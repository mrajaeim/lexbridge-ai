import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@lexbridge/database';
import { appConfig } from '../config';
import { AccountLinkService } from './account-link.service';
import { assertIdTokenClaims } from './id-token-claims';
import { OAuthTransactionStore } from './oauth-transaction.store';
import { OidcService } from './oidc.service';

@Injectable()
export class AuthFlowService {
  constructor(
    private readonly oidc: OidcService,
    private readonly transactions: OAuthTransactionStore,
    private readonly accounts: AccountLinkService,
    private readonly prisma: PrismaService,
  ) {}

  async begin(returnTo: string): Promise<string> {
    const started = await this.oidc.begin(returnTo);
    await this.transactions.save(started.state, {
      codeVerifier: started.codeVerifier,
      nonce: started.nonce,
      returnTo,
    });
    return started.redirect;
  }

  async complete(callbackUrl: URL): Promise<{
    userId: string;
    organizationId: string | null;
    idToken: string;
    returnTo: string;
  }> {
    const state = callbackUrl.searchParams.get('state');
    if (!state) throw new BadRequestException('Invalid or replayed OAuth state');
    const transaction = await this.transactions.consume(state);
    if (!transaction) throw new BadRequestException('Invalid or replayed OAuth state');

    let granted;
    try {
      granted = await this.oidc.grant(callbackUrl, state, transaction);
    } catch {
      throw new UnauthorizedException('Invalid OIDC token');
    }

    const claims = granted.claims();
    try {
      assertIdTokenClaims(claims, {
        issuer: appConfig().oidcIssuer,
        audience: appConfig().oidcClientId,
        nonce: transaction.nonce,
        now: Date.now(),
      });
    } catch {
      throw new UnauthorizedException('Invalid OIDC token');
    }

    const user = await this.accounts.link(claims);
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    return {
      userId: user.id,
      organizationId: membership?.organizationId ?? null,
      idToken: granted.idToken,
      returnTo: transaction.returnTo,
    };
  }
}
