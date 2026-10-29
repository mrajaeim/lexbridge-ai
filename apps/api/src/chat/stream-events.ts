export type LiveEvent = {
  messageId: string;
  sequence: number;
  delta: string;
  status: string;
  insufficient: boolean;
  content?: string;
  citations?: Array<{ id: string; label: string; excerpt: string; documentId: string }>;
};

export function acceptSequence(last: number, incoming: number): boolean {
  return incoming > last;
}

export function chatChannel(messageId: string): string {
  return `chat:msg:${messageId}`;
}
