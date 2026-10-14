import type { IncomingMessage, ServerResponse } from 'node:http';
import accessGrants from '../api-handlers/v1/access/grants';
import revokeAccessGrant from '../api-handlers/v1/access/grants/[id]';
import permissionRequests from '../api-handlers/v1/access/requests';
import decidePermissionRequest from '../api-handlers/v1/access/requests/[id]/decision';
import adminBackup from '../api-handlers/v1/admin/backup';
import adminControls from '../api-handlers/v1/admin/controls';
import accountsArchive from '../api-handlers/v1/accounts/archive';
import accountsList from '../api-handlers/v1/accounts/index';
import accountDetails from '../api-handlers/v1/accounts/[key]';
import resetPassword from '../api-handlers/v1/accounts/[key]/reset-password';
import renewParavetTemporaryPassword from '../api-handlers/v1/accounts/[key]/renew-temp-password';
import activity from '../api-handlers/v1/activity';
import analytics from '../api-handlers/v1/analytics';
import reports from '../api-handlers/v1/reports';
import spayNeuterReport from '../api-handlers/v1/spay-neuter-report';
import dashboardCounts from '../api-handlers/v1/dashboard/counts';
import firstSignin from '../api-handlers/v1/auth/first-signin';
import login from '../api-handlers/v1/auth/login';
import logout from '../api-handlers/v1/auth/logout';
import currentUser from '../api-handlers/v1/auth/me';
import preferences from '../api-handlers/v1/auth/preferences';
import profilePhoto from '../api-handlers/v1/auth/photo';
import profile from '../api-handlers/v1/auth/profile';
import setPassword from '../api-handlers/v1/auth/set-password';
import barangays from '../api-handlers/v1/barangays/index';
import cronMaintenance from '../api-handlers/v1/cron/maintenance';
import health from '../api-handlers/v1/health';
import idVerification from '../api-handlers/v1/id-verification';
import idVerificationPhoto from '../api-handlers/v1/id-verification/[id]/photo';
import idVerificationDecision from '../api-handlers/v1/id-verification/[id]/decision';
import issues from '../api-handlers/v1/issues';
import issue from '../api-handlers/v1/issues/[id]';
import notifications from '../api-handlers/v1/notifications';
import recentlyAdded from '../api-handlers/v1/recently-added';
import search from '../api-handlers/v1/search';
import sampleData from '../api-handlers/v1/sample-data';
import sampleDataBackup from '../api-handlers/v1/sample-data-backup';
import undo from '../api-handlers/v1/undo';
import calendarEvents from '../api-handlers/v1/calendar/events';
import prelistings from '../api-handlers/v1/prelistings/index';
import records from '../api-handlers/v1/records/[dataset]';
import archiveRecords from '../api-handlers/v1/records/[dataset]/archive';
import importRecords from '../api-handlers/v1/records/[dataset]/import';
import undoImport from '../api-handlers/v1/records/[dataset]/undo-import';
import censusSubmissions from '../api-handlers/v1/census/submissions';
import censusSubmission from '../api-handlers/v1/census/submissions/[id]';
import censusAttachment from '../api-handlers/v1/census/submissions/[id]/attachments/[attachmentId]';
import censusAttachments from '../api-handlers/v1/census/submissions/[id]/attachments';
import censusDecisions from '../api-handlers/v1/census/submissions/[id]/decisions';
import censusResubmit from '../api-handlers/v1/census/submissions/[id]/resubmit';
import censusReview from '../api-handlers/v1/census/submissions/[id]/review';
import censusSubmissionStatus from '../api-handlers/v1/census/submissions/[id]/status';
import censusFrontPage from '../api-handlers/v1/census/front-page';
import censusSummary from '../api-handlers/v1/census/summary';

interface RoutedRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  body?: unknown;
  appFeature?: string;
}

type RouteHandler = (req: RoutedRequest, res: ServerResponse) => Promise<void>;

