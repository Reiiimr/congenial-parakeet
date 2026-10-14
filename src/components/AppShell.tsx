import { ArrowLeft, ArrowUp, Bell, LoaderCircle, Menu, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useT } from '../i18n';
import { filterNav, findActive, flatten, NAV, type NavNode } from '../nav/nav';
import { Sidebar } from './Sidebar';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useReportBasket } from '../lib/reportBasket';

const COLLAPSE_KEY = 'cv.nav.collapsed';

interface SearchResult {
  kind: string;
  dataset: string;
  id: string;
  label: string;
  detail: string;
  to: string;
}

function UniversalSearch({ value, onChange, results, loading, error }: {
  value: string;
  onChange: (value: string) => void;
  results: SearchResult[];
  loading: boolean;
  error: string;
}) {
  const { t } = useT();
  const open = value.trim().length >= 2;
  return (
    <div className="relative min-w-0 flex-1">
      <Search aria-hidden className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.label')}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900" />
      {open && <div role="listbox" aria-label={t('search.results')} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-surface-dark">
        {loading && <p className="px-4 py-3 text-sm text-slate-500">{t('search.loading')}</p>}
        {!loading && error && <p role="alert" className="px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        {!loading && !error && results.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">{t('search.empty')}</p>}
        {!loading && !error && results.map((item) => <Link key={`${item.kind}:${item.id}`} role="option" aria-selected="false" to={item.to} onClick={() => onChange('')}
          className="block border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
          <span className="block text-sm font-medium">{item.label}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">{item.kind === 'account' ? t('search.account') : item.kind === 'submission' ? t('search.submission') : item.kind === 'page' ? t('search.page') : item.dataset} · {item.detail}</span>
        </Link>)}
      </div>}
    </div>
  );
}

export function useVisibleNav(): NavNode[] {
  const { can, featureEnabled } = useAuth();
  return useMemo(
    () => filterNav(NAV.flatMap((section) => section.nodes), (node) => (!node.cap || can(node.cap)) && featureEnabled(node.feature)),
    [can, featureEnabled],
  );
}

