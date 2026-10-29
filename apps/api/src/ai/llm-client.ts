import { Injectable } from '@nestjs/common';
import { INSUFFICIENT_ANSWER } from '@lexbridge/shared';
import { appConfig } from '../config';
import { LlmClient, RetrievedChunk } from './ai.types';

function pieces(text: string): string[] {
  return text.match(/[\s\S]{1,40}/g) ?? [text];
}

@Injectable()
export class MockLlmClient implements LlmClient {
  async *stream(input: { question: string; chunks: RetrievedChunk[] }): AsyncIterable<string> {
    const text =
      input.chunks.length === 0
        ? INSUFFICIENT_ANSWER
        : `Based on the retrieved sources, ${input.chunks
            .map((chunk) => `${chunk.title}: ${chunk.content}`)
            .join(' ')}`;
    for (const part of pieces(text)) yield part;
  }
}

@Injectable()
export class OpenAiLlmClient implements LlmClient {
  async *stream(input: { question: string; chunks: RetrievedChunk[] }): AsyncIterable<string> {
    if (input.chunks.length === 0) {
      yield INSUFFICIENT_ANSWER;
      return;
    }
    const config = appConfig();
    const response = await fetch(`${config.llmBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.llmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.llmModel,
        stream: true,
        messages: [
          {
            role: 'system',
            content: `Answer only using the provided sources and cite their titles. If the sources do not support an answer, reply exactly: ${INSUFFICIENT_ANSWER}`,
          },
          {
            role: 'user',
            content: `Question: ${input.question}\n\nSources:\n${input.chunks
              .map((chunk) => `[${chunk.title}] ${chunk.content}`)
              .join('\n\n')}`,
          },
        ],
      }),
    });
    if (!response.ok || !response.body) {
      throw new Error(`LLM request failed (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const read = await reader.read();
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) yield token;
      }
    }
  }
}

export function selectLlmClient(): LlmClient {
  return appConfig().llmApiKey ? new OpenAiLlmClient() : new MockLlmClient();
}
