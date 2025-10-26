import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as WebSocket from 'ws';
import * as http from 'http';
import { AppLogger } from '../../common/logger';

/**
 * WebSocket-Gateway für Frontend-Debug-Events
 * Sendet Live-Events von Debug-Nodes an das Frontend
 */
@Injectable()
export class DebugEventsGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new AppLogger('DebugEventsGateway');
  private wss: WebSocket.Server;
  private server: http.Server;
  private clients: Set<WebSocket> = new Set();
  private latestHealthStatus: Map<string, HealthStatusEvent> = new Map(); // nodeId -> Health Status
  private eventCache: DebugEvent[] = []; // Cache für Debug-Events (HTTP-Zugriff)
  private readonly maxCachedEvents = 200;

  async onModuleInit() {
    const port = parseInt(process.env.DEBUG_EVENTS_PORT || '8082', 10);

    // HTTP-Server für WebSocket
    this.server = http.createServer();

    // WebSocket-Server erstellen
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.server.listen(port, () => {
      this.logger.info(`Debug Events WebSocket server listening on port ${port}`);
    });
  }

  async onModuleDestroy() {
    this.logger.info('Shutting down Debug Events WebSocket server...');

    // Alle Clients schließen
    this.clients.forEach((ws) => {
      ws.close();
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
   * Behandelt neue WebSocket-Verbindungen vom Frontend
   */
  private handleConnection(ws: WebSocket) {
    this.logger.info('Frontend client connected for debug events');

    this.clients.add(ws);

    // Pong-Handler
    ws.on('pong', () => {
      // Keep-alive
    });

    // Message-Handler (z.B. für Filter-Settings)
    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.logger.debug('Received message from frontend', message);
        
        // TODO: Filter-Settings verarbeiten
      } catch (error) {
        this.logger.error('Error parsing frontend message', error.message);
      }
    });

    // Close-Handler
    ws.on('close', () => {
      this.logger.info('Frontend client disconnected');
      this.clients.delete(ws);
    });

    // Error-Handler
    ws.on('error', (error) => {
      this.logger.error('WebSocket error', error.message);
      this.clients.delete(ws);
    });

    // Willkommensnachricht
    this.sendToClient(ws, {
      type: 'welcome',
      timestamp: Date.now(),
      message: 'Connected to Debug Events stream',
    });

    // Sende initiale Health Status für alle Nodes
    this.sendInitialHealthStatus(ws);
  }

  /**
   * Sendet die aktuellen Health Status aller Nodes an einen neuen Client
   */
  private sendInitialHealthStatus(ws: WebSocket): void {
    if (this.latestHealthStatus.size === 0) {
      this.logger.debug('No health status to send (no active nodes yet)');
      return;
    }

    let sentCount = 0;
    this.latestHealthStatus.forEach((event) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: 'health:status',
          event,
          timestamp: Date.now(),
        });
        sentCount++;
      }
    });

    if (sentCount > 0) {
      this.logger.info(`Sent ${sentCount} initial health status event(s) to new client`);
    }
  }

  /**
   * Sendet ein Debug-Event an alle verbundenen Frontend-Clients
   */
  broadcastDebugEvent(event: DebugEvent): void {
    // Cache Event für HTTP-Zugriff
    this.eventCache.unshift(event);
    if (this.eventCache.length > this.maxCachedEvents) {
      this.eventCache = this.eventCache.slice(0, this.maxCachedEvents);
    }

    const message = JSON.stringify({
      type: 'debug:event',
      event,
      timestamp: Date.now(),
    });

    let sentCount = 0;
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      this.logger.debug(`Broadcasted debug event to ${sentCount} client(s)`, {
        flowId: event.flowId,
        nodeId: event.nodeId,
      });
    }
  }

  /**
   * Holt gecachte Debug-Events für HTTP-Zugriff
   */
  getCachedEvents(flowId?: string, since?: number): DebugEvent[] {
    let events = this.eventCache;
    
    // Filter nach flowId
    if (flowId) {
      events = events.filter(e => e.flowId === flowId);
    }
    
    // Filter nach Zeit
    if (since) {
      events = events.filter(e => e.timestamp >= since);
    }
    
    return events;
  }

  /**
   * Sendet ein Health-Status-Event an alle verbundenen Frontend-Clients
   * Speichert auch den aktuellen Status für neue Clients
   */
  broadcastHealthStatus(event: HealthStatusEvent): void {
    // Speichere den aktuellen Health Status für diesen Node
    this.latestHealthStatus.set(event.nodeId, event);

    const message = JSON.stringify({
      type: 'health:status',
      event,
      timestamp: Date.now(),
    });

    let sentCount = 0;
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      this.logger.debug(`Broadcasted health status to ${sentCount} client(s)`, {
        flowId: event.flowId,
        nodeId: event.nodeId,
        status: event.status,
        connectedClients: event.connectedClients,
      });
    }
  }

  /**
   * Sendet eine Nachricht an einen spezifischen Client
   */
  private sendToClient(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Gibt die Anzahl verbundener Clients zurück
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

/**
 * Interface für Debug-Events
 */
export interface DebugEvent {
  flowId: string;
  flowName?: string;
  nodeId: string;
  nodeLabel?: string;
  timestamp: number;
  uso: {
    header: any;
    payloadType: string;
    payloadSize: number;
    payloadPreview?: string;
  };
}

/**
 * Interface für Health-Status-Events
 */
export interface HealthStatusEvent {
  flowId: string;
  flowName?: string;
  nodeId: string;
  nodeLabel?: string;
  nodeType: string;
  status: 'healthy' | 'degraded' | 'error';
  message?: string;
  connectedClients?: number;
  timestamp: number;
}

