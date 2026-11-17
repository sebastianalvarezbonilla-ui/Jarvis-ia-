import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Eye,
  Loader2,
  MessageSquare,
  Monitor,
  MonitorOff,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  PublishedAppRecord,
  SpectatorObservation,
} from '../types/jarvis';

interface SpectatorViewProps {
  publishedApps: PublishedAppRecord[];
  onInspectScreen: (payload: {
    imageBase64: string;
    mimeType: string;
    question: string;
    mode: 'spectator' | 'game' | 'reels' | 'design';
  }) => Promise<Omit<SpectatorObservation, 'id' | 'timestamp'>>;
  onSpeakText: (text: string) => void;
  onGoToAssistantWithPrompt: (promptText: string) => void;
}

const FOCUS_MODES: Array<{
  id: 'spectator' | 'game' | 'reels' | 'design';
  label: string;
}> = [
  { id: 'spectator', label: 'General' },
  { id: 'game', label: 'Videojuego' },
  { id: 'reels', label: 'Reels / Video' },
  { id: 'design', label: 'Crítica Diseño' },
];

export const SpectatorView: React.FC<SpectatorViewProps> = ({
  publishedApps,
  onInspectScreen,
  onSpeakText,
  onGoToAssistantWithPrompt,
}) => {
  const [sourceKind, setSourceKind] = useState<'screen' | 'app'>('screen');
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [focusMode, setFocusMode] = useState<
    'spectator' | 'game' | 'reels' | 'design'
  >('spectator');
  const [question, setQuestion] = useState('');

  const [isSharing, setIsSharing] = useState(false);
  const [autoWatch, setAutoWatch] = useState(false);
  const [speakAloud, setSpeakAloud] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [observations, setObservations] = useState<SpectatorObservation[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!selectedSlug && publishedApps.length > 0) {
      setSelectedSlug(publishedApps[0].slug);
    }
  }, [publishedApps, selectedSlug]);

  const stopScreenShare = () => {
    setAutoWatch(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startScreenShare = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setErrorMsg(
        'Tu navegador no permite capturar pantalla desde esta ventana.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
      setSourceKind('screen');
      setIsSharing(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `No se inició la vista de espectador: ${err.message}`
          : 'Permiso de captura de pantalla cancelado.'
      );
    }
  };

  const captureAndAnalyze = async () => {
    if (isAnalyzing) return;
    if (!videoRef.current || !isSharing) {
      setErrorMsg(
        'Inicia «Compartir pantalla» para capturar y analizar lo que estás viendo en vivo.'
      );
      return;
    }
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorMsg('Esperando el primer fotograma de la pantalla compartida...');
      return;
    }

    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvasRef.current = canvas;
      const targetWidth = Math.min(1280, video.videoWidth);
      const scale = targetWidth / video.videoWidth;
      canvas.width = targetWidth;
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el lienzo de captura.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
      const base64 = dataUrl.split(',')[1] || '';

      const result = await onInspectScreen({
        imageBase64: base64,
        mimeType: 'image/jpeg',
        question: question.trim(),
        mode: focusMode,
      });

      const entry: SpectatorObservation = {
        ...result,
        id: `spec-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      setObservations((prev) => [entry, ...prev].slice(0, 15));
      if (speakAloud && entry.spokenLine) {
        onSpeakText(entry.spokenLine);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo analizar la pantalla en modo espectador.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!autoWatch || !isSharing) return;
    const timer = window.setInterval(() => {
      void captureAndAnalyze();
    }, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWatch, isSharing, focusMode, speakAloud, question]);

  const activePublishedApp = publishedApps.find((a) => a.slug === selectedSlug);

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-4"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-medium underline shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Spectator Control Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Pantalla de Espectador en Tiempo Real
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Observa tu pantalla compartida (navegador, videojuegos, Reels o apps) o supervisa en vivo una app publicada.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setSourceKind('screen')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  sourceKind === 'screen'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Pantalla compartida
              </button>
              <button
                type="button"
                onClick={() => setSourceKind('app')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  sourceKind === 'app'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                App publicada ({publishedApps.length})
              </button>
            </div>
          </div>
        </div>

        {sourceKind === 'screen' ? (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {!isSharing ? (
              <button
                type="button"
                onClick={() => void startScreenShare()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Monitor className="w-4 h-4" />
                <span>Compartir pantalla o pestaña</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScreenShare}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 transition-colors whitespace-nowrap shrink-0"
              >
                <MonitorOff className="w-4 h-4" />
                <span>Detener transmisión</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void captureAndAnalyze()}
              disabled={!isSharing || isAnalyzing}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Observando...</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Analizar fotograma ahora</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAutoWatch((v) => !v)}
              disabled={!isSharing}
              aria-pressed={autoWatch}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 ${
                autoWatch
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{autoWatch ? 'Espectador continuo: Sí (8s)' : 'Espectador continuo: No'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSpeakAloud((v) => !v)}
              aria-pressed={speakAloud}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                speakAloud
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {speakAloud ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>{speakAloud ? 'Narración por voz: Sí' : 'Narración por voz: No'}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label htmlFor="spectator-app-select" className="sr-only">
              Elegir aplicación publicada
            </label>
            <select
              id="spectator-app-select"
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
            >
              {publishedApps.length === 0 ? (
                <option value="">No hay apps publicadas aún</option>
              ) : (
                publishedApps.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.title} (/p/{a.slug})
                  </option>
                ))
              )}
            </select>
            {activePublishedApp && (
              <a
                href={`/p/${activePublishedApp.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Abrir en pestaña completa
              </a>
            )}
          </div>
        )}

        {/* Focus & Question Row */}
        {sourceKind === 'screen' && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
              {FOCUS_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFocusMode(m.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    focusMode === m.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Indicación opcional para el espectador (ej. dime qué pasa en este reel o cuál es la mejor jugada)"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        )}
      </div>

      {/* Spectator Viewport + Observations Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Viewport */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span>
              {sourceKind === 'screen'
                ? isSharing
                  ? 'Transmisión de pantalla activa'
                  : 'Vista previa de espectador en espera'
                : activePublishedApp
                  ? `Supervisando: ${activePublishedApp.title}`
                  : 'Vista de aplicación'}
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              {sourceKind === 'screen' ? (isSharing ? 'EN VIVO' : 'INACTIVO') : 'SANDBOX'}
            </span>
          </div>

          {sourceKind === 'screen' ? (
            <div className="aspect-video w-full flex items-center justify-center relative bg-slate-950">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`w-full h-full object-contain ${isSharing ? 'block' : 'hidden'}`}
              />
              {!isSharing && (
                <div className="p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-200">
                    Pantalla de espectador lista para observar
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Pulsa «Compartir pantalla o pestaña» para elegir cualquier ventana, juego, video o red social de tu equipo. OpenJarvis verá la pantalla en vivo y podrá narrar o asistirte paso a paso.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startScreenShare()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Conectar pantalla ahora</span>
                  </button>
                </div>
              )}
            </div>
          ) : activePublishedApp ? (
            <iframe
              title={activePublishedApp.title}
              srcDoc={activePublishedApp.htmlCode}
              sandbox="allow-scripts allow-forms allow-modals allow-downloads"
              className="w-full h-[460px] bg-white"
            />
          ) : (
            <div className="aspect-video flex items-center justify-center p-8 text-xs text-slate-400">
              No hay aplicaciones publicadas seleccionadas para supervisar.
            </div>
          )}
        </div>

        {/* Live Spectator Feed */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Bitácora del Espectador
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {observations.length} lecturas
            </span>
          </div>

          {observations.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Sin capturas analizadas aún
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparte una pantalla y pulsa «Analizar fotograma ahora» o activa el modo continuo cada 8 segundos.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
              {observations.map((obs) => (
                <li key={obs.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {obs.contextLabel}
                    </span>
                    <span className="font-mono tabular-nums">
                      {obs.timestamp} · {obs.latencyMs} ms
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {obs.summary}
                  </p>

                  {obs.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {obs.suggestedActions.slice(0, 3).map((act, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            onGoToAssistantWithPrompt(
                              `Sobre lo que vimos en la pantalla de espectador (${obs.contextLabel}): ${obs.summary}\nQuiero ejecutar o profundizar en: ${act}`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3 text-blue-600" />
                          <span>{act}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
