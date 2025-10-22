import { Injectable } from '@nestjs/common';
import { INode, INodeFactory, NodeSchema } from '../../types/INode';
import { AppLogger } from '../../common/logger';

// Import Node-Implementierungen
import { DebugNode } from '../nodes/debug.node';
import { STTNode } from '../nodes/stt.node';
import { TTSNode } from '../nodes/tts.node';
import { MicNode } from '../nodes/mic.node';
import { SpeakerNode } from '../nodes/speaker.node';
import { AINode } from '../nodes/ai.node';
import { WSInNode } from '../nodes/wsIn.node';
import { WSOutNode } from '../nodes/wsOut.node';

// Import Services
import { VoskService } from '../services/vosk.service';
import { PiperService } from '../services/piper.service';
import { N8nService } from '../services/n8n.service';
import { FlowiseService } from '../services/flowise.service';
import { WebSocketGateway } from '../devices/websocket.gateway';

// Import Schemas
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FlowiseServer } from '../services/schemas/flowise-server.schema';

/**
 * Node-Factory für dynamisches Laden von Nodes
 */
@Injectable()
export class NodeFactory implements INodeFactory {
  private readonly logger = new AppLogger('NodeFactory');
  private nodeSchemas: Map<string, NodeSchema> = new Map();

  constructor(
    private readonly voskService: VoskService,
    private readonly piperService: PiperService,
    private readonly n8nService: N8nService,
    private readonly flowiseService: FlowiseService,
    private readonly wsGateway: WebSocketGateway,
    @InjectModel(FlowiseServer.name) private readonly flowiseServerModel: Model<FlowiseServer>,
  ) {
    this.registerDefaultNodes();
  }

  /**
   * Registriert alle Standard-Nodes
   */
  private registerDefaultNodes(): void {
    // Debug Node
    this.registerNodeSchema({
      type: 'debug',
      displayName: 'Debug',
      description: 'Zeigt USO-Datenströme im Log an',
      category: 'utility',
      color: '#9CA3AF',
      config: {
        enabled: {
          type: 'boolean',
          label: 'Aktiviert',
          default: true,
        },
        showPayload: {
          type: 'boolean',
          label: 'Payload anzeigen',
          default: true,
        },
        maxPayloadSize: {
          type: 'number',
          label: 'Max. Payload-Größe (Bytes)',
          default: 1024,
        },
      },
      inputs: [{ name: 'input', type: 'any' }],
      outputs: [],
    });

    // Mic Node
    this.registerNodeSchema({
      type: 'mic',
      displayName: 'Mikrofon',
      description: 'Empfängt Audio von ESP32-Client',
      category: 'input',
      color: '#3B82F6',
      config: {
        deviceId: {
          type: 'string',
          label: 'Gerät',
          description: 'ESP32-Client mit Mikrofon',
          required: true,
        },
      },
      inputs: [],
      outputs: [{ name: 'audio', type: 'audio' }],
    });

    // STT Node
    this.registerNodeSchema({
      type: 'stt',
      displayName: 'Speech-to-Text',
      description: 'Konvertiert Audio zu Text (Vosk)',
      category: 'processing',
      color: '#10B981',
      config: {
        serviceUrl: {
          type: 'string',
          label: 'Vosk Server URL',
          default: 'ws://localhost:2700',
          required: true,
        },
        language: {
          type: 'select',
          label: 'Sprache',
          default: 'de',
          options: [
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ],
        },
        sampleRate: {
          type: 'number',
          label: 'Sample Rate',
          default: 16000,
        },
        emitPartialResults: {
          type: 'boolean',
          label: 'Partielle Ergebnisse',
          default: false,
        },
      },
      inputs: [{ name: 'audio', type: 'audio' }],
      outputs: [{ name: 'text', type: 'text' }],
    });

    // TTS Node
    this.registerNodeSchema({
      type: 'tts',
      displayName: 'Text-to-Speech',
      description: 'Konvertiert Text zu Audio (Piper)',
      category: 'processing',
      color: '#F59E0B',
      config: {
        serviceUrl: {
          type: 'string',
          label: 'Piper Server URL',
          default: 'http://localhost:5000',
          required: true,
        },
        voiceModel: {
          type: 'string',
          label: 'Stimme',
          default: 'de_DE-thorsten-medium',
        },
        streamingMode: {
          type: 'boolean',
          label: 'Streaming-Modus',
          default: false,
        },
        sampleRate: {
          type: 'number',
          label: 'Sample Rate',
          default: 22050,
        },
      },
      inputs: [{ name: 'text', type: 'text' }],
      outputs: [{ name: 'audio', type: 'audio' }],
    });

    // Speaker Node
    this.registerNodeSchema({
      type: 'speaker',
      displayName: 'Lautsprecher',
      description: 'Gibt Audio auf ESP32-Client wieder',
      category: 'output',
      color: '#EF4444',
      config: {
        deviceId: {
          type: 'string',
          label: 'Gerät',
          description: 'ESP32-Client mit Lautsprecher',
          required: true,
        },
      },
      inputs: [{ name: 'audio', type: 'audio' }],
      outputs: [],
    });

    // AI Node
    this.registerNodeSchema({
      type: 'ai',
      displayName: 'KI / Flowise',
      description: 'Verarbeitung mit Flowise AI Flow Engine',
      category: 'processing',
      color: '#8B5CF6',
      config: {
        flowiseServerId: {
          type: 'string',
          label: 'Flowise-Server',
          description: 'Wählen Sie einen konfigurierten Flowise-Server',
          required: true,
        },
        enableStreaming: {
          type: 'boolean',
          label: 'Streaming aktivieren',
          description: 'Sendet AI-Antwort token-für-token (empfohlen)',
          default: true,
        },
      },
      inputs: [{ name: 'text', type: 'text' }],
      outputs: [{ name: 'text', type: 'text' }],
    });

    // WebSocket In Node
    this.registerNodeSchema({
      type: 'ws_in',
      displayName: 'WebSocket In',
      description: 'Empfängt Daten von externem WebSocket',
      category: 'input',
      color: '#6366F1',
      config: {
        port: {
          type: 'number',
          label: 'Port',
          default: 8081,
          required: true,
        },
        path: {
          type: 'string',
          label: 'Pfad',
          default: '/ws/external',
          required: true,
        },
        dataType: {
          type: 'select',
          label: 'Datentyp',
          default: 'text',
          options: [
            { value: 'text', label: 'Text' },
            { value: 'audio', label: 'Audio' },
            { value: 'raw', label: 'Raw/JSON' },
          ],
        },
        includeContext: {
          type: 'boolean',
          label: 'Context weitergeben',
          default: true,
          description: 'Context-Informationen (Zeit, Person, Standort, Client) an nachfolgende Nodes weitergeben',
        },
      },
      inputs: [],
      outputs: [{ name: 'data', type: 'any' }],
    });

    // WebSocket Out Node
    this.registerNodeSchema({
      type: 'ws_out',
      displayName: 'WebSocket Out',
      description: 'Sendet Daten an externen WebSocket',
      category: 'output',
      color: '#6366F1',
      config: {
        targetUrl: {
          type: 'string',
          label: 'Ziel-URL',
          default: 'ws://localhost:8082',
          required: true,
        },
        sendFormat: {
          type: 'select',
          label: 'Sende-Format',
          default: 'uso_full',
          options: [
            { value: 'content_only', label: 'Nur Content (reiner Text/Daten)' },
            { value: 'payload_only', label: 'Nur Payload' },
            { value: 'uso_full', label: 'Komplettes USO (JSON)' },
            { value: 'header_then_payload', label: 'Header → Payload' },
          ],
        },
        dataType: {
          type: 'select',
          label: 'Datentyp',
          default: 'text',
          options: [
            { value: 'text', label: 'Text / JSON' },
            { value: 'audio', label: 'Audio' },
            { value: 'raw', label: 'Raw (Binär)' },
          ],
        },
        emitErrors: {
          type: 'boolean',
          label: 'Fehler emittieren',
          default: false,
        },
      },
      inputs: [{ name: 'data', type: 'any' }],
      outputs: [],
    });
  }

