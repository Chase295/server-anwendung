import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { AppLogger } from '../../common/logger';
import { UniversalStreamObject } from '../../types/USO';

/**
 * FlowiseService - Wrapper für Flowise AI Flow Engine
 * Kommuniziert mit Flowise über REST API
 */
@Injectable()
export class FlowiseService {
  private readonly logger = new AppLogger('FlowiseService');
  private axiosInstance: AxiosInstance;

  constructor() {
    // HTTPS Agent für selbst-signierte Zertifikate
    const httpsAgent = new https.Agent({  
      rejectUnauthorized: false // Akzeptiert selbst-signierte Zertifikate
    });

    this.axiosInstance = axios.create({
      timeout: 120000, // 120 Sekunden für AI-Antworten
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent, // Verwende HTTPS-Agent
    });
  }

  /**
   * Parst das Python-Script aus Flowise und extrahiert API-URL und Bearer Token
   * Beispiel-Input:
   * ```
   * import requests
   * 
   * API_URL = "https://flowise.local.chase295.de/api/v1/prediction/49b3fd51-c6de-45de-8080-c58cb850a5b7"
   * headers = {"Authorization": "Bearer dkSjdaLRLVD8d9YUyuppzvDBB3HUujvQloEf5vtdcIc"}
   * ```
   */
  parseFlowiseScript(script: string): { apiUrl: string; authToken: string } {
    try {
      // Extrahiere API_URL
      const apiUrlMatch = script.match(/API_URL\s*=\s*["']([^"']+)["']/);
      if (!apiUrlMatch) {
        throw new Error('API_URL nicht im Script gefunden');
      }
      const apiUrl = apiUrlMatch[1];

      // Extrahiere Bearer Token
      const authTokenMatch = script.match(/["']Authorization["']\s*:\s*["']Bearer\s+([^"']+)["']/);
      if (!authTokenMatch) {
        throw new Error('Authorization Bearer Token nicht im Script gefunden');
      }
      const authToken = authTokenMatch[1];

      this.logger.debug('Flowise script parsed successfully', {
        apiUrl: apiUrl.substring(0, 50) + '...',
        tokenLength: authToken.length,
      });

      return { apiUrl, authToken };
    } catch (error) {
      this.logger.error('Failed to parse Flowise script', error.message);
      throw new Error(`Script-Parsing fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Sendet eine Anfrage an Flowise
   */
  async sendToFlowise(
    config: FlowiseConfig,
    question: string,
    sessionId?: string
  ): Promise<FlowiseResponse> {
    try {
      this.logger.info('Sending request to Flowise', {
        apiUrl: config.apiUrl,
        questionLength: question.length,
        sessionId,
        questionPreview: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      });

      const startTime = Date.now();

      // Prepare payload für Flowise
      const payload: any = {
        question: question,
      };

      // Optional: Session-ID für Chat-History
      if (sessionId) {
        payload.sessionId = sessionId;
      }

      this.logger.info('📤 Flowise REQUEST payload', {
        sessionId,
        question,
        hasSessionId: !!payload.sessionId,
      });

      // HTTP POST an Flowise
      const response = await this.axiosInstance.post(config.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
        },
      });

      const duration = Date.now() - startTime;

      this.logger.info('📥 Flowise RESPONSE received', {
        sessionId,
        duration: `${duration}ms`,
        status: response.status,
        responseData: JSON.stringify(response.data).substring(0, 500),
      });

      // Parse Response
      const parsedResponse = this.parseResponse(response.data);
      
      this.logger.info('📥 Flowise RESPONSE parsed', {
        sessionId,
        text: parsedResponse.text,
        textLength: parsedResponse.text?.length || 0,
      });

      return parsedResponse;
    } catch (error) {
      this.logger.error('Flowise request error', error.message, {
        apiUrl: config.apiUrl.substring(0, 50) + '...',
        sessionId,
      });

      if (error.response) {
        throw new Error(`Flowise error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Flowise-Server nicht erreichbar');
      } else {
        throw new Error(`Flowise request error: ${error.message}`);
      }
    }
  }

  /**
   * Sendet eine Streaming-Anfrage an Flowise (Server-Sent Events)
   */
  async sendToFlowiseStreaming(
    config: FlowiseConfig,
    question: string,
    sessionId: string | undefined,
    chunkCallback: (chunk: string, event: string) => void,
    metadataCallback?: (metadata: any) => void
  ): Promise<void> {
    try {
      this.logger.info('Starting streaming request to Flowise', {
        apiUrl: config.apiUrl,
        questionLength: question.length,
        sessionId,
        questionPreview: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      });

      // Prepare payload für Flowise mit streaming: true
      const payload: any = {
        question: question,
        streaming: true, // WICHTIG: Aktiviert Server-Sent Events
      };

      // Optional: Session-ID für Chat-History
      if (sessionId) {
        payload.sessionId = sessionId;
      }

      this.logger.info('📤 Flowise STREAMING REQUEST payload', {
        sessionId,
        question,
        hasSessionId: !!payload.sessionId,
        streaming: true,
      });

      // HTTP POST an Flowise mit responseType: 'stream'
      const response = await this.axiosInstance.post(config.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
          'Accept': 'text/event-stream', // SSE Header
        },
        responseType: 'stream',
      });

      let buffer = '';
      let fullText = '';
      let metadata: any = {};

      // Stream-Verarbeitung für Server-Sent Events
      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();

        // SSE Format: "event: token\ndata: hello\n\n"
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Letzte unvollständige Message behalten

        for (const message of messages) {
          if (!message.trim()) continue;

          const lines = message.split('\n');
          let event = 'message';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              event = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              data = line.substring(5).trim();
            }
          }

          if (data) {
            // WICHTIG: Flowise sendet verschachteltes JSON!
            // Event kann "message" sein mit data: {"event":"token","data":"..."}
            let actualEvent = event;
            let actualData = data;

            this.logger.debug('📥 Flowise RAW event received', {
              sessionId,
              originalEvent: event,
              dataPreview: typeof data === 'string' ? data.substring(0, 100) : typeof data,
            });

            // Prüfe ob data ein JSON-String mit verschachteltem Event ist
            if (event === 'message') {
              try {
                const nested = JSON.parse(data);
                if (nested.event && nested.data !== undefined) {
                  actualEvent = nested.event;
                  actualData = nested.data;
                  this.logger.debug('✅ Parsed nested Flowise event', { 
                    sessionId,
                    originalEvent: event,
                    actualEvent, 
                    dataType: typeof actualData,
                    dataLength: typeof actualData === 'string' ? actualData.length : 0,
                    dataPreview: typeof actualData === 'string' ? actualData.substring(0, 50) : typeof actualData,
                  });
                }
              } catch (e) {
                // Kein verschachteltes JSON, nutze Original
              }
            }

            // Verarbeite verschiedene Event-Typen
            switch (actualEvent) {
              case 'start':
                this.logger.debug('Flowise streaming started', { sessionId });
                break;

              case 'token':
                // Einzelner Token vom Stream
                fullText += actualData;
                this.logger.debug('📥 Flowise STREAMING token received', {
                  sessionId,
                  token: actualData,
                  fullTextLength: fullText.length,
                });
                chunkCallback(actualData, actualEvent);
                break;

              case 'metadata':
                // Metadaten (nach allen Tokens)
                try {
                  metadata = JSON.parse(actualData);
                  if (metadataCallback) {
                    metadataCallback(metadata);
                  }
                } catch (e) {
                  this.logger.warn('Failed to parse metadata', { data: actualData });
                }
                break;

              case 'sourceDocuments':
                // Quellen-Dokumente
                try {
                  const sources = JSON.parse(actualData);
                  metadata.sourceDocuments = sources;
                } catch (e) {
                  this.logger.warn('Failed to parse sourceDocuments', { data: actualData });
                }
                break;

              case 'usedTools':
                // Verwendete Tools
                try {
                  const tools = JSON.parse(actualData);
                  metadata.usedTools = tools;
                } catch (e) {
                  this.logger.warn('Failed to parse usedTools', { data: actualData });
                }
                break;

              case 'end':
                this.logger.info('Flowise streaming completed', {
                  sessionId,
                  totalLength: fullText.length,
                });
                break;

              case 'error':
                this.logger.error('Flowise streaming error', actualData, { sessionId });
                throw new Error(`Flowise streaming error: ${actualData}`);

              default:
                // Unbekannte Events loggen (nur noch echte Unbekannte)
                this.logger.debug('Unknown Flowise event', { event: actualEvent, data: actualData });
            }
          }
        }
      });

      response.data.on('end', () => {
        // Verarbeite restlichen Buffer
        if (buffer.trim()) {
          this.logger.debug('Processing remaining buffer', { bufferLength: buffer.length });
        }

        this.logger.info('Flowise stream ended', { sessionId, totalLength: fullText.length });
      });

      response.data.on('error', (error: any) => {
        // Ignoriere "aborted" Fehler (kann passieren wenn Stream beendet wird)
        if (error.message === 'aborted' || error.code === 'ECONNRESET') {
          this.logger.warn('Flowise stream aborted (normal)', { sessionId, code: error.code });
          return; // Nicht als Fehler behandeln
        }
        
        this.logger.error('Flowise streaming connection error', error.message, { sessionId, code: error.code });
        throw error;
      });

      // Warte bis Stream beendet ist
      await new Promise<void>((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });

    } catch (error: any) {
      // Ignoriere "aborted" Fehler (normal wenn Stream beendet wird)
      if (error.message === 'aborted' || error.code === 'ECONNRESET') {
        this.logger.warn('Flowise stream aborted normally', { sessionId });
        return; // Nicht als Fehler behandeln
      }
      
      this.logger.error('Flowise streaming request failed', error.message, {
        apiUrl: config.apiUrl.substring(0, 50) + '...',
        sessionId,
      });

      if (error.response) {
        throw new Error(`Flowise error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Flowise-Server nicht erreichbar');
      } else {
        throw new Error(`Flowise streaming error: ${error.message}`);
      }
    }
  }

  /**
   * Parse Flowise Response
   * Flowise kann verschiedene Response-Formate zurückgeben
   */
  private parseResponse(data: any): FlowiseResponse {
    // Standard-Format: { text: "...", ... }
    if (typeof data === 'string') {
      return {
        text: data,
        metadata: {},
      };
    }

    // Objekt mit text-Feld
    if (data.text) {
      return {
        text: data.text,
        metadata: {
          sourceDocuments: data.sourceDocuments,
          conversationId: data.conversationId,
          sessionId: data.sessionId,
          ...data,
        },
      };
    }

    // Objekt mit answer-Feld (alternatives Format)
    if (data.answer) {
      return {
        text: data.answer,
        metadata: data,
      };
    }

    // Fallback: Ganzes Objekt als JSON-String
    this.logger.warn('Unknown Flowise response format, using JSON.stringify', { data });
    return {
      text: JSON.stringify(data),
      metadata: {},
    };
  }

  /**
   * Health-Check: Testet die Verbindung zu Flowise
   * Flowise verwendet Server-Sent Events (SSE) für Streaming!
   * Wir testen nur ob der Stream startet, nicht ob er endet.
   */
  async testConnection(config: FlowiseConfig): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Testing Flowise connection (SSE/Streaming)', {
        apiUrl: config.apiUrl.substring(0, 60) + '...',
        tokenLength: config.authToken.length,
      });

      // Test mit Streaming - wir warten nur auf die ersten Chunks
      // WICHTIG: streaming: true aktiviert SSE in Flowise!
      const testPayload = {
        question: 'test',
        streaming: true, // Aktiviert Server-Sent Events
      };

      this.logger.debug('Sending streaming test request to Flowise...');

      // Promise-basierter Stream-Test
      return await new Promise<{ success: boolean; message: string }>((resolve, reject) => {
        let resolved = false;
        let receivedData = false;

        const request = this.axiosInstance.post(config.apiUrl, testPayload, {
          headers: {
            'Authorization': `Bearer ${config.authToken}`,
          },
          timeout: 30000, // 30 Sekunden Connection-Timeout
          responseType: 'stream', // WICHTIG: Stream-Response
          validateStatus: (status) => status >= 200 && status < 500,
        });

        request.then((response) => {
          const duration = Date.now() - startTime;

          // Prüfe Status-Code SOFORT
          if (response.status === 401 || response.status === 403) {
            if (!resolved) {
              resolved = true;
              response.data.destroy();
              resolve({
                success: false,
                message: 'Autorisierung fehlgeschlagen - Prüfen Sie den Bearer Token',
              });
            }
            return;
          }

          if (response.status === 404) {
            if (!resolved) {
              resolved = true;
              response.data.destroy();
              resolve({
                success: false,
                message: 'Flowise API nicht gefunden (404) - Prüfen Sie die API-URL',
              });
            }
            return;
          }

          if (response.status >= 400) {
            if (!resolved) {
              resolved = true;
              response.data.destroy();
              resolve({
                success: false,
                message: `Flowise-Fehler: Status ${response.status}`,
              });
            }
            return;
          }

          this.logger.info('Flowise stream connection established', {
            status: response.status,
            duration: `${duration}ms`,
          });

          // Warte auf ERSTE Daten vom Stream
          response.data.on('data', (chunk: Buffer) => {
            if (resolved) return;
            
            receivedData = true;
            const chunkStr = chunk.toString();
            
            this.logger.debug('Received first chunk from Flowise', {
              chunkSize: chunk.length,
              preview: chunkStr.substring(0, 200),
            });

            // Parse SSE-Daten und prüfe auf Fehler
            const lines = chunkStr.split('\n');
            let hasError = false;
            let errorMessage = '';
            let hasValidData = false;

            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataStr = line.substring(5).trim();
                if (dataStr && dataStr !== '[DONE]') {
                  try {
                    const data = JSON.parse(dataStr);
                    
                    // Prüfe auf Fehler
                    if (data.event === 'error') {
                      hasError = true;
                      // Flowise sendet Fehler als: {"event":"error","data":"Error: ..."}
                      errorMessage = data.data || data.message || data.error || 'Unknown error';
                      
                      // Extrahiere Haupt-Fehlermeldung (z.B. "Unauthorized" aus "Error: ... - Unauthorized")
                      if (errorMessage.includes('Unauthorized')) {
                        errorMessage = 'Unauthorized - Prüfen Sie den Bearer Token';
                      } else if (errorMessage.includes('not found')) {
                        errorMessage = 'Flow nicht gefunden - Prüfen Sie die API-URL';
                      }
                      
                      this.logger.error('Flowise returned error in stream', errorMessage);
                    } else if (data.event === 'token' || data.event === 'start' || data.event === 'agentFlowEvent') {
                      hasValidData = true;
                    } else if (data.error) {
                      hasError = true;
                      errorMessage = data.error || data.message || 'Unknown error';
                      this.logger.error('Flowise returned error', errorMessage);
                    }
                  } catch (e) {
                    // Kann nicht geparsed werden, könnte Text sein
                    if (dataStr.length > 0) {
                      hasValidData = true;
                    }
                  }
                }
              }
            }

            resolved = true;
            response.data.destroy(); // Stream sofort schließen
            
            const totalDuration = Date.now() - startTime;

            if (hasError) {
              resolve({
                success: false,
                message: `Flowise-Fehler: ${errorMessage}`,
              });
            } else if (hasValidData) {
              resolve({
                success: true,
                message: `Verbindung zu Flowise erfolgreich - Stream antwortet (${totalDuration}ms)`,
              });
            } else {
              // Daten empfangen, aber keine validen Events
              resolve({
                success: false,
                message: `Flowise antwortet, aber keine validen Daten empfangen`,
              });
            }
          });

          // Fallback: Wenn nach 10 Sekunden keine Daten kommen
          setTimeout(() => {
            if (resolved) return;
            resolved = true;
            response.data.destroy();
            
            const totalDuration = Date.now() - startTime;
            
            if (receivedData) {
              resolve({
                success: true,
                message: `Verbindung zu Flowise erfolgreich (${totalDuration}ms)`,
              });
            } else {
              // Keine Daten nach 10 Sekunden = Fehler
              resolve({
                success: false,
                message: `Timeout: Keine Antwort von Flowise nach ${totalDuration}ms`,
              });
            }
          }, 10000); // 10 Sekunden warten auf Daten

          // Error-Handler
          response.data.on('error', (err: Error) => {
            if (resolved) return;
            resolved = true;
            this.logger.error('Stream error', err.message);
            reject(err);
          });

          response.data.on('end', () => {
            if (resolved) return;
            resolved = true;
            
            const totalDuration = Date.now() - startTime;
            resolve({
              success: true,
              message: `Stream beendet (${totalDuration}ms) - Verbindung erfolgreich`,
            });
          });

        }).catch((error) => {
          if (resolved) return;
          resolved = true;
          reject(error);
        });

        // Timeout-Handler
        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          
          const duration = Date.now() - startTime;
          reject(new Error(`Connection timeout after ${duration}ms`));
        }, 30000);
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Flowise connection test failed', error.message, {
        duration: `${duration}ms`,
        code: error.code,
        statusCode: error.response?.status,
      });

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Flowise-Server nicht erreichbar (Connection refused) - Ist die URL korrekt?',
        };
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: `Verbindung zu Flowise timeout nach ${duration}ms - Server antwortet nicht`,
        };
      } else if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          message: 'DNS-Fehler - Host nicht gefunden. Prüfen Sie die URL.',
        };
      } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED') {
        return {
          success: false,
          message: 'SSL-Zertifikat-Problem - Das sollte durch den SSL-Bypass behoben sein',
        };
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          success: false,
          message: 'Autorisierung fehlgeschlagen - Prüfen Sie den Bearer Token',
        };
      } else if (error.response?.status === 404) {
        return {
          success: false,
          message: 'Flowise API nicht gefunden (404) - Prüfen Sie die API-URL',
        };
      } else if (error.response?.status === 500) {
        const errorMsg = error.response?.data?.message || 'Internal Server Error';
        return {
          success: false,
          message: `Flowise Server-Fehler (500): ${errorMsg}`,
        };
      } else {
        return {
          success: false,
          message: `Verbindungsfehler: ${error.message} (Code: ${error.code || 'unknown'})`,
        };
      }
    }
  }

  /**
   * Sendet USO an Flowise (Wrapper-Methode für AI-Node)
   */
  async sendUSOToFlowise(
    config: FlowiseConfig,
    uso: UniversalStreamObject
  ): Promise<FlowiseResponse> {
    // Extrahiere Text aus USO
    const text = typeof uso.payload === 'string' ? uso.payload : uso.payload.toString();
    
    // Verwende USO-ID als Session-ID für Chat-History
    const sessionId = uso.header.id;

    return this.sendToFlowise(config, text, sessionId);
  }
}

/**
 * Flowise-Konfiguration
 */
export interface FlowiseConfig {
  apiUrl: string;
  authToken: string;
}

/**
 * Flowise-Response
 */
export interface FlowiseResponse {
  text: string;
  metadata: Record<string, any>;
}

