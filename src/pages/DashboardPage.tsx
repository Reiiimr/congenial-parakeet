import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useVisibleNav } from '../components/AppShell';
import { Loading, Modal, Notice, btnGhost, btnPrimary } from '../components/ui';
import { useT } from '../i18n';
import { useAuth } from '../lib/auth';
import { flatten } from '../nav/nav';
import { CalendarPage } from './CalendarPage';
import { useApi } from '../lib/useApi';

interface RecentItem { id: string; dataset: string; label: string; updatedAt: string; to: string }
type DashboardCounts = { counts: Record<string, number> };

export function DashboardPage() {
  const { t } = useT();
  const { account } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nodes = useVisibleNav();
  const links = flatten(nodes).filter(({ node }) => node.to && node.id !== 'dashboard');
  const { data: recent, loading: recentLoading, error: recentError } = useApi<{ data: RecentItem[] }>('/recently-added');
  const { data: dashboardCounts, loading: countsLoading, error: countsError } = useApi<DashboardCounts>('/dashboard/counts');
  const resumePath = (location.state as { resumePath?: unknown } | null)?.resumePath;
  const closeResume = () => navigate('/dashboard', { replace: true, state: null });
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
      <section>
      <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.welcome', { name: account?.name ?? '' })}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {t('common.signedInAs', { name: account?.type ?? '' })}{account?.barangay ? ` · ${account.barangay}` : ''}
      </p>
      <h2 className="mb-2 mt-5 text-sm font-semibold text-slate-500">{t('dashboard.sections')}</h2>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {links.map(({ node, ancestors }) => {
          const Icon = node.icon;
          return (
            <li key={node.id}>
              <Link to={node.to!} className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 text-sm transition-colors hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:hover:bg-brand-900/30">
                {Icon && <Icon aria-hidden className="h-4 w-4 shrink-0 text-brand-600" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t(node.label)}</span>
                  {ancestors[0] && <span className="block truncate text-xs text-slate-400">{t(ancestors[0].label)}</span>}
                </span>
                <span aria-label={`${dashboardCounts?.counts[node.id] ?? 0} associated items`} className="ml-auto min-w-9 rounded-full bg-slate-100 px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-200">{dashboardCounts ? dashboardCounts.counts[node.id] ?? 0 : '…'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      </section>
      <section aria-labelledby="dashboard-calendar" className="min-w-0">
        <CalendarPage embedded />
      </section>
      </div>
      <section aria-labelledby="recent-title" className="mx-auto w-full max-w-5xl">
        <h2 id="recent-title" className="text-center text-lg font-semibold">Recently added</h2>
        <p className="mt-1 text-center text-sm text-slate-500">The 10 most recently updated records and portal accounts.</p>
        {countsError && <div className="mt-3"><Notice kind="error">{countsError.message}</Notice></div>}
        {recentError && <div className="mt-3"><Notice kind="error">{recentError.message}</Notice></div>}
        {(countsLoading || recentLoading) && <div className="mt-3"><Loading /></div>}
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {(recent?.data ?? []).map((item) => <li key={`${item.dataset}:${item.id}`}>
            <Link to={item.to} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span><strong className="font-medium">{item.label}</strong><span className="ml-2 text-xs capitalize text-slate-500">{item.dataset}</span></span>
              <time className="shrink-0 text-xs text-slate-500">{new Date(item.updatedAt).toLocaleDateString()}</time>
            </Link>
          </li>)}
          {recent?.data.length === 0 && <li className="px-4 py-5 text-sm text-slate-500">No recent records.</li>}
        </ul>
      </section>
      {typeof resumePath === 'string' && <Modal title="Continue where you left off?" onClose={closeResume}>
        <p className="text-sm text-slate-600 dark:text-slate-300">You last visited <span className="font-medium">{resumePath.split('?')[0].replaceAll('/', ' › ').slice(3) || 'the dashboard'}</span>.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={closeResume} className={btnGhost}>Go to dashboard</button>
          <button type="button" onClick={() => navigate(resumePath, { replace: true, state: null })} className={btnPrimary}>Continue</button>
        </div>
      </Modal>}
    </div>
  );
}
