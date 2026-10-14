import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { can, type Capability, type GrantPermission, type Principal, type Role } from '../../shared/permissions';
import type { Locale } from '../i18n/messages';
import { api, ApiError } from './api';

export interface Account {
  id: number;
  type: Role;
  name: string;
  username: string | null;
  accountKey: string | null;
  barangayId: number | null;
  barangay: string | null;
  locale?: Locale;
  theme?: 'light' | 'dark';
  errorDurationMinutes?: number;
  profilePhoto?: string | null;
  grants?: GrantPermission[];
}

interface Controls { maintenanceMode: boolean; featureAccess: Record<string, boolean> }

interface AuthState {
  status: 'loading' | 'anonymous' | 'maintenance' | 'ready';
  account: Account | null;
  controls: Controls | null;
  principal: Principal | null;
  can: (capability: Capability) => boolean;
  featureEnabled: (feature?: string) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setLocale: (locale: Locale) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [controls, setControls] = useState<Controls | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ account: Account }>('GET', '/auth/me');
      const info = await api<{ maintenanceMode: boolean; featureAccess: { accountType: string; featureKey: string; enabled: boolean }[] }>('GET', '/admin/controls').catch(() => null);
      setAccount(me.account);
      document.documentElement.classList.toggle('dark', me.account.theme === 'dark');
      try { localStorage.setItem('cv.theme', me.account.theme === 'dark' ? 'dark' : 'light'); } catch { /* storage unavailable */ }
      setControls(info ? {
        maintenanceMode: info.maintenanceMode,
        featureAccess: Object.fromEntries(info.featureAccess.map((item) => [`${item.accountType}:${item.featureKey}`, item.enabled])),
      } : null);
      setStatus('ready');
    } catch (error) {
      setAccount(null);
      setControls(null);
      setStatus(error instanceof ApiError && error.code === 'MAINTENANCE_MODE' ? 'maintenance' : 'anonymous');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onExpired = () => { setAccount(null); setStatus('anonymous'); };
    window.addEventListener('cv:unauthenticated', onExpired);
    return () => window.removeEventListener('cv:unauthenticated', onExpired);
  }, []);

  const principal = useMemo<Principal | null>(
    () => (account ? { role: account.type, grants: account.grants ?? [] } : null), [account]);

  const value = useMemo<AuthState>(() => ({
    status, account, controls, principal,
    can: (capability) => can(principal, capability),
    featureEnabled: (feature) => {
      if (!feature || !account || account.type === 'SuperAdmin') return true;
      return controls?.featureAccess[`${account.type}:${feature}`] !== false;
    },
    refresh,
    logout: async () => {
      await api('POST', '/auth/logout', {}).catch(() => undefined);
      setAccount(null);
      setStatus('anonymous');
    },
    setLocale: (locale) => {
      void api('PUT', '/auth/preferences', { locale }).catch((error: unknown) => {
        window.dispatchEvent(new CustomEvent('cv:api-error', { detail: { message: error instanceof Error ? error.message : 'Could not save language preference.' } }));
      });
    },
  }), [status, account, controls, principal, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
