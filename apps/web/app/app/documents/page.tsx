'use client';

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useState } from 'react';
import { PageHeader } from '../../../components/page-header';
import { LoadingSkeleton } from '../../../components/loading';
import { useSessionRole } from '../../../components/shell';
import { previewBody, statusLabel } from '../../../lib/copy';

const DOCUMENTS = gql`
  query Documents {
    documents {
      id
      title
      status
      body
    }
  }
`;

const CREATE = gql`
  mutation Create($input: CreateDocumentInput!) {
    createDocument(input: $input) {
      id
      title
      status
    }
  }
`;

type DocumentRow = { id: string; title: string; status: string; body: string };

export default function DocumentsPage() {
  const membership = useSessionRole();
  const { data, loading, refetch, error } = useQuery<{ documents: DocumentRow[] }>(DOCUMENTS);
  const [createDocument, { error: createError }] = useMutation(CREATE);
  const [forbidden, setForbidden] = useState('');
  const reader = membership?.role === 'READER';
  const documents = data?.documents ?? [];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reader) {
      setForbidden('Readers cannot publish documents.');
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await createDocument({
        variables: {
          input: {
            title: String(form.get('title') ?? ''),
            body: String(form.get('body') ?? ''),
            publish: form.get('publish') === 'on',
          },
        },
      });
      setForbidden('');
      event.currentTarget.reset();
      await refetch();
    } catch (err) {
      setForbidden(err instanceof Error ? err.message : 'You cannot publish documents.');
    }
  }

  return (
    <section className="stack">
      <PageHeader
        title="Documents"
        description="Published text is what chat can retrieve. Drafts stay in the library until an editor publishes them."
      />
      {reader && <div className="notice">You can read published material. Publishing is limited to editors and admins.</div>}
      {forbidden && <div className="danger">{forbidden}</div>}
      {(error || createError) && <div className="danger">{error?.message || createError?.message}</div>}
      {!reader && (
        <form className="card stack stack-tight" onSubmit={onSubmit}>
          <h2>Add a document</h2>
          <label>
            Title
            <input name="title" required placeholder="Agreement title" />
          </label>
          <label>
            Text
            <textarea name="body" rows={5} required placeholder="Paste or type document text…" />
          </label>
          <label className="checkbox-row">
            <input name="publish" type="checkbox" />
            Publish immediately (visible to chat)
          </label>
          <div>
            <button type="submit">Save document</button>
          </div>
        </form>
      )}
      {loading && <LoadingSkeleton rows={4} />}
      {!loading && documents.length === 0 && (
        <div className="card empty-state">
          <h2>No documents yet</h2>
          <p>Editors and admins can add the first document for this firm.</p>
        </div>
      )}
      <div className="doc-grid">
        {documents.map((document) => (
          <article className="card doc-card" key={document.id}>
            <div className="row-spread">
              <strong>{document.title}</strong>
              <span className={`badge ${document.status === 'PUBLISHED' ? 'published' : ''}`}>{statusLabel(document.status)}</span>
            </div>
            <p className="muted mt-sm">{previewBody(document.body)}</p>
            <details>
              <summary>Full text</summary>
              <p className="message">{document.body}</p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
