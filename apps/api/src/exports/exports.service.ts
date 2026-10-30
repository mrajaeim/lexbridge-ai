import { Injectable } from '@nestjs/common';
import { ExportStatus, PrismaService } from '@lexbridge/database';
import { PDF_EXPORT_QUEUE } from '@lexbridge/shared';
import { exportPdfPath } from '@lexbridge/shared/export-paths';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import { appConfig } from '../config';
import { notFound } from '../common/errors';
import { AuditService } from '../organizations/organizations.service';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectQueue(PDF_EXPORT_QUEUE) private readonly queue: Queue,
  ) {}

  async request(userId: string, organizationId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, organizationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) notFound();
    const contentVersion = createHash('sha256')
      .update(conversation.messages.map((message) => `${message.id}:${message.sequence}:${message.content}`).join('|'))
      .digest('hex');

    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.exportJob.findFirst({
        where: {
          conversationId,
          contentVersion,
          status: { in: [ExportStatus.QUEUED, ExportStatus.PROCESSING] },
        },
      });
      if (existing) return { job: existing, isNew: false };
      const job = await tx.exportJob.create({
        data: {
          organizationId,
          conversationId,
          requestedById: userId,
          contentVersion,
          status: ExportStatus.QUEUED,
        },
      });
      return { job, isNew: true };
    });

    if (created.isNew) {
      await this.queue.add(
        'export',
        { exportJobId: created.job.id },
        {
          jobId: created.job.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      await this.audit.record({
        organizationId,
        actorId: userId,
        action: 'export.requested',
        targetType: 'ExportJob',
        targetId: created.job.id,
      });
    }
    return created.job;
  }

  async get(userId: string, organizationId: string, id: string) {
    const job = await this.prisma.exportJob.findFirst({
      where: { id, organizationId, requestedById: userId },
    });
    if (!job) notFound();
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: job.conversationId, userId, organizationId },
    });
    if (!conversation) notFound();
    return job;
  }

  async openDownload(userId: string, organizationId: string, id: string) {
    const job = await this.get(userId, organizationId, id);
    if (job.status !== ExportStatus.COMPLETE) notFound();
    const filePath = exportPdfPath(appConfig().exportDir, job.organizationId, job.id);
    try {
      await access(filePath);
    } catch {
      notFound();
    }
    return { job, stream: createReadStream(filePath) };
  }
}
