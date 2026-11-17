import React, { useState } from 'react';
import {
  Play,
  Globe,
  Code2,
  Eye,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Download,
  Loader2,
  Mic,
  MicOff,
  LogIn,
  LogOut,
  AlertCircle,
  Monitor,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  AppStatus,
  AutonomousTaskType,
  ConnectedAppMethod,
  ConnectedAppRecord,
  ConnectedAppType,
  DesignAuditReport,
  DesignStyleId,
  MemoryEntry,
  PublishedAppRecord,
  RouterAuthScheme,
  RouterDiagnosticReport,
  RouterProfileRecord,
  RouterVendor,
  SimplifiedRouterConfig,
  SpectatorObservation,
  SubtitleCue,
  TraceRecord,
  VideoAspectRatio,
  VideoProjectPlan,
  VideoSubtitleTheme,
  VoiceId,
  WebPageReadResult,
  WebSearchResultItem,
} from '../types/jarvis';
import { ConnectedAppsManager } from './ConnectedAppsManager';
import {
  RouterManagerView,
  type ApplyRouterConfigResult,
  type SaveRouterProfileInput,
  type SimplifyRouterConfigResult,
} from './RouterManagerView';
import { SpectatorView } from './SpectatorView';
import { VideoStudioView } from './VideoStudioView';
import { SearchWebReaderView } from './SearchWebReaderView';
import { AutonomousAgentView } from './AutonomousAgentView';

export type AppsWorkspaceMode =
  | 'builder'
  | 'manage'
  | 'router'
  | 'spectator'
  | 'video'
  | 'web'
  | 'autonomous';

interface AppBuilderViewProps {
  mode: AppsWorkspaceMode;
  onChangeMode: (mode: AppsWorkspaceMode) => void;
  user: User | null;
  authReady: boolean;
  publishedApps: PublishedAppRecord[];
  connectedApps: ConnectedAppRecord[];
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onGenerateApp: (
    prompt: string,
    currentHtml?: string,
    designStyle?: DesignStyleId
  ) => Promise<{
    title: string;
    summary: string;
    suggestedSlug: string;
    htmlCode: string;
    model: string;
    latencyMs: number;
  }>;
  onAuditDesign: (
    htmlCode: string,
    designStyle: DesignStyleId
  ) => Promise<DesignAuditReport & { model: string; latencyMs: number }>;
  onPublishApp: (payload: {
    slug: string;
    title: string;
    summary: string;
    prompt: string;
    htmlCode: string;
  }) => Promise<string>;
  onDeleteApp: (slug: string) => Promise<void>;
  onTogglePublishedStatus: (slug: string, status: AppStatus) => Promise<void>;
  onSaveConnectedApp: (input: {
    id?: string;
    name: string;
    appType: ConnectedAppType;
    baseUrl: string;
    healthPath?: string;
    defaultMethod: ConnectedAppMethod;
    description?: string;
    status?: AppStatus;
    linkedPublishedSlug?: string;
  }) => Promise<string>;
  onToggleConnectedStatus: (id: string, status: AppStatus) => Promise<void>;
  onPingConnectedApp: (app: ConnectedAppRecord) => Promise<{
    online: boolean;
    httpStatus: number;
    latencyMs: number;
    snippet?: string;
    error?: string;
  }>;
  onDispatchCommand: (payload: {
    app: ConnectedAppRecord;
    endpointPath: string;
    method: ConnectedAppMethod;
    bodyText: string;
    authHeaderName?: string;
    authHeaderValue?: string;
  }) => Promise<{
    ok: boolean;
    httpStatus: number;
    latencyMs: number;
    bodyText?: string;
    targetUrl?: string;
    error?: string;
  }>;
  onDeleteConnectedApp: (id: string) => Promise<void>;
  routerProfiles: RouterProfileRecord[];
  onSaveRouterProfile: (input: SaveRouterProfileInput) => Promise<string>;
  onDeleteRouterProfile: (id: string) => Promise<void>;
  onDiagnoseRouter: (payload: {
    profileId?: string;
    name: string;
    vendor: RouterVendor;
    hostUrl: string;
    adminUsername: string;
    adminPassword: string;
    authScheme: RouterAuthScheme;
    probePath?: string;
    diagnosticSnapshot?: string;
    simplifiedConfig: SimplifiedRouterConfig;
  }) => Promise<RouterDiagnosticReport>;
  onSimplifyRouterConfig: (payload: {
    vendor: RouterVendor;
    routerName: string;
    naturalRequest: string;
    simplifiedConfig: SimplifiedRouterConfig;
    newWifiPassword?: string;
  }) => Promise<SimplifyRouterConfigResult>;
  onApplyRouterConfig: (payload: {
    hostUrl: string;
    applyPath: string;
    method: 'POST' | 'PUT' | 'PATCH';
    adminUsername: string;
    adminPassword: string;
    authScheme: RouterAuthScheme;
    payloadJson: string;
  }) => Promise<ApplyRouterConfigResult>;
  onGoToAssistantWithPrompt: (promptText: string) => void;
  onTranscribeToPrompt: (blob: Blob, mimeType: string) => Promise<string>;
  memories: MemoryEntry[];
  traces: TraceRecord[];
  activeVoice: VoiceId;
  onInspectScreen: (payload: {
    imageBase64: string;
    mimeType: string;
    question: string;
    mode: 'spectator' | 'game' | 'reels' | 'design';
  }) => Promise<Omit<SpectatorObservation, 'id' | 'timestamp'>>;
  onGenerateVideoPlan: (payload: {
    topic: string;
    style: string;
    aspectRatio: VideoAspectRatio;
    durationSec: number;
    subtitleTheme: VideoSubtitleTheme;
  }) => Promise<VideoProjectPlan>;
  onAutoSubtitles: (payload: {
    audioBase64?: string;
    mimeType?: string;
    scriptText?: string;
    totalDurationSec: number;
  }) => Promise<{ transcript: string; subtitles: SubtitleCue[] }>;
  onSynthesizeVoiceover: (
    text: string,
    voiceName: VoiceId
  ) => Promise<{ audioBase64: string; mimeType: string }>;
  onSearchWeb: (query: string) => Promise<{
    answer: string;
    results: WebSearchResultItem[];
    model: string;
    latencyMs: number;
  }>;
  onReadWebPage: (url: string, question?: string) => Promise<WebPageReadResult>;
  onApplyAppStatusChanges: (
    changes: Array<{
      kind: 'connected' | 'published';
      identifier: string;
      status: AppStatus;
    }>
  ) => Promise<void>;
  onRunAutonomousStep: (payload: {
    goal: string;
    taskType: AutonomousTaskType;
    stepIndex: number;
    previousLog: Array<{ action: string; outcome: string }>;
    gameState?: Record<string, unknown>;
    screenImageBase64?: string;
    screenMimeType?: string;
  }) => Promise<{
    action: string;
    observation: string;
    outcome: string;
    move?: string;
    sources?: Array<{ title: string; url: string }>;
    statusChanges?: Array<{
      kind: 'connected' | 'published';
      identifier: string;
      status: AppStatus;
    }>;
    spokenLine?: string;
    companionScript?: string;
    model: string;
    latencyMs: number;
  }>;
  onSpeakText: (text: string) => void;
}

