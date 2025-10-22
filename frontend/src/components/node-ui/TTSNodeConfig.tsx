'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, Edit2, TestTube, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import AddPiperServerModal from '@/components/piper/AddPiperServerModal';
import EditPiperServerModal from '@/components/piper/EditPiperServerModal';

interface TTSNodeConfigProps {
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

interface PiperServer {
  _id: string;
  name: string;
  url: string;
  description?: string;
  isActive: boolean;
}

export default function TTSNodeConfig({ config, onChange }: TTSNodeConfigProps) {
  const [piperServers, setPiperServers] = useState<PiperServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedServerForEdit, setSelectedServerForEdit] = useState<PiperServer | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Setze Standard-Service auf 'piper' wenn nicht gesetzt
  useEffect(() => {
    if (!config.ttsService) {
      onChange('ttsService', 'piper');
    }
  }, [config.ttsService, onChange]);

  const ttsService = config.ttsService || 'piper';

  const loadPiperServers = useCallback(async () => {
    setLoadingServers(true);
    try {
      const response = await api.get('/piper-servers');
      setPiperServers(response.data);
      console.log('Loaded Piper servers:', response.data);
      console.log('Current piperServerId:', config.piperServerId);
    } catch (error) {
      console.error('Failed to load Piper servers:', error);
      setPiperServers([]);
    } finally {
      setLoadingServers(false);
    }
  }, [config.piperServerId]);

  // Lade Piper-Server beim Öffnen
  useEffect(() => {
    if (ttsService === 'piper') {
      loadPiperServers();
    }
  }, [ttsService, loadPiperServers]);

