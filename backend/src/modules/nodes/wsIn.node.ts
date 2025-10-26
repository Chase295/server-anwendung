import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject, USOUtils } from '../../types/USO';
import { AppLogger } from '../../common/logger';

/**
 * WSInNode - WebSocket Input Node
 * Erstellt einen externen WebSocket-Endpunkt und leitet Daten in den Flow
 */
export class WSInNode extends BaseNode {
  private readonly logger = new AppLogger('WSInNode');
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private flowEmitter: EventEmitter | null = null;
  
  // State für USO-Protokoll (Header → Payload)
  private clientStates: Map<string, { 
    awaitingPayload: boolean; 
    header: any;
  }> = new Map();
  
  // State für Raw Audio Mode (Session-ID pro Client)
  private rawAudioSessions: Map<string, string> = new Map();
  
  // Vosk-Verbindungen für Raw Audio Mode (direkte WebSocket-Verbindungen)
  private voskConnections: Map<string, WebSocket> = new Map();

  async start(): Promise<void> {
    // Stelle sicher dass alter Server geschlossen ist
    if (this.wss) {
      this.logger.warn('WSIn server already running, closing old server first', { nodeId: this.id });
      
      // Schließe alle bestehenden Client-Verbindungen
      this.clients.forEach((ws, clientId) => {
        ws.removeAllListeners();
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Server restarting');
        }
      });
      this.clients.clear();
      this.clientStates.clear();
      
      // Schließe Server
      this.wss.removeAllListeners();
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }

    this.isRunning = true;
    
    const port = this.config.port || 8081;
    const path = this.config.path || '/ws/external';

