import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SecretDocument = Secret & Document;

/**
 * Schema für verschlüsselte Secrets (API-Keys, Client-Secrets, etc.)
 */
@Schema({ timestamps: true })
export class Secret {
  @Prop({ required: true, unique: true })
  key: string; // z.B. 'vosk_api_key', 'client_secret_esp32_001'

  @Prop({ required: true })
  encryptedValue: string; // AES-verschlüsselter Wert

  @Prop({ required: true })
  type: string; // 'api_key', 'client_secret', 'service_token'

  @Prop()
  description?: string;

  @Prop({ default: true })
  active: boolean;

  @Prop()
  expiresAt?: Date;
}

export const SecretSchema = SchemaFactory.createForClass(Secret);