const routeEntries: Array<{ path: string; handler: RouteHandler; feature?: string }> = [
  { path: '/api/v1/access/grants/[id]', handler: revokeAccessGrant },
  { path: '/api/v1/access/grants', handler: accessGrants },
  { path: '/api/v1/access/requests/[id]/decision', handler: decidePermissionRequest },
  { path: '/api/v1/access/requests', handler: permissionRequests },
  { path: '/api/v1/activity', handler: activity, feature: 'reports' },
  { path: '/api/v1/analytics', handler: analytics, feature: 'reports' },
  { path: '/api/v1/reports', handler: reports, feature: 'reports' },
  { path: '/api/v1/spay-neuter-report', handler: spayNeuterReport, feature: 'reports' },
  { path: '/api/v1/dashboard/counts', handler: dashboardCounts },
  { path: '/api/v1/admin/controls', handler: adminControls },
  { path: '/api/v1/admin/backup', handler: adminBackup },
  { path: '/api/v1/health', handler: health },
  { path: '/api/v1/id-verification/[id]/photo', handler: idVerificationPhoto, feature: 'id-verification' },
  { path: '/api/v1/id-verification/[id]/decision', handler: idVerificationDecision, feature: 'id-verification' },
  { path: '/api/v1/id-verification', handler: idVerification, feature: 'id-verification' },
  { path: '/api/v1/issues/[id]', handler: issue },
  { path: '/api/v1/issues', handler: issues },
  { path: '/api/v1/notifications', handler: notifications },
  { path: '/api/v1/recently-added', handler: recentlyAdded },
  { path: '/api/v1/search', handler: search },
  { path: '/api/v1/sample-data', handler: sampleData },
  { path: '/api/v1/sample-data/backup', handler: sampleDataBackup },
  { path: '/api/v1/undo/[token]', handler: undo },
  { path: '/api/v1/calendar/events', handler: calendarEvents },
  { path: '/api/v1/accounts/archive', handler: accountsArchive, feature: 'accounts' },
  { path: '/api/v1/accounts', handler: accountsList, feature: 'accounts' },
  { path: '/api/v1/accounts/[key]', handler: accountDetails, feature: 'accounts' },
  { path: '/api/v1/accounts/[key]/renew-temp-password', handler: renewParavetTemporaryPassword, feature: 'accounts' },
  { path: '/api/v1/accounts/[key]/reset-password', handler: resetPassword, feature: 'accounts' },
  { path: '/api/v1/auth/first-signin', handler: firstSignin },
  { path: '/api/v1/auth/login', handler: login },
  { path: '/api/v1/auth/logout', handler: logout },
  { path: '/api/v1/auth/me', handler: currentUser },
  { path: '/api/v1/auth/preferences', handler: preferences },
  { path: '/api/v1/auth/photo', handler: profilePhoto },
  { path: '/api/v1/auth/profile', handler: profile },
  { path: '/api/v1/auth/set-password', handler: setPassword },
  { path: '/api/v1/barangays', handler: barangays },
  { path: '/api/v1/cron/maintenance', handler: cronMaintenance },
  { path: '/api/v1/census/front-page', handler: censusFrontPage, feature: 'census' },
  { path: '/api/v1/census/summary', handler: censusSummary, feature: 'census' },
  { path: '/api/v1/census/submissions/[id]/attachments/[attachmentId]', handler: censusAttachment, feature: 'census' },
  { path: '/api/v1/census/submissions/[id]/attachments', handler: censusAttachments, feature: 'census' },
  { path: '/api/v1/census/submissions/[id]/decisions', handler: censusDecisions, feature: 'census' },
  { path: '/api/v1/census/submissions/[id]/resubmit', handler: censusResubmit, feature: 'census' },
  { path: '/api/v1/census/submissions/[id]/review', handler: censusReview, feature: 'census' },
  { path: '/api/v1/census/submissions/[id]/status', handler: censusSubmissionStatus, feature: 'census' },
  { path: '/api/v1/census/submissions/[id]', handler: censusSubmission, feature: 'census' },
  { path: '/api/v1/census/submissions', handler: censusSubmissions, feature: 'census' },
  { path: '/api/v1/prelistings', handler: prelistings, feature: 'operations' },
  { path: '/api/v1/records/[dataset]', handler: records },
  { path: '/api/v1/records/[dataset]/archive', handler: archiveRecords },
  { path: '/api/v1/records/[dataset]/import', handler: importRecords },
  { path: '/api/v1/records/[dataset]/undo-import', handler: undoImport },
];

const routes = routeEntries.map((entry) => {
  const names: string[] = [];
  const expression = `^${entry.path.replace(/\[([^\]]+)\]/g, (_match, name: string) => {
    names.push(name);
    return '([^/]+)';
  })}$`;
  return { ...entry, names, expression: new RegExp(expression) };
}).sort((a, b) => a.names.length - b.names.length);

export async function dispatchApi(req: RoutedRequest, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const rewrittenPath = url.searchParams.get('route') ?? req.query?.route;
  const requestPath = Array.isArray(rewrittenPath) ? rewrittenPath[0] : rewrittenPath;
  const pathname = typeof requestPath === 'string' && requestPath.startsWith('/api/v1/')
    ? requestPath
    : url.pathname;
  for (const route of routes) {
    const match = route.expression.exec(pathname);
    if (!match) continue;
    const query = { ...(req.query ?? {}) };
    route.names.forEach((name, index) => {
      query[name] = decodeURIComponent(match[index + 1]);
    });
    req.query = query;
    const dataset = String(query.dataset ?? '');
    req.appFeature = route.feature ?? (
      route.path.startsWith('/api/v1/records/')
        ? route.path.endsWith('/import') || route.path.endsWith('/undo-import')
          ? 'data-management'
          : ['programs', 'participants', 'respondents', 'households', 'animals'].includes(dataset)
            ? 'operations'
            : dataset === 'paravets' ? 'field-team' : 'registry'
        : undefined
    );
    return route.handler(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end('{"error":{"code":"NOT_FOUND","message":"Not found."}}');
}
