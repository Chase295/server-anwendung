'use client';

import { useState, useEffect } from 'react';
import { devicesApi } from '@/lib/api';

interface MicNodeConfigProps {
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

interface Device {
  clientId: string;
  name: string;
  capabilities: string[];
  isConnected: boolean;
}

export default function MicNodeConfig({ config, onChange }: MicNodeConfigProps) {
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
      // Nur Geräte mit Mikrofon-Capability anzeigen
      const micDevices = response.data.filter((d: Device) =>
        d.capabilities.includes('mic') && d.isConnected
      );
      setDevices(micDevices);
    } catch (error) {
      console.error('Fehler beim Laden der Geräte:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mikrofon-Gerät <span className="text-red-500">*</span>
        </label>
        {loading ? (
          <div className="text-sm text-gray-500">Lade Geräte...</div>
        ) : devices.length === 0 ? (
          <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
            ⚠️ Keine Geräte mit Mikrofon online
          </div>
        ) : (
          <select
            value={config.deviceId ?? ''}
            onChange={(e) => onChange('deviceId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
        <p className="text-xs text-gray-500 mt-1">
          Nur verbundene Geräte mit Mikrofon-Fähigkeit werden angezeigt
        </p>
      </div>

      {config.deviceId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            ✓ Gerät <span className="font-mono">{config.deviceId}</span> ausgewählt
          </p>
        </div>
      )}
    </div>
  );
}

