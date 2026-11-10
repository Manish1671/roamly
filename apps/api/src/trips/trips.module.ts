import { Module } from '@nestjs/common';
import { TripAuthorizationService } from './trip-authorization.service';
import { TripInvitationsController } from './trip-invitations.controller';
import { TripInvitationsService } from './trip-invitations.service';
import { TripMembersController } from './trip-members.controller';
import { TripMembersService } from './trip-members.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  controllers: [TripsController, TripMembersController, TripInvitationsController],
  providers: [
    TripsService,
    TripMembersService,
    TripInvitationsService,
    TripAuthorizationService,
  ],
  exports: [TripAuthorizationService, TripsService],
})
export class TripsModule {}
