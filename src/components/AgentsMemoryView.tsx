import React, { useState } from 'react';
import { Check, Plus, Search, Trash2 } from 'lucide-react';
import {
  AGENT_PRESETS,
  type MemoryEntry,
  type PresetId,
} from '../types/jarvis';

interface AgentsMemoryViewProps {
  activePreset: PresetId;
  onSelectPreset: (preset: PresetId) => void;
  memories: MemoryEntry[];
  onAddMemory: (category: MemoryEntry['category'], content: string) => void;
  onDeleteMemory: (id: string) => void;
  onGoToAssistant: () => void;
}

const CATEGORIES: Array<{ id: MemoryEntry['category']; label: string }> = [
  { id: 'preferencia', label: 'Preferencia' },
  { id: 'proyecto', label: 'Proyecto' },
  { id: 'contexto', label: 'Contexto' },
  { id: 'rutina', label: 'Rutina' },
];

export const AgentsMemoryView: React.FC<AgentsMemoryViewProps> = ({
  activePreset,
  onSelectPreset,
  memories,
  onAddMemory,
  onDeleteMemory,
  onGoToAssistant,
}) => {
  const [newCategory, setNewCategory] =
    useState<MemoryEntry['category']>('proyecto');
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onAddMemory(newCategory, newContent.trim());
    setNewContent('');
  };

  const filteredMemories = memories.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.content.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Agentes y Memoria Local
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Configura la lógica agéntica y el almacén de memoria persistente que OpenJarvis consulta automáticamente en cada interacción.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToAssistant}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0 self-start"
          >
            Ir al asistente
          </button>
        </div>

        {/* Section 1: Agentic Presets */}
        <section aria-labelledby="presets-section-title" className="space-y-4">
          <h2
            id="presets-section-title"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Presets de OpenJarvis
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AGENT_PRESETS.map((preset) => {
              const isSelected = preset.id === activePreset;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset.id)}
                  className={`text-left rounded-xl border p-5 transition-colors flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {preset.label}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          <Check className="w-3.5 h-3.5" />
                          <span>Activo</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span>{preset.yamlName}</span>
                      <span aria-hidden="true">·</span>
                      <span>Razonamiento: {preset.thinkingLevel}</span>
                      {preset.usesSearch && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Búsqueda Web</span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Persistent Local Memory */}
        <section aria-labelledby="memory-section-title" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2
                id="memory-section-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Memoria local persistente
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                También puedes decirle al asistente «Recuerda que...» para que guarde entradas por sí mismo.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="memory-search-input" className="sr-only">
                Buscar en memoria
              </label>
              <input
                id="memory-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar memoria..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Add Memory Form */}
          <form
            onSubmit={handleAdd}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <label htmlFor="memory-category-select" className="sr-only">
              Categoría
            </label>
            <select
              id="memory-category-select"
              value={newCategory}
              onChange={(e) =>
                setNewCategory(e.target.value as MemoryEntry['category'])
              }
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>

            <label htmlFor="memory-content-input" className="sr-only">
              Contenido de memoria
            </label>
            <input
              id="memory-content-input"
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Ej. Mi entorno local usa Ollama en localhost:11434 con Qwen 3..."
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            <button
              type="submit"
              disabled={!newContent.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-45 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Guardar nota</span>
            </button>
          </form>

          {/* Memory List */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
            {filteredMemories.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {memories.length === 0
                    ? 'Aún no hay notas en tu memoria local'
                    : 'Ninguna nota coincide con el filtro'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Agrega una nota arriba o pide a OpenJarvis en el chat que recuerde tus preferencias.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredMemories.map((entry) => (
                  <li
                    key={entry.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        {entry.content}
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span className="capitalize font-medium">
                          {entry.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Origen: {entry.source}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{entry.createdAt}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteMemory(entry.id)}
                      aria-label="Eliminar nota de memoria"
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
