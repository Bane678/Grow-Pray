import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// v2 key — separate from old weekly-only storage so existing data doesn't conflict
const CHALLENGES_KEY = '@GrowPray:challenges_v2';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type WeeklyChallengeId = 'perfectWeek' | 'dawnWarrior' | 'onTimeMaster' | 'treePlanter';
export type DailyChallengeId  = 'fajrToday'  | 'allFiveToday' | 'onTimeToday' | 'plantToday';
export type ChallengeId = WeeklyChallengeId | DailyChallengeId;

// (legacy alias kept so App.tsx import doesn't need touching)
// export type ChallengeId used to be weekly-only — now it's the full union

export interface Challenge {
  id: ChallengeId;
  type: 'daily' | 'weekly';
  title: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  reward: number; // coins
  claimed: boolean;
}

interface CombinedState {
  weekStart: string;             // Monday YYYY-MM-DD
  dayStart:  string;             // Today  YYYY-MM-DD
  weekly:    Record<WeeklyChallengeId, Challenge>;
  daily:     Record<DailyChallengeId,  Challenge>;
  fajrDays:  string[];           // days Fajr was done (weekly Dawn Warrior)
}

// ─── Challenge definitions ─────────────────────────────────────────────────────

// Weekly — realistic across 7 days
const WEEKLY_DEFINITIONS: Record<WeeklyChallengeId, Omit<Challenge, 'progress' | 'claimed'>> = {
  perfectWeek: {
    id: 'perfectWeek', type: 'weekly',
    title: 'Perfect Week',
    description: 'Complete all 35 prayers this week',
    icon: '⭐',
    target: 35, reward: 200,
  },
  dawnWarrior: {
    id: 'dawnWarrior', type: 'weekly',
    title: 'Dawn Warrior',
    description: 'Complete Fajr every day this week',
    icon: '🌅',
    target: 7, reward: 100,
  },
  onTimeMaster: {
    id: 'onTimeMaster', type: 'weekly',
    title: 'On-Time Master',
    description: 'Complete 25 prayers on time this week',
    icon: '⏰',
    target: 25, reward: 150,
  },
  treePlanter: {
    id: 'treePlanter', type: 'weekly',
    title: 'Tree Planter',
    description: 'Plant 3 new trees this week',
    icon: '🌳',
    target: 3, reward: 50,
  },
};

// Daily — all completable within a single day (5 prayers max)
const DAILY_DEFINITIONS: Record<DailyChallengeId, Omit<Challenge, 'progress' | 'claimed'>> = {
  fajrToday: {
    id: 'fajrToday', type: 'daily',
    title: 'Dawn Start',
    description: 'Complete Fajr prayer today',
    icon: '🌄',
    target: 1, reward: 10,
  },
  allFiveToday: {
    id: 'allFiveToday', type: 'daily',
    title: 'Daily Devotion',
    description: 'Complete all 5 prayers today',
    icon: '🕌',
    target: 5, reward: 30,
  },
  onTimeToday: {
    id: 'onTimeToday', type: 'daily',
    title: 'On Schedule',
    description: 'Complete 3 prayers on time today',
    icon: '⏱️',
    target: 3, reward: 20,
  },
  plantToday: {
    id: 'plantToday', type: 'daily',
    title: 'Green Thumb',
    description: 'Plant a tree in your garden today',
    icon: '🪴',
    target: 1, reward: 15,
  },
};

// ─── Time helpers ──────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekStartMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

/** Time until next Monday midnight (weekly reset) */
export function getTimeUntilReset(): { days: number; hours: number; minutes: number } {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  const totalMinutes = Math.floor((nextMonday.getTime() - now.getTime()) / 60000);
  return {
    days:    Math.floor(totalMinutes / (60 * 24)),
    hours:   Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
  };
}

