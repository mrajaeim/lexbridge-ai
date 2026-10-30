'use client';

import { gql } from '@apollo/client';
import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../../components/page-header';
import { LoadingSkeleton } from '../../../components/loading';
import { apiOrigin, fetchSession } from '../../../lib/api';
import { questionsFor, statusLabel } from '../../../lib/copy';

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

function Citations({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div>
      <p className="citations-label">Sources</p>
      {citations.map((citation) => (
        <p className="citation" key={citation.id}>
          <strong>{citation.label}</strong>
          {citation.excerpt}
        </p>
      ))}
    </div>
  );
}

function MessageBubble({ message, live }: { message: ChatMessage; live?: boolean }) {
  const isUser = message.role === 'USER';
  const streaming = live && (message.status === 'PENDING' || message.status === 'STREAMING');
  return (
    <article className={`card message-card ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
      <div className="message-head">
        <strong>{statusLabel(message.role)}</strong>
        {!isUser && streaming && (
          <span className="muted">
            <span className="pulse-dot" aria-hidden />
            {statusLabel(message.status)}
          </span>
        )}
      </div>
      <p className="message">{message.content || (streaming ? 'Reading the library…' : '')}</p>
      {message.insufficient && <div className="notice">The available sources do not support an answer.</div>}
      <Citations citations={message.citations ?? []} />
    </article>
  );
}

export default function ChatPage() {
  const threadRef = useRef<HTMLDivElement>(null);
  const { data: list, loading: listLoading, refetch: refetchList } = useQuery<{ conversations: ConversationSummary[] }>(CONVERSATIONS);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { data, loading: convLoading, refetch } = useQuery<
    { conversation: { id: string; title: string; messages: ChatMessage[] } | null },
    { id: string }
  >(CONVERSATION, conversationId ? { variables: { id: conversationId } } : skipToken);
  const [askQuestion] = useMutation<{ askQuestion: { id: string; conversationId: string } }>(ASK);
  const [requestPdfExport] = useMutation<{ requestPdfExport: ExportJobView }>(EXPORT);
  const [live, setLive] = useState<ChatMessage | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [firmSlug, setFirmSlug] = useState<string | null>(null);
  const [job, setJob] = useState<ExportJobView | null>(null);
  const jobQuery = useQuery<{ exportJob: ExportJobView | null }, { id: string }>(
    JOB,
    job && job.status !== 'COMPLETE' && job.status !== 'FAILED'
      ? { variables: { id: job.id }, pollInterval: 1000 }
      : skipToken,
  );

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get('q');
    if (preset) setQuestion(preset);
    void fetchSession().then((session) => setFirmSlug(session?.membership?.organizationSlug ?? null));
  }, []);

  useEffect(() => {
    if (jobQuery.data?.exportJob) setJob(jobQuery.data.exportJob);
  }, [jobQuery.data]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [data?.conversation?.messages, live?.content, live?.citations.length]);

  async function onAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || asking) return;
    setAsking(true);
    setAskError('');
    setQuestion('');
    try {
      const result = await askQuestion({
        variables: { input: { question: text, conversationId } },
      });
      const created = result.data?.askQuestion;
      if (!created) {
        setAsking(false);
        setAskError('The question was not accepted.');
        setQuestion(text);
        return;
      }
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
      let finished = false;
      source.addEventListener('snapshot', (eventMessage) => apply(eventMessage));
      source.addEventListener('delta', (eventMessage) => apply(eventMessage));
      source.addEventListener('done', (eventMessage) => {
        finished = true;
        apply(eventMessage);
        source.close();
        setAsking(false);
        void refetch();
        void refetchList();
      });
      source.onerror = () => {
        source.close();
        if (!finished) {
          setAsking(false);
          setAskError('The answer stream stopped. Open the conversation again to see what was saved.');
        }
      };

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
    } catch (err) {
      setAsking(false);
      setQuestion(text);
      setAskError(err instanceof Error ? err.message : 'The question could not be sent.');
    }
  }

  async function onExport() {
    if (!conversationId) return;
    const result = await requestPdfExport({ variables: { conversationId } });
    if (result.data?.requestPdfExport) setJob(result.data.requestPdfExport);
  }

  const messages: ChatMessage[] = data?.conversation?.messages ?? [];
  const showLive = live && !messages.some((message) => message.id === live.id);
  const empty = messages.length === 0 && !showLive && !convLoading;

  return (
    <section className="stack">
      <PageHeader
        title="Chat"
        description="Answers are grounded in this firm’s published documents. They are not legal advice."
      />
      <div className="chat-layout">
        <aside className="conversation-panel">
          <h2>Conversations</h2>
          <div className="conversation-list">
            <button
              type="button"
              className={conversationId ? undefined : 'current'}
              onClick={() => {
                setConversationId(null);
                setLive(null);
                setJob(null);
              }}
            >
              + New question
            </button>
            {listLoading && <LoadingSkeleton rows={2} />}
            {(list?.conversations ?? []).map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={conversationId === conversation.id ? 'current' : undefined}
                onClick={() => {
                  setConversationId(conversation.id);
                  setLive(null);
                  setJob(null);
                }}
              >
                {conversation.title}
              </button>
            ))}
          </div>
        </aside>
        <div className="stack stack-tight">
          <div className="chat-thread" ref={threadRef}>
            {convLoading && conversationId && <LoadingSkeleton rows={3} />}
            {empty && (
              <article className="card empty-state">
                <h2>Start from the library</h2>
                <p>Pick a sample question or type your own below.</p>
                <div className="suggest empty-suggest">
                  {questionsFor(firmSlug).map((item) => (
                    <button key={item} type="button" onClick={() => setQuestion(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </article>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {showLive && live && <MessageBubble message={live} live />}
          </div>
          {askError && <div className="danger">{askError}</div>}
          <div className="chat-composer">
            <form className="card stack stack-tight" onSubmit={onAsk}>
              <label>
                Your question
                <textarea
                  name="question"
                  rows={3}
                  required
                  value={question}
                  disabled={asking}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What notice period does the Harbor Services Agreement require?"
                />
              </label>
              <div className="row">
                <button type="submit" disabled={asking || !question.trim()}>
                  {asking ? 'Answering…' : 'Ask'}
                </button>
                {question && !asking && (
                  <button type="button" className="secondary" onClick={() => setQuestion('')}>
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>
          {conversationId && (
            <div className="card export-bar">
              <button
                type="button"
                onClick={() => void onExport()}
                disabled={job?.status === 'QUEUED' || job?.status === 'PROCESSING'}
              >
                Generate PDF
              </button>
              {job && (
                <span className="muted">
                  Export {statusLabel(job.status).toLowerCase()}
                  {(job.status === 'QUEUED' || job.status === 'PROCESSING') && '…'}
                </span>
              )}
              {job?.status === 'COMPLETE' && (
                <a className="button secondary" href={`${apiOrigin()}/exports/${job.id}/file`}>
                  Download PDF
                </a>
              )}
              {job?.status === 'FAILED' && <span className="danger">{job.error || 'Export failed'}</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
