import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from '@roamly/shared';
import { IS_PUBLIC_KEY } from './auth.constants';
import { SessionService } from './session.service';

export type AuthenticatedRequest = Request & {
  user?: import('@prisma/client').User;
  sessionId?: string;
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    const validated = await this.sessions.validateSessionToken(token);

    if (!validated) {
      throw new UnauthorizedException('Authentication required');
    }

    req.user = validated.user;
    req.sessionId = validated.sessionId;
    return true;
  }
}
