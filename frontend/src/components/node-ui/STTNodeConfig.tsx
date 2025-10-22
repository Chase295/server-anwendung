'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, Edit2, TestTube, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import AddVoskServerModal from '@/components/vosk/AddVoskServerModal';
import EditVoskServerModal from '@/components/vosk/EditVoskServerModal';

interface STTNodeConfigProps {
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

interface VoskServer {
  _id: string;
  name: string;
  url: string;
  description?: string;
  isActive: boolean;
}

export default function STTNodeConfig({ config, onChange }: STTNodeConfigProps) {
  const [voskServers, setVoskServers] = useState<VoskServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedServerForEdit, setSelectedServerForEdit] = useState<VoskServer | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Setze Standard-Service auf 'vosk' wenn nicht gesetzt (in useEffect!)
  useEffect(() => {
    if (!config.sttService) {
      onChange('sttService', 'vosk');
    }
  }, [config.sttService, onChange]);

  const sttService = config.sttService || 'vosk';

  const loadVoskServers = useCallback(async () => {
    setLoadingServers(true);
    try {
      const response = await api.get('/vosk-servers');
      setVoskServers(response.data);
      console.log('Loaded Vosk servers:', response.data);
      console.log('Current voskServerId:', config.voskServerId);
    } catch (error) {
      console.error('Failed to load Vosk servers:', error);
      setVoskServers([]);
    } finally {
      setLoadingServers(false);
    }
  }, [config.voskServerId]);

  // Lade Vosk-Server beim Öffnen
  useEffect(() => {
    if (sttService === 'vosk') {
      loadVoskServers();
    }
  }, [sttService, loadVoskServers]);

