import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { EnvConfig } from '../config/env.schema';

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const allowed = this.config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    if (allowed.length === 0) {
      return true;
    }

    const origin = req.get('origin');
    const referer = req.get('referer');

    if (origin && allowed.includes(origin)) {
      return true;
    }

    if (referer) {
      const ok = allowed.some((base) => referer.startsWith(base));
      if (ok) {
        return true;
      }
    }

    throw new ForbiddenException('Untrusted request origin');
  }
}
