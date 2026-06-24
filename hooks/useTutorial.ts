import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TUTORIAL_KEY = '@GrowPray:tutorialComplete';

export type TutorialTargetId =
  | 'garden'
  | 'prayerBar'
  | 'stats'
  | 'qibla'
  | 'settings'
  | 'tabs';

export interface TutorialStep {
  id: TutorialTargetId;
  title: string;
  body: string;
  /** 'center' = no spotlight (used for the garden / fallback). */
  placement?: 'auto' | 'center';
}

// The six-step orientation tour. Copy is short and on-voice.
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'garden',
    title: 'This is your garden',
    body: 'Pray on time and it grows. Miss prayers and it withers. Pinch to zoom, drag to look around.',
    placement: 'center',
  },
  {
    id: 'prayerBar',
    title: 'Mark your prayers',
    body: 'Tap each prayer here once you have prayed it, within its time window.',
  },
  {
    id: 'stats',
    title: 'Your progress',
    body: 'Your streak, coins, XP, and growth bonus live up here.',
  },
  {
    id: 'qibla',
    title: 'Find the Qibla',
    body: 'Tap the compass any time to find the direction of the Kaaba.',
  },
  {
    id: 'settings',
    title: 'Settings',
    body: 'Location, prayer method, notifications, and more are behind the gear.',
  },
  {
    id: 'tabs',
    title: 'Explore the rest',
    body: 'Challenges, the shop, your history, and dhikr are all down here.',
  },
];

export function useTutorial() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const completedRef = useRef<boolean | null>(null);

  // Load the run-once flag.
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(TUTORIAL_KEY);
        completedRef.current = v === 'true';
      } catch {
        completedRef.current = false;
      } finally {
        setCompletedLoaded(true);
      }
    })();
  }, []);

  const persistComplete = useCallback(() => {
    completedRef.current = true;
    AsyncStorage.setItem(TUTORIAL_KEY, 'true').catch(() => {});
  }, []);

  /** Start the tour only if it has not been completed (unless forced for replay). */
  const start = useCallback((force = false) => {
    if (!force && completedRef.current) return;
    setStepIndex(0);
    setActive(true);
  }, []);

  const complete = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    persistComplete();
  }, [persistComplete]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= TUTORIAL_STEPS.length - 1) {
        // Last step → finish.
        setActive(false);
        persistComplete();
        return 0;
      }
      return i + 1;
    });
  }, [persistComplete]);

  const skip = useCallback(() => {
    complete();
  }, [complete]);

  /** Reset the flag and restart (used by "Replay tutorial"). */
  const replay = useCallback(() => {
    completedRef.current = false;
    AsyncStorage.removeItem(TUTORIAL_KEY).catch(() => {});
    setStepIndex(0);
    setActive(true);
  }, []);

  const hasCompleted = useCallback(() => completedRef.current === true, []);

  return {
    active,
    stepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    steps: TUTORIAL_STEPS,
    currentStep: TUTORIAL_STEPS[stepIndex],
    completedLoaded,
    start,
    next,
    skip,
    complete,
    replay,
    hasCompleted,
  };
}
