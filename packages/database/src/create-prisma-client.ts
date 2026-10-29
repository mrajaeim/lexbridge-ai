import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

export function prismaClientOptions(): ConstructorParameters<typeof PrismaClient>[0] {
  return { adapter: new PrismaPg({ connectionString: databaseUrl() }) };
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient(prismaClientOptions());
}
