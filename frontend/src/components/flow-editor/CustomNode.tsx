'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Bug, Mic, Volume2, MessageSquare, Cpu, Wifi } from 'lucide-react';

function CustomNode({ data, selected }: NodeProps) {
  const [isInputHovered, setIsInputHovered] = useState(false);
  const [isOutputHovered, setIsOutputHovered] = useState(false);

  // Icon-Mapping für alle Node-Typen
  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'debug':
        return { icon: Bug, color: 'gray' };
      case 'mic':
        return { icon: Mic, color: 'blue' };
      case 'stt':
        return { icon: MessageSquare, color: 'green' };
      case 'ai':
        return { icon: Cpu, color: 'purple' };
      case 'tts':
        return { icon: Volume2, color: 'orange' };
      case 'speaker':
        return { icon: Volume2, color: 'red' };
      case 'ws_in':
        return { icon: Wifi, color: 'indigo' };
      case 'ws_out':
        return { icon: Wifi, color: 'indigo' };
      default:
        return { icon: Bug, color: 'gray' };
    }
  };

  // Definiere welche Handles jeder Node-Typ haben soll
  const getNodeHandles = (nodeType: string) => {
    switch (nodeType) {
      case 'debug':
        return { hasInput: true, hasOutput: false }; // Nur Input (Endpunkt)
      case 'mic':
        return { hasInput: false, hasOutput: true }; // Nur Output (Startpunkt)
      case 'stt':
        return { hasInput: true, hasOutput: true }; // Input und Output
      case 'ai':
        return { hasInput: true, hasOutput: true }; // Input und Output
      case 'tts':
        return { hasInput: true, hasOutput: true }; // Input und Output
      case 'speaker':
        return { hasInput: true, hasOutput: false }; // Nur Input (Endpunkt)
      case 'ws_in':
        return { hasInput: false, hasOutput: true }; // Nur Output (Startpunkt)
      case 'ws_out':
        return { hasInput: true, hasOutput: false }; // Nur Input (Endpunkt)
      default:
        return { hasInput: true, hasOutput: true }; // Standard: beide
    }
  };

  const { hasInput, hasOutput } = getNodeHandles(data.type);
  const { icon: Icon, color } = getNodeIcon(data.type);

  // Dark Mode Detection
  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  // Health Status Badge für WS_In Nodes
  const healthStatus = data.healthStatus;
  const showHealthBadge = data.type === 'ws_in';
  const isConnected = healthStatus && healthStatus.connectedClients && healthStatus.connectedClients > 0;

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-white dark:bg-gray-800 transition-all min-w-[120px] relative ${
        selected 
          ? 'border-blue-500 dark:border-blue-400 shadow-blue-500/50 dark:shadow-blue-400/50 ring-2 ring-blue-500/30 dark:ring-blue-400/30' 
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
      }`}
    >
      {/* Health Status Badge (oben rechts) - Immer für WS_In Nodes */}
      {showHealthBadge && (
        <div className={`absolute -top-3 -right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg transition-all duration-300 ${
          isConnected
            ? 'bg-gradient-to-br from-green-400 to-green-500 dark:from-green-500 dark:to-green-600 border-2 border-green-300 dark:border-green-400'
            : 'bg-gradient-to-br from-red-400 to-red-500 dark:from-red-500 dark:to-red-600 border-2 border-red-300 dark:border-red-400'
        }`}>
          {/* Pulsierender Punkt */}
          <div className="relative flex items-center justify-center">
            {isConnected ? (
              <>
                <span className="absolute inline-flex h-3 w-3 rounded-full bg-green-300 dark:bg-green-200 opacity-75 animate-ping"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white shadow-sm"></span>
              </>
            ) : (
              <>
                <span className="absolute inline-flex h-3 w-3 rounded-full bg-red-300 dark:bg-red-200 opacity-75 animate-pulse"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white shadow-sm"></span>
              </>
            )}
          </div>
          {/* Anzahl der Clients */}
          <span className="text-xs font-bold text-white drop-shadow-md leading-none">
            {healthStatus?.connectedClients ?? 0}
          </span>
        </div>
      )}
      {/* Input Handle (Links) - nur wenn benötigt */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: '11px',
            height: '11px',
            backgroundColor: isDarkMode ? '#60a5fa' : '#3b82f6', // blue-400 : blue-500
            border: `1.5px solid ${isDarkMode ? '#111827' : 'white'}`, // gray-900 : white
            boxShadow: isInputHovered 
              ? (isDarkMode 
                  ? '0 6px 12px -1px rgba(96, 165, 250, 0.8), 0 4px 8px -1px rgba(96, 165, 250, 0.6), 0 0 0 2px rgba(96, 165, 250, 0.3)' 
                  : '0 6px 12px -1px rgba(59, 130, 246, 0.8), 0 4px 8px -1px rgba(59, 130, 246, 0.6), 0 0 0 2px rgba(59, 130, 246, 0.3)')
              : (isDarkMode 
                  ? '0 2px 4px -1px rgba(96, 165, 250, 0.4), 0 1px 2px -1px rgba(96, 165, 250, 0.2)' 
                  : '0 2px 4px -1px rgba(59, 130, 246, 0.4), 0 1px 2px -1px rgba(59, 130, 246, 0.2)'),
            transformOrigin: 'center center',
            transition: 'box-shadow 0.2s ease-in-out',
          }}
          onMouseEnter={() => setIsInputHovered(true)}
          onMouseLeave={() => setIsInputHovered(false)}
          className=""
        />
      )}

      {/* Node Content mit Icon */}
      <div className="flex items-center justify-center space-x-2">
        <Icon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
        <div className="text-gray-900 dark:text-white font-medium text-sm">
          {data.label}
        </div>
      </div>

      {/* Output Handle (Rechts) - nur wenn benötigt */}
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: '11px',
            height: '11px',
            backgroundColor: isDarkMode ? '#34d399' : '#10b981', // green-400 : green-500
            border: `1.5px solid ${isDarkMode ? '#111827' : 'white'}`, // gray-900 : white
            boxShadow: isOutputHovered 
              ? (isDarkMode 
                  ? '0 6px 12px -1px rgba(52, 211, 153, 0.8), 0 4px 8px -1px rgba(52, 211, 153, 0.6), 0 0 0 2px rgba(52, 211, 153, 0.3)' 
                  : '0 6px 12px -1px rgba(16, 185, 129, 0.8), 0 4px 8px -1px rgba(16, 185, 129, 0.6), 0 0 0 2px rgba(16, 185, 129, 0.3)')
              : (isDarkMode 
                  ? '0 2px 4px -1px rgba(52, 211, 153, 0.4), 0 1px 2px -1px rgba(52, 211, 153, 0.2)' 
                  : '0 2px 4px -1px rgba(16, 185, 129, 0.4), 0 1px 2px -1px rgba(16, 185, 129, 0.2)'),
            transformOrigin: 'center center',
            transition: 'box-shadow 0.2s ease-in-out',
          }}
          onMouseEnter={() => setIsOutputHovered(true)}
          onMouseLeave={() => setIsOutputHovered(false)}
          className=""
        />
      )}
    </div>
  );
}

export default memo(CustomNode);

