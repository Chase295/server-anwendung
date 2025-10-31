import { EventEmitter } from 'events';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject } from '../../types/USO';
import { AppLogger } from '../../common/logger';

/**
 * DeviceTxtInputNode - Text Input Node für ESP32-Clients
 * Empfängt Text-USOs von ESP32-Client und leitet sie weiter (wie Mic-Node mit Audio)
 */
export class DeviceTxtInputNode extends BaseNode {
  private readonly logger = new AppLogger('DeviceTxtInputNode');
  private activeSession: string | null = null;

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Device TXT Input node started', {
      nodeId: this.id,
      sourceDevice: this.config.deviceId,
    });
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    try {
      // Nur Text-USOs vom konfigurierten Device akzeptieren
      if (uso.header.type !== 'text') {
        this.logger.debug('Device TXT Input node ignoring non-text USO', {
          nodeId: this.id,
          receivedType: uso.header.type,
        });
        return;
      }

      // Prüfe ob USO vom richtigen Device kommt
      const expectedDeviceId = this.config.deviceId;
      if (expectedDeviceId && uso.header.sourceId !== expectedDeviceId) {
        this.logger.debug('Device TXT Input node ignoring USO from different device', {
          nodeId: this.id,
          expectedDevice: expectedDeviceId,
          receivedFrom: uso.header.sourceId,
        });
        return;
      }

      // Session tracking
      if (!this.activeSession) {
        this.activeSession = uso.header.id;
        this.logger.info('Device TXT Input node started new session', {
          nodeId: this.id,
          sessionId: this.activeSession,
          sourceDevice: uso.header.sourceId,
        });
      }

      // Text-USO direkt weiterleiten
      this.emitOutput(emitter, uso);

      this.logger.debug('Device TXT Input node forwarded text', {
        nodeId: this.id,
        sessionId: uso.header.id,
        text: typeof uso.payload === 'string' ? uso.payload.substring(0, 100) : 'binary',
      });

      // Automatisch Debug-Event senden (damit Text im Frontend sichtbar ist)
      let payloadPreview: string | undefined;
      const maxPreviewSize = 500;
      
      if (typeof uso.payload === 'string') {
        payloadPreview = uso.payload.length > maxPreviewSize
          ? uso.payload.substring(0, maxPreviewSize) + '...'
          : uso.payload;
      }

      emitter.emit('debug:log', {
        nodeId: this.id,
        timestamp: Date.now(),
        isFinal: uso.header.final,
        uso: {
          header: uso.header,
          payloadType: typeof uso.payload,
          payloadSize: uso.payload?.length || 0,
          payloadPreview,
        },
      });

      // Session beenden wenn final
      if (uso.header.final) {
        this.logger.info('Device TXT Input node session completed', {
          nodeId: this.id,
          sessionId: this.activeSession,
        });
        this.activeSession = null;
      }
    } catch (error) {
      this.logger.error('Error in Device TXT Input node processing', error.message, {
        nodeId: this.id,
        sessionId: uso.header.id,
      });

      this.emitError(emitter, error, uso.header.id);
      this.activeSession = null;
    }
  }

  async stop(): Promise<void> {
    this.activeSession = null;
    this.isRunning = false;
    this.logger.info('Device TXT Input node stopped', { nodeId: this.id });
  }

  /**
   * Test ob das konfigurierte Device verfügbar ist
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const deviceId = this.config.deviceId;

    if (!deviceId) {
      return {
        success: false,
        message: 'Kein Gerät konfiguriert',
      };
    }

    return {
      success: true,
      message: `Gerät ${deviceId} konfiguriert`,
    };
  }

  getHealthStatus(): { status: 'healthy' | 'degraded' | 'error'; message?: string } {
    if (!this.isRunning) {
      return { status: 'error', message: 'Node is not running' };
    }

    if (!this.config.deviceId) {
      return { status: 'error', message: 'No device configured' };
    }

    if (this.activeSession) {
      return {
        status: 'healthy',
        message: `Receiving text from ${this.config.deviceId}`,
      };
    }

    return {
      status: 'healthy',
      message: `Waiting for text from ${this.config.deviceId}`,
    };
  }
}

