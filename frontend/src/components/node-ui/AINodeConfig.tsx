'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, TestTube, Loader2, ExternalLink, Plus, Edit2, CheckCircle, XCircle } from 'lucide-react';
import AddFlowiseServerModal from '@/components/flowise/AddFlowiseServerModal';
import EditFlowiseServerModal from '@/components/flowise/EditFlowiseServerModal';

interface FlowiseServer {
  _id: string;
  name: string;
  apiUrl: string;
  authToken: string;
  description?: string;
  lastTested?: Date;
  lastTestSuccess?: boolean;
}

interface AINodeConfigProps {
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

export default function AINodeConfig({ config, onChange }: AINodeConfigProps) {
  const [servers, setServers] = useState<FlowiseServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedServerForEdit, setSelectedServerForEdit] = useState<FlowiseServer | null>(null);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/flowise-servers');
      if (response.ok) {
        const data = await response.json();
        setServers(data);
        console.log('Loaded Flowise servers:', data);
      }
    } catch (error) {
      console.error('Failed to load Flowise servers:', error);
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleAddServer = async (serverData: { name: string; script: string; description?: string }) => {
    try {
      const response = await fetch('/api/flowise-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Hinzufügen');
      }
      
      await loadServers(); // Reload list
    } catch (error: any) {
      alert(`Fehler beim Hinzufügen: ${error.message}`);
      throw error;
    }
  };

  const handleEditServer = async (serverId: string, serverData: { name: string; script: string; description?: string }) => {
    try {
      const response = await fetch(`/api/flowise-servers/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Bearbeiten');
      }
      
      await loadServers(); // Reload list
    } catch (error: any) {
      alert(`Fehler beim Bearbeiten: ${error.message}`);
      throw error;
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      const response = await fetch(`/api/flowise-servers/${serverId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Löschen');
      }
      
      // Entferne die Auswahl, falls der gelöschte Server ausgewählt war
      if (config.flowiseServerId === serverId) {
        onChange('flowiseServerId', '');
      }
      
      await loadServers(); // Reload list
    } catch (error: any) {
      alert(`Fehler beim Löschen: ${error.message}`);
      throw error;
    }
  };

  const handleOpenEdit = () => {
    const server = servers.find(s => s._id === config.flowiseServerId);
    if (server) {
      setSelectedServerForEdit(server);
      setIsEditModalOpen(true);
    }
  };

  const handleTestConnection = async () => {
    if (!config.flowiseServerId) {
      setTestResult({
        success: false,
        message: 'Bitte wählen Sie zuerst einen Flowise-Server aus',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`/api/flowise-servers/${config.flowiseServerId}/test`, {
        method: 'POST',
      });

      const result = await response.json();

      setTestResult({
        success: result.success,
        message: result.message,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Verbindung fehlgeschlagen',
      });
    } finally {
      setTesting(false);
    }
  };

  const selectedServer = servers.find(s => s._id === config.flowiseServerId);

  return (
    <div className="space-y-6">
      {/* Flowise Server Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Flowise-Server <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center space-x-2">
            {/* Edit Button - nur sichtbar wenn Server ausgewählt */}
            {config.flowiseServerId && (
              <button
                type="button"
                onClick={handleOpenEdit}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center space-x-1 px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30"
                title="Server bearbeiten"
              >
                <Edit2 className="w-3 h-3" />
                <span>Bearbeiten</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center space-x-1 px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30"
              title="Neuen Server hinzufügen"
            >
              <Plus className="w-3 h-3" />
              <span>Neu</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : (
          <>
            <select
              value={config.flowiseServerId || ''}
              onChange={(e) => onChange('flowiseServerId', e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              required
            >
              <option value="">
                {loading ? 'Lade Server...' : 'Server auswählen...'}
              </option>
              {servers.map((server) => (
                <option key={server._id} value={server._id}>
                  {server.name}
                  {server.lastTestSuccess === false && ' ⚠️'}
                </option>
              ))}
            </select>

            {!loading && servers.length === 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1.5">
                ⚠️ Keine Flowise-Server konfiguriert. Klicken Sie auf "Neu", um einen hinzuzufügen, oder gehen Sie zu den{' '}
                <a href="/settings" className="underline hover:text-yellow-700 dark:hover:text-yellow-300">
                  Einstellungen
                </a>
                .
              </p>
            )}

            {config.flowiseServerId && selectedServer && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                URL: {selectedServer.apiUrl.substring(0, 60)}...
              </p>
            )}
          </>
        )}
      </div>

      {/* Server Info */}
      {selectedServer && (
        <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-1">
            {selectedServer.name}
          </p>
          {selectedServer.description && (
            <p className="text-xs text-purple-700 dark:text-purple-400 mb-2">
              {selectedServer.description}
            </p>
          )}
          <p className="text-xs text-purple-600 dark:text-purple-500 font-mono break-all mb-2">
            {selectedServer.apiUrl}
          </p>
          {selectedServer.lastTested && (
            <p className="text-xs text-purple-600 dark:text-purple-500">
              Letzter Test: {new Date(selectedServer.lastTested).toLocaleString('de-DE')}
              {selectedServer.lastTestSuccess ? ' ✓' : ' ✗'}
            </p>
          )}
        </div>
      )}

      {/* Verbindungstest - nur wenn Server ausgewählt */}
      {config.flowiseServerId && selectedServer && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white px-4 py-3 rounded-lg disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-colors"
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

      {/* Info Box - Was wird an Flowise gesendet */}
      <details className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
          📄 Was wird an Flowise gesendet?
        </summary>
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>Die AINode sendet ein JSON-Objekt mit:</p>
          <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">
{`{
  "question": "Der Text-Input",
  "sessionId": "session-uuid"
}`}</pre>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Die Session-ID wird für Chat-History verwendet.
          </p>
        </div>
      </details>

      {/* Setup Info */}
      <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <p className="text-sm text-purple-900 dark:text-purple-300 font-medium mb-2">
          💡 Flowise Setup
        </p>
        <div className="text-xs text-purple-700 dark:text-purple-400 space-y-3">
          <div>
            <p className="font-medium mb-1">🎯 Server-Verwaltung:</p>
            <p>
              Flowise-Server werden zentral verwaltet. Klicken Sie auf "Neu", um einen neuen Server hinzuzufügen.
              Einmal konfiguriert, können Sie den Server in allen AI-Nodes verwenden.
            </p>
          </div>
          
          <div>
            <p className="font-medium mb-1">🚀 Flowise Flow verbinden:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Erstellen Sie einen Flow in Flowise</li>
              <li>Klicken Sie auf "API" oben rechts</li>
              <li>Kopieren Sie das Python-Script aus dem API-Dialog</li>
              <li>
                Fügen Sie es hier über "Neu" hinzu oder in den{' '}
                <a href="/settings" className="underline hover:text-purple-800 dark:hover:text-purple-300 inline-flex items-center">
                  Einstellungen
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddFlowiseServerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddServer}
      />

      <EditFlowiseServerModal
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

