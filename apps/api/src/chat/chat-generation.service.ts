import { Inject, Injectable, Logger } from '@nestjs/common';
import { MessageStatus, PrismaService } from '@lexbridge/database';
import { INSUFFICIENT_ANSWER } from '@lexbridge/shared';
import { LlmClient } from '../ai/ai.types';
import { PostgresRetriever } from '../ai/postgres-retriever';
import { RedisService } from '../common/redis.service';
import { chatChannel } from './stream-events';

export const LLM_CLIENT = Symbol('LLM_CLIENT');

@Injectable()
export class ChatGenerationService {
  private readonly logger = new Logger(ChatGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly retriever: PostgresRetriever,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {}

  async run(messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.role !== 'ASSISTANT') return;
    const userMessage = await this.prisma.message.findFirst({
      where: { conversationId: message.conversationId, role: 'USER' },
      orderBy: { createdAt: 'desc' },
    });
    const question = userMessage?.content ?? '';
    try {
      const chunks = await this.retriever.search({
        organizationId: message.organizationId,
        query: question,
      });
      let pending = '';
      for await (const piece of this.llm.stream({ question, chunks })) {
        pending += piece;
        if (pending.length >= 40) {
          await this.flush(messageId, pending);
          pending = '';
        }
      }
      if (pending) await this.flush(messageId, pending);
      const current = await this.prisma.message.findUniqueOrThrow({ where: { id: messageId } });
      const insufficient = chunks.length === 0 || current.content.includes(INSUFFICIENT_ANSWER);
      if (chunks.length > 0 && !insufficient) {
        await this.prisma.citation.createMany({
          data: chunks.map((chunk) => ({
            messageId,
            documentId: chunk.documentId,
            chunkId: chunk.chunkId,
            organizationId: message.organizationId,
            label: chunk.title,
            excerpt: chunk.content.slice(0, 280),
          })),
        });
      }
      const citations = await this.prisma.citation.findMany({ where: { messageId } });
      const completed = await this.prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.COMPLETE, insufficient },
      });
      await this.redis.client.publish(
        chatChannel(messageId),
        JSON.stringify({
          messageId,
          sequence: completed.sequence,
          delta: '',
          status: MessageStatus.COMPLETE,
          insufficient,
          content: completed.content,
          citations: citations.map((citation) => ({
            id: citation.id,
            label: citation.label,
            excerpt: citation.excerpt,
            documentId: citation.documentId,
          })),
        }),
      );
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'generation failed');
      const failed = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: MessageStatus.FAILED,
          content: 'The answer could not be generated.',
        },
      });
      await this.redis.client.publish(
        chatChannel(messageId),
        JSON.stringify({
          messageId,
          sequence: failed.sequence,
          delta: '',
          status: MessageStatus.FAILED,
          insufficient: false,
          content: failed.content,
        }),
      );
    }
  }

  private async flush(messageId: string, delta: string): Promise<void> {
    const current = await this.prisma.message.findUniqueOrThrow({ where: { id: messageId } });
    const sequence = current.sequence + 1;
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: current.content + delta, sequence, status: MessageStatus.STREAMING },
    });
    await this.redis.client.publish(
      chatChannel(messageId),
      JSON.stringify({
        messageId,
        sequence,
        delta,
        status: MessageStatus.STREAMING,
        insufficient: false,
        content: updated.content,
      }),
    );
  }
}