const DESIGN_STYLES: Array<{
  id: DesignStyleId;
  label: string;
  detail: string;
}> = [
  {
    id: 'editorial-suiza',
    label: 'Editorial Suiza',
    detail: 'Papel cálido, tipografía limpia y rejilla asimétrica',
  },
  {
    id: 'revista-lujo',
    label: 'Revista / Lujo Silencioso',
    detail: 'Serif editorial, marfil sobrio y espaciado amplio',
  },
  {
    id: 'producto-saas',
    label: 'Producto SaaS Sobrio',
    detail: 'Bordes nítidos de 1px y cifras tabulares de alta legibilidad',
  },
  {
    id: 'estudio-creativo',
    label: 'Estudio Creativo',
    detail: 'Bento asimétrico de alto contraste sin clichés neón',
  },
];

const WORKSPACE_MODES: Array<{ id: AppsWorkspaceMode; label: string }> = [
  { id: 'builder', label: 'Crear y Diseño' },
  { id: 'manage', label: 'Conectar Apps' },
  { id: 'router', label: 'Router y Red' },
  { id: 'spectator', label: 'Espectador' },
  { id: 'video', label: 'Video y Subtítulos' },
  { id: 'web', label: 'Buscador y Web' },
  { id: 'autonomous', label: 'Autónomo' },
];

