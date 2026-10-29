import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ExportStatus, PrismaService } from '@lexbridge/database';
import { PDF_EXPORT_QUEUE } from '@lexbridge/shared';
import { Job } from 'bullmq';
import { ExportRecord, ExportStore, runExport } from './export-runner';
import { renderPdf } from './pdf-renderer';

class PrismaExportStore implements ExportStore {
  constructor(private readonly prisma: PrismaService) {}

  async find(id: string): Promise<ExportRecord | null> {
    const job = await this.prisma.exportJob.findUnique({
      where: { id },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              include: { citations: true },
            },
          },
        },
      },
    });
    if (!job) return null;
    return {
      id: job.id,
      organizationId: job.organizationId,
      conversationId: job.conversationId,
      status: job.status,
      attempts: job.attempts,
      error: job.error,
      filePath: job.filePath,
      conversation: {
        title: job.conversation.title,
        messages: job.conversation.messages.map((message) => ({
          role: message.role,
          content: message.content,
          citations: message.citations.map((citation) => ({
            label: citation.label,
            excerpt: citation.excerpt,
          })),
        })),
      },
    };
  }

  async update(id: string, data: Parameters<ExportStore['update']>[1]): Promise<void> {
    await this.prisma.exportJob.update({
      where: { id },
      data: {
        status: data.status as ExportStatus | undefined,
        attempts: data.attempts,
        error: data.error,
        filePath: data.filePath,
        completedAt: data.completedAt,
      },
    });
  }
}

@Processor(PDF_EXPORT_QUEUE)
export class PdfExportProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfExportProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ exportJobId: string }>): Promise<void> {
    this.logger.log(`export ${job.data.exportJobId} attempt ${job.attemptsMade + 1}`);
    await runExport({
      store: new PrismaExportStore(this.prisma),
      render: renderPdf,
      exportDir: process.env.EXPORT_DIR ?? 'storage/exports',
      exportJobId: job.data.exportJobId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 3,
    });
  }
}
