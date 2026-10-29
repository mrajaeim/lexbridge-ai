import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { OAuthTransaction } from './types';

const TTL_SECONDS = 600;

@Injectable()
export class OAuthTransactionStore {
  constructor(private readonly redis: RedisService) {}

  async save(state: string, transaction: OAuthTransaction): Promise<void> {
    await this.redis.client.set(this.key(state), JSON.stringify(transaction), 'EX', TTL_SECONDS);
  }

  async consume(state: string): Promise<OAuthTransaction | null> {
    const raw = await this.redis.client.getdel(this.key(state));
    if (!raw) return null;
    return JSON.parse(raw) as OAuthTransaction;
  }

  private key(state: string): string {
    return `oauth:${state}`;
  }
}
