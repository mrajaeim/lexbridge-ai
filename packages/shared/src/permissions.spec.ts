import { describe, expect, it } from 'vitest';
import { OrgRole, Permission, ROLE_PERMISSIONS, hasPermission, isSafeReturnPath } from './index';

const expected: Record<OrgRole, Permission[]> = {
  [OrgRole.READER]: [Permission.DocumentRead, Permission.ChatAsk, Permission.ExportOwn],
  [OrgRole.EDITOR]: [
    Permission.DocumentRead,
    Permission.DocumentWrite,
    Permission.ChatAsk,
    Permission.ExportOwn,
  ],
  [OrgRole.ADMIN]: Object.values(Permission),
};

describe('role permission matrix', () => {
  const roles = Object.values(OrgRole);
  const permissions = Object.values(Permission);

  it('covers every role and permission exactly once in the matrix table', () => {
    expect(roles).toHaveLength(3);
    expect(permissions).toHaveLength(6);
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...roles].sort());
  });

  for (const role of Object.values(OrgRole)) {
    for (const permission of Object.values(Permission)) {
      it(`${role} ${permission}`, () => {
        expect(hasPermission(role, permission)).toBe(expected[role].includes(permission));
      });
    }
  }
});

describe('isSafeReturnPath', () => {
  it('allows relative application paths', () => {
    expect(isSafeReturnPath('/app')).toBe(true);
    expect(isSafeReturnPath('/invite?token=abc')).toBe(true);
    expect(isSafeReturnPath('/app/chat')).toBe(true);
  });

  it('rejects absolute and protocol-relative redirects', () => {
    expect(isSafeReturnPath('https://evil.example/phish')).toBe(false);
    expect(isSafeReturnPath('http://evil.example')).toBe(false);
    expect(isSafeReturnPath('//evil.example')).toBe(false);
    expect(isSafeReturnPath('/\\evil.example')).toBe(false);
    expect(isSafeReturnPath('')).toBe(false);
    expect(isSafeReturnPath(null)).toBe(false);
    expect(isSafeReturnPath('app')).toBe(false);
  });
});
