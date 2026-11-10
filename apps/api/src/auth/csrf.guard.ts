import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@roamly/shared';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.get(CSRF_HEADER_NAME);
    const cookieRaw = req.cookies?.[CSRF_COOKIE_NAME];
    const cookie = typeof cookieRaw === 'string' ? cookieRaw : undefined;

    if (!header || !cookie || header !== cookie) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
