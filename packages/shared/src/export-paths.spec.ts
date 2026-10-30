import { join, resolve } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportPdfPath, resolveExportDir } from './export-paths';

const repoRoot = resolve(__dirname, '../../..');
const previousExportDir = process.env.EXPORT_DIR;

afterEach(() => {
  if (previousExportDir === undefined) delete process.env.EXPORT_DIR;
  else process.env.EXPORT_DIR = previousExportDir;
});

describe('export paths', () => {
  it('resolves relative export dirs from cwd when there is no workspace', () => {
    delete process.env.EXPORT_DIR;
    expect(resolveExportDir('/tmp/app')).toBe(resolve('/tmp/app', 'storage/exports'));
  });

  it('uses one export directory for the api and worker working directories', () => {
    process.env.EXPORT_DIR = 'storage/exports';
    const expected = resolve(repoRoot, 'storage/exports');
    expect(resolveExportDir(join(repoRoot, 'apps/api'))).toBe(expected);
    expect(resolveExportDir(join(repoRoot, 'apps/worker'))).toBe(expected);
    expect(resolveExportDir(repoRoot)).toBe(expected);
  });

  it('keeps an app-relative export dir inside the repository', () => {
    process.env.EXPORT_DIR = '../../storage/exports';
    const expected = resolve(repoRoot, 'storage/exports');
    expect(resolveExportDir(join(repoRoot, 'apps/api'))).toBe(expected);
    expect(resolveExportDir(join(repoRoot, 'apps/worker'))).toBe(expected);
  });

  it('keeps absolute export dirs unchanged', () => {
    const absolute = resolve('/data/exports');
    process.env.EXPORT_DIR = absolute;
    expect(resolveExportDir(join(repoRoot, 'apps/api'))).toBe(absolute);
  });

  it('builds a stable pdf path from org and job id', () => {
    const path = exportPdfPath('/data/exports', 'org-1', 'job-1');
    expect(path).toBe(join('/data/exports', 'org-1', 'job-1.pdf'));
  });
});
