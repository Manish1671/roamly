import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { LoginBody, PublicUser, RegisterBody } from '@roamly/shared';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async register(input: RegisterBody): Promise<{
    user: PublicUser;
    sessionToken: string;
    expiresAt: Date;
  }> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName,
      },
    });

    const { token, expiresAt } = await this.sessions.createSession(user.id);
    return { user: toPublicUser(user), sessionToken: token, expiresAt };
  }

  async login(input: LoginBody): Promise<{
    user: PublicUser;
    sessionToken: string;
    expiresAt: Date;
  }> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const valid = await this.passwords.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const { token, expiresAt } = await this.sessions.createSession(user.id);
    return { user: toPublicUser(user), sessionToken: token, expiresAt };
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    await this.sessions.revokeByToken(sessionToken);
  }

  getPublicUser(user: User): PublicUser {
    return toPublicUser(user);
  }
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}
