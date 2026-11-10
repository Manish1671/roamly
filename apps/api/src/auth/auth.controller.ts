import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import {
  type CsrfResponse,
  CSRF_COOKIE_NAME,
  loginBodySchema,
  registerBodySchema,
  SESSION_COOKIE_NAME,
  type LoginBody,
  type RegisterBody,
} from '@roamly/shared';
import type { Request, Response } from 'express';
import type { EnvConfig } from '../config/env.schema';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import {
  clearCsrfCookieOptions,
  clearSessionCookieOptions,
  csrfCookieOptions,
  sessionCookieOptions,
} from './cookie.util';
import { CsrfGuard } from './csrf.guard';
import { CurrentUser } from './current-user.decorator';
import { generateSecureToken } from './crypto.util';
import { Public } from './public.decorator';
import { SessionAuthGuard } from './session-auth.guard';
import { TrustedOriginGuard } from './trusted-origin.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  private env(): EnvConfig {
    return {
      NODE_ENV: this.config.get('NODE_ENV', { infer: true }),
      API_HOST: this.config.get('API_HOST', { infer: true }),
      API_PORT: this.config.get('API_PORT', { infer: true }),
      DATABASE_URL: this.config.get('DATABASE_URL', { infer: true }),
      CORS_ORIGINS: this.config.get('CORS_ORIGINS', { infer: true }),
      SESSION_SECRET: this.config.get('SESSION_SECRET', { infer: true }),
      SESSION_TTL_HOURS: this.config.get('SESSION_TTL_HOURS', { infer: true }),
      COOKIE_SECURE: this.config.get('COOKIE_SECURE', { infer: true }),
    };
  }

  @Public()
  @Get('csrf')
  getCsrf(@Res({ passthrough: true }) res: Response): CsrfResponse {
    const env = this.env();
    const csrfToken = generateSecureToken(24);
    res.cookie(
      CSRF_COOKIE_NAME,
      csrfToken,
      csrfCookieOptions(env, env.SESSION_TTL_HOURS * 60 * 60 * 1000),
    );
    return { csrfToken };
  }

  @Public()
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerBodySchema)) body: RegisterBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const env = this.env();
    const { user, sessionToken, expiresAt } = await this.authService.register(body);
    res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(env, expiresAt));
    return { user };
  }

  @Public()
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const env = this.env();
    const { user, sessionToken, expiresAt } = await this.authService.login(body);
    res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(env, expiresAt));
    return { user };
  }

  @UseGuards(SessionAuthGuard, TrustedOriginGuard, CsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const env = this.env();
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    await this.authService.logout(token);
    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions(env));
    res.clearCookie(CSRF_COOKIE_NAME, clearCsrfCookieOptions(env));
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return { user: this.authService.getPublicUser(user) };
  }
}
