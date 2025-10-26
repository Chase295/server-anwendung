import { useState, useEffect, useCallback, useRef } from 'react';

export interface DebugEvent {
  flowId: string;
  flowName?: string;
  nodeId: string;
  nodeLabel?: string;
  timestamp: number;
  isFinal?: boolean;
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

export function useDebugEvents(flowId?: string) {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [nodeHealthStatus, setNodeHealthStatus] = useState<Map<string, HealthStatusEvent>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const flowIdRef = useRef<string | undefined>(flowId);
  const maxEvents = 50;
  const seenEventIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    flowIdRef.current = flowId;
  }, [flowId]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return;
    }

    console.log('[DebugEvents] Starting HTTP polling (no WebSocket, no Nginx changes needed)');
    setError(null);
    
    const poll = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
        const since = Date.now() - 60000; // Letzte Minute
        const currentFlowId = flowIdRef.current;
        
        // Hole Debug-Events vom Backend (gecacht)
        const response = await fetch(
          `${apiUrl}/devices/debug-events?flowId=${currentFlowId || ''}&since=${since}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setIsConnected(true);
          
          if (data.events && Array.isArray(data.events)) {
            data.events.forEach((event: DebugEvent) => {
              // Nur neue Events hinzufügen
              if (!seenEventIds.current.has(event.timestamp)) {
                seenEventIds.current.add(event.timestamp);
                
                setEvents((prev) => {
                  // Prüfe ob Event bereits existiert
                  const exists = prev.some(e => 
                    e.nodeId === event.nodeId && 
                    e.timestamp === event.timestamp &&
                    e.uso.payloadPreview === event.uso.payloadPreview
                  );
                  
                  if (exists) return prev;
                  
                  const newEvents = [event, ...prev];
                  return newEvents.slice(0, maxEvents);
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('[DebugEvents] Polling error (will retry):', err);
        setError(null); // Kein sichtbarer Fehler
      }
    };

    // Initial poll
    poll();
    
    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(poll, 2000);
  }, [maxEvents]);

  const disconnect = useCallback(() => {
    console.log('[DebugEvents] Disconnecting...');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = undefined;
    }
    setIsConnected(false);
    seenEventIds.current.clear();
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    seenEventIds.current.clear();
  }, []);

  const connect = useCallback(() => {
    startPolling();
  }, [startPolling]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    events,
    nodeHealthStatus,
    isConnected,
    error,
    clearEvents,
    reconnect: connect,
  };
}
