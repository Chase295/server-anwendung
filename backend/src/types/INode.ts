import { EventEmitter } from 'events';
import { UniversalStreamObject } from './USO';

/**
 * INode Interface - MUSS von allen Logik-Nodes implementiert werden
 */
export interface INode {
  /**
   * Eindeutige Node-ID im Flow
   */
  id: string;

  /**
   * Node-Typ (z.B. 'mic', 'stt', 'tts', 'speaker', 'debug')
   */
  type: string;

  /**
   * Node-Konfiguration (spezifisch für jeden Node-Typ)
   */
  config: Record<string, any>;

  /**
   * Startet die Node und initialisiert Ressourcen
   * @returns Promise<void>
   */
  start(): Promise<void>;

  /**
   * Verarbeitet ein eingehendes USO
   * @param uso Das zu verarbeitende Universal Stream Object
   * @param emitter Event-Emitter für Ausgabe-USOs und Status-Updates
   * @returns Promise<void>
   */
  process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void>;

  /**
   * Stoppt die Node und gibt Ressourcen frei
   * @returns Promise<void>
   */
  stop(): Promise<void>;

  /**
   * Optionale Methode zum Testen der Node-Konfiguration
   * @returns Promise<{success: boolean, message: string}>
   */
  testConnection?(): Promise<{ success: boolean; message: string }>;

  /**
   * Gibt den aktuellen Health-Status der Node zurück
   * @returns {status: 'healthy' | 'degraded' | 'error', message?: string}
   */
  getHealthStatus?(): { status: 'healthy' | 'degraded' | 'error'; message?: string };
}

/**
 * Node-Factory Interface für dynamisches Laden von Nodes
 */
export interface INodeFactory {
  /**
   * Erstellt eine neue Node-Instanz
   * @param id Eindeutige Node-ID
   * @param type Node-Typ
   * @param config Node-Konfiguration
   * @returns INode-Instanz
   */
  createNode(id: string, type: string, config: Record<string, any>): INode;

  /**
   * Gibt alle verfügbaren Node-Typen zurück
   * @returns Array von Node-Typ-Namen
   */
  getAvailableNodeTypes(): string[];

  /**
   * Gibt die Schema-Definition für einen Node-Typ zurück
   * @param type Node-Typ
   * @returns Schema-Definition
   */
  getNodeSchema(type: string): NodeSchema;
}

/**
 * Schema-Definition für Node-Konfiguration
 */
export interface NodeSchema {
  type: string;
  displayName: string;
  description: string;
  category: 'input' | 'processing' | 'output' | 'utility';
  icon?: string;
  color?: string;
  config: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'select' | 'text';
      label: string;
      description?: string;
      required?: boolean;
      default?: any;
      options?: { value: any; label: string }[];
      validation?: {
        min?: number;
        max?: number;
        pattern?: string;
      };
    };
  };
  inputs: Array<{
    name: string;
    type: 'audio' | 'text' | 'control' | 'any';
  }>;
  outputs: Array<{
    name: string;
    type: 'audio' | 'text' | 'control' | 'any';
  }>;
}

/**
 * Basis-Node-Klasse mit gemeinsamer Funktionalität
 */
export abstract class BaseNode implements INode {
  public id: string;
  public type: string;
  public config: Record<string, any>;
  protected isRunning: boolean = false;

  constructor(id: string, type: string, config: Record<string, any>) {
    this.id = id;
    this.type = type;
    this.config = config;
  }

  abstract start(): Promise<void>;
  abstract process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void>;
  abstract stop(): Promise<void>;

  /**
   * Standard-Implementierung für Health-Status
   */
  getHealthStatus(): { status: 'healthy' | 'degraded' | 'error'; message?: string } {
    return {
      status: this.isRunning ? 'healthy' : 'error',
      message: this.isRunning ? 'Node is running' : 'Node is not running',
    };
  }

  /**
   * Hilfsmethode zum Emittieren von Output-USOs
   */
  protected emitOutput(
    emitter: EventEmitter,
    uso: UniversalStreamObject,
    outputPort: string = 'default'
  ): void {
    emitter.emit('node:output', {
      nodeId: this.id,
      port: outputPort,
      uso,
    });
  }

  /**
   * Hilfsmethode zum Emittieren von Fehlern
   */
  protected emitError(emitter: EventEmitter, error: Error, sessionId: string): void {
    const errorUso = {
      header: {
        id: sessionId,
        type: 'control' as const,
        sourceId: this.id,
        timestamp: Date.now(),
        final: true,
        control: {
          action: 'error',
          message: error.message,
          errorCode: error.name,
        },
      },
      payload: '',
    };

    this.emitOutput(emitter, errorUso);
    emitter.emit('node:error', {
      nodeId: this.id,
      error: error.message,
      sessionId,
    });
  }
}

