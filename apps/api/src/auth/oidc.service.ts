import { Injectable } from '@nestjs/common';
import { appConfig } from '../config';
import { IdTokenClaims, OAuthTransaction } from './types';

type DiscoveryConfig = Awaited<ReturnType<(typeof import('openid-client'))['discovery']>>;

export type GrantedTokens = {
  claims: () => import('./types').IdTokenClaims | undefined;
  idToken: string;
};

@Injectable()
export class OidcService {
  private configuration: Promise<DiscoveryConfig> | null = null;

  async begin(returnTo: string): Promise<{
    redirect: string;
    state: string;
    nonce: string;
    codeVerifier: string;
    returnTo: string;
  }> {
    const oidc = await import('openid-client');
    const config = await this.discover();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const settings = appConfig();
    const redirect = oidc.buildAuthorizationUrl(config, {
      redirect_uri: settings.oidcRedirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { redirect: redirect.href, state, nonce, codeVerifier, returnTo };
  }

  async grant(callbackUrl: URL, state: string, transaction: OAuthTransaction): Promise<GrantedTokens> {
    const oidc = await import('openid-client');
    const config = await this.discover();
    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: transaction.codeVerifier,
      expectedState: state,
      expectedNonce: transaction.nonce,
    });
    return {
      claims: () => tokens.claims() as IdTokenClaims | undefined,
      idToken: tokens.id_token ?? '',
    };
  }

  async logoutUrl(idToken: string): Promise<string> {
    const oidc = await import('openid-client');
    const config = await this.discover();
    const url = oidc.buildEndSessionUrl(config, {
      id_token_hint: idToken,
      post_logout_redirect_uri: appConfig().webOrigin,
    });
    return url.href;
  }

  private discover(): Promise<DiscoveryConfig> {
    if (!this.configuration) {
      this.configuration = (async () => {
        const oidc = await import('openid-client');
        const settings = appConfig();
        const issuer = new URL(settings.oidcIssuer);
        return oidc.discovery(issuer, settings.oidcClientId, settings.oidcClientSecret, undefined, {
          execute: issuer.protocol === 'http:' ? [oidc.allowInsecureRequests] : [],
        });
      })();
    }
    return this.configuration;
  }
}
