/**
 * Universal Stream Object (USO) Spezifikation
 * Dies ist der einzige Datencontainer für alle Datenströme im System
 */

export type USOType = 'audio' | 'text' | 'control';

/**
 * USO Header Interface - MUSS als JSON-Text-Frame gesendet werden
 */
export interface USO_Header {
  // Zwingende Felder
  id: string;                    // Flow-Sitzungs-ID (UUID)
  type: USOType;                 // Typ des Streams
  sourceId: string;              // ID des Ursprungsgeräts/Servers
  timestamp: number;             // Epoch MS
  final: boolean;                // Ende des Streams
  
  // Optionale Felder
  speakerInfo?: {
    speakerId?: string;
    confidence?: number;
    language?: string;
  };
  
  websocketInfo?: {
    connectionId: string;
    clientIp: string;
    connectedAt: number;
  };
  
  // Context-Informationen (für KI-Kontext)
  context?: {
    person?: string;             // Name der Person (z.B. "Moritz Haslbeck")
    location?: string;           // Standort (z.B. "Schlafzimmer")
    clientName?: string;         // Client-Name (z.B. "Laptop xyz")
    [key: string]: any;          // Erweiterbar für zusätzliche Context-Infos
  };
  
  // Zusätzliche Metadaten für Control-Messages
  control?: {
    action: string;              // z.B. 'error', 'start', 'stop', 'pause'
    message?: string;
    errorCode?: string;
    data?: any;
  };
  
  // Audio-spezifische Metadaten
  audioMeta?: {
    sampleRate: number;
    channels: number;
    encoding: string;            // z.B. 'pcm_s16le', 'opus'
    bitDepth?: number;
    format?: string;             // z.B. 'int16', 'float32'
    endianness?: string;        // z.B. 'little', 'big'
  };
}

/**
 * Komplettes USO mit Header und Payload
 */
export interface UniversalStreamObject {
  header: USO_Header;
  payload: string | Buffer;     // String für Text, Buffer für Binär-Audio
}

/**
 * Hilfsfunktionen für USO-Handling
 */
export class USOUtils {
  /**
   * Erstellt ein neues USO mit vorgegebenen Defaults
   */
  static create(
    type: USOType,
    sourceId: string,
    payload: string | Buffer,
    final: boolean = false,
    additionalHeader?: Partial<USO_Header>
  ): UniversalStreamObject {
    const header: USO_Header = {
      id: additionalHeader?.id || this.generateUUID(),
      type,
      sourceId,
      timestamp: Date.now(),
      final,
      ...additionalHeader,
    };

    return { header, payload };
  }

  /**
   * Erstellt ein Control-USO für Fehler
   */
  static createError(
    sourceId: string,
    sessionId: string,
    errorMessage: string,
    errorCode?: string
  ): UniversalStreamObject {
    return this.create('control', sourceId, '', true, {
      id: sessionId,
      control: {
        action: 'error',
        message: errorMessage,
        errorCode,
      },
    });
  }

  /**
   * Validiert ein USO-Header
   */
  static validateHeader(header: any): header is USO_Header {
    return (
      header &&
      typeof header.id === 'string' &&
      ['audio', 'text', 'control'].includes(header.type) &&
      typeof header.sourceId === 'string' &&
      typeof header.timestamp === 'number' &&
      typeof header.final === 'boolean'
    );
  }

  /**
   * Generiert eine UUID v4
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Serialisiert USO-Header für WebSocket-Übertragung
   */
  static serializeHeader(header: USO_Header): string {
    return JSON.stringify(header);
  }

  /**
   * Deserialisiert USO-Header von WebSocket
   */
  static deserializeHeader(data: string): USO_Header {
    try {
      const header = JSON.parse(data);
      if (!this.validateHeader(header)) {
        throw new Error('Invalid USO header format');
      }
      return header;
    } catch (error) {
      throw new Error(`Failed to deserialize USO header: ${error.message}`);
    }
  }
}

