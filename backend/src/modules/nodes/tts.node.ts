import { EventEmitter } from 'events';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject, USOUtils } from '../../types/USO';
import { AppLogger } from '../../common/logger';
import { PiperService, PiperConnection } from '../services/piper.service';

/**
 * TTSNode - Text-to-Speech Node
 * Konvertiert Text zu Audio mittels Piper (WebSocket, wie piper_test.py)
 */
export class TTSNode extends BaseNode {
  private readonly logger = new AppLogger('TTSNode');
  private piperService: PiperService;
  private activeConnections: Map<string, PiperConnection> = new Map();
  
  // Buffer für Streaming-Text-Chunks (um zu vermeiden dass jeder kleine Chunk sofort zu Piper geht)
  private textBuffers: Map<string, { text: string; timer: NodeJS.Timeout | null }> = new Map();

  constructor(id: string, type: string, config: Record<string, any>, piperService: PiperService) {
    super(id, type, config);
    this.piperService = piperService;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('TTS node started', {
      nodeId: this.id,
      serviceUrl: this.config.serviceUrl,
      voice: this.config.voiceModel,
    });
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    try {
      // Nur Text-USOs akzeptieren
      if (uso.header.type !== 'text') {
        this.logger.warn('TTS node received non-text USO', {
          nodeId: this.id,
          receivedType: uso.header.type,
          sessionId: uso.header.id,
        });
        return;
      }

      const text = uso.payload.toString();

      if (!text || text.trim().length === 0) {
        this.logger.warn('TTS node received empty text', {
          nodeId: this.id,
          sessionId: uso.header.id,
        });
        return;
      }

      // WICHTIG: Nur finale Ergebnisse verarbeiten (kein Streaming!)
      if (!uso.header.final) {
        this.logger.debug('TTS node ignoring non-final text (partial result)', {
          nodeId: this.id,
          sessionId: uso.header.id,
          text: text.substring(0, 50),
        });
        return;
      }

      const sessionId = uso.header.id;
      
      this.logger.info('🎤 TTS processing FINAL text', {
        nodeId: this.id,
        sessionId,
        textLength: text.length,
        text: text.substring(0, 100),
      });

      // Sende sofort an Piper
      await this.sendTextToPiper(sessionId, text, emitter);

      // Piper sendet automatisch Audio-Chunks über den Emitter
      // Diese werden im connectToPiper Listener verarbeitet

    } catch (error) {
      this.logger.error('Error in TTS node processing', error.message, {
        nodeId: this.id,
        sessionId: uso.header.id,
      });

      this.emitError(emitter, error, uso.header.id);
    }
  }

  /**
   * Sendet Text an Piper (mit Connection-Handling)
   */
  private async sendTextToPiper(
    sessionId: string,
    text: string,
    emitter: EventEmitter
  ): Promise<void> {
    // Piper-Verbindung holen oder erstellen
    let connection = this.activeConnections.get(sessionId);

    if (!connection) {
      connection = await this.connectToPiper(sessionId, emitter);
      this.activeConnections.set(sessionId, connection);
    }

    // Text an Piper senden
    await this.piperService.sendText(sessionId, text);

    this.logger.debug('Text sent to Piper', {
      nodeId: this.id,
      sessionId,
      textLength: text.length,
    });
  }

  /**
   * Verbindet mit Piper-Server und setzt Event-Listener auf
   */
  private async connectToPiper(sessionId: string, emitter: EventEmitter): Promise<PiperConnection> {
    try {
      const connection = await this.piperService.connect(sessionId, {
        serviceUrl: this.config.serviceUrl || 'ws://localhost:5002',
      });

      // Event-Listener für Audio-Chunks
      connection.emitter.on('audio', (audioChunk: Buffer) => {
        this.logger.debug('Piper audio chunk received', {
          nodeId: this.id,
          sessionId,
          chunkSize: audioChunk.length,
        });

        // Audio-USO erstellen (16kHz, 16-bit PCM mono, wie piper_test.py)
        const audioUso = USOUtils.create('audio', this.id, audioChunk, false, {
          id: sessionId,
          audioMeta: {
            sampleRate: 16000, // Piper gibt 16kHz aus (wie piper_test.py)
            channels: 1,
            encoding: 'pcm_s16le',
            bitDepth: 16,
            format: 'raw',
            endianness: 'little',
          },
        });

        this.emitOutput(emitter, audioUso);
      });

      connection.emitter.on('close', () => {
        this.activeConnections.delete(sessionId);
        this.logger.info('Piper connection closed', { nodeId: this.id, sessionId });
        
        // Finales USO senden um Stream abzuschließen
        const finalUso = USOUtils.create('audio', this.id, Buffer.alloc(0), true, {
          id: sessionId,
          audioMeta: {
            sampleRate: 16000,
            channels: 1,
            encoding: 'pcm_s16le',
            bitDepth: 16,
            format: 'raw',
            endianness: 'little',
          },
        });

        this.emitOutput(emitter, finalUso);

        this.logger.info('✅ TTS synthesis completed', {
          nodeId: this.id,
          sessionId,
        });
      });

      return connection;
    } catch (error) {
      this.logger.error('Failed to connect to Piper', error.message, {
        nodeId: this.id,
        sessionId,
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Clear alle Timer
    for (const [sessionId, buffer] of this.textBuffers) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
    }
    this.textBuffers.clear();
    
    // Schließe alle Verbindungen
    for (const [sessionId, connection] of this.activeConnections) {
      this.piperService.disconnect(sessionId);
    }
    this.activeConnections.clear();
    
    this.logger.info('TTS node stopped', { nodeId: this.id });
  }

  /**
   * Test der Piper-Verbindung
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const serviceUrl = this.config.serviceUrl || 'ws://localhost:5002';
      return await this.piperService.testConnection(serviceUrl);
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

    return {
      status: 'healthy',
      message: 'Ready for text input',
    };
  }
}
