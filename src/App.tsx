import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AppWindow } from 'lucide-react';
import { TopBar, type NavTab } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { AssistantView } from './components/AssistantView';
import { VoicesView } from './components/VoicesView';
import { AppBuilderView, type AppsWorkspaceMode } from './components/AppBuilderView';
import { AgentsMemoryView } from './components/AgentsMemoryView';
import { TracesView } from './components/TracesView';
import {
  auth,
  deleteConnectedAppDocument,
  deletePublishedAppDocument,
  deleteRouterProfileDocument,
  publishAppDocument,
  recordConnectedAppCheck,
  saveConnectedAppDocument,
  saveRouterProfileDocument,
  signInWithGoogle,
  signOutUser,
  subscribeToUserConnectedApps,
  subscribeToUserPublishedApps,
  subscribeToUserRouterProfiles,
  updateConnectedAppStatus,
  updatePublishedAppStatus,
} from './firebase';
import type {
  ApplyRouterConfigResult,
  SaveRouterProfileInput,
  SimplifyRouterConfigResult,
} from './components/RouterManagerView';
import {
  AGENT_PRESETS,
  VOICE_PROFILES,
  type AppStatus,
  type AutonomousTaskType,
  type ChatMessage,
  type ConnectedAppMethod,
  type ConnectedAppRecord,
  type ConnectedAppType,
  type DesignAuditReport,
  type DesignStyleId,
  type EngineRoute,
  type MemoryEntry,
  type PresetId,
  type PublishedAppRecord,
  type RouterAuthScheme,
  type RouterDiagnosticReport,
  type RouterProfileRecord,
  type RouterVendor,
  type SimplifiedRouterConfig,
  type SpectatorObservation,
  type SubtitleCue,
  type TraceRecord,
  type TtsModelId,
  type VideoAspectRatio,
  type VideoProjectPlan,
  type VideoSubtitleTheme,
  type VoiceId,
  type WebPageReadResult,
  type WebSearchResultItem,
} from './types/jarvis';
import {
  playBase64Wav,
  streamAndPlayTtsAudio,
  type StreamPlaybackHandle,
} from './utils/audioPlayer';

const MEMORY_STORAGE_KEY = 'openjarvis_memories_v1';
const VOICE_STORAGE_KEY = 'openjarvis_voice_prefs_v1';
const THEME_STORAGE_KEY = 'openjarvis_theme_v1';

const DEFAULT_MEMORIES: MemoryEntry[] = [
  {
    id: 'mem-init-1',
    category: 'proyecto',
    content: 'Entorno personal OpenJarvis configurado con arquitectura local-first y soporte de voz neuronal.',
    createdAt: 'Inicial',
    source: 'manual',
  },
  {
    id: 'mem-init-2',
    category: 'preferencia',
    content: 'Respuestas claras en español con estructura directa y apta para lectura en voz alta.',
    createdAt: 'Inicial',
    source: 'manual',
  },
];

