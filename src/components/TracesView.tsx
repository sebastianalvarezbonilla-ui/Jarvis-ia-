import React, { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import type { TraceRecord } from '../types/jarvis';

interface TracesViewProps {
  traces: TraceRecord[];
  onClearTraces: () => void;
  onGoToAssistant: () => void;
}

export const TracesView: React.FC<TracesViewProps> = ({
  traces,
  onClearTraces,
  onGoToAssistant,
}) => {
  const [filter, setFilter] = useState<'all' | 'chat' | 'tts' | 'stt' | 'app'>('all');

  const filtered = traces.filter((t) =>
    filter === 'all' ? true : t.operation === filter
  );

  const totalTokens = traces.reduce(
    (sum, t) => sum + t.promptTokens + t.outputTokens,
    0
  );
  const avgLatency =
    traces.length > 0
      ? Math.round(
          traces.reduce((sum, t) => sum + t.latencyMs, 0) / traces.length
        )
      : 0;
  const totalEnergyWh = traces.reduce(
    (sum, t) => sum + t.estimatedEnergyWh,
    0
  );

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(traces, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openjarvis-traces-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Trazas de Ejecución y Aprendizaje
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Registro real de latencia, consumo de tokens, síntesis de voz y herramientas invocadas en tu sesión actual.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={traces.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON</span>
            </button>
            <button
              type="button"
              onClick={onClearTraces}
              disabled={traces.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Ejecuciones registradas
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {traces.length}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Latencia media
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {avgLatency} ms
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Tokens acumulados
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {totalTokens.toLocaleString('es-ES')}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Energía estimada
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {totalEnergyWh.toFixed(3)} Wh
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'chat', label: 'Asistente' },
                { id: 'tts', label: 'Síntesis TTS' },
                { id: 'stt', label: 'Transcripción STT' },
                { id: 'app', label: 'Apps' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'evento' : 'eventos'}
          </span>
        </div>

        {/* Data Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                No hay trazas registradas todavía
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Envía un mensaje en el asistente o prueba una voz en el estudio para capturar métricas reales de latencia, tokens y herramientas.
              </p>
              <button
                type="button"
                onClick={onGoToAssistant}
                className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition-colors"
              >
                Iniciar primera consulta
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Hora</th>
                    <th className="py-3 px-4">Operación</th>
                    <th className="py-3 px-4">Agente / Voz</th>
                    <th className="py-3 px-4">Modelo</th>
                    <th className="py-3 px-4">Herramientas</th>
                    <th className="py-3 px-4 text-right">Latencia</th>
                    <th className="py-3 px-4 text-right">Tokens</th>
                    <th className="py-3 px-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {filtered.map((trace) => (
                    <tr
                      key={trace.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {trace.timestamp}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {trace.operation.toUpperCase()}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {trace.voice ? `${trace.preset} · ${trace.voice}` : trace.preset}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {trace.model}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {trace.toolsUsed.length > 0
                          ? trace.toolsUsed.join(', ')
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {trace.latencyMs} ms
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {trace.promptTokens + trace.outputTokens}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-medium whitespace-nowrap ${
                          trace.status === 'ok'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {trace.status === 'ok' ? 'Correcto' : 'Error'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
