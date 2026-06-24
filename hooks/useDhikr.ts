import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TASBIH_SEQUENCE, TasbihStep } from '../data/adhkar';

const TASBIH_KEY = '@GrowPray:tasbih';
const DHIKR_STREAK_KEY = '@GrowPray:dhikrStreak';

export type DhikrMode = 'sequence' | 'custom';

/** Result of a tap, so the UI can drive haptics + animation. */
export type TapResult = 'counting' | 'stepComplete' | 'allComplete';

interface TasbihState {
  mode: DhikrMode;
  stepIndex: number;
  count: number;
  customTarget: number;
}

interface DhikrStreakState {
  count: number;
  lastDate: string; // YYYY-MM-DD
}

function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useDhikr() {
  const [mode, setMode] = useState<DhikrMode>('sequence');
  const [stepIndex, setStepIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [customTarget, setCustomTarget] = useState(100);
  const [sequenceComplete, setSequenceComplete] = useState(false);
  const [dhikrStreak, setDhikrStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Load persisted state once.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TASBIH_KEY);
        if (raw) {
          const p: Partial<TasbihState> = JSON.parse(raw);
          if (p.mode === 'sequence' || p.mode === 'custom') setMode(p.mode);
          if (typeof p.stepIndex === 'number') setStepIndex(Math.max(0, Math.min(TASBIH_SEQUENCE.length - 1, p.stepIndex)));
          if (typeof p.count === 'number') setCount(Math.max(0, p.count));
          if (typeof p.customTarget === 'number') setCustomTarget(Math.max(1, p.customTarget));
        }
        const sraw = await AsyncStorage.getItem(DHIKR_STREAK_KEY);
        if (sraw) {
          const s: DhikrStreakState = JSON.parse(sraw);
          if (s.lastDate === dayKey(0) || s.lastDate === dayKey(-1)) {
            setDhikrStreak(s.count || 0);
          } else {
            setDhikrStreak(0);
          }
        }
      } catch {
        // Safe defaults on any failure.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback((next: TasbihState) => {
    AsyncStorage.setItem(TASBIH_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const currentStep: TasbihStep = TASBIH_SEQUENCE[stepIndex] || TASBIH_SEQUENCE[0];
  const target = mode === 'custom' ? customTarget : currentStep.target;

  // Record a completed dhikr session toward the daily streak (premium feature).
  const recordDhikrStreak = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DHIKR_STREAK_KEY);
      const prev: DhikrStreakState | null = raw ? JSON.parse(raw) : null;
      const today = dayKey(0);
      if (prev && prev.lastDate === today) return; // already counted today
      const continues = prev && prev.lastDate === dayKey(-1);
      const nextCount = continues ? prev!.count + 1 : 1;
      await AsyncStorage.setItem(DHIKR_STREAK_KEY, JSON.stringify({ count: nextCount, lastDate: today }));
      setDhikrStreak(nextCount);
    } catch {
      // Non-critical.
    }
  }, []);

  // Increment the counter. Returns what happened so the screen can react.
  const increment = useCallback((): TapResult => {
    if (mode === 'custom') {
      let result: TapResult = 'counting';
      setCount((c) => {
        const next = c + 1;
        if (next >= customTarget) result = 'allComplete';
        persist({ mode: 'custom', stepIndex, count: next, customTarget });
        return next;
      });
      return result;
    }

    // Sequence mode
    if (sequenceComplete) return 'allComplete';
    const step = TASBIH_SEQUENCE[stepIndex];
    const next = count + 1;
    if (next >= step.target) {
      const isLast = stepIndex >= TASBIH_SEQUENCE.length - 1;
      if (isLast) {
        setCount(step.target);
        setSequenceComplete(true);
        persist({ mode: 'sequence', stepIndex, count: step.target, customTarget });
        return 'allComplete';
      }
      // Advance to next step.
      const nextStep = stepIndex + 1;
      setStepIndex(nextStep);
      setCount(0);
      persist({ mode: 'sequence', stepIndex: nextStep, count: 0, customTarget });
      return 'stepComplete';
    }
    setCount(next);
    persist({ mode: 'sequence', stepIndex, count: next, customTarget });
    return 'counting';
  }, [mode, sequenceComplete, stepIndex, count, customTarget, persist]);

  const reset = useCallback(() => {
    setCount(0);
    setSequenceComplete(false);
    if (mode === 'sequence') {
      setStepIndex(0);
      persist({ mode: 'sequence', stepIndex: 0, count: 0, customTarget });
    } else {
      persist({ mode: 'custom', stepIndex, count: 0, customTarget });
    }
  }, [mode, stepIndex, customTarget, persist]);

  const switchMode = useCallback((m: DhikrMode) => {
    setMode(m);
    setCount(0);
    setSequenceComplete(false);
    if (m === 'sequence') {
      setStepIndex(0);
      persist({ mode: 'sequence', stepIndex: 0, count: 0, customTarget });
    } else {
      persist({ mode: 'custom', stepIndex: 0, count: 0, customTarget });
    }
  }, [customTarget, persist]);

  const updateCustomTarget = useCallback((t: number) => {
    const clamped = Math.max(1, Math.min(9999, Math.floor(t) || 1));
    setCustomTarget(clamped);
    setCount(0);
    persist({ mode: 'custom', stepIndex, count: 0, customTarget: clamped });
  }, [stepIndex, persist]);

  return {
    mode,
    stepIndex,
    stepCount: TASBIH_SEQUENCE.length,
    currentStep,
    count,
    target,
    customTarget,
    sequenceComplete,
    dhikrStreak,
    loaded,
    increment,
    reset,
    switchMode,
    updateCustomTarget,
    recordDhikrStreak,
  };
}
