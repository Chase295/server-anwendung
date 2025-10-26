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
  
  // Debouncing für finale Ergebnisse
  private finalResultTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Speichert das letzte Partial-Ergebnis für jeden Session
  private lastPartialResults: Map<string, string> = new Map();
  
  // Speichert das letzte gesendete finale Text-Ergebnis für jeden Session
  private lastSentFinalText: Map<string, string> = new Map();

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

      // Audio-Daten senden (prüfe Audio-Format)
      if (Buffer.isBuffer(uso.payload) && uso.payload.length > 0) {
        // Logge Audio-Metadaten für Debugging
        this.logger.debug('Audio received for STT processing', {
          nodeId: this.id,
          sessionId,
          bufferSize: uso.payload.length,
          audioMeta: uso.header.audioMeta,
          final: uso.header.final,
        });

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
        
        this.logger.info('STT processing finalized - waiting for final result', {
          nodeId: this.id,
          sessionId,
        });

        // Warte kurz auf finale Ergebnisse und cleanup
        setTimeout(() => {
          this.cleanup(sessionId);
          this.logger.info('STT cleanup completed', {
            nodeId: this.id,
            sessionId,
          });
        }, 500); // Kurz warten auf Endergebnis
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
        words: this.config.words !== false, // Standard: true (wie vosk-mic-test.py)
      });

      // Event-Listener für Vosk-Ergebnisse
      connection.emitter.on('partial', (partialText: string) => {
        // Speichere letztes Partial-Ergebnis
        this.lastPartialResults.set(sessionId, partialText);
        
        // IMMER partielle Ergebnisse emittieren (keine Prüfung!)
        const partialUso = USOUtils.create(
          'text',
          this.id,
          partialText,
          false, // NICHT final
          {
            id: sessionId,
            speakerInfo: {
              confidence: 0.5, // Partielle Ergebnisse haben niedrigere Confidence
            },
          }
        );

        this.emitOutput(emitter, partialUso);

        this.logger.info('STT partial result (live)', {
          nodeId: this.id,
          sessionId,
          text: partialText.substring(0, 50),
        });
        
        // Neuen Timer für finale Ergebnis setzen (2 Sekunden nach letztem Partial)
        const debounceDelay = this.config.finalResultDebounceDelay || 2000;
        
        // Alten Timer löschen
        if (this.finalResultTimers.has(sessionId)) {
          clearTimeout(this.finalResultTimers.get(sessionId)!);
        }
        
        // Neuen Timer setzen
        const timer = setTimeout(() => {
          const lastPartial = this.lastPartialResults.get(sessionId);
          if (lastPartial) {
            // Prüfe ob dieser Text bereits als final gesendet wurde
            const lastSentText = this.lastSentFinalText.get(sessionId);
            if (lastSentText === lastPartial) {
              this.logger.debug('Final result already sent for this exact text, skipping', { 
                sessionId, 
                text: lastPartial.substring(0, 30) 
              });
              return;
            }
            
            // Speichere den gesendeten Text
            this.lastSentFinalText.set(sessionId, lastPartial);
            
            // Emittiere letztes Partial als FINALES Ergebnis
            const finalUso = USOUtils.create(
              'text',
              this.id,
              lastPartial,
              true, // FINAL
              {
                id: sessionId,
                speakerInfo: {
                  confidence: 0.8, // Höhere Confidence für finale
                },
              }
            );

            this.emitOutput(emitter, finalUso);

            this.logger.info('✅ STT FINAL result (from last partial with debounce)', {
              nodeId: this.id,
              sessionId,
              text: lastPartial,
              isFinal: true,
              debounceDelay,
            });
            
            // Cleanup
            this.lastPartialResults.delete(sessionId);
            this.finalResultTimers.delete(sessionId);
            
            // WICHTIG: Vosk-Verbindung nach finalem Ergebnis schließen
            setTimeout(async () => {
              try {
                const conn = this.activeConnections.get(sessionId);
                if (conn) {
                  await this.voskService.finalize(sessionId);
                  this.voskService.disconnect(sessionId);
                  this.activeConnections.delete(sessionId);
                  this.logger.info('✅ Vosk connection closed after final result', {
                    nodeId: this.id,
                    sessionId,
                  });
                }
              } catch (error) {
                this.logger.error('Error closing Vosk connection', error.message, { sessionId });
              }
            }, 500); // 500ms Verzögerung
          }
        }, debounceDelay);
        
        this.finalResultTimers.set(sessionId, timer);
      });

      connection.emitter.on('result', (result: { text: string; final: boolean; confidence: number; words?: any[] }) => {
        // Prüfe ob dieser Text bereits gesendet wurde
        const lastSentText = this.lastSentFinalText.get(sessionId);
        if (lastSentText === result.text) {
          this.logger.debug('Vosk result already sent for this exact text, skipping', { 
            sessionId, 
            text: result.text.substring(0, 30) 
          });
          return;
        }
        
        // Speichere den gesendeten Text
        this.lastSentFinalText.set(sessionId, result.text);
        
        // Finales Ergebnis mit DEBOUNCE-Delay (Standard: 2000ms) für KI-Nodes
        const debounceDelay = this.config.finalResultDebounceDelay || 2000; // Standard: 2 Sekunden
        
        // Alten Timer löschen wenn vorhanden
        if (this.finalResultTimers.has(sessionId)) {
          clearTimeout(this.finalResultTimers.get(sessionId)!);
        }
        
        // Neuen Timer setzen
        const timer = setTimeout(() => {
          const speakerInfo: any = {
            confidence: result.confidence,
            language: this.config.language || 'de',
          };

          // Wort-Details hinzufügen wenn vorhanden
          if (result.words) {
            speakerInfo.words = result.words;
          }

          const textUso = USOUtils.create(
            'text',
            this.id,
            result.text,
            true, // Finale Ergebnisse sind immer final
            {
              id: sessionId,
              speakerInfo,
            }
          );

          this.emitOutput(emitter, textUso);

          this.logger.info('STT final result (debounced)', {
            nodeId: this.id,
            sessionId,
            text: result.text,
            confidence: result.confidence,
            final: result.final,
            wordCount: result.words ? result.words.length : 0,
            debounceDelay,
          });
          
          // Timer entfernen
          this.finalResultTimers.delete(sessionId);
          
          // WICHTIG: Vosk-Verbindung nach finalem Ergebnis schließen
          setTimeout(async () => {
            try {
              const conn = this.activeConnections.get(sessionId);
              if (conn) {
                await this.voskService.finalize(sessionId);
                this.voskService.disconnect(sessionId);
                this.activeConnections.delete(sessionId);
                this.logger.info('✅ Vosk connection closed after final result (from result event)', {
                  nodeId: this.id,
                  sessionId,
                });
              }
            } catch (error) {
              this.logger.error('Error closing Vosk connection', error.message, { sessionId });
            }
          }, 500); // 500ms Verzögerung
        }, debounceDelay);
        
        // Timer speichern
        this.finalResultTimers.set(sessionId, timer);
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
    // Timer löschen falls vorhanden
    if (this.finalResultTimers.has(sessionId)) {
      clearTimeout(this.finalResultTimers.get(sessionId)!);
      this.finalResultTimers.delete(sessionId);
    }
    
    this.voskService.disconnect(sessionId);
    this.activeConnections.delete(sessionId);
  }

  async stop(): Promise<void> {
    // Alle Timer löschen
    this.finalResultTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.finalResultTimers.clear();
    
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

