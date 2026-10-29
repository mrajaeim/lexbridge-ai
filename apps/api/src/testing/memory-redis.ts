type Row = { value: string; expiresAt?: number };

export class MemoryRedis {
  private readonly rows = new Map<string, Row>();

  private live(key: string): Row | null {
    const row = this.rows.get(key);
    if (!row) return null;
    if (row.expiresAt !== undefined && row.expiresAt <= Date.now()) {
      this.rows.delete(key);
      return null;
    }
    return row;
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: 'EX', ttlSeconds?: number): Promise<'OK'> {
    const expiresAt = mode === 'EX' && ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.rows.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.rows.delete(key) ? 1 : 0;
  }

  async getdel(key: string): Promise<string | null> {
    const value = await this.get(key);
    await this.del(key);
    return value;
  }

  async incr(key: string): Promise<number> {
    const current = Number((await this.get(key)) ?? '0');
    const next = current + 1;
    const existing = this.rows.get(key);
    this.rows.set(key, { value: String(next), expiresAt: existing?.expiresAt });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const row = this.live(key);
    if (!row) return 0;
    row.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}
