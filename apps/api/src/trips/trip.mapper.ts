import type { Trip, TripMembership, TripInvitation, User } from '@prisma/client';
import type { TripInvitationView, TripMemberView, TripRole, TripSummary } from '@roamly/shared';

export function toTripSummary(trip: Trip, membership: TripMembership): TripSummary {
  return {
    id: trip.id,
    name: trip.name,
    destinationName: trip.destinationName,
    countryCode: trip.countryCode,
    startDate: formatDate(trip.startDate),
    endDate: formatDate(trip.endDate),
    budgetAmount: trip.budgetAmount?.toString() ?? null,
    budgetCurrency: trip.budgetCurrency,
    archivedAt: trip.archivedAt?.toISOString() ?? null,
    myRole: membership.role as TripRole,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}

export function toTripMemberView(membership: TripMembership, user: User): TripMemberView {
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    role: membership.role as TripRole,
    joinedAt: membership.joinedAt.toISOString(),
  };
}

export function toInvitationView(
  invitation: TripInvitation,
  trip: Pick<Trip, 'id' | 'name'>,
  inviter: Pick<User, 'displayName'>,
): TripInvitationView {
  return {
    id: invitation.id,
    tripId: trip.id,
    tripName: trip.name,
    invitedEmail: invitation.invitedEmail,
    invitedUserId: invitation.invitedUserId,
    invitedByDisplayName: inviter.displayName,
    intendedRole: invitation.intendedRole as TripRole,
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    respondedAt: invitation.respondedAt?.toISOString() ?? null,
  };
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
