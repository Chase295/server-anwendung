import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter } from 'events';
import { AppLogger } from '../../common/logger';
import { UniversalStreamObject } from '../../types/USO';
import { INode } from '../../types/INode';
import { NodeFactory } from './node-factory';
import { WebSocketGateway } from '../devices/websocket.gateway';
import { DebugEventsGateway } from '../devices/debug-events.gateway';

/**
 * Flow-Engine: Zentrale Event-Engine für USO-Datenweiterleitung
 */
@Injectable()
export class FlowEngine implements OnModuleInit {
  private readonly logger = new AppLogger('FlowEngine');
  public readonly eventEmitter = new EventEmitter();
  
  private activeFlows: Map<string, FlowInstance> = new Map();
  private runningNodes: Map<string, INode> = new Map();

  constructor(
    private readonly nodeFactory: NodeFactory,
    private readonly wsGateway: WebSocketGateway,
    @Inject(forwardRef(() => DebugEventsGateway))
    private readonly debugEventsGateway: DebugEventsGateway,
  ) {
    // Event-Emitter mit hohem Limit für viele Listener
    this.eventEmitter.setMaxListeners(100);
  }

  async onModuleInit() {
    // WebSocket USO-Events abonnieren
    this.wsGateway.eventEmitter.on('uso:received', (uso: UniversalStreamObject, client: any) => {
      this.handleIncomingUSO(uso, client);
    });

    // Node-Output-Events abonnieren (ZENTRAL - nicht pro Flow!)
    this.eventEmitter.on('node:output', (event) => {
      this.handleNodeOutputGlobal(event);
    });

    // Debug-Events abonnieren und an Frontend weiterleiten
    this.eventEmitter.on('debug:log', (debugData: any) => {
      this.handleDebugEvent(debugData);
    });

    // Health-Status-Änderungen abonnieren und an Frontend weiterleiten
    this.eventEmitter.on('node:health-status-change', (healthData: any) => {
      this.handleHealthStatusChange(healthData);
    });

    this.logger.info('Flow Engine initialized');
  }