  const handleAddServer = async (serverData: { name: string; url: string; description?: string }) => {
    try {
      await api.post('/vosk-servers', serverData);
      await loadVoskServers(); // Reload list
    } catch (error: any) {
      alert(`Fehler beim Hinzufügen: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };

  const handleEditServer = async (serverId: string, serverData: { name: string; url: string; description?: string }) => {
    try {
      await api.put(`/vosk-servers/${serverId}`, serverData);
      await loadVoskServers(); // Reload list
    } catch (error: any) {
      alert(`Fehler beim Bearbeiten: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await api.delete(`/vosk-servers/${serverId}`);
      // Entferne die Auswahl, falls der gelöschte Server ausgewählt war
      if (config.voskServerId === serverId) {
        onChange('voskServerId', '');
        onChange('serviceUrl', '');
      }
      await loadVoskServers(); // Reload list
    } catch (error: any) {
      alert(`Fehler beim Löschen: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };

  const handleOpenEdit = () => {
    const server = voskServers.find(s => s._id === config.voskServerId);
    if (server) {
      setSelectedServerForEdit(server);
      setIsEditModalOpen(true);
    }
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
      await testVoskWebSocket(config.serviceUrl);
      setTestResult({
        success: true,
        message: `✓ Verbindung zu ${config.serviceUrl} erfolgreich!`,
      });
    } catch (error: any) {
      console.error('Vosk connection test failed:', error);
      setTestResult({
        success: false,
        message: error.message || 'Verbindung fehlgeschlagen',
      });
    } finally {
      setTesting(false);
    }
  };

  const testVoskWebSocket = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      let ws: WebSocket | null = null;
      
      const timeout = setTimeout(() => {
        if (ws) {
          ws.close();
        }
        reject(new Error('Timeout: Server antwortet nicht innerhalb von 5 Sekunden'));
      }, 5000);
      
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

  return (
    <div className="space-y-6">
      {/* Service-Auswahl */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <label className="block text-sm font-semibold text-blue-900 dark:text-blue-300">
            STT-Dienst <span className="text-red-500">*</span>
          </label>
        </div>
        <select
          value={sttService}
          onChange={(e) => onChange('sttService', e.target.value)}
          className="w-full px-4 py-3 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium shadow-sm"
        >
          <option value="vosk">Vosk (Open Source)</option>
          {/* Weitere STT-Dienste können hier hinzugefügt werden */}
          {/* <option value="whisper">OpenAI Whisper</option> */}
          {/* <option value="google">Google Speech-to-Text</option> */}
        </select>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
          Wählen Sie den zu verwendenden Speech-to-Text Dienst
        </p>
      </div>

      {/* Vosk-spezifische Konfiguration */}
      {sttService === 'vosk' && (
        <div className="space-y-4">
              {/* Server-Auswahl */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Vosk-Server <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    {/* Edit Button - nur sichtbar wenn Server ausgewählt */}
                    {config.voskServerId && (
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
              value={config.voskServerId || ''}
              onChange={(e) => {
                const serverId = e.target.value;
                console.log('Server selected:', serverId);
                console.log('Available servers:', voskServers);
                
                // Finde den Server
                const server = voskServers.find(s => s._id === serverId);
                console.log('Found server:', server);
                
                // Setze BEIDE Werte gleichzeitig in separaten Aufrufen
                // um React State Batching zu erzwingen
                if (server) {
                  // Erst voskServerId
                  onChange('voskServerId', serverId);
                  // Dann serviceUrl in setTimeout, damit der vorherige State aktualisiert wurde
                  setTimeout(() => {
                    onChange('serviceUrl', server.url);
                  }, 0);
                } else {
                  onChange('voskServerId', serverId);
                }
              }}
              disabled={loadingServers}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              required
            >
              <option value="">
                {loadingServers ? 'Lade Server...' : 'Server auswählen...'}
              </option>
              {voskServers.map((server) => (
                <option key={server._id} value={server._id}>
                  {server.name} ({server.url})
                </option>
              ))}
            </select>
            
            {!loadingServers && voskServers.length === 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1.5">
                ⚠️ Keine Vosk-Server konfiguriert. Klicken Sie auf "Neu", um einen hinzuzufügen.
              </p>
            )}
            
                {config.voskServerId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    URL: {config.serviceUrl || 'Nicht gesetzt'}
                  </p>
                )}
              </div>

              {/* Verbindungstest - nur wenn Server ausgewählt */}
              {config.voskServerId && config.serviceUrl && (
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


          {/* Sample Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sample Rate (Hz)
            </label>
            <input
              type="number"
              value={config.sampleRate || 16000}
              onChange={(e) => onChange('sampleRate', parseInt(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              min="8000"
              max="48000"
              step="1000"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Empfohlen: 16000 Hz für beste Ergebnisse
            </p>
          </div>

          {/* Partielle Ergebnisse */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.emitPartialResults || false}
                onChange={(e) => onChange('emitPartialResults', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Partielle Ergebnisse ausgeben
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Sendet Zwischenergebnisse während der Erkennung
                </p>
              </div>
            </label>
          </div>
        </div>
      )}


      {/* Info-Box */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-300 font-medium mb-2">💡 Vosk STT-Server</p>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed mb-3">
          Vosk ist ein Open-Source Speech-to-Text System. Der Server muss separat gestartet werden
          und wird mit einem festen Sprachmodell konfiguriert.
        </p>
        
        <div className="pt-3 border-t border-blue-200 dark:border-blue-700 space-y-3">
          <div>
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">
              🎯 Server-Verwaltung:
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500">
              Vosk-Server werden zentral verwaltet. Klicken Sie auf "Neu", um einen neuen Server hinzuzufügen.
              Einmal konfiguriert, können Sie den Server in allen STT-Nodes verwenden.
            </p>
          </div>
          
          <div>
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">
              🚀 Vosk-Server starten:
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500">
              <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">python3 asr_server.py --model vosk-model-de</code>
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
              📥 Modelle: <a href="https://alphacephei.com/vosk/models" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700 dark:hover:text-blue-400">alphacephei.com/vosk/models</a>
            </p>
          </div>
        </div>
      </div>

          {/* Modals */}
          <AddVoskServerModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAdd={handleAddServer}
          />
          
          <EditVoskServerModal
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

