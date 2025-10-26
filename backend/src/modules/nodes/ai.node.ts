import { EventEmitter } from 'events';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject, USOUtils } from '../../types/USO';
import { AppLogger } from '../../common/logger';
import { FlowiseService } from '../services/flowise.service';
import { Model } from 'mongoose';
import { FlowiseServer } from '../services/schemas/flowise-server.schema';

/**
 * AINode - Künstliche Intelligenz Node
 * Integriert mit Flowise für KI-Workflows
 */
export class AINode extends BaseNode {
  private readonly logger = new AppLogger('AINode');
  private flowiseService: FlowiseService;
  private flowiseServerModel: Model<FlowiseServer>;
  private flowiseConfig: { apiUrl: string; authToken: string } | null = null;

  constructor(
    id: string, 
    type: string, 
    config: Record<string, any>, 
    flowiseService: FlowiseService,
    flowiseServerModel: Model<FlowiseServer>
  ) {
    super(id, type, config);
    this.flowiseService = flowiseService;
    this.flowiseServerModel = flowiseServerModel;
  }

  async start(): Promise<void> {
    // Lade Flowise-Server-Konfiguration
    if (!this.config.flowiseServerId) {
      throw new Error('Keine Flowise-Server-ID konfiguriert');
    }

    const server = await this.flowiseServerModel.findById(this.config.flowiseServerId).exec();
    if (!server) {
      throw new Error(`Flowise-Server mit ID ${this.config.flowiseServerId} nicht gefunden`);
    }

    this.flowiseConfig = {
      apiUrl: server.apiUrl,
      authToken: server.authToken,
    };

    this.isRunning = true;
    this.logger.info('AI node started', {
      nodeId: this.id,
      flowiseServer: server.name,
      apiUrl: server.apiUrl.substring(0, 50) + '...',
    });
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    try {
      if (!this.flowiseConfig) {
        throw new Error('Flowise-Konfiguration nicht geladen');
      }

      // Nur Text-USOs akzeptieren
      if (uso.header.type !== 'text') {
        this.logger.warn('AI node received non-text USO', {
          nodeId: this.id,
          receivedType: uso.header.type,
          sessionId: uso.header.id,
        });
        return;
      }

      // WICHTIG: Nur finale Ergebnisse an Flowise senden (ignoriere partielle!)
      if (!uso.header.final) {
        this.logger.debug('AI node ignoring non-final text (partial result)', {
          nodeId: this.id,
          sessionId: uso.header.id,
          text: uso.payload.toString().substring(0, 50),
        });
        return;
      }

      const text = uso.payload.toString();

      if (!text || text.trim().length === 0) {
        this.logger.warn('AI node received empty text', {
          nodeId: this.id,
          sessionId: uso.header.id,
        });
        return;
      }

      this.logger.info('AI node processing text with Flowise', {
        nodeId: this.id,
        sessionId: uso.header.id,
        textLength: text.length,
        text: text.substring(0, 100),
      });

      // Sende an Flowise
      await this.processSingle(uso, text, emitter);
    } catch (error) {
      this.logger.error('Error in AI node processing', error.message, {
        nodeId: this.id,
        sessionId: uso.header.id,
      });

      this.emitError(emitter, error, uso.header.id);
    }
  }

  /**
   * Verarbeitung mit Flowise
   */
  private async processSingle(
    uso: UniversalStreamObject,
    text: string,
    emitter: EventEmitter
  ): Promise<void> {
    try {
      if (!this.flowiseConfig) {
        throw new Error('Flowise-Konfiguration nicht verfügbar');
      }

      const enableStreaming = this.config.enableStreaming ?? true; // Default: true

      if (enableStreaming) {
        // Streaming-Modus
        await this.processStreaming(uso, text, emitter);
      } else {
        // Nicht-Streaming-Modus (warte auf komplette Antwort)
        const response = await this.flowiseService.sendUSOToFlowise(
          this.flowiseConfig,
          uso
        );

        // Text-USO mit AI-Antwort erstellen
        const aiUso = this.createOutputUSO(
          uso,
          response.text,
          true,
          response.metadata
        );

        this.emitOutput(emitter, aiUso);

        this.logger.info('Flowise AI response sent', {
          nodeId: this.id,
          sessionId: uso.header.id,
          responseLength: response.text.length,
        });
      }
    } catch (error) {
      throw new Error(`Flowise AI processing failed: ${error.message}`);
    }
  }

