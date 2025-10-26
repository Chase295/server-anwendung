'use client';

import { useState } from 'react';
import { X, TestTube, Server, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface AddPiperServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (serverData: { name: string; url: string; description?: string }) => Promise<void>;
}

export default function AddPiperServerModal({ isOpen, onClose, onAdd }: AddPiperServerModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setUrl('');
    setDescription('');
    setTestResult(null);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        throw new Error('Bitte geben Sie eine Server-URL ein');
      }
      if (!trimmedUrl.startsWith('ws://') && !trimmedUrl.startsWith('wss://')) {
        throw new Error('URL muss mit ws:// oder wss:// beginnen');
      }

      // Teste über Backend-API (kein Mixed-Content-Problem!)
      const response = await api.post('/piper-servers/test-connection', { url: trimmedUrl });
      
      if (response.data.success) {
        setTestResult({
          success: true,
          message: `✓ Verbindung zu ${trimmedUrl} erfolgreich!`,
        });
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Verbindung fehlgeschlagen',
        });
      }
    } catch (err: any) {
      console.error('Piper server test failed:', err);
      const message = err.response?.data?.message || err.message || 'Verbindung fehlgeschlagen';
      setTestResult({
        success: false,
        message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !url.trim()) {
      setError('Name und URL dürfen nicht leer sein.');
      return;
    }

    try {
      await onAdd({ name, url, description });
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern des Servers.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 m-4 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
            <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Piper-Server hinzufügen</span>
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="serverName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="serverName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="z.B. Piper DE Production"
              required
            />
          </div>

          {/* URL */}
          <div>
            <label htmlFor="serverUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              WebSocket-URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="serverUrl"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="ws://localhost:5002"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Muss mit <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ws://</code> oder <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">wss://</code> beginnen.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Die Verbindung wird über das Backend getestet (keine Mixed-Content-Probleme).
            </p>
          </div>

          {/* Beschreibung */}
          <div>
            <label htmlFor="serverDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Beschreibung (optional)
            </label>
            <textarea
              id="serverDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Kurze Beschreibung des Servers"
            ></textarea>
          </div>

          {/* Verbindung testen */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !url.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-colors"
            >
              {isTesting ? (
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
                className={`mt-3 p-3 rounded-lg border ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                }`}
              >
                <p className="text-sm font-medium flex items-center">
                  <span className="mr-2">
                    {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </span>
                  {testResult.message}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

