import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  ASK_RATE_LIMIT,
  ASK_RATE_WINDOW_SECONDS,
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_SECONDS,
} from '@lexbridge/shared';
import { RedisService } from './redis.service';

export async function consumeLimit(
  store: {
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<unknown>;
  },
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const count = await store.incr(key);
  if (count === 1) {
    await store.expire(key, windowSeconds);
  }
  if (count > limit) {
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class RateLimiter {
  constructor(private readonly redis: RedisService) {}

  consumeLogin(ip: string): Promise<void> {
    return consumeLimit(
      this.redis.client,
      `rl:login:${ip}`,
      LOGIN_RATE_LIMIT,
      LOGIN_RATE_WINDOW_SECONDS,
    );
  }

  consumeAsk(userId: string): Promise<void> {
    return consumeLimit(
      this.redis.client,
      `rl:ask:${userId}`,
      ASK_RATE_LIMIT,
      ASK_RATE_WINDOW_SECONDS,
    );
  }
}
