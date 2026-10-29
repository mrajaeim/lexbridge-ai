import { IdTokenClaims } from './types';

export function assertIdTokenClaims(
  claims: IdTokenClaims | undefined,
  expected: { issuer: string; audience: string; nonce: string; now: number },
): asserts claims is IdTokenClaims & { iss: string; sub: string; exp: number; nonce: string } {
  if (!claims) throw new Error('missing claims');
  if (claims.iss !== expected.issuer) throw new Error('issuer');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(expected.audience)) throw new Error('audience');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= expected.now) throw new Error('expired');
  if (claims.nonce !== expected.nonce) throw new Error('nonce');
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) throw new Error('subject');
}
