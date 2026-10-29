import { Injectable } from '@nestjs/common';
import { MessageRole, MessageStatus, PrismaService } from '@lexbridge/database';
import { Response } from 'express';
import { RedisService } from '../common/redis.service';
import { RateLimiter } from '../common/rate-limiter';
import { notFound } from '../common/errors';
import { ChatGenerationService } from './chat-generation.service';
import { LiveEvent, acceptSequence, chatChannel } from './stream-events';

function writeEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly limiter: RateLimiter,
    private readonly generation: ChatGenerationService,
  ) {}

  list(userId: string, organizationId: string) {
    return this.prisma.conversation.findMany({
      where: { userId, organizationId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(userId: string, organizationId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId, organizationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { citations: true },
        },
      },
    });
    if (!conversation) notFound();
    return conversation;
  }

  async ask(input: { userId: string; organizationId: string; conversationId?: string | null; question: string }) {
    await this.limiter.consumeAsk(input.userId);
    const question = input.question.trim();
    const conversation = input.conversationId
      ? await this.prisma.conversation.findFirst({
          where: { id: input.conversationId, userId: input.userId, organizationId: input.organizationId },
        })
      : await this.prisma.conversation.create({
          data: {
            organizationId: input.organizationId,
            userId: input.userId,
            title: question.slice(0, 80) || 'New question',
          },
        });
    if (!conversation) notFound();
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        organizationId: input.organizationId,
        role: MessageRole.USER,
        content: question,
        status: MessageStatus.COMPLETE,
        sequence: 1,
      },
    });
    const assistant = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        organizationId: input.organizationId,
        role: MessageRole.ASSISTANT,
        content: '',
        status: MessageStatus.PENDING,
        sequence: 0,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    void this.generation.run(assistant.id);
    return { ...assistant, citations: [] };
  }

  async assertReadable(userId: string, organizationId: string, conversationId: string, messageId?: string) {
    const conversation = await this.owned(userId, organizationId, conversationId);
    if (messageId) {
      const message = await this.prisma.message.findFirst({
        where: { id: messageId, conversationId: conversation.id },
      });
      if (!message) notFound();
    }
    return conversation;
  }

  async pipe(input: {
    userId: string;
    organizationId: string;
    conversationId: string;
    messageId?: string;
    res: Response;
  }): Promise<void> {
    const conversation = await this.owned(input.userId, input.organizationId, input.conversationId);
    const message = input.messageId
      ? await this.prisma.message.findFirst({
          where: { id: input.messageId, conversationId: conversation.id, role: MessageRole.ASSISTANT },
          include: { citations: true },
        })
      : await this.prisma.message.findFirst({
          where: { conversationId: conversation.id, role: MessageRole.ASSISTANT },
          orderBy: { createdAt: 'desc' },
          include: { citations: true },
        });
    if (!message) notFound();

    const subscriber = this.redis.duplicate();
    const early: LiveEvent[] = [];
    let snapshotSent = false;
    let closed = false;
    let last = -1;
    const channel = chatChannel(message.id);

    const cleanup = () => {
      if (closed) return;
      closed = true;
      subscriber.removeAllListeners('message');
      void subscriber.unsubscribe(channel);
      subscriber.disconnect();
    };

    const emit = (event: LiveEvent) => {
      if (closed) return;
      if (acceptSequence(last, event.sequence)) {
        last = event.sequence;
        writeEvent(input.res, 'delta', event);
      }
      if (event.status === MessageStatus.COMPLETE || event.status === MessageStatus.FAILED) {
        writeEvent(input.res, 'done', event);
        cleanup();
        input.res.end();
      }
    };

    subscriber.on('message', (_channel, payload) => {
      const event = JSON.parse(payload) as LiveEvent;
      if (!snapshotSent) {
        early.push(event);
        return;
      }
      emit(event);
    });

    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(channel, (error) => (error ? reject(error) : resolve()));
    });

    const snapshot = await this.prisma.message.findFirst({
      where: { id: message.id },
      include: { citations: true },
    });
    if (!snapshot) {
      cleanup();
      notFound();
    }

    last = snapshot.sequence;
    const payload = this.payload(snapshot);
    writeEvent(input.res, 'snapshot', payload);
    snapshotSent = true;
    for (const event of early) emit(event);
    if (!closed && (snapshot.status === MessageStatus.COMPLETE || snapshot.status === MessageStatus.FAILED)) {
      writeEvent(input.res, 'done', payload);
      cleanup();
      input.res.end();
      return;
    }

    input.res.on('close', cleanup);
  }

  private payload(message: {
    id: string;
    sequence: number;
    content: string;
    status: string;
    insufficient: boolean;
    citations: Array<{ id: string; label: string; excerpt: string; documentId: string }>;
  }) {
    return {
      messageId: message.id,
      sequence: message.sequence,
      delta: '',
      status: message.status,
      insufficient: message.insufficient,
      content: message.content,
      citations: message.citations.map((citation) => ({
        id: citation.id,
        label: citation.label,
        excerpt: citation.excerpt,
        documentId: citation.documentId,
      })),
    };
  }

  private async owned(userId: string, organizationId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, organizationId },
    });
    if (!conversation) notFound();
    return conversation;
  }
}