/** Time until midnight tonight (daily reset) */
export function getTimeUntilMidnight(): { hours: number; minutes: number } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(now.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const totalMinutes = Math.floor((midnight.getTime() - now.getTime()) / 60000);
  return {
    hours:   Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

// ─── State factories ───────────────────────────────────────────────────────────

function createFreshWeekly(): Record<WeeklyChallengeId, Challenge> {
  const r = {} as Record<WeeklyChallengeId, Challenge>;
  for (const [id, def] of Object.entries(WEEKLY_DEFINITIONS)) {
    r[id as WeeklyChallengeId] = { ...def, progress: 0, claimed: false };
  }
  return r;
}

function createFreshDaily(): Record<DailyChallengeId, Challenge> {
  const r = {} as Record<DailyChallengeId, Challenge>;
  for (const [id, def] of Object.entries(DAILY_DEFINITIONS)) {
    r[id as DailyChallengeId] = { ...def, progress: 0, claimed: false };
  }
  return r;
}

function createFreshState(): CombinedState {
  return {
    weekStart: getWeekStartMonday(),
    dayStart:  getToday(),
    weekly:    createFreshWeekly(),
    daily:     createFreshDaily(),
    fajrDays:  [],
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useChallenges() {
  const [state, setState] = useState<CombinedState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadChallenges(); }, []);

  const loadChallenges = async () => {
    try {
      const stored = await AsyncStorage.getItem(CHALLENGES_KEY);
      const currentWeek = getWeekStartMonday();
      const today = getToday();

      if (stored) {
        let parsed: CombinedState = JSON.parse(stored);

        // Ensure buckets exist (guard against old schema)
        if (!parsed.weekly) parsed.weekly = createFreshWeekly();
        if (!parsed.daily)  parsed.daily  = createFreshDaily();

        if (parsed.weekStart !== currentWeek) {
          parsed = { ...parsed, weekStart: currentWeek, weekly: createFreshWeekly(), fajrDays: [] };
        }
        if (parsed.dayStart !== today) {
          parsed = { ...parsed, dayStart: today, daily: createFreshDaily() };
        }

        setState(parsed);
        await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(parsed));
      } else {
        const fresh = createFreshState();
        setState(fresh);
        await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(fresh));
      }
    } catch {
      setState(createFreshState());
    } finally {
      setIsLoading(false);
    }
  };

  const persist = useCallback(async (newState: CombinedState) => {
    setState(newState);
    await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(newState));
  }, []);

  /**
   * Call when a prayer is marked complete.
   * Updates both daily and weekly progress where relevant.
   */
  const recordPrayerCompletion = useCallback(async (prayer: string, isOnTime: boolean) => {
    if (!state) return;
    const ns: CombinedState = { ...state, weekly: { ...state.weekly }, daily: { ...state.daily } };
    const today = getToday();

    // Weekly — Perfect Week (all prayers)
    const pw = { ...ns.weekly.perfectWeek };
    if (pw.progress < pw.target) pw.progress++;
    ns.weekly.perfectWeek = pw;

    // Weekly — Dawn Warrior (unique Fajr days)
    if (prayer === 'Fajr') {
      const fajrDays = [...(ns.fajrDays ?? [])];
      if (!fajrDays.includes(today)) {
        fajrDays.push(today);
        ns.fajrDays = fajrDays;
        const dw = { ...ns.weekly.dawnWarrior };
        dw.progress = fajrDays.length;
        ns.weekly.dawnWarrior = dw;
      }
    }

    // Weekly — On-Time Master
    if (isOnTime) {
      const otm = { ...ns.weekly.onTimeMaster };
      if (otm.progress < otm.target) otm.progress++;
      ns.weekly.onTimeMaster = otm;
    }

    // Daily — Dawn Start (Fajr)
    if (prayer === 'Fajr') {
      const ft = { ...ns.daily.fajrToday };
      if (ft.progress < ft.target) ft.progress++;
      ns.daily.fajrToday = ft;
    }

    // Daily — Daily Devotion (all 5)
    const af = { ...ns.daily.allFiveToday };
    if (af.progress < af.target) af.progress++;
    ns.daily.allFiveToday = af;

    // Daily — On Schedule (on-time count)
    if (isOnTime) {
      const ot = { ...ns.daily.onTimeToday };
      if (ot.progress < ot.target) ot.progress++;
      ns.daily.onTimeToday = ot;
    }

    await persist(ns);
  }, [state, persist]);

  /**
   * Call when a prayer is unchecked/toggled off.
   */
  const undoPrayerCompletion = useCallback(async (prayer: string, wasOnTime: boolean) => {
    if (!state) return;
    const ns: CombinedState = { ...state, weekly: { ...state.weekly }, daily: { ...state.daily } };
    const today = getToday();

    const pw = { ...ns.weekly.perfectWeek };
    if (pw.progress > 0) pw.progress--;
    ns.weekly.perfectWeek = pw;

    if (prayer === 'Fajr') {
      const fajrDays = (ns.fajrDays ?? []).filter(d => d !== today);
      ns.fajrDays = fajrDays;
      const dw = { ...ns.weekly.dawnWarrior };
      dw.progress = fajrDays.length;
      ns.weekly.dawnWarrior = dw;

      const ft = { ...ns.daily.fajrToday };
      if (ft.progress > 0) ft.progress--;
      ns.daily.fajrToday = ft;
    }

    if (wasOnTime) {
      const otm = { ...ns.weekly.onTimeMaster };
      if (otm.progress > 0) otm.progress--;
      ns.weekly.onTimeMaster = otm;

      const ot = { ...ns.daily.onTimeToday };
      if (ot.progress > 0) ot.progress--;
      ns.daily.onTimeToday = ot;
    }

    const af = { ...ns.daily.allFiveToday };
    if (af.progress > 0) af.progress--;
    ns.daily.allFiveToday = af;

    await persist(ns);
  }, [state, persist]);

  /**
   * Record a tree plant — counts toward both weekly and daily tree challenges.
   */
  const recordTreePlanted = useCallback(async () => {
    if (!state) return;
    const ns: CombinedState = { ...state, weekly: { ...state.weekly }, daily: { ...state.daily } };

    const tp = { ...ns.weekly.treePlanter };
    if (tp.progress < tp.target) tp.progress++;
    ns.weekly.treePlanter = tp;

    const pt = { ...ns.daily.plantToday };
    if (pt.progress < pt.target) pt.progress++;
    ns.daily.plantToday = pt;

    await persist(ns);
  }, [state, persist]);

  /**
   * Claim a completed challenge reward. Returns coins awarded, or 0 if not claimable.
   */
  const claimReward = useCallback(async (challengeId: ChallengeId): Promise<number> => {
    if (!state) return 0;

    const isWeekly  = challengeId in state.weekly;
    const bucket    = isWeekly ? 'weekly' : 'daily';
    const challenge = isWeekly
      ? state.weekly[challengeId as WeeklyChallengeId]
      : state.daily[challengeId as DailyChallengeId];

    if (!challenge || challenge.claimed || challenge.progress < challenge.target) return 0;

    const ns = { ...state, [bucket]: { ...(state as any)[bucket] } };
    (ns as any)[bucket][challengeId] = { ...challenge, claimed: true };
    await persist(ns);
    return challenge.reward;
  }, [state, persist]);

  // ─── Derived values ───────────────────────────────────────────────────────────
  const weeklyChallengesList = state ? Object.values(state.weekly) : Object.values(createFreshWeekly());
  const dailyChallengesList  = state ? Object.values(state.daily)  : Object.values(createFreshDaily());
  const challengesList       = [...dailyChallengesList, ...weeklyChallengesList];
  const totalCompleted       = challengesList.filter(c => c.claimed).length;
  const totalClaimable       = challengesList.filter(c => c.progress >= c.target && !c.claimed).length;

  return {
    challenges: state?.weekly ?? createFreshWeekly(),  // back-compat alias
    challengesList,
    weeklyChallengesList,
    dailyChallengesList,
    totalCompleted,
    totalClaimable,
    isLoading,
    recordPrayerCompletion,
    undoPrayerCompletion,
    recordTreePlanted,
    claimReward,
  };
}
