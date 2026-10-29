import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { appConfig } from '../config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis(appConfig().redisUrl, { maxRetriesPerRequest: 2 });
  }

  duplicate(): Redis {
    return this.client.duplicate();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
