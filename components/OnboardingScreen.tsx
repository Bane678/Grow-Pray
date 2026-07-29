import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { PREMIUM_PLANS } from '../hooks/usePremium';
import { usePrayerTimes, Timings } from '../hooks/usePrayerTimes';
import { FONTS } from '../theme/typography';
import { GardenGrowthPreview } from './GardenGrowthPreview';
import { GardenScaleShowcase } from './GardenScaleShowcase';

const ICON_LOCATION = require('../assets/Garden Assets/Icons/Icon_Location.png');
const ICON_BELL = require('../assets/Garden Assets/Icons/Icon_Bell.png');
const ICON_SPARKLE = require('../assets/Garden Assets/Icons/Icon_Sparkle.png');
// Onboarding hero images
const OB_AYAH     = require('../assets/Garden Assets/Icons/Onboarding_Ayah.png');
const OB_PLAN     = require('../assets/Garden Assets/Icons/Onboarding_Plan.png');
// (The old AI-generated paywall hero is gone - the paywall now uses the
//  GardenScaleShowcase animation instead. Asset kept on disk, unused here.)
// The seed the user plants during onboarding sprouts into the Basic sapling.
const SAPLING_BASIC = require('../assets/Garden Assets/Tree Types/Basic Trees/Sapling_converted.png');

// Tree sprites + tiles for the redesigned free-warning animated transformation (card 21).
// The whole sequence uses the premium Golden Tree across its real growth stages, so the
// "free" sapling is the Golden Tree's own sapling (just dim) blooming into its full form.
const GOLD_SAPLING   = require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Sapling.png');
const GOLD_GROWING   = require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Growing.png');
const GOLD_GROWN     = require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Grown.png');
const GOLD_FLOURISH  = require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Flourishing.png');
const TILE_DEAD       = require('../assets/Garden Assets/Ground Tiles/Dead_Tile.png');
const TILE_RECOVERING = require('../assets/Garden Assets/Ground Tiles/Recovering_Tile.png');
const TILE_RECOVERED  = require('../assets/Garden Assets/Ground Tiles/Recovered_Tile.png');

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
const SUPPORT_KEY = '@GrowPray:onboardingSupportStyle';
// The planted niyyah: { goalId, text, name, plantedAt }
const NIYYAH_KEY = '@GrowPray:niyyah';
// Set when the user plants their seed - App.tsx consumes it after onboarding
// and plants a real Basic sapling into the garden state.
const SEED_PENDING_KEY = '@GrowPray:niyyahSeedPending';
// Set when the user answers "Yes, alhamdulillah" on the first-prayer step -
// App.tsx consumes it once prayer times load and marks the prayer through the
// real togglePrayerCompleted path (real XP, coins, streak).
const FIRST_PRAYER_KEY = '@GrowPray:onboardingPrayerMarked';

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
  | { kind: 'welcome'; title: string; body: string; cta: string }
  | { kind: 'singleSelect'; key: string; title: string; subtitle: string; cta: string; options: SelectOption[] }
  | { kind: 'multiSelect'; key: string; title: string; subtitle: string; cta: string; options: SelectOption[] }
  | { kind: 'nameInput'; title: string; body: string; cta: string; placeholder: string }
  | { kind: 'madhab' }
  | { kind: 'locationPermission' }
  | { kind: 'notificationPermission' }
  | { kind: 'paywall' }
  | { kind: 'freeWarning' }
  /** Full-bleed background image with a centred quote/ayah overlay */
  | { kind: 'ayah'; quote: string; source: string; cta: string; image: any }
  /** Empathy select - like singleSelect but with a soft reframe response built in */
  | { kind: 'empathySelect'; key: string; title: string; subtitle: string; cta: string; options: SelectOption[] }
  /** Personalised plan summary - derives copy from earlier answers */
  | { kind: 'summary'; cta: string }
  /** Plant your niyyah - the commitment moment. Hold the earth to plant the
      intention chosen on the goal step. Replaces the old signature pledge. */
  | { kind: 'niyyahPlanting' }
  /** Adaptive first-prayer step - runs the core loop once, for real, before
      the paywall: "Have you prayed X today?" */
  | { kind: 'firstPrayer' };

type InsightCard = {
  title: string;
  body: string;
  icon: IconName;
  bullets?: string[];
};

const STEPS: Step[] = [
  // 0 - Opening: the promise, with the loop shown live
  { kind: 'welcome', title: 'Salaam.', body: 'Five daily prayers. One living garden. Every salah you keep is planted - and everything you grow stays on this phone.', cta: 'Bismillah' },

  // 1 - Ayah (Qur'an 29:45)
  {
    kind: 'ayah',
    quote: 'Indeed, prayer prohibits immorality and wrongdoing.',
    source: 'Qur\'an 29:45',
    cta: 'Continue',
    image: OB_AYAH,
  },

  // 2 - Where you are (empathetic select) -> insight card A
  {
    kind: 'empathySelect',
    key: ROUTINE_KEY,
    title: 'How is your relationship with salah right now?',
    subtitle: 'Wherever you are is where we start.',
    cta: 'Next',
    options: [
      { value: 'on_time',           label: 'I pray all 5 on time',           icon: 'check-circle-outline' },
      { value: 'daily_not_on_time', label: 'I pray daily, not always on time', icon: 'clock-alert-outline' },
      { value: 'most_days',         label: 'Most days, but I miss some',      icon: 'calendar-check-outline' },
      { value: 'occasionally',      label: "Occasionally - I'm working on it", icon: 'calendar-blank-outline' },
      { value: 'starting',          label: 'I want to start, or start again',  icon: 'seed-outline' },
    ],
  },

  // 3 - Hardest prayer (single select)
  {
    kind: 'singleSelect',
    key: '@GrowPray:hardestPrayer',
    title: 'Which prayer is hardest to keep?',
    subtitle: 'Everyone has one.',
    cta: 'Next',
    options: [
      { value: 'Fajr',    label: 'Fajr (the early morning prayer)', icon: 'weather-sunset-up' },
      { value: 'Dhuhr',   label: 'Dhuhr (midday)',                  icon: 'weather-sunny' },
      { value: 'Asr',     label: 'Asr (afternoon)',                 icon: 'weather-partly-cloudy' },
      { value: 'Maghrib', label: 'Maghrib (after sunset)',          icon: 'weather-sunset-down' },
      { value: 'Isha',    label: 'Isha (night prayer)',             icon: 'weather-night' },
      { value: 'all',     label: 'Honestly, all of them',          icon: 'emoticon-sad-outline' },
    ],
  },

  // 4 - What gets in the way (multi select)
  {
    kind: 'multiSelect',
    key: BLOCKERS_KEY,
    title: 'What usually gets in the way?',
    subtitle: 'Choose all that apply.',
    cta: 'Next',
    options: [
      { value: 'waking_up',    label: 'Waking up for Fajr',         icon: 'alarm' },
      { value: 'busy',         label: 'A busy schedule',             icon: 'run-fast' },
      { value: 'forgetting',   label: 'Forgetting prayer times',     icon: 'bell-off-outline' },
      { value: 'motivation',   label: 'Low motivation or iman',      icon: 'emoticon-sad-outline' },
      { value: 'distractions', label: 'Phone distractions',          icon: 'cellphone' },
      { value: 'focus',        label: 'Lack of focus in prayer',     icon: 'brain' },
    ],
  },

  // 5 - What would help (forward-framed; replaces the old "how do you feel
  //     when you miss a prayer" confession question) -> insight card B
  {
    kind: 'empathySelect',
    key: SUPPORT_KEY,
    title: 'When you do miss one - what would actually help?',
    subtitle: "We'll build your support around this.",
    cta: 'Next',
    options: [
      { value: 'nudge',      label: 'A nudge to pray it as soon as I can', icon: 'refresh' },
      { value: 'freshstart', label: 'Knowing the next one is a fresh start', icon: 'weather-sunset-up' },
      { value: 'progress',   label: 'Seeing my progress, not my failures', icon: 'sprout-outline' },
      { value: 'noguilt',    label: 'Less guilt, more encouragement',      icon: 'heart-outline' },
    ],
  },

  // 6 - Name input (privacy reassurance folded in, where the anxiety lives)
  { kind: 'nameInput', title: 'What should we call you?', body: 'Your name appears in one place that matters - your intention.', cta: 'Next', placeholder: 'Your name' },

  // 7 - Niyyah (goal select; pays off at the planting step)
  {
    kind: 'singleSelect',
    key: GOAL_KEY,
    title: 'Set your niyyah for the next 30 days.',
    subtitle: "One intention. In a moment, you'll plant it.",
    cta: 'Next',
    options: [
      { value: '5_on_time',   label: 'I intend to pray all five on time',      icon: 'clock-check-outline' },
      { value: 'fajr',        label: 'I intend to wake for Fajr, consistently', icon: 'weather-sunset-up' },
      { value: 'consistency', label: 'I intend to build a routine that lasts',  icon: 'repeat' },
      { value: 'focus',       label: 'I intend to be more present in salah',    icon: 'bullseye' },
      { value: 'character',   label: 'I intend to come back to my prayers',     icon: 'diamond-stone' },
    ],
  },

  // 8 - Personalised summary (pulls from answers)
  { kind: 'summary', cta: 'Set up my prayer times' },

  // 9 - Madhab (must precede showing times - changes Asr calculation)
  { kind: 'madhab' },

  // 10 - Location (priming kept; on grant the same card shows live times)
  { kind: 'locationPermission' },

  // 11 - Notifications (primed with the user's actual next prayer)
  { kind: 'notificationPermission' },

  // 12 - Plant your niyyah (the commitment moment - no premium messaging
  //      before it, and no commercial screen may ever reference it)
  { kind: 'niyyahPlanting' },

  // 13 - First prayer (adaptive: runs the core loop once, for real)
  { kind: 'firstPrayer' },

  // 14 - The offer (single paywall; opens with what's free forever)
  { kind: 'paywall' },

  // 15 - The honest second look (soft decline screen; conveniences only,
  //      never religious content)
  { kind: 'freeWarning' },
];
const TOTAL_STEPS = STEPS.length;
// Empathy select steps that produce an insight card (indices 2 and 5)
const INSIGHT_STEP_INDICES = [2, 5];
const TRUE_TOTAL = STEPS.length + INSIGHT_STEP_INDICES.length; // 16 steps + 2 insights = 18

