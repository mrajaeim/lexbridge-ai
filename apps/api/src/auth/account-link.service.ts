import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@lexbridge/database';
import { IdTokenClaims } from './types';

@Injectable()
export class AccountLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async link(claims: IdTokenClaims): Promise<{ id: string; email: string; name: string }> {
    const issuer = claims.iss;
    const subject = claims.sub;
    if (!issuer || !subject) {
      throw new UnauthorizedException('Invalid OIDC token');
    }
    const existing = await this.prisma.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
      include: { user: true },
    });
    if (existing) return existing.user;

    const email = claims.email?.toLowerCase();
    if (!email) throw new UnauthorizedException('Email claim is required');
    const verified = claims.email_verified === true;
    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      if (!verified) {
        throw new UnauthorizedException('Verified email is required to link this account');
      }
      await this.prisma.externalIdentity.create({
        data: { issuer, subject, userId: byEmail.id },
      });
      if (!byEmail.emailVerified) {
        await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { emailVerified: true },
        });
      }
      return byEmail;
    }

    return this.prisma.user.create({
      data: {
        email,
        name: claims.name?.trim() || email,
        emailVerified: verified,
        identities: { create: { issuer, subject } },
      },
    });
  }
}
