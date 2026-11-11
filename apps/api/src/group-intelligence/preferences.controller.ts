import { Body, Controller, Get, Put, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { upsertMyPreferenceBodySchema } from '@roamly/shared';
import type { UpsertMyPreferenceBody } from '@roamly/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard } from '../auth/csrf.guard';
import { TrustedOriginGuard } from '../auth/trusted-origin.guard';
import { PreferencesService } from './preferences.service';

@Controller('trips/:tripId/preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  overview(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.preferences.getOverview(user.id, tripId);
  }

  @Get('status')
  status(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.preferences.getStatus(user.id, tripId);
  }

  @Put('me')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  upsertMe(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body(new ZodValidationPipe(upsertMyPreferenceBodySchema)) body: UpsertMyPreferenceBody,
  ) {
    return this.preferences.upsertMyPreference(user, tripId, body);
  }
}
