'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/page-header';
import { LoadingSkeleton } from '../../components/loading';
import { fetchSession, SessionResponse } from '../../lib/api';
import { questionsFor, roleLabel } from '../../lib/copy';

export default function AppHomePage() {
  const [session, setSession] = useState<SessionResponse | null>(null);

  useEffect(() => {
    void fetchSession().then(setSession);
  }, []);

  const name = session?.user?.name?.split(' ')[0];
  const firm = session?.membership?.organizationName;
  const role = roleLabel(session?.membership?.role);

  return (
    <section className="stack">
      {!session ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <PageHeader
            kicker="Workspace"
            title={name ? `Hello, ${name}` : 'Workspace'}
            description={
              firm
                ? `${firm} · ${role}. Answers use this firm’s published documents only — not legal advice.`
                : 'Answers use your firm’s published documents only — not legal advice.'
            }
          />
          <div className="grid-3">
            <Link className="quick-link" href="/app/chat">
              <strong>Chat</strong>
              <span>Ask a question and export cited answers</span>
            </Link>
            <Link className="quick-link" href="/app/documents">
              <strong>Documents</strong>
              <span>Browse and publish the firm library</span>
            </Link>
            <Link className="quick-link" href="/app/members">
              <strong>Members</strong>
              <span>Invites and roles for this firm</span>
            </Link>
          </div>
          <div className="grid-2">
            <article className="card">
              <h2>Try a question</h2>
              <div className="suggest">
                {questionsFor(session.membership?.organizationSlug).map((question) => (
                  <Link key={question} href={`/app/chat?q=${encodeURIComponent(question)}`}>
                    {question}
                  </Link>
                ))}
              </div>
            </article>
            <article className="card card-flat">
              <h2>Reviewers often check</h2>
              <ul>
                <li>Sign in as Carol and confirm publishing is blocked.</li>
                <li>Ask about the Harbor agreement, then download the PDF.</li>
                <li>Open the audit log after an invite or export.</li>
              </ul>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
