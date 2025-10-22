import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FlowiseServerDocument = FlowiseServer & Document;

@Schema({ timestamps: true })
export class FlowiseServer {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  apiUrl: string;

  @Prop({ required: true })
  authToken: string;

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

export const FlowiseServerSchema = SchemaFactory.createForClass(FlowiseServer);

