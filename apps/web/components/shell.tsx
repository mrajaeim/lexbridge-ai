'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { apiOrigin, fetchSession, SessionResponse } from '../lib/api';

export function Shell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);

  useEffect(() => {
    void fetchSession().then((value) => {
      if (!value?.user) {
        window.location.href = '/';
        return;
      }
      setSession(value);
    });
  }, []);

  async function onSwitch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const organizationId = new FormData(event.currentTarget).get('organizationId');
    await fetch(`${apiOrigin()}/graphql`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-lexbridge-request': '1' },
      body: JSON.stringify({
        query: 'mutation ($organizationId: ID!) { switchOrganization(organizationId: $organizationId) { id name } }',
        variables: { organizationId },
      }),
    });
    window.location.reload();
  }

  if (!session?.user) return <main className="page">Loading session…</main>;

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <div className="brand">LexBridge</div>
          <div className="muted">
            {session.membership?.organizationName ?? 'No organization'} · {session.membership?.role ?? 'signed in'}
          </div>
        </div>
        <nav className="nav">
          <Link href="/app">Home</Link>
          <Link href="/app/documents">Documents</Link>
          <Link href="/app/chat">Chat</Link>
          <Link href="/app/members">Members</Link>
          <Link href="/app/audit">Audit</Link>
          <a href={`${apiOrigin()}/auth/logout`}>Sign out</a>
        </nav>
      </header>
      <main className="page">
        {session.organizations.length > 1 && (
          <form className="row" onSubmit={onSwitch}>
            <select name="organizationId" defaultValue={session.membership?.organizationId}>
              {session.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <button type="submit">Switch organization</button>
          </form>
        )}
        {children}
      </main>
    </div>
  );
}

export function useSessionRole() {
  const [role, setRole] = useState<SessionResponse['membership']>(null);
  useEffect(() => {
    void fetchSession().then((session) => setRole(session?.membership ?? null));
  }, []);
  return role;
}
