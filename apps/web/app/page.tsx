import { apiOrigin } from '../lib/api';

export default function HomePage() {
  const login = `${apiOrigin()}/auth/login?returnTo=/app`;
  return (
    <main className="page">
      <p className="brand">LexBridge AI</p>
      <h1>A workspace for trusted legal research.</h1>
      <p className="muted">
        Technical prototype for organization-scoped document search, cited answers, and export. Not legal advice.
      </p>
      <p>
        <a className="button" href={login}>
          Sign in
        </a>
      </p>
      <div className="card">
        <p>Demo firm users sign in through Keycloak. Passwords are local development credentials only.</p>
        <p className="muted">Alice, Bob, and Carol belong to Firm Alpha. David and Emma belong to Firm Beta.</p>
      </div>
    </main>
  );
}