export function AppShell() {
  const { t } = useT();
  const { account } = useAuth();
  const { items: reportItems } = useReportBasket();
  const location = useLocation();
  const navigate = useNavigate();
  const nodes = useVisibleNav();
  const trail = useMemo(() => findActive(nodes, location.pathname), [nodes, location.pathname]);
  const activeId = trail?.node.id ?? null;
  const activeAncestors = useMemo(() => trail?.ancestors.map((node) => node.id) ?? [], [trail]);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [dbState, setDbState] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [errorLog, setErrorLog] = useState('');
  const [unread, setUnread] = useState(0);
  const [successLog, setSuccessLog] = useState('');
  const [pendingWrites, setPendingWrites] = useState(0);
  const [showReturnTop, setShowReturnTop] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    const check = async () => {
      try { await api('GET', '/health'); if (live) setDbState('connected'); }
      catch { if (live) setDbState('offline'); }
    };
    void check();
    const timer = window.setInterval(() => {
      void check();
      void api<{ unread: number }>('GET', '/notifications').then((x) => { if (live) setUnread(x.unread); }).catch(() => {});
    }, 15000);
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; status?: number }>).detail;
      const message = `${new Date().toLocaleTimeString()} · ${detail?.status ?? 'API'} · ${detail?.message ?? 'Request failed'}`;
      setErrorLog(message);
      setSuccessLog(`Action failed · ${detail?.message ?? 'Request failed'}`);
    };
    const onSuccess = (event: Event) => setSuccessLog((event as CustomEvent<{ message?: string }>).detail?.message ?? 'Action completed successfully.');
    const onRequestStart = () => setPendingWrites((count) => count + 1);
    const onRequestEnd = () => setPendingWrites((count) => Math.max(0, count - 1));
    window.addEventListener('cv:api-error', onError);
    window.addEventListener('cv:api-success', onSuccess);
    window.addEventListener('cv:api-request-start', onRequestStart);
    window.addEventListener('cv:api-request-end', onRequestEnd);
    void api<{ unread: number }>('GET', '/notifications').then((x) => { if (live) setUnread(x.unread); }).catch(() => {});
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener('cv:api-error', onError);
      window.removeEventListener('cv:api-success', onSuccess);
      window.removeEventListener('cv:api-request-start', onRequestStart);
      window.removeEventListener('cv:api-request-end', onRequestEnd);
    };
  }, []);
  useEffect(() => {
    if (!successLog) return;
    const timeout = window.setTimeout(() => setSuccessLog(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [successLog]);
  useEffect(() => {
    if (!errorLog) return;
    const timeout = window.setTimeout(() => setErrorLog(''), (account?.errorDurationMinutes ?? 5) * 60_000);
    return () => window.clearTimeout(timeout);
  }, [account?.errorDurationMinutes, errorLog]);
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    let live = true;
    const pages = flatten(nodes)
      .filter(({ node }) => node.to && t(node.label).toLowerCase().includes(term.toLowerCase()))
      .map(({ node }) => ({ kind: 'page', dataset: 'navigation', id: node.id, label: t(node.label), detail: t('search.page'), to: node.to! }));
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void api<{ data: SearchResult[] }>('GET', `/search?q=${encodeURIComponent(term)}`)
        .then((result) => { if (live) { setSearchResults([...pages, ...result.data].slice(0, 30)); setSearchError(''); } })
        .catch((error: unknown) => { if (live) { setSearchResults([]); setSearchError(error instanceof Error ? error.message : t('search.failed')); } })
        .finally(() => { if (live) setSearchLoading(false); });
    }, 300);
    return () => { live = false; window.clearTimeout(timer); };
  }, [search, t, nodes]);

  const toggleCollapsed = () => setCollapsed((value) => {
    try { localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1'); } catch { /* storage unavailable */ }
    return !value;
  });

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const onScroll = () => setShowReturnTop(main.scrollTop > 500);
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!account || location.pathname === '/dashboard' || location.pathname === '/login') return;
    try { localStorage.setItem(`cv.last-page.${account.id}`, `${location.pathname}${location.search}`); } catch { /* storage unavailable */ }
  }, [account, location.pathname, location.search]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [drawer]);

  return (
    <div className="flex h-dvh gap-3 p-3 print:block print:h-auto print:p-0">
      <aside className={`hidden shrink-0 transition-[width] duration-200 md:block print:hidden ${collapsed ? 'w-[76px]' : 'w-72'}`}>
        <Sidebar nodes={nodes} activeId={activeId} activeAncestors={activeAncestors} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <header className="mb-3 flex items-center gap-3 md:hidden print:hidden">
          <button type="button" onClick={() => setDrawer(true)} aria-label={t('nav.menu')}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-surface-dark dark:text-slate-300">
            <Menu aria-hidden className="h-5 w-5" />
          </button>
          <p className="hidden truncate text-sm font-semibold sm:block">{t('app.name')}</p>
          <UniversalSearch value={search} onChange={setSearch} results={searchResults} loading={searchLoading} error={searchError} />
          <Link to="/report-basket" className="relative rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">Basket{reportItems.length > 0 && <span className="ml-1 rounded-full bg-brand-700 px-1.5 text-white">{reportItems.length}</span>}</Link>
        </header>
        <header className="mb-3 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-panel dark:border-slate-800 dark:bg-surface-dark md:flex print:hidden">
          <UniversalSearch value={search} onChange={setSearch} results={searchResults} loading={searchLoading} error={searchError} />
          <Link to="/report-basket" className="relative rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">Report basket{reportItems.length > 0 && <span className="ml-1 rounded-full bg-brand-700 px-1.5 text-white">{reportItems.length}</span>}</Link>
          <Link to="/inbox" aria-label={`Notifications, ${unread} unread`} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Bell aria-hidden className="h-5 w-5" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] text-white">{unread}</span>}</Link>
          <span title={errorLog ? `Last API error: ${errorLog}` : 'API and database health'} className={`rounded-full px-2.5 py-1 text-xs ${dbState === 'connected' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : dbState === 'offline' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-50 text-amber-700'}`}>Database {dbState}</span>
        </header>
        {errorLog && <div role="status" className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"><span>Latest API error: {errorLog}</span><button type="button" onClick={() => setErrorLog('')} aria-label={t('common.close')} className="shrink-0 rounded p-0.5 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900"><X aria-hidden className="h-4 w-4" /></button></div>}
        <main id="main" className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-surface-dark md:p-8 print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {location.pathname !== '/dashboard' && <div className="mb-4 print:hidden"><button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowLeft aria-hidden className="h-4 w-4" />{t('common.back')}</button></div>}
          {pendingWrites > 0 && <div role="status" className="fixed right-4 top-4 z-[60] inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-medium text-brand-800 shadow-lg dark:border-brand-900 dark:bg-surface-dark dark:text-brand-100"><LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />Working…</div>}
          <div key={location.pathname} className="page-transition"><Outlet /></div>
        </main>
      </div>

      {successLog && <div role="status" className={`fixed right-4 top-4 z-[60] flex max-w-sm items-start gap-3 rounded-lg border px-3 py-2 text-xs shadow-lg ${successLog.startsWith('Action failed') ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'}`}><span>{successLog}</span><button type="button" aria-label={t('common.close')} onClick={() => setSuccessLog('')} className="shrink-0"><X aria-hidden className="h-3.5 w-3.5" /></button></div>}
      {showReturnTop && <button type="button" onClick={() => document.getElementById('main')?.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 print:hidden"><ArrowUp aria-hidden className="h-4 w-4" />Return to Top</button>}

      {drawer && createPortal(
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
          <button type="button" aria-label={t('nav.close')} tabIndex={-1} onClick={() => setDrawer(false)} className="absolute inset-0 bg-slate-900/50" />
          <div className="absolute inset-y-0 left-0 w-[19rem] max-w-[88vw] p-3">
            <button ref={closeRef} type="button" onClick={() => setDrawer(false)} aria-label={t('nav.close')}
              className="absolute right-5 top-5 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800">
              <X aria-hidden className="h-4 w-4" />
            </button>
            <Sidebar nodes={nodes} activeId={activeId} activeAncestors={activeAncestors} collapsed={false} onNavigate={() => setDrawer(false)} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
