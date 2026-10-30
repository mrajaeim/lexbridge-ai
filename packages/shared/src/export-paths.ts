import { readFileSync } from 'fs';
import { isAbsolute, join, relative, resolve } from 'path';

function workspaceRoot(start: string): string | null {
  let dir = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { workspaces?: unknown };
      if (pkg.workspaces) return dir;
    } catch {
      // This directory has no readable package.json.
    }
    const parent = resolve(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function isInside(child: string, parent: string): boolean {
  const fromParent = relative(parent, child);
  return fromParent === '' || (!fromParent.startsWith('..') && !isAbsolute(fromParent));
}

/**
 * Resolve EXPORT_DIR to an absolute path shared by the API and worker.
 * Relative paths are based on the repository root so each app's cwd does not
 * create a separate storage/exports directory. `../../storage/exports` from an
 * app package still lands in that same repository directory.
 */
export function resolveExportDir(cwd = process.cwd()): string {
  const configured = process.env.EXPORT_DIR ?? 'storage/exports';
  if (isAbsolute(configured)) return configured;
  const root = workspaceRoot(cwd);
  if (!root) return resolve(cwd, configured);
  const fromCwd = resolve(cwd, configured);
  if (configured.includes('..') && isInside(fromCwd, root)) return fromCwd;
  return resolve(root, configured);
}

export function exportPdfPath(exportDir: string, organizationId: string, exportJobId: string): string {
  return join(exportDir, organizationId, `${exportJobId}.pdf`);
}
