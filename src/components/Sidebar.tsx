import React from 'react';
import {
  Volume2,
  Play,
  Square,
  Sun,
  Moon,
  SlidersHorizontal,
  Link2,
  Router as RouterIcon,
  Eye,
  Film,
  Search,
  Bot,
} from 'lucide-react';
import {
  AGENT_PRESETS,
  VOICE_PROFILES,
  type EngineRoute,
  type PresetId,
  type VoiceId,
} from '../types/jarvis';

interface SidebarProps {
  activePreset: PresetId;
  onSelectPreset: (preset: PresetId) => void;
  activeVoice: VoiceId;
  onSelectVoice: (voice: VoiceId) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  onPreviewVoice: (voiceId: VoiceId) => void;
  previewingVoice: VoiceId | null;
  onOpenVoiceStudio: () => void;
  engineRoute: EngineRoute;
  onSelectEngineRoute: (route: EngineRoute) => void;
  memoryCount: number;
  connectedAppsCount: number;
  onOpenConnectedApps: () => void;
  routerProfilesCount: number;
  onOpenRouterManager: () => void;
  onOpenSpectator: () => void;
  onOpenVideoStudio: () => void;
  onOpenSearchWeb: () => void;
  onOpenAutonomous: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const ENGINE_ROUTES: Array<{ id: EngineRoute; label: string; detail: string }> = [
  {
    id: 'local-first-hybrid',
    label: 'Local-First Híbrido',
    detail: 'Prioriza contexto local con respaldo Gemini 4',
  },
  {
    id: 'cloud-reasoning',
    label: 'Razonamiento Extendido',
    detail: 'Planificación multi-paso y herramientas',
  },
  {
    id: 'low-latency-edge',
    label: 'Respuesta Rápida',
    detail: 'Optimizado para interacción por voz',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePreset,
  onSelectPreset,
  activeVoice,
  onSelectVoice,
  autoSpeak,
  onToggleAutoSpeak,
  onPreviewVoice,
  previewingVoice,
  onOpenVoiceStudio,
  engineRoute,
  onSelectEngineRoute,
  memoryCount,
  connectedAppsCount,
  onOpenConnectedApps,
  routerProfilesCount,
  onOpenRouterManager,
  onOpenSpectator,
  onOpenVideoStudio,
  onOpenSearchWeb,
  onOpenAutonomous,
  darkMode,
  onToggleDarkMode,
}) => {
  const currentVoice =
    VOICE_PROFILES.find((v) => v.id === activeVoice) || VOICE_PROFILES[0];

  return (
    <aside className="w-full lg:w-[272px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 flex flex-col gap-6">
      {/* Elección rápida de voz */}
      <section aria-labelledby="sidebar-voice-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="sidebar-voice-heading"
            className="text-xs font-semibold tracking-tight text-slate-500 dark:text-slate-400"
          >
            Voz de OpenJarvis
          </h2>
          <button
            type="button"
            onClick={onOpenVoiceStudio}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Estudio</span>
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="quick-voice-select" className="sr-only">
            Seleccionar voz activa
          </label>
          <select
            id="quick-voice-select"
            value={activeVoice}
            onChange={(e) => onSelectVoice(e.target.value as VoiceId)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {VOICE_PROFILES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} — {voice.register}
              </option>
            ))}
          </select>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {currentVoice.timbre}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onPreviewVoice(activeVoice)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              {previewingVoice === activeVoice ? (
                <>
                  <Square className="w-3.5 h-3.5 text-blue-600" />
                  <span>Detener</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-blue-600" />
                  <span>Probar voz</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleAutoSpeak}
              aria-pressed={autoSpeak}
              title="Leer respuestas automáticamente en voz alta"
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                autoSpeak
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{autoSpeak ? 'Auto: Sí' : 'Auto: No'}</span>
            </button>
          </div>
        </div>
      </section>

      <div className="border-t border-slate-200 dark:border-slate-800" />

      {/* Presets de OpenJarvis */}
      <section aria-labelledby="sidebar-preset-heading">
        <h2
          id="sidebar-preset-heading"
          className="text-xs font-semibold tracking-tight text-slate-500 dark:text-slate-400 mb-2.5"
        >
          Agente activo
        </h2>
        <div className="flex flex-col gap-1">
          {AGENT_PRESETS.map((preset) => {
            const selected = preset.id === activePreset;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset.id)}
                className={`text-left px-3 py-2 rounded-lg transition-colors flex flex-col gap-0.5 ${
                  selected
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className="text-sm font-medium leading-snug truncate">
                  {preset.label}
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                  {preset.yamlName}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="border-t border-slate-200 dark:border-slate-800" />

      {/* Estrategia de Motor */}
      <section aria-labelledby="sidebar-engine-heading">
        <h2
          id="sidebar-engine-heading"
          className="text-xs font-semibold tracking-tight text-slate-500 dark:text-slate-400 mb-2.5"
        >
          Enrutamiento de motor
        </h2>
        <div className="flex flex-col gap-1.5">
          {ENGINE_ROUTES.map((route) => {
            const active = engineRoute === route.id;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onSelectEngineRoute(route.id)}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                  active
                    ? 'border-blue-600/50 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-slate-100'
                    : 'border-transparent hover:border-slate-200 dark:hover:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-medium">{route.label}</div>
                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                  {route.detail}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Acceso directo a aplicaciones conectadas y router */}
      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
        <button
          type="button"
          onClick={onOpenConnectedApps}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Link2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Conectar y manejar apps</span>
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {connectedAppsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenRouterManager}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <RouterIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Router y diagnóstico</span>
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {routerProfilesCount}
          </span>
        </button>

        <div className="grid grid-cols-1 gap-1.5 pt-1">
          <button
            type="button"
            onClick={onOpenSpectator}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Espectador en vivo</span>
          </button>

          <button
            type="button"
            onClick={onOpenVideoStudio}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Film className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Video y subtítulos</span>
          </button>

          <button
            type="button"
            onClick={onOpenSearchWeb}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Buscador y lector web</span>
          </button>

          <button
            type="button"
            onClick={onOpenAutonomous}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Bot className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Agente autónomo</span>
          </button>
        </div>

        {/* Pie del sidebar: resumen de memoria + tema */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Memoria: {memoryCount} {memoryCount === 1 ? 'nota' : 'notas'}
          </span>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span>Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span>Oscuro</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
