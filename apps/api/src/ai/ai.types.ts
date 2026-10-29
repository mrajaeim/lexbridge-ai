export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
};

export interface Retriever {
  search(input: { organizationId: string; query: string; limit?: number }): Promise<RetrievedChunk[]>;
}

export interface LlmClient {
  stream(input: { question: string; chunks: RetrievedChunk[] }): AsyncIterable<string>;
}
