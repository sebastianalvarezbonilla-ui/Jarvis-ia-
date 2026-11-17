import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  MessageSquare,
  Plus,
  Router as RouterIcon,
  Save,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Wifi,
  Wrench,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  RouterAuthScheme,
  RouterConnectionStatus,
  RouterDiagnosticReport,
  RouterDnsProtection,
  RouterHealthStatus,
  RouterPriorityMode,
  RouterProfileRecord,
  RouterReachMode,
  RouterSecurityLevel,
  RouterVendor,
  SimplifiedRouterConfig,
} from '../types/jarvis';

export interface SaveRouterProfileInput {
  id?: string;
  name: string;
  vendor: RouterVendor;
  hostUrl: string;
  adminUsername: string;
  authScheme: RouterAuthScheme;
  connectionStatus?: RouterConnectionStatus;
  lastHttpCode?: number;
  lastLatencyMs?: number;
  lastDiagnosticHealth?: RouterHealthStatus;
  lastDiagnosticSummary?: string;
  wifiName: string;
  reachMode: RouterReachMode;
  securityLevel: RouterSecurityLevel;
  priorityMode: RouterPriorityMode;
  dnsProtection: RouterDnsProtection;
  guestWifiEnabled: boolean;
  guestWifiName: string;
  autoOptimizeChannel: boolean;
}

export interface SimplifyRouterConfigResult {
  plainSummary: string;
  updatedConfig: SimplifiedRouterConfig;
  vendorCommands: string;
  restJsonPayload: string;
  model: string;
  latencyMs: number;
}

export interface ApplyRouterConfigResult {
  ok: boolean;
  httpStatus: number;
  latencyMs: number;
  bodyText?: string;
  targetUrl?: string;
  error?: string;
}

interface RouterManagerViewProps {
  user: User | null;
  authReady: boolean;
  routerProfiles: RouterProfileRecord[];
  onSignIn: () => Promise<void>;
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
}

const VENDOR_OPTIONS: Array<{ id: RouterVendor; label: string }> = [
  { id: 'openwrt', label: 'OpenWrt (UCI / LuCI)' },
  { id: 'mikrotik', label: 'MikroTik RouterOS' },
  { id: 'asus', label: 'ASUSWRT / Merlin' },
  { id: 'tplink', label: 'TP-Link / Deco / Archer' },
  { id: 'generic_rest', label: 'API REST Genérica' },
  { id: 'manual', label: 'Modo Manual / LAN Privada' },
];

const AUTH_SCHEME_OPTIONS: Array<{ id: RouterAuthScheme; label: string }> = [
  { id: 'basic', label: 'Usuario + Clave (Basic Auth)' },
  { id: 'bearer', label: 'Token Bearer (Clave como Token)' },
  { id: 'api_key_header', label: 'Header X-API-Key' },
  { id: 'cookie_session', label: 'Sesión Web / Manual' },
];

const REACH_OPTIONS: Array<{
  id: RouterReachMode;
  label: string;
  help: string;
}> = [
  {
    id: 'balanced',
    label: 'Equilibrado (recomendado)',
    help: 'Balancea velocidad y cobertura en toda la casa.',
  },
  {
    id: 'max_speed',
    label: 'Máxima velocidad cerca',
    help: 'Prioriza 5 GHz / canales amplios para máxima tasa cerca del router.',
  },
  {
    id: 'max_range',
    label: 'Máximo alcance en toda la casa',
    help: 'Prioriza penetración a través de paredes y habitaciones lejanas.',
  },
];

const SECURITY_OPTIONS: Array<{
  id: RouterSecurityLevel;
  label: string;
  help: string;
}> = [
  {
    id: 'wpa2_standard',
    label: 'Estándar segura (WPA2)',
    help: 'Compatible con todo tipo de teléfonos, laptops y TVs.',
  },
  {
    id: 'wpa3_max',
    label: 'Máxima protección (WPA3 / WPA2)',
    help: 'Cifrado moderno contra ataques de diccionario en Wi-Fi.',
  },
  {
    id: 'strict_isolated',
    label: 'Aislamiento estricto',
    help: 'Refuerza firewall, desactiva acceso remoto innecesario y protege la LAN.',
  },
];

