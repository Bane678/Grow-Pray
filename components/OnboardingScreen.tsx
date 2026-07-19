import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
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
import { PREMIUM_PLANS } from '../hooks/usePremium';
import { FONTS } from '../theme/typography';
import { GardenGrowthPreview } from './GardenGrowthPreview';
import { SignaturePad } from './SignaturePad';

const APP_LOGO = require('../assets/Garden Assets/Icons/App_Logo.png');
const ICON_HANDS = require('../assets/Garden Assets/Icons/Icon_Hands.png');
const ICON_LOCATION = require('../assets/Garden Assets/Icons/Icon_Location.png');
const ICON_BELL = require('../assets/Garden Assets/Icons/Icon_Bell.png');
const HERO_GARDEN = require('../assets/Garden Assets/Icons/Loading_Screen2.png');
const HERO_DAWN = require('../assets/Garden Assets/Icons/Loading_Screen.png');
const HERO_NIGHT = require('../assets/Garden Assets/Icons/Starry_Night_Sky.png');
const DEMO_IMAGE = require('../assets/Garden Assets/Icons/Demo_Image.png');
const ICON_SPARKLE = require('../assets/Garden Assets/Icons/Icon_Sparkle.png');
// New onboarding hero images
const OB_WELCOME  = require('../assets/Garden Assets/Icons/Onboarding_Welcome.png');
const OB_AYAH     = require('../assets/Garden Assets/Icons/Onboarding_Ayah.png');
const OB_REFRAME  = require('../assets/Garden Assets/Icons/Onboarding_Refreame.png'); // note typo in filename
const OB_PLAN     = require('../assets/Garden Assets/Icons/Onboarding_Plan.png');
const OB_PLEDGE   = require('../assets/Garden Assets/Icons/Onboarding_Pledge.png');
const OB_PAYWALL  = require('../assets/Garden Assets/Icons/Onboarding_Paywall.png');
// Card 19 (premium showcase) gets its own image, distinct from the paywall art, so two
// back-to-back premium cards don't repeat the same picture. Until the user supplies
// Onboarding_Premium.png, this falls back to OB_PAYWALL (see the swap note below).
const OB_PREMIUM  = OB_PAYWALL;

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

