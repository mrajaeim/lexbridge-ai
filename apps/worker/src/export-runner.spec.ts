import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ExportRecord, ExportStore, runExport } from './export-runner';
import { renderPdf } from './pdf-renderer';

function sample(): ExportRecord {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    conversationId: 'conv-1',
    status: 'QUEUED',
    attempts: 0,
    error: null,
    filePath: null,
    conversation: {
      title: 'Harbor notice',
      messages: [
        { role: 'USER', content: 'What is the notice period?', citations: [] },
        {
          role: 'ASSISTANT',
          content: 'Thirty days written notice.',
          citations: [{ label: 'Harbor Services Agreement', excerpt: 'thirty days' }],
        },
      ],
    },
  };
}

function memoryStore(job: ExportRecord): ExportStore & { history: ExportRecord[] } {
  const history: ExportRecord[] = [];
  return {
    history,
    async find() {
      return job;
    },
    async update(_id, data) {
      Object.assign(job, data);
      history.push({ ...job, conversation: job.conversation });
    },
  };
}

describe('runExport', () => {
  it('moves a job from queued through processing to complete', async () => {
    const job = sample();
    const store = memoryStore(job);
    const dir = await mkdtemp(join(tmpdir(), 'lexbridge-pdf-'));
    try {
      await runExport({
        store,
        render: renderPdf,
        exportDir: dir,
        exportJobId: job.id,
        attempt: 1,
        maxAttempts: 3,
      });
      expect(store.history.map((row) => row.status)).toEqual(['PROCESSING', 'COMPLETE']);
      expect(job.filePath).toBeTruthy();
      const bytes = await readFile(job.filePath!);
      expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('requeues on failure and marks failed on the last attempt', async () => {
    const retry = sample();
    const retryStore = memoryStore(retry);
    await expect(
      runExport({
        store: retryStore,
        render: async () => {
          throw new Error('disk full');
        },
        exportDir: 'unused',
        exportJobId: retry.id,
        attempt: 1,
        maxAttempts: 3,
      }),
    ).rejects.toThrow('disk full');
    expect(retry.status).toBe('QUEUED');
    expect(retry.attempts).toBe(1);

    const failed = sample();
    const failedStore = memoryStore(failed);
    await expect(
      runExport({
        store: failedStore,
        render: async () => {
          throw new Error('disk full');
        },
        exportDir: 'unused',
        exportJobId: failed.id,
        attempt: 3,
        maxAttempts: 3,
      }),
    ).rejects.toThrow('disk full');
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toBe('disk full');
  });
});
