import { EventEmitter } from 'events';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject, USOUtils } from '../../types/USO';
import { AppLogger } from '../../common/logger';
import { VoskService, VoskConnection } from '../services/vosk.service';

/**
 * STTNode - Speech-to-Text Node
 * Konvertiert Audio-Streams zu Text mittels Vosk
 */
export class STTNode extends BaseNode {
  private readonly logger = new AppLogger('STTNode');
  private voskService: VoskService;
  private activeConnections: Map<string, VoskConnection> = new Map();

  constructor(id: string, type: string, config: Record<string, any>, voskService: VoskService) {
    super(id, type, config);
    this.voskService = voskService;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('STT node started', {
      nodeId: this.id,
      serviceUrl: this.config.serviceUrl,
    });
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    try {
      // Nur Audio-USOs akzeptieren
      if (uso.header.type !== 'audio') {
        this.logger.warn('STT node received non-audio USO', {
          nodeId: this.id,
          receivedType: uso.header.type,
          sessionId: uso.header.id,
        });
        return;
      }

      const sessionId = uso.header.id;

      // Vosk-Verbindung holen oder erstellen
      let connection = this.activeConnections.get(sessionId);

      if (!connection) {
        connection = await this.connectToVosk(sessionId, emitter);
        this.activeConnections.set(sessionId, connection);
      }

      // Audio-Daten senden
      if (Buffer.isBuffer(uso.payload) && uso.payload.length > 0) {
        await this.voskService.sendAudio(sessionId, uso.payload);

        this.logger.debug('Audio sent to Vosk', {
          nodeId: this.id,
          sessionId,
          bufferSize: uso.payload.length,
        });
      }

      // Wenn finales Frame, finalize und cleanup
      if (uso.header.final) {
        await this.voskService.finalize(sessionId);
        
        // Warte kurz auf finale Ergebnisse
        setTimeout(() => {
          this.cleanup(sessionId);
        }, 1000);

        this.logger.info('STT processing finalized', {
          nodeId: this.id,
          sessionId,
        });
      }
    } catch (error) {
      this.logger.error('Error in STT node processing', error.message, {
        nodeId: this.id,
        sessionId: uso.header.id,
      });

      this.emitError(emitter, error, uso.header.id);
      this.cleanup(uso.header.id);
    }
  }

  /**
   * Erstellt Vosk-Verbindung und registriert Event-Listener
   */
  private async connectToVosk(
    sessionId: string,
    emitter: EventEmitter
  ): Promise<VoskConnection> {
    try {
      const connection = await this.voskService.connect(sessionId, {
        serviceUrl: this.config.serviceUrl || 'ws://localhost:2700',
        sampleRate: this.config.sampleRate || 16000,
        language: this.config.language || 'de',
        words: this.config.words || false,
      });

      // Event-Listener für Vosk-Ergebnisse
      connection.emitter.on('partial', (partialText: string) => {
        if (this.config.emitPartialResults) {
          // Partielle Ergebnisse als USO emittieren
          const partialUso = USOUtils.create(
            'text',
            this.id,
            partialText,
            false,
            {
              id: sessionId,
              speakerInfo: {
                confidence: 0.5, // Partielle Ergebnisse haben niedrigere Confidence
              },
            }
          );

          this.emitOutput(emitter, partialUso);

          this.logger.debug('Partial STT result', {
            nodeId: this.id,
            sessionId,
            text: partialText.substring(0, 50),
          });
        }
      });

      connection.emitter.on('result', (result: { text: string; final: boolean; confidence: number }) => {
        // Finales Ergebnis als USO emittieren
        const textUso = USOUtils.create(
          'text',
          this.id,
          result.text,
          result.final,
          {
            id: sessionId,
            speakerInfo: {
              confidence: result.confidence,
              language: this.config.language || 'de',
            },
          }
        );

        this.emitOutput(emitter, textUso);

        this.logger.info('STT result', {
          nodeId: this.id,
          sessionId,
          text: result.text,
          confidence: result.confidence,
          final: result.final,
        });
      });

      connection.emitter.on('close', () => {
        this.activeConnections.delete(sessionId);
        this.logger.info('Vosk connection closed', { nodeId: this.id, sessionId });
      });

      return connection;
    } catch (error) {
      this.logger.error('Failed to connect to Vosk', error.message, {
        nodeId: this.id,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Cleanup für Session
   */
  private cleanup(sessionId: string): void {
    this.voskService.disconnect(sessionId);
    this.activeConnections.delete(sessionId);
  }

  async stop(): Promise<void> {
    // Alle Verbindungen schließen
    this.activeConnections.forEach((_, sessionId) => {
      this.voskService.disconnect(sessionId);
    });
    this.activeConnections.clear();

    this.isRunning = false;
    this.logger.info('STT node stopped', { nodeId: this.id });
  }

  /**
   * Test der Vosk-Verbindung
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const serviceUrl = this.config.serviceUrl || 'ws://localhost:2700';
      return await this.voskService.testConnection(serviceUrl);
    } catch (error) {
      return {
        success: false,
        message: `Test fehlgeschlagen: ${error.message}`,
      };
    }
  }

  getHealthStatus(): { status: 'healthy' | 'degraded' | 'error'; message?: string } {
    if (!this.isRunning) {
      return { status: 'error', message: 'Node is not running' };
    }

    const activeCount = this.activeConnections.size;

    if (activeCount > 0) {
      return {
        status: 'healthy',
        message: `${activeCount} active Vosk connection(s)`,
      };
    }

    return {
      status: 'healthy',
      message: 'Ready for audio input',
    };
  }
}

