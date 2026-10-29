'use client';

import Link from 'next/link';

export default function AppHomePage() {
  return (
    <section className="stack">
      <h1>Workspace</h1>
      <p className="muted">Prototype only. Answers are grounded in your organization’s published documents and are not legal advice.</p>
      <div className="card">
        <p>Ask a question, then export the cited answer as a PDF.</p>
        <p>
          <Link className="button" href="/app/chat">
            Open chat
          </Link>
        </p>
      </div>
    </section>
  );
}
