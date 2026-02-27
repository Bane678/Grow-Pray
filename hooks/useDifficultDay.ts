import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DIFFICULT_DAY_KEY = '@GrowPray:difficultDay';
const DIFFICULT_DAY_USES_KEY = '@GrowPray:difficultDayUses';

// Difficult Day mode — allows users to mark a day as difficult
// Prayers still use standard Islamic deadlines

interface DifficultDayState {
  active: boolean;
  activatedDate: string | null; // date string e.g. "2026-02-15"
}

interface MonthlyUses {
  month: string; // "2026-02"
  count: number;
}

export function useDifficultDay(isPremium: boolean) {
  const [state, setState] = useState<DifficultDayState>({ active: false, activatedDate: null });
  const [monthlyUses, setMonthlyUses] = useState<MonthlyUses>({ month: '', count: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const maxUses = isPremium ? 10 : 3;
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-02"
  const today = new Date().toDateString();

  // Load state on mount
  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const [storedState, storedUses] = await Promise.all([
        AsyncStorage.getItem(DIFFICULT_DAY_KEY),
        AsyncStorage.getItem(DIFFICULT_DAY_USES_KEY),
      ]);

      let loadedState: DifficultDayState = { active: false, activatedDate: null };
      if (storedState) {
        loadedState = JSON.parse(storedState);
        // Auto-deactivate if it was activated on a different day
        if (loadedState.active && loadedState.activatedDate !== today) {
          loadedState = { active: false, activatedDate: null };
          await AsyncStorage.setItem(DIFFICULT_DAY_KEY, JSON.stringify(loadedState));
        }
      }
      setState(loadedState);

      let loadedUses: MonthlyUses = { month: currentMonth, count: 0 };
      if (storedUses) {
        loadedUses = JSON.parse(storedUses);
        // Reset if different month
        if (loadedUses.month !== currentMonth) {
          loadedUses = { month: currentMonth, count: 0 };
          await AsyncStorage.setItem(DIFFICULT_DAY_USES_KEY, JSON.stringify(loadedUses));
        }
      }
      setMonthlyUses(loadedUses);
    } catch (error) {
      console.error('Error loading difficult day state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activate = useCallback(async (): Promise<boolean> => {
    // Check if already active today
    if (state.active) return false;

    // Check monthly limit
    const effectiveUses = monthlyUses.month === currentMonth ? monthlyUses.count : 0;
    if (effectiveUses >= maxUses) return false;

    // Activate
    const newState: DifficultDayState = { active: true, activatedDate: today };
    const newUses: MonthlyUses = {
      month: currentMonth,
      count: effectiveUses + 1,
    };

    setState(newState);
    setMonthlyUses(newUses);

    await Promise.all([
      AsyncStorage.setItem(DIFFICULT_DAY_KEY, JSON.stringify(newState)),
      AsyncStorage.setItem(DIFFICULT_DAY_USES_KEY, JSON.stringify(newUses)),
    ]);

    return true;
  }, [state, monthlyUses, currentMonth, today, maxUses]);

  const deactivate = useCallback(async () => {
    const newState: DifficultDayState = { active: false, activatedDate: null };
    setState(newState);
    await AsyncStorage.setItem(DIFFICULT_DAY_KEY, JSON.stringify(newState));
  }, []);

  const usesRemaining = Math.max(0, maxUses - (monthlyUses.month === currentMonth ? monthlyUses.count : 0));

  return {
    isActive: state.active,
    usesRemaining,
    maxUses,
    usesThisMonth: monthlyUses.month === currentMonth ? monthlyUses.count : 0,
    isLoading,
    activate,
    deactivate,
  };
}
