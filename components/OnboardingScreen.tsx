import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PREMIUM_PLANS } from '../hooks/usePremium';

const APP_LOGO = require('../assets/Garden Assets/Icons/App_Logo.png');
const ICON_HANDS = require('../assets/Garden Assets/Icons/Icon_Hands.png');
const ICON_LOCATION = require('../assets/Garden Assets/Icons/Icon_Location.png');
const ICON_BELL = require('../assets/Garden Assets/Icons/Icon_Bell.png');
const HERO_GARDEN = require('../assets/Garden Assets/Icons/Loading_Screen2.png');
const HERO_DAWN = require('../assets/Garden Assets/Icons/Loading_Screen.png');
const HERO_NIGHT = require('../assets/Garden Assets/Icons/Starry_Night_Sky.png');
const DEMO_IMAGE = require('../assets/Garden Assets/Icons/Demo_Image.png');
const ICON_SPARKLE = require('../assets/Garden Assets/Icons/Icon_Sparkle.png');
const GOLDEN_TREE = require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Grown.png');
const CEDAR_TREE  = require('../assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Grown.png');
const STARRY_NIGHT = require('../assets/Garden Assets/Icons/Starry_Night_Sky.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ONBOARDING_KEY = '@JannahGarden:onboardingComplete';
const USER_NAME_KEY = '@JannahGarden:userName';
const MADHAB_KEY = '@GrowPray:madhab';
const FACTORS_KEY = '@GrowPray:onboardingFactors';
const AGE_KEY = '@GrowPray:onboardingAge';
const MOTIVATION_KEY = '@GrowPray:onboardingMotivation';
const GOAL_KEY = '@GrowPray:onboardingGoal';
const BLOCKERS_KEY = '@GrowPray:onboardingBlockers';
const ROUTINE_KEY = '@GrowPray:onboardingRoutine';
const SOURCE_KEY = '@GrowPray:onboardingSource';

type OnboardingScreenProps = {
  onComplete: () => void;
  onMadhabChange?: (madhab: 'hanafi' | 'standard') => void;
  onPurchaseMonthly?: () => Promise<boolean>;
  onPurchaseYearly?: () => Promise<boolean>;
};

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type SelectOption = {
  value: string;
  label: string;
  icon: IconName;
  hint?: string;
};

type Step =
  | { kind: 'welcome'; title: string; body: string; cta: string; image: any }
  | { kind: 'singleSelect'; key: string; title: string; subtitle: string; cta: string; options: SelectOption[] }
  | { kind: 'multiSelect'; key: string; title: string; subtitle: string; cta: string; options: SelectOption[] }
  | { kind: 'pillar'; title: string; body: string; cta: string; icon?: IconName; iconImage?: any; imagePreview?: any; highlights?: string[] }
  | { kind: 'support'; title: string; body: string; cta: string }
  | { kind: 'transition'; title: string; subtitle: string; cta: string; icon?: IconName; iconImage?: any }
  | { kind: 'reframe'; title: string; body: string; cta: string }
  | { kind: 'quote'; source: string; quote: string; cta: string; image?: any }
  | { kind: 'nameInput'; title: string; body: string; cta: string; placeholder: string }
  | { kind: 'madhab' }
  | { kind: 'locationPermission' }
  | { kind: 'notificationPermission' }
  | { kind: 'paywall' }
  | { kind: 'freeWarning' };

type InsightCard = {
  title: string;
  body: string;
  icon: IconName;
  bullets?: string[];
};

// Maps each factor option value to its corresponding pillar step index in STEPS
const FACTOR_TO_PILLAR_INDEX: Record<string, number> = {
  privacy:    2,  // 'Private by default'
  no_ads:     3,  // 'Built for focus'
  accuracy:   4,  // 'Prayer times that stay accurate'
  tracking:   5,  // 'A garden that grows with your salah'
  challenges: 6,  // 'Built-in challenges and rewards'
};

const STEPS: Step[] = [
  { kind: 'welcome', title: 'Salaam', body: 'Every prayer you keep grows your garden. Every one you miss, it shows. A peaceful, honest companion for your daily worship.', cta: 'Bismillah', image: HERO_GARDEN },
  {
    kind: 'multiSelect',
    key: FACTORS_KEY,
    title: 'What matters most to you in a prayer app?',
    subtitle: 'Choose all that matter. We will tune your setup accordingly.',
    cta: 'Next',
    options: [
      { value: 'accuracy', label: 'Accurate local prayer times', icon: 'target' },
      { value: 'privacy', label: 'Strong privacy', icon: 'shield-check-outline' },
      { value: 'no_ads', label: 'No ads or distractions', icon: 'eye-off-outline' },
      { value: 'tracking', label: 'Progress and streak tracking', icon: 'sprout-outline' },
      { value: 'challenges', label: 'Challenges and rewards', icon: 'trophy-outline' },
    ],
  },
  { kind: 'pillar', title: 'Private by default', body: 'Your prayer data stays on your device. No accounts, no selling, no sharing.', cta: 'Next', icon: 'shield-check-outline', highlights: ['On-device only', 'No account required', 'Zero data sharing'] },
  { kind: 'pillar', title: 'Built for focus', body: 'No ads, no social feeds, no noise. Just a calm space to show up for your prayers.', cta: 'Next', icon: 'eye-off-outline', highlights: ['Ad-free experience', 'Distraction-free design', 'Clean & minimal UI'] },
  { kind: 'pillar', title: 'Prayer times that stay accurate', body: 'Location-aware and madhab-sensitive calculations so your salah timing is always dependable.', cta: 'Next', icon: 'bullseye-arrow', highlights: ['GPS or manual city', 'Madhab-aware Asr times', 'Auto-updated daily'] },
  { kind: 'pillar', title: 'A garden that grows with your salah', body: 'Every prayer you keep strengthens your garden. Miss days and it starts to show.', cta: 'Next', imagePreview: HERO_DAWN, highlights: ['Visual prayer momentum', 'Grows with consistency', 'Reflects missed days'] },
  { kind: 'pillar', title: 'Built-in challenges and rewards', body: 'Daily and weekly challenges keep motivation alive, especially when the routine gets hard.', cta: 'Next', icon: 'trophy-outline', highlights: ['Daily missions', 'Streak rewards', 'Coin system'] },
  { kind: 'support', title: 'Liking Grow Pray so far?', body: 'A quick rating helps more Muslims find the app.', cta: 'Leave a review' },
  { kind: 'transition', title: "Let's personalise your journey.", subtitle: 'A few quick questions, then we set up your prayer engine.', cta: 'Continue', icon: 'tune-variant' },
  { kind: 'nameInput', title: 'What should we call you?', body: 'We use your name in a few places to make the experience feel personal.', cta: 'Next', placeholder: 'Enter your name' },
  {
    kind: 'singleSelect',
    key: AGE_KEY,
    title: 'What is your age group?',
    subtitle: 'Used only for onboarding personalisation.',
    cta: 'Next',
    options: [
      { value: '10_15', label: '10-15', icon: 'account-group-outline' },
      { value: '16_20', label: '16-20', icon: 'account-group-outline' },
      { value: '21_25', label: '21-25', icon: 'account-group-outline' },
      { value: '26_30', label: '26-30', icon: 'account-group-outline' },
      { value: '31_45', label: '31-45', icon: 'account-group-outline' },
      { value: '46_plus', label: '46+', icon: 'account-group-outline' },
    ],
  },
  {
    kind: 'singleSelect',
    key: ROUTINE_KEY,
    title: 'How is your current prayer routine?',
    subtitle: "Be honest. We're here to support, not judge.",
    cta: 'Next',
    options: [
      { value: 'on_time', label: 'I pray 5x on time', icon: 'check-circle-outline' },
      { value: 'daily_not_on_time', label: 'I pray daily, not always on time', icon: 'clock-alert-outline' },
      { value: 'most_days', label: 'I pray most days', icon: 'calendar-check-outline' },
      { value: 'occasionally', label: 'I pray occasionally', icon: 'calendar-blank-outline' },
      { value: 'starting', label: "I'm trying to start", icon: 'seed-outline' },
    ],
  },
  {
    kind: 'singleSelect',
    key: MOTIVATION_KEY,
    title: 'What motivates you most right now?',
    subtitle: 'Choose the intention you want your journey to center around.',
    cta: 'Next',
    options: [
      { value: 'discipline', label: 'Build discipline', icon: 'target' },
      { value: 'khushu', label: 'Improve focus (khushu)', icon: 'heart-outline' },
      { value: 'fajr', label: 'Strengthen Fajr habit', icon: 'weather-sunset-up' },
      { value: 'barakah', label: 'Increase barakah in my day', icon: 'star-four-points-outline' },
    ],
  },
  {
    kind: 'singleSelect',
    key: GOAL_KEY,
    title: 'What is your top goal?',
    subtitle: 'Pick one primary goal so we can guide your first week clearly.',
    cta: 'Next',
    options: [
      { value: '5_on_time', label: 'Pray all 5 on time', icon: 'clock-check-outline' },
      { value: 'focus', label: 'Improve my focus in salah', icon: 'bullseye' },
      { value: 'character', label: 'Improve my character', icon: 'diamond-stone' },
      { value: 'fajr', label: 'Wake up consistently for Fajr', icon: 'weather-sunset-up' },
      { value: 'consistency', label: 'Build a stable daily routine', icon: 'repeat' },
    ],
  },
  {
    kind: 'multiSelect',
    key: BLOCKERS_KEY,
    title: 'What usually gets in the way?',
    subtitle: 'Select all that apply.',
    cta: 'Next',
    options: [
      { value: 'busy', label: 'Busy schedule', icon: 'run-fast' },
      { value: 'distractions', label: 'Phone distractions', icon: 'cellphone' },
      { value: 'uninspired', label: 'Low motivation', icon: 'emoticon-sad-outline' },
      { value: 'routine', label: 'Unstructured routine', icon: 'repeat' },
      { value: 'focus', label: 'Lack of focus', icon: 'brain' },
    ],
  },
  {
    kind: 'singleSelect',
    key: SOURCE_KEY,
    title: 'Where did you hear about Grow Pray?',
    subtitle: 'This helps us improve outreach and keep the app sustainable.',
    cta: 'Next',
    options: [
      { value: 'friends', label: 'Friends & Family', icon: 'account-multiple' },
      { value: 'app_store', label: 'App Store', icon: 'apple' },
      { value: 'instagram', label: 'Instagram', icon: 'instagram' },
      { value: 'tiktok', label: 'TikTok', icon: 'music-note' },
      { value: 'x', label: 'X', icon: 'alpha-x-circle-outline' },
      { value: 'facebook', label: 'Facebook', icon: 'facebook' },
    ],
  },
  { kind: 'madhab' },
  { kind: 'locationPermission' },
  { kind: 'notificationPermission' },
  { kind: 'paywall' },
  { kind: 'freeWarning' },
];
const TOTAL_STEPS = STEPS.length;
// Step indices that always produce an insight card (ROUTINE=11, MOTIVATION=12, BLOCKERS=14)
const INSIGHT_STEP_INDICES = [11, 12, 14];
const TRUE_TOTAL = STEPS.length + INSIGHT_STEP_INDICES.length; // 24 (21 steps + 3 insights)

// Common profanity/slur blocklist — word-boundary matched, case-insensitive.
// This is a client-side first pass; not exhaustive but catches obvious cases.
const BLOCKED_TERMS = [
  'fuck', 'fucker', 'fucking', 'fuk', 'f\u00fck',
  'shit', 'shyt', 'sht',
  'ass', 'asshole', 'arse',
  'bitch', 'b1tch',
  'cunt', 'cnt',
  'dick', 'dik', 'd1ck',
  'cock', 'c0ck',
  'pussy', 'puss',
  'bastard',
  'slut', 'sl\u00fct',
  'whore', 'wh0re',
  'nigger', 'nigga', 'n1gger', 'nigg',
  'faggot', 'fag', 'f\u00e4g',
  'retard', 'ret\u00e4rd',
  'kike', 'spic', 'chink', 'gook', 'wetback', 'cracker',
  'prick', 'twat', 'wanker', 'tosser',
  'penis', 'vagina', 'dildo', 'anal',
];

function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return BLOCKED_TERMS.some(term => {
    const clean = term.replace(/[^a-z0-9]/g, '');
    return normalized.includes(clean);
  });
}

