import { z } from 'zod';

export const tripRoles = ['OWNER', 'EDITOR', 'MEMBER', 'VIEWER'] as const;
export type TripRole = (typeof tripRoles)[number];

export const invitationStatuses = [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'REVOKED',
  'EXPIRED',
] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const currencyCode = z
  .string()
  .trim()
  .length(3, 'Currency must be a 3-letter ISO 4217 code')
  .transform((v) => v.toUpperCase());

const tripFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Trip name is required').max(120),
  destinationName: z.string().trim().min(1, 'Destination is required').max(200),
  countryCode: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length === 2 ? v.toUpperCase() : undefined)),
  startDate: isoDate,
  endDate: isoDate,
  budgetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Budget must be a positive decimal')
    .optional(),
  budgetCurrency: currencyCode.optional(),
});

export const createTripBodySchema = tripFieldsSchema
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  })
  .refine(
    (data) => {
      const hasBudget = Boolean(data.budgetAmount);
      const hasCurrency = Boolean(data.budgetCurrency);
      return hasBudget === hasCurrency;
    },
    { message: 'Budget amount and currency must be provided together', path: ['budgetCurrency'] },
  );

export const updateTripBodySchema = tripFieldsSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    { message: 'End date cannot be before start date', path: ['endDate'] },
  );

export const inviteMemberBodySchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(['EDITOR', 'MEMBER', 'VIEWER']),
});

export const updateMemberRoleBodySchema = z.object({
  role: z.enum(tripRoles),
});

export type CreateTripBody = z.infer<typeof createTripBodySchema>;
export type UpdateTripBody = z.infer<typeof updateTripBodySchema>;
export type InviteMemberBody = z.infer<typeof inviteMemberBodySchema>;

export interface TripSummary {
  id: string;
  name: string;
  destinationName: string;
  countryCode: string | null;
  startDate: string;
  endDate: string;
  budgetAmount: string | null;
  budgetCurrency: string | null;
  archivedAt: string | null;
  myRole: TripRole;
  createdAt: string;
  updatedAt: string;
}

export interface TripMemberView {
  userId: string;
  email: string;
  displayName: string;
  role: TripRole;
  joinedAt: string;
}

export interface TripInvitationView {
  id: string;
  tripId: string;
  tripName: string;
  invitedEmail: string;
  invitedUserId: string;
  invitedByDisplayName: string;
  intendedRole: TripRole;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
}