    try {
      // WebSocket-Server erstellen
      this.wss = new WebSocket.Server({ 
        port,
        path,
      });

      this.wss.on('connection', (ws: WebSocket, req) => {
        this.handleConnection(ws, req);
      });

      this.wss.on('error', (error) => {
        this.logger.error('WSIn server error', error.message, { nodeId: this.id });
      });

      this.logger.info('WSIn node started', {
        nodeId: this.id,
        port,
        path,
        expectedType: this.config.dataType,
        rawAudioMode: this.config.rawAudioMode || false,
      });
    } catch (error) {
      this.logger.error('Failed to start WSIn server', error.message, { nodeId: this.id });
      throw error;
    }
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    // WICHTIG: Diese Node ist eine Entry-Node (empfängt keine USOs von anderen Nodes)
    // Der emitter wird hier gespeichert für spätere Verwendung
    // ABER: process() wird nur aufgerufen wenn die Node Daten empfängt!
    // Für Entry-Nodes müssen wir den emitter anders übergeben
    if (!this.flowEmitter) {
      this.flowEmitter = emitter;
    }
  }
  
  /**
   * Setzt den Flow-Emitter (wird von Flow-Engine aufgerufen)
   * WICHTIG: Für Entry-Nodes wie WSIn, da process() nicht aufgerufen wird
   */
  setFlowEmitter(emitter: EventEmitter): void {
    this.flowEmitter = emitter;
  }

  /**
   * Behandelt neue WebSocket-Verbindungen
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress || 'unknown';

    this.clients.set(clientId, ws);

    this.logger.info('WSIn client connected', {
      nodeId: this.id,
      clientId,
      clientIp,
      totalClients: this.clients.size,
    });

    // Health-Status-Änderung emittieren
    this.emitHealthStatusChange();

    // Message-Handler
    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(clientId, data);
    });

    // Close-Handler
    ws.on('close', () => {
      this.clients.delete(clientId);
      this.clientStates.delete(clientId); // State aufräumen
      this.rawAudioSessions.delete(clientId); // Raw Audio Session aufräumen
      this.logger.info('WSIn client disconnected', {
        nodeId: this.id,
        clientId,
        remainingClients: this.clients.size,
      });
      
      // Health-Status-Änderung emittieren
      this.emitHealthStatusChange();
    });

    // Error-Handler
    ws.on('error', (error) => {
      this.logger.error('WSIn client error', error.message, {
        nodeId: this.id,
        clientId,
      });
    });

    // Willkommensnachricht
    ws.send(JSON.stringify({
      type: 'welcome',
      nodeId: this.id,
      clientId,
      timestamp: Date.now(),
    }));
  }

  /**
   * Erweitert Context um aktuelle Uhrzeit, falls nicht vorhanden
   */
  private enrichContextWithTime(context: any): any {
    if (!context) {
      context = {};
    }
    
    // Füge aktuelle Uhrzeit hinzu, falls nicht vorhanden
    if (!context.time) {
      const now = new Date();
      context.time = now.toISOString().replace('T', ' ').substring(0, 19);
    }
    
    return context;
  }

  /**
   * Behandelt rohe Audio-Daten (Raw Audio Mode)
   * Erstellt automatisch USO-Header für Audio-Daten
   */
  private handleRawAudio(clientId: string, data: WebSocket.Data): void {
    try {
      // Konvertiere zu Buffer
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
      
      // Hole oder erstelle Session-ID für diesen Client
      let sessionId = this.rawAudioSessions.get(clientId);
      if (!sessionId) {
        sessionId = `raw_audio_${clientId}_${Date.now()}`;
        this.rawAudioSessions.set(clientId, sessionId);
        
        this.logger.info('WSIn started new raw audio session', {
          nodeId: this.id,
          clientId,
          sessionId,
        });
      }
      
      // Context nur hinzufügen wenn includeContext aktiviert ist (default: true)
      const includeContext = this.config.includeContext !== false;
      const contextData = includeContext ? this.enrichContextWithTime({}) : undefined;
      
      const uso = USOUtils.create('audio', this.id, buffer, false, {
        id: sessionId,
        audioMeta: {
          sampleRate: this.config.sampleRate || 16000,
          channels: this.config.channels || 1,
          encoding: this.config.encoding || 'pcm_s16le',
          bitDepth: 16,
          format: 'int16',
          endianness: 'little'
        },
        websocketInfo: {
          connectionId: clientId,
          clientIp: 'external',
          connectedAt: Date.now(),
        },
        context: contextData, // Context nur wenn aktiviert
      });

      this.logger.debug('WSIn received raw audio', {
        nodeId: this.id,
        clientId,
        bufferSize: buffer.length,
        sessionId,
        hasContext: !!contextData,
      });

      // USO an Flow weiterleiten
      if (this.flowEmitter) {
        this.logger.debug('🔄 WSIn emitting audio USO to flow', {
          nodeId: this.id,
          sessionId,
          hasFlowEmitter: !!this.flowEmitter,
        });
        this.emitOutput(this.flowEmitter, uso);
      } else {
        this.logger.warn('⚠️ WSIn has no flowEmitter, cannot emit audio', {
          nodeId: this.id,
          sessionId,
        });
      }
    } catch (error) {
      this.logger.error('Error handling raw audio', error.message, {
        nodeId: this.id,
        clientId,
      });
    }
  }

  /**
   * Behandelt eingehende Messages (USO-Protokoll: Header → Payload ODER Raw Audio Mode)
   */
  private handleMessage(clientId: string, data: WebSocket.Data): void {
    try {
      const clientState = this.clientStates.get(clientId) || { awaitingPayload: false, header: null };
      
      // Prüfe ob Raw Audio Mode aktiviert ist
      const rawAudioMode = this.config.rawAudioMode === true;
      const dataType = this.config.dataType || 'text';
      
      this.logger.debug('WSIn received message', {
        nodeId: this.id,
        clientId,
        rawAudioMode,
        dataType,
        configRawAudioMode: this.config.rawAudioMode,
        dataLength: Buffer.isBuffer(data) ? data.length : data.toString().length,
      });
      
      // Prüfe ob Raw Audio Mode aktiviert ist UND Datentyp ist Audio
      if (rawAudioMode && dataType === 'audio') {
        // Raw Audio Mode: Direkte Audio-Daten ohne USO-Protokoll
        this.handleRawAudio(clientId, data);
        return;
      }
      
      if (!clientState.awaitingPayload) {
        // Phase 1: Header empfangen
        try {
          const headerStr = data.toString();
          const header = JSON.parse(headerStr);
          
          // Validiere Header
          if (!USOUtils.validateHeader(header)) {
            this.logger.warn('Invalid USO header received', {
              nodeId: this.id,
              clientId,
            });
            return;
          }
          
          // Speichere Header und warte auf Payload
          this.clientStates.set(clientId, {
            awaitingPayload: true,
            header,
          });
          
          this.logger.debug('WSIn received header', {
            nodeId: this.id,
            clientId,
            type: header.type,
            hasContext: !!header.context,
          });
        } catch (error) {
          this.logger.error('Error parsing header', error.message, {
            nodeId: this.id,
            clientId,
          });
        }
      } else {
        // Phase 2: Payload empfangen
        const header = clientState.header;
        const dataType = this.config.dataType || header.type || 'text';
        let uso: UniversalStreamObject;

        if (dataType === 'text' || header.type === 'text') {
          // Text-Payload
          const text = data.toString();
          
          // Context nur hinzufügen wenn includeContext aktiviert ist (default: true)
          const includeContext = this.config.includeContext !== false;
          const contextData = includeContext ? this.enrichContextWithTime(header.context) : undefined;
          
          // USO erstellen und Context aus Client-Header übernehmen (mit automatischer Uhrzeit)
          uso = USOUtils.create('text', this.id, text, header.final, {
            id: header.id,
            websocketInfo: {
              connectionId: clientId,
              clientIp: 'external',
              connectedAt: Date.now(),
            },
            context: contextData, // Context nur wenn aktiviert
          });

          this.logger.info('WSIn received text', {
            nodeId: this.id,
            clientId,
            textLength: text.length,
            hasContext: !!header.context,
            context: header.context,
          });
        } else if (dataType === 'audio' || header.type === 'audio') {
          // Audio-Payload
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
          
          // Context nur hinzufügen wenn includeContext aktiviert ist (default: true)
          const includeContext = this.config.includeContext !== false;
          const contextData = includeContext ? this.enrichContextWithTime(header.context) : undefined;
          
          uso = USOUtils.create('audio', this.id, buffer, header.final, {
            id: header.id,
            audioMeta: header.audioMeta || {
              sampleRate: this.config.sampleRate || 16000,
              channels: this.config.channels || 1,
              encoding: this.config.encoding || 'pcm_s16le',
            },
            websocketInfo: {
              connectionId: clientId,
              clientIp: 'external',
              connectedAt: Date.now(),
            },
            context: contextData, // Context nur wenn aktiviert
          });

          this.logger.debug('WSIn received audio', {
            nodeId: this.id,
            clientId,
            bufferSize: buffer.length,
            hasContext: !!header.context,
          });
        } else {
          // Raw/JSON-Payload
          const jsonData = typeof data === 'string' ? data : data.toString();
          
          // Context nur hinzufügen wenn includeContext aktiviert ist (default: true)
          const includeContext = this.config.includeContext !== false;
          const contextData = includeContext ? this.enrichContextWithTime(header.context) : undefined;
          
          uso = USOUtils.create('text', this.id, jsonData, header.final, {
            id: header.id,
            websocketInfo: {
              connectionId: clientId,
              clientIp: 'external',
              connectedAt: Date.now(),
            },
            context: contextData, // Context nur wenn aktiviert
          });

          this.logger.info('WSIn received raw data', {
            nodeId: this.id,
            clientId,
            dataLength: jsonData.length,
            hasContext: !!header.context,
          });
        }

        // State zurücksetzen
        this.clientStates.set(clientId, { awaitingPayload: false, header: null });

        // USO an Flow weiterleiten
        if (this.flowEmitter) {
          this.emitOutput(this.flowEmitter, uso);
        }
      }
    } catch (error) {
      this.logger.error('Error handling WSIn message', error.message, {
        nodeId: this.id,
        clientId,
      });
      
      // State zurücksetzen bei Fehler
      this.clientStates.set(clientId, { awaitingPayload: false, header: null });
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    // Alle Clients schließen und Event-Handler entfernen
    this.clients.forEach((ws, clientId) => {
      // Entferne Event-Handler
      ws.removeAllListeners();
      
      // Schließe Verbindung
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server stopping'); // 1000 = Normal closure
      }
      
      this.logger.debug('Closing WSIn client', { nodeId: this.id, clientId });
    });
    this.clients.clear();
    this.clientStates.clear(); // States aufräumen
    this.rawAudioSessions.clear(); // Raw Audio Sessions aufräumen

    // Server schließen (WICHTIG: warten bis wirklich geschlossen!)
    if (this.wss) {
      // Entferne Server-Event-Handler
      this.wss.removeAllListeners();
      
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          this.logger.info('WSIn server closed', { nodeId: this.id });
          resolve();
        });
      });
      this.wss = null;
    }

    this.flowEmitter = null;
    this.logger.info('WSIn node stopped', { nodeId: this.id });
  }

  /**
   * Test-Verbindung (prüft ob Port verfügbar ist)
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const port = this.config.port || 8081;
      const path = this.config.path || '/ws/external';

      if (this.isRunning && this.wss) {
        return {
          success: true,
          message: `WebSocket-Endpunkt aktiv auf Port ${port}${path}`,
        };
      }

      return {
        success: true,
        message: `Wird auf Port ${port}${path} gestartet`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Test fehlgeschlagen: ${error.message}`,
      };
    }
  }

  getHealthStatus(): { status: 'healthy' | 'degraded' | 'error'; message?: string; connectedClients?: number } {
    if (!this.isRunning || !this.wss) {
      return { status: 'error', message: 'Server not running', connectedClients: 0 };
    }

    const clientCount = this.clients.size;

    return {
      status: 'healthy',
      message: `${clientCount} client(s) connected`,
      connectedClients: clientCount,
    };
  }

  /**
   * Emittiert Health-Status-Änderung
   */
  private emitHealthStatusChange(): void {
    if (!this.flowEmitter) {
      return;
    }

    const healthStatus = this.getHealthStatus();
    
    this.flowEmitter.emit('node:health-status-change', {
      nodeId: this.id,
      nodeType: this.type,
      status: healthStatus.status,
      message: healthStatus.message,
      connectedClients: healthStatus.connectedClients,
      timestamp: Date.now(),
    });

    this.logger.debug('WSIn health status changed', {
      nodeId: this.id,
      status: healthStatus.status,
      connectedClients: healthStatus.connectedClients,
    });
  }

  /**
   * Hilfsfunktionen
   */
  private generateClientId(): string {
    return `wsin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gibt Endpunkt-URL zurück
   */
  getEndpointUrl(): string {
    const port = this.config.port || 8081;
    const path = this.config.path || '/ws/external';
    return `ws://localhost:${port}${path}`;
  }
}

