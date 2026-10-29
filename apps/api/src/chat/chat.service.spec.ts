import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ChatService } from './chat.service';
import { acceptSequence } from './stream-events';

describe('stream sequence dedupe', () => {
  it('applies only events newer than the database snapshot', () => {
    const snapshot = 2;
    const events = [1, 2, 3, 3, 4];
    const applied = events.filter((sequence) => acceptSequence(snapshot, sequence) && sequence > snapshot);
    let last = snapshot;
    const kept: number[] = [];
    for (const sequence of events) {
      if (acceptSequence(last, sequence)) {
        last = sequence;
        kept.push(sequence);
      }
    }
    expect(applied).toEqual([3, 3, 4]);
    expect(kept).toEqual([3, 4]);
  });
});

describe('askQuestion rate limit', () => {
  it('does not persist a question when the limiter rejects', async () => {
    const create = vi.fn();
    const prisma = { conversation: { create }, message: { create } };
    const limiter = {
      consumeAsk: vi.fn(async () => {
        throw new HttpException('Too many requests', 429);
      }),
    };
    const chat = new ChatService(prisma as never, {} as never, limiter as never, {} as never);
    await expect(
      chat.ask({ userId: 'user-1', organizationId: 'org-1', question: 'notice period' }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(create).not.toHaveBeenCalled();
  });
});
