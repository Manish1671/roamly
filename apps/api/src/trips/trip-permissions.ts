import type { TripRole } from '@prisma/client';

export type TripPermission =
  | 'VIEW_TRIP'
  | 'EDIT_TRIP'
  | 'INVITE'
  | 'VIEW_MEMBERS'
  | 'CHANGE_ROLES'
  | 'REMOVE_MEMBER'
  | 'ARCHIVE'
  | 'SUBMIT_PREFERENCES'
  | 'GENERATE_RECOMMENDATIONS'
  | 'VOTE_ON_POLL'
  | 'MANAGE_POLL';

const MATRIX: Record<TripPermission, TripRole[]> = {
  VIEW_TRIP: ['OWNER', 'EDITOR', 'MEMBER', 'VIEWER'],
  EDIT_TRIP: ['OWNER', 'EDITOR'],
  INVITE: ['OWNER'],
  VIEW_MEMBERS: ['OWNER', 'EDITOR', 'MEMBER', 'VIEWER'],
  CHANGE_ROLES: ['OWNER'],
  REMOVE_MEMBER: ['OWNER'],
  ARCHIVE: ['OWNER'],
  SUBMIT_PREFERENCES: ['OWNER', 'EDITOR', 'MEMBER'],
  GENERATE_RECOMMENDATIONS: ['OWNER', 'EDITOR', 'MEMBER'],
  VOTE_ON_POLL: ['OWNER', 'EDITOR', 'MEMBER', 'VIEWER'],
  MANAGE_POLL: ['OWNER', 'EDITOR'],
};

export function roleHasPermission(role: TripRole, permission: TripPermission): boolean {
  return MATRIX[permission].includes(role);
}
