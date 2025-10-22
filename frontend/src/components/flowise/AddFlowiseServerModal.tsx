'use client';

import { useState } from 'react';
import { X, TestTube, Loader2 } from 'lucide-react';

interface AddFlowiseServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (server: { name: string; script: string; description?: string }) => Promise<void>;
}

export default function AddFlowiseServerModal({ isOpen, onClose, onAdd }: AddFlowiseServerModalProps) {
  const [name, setName] = useState('');
  const [script, setScript] = useState('');
  const [description, setDescription] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const exampleScript = `import requests

API_URL = "https://flowise.local.chase295.de/api/v1/prediction/49b3fd51-c6de-45de-8080-c58cb850a5b7"
headers = {"Authorization": "Bearer dkSjdaLRLVD8d9YUyuppzvDBB3HUujvQloEf5vtdcIc"}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()
    
output = query({
    "question": "Hey, how are you?",
})`;

  const validateScript = (scriptText: string): boolean => {
    setScriptError(null);

    if (!scriptText.trim()) {
      setScriptError('Bitte fügen Sie ein Flowise-Script ein');
      return false;
    }

    // Prüfe ob API_URL vorhanden ist
    if (!scriptText.match(/API_URL\s*=\s*["']([^"']+)["']/)) {
      setScriptError('API_URL nicht gefunden - Bitte kopieren Sie das komplette Script aus Flowise');
      return false;
    }

    // Prüfe ob Authorization Bearer Token vorhanden ist
    if (!scriptText.match(/["']Authorization["']\s*:\s*["']Bearer\s+([^"']+)["']/)) {
      setScriptError('Authorization Bearer Token nicht gefunden - Bitte kopieren Sie das komplette Script aus Flowise');
      return false;
    }

    return true;
  };

  const handleTest = async () => {
    if (!validateScript(script)) {
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Sende Test-Request an Backend
      const response = await fetch('/api/flowise-servers/test-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
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
    
    if (!name.trim() || !script.trim()) {
      return;
    }

    if (!validateScript(script)) {
      return;
    }

    setSaving(true);
    try {
      await onAdd({ 
        name: name.trim(), 
        script: script.trim(), 
        description: description.trim() || undefined 
      });
      
      // Reset Form
      setName('');
      setScript('');
      setDescription('');
      setTestResult(null);
      setScriptError(null);
      
      onClose();
    } catch (error) {
      console.error('Failed to add Flowise server:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleScriptChange = (value: string) => {
    setScript(value);
    setScriptError(null);
    setTestResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Neuen Flowise-Server hinzufügen
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
              Flowise Python Script <span className="text-red-500">*</span>
            </label>
            <textarea
              value={script}
              onChange={(e) => handleScriptChange(e.target.value)}
              placeholder={exampleScript}
              rows={12}
              className={`w-full px-4 py-2.5 border ${scriptError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm resize-none`}
              required
            />
            {scriptError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {scriptError}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              💡 Kopieren Sie das komplette Python-Script aus dem Flowise-Log
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

          {/* Info Box */}
          <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="text-sm text-purple-900 dark:text-purple-300 font-medium mb-2">
              📋 So finden Sie das Script in Flowise:
            </p>
            <ol className="text-xs text-purple-700 dark:text-purple-400 space-y-1 list-decimal list-inside">
              <li>Öffnen Sie Ihren Flow in Flowise</li>
              <li>Klicken Sie auf den "API" Button oben rechts</li>
              <li>Wählen Sie "Python" als Sprache</li>
              <li>Kopieren Sie das komplette Script</li>
              <li>Fügen Sie es hier ein</li>
            </ol>
          </div>

          {/* Test Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !script.trim() || !name.trim()}
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
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !script.trim()}
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
  );
}