// Common profanity/slur blocklist - word-boundary matched, case-insensitive.
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

// ── Decorative starfield ────────────────────────────────────────────────────────
// A faint scatter of stars used inside redesigned card heroes, echoing the app's
// night-sky motif. Purely cosmetic; positions are deterministic (no random) so the
// layout is stable across renders.
const STAR_DOTS = [
  { left: '12%', top: '22%', size: 2, op: 0.5 },
  { left: '24%', top: '58%', size: 1.5, op: 0.35 },
  { left: '38%', top: '16%', size: 2.5, op: 0.6 },
  { left: '52%', top: '70%', size: 1.5, op: 0.3 },
  { left: '63%', top: '28%', size: 2, op: 0.5 },
  { left: '78%', top: '52%', size: 1.5, op: 0.4 },
  { left: '86%', top: '20%', size: 2.5, op: 0.55 },
  { left: '70%', top: '78%', size: 1.5, op: 0.3 },
  { left: '18%', top: '80%', size: 2, op: 0.4 },
];
function StarRow() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STAR_DOTS.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: s.left as any,
            top: s.top as any,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: '#f5ebd8',
            opacity: s.op,
          }}
        />
      ))}
    </View>
  );
}

// ── Free → Premium transformation (card 21) ─────────────────────────────────────
// A single garden plot that loops through a transformation: the barren "free" state
// (dead tile, dim sapling) blooms into the flourishing "premium" state (recovered
// tile, grown tree, gold glow). Conveys the upgrade as something that comes alive,
// rather than a static side-by-side comparison.
// tile: 0 = dead, 1 = recovering, 2 = recovered. The ground heals as the tree grows:
// dead → dead → recovering (3rd tree) → recovered (final).
const TRANSFORM_STAGES = [
  { tree: GOLD_SAPLING,  scale: 0.7,  treeOpacity: 0.55, glow: 0,    tile: 0, label: 'Free',     premium: false },
  { tree: GOLD_GROWING,  scale: 0.82, treeOpacity: 0.8,  glow: 0.25, tile: 0, label: 'Growing',  premium: false },
  { tree: GOLD_GROWN,    scale: 0.92, treeOpacity: 0.95, glow: 0.6,  tile: 1, label: 'Growing',  premium: false },
  { tree: GOLD_FLOURISH, scale: 1,    treeOpacity: 1,    glow: 1,    tile: 2, label: 'Premium',  premium: true },
];
function FreePremiumTransform({ size = 150 }: { size?: number }) {
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);
  // Animated values driven toward the current stage's targets.
  const scale = useRef(new Animated.Value(TRANSFORM_STAGES[0].scale)).current;
  const treeOpacity = useRef(new Animated.Value(TRANSFORM_STAGES[0].treeOpacity)).current;
  const glow = useRef(new Animated.Value(0)).current;
  // One opacity per tile layer (dead / recovering / recovered); only the active one
  // for the current stage fades to 1, so the ground heals in three steps.
  const tileDead = useRef(new Animated.Value(1)).current;
  const tileRecovering = useRef(new Animated.Value(0)).current;
  const tileRecovered = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const apply = (i: number) => {
      const s = TRANSFORM_STAGES[i];
      Animated.parallel([
        Animated.spring(scale, { toValue: s.scale, friction: 6, tension: 50, useNativeDriver: true }),
        Animated.timing(treeOpacity, { toValue: s.treeOpacity, duration: 600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: s.glow, duration: 600, useNativeDriver: true }),
        Animated.timing(tileDead, { toValue: s.tile === 0 ? 1 : 0, duration: 600, useNativeDriver: true }),
        Animated.timing(tileRecovering, { toValue: s.tile === 1 ? 1 : 0, duration: 600, useNativeDriver: true }),
        Animated.timing(tileRecovered, { toValue: s.tile === 2 ? 1 : 0, duration: 600, useNativeDriver: true }),
      ]).start();
    };
    apply(0);
    const interval = setInterval(() => {
      if (cancelled) return;
      // Advance, looping back to the barren start after the flourishing peak (with a pause).
      stageRef.current = (stageRef.current + 1) % (TRANSFORM_STAGES.length + 1);
      const next = stageRef.current % TRANSFORM_STAGES.length;
      setStage(next);
      apply(next);
    }, 1500);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const current = TRANSFORM_STAGES[stage];
  // Positioning mirrors GardenGrowthPreview exactly so the tree sits anchored on the
  // tile the same way the existing onboarding GIF does.
  return (
    <View style={{ width: size, height: size }}>
      {/* Gold bloom glow - fades in as the garden flourishes */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 0.7, height: size * 0.7,
          borderRadius: size * 0.35,
          left: size * 0.15, top: size * 0.12,
          backgroundColor: '#e8a87c',
          opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
        }}
      />
      {/* Ground tiles heal in three steps: dead → recovering → recovered */}
      {[
        { src: TILE_DEAD, op: tileDead },
        { src: TILE_RECOVERING, op: tileRecovering },
        { src: TILE_RECOVERED, op: tileRecovered },
      ].map((t, i) => (
        <Animated.Image
          key={i}
          source={t.src}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: size * 0.66, height: size * 0.33,
            left: size * 0.17, top: size * 0.455,
            opacity: t.op,
          }}
        />
      ))}
      {/* Growing tree - anchored like the real garden (base rests ~25% below tile centre) */}
      <Animated.Image
        source={current.tree}
        resizeMode="contain"
        style={{
          position: 'absolute',
          width: size * 0.58, height: size * 0.58,
          left: size * 0.21, top: size * 0.185,
          opacity: treeOpacity,
          transform: [{ scale }],
        }}
      />
      {/* Stage label pill */}
      <View style={transformStyles.labelRow}>
        <View style={[transformStyles.labelPill, current.premium && transformStyles.labelPillPremium]}>
          <Text style={[transformStyles.labelText, current.premium && transformStyles.labelTextPremium]}>
            {current.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

const transformStyles = StyleSheet.create({
  labelRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  labelPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  labelPillPremium: {
    backgroundColor: 'rgba(217,167,95,0.16)',
    borderColor: 'rgba(217,167,95,0.45)',
  },
  labelText: {
    color: 'rgba(247,241,232,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labelTextPremium: {
    color: '#e8c97e',
  },
});

// ── Hold-to-plant ───────────────────────────────────────────────────────────────
// The commitment gesture, rebuilt inside the garden metaphor: press and hold the
// earth for ~1.2s and a gold ring draws around the tile as the seed goes in.
// Haptics ramp mid-hold; releasing early rewinds. The tile itself is the button.
const AnimatedRingCircle = Animated.createAnimatedComponent(Circle);
const PLANT_HOLD_MS = 1200;
const PLANT_RING_SIZE = 220;
const PLANT_RING_R = 102;
const PLANT_RING_C = 2 * Math.PI * PLANT_RING_R;

function PlantingHold({ planted, onPlanted, children }: {
  planted: boolean;
  onPlanted: () => void;
  children: React.ReactNode;
}) {
  const fill = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midHaptic = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const start = () => {
    if (planted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    anim.current = Animated.timing(fill, { toValue: 1, duration: PLANT_HOLD_MS, useNativeDriver: false });
    anim.current.start();
    midHaptic.current = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, PLANT_HOLD_MS / 2);
    timer.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onPlanted();
    }, PLANT_HOLD_MS);
  };

  const cancel = () => {
    if (planted) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (midHaptic.current) { clearTimeout(midHaptic.current); midHaptic.current = null; }
    anim.current?.stop();
    Animated.timing(fill, { toValue: 0, duration: 220, useNativeDriver: false }).start();
  };

  // Reset the ring whenever the planted state flips back to false (e.g. the
  // user navigated back and is re-planting), and clear any in-flight timers on
  // unmount so a pending hold can't fire after the screen is gone.
  useEffect(() => {
    if (!planted) fill.setValue(0);
  }, [planted]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (midHaptic.current) clearTimeout(midHaptic.current);
    anim.current?.stop();
  }, []);

  return (
    <Pressable onPressIn={start} onPressOut={cancel} disabled={planted}>
      <View style={{ width: PLANT_RING_SIZE, height: PLANT_RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={PLANT_RING_SIZE} height={PLANT_RING_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={PLANT_RING_SIZE / 2} cy={PLANT_RING_SIZE / 2} r={PLANT_RING_R}
            stroke="rgba(217,167,95,0.18)" strokeWidth={3} fill="none"
          />
          <AnimatedRingCircle
            cx={PLANT_RING_SIZE / 2} cy={PLANT_RING_SIZE / 2} r={PLANT_RING_R}
            stroke="#d9a75f" strokeWidth={3} fill="none" strokeLinecap="round"
            strokeDasharray={`${PLANT_RING_C} ${PLANT_RING_C}`}
            strokeDashoffset={fill.interpolate({ inputRange: [0, 1], outputRange: [PLANT_RING_C, 0] })}
            transform={`rotate(-90 ${PLANT_RING_SIZE / 2} ${PLANT_RING_SIZE / 2})`}
          />
        </Svg>
        {children}
      </View>
    </Pressable>
  );
}

// ── Prayer-time helpers for the payoff screens ─────────────────────────────────
const PRAYER_SEQ = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = typeof PRAYER_SEQ[number];

function hhmmToMins(v?: string): number | null {
  if (!v || !/^\d{1,2}:\d{2}/.test(v)) return null;
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

function fmt12(v?: string): string {
  const mins = hhmmToMins(v);
  if (mins == null) return '--:--';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

/** First prayer later than now today; wraps to tomorrow's Fajr after Isha. */
function nextPrayerOf(timings: Timings): { name: PrayerName; time: string; tomorrow: boolean } {
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  for (const p of PRAYER_SEQ) {
    const t = hhmmToMins(timings[p]);
    if (t != null && t > nowM) return { name: p, time: timings[p], tomorrow: false };
  }
  return { name: 'Fajr', time: timings.Fajr, tomorrow: true };
}

/** Most recent prayer whose window has begun (before Fajr -> last night's Isha). */
function lastBegunPrayerOf(timings: Timings): PrayerName {
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  let last: PrayerName = 'Isha';
  for (const p of PRAYER_SEQ) {
    const t = hhmmToMins(timings[p]);
    if (t != null && t <= nowM) last = p;
  }
  return last;
}


export function OnboardingScreen({ onComplete, onMadhabChange, onPurchaseMonthly, onPurchaseYearly }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedMadhab, setSelectedMadhab] = useState<'hanafi' | 'standard' | null>(null);
  const [singleSelections, setSingleSelections] = useState<Record<string, string | null>>({});
  const [multiSelections, setMultiSelections] = useState<Record<string, string[]>>({});
  const [locationDenied, setLocationDenied] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const [insightCard, setInsightCard] = useState<InsightCard | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  // New-flow state: location grant (drives the live-times payoff), the planted
  // niyyah, and the adaptive first-prayer answer.
  const [locGranted, setLocGranted] = useState(false);
  const [planted, setPlanted] = useState(false);
  const [firstPrayerAnswer, setFirstPrayerAnswer] = useState<'yes' | 'no' | null>(null);

  const dynamicSteps = STEPS;

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Live prayer times for the payoff screens (live-times card, notification
  // priming, adaptive first prayer). locationReady stays false until the user
  // grants location on the priming screen, so there is no permission race and
  // no fallback-city times are ever shown as if they were the user's own.
  const prayerLive = usePrayerTimes({
    madhab: selectedMadhab ?? 'standard',
    methodKey: null,
    locationReady: locGranted,
  });
  const liveTimings: Timings | null = locGranted ? prayerLive.timings : null;

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
      // before the fade-in starts - otherwise the native thread animates before
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
    // ── Routine / relationship with salah ─────────────────────────────────────
    if ((targetStep.kind === 'singleSelect' || targetStep.kind === 'empathySelect') && targetStep.key === ROUTINE_KEY) {
      const selected = singleSelections[ROUTINE_KEY];
      if (selected === 'on_time') {
        return {
          title: 'We will help you protect that momentum',
          body: 'Grow Pray highlights streaks, history, and challenge wins so your consistency stays visible every day.',
          icon: 'fire',
          bullets: ['Per-prayer streak tracking', 'Prayer history calendar', 'Daily and weekly challenge rewards'],
        };
      }
      if (selected === 'daily_not_on_time') {
        return {
          title: 'Timing is where we can help most',
          body: 'Prayer-time reminders and your next-salah countdown help you pray earlier, more often.',
          icon: 'clock-check-outline',
          bullets: ['Accurate local prayer times', 'Deadline warnings before each window closes', 'Gentle countdown on the home screen'],
        };
      }
      if (selected === 'most_days') {
        return {
          title: 'Consistency is closer than it feels',
          body: 'Your garden makes every single prayer visible. The days you show up feel meaningful, and the gaps are honest.',
          icon: 'calendar-check-outline',
          bullets: ['Each prayer plants progress', 'Missed days show where to recover', 'Streak freezes for life\'s harder days'],
        };
      }
      return {
        title: 'Then this is a beginning, not a comeback.',
        body: "You don't owe this app an explanation. From your first salah, your garden starts growing - momentum you can see, from day one.",
        icon: 'sprout-outline',
        bullets: ['Each prayer grows something real', 'Missed days show recovery, not ruin', 'Streak freezes for the hard weeks'],
      };
    }

    // ── What would help when you miss one ─────────────────────────────────────
    // Answers the user's chosen support style. The consistency hadith lives here
    // as a RESPONSE to what they asked for, not a lecture on its own screen.
    if ((targetStep.kind === 'singleSelect' || targetStep.kind === 'empathySelect') && targetStep.key === SUPPORT_KEY) {
      const selected = singleSelections[SUPPORT_KEY];
      const responses: Record<string, InsightCard> = {
        nudge: {
          title: "We'll help you catch it",
          body: 'A gentle make-up reminder and deadline warnings before each window closes - so a missed prayer becomes a prayed one, not a lost one.',
          icon: 'refresh',
          bullets: ['Quiet make-up nudges', 'Deadline warnings before each window closes', 'A countdown to the next prayer, always visible'],
        },
        freshstart: {
          title: "That's how this garden works.",
          body: 'The Prophet صلى الله عليه وسلم said: "The most beloved of deeds to Allah are the most consistent, even if they are few." (Bukhari & Muslim). Every prayer here is a fresh start - no red marks, no broken-streak sirens.',
          icon: 'weather-sunset-up',
          bullets: ['Every prayer is a fresh start', 'Gentle reminders, never alarms', 'Streak freezes for life\'s harder days'],
        },
        progress: {
          title: 'Progress you can stand in',
          body: 'Your garden shows what you\'ve built, not what you\'ve broken. Streaks, history, and growth stay visible - the gaps just show where to grow next.',
          icon: 'sprout-outline',
          bullets: ['Each prayer grows something real', 'Per-prayer streaks and history', 'Missed days show recovery, not ruin'],
        },
        noguilt: {
          title: 'No guilt. That\'s a promise.',
          body: 'The Prophet صلى الله عليه وسلم said: "The most beloved of deeds to Allah are the most consistent, even if they are few." (Bukhari & Muslim). Grow Pray never shames a missed prayer.',
          icon: 'heart-outline',
          bullets: ['No punitive language, ever', 'Your garden shows recovery, not ruin', 'Encouragement built around your answers'],
        },
      };
      return selected ? (responses[selected] ?? null) : null;
    }

    return null;
  };

  const canContinue = useMemo(() => {
    if (currentStep.kind === 'singleSelect' || currentStep.kind === 'empathySelect') return !!singleSelections[currentStep.key];
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
      // purchase failed - stay on page so user can retry or go free
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
    // Leaving the planting step backwards un-plants the seed, so the user can
    // change their niyyah and plant again. Without this the tile stays in its
    // planted state and the hold gesture is permanently disabled.
    if (currentStep.kind === 'niyyahPlanting' && planted) {
      setPlanted(false);
      AsyncStorage.removeItem(SEED_PENDING_KEY).catch(() => {});
      AsyncStorage.removeItem(NIYYAH_KEY).catch(() => {});
    }
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

    animateToStep(step + 1);
  };

  const handleLocation = async (request: boolean) => {
    if (request) {
      let granted = false;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        granted = status === 'granted';
      } catch {
        granted = false;
      }
      await AsyncStorage.setItem('@GrowPray:locationPrompted', 'true');
      if (granted) {
        // Don't advance - this card morphs into the "Your times are live"
        // payoff state, and the user continues from there.
        setLocationDenied(false);
        setLocGranted(true);
        return;
      }
      // Hard OS-level denial: show the settings caption; the skip button
      // remains as the way forward.
      setLocationDenied(true);
      return;
    }
    await AsyncStorage.setItem('@GrowPray:locationPrompted', 'skipped');
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

  const renderSelectCard = (kind: 'singleSelect' | 'multiSelect' | 'empathySelect') => {
    if (currentStep.kind !== kind) return null;
    const isSingle = kind === 'singleSelect' || kind === 'empathySelect';
    const singleValue = singleSelections[currentStep.key];
    const multiValue = multiSelections[currentStep.key] ?? [];
    return (
      <View style={styles.panelTall}>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.subtitle}</Text>
        <View style={styles.optionList}>
          {currentStep.options.map((option) => {
            const selected = isSingle ? singleValue === option.value : multiValue.includes(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                onPress={() =>
                  isSingle
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
      // ── Insight card - responds to what the user just told us ────────────────
      return (
        <View style={styles.insightCardNew}>
          {/* Layered hero - radial gold glow + faint starfield + glass medallion icon */}
          <View style={styles.insightHero}>
            <View style={styles.insightGlowOuter} />
            <View style={styles.insightGlowInner} />
            <StarRow />
            <View style={styles.insightMedallion}>
              <View style={styles.insightMedallionRing} />
              <MaterialCommunityIcons name={insightCard.icon} size={40} color="#f0c27a" />
            </View>
          </View>
          <View style={styles.insightBody}>
            <Text style={styles.insightTitle}>{insightCard.title}</Text>
            <Text style={styles.insightBodyText}>{insightCard.body}</Text>
            {insightCard.bullets && insightCard.bullets.length > 0 ? (
              <View style={styles.insightChecklist}>
                {insightCard.bullets.map((bullet, i) => (
                  <View
                    key={bullet}
                    style={[styles.insightCheckRow, i > 0 && styles.insightCheckDivider]}
                  >
                    <View style={styles.insightCheckBadge}>
                      <MaterialCommunityIcons name="check" size={13} color="#1a0f00" />
                    </View>
                    <Text style={styles.insightCheckText}>{bullet}</Text>
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
      // The loop itself is the demo: a real tile growing a real tree, live.
      return (
        <>
          <View style={nstyles.welcomeHero}>
            <StarRow />
            <GardenGrowthPreview size={200} />
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
          {/* Privacy, whispered where the anxiety actually lives */}
          <View style={styles.helperRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color="#e6bf81" />
            <Text style={styles.helperText}>Stays on this phone. No account. No email. Ever.</Text>
          </View>
          <TouchableOpacity disabled={!canContinue} onPress={goNext} style={[styles.primaryButton, !canContinue && styles.disabled]}>
            <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'madhab') {
      return (
        <View style={styles.panelTall}>
          <Text style={styles.title}>One question about Asr.</Text>
          <Text style={styles.body}>Schools of thought differ on when Asr begins. Which timing do you follow?</Text>
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
          <Text style={nstyles.madhabCaption}>Not sure? Pick either - you can change it anytime in Settings.</Text>
          <TouchableOpacity disabled={!canContinue} onPress={goNext} style={[styles.primaryButton, !canContinue && styles.disabled]}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'locationPermission') {
      // State 2: permission granted - the same card morphs into the payoff.
      // The flow used to compute the user's times here and never show them;
      // this is the cheapest real value in the whole funnel.
      if (locGranted) {
        const next = liveTimings ? nextPrayerOf(liveTimings) : null;
        return (
          <View style={styles.panelTall}>
            <Text style={styles.title}>Your times are live.</Text>
            <Text style={styles.body}>
              {liveTimings
                ? 'Computed on this phone, for exactly where you are.'
                : 'Finding your local times…'}
            </Text>
            {liveTimings && (
              <View style={nstyles.timesList}>
                {PRAYER_SEQ.map((p) => {
                  const isNext = next != null && !next.tomorrow && next.name === p;
                  return (
                    <View key={p} style={[nstyles.timesRow, isNext && nstyles.timesRowNext]}>
                      <Text style={[nstyles.timesName, isNext && nstyles.timesNameNext]}>{p}</Text>
                      <View style={{ flex: 1 }} />
                      {isNext && <Text style={nstyles.timesNextTag}>next</Text>}
                      <Text style={[nstyles.timesValue, isNext && nstyles.timesNameNext]}>{fmt12(liveTimings[p])}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );
      }
      // State 1: priming (kept verbatim - it's the best screen in the old flow).
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
      // Primed with the user's actual next prayer when times are available -
      // the strongest honest "why" for the permission.
      const next = liveTimings ? nextPrayerOf(liveTimings) : null;
      return (
        <View style={styles.panelTall}>
          <View style={styles.iconWrap}>
            <Image source={ICON_BELL} style={styles.iconImage} />
          </View>
          <Text style={styles.title}>Never miss the window.</Text>
          <Text style={styles.body}>
            {next
              ? `${next.name} is at ${fmt12(next.time)}${next.tomorrow ? ' tomorrow' : ' today'}. Want a quiet heads-up before each prayer?`
              : 'Enable to receive prayer notifications. You can customise reminder styles later.'}
          </Text>
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

    // ── Plant your niyyah (the commitment moment) ─────────────────────────────
    if (currentStep.kind === 'niyyahPlanting') {
      const goal = singleSelections[GOAL_KEY];
      const intentionText: Record<string, string> = {
        '5_on_time':   'I intend to pray all five on time.',
        fajr:          'I intend to wake for Fajr, consistently.',
        consistency:   'I intend to build a routine that lasts.',
        focus:         'I intend to be more present in salah.',
        character:     'I intend to come back to my prayers.',
      };
      const intention = intentionText[goal ?? 'consistency'] ?? 'I intend to care for my prayers.';
      const displayName = name.trim() || 'My';
      const onPlanted = async () => {
        setPlanted(true);
        try {
          await AsyncStorage.setItem(NIYYAH_KEY, JSON.stringify({
            goalId: goal ?? 'consistency',
            text: intention,
            name: name.trim(),
            plantedAt: Date.now(),
          }));
          // App.tsx consumes this after onboarding and plants a real Basic
          // sapling into the garden state.
          await AsyncStorage.setItem(SEED_PENDING_KEY, '1');
        } catch {
          // Non-critical - the ceremony matters more than the flag.
        }
      };
      return (
        <View style={nstyles.plantWrap}>
          <StarRow />
          <Text style={nstyles.plantHadithLabel}>THE FIRST HADITH OF NAWAWI'S FORTY</Text>
          <Text style={nstyles.plantHadith}>"Actions are but by intentions."</Text>
          <Text style={nstyles.plantHadithSource}>Prophet Muhammad ﷺ · Bukhari 1 & Muslim 1907</Text>

          {/* The intention, carried on a small tag above the earth */}
          {!planted && (
            <View style={nstyles.intentionTag}>
              <Text style={nstyles.intentionText}>{intention}</Text>
              <Text style={nstyles.intentionMeta}>{displayName ? `${name.trim() || 'My'} garden · Day 0` : 'Day 0'}</Text>
            </View>
          )}
          {planted && (
            <Text style={nstyles.plantedText}>Planted. May Allah let it grow.</Text>
          )}

          <View style={nstyles.plantTileArea}>
            <PlantingHold planted={planted} onPlanted={onPlanted}>
              <View style={nstyles.plantGlow} />
              <Image source={TILE_RECOVERED} style={nstyles.plantTile} resizeMode="contain" />
              {planted && (
                <Image source={ICON_SPARKLE} style={nstyles.plantSparkle} resizeMode="contain" />
              )}
            </PlantingHold>
          </View>

          {!planted ? (
            <Text style={nstyles.plantHint}>Press and hold the earth to plant your niyyah</Text>
          ) : (
            <TouchableOpacity onPress={goNext} style={[styles.primaryButton, { alignSelf: 'stretch' }]}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // ── First prayer (adaptive - runs the loop once, for real) ────────────────
    if (currentStep.kind === 'firstPrayer') {
      // No times (location skipped): no question to ask honestly - the seed
      // simply waits for their first prayer in the app.
      if (!liveTimings) {
        return (
          <View style={styles.panelTall}>
            <Text style={styles.title}>Your seed is planted.</Text>
            <Text style={styles.body}>It's waiting in your garden. Your first prayer is what wakes it up.</Text>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );
      }
      const recent = lastBegunPrayerOf(liveTimings);
      const next = nextPrayerOf(liveTimings);
      if (firstPrayerAnswer === 'yes') {
        // The loop, run once for real: prayer marked, seed visibly sprouting.
        return (
          <View style={nstyles.plantWrap}>
            <StarRow />
            <View style={nstyles.plantTileArea}>
              <View style={{ width: PLANT_RING_SIZE, height: PLANT_RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <View style={nstyles.plantGlow} />
                <Image source={TILE_RECOVERED} style={nstyles.plantTile} resizeMode="contain" />
                <Image source={SAPLING_BASIC} style={nstyles.sproutImg} resizeMode="contain" />
              </View>
            </View>
            <Text style={[styles.title, { textAlign: 'center' }]}>Your first prayer - planted.</Text>
            <Text style={[styles.body, { textAlign: 'center' }]}>
              This is the whole app: every salah you keep, you'll see. {recent} has been marked in your garden.
            </Text>
            <TouchableOpacity onPress={goNext} style={[styles.primaryButton, { alignSelf: 'stretch' }]}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );
      }
      if (firstPrayerAnswer === 'no') {
        return (
          <View style={styles.panelTall}>
            <Text style={styles.title}>{next.name} arrives at {fmt12(next.time)}{next.tomorrow ? ' tomorrow' : ''}.</Text>
            <Text style={styles.body}>Your seed is ready when you are.</Text>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );
      }
      // Between midnight and Fajr the live window is last night's Isha, so
      // "today" would be wrong - drop the word.
      const beforeFajr =
        hhmmToMins(liveTimings.Fajr) != null &&
        new Date().getHours() * 60 + new Date().getMinutes() < (hhmmToMins(liveTimings.Fajr) as number);
      return (
        <View style={styles.panelTall}>
          <Text style={styles.title}>Have you prayed {recent}{beforeFajr ? '' : ' today'}?</Text>
          <Text style={styles.body}>No pressure either way - your garden starts wherever you are.</Text>
          <TouchableOpacity
            onPress={async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              try {
                // Consumed by App.tsx once times load - the prayer is marked
                // through the real togglePrayerCompleted path (XP, coins, streak).
                await AsyncStorage.setItem(FIRST_PRAYER_KEY, recent);
              } catch {}
              setFirstPrayerAnswer('yes');
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Yes, alhamdulillah</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFirstPrayerAnswer('no')} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Not yet</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'paywall') {
      const trialDays = PREMIUM_PLANS.yearly.trialDays;
      // Deliberately compact: everything must fit one screen with no scrolling.
      // Scrolling a paywall buries the CTA and kills conversion.
      return (
        <View style={nstyles.paywallCompact}>
          {/* Hero - the garden growing, small to flourishing. Swap in real
              screenshots via GARDEN_STAGES in components/GardenScaleShowcase.tsx */}
          <GardenScaleShowcase height={SCREEN_HEIGHT * 0.19} />

          {/* What's free comes FIRST - the Qur'an is never behind a lock, and
              saying so is the strongest trust move on this screen. */}
          <View style={nstyles.freeStripTight}>
            <Text style={nstyles.freeStripLabel}>YOURS FREE, ALWAYS</Text>
            <Text style={nstyles.freeStripTextTight}>
              Full Qur'an · Nawawi's 40 · Prayer times · Duas · Your garden
            </Text>
          </View>

          {/* Title - references the garden (a game object), never the niyyah */}
          <Text style={nstyles.paywallTitleTight}>Help it flourish.</Text>

          {/* Benefits - conveniences and the personal layer only */}
          <View style={nstyles.benefitsTight}>
            {[
              { icon: 'grid' as const, text: 'Unlimited garden' },
              { icon: 'circle-multiple' as const, text: '2x coins & XP' },
              { icon: 'tree' as const, text: 'Golden Tree & Cedar' },
              { icon: 'snowflake' as const, text: '3 freezes monthly' },
              { icon: 'chart-line' as const, text: 'Advanced insights' },
              { icon: 'pencil-plus-outline' as const, text: 'Margin notes' },
            ].map((b, i) => (
              <View key={i} style={nstyles.benefitPillTight}>
                <MaterialCommunityIcons name={b.icon} size={13} color="#d9a75f" />
                <Text style={nstyles.benefitPillTextTight}>{b.text}</Text>
              </View>
            ))}
          </View>

          {/* Plan selector - side by side */}
          <View style={nstyles.planRowTight}>
            <TouchableOpacity
              onPress={() => setSelectedPlan('yearly')}
              style={[nstyles.planCardTight, selectedPlan === 'yearly' && styles.planCardSelected]}
              activeOpacity={0.7}
            >
              <View style={nstyles.planBadgeTight}>
                <Text style={styles.planBadgeText}>BEST VALUE</Text>
              </View>
              <Text style={nstyles.planTitleTight}>Yearly</Text>
              <Text style={nstyles.planPriceTight}>
                $3.75<Text style={styles.planPeriod}>/mo</Text>
              </Text>
              <Text style={nstyles.planSubTight}>$44.99 billed yearly</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedPlan('monthly')}
              style={[nstyles.planCardTight, selectedPlan === 'monthly' && styles.planCardSelected]}
              activeOpacity={0.7}
            >
              <Text style={nstyles.planTitleTight}>Monthly</Text>
              <Text style={nstyles.planPriceTight}>
                $6.99<Text style={styles.planPeriod}>/mo</Text>
              </Text>
              <Text style={nstyles.planSubTight}>billed monthly</Text>
            </TouchableOpacity>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={handlePremiumPurchase}
            disabled={purchasing}
            style={nstyles.premiumButtonTight}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="lock-open-outline" size={17} color="#1a0f00" style={{ marginRight: 6 }} />
            <Text style={styles.premiumButtonText}>
              {purchasing ? 'Processing…' : `Start ${trialDays} days free`}
            </Text>
          </TouchableOpacity>
          <Text style={nstyles.trialNoteTight}>
            {trialDays} days free · then {selectedPlan === 'yearly' ? '$44.99/year' : '$6.99/month'} · cancel in two taps
          </Text>

          {/* Decline - a visible ghost button, not a buried link. In this
              category a findable exit IS the brand. */}
          <TouchableOpacity onPress={goNext} style={nstyles.ghostButtonTight}>
            <Text style={nstyles.ghostButtonText}>Continue with the free garden</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep.kind === 'freeWarning') {
      // ── The second ask ────────────────────────────────────────────────────────
      // Pushes harder than the paywall: names the ceiling in the headline, makes
      // the free trial the obvious move, and asks directly. Competitors run
      // far harsher versions of this screen (red danger framing, demoted exits).
      // HARD RULE that still holds: every item below is a CONVENIENCE. No
      // religious content is ever framed as something the user "loses" - the
      // Qur'an, hadith, prayer times and duas are free forever and never appear
      // on this list. That's the line Pillars never crosses either.
      const trialDays = PREMIUM_PLANS.yearly.trialDays;
      const ceilings = [
        { icon: 'grid-off' as const, text: 'Your garden stops at 7×7 - permanently' },
        { icon: 'speedometer-slow' as const, text: 'Coins & XP earn at half the rate' },
        { icon: 'snowflake-off' as const, text: 'No streak freezes - one bad week resets you' },
        { icon: 'tree-outline' as const, text: 'Golden Tree & Ancient Cedar stay locked' },
        { icon: 'chart-line' as const, text: 'No insights into your prayer patterns' },
      ];
      return (
        <View style={styles.freeWarnNew}>
          {/* Animated transformation hero - what the garden becomes */}
          <View style={styles.freeWarnHero}>
            <StarRow />
            <FreePremiumTransform size={150} />
          </View>

          <View style={styles.freeWarnBody}>
            <Text style={styles.insightTitle}>This is where the free garden stops.</Text>
            <Text style={styles.insightBodyText}>
              Prayer times, the full Qur'an, hadith and duas stay free forever. But the garden itself hits a ceiling:
            </Text>

            <View style={styles.insightChecklist}>
              {ceilings.map((l, i) => (
                <View key={l.text} style={[styles.freeWarnLossRow, i > 0 && styles.insightCheckDivider]}>
                  <MaterialCommunityIcons name={l.icon} size={17} color="rgba(232,168,124,0.9)" />
                  <Text style={styles.freeWarnLossText}>{l.text}</Text>
                </View>
              ))}
            </View>

            <View style={nstyles.askBox}>
              <Text style={nstyles.askText}>
                Try Premium free for {trialDays} days. Nothing is charged until day {trialDays + 1}, and cancelling takes two taps.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handlePremiumPurchase}
              disabled={purchasing}
              style={styles.premiumButton}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="star-four-points" size={18} color="#1a0f00" style={{ marginRight: 6 }} />
              <Text style={styles.premiumButtonText}>
                {purchasing ? 'Processing…' : `Start my ${trialDays} free days`}
              </Text>
            </TouchableOpacity>
            <Text style={styles.trialNote}>
              {trialDays} days free · then {selectedPlan === 'yearly' ? '$44.99/year' : '$6.99/month'} · cancel anytime
            </Text>

            <TouchableOpacity onPress={finishOnboarding} style={nstyles.ghostButton}>
              <Text style={nstyles.ghostButtonText}>Keep the free garden</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Ayah card ─────────────────────────────────────────────────────────────
    if (currentStep.kind === 'ayah') {
      return (
        <View style={styles.ayahWrap}>
          <Image source={currentStep.image} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(8,17,28,0.25)', 'rgba(8,17,28,0.65)', 'rgba(8,17,28,0.97)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.ayahContent}>
            <Text style={styles.ayahQuote}>❝{currentStep.quote}❞</Text>
            <Text style={styles.ayahSource}>{currentStep.source}</Text>
            <TouchableOpacity onPress={goNext} style={[styles.primaryButton, styles.ayahButton]}>
              <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Empathy select ────────────────────────────────────────────────────────
    if (currentStep.kind === 'empathySelect') {
      return renderSelectCard('empathySelect');
    }

    // ── Summary card ──────────────────────────────────────────────────────────
    if (currentStep.kind === 'summary') {
      const routine = singleSelections[ROUTINE_KEY];
      const goal = singleSelections[GOAL_KEY];
      const hardest = singleSelections['@GrowPray:hardestPrayer'];
      const blockers = multiSelections[BLOCKERS_KEY] ?? [];
      const routineLabel: Record<string, string> = {
        on_time: 'already pray consistently',
        daily_not_on_time: 'pray daily but want better timing',
        most_days: 'pray most days',
        occasionally: 'pray occasionally and want more',
        starting: 'are starting fresh',
      };
      const goalLabel: Record<string, string> = {
        '5_on_time': 'pray all 5 on time', fajr: 'build a strong Fajr habit',
        consistency: 'build a stable daily routine', focus: 'improve focus in salah',
        character: 'become a better Muslim',
      };
      const features: string[] = [];
      if (hardest === 'Fajr' || blockers.includes('waking_up')) features.push('Fajr reminders to start your day in prayer');
      if (blockers.includes('forgetting')) features.push('Prayer-time alerts so no window slips by');
      if (blockers.includes('motivation')) features.push('A garden that grows with every salah');
      if (blockers.includes('focus')) features.push('Tasbih and after-salah adhkar to steady your focus');
      if (blockers.includes('distractions')) features.push('A calm, ad-free, distraction-free space');
      if (blockers.includes('busy')) features.push('Deadline warnings before each window closes');
      // Spiritual tools everyone gets, free
      features.push('A daily reflection, Qibla compass, and dua library');
      if (features.length < 3) features.push('A garden that grows with your salah', 'Streak tracking and weekly challenges');
      return (
        <View style={styles.pillarCard}>
          <View style={styles.pillarHeroImage}>
            <Image source={OB_PLAN} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={styles.pillarHeroOverlay} />
          </View>
          <View style={styles.pillarContent}>
            <Text style={styles.pillarTitle}>Your personalised path</Text>
            <Text style={styles.pillarBody}>
              {`You ${routineLabel[routine ?? 'starting'] ?? 'are on a journey'} and want to ${goalLabel[goal ?? 'consistency'] ?? 'build better habits'}. Here is what Grow Pray will focus on for you:`}
            </Text>
            {/* Pinned first, gold: the anti-lock message. The Qur'an is an
                acquisition asset here, never a padlock. */}
            <View style={nstyles.freeRow}>
              <MaterialCommunityIcons name="book-open-page-variant" size={15} color="#f0c27a" />
              <Text style={nstyles.freeRowText}>The full Qur'an & Nawawi's 40 Hadith - free, for everyone, forever.</Text>
            </View>
            <View style={styles.pillarHighlights}>
              {features.slice(0, 4).map((f) => (
                <View key={f} style={styles.pillarChip}>
                  <MaterialCommunityIcons name="check" size={13} color="#d9a75f" />
                  <Text style={styles.pillarChipText}>{f}</Text>
                </View>
              ))}
            </View>
            <Text style={nstyles.summaryClosing}>Everything's ready. Two minutes of setup - then you plant that intention.</Text>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
            </TouchableOpacity>
          </View>
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
  reframeHero: {
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
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
  title: { color: '#ffffff', fontSize: 34, lineHeight: 40, fontWeight: '800', marginBottom: 12, fontFamily: FONTS.display },
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
    fontFamily: FONTS.display,
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
  // Card 19 (premiumIntro) benefits - icon-led rows so each perk has a visual
  // anchor, mirroring how the pillar cards pair copy with a clear icon.
  premiumBenefits: {
    gap: 12,
    marginBottom: 22,
  },
  premiumBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  premiumBenefitIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,167,95,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.24)',
  },
  premiumBenefitTitle: {
    color: '#f7f1e8',
    fontSize: 15,
    fontWeight: '700',
  },
  premiumBenefitSub: {
    color: 'rgba(247,241,232,0.55)',
    fontSize: 12.5,
    marginTop: 1,
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
  quoteText: { textAlign: 'center', color: '#ffffff', fontSize: 33, lineHeight: 40, fontWeight: '800', marginBottom: 18, fontFamily: FONTS.display },
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

  // ── Redesigned insight card (cards 4 & 8) ───────────────────────────────────
  insightCardNew: {
    backgroundColor: 'rgba(7,13,22,0.88)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.18)',
    overflow: 'hidden',
  },
  insightHero: {
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217,167,95,0.14)',
    backgroundColor: 'rgba(217,167,95,0.05)',
    overflow: 'hidden',
  },
  insightGlowOuter: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(217,167,95,0.07)',
  },
  insightGlowInner: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(217,167,95,0.12)',
  },
  insightMedallion: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,26,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(240,194,122,0.45)',
  },
  insightMedallionRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: 'rgba(240,194,122,0.22)',
  },
  insightBody: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
  },
  insightTitle: {
    color: '#ffffff',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    marginBottom: 10,
    fontFamily: FONTS.display,
  },
  insightBodyText: {
    color: 'rgba(247,241,232,0.74)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  insightChecklist: {
    backgroundColor: 'rgba(13,26,43,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  insightCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  insightCheckDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  insightCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d9a75f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCheckText: {
    flex: 1,
    color: 'rgba(247,241,232,0.86)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },

  // ── Redesigned privacy pillar (card 11) ─────────────────────────────────────
  privacyVault: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,26,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(240,194,122,0.45)',
  },
  privacyVaultRing: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(240,194,122,0.22)',
  },
  privacyVaultRingInner: {
    position: 'absolute',
    width: 138,
    height: 138,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: 'rgba(240,194,122,0.10)',
  },
  privacyFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  privacyFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,167,95,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.20)',
  },
  privacyFeatureLabel: {
    color: '#f4efe6',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 1,
  },
  privacyFeatureSub: {
    color: 'rgba(247,241,232,0.55)',
    fontSize: 12.5,
    lineHeight: 17,
  },

  // ── Redesigned free-version warning (card 21) ───────────────────────────────
  freeWarnNew: {
    backgroundColor: 'rgba(7,13,22,0.90)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.16)',
    overflow: 'hidden',
  },
  freeWarnHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217,167,95,0.12)',
    backgroundColor: 'rgba(217,167,95,0.04)',
    overflow: 'hidden',
  },
  freeWarnBody: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
  },
  freeWarnLossRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  freeWarnLossText: {
    flex: 1,
    color: 'rgba(247,241,232,0.82)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
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
    // Box matches the 1659×948 landscape art (~1.75:1). The image uses resizeMode
    // "contain" so the WHOLE picture is always visible - nothing is ever cropped,
    // regardless of device width.
    width: '100%',
    aspectRatio: 1659 / 948,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#0a111c',
  },
  paywallHeroImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  paywallHeroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  // Card 19 (premiumIntro) carries more body content than the paywall, so its hero
  // must be shorter. Instead of capping maxHeight against the inherited width:'100%'
  // + aspectRatio (which leaves the box's size unresolvable -> it collapses and
  // squishes the art + badge), give it an EXPLICIT width: the largest that keeps the
  // aspectRatio-derived height within ~20% of the screen, but never wider than the
  // content column. Height then derives from paywallHero's aspectRatio; centred.
  premiumHero: {
    width: Math.min(SCREEN_WIDTH - 40, SCREEN_HEIGHT * 0.2 * (1659 / 948)),
    alignSelf: 'center',
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
    fontFamily: FONTS.display,
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
    fontFamily: FONTS.display,
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

  // ── New card styles ─────────────────────────────────────────────────────────

  // Ayah card
  ayahWrap: {
    minHeight: SCREEN_HEIGHT * 0.72,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  ayahContent: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 80,
    alignItems: 'center',
  },
  // The ayah content is center-aligned, which would otherwise shrink the button
  // to its text width. Stretch it full-width so it matches every other card.
  ayahButton: {
    alignSelf: 'stretch',
  },
  ayahQuote: {
    color: '#f5ebd8',
    fontSize: 22,
    lineHeight: 32,
    textAlign: 'center',
    fontFamily: FONTS.display,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  ayahSource: {
    color: 'rgba(247,241,232,0.55)',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: FONTS.displayMedium,
    marginBottom: 28,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Pledge card
  pledgeWrap: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 18,
  },
  pledgeBgImage: {
    borderRadius: 28,
    opacity: 0.5,
  },
  pledgeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,13,22,0.62)',
    borderRadius: 28,
  },
  pledgeHadithLabel: {
    color: '#7fb0e8',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.display,
    marginBottom: 10,
  },
  pledgeHadith: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    fontFamily: FONTS.display,
    marginBottom: 6,
  },
  pledgeAccent: {
    color: '#e8a87c',
  },
  pledgeSource: {
    color: 'rgba(247,241,232,0.45)',
    fontSize: 12,
    marginBottom: 24,
  },
  pledgePromise: {
    color: 'rgba(247,241,232,0.92)',
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 12,
  },
  pledgePromiseSub: {
    color: 'rgba(247,241,232,0.92)',
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 22,
  },
  pledgeSignWrap: {
    marginBottom: 22,
  },
  trustNote: {
    color: 'rgba(247,241,232,0.40)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
});

// ── Styles for the redesigned flow (welcome hero, live times, planting,
//    free-forever strip, ghost decline buttons) ────────────────────────────────
const nstyles = StyleSheet.create({
  // S1 welcome hero - the growth loop, live, under a starfield
  welcomeHero: {
    height: SCREEN_HEIGHT * 0.32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  // Live prayer times payoff (location card, state 2)
  timesList: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(247,241,232,0.10)',
    backgroundColor: 'rgba(7,13,22,0.55)',
    overflow: 'hidden',
    marginBottom: 18,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(247,241,232,0.08)',
  },
  timesRowNext: {
    backgroundColor: 'rgba(217,167,95,0.12)',
  },
  timesName: { color: 'rgba(247,241,232,0.85)', fontSize: 15, fontWeight: '700' },
  timesNameNext: { color: '#f0c27a' },
  timesValue: { color: 'rgba(247,241,232,0.7)', fontSize: 15, fontWeight: '600' },
  timesNextTag: {
    color: '#f0c27a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginRight: 10,
  },

  // Plant-your-niyyah screen
  plantWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  plantHadithLabel: {
    color: 'rgba(240,194,122,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 10,
    textAlign: 'center',
  },
  plantHadith: {
    color: '#f7f1e8',
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
    fontFamily: FONTS.display,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  plantHadithSource: {
    color: 'rgba(247,241,232,0.5)',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 22,
    textAlign: 'center',
  },
  intentionTag: {
    backgroundColor: 'rgba(217,167,95,0.12)',
    borderColor: 'rgba(217,167,95,0.45)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 6,
  },
  intentionText: { color: '#f4e9d8', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  intentionMeta: { color: 'rgba(247,241,232,0.5)', fontSize: 12, marginTop: 4 },
  plantedText: {
    color: '#e8c97e',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  plantTileArea: { alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  plantGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(217,167,95,0.14)',
  },
  plantTile: { width: 140, height: 70 },
  plantSparkle: { position: 'absolute', width: 34, height: 34, top: 44 },
  sproutImg: { position: 'absolute', width: 92, height: 92, top: 24 },
  plantHint: {
    color: 'rgba(247,241,232,0.55)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },

  // Paywall free-forever strip - what's free comes before what's for sale
  freeStrip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(240,194,122,0.35)',
    backgroundColor: 'rgba(240,194,122,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  freeStripLabel: {
    color: '#f0c27a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  freeStripText: { color: 'rgba(247,241,232,0.8)', fontSize: 12.5, lineHeight: 18 },

  // Summary additions
  freeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(240,194,122,0.10)',
    borderColor: 'rgba(240,194,122,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  freeRowText: { flex: 1, color: '#f4e9d8', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  summaryClosing: {
    color: 'rgba(247,241,232,0.6)',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 19,
  },

  // Decline path - a visible ghost button, not a buried link
  ghostButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(247,241,232,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: { color: 'rgba(247,241,232,0.6)', fontSize: 14, fontWeight: '700' },

  // Second-ask support line
  supportLine: {
    color: 'rgba(247,241,232,0.5)',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 4,
  },

  // Madhab caption - balanced above/below so it reads as centred between the
  // last option and the Next button (the options wrap already adds 18 below).
  madhabCaption: {
    textAlign: 'center',
    color: 'rgba(247,241,232,0.56)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 0,
    marginBottom: 18,
    paddingHorizontal: 8,
  },

  // ── Compact paywall - must fit one screen, never scroll ──────────────────
  paywallCompact: {
    backgroundColor: 'rgba(7,13,22,0.92)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  freeStripTight: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240,194,122,0.35)',
    backgroundColor: 'rgba(240,194,122,0.08)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  freeStripTextTight: { color: 'rgba(247,241,232,0.82)', fontSize: 11.5, lineHeight: 16 },
  paywallTitleTight: {
    color: '#ffffff',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    fontFamily: FONTS.display,
    textAlign: 'center',
    marginBottom: 10,
  },
  benefitsTight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  benefitPillTight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(217,167,95,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.22)',
  },
  benefitPillTextTight: { color: '#e8c97e', fontSize: 11, fontWeight: '600' },
  planRowTight: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  planCardTight: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(247,241,232,0.16)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  planBadgeTight: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    backgroundColor: '#d9a75f',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planTitleTight: { color: 'rgba(247,241,232,0.75)', fontSize: 12, fontWeight: '700' },
  planPriceTight: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '800',
    fontFamily: FONTS.display,
    marginTop: 2,
  },
  planSubTight: { color: 'rgba(247,241,232,0.45)', fontSize: 10, marginTop: 2 },
  premiumButtonTight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9a75f',
    borderRadius: 16,
    paddingVertical: 15,
  },
  trialNoteTight: {
    color: 'rgba(247,241,232,0.45)',
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 7,
  },
  ghostButtonTight: {
    marginTop: 10,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(247,241,232,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Second-ask direct request box
  askBox: {
    marginTop: 14,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(217,167,95,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.30)',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  askText: {
    color: '#f4e9d8',
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '600',
  },
});

