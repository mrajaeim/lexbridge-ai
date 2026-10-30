'use client';

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { PageHeader } from '../../../components/page-header';
import { LoadingSkeleton } from '../../../components/loading';
import { auditLabel } from '../../../lib/copy';

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
  const { data, loading, error } = useQuery<{ auditLogs: AuditRow[] }>(AUDIT);
  const rows = data?.auditLogs ?? [];

  return (
    <section className="stack">
      <PageHeader
        title="Audit log"
        description="Role changes, invites, publishes, and export requests for this firm."
      />
      {error && <div className="notice">Administrators can read this log. Other roles see the workspace without it.</div>}
      {loading && <LoadingSkeleton rows={5} />}
      {!loading && !error && rows.length === 0 && (
        <div className="card empty-state">
          <h2>No events yet</h2>
          <p>Publishing a document, inviting someone, or exporting a PDF will show up here.</p>
        </div>
      )}
      <div className="audit-list">
        {rows.map((row) => (
          <article className="card audit-row" key={row.id}>
            <div>
              <strong>{auditLabel(row.action)}</strong>
              <div className="muted">{auditLabel(row.targetType)}</div>
            </div>
            <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time>
          </article>
        ))}
      </div>
    </section>
  );
}
