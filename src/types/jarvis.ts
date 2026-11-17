export type VoiceId = 'Charon' | 'Kore' | 'Zephyr' | 'Puck' | 'Fenrir';

export type TtsModelId = 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';

export type PresetId =
  | 'chat-simple'
  | 'code-assistant'
  | 'deep-research'
  | 'scheduled-monitor'
  | 'daily-briefing';

export type EngineRoute = 'local-first-hybrid' | 'cloud-reasoning' | 'low-latency-edge';

export interface VoiceProfile {
  id: VoiceId;
  name: string;
  register: string;
  timbre: string;
  recommendedFor: string;
  defaultStyle: string;
  samplePhrase: string;
  accentPitch: string;
}

export interface AgentPreset {
  id: PresetId;
  label: string;
  yamlName: string;
  description: string;
  thinkingLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  usesSearch: boolean;
  systemPrompt: string;
}

export interface MemoryEntry {
  id: string;
  category: 'preferencia' | 'proyecto' | 'contexto' | 'rutina';
  content: string;
  createdAt: string;
  source: 'manual' | 'agente';
}

export interface TraceRecord {
  id: string;
  timestamp: string;
  operation: 'chat' | 'tts' | 'stt' | 'app';
  preset: PresetId;
  model: string;
  voice?: VoiceId;
  latencyMs: number;
  promptTokens: number;
  outputTokens: number;
  estimatedEnergyWh: number;
  toolsUsed: string[];
  status: 'ok' | 'error';
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  preset: PresetId;
  voiceUsed?: VoiceId;
  toolsUsed?: string[];
  sources?: GroundingSource[];
  latencyMs?: number;
  tokens?: number;
  audioBase64?: string;
}

export type AppStatus = 'active' | 'paused';

export type ConnectedAppType = 'openjarvis_app' | 'web_app' | 'api_rest' | 'webhook';

export type ConnectedAppMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ConnectedAppCheckStatus = 'unknown' | 'online' | 'error';