  /**
   * Startet einen Flow
   */
  async startFlow(flowId: string, flowDefinition: any): Promise<void> {
    try {
      this.logger.info('▶️  Starting flow...', { 
        flowId, 
        nodeCount: flowDefinition.nodes?.length || 0,
        edgeCount: flowDefinition.edges?.length || 0
      });

      // Nodes erstellen
      const nodes = new Map<string, INode>();
      
      for (const nodeDef of flowDefinition.nodes) {
        this.logger.debug('🔧 Creating node', { 
          flowId, 
          nodeId: nodeDef.id, 
          nodeType: nodeDef.type 
        });
        
        // Config aus nodeDef.data.config extrahieren (falls vorhanden)
        const config = nodeDef.data?.config || nodeDef.data || {};
        
        const node = this.nodeFactory.createNode(nodeDef.id, nodeDef.type, config);
        await node.start();
        nodes.set(nodeDef.id, node);
        this.runningNodes.set(nodeDef.id, node);
        
        this.logger.info('✅ Node started', { 
          flowId, 
          nodeId: nodeDef.id, 
          nodeType: nodeDef.type 
        });
      }

      // WICHTIG: Für Entry-Nodes (keine eingehenden Edges) den emitter setzen
      // Diese Nodes haben keine process()-Aufrufe, brauchen aber den emitter
      const entryNodeIds = this.findEntryNodes({
        id: flowId,
        definition: flowDefinition,
        nodes,
        edges: flowDefinition.edges,
        startedAt: Date.now(),
      });

      for (const nodeId of entryNodeIds) {
        const node = nodes.get(nodeId) as any;
        if (node && typeof node.setFlowEmitter === 'function') {
          node.setFlowEmitter(this.eventEmitter);
          this.logger.debug('Set flow emitter for entry node', { flowId, nodeId });
        }
      }

      // Flow-Instanz erstellen
      const flowInstance: FlowInstance = {
        id: flowId,
        definition: flowDefinition,
        nodes,
        edges: flowDefinition.edges,
        startedAt: Date.now(),
      };

      this.activeFlows.set(flowId, flowInstance);

      this.logger.info('🎉 Flow started successfully', { 
        flowId, 
        nodeCount: nodes.size,
        edgeCount: flowDefinition.edges?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      this.eventEmitter.emit('flow:started', { flowId });
    } catch (error) {
      this.logger.error('❌ Failed to start flow', error.message, { flowId });
      throw error;
    }
  }

  /**
   * Stoppt einen Flow
   */
  async stopFlow(flowId: string): Promise<void> {
    try {
      const flow = this.activeFlows.get(flowId);

      if (!flow) {
        this.logger.warn('⚠️  Flow not found (may already be stopped)', { flowId });
        return;
      }

      const uptime = Date.now() - flow.startedAt;
      const uptimeMinutes = Math.floor(uptime / 60000);
      
      this.logger.info('⏹️  Stopping flow...', { 
        flowId, 
        nodeCount: flow.nodes.size,
        uptimeMinutes 
      });

      // Alle Nodes stoppen
      for (const [nodeId, node] of flow.nodes) {
        this.logger.debug('🔧 Stopping node', { flowId, nodeId });
        await node.stop();
        this.runningNodes.delete(nodeId);
        this.logger.info('✅ Node stopped', { flowId, nodeId });
      }

      this.activeFlows.delete(flowId);

      this.logger.info('🛑 Flow stopped successfully', { 
        flowId, 
        nodesStopped: flow.nodes.size,
        uptimeMinutes,
        timestamp: new Date().toISOString()
      });
      
      this.eventEmitter.emit('flow:stopped', { flowId });
    } catch (error) {
      this.logger.error('❌ Failed to stop flow', error.message, { flowId });
      throw error;
    }
  }

  /**
   * Behandelt eingehende USOs von WebSocket
   */
  private handleIncomingUSO(uso: UniversalStreamObject, client: any): void {
    try {
      this.logger.logUSO('in', uso, { clientId: client.clientId });

      // Flow-Data-Event emittieren
      this.eventEmitter.emit('flow:data', {
        uso,
        source: 'websocket',
        clientId: client.clientId,
      });

      // Finde Eingangs-Nodes (Nodes ohne eingehende Edges)
      // Für jetzt: Routing basierend auf Node-Typ und Client-Capabilities
      this.routeUSOToNodes(uso);
    } catch (error) {
      this.logger.error('Error handling incoming USO', error.message, {
        sessionId: uso.header.id,
      });
    }
  }

  /**
   * Routet ein USO zu den entsprechenden Nodes
   */
  private routeUSOToNodes(uso: UniversalStreamObject): void {
    // Für jeden aktiven Flow
    this.activeFlows.forEach(async (flow) => {
      // Finde Eingangs-Nodes (keine eingehenden Edges)
      const entryNodes = this.findEntryNodes(flow);

      for (const nodeId of entryNodes) {
        const node = flow.nodes.get(nodeId);
        
        if (!node) continue;

        // Prüfe ob Node das USO-Type akzeptiert
        // TODO: Implementiere Schema-Validierung
        try {
          await node.process(uso, this.eventEmitter);
        } catch (error) {
          this.logger.error('Node processing error', error.message, {
            flowId: flow.id,
            nodeId,
            sessionId: uso.header.id,
          });

          this.eventEmitter.emit('node:error', {
            flowId: flow.id,
            nodeId,
            error: error.message,
            sessionId: uso.header.id,
          });
        }
      }
    });
  }

  /**
   * Behandelt Node-Output global (für alle Flows)
   */
  private async handleNodeOutputGlobal(event: any): Promise<void> {
    const { nodeId, port, uso } = event;

    // Finde Flow der diese Node enthält
    for (const [flowId, flow] of this.activeFlows) {
      if (flow.nodes.has(nodeId)) {
        await this.handleNodeOutput(flowId, event);
        return;
      }
    }

    this.logger.warn('Node output from unknown node', { nodeId });
  }

  /**
   * Behandelt Node-Output und routet zu nachfolgenden Nodes
   */
  private async handleNodeOutput(flowId: string, event: any): Promise<void> {
    const { nodeId, port, uso } = event;

    try {
      this.logger.debug('Node output', { flowId, nodeId, port, sessionId: uso.header.id });

      const flow = this.activeFlows.get(flowId);
      if (!flow) return;

      // Finde nachfolgende Nodes
      const targetNodeIds = this.findTargetNodes(flow, nodeId, port);

      for (const targetNodeId of targetNodeIds) {
        const targetNode = flow.nodes.get(targetNodeId);
        
        if (!targetNode) continue;

        try {
          await targetNode.process(uso, this.eventEmitter);
        } catch (error) {
          this.logger.error('Target node processing error', error.message, {
            flowId,
            sourceNodeId: nodeId,
            targetNodeId,
            sessionId: uso.header.id,
          });

          this.eventEmitter.emit('node:error', {
            flowId,
            nodeId: targetNodeId,
            error: error.message,
            sessionId: uso.header.id,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error handling node output', error.message, { flowId, nodeId });
    }
  }

  /**
   * Findet Eingangs-Nodes (ohne eingehende Edges)
   */
  private findEntryNodes(flow: FlowInstance): string[] {
    const allNodes = Array.from(flow.nodes.keys());
    const nodesWithIncoming = new Set(flow.edges.map(e => e.target));
    
    return allNodes.filter(nodeId => !nodesWithIncoming.has(nodeId));
  }

  /**
   * Findet Ziel-Nodes für einen Output-Port
   */
  private findTargetNodes(flow: FlowInstance, sourceNodeId: string, port: string): string[] {
    return flow.edges
      .filter(edge => edge.source === sourceNodeId && (edge.sourceHandle === port || port === 'default'))
      .map(edge => edge.target);
  }

  /**
   * Gibt aktive Flows zurück
   */
  getActiveFlows(): Array<{ id: string; nodeCount: number; startedAt: number }> {
    return Array.from(this.activeFlows.values()).map(flow => ({
      id: flow.id,
      nodeCount: flow.nodes.size,
      startedAt: flow.startedAt,
    }));
  }

  /**
   * Gibt Health-Status aller Nodes zurück
   */
  getNodesHealthStatus(): Map<string, any> {
    const status = new Map();

    this.runningNodes.forEach((node, nodeId) => {
      if (node.getHealthStatus) {
        status.set(nodeId, node.getHealthStatus());
      } else {
        status.set(nodeId, { status: 'unknown' });
      }
    });

    return status;
  }

  /**
   * Behandelt Debug-Events und sendet sie an Frontend-Clients
   */
  private handleDebugEvent(debugData: any): void {
    try {
      const { nodeId, timestamp, uso } = debugData;

      // Finde Flow-ID für diese Node
      let flowId: string | null = null;
      let flowName: string | null = null;
      let nodeLabel: string | null = null;

      for (const [fId, flow] of this.activeFlows) {
        if (flow.nodes.has(nodeId)) {
          flowId = fId;
          flowName = flow.definition.name || 'Unnamed Flow';
          
          // Finde Node-Label aus Definition
          const nodeDef = flow.definition.nodes.find((n: any) => n.id === nodeId);
          nodeLabel = nodeDef?.data?.label || nodeDef?.type || 'Unknown';
          
          break;
        }
      }

      if (!flowId) {
        this.logger.warn('Debug event from unknown flow', { nodeId });
        return;
      }

      // Debug-Event an Frontend senden (mit payloadPreview von der Debug Node)
      this.debugEventsGateway.broadcastDebugEvent({
        flowId,
        flowName: flowName || undefined,
        nodeId,
        nodeLabel: nodeLabel || undefined,
        timestamp,
        uso: {
          header: uso.header,
          payloadType: uso.payloadType,
          payloadSize: uso.payloadSize,
          payloadPreview: uso.payloadPreview, // Preview von Debug Node übernehmen
        },
      });

      this.logger.debug('Debug event forwarded to frontend', {
        flowId,
        nodeId,
        payloadSize: uso.payloadSize,
        hasPreview: !!uso.payloadPreview,
      });
    } catch (error) {
      this.logger.error('Error handling debug event', error.message);
    }
  }

  /**
   * Behandelt Health-Status-Änderungen und sendet sie an Frontend-Clients
   */
  private handleHealthStatusChange(healthData: any): void {
    try {
      const { nodeId, nodeType, status, message, connectedClients, timestamp } = healthData;

      // Finde Flow-ID für diese Node
      let flowId: string | null = null;
      let flowName: string | null = null;
      let nodeLabel: string | null = null;

      for (const [fId, flow] of this.activeFlows) {
        if (flow.nodes.has(nodeId)) {
          flowId = fId;
          flowName = flow.definition.name;
          
          // Finde Node-Label
          const nodeDef = flow.definition.nodes.find((n: any) => n.id === nodeId);
          if (nodeDef) {
            nodeLabel = nodeDef.data?.label || nodeType;
          }
          break;
        }
      }

      if (!flowId) {
        this.logger.warn('Health status change for unknown node', { nodeId });
        return;
      }

      // An Debug-Events-Gateway senden
      this.debugEventsGateway.broadcastHealthStatus({
        flowId,
        flowName: flowName || undefined,
        nodeId,
        nodeLabel: nodeLabel || undefined,
        nodeType,
        status,
        message,
        connectedClients,
        timestamp,
      });

      this.logger.debug('Health status change forwarded to frontend', {
        flowId,
        nodeId,
        nodeType,
        status,
        connectedClients,
      });
    } catch (error) {
      this.logger.error('Error handling health status change', error.message);
    }
  }
}

/**
 * Interface für Flow-Instanz
 */
interface FlowInstance {
  id: string;
  definition: any;
  nodes: Map<string, INode>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
  startedAt: number;
}

