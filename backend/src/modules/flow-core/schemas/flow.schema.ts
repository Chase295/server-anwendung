import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FlowDocument = Flow & Document;

/**
 * Schema für gespeicherte Flows (visuelle Logik)
 */
@Schema({ timestamps: true })
export class Flow {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Object, required: true })
  definition: {
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: Record<string, any>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>;
  };

  @Prop({ default: false })
  active: boolean;

  @Prop()
  lastExecuted?: Date;

  @Prop({ type: Object })
  statistics?: {
    executionCount: number;
    lastError?: string;
    averageExecutionTime?: number;
  };

  @Prop({ default: true })
  enabled: boolean;
}

export const FlowSchema = SchemaFactory.createForClass(Flow);

