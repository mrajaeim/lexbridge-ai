import { Global, Module } from '@nestjs/common';
import { RateLimiter } from '../common/rate-limiter';
import { PermissionGuard } from '../permissions/permission.guard';
import { AccountLinkService } from './account-link.service';
import { AuthContextService } from './auth-context.service';
import { AuthController } from './auth.controller';
import { AuthFlowService } from './auth-flow.service';
import { GqlAuthGuard } from './gql-auth.guard';
import { OAuthTransactionStore } from './oauth-transaction.store';
import { OidcService } from './oidc.service';
import { SessionService } from './session.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    RateLimiter,
    OidcService,
    OAuthTransactionStore,
    SessionService,
    AccountLinkService,
    AuthFlowService,
    AuthContextService,
    GqlAuthGuard,
    PermissionGuard,
  ],
  exports: [
    RateLimiter,
    SessionService,
    AuthContextService,
    GqlAuthGuard,
    PermissionGuard,
    OidcService,
    OAuthTransactionStore,
    AuthFlowService,
    AccountLinkService,
  ],
})
export class AuthModule {}
