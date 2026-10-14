import { describe, expect, it } from 'vitest';
import { can, landingPageForRole, rolesWith, type Role } from '../shared/permissions';

const roles: Role[] = ['SuperAdmin', 'Admin', 'Paravet', 'User'];

describe('role capability map', () => {
  it('sends every role to a page it can access', () => {
    for (const role of roles) {
      const page = landingPageForRole(role);
      expect(page).toBe(role === 'User' ? '/settings' : '/dashboard');
      if (page === '/dashboard') expect(can({ role }, 'dashboard.view')).toBe(true);
    }
    expect(landingPageForRole('User')).toBe('/settings');
  });

  it('keeps staff-only capabilities out of User and Paravet permissions', () => {
    for (const role of ['User', 'Paravet'] as const) {
      expect(can({ role }, 'accounts.manage_portal')).toBe(false);
      expect(can({ role }, 'grants.manage')).toBe(false);
      expect(can({ role }, 'issues.manage')).toBe(false);
      expect(can({ role }, 'system.backup')).toBe(false);
    }
    expect(rolesWith('dashboard.view')).toEqual(['SuperAdmin', 'Admin', 'Paravet']);
  });

  it('only unlocks grant-backed capabilities for a matching active grant', () => {
    expect(can({ role: 'Admin' }, 'registry.archive')).toBe(false);
    expect(can({ role: 'Admin', grants: ['archive'] }, 'registry.archive')).toBe(true);
    expect(can({ role: 'Admin', grants: ['restore'] }, 'registry.archive')).toBe(false);
  });
});
