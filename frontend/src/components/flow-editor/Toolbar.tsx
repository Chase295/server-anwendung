'use client';

import { Bug, Mic, Volume2, MessageSquare, Cpu, Wifi, FileText } from 'lucide-react';

interface ToolbarProps {
  onAddNode: (nodeType: string) => void;
}

const nodeTypes = [
  { type: 'debug', label: 'Debug', icon: Bug, color: 'gray' },
  { type: 'mic', label: 'Mikrofon', icon: Mic, color: 'blue' },
  { type: 'device_txt_input', label: 'Device TXT In', icon: FileText, color: 'blue' },
  { type: 'stt', label: 'STT', icon: MessageSquare, color: 'green' },
  { type: 'ai', label: 'KI', icon: Cpu, color: 'purple' },
  { type: 'tts', label: 'TTS', icon: Volume2, color: 'orange' },
  { type: 'speaker', label: 'Lautsprecher', icon: Volume2, color: 'red' },
  { type: 'device_txt_output', label: 'Device TXT Out', icon: FileText, color: 'green' },
  { type: 'ws_in', label: 'WS Input', icon: Wifi, color: 'indigo' },
  { type: 'ws_out', label: 'WS Output', icon: Wifi, color: 'indigo' },
];

export default function Toolbar({ onAddNode }: ToolbarProps) {
  const handleDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Nodes</h3>
      
      <div className="space-y-2">
        {nodeTypes.map((node) => {
          const Icon = node.icon;
          
          return (
            <div
              key={node.type}
              draggable
              onDragStart={(e) => handleDragStart(e, node.type)}
              onClick={() => onAddNode(node.type)}
              className="w-full flex items-center space-x-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left cursor-grab active:cursor-grabbing border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
            >
              <Icon className={`w-5 h-5 text-${node.color}-600 dark:text-${node.color}-400`} />
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{node.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{node.type}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
        <p className="font-medium text-blue-900 dark:text-blue-300 mb-2">💡 Tipp</p>
        <p className="text-blue-700 dark:text-blue-400">
          Ziehen Sie Nodes auf die Canvas und verbinden Sie sie, um einen Workflow zu erstellen.
        </p>
      </div>
    </div>
  );
}

