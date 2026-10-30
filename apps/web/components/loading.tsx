export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden />
      <span className="muted">{label}</span>
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-line" key={index} style={{ width: `${88 - index * 12}%` }} />
      ))}
    </div>
  );
}
