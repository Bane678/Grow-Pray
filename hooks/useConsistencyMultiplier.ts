import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage keys ───────────────────────────────────────────────────────────────
const PERFECT_DAYS_KEY = '@GrowPray:perfectDays';
const LAST_PERFECT_DATE_KEY = '@GrowPray:lastPerfectDate';

// ─── Multiplier tiers ───────────────────────────────────────────────────────────
const MULTIPLIER_TIERS = [
  { minDays: 60, multiplier: 2.0 },
  { minDays: 30, multiplier: 1.75 },
  { minDays: 14, multiplier: 1.5 },
  { minDays: 7, multiplier: 1.25 },
  { minDays: 0, multiplier: 1.0 },
];

/**
 * Get the XP multiplier for a given number of consecutive perfect days.
 */
export function getMultiplierForDays(days: number): number {
  for (const tier of MULTIPLIER_TIERS) {
    if (days >= tier.minDays) return tier.multiplier;
  }
  return 1.0;
}

/**
 * Get info about the next multiplier tier (for progress display).
 */
export function getNextTier(days: number): { daysNeeded: number; nextMultiplier: number } | null {
  // Find current tier index
  for (let i = 0; i < MULTIPLIER_TIERS.length; i++) {
    if (days >= MULTIPLIER_TIERS[i].minDays) {
      if (i === 0) return null; // Already at max
      return {
        daysNeeded: MULTIPLIER_TIERS[i - 1].minDays - days,
        nextMultiplier: MULTIPLIER_TIERS[i - 1].multiplier,
      };
    }
  }
  return null;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export interface ConsistencyMultiplierResult {
  /** Number of consecutive days with all 5 prayers completed */
  perfectDays: number;
  /** Current XP multiplier (1.0× – 2.0×) */
  multiplier: number;
  /** Days until next tier upgrade, null if at max */
  nextTier: { daysNeeded: number; nextMultiplier: number } | null;
  /** Whether data has been loaded from storage */
  loaded: boolean;
  /** Call when all 5 prayers are completed for today */
  recordPerfectDay: () => Promise<void>;
  /** Call when a prayer is missed (resets streak) */
  resetPerfectDays: () => Promise<void>;
  /** Debug: set perfect days to any value */
  debugSetPerfectDays: (days: number) => Promise<void>;
}

export function useConsistencyMultiplier(): ConsistencyMultiplierResult {
  const [perfectDays, setPerfectDays] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const storedDays = await AsyncStorage.getItem(PERFECT_DAYS_KEY);
        const storedDate = await AsyncStorage.getItem(LAST_PERFECT_DATE_KEY);
        const today = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (storedDays != null && storedDate != null) {
          const days = JSON.parse(storedDays);
          // If last perfect day was today or yesterday, streak is alive
          if (storedDate === today || storedDate === yesterdayStr) {
            setPerfectDays(days);
          } else {
            // Streak broken — too many days have passed
            setPerfectDays(0);
            await AsyncStorage.setItem(PERFECT_DAYS_KEY, JSON.stringify(0));
          }
        }
      } catch (e) {
        console.error('Failed to load consistency multiplier:', e);
      }
      setLoaded(true);
    })();
  }, []);

  const recordPerfectDay = useCallback(async () => {
    const today = new Date().toDateString();
    const storedDate = await AsyncStorage.getItem(LAST_PERFECT_DATE_KEY);

    // Don't double-count the same day
    if (storedDate === today) return;

    const newDays = perfectDays + 1;
    setPerfectDays(newDays);
    await AsyncStorage.setItem(PERFECT_DAYS_KEY, JSON.stringify(newDays));
    await AsyncStorage.setItem(LAST_PERFECT_DATE_KEY, today);
  }, [perfectDays]);

  const resetPerfectDays = useCallback(async () => {
    setPerfectDays(0);
    await AsyncStorage.setItem(PERFECT_DAYS_KEY, JSON.stringify(0));
    // Don't clear LAST_PERFECT_DATE_KEY — it's fine as stale
  }, []);

  const debugSetPerfectDays = useCallback(async (days: number) => {
    setPerfectDays(days);
    await AsyncStorage.setItem(PERFECT_DAYS_KEY, JSON.stringify(days));
    // Set last perfect date to today so it doesn't expire
    await AsyncStorage.setItem(LAST_PERFECT_DATE_KEY, new Date().toDateString());
  }, []);

  const multiplier = getMultiplierForDays(perfectDays);
  const nextTier = getNextTier(perfectDays);

  return {
    perfectDays,
    multiplier,
    nextTier,
    loaded,
    recordPerfectDay,
    resetPerfectDays,
    debugSetPerfectDays,
  };
}
