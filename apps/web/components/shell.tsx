'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { LoadingPanel } from './loading';
import { apiOrigin, fetchSession, SessionResponse } from '../lib/api';
import { roleLabel } from '../lib/copy';

const NAV = [
  { href: '/app', label: 'Home' },
  { href: '/app/documents', label: 'Documents' },
  { href: '/app/chat', label: 'Chat' },
  { href: '/app/members', label: 'Members' },
  { href: '/app/audit', label: 'Audit' },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const wide = pathname.startsWith('/app/chat');

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

  if (!session?.user) {
    return (
      <main className="page">
        <LoadingPanel label="Loading your workspace…" />
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-meta">
          <div className="brand">
            <Link href="/app">LexBridge</Link>
          </div>
          <div className="user-line">
            {session.user.name}
            {' · '}
            {session.membership?.organizationName ?? 'No organization'}
            {' · '}
            {roleLabel(session.membership?.role)}
          </div>
        </div>
        <nav className="nav" aria-label="Workspace">
          {NAV.map((item) => {
            const active = item.href === '/app' ? pathname === '/app' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
                {item.label}
              </Link>
            );
          })}
          <a className="sign-out" href={`${apiOrigin()}/auth/logout`}>
            Sign out
          </a>
        </nav>
      </header>
      <main className={wide ? 'page page-wide' : 'page'}>
        {session.organizations.length > 1 && (
          <form className="org-switch" onSubmit={onSwitch}>
            <span className="muted">Organization</span>
            <select name="organizationId" defaultValue={session.membership?.organizationId} aria-label="Active organization">
              {session.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <button type="submit" className="secondary">
              Switch
            </button>
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
