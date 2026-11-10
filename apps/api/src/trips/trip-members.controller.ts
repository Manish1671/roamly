import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { updateMemberRoleBodySchema } from '@roamly/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard } from '../auth/csrf.guard';
import { TrustedOriginGuard } from '../auth/trusted-origin.guard';
import { TripMembersService } from './trip-members.service';

@Controller('trips/:tripId/members')
export class TripMembersController {
  constructor(private readonly members: TripMembersService) {}

  @Get()
  async list(@CurrentUser() user: User, @Param('tripId', ParseUUIDPipe) tripId: string) {
    const items = await this.members.listMembers(user.id, tripId);
    return { members: items };
  }

  @Patch(':userId')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  updateRole(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body(new ZodValidationPipe(updateMemberRoleBodySchema)) body: { role: string },
  ) {
    return this.members.updateMemberRole(user.id, tripId, targetUserId, body.role as never);
  }

  @Delete(':userId')
  @UseGuards(TrustedOriginGuard, CsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: User,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.members.removeMember(user.id, tripId, targetUserId);
  }
}
