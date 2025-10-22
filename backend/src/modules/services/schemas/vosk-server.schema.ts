import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Vosk-Server Konfiguration
 * Speichert zentral verwaltete Vosk-Server
 */
@Schema({ timestamps: true })
export class VoskServer extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  description?: string;

  @Prop({ type: Date })
  lastTested?: Date;

  @Prop({ default: false })
  lastTestSuccess?: boolean;
}

export const VoskServerSchema = SchemaFactory.createForClass(VoskServer);