  /**
   * Registriert ein Node-Schema
   */
  registerNodeSchema(schema: NodeSchema): void {
    this.nodeSchemas.set(schema.type, schema);
    this.logger.debug('Node schema registered', { type: schema.type });
  }

  /**
   * Erstellt eine neue Node-Instanz
   */
  createNode(id: string, type: string, config: Record<string, any>): INode {
    this.logger.debug('Creating node', { id, type });

    // Default-Werte aus Schema anwenden
    const schema = this.nodeSchemas.get(type);
    const finalConfig = this.applyDefaultConfig(schema, config);

    switch (type) {
      case 'debug':
        return new DebugNode(id, type, finalConfig);
      
      case 'mic':
        return new MicNode(id, type, finalConfig);
      
      case 'stt':
        return new STTNode(id, type, finalConfig, this.voskService);
      
      case 'tts':
        return new TTSNode(id, type, finalConfig, this.piperService);
      
      case 'speaker':
        return new SpeakerNode(id, type, finalConfig, this.wsGateway);
      
      case 'ai':
        return new AINode(id, type, finalConfig, this.flowiseService, this.flowiseServerModel);
      
      case 'ws_in':
        return new WSInNode(id, type, finalConfig);
      
      case 'ws_out':
        return new WSOutNode(id, type, finalConfig);
      
      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }

  /**
   * Gibt alle verfügbaren Node-Typen zurück
   */
  getAvailableNodeTypes(): string[] {
    return Array.from(this.nodeSchemas.keys());
  }

  /**
   * Gibt die Schema-Definition für einen Node-Typ zurück
   */
  getNodeSchema(type: string): NodeSchema {
    const schema = this.nodeSchemas.get(type);
    
    if (!schema) {
      throw new Error(`Schema for node type '${type}' not found`);
    }

    return schema;
  }

  /**
   * Gibt alle Node-Schemas zurück
   */
  getAllNodeSchemas(): NodeSchema[] {
    return Array.from(this.nodeSchemas.values());
  }

  /**
   * Wendet Default-Werte aus dem Schema auf die Config an
   */
  private applyDefaultConfig(schema: NodeSchema | undefined, config: Record<string, any>): Record<string, any> {
    if (!schema || !schema.config) {
      return config;
    }

    const finalConfig = { ...config };

    // Für jeden Config-Key im Schema
    Object.keys(schema.config).forEach((key) => {
      const schemaField = schema.config[key];
      
      // Wenn der Wert nicht in der Config gesetzt ist, verwende Default
      if (finalConfig[key] === undefined && schemaField.default !== undefined) {
        finalConfig[key] = schemaField.default;
        this.logger.debug('Applied default config value', { 
          nodeType: schema.type, 
          key, 
          defaultValue: schemaField.default 
        });
      }
    });

    return finalConfig;
  }
}

