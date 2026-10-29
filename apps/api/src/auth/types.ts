import { OrgRole } from '@lexbridge/database';
import { Request, Response } from 'express';

export type SessionData = {
  userId: string;
  activeOrganizationId: string | null;
  idToken?: string;
  expiresAt: number;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type AuthMembership = {
  organizationId: string;
  role: OrgRole;
  organizationName: string;
  organizationSlug: string;
};

export type GqlContext = {
  req: Request;
  res: Response;
  sessionId: string | null;
  user: AuthUser | null;
  membership: AuthMembership | null;
};

export type IdTokenClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export type OAuthTransaction = {
  codeVerifier: string;
  nonce: string;
  returnTo: string;
};
