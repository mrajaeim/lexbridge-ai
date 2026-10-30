import { apiOrigin } from '../lib/api';

export default function HomePage() {
  const login = `${apiOrigin()}/auth/login?returnTo=/app`;
  return (
    <div className="landing">
      <main className="landing-main">
        <div className="landing-hero">
          <p className="kicker">Prototype · not legal advice</p>
          <p className="brand">LexBridge AI</p>
          <h1>Ask a question against your firm’s published documents.</h1>
          <p className="lede">
            Organization-scoped research for a hiring demo: sign in as one firm, stay inside that library, and get a streamed answer with the passages it used.
          </p>
          <div className="landing-actions">
            <a className="button" href={login}>
              Sign in with Keycloak
            </a>
            <a className="button secondary" href="#demo">
              Demo credentials
            </a>
          </div>
        </div>
        <div className="grid-2">
          <article className="card">
            <h2>What this build shows</h2>
            <ul>
              <li>Strict multi-tenancy — each firm only sees its own documents.</li>
              <li>Grounded answers that stream in with cited passages.</li>
              <li>Role-based access and an audit trail for admins.</li>
              <li>PDF export handled by a background worker.</li>
            </ul>
          </article>
          <article className="card" id="demo">
            <h2>Demo sign-in</h2>
            <p>
              Shared password: <code>Lexbridge-demo-1</code>
            </p>
            <p className="muted mt-sm">
              <strong>Firm Alpha</strong> — alice (admin), bob (editor), carol (reader)
            </p>
            <p className="muted">
              <strong>Firm Beta</strong> — david (admin), emma (reader)
            </p>
          </article>
        </div>
      </main>
      <footer className="landing-footer">Synthetic sample documents only · Built as a technical portfolio prototype</footer>
    </div>
  );
}
