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
import { inviteMemberBodySchema } from '@roamly/shared';
import type { InviteMemberBody } from '@roamly/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard } from '../auth/csrf.guard';
import { TrustedOriginGuard } from '../auth/trusted-origin.guard';
import { TripInvitationsService } from './trip-invitations.service';

@Controller()
export class TripInvitationsController {
  constructor(private readonly invitations: TripInvitationsService) {}

  @Post('trips/:tripId/invitations')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body(new ZodValidationPipe(inviteMemberBodySchema)) body: InviteMemberBody,
  ) {
    return this.invitations.createInvitation(user, tripId, body);
  }

  @Get('trips/:tripId/invitations')
  async listForTrip(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    const items = await this.invitations.listTripInvitations(user.id, tripId);
    return { invitations: items };
  }

  @Get('invitations')
  async listMine(@CurrentUser() user: User) {
    const items = await this.invitations.listInvitationsForUser(user.id);
    return { invitations: items };
  }

  @Post('invitations/:invitationId/accept')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: User, @Param('invitationId', ParseUUIDPipe) invitationId: string) {
    return this.invitations.acceptInvitation(user.id, invitationId);
  }

  @Post('invitations/:invitationId/decline')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  decline(@CurrentUser() user: User, @Param('invitationId', ParseUUIDPipe) invitationId: string) {
    return this.invitations.declineInvitation(user.id, invitationId);
  }

  @Post('trips/:tripId/invitations/:invitationId/revoke')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  revoke(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitations.revokeInvitation(user.id, tripId, invitationId);
  }
}
