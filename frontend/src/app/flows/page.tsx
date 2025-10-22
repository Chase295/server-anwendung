'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { flowsApi } from '@/lib/api';
import { Workflow, Plus, Play, Square, Edit, Trash2, Copy } from 'lucide-react';

interface Flow {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  enabled: boolean;
  isRunning: boolean;
  updatedAt: string;
  definition: any;
}

export default function FlowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFlows = async () => {
    try {
      const response = await flowsApi.getAll();
      setFlows(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Flows:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const handleCreateFlow = () => {
    router.push('/flows/editor');
  };

  const handleEditFlow = (flowId: string) => {
    router.push(`/flows/editor?id=${flowId}`);
  };

  const handleToggleFlow = async (flowId: string, isRunning: boolean) => {
    try {
      if (isRunning) {
        await flowsApi.stop(flowId);
      } else {
        await flowsApi.start(flowId);
      }
      loadFlows();
    } catch (error) {
      console.error('Fehler beim Starten/Stoppen:', error);
      alert('Fehler: ' + (error as any).response?.data?.message || 'Unbekannter Fehler');
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Möchten Sie diesen Flow wirklich löschen?')) return;

    try {
      await flowsApi.delete(flowId);
      loadFlows();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const handleDuplicateFlow = async (flow: Flow) => {
    try {
      await flowsApi.create({
        name: `${flow.name} (Kopie)`,
        description: flow.description || '',
        definition: flow.definition,
      });
      loadFlows();
    } catch (error) {
      console.error('Fehler beim Duplizieren:', error);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Flows</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Erstellen und verwalten Sie Ihre Workflows</p>
          </div>
          <button
            onClick={handleCreateFlow}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Neuer Flow</span>
          </button>
        </div>

        {/* Flows List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Lade Flows...</p>
          </div>
        ) : flows.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
            <Workflow className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Keine Flows</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Erstellen Sie Ihren ersten Workflow</p>
            <button
              onClick={handleCreateFlow}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Flow erstellen</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {flows.map((flow) => (
              <div
                key={flow._id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {flow.name}
                    </h3>
                    {flow.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{flow.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {flow.isRunning && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-medium rounded-full flex items-center">
                        <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-1 animate-pulse"></span>
                        Läuft
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  <p>Nodes: {flow.definition?.nodes?.length || 0}</p>
                  <p>Aktualisiert: {new Date(flow.updatedAt).toLocaleString('de-DE')}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleToggleFlow(flow._id, flow.isRunning)}
                      className={`px-3 py-2 rounded-lg flex items-center space-x-2 ${
                        flow.isRunning
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60'
                          : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60'
                      }`}
                      disabled={!flow.enabled}
                    >
                      {flow.isRunning ? (
                        <>
                          <Square className="w-4 h-4" />
                          <span>Stoppen</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span>Starten</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleEditFlow(flow._id)}
                      className="px-3 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 flex items-center space-x-2"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Bearbeiten</span>
                    </button>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDuplicateFlow(flow)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFlow(flow._id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