// ── Reversible redesign flags ───────────────────────────────────────────────────
// Flip any of these back to `false` to instantly restore that card's previous design.
// Each redesigned render path keeps its original ("legacy") branch intact behind the flag,
// so reversal is a one-line edit and no assets are removed.
const REDESIGN_INSIGHT        = true; // cards 4 & 8 - the empathy insight card
const REDESIGN_PILLAR_PRIVACY = true; // card 11 - "Your spiritual life is private" pillar
const REDESIGN_FREE_WARNING   = true; // card 21 - the "Are you sure?" free-version warning

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
  | { kind: 'freeWarning' }
  // ── New card kinds ──────────────────────────────────────────────────────────
  /** Full-bleed background image with a centred quote/ayah overlay */
  | { kind: 'ayah'; quote: string; source: string; cta: string; image: any }
  /** Animated garden growth preview pillar */
  | { kind: 'growthPillar'; title: string; body: string; cta: string }
  /** Empathy select - like singleSelect but with a soft reframe response built in */
  | { kind: 'empathySelect'; key: string; title: string; subtitle: string; cta: string; options: SelectOption[] }
  /** Personalised plan summary - derives copy from earlier answers */
  | { kind: 'summary'; cta: string }
  /** Aspirational premium showcase shown right before the pledge + paywall */
  | { kind: 'premiumIntro' }
  /** Signed pledge / niyyah contract */
  | { kind: 'pledge' };

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
  // 0 - Welcome
  { kind: 'welcome', title: 'Salaam', body: 'Every prayer you keep grows your garden. Every one you miss, it shows. A peaceful, honest companion for your daily worship.', cta: 'Bismillah', image: OB_WELCOME },

  // 1 - Ayah (Qur'an 29:45)
  {
    kind: 'ayah',
    quote: 'Indeed, prayer prohibits immorality and wrongdoing.',
    source: 'Qur\'an 29:45',
    cta: 'Continue',
    image: OB_AYAH,
  },

  // 2 - Relationship with salah (empathetic select)
  {
    kind: 'empathySelect',
    key: ROUTINE_KEY,
    title: 'How is your relationship with salah right now?',
    subtitle: "Be honest. We're here to support, not judge.",
    cta: 'Next',
    options: [
      { value: 'on_time',           label: 'I pray all 5 on time',           icon: 'check-circle-outline' },
      { value: 'daily_not_on_time', label: 'I pray daily, not always on time', icon: 'clock-alert-outline' },
      { value: 'most_days',         label: 'Most days, but I miss some',      icon: 'calendar-check-outline' },
      { value: 'occasionally',      label: 'Occasionally, trying to improve', icon: 'calendar-blank-outline' },
      { value: 'starting',          label: "I want to start or restart",       icon: 'seed-outline' },
    ],
  },

  // 3 - Hardest prayer (single select)
  {
    kind: 'singleSelect',
    key: '@GrowPray:hardestPrayer',
    title: 'Which prayer is hardest for you to keep?',
    subtitle: "Everyone has one. There's no wrong answer.",
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
    title: 'What usually makes it difficult?',
    subtitle: 'Select all that apply.',
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

  // 5 - How you feel after missing (emotional empathy)
  {
    kind: 'empathySelect',
    key: '@GrowPray:missedFeeling',
    title: 'How do you feel when you miss a prayer?',
    subtitle: 'We ask so we can support you, not judge you.',
    cta: 'Next',
    options: [
      { value: 'guilty',      label: 'Guilty, I carry it',       icon: 'heart-broken' },
      { value: 'disconnected',label: 'Disconnected from Allah',   icon: 'link-off' },
      { value: 'restart',     label: 'Motivated to get back on track', icon: 'refresh' },
      { value: 'numb',        label: "Numb, I've normalised it", icon: 'emoticon-neutral-outline' },
    ],
  },

  // 6 - Reframe: every prayer is a fresh start
  {
    kind: 'reframe',
    title: 'Every prayer is a fresh start.',
    body: "The Prophet ﷺ said: 'The most beloved deeds to Allah are the most consistent ones, even if small.' Missing a prayer doesn't close the door. Turning back is always possible.",
    cta: 'That gives me hope',
  },

  // 7 - Garden growth pillar
  { kind: 'growthPillar', title: 'Your prayers build something real.', body: 'Every salah you keep grows your garden. Miss days and it begins to wither. Grow Pray makes your consistency visible.', cta: 'Let\'s grow' },

  // 8 - Privacy pillar
  { kind: 'pillar', title: 'Your spiritual life is private.', body: 'No accounts. No servers. Your prayers, streaks, and garden never leave your device.', cta: 'Next', icon: 'shield-check-outline', highlights: ['On-device only', 'No login required', 'Zero data sharing'] },

  // 9 - Name input
  { kind: 'nameInput', title: 'What should we call you?', body: 'We use your name in a few places to make the experience feel personal.', cta: 'Next', placeholder: 'Enter your name' },

  // 10 - Goal (single select)
  {
    kind: 'singleSelect',
    key: GOAL_KEY,
    title: 'What is your intention for the next 30 days?',
    subtitle: 'Set one clear goal to anchor your journey.',
    cta: 'Next',
    options: [
      { value: '5_on_time',   label: 'Pray all 5 on time',           icon: 'clock-check-outline' },
      { value: 'fajr',        label: 'Consistently wake for Fajr',   icon: 'weather-sunset-up' },
      { value: 'consistency', label: 'Build a stable daily routine', icon: 'repeat' },
      { value: 'focus',       label: 'Improve my focus in salah',    icon: 'bullseye' },
      { value: 'character',   label: 'Become a better Muslim overall', icon: 'diamond-stone' },
    ],
  },

  // 11 - Personalised summary (pulls from answers)
  { kind: 'summary', cta: 'Let\'s set up your prayer times' },

  // 12 - Madhab
  { kind: 'madhab' },

  // 13 - Location
  { kind: 'locationPermission' },

  // 14 - Notifications
  { kind: 'notificationPermission' },

  // 15 - Pledge (signed niyyah) - the sincere commitment comes first, with no
  //       premium messaging beforehand.
  { kind: 'pledge' },

  // 16 - Premium showcase - desire-building immediately after the pledge
  { kind: 'premiumIntro' },

  // 17 - Paywall
  { kind: 'paywall' },

  // 18 - Free warning fallback
  { kind: 'freeWarning' },
];
const TOTAL_STEPS = STEPS.length;
// Empathy select steps that produce an insight card (indices 2 and 5)
const INSIGHT_STEP_INDICES = [2, 5];
const TRUE_TOTAL = STEPS.length + INSIGHT_STEP_INDICES.length; // 20 steps + 2 insights = 20

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

