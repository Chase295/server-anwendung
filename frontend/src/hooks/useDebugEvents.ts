import { useState, useEffect, useCallback, useRef } from 'react';

export interface DebugEvent {
  flowId: string;
  flowName?: string;
  nodeId: string;
  nodeLabel?: string;
  timestamp: number;
  uso: {
    header: any;
    payloadType: string;
    payloadSize: number;
    payloadPreview?: string;
  };
}

export interface HealthStatusEvent {
  flowId: string;
  flowName?: string;
  nodeId: string;
  nodeLabel?: string;
  nodeType: string;
  status: 'healthy' | 'degraded' | 'error';
  message?: string;
  connectedClients?: number;
  timestamp: number;
}

interface DebugEventMessage {
  type: string;
  event?: DebugEvent | HealthStatusEvent;
  timestamp: number;
  message?: string;
}

export function useDebugEvents(flowId?: string) {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [nodeHealthStatus, setNodeHealthStatus] = useState<Map<string, HealthStatusEvent>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const flowIdRef = useRef<string | undefined>(flowId);
  const maxEvents = 50; // Maximale Anzahl der Events

  // flowId im Ref speichern, um es in Event-Handlern zu verwenden
  useEffect(() => {
    flowIdRef.current = flowId;
  }, [flowId]);

  const connect = useCallback(() => {
    // Verhindere mehrfache Verbindungen
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[DebugEvents] Already connected/connecting, skipping');
      return;
    }

    try {
      // WebSocket URL (Port 8082 für Debug Events)
      const wsUrl = process.env.NEXT_PUBLIC_DEBUG_WS_URL || 'ws://localhost:8082';
      
      console.log('[DebugEvents] Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[DebugEvents] Connected');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: DebugEventMessage = JSON.parse(event.data);
          
          if (message.type === 'welcome') {
            console.log('[DebugEvents]', message.message);
            return;
          }

          if (message.type === 'debug:event' && message.event) {
            const debugEvent = message.event as DebugEvent;
            
            // Filter nach flowId wenn angegeben (verwende flowIdRef)
            const currentFlowId = flowIdRef.current;
            if (currentFlowId && debugEvent.flowId !== currentFlowId) {
              return;
            }

            setEvents((prev) => {
              const newEvents = [debugEvent, ...prev];
              // Limitiere auf maxEvents
              return newEvents.slice(0, maxEvents);
            });
          }

          if (message.type === 'health:status' && message.event) {
            const healthEvent = message.event as HealthStatusEvent;
            
            // Filter nach flowId wenn angegeben
            const currentFlowId = flowIdRef.current;
            if (currentFlowId && healthEvent.flowId !== currentFlowId) {
              return;
            }

            // Aktualisiere Health-Status für diese Node
            setNodeHealthStatus((prev) => {
              const newMap = new Map(prev);
              newMap.set(healthEvent.nodeId, healthEvent);
              return newMap;
            });

            console.log('[DebugEvents] Health status updated:', {
              nodeId: healthEvent.nodeId,
              status: healthEvent.status,
              connectedClients: healthEvent.connectedClients,
            });
          }
        } catch (err) {
          console.error('[DebugEvents] Error parsing message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[DebugEvents] WebSocket error:', error);
        setError('WebSocket-Verbindungsfehler');
      };

      ws.onclose = () => {
        console.log('[DebugEvents] Disconnected');
        setIsConnected(false);
        
        // Nur reconnecten wenn wsRef noch gesetzt ist (nicht durch disconnect() aufgerufen)
        if (wsRef.current === ws) {
          wsRef.current = null;
          
          // Auto-Reconnect nach 3 Sekunden
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[DebugEvents] Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('[DebugEvents] Connection error:', err);
      setError('Fehler beim Verbinden');
    }
  }, []); // Keine Dependencies - verwende flowIdRef stattdessen

  const disconnect = useCallback(() => {
    console.log('[DebugEvents] Disconnecting...');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      // Entferne Event-Handler vor dem Schließen
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Auto-Connect beim Mount (nur einmal!)
  useEffect(() => {
    // Verhindere mehrfache Verbindungen
    if (wsRef.current) {
      console.log('[DebugEvents] Already connected, skipping connect');
      return;
    }

    connect();

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Nur beim Mount, nicht bei connect/disconnect Änderungen!

  return {
    events,
    nodeHealthStatus,
    isConnected,
    error,
    clearEvents,
    reconnect: connect,
  };
}