  /**
   * Verarbeitung mit Flowise Streaming
   */
  private async processStreaming(
    uso: UniversalStreamObject,
    text: string,
    emitter: EventEmitter
  ): Promise<void> {
    let fullText = '';
    let chunkCount = 0;
    let finalMetadata: any = {};

    this.logger.info('Starting Flowise streaming', {
      nodeId: this.id,
      sessionId: uso.header.id,
      textLength: text.length,
    });

    await this.flowiseService.sendToFlowiseStreaming(
      this.flowiseConfig!,
      text,
      uso.header.id,
      (chunk: string, event: string) => {
        // Callback für jeden Token
        fullText += chunk;
        chunkCount++;

        // Sende jeden Chunk als eigenes USO (final=false)
        const chunkUso = this.createOutputUSO(
          uso,
          chunk,
          false, // Nicht final - weitere Chunks kommen
          { event, chunkNumber: chunkCount }
        );

        this.emitOutput(emitter, chunkUso);

        this.logger.debug('Flowise token streamed', {
          nodeId: this.id,
          sessionId: uso.header.id,
          chunkNumber: chunkCount,
          chunkLength: chunk.length,
        });
      },
      (metadata: any) => {
        // Callback für Metadaten
        finalMetadata = metadata;
        this.logger.debug('Flowise metadata received', {
          nodeId: this.id,
          sessionId: uso.header.id,
          metadata,
        });
      }
    );

    // Sende finales USO mit komplettem Text
    const finalUso = this.createOutputUSO(
      uso,
      fullText,
      true, // Final
      {
        ...finalMetadata,
        streamingComplete: true,
        totalChunks: chunkCount,
        totalLength: fullText.length,
      }
    );

    this.emitOutput(emitter, finalUso);

    this.logger.info('Flowise streaming completed', {
      nodeId: this.id,
      sessionId: uso.header.id,
      totalChunks: chunkCount,
      totalLength: fullText.length,
    });
  }

  /**
   * Erstellt Output-USO mit AI-Antwort
   */
  private createOutputUSO(
    inputUso: UniversalStreamObject,
    text: string,
    final: boolean,
    metadata: Record<string, any>
  ): UniversalStreamObject {
    return USOUtils.create('text', this.id, text, final, {
      id: inputUso.header.id,
      // Metadaten vom Input-USO übernehmen
      speakerInfo: inputUso.header.speakerInfo,
      websocketInfo: inputUso.header.websocketInfo,
      // AI-spezifische Metadaten hinzufügen
      control: {
        action: 'ai_response',
        data: {
          model: 'flowise',
          ...metadata,
        },
      },
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('AI node stopped', { nodeId: this.id });
  }

  /**
   * Test der Flowise-Verbindung
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.config.flowiseServerId) {
        return {
          success: false,
          message: 'Kein Flowise-Server konfiguriert',
        };
      }

      const server = await this.flowiseServerModel.findById(this.config.flowiseServerId).exec();
      if (!server) {
        return {
          success: false,
          message: 'Flowise-Server nicht gefunden',
        };
      }

      return await this.flowiseService.testConnection({
        apiUrl: server.apiUrl,
        authToken: server.authToken,
      });
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

    if (!this.config.flowiseServerId) {
      return { status: 'error', message: 'No Flowise server configured' };
    }

    if (!this.flowiseConfig) {
      return { status: 'error', message: 'Flowise config not loaded' };
    }

    return {
      status: 'healthy',
      message: 'Ready for AI processing with Flowise',
    };
  }
}

