import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { EnvConfig } from '../config/env.schema';
import { generateSecureToken, hashToken } from './crypto.util';

export interface ValidatedSession {
  sessionId: string;
  user: User;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = generateSecureToken();
    const tokenHash = this.hash(token);
    const expiresAt = this.expiresAt();

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async validateSessionToken(token: string | undefined): Promise<ValidatedSession | null> {
    if (!token) {
      return null;
    }

    const tokenHash = this.hash(token);
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }

    return { sessionId: session.id, user: session.user };
  }

  async revokeByToken(token: string | undefined): Promise<boolean> {
    if (!token) {
      return false;
    }

    const tokenHash = this.hash(token);
    const result = await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count > 0;
  }

  async revokeSessionId(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hash(token: string): string {
    const secret = this.config.get('SESSION_SECRET', { infer: true });
    return hashToken(token, secret);
  }

  private expiresAt(): Date {
    const hours = this.config.get('SESSION_TTL_HOURS', { infer: true });
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
}
