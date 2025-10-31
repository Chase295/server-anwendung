'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Settings, Activity, Clock, Database, FileText, Circle } from 'lucide-react';
import { DebugEvent } from '@/hooks/useDebugEvents';

interface EventPanelProps {
  events: DebugEvent[];
  isConnected: boolean;
  onClearEvents: () => void;
  flowId?: string;
}

type ViewMode = 'compact' | 'detailed' | 'json';
type FilterType = 'all' | 'audio' | 'text' | 'control';

export default function EventPanel({ events, isConnected, onClearEvents, flowId }: EventPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [height, setHeight] = useState(300); // Standard-Höhe
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isResizing, setIsResizing] = useState(false);

  // Filter Events und sortiere neueste zuerst (bereits geschehen durch [event, ...prev], aber sicherstellen)
  const filteredEvents = events
    .filter((event) => {
      if (filter === 'all') return true;
      return event.uso.header.type === filter;
    })
    .sort((a, b) => b.timestamp - a.timestamp); // Neueste zuerst

  // Formatierung
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'audio':
        return 'text-purple-600 dark:text-purple-400';
      case 'text':
        return 'text-blue-600 dark:text-blue-400';
      case 'control':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Mouse-Handler für Resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newHeight = window.innerHeight - e.clientY;
    setHeight(Math.max(100, Math.min(newHeight, window.innerHeight - 200)));
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Event-Listener für Resizing
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  }

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 shadow-lg z-40"
      style={{ height: isOpen ? `${height}px` : '48px' }}
    >
      {/* Resize-Handle (nur wenn offen) */}
      {isOpen && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-gray-400 dark:bg-gray-600 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title={isOpen ? 'Panel schließen' : 'Panel öffnen'}
          >
            {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
          
          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Debug Events
          </h3>
          
          <div className="flex items-center space-x-2">
            <Circle 
              className={`w-2 h-2 ${isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isConnected ? 'Verbunden' : 'Getrennt'}
            </span>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'Event' : 'Events'}
          </div>
        </div>

        {isOpen && (
          <div className="flex items-center space-x-2">
            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">Alle Typen</option>
              <option value="audio">Audio</option>
              <option value="text">Text</option>
              <option value="control">Control</option>
            </select>

            {/* View Mode */}
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="compact">Kompakt</option>
              <option value="detailed">Detailliert</option>
              <option value="json">JSON</option>
            </select>

            {/* Clear Button */}
            <button
              onClick={onClearEvents}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors text-red-600 dark:text-red-400"
              title="Alle Events löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isOpen && (
        <div className="overflow-y-auto" style={{ height: `${height - 96}px` }}>
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <Activity className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">
                {events.length === 0 
                  ? 'Keine Events empfangen'
                  : 'Keine Events für diesen Filter'
                }
              </p>
              <p className="text-xs mt-1">
                {flowId ? 'Debug-Nodes im aktuellen Flow werden hier angezeigt' : 'Öffne einen Flow um Debug-Events zu sehen'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEvents.map((event, index) => (
                <div key={`${event.nodeId}-${event.timestamp}-${index}`} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {viewMode === 'compact' && (
                    <div className="space-y-1">
                      <div className="flex items-start space-x-3 text-xs">
                        <span className="text-gray-400 dark:text-gray-500 font-mono">
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <span className={`font-medium ${getTypeColor(event.uso.header.type)}`}>
                          {event.uso.header.type.toUpperCase()}
                        </span>
                        {event.isFinal === false && (
                          <span className="text-orange-600 dark:text-orange-400 font-bold animate-pulse">
                            [LIVE]
                          </span>
                        )}
                        {event.isFinal === true && (
                          <span className="text-green-600 dark:text-green-400 font-bold bg-green-100 dark:bg-green-900 px-1 rounded">
                            [FINAL]
                          </span>
                        )}
                        <span className="text-gray-900 dark:text-white font-medium">
                          {event.nodeLabel || event.nodeId}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatSize(event.uso.payloadSize)}
                        </span>
                        {event.uso.header.sourceId && (
                          <span className="text-gray-400 dark:text-gray-500">
                            from: {event.uso.header.sourceId}
                          </span>
                        )}
                      </div>
                      {/* Context-Info im kompakten Modus */}
                      {event.uso.header.context && (
                        <div className="ml-24 text-xs text-blue-600 dark:text-blue-400">
                          {event.uso.header.context.time && `🕐 ${event.uso.header.context.time}`}
                          {event.uso.header.context.person && ` 👤 ${event.uso.header.context.person}`}
                          {event.uso.header.context.location && ` 📍 ${event.uso.header.context.location}`}
                          {event.uso.header.context.clientName && ` 💻 ${event.uso.header.context.clientName}`}
                        </div>
                      )}
                      {/* Text-Preview im kompakten Modus (max 100 Zeichen) */}
                      {event.uso.payloadPreview && event.uso.header.type === 'text' && (
                        <div className="ml-24 text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                          {event.uso.payloadPreview.substring(0, 100)}{event.uso.payloadPreview.length > 100 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  )}

                  {viewMode === 'detailed' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium text-sm ${getTypeColor(event.uso.header.type)}`}>
                            {event.uso.header.type.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-900 dark:text-white font-medium">
                            {event.nodeLabel || event.nodeId}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center space-x-2">
                          <Database className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-500 dark:text-gray-400">Payload:</span>
                          <span className="text-gray-900 dark:text-white">{formatSize(event.uso.payloadSize)}</span>
                          <span className="text-gray-500 dark:text-gray-400">({event.uso.payloadType})</span>
                        </div>
                        
                        {event.uso.header.sourceId && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500 dark:text-gray-400">Source:</span>
                            <span className="text-gray-900 dark:text-white font-mono text-xs">{event.uso.header.sourceId}</span>
                          </div>
                        )}
                        
                        {event.uso.header.sessionId && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500 dark:text-gray-400">Session:</span>
                            <span className="text-gray-900 dark:text-white font-mono text-xs">{event.uso.header.id}</span>
                          </div>
                        )}
                      </div>

                      {event.uso.header.audioMeta && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Audio: {event.uso.header.audioMeta.sampleRate}Hz, {event.uso.header.audioMeta.channels}ch, {event.uso.header.audioMeta.encoding}
                        </div>
                      )}

                      {/* Context-Informationen anzeigen */}
                      {event.uso.header.context && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center space-x-1 mb-1">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">📋 Context:</span>
                          </div>
                          <div className="text-xs space-y-0.5">
                            {event.uso.header.context.time && (
                              <div className="text-gray-700 dark:text-gray-300">
                                <span className="font-medium">🕐 Zeit:</span> {event.uso.header.context.time}
                              </div>
                            )}
                            {event.uso.header.context.person && (
                              <div className="text-gray-700 dark:text-gray-300">
                                <span className="font-medium">👤 Person:</span> {event.uso.header.context.person}
                              </div>
                            )}
                            {event.uso.header.context.location && (
                              <div className="text-gray-700 dark:text-gray-300">
                                <span className="font-medium">📍 Standort:</span> {event.uso.header.context.location}
                              </div>
                            )}
                            {event.uso.header.context.clientName && (
                              <div className="text-gray-700 dark:text-gray-300">
                                <span className="font-medium">💻 Client:</span> {event.uso.header.context.clientName}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Payload Preview anzeigen (Text-Inhalt) */}
                      {event.uso.payloadPreview && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center space-x-1 mb-1">
                            <FileText className="w-3 h-3 text-gray-400" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Content:</span>
                          </div>
                          <pre className="text-xs text-gray-900 dark:text-white font-mono whitespace-pre-wrap break-words">
                            {event.uso.payloadPreview}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {viewMode === 'json' && (
                    <div className="bg-gray-900 dark:bg-black rounded p-2 overflow-x-auto">
                      <pre className="text-xs text-green-400 font-mono">
                        {JSON.stringify(event, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