  const handleAddServer = async (serverData: { name: string; url: string; description?: string }) => {
    try {
      await api.post('/piper-servers', serverData);
      await loadPiperServers();
    } catch (error: any) {
      alert(`Fehler beim Hinzufügen: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };

  const handleEditServer = async (serverId: string, serverData: { name: string; url: string; description?: string }) => {
    try {
      await api.put(`/piper-servers/${serverId}`, serverData);
      await loadPiperServers();
    } catch (error: any) {
      alert(`Fehler beim Bearbeiten: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await api.delete(`/piper-servers/${serverId}`);
      if (config.piperServerId === serverId) {
        onChange('piperServerId', '');
        onChange('serviceUrl', '');
      }
      await loadPiperServers();
    } catch (error: any) {
      alert(`Fehler beim Löschen: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };

  const handleOpenEdit = () => {
    const server = piperServers.find(s => s._id === config.piperServerId);
    if (server) {
      setSelectedServerForEdit(server);
      setIsEditModalOpen(true);
    }
  };

  const testPiperWebSocket = (wsUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      let ws: WebSocket | null = null;
      
      const timeout = setTimeout(() => {
        if (ws) {
          ws.close();
        }
        reject(new Error('Timeout: Server antwortet nicht innerhalb von 10 Sekunden'));
      }, 10000);
      
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          clearTimeout(timeout);
          if (ws) {
            ws.close();
          }
          resolve();
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`WebSocket-Fehler: Kann nicht zu ${wsUrl} verbinden. Ist der Server erreichbar?`));
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
    if (!config.serviceUrl) {
      setTestResult({
        success: false,
        message: '❌ Keine Server-URL konfiguriert',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Teste WebSocket-Verbindung
      await testPiperWebSocket(config.serviceUrl);

      setTestResult({
        success: true,
        message: `✓ Verbindung zu ${config.serviceUrl} erfolgreich!`,
      });
    } catch (error: any) {
      console.error('Piper connection test failed:', error);
      setTestResult({
        success: false,
        message: error.message || 'Verbindung fehlgeschlagen',
      });
    } finally {
      setTesting(false);
    }
  };

  const voiceModels = [
    { value: 'de_DE-thorsten-medium', label: 'Deutsch - Thorsten (Medium)' },
    { value: 'de_DE-thorsten-low', label: 'Deutsch - Thorsten (Low)' },
    { value: 'en_US-lessac-medium', label: 'English - Lessac (Medium)' },
    { value: 'en_GB-alan-medium', label: 'English - Alan (Medium)' },
  ];

  return (
    <div className="space-y-6">
      {/* Service-Auswahl */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <label className="block text-sm font-semibold text-blue-900 dark:text-blue-300">
            TTS-Dienst <span className="text-red-500">*</span>
          </label>
        </div>
        <select
          value={ttsService}
          onChange={(e) => onChange('ttsService', e.target.value)}
          className="w-full px-4 py-3 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium shadow-sm"
        >
          <option value="piper">Piper (Open Source)</option>
          {/* Weitere TTS-Dienste können hier hinzugefügt werden */}
        </select>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
          Wählen Sie den zu verwendenden Text-to-Speech Dienst
        </p>
      </div>

      {/* Piper-spezifische Konfiguration */}
      {ttsService === 'piper' && (
        <div className="space-y-4">
          {/* Server-Auswahl */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Piper-Server <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-2">
                {config.piperServerId && (
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    title="Server bearbeiten"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Bearbeiten</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="Neuen Server hinzufügen"
                >
                  <Plus className="w-3 h-3" />
                  <span>Neu</span>
                </button>
              </div>
            </div>

            <select
              value={config.piperServerId || ''}
              onChange={(e) => {
                const serverId = e.target.value;
                console.log('Server selected:', serverId);
                console.log('Available servers:', piperServers);
                
                const server = piperServers.find(s => s._id === serverId);
                console.log('Found server:', server);
                
                if (server) {
                  onChange('piperServerId', serverId);
                  setTimeout(() => {
                    onChange('serviceUrl', server.url);
                  }, 0);
                } else {
                  onChange('piperServerId', serverId);
                }
              }}
              disabled={loadingServers}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              required
            >
              <option value="">
                {loadingServers ? 'Lade Server...' : 'Server auswählen...'}
              </option>
              {piperServers.map((server) => (
                <option key={server._id} value={server._id}>
                  {server.name} ({server.url})
                </option>
              ))}
            </select>

            {!loadingServers && piperServers.length === 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1.5">
                ⚠️ Keine Piper-Server konfiguriert. Klicken Sie auf "Neu", um einen hinzuzufügen.
              </p>
            )}

            {config.piperServerId && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                URL: {config.serviceUrl || 'Nicht gesetzt'}
              </p>
            )}
          </div>

          {/* Verbindungstest */}
          {config.piperServerId && config.serviceUrl && (
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

          {/* Voice Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stimme / Voice Model
            </label>
            <select
              value={config.voiceModel ?? 'de_DE-thorsten-medium'}
              onChange={(e) => onChange('voiceModel', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {voiceModels.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Wählen Sie die gewünschte Stimme
            </p>
          </div>

          {/* Sample Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sample Rate (Hz)
            </label>
            <input
              type="number"
              value={config.sampleRate ?? 22050}
              onChange={(e) => onChange('sampleRate', parseInt(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              min="16000"
              max="48000"
              step="1000"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Empfohlen: 22050 Hz für beste Ergebnisse
            </p>
          </div>

          {/* Streaming Mode */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.streamingMode ?? false}
                onChange={(e) => onChange('streamingMode', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Streaming-Modus
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Teilt lange Texte in Sätze und sendet sie nacheinander
                </p>
              </div>
            </label>
          </div>

          {/* Erweiterte Einstellungen */}
          <details className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              ⚙️ Erweiterte Einstellungen
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Length Scale
                </label>
                <input
                  type="number"
                  value={config.lengthScale ?? 1.0}
                  onChange={(e) => onChange('lengthScale', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Geschwindigkeit (1.0 = normal, höher = langsamer)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Noise Scale
                </label>
                <input
                  type="number"
                  value={config.noiseScale ?? 0.667}
                  onChange={(e) => onChange('noiseScale', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  min="0"
                  max="1"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Noise W
                </label>
                <input
                  type="number"
                  value={config.noiseW ?? 0.8}
                  onChange={(e) => onChange('noiseW', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  min="0"
                  max="1"
                  step="0.1"
                />
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Info-Box */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-300 font-medium mb-2">💡 Piper TTS-Server</p>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed mb-3">
          Piper ist ein Open-Source Text-to-Speech System. Der Server verwendet <strong>WebSocket</strong> für die Kommunikation.
        </p>
        
        <div className="pt-3 border-t border-blue-200 dark:border-blue-700 space-y-3">
          <div>
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">
              🎯 Server-Verwaltung:
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500">
              Piper-Server werden zentral verwaltet. Klicken Sie auf "Neu", um einen neuen Server hinzuzufügen.
              Geben Sie die WebSocket-URL als <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">ws://...</code> oder <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">wss://...</code> ein.
            </p>
          </div>
          
          <div>
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">
              🚀 Piper-Server starten:
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500">
              <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">python3 -m piper --model de_DE-thorsten-medium --port 5002</code>
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
              Server läuft dann auf: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">ws://localhost:5002</code>
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
              📥 Modelle: <a href="https://github.com/rhasspy/piper" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700 dark:hover:text-blue-400">github.com/rhasspy/piper</a>
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddPiperServerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddServer}
      />
      
      <EditPiperServerModal
        isOpen={isEditModalOpen}
        server={selectedServerForEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedServerForEdit(null);
        }}
        onSave={handleEditServer}
        onDelete={handleDeleteServer}
      />
    </div>
  );
}
