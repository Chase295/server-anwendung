'use client';

import { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { X, Trash2, Settings } from 'lucide-react';
import { HealthStatusEvent } from '@/hooks/useDebugEvents';
import MicNodeConfig from '../node-ui/MicNodeConfig';
import SpeakerNodeConfig from '../node-ui/SpeakerNodeConfig';
import DeviceTxtInputNodeConfig from '../node-ui/DeviceTxtInputNodeConfig';
import DeviceTxtOutputNodeConfig from '../node-ui/DeviceTxtOutputNodeConfig';
import STTNodeConfig from '../node-ui/STTNodeConfig';
import TTSNodeConfig from '../node-ui/TTSNodeConfig';
import AINodeConfig from '../node-ui/AINodeConfig';
import WSInNodeConfig from '../node-ui/WSInNodeConfig';
import WSOutNodeConfig from '../node-ui/WSOutNodeConfig';

interface NodePanelProps {
  node: Node;
  healthStatus?: HealthStatusEvent;
  onClose: () => void;
  onUpdate: (node: Node) => void;
  onDelete: () => void;
}

export default function NodePanel({ node, healthStatus, onClose, onUpdate, onDelete }: NodePanelProps) {
  const [config, setConfig] = useState(node.data.config || {});

  // Synchronisiere config mit node.data.config wenn sich node ändert
  useEffect(() => {
    setConfig(node.data.config || {});
  }, [node.data.config]);

  const handleConfigChange = (key: string, value: any) => {
    console.log('NodePanel handleConfigChange:', key, '=', value);
    console.log('Current config:', config);
    
    // Verwende funktionales Update für setConfig
    setConfig((prevConfig) => {
      const newConfig = { ...prevConfig, [key]: value };
      console.log('New config:', newConfig);
      
      // Update die Node AUSSERHALB des Render-Zyklus mit setTimeout
      setTimeout(() => {
        const updatedNode = {
          ...node,
          data: {
            ...node.data,
            config: newConfig,
          },
        };
        console.log('Updated node:', updatedNode);
        onUpdate(updatedNode);
      }, 0);
      
      return newConfig;
    });
  };

  const renderConfigFields = () => {
    const nodeType = node.data.type;

    switch (nodeType) {
      case 'mic':
        return <MicNodeConfig config={config} onChange={handleConfigChange} />;

      case 'device_txt_input':
        return <DeviceTxtInputNodeConfig config={config} onChange={handleConfigChange} />;

      case 'speaker':
        return <SpeakerNodeConfig config={config} onChange={handleConfigChange} />;

      case 'device_txt_output':
        return <DeviceTxtOutputNodeConfig config={config} onChange={handleConfigChange} />;

      case 'stt':
        return <STTNodeConfig config={config} onChange={handleConfigChange} />;

      case 'tts':
        return <TTSNodeConfig config={config} onChange={handleConfigChange} />;

      case 'ai':
        return <AINodeConfig config={config} onChange={handleConfigChange} />;

      case 'ws_in':
        return <WSInNodeConfig config={config} healthStatus={healthStatus} onChange={handleConfigChange} />;

      case 'ws_out':
        return <WSOutNodeConfig config={config} onChange={handleConfigChange} />;

      case 'debug':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aktiviert
              </label>
              <input
                type="checkbox"
                checked={config.enabled !== false}
                onChange={(e) => handleConfigChange('enabled', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payload anzeigen
              </label>
              <input
                type="checkbox"
                checked={config.showPayload !== false}
                onChange={(e) => handleConfigChange('showPayload', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max. Payload-Größe (Bytes)
              </label>
              <input
                type="number"
                value={config.maxPayloadSize || 1024}
                onChange={(e) => handleConfigChange('maxPayloadSize', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </>
        );

      default:
        return (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Keine Konfiguration verfügbar für diesen Node-Typ.
          </div>
        );
    }
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Node-Konfiguration</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{node.data.type}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-900 dark:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Node Label */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Label
        </label>
        <input
          type="text"
          value={node.data.label}
          onChange={(e) =>
            onUpdate({
              ...node,
              data: { ...node.data, label: e.target.value },
            })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      {/* Configuration Fields */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white">Konfiguration</h4>
        {renderConfigFields()}
      </div>

      {/* Delete Button */}
      <button
        onClick={() => {
          if (confirm('Möchten Sie diese Node wirklich löschen?')) {
            onDelete();
          }
        }}
        className="w-full bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg flex items-center justify-center space-x-2 border border-red-200 dark:border-red-800"
      >
        <Trash2 className="w-4 h-4" />
        <span>Node löschen</span>
      </button>
    </div>
  );
}

