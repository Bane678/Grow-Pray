import { useMemo } from 'react';

// ─── Prayer insights - pure, on-device analytics over local prayer data ──────────
// Derives everything from `prayerHistory` (Record<dateKey, completedPrayerNames[]>)
// and `streaks` (Record<prayerName, currentStreak>). No new persisted data needed.

export const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = (typeof PRAYER_ORDER)[number];

export type PrayerHistory = Record<string, string[]>;
export type PrayerStreaks = Record<string, number>;

// Local date key "YYYY-MM-DD" (mirrors the format written elsewhere in the app).
function getDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Build an array of the most recent `windowDays` date keys, oldest → newest.
function recentDateKeys(windowDays: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(getDateKey(d));
  }
  return keys;
}

export interface PrayerInsights {
  /** 0..1 completion rate per prayer over the window. */
  perPrayerRate: Record<PrayerName, number>;
  /** Prayer with the highest rate (null if no data). */
  mostConsistent: PrayerName | null;
  /** Prayer with the lowest rate (null if no data). */
  leastConsistent: PrayerName | null;
  /** Completion fraction (0..1) per bucket across the window, oldest → newest. */
  completionTrend: number[];
  /** Days in the window where all 5 prayers were completed. */
  perfectDays: number;
  /** Total prayers completed in the window. */
  totalPrayers: number;
  /** Best current streak across all prayers. */
  bestStreak: number;
  /** Whether there is any history at all in the window. */
  hasData: boolean;
}

export function computePrayerInsights(
  history: PrayerHistory,
  streaks: PrayerStreaks,
  windowDays = 30,
  trendBuckets = 6,
): PrayerInsights {
  const keys = recentDateKeys(windowDays);

  // Per-prayer counts over the window.
  const counts: Record<PrayerName, number> = {
    Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0,
  };
  let totalPrayers = 0;
  let perfectDays = 0;
  let daysWithAny = 0;

  for (const key of keys) {
    const done = history[key] || [];
    if (done.length > 0) daysWithAny++;
    let dayCount = 0;
    for (const p of PRAYER_ORDER) {
      if (done.includes(p)) {
        counts[p]++;
        totalPrayers++;
        dayCount++;
      }
    }
    if (dayCount === PRAYER_ORDER.length) perfectDays++;
  }

  const denom = keys.length || 1;
  const perPrayerRate: Record<PrayerName, number> = {
    Fajr: counts.Fajr / denom,
    Dhuhr: counts.Dhuhr / denom,
    Asr: counts.Asr / denom,
    Maghrib: counts.Maghrib / denom,
    Isha: counts.Isha / denom,
  };

  // Most / least consistent (only meaningful when there is data).
  let mostConsistent: PrayerName | null = null;
  let leastConsistent: PrayerName | null = null;
  if (daysWithAny > 0) {
    let hi = -1;
    let lo = Infinity;
    for (const p of PRAYER_ORDER) {
      const r = perPrayerRate[p];
      if (r > hi) { hi = r; mostConsistent = p; }
      if (r < lo) { lo = r; leastConsistent = p; }
    }
  }

  // Completion trend: split the window into buckets, each bucket = avg daily
  // completion fraction (0..1) over its days.
  const completionTrend: number[] = [];
  const bucketSize = Math.max(1, Math.ceil(keys.length / trendBuckets));
  for (let i = 0; i < keys.length; i += bucketSize) {
    const slice = keys.slice(i, i + bucketSize);
    let sum = 0;
    for (const key of slice) {
      const done = history[key] || [];
      let c = 0;
      for (const p of PRAYER_ORDER) if (done.includes(p)) c++;
      sum += c / PRAYER_ORDER.length;
    }
    completionTrend.push(slice.length ? sum / slice.length : 0);
  }

  const bestStreak = Object.values(streaks).reduce((m, v) => (v > m ? v : m), 0);

  return {
    perPrayerRate,
    mostConsistent,
    leastConsistent,
    completionTrend,
    perfectDays,
    totalPrayers,
    bestStreak,
    hasData: daysWithAny > 0,
  };
}

/**
 * Monthly completion fraction (0..1) for each of the 12 months of `year`,
 * January → December. Future months return 0.
 */
export function computeYearOverview(history: PrayerHistory, year: number): number[] {
  const months: number[] = [];
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    let done = 0;
    let possible = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, m, d);
      if (date > now) break;
      possible += PRAYER_ORDER.length;
      const key = getDateKey(date);
      const completed = history[key] || [];
      for (const p of PRAYER_ORDER) if (completed.includes(p)) done++;
    }
    months.push(possible > 0 ? done / possible : 0);
  }
  return months;
}

/** Memoized hook wrapper for use inside components. */
export function usePrayerInsights(
  history: PrayerHistory,
  streaks: PrayerStreaks,
  windowDays = 30,
  trendBuckets = 6,
): PrayerInsights {
  return useMemo(
    () => computePrayerInsights(history, streaks, windowDays, trendBuckets),
    [history, streaks, windowDays, trendBuckets],
  );
}