const PRIORITY_OPTIONS: Array<{
  id: RouterPriorityMode;
  label: string;
  help: string;
}> = [
  {
    id: 'general',
    label: 'Uso general equilibrado',
    help: 'Reparte el ancho de banda por igual entre todos.',
  },
  {
    id: 'video_calls',
    label: 'Videollamadas y trabajo',
    help: 'Evita cortes en Zoom, Meet o Teams aunque otros descarguen.',
  },
  {
    id: 'gaming_low_latency',
    label: 'Juegos sin lag',
    help: 'Reduce latencia (ping) y picos de bufferbloat.',
  },
  {
    id: 'streaming_4k',
    label: 'Streaming y video 4K',
    help: 'Estabiliza reproducción de video en Smart TVs.',
  },
];

const DNS_OPTIONS: Array<{
  id: RouterDnsProtection;
  label: string;
  help: string;
}> = [
  {
    id: 'isp_default',
    label: 'Automático del proveedor',
    help: 'Usa los DNS predeterminados de tu compañía de Internet.',
  },
  {
    id: 'fast_private',
    label: 'Rápido y privado (1.1.1.1)',
    help: 'Acelera la apertura de páginas sin registrar tu historial.',
  },
  {
    id: 'family_safe',
    label: 'Filtro familiar y anti-anuncios',
    help: 'Bloquea dominios maliciosos, rastreadores y contenido adulto.',
  },
];

const DEFAULT_SIMPLIFIED_CONFIG: SimplifiedRouterConfig = {
  wifiName: 'MiRedWiFi',
  reachMode: 'balanced',
  securityLevel: 'wpa2_standard',
  priorityMode: 'general',
  dnsProtection: 'fast_private',
  guestWifiEnabled: false,
  guestWifiName: 'MiRed-Invitados',
  autoOptimizeChannel: true,
};

function healthStatusMeta(status: RouterHealthStatus): {
  label: string;
  textClass: string;
  borderClass: string;
} {
  if (status === 'optimal') {
    return {
      label: 'Estado óptimo',
      textClass: 'text-emerald-700 dark:text-emerald-300',
      borderClass: 'border-emerald-200 dark:border-emerald-900/60',
    };
  }
  if (status === 'critical') {
    return {
      label: 'Requiere corrección',
      textClass: 'text-red-700 dark:text-red-300',
      borderClass: 'border-red-200 dark:border-red-900/60',
    };
  }
  if (status === 'attention') {
    return {
      label: 'Atención recomendada',
      textClass: 'text-amber-700 dark:text-amber-300',
      borderClass: 'border-amber-200 dark:border-amber-900/60',
    };
  }
  return {
    label: 'Sin diagnosticar',
    textClass: 'text-slate-600 dark:text-slate-400',
    borderClass: 'border-slate-200 dark:border-slate-800',
  };
}

function renderStatusIcon(status: 'optimal' | 'attention' | 'critical') {
  if (status === 'optimal') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  }
  if (status === 'critical') {
    return <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />;
  }
  return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
}

