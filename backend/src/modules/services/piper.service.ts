import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { AppLogger } from '../../common/logger';
import { EventEmitter } from 'events';

/**
 * PiperService - Wrapper für Piper Text-to-Speech Server
 * Verwendet WebSocket-Verbindung (wie vosk-mic-test.py und piper_test.py)
 */
@Injectable()
export class PiperService {
  private readonly logger = new AppLogger('PiperService');
  private connections: Map<string, PiperConnection> = new Map();
  private reconnectAttempts = 3;
  private reconnectDelay = 2000;

  /**
   * Erstellt eine neue WebSocket-Verbindung zum Piper-Server
   */
  async connect(sessionId: string, config: PiperConfig): Promise<PiperConnection> {
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

      this.logger.info('Connecting to Piper server', { sessionId, url: config.serviceUrl });

      const ws = new WebSocket(config.serviceUrl);
      const emitter = new EventEmitter();
      let isConnected = false;

      const connection: PiperConnection = {
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
          reject(new Error('Piper connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          isConnected = true;
          connection.isReady = true;
          
          this.logger.info('Piper connection established', { sessionId });
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.logger.error('Piper connection error', error.message, { sessionId });
          if (!isConnected) {
            reject(error);
          }
        });

        ws.on('close', () => {
          this.logger.info('Piper connection closed', { sessionId });
          this.connections.delete(sessionId);
          emitter.emit('close');
        });

        ws.on('message', (data: Buffer) => {
          try {
            // Piper sendet Audio-Daten als binary
            if (Buffer.isBuffer(data) && data.length > 0) {
              connection.lastActivity = Date.now();
              emitter.emit('audio', data);
            } else {
              this.logger.warn('Piper sent unexpected message format', {
                sessionId,
                dataLength: data.length,
              });
            }
          } catch (error) {
            this.logger.error('Error handling Piper message', error.message, { sessionId });
          }
        });
      });

      this.connections.set(sessionId, connection);
      return connection;
    } catch (error) {
      this.logger.error('Failed to connect to Piper', error.message, { sessionId });
      throw error;
    }
  }

  /**
   * Sendet Text an Piper und gibt Audio-Stream zurück
   */
  async sendText(sessionId: string, text: string): Promise<void> {
    const connection = this.connections.get(sessionId);

    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Piper connection not available');
    }

    try {
      // Sende Text als Plain Text (wie piper_test.py)
      connection.ws.send(text);
      connection.lastActivity = Date.now();
      
      this.logger.debug('Text sent to Piper', {
        sessionId,
        textLength: text.length,
        text: text.substring(0, 50),
      });
    } catch (error) {
      this.logger.error('Error sending text to Piper', error.message, { sessionId });
      throw error;
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
      this.logger.info('Piper connection disconnected', { sessionId });
    }
  }

  /**
   * Holt eine bestehende Verbindung
   */
  getConnection(sessionId: string): PiperConnection | undefined {
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
    this.logger.info('All Piper connections cleaned up');
  }

  /**
   * Health-Check: Testet die Verbindung zum Piper-Server
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
            message: 'Connection timeout - Piper server nicht erreichbar',
          });
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve({
            success: true,
            message: 'Verbindung erfolgreich',
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
        message: `Verbindungsfehler: ${error.message}`,
      };
    }
  }

  /**
   * Listet verfügbare Stimmen auf (falls Piper API das unterstützt)
   */
  async listVoices(serviceUrl: string): Promise<string[]> {
    try {
      // Fallback auf bekannte Stimmen
      return [
        'de_DE-thorsten-medium',
        'de_DE-thorsten-low',
        'en_US-lessac-medium',
        'en_GB-alan-medium',
      ];
    } catch (error) {
      this.logger.warn('Could not fetch voice list from Piper', error.message);
      return [
        'de_DE-thorsten-medium',
        'de_DE-thorsten-low',
        'en_US-lessac-medium',
        'en_GB-alan-medium',
      ];
    }
  }
}

/**
 * Piper-Konfiguration
 */
export interface PiperConfig {
  serviceUrl: string;
  voiceModel?: string;
  speakerId?: number;
  lengthScale?: number;
  noiseScale?: number;
  noiseW?: number;
  sampleRate?: number;
}

/**
 * Piper-Verbindung
 */
export interface PiperConnection {
  sessionId: string;
  ws: WebSocket;
  emitter: EventEmitter;
  config: PiperConfig;
  lastActivity: number;
  isReady: boolean;
}