'use client';

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useState } from 'react';
import { useSessionRole } from '../../../components/shell';

const MEMBERS = gql`
  query Members {
    members {
      id
      name
      email
      role
    }
  }
`;

const INVITE = gql`
  mutation Invite($input: InviteUserInput!) {
    inviteUser(input: $input) {
      id
      email
      acceptUrl
    }
  }
`;

const CHANGE = gql`
  mutation Change($input: ChangeRoleInput!) {
    changeUserRole(input: $input) {
      id
      role
    }
  }
`;

type MemberRow = { id: string; name: string; email: string; role: string };

export default function MembersPage() {
  const membership = useSessionRole();
  const admin = membership?.role === 'ADMIN';
  const { data, refetch, error } = useQuery<{ members: MemberRow[] }>(MEMBERS);
  const [inviteUser] = useMutation<{ inviteUser: { acceptUrl: string } }>(INVITE);
  const [changeUserRole] = useMutation(CHANGE);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!admin) {
      setMessage('Only administrators can invite users.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const result = await inviteUser({
      variables: { input: { email: String(form.get('email')), role: String(form.get('role')) } },
    });
    setLink(result.data?.inviteUser.acceptUrl ?? '');
    await refetch();
  }

  async function onRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await changeUserRole({
        variables: { input: { membershipId: String(form.get('membershipId')), role: String(form.get('role')) } },
      });
      setMessage('Role updated.');
      await refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Role change was rejected.');
    }
  }

  return (
    <section className="stack">
      <h1>Members</h1>
      {error && <div className="danger">{error.message}</div>}
      {message && <div className="danger">{message}</div>}
      <form className="card stack" onSubmit={onInvite}>
        <h2>Invite</h2>
        {!admin && <p className="muted">Only administrators can invite users or change roles.</p>}
        <label>
          Email
          <input name="email" type="email" required disabled={!admin} />
        </label>
        <label>
          Role
          <select name="role" defaultValue="READER" disabled={!admin}>
            <option>READER</option>
            <option>EDITOR</option>
            <option>ADMIN</option>
          </select>
        </label>
        <button type="submit" disabled={!admin}>
          Create invite link
        </button>
        {link && (
          <label>
            Accept link
            <input readOnly value={link} />
          </label>
        )}
      </form>
      {(data?.members ?? []).map((member) => (
        <form className="card row" key={member.id} onSubmit={onRole}>
          <input type="hidden" name="membershipId" value={member.id} />
          <div>
            <strong>{member.name}</strong>
            <div className="muted">{member.email}</div>
          </div>
          <select name="role" defaultValue={member.role} disabled={!admin}>
            <option>READER</option>
            <option>EDITOR</option>
            <option>ADMIN</option>
          </select>
          <button type="submit" disabled={!admin}>
            Change role
          </button>
        </form>
      ))}
    </section>
  );
}
