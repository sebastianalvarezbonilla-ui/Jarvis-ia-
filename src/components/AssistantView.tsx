import React, { useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  Square,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import {
  AGENT_PRESETS,
  VOICE_PROFILES,
  type ChatMessage,
  type PresetId,
  type VoiceId,
} from '../types/jarvis';

interface AssistantViewProps {
  messages: ChatMessage[];
  activePreset: PresetId;
  activeVoice: VoiceId;
  onSelectVoice: (voice: VoiceId) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  isSending: boolean;
  isTranscribing: boolean;
  playingMessageId: string | null;
  synthesizingMessageId: string | null;
  errorMsg: string | null;
  onDismissError: () => void;
  onSendMessage: (text: string) => void;
  onRetryLastMessage: () => void;
  onPlayMessage: (message: ChatMessage) => void;
  onStopAudio: () => void;
  onTranscribeAudio: (blob: Blob, mimeType: string) => Promise<void>;
  onOpenVoiceStudio: () => void;
}

const STARTER_PROMPTS: Array<{ title: string; prompt: string; presetHint: string }> = [
  {
    title: 'Briefing y memoria personal',
    prompt: 'Revisa mi memoria guardada y prepárame un resumen breve para empezar el día.',
    presetHint: 'daily-briefing',
  },
  {
    title: 'Cambiar voz desde el chat',
    prompt: 'Cambia tu voz a Zephyr y explícame en 3 puntos cómo funciona la arquitectura de OpenJarvis.',
    presetHint: 'chat-simple',
  },
  {
    title: 'Arquitectura local-first',
    prompt: 'Compárame Ollama, llama.cpp y vLLM para ejecutar un asistente OpenJarvis en hardware personal.',
    presetHint: 'code-assistant',
  },
  {
    title: 'Guardar preferencia en memoria',
    prompt: 'Recuerda que trabajo principalmente con TypeScript y prefiero respuestas directas sin relleno.',
    presetHint: 'chat-simple',
  },
];

export const AssistantView: React.FC<AssistantViewProps> = ({
  messages,
  activePreset,
  activeVoice,
  onSelectVoice,
  autoSpeak,
  onToggleAutoSpeak,
  playbackRate,
  onChangePlaybackRate,
  isSending,
  isTranscribing,
  playingMessageId,
  synthesizingMessageId,
  errorMsg,
  onDismissError,
  onSendMessage,
  onRetryLastMessage,
  onPlayMessage,
  onStopAudio,
  onTranscribeAudio,
  onOpenVoiceStudio,
}) => {
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const presetMeta =
    AGENT_PRESETS.find((p) => p.id === activePreset) || AGENT_PRESETS[0];
  const voiceMeta =
    VOICE_PROFILES.find((v) => v.id === activeVoice) || VOICE_PROFILES[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isSending) return;
    onSendMessage(draft.trim());
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim() && !isSending) {
        onSendMessage(draft.trim());
        setDraft('');
      }
    }
  };

  const toggleRecording = async () => {
    setMicError(null);
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Tu navegador no admite captura de micrófono.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: preferredMime });
        if (blob.size > 0) {
          await onTranscribeAudio(blob, preferredMime);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setMicError(
        err instanceof Error
          ? `Permiso de micrófono requerido: ${err.message}`
          : 'No se pudo acceder al micrófono.'
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Contextual Workspace Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 bg-slate-50/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span>{presetMeta.label}</span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="font-mono text-xs font-normal text-slate-500 dark:text-slate-400">
              {presetMeta.yamlName}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
            {presetMeta.description}
          </p>
        </div>

        {/* Inline Voice Quick Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label
              htmlFor="assistant-voice-bar"
              className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap"
            >
              Voz activa:
            </label>
            <select
              id="assistant-voice-bar"
              value={activeVoice}
              onChange={(e) => onSelectVoice(e.target.value as VoiceId)}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {VOICE_PROFILES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.register})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="assistant-speed-bar"
              className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap"
            >
              Velocidad:
            </label>
            <select
              id="assistant-speed-bar"
              value={playbackRate}
              onChange={(e) => onChangePlaybackRate(Number(e.target.value))}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value={0.9}>0.90x</option>
              <option value={1}>1.00x</option>
              <option value={1.15}>1.15x</option>
              <option value={1.25}>1.25x</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenVoiceStudio}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
          >
            Configurar voces
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(errorMsg || micError) && (
        <div
          role="alert"
          className="mx-6 mt-4 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorMsg || micError}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {errorMsg &&
              messages.length > 0 &&
              messages[messages.length - 1].role === 'user' &&
              !isSending && (
                <button
                  type="button"
                  onClick={onRetryLastMessage}
                  className="px-3 py-1 rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Reintentar
                </button>
              )}
            <button
              type="button"
              onClick={() => {
                onDismissError();
                setMicError(null);
              }}
              className="text-xs font-medium underline shrink-0"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="py-6 space-y-8">
              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                  Asistente personal OpenJarvis con voz neuronal
                </h1>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                  Inspirado en la arquitectura modular de{' '}
                  <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                    open-jarvis/openjarvis
                  </span>
                  : combina agentes configurables, memoria persistente, herramientas de sistema y elección de voz en tiempo real con{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {voiceMeta.name}
                  </span>{' '}
                  ({voiceMeta.register}).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => onSendMessage(item.prompt)}
                    className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-colors group"
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {item.prompt}
                    </div>
                    <div className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-3">
                      {item.presetHint}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const isPlaying = playingMessageId === msg.id;
                const isSynth = synthesizingMessageId === msg.id;

                return (
                  <article key={msg.id} className="py-6 first:pt-0 last:pb-2">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {isUser ? 'Tú' : 'OpenJarvis'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{msg.timestamp}</span>
                        {!isUser && msg.voiceUsed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Voz: {msg.voiceUsed}</span>
                          </>
                        )}
                        {!isUser && msg.latencyMs !== undefined && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {msg.latencyMs} ms
                            </span>
                          </>
                        )}
                        {!isUser && msg.tokens !== undefined && msg.tokens > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {msg.tokens} tok
                            </span>
                          </>
                        )}
                      </div>

                      {!isUser && (
                        <button
                          type="button"
                          onClick={() =>
                            isPlaying ? onStopAudio() : onPlayMessage(msg)
                          }
                          disabled={isSynth}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                        >
                          {isSynth ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                              <span>Sintetizando...</span>
                            </>
                          ) : isPlaying ? (
                            <>
                              <Square className="w-3.5 h-3.5 text-blue-600" />
                              <span>Detener audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Escuchar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {!isUser && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="mt-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                        Herramientas ejecutadas: {msg.toolsUsed.join(' · ')}
                      </div>
                    )}

                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/70 space-y-1">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Fuentes consultadas
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {msg.sources.map((src, idx) => (
                            <a
                              key={`${src.uri}-${idx}`}
                              href={src.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <span className="truncate max-w-[260px]">
                                {src.title}
                              </span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}

              {isSending && (
                <div className="py-6 flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>OpenJarvis está procesando tu solicitud...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-6 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex flex-col gap-3"
        >
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <label htmlFor="jarvis-prompt-input" className="sr-only">
                Escribe un mensaje o comando para OpenJarvis
              </label>
              <textarea
                id="jarvis-prompt-input"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe una consulta, pide recordar algo o di 'Cambia tu voz a Kore'..."
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="button"
              onClick={toggleRecording}
              disabled={isSending || isTranscribing}
              title={
                isRecording
                  ? 'Detener grabación y transcribir'
                  : 'Dictar mensaje con micrófono'
              }
              className={`h-11 px-4 rounded-xl border text-xs font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                isRecording
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Transcribiendo</span>
                </>
              ) : isRecording ? (
                <>
                  <MicOff className="w-4 h-4 text-red-600" />
                  <span>Detener</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  <span>Dictar</span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={!draft.trim() || isSending}
              className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Enviar</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Voz seleccionada: <strong className="font-medium text-slate-700 dark:text-slate-300">{activeVoice}</strong> · Lectura automática:{' '}
              <button
                type="button"
                onClick={onToggleAutoSpeak}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {autoSpeak ? 'Activada' : 'Desactivada'}
              </button>
            </span>
            <span className="hidden sm:inline">
              Enter para enviar · Shift+Enter para salto de línea
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
