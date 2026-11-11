import { DEFAULT_MEMBER_LABEL, type MemberLabelResolver } from './member-labels.js';
import type { DateRange, MemberPreferenceInput, NormalizedDestination } from './types.js';

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function parseDate(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return parseDate(a.startDate) <= parseDate(b.endDate) && parseDate(b.startDate) <= parseDate(a.endDate);
}

export function intersectDateRanges(ranges: DateRange[]): DateRange[] {
  if (ranges.length === 0) return [];
  let current: DateRange[] = [...ranges];
  for (let i = 1; i < ranges.length; i++) {
    const next: DateRange[] = [];
    for (const a of current) {
      for (const b of [ranges[i]]) {
        if (!rangesOverlap(a, b)) continue;
        const start = parseDate(a.startDate) > parseDate(b.startDate) ? a.startDate : b.startDate;
        const end = parseDate(a.endDate) < parseDate(b.endDate) ? a.endDate : b.endDate;
        if (parseDate(start) <= parseDate(end)) {
          next.push({ startDate: start, endDate: end });
        }
      }
    }
    current = next;
    if (current.length === 0) break;
  }
  return current;
}

export function groupHasOverlappingAvailability(members: MemberPreferenceInput[]): boolean {
  const perMember = members.map((m) => m.availability);
  if (perMember.some((r) => r.length === 0)) return false;
  let acc = perMember[0];
  for (let i = 1; i < perMember.length; i++) {
    const merged: DateRange[] = [];
    for (const a of acc) {
      for (const b of perMember[i]) {
        if (!rangesOverlap(a, b)) continue;
        const start = parseDate(a.startDate) > parseDate(b.startDate) ? a.startDate : b.startDate;
        const end = parseDate(a.endDate) < parseDate(b.endDate) ? a.endDate : b.endDate;
        if (parseDate(start) <= parseDate(end)) merged.push({ startDate: start, endDate: end });
      }
    }
    acc = merged;
    if (acc.length === 0) return false;
  }
  return acc.length > 0;
}

function budgetsComparable(
  aCurrency: string,
  bCurrency: string,
): boolean {
  return aCurrency.toUpperCase() === bCurrency.toUpperCase();
}

export function evaluateHardConstraints(
  destination: NormalizedDestination,
  members: MemberPreferenceInput[],
  memberLabel: MemberLabelResolver = () => DEFAULT_MEMBER_LABEL,
): string[] {
  const reasons: string[] = [];

  if (!groupHasOverlappingAvailability(members)) {
    reasons.push('No shared availability window across all members');
  }

  for (const member of members) {
    const who = memberLabel(member.memberId);
    if (!member.budget) {
      reasons.push(`${who} has no per-person budget preference recorded`);
      continue;
    }
    const budget = member.budget;
    if (!budgetsComparable(budget.currency, destination.budgetPerPerson.currency)) {
      reasons.push(
        `Budget currency mismatch for ${who} (${budget.currency} vs ${destination.budgetPerPerson.currency}) — amounts were not compared`,
      );
      continue;
    }
    if (budget.maxIsHardConstraint && budget.maxPerPerson !== null) {
      if (destination.budgetPerPerson.minPerPerson > budget.maxPerPerson) {
        reasons.push(
          `${who}'s hard per-person maximum (${formatMoney(budget.maxPerPerson, budget.currency)}) is below ${destination.name}'s indicative minimum (${formatMoney(destination.budgetPerPerson.minPerPerson, destination.budgetPerPerson.currency)} per person, estimate only)`,
        );
      }
    }
  }

  return reasons;
}
