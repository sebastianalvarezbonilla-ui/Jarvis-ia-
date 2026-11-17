import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no está configurada. Añádela en el panel Settings > Secrets para activar las respuestas de OpenJarvis y las voces neuronales.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VALID_VOICES = ['Charon', 'Kore', 'Zephyr', 'Puck', 'Fenrir'] as const;
const VALID_PRESETS = [
  'chat-simple',
  'code-assistant',
  'deep-research',
  'scheduled-monitor',
  'daily-briefing',
] as const;

const saveMemoryTool: FunctionDeclaration = {
  name: 'save_memory',
  description:
    'Guarda un dato, preferencia, proyecto o recordatorio importante en la memoria local de OpenJarvis para futuras consultas.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: 'Categoría de la memoria: preferencia, proyecto, contexto o rutina.',
      },
      content: {
        type: Type.STRING,
        description: 'Contenido conciso a recordar en la memoria personal.',
      },
    },
    required: ['category', 'content'],
  },
};

const searchMemoryTool: FunctionDeclaration = {
  name: 'search_memory',
  description:
    'Busca entradas guardadas en la memoria local de OpenJarvis relacionadas con una consulta.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Palabra clave o tema a buscar en la memoria local.',
      },
    },
    required: ['query'],
  },
};

const switchVoiceTool: FunctionDeclaration = {
  name: 'switch_voice',
  description:
    'Cambia la voz activa de OpenJarvis cuando el usuario pida usar una voz específica (Charon, Kore, Zephyr, Puck o Fenrir).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      voiceId: {
        type: Type.STRING,
        description: 'Nombre de la voz: Charon, Kore, Zephyr, Puck o Fenrir.',
      },
      style: {
        type: Type.STRING,
        description: 'Estilo vocal opcional solicitado por el usuario.',
      },
    },
    required: ['voiceId'],
  },
};

const switchPresetTool: FunctionDeclaration = {
  name: 'switch_preset',
  description:
    'Cambia el agente/preset activo de OpenJarvis (chat-simple, code-assistant, deep-research, scheduled-monitor, daily-briefing).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      presetId: {
        type: Type.STRING,
        description: 'ID del preset a activar.',
      },
    },
    required: ['presetId'],
  },
};

const listUserAppsTool: FunctionDeclaration = {
  name: 'list_user_apps',
  description:
    'Lista las aplicaciones creadas/publicadas y las aplicaciones externas o webhooks conectados del usuario junto con su estado actual (active o paused) y URLs.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filter: {
        type: Type.STRING,
        description: 'Opcional: "all", "published", "connected", "active" o "paused".',
      },
    },
  },
};

const toggleAppStatusTool: FunctionDeclaration = {
  name: 'toggle_app_status',
  description:
    'Activa o pausa una aplicación publicada (/p/:slug) o una aplicación conectada del usuario.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      kind: {
        type: Type.STRING,
        description: 'Tipo de registro: "published" o "connected".',
      },
      identifier: {
        type: Type.STRING,
        description: 'Nombre, slug o ID de la aplicación a modificar.',
      },
      status: {
        type: Type.STRING,
        description: 'Nuevo estado: "active" o "paused".',
      },
    },
    required: ['kind', 'identifier', 'status'],
  },
};

const executeConnectedAppTool: FunctionDeclaration = {
  name: 'execute_connected_app',
  description:
    'Ejecuta una petición HTTP (GET o POST) sobre una aplicación conectada activa (API, webhook o app web) para consultar su estado o enviarle un comando.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      appNameOrId: {
        type: Type.STRING,
        description: 'Nombre o ID de la aplicación conectada activa.',
      },
      method: {
        type: Type.STRING,
        description: 'Método HTTP opcional (GET o POST).',
      },
      endpointPath: {
        type: Type.STRING,
        description: 'Ruta relativa opcional (ej. /api/status).',
      },
      payloadJson: {
        type: Type.STRING,
        description: 'Cuerpo JSON opcional serializado como texto para peticiones POST.',
      },
    },
    required: ['appNameOrId'],
  },
};

const readWebPageTool: FunctionDeclaration = {
  name: 'read_web_page',
  description:
    'Lee y extrae el título, resumen y contenido textual principal de cualquier página web pública (http:// o https://) proporcionada por el usuario.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: 'URL pública completa de la página web (ej. https://ejemplo.com/articulo).',
      },
    },
    required: ['url'],
  },
};

interface MemoryItemInput {
  id: string;
  category: string;
  content: string;
  createdAt: string;
  source: string;
}

interface PublishedAppContextInput {
  slug: string;
  title: string;
  summary: string;
  status: 'active' | 'paused';
}

interface ConnectedAppContextInput {
  id: string;
  name: string;
  appType: string;
  baseUrl: string;
  healthPath: string;
  defaultMethod: string;
  description: string;
  status: 'active' | 'paused';
  lastCheckStatus: string;
}

interface RouterProfileContextInput {
  id: string;
  name: string;
  vendor: string;
  hostUrl: string;
  connectionStatus: string;
  lastDiagnosticHealth: string;
  lastDiagnosticSummary: string;
  wifiName: string;
  reachMode: string;
  securityLevel: string;
  priorityMode: string;
  dnsProtection: string;
  guestWifiEnabled: boolean;
}

interface ChatHistoryInput {
  role: 'user' | 'assistant';
  content: string;
}

function buildRouterAuthHeaders(
  authScheme: string,
  username: string,
  adminKey: string
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, text/html',
  };
  const key = String(adminKey || '');
  const user = String(username || 'admin');
  if (!key) return headers;

  if (authScheme === 'bearer') {
    headers['Authorization'] = `Bearer ${key}`;
  } else if (authScheme === 'api_key_header') {
    headers['X-API-Key'] = key;
    headers['X-Admin-Key'] = key;
  } else {
    const encoded = Buffer.from(`${user}:${key}`, 'utf-8').toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  }
  return headers;
}

function isPrivateOrRestrictedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
    return true;
  }
  if (/^169\.254\./.test(host)) {
    return true;
  }
  const match172 = host.match(/^172\.(\d+)\./);
  if (match172) {
    const second = Number(match172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function resolveSafeAppUrl(baseUrl: string, endpointPath = ''): string {
  const cleanBase = String(baseUrl || '').trim();
  const cleanPath = String(endpointPath || '').trim();

  if (cleanBase.startsWith('/p/')) {
    const slugMatch = cleanBase.match(/^\/p\/([a-zA-Z0-9_-]{3,128})/);
    if (!slugMatch) {
      throw new Error('Ruta interna /p/ inválida.');
    }
    return `http://127.0.0.1:${PORT}/p/${slugMatch[1]}`;
  }

  let parsedBase: URL;
  try {
    parsedBase = new URL(cleanBase);
  } catch {
    throw new Error('La URL de la aplicación no es válida.');
  }

  if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
    throw new Error('Solo se permiten protocolos http:// o https://.');
  }

  if (isPrivateOrRestrictedHost(parsedBase.hostname)) {
    throw new Error(
      'Por seguridad, no se permiten direcciones locales o redes privadas internas.'
    );
  }

  if (!cleanPath) {
    return parsedBase.toString();
  }

  if (/^https?:\/\//i.test(cleanPath)) {
    const parsedFull = new URL(cleanPath);
    if (parsedFull.origin !== parsedBase.origin) {
      throw new Error('El endpoint debe pertenecer al mismo dominio base configurado.');
    }
    return parsedFull.toString();
  }

  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return new URL(normalizedPath, parsedBase.origin).toString();
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec) || 32));
}

async function fetchAndExtractWebPage(rawUrl: string): Promise<{
  url: string;
  title: string;
  description: string;
  extractedText: string;
  headings: string[];
  links: Array<{ text: string; url: string }>;
  wordCount: number;
}> {
  const withProto = /^https?:\/\//i.test(rawUrl.trim())
    ? rawUrl.trim()
    : `https://${rawUrl.trim()}`;
  const safeUrl = resolveSafeAppUrl(withProto, '');

  const upstream = await fetch(safeUrl, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; OpenJarvisReader/1.0; +https://openjarvis.studio)',
      Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!upstream.ok) {
    throw new Error(`La página devolvió HTTP ${upstream.status}.`);
  }

  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
  const rawBody = await upstream.text();

  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    const cleanText = rawBody.trim().slice(0, 18000);
    return {
      url: safeUrl,
      title: safeUrl,
      description: 'Documento de texto o JSON',
      extractedText: cleanText,
      headings: [],
      links: [],
      wordCount: cleanText ? cleanText.split(/\s+/).length : 0,
    };
  }

  const titleMatch = rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeHtmlEntities((titleMatch?.[1] || safeUrl).replace(/\s+/g, ' ').trim()).slice(0, 200);

  const descMatch =
    rawBody.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ||
    rawBody.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
  const description = decodeHtmlEntities((descMatch?.[1] || '').replace(/\s+/g, ' ').trim()).slice(0, 400);

  const headings: string[] = [];
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = headingRegex.exec(rawBody)) !== null && headings.length < 18) {
    const cleaned = decodeHtmlEntities(hMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (cleaned.length >= 2) headings.push(cleaned.slice(0, 160));
  }

  const links: Array<{ text: string; url: string }> = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let lMatch: RegExpExecArray | null;
  const seenUrls = new Set<string>();
  while ((lMatch = linkRegex.exec(rawBody)) !== null && links.length < 25) {
    const href = (lMatch[1] || '').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    try {
      const absUrl = new URL(href, safeUrl).toString();
      if (!/^https?:\/\//i.test(absUrl) || seenUrls.has(absUrl)) continue;
      seenUrls.add(absUrl);
      const linkText = decodeHtmlEntities(lMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      links.push({
        text: (linkText || absUrl).slice(0, 100),
        url: absUrl,
      });
    } catch {
      // ignore invalid href
    }
  }

  const stripped = rawBody
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const normalized = decodeHtmlEntities(stripped)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
    .slice(0, 18000);

  return {
    url: safeUrl,
    title,
    description,
    extractedText: normalized,
    headings,
    links,
    wordCount: normalized ? normalized.split(/\s+/).length : 0,
  };
}

function mapThinkingLevel(level?: string): ThinkingLevel {
  if (level === 'HIGH') return ThinkingLevel.HIGH;
  if (level === 'LOW') return ThinkingLevel.LOW;
  return ThinkingLevel.MEDIUM;
}

interface ParsedApiError {
  statusCode: number;
  apiStatus?: string;
  userMessage: string;
}

function parseGeminiError(err: unknown): ParsedApiError {
  const raw = err instanceof Error ? err.message : String(err || 'Error desconocido');
  let code = 500;
  let apiStatus = '';
  let innerMsg = raw;

  try {
    const jsonStart = raw.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error) {
        code = parsed.error.code || code;
        apiStatus = parsed.error.status || '';
        innerMsg = parsed.error.message || innerMsg;
      }
    }
  } catch {
    // not JSON, inspect plain text
  }

  const lower = `${raw} ${innerMsg} ${apiStatus}`.toLowerCase();
  if (code === 503 || lower.includes('unavailable') || lower.includes('high demand')) {
    return {
      statusCode: 503,
      apiStatus: 'UNAVAILABLE',
      userMessage:
        'El modelo está experimentando un pico temporal de demanda (503). Se reintentó automáticamente, pero sigue saturado. Intenta de nuevo en unos segundos.',
    };
  }
  if (code === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      statusCode: 429,
      apiStatus: 'RESOURCE_EXHAUSTED',
      userMessage:
        'Se alcanzó el límite temporal de solicitudes (429). Espera unos segundos antes de volver a intentarlo.',
    };
  }
  if (
    code === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('api key not valid')
  ) {
    return {
      statusCode: code === 403 ? 403 : 400,
      apiStatus: apiStatus || 'INVALID_ARGUMENT',
      userMessage:
        'No se pudo validar la clave de API de Gemini. Revisa tu configuración en Settings > Secrets.',
    };
  }

  return {
    statusCode: code >= 400 && code < 600 ? code : 500,
    apiStatus,
    userMessage: innerMsg,
  };
}

