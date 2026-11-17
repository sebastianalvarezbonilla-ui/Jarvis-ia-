import React, { useState } from 'react';
import {
  Play,
  Square,
  Check,
  Download,
  Loader2,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import {
  VOICE_PROFILES,
  type TtsModelId,
  type VoiceId,
} from '../types/jarvis';
import { downloadBase64Wav } from '../utils/audioPlayer';

interface VoicesViewProps {
  activeVoice: VoiceId;
  onSelectVoice: (voice: VoiceId) => void;
  voiceStyle: string;
  onChangeVoiceStyle: (style: string) => void;
  ttsModel: TtsModelId;
  onChangeTtsModel: (model: TtsModelId) => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  previewingVoice: VoiceId | null;
  synthesizingVoice: VoiceId | null;
  onPreviewVoice: (voice: VoiceId, customText?: string, overrideStyle?: string) => void;
  onStopAudio: () => void;
  lastGeneratedAudio: {
    voiceId: VoiceId;
    audioBase64: string;
    latencyMs: number;
    model: string;
  } | null;
  errorMsg: string | null;
  onDismissError: () => void;
}

const STYLE_PRESETS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Jarvis clásico',
    prompt: 'Sereno, británico-técnico, dicción impecable y pausas medidas',
  },
  {
    label: 'Directo y conciso',
    prompt: 'Ritmo ágil, claro y objetivo para comandos y resúmenes rápidos',
  },
  {
    label: 'Briefing cálido',
    prompt: 'Cálido, cercano y optimista, como un asistente personal de confianza',
  },
  {
    label: 'Alerta operativa',
    prompt: 'Firme, serio y autoritativo para reportes técnicos y monitoreo',
  },
];

export const VoicesView: React.FC<VoicesViewProps> = ({
  activeVoice,
  onSelectVoice,
  voiceStyle,
  onChangeVoiceStyle,
  ttsModel,
  onChangeTtsModel,
  playbackRate,
  onChangePlaybackRate,
  autoSpeak,
  onToggleAutoSpeak,
  previewingVoice,
  synthesizingVoice,
  onPreviewVoice,
  onStopAudio,
  lastGeneratedAudio,
  errorMsg,
  onDismissError,
}) => {
  const [sandboxText, setSandboxText] = useState(
    'Buenos días. Todos los módulos locales de OpenJarvis están operativos. ¿Qué deseas priorizar en esta sesión?'
  );

  const selectedProfile =
    VOICE_PROFILES.find((v) => v.id === activeVoice) || VOICE_PROFILES[0];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Elección y Estudio de Voces
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Selecciona la voz neuronal de OpenJarvis, ajusta la dirección vocal y prueba frases reales antes de conversar.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleAutoSpeak}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 ${
                autoSpeak
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>
                {autoSpeak
                  ? 'Lectura automática activada'
                  : 'Activar lectura automática'}
              </span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={onDismissError}
              className="text-xs font-medium underline"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Voice Catalog Grid */}
        <section aria-labelledby="voice-catalog-title" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="voice-catalog-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Catálogo de 5 voces neuronales
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Voz activa: <strong className="text-slate-900 dark:text-slate-100">{activeVoice}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {VOICE_PROFILES.map((voice) => {
              const isSelected = voice.id === activeVoice;
              const isPlaying = previewingVoice === voice.id;
              const isLoading = synthesizingVoice === voice.id;

              return (
                <div
                  key={voice.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {voice.name}
                        </h3>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{voice.register}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {voice.accentPitch}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          <Check className="w-3.5 h-3.5" />
                          <span>Activa</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {voice.timbre}. {voice.recommendedFor}.
                    </p>

                    <p className="text-xs italic text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2.5 leading-relaxed">
                      “{voice.samplePhrase}”
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        isPlaying
                          ? onStopAudio()
                          : onPreviewVoice(voice.id, voice.samplePhrase, voice.defaultStyle)
                      }
                      disabled={isLoading}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Generando...</span>
                        </>
                      ) : isPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 text-blue-600" />
                          <span>Detener</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-blue-600" />
                          <span>Escuchar muestra</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectVoice(voice.id);
                        onChangeVoiceStyle(voice.defaultStyle);
                      }}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isSelected ? 'Seleccionada' : 'Elegir'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Custom Voice Design & Sandbox */}
        <section
          aria-labelledby="voice-sandbox-title"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2
                id="voice-sandbox-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Dirección vocal y banco de pruebas ({selectedProfile.name})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Personaliza la expresividad de la voz activa y prueba cualquier frase con audio WAV en vivo.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
              <button
                type="button"
                onClick={() => onChangeTtsModel('gemini-3.8-flash-lite-tts')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  ttsModel === 'gemini-3.8-flash-lite-tts'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Baja latencia
              </button>
              <button
                type="button"
                onClick={() => onChangeTtsModel('gemini-3.8-flash-tts')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  ttsModel === 'gemini-3.8-flash-tts'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Diseño vocal
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Style & Speed Controls */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="voice-style-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Directriz de estilo vocal
                </label>
                <input
                  id="voice-style-input"
                  type="text"
                  value={voiceStyle}
                  onChange={(e) => onChangeVoiceStyle(e.target.value)}
                  placeholder="Ej. Sereno, pausado, tono analítico..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onChangeVoiceStyle(preset.prompt)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="voice-speed-range"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Velocidad de reproducción
                  </label>
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {playbackRate.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="voice-speed-range"
                  type="range"
                  min={0.85}
                  max={1.25}
                  step={0.05}
                  value={playbackRate}
                  onChange={(e) => onChangePlaybackRate(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            {/* Test Phrase Synthesis */}
            <div className="space-y-3">
              <label
                htmlFor="voice-sandbox-textarea"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Texto de prueba personalizado
              </label>
              <textarea
                id="voice-sandbox-textarea"
                rows={4}
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      !sandboxText.trim() || synthesizingVoice === activeVoice
                    }
                    onClick={() =>
                      previewingVoice === activeVoice
                        ? onStopAudio()
                        : onPreviewVoice(activeVoice, sandboxText, voiceStyle)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
                  >
                    {synthesizingVoice === activeVoice ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sintetizando...</span>
                      </>
                    ) : previewingVoice === activeVoice ? (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        <span>Detener audio</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Sintetizar y reproducir</span>
                      </>
                    )}
                  </button>

                  {lastGeneratedAudio && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadBase64Wav(
                          lastGeneratedAudio.audioBase64,
                          `openjarvis-${lastGeneratedAudio.voiceId.toLowerCase()}.wav`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar WAV</span>
                    </button>
                  )}
                </div>

                {lastGeneratedAudio && (
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {lastGeneratedAudio.model} · {lastGeneratedAudio.latencyMs} ms
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
