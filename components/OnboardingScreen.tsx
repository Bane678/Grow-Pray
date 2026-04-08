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

const APP_LOGO = require('../assets/Garden Assets/Icons/App_Logo.png');
const ICON_HANDS = require('../assets/Garden Assets/Icons/Icon_Hands.png');
const ICON_LOCATION = require('../assets/Garden Assets/Icons/Icon_Location.png');
const ICON_BELL = require('../assets/Garden Assets/Icons/Icon_Bell.png');
const HERO_GARDEN = require('../assets/Garden Assets/Icons/Loading_Screen2.png');
const HERO_DAWN = require('../assets/Garden Assets/Icons/Loading_Screen.png');
const HERO_NIGHT = require('../assets/Garden Assets/Icons/Starry_Night_Sky.png');

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
  | { kind: 'pillar'; title: string; body: string; cta: string; icon?: IconName; iconImage?: any; imagePreview?: any }
  | { kind: 'support'; title: string; body: string; cta: string }
  | { kind: 'transition'; title: string; subtitle: string; cta: string; icon?: IconName; iconImage?: any }
  | { kind: 'reframe'; title: string; body: string; cta: string }
  | { kind: 'quote'; source: string; quote: string; cta: string; image?: any }
  | { kind: 'nameInput'; title: string; body: string; cta: string; placeholder: string }
  | { kind: 'madhab' }
  | { kind: 'locationPermission' }
  | { kind: 'notificationPermission' }
  | { kind: 'final'; title: string; body: string; cta: string; icon?: IconName; iconImage?: any };

type InsightCard = {
  title: string;
  body: string;
  icon: IconName;
  bullets?: string[];
};

const STEPS: Step[] = [
  { kind: 'welcome', title: 'Salaam', body: 'Grow Pray is a calm prayer tracker that turns consistency into a living garden.', cta: 'Bismillah', image: HERO_GARDEN },
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
      { value: 'reminders', label: 'Helpful reminders', icon: 'bell-ring-outline' },
      { value: 'tracking', label: 'Progress and streak tracking', icon: 'sprout-outline' },
    ],
  },
  { kind: 'pillar', title: 'Private by default', body: 'Your prayer data stays on your device. No selling, no sharing, no noise.', cta: 'Next', icon: 'shield-check-outline' },
  { kind: 'pillar', title: 'Built for focus', body: 'No ad clutter. Just a clean space for worship and reflection.', cta: 'Next', icon: 'eye-off-outline' },
  { kind: 'pillar', title: 'Prayer times that stay accurate', body: 'Location + madhab-aware calculations keep your salah timing dependable.', cta: 'Next', icon: 'bullseye-arrow' },
  { kind: 'pillar', title: 'A garden that grows with your salah', body: 'Every prayer strengthens your garden. Missing prayers affects momentum.', cta: 'Next', imagePreview: HERO_DAWN },
  { kind: 'pillar', title: 'Built-in challenges and rewards', body: 'Daily and weekly challenges help you stay steady when motivation dips.', cta: 'Next', icon: 'trophy-outline' },
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
  { kind: 'final', title: 'Your garden is ready', body: "Let's begin with your next prayer.", cta: 'Enter Grow Pray', iconImage: ICON_HANDS },
];
const TOTAL_STEPS = STEPS.length;

export function OnboardingScreen({ onComplete, onMadhabChange }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedMadhab, setSelectedMadhab] = useState<'hanafi' | 'standard' | null>(null);
  const [singleSelections, setSingleSelections] = useState<Record<string, string | null>>({});
  const [multiSelections, setMultiSelections] = useState<Record<string, string[]>>({});
  const [selectedStars, setSelectedStars] = useState(0);
  const [locationDenied, setLocationDenied] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const [insightCard, setInsightCard] = useState<InsightCard | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentStep = STEPS[step];
  if (!currentStep) return null;

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
    if (currentStep.kind === 'singleSelect' && currentStep.key === ROUTINE_KEY) {
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

    if (currentStep.kind === 'singleSelect' && currentStep.key === MOTIVATION_KEY) {
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

    if (currentStep.kind === 'multiSelect' && currentStep.key === BLOCKERS_KEY) {
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
    if (currentStep.kind === 'nameInput') return name.trim().length > 0;
    if (currentStep.kind === 'madhab') return selectedMadhab !== null;
    return true;
  }, [currentStep, multiSelections, name, selectedMadhab, singleSelections]);

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const goBack = () => {
    if (insightCard) {
      // Animate back to the current step's question (reverse slide direction)
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
    animateToStep(step - 1);
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
        <View style={styles.panelTall}>
          <View style={styles.transitionIcon}>
            <MaterialCommunityIcons name={insightCard.icon} size={38} color="#d9a75f" />
          </View>
          <Text style={[styles.title, { textAlign: 'center' }]}>{insightCard.title}</Text>
          <Text style={[styles.body, { textAlign: 'center' }]}>{insightCard.body}</Text>
          {insightCard.bullets && insightCard.bullets.length > 0 ? (
            <View style={styles.insightBulletsWrap}>
              {insightCard.bullets.map((bullet) => (
                <View key={bullet} style={styles.insightBulletRow}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color="#e6bf81" />
                  <Text style={styles.insightBulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'welcome') {
      return (
        <>
          <ImageBackground source={currentStep.image} style={styles.heroArt} imageStyle={styles.heroArtImage}>
            <LinearGradient colors={['rgba(9,14,22,0.0)', 'rgba(9,14,22,0.55)', 'rgba(9,14,22,0.96)']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.logoBadge}>
              <Image source={APP_LOGO} style={styles.logoImage} />
              <Text style={styles.logoText}>Grow Pray</Text>
            </View>
          </ImageBackground>
          <View style={styles.panel}>
            <Text style={styles.title}>{currentStep.title}</Text>
            <Text style={styles.body}>{currentStep.body}</Text>
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
        <View style={styles.panelTall}>
          <View style={styles.iconWrap}>
            {currentStep.iconImage ? (
              <Image source={currentStep.iconImage} style={styles.iconImage} />
            ) : (
              <MaterialCommunityIcons name={currentStep.icon ?? 'star-four-points-outline'} size={36} color="#d9a75f" />
            )}
          </View>
          <Text style={styles.title}>{currentStep.title}</Text>
          <Text style={styles.body}>{currentStep.body}</Text>
          {currentStep.imagePreview ? <Image source={currentStep.imagePreview} style={styles.previewImage} resizeMode="cover" /> : null}
          <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
          </TouchableOpacity>
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

    if (currentStep.kind === 'transition' || currentStep.kind === 'final') {
      const copy = currentStep.kind === 'transition' ? currentStep.subtitle : currentStep.body;
      return (
        <View style={styles.panelTall}>
          <View style={styles.transitionIcon}>
            {currentStep.iconImage ? (
              <Image source={currentStep.iconImage} style={styles.iconImage} />
            ) : (
              <MaterialCommunityIcons name={currentStep.icon ?? 'sprout-outline'} size={38} color="#d9a75f" />
            )}
          </View>
          <Text style={[styles.title, { textAlign: 'center' }]}>{currentStep.title}</Text>
          <Text style={[styles.body, { textAlign: 'center' }]}>{copy}</Text>
          <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
          </TouchableOpacity>
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
            onChangeText={setName}
            placeholder={currentStep.placeholder}
            placeholderTextColor="rgba(247,241,232,0.34)"
            style={styles.textInput}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canContinue) goNext();
            }}
          />
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
              <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{step + 1}/{TOTAL_STEPS}</Text>
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
  logoBadge: {
    margin: 18,
    alignSelf: 'flex-start',
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
});