function isRetryableError(err: unknown): boolean {
  const parsed = parseGeminiError(err);
  if (parsed.statusCode === 503 || parsed.statusCode === 429) return true;
  const raw = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    raw.includes('timeout') ||
    raw.includes('econnreset') ||
    raw.includes('etimedout') ||
    raw.includes('fetch failed') ||
    raw.includes('503') ||
    raw.includes('unavailable')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${timeoutMs}ms) esperando respuesta de ${label}.`));
    }, timeoutMs);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

const modelCooldownUntil = new Map<string, number>();

async function callWithRetryAndFallback<T>(
  modelConfigs: Array<{ model: string; retries: number; timeoutMs: number }>,
  invoker: (model: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  let lastError: unknown;
  const now = Date.now();

  const activeConfigs = modelConfigs.filter(
    (c) => (modelCooldownUntil.get(c.model) ?? 0) <= now
  );
  const orderedConfigs =
    activeConfigs.length > 0 ? activeConfigs : modelConfigs;

  for (const { model, retries, timeoutMs } of orderedConfigs) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await withTimeout(invoker(model), timeoutMs, model);
        modelCooldownUntil.delete(model);
        return { result, modelUsed: model };
      } catch (err) {
        lastError = err;
        if (!isRetryableError(err)) {
          throw err;
        }
        const isLastAttemptForModel = attempt === retries - 1;
        if (!isLastAttemptForModel) {
          const delayMs = 350 * (attempt + 1);
          console.log(
            `[OpenJarvis retry] ${model} intento ${attempt + 1}/${retries}; reintentando en ${delayMs}ms.`
          );
          await sleep(delayMs);
        } else {
          // Put overloaded/timed-out model in 60s cooldown so next requests respond immediately
          modelCooldownUntil.set(model, Date.now() + 60_000);
          console.log(
            `[OpenJarvis fallback] Conmutando desde ${model} al siguiente modelo disponible (enfriamiento 60s).`
          );
        }
      }
    }
  }

  throw lastError;
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'openjarvis-studio',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // OpenJarvis Chat + Tool Execution + Optional Grounding
  app.post('/api/jarvis/chat', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        message,
        history = [],
        preset = 'chat-simple',
        systemPrompt = '',
        thinkingLevel = 'LOW',
        usesSearch = false,
        memories = [],
        publishedApps = [],
        connectedApps = [],
        routerProfiles = [],
        activeVoice = 'Charon',
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        message: string;
        history?: ChatHistoryInput[];
        preset?: string;
        systemPrompt?: string;
        thinkingLevel?: string;
        usesSearch?: boolean;
        memories?: MemoryItemInput[];
        publishedApps?: PublishedAppContextInput[];
        connectedApps?: ConnectedAppContextInput[];
        routerProfiles?: RouterProfileContextInput[];
        activeVoice?: string;
        engineRoute?: string;
      };

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
        return;
      }

      const ai = getAiClient();

      const memorySummary =
        memories.length > 0
          ? memories.map((m) => `- [${m.category}] ${m.content}`).join('\n')
          : 'Sin entradas guardadas aún.';

      const appsSummaryLines: string[] = [];
      if (publishedApps.length > 0) {
        appsSummaryLines.push(
          'Aplicaciones publicadas (/p/:slug):\n' +
            publishedApps
              .map(
                (a) =>
                  `- ${a.title} (slug: ${a.slug}, estado: ${a.status}): ${a.summary}`
              )
              .join('\n')
        );
      }
      if (connectedApps.length > 0) {
        appsSummaryLines.push(
          'Aplicaciones conectadas:\n' +
            connectedApps
              .map(
                (c) =>
                  `- ${c.name} (id: ${c.id}, tipo: ${c.appType}, url: ${c.baseUrl}, estado: ${c.status}, salud: ${c.lastCheckStatus}): ${c.description}`
              )
              .join('\n')
        );
      }
      if (routerProfiles.length > 0) {
        appsSummaryLines.push(
          'Routers registrados:\n' +
            routerProfiles
              .map(
                (r) =>
                  `- ${r.name} (marca: ${r.vendor}, estado: ${r.connectionStatus}, salud: ${r.lastDiagnosticHealth}, Wi-Fi: ${r.wifiName}, alcance: ${r.reachMode}, prioridad: ${r.priorityMode}, DNS: ${r.dnsProtection}): ${r.lastDiagnosticSummary || 'Sin diagnóstico previo'}`
              )
              .join('\n')
        );
      }
      const appsContext =
        appsSummaryLines.length > 0
          ? appsSummaryLines.join('\n')
          : 'Sin aplicaciones publicadas ni conectadas en esta sesión.';

      const fullSystemInstruction = [
        systemPrompt ||
          'Eres OpenJarvis, un asistente personal de IA modular inspirado en el proyecto open-jarvis/openjarvis.',
        `Preset activo: ${preset}. Estrategia de motor: ${engineRoute}. Voz activa del usuario: ${activeVoice}.`,
        `Memoria local disponible:\n${memorySummary}`,
        `Aplicaciones y routers del usuario disponibles para consultar o manejar:\n${appsContext}`,
        'Si el usuario te pide recordar algo, usa save_memory. Si pide cambiar de voz, usa switch_voice. Si pide cambiar de preset, usa switch_preset. Si pide listar, pausar, activar, revisar o ejecutar comandos en sus aplicaciones publicadas o conectadas, usa list_user_apps, toggle_app_status o execute_connected_app. Si pregunta por su router o red Wi-Fi, explícale usando términos simples basados en el perfil de router registrado.',
        'Mantén las respuestas claras, bien estructuradas y agradables para leerse en voz alta cuando la lectura automática esté activada.',
      ].join('\n\n');

      const contents: Content[] = history.slice(-12).map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }],
      }));
      contents.push({
        role: 'user',
        parts: [{ text: message.trim() }],
      });

      const functionDeclarations = [
        saveMemoryTool,
        searchMemoryTool,
        switchVoiceTool,
        switchPresetTool,
        listUserAppsTool,
        toggleAppStatusTool,
        executeConnectedAppTool,
        readWebPageTool,
      ];

      const tools: Array<Record<string, unknown>> = [{ functionDeclarations }];
      if (usesSearch) {
        tools.unshift({ googleSearch: {} });
      }

      const buildConfigForModel = (model: string): Record<string, unknown> => {
        const cfg: Record<string, unknown> = {
          systemInstruction: fullSystemInstruction,
          tools,
        };
        if (model === 'gemini-4-hydrogen') {
          cfg.thinkingConfig = { thinkingLevel: mapThinkingLevel(thinkingLevel) };
        }
        if (usesSearch) {
          cfg.toolConfig = { includeServerSideToolInvocations: true };
        }
        return cfg;
      };

      const chatModelChain =
        engineRoute === 'low-latency-edge'
          ? [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 10000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 10000 },
            ]
          : engineRoute === 'cloud-reasoning'
            ? [
                { model: 'gemini-4-hydrogen', retries: 2, timeoutMs: 14000 },
                { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 10000 },
              ]
            : [
                { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 6500 },
                { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 10000 },
              ];

      let { result: response, modelUsed } = await callWithRetryAndFallback(
        chatModelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents,
            config: buildConfigForModel(model),
          })
      );

      const toolsUsed: string[] = [];
      const addedMemories: Array<{ category: string; content: string }> = [];
      const appStatusUpdates: Array<{
        kind: 'published' | 'connected';
        identifier: string;
        status: 'active' | 'paused';
      }> = [];
      let nextVoice: string | undefined;
      let nextVoiceStyle: string | undefined;
      let nextPreset: string | undefined;

      let totalPromptTokens = response.usageMetadata?.promptTokenCount ?? 0;
      let totalOutputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

      // Multi-turn tool execution loop (max 3 rounds)
      let currentContents = [...contents];
      for (let round = 0; round < 3; round++) {
        const calls = response.functionCalls;
        if (!calls || calls.length === 0) break;

        const previousContent = response.candidates?.[0]?.content;
        if (!previousContent) break;

        const functionResponses = await Promise.all(
          calls.map(async (call) => {
            const name = call.name || 'unknown';
            toolsUsed.push(name);
            const args = (call.args || {}) as Record<string, unknown>;

          if (name === 'save_memory') {
            const category = String(args.category || 'contexto');
            const content = String(args.content || '').trim();
            if (content) {
              addedMemories.push({ category, content });
            }
            return {
              functionResponse: {
                id: call.id,
                name,
                response: {
                  saved: Boolean(content),
                  category,
                  content,
                },
              },
            };
          }

          if (name === 'search_memory') {
            const q = String(args.query || '').toLowerCase();
            const matches = memories.filter(
              (m) =>
                m.content.toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q)
            );
            return {
              functionResponse: {
                id: call.id,
                name,
                response: {
                  matches: matches.map((m) => ({
                    category: m.category,
                    content: m.content,
                  })),
                },
              },
            };
          }

          if (name === 'switch_voice') {
            const requested = String(args.voiceId || '');
            const matched = VALID_VOICES.find(
              (v) => v.toLowerCase() === requested.toLowerCase()
            );
            if (matched) {
              nextVoice = matched;
              if (args.style) {
                nextVoiceStyle = String(args.style);
              }
            }
            return {
              functionResponse: {
                id: call.id,
                name,
                response: {
                  success: Boolean(matched),
                  activeVoice: matched ?? activeVoice,
                  availableVoices: VALID_VOICES,
                },
              },
            };
          }

          if (name === 'switch_preset') {
            const requested = String(args.presetId || '');
            const matched = VALID_PRESETS.find(
              (p) => p.toLowerCase() === requested.toLowerCase()
            );
            if (matched) {
              nextPreset = matched;
            }
            return {
              functionResponse: {
                id: call.id,
                name,
                response: {
                  success: Boolean(matched),
                  activePreset: matched ?? preset,
                },
              },
            };
          }

          if (name === 'list_user_apps') {
            const filter = String(args.filter || 'all').toLowerCase();
            return {
              functionResponse: {
                id: call.id,
                name,
                response: {
                  publishedApps:
                    filter === 'connected'
                      ? []
                      : publishedApps.filter((a) =>
                          filter === 'active' || filter === 'paused'
                            ? a.status === filter
                            : true
                        ),
                  connectedApps:
                    filter === 'published'
                      ? []
                      : connectedApps.filter((c) =>
                          filter === 'active' || filter === 'paused'
                            ? c.status === filter
                            : true
                        ),
                },
              },
            };
          }

          if (name === 'toggle_app_status') {
            const kind =
              String(args.kind || '').toLowerCase() === 'published'
                ? 'published'
                : 'connected';
            const identifier = String(args.identifier || '').trim();
            const newStatus =
              String(args.status || '').toLowerCase() === 'paused'
                ? 'paused'
                : 'active';

            let matchedId: string | null = null;
            let matchedLabel: string | null = null;

            if (kind === 'published') {
              const found = publishedApps.find(
                (a) =>
                  a.slug.toLowerCase() === identifier.toLowerCase() ||
                  a.title.toLowerCase().includes(identifier.toLowerCase())
              );
              if (found) {
                matchedId = found.slug;
                matchedLabel = found.title;
              }
            } else {
              const found = connectedApps.find(
                (c) =>
                  c.id.toLowerCase() === identifier.toLowerCase() ||
                  c.name.toLowerCase().includes(identifier.toLowerCase())
              );
              if (found) {
                matchedId = found.id;
                matchedLabel = found.name;
              }
            }

            if (matchedId) {
              appStatusUpdates.push({
                kind,
                identifier: matchedId,
                status: newStatus,
              });
            }

            return {
              functionResponse: {
                id: call.id,
                name,
                response: {
                  updated: Boolean(matchedId),
                  kind,
                  identifier: matchedId,
                  label: matchedLabel,
                  status: newStatus,
                },
              },
            };
          }

          if (name === 'execute_connected_app') {
            const queryName = String(args.appNameOrId || '').trim().toLowerCase();
            const target = connectedApps.find(
              (c) =>
                c.id.toLowerCase() === queryName ||
                c.name.toLowerCase().includes(queryName)
            );
            if (!target) {
              return {
                functionResponse: {
                  id: call.id,
                  name,
                  response: {
                    ok: false,
                    error: `No se encontró ninguna aplicación conectada llamada "${args.appNameOrId}".`,
                  },
                },
              };
            }
            if (target.status === 'paused') {
              return {
                functionResponse: {
                  id: call.id,
                  name,
                  response: {
                    ok: false,
                    error: `La aplicación "${target.name}" está pausada. Actívala antes de enviar comandos.`,
                  },
                },
              };
            }
            try {
              const targetUrl = resolveSafeAppUrl(
                target.baseUrl,
                String(args.endpointPath || target.healthPath || '')
              );
              const method =
                String(args.method || target.defaultMethod || 'GET').toUpperCase() ===
                'POST'
                  ? 'POST'
                  : 'GET';
              const reqInit: RequestInit = {
                method,
                signal: AbortSignal.timeout(8000),
                headers: { Accept: 'application/json, text/plain, text/html' },
              };
              if (method === 'POST' && args.payloadJson) {
                reqInit.headers = {
                  ...reqInit.headers,
                  'Content-Type': 'application/json',
                };
                reqInit.body = String(args.payloadJson);
              }
              const t0 = Date.now();
              const upstream = await fetch(targetUrl, reqInit);
              const bodySnippet = (await upstream.text()).slice(0, 2000);
              return {
                functionResponse: {
                  id: call.id,
                  name,
                  response: {
                    ok: upstream.ok,
                    httpStatus: upstream.status,
                    latencyMs: Date.now() - t0,
                    url: targetUrl,
                    bodySnippet,
                  },
                },
              };
            } catch (execErr) {
              return {
                functionResponse: {
                  id: call.id,
                  name,
                  response: {
                    ok: false,
                    error:
                      execErr instanceof Error
                        ? execErr.message
                        : 'Error conectando con la aplicación.',
                  },
                },
              };
            }
          }

          if (name === 'read_web_page') {
            const url = String(args.url || '').trim();
            if (!url) {
              return {
                functionResponse: {
                  id: call.id,
                  name,
                  response: { ok: false, error: 'Se requiere una URL válida.' },
                },
              };
            }
            try {
              const extracted = await fetchAndExtractWebPage(url);
              return {
                functionResponse: {
                  id: call.id,
                  name,
                  response: {
                    ok: true,
                    url: extracted.url,
                    title: extracted.title,
                    description: extracted.description,
                    headings: extracted.headings.slice(0, 10),
                    contentSnippet: extracted.extractedText.slice(0, 7000),
                  },
                },
              };
            } catch (webErr) {
              return {
                functionResponse: {
                  id: call.id,
                  name,
                  response: {
                    ok: false,
                    error:
                      webErr instanceof Error
                        ? webErr.message
                        : 'No se pudo leer la página web.',
                  },
                },
              };
            }
          }

          return {
            functionResponse: {
              id: call.id,
              name,
              response: { error: `Herramienta desconocida: ${name}` },
            },
          };
          })
        );

        currentContents = [
          ...currentContents,
          previousContent,
          {
            role: 'user',
            parts: functionResponses,
          },
        ];

        const orderedRoundChain = [
          ...chatModelChain.filter((c) => c.model === modelUsed),
          ...chatModelChain.filter((c) => c.model !== modelUsed),
        ];
        const nextRound = await callWithRetryAndFallback(
          orderedRoundChain,
          (model) =>
            ai.models.generateContent({
              model,
              contents: currentContents,
              config: buildConfigForModel(model),
            })
        );
        response = nextRound.result;
        modelUsed = nextRound.modelUsed;

        totalPromptTokens += response.usageMetadata?.promptTokenCount ?? 0;
        totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;
      }

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = groundingChunks
        .map((chunk) => {
          const web = (chunk as { web?: { title?: string; uri?: string } }).web;
          if (web?.uri) {
            return {
              title: web.title || web.uri,
              uri: web.uri,
            };
          }
          return null;
        })
        .filter((s): s is { title: string; uri: string } => s !== null);

      if (sources.length > 0 && !toolsUsed.includes('google_search')) {
        toolsUsed.push('google_search');
      }

      const latencyMs = Date.now() - startTime;
      const text =
        response.text?.trim() ||
        'No pude generar una respuesta de texto en esta iteración.';

      res.json({
        text,
        model: modelUsed,
        latencyMs,
        promptTokens: totalPromptTokens,
        outputTokens: totalOutputTokens,
        toolsUsed: Array.from(new Set(toolsUsed)),
        sources,
        addedMemories,
        appStatusUpdates,
        nextVoice,
        nextVoiceStyle,
        nextPreset,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      console.error('[/api/jarvis/chat] error:', err);
      res.status(parsed.statusCode).json({
        error: parsed.userMessage,
        code: parsed.statusCode,
        status: parsed.apiStatus,
      });
    }
  });

  // OpenJarvis Neural Voice Synthesis (TTS)
  app.post('/api/jarvis/tts', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        text,
        voiceName = 'Charon',
        style = '',
        ttsModel = 'gemini-3.8-flash-lite-tts',
      } = req.body as {
        text: string;
        voiceName?: string;
        style?: string;
        ttsModel?: string;
      };

      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Se requiere texto para sintetizar audio.' });
        return;
      }

      const selectedVoice = VALID_VOICES.includes(
        voiceName as (typeof VALID_VOICES)[number]
      )
        ? voiceName
        : 'Charon';

      const selectedModel =
        ttsModel === 'gemini-3.8-flash-tts'
          ? 'gemini-3.8-flash-tts'
          : 'gemini-3.8-flash-lite-tts';

      const cleanTextForSpeech = (raw: string, maxChars = 1400): string => {
        const stripped = raw
          .replace(/```[\s\S]*?```/g, ' bloque de código omitido en lectura. ')
          .replace(/[#*_`>]/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\s+/g, ' ')
          .trim();
        if (stripped.length <= maxChars) return stripped;
        const slice = stripped.slice(0, maxChars);
        const lastPunct = Math.max(
          slice.lastIndexOf('. '),
          slice.lastIndexOf('! '),
          slice.lastIndexOf('? ')
        );
        return lastPunct > 200 ? slice.slice(0, lastPunct + 1) : slice;
      };

      const cleanedText = cleanTextForSpeech(text, 1400);

      const ai = getAiClient('v1beta');

      const part: Record<string, unknown> = {
        text: cleanedText,
      };
      if (style && style.trim()) {
        part.speechMetadata = {
          style: style.trim(),
        };
      }

      const alternateTtsModel =
        selectedModel === 'gemini-3.8-flash-lite-tts'
          ? 'gemini-3.8-flash-tts'
          : 'gemini-3.8-flash-lite-tts';

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        [
          { model: selectedModel, retries: 1, timeoutMs: 25000 },
          { model: alternateTtsModel, retries: 1, timeoutMs: 25000 },
        ],
        (model) =>
          ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [part],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          })
      );

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error: 'El modelo TTS no devolvió datos de audio en la respuesta.',
        });
        return;
      }

      const latencyMs = Date.now() - startTime;
      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        voiceName: selectedVoice,
        model: modelUsed,
        latencyMs,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      console.error('[/api/jarvis/tts] error:', err);
      res.status(parsed.statusCode).json({
        error: parsed.userMessage,
        code: parsed.statusCode,
        status: parsed.apiStatus,
      });
    }
  });

  // OpenJarvis Progressive Streaming Neural TTS (SSE raw PCM 24kHz)
  app.post('/api/jarvis/tts-stream', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        text,
        voiceName = 'Charon',
        style = '',
        ttsModel = 'gemini-3.8-flash-lite-tts',
      } = req.body as {
        text: string;
        voiceName?: string;
        style?: string;
        ttsModel?: string;
      };

      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Se requiere texto para sintetizar audio.' });
        return;
      }

      const selectedVoice = VALID_VOICES.includes(
        voiceName as (typeof VALID_VOICES)[number]
      )
        ? voiceName
        : 'Charon';

      const selectedModel =
        ttsModel === 'gemini-3.8-flash-tts'
          ? 'gemini-3.8-flash-tts'
          : 'gemini-3.8-flash-lite-tts';

      const alternateTtsModel =
        selectedModel === 'gemini-3.8-flash-lite-tts'
          ? 'gemini-3.8-flash-tts'
          : 'gemini-3.8-flash-lite-tts';

      const stripped = text
        .replace(/```[\s\S]*?```/g, ' bloque de código omitido en lectura. ')
        .replace(/[#*_`>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      const cleanedText =
        stripped.length > 1400
          ? (() => {
              const s = stripped.slice(0, 1400);
              const idx = Math.max(
                s.lastIndexOf('. '),
                s.lastIndexOf('! '),
                s.lastIndexOf('? ')
              );
              return idx > 200 ? s.slice(0, idx + 1) : s;
            })()
          : stripped;

      const ai = getAiClient('v1beta');
      const part: Record<string, unknown> = { text: cleanedText };
      if (style && style.trim()) {
        part.speechMetadata = { style: style.trim() };
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      let clientDisconnected = false;
      res.on('close', () => {
        if (!res.writableFinished) {
          clientDisconnected = true;
        }
      });

      const sendEvent = (payload: Record<string, unknown>) => {
        if (!clientDisconnected && !res.writableEnded) {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
      };

      let succeeded = false;
      let lastError: unknown;

      for (const model of [selectedModel, alternateTtsModel]) {
        if (clientDisconnected) break;
        try {
          const stream = await withTimeout(
            ai.models.generateContentStream({
              model,
              contents: [{ role: 'user', parts: [part] }],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: selectedVoice },
                  },
                },
              },
            }),
            9000,
            model
          );

          let chunkCount = 0;
          let promptTokens = 0;
          let outputTokens = 0;

          for await (const chunk of stream) {
            if (clientDisconnected) break;
            if (chunk.usageMetadata) {
              promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
              outputTokens =
                chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
            }
            const data =
              chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (data) {
              chunkCount++;
              sendEvent({ pcmBase64: data, model });
            }
          }

          if (chunkCount === 0 && !clientDisconnected) {
            throw new Error(`El modelo ${model} no emitió chunks de audio.`);
          }

          sendEvent({
            done: true,
            model,
            voiceName: selectedVoice,
            latencyMs: Date.now() - startTime,
            promptTokens,
            outputTokens,
          });
          succeeded = true;
          break;
        } catch (err) {
          lastError = err;
          console.log(
            `[OpenJarvis tts-stream] Conmutando desde ${model}: ${err instanceof Error ? err.message : 'error transitorio'}`
          );
        }
      }

      if (!succeeded && !clientDisconnected) {
        const parsed = parseGeminiError(lastError);
        sendEvent({ error: parsed.userMessage, code: parsed.statusCode });
      }

      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      const parsed = parseGeminiError(err);
      console.error('[/api/jarvis/tts-stream] error:', err);
      if (!res.headersSent) {
        res.status(parsed.statusCode).json({ error: parsed.userMessage });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: parsed.userMessage })}\n\n`);
        res.end();
      }
    }
  });

  // OpenJarvis Audio Transcription (STT)
  app.post('/api/jarvis/transcribe', async (req, res) => {
    const startTime = Date.now();
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body as {
        audioBase64: string;
        mimeType?: string;
      };

      if (!audioBase64) {
        res.status(400).json({ error: 'Falta el audio grabado para transcribir.' });
        return;
      }

      const ai = getAiClient();
      const { result: response, modelUsed } = await callWithRetryAndFallback(
        [{ model: 'gemini-3.5-transcribe', retries: 2, timeoutMs: 15000 }],
        (model) =>
          ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
                {
                  text: 'Transcribe este audio con exactitud en su idioma original. Devuelve únicamente el texto transcrito, sin comillas ni explicaciones adicionales.',
                },
              ],
            },
          })
      );

      const latencyMs = Date.now() - startTime;
      res.json({
        text: (response.text ?? '').trim(),
        model: modelUsed,
        latencyMs,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      console.error('[/api/jarvis/transcribe] error:', err);
      res.status(parsed.statusCode).json({
        error: parsed.userMessage,
        code: parsed.statusCode,
        status: parsed.apiStatus,
      });
    }
  });

  // OpenJarvis Prompt-to-App Generator (with Anti-AI Editorial Design Constitution)
  app.post('/api/jarvis/generate-app', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        prompt,
        currentHtml = '',
        designStyle = 'editorial-suiza',
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        prompt: string;
        currentHtml?: string;
        designStyle?: string;
        engineRoute?: string;
      };

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Describe la aplicación que quieres crear.' });
        return;
      }

      const ai = getAiClient();

      const designDirectionMap: Record<string, string> = {
        'editorial-suiza':
          'Dirección de arte EDITORIAL SUIZA: fondo papel cálido (#FAFAF8) o blanco puro (#FFFFFF), tinta grafito (#111827), un único acento azul cobalto (#1D4ED8), tipografía Plus Jakarta Sans + DM Sans + JetBrains Mono vía Google Fonts, rejilla asimétrica estricta, líneas finas de 1px (#E5E7EB), sin sombras pesadas ni gradientes.',
        'revista-lujo':
          'Dirección de arte REVISTA / LUJO SILENCIOSO: fondo marfil suave (#F7F5F0), tinta negro carbón (#141413), acento verde bosque profundo (#14532D) o borgoña sobrio (#7F1D1D), tipografía Fraunces / Playfair Display en titulares y Source Serif 4 / DM Sans en cuerpo, espaciado generoso y jerarquía editorial limpia.',
        'producto-saas':
          'Dirección de arte PRODUCTO SAAS SOBRIO: superficie neutra (#F8FAFC / #FFFFFF), bordes nítidos de 1px (#E2E8F0), tipografía Manrope + Public Sans + JetBrains Mono con tabular-nums obligatorio en métricas, tablas de alta legibilidad, máxima 1 elevación y 1 único botón primario de alto contraste.',
        'estudio-creativo':
          'Dirección de arte ESTUDIO CREATIVO CONTEMPORÁNEO: contraste editorial claro u oscuro refinado (#0F1115 o #F4F4F0), tipografía Outfit + DM Sans, bloques asimétricos tipo Bento con líneas divisorias precisas, cero neones cian/magenta y cero clichés futuristas.',
      };

      const selectedDirection =
        designDirectionMap[designStyle] || designDirectionMap['editorial-suiza'];

      const appBuilderInstruction = [
        'Eres un director de arte senior y arquitecto frontend humano en OpenJarvis.',
        'Genera una aplicación web HTML5 completa, funcional e interactiva en un único documento autocontenido (<!doctype html>...</html>).',
        selectedDirection,
        'REGLAS ESTRICTAS ANTI-DISEÑO DE IA (OBLIGATORIAS):',
        '- Carga fuentes reales desde Google Fonts en el <head> acorde a la dirección de arte (PROHIBIDO usar Inter, Roboto o fuentes genéricas por defecto).',
        '- PROHIBIDO usar gradientes morados/violetas/neón, brillos cyberpunk, fondos borrosos excesivos o tarjetas dentro de tarjetas.',
        '- PROHIBIDO llenar tarjetas o encabezados con cápsulas/pills redondeadas de colores (rounded-full px-2 py-0.5), prefijos falsos tipo "// 01_" o ">_", puntos parpadeantes decorativos (animate-pulse), bordes gruesos laterales (border-l-4) o puntajes falsos tipo "94/100 AI SCORE".',
        '- Usa metadatos limpios como texto plano con separadores tipográficos ("·" o "/"), cifras tabulares (font-variant-numeric: tabular-nums), regla de color 60-30-10 y espacios en blanco generosos.',
        '- Usa Tailwind CSS vía CDN (<script src="https://cdn.tailwindcss.com"></script>) y JavaScript moderno limpio en <script> para que toda la interactividad funcione al instante.',
        '- No uses alert() ni confirm() del navegador ni URLs de imágenes externas rotas (usa SVG limpio o diseño tipográfico). Idioma: español por defecto.',
      ].join('\n');

      const userContent = currentHtml.trim()
        ? `Aplica las siguientes mejoras o cambios manteniendo el diseño profesional humano sin clichés de IA:\n\nSOLICITUD:\n${prompt.trim()}\n\nCÓDIGO HTML ACTUAL:\n${currentHtml.slice(0, 80000)}`
        : `Crea una aplicación web completa y funcional con diseño editorial humano profesional basada en este prompt:\n\n${prompt.trim()}`;

      const modelChain =
        engineRoute === 'low-latency-edge'
          ? [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 25000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 25000 },
            ]
          : [
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 25000 },
            ];

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: userContent,
            config: {
              systemInstruction: appBuilderInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: 'Título corto y claro de la aplicación.',
                  },
                  summary: {
                    type: Type.STRING,
                    description: 'Resumen breve en 1 frase de lo que hace la aplicación.',
                  },
                  suggestedSlug: {
                    type: Type.STRING,
                    description:
                      'Identificador URL corto en minúsculas y guiones (ej. gestor-gastos-pro).',
                  },
                  htmlCode: {
                    type: Type.STRING,
                    description:
                      'Documento HTML5 completo y ejecutable empezando por <!doctype html>.',
                  },
                },
                required: ['title', 'summary', 'suggestedSlug', 'htmlCode'],
              },
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
      );

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as {
        title?: string;
        summary?: string;
        suggestedSlug?: string;
        htmlCode?: string;
      };

      if (!parsed.htmlCode || parsed.htmlCode.length < 20) {
        throw new Error('No se pudo generar el código HTML de la aplicación.');
      }

      const cleanSlug = (parsed.suggestedSlug || parsed.title || 'mi-app')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

      res.json({
        title: (parsed.title || 'Aplicación OpenJarvis').slice(0, 120),
        summary: (
          parsed.summary || 'Aplicación web generada a partir de prompt.'
        ).slice(0, 300),
        suggestedSlug:
          cleanSlug.length >= 3
            ? `${cleanSlug}-${Math.random().toString(36).slice(2, 6)}`
            : `app-${Math.random().toString(36).slice(2, 7)}`,
        htmlCode: parsed.htmlCode,
        model: modelUsed,
        latencyMs: Date.now() - startTime,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      console.error('[/api/jarvis/generate-app] error:', err);
      res.status(parsed.statusCode).json({
        error: parsed.userMessage,
        code: parsed.statusCode,
        status: parsed.apiStatus,
      });
    }
  });

  // Connected Apps Live Health Check & Command Dispatch Proxy
  app.post('/api/jarvis/apps/ping', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        baseUrl,
        healthPath = '',
        authHeaderName = '',
        authHeaderValue = '',
      } = req.body as {
        baseUrl: string;
        healthPath?: string;
        authHeaderName?: string;
        authHeaderValue?: string;
      };

      const targetUrl = resolveSafeAppUrl(baseUrl, healthPath);
      const headers: Record<string, string> = {
        Accept: 'application/json, text/html, text/plain',
      };
      if (authHeaderName.trim() && authHeaderValue.trim()) {
        headers[authHeaderName.trim()] = authHeaderValue.trim();
      }

      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000),
      });

      const latencyMs = Date.now() - startTime;
      const snippet = (await upstream.text()).slice(0, 800);

      res.json({
        ok: true,
        online: upstream.ok,
        httpStatus: upstream.status,
        latencyMs,
        contentType: upstream.headers.get('content-type') || '',
        snippet,
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      res.status(400).json({
        ok: false,
        online: false,
        httpStatus: 0,
        latencyMs,
        error:
          err instanceof Error
            ? err.message
            : 'No se pudo verificar la conexión con la aplicación.',
      });
    }
  });

  app.post('/api/jarvis/apps/dispatch', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        baseUrl,
        endpointPath = '',
        method = 'GET',
        bodyText = '',
        authHeaderName = '',
        authHeaderValue = '',
      } = req.body as {
        baseUrl: string;
        endpointPath?: string;
        method?: string;
        bodyText?: string;
        authHeaderName?: string;
        authHeaderValue?: string;
      };

      const targetUrl = resolveSafeAppUrl(baseUrl, endpointPath);
      const cleanMethod = String(method || 'GET').toUpperCase();
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(cleanMethod)) {
        res.status(400).json({ error: 'Método HTTP no permitido.' });
        return;
      }

      const headers: Record<string, string> = {
        Accept: 'application/json, text/plain, text/html',
      };
      if (authHeaderName.trim() && authHeaderValue.trim()) {
        headers[authHeaderName.trim()] = authHeaderValue.trim();
      }

      const fetchInit: RequestInit = {
        method: cleanMethod,
        headers,
        signal: AbortSignal.timeout(12000),
      };

      if ((cleanMethod === 'POST' || cleanMethod === 'PUT') && bodyText.trim()) {
        headers['Content-Type'] = 'application/json';
        fetchInit.body = bodyText;
      }

      const upstream = await fetch(targetUrl, fetchInit);
      const latencyMs = Date.now() - startTime;
      const responseText = (await upstream.text()).slice(0, 8000);

      res.json({
        ok: upstream.ok,
        httpStatus: upstream.status,
        latencyMs,
        contentType: upstream.headers.get('content-type') || '',
        bodyText: responseText,
        targetUrl,
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      res.status(400).json({
        ok: false,
        httpStatus: 0,
        latencyMs,
        error:
          err instanceof Error
            ? err.message
            : 'No se pudo ejecutar el comando en la aplicación.',
      });
    }
  });

  // Router Admin Connection & Detailed Plain-Language Diagnostics
  app.post('/api/jarvis/router/diagnose', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        name = 'Router Principal',
        vendor = 'openwrt',
        hostUrl = '',
        adminUsername = 'admin',
        adminPassword = '',
        authScheme = 'basic',
        probePath = '',
        diagnosticSnapshot = '',
        simplifiedConfig,
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        name?: string;
        vendor?: string;
        hostUrl?: string;
        adminUsername?: string;
        adminPassword?: string;
        authScheme?: string;
        probePath?: string;
        diagnosticSnapshot?: string;
        simplifiedConfig?: Record<string, unknown>;
        engineRoute?: string;
      };

      const cleanUrl = String(hostUrl || '').trim();
      let reachable = false;
      let httpStatus = 0;
      let probeLatencyMs = 0;
      let isPrivateLan = false;
      let liveNote = '';
      let capturedTelemetry = '';

      if (cleanUrl) {
        const withProtocol = /^https?:\/\//i.test(cleanUrl)
          ? cleanUrl
          : `http://${cleanUrl}`;
        try {
          const parsedUrl = new URL(withProtocol);
          if (isPrivateOrRestrictedHost(parsedUrl.hostname)) {
            isPrivateLan = true;
            liveNote = `La dirección ${parsedUrl.hostname} pertenece a una red local privada. Desde un servidor en la nube no es alcanzable sin un túnel HTTPS o DDNS; puedes pegar abajo el estado exportado de tu router para analizarlo igualmente.`;
          } else {
            const targetUrl = resolveSafeAppUrl(withProtocol, probePath);
            const headers = buildRouterAuthHeaders(
              authScheme,
              adminUsername,
              adminPassword
            );
            const t0 = Date.now();
            const upstream = await fetch(targetUrl, {
              method: 'GET',
              headers,
              signal: AbortSignal.timeout(8000),
            });
            probeLatencyMs = Date.now() - t0;
            httpStatus = upstream.status;
            reachable = upstream.ok;
            const bodySnippet = (await upstream.text()).slice(0, 4000);
            capturedTelemetry = `HTTP ${httpStatus} (${probeLatencyMs}ms) desde ${targetUrl}:\n${bodySnippet}`;
            liveNote = upstream.ok
              ? `Conectado con el router (HTTP ${httpStatus}) en ${probeLatencyMs} ms.`
              : `El router respondió HTTP ${httpStatus}. Verifica si la clave de admin, el usuario o el esquema de autenticación coinciden.`;
          }
        } catch (probeErr) {
          liveNote =
            probeErr instanceof Error
              ? `No se pudo contactar la URL del router: ${probeErr.message}`
              : 'No se pudo contactar la URL del router.';
        }
      } else {
        liveNote =
          'Modo sin URL remota: evaluando la configuración actual y cualquier reporte pegado.';
      }

      const ai = getAiClient();
      const diagnosticPrompt = [
        'Eres el especialista en redes domésticas y empresariales de OpenJarvis.',
        'Tu tarea es generar un DIAGNÓSTICO DETALLADO DE TODO el router explicado en términos muy claros y sencillos para cualquier persona sin conocimientos técnicos avanzados (y manteniendo una breve nota técnica secundaria por si la necesita).',
        'IMPORTANTE: No inventes velocidades en Mbps ni listas ficticias de dispositivos si no aparecen en la telemetría o captura real. Si falta telemetría directa de algún punto, indícalo con claridad y evalúa los riesgos y mejoras basándote en la configuración actual y el estado de conexión observado.',
        `Datos del router:\n- Nombre: ${name}\n- Marca/Sistema: ${vendor}\n- URL/Host: ${cleanUrl || 'No especificada'}\n- Estado de conexión observado: ${liveNote}`,
        `Configuración simplificada actual:\n${JSON.stringify(simplifiedConfig || {}, null, 2)}`,
        capturedTelemetry ? `Telemetría capturada en vivo:\n${capturedTelemetry}` : '',
        diagnosticSnapshot.trim()
          ? `Reporte o configuración pegada por el usuario:\n${diagnosticSnapshot.slice(0, 12000)}`
          : '',
        'Evalúa obligatoriamente estas 5 áreas en `areas`: 1) "Internet y Conexión", 2) "Wi-Fi y Cobertura", 3) "Dispositivos y Red Local", 4) "Seguridad y Clave de Admin", 5) "Rendimiento del Router".',
        'Sugiere entre 2 y 3 `quickFixes` accionables que modifiquen la configuración simplificada.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const modelChain =
        engineRoute === 'cloud-reasoning'
          ? [
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 25000 },
            ]
          : [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 25000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
            ];

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: diagnosticPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  overallHealth: {
                    type: Type.STRING,
                    enum: ['optimal', 'attention', 'critical'],
                    description: 'Estado general del router.',
                  },
                  overallTitle: {
                    type: Type.STRING,
                    description: 'Título breve del estado general del router.',
                  },
                  summary: {
                    type: Type.STRING,
                    description:
                      'Resumen claro y comprensible en 2-3 frases del estado completo del router.',
                  },
                  areas: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        area: { type: Type.STRING },
                        status: {
                          type: Type.STRING,
                          enum: ['optimal', 'attention', 'critical'],
                        },
                        headline: { type: Type.STRING },
                        plainExplanation: {
                          type: Type.STRING,
                          description: 'Explicación sencilla sin tecnicismos.',
                        },
                        technicalDetail: {
                          type: Type.STRING,
                          description: 'Dato técnico breve observado o a revisar.',
                        },
                        recommendation: {
                          type: Type.STRING,
                          description: 'Paso práctico recomendado.',
                        },
                      },
                      required: [
                        'area',
                        'status',
                        'headline',
                        'plainExplanation',
                        'technicalDetail',
                        'recommendation',
                      ],
                    },
                  },
                  quickFixes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        effectDescription: { type: Type.STRING },
                        reachMode: {
                          type: Type.STRING,
                          enum: ['balanced', 'max_speed', 'max_range'],
                        },
                        securityLevel: {
                          type: Type.STRING,
                          enum: ['wpa2_standard', 'wpa3_max', 'strict_isolated'],
                        },
                        priorityMode: {
                          type: Type.STRING,
                          enum: ['general', 'video_calls', 'gaming_low_latency', 'streaming_4k'],
                        },
                        dnsProtection: {
                          type: Type.STRING,
                          enum: ['isp_default', 'fast_private', 'family_safe'],
                        },
                        guestWifiEnabled: { type: Type.BOOLEAN },
                        autoOptimizeChannel: { type: Type.BOOLEAN },
                      },
                      required: ['label', 'effectDescription'],
                    },
                  },
                },
                required: ['overallHealth', 'overallTitle', 'summary', 'areas', 'quickFixes'],
              },
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        overallHealth?: 'optimal' | 'attention' | 'critical';
        overallTitle?: string;
        summary?: string;
        areas?: Array<Record<string, string>>;
        quickFixes?: Array<Record<string, unknown>>;
      };

      const validHealth = ['optimal', 'attention', 'critical'].includes(
        String(parsed.overallHealth)
      )
        ? (parsed.overallHealth as 'optimal' | 'attention' | 'critical')
        : 'attention';

      res.json({
        overallHealth: validHealth,
        overallTitle: parsed.overallTitle || 'Diagnóstico completado',
        summary: parsed.summary || liveNote,
        areas: Array.isArray(parsed.areas) ? parsed.areas : [],
        quickFixes: Array.isArray(parsed.quickFixes) ? parsed.quickFixes : [],
        connectionObserved: {
          reachable,
          httpStatus,
          latencyMs: probeLatencyMs,
          isPrivateLan,
          note: liveNote,
        },
        model: modelUsed,
        latencyMs: Date.now() - startTime,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      console.error('[/api/jarvis/router/diagnose] error:', err);
      res.status(parsed.statusCode).json({
        error: parsed.userMessage,
        code: parsed.statusCode,
        status: parsed.apiStatus,
      });
    }
  });

  // Router Simplified Configuration Translator & Generator
  app.post('/api/jarvis/router/simplify-config', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        vendor = 'openwrt',
        routerName = 'Router Principal',
        naturalRequest = '',
        simplifiedConfig = {},
        newWifiPassword = '',
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        vendor?: string;
        routerName?: string;
        naturalRequest?: string;
        simplifiedConfig?: Record<string, unknown>;
        newWifiPassword?: string;
        engineRoute?: string;
      };

      const ai = getAiClient();
      const prompt = [
        'Eres el traductor de configuración simplificada de routers de OpenJarvis.',
        'Recibes opciones en términos sencillos (o una solicitud en lenguaje cotidiano del usuario) y debes:',
        '1) Ajustar los valores de configuración simplificada coherentes con lo que pidió el usuario.',
        '2) Explicar en términos muy sencillos y humanos cada ajuste que se aplicará (sin siglas confusas).',
        `3) Generar los comandos o payload exacto listo para el router de tipo "${vendor}" (OpenWrt UCI, MikroTik RouterOS, JSON REST para APIs genéricas, o pasos claros para menús web de Asus/TP-Link/Manual).`,
        newWifiPassword.trim()
          ? `Nota: El usuario proporcionó una nueva contraseña Wi-Fi temporal ("${newWifiPassword.trim()}") para incluir en el script/payload generado.`
          : 'Nota: No cambies la contraseña Wi-Fi en el script a menos que ya exista o indica mantener la actual.',
        `Router: ${routerName} (${vendor})`,
        `Configuración simplificada actual:\n${JSON.stringify(simplifiedConfig, null, 2)}`,
        naturalRequest.trim()
          ? `Petición en lenguaje natural del usuario:\n"${naturalRequest.trim()}"`
          : 'Genera la explicación y el script/payload para la configuración simplificada actual.',
      ].join('\n\n');

      const modelChain =
        engineRoute === 'cloud-reasoning'
          ? [
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 25000 },
            ]
          : [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 25000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
            ];

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  plainSummary: {
                    type: Type.STRING,
                    description: 'Explicación amigable de lo que cambiará en la red.',
                  },
                  updatedConfig: {
                    type: Type.OBJECT,
                    properties: {
                      wifiName: { type: Type.STRING },
                      reachMode: {
                        type: Type.STRING,
                        enum: ['balanced', 'max_speed', 'max_range'],
                      },
                      securityLevel: {
                        type: Type.STRING,
                        enum: ['wpa2_standard', 'wpa3_max', 'strict_isolated'],
                      },
                      priorityMode: {
                        type: Type.STRING,
                        enum: ['general', 'video_calls', 'gaming_low_latency', 'streaming_4k'],
                      },
                      dnsProtection: {
                        type: Type.STRING,
                        enum: ['isp_default', 'fast_private', 'family_safe'],
                      },
                      guestWifiEnabled: { type: Type.BOOLEAN },
                      guestWifiName: { type: Type.STRING },
                      autoOptimizeChannel: { type: Type.BOOLEAN },
                    },
                    required: [
                      'wifiName',
                      'reachMode',
                      'securityLevel',
                      'priorityMode',
                      'dnsProtection',
                      'guestWifiEnabled',
                      'guestWifiName',
                      'autoOptimizeChannel',
                    ],
                  },
                  vendorCommands: {
                    type: Type.STRING,
                    description:
                      'Comandos listos (UCI/RouterOS) o JSON REST / guía paso a paso según la marca del router.',
                  },
                  restJsonPayload: {
                    type: Type.STRING,
                    description:
                      'Objeto JSON serializado en texto listo para enviarse por HTTP POST/PUT si el router expone API REST.',
                  },
                },
                required: [
                  'plainSummary',
                  'updatedConfig',
                  'vendorCommands',
                  'restJsonPayload',
                ],
              },
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        plainSummary?: string;
        updatedConfig?: Record<string, unknown>;
        vendorCommands?: string;
        restJsonPayload?: string;
      };

      const rawUpd = parsed.updatedConfig || {};
      const safeUpdatedConfig = {
        wifiName: String(rawUpd.wifiName || simplifiedConfig.wifiName || 'MiRedWiFi'),
        reachMode: ['balanced', 'max_speed', 'max_range'].includes(String(rawUpd.reachMode))
          ? String(rawUpd.reachMode)
          : String(simplifiedConfig.reachMode || 'balanced'),
        securityLevel: ['wpa2_standard', 'wpa3_max', 'strict_isolated'].includes(
          String(rawUpd.securityLevel)
        )
          ? String(rawUpd.securityLevel)
          : String(simplifiedConfig.securityLevel || 'wpa2_standard'),
        priorityMode: [
          'general',
          'video_calls',
          'gaming_low_latency',
          'streaming_4k',
        ].includes(String(rawUpd.priorityMode))
          ? String(rawUpd.priorityMode)
          : String(simplifiedConfig.priorityMode || 'general'),
        dnsProtection: ['isp_default', 'fast_private', 'family_safe'].includes(
          String(rawUpd.dnsProtection)
        )
          ? String(rawUpd.dnsProtection)
          : String(simplifiedConfig.dnsProtection || 'fast_private'),
        guestWifiEnabled:
          typeof rawUpd.guestWifiEnabled === 'boolean'
            ? rawUpd.guestWifiEnabled
            : Boolean(simplifiedConfig.guestWifiEnabled),
        guestWifiName: String(
          rawUpd.guestWifiName || simplifiedConfig.guestWifiName || 'MiRed-Invitados'
        ),
        autoOptimizeChannel:
          typeof rawUpd.autoOptimizeChannel === 'boolean'
            ? rawUpd.autoOptimizeChannel
            : simplifiedConfig.autoOptimizeChannel !== undefined
              ? Boolean(simplifiedConfig.autoOptimizeChannel)
              : true,
      };

      res.json({
        plainSummary:
          parsed.plainSummary || 'Configuración simplificada preparada.',
        updatedConfig: safeUpdatedConfig,
        vendorCommands: parsed.vendorCommands || '',
        restJsonPayload: parsed.restJsonPayload || '{}',
        model: modelUsed,
        latencyMs: Date.now() - startTime,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      console.error('[/api/jarvis/router/simplify-config] error:', err);
      res.status(parsed.statusCode).json({
        error: parsed.userMessage,
        code: parsed.statusCode,
        status: parsed.apiStatus,
      });
    }
  });

  // Apply Simplified Configuration to Reachable Router Endpoint using Admin Key
  app.post('/api/jarvis/router/apply-config', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        hostUrl = '',
        applyPath = '',
        method = 'POST',
        adminUsername = 'admin',
        adminPassword = '',
        authScheme = 'basic',
        payloadJson = '{}',
      } = req.body as {
        hostUrl: string;
        applyPath?: string;
        method?: string;
        adminUsername?: string;
        adminPassword?: string;
        authScheme?: string;
        payloadJson?: string;
      };

      if (!hostUrl.trim()) {
        res.status(400).json({ error: 'Se requiere la URL pública o túnel del router.' });
        return;
      }

      const withProtocol = /^https?:\/\//i.test(hostUrl.trim())
        ? hostUrl.trim()
        : `http://${hostUrl.trim()}`;
      const targetUrl = resolveSafeAppUrl(withProtocol, applyPath);
      const cleanMethod = ['POST', 'PUT', 'PATCH'].includes(
        String(method).toUpperCase()
      )
        ? String(method).toUpperCase()
        : 'POST';

      const headers: Record<string, string> = {
        ...buildRouterAuthHeaders(authScheme, adminUsername, adminPassword),
        'Content-Type': 'application/json',
      };

      const upstream = await fetch(targetUrl, {
        method: cleanMethod,
        headers,
        body: payloadJson,
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - startTime;
      const bodyText = (await upstream.text()).slice(0, 4000);

      res.json({
        ok: upstream.ok,
        httpStatus: upstream.status,
        latencyMs,
        bodyText,
        targetUrl,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        httpStatus: 0,
        latencyMs: Date.now() - startTime,
        error:
          err instanceof Error
            ? err.message
            : 'No se pudo enviar la configuración al router.',
      });
    }
  });

  // Anti-AI Editorial Design Audit & Human-Grade Refinement
  app.post('/api/jarvis/design/audit', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        htmlCode = '',
        designStyle = 'editorial-suiza',
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        htmlCode: string;
        designStyle?: string;
        engineRoute?: string;
      };

      if (!htmlCode.trim()) {
        res.status(400).json({ error: 'Se requiere código HTML para auditar y elevar el diseño.' });
        return;
      }

      const ai = getAiClient();
      const modelChain =
        engineRoute === 'cloud-reasoning'
          ? [
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 24000 },
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 25000 },
            ]
          : [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 25000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 22000 },
            ];

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: [
              `Audita este HTML para detectar señales típicas de diseño genérico de IA (gradientes morados/neón, pills excesivas, tarjetas anidadas, tipografía genérica, puntos parpadeantes, bordes border-l-4, copias genéricas) y reescríbelo completamente con estética humana editorial (${designStyle}), cargando Google Fonts acordes y manteniendo el 100% de la funcionalidad JavaScript.`,
              `HTML ACTUAL:\n${htmlCode.slice(0, 75000)}`,
            ].join('\n\n'),
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  scoreLabel: { type: Type.STRING },
                  typographyPairing: { type: Type.STRING },
                  aiTellsFound: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  improvementsApplied: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  refinedHtml: { type: Type.STRING },
                },
                required: [
                  'scoreLabel',
                  'typographyPairing',
                  'aiTellsFound',
                  'improvementsApplied',
                  'refinedHtml',
                ],
              },
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        scoreLabel?: string;
        typographyPairing?: string;
        aiTellsFound?: string[];
        improvementsApplied?: string[];
        refinedHtml?: string;
      };

      res.json({
        scoreLabel: parsed.scoreLabel || 'Diseño editorial refinado',
        typographyPairing: parsed.typographyPairing || 'Plus Jakarta Sans + DM Sans',
        aiTellsFound: Array.isArray(parsed.aiTellsFound) ? parsed.aiTellsFound : [],
        improvementsApplied: Array.isArray(parsed.improvementsApplied)
          ? parsed.improvementsApplied
          : [],
        refinedHtml: parsed.refinedHtml || htmlCode,
        model: modelUsed,
        latencyMs: Date.now() - startTime,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  // Live Spectator Screen & Visual Context Inspector
  app.post('/api/jarvis/vision/inspect', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        question = '',
        mode = 'spectator',
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        imageBase64: string;
        mimeType?: string;
        question?: string;
        mode?: string;
        engineRoute?: string;
      };

      if (!imageBase64) {
        res.status(400).json({ error: 'Se requiere una captura de pantalla para analizar.' });
        return;
      }

      const ai = getAiClient();
      const modeInstructions: Record<string, string> = {
        spectator:
          'Estás en modo Pantalla de Espectador observando en vivo lo que ocurre en pantalla. Describe con claridad qué aplicación, contenido o acción está ocurriendo y sugiere acciones útiles.',
        game:
          'Estás en modo Espectador de Videojuego. Identifica el estado del juego, obstáculos, puntuación visible o situación táctica y recomienda el siguiente movimiento concreto en una frase directa.',
        reels:
          'Estás en modo Espectador de Reels / Videos / Feed Social. Resume el tema visual del clip o publicación en pantalla, lee textos visibles y sugiere si guardar, comentar o pasar al siguiente.',
        design:
          'Estás en modo Crítico de Diseño Editorial. Evalúa el diseño visible en pantalla y señala qué mejorar para que luzca más humano y profesional.',
      };

      const promptText = [
        modeInstructions[mode] || modeInstructions.spectator,
        question.trim()
          ? `Pregunta o foco específico del usuario: "${question.trim()}"`
          : 'Analiza la captura en español claro y conciso.',
      ].join('\n\n');

      const modelChain =
        engineRoute === 'cloud-reasoning'
          ? [
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 18000 },
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 20000 },
            ]
          : [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 20000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 18000 },
            ];

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
                { text: promptText },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  contextLabel: {
                    type: Type.STRING,
                    description: 'Tipo de pantalla observada (ej. Navegador web, Videojuego, Reels, Editor).',
                  },
                  summary: {
                    type: Type.STRING,
                    description: 'Análisis detallado de lo que se ve en la pantalla.',
                  },
                  spokenLine: {
                    type: Type.STRING,
                    description: 'Frase natural y breve (máx 25 palabras) lista para narrar por voz.',
                  },
                  suggestedActions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['contextLabel', 'summary', 'spokenLine', 'suggestedActions'],
              },
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        contextLabel?: string;
        summary?: string;
        spokenLine?: string;
        suggestedActions?: string[];
      };

      res.json({
        contextLabel: parsed.contextLabel || 'Pantalla observada',
        summary: parsed.summary || 'Captura analizada correctamente.',
        spokenLine: parsed.spokenLine || parsed.summary || 'Observación completada.',
        suggestedActions: Array.isArray(parsed.suggestedActions)
          ? parsed.suggestedActions
          : [],
        model: modelUsed,
        latencyMs: Date.now() - startTime,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  // Professional Video Storyboard, Voiceover Script & Timed Subtitles Generator
  app.post('/api/jarvis/video/plan', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        topic = '',
        style = 'editorial',
        aspectRatio = '16:9',
        durationSec = 18,
        subtitleTheme = 'cinematic_bottom',
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        topic: string;
        style?: string;
        aspectRatio?: string;
        durationSec?: number;
        subtitleTheme?: string;
        engineRoute?: string;
      };

      if (!topic.trim()) {
        res.status(400).json({ error: 'Describe el tema o guión del video que deseas crear.' });
        return;
      }

      const targetSec = Math.max(8, Math.min(45, Number(durationSec) || 18));
      const ai = getAiClient();
      const modelChain = [
        { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 22000 },
        { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
      ];

      const prompt = [
        'Eres un director creativo y editor de video profesional.',
        `Crea un plan completo de producción audiovisual en español para un video sobre: "${topic.trim()}".`,
        `Estilo: ${style}. Formato: ${aspectRatio}. Duración total aproximada: ${targetSec} segundos.`,
        '1) Divide el video en 3 a 5 escenas equilibradas cuya suma de `durationSec` sea exactamente ' + targetSec + ' segundos.',
        '2) Escribe un `narrationScript` natural, fluido y profesional listo para locución de voz.',
        '3) Genera `subtitles` divididos en frases cortas de lectura rápida (máximo 7-9 palabras por subtítulo) cubriendo de 0s a ' + targetSec + 's sin solapamientos.',
        '4) Elige una paleta sobria y profesional (`bgHex`, `accentHex`, `textHex`) acorde al tema (evita neones exagerados).',
      ].join('\n\n');

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  palette: {
                    type: Type.OBJECT,
                    properties: {
                      bgHex: { type: Type.STRING },
                      accentHex: { type: Type.STRING },
                      textHex: { type: Type.STRING },
                    },
                    required: ['bgHex', 'accentHex', 'textHex'],
                  },
                  narrationScript: { type: Type.STRING },
                  scenes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        durationSec: { type: Type.NUMBER },
                        headline: { type: Type.STRING },
                        visualPrompt: { type: Type.STRING },
                        captionText: { type: Type.STRING },
                        motionType: {
                          type: Type.STRING,
                          enum: ['zoom_in', 'pan_left', 'pan_right', 'static_focus'],
                        },
                        layoutType: {
                          type: Type.STRING,
                          enum: ['title_hero', 'split_stat', 'quote_frame', 'lower_third'],
                        },
                      },
                      required: [
                        'id',
                        'durationSec',
                        'headline',
                        'visualPrompt',
                        'captionText',
                        'motionType',
                        'layoutType',
                      ],
                    },
                  },
                  subtitles: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        index: { type: Type.INTEGER },
                        startSec: { type: Type.NUMBER },
                        endSec: { type: Type.NUMBER },
                        text: { type: Type.STRING },
                      },
                      required: ['index', 'startSec', 'endSec', 'text'],
                    },
                  },
                },
                required: ['title', 'palette', 'narrationScript', 'scenes', 'subtitles'],
              },
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      res.json({
        title: String(parsed.title || 'Producción OpenJarvis'),
        palette: parsed.palette || {
          bgHex: '#0F172A',
          accentHex: '#2563EB',
          textHex: '#F8FAFC',
        },
        subtitleTheme,
        narrationScript: String(parsed.narrationScript || ''),
        scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
        subtitles: Array.isArray(parsed.subtitles) ? parsed.subtitles : [],
        model: modelUsed,
        latencyMs: Date.now() - startTime,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  // Auto-generate timed subtitles from uploaded audio/video or script
  app.post('/api/jarvis/video/auto-subtitles', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        audioBase64 = '',
        mimeType = 'audio/webm',
        scriptText = '',
        totalDurationSec = 15,
      } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        scriptText?: string;
        totalDurationSec?: number;
      };

      const ai = getAiClient();
      let finalTranscript = scriptText.trim();
      let modelUsed = 'gemini-3.1-flash-lite';

      if (audioBase64 && !finalTranscript) {
        const sttRes = await callWithRetryAndFallback(
          [{ model: 'gemini-3.5-transcribe', retries: 2, timeoutMs: 20000 }],
          (model) =>
            ai.models.generateContent({
              model,
              contents: {
                parts: [
                  { inlineData: { mimeType, data: audioBase64 } },
                  {
                    text: 'Transcribe el audio completo en su idioma original con puntuación clara. Devuelve únicamente el texto transcrito.',
                  },
                ],
              },
            })
        );
        finalTranscript = (sttRes.result.text ?? '').trim();
        modelUsed = sttRes.modelUsed;
      }

      if (!finalTranscript) {
        res.status(400).json({
          error: 'No se detectó texto ni audio con voz para generar subtítulos.',
        });
        return;
      }

      const dur = Math.max(3, Math.min(300, Number(totalDurationSec) || 15));
      const words = finalTranscript.split(/\s+/).filter(Boolean);
      const chunkSize = Math.max(4, Math.min(8, Math.ceil(words.length / Math.max(2, Math.round(dur / 2.5)))));
      const phrases: string[] = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        phrases.push(words.slice(i, i + chunkSize).join(' '));
      }

      const step = dur / Math.max(1, phrases.length);
      const subtitles = phrases.map((txt, idx) => ({
        index: idx + 1,
        startSec: Number((idx * step).toFixed(2)),
        endSec: Number(((idx + 1) * step).toFixed(2)),
        text: txt,
      }));

      res.json({
        transcript: finalTranscript,
        subtitles,
        model: modelUsed,
        latencyMs: Date.now() - startTime,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  // Internal Live Web Search (Google Search Grounding)
  app.post('/api/jarvis/search', async (req, res) => {
    const startTime = Date.now();
    try {
      const { query = '', engineRoute = 'local-first-hybrid' } = req.body as {
        query: string;
        engineRoute?: string;
      };

      if (!query.trim()) {
        res.status(400).json({ error: 'Escribe qué deseas buscar.' });
        return;
      }

      const ai = getAiClient();
      const modelChain =
        engineRoute === 'cloud-reasoning'
          ? [
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 18000 },
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 18000 },
            ]
          : [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 18000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 18000 },
            ];

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Busca información actualizada y verídica en la web sobre: "${query.trim()}". Responde en español con un resumen directo, puntos clave verificables y datos concretos.`,
            config: {
              tools: [{ googleSearch: {} }],
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
      );

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seen = new Set<string>();
      const results = chunks
        .map((chunk) => {
          const web = (chunk as { web?: { title?: string; uri?: string } }).web;
          if (!web?.uri || seen.has(web.uri)) return null;
          seen.add(web.uri);
          let domain = '';
          try {
            domain = new URL(web.uri).hostname.replace(/^www\./, '');
          } catch {
            domain = 'web';
          }
          return {
            title: web.title || domain,
            url: web.uri,
            snippet: `Fuente verificada encontrada en ${domain}`,
            domain,
          };
        })
        .filter((x): x is { title: string; url: string; snippet: string; domain: string } => x !== null);

      res.json({
        answer: (response.text ?? '').trim() || 'Búsqueda completada.',
        results,
        model: modelUsed,
        latencyMs: Date.now() - startTime,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  // Universal Web Page Reader (Direct Safe Fetch + Gemini URL Context / Summary / Q&A)
  app.post('/api/jarvis/web/read', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        url = '',
        question = '',
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        url: string;
        question?: string;
        engineRoute?: string;
      };

      if (!url.trim()) {
        res.status(400).json({ error: 'Ingresa la dirección URL de la página web que quieres leer.' });
        return;
      }

      let extracted: Awaited<ReturnType<typeof fetchAndExtractWebPage>> | null = null;
      let fetchErrorNote = '';
      try {
        extracted = await fetchAndExtractWebPage(url);
      } catch (err) {
        fetchErrorNote =
          err instanceof Error ? err.message : 'No se pudo descargar el HTML directo.';
      }

      const ai = getAiClient();
      const targetUrl =
        extracted?.url ||
        (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);

      // Validate targetUrl even when falling back to urlContext
      resolveSafeAppUrl(targetUrl, '');

      const modelChain =
        engineRoute === 'cloud-reasoning'
          ? [
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 20000 },
            ]
          : [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 20000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
            ];

      const readerPrompt = extracted
        ? [
            `Analiza esta página web (${extracted.url}) cuyo título es "${extracted.title}".`,
            question.trim()
              ? `Responde específicamente a esta pregunta del usuario basándote en el texto: "${question.trim()}". Además entrega un resumen claro.`
              : 'Entrega un resumen completo, claro y estructurado en español con los puntos principales de la página.',
            `CONTENIDO EXTRAÍDO:\n${extracted.extractedText.slice(0, 14000)}`,
          ].join('\n\n')
        : [
            `Lee el contenido de la URL ${targetUrl} usando URL Context.`,
            question.trim()
              ? `Responde en español a: "${question.trim()}" y resume los puntos principales.`
              : 'Resume en español el contenido principal, secciones clave y datos útiles de la página.',
            fetchErrorNote ? `(Nota técnica de lectura directa: ${fetchErrorNote})` : '',
          ]
            .filter(Boolean)
            .join('\n\n');

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: readerPrompt,
            config: {
              ...(!extracted ? { tools: [{ urlContext: {} }] } : {}),
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          })
      );

      const aiText = (response.text ?? '').trim();
      const wordCount = extracted?.wordCount ?? (aiText ? aiText.split(/\s+/).length : 0);

      res.json({
        url: targetUrl,
        title: extracted?.title || targetUrl,
        description: extracted?.description || '',
        wordCount,
        readingTimeMin: Math.max(1, Math.round(wordCount / 200)),
        extractedText: extracted?.extractedText || aiText,
        headings: extracted?.headings || [],
        links: extracted?.links || [],
        aiSummary: aiText,
        answer: question.trim() ? aiText : undefined,
        model: modelUsed,
        latencyMs: Date.now() - startTime,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  // Autonomous Multi-Step Agent Endpoint (Google Research, App Management, Games, Spectator Web Workflows)
  app.post('/api/jarvis/autonomous/step', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        goal = '',
        taskType = 'google_research',
        stepIndex = 1,
        previousLog = [],
        connectedApps = [],
        publishedApps = [],
        gameState,
        screenImageBase64 = '',
        screenMimeType = 'image/jpeg',
        engineRoute = 'local-first-hybrid',
      } = req.body as {
        goal: string;
        taskType: 'play_game' | 'google_research' | 'manage_apps' | 'web_workflow';
        stepIndex?: number;
        previousLog?: Array<{ action: string; outcome: string }>;
        connectedApps?: ConnectedAppContextInput[];
        publishedApps?: PublishedAppContextInput[];
        gameState?: Record<string, unknown>;
        screenImageBase64?: string;
        screenMimeType?: string;
        engineRoute?: string;
      };

      const ai = getAiClient();

      if (taskType === 'google_research') {
        const { result: response, modelUsed } = await callWithRetryAndFallback(
          [
            { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 20000 },
            { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
          ],
          (model) =>
            ai.models.generateContent({
              model,
              contents: [
                `Objetivo autónomo de búsqueda e investigación en Google: "${goal.trim() || 'Tendencias tecnológicas recientes'}".`,
                `Paso actual #${stepIndex}. Historial previo: ${JSON.stringify(previousLog.slice(-4))}.`,
                'Ejecuta búsqueda web real, lee y contrasta fuentes confiables y entrega hallazgos concretos en español.',
              ].join('\n\n'),
              config: {
                tools: [{ googleSearch: {} }, { urlContext: {} }],
                ...(model === 'gemini-4-hydrogen'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
              },
            })
        );

        const chunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const sources = chunks
          .map((c) => {
            const w = (c as { web?: { title?: string; uri?: string } }).web;
            return w?.uri ? { title: w.title || w.uri, url: w.uri } : null;
          })
          .filter((x): x is { title: string; url: string } => x !== null);

        res.json({
          action: 'Búsqueda autónoma en Google y lectura de fuentes',
          observation: `Consultadas ${sources.length} fuentes web verificadas`,
          outcome: (response.text ?? '').trim(),
          sources,
          done: true,
          model: modelUsed,
          latencyMs: Date.now() - startTime,
        });
        return;
      }

      if (taskType === 'manage_apps') {
        // Real server-side autonomous audit & execution over user's connectedApps & publishedApps
        const pingResults = await Promise.all(
          connectedApps.slice(0, 8).map(async (appItem) => {
            try {
              const targetUrl = resolveSafeAppUrl(appItem.baseUrl, appItem.healthPath || '');
              const t0 = Date.now();
              const resp = await fetch(targetUrl, {
                method: 'GET',
                signal: AbortSignal.timeout(6000),
              });
              return {
                id: appItem.id,
                name: appItem.name,
                status: appItem.status,
                online: resp.ok,
                httpStatus: resp.status,
                latencyMs: Date.now() - t0,
              };
            } catch (pingErr) {
              return {
                id: appItem.id,
                name: appItem.name,
                status: appItem.status,
                online: false,
                httpStatus: 0,
                latencyMs: 0,
                error: pingErr instanceof Error ? pingErr.message : 'Error de red',
              };
            }
          })
        );

        const { result: response, modelUsed } = await callWithRetryAndFallback(
          [{ model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 18000 }],
          (model) =>
            ai.models.generateContent({
              model,
              contents: [
                `Objetivo autónomo de administración de apps: "${goal.trim() || 'Supervisar todas las apps y optimizar estado'}".`,
                `Apps conectadas verificadas en vivo: ${JSON.stringify(pingResults)}`,
                `Apps publicadas: ${JSON.stringify(publishedApps)}`,
                'Decide si conviene activar o pausar alguna app según su salud real y entrega un informe claro en español.',
              ].join('\n\n'),
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING },
                    observation: { type: Type.STRING },
                    outcome: { type: Type.STRING },
                    statusChanges: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          kind: { type: Type.STRING, enum: ['connected', 'published'] },
                          identifier: { type: Type.STRING },
                          status: { type: Type.STRING, enum: ['active', 'paused'] },
                        },
                        required: ['kind', 'identifier', 'status'],
                      },
                    },
                  },
                  required: ['action', 'observation', 'outcome', 'statusChanges'],
                },
              },
            })
        );

        const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
        res.json({
          action: String(parsed.action || 'Auditoría autónoma de aplicaciones'),
          observation: String(parsed.observation || `${pingResults.length} apps inspeccionadas`),
          outcome: String(parsed.outcome || 'Revisión completada.'),
          statusChanges: Array.isArray(parsed.statusChanges) ? parsed.statusChanges : [],
          pingResults,
          done: true,
          model: modelUsed,
          latencyMs: Date.now() - startTime,
        });
        return;
      }

      if (taskType === 'play_game') {
        const parts: Array<Record<string, unknown>> = [];
        if (screenImageBase64) {
          parts.push({
            inlineData: { mimeType: screenMimeType, data: screenImageBase64 },
          });
        }
        parts.push({
          text: [
            `Eres un agente autónomo jugando un videojuego en la Arena de Espectador.`,
            `Estado actual del juego: ${JSON.stringify(gameState || {})}.`,
            `Objetivo: "${goal.trim() || 'Maximizar puntuación y evitar colisiones'}".`,
            'Elige la mejor acción inmediata ("UP", "DOWN", "LEFT", "RIGHT" o "STAY") y da una breve observación táctica en español.',
          ].join('\n'),
        });

        const { result: response, modelUsed } = await callWithRetryAndFallback(
          [{ model: 'gemini-3.1-flash-lite', retries: 1, timeoutMs: 10000 }],
          (model) =>
            ai.models.generateContent({
              model,
              contents: { parts },
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    move: {
                      type: Type.STRING,
                      enum: ['UP', 'DOWN', 'LEFT', 'RIGHT', 'STAY'],
                    },
                    observation: { type: Type.STRING },
                    outcome: { type: Type.STRING },
                  },
                  required: ['move', 'observation', 'outcome'],
                },
              },
            })
        );

        const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
        res.json({
          move: String(parsed.move || 'STAY'),
          action: `Movimiento autónomo: ${String(parsed.move || 'STAY')}`,
          observation: String(parsed.observation || 'Estado evaluado'),
          outcome: String(parsed.outcome || 'Movimiento aplicado'),
          done: false,
          model: modelUsed,
          latencyMs: Date.now() - startTime,
        });
        return;
      }

      // web_workflow (Spectator + External Apps / Reels / Companion Automation)
      const parts: Array<Record<string, unknown>> = [];
      if (screenImageBase64) {
        parts.push({
          inlineData: { mimeType: screenMimeType, data: screenImageBase64 },
        });
      }
      parts.push({
        text: [
          `Eres el agente autónomo de OpenJarvis asistiendo un flujo web o de pantalla compartida.`,
          `Objetivo del usuario: "${goal.trim() || 'Analizar actividad en pantalla y asistir el siguiente paso'}".`,
          `Paso #${stepIndex}. Historial: ${JSON.stringify(previousLog.slice(-4))}.`,
          'Si hay captura de pantalla (ej. Reels, Instagram, YouTube, app externa o juego), describe qué aparece en este momento, qué acción recomienda el agente (ej. avanzar al siguiente reel, resumir audio/texto, guardar referencia) y, si es útil, incluye un script seguro de navegador (JavaScript para consola/bookmarklet que el usuario puede ejecutar localmente en su pestaña cuando el sitio no permite iframe por CORS/X-Frame-Options).',
        ].join('\n\n'),
      });

      const modelChain =
        engineRoute === 'cloud-reasoning'
          ? [
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 20000 },
            ]
          : [
              { model: 'gemini-3.1-flash-lite', retries: 2, timeoutMs: 20000 },
              { model: 'gemini-4-hydrogen', retries: 1, timeoutMs: 20000 },
            ];

      const { result: response, modelUsed } = await callWithRetryAndFallback(
        modelChain,
        (model) =>
          ai.models.generateContent({
            model,
            contents: { parts },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  observation: { type: Type.STRING },
                  outcome: { type: Type.STRING },
                  spokenLine: { type: Type.STRING },
                  companionScript: { type: Type.STRING },
                },
                required: ['action', 'observation', 'outcome', 'spokenLine'],
              },
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      res.json({
        action: String(parsed.action || 'Evaluación de flujo web'),
        observation: String(parsed.observation || 'Pantalla analizada'),
        outcome: String(parsed.outcome || 'Paso completado'),
        spokenLine: String(parsed.spokenLine || ''),
        companionScript: String(parsed.companionScript || ''),
        done: true,
        model: modelUsed,
        latencyMs: Date.now() - startTime,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  // Public Online Hosting for Published Apps (/p/:slug) backed by Firestore
  app.get('/p/:slug', async (req, res) => {
    const slug = String(req.params.slug || '').trim();
    if (!/^[a-zA-Z0-9_-]{3,128}$/.test(slug)) {
      res
        .status(404)
        .type('html')
        .send(
          '<!doctype html><html lang="es"><body style="font-family:sans-serif;padding:48px;text-align:center;"><h1>Enlace inválido</h1><p>La ruta solicitada no corresponde a una aplicación publicada.</p><a href="/">Volver a OpenJarvis</a></body></html>'
        );
      return;
    }

    try {
      const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
      if (!fs.existsSync(cfgPath)) {
        res.status(500).send('Configuración de Firebase no disponible.');
        return;
      }
      const fbCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as {
        projectId: string;
        apiKey: string;
        firestoreDatabaseId: string;
      };

      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        fbCfg.projectId
      )}/databases/${encodeURIComponent(
        fbCfg.firestoreDatabaseId
      )}/documents/published_apps/${encodeURIComponent(slug)}?key=${encodeURIComponent(
        fbCfg.apiKey
      )}`;

      const docRes = await fetch(firestoreUrl);
      if (!docRes.ok) {
        res
          .status(404)
          .type('html')
          .send(
            `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Aplicación no encontrada</title></head><body style="font-family:system-ui,sans-serif;padding:48px;text-align:center;color:#0f172a;"><h1>Aplicación no encontrada</h1><p>No existe ninguna aplicación publicada en <code>/p/${slug}</code>.</p><p><a href="/" style="color:#2563eb;">Volver a OpenJarvis Studio</a></p></body></html>`
          );
        return;
      }

      const docJson = (await docRes.json()) as {
        fields?: {
          htmlCode?: { stringValue?: string };
          status?: { stringValue?: string };
          title?: { stringValue?: string };
        };
      };
      const status = docJson.fields?.status?.stringValue || 'active';
      if (status === 'paused') {
        const pausedTitle = docJson.fields?.title?.stringValue || 'Aplicación';
        res
          .status(503)
          .type('html')
          .send(
            `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${pausedTitle} — Pausada</title></head><body style="font-family:system-ui,sans-serif;padding:48px;text-align:center;color:#0f172a;background:#f8fafc;"><h1>Aplicación pausada temporalmente</h1><p>El propietario de <strong>${pausedTitle}</strong> ha pausado su acceso público desde OpenJarvis Studio.</p><p><a href="/" style="color:#2563eb;">Ir a OpenJarvis Studio</a></p></body></html>`
          );
        return;
      }

      const htmlCode = docJson.fields?.htmlCode?.stringValue;

      if (!htmlCode) {
        res.status(404).send('Aplicación vacía o no disponible.');
        return;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(htmlCode);
    } catch (err) {
      console.error('[/p/:slug] error:', err);
      res.status(500).send('No se pudo cargar la aplicación publicada.');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenJarvis Studio server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