export const RouterManagerView: React.FC<RouterManagerViewProps> = ({
  user,
  authReady,
  routerProfiles,
  onSignIn,
  onSaveRouterProfile,
  onDeleteRouterProfile,
  onDiagnoseRouter,
  onSimplifyRouterConfig,
  onApplyRouterConfig,
  onGoToAssistantWithPrompt,
}) => {
  // Active saved profile ID (optional)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  // Connection & session-only Admin Key (NEVER persisted)
  const [name, setName] = useState('Router Principal');
  const [vendor, setVendor] = useState<RouterVendor>('openwrt');
  const [hostUrl, setHostUrl] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [authScheme, setAuthScheme] = useState<RouterAuthScheme>('basic');
  const [probePath, setProbePath] = useState('');
  const [diagnosticSnapshot, setDiagnosticSnapshot] = useState('');
  const [showSnapshotBox, setShowSnapshotBox] = useState(false);

  // Simplified Configuration Editor state
  const [config, setConfig] = useState<SimplifiedRouterConfig>(
    DEFAULT_SIMPLIFIED_CONFIG
  );
  const [newWifiPassword, setNewWifiPassword] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [naturalRequest, setNaturalRequest] = useState('');

  // Diagnostics & translation results
  const [diagnosticReport, setDiagnosticReport] =
    useState<RouterDiagnosticReport | null>(null);
  const [expandedTechAreas, setExpandedTechAreas] = useState<
    Record<string, boolean>
  >({});
  const [simplifyResult, setSimplifyResult] =
    useState<SimplifyRouterConfigResult | null>(null);

  // Live apply state
  const [applyPath, setApplyPath] = useState('/rest/config');
  const [applyMethod, setApplyMethod] = useState<'POST' | 'PUT' | 'PATCH'>(
    'POST'
  );
  const [applyResult, setApplyResult] = useState<ApplyRouterConfigResult | null>(
    null
  );

  // Async flags & messages
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [copiedCommands, setCopiedCommands] = useState(false);
  const [appliedQuickFixMsg, setAppliedQuickFixMsg] = useState<string | null>(
    null
  );
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load first profile automatically if none selected yet
  useEffect(() => {
    if (!selectedProfileId && routerProfiles.length > 0) {
      const first = routerProfiles[0];
      setSelectedProfileId(first.id);
      setName(first.name);
      setVendor(first.vendor);
      setHostUrl(first.hostUrl);
      setAdminUsername(first.adminUsername);
      setAuthScheme(first.authScheme);
      setConfig({
        wifiName: first.wifiName,
        reachMode: first.reachMode,
        securityLevel: first.securityLevel,
        priorityMode: first.priorityMode,
        dnsProtection: first.dnsProtection,
        guestWifiEnabled: first.guestWifiEnabled,
        guestWifiName: first.guestWifiName,
        autoOptimizeChannel: first.autoOptimizeChannel,
      });
    }
  }, [routerProfiles, selectedProfileId]);

  const loadProfileIntoForm = (profile: RouterProfileRecord) => {
    setSelectedProfileId(profile.id);
    setName(profile.name);
    setVendor(profile.vendor);
    setHostUrl(profile.hostUrl);
    setAdminUsername(profile.adminUsername);
    setAuthScheme(profile.authScheme);
    setConfig({
      wifiName: profile.wifiName,
      reachMode: profile.reachMode,
      securityLevel: profile.securityLevel,
      priorityMode: profile.priorityMode,
      dnsProtection: profile.dnsProtection,
      guestWifiEnabled: profile.guestWifiEnabled,
      guestWifiName: profile.guestWifiName,
      autoOptimizeChannel: profile.autoOptimizeChannel,
    });
    setDiagnosticReport(null);
    setSimplifyResult(null);
    setApplyResult(null);
    setErrorMsg(null);
    setSavedFeedback(null);
  };

  const handleResetNewProfile = () => {
    setSelectedProfileId('');
    setName('Nuevo Router');
    setVendor('openwrt');
    setHostUrl('');
    setAdminUsername('admin');
    setAdminPassword('');
    setAuthScheme('basic');
    setProbePath('');
    setDiagnosticSnapshot('');
    setConfig(DEFAULT_SIMPLIFIED_CONFIG);
    setNewWifiPassword('');
    setDiagnosticReport(null);
    setSimplifyResult(null);
    setApplyResult(null);
    setErrorMsg(null);
    setSavedFeedback(null);
  };

  const handleDiagnose = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isDiagnosing) return;
    setErrorMsg(null);
    setSavedFeedback(null);
    setAppliedQuickFixMsg(null);
    setIsDiagnosing(true);
    try {
      const report = await onDiagnoseRouter({
        profileId: selectedProfileId || undefined,
        name: name.trim() || 'Router Principal',
        vendor,
        hostUrl: hostUrl.trim(),
        adminUsername: adminUsername.trim() || 'admin',
        adminPassword,
        authScheme,
        probePath: probePath.trim(),
        diagnosticSnapshot: diagnosticSnapshot.trim(),
        simplifiedConfig: config,
      });
      setDiagnosticReport(report);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el diagnóstico del router.'
      );
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSaveProfile = async (overrideConfig?: SimplifiedRouterConfig) => {
    if (isSavingProfile) return;
    setErrorMsg(null);
    setSavedFeedback(null);
    setIsSavingProfile(true);
    try {
      if (!user) {
        await onSignIn();
      }
      const activeCfg = overrideConfig || config;
      const derivedConnStatus: RouterConnectionStatus = diagnosticReport
        ? diagnosticReport.connectionObserved.reachable
          ? 'connected'
          : diagnosticReport.connectionObserved.isPrivateLan ||
              !hostUrl.trim()
            ? 'snapshot_only'
            : 'unreachable'
        : 'unknown';

      const savedId = await onSaveRouterProfile({
        id: selectedProfileId || undefined,
        name: name.trim() || 'Router Principal',
        vendor,
        hostUrl: hostUrl.trim(),
        adminUsername: adminUsername.trim() || 'admin',
        authScheme,
        connectionStatus: derivedConnStatus,
        lastHttpCode: diagnosticReport?.connectionObserved.httpStatus ?? 0,
        lastLatencyMs: diagnosticReport?.connectionObserved.latencyMs ?? 0,
        lastDiagnosticHealth: diagnosticReport?.overallHealth ?? 'unknown',
        lastDiagnosticSummary: diagnosticReport?.summary ?? '',
        wifiName: activeCfg.wifiName,
        reachMode: activeCfg.reachMode,
        securityLevel: activeCfg.securityLevel,
        priorityMode: activeCfg.priorityMode,
        dnsProtection: activeCfg.dnsProtection,
        guestWifiEnabled: activeCfg.guestWifiEnabled,
        guestWifiName: activeCfg.guestWifiName,
        autoOptimizeChannel: activeCfg.autoOptimizeChannel,
      });
      setSelectedProfileId(savedId);
      setSavedFeedback(
        'Perfil y preferencias guardados en tu cuenta (sin almacenar claves ni contraseñas).'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el perfil del router.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    setErrorMsg(null);
    try {
      await onDeleteRouterProfile(id);
      if (selectedProfileId === id) {
        handleResetNewProfile();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo eliminar el perfil.'
      );
    }
  };

  const handleSimplify = async (requestTextOverride?: string) => {
    if (isSimplifying) return;
    setErrorMsg(null);
    setApplyResult(null);
    setIsSimplifying(true);
    try {
      const reqText =
        requestTextOverride !== undefined ? requestTextOverride : naturalRequest;
      const res = await onSimplifyRouterConfig({
        vendor,
        routerName: name.trim() || 'Router Principal',
        naturalRequest: reqText.trim(),
        simplifiedConfig: config,
        newWifiPassword: newWifiPassword.trim(),
      });
      setSimplifyResult(res);
      if (res.updatedConfig) {
        setConfig((prev) => ({
          wifiName: res.updatedConfig.wifiName || prev.wifiName,
          reachMode: (
            ['balanced', 'max_speed', 'max_range'].includes(
              res.updatedConfig.reachMode
            )
              ? res.updatedConfig.reachMode
              : prev.reachMode
          ) as RouterReachMode,
          securityLevel: (
            ['wpa2_standard', 'wpa3_max', 'strict_isolated'].includes(
              res.updatedConfig.securityLevel
            )
              ? res.updatedConfig.securityLevel
              : prev.securityLevel
          ) as RouterSecurityLevel,
          priorityMode: (
            [
              'general',
              'video_calls',
              'gaming_low_latency',
              'streaming_4k',
            ].includes(res.updatedConfig.priorityMode)
              ? res.updatedConfig.priorityMode
              : prev.priorityMode
          ) as RouterPriorityMode,
          dnsProtection: (
            ['isp_default', 'fast_private', 'family_safe'].includes(
              res.updatedConfig.dnsProtection
            )
              ? res.updatedConfig.dnsProtection
              : prev.dnsProtection
          ) as RouterDnsProtection,
          guestWifiEnabled:
            typeof res.updatedConfig.guestWifiEnabled === 'boolean'
              ? res.updatedConfig.guestWifiEnabled
              : prev.guestWifiEnabled,
          guestWifiName: res.updatedConfig.guestWifiName ?? prev.guestWifiName,
          autoOptimizeChannel:
            typeof res.updatedConfig.autoOptimizeChannel === 'boolean'
              ? res.updatedConfig.autoOptimizeChannel
              : prev.autoOptimizeChannel,
        }));
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo generar la configuración simplificada.'
      );
    } finally {
      setIsSimplifying(false);
    }
  };

  const handleApplyLive = async () => {
    if (!simplifyResult || isApplying) return;
    setErrorMsg(null);
    setApplyResult(null);
    setIsApplying(true);
    try {
      const res = await onApplyRouterConfig({
        hostUrl: hostUrl.trim(),
        applyPath: applyPath.trim(),
        method: applyMethod,
        adminUsername: adminUsername.trim() || 'admin',
        adminPassword,
        authScheme,
        payloadJson: simplifyResult.restJsonPayload || '{}',
      });
      setApplyResult(res);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error enviando la configuración al router.'
      );
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyQuickFix = (
    fix: RouterDiagnosticReport['quickFixes'][number]
  ) => {
    setConfig((prev) => ({
      ...prev,
      ...(fix.reachMode ? { reachMode: fix.reachMode } : {}),
      ...(fix.securityLevel ? { securityLevel: fix.securityLevel } : {}),
      ...(fix.priorityMode ? { priorityMode: fix.priorityMode } : {}),
      ...(fix.dnsProtection ? { dnsProtection: fix.dnsProtection } : {}),
      ...(typeof fix.guestWifiEnabled === 'boolean'
        ? { guestWifiEnabled: fix.guestWifiEnabled }
        : {}),
      ...(typeof fix.autoOptimizeChannel === 'boolean'
        ? { autoOptimizeChannel: fix.autoOptimizeChannel }
        : {}),
    }));
    setAppliedQuickFixMsg(
      `Ajuste aplicado en el editor sencillo: "${fix.label}". Puedes generar los comandos o guardarlo abajo.`
    );
  };

  const handleCopyCommands = async () => {
    if (!simplifyResult?.vendorCommands) return;
    try {
      await navigator.clipboard.writeText(simplifyResult.vendorCommands);
      setCopiedCommands(true);
      window.setTimeout(() => setCopiedCommands(false), 2000);
    } catch {
      setErrorMsg('No se pudieron copiar los comandos al portapapeles.');
    }
  };

  const activeProfile = routerProfiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="space-y-6">
      {/* Error & Feedback Banners */}
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

      {savedFeedback && (
        <div className="px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-sm text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-4">
          <span>{savedFeedback}</span>
          <button
            type="button"
            onClick={() => setSavedFeedback(null)}
            className="text-xs font-medium underline shrink-0"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* Auth prompt if not signed in */}
      {authReady && !user && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Guarda tus perfiles de router en tu cuenta
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Puedes diagnosticar y traducir ajustes ahora mismo; si conectas tu cuenta, guardamos la ficha técnica de tu router (sin guardar jamás tu clave de admin).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSignIn()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Conectar con Google</span>
          </button>
        </div>
      )}

      {/* Saved Router Profiles Selector */}
      {user && (
        <section
          aria-labelledby="saved-routers-heading"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RouterIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2
                id="saved-routers-heading"
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                Perfiles de router guardados ({routerProfiles.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={handleResetNewProfile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo router</span>
            </button>
          </div>

          {routerProfiles.length === 0 ? (
            <div className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
              Todavía no tienes routers guardados. Configura uno abajo y pulsa «Guardar perfil».
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {routerProfiles.map((prof) => {
                const isSelected = prof.id === selectedProfileId;
                const hMeta = healthStatusMeta(prof.lastDiagnosticHealth);
                return (
                  <li
                    key={prof.id}
                    className={`px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/60 dark:bg-blue-950/20'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadProfileIntoForm(prof)}
                      className="text-left min-w-0 flex-1 space-y-0.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {prof.name}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {prof.vendor}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className={`text-xs font-medium ${hMeta.textClass}`}>
                          {hMeta.label}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                        {prof.hostUrl || 'Sin URL pública (modo captura local)'} · Wi-Fi: {prof.wifiName}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadProfileIntoForm(prof)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        {isSelected ? 'Activo' : 'Cargar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteProfile(prof.id)}
                        aria-label={`Eliminar perfil ${prof.name}`}
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
        </section>
      )}

      {/* 1. Conexión al Router con Clave de Admin */}
      <form
        onSubmit={(e) => void handleDiagnose(e)}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                1. Conexión al router con clave de administrador
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                La clave de admin solo se mantiene en memoria durante esta sesión y nunca se guarda en la nube.
              </p>
            </div>
          </div>

          {activeProfile && activeProfile.lastLatencyMs > 0 && (
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
              Último registro: HTTP {activeProfile.lastHttpCode} · {activeProfile.lastLatencyMs} ms
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="router-name"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Nombre del router
            </label>
            <input
              id="router-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Router Casa Fibra"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="router-vendor"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Marca / Sistema del router
            </label>
            <select
              id="router-vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value as RouterVendor)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {VENDOR_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="router-host-url"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Dirección URL o IP del router
            </label>
            <input
              id="router-host-url"
              type="text"
              value={hostUrl}
              onChange={(e) => setHostUrl(e.target.value)}
              placeholder="https://mi-router.duckdns.org o 192.168.1.1"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="router-admin-user"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Usuario admin
            </label>
            <input
              id="router-admin-user"
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="admin"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="router-admin-key"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Clave de admin (solo sesión)
            </label>
            <div className="relative flex items-center">
              <input
                id="router-admin-key"
                type={showAdminPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="off"
                placeholder="Tu clave o token de admin"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-3 pr-9 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword((v) => !v)}
                aria-label={
                  showAdminPassword
                    ? 'Ocultar clave de admin'
                    : 'Mostrar clave de admin'
                }
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showAdminPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="router-auth-scheme"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Método de autenticación
            </label>
            <select
              id="router-auth-scheme"
              value={authScheme}
              onChange={(e) => setAuthScheme(e.target.value as RouterAuthScheme)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {AUTH_SCHEME_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="router-probe-path"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Ruta de consulta (opcional)
            </label>
            <input
              id="router-probe-path"
              type="text"
              value={probePath}
              onChange={(e) => setProbePath(e.target.value)}
              placeholder="/rest/system/resource"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Snapshot / LAN export box toggle */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowSnapshotBox((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showSnapshotBox ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            <span>
              Pegar estado o configuración exportada (útil si tu router solo es accesible en red local 192.168.x.x)
            </span>
          </button>

          {showSnapshotBox && (
            <div>
              <label htmlFor="router-snapshot-textarea" className="sr-only">
                Pegar salida de estado o configuración del router
              </label>
              <textarea
                id="router-snapshot-textarea"
                rows={4}
                value={diagnosticSnapshot}
                onChange={(e) => setDiagnosticSnapshot(e.target.value)}
                placeholder="Pega aquí la salida de 'uci show' (OpenWrt), '/export' (MikroTik), un JSON de estado o las opciones visibles en la pantalla de tu router..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isDiagnosing}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
          >
            {isDiagnosing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Conectando y diagnosticando todo...</span>
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                <span>Conectar y Diagnosticar Todo</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={isSavingProfile}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isSavingProfile ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Guardar perfil</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 2. Diagnóstico Detallado de Todo */}
      <section
        aria-labelledby="router-diagnostics-heading"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2
              id="router-diagnostics-heading"
              className="text-sm font-semibold text-slate-900 dark:text-white"
            >
              2. Diagnóstico detallado de todo el router
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Evaluación clara de Internet, Wi-Fi, dispositivos, seguridad y rendimiento en términos comprensibles.
            </p>
          </div>
          {diagnosticReport && (
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
              {diagnosticReport.model} · {diagnosticReport.latencyMs} ms
            </span>
          )}
        </div>

        {!diagnosticReport ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Aún no se ha ejecutado un diagnóstico
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Introduce la dirección de tu router (o pega una captura de su configuración si estás en una red doméstica 192.168.x.x) y pulsa «Conectar y Diagnosticar Todo».
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {/* Overall Verdict */}
            <div className="p-5 space-y-3 bg-slate-50/70 dark:bg-slate-950/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {renderStatusIcon(diagnosticReport.overallHealth)}
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    {diagnosticReport.overallTitle}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      healthStatusMeta(diagnosticReport.overallHealth).textClass
                    }`}
                  >
                    {healthStatusMeta(diagnosticReport.overallHealth).label}
                  </span>
                </div>

                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {diagnosticReport.connectionObserved.reachable
                    ? `Conectado en vivo · HTTP ${diagnosticReport.connectionObserved.httpStatus} · ${diagnosticReport.connectionObserved.latencyMs} ms`
                    : diagnosticReport.connectionObserved.isPrivateLan
                      ? 'Red local privada (evaluación por configuración/captura)'
                      : diagnosticReport.connectionObserved.httpStatus > 0
                        ? `HTTP ${diagnosticReport.connectionObserved.httpStatus} · ${diagnosticReport.connectionObserved.latencyMs} ms`
                        : 'Evaluación de configuración'}
                </span>
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {diagnosticReport.summary}
              </p>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estado de conexión: {diagnosticReport.connectionObserved.note}
              </p>
            </div>

            {/* 5 Areas */}
            {diagnosticReport.areas.map((area, idx) => {
              const isTechOpen = Boolean(expandedTechAreas[area.area || String(idx)]);
              const areaMeta = healthStatusMeta(area.status);
              return (
                <div key={`${area.area}-${idx}`} className="p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {renderStatusIcon(area.status)}
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {area.area}
                      </h3>
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span className={`text-xs font-medium ${areaMeta.textClass}`}>
                        {area.status === 'optimal'
                          ? 'Óptimo'
                          : area.status === 'critical'
                            ? 'Crítico'
                            : 'Atención'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTechAreas((prev) => ({
                          ...prev,
                          [area.area || String(idx)]: !isTechOpen,
                        }))
                      }
                      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline"
                    >
                      {isTechOpen ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
                    </button>
                  </div>

                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {area.headline}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {area.plainExplanation}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Recomendación práctica: {area.recommendation}
                  </p>

                  {isTechOpen && (
                    <div className="pt-2 text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-800">
                      {area.technicalDetail}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick Fixes */}
            {diagnosticReport.quickFixes.length > 0 && (
              <div className="p-5 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Correcciones rápidas en 1 clic
                  </h3>
                </div>

                {appliedQuickFixMsg && (
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    {appliedQuickFixMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {diagnosticReport.quickFixes.map((fix, idx) => (
                    <button
                      key={`${fix.label}-${idx}`}
                      type="button"
                      onClick={() => handleApplyQuickFix(fix)}
                      className="text-left p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 transition-colors space-y-1"
                    >
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {fix.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                        {fix.effectDescription}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Editor de Configuración en Términos Simplificados */}
      <section
        aria-labelledby="router-simple-editor-heading"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-5"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-4">
          <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <h2
              id="router-simple-editor-heading"
              className="text-sm font-semibold text-slate-900 dark:text-white"
            >
              3. Editar configuración en términos simplificados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cambia opciones complejas por lenguaje cotidiano o escribe lo que necesitas y OpenJarvis lo traduce por ti.
            </p>
          </div>
        </div>

        {/* Natural language translator input */}
        <div className="space-y-2">
          <label
            htmlFor="router-natural-request"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Pídelo con tus propias palabras
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="router-natural-request"
              type="text"
              value={naturalRequest}
              onChange={(e) => setNaturalRequest(e.target.value)}
              placeholder="Ej. Quiero que las videollamadas no se corten, activar Wi-Fi para invitados y bloquear anuncios"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={() => void handleSimplify()}
              disabled={isSimplifying}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap shrink-0"
            >
              {isSimplifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Traduciendo...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Traducir a ajustes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Simplified Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label
              htmlFor="simple-wifi-name"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Nombre de tu Wi-Fi
            </label>
            <input
              id="simple-wifi-name"
              type="text"
              value={config.wifiName}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, wifiName: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="simple-wifi-password"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Nueva contraseña Wi-Fi (opcional, no se guarda en la nube)
            </label>
            <div className="relative flex items-center">
              <input
                id="simple-wifi-password"
                type={showWifiPassword ? 'text' : 'password'}
                value={newWifiPassword}
                onChange={(e) => setNewWifiPassword(e.target.value)}
                autoComplete="off"
                placeholder="Déjalo vacío para mantener la actual"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-3 pr-9 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowWifiPassword((v) => !v)}
                aria-label={
                  showWifiPassword
                    ? 'Ocultar contraseña Wi-Fi'
                    : 'Mostrar contraseña Wi-Fi'
                }
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showWifiPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="simple-reach-mode"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Alcance vs Velocidad
            </label>
            <select
              id="simple-reach-mode"
              value={config.reachMode}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  reachMode: e.target.value as RouterReachMode,
                }))
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {REACH_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {REACH_OPTIONS.find((o) => o.id === config.reachMode)?.help}
            </p>
          </div>

          <div>
            <label
              htmlFor="simple-security-level"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Nivel de seguridad
            </label>
            <select
              id="simple-security-level"
              value={config.securityLevel}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  securityLevel: e.target.value as RouterSecurityLevel,
                }))
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {SECURITY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {SECURITY_OPTIONS.find((o) => o.id === config.securityLevel)?.help}
            </p>
          </div>

          <div>
            <label
              htmlFor="simple-priority-mode"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Prioridad de Internet (QoS simplificado)
            </label>
            <select
              id="simple-priority-mode"
              value={config.priorityMode}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  priorityMode: e.target.value as RouterPriorityMode,
                }))
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {PRIORITY_OPTIONS.find((o) => o.id === config.priorityMode)?.help}
            </p>
          </div>

          <div>
            <label
              htmlFor="simple-dns-protection"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Protección y DNS
            </label>
            <select
              id="simple-dns-protection"
              value={config.dnsProtection}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  dnsProtection: e.target.value as RouterDnsProtection,
                }))
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {DNS_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {DNS_OPTIONS.find((o) => o.id === config.dnsProtection)?.help}
            </p>
          </div>
        </div>

        {/* Simple Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.guestWifiEnabled}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    guestWifiEnabled: e.target.checked,
                  }))
                }
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  Red Wi-Fi separada para invitados
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Da Internet a visitas sin que puedan ver tus dispositivos personales.
                </div>
              </div>
            </label>

            {config.guestWifiEnabled && (
              <div className="pl-6">
                <label
                  htmlFor="simple-guest-wifi-name"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Nombre de red para invitados
                </label>
                <input
                  id="simple-guest-wifi-name"
                  type="text"
                  value={config.guestWifiName}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      guestWifiName: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoOptimizeChannel}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  autoOptimizeChannel: e.target.checked,
                }))
              }
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Elegir automáticamente el canal menos saturado
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Evita interferencias con el Wi-Fi de vecinos cercanos.
              </div>
            </div>
          </label>
        </div>

        {/* Editor Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => void handleSimplify('')}
            disabled={isSimplifying}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
          >
            {isSimplifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generando vista previa...</span>
              </>
            ) : (
              <>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Generar cambios y comandos</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleSaveProfile(config)}
            disabled={isSavingProfile}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar preferencias</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onGoToAssistantWithPrompt(
                `Ayúdame con mi router "${name}" (${vendor}). Configuración actual en términos simples: Wi-Fi "${config.wifiName}", alcance=${config.reachMode}, seguridad=${config.securityLevel}, prioridad=${config.priorityMode}, DNS=${config.dnsProtection}, invitados=${config.guestWifiEnabled ? config.guestWifiName : 'no'}.${
                  diagnosticReport
                    ? ` Último diagnóstico: ${diagnosticReport.overallTitle} — ${diagnosticReport.summary}`
                    : ''
                } Explícame qué puedo mejorar.`
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Consultar por chat</span>
          </button>
        </div>

        {/* Translation Preview & Live Apply */}
        {simplifyResult && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Resumen de cambios en términos claros
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {simplifyResult.model} · {simplifyResult.latencyMs} ms
              </span>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {simplifyResult.plainSummary}
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Comandos / guía exacta para {vendor}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyCommands()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {copiedCommands ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar comandos</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
                <code>{simplifyResult.vendorCommands}</code>
              </pre>
            </div>

            {/* Apply directly over Admin HTTP/REST endpoint */}
            <div className="pt-2 space-y-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Aplicar directamente al router conectado (requiere URL remota/túnel + clave de admin)
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  aria-label="Método HTTP para aplicar"
                  value={applyMethod}
                  onChange={(e) =>
                    setApplyMethod(e.target.value as 'POST' | 'PUT' | 'PATCH')
                  }
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
                <input
                  type="text"
                  aria-label="Ruta del endpoint de configuración"
                  value={applyPath}
                  onChange={(e) => setApplyPath(e.target.value)}
                  placeholder="/rest/config"
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void handleApplyLive()}
                  disabled={isApplying || !hostUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 text-white transition-colors whitespace-nowrap shrink-0"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Aplicando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Aplicar al router</span>
                    </>
                  )}
                </button>
              </div>

              {applyResult && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    applyResult.ok
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                      : 'border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30 text-red-900 dark:text-red-200'
                  }`}
                >
                  <div className="font-mono font-semibold">
                    {applyResult.ok
                      ? `Aplicado correctamente · HTTP ${applyResult.httpStatus} · ${applyResult.latencyMs} ms`
                      : `No se pudo aplicar · HTTP ${applyResult.httpStatus} · ${applyResult.error || 'Error del router'}`}
                  </div>
                  {applyResult.bodyText && (
                    <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap opacity-90">
                      {applyResult.bodyText}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
