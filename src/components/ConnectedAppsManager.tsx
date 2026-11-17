import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  LogIn,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  AppStatus,
  ConnectedAppMethod,
  ConnectedAppRecord,
  ConnectedAppType,
  PublishedAppRecord,
} from '../types/jarvis';

interface PingResult {
  online: boolean;
  httpStatus: number;
  latencyMs: number;
  snippet?: string;
  error?: string;
}

interface DispatchResult {
  ok: boolean;
  httpStatus: number;
  latencyMs: number;
  bodyText?: string;
  targetUrl?: string;
  error?: string;
}

interface ConnectedAppsManagerProps {
  user: User | null;
  authReady: boolean;
  publishedApps: PublishedAppRecord[];
  connectedApps: ConnectedAppRecord[];
  onSignIn: () => Promise<void>;
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
  onPingConnectedApp: (app: ConnectedAppRecord) => Promise<PingResult>;
  onDispatchCommand: (payload: {
    app: ConnectedAppRecord;
    endpointPath: string;
    method: ConnectedAppMethod;
    bodyText: string;
    authHeaderName?: string;
    authHeaderValue?: string;
  }) => Promise<DispatchResult>;
  onDeleteConnectedApp: (id: string) => Promise<void>;
  onTogglePublishedStatus: (slug: string, status: AppStatus) => Promise<void>;
  onDeletePublishedApp: (slug: string) => Promise<void>;
  onEditPublishedInBuilder: (app: PublishedAppRecord) => void;
  onGoToAssistantWithPrompt: (promptText: string) => void;
}

const APP_TYPE_LABELS: Record<ConnectedAppType, string> = {
  openjarvis_app: 'App OpenJarvis',
  web_app: 'Aplicación Web',
  api_rest: 'API REST',
  webhook: 'Webhook',
};

