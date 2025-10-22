import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PiperServerDocument = PiperServer & Document;

@Schema({ timestamps: true })
export class PiperServer {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  lastTestSuccess: boolean;

  @Prop({ default: null })
  lastTestMessage?: string;

  @Prop({ default: null })
  lastTested?: Date;
}

export const PiperServerSchema = SchemaFactory.createForClass(PiperServer);

