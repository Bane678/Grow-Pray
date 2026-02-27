import { useMemo } from 'react';

// ─── Ramadan 2026 dates (Hijri 1447) ──────────────────────────────────────────
// Ramadan 2026 is expected to begin on February 18 and end on March 19.
// These are hardcoded for the 2026 launch. Future years can be added below.
const RAMADAN_DATES: { year: number; start: string; end: string }[] = [
  { year: 2026, start: '2026-02-18', end: '2026-03-19' },
  { year: 2027, start: '2027-02-08', end: '2027-03-09' },
];

export const RAMADAN_XP_MULTIPLIER = 2.0;

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Detect whether we're currently in Ramadan and return the multiplier info.
 * Ramadan bonuses:
 * - 2× XP multiplier (stacks with consistency multiplier)
 * - Special banner text
 */
export function useRamadanMode() {
  const today = getToday();

  const { isRamadan, daysRemaining, ramadanDay } = useMemo(() => {
    for (const r of RAMADAN_DATES) {
      if (today >= r.start && today <= r.end) {
        // Calculate days remaining
        const endDate = new Date(r.end);
        const todayDate = new Date(today);
        const diffMs = endDate.getTime() - todayDate.getTime();
        const remaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Calculate which day of Ramadan it is (1-indexed)
        const startDate = new Date(r.start);
        const dayNum = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return { isRamadan: true, daysRemaining: remaining, ramadanDay: dayNum };
      }
    }
    return { isRamadan: false, daysRemaining: 0, ramadanDay: 0 };
  }, [today]);

  const multiplier = isRamadan ? RAMADAN_XP_MULTIPLIER : 1.0;

  // Banner text for TopInfoBar
  const bannerText = isRamadan
    ? `🌙 Ramadan Kareem — Day ${ramadanDay} · 2× XP!`
    : null;

  return {
    isRamadan,
    multiplier,
    daysRemaining,
    ramadanDay,
    bannerText,
  };
}
