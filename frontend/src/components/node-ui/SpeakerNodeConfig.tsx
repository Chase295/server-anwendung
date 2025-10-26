'use client';

import { useState, useEffect } from 'react';
import { devicesApi } from '@/lib/api';

interface SpeakerNodeConfigProps {
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

interface Device {
  clientId: string;
  name: string;
  capabilities: string[];
  isConnected: boolean;
}

export default function SpeakerNodeConfig({ config, onChange }: SpeakerNodeConfigProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
    // Refresh alle 5 Sekunden
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadDevices = async () => {
    try {
      const response = await devicesApi.getAll();
      // Nur Geräte mit Speaker-Capability anzeigen
      const speakerDevices = response.data.filter((d: Device) =>
        d.capabilities.includes('speaker') && d.isConnected
      );
      setDevices(speakerDevices);
    } catch (error) {
      console.error('Fehler beim Laden der Geräte:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Lautsprecher-Gerät <span className="text-red-500">*</span>
        </label>
        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Lade Geräte...</div>
        ) : devices.length === 0 ? (
          <div className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-3 rounded-lg">
            ⚠️ Keine Geräte mit Lautsprecher online
          </div>
        ) : (
          <select
            value={config.deviceId ?? ''}
            onChange={(e) => onChange('deviceId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Gerät auswählen...</option>
            {devices.map((device) => (
              <option key={device.clientId} value={device.clientId}>
                {device.name} ({device.clientId})
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Nur verbundene Geräte mit Lautsprecher-Fähigkeit werden angezeigt
        </p>
      </div>

      {config.deviceId && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
          <p className="text-sm text-green-800 dark:text-green-400">
            ✓ Gerät <span className="font-mono">{config.deviceId}</span> ausgewählt
          </p>
        </div>
      )}
    </div>
  );
}

