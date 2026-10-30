'use client';

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useState } from 'react';
import { PageHeader } from '../../../components/page-header';
import { LoadingSkeleton } from '../../../components/loading';
import { useSessionRole } from '../../../components/shell';
import { roleBadgeClass, roleLabel } from '../../../lib/copy';

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
  const { data, loading, refetch, error } = useQuery<{ members: MemberRow[] }>(MEMBERS);
  const [inviteUser] = useMutation<{ inviteUser: { acceptUrl: string } }>(INVITE);
  const [changeUserRole] = useMutation(CHANGE);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!admin) {
      setMessage({ tone: 'bad', text: 'Only administrators can invite users.' });
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      const result = await inviteUser({
        variables: { input: { email: String(form.get('email')), role: String(form.get('role')) } },
      });
      setLink(result.data?.inviteUser.acceptUrl ?? '');
      setCopied(false);
      setMessage({ tone: 'ok', text: 'Invite link created. There is no email delivery in this prototype.' });
      await refetch();
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'The invite was rejected.' });
    }
  }

  async function onRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await changeUserRole({
        variables: { input: { membershipId: String(form.get('membershipId')), role: String(form.get('role')) } },
      });
      setMessage({ tone: 'ok', text: 'Role updated.' });
      await refetch();
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Role change was rejected.' });
    }
  }

  async function copyLink() {
    if (!link || !navigator.clipboard) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  const members = data?.members ?? [];

  return (
    <section className="stack">
      <PageHeader
        title="Members"
        description="Roles live in LexBridge, not in the identity provider. An admin invite is a link, not an email."
      />
      {error && <div className="danger">{error.message}</div>}
      {message && <div className={message.tone === 'ok' ? 'success' : 'danger'}>{message.text}</div>}
      <form className="card stack stack-tight" onSubmit={onInvite}>
        <h2>Invite someone</h2>
        {!admin && <p className="muted">Only administrators can invite users or change roles.</p>}
        <div className="grid-2">
          <label>
            Email
            <input name="email" type="email" required disabled={!admin} placeholder="name@firm.example" />
          </label>
          <label>
            Role
            <select name="role" defaultValue="READER" disabled={!admin}>
              <option value="READER">Reader</option>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={!admin}>
          Create invite link
        </button>
        {link && (
          <div className="stack stack-tight">
            <label>
              Accept link
              <input readOnly value={link} />
            </label>
            <button type="button" className="secondary" onClick={() => void copyLink()}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        )}
      </form>
      {loading && <LoadingSkeleton rows={3} />}
      <div className="member-list">
        {members.map((member) => (
          <form className="card member-row" key={member.id} onSubmit={onRole}>
            <input type="hidden" name="membershipId" value={member.id} />
            <div className="member-info">
              <strong>{member.name}</strong>
              <div className="muted">{member.email}</div>
            </div>
            <span className={roleBadgeClass(member.role)}>{roleLabel(member.role)}</span>
            <div className="row">
              <select name="role" defaultValue={member.role} disabled={!admin} aria-label={`Role for ${member.name}`}>
                <option value="READER">Reader</option>
                <option value="EDITOR">Editor</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button type="submit" disabled={!admin} className="secondary">
                Update
              </button>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}
