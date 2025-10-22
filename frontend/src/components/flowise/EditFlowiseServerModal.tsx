'use client';

import { useState, useEffect } from 'react';
import { X, TestTube, Loader2 } from 'lucide-react';

interface FlowiseServer {
  _id: string;
  name: string;
  apiUrl: string;
  authToken: string;
  description?: string;
  lastTested?: Date;
  lastTestSuccess?: boolean;
}

interface EditFlowiseServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: FlowiseServer | null;
  onSave: (id: string, updates: { name?: string; script?: string; description?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function EditFlowiseServerModal({ isOpen, onClose, server, onSave, onDelete }: EditFlowiseServerModalProps) {
  const [name, setName] = useState('');
  const [script, setScript] = useState('');
  const [description, setDescription] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  useEffect(() => {
    if (server && isOpen) {
      setName(server.name);
      setDescription(server.description || '');
      // Rekonstruiere Script aus API_URL und authToken (nur zur Anzeige)
      setScript(`import requests

API_URL = "${server.apiUrl}"
headers = {"Authorization": "Bearer ${server.authToken}"}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()
    
output = query({
    "question": "Hey, how are you?",
})`);
      setTestResult(null);
      setScriptError(null);
    }
  }, [server, isOpen]);

  const validateScript = (scriptText: string): boolean => {
    setScriptError(null);

    if (!scriptText.trim()) {
      setScriptError('Bitte fügen Sie ein Flowise-Script ein');
      return false;
    }

    // Prüfe ob API_URL vorhanden ist
    if (!scriptText.match(/API_URL\s*=\s*["']([^"']+)["']/)) {
      setScriptError('API_URL nicht gefunden');
      return false;
    }

    // Prüfe ob Authorization Bearer Token vorhanden ist
    if (!scriptText.match(/["']Authorization["']\s*:\s*["']Bearer\s+([^"']+)["']/)) {
      setScriptError('Authorization Bearer Token nicht gefunden');
      return false;
    }

    return true;
  };

  const handleTest = async () => {
    if (!server) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`/api/flowise-servers/${server._id}/test`, {
        method: 'POST',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestResult({
          success: true,
          message: '✓ Verbindung zu Flowise erfolgreich!',
        });
      } else {
        setTestResult({
          success: false,
          message: result.message || 'Verbindung fehlgeschlagen',
        });
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setTestResult({
        success: false,
        message: error.message || 'Verbindung fehlgeschlagen',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!server || !name.trim()) {
      return;
    }

    // Prüfe ob Script geändert wurde (nur wenn es anders ist als das rekonstruierte)
    const originalScript = `import requests

API_URL = "${server.apiUrl}"
headers = {"Authorization": "Bearer ${server.authToken}"}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()
    
output = query({
    "question": "Hey, how are you?",
})`;

    const scriptChanged = script.trim() !== originalScript.trim();

    if (scriptChanged && !validateScript(script)) {
      return;
    }

    setSaving(true);
    try {
      const updates: any = {
        name: name.trim(),
        description: description.trim() || undefined,
      };

      if (scriptChanged) {
        updates.script = script.trim();
      }

      await onSave(server._id, updates);
      onClose();
    } catch (error) {
      console.error('Failed to update Flowise server:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!server) return;

    const confirmed = window.confirm(
      `Möchten Sie den Flowise-Server "${server.name}" wirklich löschen?\n\n` +
      'Diese Aktion kann nicht rückgängig gemacht werden.'
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      await onDelete(server._id);
      onClose();
    } catch (error) {
      console.error('Failed to delete Flowise server:', error);
      alert('Fehler beim Löschen des Servers');
    } finally {
      setDeleting(false);
    }
  };

  const handleScriptChange = (value: string) => {
    setScript(value);
    setScriptError(null);
    setTestResult(null);
  };

  if (!isOpen || !server) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Flowise-Server bearbeiten
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Flowise Production"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              required
            />
          </div>

          {/* Script */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Flowise Python Script
            </label>
            <textarea
              value={script}
              onChange={(e) => handleScriptChange(e.target.value)}
              rows={12}
              className={`w-full px-4 py-2.5 border ${scriptError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm resize-none`}
            />
            {scriptError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {scriptError}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              💡 Ändern Sie das Script nur, wenn Sie die API-URL oder den Token aktualisieren möchten
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Beschreibung (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Flowise-Server mit GPT-4 Chatbot"
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
            />
          </div>

          {/* Test Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white px-4 py-3 rounded-lg disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-colors"
            >
              {testing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
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
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                }`}
              >
                <p className="text-sm font-medium">{testResult.message}</p>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
          {/* Delete Button - links */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white rounded-lg disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Löschen...
              </>
            ) : (
              'Server löschen'
            )}
          </button>

          {/* Right buttons */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || deleting || !name.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-lg disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

