'use client';

import { gql } from '@apollo/client';
import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useEffect, useState } from 'react';
import { apiOrigin } from '../../../lib/api';

const CONVERSATIONS = gql`
  query Conversations {
    conversations {
      id
      title
    }
  }
`;

const CONVERSATION = gql`
  query Conversation($id: ID!) {
    conversation(id: $id) {
      id
      title
      messages {
        id
        role
        content
        status
        insufficient
        citations {
          id
          label
          excerpt
        }
      }
    }
  }
`;

const ASK = gql`
  mutation Ask($input: AskQuestionInput!) {
    askQuestion(input: $input) {
      id
      conversationId
    }
  }
`;

const EXPORT = gql`
  mutation Export($conversationId: ID!) {
    requestPdfExport(conversationId: $conversationId) {
      id
      status
    }
  }
`;

const JOB = gql`
  query Job($id: ID!) {
    exportJob(id: $id) {
      id
      status
      error
    }
  }
`;

type Citation = { id: string; label: string; excerpt: string };
type ChatMessage = {
  id: string;
  role: string;
  content: string;
  status: string;
  insufficient: boolean;
  citations: Citation[];
};

type ConversationSummary = { id: string; title: string };
type ExportJobView = { id: string; status: string; error?: string | null };

export default function ChatPage() {
  const { data: list, refetch: refetchList } = useQuery<{ conversations: ConversationSummary[] }>(CONVERSATIONS);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { data, refetch } = useQuery<
    { conversation: { id: string; title: string; messages: ChatMessage[] } | null },
    { id: string }
  >(CONVERSATION, conversationId ? { variables: { id: conversationId } } : skipToken);
  const [askQuestion] = useMutation<{ askQuestion: { id: string; conversationId: string } }>(ASK);
  const [requestPdfExport] = useMutation<{ requestPdfExport: ExportJobView }>(EXPORT);
  const [live, setLive] = useState<ChatMessage | null>(null);
  const [job, setJob] = useState<ExportJobView | null>(null);
  const jobQuery = useQuery<{ exportJob: ExportJobView | null }, { id: string }>(
    JOB,
    job && job.status !== 'COMPLETE' && job.status !== 'FAILED'
      ? { variables: { id: job.id }, pollInterval: 1000 }
      : skipToken,
  );

  useEffect(() => {
    if (jobQuery.data?.exportJob) setJob(jobQuery.data.exportJob);
  }, [jobQuery.data]);

  async function onAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get('question') ?? '');
    const result = await askQuestion({
      variables: { input: { question, conversationId } },
    });
    const created = result.data?.askQuestion;
    if (!created) return;
    setConversationId(created.conversationId);
    setLive({
      id: created.id,
      role: 'ASSISTANT',
      content: '',
      status: 'PENDING',
      insufficient: false,
      citations: [],
    });
    const source = new EventSource(
      `${apiOrigin()}/chat/stream/${created.conversationId}?messageId=${created.id}`,
      { withCredentials: true },
    );
    source.addEventListener('snapshot', (eventMessage) => apply(eventMessage));
    source.addEventListener('delta', (eventMessage) => apply(eventMessage));
    source.addEventListener('done', (eventMessage) => {
      apply(eventMessage);
      source.close();
      void refetch();
      void refetchList();
    });

    function apply(eventMessage: Event) {
      const payload = JSON.parse((eventMessage as MessageEvent).data) as {
        content?: string;
        delta?: string;
        sequence: number;
        status: string;
        insufficient: boolean;
        citations?: Citation[];
      };
      setLive((current) => {
        if (!current) return current;
        const content = payload.content || `${current.content}${payload.delta ?? ''}`;
        return {
          ...current,
          content,
          status: payload.status,
          insufficient: payload.insufficient,
          citations: payload.citations ?? current.citations,
        };
      });
    }
    event.currentTarget.reset();
  }

  async function onExport() {
    if (!conversationId) return;
    const result = await requestPdfExport({ variables: { conversationId } });
    if (result.data?.requestPdfExport) setJob(result.data.requestPdfExport);
  }

  const messages: ChatMessage[] = data?.conversation?.messages ?? [];

  return (
    <section className="stack">
      <h1>Chat</h1>
      <div className="row">
        <button type="button" onClick={() => { setConversationId(null); setLive(null); }}>
          New question
        </button>
        {(list?.conversations ?? []).map((conversation) => (
          <button type="button" key={conversation.id} onClick={() => setConversationId(conversation.id)}>
            {conversation.title}
          </button>
        ))}
      </div>
      {messages.map((message) => (
        <article className="card" key={message.id}>
          <div className="muted">{message.role}</div>
          <p className="message">{message.content}</p>
          {message.insufficient && <div className="danger">The available sources do not support an answer.</div>}
          {message.citations?.map((citation) => (
            <p className="citation" key={citation.id}>
              {citation.label}: {citation.excerpt}
            </p>
          ))}
        </article>
      ))}
      {live && !messages.some((message) => message.id === live.id) && (
        <article className="card">
          <div className="muted">ASSISTANT · {live.status}</div>
          <p className="message">{live.content || 'Waiting for the answer…'}</p>
          {live.insufficient && <div className="danger">The available sources do not support an answer.</div>}
          {live.citations.map((citation) => (
            <p className="citation" key={citation.id}>
              {citation.label}: {citation.excerpt}
            </p>
          ))}
        </article>
      )}
      <form className="card stack" onSubmit={onAsk}>
        <label>
          Question
          <textarea name="question" rows={3} required placeholder="What notice period does the Harbor Services Agreement require?" />
        </label>
        <button type="submit">Ask</button>
      </form>
      {conversationId && (
        <div className="card row">
          <button type="button" onClick={() => void onExport()}>
            Generate PDF
          </button>
          {job && <span className="muted">Export {job.status}</span>}
          {job?.status === 'COMPLETE' && (
            <a href={`${apiOrigin()}/exports/${job.id}/file`}>Download PDF</a>
          )}
          {job?.status === 'FAILED' && <span className="danger">{job.error || 'Export failed'}</span>}
        </div>
      )}
    </section>
  );
}
