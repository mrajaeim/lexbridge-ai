import { Injectable } from '@nestjs/common';
import { DocumentStatus, OrgRole, PrismaService } from '@lexbridge/database';
import { chunkText } from '@lexbridge/shared';
import { notFound } from '../common/errors';
import { AuditService } from '../organizations/organizations.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organizationId: string, role: OrgRole) {
    return this.prisma.document.findMany({
      where: {
        organizationId,
        ...(role === OrgRole.READER ? { status: DocumentStatus.PUBLISHED } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(organizationId: string, role: OrgRole, id: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        organizationId,
        ...(role === OrgRole.READER ? { status: DocumentStatus.PUBLISHED } : {}),
      },
    });
    if (!document) notFound();
    return document;
  }

  async create(input: {
    organizationId: string;
    userId: string;
    title: string;
    body: string;
    publish: boolean;
  }) {
    const status = input.publish ? DocumentStatus.PUBLISHED : DocumentStatus.DRAFT;
    const document = await this.prisma.document.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.userId,
        title: input.title.trim(),
        body: input.body.trim(),
        status,
        chunks: {
          create: chunkText(input.body).map((content, ordinal) => ({
            organizationId: input.organizationId,
            ordinal,
            content,
          })),
        },
      },
    });
    if (status === DocumentStatus.PUBLISHED) {
      await this.audit.record({
        organizationId: input.organizationId,
        actorId: input.userId,
        action: 'document.published',
        targetType: 'Document',
        targetId: document.id,
      });
    }
    return document;
  }

  async publish(organizationId: string, userId: string, id: string) {
    const existing = await this.prisma.document.findFirst({
      where: { id, organizationId },
    });
    if (!existing) notFound();
    const document = await this.prisma.document.update({
      where: { id: existing.id },
      data: { status: DocumentStatus.PUBLISHED },
    });
    await this.audit.record({
      organizationId,
      actorId: userId,
      action: 'document.published',
      targetType: 'Document',
      targetId: document.id,
    });
    return document;
  }
}
