'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { flowsApi } from '@/lib/api';
import Toolbar from './Toolbar';
import NodePanel from './NodePanel';
import CustomNode from './CustomNode';
import Toast from '@/components/Toast';
import EventPanel from './EventPanel';
import { useDebugEvents } from '@/hooks/useDebugEvents';
import { Save, ArrowLeft, Play, Square } from 'lucide-react';

export default function FlowEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flowId = searchParams?.get('id');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flowName, setFlowName] = useState('Neuer Flow');
  const [flowDescription, setFlowDescription] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Debug Events Hook
  const { events, nodeHealthStatus, isConnected, clearEvents } = useDebugEvents(flowId || undefined);

  // Custom Node Types
  const nodeTypes = useMemo(() => ({ customNode: CustomNode }), []);

  // Nodes mit Health-Status anreichern
  const nodesWithHealthStatus = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        healthStatus: nodeHealthStatus.get(node.id),
      },
    }));
  }, [nodes, nodeHealthStatus]);

  // Datentyp-Mapping für Node-Verbindungen
  const getNodeDataTypes = (nodeType: string, config?: any) => {
    switch (nodeType) {
      case 'mic':
        return { input: null, output: 'audio' }; // Nur Audio-Output
      case 'stt':
        return { input: 'audio', output: 'text' }; // Audio → Text
      case 'ai':
        return { input: 'text', output: 'text' }; // Text → Text
      case 'tts':
        return { input: 'text', output: 'audio' }; // Text → Audio
      case 'speaker':
        return { input: 'audio', output: null }; // Nur Audio-Input
      case 'ws_in':
        // WebSocket Input: Je nach Konfiguration
        let wsInType = config?.dataType || 'audio'; // Default: audio
        // 'raw' wird als 'text' behandelt (JSON ist Text-basiert)
        if (wsInType === 'raw') wsInType = 'text';
        return { input: null, output: wsInType };
      case 'ws_out':
        // WebSocket Output: Je nach Konfiguration
        let wsOutType = config?.dataType || 'audio'; // Default: audio
        // 'raw' wird als 'text' behandelt (JSON ist Text-basiert)
        if (wsOutType === 'raw') wsOutType = 'text';
        return { input: wsOutType, output: null };
      case 'debug':
        return { input: 'any', output: null }; // Akzeptiert alles
      default:
        return { input: 'any', output: 'any' }; // Standard: alles erlaubt
    }
  };

  // Validierung von Verbindungen
  const isValidConnection = useCallback(
    (connection: Connection) => {
      // Finde Source- und Target-Nodes
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) {
        return false;
      }

      // Hole Datentypen
      const sourceTypes = getNodeDataTypes(sourceNode.data.type, sourceNode.data.config);
      const targetTypes = getNodeDataTypes(targetNode.data.type, targetNode.data.config);

      // Source Output und Target Input müssen kompatibel sein
      const sourceOutput = sourceTypes.output;
      const targetInput = targetTypes.input;

      // Debug-Logging
      console.log('Connection validation:', {
        source: sourceNode.data.type,
        sourceConfig: sourceNode.data.config,
        sourceOutput,
        target: targetNode.data.type,
        targetConfig: targetNode.data.config,
        targetInput,
        compatible: sourceOutput === targetInput || sourceOutput === 'any' || targetInput === 'any'
      });

      // Wenn einer 'any' ist, erlauben
      if (sourceOutput === 'any' || targetInput === 'any') {
        return true;
      }

      // Wenn einer null ist (kein Output/Input), ablehnen
      if (sourceOutput === null || targetInput === null) {
        return false;
      }

      // Typen müssen übereinstimmen
      return sourceOutput === targetInput;
    },
    [nodes]
  );

  // Flow laden (falls Edit-Modus)
  useEffect(() => {
    if (flowId) {
      loadFlow(flowId);
    }
  }, [flowId]);

  // Status-Refresh beim Mount und wenn Komponente wieder sichtbar wird
  useEffect(() => {
    if (!flowId) return;

    // Status beim Mount aktualisieren
    refreshFlowStatus(flowId);

    // Status auch aktualisieren wenn Tab wieder fokussiert wird
    const handleVisibilityChange = () => {
      if (!document.hidden && flowId) {
        refreshFlowStatus(flowId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flowId]);

  const loadFlow = async (id: string) => {
    try {
      const response = await flowsApi.getOne(id);
      const flow = response.data;
      
      setFlowName(flow.name);
      setFlowDescription(flow.description || '');
      setIsRunning(flow.isRunning === true);
      
      // Convert loaded nodes to use customNode type
      const loadedNodes = (flow.definition.nodes || []).map((node: Node) => ({
        ...node,
        type: 'customNode', // Ensure all nodes use our custom type
      }));
      
      setNodes(loadedNodes);
      setEdges(flow.definition.edges || []);
    } catch (error) {
      console.error('Fehler beim Laden des Flows:', error);
      setToast({ message: 'Fehler beim Laden des Flows', type: 'error' });
    }
  };

  const refreshFlowStatus = async (id: string) => {
    try {
      const response = await flowsApi.getOne(id);
      const flow = response.data;
      const running = flow.isRunning === true;
      setIsRunning(running);
      console.log('[FlowEditor] Status refreshed:', { isRunning: flow.isRunning, running });
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Flow-Status:', error);
    }
  };

  const handleToggleFlow = async () => {
    if (!flowId) {
      setToast({ message: 'Bitte speichern Sie den Flow zuerst', type: 'warning' });
      return;
    }

    setIsToggling(true);
    try {
      if (isRunning) {
        await flowsApi.stop(flowId);
        setIsRunning(false);
        setToast({ message: 'Flow gestoppt', type: 'success' });
      } else {
        await flowsApi.start(flowId);
        setIsRunning(true);
        setToast({ message: 'Flow gestartet', type: 'success' });
      }
    } catch (error: any) {
      console.error('Fehler beim Starten/Stoppen:', error);
      setToast({ 
        message: error.response?.data?.message || 'Fehler beim Starten/Stoppen des Flows', 
        type: 'error' 
      });
    } finally {
      setIsToggling(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Keyboard-Handler für Delete-Taste
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prüfe ob der Focus gerade in einem Input-Feld ist
      const target = event.target as HTMLElement;
      const isInputField = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Wenn in einem Input-Feld, NICHT löschen!
      if (isInputField) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Lösche ausgewählte Edges
        setEdges((eds) => eds.filter((edge) => !edge.selected));
        // Lösche ausgewählte Nodes
        setNodes((nds) => {
          const selectedNodeIds = nds.filter((n) => n.selected).map((n) => n.id);
          // Lösche auch verbundene Edges
          if (selectedNodeIds.length > 0) {
            setEdges((eds) =>
              eds.filter(
                (e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
              )
            );
          }
          return nds.filter((n) => !n.selected);
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setEdges, setNodes]);

  const handleAddNode = (nodeType: string, position?: { x: number; y: number }) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: 'customNode', // Use custom node type
      position: position || { x: 250, y: 100 },
      data: { 
        label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
        type: nodeType,
        config: {},
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // Drag & Drop handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type || !reactFlowBounds || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      handleAddNode(type, position);
    },
    [reactFlowInstance, handleAddNode]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  const handleSave = async () => {
    if (!flowName.trim()) {
      setToast({ message: 'Bitte geben Sie einen Namen für den Flow ein', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const flowDefinition = {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.data.type || 'debug',
          position: node.position,
          data: node.data,
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        })),
      };

      if (flowId) {
        // Update
        await flowsApi.update(flowId, {
          name: flowName,
          description: flowDescription,
          definition: flowDefinition,
        });
      } else {
        // Create
        await flowsApi.create({
          name: flowName,
          description: flowDescription,
          definition: flowDefinition,
        });
      }

      setToast({ message: '✓ Flow erfolgreich gespeichert!', type: 'success' });
      // NICHT mehr zur Flow-Übersicht navigieren - im Editor bleiben!
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      setToast({ message: 'Fehler beim Speichern des Flows', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/flows')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-900 dark:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-xl font-bold text-gray-900 dark:text-white border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 bg-transparent"
              placeholder="Flow-Name"
            />
            <input
              type="text"
              value={flowDescription}
              onChange={(e) => setFlowDescription(e.target.value)}
              className="text-sm text-gray-600 dark:text-gray-400 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 mt-1 block bg-transparent"
              placeholder="Beschreibung (optional)"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Start/Stop Button */}
          {flowId && (
            <button
              onClick={handleToggleFlow}
              disabled={isToggling}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 font-medium transition-all shadow-lg disabled:opacity-50 ${
                isRunning
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <Square className="w-5 h-5" />
                  <span>{isToggling ? 'Stoppe...' : 'Stop'}</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>{isToggling ? 'Starte...' : 'Start'}</span>
                </>
              )}
            </button>
          )}
          
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:bg-gray-400 dark:disabled:bg-gray-600 shadow-lg"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Speichere...' : 'Speichern'}</span>
          </button>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex">
        {/* Toolbar */}
        <Toolbar onAddNode={handleAddNode} />

        {/* React Flow Canvas */}
        <div 
          ref={reactFlowWrapper}
          className="flex-1 bg-gray-50 dark:bg-gray-900" 
          style={{ height: '100%' }}
        >
          <ReactFlow
            nodes={nodesWithHealthStatus}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={onInit}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            isValidConnection={isValidConnection}
            connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
            defaultEdgeOptions={{
              animated: false,
              style: { stroke: '#94a3b8', strokeWidth: 2 },
            }}
            deleteKeyCode="Delete"
            selectionOnDrag={true}
            panOnDrag={[1, 2]}
            selectNodesOnDrag={false}
            fitView
            style={{ width: '100%', height: '100%' }}
          >
            <Background color="#aaa" gap={16} />
            <Controls />
            <MiniMap />
            <Panel position="top-right" className="bg-white dark:bg-gray-800 p-3 rounded shadow text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
              <div className="font-semibold mb-2">Flow Info</div>
              <div className="space-y-1">
                <div>Nodes: {nodes.length}</div>
                <div>Edges: {edges.length}</div>
                {flowId && (
                  <div className="flex items-center gap-2 pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="font-medium">Status:</span>
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                      isRunning 
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      <span className={`inline-flex h-2 w-2 rounded-full ${
                        isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`}></span>
                      {isRunning ? 'Läuft' : 'Gestoppt'}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
                <div className="font-medium mb-1">Tastenkürzel:</div>
                <div>• Delete = Löschen</div>
                <div>• Klick = Auswählen</div>
                <div>• Drag = Verschieben</div>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Node Configuration Panel */}
        {selectedNode && (
          <NodePanel
            node={selectedNode}
            healthStatus={nodeHealthStatus.get(selectedNode.id)}
            onClose={() => setSelectedNode(null)}
            onUpdate={(updatedNode) => {
              setNodes((nds) =>
                nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
              );
              setSelectedNode(updatedNode);
            }}
            onDelete={() => {
              setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
              setEdges((eds) =>
                eds.filter(
                  (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
                )
              );
              setSelectedNode(null);
            }}
          />
        )}
      </div>

      {/* Event Panel (unten andockbar) */}
      <EventPanel 
        events={events}
        isConnected={isConnected}
        onClearEvents={clearEvents}
        flowId={flowId || undefined}
      />

      {/* Toast-Benachrichtigung */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

