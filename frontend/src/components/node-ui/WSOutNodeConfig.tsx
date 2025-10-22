'use client';

import { useState } from 'react';
import { Settings, Send, TestTube, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface WSOutNodeConfigProps {
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

export default function WSOutNodeConfig({ config, onChange }: WSOutNodeConfigProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testWebSocketConnection = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      let ws: WebSocket | null = null;
      
      const timeout = setTimeout(() => {
        if (ws) {
          ws.close();
        }
        reject(new Error('Timeout: Server antwortet nicht innerhalb von 10 Sekunden'));
      }, 10000);
      
      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          clearTimeout(timeout);
          if (ws) {
            ws.close();
          }
          resolve();
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`WebSocket-Fehler: Kann nicht zu ${url} verbinden. Ist der Server erreichbar?`));
        };

        ws.onclose = (event) => {
          if (!event.wasClean && event.code !== 1000) {
            clearTimeout(timeout);
            reject(new Error(`Verbindung unerwartet geschlossen (Code: ${event.code})`));
          }
        };
      } catch (error: any) {
        clearTimeout(timeout);
        reject(new Error(`Fehler beim Verbinden: ${error.message}`));
      }
    });
  };

  const handleTestConnection = async () => {
    const targetUrl = config.targetUrl?.trim();
    
    if (!targetUrl) {
      setTestResult({
        success: false,
        message: '❌ Keine Ziel-URL konfiguriert',
      });
      return;
    }

    if (!targetUrl.startsWith('ws://') && !targetUrl.startsWith('wss://')) {
      setTestResult({
        success: false,
        message: '❌ URL muss mit ws:// oder wss:// beginnen',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await testWebSocketConnection(targetUrl);
      setTestResult({
        success: true,
        message: `✓ Verbindung zu ${targetUrl} erfolgreich!`,
      });
    } catch (error: any) {
      console.error('WebSocket test failed:', error);
      setTestResult({
        success: false,
        message: error.message || 'Verbindung fehlgeschlagen',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Service-Info */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <label className="block text-sm font-semibold text-blue-900 dark:text-blue-300">
            WebSocket Output Client
          </label>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Sendet Daten aus dem Flow an einen externen WebSocket-Server.
        </p>
      </div>

      <div className="space-y-4">
        {/* Ziel WebSocket-URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ziel WebSocket-URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={config.targetUrl ?? ''}
            onChange={(e) => onChange('targetUrl', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="ws://localhost:8082/endpoint"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            WebSocket-URL des externen Servers (ws:// oder wss://)
          </p>
        </div>

        {/* Verbindungstest */}
        {config.targetUrl && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-3 rounded-lg disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-colors"
            >
              {testing ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Teste Verbindung...
                </>
              ) : (
                <>
                  <TestTube className="w-5 h-5 mr-2" />
                  Verbindung testen
                </>
              )}
            </button>

            {testResult && (
              <div
                className={`mt-3 p-4 rounded-lg border ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                }`}
              >
                <p
                  className={`text-sm font-medium flex items-center ${
                    testResult.success
                      ? 'text-green-800 dark:text-green-300'
                      : 'text-red-800 dark:text-red-300'
                  }`}
                >
                  <span className="mr-2">
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </span>
                  {testResult.message}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Datentyp */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Datentyp <span className="text-red-500">*</span>
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
            Welche Art von Daten empfängt diese Node vom Flow?
          </p>
        </div>

        {/* Sende-Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sende-Format
          </label>
          <select
            value={config.sendFormat ?? 'uso_full'}
            onChange={(e) => onChange('sendFormat', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="content_only">Nur Content (reiner Text/Daten)</option>
            <option value="payload_only">Nur Payload</option>
            <option value="uso_full">Komplettes USO (JSON)</option>
            <option value="header_then_payload">Header → Payload</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Wie sollen Daten an den Server gesendet werden?
          </p>
        </div>

        {/* Format-Beschreibung */}
        {config.sendFormat && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              📋 Format-Beschreibung:
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {config.sendFormat === 'content_only' && (
                <>Sendet nur den reinen Content/Text - keine Metadaten, kein Context, keine Header. Ideal für einfache Text-Übertragung oder wenn der Empfänger nur den puren Inhalt benötigt.</>
              )}
              {config.sendFormat === 'payload_only' && (
                <>Sendet nur den Payload-Inhalt als Text oder Binär-Daten (kann noch Strukturen enthalten).</>
              )}
              {config.sendFormat === 'uso_full' && (
                <>Sendet das komplette USO-Objekt als JSON (Header + Payload als Base64). Beinhaltet alle Metadaten und Context-Informationen.</>
              )}
              {config.sendFormat === 'header_then_payload' && (
                <>Sendet erst den Header als JSON-Frame, dann den Payload als separaten Binär-Frame. USO-Protokoll kompatibel mit ESP32 und test-ws-in.py.</>
              )}
            </p>
          </div>
        )}

        {/* Fehler emittieren */}
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.emitErrors ?? false}
              onChange={(e) => onChange('emitErrors', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Fehler emittieren
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Sendet Control-USO bei Verbindungsfehlern (bricht Flow ab)
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Reconnect-Logik Info */}
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-sm text-yellow-900 dark:text-yellow-300 font-medium mb-2 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Automatische Wiederverbindung
        </p>
        <p className="text-xs text-yellow-700 dark:text-yellow-400 leading-relaxed">
          Die Node versucht automatisch, die Verbindung wiederherzustellen (max. 5 Versuche mit
          exponentiellem Backoff). Verbindungsfehler unterbrechen den Flow standardmäßig nicht.
        </p>
      </div>

      {/* Verwendungs-Info */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-300 font-medium mb-2">💡 Verwendung</p>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Diese Node sendet Daten aus dem Flow an einen externen WebSocket-Server.
          Verwenden Sie dies, um Daten an externe Systeme zu übertragen oder um mehrere
          IoT-Orchestrator-Instanzen zu vernetzen.
        </p>
      </div>
    </div>
  );
}
