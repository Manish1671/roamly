import {
  Body,
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
import { castVoteBodySchema, createPollBodySchema } from '@roamly/shared';
import type { CastVoteBody, CreatePollBody } from '@roamly/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard } from '../auth/csrf.guard';
import { TrustedOriginGuard } from '../auth/trusted-origin.guard';
import { DestinationPollsService } from './destination-polls.service';

@Controller('trips/:tripId/polls')
export class DestinationPollsController {
  constructor(private readonly polls: DestinationPollsService) {}

  @Post()
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body(new ZodValidationPipe(createPollBodySchema)) body: CreatePollBody,
  ) {
    return this.polls.createPoll(user, tripId, body);
  }

  @Get()
  list(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.polls.listPolls(user.id, tripId);
  }

  @Get('decision')
  latestDecision(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.polls.getLatestDecision(user.id, tripId);
  }

  @Get(':pollId')
  getOne(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
  ) {
    return this.polls.getPoll(user.id, tripId, pollId);
  }

  @Post(':pollId/votes')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  vote(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @Body(new ZodValidationPipe(castVoteBodySchema)) body: CastVoteBody,
  ) {
    return this.polls.castVote(user, tripId, pollId, body);
  }

  @Post(':pollId/close')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  close(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
  ) {
    return this.polls.closePoll(user, tripId, pollId);
  }

  @Get(':pollId/results')
  results(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
  ) {
    return this.polls.getResults(user.id, tripId, pollId);
  }

  @Post(':pollId/finalize')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.CREATED)
  finalize(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
  ) {
    return this.polls.finalizePoll(user, tripId, pollId);
  }
}
