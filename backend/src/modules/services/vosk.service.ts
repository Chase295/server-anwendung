import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { AppLogger } from '../../common/logger';
import { EventEmitter } from 'events';

/**
 * VoskService - Wrapper für Vosk Speech-to-Text Server
 * Verwaltet WebSocket-Verbindungen zum externen Vosk-Server
 */
@Injectable()
export class VoskService {
  private readonly logger = new AppLogger('VoskService');
  private connections: Map<string, VoskConnection> = new Map();
  private reconnectAttempts = 3;
  private reconnectDelay = 2000;

  /**
   * Erstellt eine neue WebSocket-Verbindung zum Vosk-Server
   */
  async connect(sessionId: string, config: VoskConfig): Promise<VoskConnection> {
    try {
      // Prüfe ob bereits eine Verbindung existiert
      if (this.connections.has(sessionId)) {
        const existing = this.connections.get(sessionId)!;
        if (existing.ws.readyState === WebSocket.OPEN) {
          return existing;
        }
        // Alte Verbindung schließen
        existing.ws.close();
        this.connections.delete(sessionId);
      }

      this.logger.info('Connecting to Vosk server', { sessionId, url: config.serviceUrl });

      const ws = new WebSocket(config.serviceUrl);
      const emitter = new EventEmitter();
      let isConnected = false;

      const connection: VoskConnection = {
        sessionId,
        ws,
        emitter,
        config,
        lastActivity: Date.now(),
        isReady: false,
      };

      // Connection Promise
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Vosk connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          isConnected = true;
          connection.isReady = true;
          
          // Sende Konfiguration an Vosk
          const initConfig = {
            config: {
              sample_rate: config.sampleRate || 16000,
              words: config.words || false,
            },
          };
          ws.send(JSON.stringify(initConfig));
          
          this.logger.info('Vosk connection established', { sessionId });
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.logger.error('Vosk connection error', error.message, { sessionId });
          if (!isConnected) {
            reject(error);
          }
        });

        ws.on('close', () => {
          this.logger.info('Vosk connection closed', { sessionId });
          this.connections.delete(sessionId);
          emitter.emit('close');
        });

        ws.on('message', (data: Buffer) => {
          try {
            const result = JSON.parse(data.toString());
            
            // Vosk sendet partielle und finale Ergebnisse
            if (result.partial) {
              emitter.emit('partial', result.partial);
            }
            
            if (result.text) {
              emitter.emit('result', {
                text: result.text,
                final: true,
                confidence: result.confidence || 1.0,
              });
            }
          } catch (error) {
            this.logger.error('Error parsing Vosk response', error.message, { sessionId });
          }
        });
      });

      this.connections.set(sessionId, connection);
      return connection;
    } catch (error) {
      this.logger.error('Failed to connect to Vosk', error.message, { sessionId });
      throw error;
    }
  }

  /**
   * Sendet Audio-Daten an Vosk
   */
  async sendAudio(sessionId: string, audioBuffer: Buffer): Promise<void> {
    const connection = this.connections.get(sessionId);

    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Vosk connection not available');
    }

    try {
      connection.ws.send(audioBuffer);
      connection.lastActivity = Date.now();
    } catch (error) {
      this.logger.error('Error sending audio to Vosk', error.message, { sessionId });
      throw error;
    }
  }

  /**
   * Signalisiert das Ende des Audio-Streams
   */
  async finalize(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);

    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Sende EOF-Signal an Vosk
      connection.ws.send(JSON.stringify({ eof: 1 }));
      this.logger.debug('Sent EOF to Vosk', { sessionId });
    } catch (error) {
      this.logger.error('Error finalizing Vosk stream', error.message, { sessionId });
    }
  }

  /**
   * Schließt die Verbindung
   */
  disconnect(sessionId: string): void {
    const connection = this.connections.get(sessionId);

    if (connection) {
      connection.ws.close();
      this.connections.delete(sessionId);
      this.logger.info('Vosk connection disconnected', { sessionId });
    }
  }

  /**
   * Health-Check: Testet die Verbindung zum Vosk-Server
   */
  async testConnection(serviceUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const testSessionId = `test_${Date.now()}`;
      const ws = new WebSocket(serviceUrl);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            success: false,
            message: 'Connection timeout - Vosk server nicht erreichbar',
          });
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve({
            success: true,
            message: 'Verbindung zum Vosk-Server erfolgreich',
          });
        });

        ws.on('error', (error) => {
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
        message: `Fehler beim Verbindungstest: ${error.message}`,
      };
    }
  }

  /**
   * Gibt eine Verbindung zurück
   */
  getConnection(sessionId: string): VoskConnection | undefined {
    return this.connections.get(sessionId);
  }

  /**
   * Cleanup aller Verbindungen
   */
  cleanup(): void {
    this.connections.forEach((connection) => {
      connection.ws.close();
    });
    this.connections.clear();
    this.logger.info('All Vosk connections cleaned up');
  }
}

/**
 * Vosk-Konfiguration
 */
export interface VoskConfig {
  serviceUrl: string;
  sampleRate?: number;
  language?: string;
  words?: boolean;
}

/**
 * Vosk-Verbindung
 */
export interface VoskConnection {
  sessionId: string;
  ws: WebSocket;
  emitter: EventEmitter;
  config: VoskConfig;
  lastActivity: number;
  isReady: boolean;
}

