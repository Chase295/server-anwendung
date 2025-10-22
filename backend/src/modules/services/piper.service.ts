import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { AppLogger } from '../../common/logger';

/**
 * PiperService - Wrapper für Piper Text-to-Speech Server
 * Kommuniziert mit dem externen Piper-Server über HTTP
 */
@Injectable()
export class PiperService {
  private readonly logger = new AppLogger('PiperService');
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000, // 30 Sekunden Timeout
      responseType: 'arraybuffer', // Für Audio-Daten
    });
  }

  /**
   * Konvertiert Text zu Audio
   */
  async synthesize(text: string, config: PiperConfig): Promise<Buffer> {
    try {
      this.logger.info('Synthesizing text with Piper', {
        textLength: text.length,
        voice: config.voiceModel,
      });

      const startTime = Date.now();

      // Piper API-Call (HTTP POST)
      const response = await this.axiosInstance.post(
        config.serviceUrl,
        {
          text,
          voice: config.voiceModel || 'de_DE-thorsten-medium',
          speaker_id: config.speakerId,
          length_scale: config.lengthScale || 1.0,
          noise_scale: config.noiseScale || 0.667,
          noise_w: config.noiseW || 0.8,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const duration = Date.now() - startTime;
      const audioBuffer = Buffer.from(response.data);

      this.logger.info('Piper synthesis completed', {
        textLength: text.length,
        audioSize: audioBuffer.length,
        duration: `${duration}ms`,
      });

      return audioBuffer;
    } catch (error) {
      this.logger.error('Piper synthesis failed', error.message, {
        text: text.substring(0, 50) + '...',
      });

      if (error.response) {
        throw new Error(`Piper error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Piper server nicht erreichbar');
      } else {
        throw new Error(`Piper synthesis error: ${error.message}`);
      }
    }
  }

  /**
   * Streaming-Synthese (für große Texte)
   * Teilt den Text in Chunks und verarbeitet sie nacheinander
   */
  async synthesizeStreaming(
    text: string,
    config: PiperConfig,
    chunkCallback: (chunk: Buffer) => void
  ): Promise<void> {
    try {
      // Teile Text in Sätze
      const sentences = this.splitIntoSentences(text);

      for (const sentence of sentences) {
        if (sentence.trim().length === 0) continue;

        const audioChunk = await this.synthesize(sentence, config);
        chunkCallback(audioChunk);
      }
    } catch (error) {
      this.logger.error('Streaming synthesis failed', error.message);
      throw error;
    }
  }

  /**
   * Teilt Text in Sätze auf
   */
  private splitIntoSentences(text: string): string[] {
    // Einfache Satz-Trennung (kann verbessert werden)
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Health-Check: Testet die Verbindung zum Piper-Server
   */
  async testConnection(serviceUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Test mit kurzer Phrase
      const testText = 'Test';
      
      const response = await this.axiosInstance.post(
        serviceUrl,
        {
          text: testText,
          voice: 'de_DE-thorsten-medium',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.status === 200 && response.data) {
        return {
          success: true,
          message: 'Verbindung zum Piper-Server erfolgreich',
        };
      } else {
        return {
          success: false,
          message: 'Piper-Server antwortet nicht korrekt',
        };
      }
    } catch (error) {
      this.logger.error('Piper connection test failed', error.message);

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Piper-Server nicht erreichbar (Connection refused)',
        };
      } else if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          message: 'Verbindung zum Piper-Server timeout',
        };
      } else {
        return {
          success: false,
          message: `Verbindungsfehler: ${error.message}`,
        };
      }
    }
  }

  /**
   * Listet verfügbare Stimmen auf (falls Piper API das unterstützt)
   */
  async listVoices(serviceUrl: string): Promise<string[]> {
    try {
      const response = await this.axiosInstance.get(`${serviceUrl}/voices`);
      return response.data.voices || [];
    } catch (error) {
      this.logger.warn('Could not fetch voice list from Piper', error.message);
      // Fallback auf bekannte Stimmen
      return [
        'de_DE-thorsten-medium',
        'de_DE-thorsten-low',
        'en_US-lessac-medium',
        'en_GB-alan-medium',
      ];
    }
  }
}

/**
 * Piper-Konfiguration
 */
export interface PiperConfig {
  serviceUrl: string;
  voiceModel?: string;
  speakerId?: number;
  lengthScale?: number;
  noiseScale?: number;
  noiseW?: number;
  sampleRate?: number;
}

