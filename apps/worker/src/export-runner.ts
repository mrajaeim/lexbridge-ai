import { exportFilePath } from './pdf-renderer';

export type ExportRecord = {
  id: string;
  organizationId: string;
  conversationId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
  attempts: number;
  error: string | null;
  filePath: string | null;
  conversation: {
    title: string;
    messages: Array<{
      role: string;
      content: string;
      citations: Array<{ label: string; excerpt: string }>;
    }>;
  };
};

export type ExportPatch = {
  status?: ExportRecord['status'];
  attempts?: number;
  error?: string | null;
  filePath?: string | null;
  completedAt?: Date | null;
};

export interface ExportStore {
  find(id: string): Promise<ExportRecord | null>;
  update(id: string, data: ExportPatch): Promise<void>;
}

export async function runExport(input: {
  store: ExportStore;
  render: (job: ExportRecord, filePath: string) => Promise<void>;
  exportDir: string;
  exportJobId: string;
  attempt: number;
  maxAttempts: number;
}): Promise<void> {
  const job = await input.store.find(input.exportJobId);
  if (!job) return;
  await input.store.update(job.id, { status: 'PROCESSING', attempts: input.attempt, error: null });
  const filePath = exportFilePath(input.exportDir, job.organizationId, job.id);
  try {
    await input.render(job, filePath);
    await input.store.update(job.id, {
      status: 'COMPLETE',
      filePath,
      error: null,
      completedAt: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'export failed';
    if (input.attempt >= input.maxAttempts) {
      await input.store.update(job.id, { status: 'FAILED', error: message });
    } else {
      await input.store.update(job.id, { status: 'QUEUED', error: message });
    }
    throw error;
  }
}
