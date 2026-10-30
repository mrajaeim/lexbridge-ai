'use client';

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { apiOrigin } from '../../lib/api';

const ACCEPT = gql`
  mutation Accept($token: String!) {
    acceptInvitation(token: $token) {
      id
      role
    }
  }
`;

export default function InvitePage() {
  const [acceptInvitation, { data, error }] = useMutation<{ acceptInvitation: { id: string; role: string } }>(ACCEPT);
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  const returnTo = encodeURIComponent(`/invite?token=${token}`);

  return (
    <div className="landing">
      <main className="page invite-card">
        <p className="kicker">Invitation</p>
        <h1>Join your firm on LexBridge</h1>
        <p className="page-desc">
          Sign in with the invited email address, then accept. There is no email delivery in this prototype — you arrived here from an invite link.
        </p>
        <div className="stack stack-tight mt-sm">
          <a className="button" href={`${apiOrigin()}/auth/login?returnTo=${returnTo}`}>
            Sign in to continue
          </a>
          <button
            type="button"
            disabled={pending || !token}
            onClick={() => {
              setPending(true);
              void acceptInvitation({ variables: { token } }).finally(() => setPending(false));
            }}
          >
            {pending ? 'Accepting…' : 'Accept invitation'}
          </button>
          {!token && <div className="notice">This link is missing a token. Ask an admin for a new invite.</div>}
          {data && (
            <div className="success">
              Joined as {data.acceptInvitation.role.toLowerCase()}.{' '}
              <a href="/app">Open the workspace</a>
            </div>
          )}
          {error && <div className="danger">{error.message}</div>}
        </div>
      </main>
    </div>
  );
}