export const ConnectedAppsManager: React.FC<ConnectedAppsManagerProps> = ({
  user,
  authReady,
  publishedApps,
  connectedApps,
  onSignIn,
  onSaveConnectedApp,
  onToggleConnectedStatus,
  onPingConnectedApp,
  onDispatchCommand,
  onDeleteConnectedApp,
  onTogglePublishedStatus,
  onDeletePublishedApp,
  onEditPublishedInBuilder,
  onGoToAssistantWithPrompt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>(
    'all'
  );

  // Connect / Edit Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<ConnectedAppType>('web_app');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formHealthPath, setFormHealthPath] = useState('/');
  const [formMethod, setFormMethod] = useState<ConnectedAppMethod>('GET');
  const [formDescription, setFormDescription] = useState('');
  const [formLinkedSlug, setFormLinkedSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Operational state
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [activeConsoleId, setActiveConsoleId] = useState<string | null>(null);
  const [cmdPath, setCmdPath] = useState('');
  const [cmdMethod, setCmdMethod] = useState<ConnectedAppMethod>('GET');
  const [cmdBody, setCmdBody] = useState('{\n  "action": "status"\n}');
  const [cmdAuthName, setCmdAuthName] = useState('');
  const [cmdAuthValue, setCmdAuthValue] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [lastDispatch, setLastDispatch] = useState<DispatchResult | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const filteredConnected = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return connectedApps.filter((app) => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        app.baseUrl.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q)
      );
    });
  }, [connectedApps, searchQuery, statusFilter]);

  const activeCount = connectedApps.filter((a) => a.status === 'active').length;
  const pausedCount = connectedApps.filter((a) => a.status === 'paused').length;

  const resetForm = () => {
    setEditingId(undefined);
    setFormName('');
    setFormType('web_app');
    setFormBaseUrl('');
    setFormHealthPath('/');
    setFormMethod('GET');
    setFormDescription('');
    setFormLinkedSlug('');
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
    setErrorMsg(null);
  };

  const openEditForm = (app: ConnectedAppRecord) => {
    setEditingId(app.id);
    setFormName(app.name);
    setFormType(app.appType);
    setFormBaseUrl(app.baseUrl);
    setFormHealthPath(app.healthPath || '/');
    setFormMethod(app.defaultMethod);
    setFormDescription(app.description);
    setFormLinkedSlug(app.linkedPublishedSlug || '');
    setShowForm(true);
    setErrorMsg(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBaseUrl.trim() || isSaving) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    setIsSaving(true);
    try {
      if (!user) {
        await onSignIn();
      }
      await onSaveConnectedApp({
        id: editingId,
        name: formName.trim(),
        appType: formType,
        baseUrl: formBaseUrl.trim(),
        healthPath: formHealthPath.trim(),
        defaultMethod: formMethod,
        description: formDescription.trim(),
        linkedPublishedSlug: formLinkedSlug.trim(),
      });
      setFeedbackMsg(
        editingId
          ? `Conexión "${formName.trim()}" actualizada.`
          : `Aplicación "${formName.trim()}" conectada a OpenJarvis.`
      );
      setShowForm(false);
      resetForm();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo guardar la conexión.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickConnectPublished = async (pub: PublishedAppRecord) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      if (!user) {
        await onSignIn();
      }
      await onSaveConnectedApp({
        name: pub.title,
        appType: 'openjarvis_app',
        baseUrl: `/p/${pub.slug}`,
        healthPath: '',
        defaultMethod: 'GET',
        description: pub.summary,
        status: pub.status,
        linkedPublishedSlug: pub.slug,
      });
      setFeedbackMsg(`"${pub.title}" conectada para gestión en OpenJarvis.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo conectar la aplicación.'
      );
    }
  };

  const handlePing = async (app: ConnectedAppRecord) => {
    setErrorMsg(null);
    setPingingId(app.id);
    try {
      const result = await onPingConnectedApp(app);
      setFeedbackMsg(
        result.online
          ? `"${app.name}" respondió HTTP ${result.httpStatus} en ${result.latencyMs} ms.`
          : `"${app.name}" devolvió HTTP ${result.httpStatus || 'sin conexión'} (${result.error || 'revisa la URL'}).`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al probar la conexión.'
      );
    } finally {
      setPingingId(null);
    }
  };

  const openCommandConsole = (app: ConnectedAppRecord) => {
    if (activeConsoleId === app.id) {
      setActiveConsoleId(null);
      return;
    }
    setActiveConsoleId(app.id);
    setCmdPath(app.healthPath || '');
    setCmdMethod(app.defaultMethod);
    setLastDispatch(null);
  };

  const handleRunCommand = async (
    e: React.FormEvent,
    app: ConnectedAppRecord
  ) => {
    e.preventDefault();
    if (isDispatching) return;
    setErrorMsg(null);
    setIsDispatching(true);
    try {
      const result = await onDispatchCommand({
        app,
        endpointPath: cmdPath,
        method: cmdMethod,
        bodyText: cmdBody,
        authHeaderName: cmdAuthName,
        authHeaderValue: cmdAuthValue,
      });
      setLastDispatch(result);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo ejecutar el comando.'
      );
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setErrorMsg('No se pudo copiar al portapapeles.');
    }
  };

  return (
    <div className="space-y-8">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Apps conectadas
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {connectedApps.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Activas
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {activeCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Pausadas
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1">
            {pausedCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Publicadas online
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {publishedApps.length}
          </div>
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
            onClick={() => setErrorMsg(null)}
            className="text-xs font-medium underline shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {feedbackMsg && (
        <div className="px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-sm text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-medium underline shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Auth prompt if disconnected */}
      {authReady && !user && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Conecta tu cuenta para administrar tus aplicaciones
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Inicia sesión con Google para vincular aplicaciones externas, APIs, webhooks y controlar el estado de tus apps publicadas desde OpenJarvis.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSignIn()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Conectar con Google</span>
          </button>
        </div>
      )}

      {/* Connect New App Form */}
      {showForm && (
        <form
          onSubmit={(e) => void handleSubmitForm(e)}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId
                ? 'Editar aplicación conectada'
                : 'Conectar nueva aplicación, API o webhook'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              aria-label="Cerrar formulario"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="conn-app-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Nombre de la aplicación
              </label>
              <input
                id="conn-app-name"
                type="text"
                required
                maxLength={100}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej. CRM Ventas o Panel Inventario"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="conn-app-type"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Tipo de conexión
              </label>
              <select
                id="conn-app-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value as ConnectedAppType)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="web_app">Aplicación Web</option>
                <option value="api_rest">API REST / Microservicio</option>
                <option value="webhook">Webhook / Automatización</option>
                <option value="openjarvis_app">App OpenJarvis (/p/:slug)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="conn-app-url"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                URL base o ruta pública
              </label>
              <input
                id="conn-app-url"
                type="text"
                required
                maxLength={500}
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="https://mi-app.ejemplo.com o /p/mi-app"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="conn-app-health"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Ruta de verificación
                </label>
                <input
                  id="conn-app-health"
                  type="text"
                  maxLength={200}
                  value={formHealthPath}
                  onChange={(e) => setFormHealthPath(e.target.value)}
                  placeholder="/api/health"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="conn-app-method"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Método por defecto
                </label>
                <select
                  id="conn-app-method"
                  value={formMethod}
                  onChange={(e) =>
                    setFormMethod(e.target.value as ConnectedAppMethod)
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="conn-app-desc"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Descripción operativa (ayuda a OpenJarvis a manejar esta app)
              </label>
              <input
                id="conn-app-desc"
                type="text"
                maxLength={300}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ej. Servicio de pedidos; acepta POST /orders para registrar nuevas órdenes."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !formName.trim() || !formBaseUrl.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Guardar cambios' : 'Conectar aplicación'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Connected Apps Section */}
      <section aria-labelledby="connected-apps-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2
              id="connected-apps-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Aplicaciones conectadas a OpenJarvis
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Conecta apps externas, APIs o tus propias apps publicadas para monitorearlas, enviarles comandos o controlarlas desde el asistente.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Conectar aplicación</span>
          </button>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar app conectada por nombre o URL..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'active', label: 'Activas' },
                { id: 'paused', label: 'Pausadas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
          {filteredConnected.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {connectedApps.length === 0
                  ? 'No tienes aplicaciones conectadas todavía'
                  : 'Ninguna aplicación coincide con tu filtro'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Vincula una URL web, una API REST, un webhook o cualquiera de tus apps publicadas para probar su conexión y manejarla desde aquí o por voz con OpenJarvis.
              </p>
              {connectedApps.length === 0 && (
                <button
                  type="button"
                  onClick={openNewForm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Conectar primera aplicación</span>
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredConnected.map((app) => {
                const resolvedHref = app.baseUrl.startsWith('/p/')
                  ? `${window.location.origin}${app.baseUrl}`
                  : app.baseUrl;
                const isConsoleOpen = activeConsoleId === app.id;

                return (
                  <li key={app.id} className="p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {app.name}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {APP_TYPE_LABELS[app.appType]}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                            {app.baseUrl}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              app.status === 'active'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {app.status === 'active' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <PauseCircle className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {app.status === 'active' ? 'Activa' : 'Pausada'}
                            </span>
                          </span>
                          {app.lastCheckStatus !== 'unknown' && (
                            <>
                              <span aria-hidden="true" className="text-slate-400">
                                ·
                              </span>
                              <span
                                className={`text-xs font-mono tabular-nums ${
                                  app.lastCheckStatus === 'online'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-red-700 dark:text-red-400'
                                }`}
                              >
                                {app.lastCheckStatus === 'online'
                                  ? `En línea (${app.lastHttpCode})`
                                  : `Error (${app.lastHttpCode || 'red'})`}{' '}
                                · {app.lastLatencyMs} ms
                              </span>
                            </>
                          )}
                        </div>

                        {app.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {app.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => void handlePing(app)}
                          disabled={pingingId === app.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          {pingingId === app.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Activity className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>Probar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openCommandConsole(app)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                            isConsoleOpen
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Controlar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void onToggleConnectedStatus(
                              app.id,
                              app.status === 'active' ? 'paused' : 'active'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          {app.status === 'active' ? (
                            <>
                              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Pausar</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Activar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onGoToAssistantWithPrompt(
                              `Revisa y ayúdame a operar mi aplicación conectada "${app.name}" (${app.baseUrl}).`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>Pedir a Jarvis</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditForm(app)}
                          aria-label={`Editar ${app.name}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <a
                          href={resolvedHref}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir ${app.name}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        <button
                          type="button"
                          onClick={() => void onDeleteConnectedApp(app.id)}
                          aria-label={`Desconectar ${app.name}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Command Console for this app */}
                    {isConsoleOpen && (
                      <form
                        onSubmit={(e) => void handleRunCommand(e, app)}
                        className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label="Método HTTP"
                            value={cmdMethod}
                            onChange={(e) =>
                              setCmdMethod(e.target.value as ConnectedAppMethod)
                            }
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                          </select>

                          <input
                            type="text"
                            value={cmdPath}
                            onChange={(e) => setCmdPath(e.target.value)}
                            placeholder="/ruta/endpoint (opcional)"
                            className="flex-1 min-w-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />

                          <button
                            type="submit"
                            disabled={isDispatching || app.status === 'paused'}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white transition-colors whitespace-nowrap shrink-0"
                          >
                            {isDispatching ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Enviando...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Ejecutar</span>
                              </>
                            )}
                          </button>
                        </div>

                        {app.status === 'paused' && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Esta aplicación está pausada. Actívala para enviar comandos en vivo.
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={cmdAuthName}
                            onChange={(e) => setCmdAuthName(e.target.value)}
                            placeholder="Header auth opcional (ej. Authorization)"
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                          />
                          <input
                            type="password"
                            value={cmdAuthValue}
                            onChange={(e) => setCmdAuthValue(e.target.value)}
                            placeholder="Valor / Bearer token (solo en memoria)"
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        {(cmdMethod === 'POST' || cmdMethod === 'PUT') && (
                          <textarea
                            rows={3}
                            value={cmdBody}
                            onChange={(e) => setCmdBody(e.target.value)}
                            placeholder='{"action": "sync"}'
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        )}

                        {lastDispatch && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              <span
                                className={
                                  lastDispatch.ok
                                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                    : 'text-red-700 dark:text-red-400 font-semibold'
                                }
                              >
                                HTTP {lastDispatch.httpStatus || 'ERR'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{lastDispatch.latencyMs} ms</span>
                              {lastDispatch.targetUrl && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">
                                    {lastDispatch.targetUrl}
                                  </span>
                                </>
                              )}
                            </div>
                            <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-auto max-h-48">
                              {lastDispatch.error ||
                                lastDispatch.bodyText ||
                                '(Respuesta vacía)'}
                            </pre>
                          </div>
                        )}
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Published Apps Operational Management */}
      <section aria-labelledby="manage-published-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="manage-published-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Control de aplicaciones publicadas (/p/:slug)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Activa o pausa el acceso público en línea, edita en el constructor o conéctalas al asistente con un clic.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {publishedApps.length}{' '}
            {publishedApps.length === 1 ? 'app' : 'apps'}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
          {publishedApps.length === 0 ? (
            <div className="p-8 text-center space-y-1.5">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Aún no tienes aplicaciones publicadas
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Crea y publica aplicaciones desde la pestaña «Crear con prompt» para gestionarlas aquí.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {publishedApps.map((pub) => {
                const publicUrl = `${window.location.origin}/p/${pub.slug}`;
                const alreadyConnected = connectedApps.some(
                  (c) => c.linkedPublishedSlug === pub.slug
                );
                return (
                  <li
                    key={pub.slug}
                    className="px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {pub.title}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          /p/{pub.slug}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            pub.status === 'active'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {pub.status === 'active' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <PauseCircle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {pub.status === 'active'
                              ? 'Online activa'
                              : 'Pausada'}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {pub.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {!alreadyConnected && (
                        <button
                          type="button"
                          onClick={() => void handleQuickConnectPublished(pub)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Conectar a Jarvis</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          void onTogglePublishedStatus(
                            pub.slug,
                            pub.status === 'active' ? 'paused' : 'active'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        {pub.status === 'active' ? (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Activar</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditPublishedInBuilder(pub)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleCopy(publicUrl, pub.slug)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        {copiedKey === pub.slug ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>URL</span>
                          </>
                        )}
                      </button>

                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => void onDeletePublishedApp(pub.slug)}
                        aria-label={`Eliminar ${pub.title}`}
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
    </div>
  );
};
