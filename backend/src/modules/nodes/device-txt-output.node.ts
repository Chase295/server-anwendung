import { EventEmitter } from 'events';
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject } from '../../types/USO';
import { AppLogger } from '../../common/logger';
import { WebSocketGateway } from '../devices/websocket.gateway';

/**
 * DeviceTxtOutputNode - Text Output Node für ESP32-Clients
 * Sendet Text-Stream an ESP32-Client zur Anzeige
 */
export class DeviceTxtOutputNode extends BaseNode {
  private readonly logger = new AppLogger('DeviceTxtOutputNode');
  private wsGateway: WebSocketGateway;
  private activeSession: string | null = null;

  constructor(
    id: string,
    type: string,
    config: Record<string, any>,
    wsGateway: WebSocketGateway
  ) {
    super(id, type, config);
    this.wsGateway = wsGateway;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Device TXT Output node started', {
      nodeId: this.id,
      targetDevice: this.config.deviceId,
    });
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    try {
      // Nur Text-USOs akzeptieren
      if (uso.header.type !== 'text') {
        this.logger.warn('Device TXT Output node received non-text USO', {
          nodeId: this.id,
          receivedType: uso.header.type,
          sessionId: uso.header.id,
        });
        return;
      }

      const targetDevice = this.config.deviceId;

      if (!targetDevice) {
        throw new Error('No target device configured');
      }

      // Prüfe ob Device verbunden ist
      if (!this.wsGateway.isClientConnected(targetDevice)) {
        throw new Error(`Target device ${targetDevice} is not connected`);
      }

      // Session tracking
      if (!this.activeSession) {
        this.activeSession = uso.header.id;
        this.logger.info('Device TXT Output node started text session', {
          nodeId: this.id,
          sessionId: this.activeSession,
          targetDevice,
        });
      }

      // USO an Device senden (unterstützt Streaming mit final=false/true)
      const sent = this.wsGateway.sendUSO(targetDevice, uso);

      if (!sent) {
        throw new Error(`Failed to send text to device ${targetDevice}`);
      }

      this.logger.debug('Device TXT Output node sent text to device', {
        nodeId: this.id,
        sessionId: uso.header.id,
        targetDevice,
        payloadSize: typeof uso.payload === 'string' ? uso.payload.length : uso.payload.length,
        final: uso.header.final,
      });

      // Session beenden wenn final
      if (uso.header.final) {
        this.logger.info('Device TXT Output session completed', {
          nodeId: this.id,
          sessionId: this.activeSession,
          targetDevice,
        });
        this.activeSession = null;
      }
    } catch (error) {
      this.logger.error('Error in Device TXT Output node processing', error.message, {
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
    this.logger.info('Device TXT Output node stopped', { nodeId: this.id });
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

    // Prüfe ob Device verbunden ist
    const isConnected = this.wsGateway.isClientConnected(deviceId);

    if (isConnected) {
      return {
        success: true,
        message: `Gerät ${deviceId} ist verbunden und bereit`,
      };
    } else {
      return {
        success: false,
        message: `Gerät ${deviceId} ist nicht verbunden`,
      };
    }
  }

  getHealthStatus(): { status: 'healthy' | 'degraded' | 'error'; message?: string } {
    if (!this.isRunning) {
      return { status: 'error', message: 'Node is not running' };
    }

    if (!this.config.deviceId) {
      return { status: 'error', message: 'No device configured' };
    }

    const isConnected = this.wsGateway.isClientConnected(this.config.deviceId);

    if (!isConnected) {
      return {
        status: 'error',
        message: `Device ${this.config.deviceId} not connected`,
      };
    }

    if (this.activeSession) {
      return {
        status: 'healthy',
        message: `Sending text to ${this.config.deviceId}`,
      };
    }

    return {
      status: 'healthy',
      message: `Ready to send text to ${this.config.deviceId}`,
    };
  }
}

