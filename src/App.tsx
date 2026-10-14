import type { ReactElement, ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { landingPageForRole, type Capability } from '../shared/permissions';
import { AppShell } from './components/AppShell';
import { LocaleProvider, useT } from './i18n';
import type { Locale } from './i18n/messages';
import { useAuth } from './lib/auth';
import { ReportBasketProvider } from './lib/reportBasket';
import { flatten, NAV } from './nav/nav';
import { DashboardPage } from './pages/DashboardPage';
import { InboxPage } from './pages/InboxPage';
import { RecordsPage } from './pages/RecordsPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { AuditPage, DataQualityPage, ReportsPage } from './pages/InsightsPages';
import { ReportBasketPage } from './pages/ReportBasketPage';
import { BarangaysPage, PrelistingFormPage, PrelistingsPage } from './pages/ReferencePages';
import { LoginPage } from './pages/LoginPage';
import { CensusFormPage } from './pages/census/CensusFormPage';
import { CensusImportPage } from './pages/census/CensusImportPage';
import { CensusFrontPage, CensusSummaryPage } from './pages/census/CensusReports';
import { SubmissionDetailPage } from './pages/census/SubmissionDetailPage';
import { MySubmissionsPage, ReviewListPage } from './pages/census/SubmissionLists';
import { SettingsPage } from './pages/SettingsPage';
import { AccountsPage } from './pages/AccountsPage';
import { AccessGrantsPage, AccessRequestsPage, IdVerificationPage, IssuesPage, NewIssuePage } from './pages/WorkflowPages';
import { MaintenancePage, NotFoundPage, PendingPage } from './pages/StatusPages';

/** Screens that exist. Every other menu URL shows a neutral "being built" page until its module ships. */
const BUILT: Record<string, ReactElement> = {
  '/dashboard': <DashboardPage />,
  '/registry/owners': <RecordsPage dataset="owners" title="Owners" />,
  '/registry/pets': <RecordsPage dataset="pets" title="Pets" />,
  '/registry/respondents': <RecordsPage dataset="respondents" title="Respondents" />,
  '/registry/households': <RecordsPage dataset="households" title="Households" />,
  '/registry/animals': <RecordsPage dataset="animals" title="Animals" />,
  '/registry/participants': <RecordsPage dataset="participants" title="Participants" />,
  '/paravets': <RecordsPage dataset="paravets" title="Paravets" writeCap="paravets.manage" />,
  '/accounts': <AccountsPage />,
  '/prelistings': <PrelistingsPage />,
  '/prelistings/new': <PrelistingFormPage />,
  '/barangays': <BarangaysPage />,
  '/programs': <RecordsPage dataset="programs" title="Programs and events" writeCap="programs.manage" />,
  '/program-day': <RecordsPage dataset="programs" title="Program day records" writeCap="programs.manage" />,
  '/stubs': <RecordsPage dataset="stubs" title="Service stubs" writeCap="stubs.manage" />,
  '/services': <RecordsPage dataset="services" title="Services" writeCap="services.manage" />,
  '/import-export': <DataManagementPage />,
  '/reports': <ReportsPage />,
  '/report-basket': <ReportBasketPage />,
  '/data-quality': <DataQualityPage />,
  '/audit': <AuditPage />,
  '/settings': <SettingsPage />,
  '/id-verification': <IdVerificationPage />,
  '/access': <AccessGrantsPage />,
  '/access/requests': <AccessRequestsPage />,
  '/issues': <IssuesPage />,
  '/issues/new': <NewIssuePage />,
  '/census/new': <CensusFormPage />,
  '/census/import': <CensusImportPage />,
  '/census/mine': <MySubmissionsPage />,
  '/census/review/pending': <ReviewListPage status="pending" />,
  '/census/review/approved': <ReviewListPage status="approved" />,
  '/census/review/rejected': <ReviewListPage status="rejected" />,
  '/census/summary': <CensusSummaryPage />,
  '/census/front-page': <CensusFrontPage />,
};

function Protected({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  const { t } = useT();
  if (status === 'loading') return <p role="status" className="p-8 text-sm text-slate-500">{t('common.loading')}</p>;
  if (status === 'maintenance') return <MaintenancePage />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { account } = useAuth();
  return <Navigate to={account ? landingPageForRole(account.type) : '/login'} replace />;
}

function RequireCapability({ cap, children }: { cap?: Capability; children: ReactElement }) {
  const { account, can } = useAuth();
  return !cap || can(cap) ? children : <Navigate to={account ? landingPageForRole(account.type) : '/login'} replace />;
}

const routes = flatten(NAV.flatMap((section) => section.nodes)).filter(({ node }) => node.to);

export function App() {
  const { account, setLocale } = useAuth();
  return (
    <LocaleProvider key={account?.id ?? 'anonymous'} preferred={account?.locale} onChange={account ? setLocale : undefined}>
      <ReportBasketProvider><Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Protected><AppShell /></Protected>}>
          <Route index element={<HomeRedirect />} />
          {routes.map(({ node }) => (
            <Route key={node.id} path={node.to} element={<RequireCapability cap={node.cap}>{BUILT[node.to!] ?? <PendingPage />}</RequireCapability>} />
          ))}
          <Route path="/census/mine/:id" element={<RequireCapability cap="census.submit"><SubmissionDetailPage /></RequireCapability>} />
          <Route path="/census/mine/:id/edit" element={<RequireCapability cap="census.submit"><CensusFormPage /></RequireCapability>} />
          <Route path="/census/review/:status/:id" element={<RequireCapability cap="census.review"><SubmissionDetailPage /></RequireCapability>} />
          <Route path="/settings" element={BUILT['/settings']} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes></ReportBasketProvider>
    </LocaleProvider>
  );
}
