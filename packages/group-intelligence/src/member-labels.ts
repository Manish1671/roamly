export type MemberLabelResolver = (memberId: string) => string;

export const DEFAULT_MEMBER_LABEL = 'A trip member';

export function memberLabelFromMap(
  memberDisplayNames: Record<string, string> | undefined,
): MemberLabelResolver {
  return (memberId: string) => memberDisplayNames?.[memberId]?.trim() || DEFAULT_MEMBER_LABEL;
}
