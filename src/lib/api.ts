export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

const AUTH_PATHS = /^\/auth\/(login|first-signin|set-password|me)/;

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const trackMutation = method !== 'GET' && !/^\/auth\/(login|first-signin|set-password|me|logout)/.test(path);
  if (trackMutation) window.dispatchEvent(new CustomEvent('cv:api-request-start'));
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const error = new ApiError(0, 'NETWORK_ERROR', 'The local API could not be reached. Check that the API and database are running.');
    window.dispatchEvent(new CustomEvent('cv:api-error', { detail: { message: error.message, code: error.code, status: error.status } }));
    if (trackMutation) window.dispatchEvent(new CustomEvent('cv:api-request-end'));
    throw error;
  }
  let data: any = null;
  try { data = await response.json(); } catch { /* empty body */ }
  if (!response.ok) {
    const error = new ApiError(response.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'The request failed.', data?.error?.details);
    if (response.status === 401 && !AUTH_PATHS.test(path)) window.dispatchEvent(new Event('cv:unauthenticated'));
    window.dispatchEvent(new CustomEvent('cv:api-error', { detail: { message: error.message, code: error.code, status: error.status } }));
    if (trackMutation) window.dispatchEvent(new CustomEvent('cv:api-request-end'));
    throw error;
  }
  if (trackMutation) {
    const resource = path.split('?')[0].split('/').filter(Boolean).slice(-1)[0]?.replaceAll('-', ' ') ?? 'record';
    const action = method === 'POST' ? 'Saved' : method === 'PATCH' ? 'Updated' : method === 'DELETE' ? 'Removed' : 'Updated';
    window.dispatchEvent(new CustomEvent('cv:api-success', { detail: { message: `${action} successfully · ${resource}` } }));
    window.dispatchEvent(new CustomEvent('cv:api-request-end'));
  }
  return data as T;
}
