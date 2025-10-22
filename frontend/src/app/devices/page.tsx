'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { devicesApi } from '@/lib/api';
import { HardDrive, Wifi, WifiOff, Trash2, Info } from 'lucide-react';

interface Device {
  _id: string;
  clientId: string;
  name: string;
  description?: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'error';
  lastSeen?: string;
  isConnected: boolean;
  metadata?: any;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDevices = async () => {
    try {
      const response = await devicesApi.getAll();
      setDevices(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Geräte:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 5000); // Refresh alle 5 Sekunden
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (clientId: string) => {
    if (!confirm('Möchten Sie dieses Gerät wirklich löschen?')) return;

    try {
      await devicesApi.delete(clientId);
      loadDevices();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Geräte</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Verwalten Sie Ihre IoT-Clients (ESP32)</p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">Automatische Geräte-Registrierung</p>
            <p>
              ESP32-Geräte registrieren sich automatisch, sobald sie sich mit dem WebSocket-Server verbinden.
              Konfigurieren Sie Ihr ESP32 mit der Server-URL <code className="bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-400">ws://localhost:8080</code> und einem Client-Secret.
            </p>
          </div>
        </div>

        {/* Devices Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Lade Geräte...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
            <HardDrive className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Keine Geräte verbunden</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">Warten auf Verbindung von ESP32-Geräten...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Verbinden Sie Ihr ESP32 mit <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">ws://localhost:8080</code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <div
                key={device._id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
              >
                {/* Status Indicator */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="w-8 h-8 text-gray-700 dark:text-gray-300" />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{device.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{device.clientId}</p>
                    </div>
                  </div>
                  {device.isConnected ? (
                    <Wifi className="w-5 h-5 text-green-500 dark:text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  )}
                </div>

                {/* Description */}
                {device.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{device.description}</p>
                )}

                {/* Capabilities */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">FÄHIGKEITEN</p>
                  <div className="flex flex-wrap gap-2">
                    {device.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs rounded-full"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        device.isConnected ? 'bg-green-500 dark:bg-green-400' : 'bg-gray-400 dark:bg-gray-500'
                      }`}
                    ></span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {device.isConnected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(device.clientId)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {device.lastSeen && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Zuletzt gesehen: {new Date(device.lastSeen).toLocaleString('de-DE')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
