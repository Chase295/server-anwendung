import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject, USOUtils } from '../../types/USO';
import { AppLogger } from '../../common/logger';

/**
 * WSOutNode - WebSocket Output Node
 * Sendet USO-Daten an einen externen WebSocket-Server
 */
export class WSOutNode extends BaseNode {
  private readonly logger = new AppLogger('WSOutNode');
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private flowEmitter: EventEmitter | null = null;

  async start(): Promise<void> {
    // Stelle sicher dass alte Verbindungen geschlossen sind
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    // Stoppe alte Reconnect-Timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset state
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.isRunning = true;

    await this.connect();

    this.logger.info('WSOut node started', {
      nodeId: this.id,
      targetUrl: this.config.targetUrl,
    });
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    // Flow-Emitter speichern für Health-Status-Updates
    if (!this.flowEmitter) {
      this.flowEmitter = emitter;
    }

    try {
      // Prüfe Verbindung
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.logger.warn('WSOut not connected, attempting reconnect', {
          nodeId: this.id,
          sessionId: uso.header.id,
        });

        await this.connect();

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          throw new Error('WSOut connection not available');
        }
      }

      // Daten senden
      await this.sendData(uso);

      this.logger.debug('WSOut data sent', {
        nodeId: this.id,
        sessionId: uso.header.id,
        usoType: uso.header.type,
        payloadSize: uso.payload.length,
      });
    } catch (error) {
      this.logger.error('Error in WSOut processing', error.message, {
        nodeId: this.id,
        sessionId: uso.header.id,
      });

      // Nicht den kompletten Flow abbrechen, nur loggen
      // Optional: Fehler-USO emittieren
      if (this.config.emitErrors) {
        this.emitError(emitter, error, uso.header.id);
      }
    }
  }

  /**
   * Setzt den Flow-Emitter (wird von Flow-Engine aufgerufen)
   */
  setFlowEmitter(emitter: EventEmitter): void {
    this.flowEmitter = emitter;
  }

  /**
   * Stellt Verbindung zum externen WebSocket-Server her
   */
  private async connect(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const targetUrl = this.config.targetUrl;

      if (!targetUrl) {
        throw new Error('No target URL configured');
      }

      this.logger.info('Connecting to external WebSocket', {
        nodeId: this.id,
        targetUrl,
        attempt: this.reconnectAttempts + 1,
      });

      this.ws = new WebSocket(targetUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.on('open', () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          this.isConnecting = false;

          this.logger.info('WSOut connected', {
            nodeId: this.id,
            targetUrl,
          });

          // Health-Status-Änderung emittieren
          this.emitHealthStatusChange();

          resolve();
        });

        this.ws!.on('error', (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;

          this.logger.error('WSOut connection error', error.message, {
            nodeId: this.id,
            targetUrl,
          });

          // Health-Status-Änderung emittieren
          this.emitHealthStatusChange();

          reject(error);
        });

        this.ws!.on('close', () => {
          this.logger.warn('WSOut connection closed', {
            nodeId: this.id,
            targetUrl,
          });

          // Health-Status-Änderung emittieren
          this.emitHealthStatusChange();

          this.handleReconnect();
        });

        this.ws!.on('message', (data) => {
          // Optional: Behandle Antworten vom Server
          const dataLength = Buffer.isBuffer(data) ? data.length : 
                            (data instanceof ArrayBuffer ? data.byteLength : 0);
          this.logger.debug('WSOut received message', {
            nodeId: this.id,
            dataLength,
          });
        });
      });
    } catch (error) {
      this.isConnecting = false;
      this.logger.error('Failed to connect WSOut', error.message, {
        nodeId: this.id,
      });

      // Reconnect versuchen
      this.handleReconnect();
      throw error;
    }
  }

  /**
   * Sendet Daten an externen WebSocket
   */
  private async sendData(uso: UniversalStreamObject): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const sendFormat = this.config.sendFormat || 'uso_full';
    const dataType = this.config.dataType || uso.header.type || 'text';

    switch (sendFormat) {
      case 'content_only':
        // NUR der reine Content (Text/Daten) - keine Metadaten, kein Context
        if (dataType === 'text' || uso.header.type === 'text') {
          // Bei Text: Nur den reinen String senden
          const content = typeof uso.payload === 'string' ? uso.payload : uso.payload.toString();
          this.ws.send(content);
        } else if (dataType === 'audio' || uso.header.type === 'audio') {
          // Bei Audio: Nur die rohen Audio-Daten senden
          const audioBuffer = Buffer.isBuffer(uso.payload) ? uso.payload : Buffer.from(uso.payload);
          this.ws.send(audioBuffer);
        } else {
          // Raw/Binär: Payload direkt senden
          if (typeof uso.payload === 'string') {
            this.ws.send(uso.payload);
          } else {
            this.ws.send(uso.payload);
          }
        }
        
        this.logger.debug('WSOut sent content only', {
          nodeId: this.id,
          dataType,
          contentLength: typeof uso.payload === 'string' ? uso.payload.length : uso.payload.length,
        });
        break;

      case 'payload_only':
        // Nur Payload senden (kann noch Strukturen enthalten)
        if (typeof uso.payload === 'string') {
          this.ws.send(uso.payload);
        } else {
          this.ws.send(uso.payload);
        }
        break;

      case 'uso_full':
        // Komplettes USO als JSON senden
        const fullUso = {
          header: uso.header,
          payload: Buffer.isBuffer(uso.payload) 
            ? uso.payload.toString('base64') 
            : uso.payload,
        };
        this.ws.send(JSON.stringify(fullUso));
        break;

      case 'header_then_payload':
        // Erst Header, dann Payload (ähnlich wie ESP32)
        this.ws.send(USOUtils.serializeHeader(uso.header));
        if (uso.payload && uso.payload.length > 0) {
          this.ws.send(uso.payload);
        }
        break;

      default:
        throw new Error(`Unknown send format: ${sendFormat}`);
    }
  }

  /**
   * Reconnect-Logik
   */
  private handleReconnect(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts reached for node ${this.id} after ${this.reconnectAttempts} attempts`
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.logger.info('Scheduling reconnect', {
      nodeId: this.id,
      attempt: this.reconnectAttempts,
      delay: `${delay}ms`,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error('Reconnect failed', error.message, {
          nodeId: this.id,
        });
      });
    }, delay);
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    // Stoppe Reconnect-Timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Schließe WebSocket und entferne alle Event-Handler
    if (this.ws) {
      // Entferne alle Event-Listener vor dem Schließen
      // um zu verhindern dass der close-Handler reconnect auslöst
      this.ws.removeAllListeners();
      
      // Schließe Verbindung
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Node stopped'); // 1000 = Normal closure
      }
      
      this.ws = null;
      
      this.logger.debug('WSOut WebSocket closed and cleaned up', { nodeId: this.id });
    }

    // Reset reconnect attempts
    this.reconnectAttempts = 0;
    this.isConnecting = false;

    this.flowEmitter = null;
    this.logger.info('WSOut node stopped', { nodeId: this.id });
  }

  /**
   * Test der Verbindung
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const targetUrl = this.config.targetUrl;

      if (!targetUrl) {
        return {
          success: false,
          message: 'Keine Ziel-URL konfiguriert',
        };
      }

      // Test-Verbindung
      const testWs = new WebSocket(targetUrl);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          testWs.close();
          resolve({
            success: false,
            message: 'Connection timeout',
          });
        }, 5000);

        testWs.on('open', () => {
          clearTimeout(timeout);
          testWs.close();
          resolve({
            success: true,
            message: 'Verbindung erfolgreich',
          });
        });

        testWs.on('error', (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            message: `Verbindungsfehler: ${error.message}`,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        message: `Test fehlgeschlagen: ${error.message}`,
      };
    }
  }

  getHealthStatus(): { status: 'healthy' | 'degraded' | 'error'; message?: string; isConnected?: boolean } {
    if (!this.isRunning) {
      return { status: 'error', message: 'Node not running', isConnected: false };
    }

    if (!this.config.targetUrl) {
      return { status: 'error', message: 'No target URL configured', isConnected: false };
    }

    const isConnected = this.ws !== null && this.ws.readyState === WebSocket.OPEN;

    if (!isConnected) {
      if (this.reconnectAttempts > 0) {
        return {
          status: 'degraded',
          message: `Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
          isConnected: false,
        };
      }
      return { status: 'error', message: 'Not connected', isConnected: false };
    }

    return {
      status: 'healthy',
      message: 'Connected and ready',
      isConnected: true,
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
      isConnected: healthStatus.isConnected,
      timestamp: Date.now(),
    });

    this.logger.debug('WSOut health status changed', {
      nodeId: this.id,
      status: healthStatus.status,
      isConnected: healthStatus.isConnected,
    });
  }
}

