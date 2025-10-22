import { EventEmitter } from 'events';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject } from '../../types/USO';
import { AppLogger } from '../../common/logger';

/**
 * Debug Node - Zeigt USO-Datenströme im Log an
 * Diese Node ist für Debugging und Entwicklung gedacht
 */
export class DebugNode extends BaseNode {
  private readonly logger = new AppLogger('DebugNode');

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Debug node started', {
      nodeId: this.id,
      config: this.config,
    });
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    try {
      // Default: enabled ist true (wenn nicht explizit false gesetzt)
      if (this.config.enabled === false) {
        return;
      }

      // Header-Info loggen
      this.logger.info('🔍 DEBUG NODE - USO Received', {
        nodeId: this.id,
        header: uso.header,
        hasContext: !!uso.header.context,
      });
      
      // Context-Informationen loggen (wenn vorhanden)
      if (uso.header.context) {
        this.logger.info('👤 DEBUG NODE - Context Info', {
          nodeId: this.id,
          context: uso.header.context,
        });
      }

      // Payload-Info loggen (wenn aktiviert) - Default: true
      if (this.config.showPayload !== false) {
        const maxSize = this.config.maxPayloadSize || 1024;
        
        if (typeof uso.payload === 'string') {
          const truncated = uso.payload.length > maxSize 
            ? uso.payload.substring(0, maxSize) + '...(truncated)'
            : uso.payload;
          
          this.logger.info('📝 DEBUG NODE - Text Payload', {
            nodeId: this.id,
            payloadLength: uso.payload.length,
            payload: truncated,
          });
        } else if (Buffer.isBuffer(uso.payload)) {
          const size = uso.payload.length;
          const preview = size > 32 
            ? uso.payload.slice(0, 32).toString('hex') + '...'
            : uso.payload.toString('hex');
          
          this.logger.info('📦 DEBUG NODE - Binary Payload', {
            nodeId: this.id,
            payloadSize: size,
            preview: preview,
          });
        }
      }

      // Spezielle Behandlung für Control-Messages
      if (uso.header.type === 'control') {
        this.logger.warn('⚠️  DEBUG NODE - Control Message', {
          nodeId: this.id,
          action: uso.header.control?.action,
          message: uso.header.control?.message,
        });
      }

      // Payload-Preview für Frontend erstellen
      let payloadPreview: string | undefined;
      const maxPreviewSize = 500; // Max. 500 Zeichen für Preview
      
      if (typeof uso.payload === 'string') {
        // Text-Payload: Preview erstellen
        payloadPreview = uso.payload.length > maxPreviewSize
          ? uso.payload.substring(0, maxPreviewSize) + '...'
          : uso.payload;
      } else if (Buffer.isBuffer(uso.payload)) {
        // Binary-Payload: Hex-Preview (ersten 64 Bytes)
        const previewBytes = Math.min(64, uso.payload.length);
        payloadPreview = uso.payload.slice(0, previewBytes).toString('hex') + 
          (uso.payload.length > previewBytes ? '...' : '');
      }

      // Event für Frontend-Log emittieren
      emitter.emit('debug:log', {
        nodeId: this.id,
        timestamp: Date.now(),
        uso: {
          header: uso.header,
          payloadType: typeof uso.payload,
          payloadSize: uso.payload?.length || 0,
          payloadPreview,
        },
      });

    } catch (error) {
      this.logger.error('Error in Debug node processing', error.message, {
        nodeId: this.id,
        sessionId: uso.header.id,
      });
      
      this.emitError(emitter, error, uso.header.id);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('Debug node stopped', { nodeId: this.id });
  }

  /**
   * Debug-Node braucht keinen Connection-Test
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Debug node is always ready',
    };
  }
}

