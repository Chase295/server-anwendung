import { EventEmitter } from 'events';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject } from '../../types/USO';
import { AppLogger } from '../../common/logger';

/**
 * MicNode - Mikrofon Input Node
 * Fordert Audio-Stream vom ESP32-Client an und leitet ihn weiter
 */
export class MicNode extends BaseNode {
  private readonly logger = new AppLogger('MicNode');
  private activeSession: string | null = null;

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Mic node started', {
      nodeId: this.id,
      targetDevice: this.config.deviceId,
    });
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    try {
      // Nur Audio-USOs vom konfigurierten Device akzeptieren
      if (uso.header.type !== 'audio') {
        this.logger.debug('Mic node ignoring non-audio USO', {
          nodeId: this.id,
          receivedType: uso.header.type,
        });
        return;
      }

      // Prüfe ob USO vom richtigen Device kommt
      const expectedDeviceId = this.config.deviceId;
      if (expectedDeviceId && uso.header.sourceId !== expectedDeviceId) {
        this.logger.debug('Mic node ignoring USO from different device', {
          nodeId: this.id,
          expectedDevice: expectedDeviceId,
          receivedFrom: uso.header.sourceId,
        });
        return;
      }

      // Session tracking
      if (!this.activeSession) {
        this.activeSession = uso.header.id;
        this.logger.info('Mic node started new session', {
          nodeId: this.id,
          sessionId: this.activeSession,
          sourceDevice: uso.header.sourceId,
        });
      }

      // Audio-USO direkt weiterleiten
      this.emitOutput(emitter, uso);

      this.logger.debug('Mic node forwarded audio', {
        nodeId: this.id,
        sessionId: uso.header.id,
        payloadSize: uso.payload.length,
        final: uso.header.final,
      });

      // Session beenden wenn final
      if (uso.header.final) {
        this.logger.info('Mic node session completed', {
          nodeId: this.id,
          sessionId: this.activeSession,
        });
        this.activeSession = null;
      }
    } catch (error) {
      this.logger.error('Error in Mic node processing', error.message, {
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
    this.logger.info('Mic node stopped', { nodeId: this.id });
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

    // Hier würde man prüfen ob das Device online ist
    // Das muss mit dem DevicesService gemacht werden
    // Für jetzt: immer OK
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
        message: `Recording from ${this.config.deviceId}`,
      };
    }

    return {
      status: 'healthy',
      message: `Waiting for audio from ${this.config.deviceId}`,
    };
  }
}