function formatTime(): string {
  return new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function estimateEnergyWh(promptTokens: number, outputTokens: number): number {
  return Number(((promptTokens * 0.00012 + outputTokens * 0.00035)).toFixed(4));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('asistente');
  const [activePreset, setActivePreset] = useState<PresetId>('chat-simple');
  const [engineRoute, setEngineRoute] =
    useState<EngineRoute>('local-first-hybrid');

  // Voice settings persisted
  const [activeVoice, setActiveVoice] = useState<VoiceId>(() => {
    try {
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeVoice) return parsed.activeVoice as VoiceId;
      }
    } catch {
      // ignore storage errors
    }
    return 'Charon';
  });

  const [voiceStyle, setVoiceStyle] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.voiceStyle === 'string') return parsed.voiceStyle;
      }
    } catch {
      // ignore
    }
    return VOICE_PROFILES[0].defaultStyle;
  });

  const [ttsModel, setTtsModel] = useState<TtsModelId>(
    'gemini-3.8-flash-lite-tts'
  );
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Dark mode synced with <html class="dark">
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(
        VOICE_STORAGE_KEY,
        JSON.stringify({ activeVoice, voiceStyle })
      );
    } catch {
      // ignore
    }
  }, [activeVoice, voiceStyle]);

  // Persistent local memories
  const [memories, setMemories] = useState<MemoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_MEMORIES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
    } catch {
      // ignore
    }
  }, [memories]);

  // Conversation, traces & audio playback state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [synthesizingMessageId, setSynthesizingMessageId] = useState<
    string | null
  >(null);
  const [previewingVoice, setPreviewingVoice] = useState<VoiceId | null>(null);
  const [synthesizingVoice, setSynthesizingVoice] = useState<VoiceId | null>(
    null
  );
  const [lastGeneratedAudio, setLastGeneratedAudio] = useState<{
    voiceId: VoiceId;
    audioBase64: string;
    latencyMs: number;
    model: string;
  } | null>(null);

  // Firebase Auth, Published Apps & Connected Apps state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [publishedApps, setPublishedApps] = useState<PublishedAppRecord[]>([]);
  const [connectedApps, setConnectedApps] = useState<ConnectedAppRecord[]>([]);
  const [routerProfiles, setRouterProfiles] = useState<RouterProfileRecord[]>([]);
  const [appsMode, setAppsMode] = useState<AppsWorkspaceMode>('builder');

  useEffect(() => {
    let unsubPublished: (() => void) | null = null;
    let unsubConnected: (() => void) | null = null;
    let unsubRouters: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (unsubPublished) {
        unsubPublished();
        unsubPublished = null;
      }
      if (unsubConnected) {
        unsubConnected();
        unsubConnected = null;
      }
      if (unsubRouters) {
        unsubRouters();
        unsubRouters = null;
      }
      if (currentUser) {
        unsubPublished = subscribeToUserPublishedApps(
          currentUser.uid,
          (apps) => setPublishedApps(apps),
          (err) => setErrorMsg(err.message)
        );
        unsubConnected = subscribeToUserConnectedApps(
          currentUser.uid,
          (apps) => setConnectedApps(apps),
          (err) => setErrorMsg(err.message)
        );
        unsubRouters = subscribeToUserRouterProfiles(
          currentUser.uid,
          (profiles) => setRouterProfiles(profiles),
          (err) => setErrorMsg(err.message)
        );
      } else {
        setPublishedApps([]);
        setConnectedApps([]);
        setRouterProfiles([]);
      }
    });
    return () => {
      unsubAuth();
      if (unsubPublished) unsubPublished();
      if (unsubConnected) unsubConnected();
      if (unsubRouters) unsubRouters();
    };
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamHandleRef = useRef<StreamPlaybackHandle | null>(null);

  const stopAllAudio = () => {
    if (streamHandleRef.current) {
      streamHandleRef.current.stop();
      streamHandleRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingMessageId(null);
    setSynthesizingMessageId(null);
    setPreviewingVoice(null);
    setSynthesizingVoice(null);
  };

  useEffect(() => {
    return () => {
      if (streamHandleRef.current) {
        streamHandleRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const appendTrace = (trace: Omit<TraceRecord, 'id' | 'timestamp'>) => {
    setTraces((prev) => [
      {
        ...trace,
        id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: formatTime(),
      },
      ...prev,
    ]);
  };

  const handleSynthesizeAndPlayMessage = async (
    msg: ChatMessage,
    voiceOverride?: VoiceId,
    styleOverride?: string
  ) => {
    stopAllAudio();
    const targetVoice = voiceOverride || activeVoice;
    const targetStyle = styleOverride ?? voiceStyle;

    // Replay cached audio if voice matches
    if (msg.audioBase64 && msg.voiceUsed === targetVoice && !voiceOverride) {
      setPlayingMessageId(msg.id);
      audioRef.current = playBase64Wav(
        msg.audioBase64,
        playbackRate,
        () => setPlayingMessageId(null),
        (err) => setErrorMsg(err)
      );
      return;
    }

    setSynthesizingMessageId(msg.id);
    streamHandleRef.current = streamAndPlayTtsAudio(
      {
        text: msg.content,
        voiceName: targetVoice,
        style: targetStyle,
        ttsModel,
      },
      playbackRate,
      {
        onFirstAudioChunk: () => {
          setSynthesizingMessageId(null);
          setPlayingMessageId(msg.id);
        },
        onComplete: (tts) => {
          setSynthesizingMessageId(null);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id
                ? { ...m, audioBase64: tts.audioBase64, voiceUsed: targetVoice }
                : m
            )
          );
          appendTrace({
            operation: 'tts',
            preset: msg.preset,
            model: tts.model,
            voice: targetVoice,
            latencyMs: tts.latencyMs,
            promptTokens: tts.promptTokens,
            outputTokens: tts.outputTokens,
            estimatedEnergyWh: estimateEnergyWh(tts.promptTokens, tts.outputTokens),
            toolsUsed: ['tts_stream'],
            status: 'ok',
          });
        },
        onEnded: () => {
          setPlayingMessageId(null);
          setSynthesizingMessageId(null);
          streamHandleRef.current = null;
        },
        onError: (message) => {
          setSynthesizingMessageId(null);
          setPlayingMessageId(null);
          setErrorMsg(message);
          appendTrace({
            operation: 'tts',
            preset: msg.preset,
            model: ttsModel,
            voice: targetVoice,
            latencyMs: 0,
            promptTokens: 0,
            outputTokens: 0,
            estimatedEnergyWh: 0,
            toolsUsed: ['tts_stream'],
            status: 'error',
          });
        },
      }
    );
  };

  const handlePreviewVoice = async (
    voiceId: VoiceId,
    customText?: string,
    overrideStyle?: string
  ) => {
    if (previewingVoice === voiceId && !customText) {
      stopAllAudio();
      return;
    }
    stopAllAudio();
    const profile =
      VOICE_PROFILES.find((v) => v.id === voiceId) || VOICE_PROFILES[0];
    const textToSpeak = customText?.trim() || profile.samplePhrase;
    const styleToUse =
      overrideStyle !== undefined
        ? overrideStyle
        : voiceId === activeVoice
          ? voiceStyle
          : profile.defaultStyle;

    setSynthesizingVoice(voiceId);
    setErrorMsg(null);
    streamHandleRef.current = streamAndPlayTtsAudio(
      {
        text: textToSpeak,
        voiceName: voiceId,
        style: styleToUse,
        ttsModel,
      },
      playbackRate,
      {
        onFirstAudioChunk: () => {
          setSynthesizingVoice(null);
          setPreviewingVoice(voiceId);
        },
        onComplete: (tts) => {
          setSynthesizingVoice(null);
          setLastGeneratedAudio({
            voiceId,
            audioBase64: tts.audioBase64,
            latencyMs: tts.latencyMs,
            model: tts.model,
          });
          appendTrace({
            operation: 'tts',
            preset: activePreset,
            model: tts.model,
            voice: voiceId,
            latencyMs: tts.latencyMs,
            promptTokens: tts.promptTokens,
            outputTokens: tts.outputTokens,
            estimatedEnergyWh: estimateEnergyWh(tts.promptTokens, tts.outputTokens),
            toolsUsed: ['voice_preview_stream'],
            status: 'ok',
          });
        },
        onEnded: () => {
          setPreviewingVoice(null);
          setSynthesizingVoice(null);
          streamHandleRef.current = null;
        },
        onError: (message) => {
          setSynthesizingVoice(null);
          setPreviewingVoice(null);
          setErrorMsg(message);
        },
      }
    );
  };

  const handleSendMessage = async (text: string, isRetry = false) => {
    setErrorMsg(null);
    const presetConfig =
      AGENT_PRESETS.find((p) => p.id === activePreset) || AGENT_PRESETS[0];

    const historyForRequest = isRetry ? messages.slice(0, -1) : messages;

    if (!isRetry) {
      const userMessage: ChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: formatTime(),
        preset: activePreset,
      };
      setMessages([...messages, userMessage]);
    }

    setIsSending(true);

    const controller = new AbortController();
    const fetchTimeout = window.setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history: historyForRequest.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          preset: activePreset,
          systemPrompt: presetConfig.systemPrompt,
          thinkingLevel: presetConfig.thinkingLevel,
          usesSearch: presetConfig.usesSearch,
          memories,
          publishedApps: publishedApps.map((a) => ({
            slug: a.slug,
            title: a.title,
            summary: a.summary,
            status: a.status,
          })),
          connectedApps: connectedApps.map((c) => ({
            id: c.id,
            name: c.name,
            appType: c.appType,
            baseUrl: c.baseUrl,
            healthPath: c.healthPath,
            defaultMethod: c.defaultMethod,
            description: c.description,
            status: c.status,
            lastCheckStatus: c.lastCheckStatus,
          })),
          routerProfiles: routerProfiles.map((r) => ({
            id: r.id,
            name: r.name,
            vendor: r.vendor,
            hostUrl: r.hostUrl,
            wifiName: r.wifiName,
            reachMode: r.reachMode,
            securityLevel: r.securityLevel,
            priorityMode: r.priorityMode,
            dnsProtection: r.dnsProtection,
            guestWifiEnabled: r.guestWifiEnabled,
            lastDiagnosticHealth: r.lastDiagnosticHealth,
            lastDiagnosticSummary: r.lastDiagnosticSummary,
          })),
          activeVoice,
          engineRoute,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al comunicarse con OpenJarvis.');
      }

      // Apply tool side-effects returned by the agent
      let effectiveVoice = activeVoice;
      let effectiveStyle = voiceStyle;
      if (data.nextVoice) {
        const matched = VOICE_PROFILES.find((v) => v.id === data.nextVoice);
        if (matched) {
          effectiveVoice = matched.id;
          setActiveVoice(matched.id);
          effectiveStyle = data.nextVoiceStyle || matched.defaultStyle;
          setVoiceStyle(effectiveStyle);
        }
      }

      if (data.nextPreset) {
        const matchedPreset = AGENT_PRESETS.find(
          (p) => p.id === data.nextPreset
        );
        if (matchedPreset) {
          setActivePreset(matchedPreset.id);
        }
      }

      if (Array.isArray(data.addedMemories) && data.addedMemories.length > 0) {
        const newEntries: MemoryEntry[] = data.addedMemories.map(
          (item: { category: string; content: string }, index: number) => ({
            id: `mem-agent-${Date.now()}-${index}`,
            category: (['preferencia', 'proyecto', 'contexto', 'rutina'].includes(
              item.category
            )
              ? item.category
              : 'contexto') as MemoryEntry['category'],
            content: item.content,
            createdAt: formatTime(),
            source: 'agente',
          })
        );
        setMemories((prev) => [...newEntries, ...prev]);
      }

      if (
        Array.isArray(data.appStatusUpdates) &&
        data.appStatusUpdates.length > 0
      ) {
        for (const upd of data.appStatusUpdates as Array<{
          kind: 'published' | 'connected';
          identifier: string;
          status: AppStatus;
        }>) {
          if (upd.kind === 'published') {
            void updatePublishedAppStatus(upd.identifier, upd.status);
          } else {
            void updateConnectedAppStatus(upd.identifier, upd.status);
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant',
        content: data.text,
        timestamp: formatTime(),
        preset: data.nextPreset || activePreset,
        voiceUsed: effectiveVoice,
        toolsUsed: data.toolsUsed || [],
        sources: data.sources || [],
        latencyMs: data.latencyMs,
        tokens: (data.promptTokens || 0) + (data.outputTokens || 0),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsSending(false);

      appendTrace({
        operation: 'chat',
        preset: assistantMsg.preset,
        model: data.model || 'gemini-4-hydrogen',
        voice: effectiveVoice,
        latencyMs: data.latencyMs || 0,
        promptTokens: data.promptTokens || 0,
        outputTokens: data.outputTokens || 0,
        estimatedEnergyWh: estimateEnergyWh(
          data.promptTokens || 0,
          data.outputTokens || 0
        ),
        toolsUsed: data.toolsUsed || [],
        status: 'ok',
      });

      if (autoSpeak) {
        void handleSynthesizeAndPlayMessage(
          assistantMsg,
          effectiveVoice,
          effectiveStyle
        );
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const message = isAbort
        ? 'La solicitud tardó más de 30 segundos en responder. Intenta de nuevo o cambia a «Respuesta Rápida» en la barra lateral.'
        : err instanceof Error
          ? err.message
          : 'Error inesperado en la sesión.';
      setErrorMsg(message);
      appendTrace({
        operation: 'chat',
        preset: activePreset,
        model: 'gemini-4-hydrogen',
        latencyMs: 0,
        promptTokens: 0,
        outputTokens: 0,
        estimatedEnergyWh: 0,
        toolsUsed: [],
        status: 'error',
      });
    } finally {
      window.clearTimeout(fetchTimeout);
      setIsSending(false);
    }
  };

  const handleTranscribeAudio = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMsg(null);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const audioBase64 = btoa(binary);

      const res = await fetch('/api/jarvis/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo transcribir el audio.');
      }

      appendTrace({
        operation: 'stt',
        preset: activePreset,
        model: data.model || 'gemini-3.5-transcribe',
        latencyMs: data.latencyMs || 0,
        promptTokens: data.promptTokens || 0,
        outputTokens: data.outputTokens || 0,
        estimatedEnergyWh: estimateEnergyWh(
          data.promptTokens || 0,
          data.outputTokens || 0
        ),
        toolsUsed: ['audio_transcribe'],
        status: 'ok',
      });

      if (data.text && data.text.trim()) {
        await handleSendMessage(data.text.trim());
      } else {
        setErrorMsg('No se detectó voz comprensible en la grabación.');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al procesar el audio.'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAddMemory = (
    category: MemoryEntry['category'],
    content: string
  ) => {
    setMemories((prev) => [
      {
        id: `mem-${Date.now()}`,
        category,
        content,
        createdAt: formatTime(),
        source: 'manual',
      },
      ...prev,
    ]);
  };

  const handleDeleteMemory = (id: string) => {
    setMemories((prev) => prev.filter((item) => item.id !== id));
  };

  const handleNewSession = () => {
    stopAllAudio();
    setMessages([]);
    setErrorMsg(null);
    setActiveTab('asistente');
  };

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleGenerateApp = async (
    prompt: string,
    currentHtml?: string,
    designStyle: DesignStyleId = 'editorial-suiza'
  ) => {
    const res = await fetch('/api/jarvis/generate-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        currentHtml: currentHtml || '',
        designStyle,
        engineRoute,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo generar la aplicación.');
    }
    appendTrace({
      operation: 'chat',
      preset: 'code-assistant',
      model: data.model || 'gemini-4-hydrogen',
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['app_builder'],
      status: 'ok',
    });
    return {
      title: data.title as string,
      summary: data.summary as string,
      suggestedSlug: data.suggestedSlug as string,
      htmlCode: data.htmlCode as string,
      model: (data.model || 'gemini-4-hydrogen') as string,
      latencyMs: (data.latencyMs || 0) as number,
    };
  };

  const handleAuditDesign = async (
    htmlCode: string,
    designStyle: DesignStyleId
  ): Promise<DesignAuditReport & { model: string; latencyMs: number }> => {
    const res = await fetch('/api/jarvis/design/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ htmlCode, designStyle, engineRoute }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo completar la auditoría Anti-IA.');
    }
    appendTrace({
      operation: 'chat',
      preset: 'code-assistant',
      model: data.model || 'gemini-3.1-flash-lite',
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['design_audit'],
      status: 'ok',
    });
    return data as DesignAuditReport & { model: string; latencyMs: number };
  };

  const handlePublishApp = async (payload: {
    slug: string;
    title: string;
    summary: string;
    prompt: string;
    htmlCode: string;
  }) => {
    return publishAppDocument(payload);
  };

  const handleDeleteApp = async (slug: string) => {
    await deletePublishedAppDocument(slug);
  };

  const handleTogglePublishedStatus = async (
    slug: string,
    status: AppStatus
  ) => {
    await updatePublishedAppStatus(slug, status);
  };

  const handleSaveConnectedApp = async (input: {
    id?: string;
    name: string;
    appType: ConnectedAppType;
    baseUrl: string;
    healthPath?: string;
    defaultMethod: ConnectedAppMethod;
    description?: string;
    status?: AppStatus;
    linkedPublishedSlug?: string;
  }) => {
    return saveConnectedAppDocument(input);
  };

  const handleToggleConnectedStatus = async (
    id: string,
    status: AppStatus
  ) => {
    await updateConnectedAppStatus(id, status);
  };

  const handlePingConnectedApp = async (app: ConnectedAppRecord) => {
    const res = await fetch('/api/jarvis/apps/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: app.baseUrl,
        healthPath: app.healthPath,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      online?: boolean;
      httpStatus?: number;
      latencyMs?: number;
      snippet?: string;
      error?: string;
    };
    const isOnline = Boolean(data.online);
    const httpStatus = Number(data.httpStatus || 0);
    const latencyMs = Number(data.latencyMs || 0);

    await recordConnectedAppCheck(app.id, {
      lastCheckStatus: isOnline ? 'online' : 'error',
      lastHttpCode: httpStatus,
      lastLatencyMs: latencyMs,
    });

    appendTrace({
      operation: 'app',
      preset: activePreset,
      model: app.name,
      latencyMs,
      promptTokens: 0,
      outputTokens: 0,
      estimatedEnergyWh: 0,
      toolsUsed: ['app_ping'],
      status: isOnline ? 'ok' : 'error',
    });

    return {
      online: isOnline,
      httpStatus,
      latencyMs,
      snippet: data.snippet,
      error: data.error,
    };
  };

  const handleDispatchCommand = async (payload: {
    app: ConnectedAppRecord;
    endpointPath: string;
    method: ConnectedAppMethod;
    bodyText: string;
    authHeaderName?: string;
    authHeaderValue?: string;
  }) => {
    const res = await fetch('/api/jarvis/apps/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: payload.app.baseUrl,
        endpointPath: payload.endpointPath,
        method: payload.method,
        bodyText: payload.bodyText,
        authHeaderName: payload.authHeaderName || '',
        authHeaderValue: payload.authHeaderValue || '',
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      httpStatus?: number;
      latencyMs?: number;
      bodyText?: string;
      targetUrl?: string;
      error?: string;
    };

    const latencyMs = Number(data.latencyMs || 0);
    const httpStatus = Number(data.httpStatus || 0);
    const ok = Boolean(data.ok);

    appendTrace({
      operation: 'app',
      preset: activePreset,
      model: payload.app.name,
      latencyMs,
      promptTokens: 0,
      outputTokens: 0,
      estimatedEnergyWh: 0,
      toolsUsed: [`app_${payload.method.toLowerCase()}`],
      status: ok ? 'ok' : 'error',
    });

    return {
      ok,
      httpStatus,
      latencyMs,
      bodyText: data.bodyText,
      targetUrl: data.targetUrl,
      error: data.error,
    };
  };

  const handleDeleteConnectedApp = async (id: string) => {
    await deleteConnectedAppDocument(id);
  };

  const handleSaveRouterProfile = async (input: SaveRouterProfileInput) => {
    return saveRouterProfileDocument(input);
  };

  const handleDeleteRouterProfile = async (id: string) => {
    await deleteRouterProfileDocument(id);
  };

  const handleDiagnoseRouter = async (payload: {
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
  }): Promise<RouterDiagnosticReport> => {
    const res = await fetch('/api/jarvis/router/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        vendor: payload.vendor,
        hostUrl: payload.hostUrl,
        adminUsername: payload.adminUsername,
        adminPassword: payload.adminPassword,
        authScheme: payload.authScheme,
        probePath: payload.probePath || '',
        diagnosticSnapshot: payload.diagnosticSnapshot || '',
        simplifiedConfig: payload.simplifiedConfig,
        engineRoute,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo completar el diagnóstico del router.');
    }

    const report = data as RouterDiagnosticReport & {
      promptTokens?: number;
      outputTokens?: number;
    };

    appendTrace({
      operation: 'app',
      preset: activePreset,
      model: report.model || 'gemini-4-hydrogen',
      latencyMs: report.latencyMs || 0,
      promptTokens: report.promptTokens || 0,
      outputTokens: report.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        report.promptTokens || 0,
        report.outputTokens || 0
      ),
      toolsUsed: ['router_diagnose'],
      status: 'ok',
    });

    if (payload.profileId && user) {
      const existing = routerProfiles.find((r) => r.id === payload.profileId);
      if (existing) {
        const derivedStatus = report.connectionObserved.reachable
          ? 'connected'
          : report.connectionObserved.isPrivateLan || !payload.hostUrl.trim()
            ? 'snapshot_only'
            : 'unreachable';
        void saveRouterProfileDocument({
          id: existing.id,
          name: payload.name,
          vendor: payload.vendor,
          hostUrl: payload.hostUrl,
          adminUsername: payload.adminUsername,
          authScheme: payload.authScheme,
          connectionStatus: derivedStatus,
          lastHttpCode: report.connectionObserved.httpStatus,
          lastLatencyMs: report.connectionObserved.latencyMs,
          lastDiagnosticHealth: report.overallHealth,
          lastDiagnosticSummary: report.summary,
          wifiName: payload.simplifiedConfig.wifiName,
          reachMode: payload.simplifiedConfig.reachMode,
          securityLevel: payload.simplifiedConfig.securityLevel,
          priorityMode: payload.simplifiedConfig.priorityMode,
          dnsProtection: payload.simplifiedConfig.dnsProtection,
          guestWifiEnabled: payload.simplifiedConfig.guestWifiEnabled,
          guestWifiName: payload.simplifiedConfig.guestWifiName,
          autoOptimizeChannel: payload.simplifiedConfig.autoOptimizeChannel,
        }).catch(() => {});
      }
    }

    return report;
  };

  const handleSimplifyRouterConfig = async (payload: {
    vendor: RouterVendor;
    routerName: string;
    naturalRequest: string;
    simplifiedConfig: SimplifiedRouterConfig;
    newWifiPassword?: string;
  }): Promise<SimplifyRouterConfigResult> => {
    const res = await fetch('/api/jarvis/router/simplify-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        engineRoute,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.error || 'No se pudo generar la configuración simplificada.'
      );
    }

    appendTrace({
      operation: 'app',
      preset: activePreset,
      model: data.model || 'gemini-4-hydrogen',
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['router_simplify'],
      status: 'ok',
    });

    return data as SimplifyRouterConfigResult;
  };

  const handleApplyRouterConfig = async (payload: {
    hostUrl: string;
    applyPath: string;
    method: 'POST' | 'PUT' | 'PATCH';
    adminUsername: string;
    adminPassword: string;
    authScheme: RouterAuthScheme;
    payloadJson: string;
  }): Promise<ApplyRouterConfigResult> => {
    const res = await fetch('/api/jarvis/router/apply-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as ApplyRouterConfigResult;

    appendTrace({
      operation: 'app',
      preset: activePreset,
      model: payload.hostUrl || 'router',
      latencyMs: Number(data.latencyMs || 0),
      promptTokens: 0,
      outputTokens: 0,
      estimatedEnergyWh: 0,
      toolsUsed: ['router_apply'],
      status: data.ok ? 'ok' : 'error',
    });

    return data;
  };

  const handleGoToAssistantWithPrompt = (promptText: string) => {
    setActiveTab('asistente');
    void handleSendMessage(promptText, false);
  };

  const handleTranscribeToPrompt = async (blob: Blob, mimeType: string) => {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const audioBase64 = btoa(binary);

    const res = await fetch('/api/jarvis/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo transcribir el audio.');
    }
    appendTrace({
      operation: 'stt',
      preset: 'code-assistant',
      model: data.model || 'gemini-3.5-transcribe',
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['audio_transcribe'],
      status: 'ok',
    });
    return (data.text || '').trim() as string;
  };

  const handleSpeakText = (text: string) => {
    if (!text.trim()) return;
    stopAllAudio();
    streamHandleRef.current = streamAndPlayTtsAudio(
      {
        text: text.trim(),
        voiceName: activeVoice,
        style: voiceStyle,
        ttsModel,
      },
      playbackRate,
      {
        onFirstAudioChunk: () => {},
        onComplete: () => {},
        onEnded: () => {
          streamHandleRef.current = null;
        },
        onError: (message) => {
          setErrorMsg(message);
        },
      }
    );
  };

  const handleInspectScreen = async (payload: {
    imageBase64: string;
    mimeType: string;
    question: string;
    mode: 'spectator' | 'game' | 'reels' | 'design';
  }): Promise<Omit<SpectatorObservation, 'id' | 'timestamp'>> => {
    const res = await fetch('/api/jarvis/vision/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, engineRoute }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo inspeccionar la pantalla.');
    }
    appendTrace({
      operation: 'chat',
      preset: activePreset,
      model: data.model || 'gemini-3.1-flash-lite',
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['vision_inspect'],
      status: 'ok',
    });
    return {
      contextLabel: String(data.contextLabel || 'Pantalla'),
      summary: String(data.summary || ''),
      spokenLine: String(data.spokenLine || ''),
      suggestedActions: Array.isArray(data.suggestedActions)
        ? data.suggestedActions
        : [],
      model: String(data.model || 'gemini-3.1-flash-lite'),
      latencyMs: Number(data.latencyMs || 0),
    };
  };

  const handleGenerateVideoPlan = async (payload: {
    topic: string;
    style: string;
    aspectRatio: VideoAspectRatio;
    durationSec: number;
    subtitleTheme: VideoSubtitleTheme;
  }): Promise<VideoProjectPlan> => {
    const res = await fetch('/api/jarvis/video/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, engineRoute }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo generar el plan de video.');
    }
    appendTrace({
      operation: 'chat',
      preset: activePreset,
      model: data.model || 'gemini-3.1-flash-lite',
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['video_plan'],
      status: 'ok',
    });
    return data as VideoProjectPlan;
  };

  const handleAutoSubtitles = async (payload: {
    audioBase64?: string;
    mimeType?: string;
    scriptText?: string;
    totalDurationSec: number;
  }): Promise<{ transcript: string; subtitles: SubtitleCue[] }> => {
    const res = await fetch('/api/jarvis/video/auto-subtitles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudieron generar los subtítulos.');
    }
    appendTrace({
      operation: 'stt',
      preset: activePreset,
      model: data.model || 'gemini-3.5-transcribe',
      latencyMs: data.latencyMs || 0,
      promptTokens: 0,
      outputTokens: 0,
      estimatedEnergyWh: 0,
      toolsUsed: ['auto_subtitles'],
      status: 'ok',
    });
    return {
      transcript: String(data.transcript || ''),
      subtitles: Array.isArray(data.subtitles) ? data.subtitles : [],
    };
  };

  const handleSynthesizeVoiceover = async (
    text: string,
    voiceName: VoiceId
  ): Promise<{ audioBase64: string; mimeType: string }> => {
    const res = await fetch('/api/jarvis/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceName,
        style: voiceStyle,
        ttsModel,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo sintetizar la locución.');
    }
    appendTrace({
      operation: 'tts',
      preset: activePreset,
      model: data.model || ttsModel,
      voice: voiceName,
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['video_voiceover'],
      status: 'ok',
    });
    return {
      audioBase64: String(data.audioBase64 || ''),
      mimeType: String(data.mimeType || 'audio/wav'),
    };
  };

  const handleSearchWeb = async (query: string): Promise<{
    answer: string;
    results: WebSearchResultItem[];
    model: string;
    latencyMs: number;
  }> => {
    const res = await fetch('/api/jarvis/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, engineRoute }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al realizar la búsqueda web.');
    }
    appendTrace({
      operation: 'chat',
      preset: 'deep-research',
      model: data.model || 'gemini-3.1-flash-lite',
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['internal_search'],
      status: 'ok',
    });
    return data as {
      answer: string;
      results: WebSearchResultItem[];
      model: string;
      latencyMs: number;
    };
  };

  const handleReadWebPage = async (
    url: string,
    question?: string
  ): Promise<WebPageReadResult> => {
    const res = await fetch('/api/jarvis/web/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, question: question || '', engineRoute }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo leer la página web.');
    }
    appendTrace({
      operation: 'chat',
      preset: 'deep-research',
      model: data.model || 'gemini-3.1-flash-lite',
      latencyMs: data.latencyMs || 0,
      promptTokens: data.promptTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedEnergyWh: estimateEnergyWh(
        data.promptTokens || 0,
        data.outputTokens || 0
      ),
      toolsUsed: ['read_web_page'],
      status: 'ok',
    });
    return data as WebPageReadResult;
  };

  const handleApplyAppStatusChanges = async (
    changes: Array<{
      kind: 'connected' | 'published';
      identifier: string;
      status: AppStatus;
    }>
  ) => {
    for (const change of changes) {
      if (change.kind === 'published') {
        await updatePublishedAppStatus(change.identifier, change.status);
      } else {
        await updateConnectedAppStatus(change.identifier, change.status);
      }
    }
  };

  const handleRunAutonomousStep = async (payload: {
    goal: string;
    taskType: AutonomousTaskType;
    stepIndex: number;
    previousLog: Array<{ action: string; outcome: string }>;
    gameState?: Record<string, unknown>;
    screenImageBase64?: string;
    screenMimeType?: string;
  }) => {
    const res = await fetch('/api/jarvis/autonomous/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        connectedApps: connectedApps.map((c) => ({
          id: c.id,
          name: c.name,
          appType: c.appType,
          baseUrl: c.baseUrl,
          healthPath: c.healthPath,
          defaultMethod: c.defaultMethod,
          description: c.description,
          status: c.status,
          lastCheckStatus: c.lastCheckStatus,
        })),
        publishedApps: publishedApps.map((a) => ({
          slug: a.slug,
          title: a.title,
          summary: a.summary,
          status: a.status,
        })),
        engineRoute,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'El paso autónomo devolvió un error.');
    }
    appendTrace({
      operation: 'app',
      preset: activePreset,
      model: data.model || 'gemini-3.1-flash-lite',
      latencyMs: data.latencyMs || 0,
      promptTokens: 0,
      outputTokens: 0,
      estimatedEnergyWh: 0,
      toolsUsed: [`autonomous_${payload.taskType}`],
      status: 'ok',
    });
    return data as {
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
    };
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewSession={handleNewSession}
      />

      <div className="flex-1 max-w-[1440px] w-full mx-auto flex flex-col lg:flex-row">
        <Sidebar
          activePreset={activePreset}
          onSelectPreset={setActivePreset}
          activeVoice={activeVoice}
          onSelectVoice={(voice) => {
            setActiveVoice(voice);
            const profile = VOICE_PROFILES.find((v) => v.id === voice);
            if (profile) setVoiceStyle(profile.defaultStyle);
          }}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={() => setAutoSpeak((v) => !v)}
          onPreviewVoice={(v) => handlePreviewVoice(v)}
          previewingVoice={previewingVoice}
          onOpenVoiceStudio={() => setActiveTab('voces')}
          engineRoute={engineRoute}
          onSelectEngineRoute={setEngineRoute}
          memoryCount={memories.length}
          connectedAppsCount={connectedApps.length}
          onOpenConnectedApps={() => {
            setAppsMode('manage');
            setActiveTab('crear');
          }}
          routerProfilesCount={routerProfiles.length}
          onOpenRouterManager={() => {
            setAppsMode('router');
            setActiveTab('crear');
          }}
          onOpenSpectator={() => {
            setAppsMode('spectator');
            setActiveTab('crear');
          }}
          onOpenVideoStudio={() => {
            setAppsMode('video');
            setActiveTab('crear');
          }}
          onOpenSearchWeb={() => {
            setAppsMode('web');
            setActiveTab('crear');
          }}
          onOpenAutonomous={() => {
            setAppsMode('autonomous');
            setActiveTab('crear');
          }}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
        />

        <main className="flex-1 flex flex-col min-w-0">
          {activeTab === 'asistente' && (
            <AssistantView
              messages={messages}
              activePreset={activePreset}
              activeVoice={activeVoice}
              onSelectVoice={(voice) => {
                setActiveVoice(voice);
                const profile = VOICE_PROFILES.find((v) => v.id === voice);
                if (profile) setVoiceStyle(profile.defaultStyle);
              }}
              autoSpeak={autoSpeak}
              onToggleAutoSpeak={() => setAutoSpeak((v) => !v)}
              playbackRate={playbackRate}
              onChangePlaybackRate={setPlaybackRate}
              isSending={isSending}
              isTranscribing={isTranscribing}
              playingMessageId={playingMessageId}
              synthesizingMessageId={synthesizingMessageId}
              errorMsg={errorMsg}
              onDismissError={() => setErrorMsg(null)}
              onSendMessage={(txt) => handleSendMessage(txt, false)}
              onRetryLastMessage={() => {
                const last = messages[messages.length - 1];
                if (last && last.role === 'user') {
                  handleSendMessage(last.content, true);
                }
              }}
              onPlayMessage={(msg) => handleSynthesizeAndPlayMessage(msg)}
              onStopAudio={stopAllAudio}
              onTranscribeAudio={handleTranscribeAudio}
              onOpenVoiceStudio={() => setActiveTab('voces')}
            />
          )}

          {activeTab === 'voces' && (
            <VoicesView
              activeVoice={activeVoice}
              onSelectVoice={setActiveVoice}
              voiceStyle={voiceStyle}
              onChangeVoiceStyle={setVoiceStyle}
              ttsModel={ttsModel}
              onChangeTtsModel={setTtsModel}
              playbackRate={playbackRate}
              onChangePlaybackRate={setPlaybackRate}
              autoSpeak={autoSpeak}
              onToggleAutoSpeak={() => setAutoSpeak((v) => !v)}
              previewingVoice={previewingVoice}
              synthesizingVoice={synthesizingVoice}
              onPreviewVoice={handlePreviewVoice}
              onStopAudio={stopAllAudio}
              lastGeneratedAudio={lastGeneratedAudio}
              errorMsg={errorMsg}
              onDismissError={() => setErrorMsg(null)}
            />
          )}

          {activeTab === 'crear' && (
            <AppBuilderView
              mode={appsMode}
              onChangeMode={setAppsMode}
              user={user}
              authReady={authReady}
              publishedApps={publishedApps}
              connectedApps={connectedApps}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              onGenerateApp={handleGenerateApp}
              onPublishApp={handlePublishApp}
              onDeleteApp={handleDeleteApp}
              onTogglePublishedStatus={handleTogglePublishedStatus}
              onSaveConnectedApp={handleSaveConnectedApp}
              onToggleConnectedStatus={handleToggleConnectedStatus}
              onPingConnectedApp={handlePingConnectedApp}
              onDispatchCommand={handleDispatchCommand}
              onDeleteConnectedApp={handleDeleteConnectedApp}
              routerProfiles={routerProfiles}
              onSaveRouterProfile={handleSaveRouterProfile}
              onDeleteRouterProfile={handleDeleteRouterProfile}
              onDiagnoseRouter={handleDiagnoseRouter}
              onSimplifyRouterConfig={handleSimplifyRouterConfig}
              onApplyRouterConfig={handleApplyRouterConfig}
              onGoToAssistantWithPrompt={handleGoToAssistantWithPrompt}
              onTranscribeToPrompt={handleTranscribeToPrompt}
              onAuditDesign={handleAuditDesign}
              memories={memories}
              traces={traces}
              activeVoice={activeVoice}
              onInspectScreen={handleInspectScreen}
              onGenerateVideoPlan={handleGenerateVideoPlan}
              onAutoSubtitles={handleAutoSubtitles}
              onSynthesizeVoiceover={handleSynthesizeVoiceover}
              onSearchWeb={handleSearchWeb}
              onReadWebPage={handleReadWebPage}
              onApplyAppStatusChanges={handleApplyAppStatusChanges}
              onRunAutonomousStep={handleRunAutonomousStep}
              onSpeakText={handleSpeakText}
            />
          )}

          {activeTab === 'agentes' && (
            <AgentsMemoryView
              activePreset={activePreset}
              onSelectPreset={setActivePreset}
              memories={memories}
              onAddMemory={handleAddMemory}
              onDeleteMemory={handleDeleteMemory}
              onGoToAssistant={() => setActiveTab('asistente')}
            />
          )}

          {activeTab === 'trazas' && (
            <TracesView
              traces={traces}
              onClearTraces={() => setTraces([])}
              onGoToAssistant={() => setActiveTab('asistente')}
            />
          )}
        </main>
      </div>

      {/* Corner Launcher: Asistente de creación de app */}
      <button
        type="button"
        onClick={() => {
          setAppsMode('builder');
          setActiveTab('crear');
        }}
        className={`fixed bottom-24 right-4 lg:bottom-5 lg:right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
          activeTab === 'crear' && appsMode === 'builder'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white'
        }`}
      >
        <AppWindow className="w-4 h-4 shrink-0" />
        <span>Asistente de creación de app</span>
      </button>
    </div>
  );
}
