export const SESSION_COOKIE = 'lexbridge.sid';
export const CSRF_HEADER = 'x-lexbridge-request';
export const CSRF_HEADER_VALUE = '1';
export const PDF_EXPORT_QUEUE = 'pdf-export';

export { exportPdfPath, resolveExportDir } from './export-paths';

export const OrgRole = {
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  READER: 'READER',
} as const;

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const Permission = {
  DocumentRead: 'document:read',
  DocumentWrite: 'document:write',
  ChatAsk: 'chat:ask',
  ExportOwn: 'export:own',
  MemberInvite: 'member:invite',
  MemberRoleChange: 'member:role:change',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  [OrgRole.READER]: [Permission.DocumentRead, Permission.ChatAsk, Permission.ExportOwn],
  [OrgRole.EDITOR]: [
    Permission.DocumentRead,
    Permission.DocumentWrite,
    Permission.ChatAsk,
    Permission.ExportOwn,
  ],
  [OrgRole.ADMIN]: ALL_PERMISSIONS,
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isSafeReturnPath(value: string | undefined | null): boolean {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.startsWith('/\\')) return false;
  if (value.includes('\\')) return false;
  if (value.includes('://')) return false;
  if (value.includes('\0')) return false;
  return true;
}

export function chunkText(body: string, size = 700): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  const parts: string[] = [];
  let rest = trimmed;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size / 2) cut = rest.lastIndexOf(' ', size);
    if (cut < size / 2) cut = size;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export const INSUFFICIENT_ANSWER =
  'The available documents do not support an answer to this question.';

export const LOGIN_RATE_LIMIT = 10;
export const LOGIN_RATE_WINDOW_SECONDS = 60;
export const ASK_RATE_LIMIT = 20;
export const ASK_RATE_WINDOW_SECONDS = 60 * 60;
