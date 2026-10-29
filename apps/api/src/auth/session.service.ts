import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SESSION_COOKIE } from '@lexbridge/shared';
import { appConfig } from '../config';
import { RedisService } from '../common/redis.service';
import { SessionData } from './types';

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  async create(input: Omit<SessionData, 'expiresAt'>): Promise<string> {
    const id = randomBytes(32).toString('base64url');
    const ttl = appConfig().sessionTtlSeconds;
    const session: SessionData = {
      ...input,
      expiresAt: Date.now() + ttl * 1000,
    };
    await this.redis.client.set(this.key(id), JSON.stringify(session), 'EX', ttl);
    return id;
  }

  async get(id: string): Promise<SessionData | null> {
    const raw = await this.redis.client.get(this.key(id));
    if (!raw) return null;
    const session = JSON.parse(raw) as SessionData;
    if (session.expiresAt <= Date.now()) {
      await this.revoke(id);
      return null;
    }
    return session;
  }

  async update(id: string, patch: Partial<SessionData>): Promise<SessionData | null> {
    const current = await this.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, expiresAt: current.expiresAt };
    const ttl = Math.max(1, Math.ceil((current.expiresAt - Date.now()) / 1000));
    await this.redis.client.set(this.key(id), JSON.stringify(next), 'EX', ttl);
    return next;
  }

  async revoke(id: string): Promise<void> {
    await this.redis.client.del(this.key(id));
  }

  readId(cookieHeader: string | undefined, cookies?: Record<string, string>): string | null {
    if (cookies?.[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(';').map((part) => part.trim());
    const match = parts.find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
  }

  private key(id: string): string {
    return `session:${id}`;
  }
}
