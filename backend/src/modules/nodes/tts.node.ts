import { EventEmitter } from 'events';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject, USOUtils } from '../../types/USO';
import { AppLogger } from '../../common/logger';
import { PiperService } from '../services/piper.service';

/**
 * TTSNode - Text-to-Speech Node
 * Konvertiert Text zu Audio mittels Piper
 */
export class TTSNode extends BaseNode {
  private readonly logger = new AppLogger('TTSNode');
  private piperService: PiperService;

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

      this.logger.info('TTS processing text', {
        nodeId: this.id,
        sessionId: uso.header.id,
        textLength: text.length,
        text: text.substring(0, 100),
      });

      // Streaming-Modus oder Einzelsynthese
      if (this.config.streamingMode && text.length > 200) {
        await this.synthesizeStreaming(uso, text, emitter);
      } else {
        await this.synthesizeSingle(uso, text, emitter);
      }
    } catch (error) {
      this.logger.error('Error in TTS node processing', error.message, {
        nodeId: this.id,
        sessionId: uso.header.id,
      });

      this.emitError(emitter, error, uso.header.id);
    }
  }

  /**
   * Einzelne Synthese (ganzer Text auf einmal)
   */
  private async synthesizeSingle(
    uso: UniversalStreamObject,
    text: string,
    emitter: EventEmitter
  ): Promise<void> {
    try {
      const audioBuffer = await this.piperService.synthesize(text, {
        serviceUrl: this.config.serviceUrl || 'http://localhost:5000',
        voiceModel: this.config.voiceModel || 'de_DE-thorsten-medium',
        speakerId: this.config.speakerId,
        lengthScale: this.config.lengthScale || 1.0,
        noiseScale: this.config.noiseScale || 0.667,
        noiseW: this.config.noiseW || 0.8,
        sampleRate: this.config.sampleRate || 22050,
      });

      // Audio-USO erstellen
      const audioUso = USOUtils.create('audio', this.id, audioBuffer, true, {
        id: uso.header.id,
        audioMeta: {
          sampleRate: this.config.sampleRate || 22050,
          channels: 1,
          encoding: 'pcm_s16le',
          bitDepth: 16,
        },
      });

      this.emitOutput(emitter, audioUso);

      this.logger.info('TTS synthesis completed', {
        nodeId: this.id,
        sessionId: uso.header.id,
        audioSize: audioBuffer.length,
      });
    } catch (error) {
      throw new Error(`TTS synthesis failed: ${error.message}`);
    }
  }

  /**
   * Streaming-Synthese (Text in Chunks)
   */
  private async synthesizeStreaming(
    uso: UniversalStreamObject,
    text: string,
    emitter: EventEmitter
  ): Promise<void> {
    try {
      let chunkIndex = 0;

      await this.piperService.synthesizeStreaming(
        text,
        {
          serviceUrl: this.config.serviceUrl || 'http://localhost:5000',
          voiceModel: this.config.voiceModel || 'de_DE-thorsten-medium',
          speakerId: this.config.speakerId,
          lengthScale: this.config.lengthScale || 1.0,
          noiseScale: this.config.noiseScale || 0.667,
          noiseW: this.config.noiseW || 0.8,
          sampleRate: this.config.sampleRate || 22050,
        },
        (audioChunk: Buffer) => {
          chunkIndex++;
          const isLast = false; // Wird im letzten Chunk gesetzt

          // Audio-USO für Chunk erstellen
          const audioUso = USOUtils.create('audio', this.id, audioChunk, isLast, {
            id: uso.header.id,
            audioMeta: {
              sampleRate: this.config.sampleRate || 22050,
              channels: 1,
              encoding: 'pcm_s16le',
              bitDepth: 16,
            },
          });

          this.emitOutput(emitter, audioUso);

          this.logger.debug('TTS chunk emitted', {
            nodeId: this.id,
            sessionId: uso.header.id,
            chunkIndex,
            chunkSize: audioChunk.length,
          });
        }
      );

      // Finales leeres USO senden um Stream abzuschließen
      const finalUso = USOUtils.create('audio', this.id, Buffer.alloc(0), true, {
        id: uso.header.id,
      });
      this.emitOutput(emitter, finalUso);

      this.logger.info('TTS streaming completed', {
        nodeId: this.id,
        sessionId: uso.header.id,
        totalChunks: chunkIndex,
      });
    } catch (error) {
      throw new Error(`TTS streaming failed: ${error.message}`);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('TTS node stopped', { nodeId: this.id });
  }

  /**
   * Test der Piper-Verbindung
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const serviceUrl = this.config.serviceUrl || 'http://localhost:5000';
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

