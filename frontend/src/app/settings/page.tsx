'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { authApi } from '@/lib/api';
import { Settings, Key, Plus, Trash2, Eye, EyeOff, User, Lock, Server, Edit, TestTube, Loader2 } from 'lucide-react';
import AddFlowiseServerModal from '@/components/flowise/AddFlowiseServerModal';
import EditFlowiseServerModal from '@/components/flowise/EditFlowiseServerModal';
import AddVoskServerModal from '@/components/vosk/AddVoskServerModal';
import EditVoskServerModal from '@/components/vosk/EditVoskServerModal';
import AddPiperServerModal from '@/components/piper/AddPiperServerModal';
import EditPiperServerModal from '@/components/piper/EditPiperServerModal';
import Toast from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Secret {
  key: string;
  type: string;
  description?: string;
}

interface FlowiseServer {
  _id: string;
  name: string;
  apiUrl: string;
  authToken: string;
  description?: string;
  lastTested?: Date;
  lastTestSuccess?: boolean;
}

interface VoskServer {
  _id: string;
  name: string;
  url: string;
  description?: string;
  isActive: boolean;
}

interface PiperServer {
  _id: string;
  name: string;
  url: string;
  description?: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Flowise Server State
  const [flowiseServers, setFlowiseServers] = useState<FlowiseServer[]>([]);
  const [flowiseLoading, setFlowiseLoading] = useState(true);
  const [showAddFlowiseModal, setShowAddFlowiseModal] = useState(false);
  const [showEditFlowiseModal, setShowEditFlowiseModal] = useState(false);
  const [selectedFlowiseServer, setSelectedFlowiseServer] = useState<FlowiseServer | null>(null);
  const [testingFlowiseId, setTestingFlowiseId] = useState<string | null>(null);

  // Vosk Server State
  const [voskServers, setVoskServers] = useState<VoskServer[]>([]);
  const [voskLoading, setVoskLoading] = useState(true);
  const [showAddVoskModal, setShowAddVoskModal] = useState(false);
  const [showEditVoskModal, setShowEditVoskModal] = useState(false);
  const [selectedVoskServer, setSelectedVoskServer] = useState<VoskServer | null>(null);
  const [testingVoskId, setTestingVoskId] = useState<string | null>(null);

  // Piper Server State
  const [piperServers, setPiperServers] = useState<PiperServer[]>([]);
  const [piperLoading, setPiperLoading] = useState(true);
  const [showAddPiperModal, setShowAddPiperModal] = useState(false);
  const [showEditPiperModal, setShowEditPiperModal] = useState(false);
  const [selectedPiperServer, setSelectedPiperServer] = useState<PiperServer | null>(null);
  const [testingPiperId, setTestingPiperId] = useState<string | null>(null);

  // Admin Credentials State
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [credentialsSaving, setCredentialsSaving] = useState(false);

