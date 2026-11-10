import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { createTripBodySchema, updateTripBodySchema } from '@roamly/shared';
import type { CreateTripBody, UpdateTripBody } from '@roamly/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard } from '../auth/csrf.guard';
import { TrustedOriginGuard } from '../auth/trusted-origin.guard';
import { TripsService } from './trips.service';

@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createTripBodySchema)) body: CreateTripBody,
  ) {
    return this.trips.createTrip(user, body);
  }

  @Get()
  async list(@CurrentUser() user: User) {
    const trips = await this.trips.listTripsForUser(user.id);
    return { trips };
  }

  @Get(':tripId')
  get(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.trips.getTrip(user.id, tripId);
  }

  @Patch(':tripId')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  update(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body(new ZodValidationPipe(updateTripBodySchema)) body: UpdateTripBody,
  ) {
    return this.trips.updateTrip(user.id, tripId, body);
  }

  @Post(':tripId/archive')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  archive(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.trips.archiveTrip(user.id, tripId);
  }
}