const APP_STARTERS: Array<{ title: string; prompt: string }> = [
  {
    title: 'Gestor de gastos personales',
    prompt:
      'Crea un gestor de gastos personales con categorías, presupuesto mensual, gráfico SVG de barras por categoría, filtro por mes y persistencia en localStorage.',
  },
  {
    title: 'Tablero Kanban de tareas',
    prompt:
      'Crea un tablero Kanban con columnas Por hacer, En curso y Completado, prioridades, búsqueda instantánea y guardado automático en localStorage.',
  },
  {
    title: 'Temporizador Pomodoro',
    prompt:
      'Crea un temporizador Pomodoro minimalista con modos Trabajo, Descanso corto y Descanso largo, contador de sesiones diarias, sonido suave con Web Audio API y lista de tareas.',
  },
  {
    title: 'Calculadora de ROI y métricas SaaS',
    prompt:
      'Crea una calculadora interactiva de métricas SaaS (MRR, ARR, Churn, LTV y CAC) con deslizadores en tiempo real y gráfica SVG comparativa.',
  },
];

export const AppBuilderView: React.FC<AppBuilderViewProps> = ({
  mode,
  onChangeMode,
  user,
  authReady,
  publishedApps,
  connectedApps,
  onSignIn,
  onSignOut,
  onGenerateApp,
  onPublishApp,
  onDeleteApp,
  onTogglePublishedStatus,
  onSaveConnectedApp,
  onToggleConnectedStatus,
  onPingConnectedApp,
  onDispatchCommand,
  onDeleteConnectedApp,
  routerProfiles,
  onSaveRouterProfile,
  onDeleteRouterProfile,
  onDiagnoseRouter,
  onSimplifyRouterConfig,
  onApplyRouterConfig,
  onGoToAssistantWithPrompt,
  onTranscribeToPrompt,
  onAuditDesign,
  memories,
  traces,
  activeVoice,
  onInspectScreen,
  onGenerateVideoPlan,
  onAutoSubtitles,
  onSynthesizeVoiceover,
  onSearchWeb,
  onReadWebPage,
  onApplyAppStatusChanges,
  onRunAutonomousStep,
  onSpeakText,
}) => {
  const [prompt, setPrompt] = useState('');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [designStyle, setDesignStyle] =
    useState<DesignStyleId>('editorial-suiza');
  const [designAuditReport, setDesignAuditReport] =
    useState<DesignAuditReport | null>(null);
  const [isAuditingDesign, setIsAuditingDesign] = useState(false);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [slug, setSlug] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [lastGenMeta, setLastGenMeta] = useState<{
    model: string;
    latencyMs: number;
  } | null>(null);

  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>(
    'desktop'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    setErrorMsg(null);
    setPublishedUrl(null);
    setDesignAuditReport(null);
    setIsGenerating(true);
    try {
      const res = await onGenerateApp(prompt.trim(), '', designStyle);
      setTitle(res.title);
      setSummary(res.summary);
      setSlug(res.suggestedSlug);
      setHtmlCode(res.htmlCode);
      setLastGenMeta({ model: res.model, latencyMs: res.latencyMs });
      setViewMode('preview');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo generar la aplicación.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refinePrompt.trim() || !htmlCode || isGenerating) return;
    setErrorMsg(null);
    setPublishedUrl(null);
    setDesignAuditReport(null);
    setIsGenerating(true);
    try {
      const res = await onGenerateApp(
        refinePrompt.trim(),
        htmlCode,
        designStyle
      );
      setTitle(res.title);
      setSummary(res.summary);
      if (!slug) setSlug(res.suggestedSlug);
      setHtmlCode(res.htmlCode);
      setLastGenMeta({ model: res.model, latencyMs: res.latencyMs });
      setRefinePrompt('');
      setViewMode('preview');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la aplicación.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAuditDesignClick = async () => {
    if (!htmlCode || isAuditingDesign || isGenerating) return;
    setErrorMsg(null);
    setIsAuditingDesign(true);
    try {
      const report = await onAuditDesign(htmlCode, designStyle);
      setHtmlCode(report.refinedHtml);
      setDesignAuditReport(report);
      setLastGenMeta({ model: report.model, latencyMs: report.latencyMs });
      setViewMode('preview');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la auditoría Anti-IA del diseño.'
      );
    } finally {
      setIsAuditingDesign(false);
    }
  };

  const handlePublish = async () => {
    if (!htmlCode.trim() || isPublishing) return;
    setErrorMsg(null);
    setIsPublishing(true);
    try {
      if (!user) {
        await onSignIn();
      }
      const finalSlug = await onPublishApp({
        slug: slug || title || 'mi-app',
        title: title || 'Aplicación OpenJarvis',
        summary: summary || 'Aplicación web creada a partir de prompt.',
        prompt: prompt || title || 'Aplicación web',
        htmlCode,
      });
      setSlug(finalSlug);
      const fullUrl = `${window.location.origin}/p/${finalSlug}`;
      setPublishedUrl(fullUrl);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo publicar la aplicación.'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlug(key);
      window.setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      setErrorMsg('No se pudo copiar el enlace al portapapeles.');
    }
  };

  const handleDownloadHtml = () => {
    if (!htmlCode) return;
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'openjarvis-app'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleVoicePrompt = async () => {
    setErrorMsg(null);
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Tu navegador no admite captura de micrófono.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          setIsTranscribing(true);
          try {
            const text = await onTranscribeToPrompt(blob, mimeType);
            if (text) {
              setPrompt((prev) => (prev ? `${prev} ${text}` : text));
            }
          } catch (err) {
            setErrorMsg(
              err instanceof Error ? err.message : 'Error al transcribir voz.'
            );
          } finally {
            setIsTranscribing(false);
          }
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Permiso de micrófono requerido: ${err.message}`
          : 'No se pudo acceder al micrófono.'
      );
    }
  };

  const handleLoadPublished = (app: PublishedAppRecord) => {
    setTitle(app.title);
    setSummary(app.summary);
    setPrompt(app.prompt);
    setSlug(app.slug);
    setHtmlCode(app.htmlCode);
    setPublishedUrl(`${window.location.origin}/p/${app.slug}`);
    setViewMode('preview');
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {mode === 'builder'
                  ? 'Asistente de creación de app'
                  : mode === 'manage'
                    ? 'Conectar y manejar aplicaciones'
                    : mode === 'router'
                      ? 'Router, diagnóstico y configuración sencilla'
                      : mode === 'spectator'
                        ? 'Pantalla de espectador en vivo'
                        : mode === 'video'
                          ? 'Estudio de video profesional y subtítulos'
                          : mode === 'web'
                            ? 'Buscador interno y lector web universal'
                            : 'Agente autónomo multi-tarea'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                {mode === 'builder'
                  ? 'Crea aplicaciones con dirección de arte humana sin clichés de IA, audita su diseño y publícalas online de forma ilimitada.'
                  : mode === 'manage'
                    ? 'Conecta aplicaciones web, APIs REST o webhooks, verifica su estado en línea, envía comandos y controla tus apps publicadas.'
                    : mode === 'router'
                      ? 'Conecta un router con su clave de admin, obtén un diagnóstico detallado de todo y edita su configuración en términos simplificados.'
                      : mode === 'spectator'
                        ? 'Observa cualquier pantalla, ventana, pestaña o app publicada en tiempo real con análisis visual y narración por voz.'
                        : mode === 'video'
                          ? 'Produce videos editoriales o verticales con guión, locución neuronal y subtítulos quemados listos para descargar.'
                          : mode === 'web'
                            ? 'Busca dentro de tu estudio o en Google al instante y lee cualquier página web pública con resumen y preguntas.'
                            : 'Ejecuta flujos autónomos: juega videojuegos con piloto IA en la arena de espectador, investiga en Google, supervisa apps o asiste en Reels.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {authReady && user ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
                    {user.displayName || user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void onSignIn()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 text-blue-600" />
                  <span>Conectar cuenta</span>
                </button>
              )}
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Herramientas del estudio"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto no-scrollbar"
          >
            {WORKSPACE_MODES.map((wm) => {
              const countSuffix =
                wm.id === 'manage'
                  ? ` (${connectedApps.length + publishedApps.length})`
                  : wm.id === 'router'
                    ? ` (${routerProfiles.length})`
                    : '';
              const active = mode === wm.id;
              return (
                <button
                  key={wm.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onChangeMode(wm.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {wm.label}
                  {countSuffix}
                </button>
              );
            })}
          </div>
        </div>

        {mode === 'manage' ? (
          <ConnectedAppsManager
            user={user}
            authReady={authReady}
            publishedApps={publishedApps}
            connectedApps={connectedApps}
            onSignIn={onSignIn}
            onSaveConnectedApp={onSaveConnectedApp}
            onToggleConnectedStatus={onToggleConnectedStatus}
            onPingConnectedApp={onPingConnectedApp}
            onDispatchCommand={onDispatchCommand}
            onDeleteConnectedApp={onDeleteConnectedApp}
            onTogglePublishedStatus={onTogglePublishedStatus}
            onDeletePublishedApp={onDeleteApp}
            onEditPublishedInBuilder={(pub) => {
              handleLoadPublished(pub);
              onChangeMode('builder');
            }}
            onGoToAssistantWithPrompt={onGoToAssistantWithPrompt}
          />
        ) : mode === 'router' ? (
          <RouterManagerView
            user={user}
            authReady={authReady}
            routerProfiles={routerProfiles}
            onSignIn={onSignIn}
            onSaveRouterProfile={onSaveRouterProfile}
            onDeleteRouterProfile={onDeleteRouterProfile}
            onDiagnoseRouter={onDiagnoseRouter}
            onSimplifyRouterConfig={onSimplifyRouterConfig}
            onApplyRouterConfig={onApplyRouterConfig}
            onGoToAssistantWithPrompt={onGoToAssistantWithPrompt}
          />
        ) : mode === 'spectator' ? (
          <SpectatorView
            publishedApps={publishedApps}
            onInspectScreen={onInspectScreen}
            onSpeakText={onSpeakText}
            onGoToAssistantWithPrompt={onGoToAssistantWithPrompt}
          />
        ) : mode === 'video' ? (
          <VideoStudioView
            activeVoice={activeVoice}
            onGenerateVideoPlan={onGenerateVideoPlan}
            onAutoSubtitles={onAutoSubtitles}
            onSynthesizeVoiceover={onSynthesizeVoiceover}
          />
        ) : mode === 'web' ? (
          <SearchWebReaderView
            memories={memories}
            publishedApps={publishedApps}
            connectedApps={connectedApps}
            routerProfiles={routerProfiles}
            traces={traces}
            onSearchWeb={onSearchWeb}
            onReadWebPage={onReadWebPage}
            onSpeakText={onSpeakText}
          />
        ) : mode === 'autonomous' ? (
          <AutonomousAgentView
            connectedApps={connectedApps}
            publishedApps={publishedApps}
            onApplyAppStatusChanges={onApplyAppStatusChanges}
            onRunAutonomousStep={onRunAutonomousStep}
            onSpeakText={onSpeakText}
          />
        ) : (
          <>

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
              onClick={() => setErrorMsg(null)}
              className="text-xs font-medium underline shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}

        {publishedUrl && (
          <div className="px-4 py-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Aplicación publicada online
              </div>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-mono text-emerald-900 dark:text-emerald-100 hover:underline truncate block mt-0.5"
              >
                {publishedUrl}
              </a>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleCopy(publishedUrl, 'banner')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                {copiedSlug === 'banner' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </button>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors whitespace-nowrap"
              >
                <span>Abrir online</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Builder Workspace Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Prompt + Controls + Publish */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={(e) => void handleCreate(e)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="app-builder-prompt"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  Prompt de la aplicación
                </label>
                <button
                  type="button"
                  onClick={() => void toggleVoicePrompt()}
                  disabled={isTranscribing || isGenerating}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                    isRecording
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Transcribiendo</span>
                    </>
                  ) : isRecording ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 text-red-600" />
                      <span>Detener voz</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Dictar prompt</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                id="app-builder-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej. Crea un planificador semanal de comidas con lista de compras automática y exportación a texto..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <div>
                <label
                  htmlFor="design-style-select"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Dirección de arte profesional (sin clichés de IA)
                </label>
                <select
                  id="design-style-select"
                  value={designStyle}
                  onChange={(e) =>
                    setDesignStyle(e.target.value as DesignStyleId)
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {DESIGN_STYLES.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.label} — {style.detail}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!prompt.trim() || isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-45 text-white transition-colors whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando aplicación...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Generar aplicación</span>
                  </>
                )}
              </button>

              {!htmlCode && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Ideas rápidas para empezar
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {APP_STARTERS.map((starter) => (
                      <button
                        key={starter.title}
                        type="button"
                        onClick={() => setPrompt(starter.prompt)}
                        className="text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 text-xs text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        {starter.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {htmlCode && (
              <>
                {/* Iterative Refinement */}
                <form
                  onSubmit={(e) => void handleRefine(e)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3"
                >
                  <label
                    htmlFor="refine-app-prompt"
                    className="block text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Mejorar con otro prompt
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="refine-app-prompt"
                      type="text"
                      value={refinePrompt}
                      onChange={(e) => setRefinePrompt(e.target.value)}
                      placeholder="Ej. Agrega modo oscuro y botón de exportar..."
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={!refinePrompt.trim() || isGenerating}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
                    >
                      Aplicar
                    </button>
                  </div>
                </form>

                {/* Publish Online Box */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Publicar online (ilimitado)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cada aplicación obtiene su propia dirección web pública en{' '}
                      <span className="font-mono">/p/{slug || 'mi-app'}</span>.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="publish-title-input"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Nombre de la app
                      </label>
                      <input
                        id="publish-title-input"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="publish-slug-input"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Ruta URL pública
                      </label>
                      <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm">
                        <span className="font-mono text-xs text-slate-400 mr-1">
                          /p/
                        </span>
                        <input
                          id="publish-slug-input"
                          type="text"
                          value={slug}
                          onChange={(e) =>
                            setSlug(
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, '-')
                            )
                          }
                          className="flex-1 bg-transparent font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={isPublishing || !htmlCode}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Publicando...</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-4 h-4" />
                          <span>
                            {user
                              ? 'Publicar online'
                              : 'Conectar y publicar online'}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleAuditDesignClick()}
                      disabled={isAuditingDesign || isGenerating || !htmlCode}
                      title="Audita el HTML actual y elimina clichés visuales de IA"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
                    >
                      {isAuditingDesign ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Auditando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span>Auditoría Anti-IA</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadHtml}
                      title="Descargar código HTML"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>HTML</span>
                    </button>
                  </div>
                </div>

                {designAuditReport && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                        {designAuditReport.scoreLabel}
                      </h3>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {designAuditReport.typographyPairing}
                      </span>
                    </div>

                    {designAuditReport.aiTellsFound.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Clichés de IA corregidos
                        </div>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                          {designAuditReport.aiTellsFound.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {designAuditReport.improvementsApplied.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Mejoras editoriales aplicadas
                        </div>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                          {designAuditReport.improvementsApplied.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column: Live Preview / Code */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden flex flex-col min-h-[560px]">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/60">
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    viewMode === 'preview'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Vista previa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('code')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    viewMode === 'code'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Código</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {lastGenMeta && (
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {lastGenMeta.model} · {lastGenMeta.latencyMs} ms
                  </span>
                )}

                {viewMode === 'preview' && (
                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setViewportMode('desktop')}
                      aria-label="Vista escritorio"
                      className={`p-1.5 rounded-md transition-colors ${
                        viewportMode === 'desktop'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewportMode('mobile')}
                      aria-label="Vista móvil"
                      className={`p-1.5 rounded-md transition-colors ${
                        viewportMode === 'mobile'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!htmlCode ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  La vista previa en vivo aparecerá aquí
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Escribe o dicta un prompt a la izquierda y pulsa «Generar aplicación» para construirla al instante.
                </p>
              </div>
            ) : viewMode === 'preview' ? (
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-3 flex justify-center">
                <iframe
                  title={title || 'Vista previa de aplicación generada'}
                  srcDoc={htmlCode}
                  sandbox="allow-scripts allow-forms allow-modals allow-downloads"
                  className={`bg-white rounded-lg border border-slate-200 dark:border-slate-800 transition-all ${
                    viewportMode === 'mobile'
                      ? 'w-[375px] h-[560px]'
                      : 'w-full h-[560px]'
                  }`}
                />
              </div>
            ) : (
              <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 max-h-[580px]">
                <code>{htmlCode}</code>
              </pre>
            )}
          </div>
        </div>

        {/* Published Apps Directory */}
        <section
          aria-labelledby="published-apps-heading"
          className="space-y-4 pt-2"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="published-apps-heading"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Mis aplicaciones publicadas online
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Publicaciones ilimitadas con enlace permanente en la nube.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {publishedApps.length}{' '}
              {publishedApps.length === 1 ? 'publicada' : 'publicadas'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
            {!user ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Conecta tu cuenta para gestionar tus apps publicadas
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Puedes crear y probar aplicaciones libremente; al conectar tu cuenta se guardan tus URLs públicas de forma ilimitada.
                </p>
                <button
                  type="button"
                  onClick={() => void onSignIn()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Conectar con Google</span>
                </button>
              </div>
            ) : publishedApps.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Aún no has publicado aplicaciones online
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Genera tu primera aplicación arriba y pulsa «Publicar online» para obtener su enlace público.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {publishedApps.map((item) => {
                  const url = `${window.location.origin}/p/${item.slug}`;
                  return (
                    <li
                      key={item.slug}
                      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {item.title}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                            /p/{item.slug}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {item.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleLoadPublished(item)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopy(url, item.slug)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                          {copiedSlug === item.slug ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar URL</span>
                            </>
                          )}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
                        >
                          <span>Abrir</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => void onDeleteApp(item.slug)}
                          aria-label={`Eliminar ${item.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
          </>
        )}
      </div>
    </div>
  );
};