  // Toast & Confirm Dialog State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'info' = 'danger'
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      type,
    });
  };

  const loadSecrets = async () => {
    try {
      const response = await authApi.listSecrets();
      setSecrets(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Secrets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
    loadFlowiseServers();
    loadVoskServers();
    loadPiperServers();
  }, []);

  // Flowise Server Functions
  const loadFlowiseServers = async () => {
    try {
      const response = await fetch('/api/flowise-servers');
      if (response.ok) {
        const data = await response.json();
        setFlowiseServers(data);
      }
    } catch (error) {
      console.error('Failed to load Flowise servers:', error);
    } finally {
      setFlowiseLoading(false);
    }
  };

  const handleAddFlowiseServer = async (server: { name: string; script: string; description?: string }) => {
    try {
      const response = await fetch('/api/flowise-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      });

      if (response.ok) {
        loadFlowiseServers();
        setShowAddFlowiseModal(false);
        showToast('Flowise-Server erfolgreich hinzugefügt', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to add Flowise server:', error);
      showToast('Fehler beim Hinzufügen des Servers', 'error');
    }
  };

  const handleUpdateFlowiseServer = async (
    id: string,
    updates: { name?: string; script?: string; description?: string }
  ) => {
    try {
      const response = await fetch(`/api/flowise-servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        loadFlowiseServers();
        setShowEditFlowiseModal(false);
        setSelectedFlowiseServer(null);
        showToast('Flowise-Server erfolgreich aktualisiert', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to update Flowise server:', error);
      showToast('Fehler beim Aktualisieren des Servers', 'error');
    }
  };

  const handleDeleteFlowiseServer = async (id: string) => {
    try {
      const response = await fetch(`/api/flowise-servers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadFlowiseServers();
        showToast('Flowise-Server erfolgreich gelöscht', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to delete Flowise server:', error);
      showToast('Fehler beim Löschen des Servers', 'error');
    }
  };

  const handleTestFlowiseServer = async (id: string) => {
    setTestingFlowiseId(id);

    try {
      const response = await fetch(`/api/flowise-servers/${id}/test`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message, 'error');
      }

      loadFlowiseServers(); // Reload to update test status
    } catch (error) {
      console.error('Failed to test Flowise server:', error);
      showToast('Fehler beim Testen der Verbindung', 'error');
    } finally {
      setTestingFlowiseId(null);
    }
  };

  // Vosk Server Functions
  const loadVoskServers = async () => {
    try {
      const response = await fetch('/api/vosk-servers');
      if (response.ok) {
        const data = await response.json();
        setVoskServers(data);
      }
    } catch (error) {
      console.error('Failed to load Vosk servers:', error);
    } finally {
      setVoskLoading(false);
    }
  };

  const handleAddVoskServer = async (server: { name: string; url: string; description?: string }) => {
    try {
      const response = await fetch('/api/vosk-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      });

      if (response.ok) {
        loadVoskServers();
        setShowAddVoskModal(false);
        showToast('Vosk-Server erfolgreich hinzugefügt', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to add Vosk server:', error);
      showToast('Fehler beim Hinzufügen des Servers', 'error');
    }
  };

  const handleUpdateVoskServer = async (
    id: string,
    updates: { name?: string; url?: string; description?: string }
  ) => {
    try {
      const response = await fetch(`/api/vosk-servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        loadVoskServers();
        setShowEditVoskModal(false);
        setSelectedVoskServer(null);
        showToast('Vosk-Server erfolgreich aktualisiert', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to update Vosk server:', error);
      showToast('Fehler beim Aktualisieren des Servers', 'error');
    }
  };

  const handleDeleteVoskServer = async (id: string) => {
    try {
      const response = await fetch(`/api/vosk-servers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadVoskServers();
        showToast('Vosk-Server erfolgreich gelöscht', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to delete Vosk server:', error);
      showToast('Fehler beim Löschen des Servers', 'error');
    }
  };

  const handleTestVoskServer = async (id: string) => {
    setTestingVoskId(id);

    try {
      const server = voskServers.find(s => s._id === id);
      if (!server) return;

      // WebSocket-Test
      const ws = new WebSocket(server.url);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Timeout: Server antwortet nicht'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          showToast('Verbindung zum Vosk-Server erfolgreich!', 'success');
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket-Fehler'));
        };
      });
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTestingVoskId(null);
    }
  };

  // Piper Server Functions
  const loadPiperServers = async () => {
    try {
      const response = await fetch('/api/piper-servers');
      if (response.ok) {
        const data = await response.json();
        setPiperServers(data);
      }
    } catch (error) {
      console.error('Failed to load Piper servers:', error);
    } finally {
      setPiperLoading(false);
    }
  };

  const handleAddPiperServer = async (server: { name: string; url: string; description?: string }) => {
    try {
      const response = await fetch('/api/piper-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      });

      if (response.ok) {
        loadPiperServers();
        setShowAddPiperModal(false);
        showToast('Piper-Server erfolgreich hinzugefügt', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to add Piper server:', error);
      showToast('Fehler beim Hinzufügen des Servers', 'error');
    }
  };

  const handleUpdatePiperServer = async (
    id: string,
    updates: { name?: string; url?: string; description?: string }
  ) => {
    try {
      const response = await fetch(`/api/piper-servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        loadPiperServers();
        setShowEditPiperModal(false);
        setSelectedPiperServer(null);
        showToast('Piper-Server erfolgreich aktualisiert', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to update Piper server:', error);
      showToast('Fehler beim Aktualisieren des Servers', 'error');
    }
  };

  const handleDeletePiperServer = async (id: string) => {
    try {
      const response = await fetch(`/api/piper-servers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadPiperServers();
        showToast('Piper-Server erfolgreich gelöscht', 'success');
      } else {
        const error = await response.json();
        showToast(error.message || 'Unbekannter Fehler', 'error');
      }
    } catch (error) {
      console.error('Failed to delete Piper server:', error);
      showToast('Fehler beim Löschen des Servers', 'error');
    }
  };

  const handleTestPiperServer = async (id: string) => {
    setTestingPiperId(id);

    try {
      const server = piperServers.find(s => s._id === id);
      if (!server) return;

      // WebSocket-Test (Piper ist ein WebSocket-Server)
      const ws = new WebSocket(server.url);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Timeout: Server antwortet nicht'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          showToast('Verbindung zum Piper-Server erfolgreich!', 'success');
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket-Fehler: Kann nicht zum Server verbinden'));
        };
      });
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTestingPiperId(null);
    }
  };

  const handleDeleteSecret = async (key: string) => {
    try {
      await authApi.deleteSecret(key);
      loadSecrets();
      showToast('Secret erfolgreich gelöscht', 'success');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      showToast('Fehler beim Löschen des Secrets', 'error');
    }
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validierung
    if (!currentUsername || !currentPassword) {
      showToast('Bitte geben Sie Ihre aktuellen Login-Daten ein', 'warning');
      return;
    }

    if (!newUsername && !newPassword) {
      showToast('Bitte geben Sie mindestens einen neuen Benutzernamen oder ein neues Passwort ein', 'warning');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      showToast('Die neuen Passwörter stimmen nicht überein', 'error');
      return;
    }

    if (newPassword && newPassword.length < 4) {
      showToast('Das neue Passwort muss mindestens 4 Zeichen lang sein', 'error');
      return;
    }

    setCredentialsSaving(true);

    try {
      const response = await authApi.changeCredentials({
        currentUsername,
        currentPassword,
        newUsername: newUsername || undefined,
        newPassword: newPassword || undefined,
      });

      if (response.data.success) {
        showToast('Login-Daten erfolgreich geändert! Sie werden zum Login weitergeleitet.', 'success');
        
        // Clear localStorage und redirect zu Login nach kurzer Verzögerung
        setTimeout(() => {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }, 2000);
      } else {
        showToast(response.data.message || 'Fehler beim Ändern der Login-Daten', 'error');
      }
    } catch (error: any) {
      console.error('Fehler beim Ändern der Credentials:', error);
      showToast(error.response?.data?.message || 'Unbekannter Fehler', 'error');
    } finally {
      setCredentialsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Einstellungen</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">System-Konfiguration und Secrets</p>
          </div>
        </div>

        {/* Admin Credentials Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <User className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Admin-Login ändern</h2>
          </div>

          <form onSubmit={handleChangeCredentials} className="space-y-6">
            {/* Aktuelle Credentials */}
            <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                Aktuelle Login-Daten
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Aktueller Benutzername
                  </label>
                  <input
                    type="text"
                    value={currentUsername}
                    onChange={(e) => setCurrentUsername(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="admin"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Aktuelles Passwort
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Neue Credentials */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                Neue Login-Daten (optional - nur ausfüllen, was geändert werden soll)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Neuer Benutzername (optional)
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Leer lassen, um beizubehalten"
                  />
                </div>
                <div></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Neues Passwort (optional)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Mindestens 4 Zeichen"
                      minLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Neues Passwort bestätigen
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Passwort wiederholen"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center space-x-4 pt-4">
              <button
                type="submit"
                disabled={credentialsSaving}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                <Lock className="w-5 h-5" />
                <span>{credentialsSaving ? 'Speichere...' : 'Login-Daten ändern'}</span>
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ⚠️ Sie werden nach der Änderung automatisch abgemeldet
              </p>
            </div>
          </form>
        </div>

        {/* Global API Key Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <Key className="w-6 h-6 text-green-700 dark:text-green-300" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Globaler API Key</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Ein API Key für alle Devices - Einfach & Sicher
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Aktueller Key anzeigen */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Aktueller API Key</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Dieser Key wird von allen Device-Clients verwendet
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <code className="px-3 py-2 bg-gray-900 dark:bg-gray-950 text-green-400 rounded-md font-mono text-sm">
                    default-api-key-123
                  </code>
                  <span className="text-xs text-gray-500 dark:text-gray-400">(Standard)</span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Wie ändere ich den API Key?</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                    Bearbeiten Sie die <code className="bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded text-xs">docker-compose.yml</code> Datei
                    und setzen Sie <code className="bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded text-xs">SIMPLE_API_KEY=ihr-neuer-key</code>.
                    Dann starten Sie das Backend neu: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded text-xs">docker-compose restart backend</code>.
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                    💡 Alternative: Ändern Sie den Key direkt in <code className="bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded text-xs">device-client.py</code> (Zeile 56).
                  </p>
                </div>
              </div>
            </div>

            {/* Device Client Konfiguration */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Device Client verwenden</h3>
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <p>1. Öffnen Sie <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">test-scripts/device-client.py</code></p>
                <p>2. Ändern Sie Zeile 56: <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">API_KEY = "ihr-api-key"</code></p>
                <p>3. Starten Sie den Client: <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">python3 device-client.py</code></p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  ✅ Der Key funktioniert für alle Devices - keine weitere Konfiguration nötig!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Flowise Server Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <Server className="w-6 h-6 text-purple-700 dark:text-purple-300" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Flowise-Server</h2>
            </div>
            <button
              onClick={() => setShowAddFlowiseModal(true)}
              className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Server hinzufügen</span>
            </button>
          </div>

          {flowiseLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-400 mx-auto"></div>
            </div>
          ) : flowiseServers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="mb-4">Keine Flowise-Server konfiguriert</p>
              <p className="text-sm">Fügen Sie einen Flowise-Server hinzu, um KI-Workflows zu nutzen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flowiseServers.map((server) => (
                <div
                  key={server._id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900 dark:text-white">{server.name}</p>
                      {server.lastTestSuccess === true && (
                        <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                      )}
                      {server.lastTestSuccess === false && (
                        <span className="text-red-600 dark:text-red-400 text-sm">✗</span>
                      )}
                    </div>
                    {server.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{server.description}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono break-all">
                      {server.apiUrl.substring(0, 80)}...
                    </p>
                    {server.lastTested && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Letzter Test: {new Date(server.lastTested).toLocaleString('de-DE')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTestFlowiseServer(server._id)}
                      disabled={testingFlowiseId === server._id}
                      className="p-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg disabled:opacity-50"
                    >
                      {testingFlowiseId === server._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFlowiseServer(server);
                        setShowEditFlowiseModal(true);
                      }}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        showConfirm(
                          'Flowise-Server löschen',
                          `Möchten Sie den Flowise-Server "${server.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
                          () => handleDeleteFlowiseServer(server._id),
                          'danger'
                        );
                      }}
                      className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vosk Server Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <Server className="w-6 h-6 text-blue-700 dark:text-blue-300" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Vosk-Server (STT)</h2>
            </div>
            <button
              onClick={() => setShowAddVoskModal(true)}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Server hinzufügen</span>
            </button>
          </div>

          {voskLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            </div>
          ) : voskServers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="mb-4">Keine Vosk-Server konfiguriert</p>
              <p className="text-sm">Fügen Sie einen Vosk-Server für Speech-to-Text hinzu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {voskServers.map((server) => (
                <div
                  key={server._id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900 dark:text-white">{server.name}</p>
                      {server.isActive && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          Aktiv
                        </span>
                      )}
                    </div>
                    {server.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{server.description}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{server.url}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleTestVoskServer(server._id)}
                      disabled={testingVoskId === server._id}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg disabled:opacity-50"
                    >
                      {testingVoskId === server._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVoskServer(server);
                        setShowEditVoskModal(true);
                      }}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        showConfirm(
                          'Vosk-Server löschen',
                          `Möchten Sie den Vosk-Server "${server.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
                          () => handleDeleteVoskServer(server._id),
                          'danger'
                        );
                      }}
                      className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Piper Server Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <Server className="w-6 h-6 text-green-700 dark:text-green-300" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Piper-Server (TTS)</h2>
            </div>
            <button
              onClick={() => setShowAddPiperModal(true)}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Server hinzufügen</span>
            </button>
          </div>

          {piperLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 dark:border-green-400 mx-auto"></div>
            </div>
          ) : piperServers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="mb-4">Keine Piper-Server konfiguriert</p>
              <p className="text-sm">Fügen Sie einen Piper-Server für Text-to-Speech hinzu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {piperServers.map((server) => (
                <div
                  key={server._id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900 dark:text-white">{server.name}</p>
                      {server.isActive && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          Aktiv
                        </span>
                      )}
                    </div>
                    {server.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{server.description}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{server.url}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleTestPiperServer(server._id)}
                      disabled={testingPiperId === server._id}
                      className="p-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg disabled:opacity-50"
                    >
                      {testingPiperId === server._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPiperServer(server);
                        setShowEditPiperModal(true);
                      }}
                      className="p-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        showConfirm(
                          'Piper-Server löschen',
                          `Möchten Sie den Piper-Server "${server.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
                          () => handleDeletePiperServer(server._id),
                          'danger'
                        );
                      }}
                      className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Secrets Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <Key className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">API-Keys & Secrets</h2>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Secret hinzufügen</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            </div>
          ) : secrets.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Keine Secrets gespeichert</p>
            </div>
          ) : (
            <div className="space-y-3">
              {secrets.map((secret) => (
                <div
                  key={secret.key}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{secret.key}</p>
                    {secret.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{secret.description}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Typ: {secret.type}</p>
                  </div>
                  <button
                    onClick={() => {
                      showConfirm(
                        'Secret löschen',
                        `Möchten Sie das Secret "${secret.key}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
                        () => handleDeleteSecret(secret.key),
                        'danger'
                      );
                    }}
                    className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WebSocket Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <Settings className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">WebSocket-Server</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Port
              </label>
              <input
                type="number"
                defaultValue={8080}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  SSL/TLS aktivieren
                </span>
              </label>
            </div>

            <button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
              Konfiguration speichern
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-sm border border-yellow-200 dark:border-yellow-800">
          <p className="font-medium text-yellow-900 dark:text-yellow-300 mb-2">⚠️  Sicherheitshinweis</p>
          <p className="text-yellow-700 dark:text-yellow-400">
            Secrets werden verschlüsselt in der Datenbank gespeichert. Stellen Sie sicher,
            dass der ENCRYPTION_KEY in der .env-Datei gesetzt und sicher ist.
          </p>
        </div>
      </div>

      {/* Flowise Modals */}
      <AddFlowiseServerModal
        isOpen={showAddFlowiseModal}
        onClose={() => setShowAddFlowiseModal(false)}
        onAdd={handleAddFlowiseServer}
      />

      <EditFlowiseServerModal
        isOpen={showEditFlowiseModal}
        onClose={() => {
          setShowEditFlowiseModal(false);
          setSelectedFlowiseServer(null);
        }}
        server={selectedFlowiseServer}
        onSave={handleUpdateFlowiseServer}
        onDelete={handleDeleteFlowiseServer}
      />

      {/* Vosk Modals */}
      <AddVoskServerModal
        isOpen={showAddVoskModal}
        onClose={() => setShowAddVoskModal(false)}
        onAdd={handleAddVoskServer}
      />

      <EditVoskServerModal
        isOpen={showEditVoskModal}
        server={selectedVoskServer}
        onClose={() => {
          setShowEditVoskModal(false);
          setSelectedVoskServer(null);
        }}
        onSave={handleUpdateVoskServer}
        onDelete={handleDeleteVoskServer}
      />

      {/* Piper Modals */}
      <AddPiperServerModal
        isOpen={showAddPiperModal}
        onClose={() => setShowAddPiperModal(false)}
        onAdd={handleAddPiperServer}
      />

      <EditPiperServerModal
        isOpen={showEditPiperModal}
        server={selectedPiperServer}
        onClose={() => {
          setShowEditPiperModal(false);
          setSelectedPiperServer(null);
        }}
        onSave={handleUpdatePiperServer}
        onDelete={handleDeletePiperServer}
      />

      {/* Add Secret Modal (vereinfacht) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Secret hinzufügen</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  await authApi.saveSecret(
                    formData.get('key') as string,
                    formData.get('value') as string,
                    formData.get('type') as string,
                    formData.get('description') as string
                  );
                  setShowAddModal(false);
                  loadSecrets();
                  showToast('Secret erfolgreich hinzugefügt', 'success');
                } catch (error) {
                  console.error('Fehler beim Speichern:', error);
                  showToast('Fehler beim Speichern des Secrets', 'error');
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Key
                  </label>
                  <input
                    type="text"
                    name="key"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="z.B. client_secret_esp32_001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Value
                  </label>
                  <input
                    type="password"
                    name="value"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Typ
                  </label>
                  <select
                    name="type"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="client_secret">Client Secret</option>
                    <option value="api_key">API Key</option>
                    <option value="service_token">Service Token</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Beschreibung (optional)
                  </label>
                  <input
                    type="text"
                    name="description"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        type={confirmDialog.type}
      />
    </Layout>
  );
}

