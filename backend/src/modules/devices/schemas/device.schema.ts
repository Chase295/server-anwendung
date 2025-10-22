import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceDocument = Device & Document;

/**
 * Schema für registrierte IoT-Clients (ESP32)
 */
@Schema({ timestamps: true })
export class Device {
  @Prop({ required: true, unique: true })
  clientId: string; // z.B. 'esp32_001'

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  capabilities: string[]; // z.B. ['mic', 'speaker', 'sensor']

  @Prop({ default: 'offline' })
  status: 'online' | 'offline' | 'error';

  @Prop()
  lastSeen?: Date;

  @Prop()
  lastHeartbeat?: Date;

  @Prop({ type: Object })
  metadata?: {
    firmwareVersion?: string;
    hardwareVersion?: string;
    ipAddress?: string;
    macAddress?: string;
    [key: string]: any;
  };

  @Prop({ default: true })
  active: boolean;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);