export function OnboardingScreen({ onComplete, onMadhabChange, onPurchaseMonthly, onPurchaseYearly }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedMadhab, setSelectedMadhab] = useState<'hanafi' | 'standard' | null>(null);
  const [singleSelections, setSingleSelections] = useState<Record<string, string | null>>({});
  const [multiSelections, setMultiSelections] = useState<Record<string, string[]>>({});
  const [selectedStars, setSelectedStars] = useState(0);
  const [locationDenied, setLocationDenied] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const [insightCard, setInsightCard] = useState<InsightCard | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [dynamicSteps, setDynamicSteps] = useState<Step[]>(() => [...STEPS]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentStep = dynamicSteps[step];
  if (!currentStep) return null;

  // Visual position accounts for insight cards already passed + whether one is showing now
  const insightsPassed = INSIGHT_STEP_INDICES.filter(i => step > i).length;
  const visualStep = step + 1 + insightsPassed + (insightCard ? 1 : 0);

  const animateToStep = (nextStep: number, clearInsightOnComplete = false) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0.02, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      // Clear insight card atomically with the step update so the old step's
      // content never flashes back before the fade-in.
      if (clearInsightOnComplete) setInsightCard(null);
      slideAnim.setValue(30);
      // Wait one frame so React commits the new step's render to the native layer
      // before the fade-in starts — otherwise the native thread animates before
      // the content is painted, briefly exposing the white native window behind it.
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    });
  };

  const animateShowInsight = (insight: InsightCard) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0.02, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setInsightCard(insight);
      slideAnim.setValue(30);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    });
  };

  // Navigate to nextStep and immediately show its insight card in one animation
  const animateToStepWithInsight = (nextStep: number, insight: InsightCard) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0.02, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      setInsightCard(insight);
      slideAnim.setValue(-30);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    });
  };

  const saveSingle = async (key: string, value: string) => {
    setSingleSelections((prev) => ({ ...prev, [key]: value }));
    await AsyncStorage.setItem(key, value);
  };

  const toggleMulti = async (key: string, value: string) => {
    const previous = multiSelections[key] ?? [];
    const next = previous.includes(value) ? previous.filter((v) => v !== value) : [...previous, value];
    setMultiSelections((prev) => ({ ...prev, [key]: next }));
    await AsyncStorage.setItem(key, JSON.stringify(next));
  };

  const buildInsightForCurrentStep = (): InsightCard | null => {
    return buildInsightForStep(currentStep);
  };

  const buildInsightForStep = (targetStep: Step): InsightCard | null => {
    if (targetStep.kind === 'singleSelect' && targetStep.key === ROUTINE_KEY) {
      const selected = singleSelections[ROUTINE_KEY];
      if (selected === 'on_time') {
        return {
          title: 'We will help you protect your momentum',
          body: 'Grow Pray highlights streaks, history, and challenge wins so your consistency stays visible every day.',
          icon: 'fire',
          bullets: ['Per-prayer streak tracking', 'Prayer history review', 'Daily and weekly challenge rewards'],
        };
      }
      if (selected === 'daily_not_on_time') {
        return {
          title: 'Timing is where we can help most',
          body: 'We use prayer-time reminders plus your next-prayer context to help you pray earlier, more often.',
          icon: 'clock-check-outline',
          bullets: ['Local timing updates', 'Gentle notification nudges', 'Progress-based accountability'],
        };
      }
      return {
        title: 'Start small, then grow consistently',
        body: 'Your garden gives visible progress from each prayer, so motivation comes from momentum instead of pressure.',
        icon: 'sprout-outline',
        bullets: ['Each prayer grows your garden', 'Missed prayers show where to recover', 'Challenges keep your week on track'],
      };
    }

    if (targetStep.kind === 'singleSelect' && targetStep.key === MOTIVATION_KEY) {
      const selected = singleSelections[MOTIVATION_KEY];
      const byMotivation: Record<string, InsightCard> = {
        discipline: {
          title: 'Discipline becomes easier with structure',
          body: 'We reinforce habits through routines: reminders, streaks, and challenge cycles.',
          icon: 'repeat',
          bullets: ['Consistent reminders', 'Streak retention loop', 'Structured daily goals'],
        },
        khushu: {
          title: 'We help reduce distraction around salah',
          body: 'A clean, ad-free experience with focused prayer context helps bring attention back to worship.',
          icon: 'heart-outline',
          bullets: ['No ad clutter', 'Clear prayer context', 'Calm visual pacing'],
        },
        fajr: {
          title: 'Fajr habit is built through consistency',
          body: 'We support Fajr consistency through timing reminders and visible momentum in your garden.',
          icon: 'weather-sunset-up',
          bullets: ['Reliable local Fajr times', 'Reminder prompts', 'Streak continuity'],
        },
        barakah: {
          title: 'Small consistent acts create barakah',
          body: 'Grow Pray helps you stay steady with daily worship so your progress compounds over time.',
          icon: 'star-four-points-outline',
          bullets: ['Daily prayer rhythm', 'Rewarding consistency', 'Weekly reflection via history'],
        },
      };
      return selected ? byMotivation[selected] : null;
    }

    if (targetStep.kind === 'multiSelect' && targetStep.key === BLOCKERS_KEY) {
      const picks = multiSelections[BLOCKERS_KEY] ?? [];
      if (picks.length === 0) return null;
      const blockerMap: Record<string, { bullet: string; icon: IconName }> = {
        busy: { bullet: 'Prayer-time reminders help you catch salah despite a full day.', icon: 'run-fast' },
        distractions: { bullet: 'Focused, ad-free design removes extra noise and friction.', icon: 'cellphone' },
        uninspired: { bullet: 'Garden growth + challenge rewards gives consistent motivation.', icon: 'sprout-outline' },
        routine: { bullet: 'Streak tracking and daily goals rebuild structure week by week.', icon: 'repeat' },
        focus: { bullet: 'Simple guided flow reduces overwhelm and keeps priority clear.', icon: 'brain' },
      };
      const top = blockerMap[picks[0]];
      return {
        title: 'Here is how Grow Pray addresses your blockers',
        body: 'Based on your answers, we will tailor your first week around these support systems.',
        icon: top?.icon ?? 'shield-check-outline',
        bullets: picks.map((p) => blockerMap[p]?.bullet).filter(Boolean) as string[],
      };
    }

    return null;
  };

  const canContinue = useMemo(() => {
    if (currentStep.kind === 'singleSelect') return !!singleSelections[currentStep.key];
    if (currentStep.kind === 'multiSelect') return (multiSelections[currentStep.key] ?? []).length > 0;
    if (currentStep.kind === 'nameInput') return name.trim().length > 0 && !containsProfanity(name);
    if (currentStep.kind === 'madhab') return selectedMadhab !== null;
    return true;
  }, [currentStep, multiSelections, name, selectedMadhab, singleSelections]);

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const handlePremiumPurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const ok = selectedPlan === 'yearly'
        ? await onPurchaseYearly?.()
        : await onPurchaseMonthly?.();
      if (ok) await finishOnboarding();
    } catch (_) {
      // purchase failed — stay on page so user can retry or go free
    } finally {
      setPurchasing(false);
    }
  };

  const goBack = () => {
    if (insightCard) {
      // Dismiss the insight, slide back to reveal the step's question
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0.02, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 30, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        setInsightCard(null);
        slideAnim.setValue(-30);
        requestAnimationFrame(() => {
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]).start();
        });
      });
      return;
    }
    if (step === 0) return;
    const prevStep = step - 1;
    // If the previous step generated an insight going forward, re-show it going backward
    if (INSIGHT_STEP_INDICES.includes(prevStep)) {
      const prevStepDef = dynamicSteps[prevStep];
      const insight = prevStepDef ? buildInsightForStep(prevStepDef) : null;
      if (insight) {
        animateToStepWithInsight(prevStep, insight);
        return;
      }
    }
    animateToStep(prevStep);
  };

  const goNext = async () => {
    if (insightCard) {
      if (step === TOTAL_STEPS - 1) {
        setInsightCard(null);
        await finishOnboarding();
      } else {
        // Clear insight and advance step atomically inside the animation callback
        // so the previous step's content never flashes back before the fade-out.
        animateToStep(step + 1, true);
      }
      return;
    }

    if (currentStep.kind === 'nameInput') {
      if (containsProfanity(name)) {
        setNameError('Please choose a different name.');
        return;
      }
      setNameError(null);
      await AsyncStorage.setItem(USER_NAME_KEY, name.trim());
    }
    if (currentStep.kind === 'madhab' && selectedMadhab) {
      await AsyncStorage.setItem(MADHAB_KEY, selectedMadhab);
      onMadhabChange?.(selectedMadhab);
    }
    if (step === TOTAL_STEPS - 1) {
      await finishOnboarding();
      return;
    }

    const insight = buildInsightForCurrentStep();
    if (insight) {
      animateShowInsight(insight);
      return;
    }

    // When leaving the factors step, reorder pillar cards to match the user's selection order
    if (currentStep.kind === 'multiSelect' && currentStep.key === FACTORS_KEY) {
      const selectedValues = multiSelections[FACTORS_KEY] ?? [];
      // Reorder all 5 selectable pillars (indices 2-6) based on selection order
      const reorderablePillarIndices = [2, 3, 4, 5, 6];
      const selectedPillarIndices = selectedValues
        .map(v => FACTOR_TO_PILLAR_INDEX[v])
        .filter((i): i is number => i !== undefined);
      const unselectedPillarIndices = reorderablePillarIndices.filter(i => !selectedPillarIndices.includes(i));
      const reorderedPillarIndices = [...selectedPillarIndices, ...unselectedPillarIndices];
      setDynamicSteps(prev => {
        const newSteps = [...prev];
        reorderedPillarIndices.forEach((srcIdx, i) => {
          newSteps[2 + i] = STEPS[srcIdx];
        });
        return newSteps;
      });
    }

    animateToStep(step + 1);
  };

  const handleLocation = async (request: boolean) => {
    let granted = false;
    if (request) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        granted = status === 'granted';
      } catch {
        granted = false;
      }
    }
    setLocationDenied(!granted);
    await AsyncStorage.setItem('@GrowPray:locationPrompted', request ? 'true' : 'skipped');
    goNext();
  };

  const handleNotifications = async (request: boolean) => {
    let granted = false;
    if (request) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        granted = status === 'granted';
      } catch {
        granted = false;
      }
    }
    setNotifDenied(!granted);
    await AsyncStorage.setItem('@GrowPray:notificationsPrompted', request ? 'true' : 'skipped');
    goNext();
  };

  const renderSelectCard = (kind: 'singleSelect' | 'multiSelect') => {
    if (currentStep.kind !== kind) return null;
    const singleValue = singleSelections[currentStep.key];
    const multiValue = multiSelections[currentStep.key] ?? [];
    return (
      <View style={styles.panelTall}>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.subtitle}</Text>
        <View style={styles.optionList}>
          {currentStep.options.map((option) => {
            const selected = kind === 'singleSelect' ? singleValue === option.value : multiValue.includes(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                onPress={() =>
                  kind === 'singleSelect'
                    ? saveSingle(currentStep.key, option.value)
                    : toggleMulti(currentStep.key, option.value)
                }
              >
                <MaterialCommunityIcons name={option.icon} size={20} color={selected ? '#f8deb2' : 'rgba(247,241,232,0.86)'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                  {option.hint ? <Text style={styles.optionHint}>{option.hint}</Text> : null}
                </View>
                {selected ? <MaterialCommunityIcons name="check-circle" size={18} color="#e6bf81" /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity disabled={!canContinue} onPress={goNext} style={[styles.primaryButton, !canContinue && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCard = () => {
    if (insightCard) {
      return (
        <View style={styles.pillarCard}>
          <View style={styles.pillarHero}>
            <View style={styles.pillarGlow} />
            <MaterialCommunityIcons name={insightCard.icon} size={60} color="#d9a75f" />
          </View>
          <View style={styles.pillarContent}>
            <Text style={styles.pillarTitle}>{insightCard.title}</Text>
            <Text style={styles.pillarBody}>{insightCard.body}</Text>
            {insightCard.bullets && insightCard.bullets.length > 0 ? (
              <View style={styles.pillarHighlights}>
                {insightCard.bullets.map((bullet) => (
                  <View key={bullet} style={styles.pillarChip}>
                    <MaterialCommunityIcons name="check" size={13} color="#d9a75f" />
                    <Text style={styles.pillarChipText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (currentStep.kind === 'welcome') {
      return (
        <>
          {/* Phone mockup showing the real app */}
          <View style={styles.phoneMockupWrap}>
            <View style={styles.phoneMockupFrame}>
              <Image source={DEMO_IMAGE} style={styles.phoneMockupImage} resizeMode="cover" />
            </View>
          </View>
          <View style={styles.panel}>
            <Text style={[styles.title, { fontSize: 40, lineHeight: 46 }]}>{currentStep.title}</Text>
            <Text style={[styles.body, { fontSize: 18, lineHeight: 27 }]}>{currentStep.body}</Text>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (currentStep.kind === 'singleSelect' || currentStep.kind === 'multiSelect') {
      return renderSelectCard(currentStep.kind);
    }

    if (currentStep.kind === 'pillar') {
      return (
        <View style={styles.pillarCard}>
          {/* Hero zone */}
          {currentStep.imagePreview ? (
            <View style={styles.pillarHeroImage}>
              <Image source={currentStep.imagePreview} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={styles.pillarHeroOverlay} />
            </View>
          ) : (
            <View style={styles.pillarHero}>
              <View style={styles.pillarGlow} />
              {currentStep.iconImage ? (
                <Image source={currentStep.iconImage} style={{ width: 64, height: 64 }} resizeMode="contain" />
              ) : (
                <MaterialCommunityIcons name={currentStep.icon ?? 'star-four-points-outline'} size={60} color="#d9a75f" />
              )}
            </View>
          )}
          {/* Content */}
          <View style={styles.pillarContent}>
            <Text style={styles.pillarTitle}>{currentStep.title}</Text>
            <Text style={styles.pillarBody}>{currentStep.body}</Text>
            {currentStep.highlights && currentStep.highlights.length > 0 && (
              <View style={styles.pillarHighlights}>
                {currentStep.highlights.map((h, i) => (
                  <View key={i} style={styles.pillarChip}>
                    <MaterialCommunityIcons name="check" size={13} color="#d9a75f" />
                    <Text style={styles.pillarChipText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (currentStep.kind === 'support') {
      return (
        <View style={styles.panelTall}>
          <Text style={[styles.title, { textAlign: 'center' }]}>{currentStep.title}</Text>
          <Text style={[styles.body, { textAlign: 'center' }]}>{currentStep.body}</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setSelectedStars(star)}>
                <MaterialCommunityIcons name={star <= selectedStars ? 'star' : 'star-outline'} size={44} color={star <= selectedStars ? '#e6bf81' : 'rgba(247,241,232,0.30)'} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              Linking.openURL('https://apps.apple.com/app/growpray').catch(() => {});
              goNext();
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goNext} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'transition') {
      const copy = currentStep.subtitle;
      return (
        <View style={styles.pillarCard}>
          <View style={styles.pillarHero}>
            <View style={styles.pillarGlow} />
            {currentStep.iconImage ? (
              <Image source={currentStep.iconImage} style={{ width: 64, height: 64 }} resizeMode="contain" />
            ) : (
              <MaterialCommunityIcons name={currentStep.icon ?? 'sprout-outline'} size={60} color="#d9a75f" />
            )}
          </View>
          <View style={styles.pillarContent}>
            <Text style={styles.pillarTitle}>{currentStep.title}</Text>
            <Text style={styles.pillarBody}>{copy}</Text>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (currentStep.kind === 'quote') {
      return (
        <View style={styles.panelTall}>
          <View style={styles.quoteImageWrap}>{currentStep.image ? <Image source={currentStep.image} style={styles.quoteImage} resizeMode="cover" /> : null}</View>
          <Text style={styles.quoteSource}>{currentStep.source}</Text>
          <Text style={styles.quoteText}>{currentStep.quote}</Text>
          <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'reframe') {
      return (
        <View style={styles.panelTall}>
          <Text style={[styles.title, { textAlign: 'center' }]}>{currentStep.title}</Text>
          <View style={styles.notifyDemo}>
            <Text style={styles.notifyLabel}>Before</Text>
            <View style={styles.notifyBubble}>
              <Text style={styles.notifyTitle}>Asr</Text>
              <Text style={styles.notifyText}>It's time to pray.</Text>
            </View>
            <Text style={styles.notifyLabel}>After</Text>
            <View style={styles.notifyBubble}>
              <Text style={styles.notifyTitle}>Asr</Text>
              <Text style={styles.notifyText}>You have a meeting with Allah now.</Text>
            </View>
          </View>
          <Text style={[styles.body, { textAlign: 'center' }]}>{currentStep.body}</Text>
          <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'nameInput') {
      return (
        <View style={styles.panelTall}>
          <Text style={styles.title}>{currentStep.title}</Text>
          <Text style={styles.body}>{currentStep.body}</Text>
          <TextInput
            value={name}
            onChangeText={(text) => { setName(text); if (nameError) setNameError(null); }}
            placeholder={currentStep.placeholder}
            placeholderTextColor="rgba(247,241,232,0.34)"
            style={[styles.textInput, nameError ? { borderColor: 'rgba(239,68,68,0.6)' } : {}]}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canContinue) goNext();
            }}
          />
          {nameError && (
            <Text style={{ color: '#f87171', fontSize: 13, marginTop: -10, marginBottom: 10 }}>
              {nameError}
            </Text>
          )}
          <TouchableOpacity disabled={!canContinue} onPress={goNext} style={[styles.primaryButton, !canContinue && styles.disabled]}>
            <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'madhab') {
      return (
        <View style={styles.panelTall}>
          <Text style={styles.title}>School of thought</Text>
          <Text style={styles.body}>Your madhab determines whether you follow earlier or later Asr times.</Text>
          <View style={styles.madhabOptionsWrap}>
            <TouchableOpacity onPress={() => setSelectedMadhab('standard')} style={[styles.optionRow, selectedMadhab === 'standard' && styles.optionRowSelected]}>
              <MaterialCommunityIcons name="clock-time-eight-outline" size={20} color="#f4efe6" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, selectedMadhab === 'standard' && styles.optionLabelSelected]}>Earlier Asr time - Shafi'i, Maliki & Hanbali</Text>
              </View>
              {selectedMadhab === 'standard' ? <MaterialCommunityIcons name="check-circle" size={18} color="#e6bf81" /> : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedMadhab('hanafi')} style={[styles.optionRow, selectedMadhab === 'hanafi' && styles.optionRowSelected]}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#f4efe6" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, selectedMadhab === 'hanafi' && styles.optionLabelSelected]}>Later Asr time - Hanafi</Text>
              </View>
              {selectedMadhab === 'hanafi' ? <MaterialCommunityIcons name="check-circle" size={18} color="#e6bf81" /> : null}
            </TouchableOpacity>
          </View>
          <TouchableOpacity disabled={!canContinue} onPress={goNext} style={[styles.primaryButton, !canContinue && styles.disabled]}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'locationPermission') {
      return (
        <View style={styles.panelTall}>
          <View style={styles.iconWrap}>
            <Image source={ICON_LOCATION} style={styles.iconImage} />
          </View>
          <Text style={styles.title}>Location</Text>
          <Text style={styles.body}>Enable location permission to find your local prayer times and calculate qibla direction.</Text>
          <View style={styles.helperRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color="#e6bf81" />
            <Text style={styles.helperText}>Your location never leaves your phone.</Text>
          </View>
          <TouchableOpacity onPress={() => handleLocation(true)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Enable location</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleLocation(false)} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Skip for now</Text>
          </TouchableOpacity>
          {locationDenied ? <Text style={styles.caption}>You can enable this later in settings.</Text> : null}
        </View>
      );
    }

    if (currentStep.kind === 'notificationPermission') {
      return (
        <View style={styles.panelTall}>
          <View style={styles.iconWrap}>
            <Image source={ICON_BELL} style={styles.iconImage} />
          </View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.body}>Enable to receive prayer notifications. You can customise reminder styles later.</Text>
          <View style={styles.helperRow}>
            <MaterialCommunityIcons name="bell-ring-outline" size={16} color="#e6bf81" />
            <Text style={styles.helperText}>Gentle reminders, never noisy.</Text>
          </View>
          <TouchableOpacity onPress={() => handleNotifications(true)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Enable notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleNotifications(false)} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Maybe later</Text>
          </TouchableOpacity>
          {notifDenied ? <Text style={styles.caption}>You can enable this later in settings.</Text> : null}
        </View>
      );
    }

    if (currentStep.kind === 'paywall') {
      return (
        <>
          {/* Premium hero — golden tree on starry night */}
          <View style={styles.paywallHero}>
            <Image source={STARRY_NIGHT} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            {/* Golden tree — left */}
            <Image source={GOLDEN_TREE} style={styles.paywallHeroTreeLeft} resizeMode="contain" />
            {/* Cedar of Jannah — right */}
            <Image source={CEDAR_TREE} style={styles.paywallHeroTreeRight} resizeMode="contain" />
            {/* Bottom gradient fade into panel */}
            <LinearGradient
              colors={['rgba(9,14,22,0)', 'rgba(9,14,22,0.6)', 'rgba(9,14,22,0.98)']}
              style={StyleSheet.absoluteFillObject}
            />
            {/* PREMIUM badge */}
            <View style={styles.paywallHeroBadge}>
              <Image source={ICON_SPARKLE} style={{ width: 14, height: 14 }} resizeMode="contain" />
              <Text style={styles.paywallHeroBadgeText}>PREMIUM ONLY</Text>
            </View>
          </View>

          <View style={styles.paywallPanel}>
            {/* Title */}
            <Text style={styles.paywallTitle}>Grow without limits</Text>
            <Text style={styles.paywallSubtitle}>
              Unlock your garden's full potential
            </Text>

            {/* Benefits — pill-style with glow */}
            <View style={styles.benefitsGrid}>
              {[
                { icon: 'grid' as const, text: 'Unlimited garden' },
                { icon: 'circle-multiple' as const, text: '2× coins & XP' },
                { icon: 'tree' as const, text: 'Premium trees' },
                { icon: 'shield-check' as const, text: 'Free streak freezes' },
                { icon: 'weather-partly-cloudy' as const, text: 'Extra difficult days' },
                { icon: 'star-four-points' as const, text: 'Exclusive rewards' },
              ].map((b, i) => (
                <View key={i} style={styles.benefitPill}>
                  <MaterialCommunityIcons name={b.icon} size={15} color="#d9a75f" />
                  <Text style={styles.benefitPillText}>{b.text}</Text>
                </View>
              ))}
            </View>

            {/* Plan selector — side by side */}
            <View style={styles.planRow}>
              <TouchableOpacity
                onPress={() => setSelectedPlan('yearly')}
                style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
                activeOpacity={0.7}
              >
                {/* Best value badge */}
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>BEST VALUE</Text>
                </View>
                <Text style={styles.planTitle}>Yearly</Text>
                <Text style={styles.planPriceLarge}>
                  $3.75<Text style={styles.planPeriod}>/mo</Text>
                </Text>
                <Text style={styles.planStrikethrough}>$83.88</Text>
                <Text style={styles.planSub}>$44.99 billed yearly</Text>
                {selectedPlan === 'yearly' && (
                  <View style={styles.planRadio}>
                    <View style={styles.planRadioInner} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedPlan('monthly')}
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected, { paddingTop: 16 }]}
                activeOpacity={0.7}
              >
                <Text style={styles.planTitle}>Monthly</Text>
                <Text style={styles.planPriceLarge}>
                  $6.99<Text style={styles.planPeriod}>/mo</Text>
                </Text>
                {selectedPlan === 'monthly' && (
                  <View style={styles.planRadio}>
                    <View style={styles.planRadioInner} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={handlePremiumPurchase}
              disabled={purchasing}
              style={styles.premiumButton}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="lock-open-outline" size={18} color="#1a0f00" style={{ marginRight: 6 }} />
              <Text style={styles.premiumButtonText}>
                {purchasing ? 'Processing…' : 'Start 7-Day Free Trial'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.trialNote}>
              7 days free · then {selectedPlan === 'yearly' ? '$44.99/year' : '$6.99/month'} · Cancel anytime
            </Text>

            {/* Subtle skip */}
            <TouchableOpacity onPress={goNext} style={styles.freeLink}>
              <Text style={styles.freeLinkText}>Continue with free version</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (currentStep.kind === 'freeWarning') {
      const rows = [
        { label: 'Garden size',    free: '7×7 max',       premium: 'Unlimited',      freeOk: false },
        { label: 'Coin earning',   free: '1×',            premium: '2×',             freeOk: true },
        { label: 'Streak freezes', free: 'None',          premium: '2 / month',      freeOk: false },
        { label: 'Premium trees',  free: 'Locked',        premium: 'All unlocked',   freeOk: false },
      ];
      return (
        <View style={[styles.freeWarningPanel, { overflow: 'hidden' }]}>
          {/* Hero zone */}
          <View style={styles.pillarHero}>
            <View style={styles.pillarGlow} />
            <MaterialCommunityIcons name="lock-outline" size={60} color="#d9a75f" />
          </View>

          {/* Title */}
          <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 4 }}>
            <Text style={styles.pillarTitle}>Are you sure?</Text>
            <Text style={styles.pillarBody}>Here's what you'll miss with the free version</Text>
          </View>

          {/* Comparison table */}
          <View style={styles.comparisonTable}>
            {/* Header row */}
            <View style={styles.compHeaderRow}>
              <View style={{ flex: 2.2 }} />
              <View style={styles.compHeaderFree}>
                <Text style={styles.compHeaderFreeText}>Free</Text>
              </View>
              <View style={styles.compHeaderPremium}>
                <Image source={ICON_SPARKLE} style={{ width: 12, height: 12, marginRight: 3 }} resizeMode="contain" />
                <Text style={styles.compHeaderPremiumText}>Pro</Text>
              </View>
            </View>

            {/* Data rows */}
            {rows.map((row, i) => (
              <View key={i} style={[styles.compRow, i % 2 === 0 && styles.compRowAlt]}>
                <Text style={styles.compLabel}>{row.label}</Text>
                <View style={styles.compFreeCell}>
                  <MaterialCommunityIcons
                    name={row.freeOk ? 'check' : 'close'}
                    size={12}
                    color={row.freeOk ? 'rgba(247,241,232,0.35)' : '#ef4444'}
                  />
                  <Text style={[styles.compFreeVal, !row.freeOk && { color: 'rgba(247,241,232,0.28)' }]}>
                    {row.free}
                  </Text>
                </View>
                <View style={styles.compPremiumCell}>
                  <MaterialCommunityIcons name="check" size={12} color="#10b981" />
                  <Text style={styles.compPremiumVal}>{row.premium}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Upgrade CTA */}
          <TouchableOpacity
            onPress={handlePremiumPurchase}
            disabled={purchasing}
            style={styles.premiumButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="star-four-points" size={18} color="#1a0f00" style={{ marginRight: 6 }} />
            <Text style={styles.premiumButtonText}>
              {purchasing ? 'Processing…' : 'Unlock Premium'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.trialNote}>
            7 days free · then {selectedPlan === 'yearly' ? '$44.99/year' : '$6.99/month'} · Cancel anytime
          </Text>

          {/* Final skip */}
          <TouchableOpacity onPress={finishOnboarding} style={styles.freeLink}>
            <Text style={styles.freeLinkText}>No thanks, continue for free</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#08111c', '#0d1b2d', '#132437']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.progressRow}>
            {step > 0 ? (
              <TouchableOpacity onPress={goBack} style={styles.backButton}>
                <MaterialCommunityIcons name="chevron-left" size={22} color="rgba(247,241,232,0.72)" />
              </TouchableOpacity>
            ) : (
              <View style={styles.backPlaceholder} />
            )}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(visualStep / TRUE_TOTAL) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{visualStep}/{TRUE_TOTAL}</Text>
          </View>
          <ScrollView
            style={styles.scrollTransparent}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              {renderCard()}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1b2d' },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  glowTop: {
    position: 'absolute',
    top: -SCREEN_WIDTH * 0.18,
    right: -SCREEN_WIDTH * 0.18,
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderRadius: 999,
    backgroundColor: 'rgba(221,177,108,0.18)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -SCREEN_WIDTH * 0.3,
    left: -SCREEN_WIDTH * 0.3,
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: 999,
    backgroundColor: 'rgba(104,135,166,0.12)',
  },
  progressRow: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 54 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 5,
  },
  backButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  backPlaceholder: { width: 28, height: 28 },
  progressTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#d9a75f' },
  progressText: { color: 'rgba(247,241,232,0.72)', fontSize: 12, fontWeight: '700' },
  scrollTransparent: { backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, backgroundColor: 'transparent' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 18 },
  panel: {
    backgroundColor: 'rgba(7,13,22,0.82)',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  panelTall: {
    backgroundColor: 'rgba(7,13,22,0.86)',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroArt: {
    height: SCREEN_HEIGHT * 0.33,
    borderRadius: 30,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroArtImage: { borderRadius: 30, opacity: 0.92 },
  phoneMockupWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  phoneMockupFrame: {
    width: SCREEN_WIDTH * 0.52,
    height: SCREEN_HEIGHT * 0.38,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#0a0f1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  phoneMockupImage: {
    width: '100%',
    height: '100%',
  },
  logoBadge: {
    marginBottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(8,12,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  logoImage: { width: 24, height: 24, borderRadius: 6 },
  logoText: { color: '#f5ebd8', fontSize: 14, fontWeight: '800' },
  title: { color: '#ffffff', fontSize: 34, lineHeight: 40, fontWeight: '800', marginBottom: 12 },
  body: { color: 'rgba(247,241,232,0.74)', fontSize: 16, lineHeight: 24, marginBottom: 18 },
  optionList: { gap: 10, marginBottom: 20 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(13,26,43,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionRowSelected: {
    borderColor: 'rgba(217,167,95,0.78)',
    backgroundColor: 'rgba(63,52,31,0.48)',
  },
  optionLabel: { color: '#f4efe6', fontSize: 16, fontWeight: '700', lineHeight: 22 },
  optionLabelSelected: { color: '#f8deb2' },
  optionHint: { marginTop: 2, color: 'rgba(247,241,232,0.56)', fontSize: 12 },
  madhabOptionsWrap: { gap: 14, marginBottom: 18 },
  textInput: {
    width: '100%',
    backgroundColor: 'rgba(13,26,43,0.92)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: '#ffffff',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: 'rgba(217,167,95,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.22)',
  },
  transitionIcon: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: 'rgba(217,167,95,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.22)',
    alignSelf: 'center',
  },
  iconImage: { width: 38, height: 38, resizeMode: 'contain' },
  previewImage: { width: '100%', height: SCREEN_HEIGHT * 0.22, borderRadius: 20, marginBottom: 18 },
  pillarCard: {
    backgroundColor: 'rgba(7,13,22,0.86)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  pillarHero: {
    height: 160,
    backgroundColor: 'rgba(217,167,95,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217,167,95,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillarHeroImage: {
    height: 170,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  pillarHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,13,22,0.32)',
  },
  pillarGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(217,167,95,0.10)',
  },
  pillarContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
  },
  pillarTitle: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    marginBottom: 10,
  },
  pillarBody: {
    color: 'rgba(247,241,232,0.72)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  pillarHighlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  pillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(217,167,95,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.22)',
  },
  pillarChipText: {
    color: '#e8c97e',
    fontSize: 12,
    fontWeight: '600',
  },
  quoteImageWrap: {
    alignSelf: 'center',
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 16,
  },
  quoteImage: { width: '100%', height: '100%' },
  quoteSource: {
    textAlign: 'center',
    color: '#d9a75f',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 12,
  },
  quoteText: { textAlign: 'center', color: '#ffffff', fontSize: 33, lineHeight: 40, fontWeight: '800', marginBottom: 18 },
  notifyDemo: { gap: 10, marginBottom: 16 },
  notifyLabel: {
    color: '#d9a75f',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  notifyBubble: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(13,26,43,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notifyTitle: { color: '#f8deb2', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  notifyText: { color: 'rgba(247,241,232,0.76)', fontSize: 14 },
  insightBulletsWrap: { gap: 9, marginBottom: 18 },
  insightBulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightBulletText: { flex: 1, color: 'rgba(247,241,232,0.78)', fontSize: 14, lineHeight: 20 },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(13,26,43,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  helperText: { color: 'rgba(247,241,232,0.70)', fontSize: 13, lineHeight: 18 },
  caption: { marginTop: 6, textAlign: 'center', color: 'rgba(247,241,232,0.56)', fontSize: 12 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 22 },
  primaryButton: { backgroundColor: '#d9a75f', borderRadius: 18, paddingVertical: 17, alignItems: 'center' },
  primaryButtonText: { color: '#17202a', fontSize: 17, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  secondaryButton: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { color: 'rgba(247,241,232,0.66)', fontSize: 15, fontWeight: '600' },
  // ─── Paywall ──────────────────────────────────────────────────────────────────
  paywallHero: {
    height: SCREEN_HEIGHT * 0.24,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  paywallHeroGlow: {
    position: 'absolute' as const,
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 100,
    borderRadius: 60,
    backgroundColor: 'rgba(217,167,95,0.22)',
    // Simulate radial glow by using large borderRadius and shadow
    shadowColor: '#d9a75f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 20,
  },
  paywallHeroTreeLeft: {
    width: '56%',
    height: '96%',
    position: 'absolute' as const,
    bottom: 0,
    left: '0%',
  },
  paywallHeroTreeRight: {
    width: '44%',
    height: '96%',
    position: 'absolute' as const,
    bottom: 0,
    right: '0%',
  },
  paywallHeroBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: 'rgba(8,12,18,0.72)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.40)',
    marginBottom: 10,
    zIndex: 2,
  },
  paywallHeroBadgeText: {
    color: '#d9a75f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  paywallPanel: {
    backgroundColor: 'rgba(7,13,22,0.92)',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.14)',
  },
  paywallTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  paywallSubtitle: {
    color: 'rgba(247,241,232,0.55)',
    fontSize: 13,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  benefitsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    justifyContent: 'center' as const,
    marginBottom: 18,
  },
  benefitPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: 'rgba(217,167,95,0.08)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.15)',
  },
  benefitPillText: {
    color: '#f4efe6',
    fontSize: 11.5,
    fontWeight: '600',
  },
  planRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(13,26,43,0.60)',
    paddingHorizontal: 10,
    paddingVertical: 14,
    paddingTop: 24,
    alignItems: 'center' as const,
    overflow: 'visible' as const,
  },
  planCardSelected: {
    borderColor: '#d9a75f',
    backgroundColor: 'rgba(63,52,31,0.45)',
  },
  planBadge: {
    position: 'absolute' as const,
    top: -10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#d9a75f',
    borderRadius: 10,
  },
  planBadgeText: {
    color: '#1a0f00',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planTitle: {
    color: '#f5ebd8',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 3,
  },
  planPriceLarge: {
    color: '#d9a75f',
    fontWeight: '800',
    fontSize: 22,
  },
  planPeriod: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(247,241,232,0.50)',
  },
  planStrikethrough: {
    color: 'rgba(247,241,232,0.25)',
    fontSize: 11,
    textDecorationLine: 'line-through' as const,
    marginTop: 1,
  },
  planSub: {
    color: 'rgba(247,241,232,0.35)',
    fontSize: 10,
    marginTop: 2,
  },
  planRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#d9a75f',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 8,
  },
  planRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#d9a75f',
  },
  premiumButton: {
    backgroundColor: '#d9a75f',
    borderRadius: 20,
    paddingVertical: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  premiumButtonText: {
    color: '#1a0f00',
    fontSize: 16,
    fontWeight: '800',
  },
  trialNote: {
    color: 'rgba(247,241,232,0.30)',
    fontSize: 10,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  freeLink: {
    alignItems: 'center' as const,
    paddingVertical: 12,
    marginTop: 2,
  },
  freeLinkText: {
    color: 'rgba(247,241,232,0.28)',
    fontSize: 12,
    fontWeight: '500',
  },
  // ─── Free Warning ────────────────────────────────────────────────────────────
  freeWarningPanel: {
    backgroundColor: 'rgba(7,13,22,0.92)',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.12)',
  },
  freeWarningHeader: {
    alignItems: 'center' as const,
    marginBottom: 18,
  },
  freeWarningIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(217,167,95,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.25)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  freeWarningTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  freeWarningSubtitle: {
    color: 'rgba(247,241,232,0.50)',
    fontSize: 13,
    textAlign: 'center' as const,
  },
  comparisonTable: {
    backgroundColor: 'rgba(13,26,43,0.50)',
    borderRadius: 16,
    overflow: 'hidden' as const,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  compHeaderRow: {
    flexDirection: 'row' as const,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  compHeaderFree: {
    flex: 1.2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  compHeaderFreeText: {
    color: 'rgba(247,241,232,0.35)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  compHeaderPremium: {
    flex: 1.2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  compHeaderPremiumText: {
    color: '#d9a75f',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  compRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  compRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  compLabel: {
    flex: 2.2,
    color: '#f4efe6',
    fontSize: 12,
    fontWeight: '600',
  },
  compFreeCell: {
    flex: 1.2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  compFreeVal: {
    color: 'rgba(247,241,232,0.35)',
    fontSize: 11,
  },
  compPremiumCell: {
    flex: 1.2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  compPremiumVal: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
});
