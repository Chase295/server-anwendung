import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { AppLogger } from '../../common/logger';
import { UniversalStreamObject } from '../../types/USO';

/**
 * N8nService - Wrapper für n8n Workflow-Engine
 * Kommuniziert mit n8n über Webhooks
 */
@Injectable()
export class N8nService {
  private readonly logger = new AppLogger('N8nService');
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 60000, // 60 Sekunden für KI-Antworten
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Sendet USO an n8n Webhook und empfängt Antwort
   */
  async sendToWorkflow(
    webhookUrl: string,
    uso: UniversalStreamObject,
    config: N8nConfig
  ): Promise<N8nResponse> {
    try {
      this.logger.info('Sending USO to n8n workflow', {
        webhookUrl,
        sessionId: uso.header.id,
        textLength: typeof uso.payload === 'string' ? uso.payload.length : 0,
      });

      const startTime = Date.now();

      // Prepare payload für n8n
      const n8nPayload = this.preparePayload(uso, config);

      // HTTP POST an n8n Webhook
      const response = await this.axiosInstance.post(webhookUrl, n8nPayload, {
        headers: config.headers || {},
      });

      const duration = Date.now() - startTime;

      this.logger.info('n8n workflow response received', {
        sessionId: uso.header.id,
        duration: `${duration}ms`,
        status: response.status,
      });

      // Parse Response
      return this.parseResponse(response.data);
    } catch (error) {
      this.logger.error('n8n workflow error', error.message, {
        webhookUrl,
        sessionId: uso.header.id,
      });

      if (error.response) {
        throw new Error(`n8n error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('n8n server nicht erreichbar');
      } else {
        throw new Error(`n8n request error: ${error.message}`);
      }
    }
  }

  /**
   * Streaming-Anfrage an n8n (für Chat-ähnliche Workflows)
   */
  async sendToWorkflowStreaming(
    webhookUrl: string,
    uso: UniversalStreamObject,
    config: N8nConfig,
    chunkCallback: (chunk: string) => void
  ): Promise<void> {
    try {
      this.logger.info('Starting streaming request to n8n', {
        webhookUrl,
        sessionId: uso.header.id,
      });

      const n8nPayload = this.preparePayload(uso, config);

      // Streaming-Request
      const response = await this.axiosInstance.post(webhookUrl, n8nPayload, {
        headers: config.headers || {},
        responseType: 'stream',
      });

      // Stream-Verarbeitung
      let buffer = '';

      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();

        // Verarbeite JSON-Zeilen (NDJSON)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Letzte unvollständige Zeile behalten

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.text) {
                chunkCallback(data.text);
              }
            } catch (e) {
              // Ignoriere Parse-Fehler
            }
          }
        }
      });

      response.data.on('end', () => {
        // Verarbeite restlichen Buffer
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.text) {
              chunkCallback(data.text);
            }
          } catch (e) {
            // Ignoriere Parse-Fehler
          }
        }

        this.logger.info('n8n streaming completed', { sessionId: uso.header.id });
      });

      response.data.on('error', (error: Error) => {
        this.logger.error('n8n streaming error', error.message, {
          sessionId: uso.header.id,
        });
        throw error;
      });
    } catch (error) {
      this.logger.error('n8n streaming request failed', error.message, {
        webhookUrl,
        sessionId: uso.header.id,
      });
      throw error;
    }
  }

  /**
   * Bereitet Payload für n8n vor (inkl. aller Metadaten)
   */
  private preparePayload(uso: UniversalStreamObject, config: N8nConfig): any {
    const payload: any = {
      // USO-Header (alle Metadaten)
      uso: {
        id: uso.header.id,
        type: uso.header.type,
        sourceId: uso.header.sourceId,
        timestamp: uso.header.timestamp,
        final: uso.header.final,
      },

      // Text-Payload (Hauptinhalt)
      text: typeof uso.payload === 'string' ? uso.payload : uso.payload.toString(),

      // Metadaten
      metadata: {},
    };

    // Speaker-Info hinzufügen (falls vorhanden)
    if (uso.header.speakerInfo) {
      payload.metadata.speaker = uso.header.speakerInfo;
    }

    // WebSocket-Info hinzufügen (falls vorhanden)
    if (uso.header.websocketInfo) {
      payload.metadata.websocket = uso.header.websocketInfo;
    }

    // Control-Info hinzufügen (falls vorhanden)
    if (uso.header.control) {
      payload.metadata.control = uso.header.control;
    }

    // Custom-Felder aus Config
    if (config.customFields) {
      payload.metadata.custom = config.customFields;
    }

    return payload;
  }

  /**
   * Parse n8n Response
   */
  private parseResponse(data: any): N8nResponse {
    // n8n kann verschiedene Response-Formate haben
    if (typeof data === 'string') {
      return {
        text: data,
        metadata: {},
      };
    }

    if (data.text) {
      return {
        text: data.text,
        metadata: data.metadata || {},
      };
    }

    if (data.message) {
      return {
        text: data.message,
        metadata: data.metadata || {},
      };
    }

    // Fallback: Ganzes Objekt als JSON-String
    return {
      text: JSON.stringify(data),
      metadata: {},
    };
  }

  /**
   * Health-Check: Testet die Verbindung zu n8n
   */
  async testConnection(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Test mit einfacher Nachricht
      const testPayload = {
        text: 'Connection Test',
        test: true,
      };

      const response = await this.axiosInstance.post(webhookUrl, testPayload, {
        timeout: 10000,
      });

      if (response.status === 200) {
        return {
          success: true,
          message: 'Verbindung zu n8n erfolgreich',
        };
      } else {
        return {
          success: false,
          message: `n8n antwortete mit Status ${response.status}`,
        };
      }
    } catch (error) {
      this.logger.error('n8n connection test failed', error.message);

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'n8n-Server nicht erreichbar (Connection refused)',
        };
      } else if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          message: 'Verbindung zu n8n timeout',
        };
      } else if (error.response?.status === 404) {
        return {
          success: false,
          message: 'n8n Webhook nicht gefunden (404) - Prüfen Sie die URL',
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
   * Erstellt eine Webhook-URL für einen bestimmten Workflow
   */
  buildWebhookUrl(baseUrl: string, workflowId?: string, path?: string): string {
    let url = baseUrl.replace(/\/$/, ''); // Entferne trailing slash

    if (workflowId) {
      url += `/webhook/${workflowId}`;
    }

    if (path) {
      url += path.startsWith('/') ? path : `/${path}`;
    }

    return url;
  }
}

/**
 * n8n-Konfiguration
 */
export interface N8nConfig {
  webhookUrl: string;
  headers?: Record<string, string>;
  customFields?: Record<string, any>;
  streamingMode?: boolean;
  timeout?: number;
}

/**
 * n8n-Response
 */
export interface N8nResponse {
  text: string;
  metadata: Record<string, any>;
}