// ── Hold-to-confirm button ─────────────────────────────────────────────────────
// Press and hold for ~1.1s to confirm - an intentional, deliberate gesture that
// suits "locking in" a sincere pledge (inspired by similar habit apps).
function HoldToConfirmButton({ disabled, onConfirm, label }: {
  disabled: boolean;
  onConfirm: () => void;
  label: string;
}) {
  const HOLD_MS = 1100;
  const fill = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const start = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    anim.current = Animated.timing(fill, { toValue: 1, duration: HOLD_MS, useNativeDriver: false });
    anim.current.start();
    timer.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onConfirm();
    }, HOLD_MS);
  };

  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    anim.current?.stop();
    Animated.timing(fill, { toValue: 0, duration: 220, useNativeDriver: false }).start();
  };

  return (
    <Pressable onPressIn={start} onPressOut={cancel} disabled={disabled}>
      <View style={[holdStyles.btn, disabled && holdStyles.btnDisabled]}>
        <Animated.View
          style={[
            holdStyles.fill,
            { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        <Text style={holdStyles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const holdStyles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(217,167,95,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.5)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#d9a75f',
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});


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
  const [pledgeSigned, setPledgeSigned] = useState(false);

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
        title: 'Start small, then grow',
        body: 'Your garden gives visible progress from each prayer, so motivation comes from momentum instead of pressure.',
        icon: 'sprout-outline',
        bullets: ['Each prayer grows your garden', 'Missed prayers show where to recover', 'Challenges keep your week on track'],
      };
    }

    // ── How you feel when you miss ────────────────────────────────────────────
    if ((targetStep.kind === 'singleSelect' || targetStep.kind === 'empathySelect') && targetStep.key === '@GrowPray:missedFeeling') {
      const selected = singleSelections['@GrowPray:missedFeeling'];
      const responses: Record<string, InsightCard> = {
        guilty: {
          title: 'Guilt can be a sign of iman',
          body: 'Feeling the weight of a missed prayer shows you care. Grow Pray helps you channel that into action rather than shame.',
          icon: 'heart-outline',
          bullets: ['No punitive language, just encouragement', 'Rest periods for hard seasons', 'Streak freezes for life\'s obstacles'],
        },
        disconnected: {
          title: 'Prayer is the connection',
          body: 'The garden is a reminder that each salah is a thread back to Allah. Every new prayer re-weaves it.',
          icon: 'link-variant',
          bullets: ['Visual link between prayer and growth', 'Daily reminders to return', 'Each prayer counts, even one'],
        },
        restart: {
          title: 'That drive is your greatest asset',
          body: 'Grow Pray is built for people who want to restart. Streak freezes, rest periods, and weekly challenges all support recovery.',
          icon: 'refresh',
          bullets: ['Streak freezes protect your progress', 'Rest period mode for tough times', 'No permanent penalty for missing'],
        },
        numb: {
          title: 'Small steps restore feeling',
          body: 'Sometimes the goal isn\'t khushu. It\'s just showing up. Your garden grows from presence, not perfection.',
          icon: 'sprout-outline',
          bullets: ['Progress from any prayer completed', 'Challenges rebuild routine gently', 'History shows how far you\'ve come'],
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
    if (currentStep.kind === 'pledge') return pledgeSigned;
    return true;
  }, [currentStep, multiSelections, name, selectedMadhab, singleSelections, pledgeSigned]);

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
      if (!REDESIGN_INSIGHT) {
        // ── Legacy insight card (flip REDESIGN_INSIGHT to false to restore) ──────
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
      // ── Redesigned insight card (cards 4 & 8) ─────────────────────────────────
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

    // ── Redesigned privacy pillar (card 11) ───────────────────────────────────
    // Only the "Your spiritual life is private." pillar is redesigned; any other
    // pillar falls through to the shared renderer below. Flip REDESIGN_PILLAR_PRIVACY
    // to false to restore the original look.
    if (
      currentStep.kind === 'pillar' &&
      REDESIGN_PILLAR_PRIVACY &&
      currentStep.title === 'Your spiritual life is private.'
    ) {
      const features: { icon: IconName; label: string; sub: string }[] = [
        { icon: 'cellphone-lock', label: 'On-device only', sub: 'Your data lives on this phone, nowhere else.' },
        { icon: 'account-off-outline', label: 'No login required', sub: 'No account, no email, no password.' },
        { icon: 'cloud-off-outline', label: 'Zero data sharing', sub: 'Nothing is sent to us or any third party.' },
      ];
      return (
        <View style={styles.insightCardNew}>
          <View style={styles.insightHero}>
            <View style={styles.insightGlowOuter} />
            <View style={styles.insightGlowInner} />
            <StarRow />
            <View style={styles.privacyVault}>
              <View style={styles.privacyVaultRing} />
              <View style={styles.privacyVaultRingInner} />
              <MaterialCommunityIcons name="shield-lock" size={42} color="#f0c27a" />
            </View>
          </View>
          <View style={styles.insightBody}>
            <Text style={styles.insightTitle}>{currentStep.title}</Text>
            <Text style={styles.insightBodyText}>{currentStep.body}</Text>
            <View style={styles.insightChecklist}>
              {features.map((f, i) => (
                <View key={f.label} style={[styles.privacyFeatureRow, i > 0 && styles.insightCheckDivider]}>
                  <View style={styles.privacyFeatureIcon}>
                    <MaterialCommunityIcons name={f.icon} size={18} color="#f0c27a" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.privacyFeatureLabel}>{f.label}</Text>
                    <Text style={styles.privacyFeatureSub}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
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
          <View style={styles.reframeHero}>
            <Image source={OB_REFRAME} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={styles.pillarHeroOverlay} />
          </View>
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
          {/* Premium hero - golden tree on starry night */}
          <View style={styles.paywallHero}>
            <Image source={OB_PAYWALL} style={styles.paywallHeroImg} resizeMode="contain" />
            {/* Bottom gradient fade into panel - only the lowest sliver fades, so the
                full artwork stays visible. */}
            <LinearGradient
              colors={['rgba(9,14,22,0)', 'rgba(9,14,22,0)', 'rgba(9,14,22,0.85)']}
              locations={[0, 0.7, 1]}
              style={styles.paywallHeroFade}
            />
            {/* PREMIUM badge */}
            <View style={styles.paywallHeroBadge}>
              <Image source={ICON_SPARKLE} style={{ width: 14, height: 14 }} resizeMode="contain" />
              <Text style={styles.paywallHeroBadgeText}>PREMIUM ONLY</Text>
            </View>
          </View>

          <View style={styles.paywallPanel}>
            {/* Title */}
            <Text style={styles.paywallTitle}>Honour your intention</Text>
            <Text style={styles.paywallSubtitle}>
              You've made your pledge. Give it the best chance to flourish.
            </Text>

            {/* Benefits - pill-style with glow */}
            <View style={styles.benefitsGrid}>
              {[
                { icon: 'grid' as const, text: 'Unlimited garden' },
                { icon: 'circle-multiple' as const, text: '2x coins and XP' },
                { icon: 'tree' as const, text: 'Premium trees' },
                { icon: 'chart-line' as const, text: 'Advanced insights' },
                { icon: 'shield-check' as const, text: 'Free streak freezes' },
                { icon: 'book-open-page-variant' as const, text: "Full Qur'an & Hadith" },
              ].map((b, i) => (
                <View key={i} style={styles.benefitPill}>
                  <MaterialCommunityIcons name={b.icon} size={15} color="#d9a75f" />
                  <Text style={styles.benefitPillText}>{b.text}</Text>
                </View>
              ))}
            </View>

            {/* Plan selector - side by side */}
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
            <Text style={styles.trustNote}>
              No ads, ever · Private by design · Cancel in two taps
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
      if (REDESIGN_FREE_WARNING) {
        // ── Redesigned free-version warning (card 21) ───────────────────────────
        // An animated free→premium transformation: one garden plot blooms from a
        // barren free state into a flourishing premium one on a loop. The loss is
        // then named in plain language. Same CTAs / pricing as before.
        const losses = [
          { icon: 'grid-off' as const, text: 'Your garden stays capped at 7×7' },
          { icon: 'snowflake-off' as const, text: 'No streak freezes when life gets hard' },
          { icon: 'tree-outline' as const, text: 'Premium trees stay locked away' },
          { icon: 'speedometer-slow' as const, text: 'Coins and XP grow at half speed' },
          { icon: 'book-lock-outline' as const, text: "The full Qur'an & Hadith library stays locked" },
        ];
        return (
          <View style={styles.freeWarnNew}>
            {/* Animated transformation hero */}
            <View style={styles.freeWarnHero}>
              <StarRow />
              <FreePremiumTransform size={170} />
            </View>

            <View style={styles.freeWarnBody}>
              <Text style={styles.insightTitle}>Your garden could flourish.</Text>
              <Text style={styles.insightBodyText}>
                Continuing free is completely okay - but here's what stays out of reach:
              </Text>

              <View style={styles.insightChecklist}>
                {losses.map((l, i) => (
                  <View key={l.text} style={[styles.freeWarnLossRow, i > 0 && styles.insightCheckDivider]}>
                    <MaterialCommunityIcons name={l.icon} size={18} color="rgba(239,68,68,0.85)" />
                    <Text style={styles.freeWarnLossText}>{l.text}</Text>
                  </View>
                ))}
              </View>

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

              <TouchableOpacity onPress={finishOnboarding} style={styles.freeLink}>
                <Text style={styles.freeLinkText}>No thanks, continue for free</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      // ── Legacy free-warning comparison table (flip REDESIGN_FREE_WARNING off) ──
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

    // ── Garden growth pillar ──────────────────────────────────────────────────
    if (currentStep.kind === 'growthPillar') {
      return (
        <View style={styles.pillarCard}>
          <View style={styles.pillarHero}>
            <View style={styles.pillarGlow} />
            <GardenGrowthPreview size={200} />
          </View>
          <View style={styles.pillarContent}>
            <Text style={styles.pillarTitle}>{currentStep.title}</Text>
            <Text style={styles.pillarBody}>{currentStep.body}</Text>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
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
            <View style={styles.pillarHighlights}>
              {features.slice(0, 4).map((f) => (
                <View key={f} style={styles.pillarChip}>
                  <MaterialCommunityIcons name="check" size={13} color="#d9a75f" />
                  <Text style={styles.pillarChipText}>{f}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{currentStep.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Premium showcase ──────────────────────────────────────────────────────
    if (currentStep.kind === 'premiumIntro') {
      const goal = singleSelections[GOAL_KEY];
      const goalLine: Record<string, string> = {
        '5_on_time': 'praying all five on time',
        fajr: 'never missing Fajr again',
        consistency: 'a routine that finally sticks',
        focus: 'deeper focus in every salah',
        character: 'becoming the Muslim you want to be',
      };
      return (
        <>
          <View style={[styles.paywallHero, styles.premiumHero]}>
            <Image source={OB_PREMIUM} style={styles.paywallHeroImg} resizeMode="contain" />
            <LinearGradient
              colors={['rgba(9,14,22,0)', 'rgba(9,14,22,0)', 'rgba(9,14,22,0.85)']}
              locations={[0, 0.7, 1]}
              style={styles.paywallHeroFade}
            />
            <View style={styles.paywallHeroBadge}>
              <Image source={ICON_SPARKLE} style={{ width: 14, height: 14 }} resizeMode="contain" />
              <Text style={styles.paywallHeroBadgeText}>PREMIUM</Text>
            </View>
          </View>
          <View style={styles.pillarContent}>
            <Text style={styles.pillarTitle}>Give your journey its best chance</Text>
            <Text style={styles.pillarBody}>
              {`You're working toward ${goalLine[goal ?? 'consistency'] ?? 'consistency'}. Premium removes every limit, grows your garden twice as fast, and shows you exactly how your salah is improving.`}
            </Text>
            <View style={styles.pillarHighlights}>
              {[
                'Unlimited garden, grow without a ceiling',
                '2x coins and XP, progress twice as fast',
                'Exclusive premium trees: the Golden Tree and Ancient Cedar',
                'Advanced insights into your prayer habits and trends',
                'Free streak freezes every month',
                "The full Qur'an and Nawawi's 40 Hadith, to read, save & annotate",
              ].map((h) => (
                <View key={h} style={styles.pillarChip}>
                  <MaterialCommunityIcons name="check" size={13} color="#d9a75f" />
                  <Text style={styles.pillarChipText}>{h}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    // ── Pledge / niyyah card ──────────────────────────────────────────────────
    if (currentStep.kind === 'pledge') {
      const displayName = name.trim() || 'I';
      return (
        <ImageBackground source={OB_PLEDGE} style={styles.pledgeWrap} imageStyle={styles.pledgeBgImage} resizeMode="cover">
          <View style={styles.pledgeOverlay} />
          {/* Hadith Qudsi */}
          <Text style={styles.pledgeHadithLabel}>Allah ﷻ says:</Text>
          <Text style={styles.pledgeHadith}>
            "I am as My servant thinks of Me, and I am with him when he <Text style={styles.pledgeAccent}>remembers Me</Text>."
          </Text>
          <Text style={styles.pledgeSource}>Sahih al-Bukhari 7405</Text>

          {/* Personal promise */}
          <Text style={styles.pledgePromise}>
            I, <Text style={styles.pledgeAccent}>{displayName}</Text>, intend to try my best to draw closer to <Text style={styles.pledgeAccent}>Allah</Text> and care for my prayers.
          </Text>
          <Text style={styles.pledgePromiseSub}>
            May <Text style={styles.pledgeAccent}>Allah</Text> guide me, and all of us, on this journey.
          </Text>

          {/* Signature */}
          <View style={styles.pledgeSignWrap}>
            <SignaturePad height={150} onSignedChange={(s) => setPledgeSigned(s)} />
          </View>

          {/* Hold to confirm */}
          <HoldToConfirmButton
            disabled={!pledgeSigned}
            onConfirm={goNext}
            label={pledgeSigned ? 'Hold to seal your intention' : 'Sign above first'}
          />
        </ImageBackground>
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
  // Card 19 (premiumIntro) carries more body content than the paywall, so its hero is
  // height-capped to keep the whole card on a single non-scrolling screen. Capping
  // maxHeight against a fixed aspectRatio shrinks the box's WIDTH too (to preserve
  // the ratio) - alignSelf: 'center' keeps it centred instead of flush to one side.
  premiumHero: {
    maxHeight: SCREEN_HEIGHT * 0.2,
    width: undefined,
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

