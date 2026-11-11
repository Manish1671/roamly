import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard } from '../auth/csrf.guard';
import { TrustedOriginGuard } from '../auth/trusted-origin.guard';
import { RecommendationsService } from './recommendations.service';

@Controller('trips/:tripId/recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Post('generate')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.CREATED)
  generate(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.recommendations.generate(user, tripId);
  }

  @Get()
  list(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.recommendations.listForTrip(user.id, tripId);
  }

  @Get(':recommendationId')
  getOne(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('recommendationId', ParseUUIDPipe) recommendationId: string,
  ) {
    return this.recommendations.getById(user.id, tripId, recommendationId);
  }
}
