export function apiOrigin(): string {
  return process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
}

export type SessionResponse = {
  user: { id: string; email: string; name: string } | null;
  membership: {
    organizationId: string;
    role: 'ADMIN' | 'EDITOR' | 'READER';
    organizationName: string;
    organizationSlug: string;
  } | null;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
};

export async function fetchSession(): Promise<SessionResponse | null> {
  const response = await fetch(`${apiOrigin()}/auth/session`, { credentials: 'include' });
  if (!response.ok) return null;
  return response.json();
}
