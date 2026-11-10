import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TripInvitation, User } from '@prisma/client';
import type { InviteMemberBody } from '@roamly/shared';
import { PrismaService } from '../database/prisma.service';
import { TripAuthorizationService } from './trip-authorization.service';
import { toInvitationView } from './trip.mapper';

const INVITE_TTL_DAYS = 14;

@Injectable()
export class TripInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: TripAuthorizationService,
  ) {}

  async createInvitation(actor: User, tripId: string, input: InviteMemberBody) {
    const { trip, membership } = await this.authz.requireMembership(actor.id, tripId);
    this.authz.assertPermission(membership.role, 'INVITE');
    this.authz.assertTripWritable(trip);

    const email = input.email.toLowerCase();
    if (email === actor.email.toLowerCase()) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const invitedUser = await this.prisma.user.findUnique({ where: { email } });
    if (!invitedUser) {
      throw new NotFoundException('No registered user with that email address');
    }

    const existingMember = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId: invitedUser.id } },
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this trip');
    }

    const pending = await this.prisma.tripInvitation.findFirst({
      where: { tripId, invitedUserId: invitedUser.id, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException('A pending invitation already exists for this user');
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    try {
      const invitation = await this.prisma.tripInvitation.create({
        data: {
          tripId,
          invitedUserId: invitedUser.id,
          invitedEmail: email,
          invitedById: actor.id,
          intendedRole: input.role,
          expiresAt,
        },
        include: {
          trip: { select: { id: true, name: true } },
          invitedByUser: { select: { displayName: true } },
        },
      });

      return toInvitationView(invitation, invitation.trip, invitation.invitedByUser);
    } catch (err: unknown) {
      if (isPrismaUniqueViolation(err)) {
        throw new ConflictException('A pending invitation already exists for this user');
      }
      throw err;
    }
  }

  async listTripInvitations(userId: string, tripId: string) {
    const { membership } = await this.authz.requireMembership(userId, tripId);
    this.authz.assertPermission(membership.role, 'INVITE');

    const rows = await this.prisma.tripInvitation.findMany({
      where: { tripId },
      include: {
        trip: { select: { id: true, name: true } },
        invitedByUser: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.withExpiryStatus(row, row.trip, row.invitedByUser));
  }

  async listInvitationsForUser(userId: string) {
    const rows = await this.prisma.tripInvitation.findMany({
      where: { invitedUserId: userId, status: { in: ['PENDING', 'EXPIRED'] } },
      include: {
        trip: { select: { id: true, name: true } },
        invitedByUser: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(rows.map((row) => this.withExpiryStatus(row, row.trip, row.invitedByUser)));
  }

  async acceptInvitation(userId: string, invitationId: string) {
    return this.respondToInvitation(userId, invitationId, 'ACCEPTED');
  }

  async declineInvitation(userId: string, invitationId: string) {
    return this.respondToInvitation(userId, invitationId, 'DECLINED');
  }

  async revokeInvitation(userId: string, tripId: string, invitationId: string) {
    const { membership } = await this.authz.requireMembership(userId, tripId);
    this.authz.assertPermission(membership.role, 'INVITE');

    const invitation = await this.prisma.tripInvitation.findFirst({
      where: { id: invitationId, tripId },
      include: {
        trip: { select: { id: true, name: true, archivedAt: true } },
        invitedByUser: { select: { displayName: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.trip.archivedAt) {
      throw new ConflictException('Cannot modify invitations on an archived trip');
    }

    if (invitation.status !== 'PENDING') {
      throw new ConflictException('Invitation is no longer pending');
    }

    const updated = await this.prisma.tripInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED', respondedAt: new Date() },
      include: {
        trip: { select: { id: true, name: true } },
        invitedByUser: { select: { displayName: true } },
      },
    });

    return toInvitationView(updated, updated.trip, updated.invitedByUser);
  }

  private async respondToInvitation(
    userId: string,
    invitationId: string,
    outcome: 'ACCEPTED' | 'DECLINED',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.tripInvitation.findUnique({
        where: { id: invitationId },
        include: { trip: true },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.invitedUserId !== userId) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.status !== 'PENDING') {
        throw new ConflictException('Invitation is no longer pending');
      }

      if (invitation.expiresAt <= new Date()) {
        await tx.tripInvitation.update({
          where: { id: invitationId },
          data: { status: 'EXPIRED', respondedAt: new Date() },
        });
        throw new ConflictException('Invitation has expired');
      }

      if (invitation.trip.archivedAt) {
        throw new ConflictException('This trip is archived');
      }

      if (outcome === 'DECLINED') {
        const declined = await tx.tripInvitation.update({
          where: { id: invitationId },
          data: { status: 'DECLINED', respondedAt: new Date() },
          include: {
            trip: { select: { id: true, name: true } },
            invitedByUser: { select: { displayName: true } },
          },
        });
        return toInvitationView(declined, declined.trip, declined.invitedByUser);
      }

      const existing = await tx.tripMembership.findUnique({
        where: {
          tripId_userId: { tripId: invitation.tripId, userId },
        },
      });
      if (existing) {
        await tx.tripInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED', respondedAt: new Date() },
        });
        throw new ConflictException('You are already a member of this trip');
      }

      try {
        await tx.tripMembership.create({
          data: {
            tripId: invitation.tripId,
            userId,
            role: invitation.intendedRole,
          },
        });
      } catch (err: unknown) {
        if (isPrismaUniqueViolation(err)) {
          throw new ConflictException('Invitation is no longer pending');
        }
        throw err;
      }

      const accepted = await tx.tripInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
        include: {
          trip: { select: { id: true, name: true } },
          invitedByUser: { select: { displayName: true } },
        },
      });

      return toInvitationView(accepted, accepted.trip, accepted.invitedByUser);
    });
  }

  private async withExpiryStatus(
    invitation: TripInvitation,
    trip: { id: string; name: string },
    inviter: { displayName: string },
  ) {
    if (invitation.status === 'PENDING' && invitation.expiresAt <= new Date()) {
      const expired = await this.prisma.tripInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED', respondedAt: new Date() },
      });
      return toInvitationView({ ...invitation, status: expired.status }, trip, inviter);
    }

    return toInvitationView(invitation, trip, inviter);
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
}
