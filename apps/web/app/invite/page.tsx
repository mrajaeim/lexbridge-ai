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

  return (
    <main className="page">
      <h1>Accept invitation</h1>
      <p className="muted">Sign in with the invited email address, then accept. There is no email delivery in this prototype.</p>
      <p>
        <a className="button" href={`${apiOrigin()}/auth/login?returnTo=${encodeURIComponent(`/invite?token=${token}`)}`}>
          Sign in
        </a>
      </p>
      <button
        type="button"
        disabled={pending || !token}
        onClick={() => {
          setPending(true);
          void acceptInvitation({ variables: { token } }).finally(() => setPending(false));
        }}
      >
        Accept invitation
      </button>
      {data && <p>Joined as {data.acceptInvitation.role}.</p>}
      {error && <div className="danger">{error.message}</div>}
    </main>
  );
}
