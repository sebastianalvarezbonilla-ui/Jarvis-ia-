import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Globe,
  Loader2,
  Search,
  Volume2,
} from 'lucide-react';
import type {
  ConnectedAppRecord,
  MemoryEntry,
  PublishedAppRecord,
  RouterProfileRecord,
  TraceRecord,
  WebPageReadResult,
  WebSearchResultItem,
} from '../types/jarvis';

interface SearchWebReaderViewProps {
  memories: MemoryEntry[];
  publishedApps: PublishedAppRecord[];
  connectedApps: ConnectedAppRecord[];
  routerProfiles: RouterProfileRecord[];
  traces: TraceRecord[];
  onSearchWeb: (query: string) => Promise<{
    answer: string;
    results: WebSearchResultItem[];
    model: string;
    latencyMs: number;
  }>;
  onReadWebPage: (
    url: string,
    question?: string
  ) => Promise<WebPageReadResult>;
  onSpeakText: (text: string) => void;
}

export const SearchWebReaderView: React.FC<SearchWebReaderViewProps> = ({
  memories,
  publishedApps,
  connectedApps,
  routerProfiles,
  traces,
  onSearchWeb,
  onReadWebPage,
  onSpeakText,
}) => {
  // Internal + Web Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [includeWeb, setIncludeWeb] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [webSearchData, setWebSearchData] = useState<{
    answer: string;
    results: WebSearchResultItem[];
    model: string;
    latencyMs: number;
  } | null>(null);

  // Universal Web Page Reader State
  const [readerUrl, setReaderUrl] = useState('');
  const [readerQuestion, setReaderQuestion] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [pageData, setPageData] = useState<WebPageReadResult | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Instant Local Workspace Search across all entities
  const localMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{
      kind: string;
      title: string;
      detail: string;
      href?: string;
    }> = [];

    for (const m of memories) {
      if (
        m.content.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      ) {
        results.push({
          kind: `Memoria (${m.category})`,
          title: m.content.slice(0, 90),
          detail: m.createdAt,
        });
      }
    }
    for (const a of publishedApps) {
      if (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q)
      ) {
        results.push({
          kind: 'App Publicada',
          title: a.title,
          detail: `/p/${a.slug} · ${a.summary}`,
          href: `/p/${a.slug}`,
        });
      }
    }
    for (const c of connectedApps) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.baseUrl.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      ) {
        results.push({
          kind: 'App Conectada',
          title: c.name,
          detail: `${c.baseUrl} · ${c.status}`,
        });
      }
    }
    for (const r of routerProfiles) {
      if (
        r.name.toLowerCase().includes(q) ||
        r.wifiName.toLowerCase().includes(q) ||
        r.vendor.toLowerCase().includes(q)
      ) {
        results.push({
          kind: 'Router',
          title: r.name,
          detail: `${r.vendor} · Wi-Fi: ${r.wifiName}`,
        });
      }
    }
    for (const t of traces.slice(0, 20)) {
      if (
        t.model.toLowerCase().includes(q) ||
        t.operation.toLowerCase().includes(q)
      ) {
        results.push({
          kind: 'Traza',
          title: `${t.operation} (${t.model})`,
          detail: `${t.timestamp} · ${t.latencyMs} ms`,
        });
      }
    }
    return results.slice(0, 14);
  }, [
    searchQuery,
    memories,
    publishedApps,
    connectedApps,
    routerProfiles,
    traces,
  ]);

  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !includeWeb || isSearching) return;
    setErrorMsg(null);
    setIsSearching(true);
    try {
      const res = await onSearchWeb(searchQuery.trim());
      setWebSearchData(res);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la búsqueda web.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleReadUrl = async (targetUrl?: string, customQ?: string) => {
    const urlToLoad = (targetUrl ?? readerUrl).trim();
    if (!urlToLoad || isReading) return;
    if (targetUrl) setReaderUrl(targetUrl);
    setErrorMsg(null);
    setIsReading(true);
    try {
      const result = await onReadWebPage(
        urlToLoad,
        customQ !== undefined ? customQ : readerQuestion.trim()
      );
      setPageData(result);
      setShowRawText(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo leer la página web solicitada.'
      );
    } finally {
      setIsReading(false);
    }
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Internal Workspace + Live Web Search */}
        <section
          aria-labelledby="internal-search-heading"
          className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2
                id="internal-search-heading"
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                Buscador Interno y Web (Google)
              </h2>
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWeb}
                onChange={(e) => setIncludeWeb(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Buscar también en Internet</span>
            </label>
          </div>

          <form onSubmit={(e) => void handleRunSearch(e)} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Busca en tus memorias, apps, routers o cualquier tema en Google..."
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={!searchQuery.trim() || !includeWeb || isSearching}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-45 text-white transition-colors whitespace-nowrap shrink-0"
            >
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <span>Buscar</span>
            </button>
          </form>

          {/* Local Instant Results */}
          {searchQuery.trim() && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Coincidencias en tu espacio de trabajo ({localMatches.length})
              </div>
              {localMatches.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sin coincidencias locales para «{searchQuery}».
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {localMatches.map((item, idx) => (
                    <li key={idx} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.kind}
                        </div>
                        <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.detail}
                        </div>
                      </div>
                      {item.href && (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-blue-600 hover:underline shrink-0"
                        >
                          Abrir
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Live Google Search Grounded Results */}
          {webSearchData && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Respuesta web verificada
                </span>
                <span className="font-mono tabular-nums">
                  {webSearchData.model} · {webSearchData.latencyMs} ms
                </span>
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {webSearchData.answer}
              </p>

              {webSearchData.results.length > 0 && (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {webSearchData.results.map((r, idx) => (
                    <li
                      key={idx}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {r.title}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                          {r.domain}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleReadUrl(r.url, '')}
                          className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          Leer página
                        </button>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir ${r.title}`}
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Right: Universal Web Page Reader */}
        <section
          aria-labelledby="web-reader-heading"
          className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h2
                id="web-reader-heading"
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                Lector de Cualquier Página Web
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pega cualquier URL pública para extraer su texto, enlaces, resumen en español o hacerle preguntas.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleReadUrl();
            }}
            className="space-y-2.5"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={readerUrl}
                onChange={(e) => setReaderUrl(e.target.value)}
                placeholder="https://es.wikipedia.org/wiki/Inteligencia_artificial"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={!readerUrl.trim() || isReading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-45 text-white transition-colors whitespace-nowrap shrink-0"
              >
                {isReading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Leyendo...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Leer página</span>
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              value={readerQuestion}
              onChange={(e) => setReaderQuestion(e.target.value)}
              placeholder="Pregunta opcional sobre la página (ej. ¿Cuáles son los precios o conclusiones clave?)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </form>

          {pageData && (
            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {pageData.title}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                    {pageData.wordCount} palabras · ~{pageData.readingTimeMin} min lectura · {pageData.latencyMs} ms
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSpeakText(pageData.aiSummary)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 whitespace-nowrap"
                >
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Escuchar resumen</span>
                </button>
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {pageData.aiSummary}
              </div>

              {pageData.links.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Enlaces descubiertos (clic para leer dentro de OpenJarvis)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pageData.links.slice(0, 8).map((lnk, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => void handleReadUrl(lnk.url, '')}
                        className="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 truncate max-w-[220px]"
                      >
                        {lnk.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowRawText((v) => !v)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showRawText
                    ? 'Ocultar texto completo extraído'
                    : 'Ver texto completo extraído'}
                </button>
                {showRawText && (
                  <pre className="mt-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-700 dark:text-slate-300 max-h-[260px] overflow-y-auto whitespace-pre-wrap">
                    {pageData.extractedText}
                  </pre>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
