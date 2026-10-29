'use client';

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useState } from 'react';
import { useSessionRole } from '../../../components/shell';

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
  const { data, refetch, error } = useQuery<{ documents: DocumentRow[] }>(DOCUMENTS);
  const [createDocument, { error: createError }] = useMutation(CREATE);
  const [forbidden, setForbidden] = useState('');
  const reader = membership?.role === 'READER';

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
      <h1>Documents</h1>
      {reader && <div className="danger">Readers cannot publish documents. You can read published material only.</div>}
      {forbidden && <div className="danger">{forbidden}</div>}
      {(error || createError) && <div className="danger">{error?.message || createError?.message}</div>}
      <form className="card stack" onSubmit={onSubmit}>
        <label>
          Title
          <input name="title" required disabled={reader} />
        </label>
        <label>
          Text
          <textarea name="body" rows={5} required disabled={reader} />
        </label>
        <label className="row">
          <input name="publish" type="checkbox" disabled={reader} /> Publish
        </label>
        <button type="submit" disabled={reader}>
          Save document
        </button>
      </form>
      {(data?.documents ?? []).map((document) => (
        <article className="card" key={document.id}>
          <strong>{document.title}</strong>
          <div className="muted">{document.status}</div>
          <p>{document.body}</p>
        </article>
      ))}
    </section>
  );
}
