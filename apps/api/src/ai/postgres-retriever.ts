import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lexbridge/database';
import { Retriever, RetrievedChunk } from './ai.types';

type SearchRow = {
  id: string;
  documentId: string;
  content: string;
  title: string;
};

@Injectable()
export class PostgresRetriever implements Retriever {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: { organizationId: string; query: string; limit?: number }): Promise<RetrievedChunk[]> {
    const query = input.query.trim();
    if (!query) return [];
    const limit = input.limit ?? 5;
    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      SELECT c.id, c."documentId", c.content, d.title
      FROM "DocumentChunk" c
      JOIN "Document" d ON d.id = c."documentId"
      WHERE c."organizationId" = ${input.organizationId}
        AND d.status = 'PUBLISHED'
        AND c."searchVector" @@ plainto_tsquery('simple', ${query})
      ORDER BY ts_rank(c."searchVector", plainto_tsquery('simple', ${query})) DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      chunkId: row.id,
      documentId: row.documentId,
      title: row.title,
      content: row.content,
    }));
  }
}
