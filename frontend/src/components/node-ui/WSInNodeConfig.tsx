'use client';

import { useState, useEffect } from 'react';
import { Settings, Server, Code, Wifi, WifiOff } from 'lucide-react';
import { HealthStatusEvent } from '@/hooks/useDebugEvents';

interface WSInNodeConfigProps {
  config: Record<string, any>;
  healthStatus?: HealthStatusEvent;
  onChange: (key: string, value: any) => void;
}

export default function WSInNodeConfig({ config, healthStatus, onChange }: WSInNodeConfigProps) {
  const [endpointUrl, setEndpointUrl] = useState('');

  useEffect(() => {
    // Generiere Endpunkt-URL
    const port = config.port ?? 8081;
    const path = config.path ?? '/ws/external';
    setEndpointUrl(`ws://localhost:${port}${path}`);
  }, [config.port, config.path]);

  return (
    <div className="space-y-6">
      {/* Service-Info */}
      <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Server className="w-5 h-5 text-green-600 dark:text-green-400" />
          <label className="block text-sm font-semibold text-green-900 dark:text-green-300">
            WebSocket Input Server
          </label>
        </div>
        <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
          Erstellt einen WebSocket-Server, der Daten von externen Clients empfängt und in den Flow einspeist.
        </p>
      </div>

      <div className="space-y-4">
        {/* Port */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Port <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={config.port ?? 8081}
            onChange={(e) => onChange('port', parseInt(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            min="1024"
            max="65535"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Port für den WebSocket-Server (1024-65535)
          </p>
        </div>

        {/* Pfad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Pfad <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={config.path ?? '/ws/external'}
            onChange={(e) => onChange('path', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="/ws/external"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            WebSocket-Pfad (muss mit / beginnen)
          </p>
        </div>

        {/* Datentyp */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Datentyp
          </label>
          <select
            value={config.dataType ?? 'text'}
            onChange={(e) => onChange('dataType', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="text">Text / JSON</option>
            <option value="audio">Audio (PCM)</option>
            <option value="raw">Raw (Binär)</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Welche Art von Daten erwartet der Endpunkt?
          </p>
        </div>

        {/* Raw Audio Mode */}
        {config.dataType === 'audio' && (
          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <label className="flex items-start cursor-pointer group">
              <input
                type="checkbox"
                checked={config.rawAudioMode === true}
                onChange={(e) => onChange('rawAudioMode', e.target.checked)}
                className="mt-1 h-5 w-5 text-orange-600 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500 dark:focus:ring-orange-400"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  🎵 Raw Audio Mode
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                  Aktiviert: Clients senden direkt rohe Audio-Binärdaten (ohne JSON-Header).
                  <br />
                  Deaktiviert: Clients verwenden das USO-Protokoll (Header → Payload).
                </p>
                <div className="mt-2 text-xs">
                  <span className="inline-block px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded">
                    ⚡ Für direkte Audio-Streams (wie vosk-mic-test.py)
                  </span>
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Context-Weitergabe */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <label className="flex items-start cursor-pointer group">
            <input
              type="checkbox"
              checked={config.includeContext !== false}
              onChange={(e) => onChange('includeContext', e.target.checked)}
              className="mt-1 h-5 w-5 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                📋 Context-Informationen weitergeben
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Wenn aktiviert: Zeit, Person, Standort und Client-Name werden an nachfolgende Nodes weitergegeben.
                <br />
                Wenn deaktiviert: Nur der reine Content wird weitergegeben (nützlich für KI-Nodes).
              </p>
              <div className="mt-2 text-xs">
                <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                  💡 Standard: Aktiviert
                </span>
              </div>
            </div>
          </label>
        </div>

        {/* Audio-Einstellungen */}
        {config.dataType === 'audio' && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              🎵 Audio-Einstellungen
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Sample Rate (Hz)
                </label>
                <input
                  type="number"
                  value={config.sampleRate ?? 16000}
                  onChange={(e) => onChange('sampleRate', parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  min="8000"
                  max="48000"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Empfohlen: 16000 Hz
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Kanäle
                </label>
                <select
                  value={config.channels ?? 1}
                  onChange={(e) => onChange('channels', parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={1}>Mono (1)</option>
                  <option value={2}>Stereo (2)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Encoding
                </label>
                <input
                  type="text"
                  value={config.encoding ?? 'pcm_s16le'}
                  onChange={(e) => onChange('encoding', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="pcm_s16le"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Standard: pcm_s16le (16-bit PCM)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WebSocket-Endpunkt Anzeige */}
      <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <p className="text-sm font-medium text-green-900 dark:text-green-300 mb-2 flex items-center">
          <Server className="w-4 h-4 mr-2" />
          WebSocket-Endpunkt
        </p>
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-green-300 dark:border-green-700">
          <code className="text-sm text-green-700 dark:text-green-400 break-all font-mono">
            {endpointUrl}
          </code>
        </div>
        <p className="text-xs text-green-700 dark:text-green-400 mt-2">
          ✓ Externe Clients können sich zu diesem Endpunkt verbinden
        </p>
      </div>

      {/* Connection Status (Live) - Immer anzeigen */}
      <div className={`border-2 rounded-xl p-5 shadow-lg transition-all duration-300 ${
        healthStatus && healthStatus.connectedClients && healthStatus.connectedClients > 0
          ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 border-green-400 dark:border-green-500'
          : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 border-red-400 dark:border-red-500'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {healthStatus && healthStatus.connectedClients && healthStatus.connectedClients > 0 ? (
              <>
                <div className="relative">
                  <Wifi className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-green-800 dark:text-green-200">
                    🟢 Live Verbunden
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    WebSocket aktiv
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <WifiOff className="w-6 h-6 text-red-600 dark:text-red-400" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-800 dark:text-red-200">
                    🔴 Nicht Verbunden
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Warte auf Clients...
                  </p>
                </div>
              </>
            )}
          </div>
          
          {/* Badge mit Anzahl */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md transition-all duration-300 ${
            healthStatus && healthStatus.connectedClients && healthStatus.connectedClients > 0
              ? 'bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700'
              : 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700'
          }`}>
            <div className="relative flex items-center justify-center">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white shadow-sm"></span>
            </div>
            <span className="text-base font-bold text-white drop-shadow">
              {healthStatus?.connectedClients ?? 0}
            </span>
          </div>
        </div>
        
        {/* Status-Text */}
        <div className={`mt-3 p-3 rounded-lg ${
          healthStatus && healthStatus.connectedClients && healthStatus.connectedClients > 0
            ? 'bg-green-100 dark:bg-green-900/40'
            : 'bg-red-100 dark:bg-red-900/40'
        }`}>
          <p className={`text-xs font-medium ${
            healthStatus && healthStatus.connectedClients && healthStatus.connectedClients > 0
              ? 'text-green-800 dark:text-green-200'
              : 'text-red-800 dark:text-red-200'
          }`}>
            {healthStatus && healthStatus.connectedClients && healthStatus.connectedClients > 0
              ? `✅ ${healthStatus.connectedClients} Client${healthStatus.connectedClients > 1 ? 's' : ''} aktiv verbunden und sendet Daten`
              : '⚠️ Keine aktiven Verbindungen. Starte einen Client um Daten zu empfangen.'}
          </p>
        </div>
      </div>

      {/* Verwendungs-Info */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-300 font-medium mb-2">💡 Verwendung</p>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Diese Node erstellt einen WebSocket-Server, der Daten von externen Clients empfängt.
          Verbinden Sie externe Systeme mit diesem Endpunkt, um Daten in Ihren Flow einzuspeisen.
        </p>
      </div>

      {/* Beispiel-Code (ausklappbar) */}
      <details className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white flex items-center">
          <Code className="w-4 h-4 mr-2" />
          📝 Beispiel Client-Code
        </summary>
        <div className="mt-3">
          <pre className="bg-gray-900 dark:bg-black p-3 rounded-lg text-xs overflow-x-auto text-green-400 font-mono">
{`// JavaScript WebSocket Client
const ws = new WebSocket('${endpointUrl}');

ws.onopen = () => {
  console.log('✓ Verbunden!');
  ws.send('Hallo vom Client!');
};

ws.onmessage = (event) => {
  console.log('Server:', event.data);
};

ws.onerror = (error) => {
  console.error('Fehler:', error);
};`}</pre>
        </div>
      </details>
    </div>
  );
}