export interface PublishedAppRecord {
  slug: string;
  title: string;
  summary: string;
  prompt: string;
  htmlCode: string;
  status: AppStatus;
  authorUid: string;
  authorName: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ConnectedAppRecord {
  id: string;
  name: string;
  appType: ConnectedAppType;
  baseUrl: string;
  healthPath: string;
  defaultMethod: ConnectedAppMethod;
  description: string;
  status: AppStatus;
  lastCheckStatus: ConnectedAppCheckStatus;
  lastHttpCode: number;
  lastLatencyMs: number;
  lastCheckedAtMs: number;
  linkedPublishedSlug: string;
  ownerUid: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export type RouterVendor =
  | 'openwrt'
  | 'mikrotik'
  | 'asus'
  | 'tplink'
  | 'generic_rest'
  | 'manual';

export type RouterAuthScheme =
  | 'basic'
  | 'bearer'
  | 'api_key_header'
  | 'cookie_session';

export type RouterConnectionStatus =
  | 'unknown'
  | 'connected'
  | 'unreachable'
  | 'snapshot_only';

export type RouterHealthStatus =
  | 'unknown'
  | 'optimal'
  | 'attention'
  | 'critical';

export type RouterReachMode = 'balanced' | 'max_speed' | 'max_range';

export type RouterSecurityLevel =
  | 'wpa2_standard'
  | 'wpa3_max'
  | 'strict_isolated';

export type RouterPriorityMode =
  | 'general'
  | 'video_calls'
  | 'gaming_low_latency'
  | 'streaming_4k';

export type RouterDnsProtection =
  | 'isp_default'
  | 'fast_private'
  | 'family_safe';

export interface SimplifiedRouterConfig {
  wifiName: string;
  reachMode: RouterReachMode;
  securityLevel: RouterSecurityLevel;
  priorityMode: RouterPriorityMode;
  dnsProtection: RouterDnsProtection;
  guestWifiEnabled: boolean;
  guestWifiName: string;
  autoOptimizeChannel: boolean;
}

export interface RouterProfileRecord extends SimplifiedRouterConfig {
  id: string;
  name: string;
  vendor: RouterVendor;
  hostUrl: string;
  adminUsername: string;
  authScheme: RouterAuthScheme;
  connectionStatus: RouterConnectionStatus;
  lastHttpCode: number;
  lastLatencyMs: number;
  lastDiagnosticHealth: RouterHealthStatus;
  lastDiagnosticSummary: string;
  ownerUid: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface RouterDiagnosticArea {
  area: string;
  status: 'optimal' | 'attention' | 'critical';
  headline: string;
  plainExplanation: string;
  technicalDetail: string;
  recommendation: string;
}

export interface RouterDiagnosticReport {
  overallHealth: 'optimal' | 'attention' | 'critical';
  overallTitle: string;
  summary: string;
  areas: RouterDiagnosticArea[];
  quickFixes: Array<{
    label: string;
    effectDescription: string;
    reachMode?: RouterReachMode;
    securityLevel?: RouterSecurityLevel;
    priorityMode?: RouterPriorityMode;
    dnsProtection?: RouterDnsProtection;
    guestWifiEnabled?: boolean;
    autoOptimizeChannel?: boolean;
  }>;
  connectionObserved: {
    reachable: boolean;
    httpStatus: number;
    latencyMs: number;
    isPrivateLan?: boolean;
    note: string;
  };
  model: string;
  latencyMs: number;
}

export type DesignStyleId =
  | 'editorial-suiza'
  | 'revista-lujo'
  | 'producto-saas'
  | 'estudio-creativo';

export interface DesignAuditReport {
  scoreLabel: string;
  aiTellsFound: string[];
  improvementsApplied: string[];
  typographyPairing: string;
  refinedHtml: string;
}

export interface SpectatorObservation {
  id: string;
  timestamp: string;
  contextLabel: string;
  summary: string;
  spokenLine: string;
  suggestedActions: string[];
  model: string;
  latencyMs: number;
}

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

export type VideoSubtitleTheme = 'cinematic_bottom' | 'viral_bold' | 'editorial_card';

export interface VideoScene {
  id: string;
  durationSec: number;
  headline: string;
  visualPrompt: string;
  captionText: string;
  motionType: 'zoom_in' | 'pan_left' | 'pan_right' | 'static_focus';
  layoutType: 'title_hero' | 'split_stat' | 'quote_frame' | 'lower_third';
}

export interface SubtitleCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface VideoProjectPlan {
  title: string;
  palette: {
    bgHex: string;
    accentHex: string;
    textHex: string;
  };
  subtitleTheme: VideoSubtitleTheme;
  narrationScript: string;
  scenes: VideoScene[];
  subtitles: SubtitleCue[];
  model: string;
  latencyMs: number;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface WebPageReadResult {
  url: string;
  title: string;
  description: string;
  wordCount: number;
  readingTimeMin: number;
  extractedText: string;
  headings: string[];
  links: Array<{ text: string; url: string }>;
  aiSummary: string;
  answer?: string;
  model: string;
  latencyMs: number;
}

export type AutonomousTaskType =
  | 'play_game'
  | 'google_research'
  | 'manage_apps'
  | 'web_workflow';

export interface AutonomousStepLog {
  id: string;
  step: number;
  timestamp: string;
  action: string;
  observation: string;
  outcome: string;
  status: 'ok' | 'info' | 'warning';
}

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'Charon',
    name: 'Charon',
    register: 'Barítono sereno',
    timbre: 'Grave, templado y analítico',
    recommendedFor: 'Briefings ejecutivos, arquitectura y modo Jarvis clásico',
    defaultStyle: 'Sereno, articulado, tono de asistente personal técnico con pausas claras',
    samplePhrase: 'Sistemas locales verificados. Tengo listo el resumen técnico de tu sesión y las tres prioridades pendientes.',
    accentPitch: '115 Hz',
  },
  {
    id: 'Kore',
    name: 'Kore',
    register: 'Contralto nítida',
    timbre: 'Clara, precisa y equilibrada',
    recommendedFor: 'Investigación profunda, lectura de informes y documentación',
    defaultStyle: 'Clara, profesional, dicción precisa y ritmo constante de lectura',
    samplePhrase: 'He contrastado las fuentes recientes y sintetizado los puntos clave en tu memoria de proyecto.',
    accentPitch: '195 Hz',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    register: 'Mezzosoprano cálida',
    timbre: 'Cercana, fluida y natural',
    recommendedFor: 'Conversación cotidiana, planificación diaria y notas rápidas',
    defaultStyle: 'Cálida, amable y conversacional, con entonación natural y cercana',
    samplePhrase: 'Buenos días. Hoy tienes una mañana despejada; podemos empezar revisando tus notas de código o el calendario.',
    accentPitch: '210 Hz',
  },
  {
    id: 'Puck',
    name: 'Puck',
    register: 'Tenor dinámico',
    timbre: 'Ágil, expresivo y brillante',
    recommendedFor: 'Sesiones de código, depuración interactiva y lluvia de ideas',
    defaultStyle: 'Ágil, entusiasta y expresivo, ideal para iterar ideas con rapidez',
    samplePhrase: 'Buena idea. Podemos desacoplar el motor de inferencia y probar la latencia de voz en tiempo real ahora mismo.',
    accentPitch: '155 Hz',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    register: 'Bajo profundo',
    timbre: 'Firme, contundente y sobrio',
    recommendedFor: 'Monitoreo programado, alertas del sistema y comandos directos',
    defaultStyle: 'Firme, sobrio y directo, sin adornos innecesarios',
    samplePhrase: 'Alerta de monitoreo: la latencia de respuesta ha superado el umbral configurado. Recomiendo revisar la traza.',
    accentPitch: '98 Hz',
  },
];

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'chat-simple',
    label: 'Asistente Directo',
    yamlName: 'chat-simple.yaml',
    description: 'Respuestas ágiles de baja latencia para consultas rápidas y control por voz.',
    thinkingLevel: 'LOW',
    usesSearch: false,
    systemPrompt:
      'Eres OpenJarvis, un asistente personal de IA inspirado en la arquitectura local-first de open-jarvis/openjarvis. Responde en español de forma clara, concisa y práctica, optimizada tanto para lectura visual como para síntesis de voz.',
  },
  {
    id: 'code-assistant',
    label: 'Asistente de Código',
    yamlName: 'code-assistant.yaml',
    description: 'Razonamiento técnico profundo para arquitectura, TypeScript, Python y depuración.',
    thinkingLevel: 'HIGH',
    usesSearch: false,
    systemPrompt:
      'Eres el agente code-assistant de OpenJarvis. Analizas código, arquitectura de motores de inferencia (Ollama, llama.cpp, vLLM, MCP) y sistemas full-stack con rigor técnico. Responde en español con ejemplos precisos.',
  },
  {
    id: 'deep-research',
    label: 'Investigación Profunda',
    yamlName: 'deep-research.yaml',
    description: 'Búsqueda web verificada y síntesis multi-fuente con citas en tiempo real.',
    thinkingLevel: 'HIGH',
    usesSearch: true,
    systemPrompt:
      'Eres el agente deep-research de OpenJarvis. Utiliza Google Search cuando necesites datos actuales o verificación externa, y sintetiza hallazgos estructurados en español citando hechos concretos.',
  },
  {
    id: 'daily-briefing',
    label: 'Briefing Diario',
    yamlName: 'daily-briefing.yaml',
    description: 'Resúmenes estructurados cruzando tu memoria local y prioridades del día.',
    thinkingLevel: 'MEDIUM',
    usesSearch: false,
    systemPrompt:
      'Eres el agente daily-briefing de OpenJarvis. Revisa la memoria personal del usuario para generar resúmenes ejecutivos breves, accionables y fáciles de escuchar por voz.',
  },
  {
    id: 'scheduled-monitor',
    label: 'Monitor de Sistema',
    yamlName: 'scheduled-monitor.yaml',
    description: 'Supervisión de estado, trazas de latencia, consumo energético y diagnósticos.',
    thinkingLevel: 'MEDIUM',
    usesSearch: false,
    systemPrompt:
      'Eres el agente scheduled-monitor de OpenJarvis. Evalúas métricas de latencia, tokens, consumo energético estimado y estado de las herramientas con precisión operativa.',
  },
];
