'use client';

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

const AUDIT = gql`
  query Audit {
    auditLogs {
      id
      action
      targetType
      createdAt
    }
  }
`;

type AuditRow = { id: string; action: string; targetType: string; createdAt: string };

export default function AuditPage() {
  const { data, error } = useQuery<{ auditLogs: AuditRow[] }>(AUDIT);
  return (
    <section className="stack">
      <h1>Audit log</h1>
      {error && <div className="danger">Administrators can read role changes, invites, publishes, and export requests.</div>}
      {(data?.auditLogs ?? []).map((row) => (
        <article className="card" key={row.id}>
          <strong>{row.action}</strong>
          <div className="muted">
            {row.targetType} · {new Date(row.createdAt).toLocaleString()}
          </div>
        </article>
      ))}
    </section>
  );
}
