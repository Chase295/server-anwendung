import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './schemas/device.schema';
import { AppLogger } from '../../common/logger';

@Injectable()
export class DevicesService {
  private readonly logger = new AppLogger('DevicesService');

  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
  ) {}

  /**
   * Registriert ein neues Device oder aktualisiert ein existierendes
   */
  async registerDevice(
    clientId: string,
    name: string,
    capabilities: string[],
    metadata?: any
  ): Promise<Device> {
    try {
      const device = await this.deviceModel.findOneAndUpdate(
        { clientId },
        {
          clientId,
          name,
          capabilities,
          metadata,
          lastSeen: new Date(),
          active: true,
        },
        { upsert: true, new: true }
      );

      this.logger.info('Device registered', { clientId, name });
      return device;
    } catch (error) {
      this.logger.error('Failed to register device', error.message, { clientId });
      throw error;
    }
  }

  /**
   * Aktualisiert den Device-Status
   */
  async updateDeviceStatus(
    clientId: string,
    status: 'online' | 'offline' | 'error',
    metadata?: any
  ): Promise<void> {
    try {
      const update: any = { status, lastSeen: new Date() };

      if (status === 'online') {
        update.lastHeartbeat = new Date();
      }

      if (metadata) {
        update.metadata = metadata;
      }

      await this.deviceModel.findOneAndUpdate(
        { clientId },
        update,
        { upsert: true }
      );

      this.logger.debug('Device status updated', { clientId, status });
    } catch (error) {
      this.logger.error('Failed to update device status', error.message, { clientId });
    }
  }

  /**
   * Holt alle Devices
   */
  async getAllDevices(): Promise<Device[]> {
    return this.deviceModel.find().sort({ lastSeen: -1 });
  }

  /**
   * Holt ein Device nach clientId
   */
  async getDevice(clientId: string): Promise<Device | null> {
    return this.deviceModel.findOne({ clientId });
  }

  /**
   * Löscht ein Device
   */
  async deleteDevice(clientId: string): Promise<void> {
    await this.deviceModel.deleteOne({ clientId });
    this.logger.info('Device deleted', { clientId });
  }

  /**
   * Markiert offline Devices (keine Heartbeat seit X Minuten)
   */
  async markStaleDevicesOffline(timeoutMinutes: number = 5): Promise<void> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const result = await this.deviceModel.updateMany(
      {
        status: 'online',
        lastHeartbeat: { $lt: cutoffTime },
      },
      {
        status: 'offline',
      }
    );

    if (result.modifiedCount > 0) {
      this.logger.info('Marked stale devices as offline', { count: result.modifiedCount });
    }
  }
}

