import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as WebSocket from 'ws';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { AppLogger } from '../../common/logger';
import { AuthService } from '../auth/auth.service';
import { DevicesService } from './devices.service';
import { USOUtils, USO_Header } from '../../types/USO';

/**
 * WebSocket-Gateway für ESP32-Clients
 * Implementiert das Binär-Streaming-Protokoll
 */
@Injectable()
export class WebSocketGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new AppLogger('WebSocketGateway');
  private wss: WebSocket.Server;
  private server: http.Server | https.Server;
  private clients: Map<string, ClientConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  
  // Event-Emitter für USO-Datenströme
  public readonly eventEmitter = new EventEmitter();

  constructor(
    private readonly authService: AuthService,
    private readonly devicesService: DevicesService,
  ) {}

  async onModuleInit() {
    const port = parseInt(process.env.WS_PORT || '8080', 10);
    const sslEnabled = process.env.WS_SSL_ENABLED === 'true';

    // Server erstellen (HTTP oder HTTPS)
    if (sslEnabled) {
      const certPath = process.env.WS_SSL_CERT_PATH;
      const keyPath = process.env.WS_SSL_KEY_PATH;

      if (!certPath || !keyPath) {
        throw new Error('SSL enabled but certificate paths not provided');
      }

      this.server = https.createServer({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      });
    } else {
      this.server = http.createServer();
    }

    // WebSocket-Server erstellen
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.server.listen(port, () => {
      this.logger.info(`WebSocket server listening on port ${port} (SSL: ${sslEnabled})`);
    });

    // Heartbeat-Mechanismus starten
    this.startHeartbeat();
  }

  async onModuleDestroy() {
    this.logger.info('Shutting down WebSocket server...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Alle Clients schließen
    this.clients.forEach((client) => {
      client.ws.close();
    });

    // Server schließen
    if (this.wss) {
      this.wss.close();
    }

    if (this.server) {
      this.server.close();
    }
  }

  /**
   * Behandelt neue WebSocket-Verbindungen
   */
  private async handleConnection(ws: WebSocket, req: http.IncomingMessage) {
    const connectionId = this.generateConnectionId();
    const clientIp = req.socket.remoteAddress || 'unknown';

    this.logger.logWebSocket('Connection attempt', { connectionId, clientIp });

    // Authentifizierung über Query-Parameter oder Header
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const clientId = url.searchParams.get('clientId');
    const clientSecret = url.searchParams.get('secret');

    if (!clientId || !clientSecret) {
      this.logger.warn('Connection rejected - missing credentials', { connectionId });
      ws.close(1008, 'Missing credentials');
      return;
    }

    // Client-Secret validieren
    const isAuthenticated = await this.authService.validateClientSecret(clientId, clientSecret);

    if (!isAuthenticated) {
      this.logger.warn('Connection rejected - authentication failed', { connectionId, clientId });
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Client-Verbindung registrieren
    const client: ClientConnection = {
      id: connectionId,
      clientId,
      ws,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      lastUSOHeader: null,
      isAlive: true,
    };

    this.clients.set(connectionId, client);

    // Device-Status aktualisieren
    await this.devicesService.updateDeviceStatus(clientId, 'online', {
      ipAddress: clientIp,
      lastSeen: new Date(),
    });

    this.logger.info('Client connected and authenticated', { connectionId, clientId });

    // Pong-Handler für Heartbeat
    ws.on('pong', () => {
      client.isAlive = true;
      client.lastHeartbeat = Date.now();
    });

    // Message-Handler
    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(client, data);
    });

    // Close-Handler
    ws.on('close', () => {
      this.handleDisconnect(client);
    });

    // Error-Handler
    ws.on('error', (error) => {
      this.logger.error('WebSocket error', error.message, { connectionId, clientId });
    });

    // Willkommensnachricht senden
    ws.send(JSON.stringify({ type: 'welcome', connectionId, timestamp: Date.now() }));
  }

  /**
   * Behandelt eingehende Messages (USO-Protokoll)
   */
  private handleMessage(client: ClientConnection, data: WebSocket.Data) {
    try {
      // Phase 1: Text-Frame = USO-Header
      if (typeof data === 'string') {
        const header = USOUtils.deserializeHeader(data);
        
        // Header validieren und speichern
        client.lastUSOHeader = header;
        
        // WebSocket-Info zum Header hinzufügen
        header.websocketInfo = {
          connectionId: client.id,
          clientIp: client.ws['_socket']?.remoteAddress || 'unknown',
          connectedAt: client.connectedAt,
        };

        this.logger.logUSO('in', { header, payload: null }, { clientId: client.clientId });

        // Wenn kein Binär-Payload erwartet wird (z.B. Control oder Text)
        if (header.type !== 'audio' || header.final) {
          const uso = { header, payload: '' };
          this.eventEmitter.emit('uso:received', uso, client);
        }
      }
      // Phase 2: Binär-Frame = Audio-Payload
      else if (Buffer.isBuffer(data)) {
        if (!client.lastUSOHeader) {
          this.logger.warn('Binary data received without header', { clientId: client.clientId });
          return;
        }

        // USO mit Header und Binär-Payload erstellen
        const uso = {
          header: client.lastUSOHeader,
          payload: data,
        };

        this.logger.debug('Binary payload received', {
          clientId: client.clientId,
          sessionId: client.lastUSOHeader.id,
          payloadSize: data.length,
        });

        this.eventEmitter.emit('uso:received', uso, client);

        // Wenn final, Header zurücksetzen
        if (client.lastUSOHeader.final) {
          client.lastUSOHeader = null;
        }
      }
    } catch (error) {
      this.logger.error('Error handling message', error.message, { clientId: client.clientId });
      
      // Error-USO senden
      const errorUso = USOUtils.createError(
        'server',
        client.lastUSOHeader?.id || 'unknown',
        error.message
      );
      this.sendUSO(client.clientId, errorUso);
    }
  }

  /**
   * Behandelt Disconnect
   */
  private async handleDisconnect(client: ClientConnection) {
    this.logger.info('Client disconnected', { 
      connectionId: client.id, 
      clientId: client.clientId 
    });

    this.clients.delete(client.id);

    // Device-Status aktualisieren
    await this.devicesService.updateDeviceStatus(client.clientId, 'offline');

    this.eventEmitter.emit('client:disconnected', client);
  }

  /**
   * Sendet ein USO an einen Client
   */
  sendUSO(clientId: string, uso: { header: USO_Header; payload: string | Buffer }): boolean {
    const client = this.findClientByClientId(clientId);

    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('Cannot send USO - client not connected', { clientId });
      return false;
    }

    try {
      // Phase 1: Header als Text-Frame senden
      const headerJson = USOUtils.serializeHeader(uso.header);
      client.ws.send(headerJson);

      // Phase 2: Payload senden (falls vorhanden)
      if (uso.payload && uso.payload.length > 0) {
        client.ws.send(uso.payload);
      }

      this.logger.logUSO('out', uso, { clientId });
      return true;
    } catch (error) {
      this.logger.error('Error sending USO', error.message, { clientId });
      return false;
    }
  }

  /**
   * Heartbeat-Mechanismus
   */
  private startHeartbeat() {
    const interval = 30000; // 30 Sekunden

    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          this.logger.warn('Client heartbeat timeout', { 
            connectionId: client.id, 
            clientId: client.clientId 
          });
          client.ws.terminate();
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, interval);

    this.logger.debug('Heartbeat mechanism started', { interval });
  }

  /**
   * Hilfsfunktionen
   */
  private findClientByClientId(clientId: string): ClientConnection | undefined {
    for (const client of this.clients.values()) {
      if (client.clientId === clientId) {
        return client;
      }
    }
    return undefined;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gibt alle verbundenen Clients zurück
   */
  getConnectedClients(): Array<{ connectionId: string; clientId: string; connectedAt: number }> {
    return Array.from(this.clients.values()).map(client => ({
      connectionId: client.id,
      clientId: client.clientId,
      connectedAt: client.connectedAt,
    }));
  }

  /**
   * Prüft ob ein Client verbunden ist
   */
  isClientConnected(clientId: string): boolean {
    return this.findClientByClientId(clientId) !== undefined;
  }
}

/**
 * Interface für Client-Verbindung
 */
interface ClientConnection {
  id: string;
  clientId: string;
  ws: WebSocket;
  connectedAt: number;
  lastHeartbeat: number;
  lastUSOHeader: USO_Header | null;
  isAlive: boolean;
}

