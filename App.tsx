import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { Text, View, ActivityIndicator, TouchableOpacity, Image, ImageBackground, Animated, Modal, ScrollView, TouchableWithoutFeedback, Pressable, Easing, StyleSheet, Dimensions, Platform, AppState } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GardenScene } from './components/GardenScene';
import { useGardenState, TileState, MAX_GRID_SIZE } from './hooks/useGardenState';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ShopModal, TREE_CATALOG } from './components/ShopModal';
import { PaywallModal } from './components/PaywallModal';
import { usePremium } from './hooks/usePremium';
import { useConsistencyMultiplier } from './hooks/useConsistencyMultiplier';
import { useChallenges, ChallengeId } from './hooks/useChallenges';
import { ChallengesModal } from './components/ChallengesModal';

import { SettingsModal } from './components/SettingsModal';
import { PrayerHistoryModal } from './components/PrayerHistoryModal';
import { DhikrScreen } from './components/DhikrScreen';
import { QiblaScreen } from './components/QiblaScreen';
import { TutorialOverlay, Rect as TutorialRect } from './components/TutorialOverlay';
import { useTutorial } from './hooks/useTutorial';
import { useBoosts, BOOST_CATALOG } from './hooks/useBoosts';

import { Asset } from 'expo-asset';
import { useFonts, Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Amiri_400Regular } from '@expo-google-fonts/amiri';
import { FONTS } from './theme/typography';
import * as SplashScreen from 'expo-splash-screen';
import * as Location from 'expo-location';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePrayerTimes, nextPrayerFrom, type PrayerTimesConfig, type Madhab, type PrayerMethodKey, PRAYER_METHODS } from './hooks/usePrayerTimes';
import { useNotifications } from './hooks/useNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, RadialGradient, Stop, Path, Rect, ClipPath, G } from 'react-native-svg';

const SINGLE_FREEZE_ICON = require('./assets/Garden Assets/Icons/Streak_Freeze.png');

// ─── Day / Night Sky ──────────────────────────────────────────────────────────
// Two stacked, pre-bundled sky images. The night layer crossfades over the day
// layer based on the user's real sunrise/sunset. On first mount the opacity is
// SNAPPED to the correct value (no fade), so reopening the app instantly shows
// the right sky with no wait or flash. A 1-min timer + AppState foreground check
// keep it accurate; both images are local requires so there is nothing to load.
const DAY_SKY = require('./assets/Garden Assets/Icons/Daytime_Sky.png');
const NIGHT_SKY = require('./assets/Garden Assets/Icons/Starry_Night_Sky.png');

// Shared day/night computation so any component (SkyBackground, tab page overlays)
// can react to the same real sunrise/sunset window without duplicating the logic.
function useIsDay(sunrise?: string, sunset?: string): boolean {
  const computeIsDay = useCallback(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMins = (s?: string) => {
      if (!s || !/^\d{1,2}:\d{2}/.test(s)) return null;
      const [h, m] = s.split(':').map(Number);
      return h * 60 + m;
    };
    const sr = toMins(sunrise) ?? 6 * 60;   // fallback 06:00
    const ss = toMins(sunset) ?? 18 * 60;   // fallback 18:00
    return mins >= sr && mins < ss;
  }, [sunrise, sunset]);

  const [isDay, setIsDay] = useState(computeIsDay);

  // Recompute whenever sunrise/sunset become available or the function changes
  useEffect(() => {
    setIsDay(computeIsDay());
  }, [computeIsDay]);

  // Keep it accurate over time and when returning to the foreground
  useEffect(() => {
    const tick = () => setIsDay(computeIsDay());
    const id = setInterval(tick, 60 * 1000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [computeIsDay]);

  return isDay;
}

function SkyBackground({
  isDay,
  children,
}: {
  isDay: boolean;
  children?: React.ReactNode;
}) {
  // night layer: 1 = night visible, 0 = day visible
  const nightOpacity = useRef(new Animated.Value(isDay ? 0 : 1)).current;
  const hasMounted = useRef(false);

  // Drive the crossfade. First run snaps instantly (no animation) for a seamless open.
  useEffect(() => {
    if (!hasMounted.current) {
      nightOpacity.setValue(isDay ? 0 : 1);
      hasMounted.current = true;
      return;
    }
    Animated.timing(nightOpacity, {
      toValue: isDay ? 0 : 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, [isDay, nightOpacity]);

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <Image source={DAY_SKY} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Animated.Image
        source={NIGHT_SKY}
        style={[StyleSheet.absoluteFill, { opacity: nightOpacity }]}
        resizeMode="cover"
      />
      {children}
    </View>
  );
}


// Preload reward sound once at app startup - avoids 200-400ms createAsync delay on first tap
let _rewardSound: Audio.Sound | null = null;
(async () => {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false, staysActiveInBackground: false });
    const { sound } = await Audio.Sound.createAsync(
      require('./assets/sounds/xp_sound.mp3'),
      { shouldPlay: false, volume: 0.5 }
    );
    _rewardSound = sound;
  } catch (_) { /* silent fail - sound is non-critical */ }
})();

// Custom pixel-art icons
const ICON_COIN = require('./assets/Garden Assets/Icons/Icon_Coin.png');
const ICON_FIRE = require('./assets/Garden Assets/Icons/Icon_Fire.png');
const ICON_XP = require('./assets/Garden Assets/Icons/Icon_XP.png');
const ICON_LIGHTNING = require('./assets/Garden Assets/Icons/Icon_Lightning.png');
const ICON_SEEDLING = require('./assets/Garden Assets/Icons/Icon_Seedling.png');
const ICON_MOON = require('./assets/Garden Assets/Icons/Icon_Moon.png');
const ICON_TROPHY = require('./assets/Garden Assets/Icons/Icon_Trophy.png');
const ICON_CROWN = require('./assets/Garden Assets/Icons/Icon_Crown.png');
const ICON_STAR = require('./assets/Garden Assets/Icons/Icon_Star.png');
const ICON_SPARKLE = require('./assets/Garden Assets/Icons/Icon_Sparkle.png');
const ICON_BELL = require('./assets/Garden Assets/Icons/Icon_Bell.png');
const ICON_LOCATION = require('./assets/Garden Assets/Icons/Icon_Location.png');
const ICON_TREE = require('./assets/Garden Assets/Icons/Icon_Tree.png');
const ICON_WARNING = require('./assets/Garden Assets/Icons/Icon_Warning.png');
const ICON_HANDS = require('./assets/Garden Assets/Icons/Icon_Hands.png');
const ICON_GEAR = require('./assets/Garden Assets/Icons/Icon_Gear.png');
const ICON_SCROLL = require('./assets/Garden Assets/Icons/Icon_Scroll.png');

// ─── Error Boundary ──────────────────────────────────────────────────────────
// Catches any unhandled JS error so the app shows a recovery UI
// instead of a blank white screen or OS crash dialog.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0f1526', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😔</Text>
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Please close and reopen the app.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Keep the native splash visible until our custom loading screen image is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

// ─── Design Tokens ────────────────────────────────────────────────────────────
const THEME = {
  bg: '#0f1526',               // Deep navy - unified across all screens
  bgCard: 'rgba(255,255,255,0.04)',  // Subtle card fill (no borders)
  bgOverlay: 'rgba(0,0,0,0.7)',      // Modal overlay
  accent: '#e8a87c',           // Warm peach - active states, highlights
  accentMuted: 'rgba(232,168,124,0.15)', // Soft accent bg
  text: '#e8e0d6',             // Primary text (warm off-white)
  textSecondary: '#6b7280',    // Muted gray
  textMuted: 'rgba(255,255,255,0.35)', // Very subtle labels
  success: '#4ade80',          // Prayer completed, garden healthy
  successMuted: 'rgba(74,222,128,0.15)',
  warning: '#fb923c',          // Streaks, fire
  coin: '#fbbf24',             // Coin-related
  coinMuted: 'rgba(251,191,36,0.12)',
  danger: '#ef4444',           // Missed prayers, destructive
  dangerMuted: 'rgba(239,68,68,0.12)',
  purple: '#a78bfa',           // Rest mode
  purpleMuted: 'rgba(167,139,250,0.12)',
  divider: 'rgba(255,255,255,0.06)', // Barely visible separators
  tabInactive: 'rgba(156,163,175,0.5)',
};

const COMPLETED_PRAYERS_KEY = '@GrowPray:completedPrayers';
const STREAKS_KEY = '@GrowPray:streaks'; // Per-prayer streaks
const XP_KEY = '@GrowPray:xp';
const COINS_KEY = '@GrowPray:coins';

const REST_PERIOD_KEY = '@GrowPray:restPeriod';
const PRAYER_HISTORY_KEY = '@GrowPray:prayerHistory';
const PRAYER_TIMING_LOG_KEY = '@GrowPray:prayerTimingLog';

// Per-prayer streak type
type PrayerStreaks = Record<string, number>;
const DEFAULT_STREAKS: PrayerStreaks = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };

// XP rewards
const XP_ON_TIME = 5;      // XP for completing during active window
const JUMMAH_XP_BONUS = 3; // Extra XP per prayer on Fridays (Jummah blessing)

// Coin rewards
const COINS_PER_PRAYER = 2;          // Base coins per prayer
const COINS_ALL_FIVE_BONUS = 10;     // Bonus for completing all 5 in a day
const COINS_7DAY_MILESTONE = 50;     // Bonus at 7-day streak
const COINS_30DAY_MILESTONE = 200;   // Bonus at 30-day streak
const COINS_100DAY_MILESTONE = 500;  // Bonus at 100-day streak

// Prayer icons - pixel art assets
const PRAYER_ICONS = {
  Fajr: require('./assets/Garden Assets/Icons/Fajr.png'),
  Dhuhr: require('./assets/Garden Assets/Icons/Dhuhr.png'),
  Asr: require('./assets/Garden Assets/Icons/Asr.png'),
  Maghrib: require('./assets/Garden Assets/Icons/Maghrib.png'),
  Isha: require('./assets/Garden Assets/Icons/Isha.png'),
};

// XP Badge pixel art
const XP_BADGE = require('./assets/Garden Assets/Effects/xp_badge.png');

// Axe icon
const AXE_ICON = require('./assets/Garden Assets/Icons/Axe.png');

// Prayer order for calculating windows
const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

// Rest Period types
type RestPeriodData = {
  startDate: string;  // ISO date string
  endDate: string;    // ISO date string
  frozenStreak: number;
} | null;

// Rest Period Hook
function useRestPeriod() {
  const [restPeriod, setRestPeriod] = useState<RestPeriodData>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load rest period on mount
  useEffect(() => {
    loadRestPeriod();
  }, []);

  // Check if rest period has expired
  useEffect(() => {
    if (restPeriod) {
      const endDate = new Date(restPeriod.endDate);
      const now = new Date();
      if (now >= endDate) {
        // Rest period has ended
        endRestPeriod();
      }
    }
  }, [restPeriod]);

  const loadRestPeriod = async () => {
    try {
      const stored = await AsyncStorage.getItem(REST_PERIOD_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const endDate = new Date(data.endDate);
        const now = new Date();
        
        if (now < endDate) {
          // Rest period is still active
          setRestPeriod(data);
        } else {
          // Rest period has expired, clear it
          await AsyncStorage.removeItem(REST_PERIOD_KEY);
          setRestPeriod(null);
        }
      }
    } catch (error) {
      console.error('Error loading rest period:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startRestPeriod = async (days: number, currentStreaks: PrayerStreaks) => {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);
      
      const data: RestPeriodData = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        frozenStreak: Math.max(...Object.values(currentStreaks)),
      };
      
      await AsyncStorage.setItem(REST_PERIOD_KEY, JSON.stringify(data));
      setRestPeriod(data);
      
      // Trigger haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error starting rest period:', error);
    }
  };

  const endRestPeriod = async () => {
    try {
      await AsyncStorage.removeItem(REST_PERIOD_KEY);
      setRestPeriod(null);
    } catch (error) {
      console.error('Error ending rest period:', error);
    }
  };

  const getDaysRemaining = (): number => {
    if (!restPeriod) return 0;
    const endDate = new Date(restPeriod.endDate);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const isResting = restPeriod !== null;

  return {
    isResting,
    restPeriod,
    isLoading,
    startRestPeriod,
    endRestPeriod,
    getDaysRemaining,
  };
}

// Rest Period Selection Modal
function RestPeriodModal({ 
  visible, 
  onClose, 
  onConfirm,
  currentStreak,
}: { 
  visible: boolean; 
  onClose: () => void;
  onConfirm: (days: number) => void;
  currentStreak: number;
}) {
  const [selectedDays, setSelectedDays] = useState(5);
  const dayOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{
          backgroundColor: THEME.bg,
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 320,
        }}>
          {/* Header */}
          <Text style={{
            fontSize: 20,
            fontWeight: '700',
            color: THEME.text,
            textAlign: 'center',
            marginBottom: 8,
            fontFamily: FONTS.display,
          }}>
            Set Rest Period
          </Text>
          
          <Text style={{
            fontSize: 14,
            color: '#9ca3af',
            textAlign: 'center',
            marginBottom: 20,
          }}>
            Your streaks will be frozen during this time
          </Text>

          {/* Day selector */}
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 24,
          }}>
            {dayOptions.map((days) => (
              <TouchableOpacity
                key={days}
                onPress={() => setSelectedDays(days)}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  backgroundColor: selectedDays === days 
                    ? 'rgba(232, 168, 124, 0.3)' 
                    : 'rgba(255, 255, 255, 0.04)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: selectedDays === days ? 2 : 0,
                  borderColor: selectedDays === days 
                    ? THEME.accent 
                    : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: selectedDays === days ? '#fff' : '#9ca3af',
                }}>
                  {days}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{
            fontSize: 14,
            color: THEME.accent,
            textAlign: 'center',
            marginBottom: 20,
          }}>
            {selectedDays} {selectedDays === 1 ? 'day' : 'days'} selected
          </Text>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
              }}
            >
              <Text style={{
                color: THEME.textSecondary,
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onConfirm(selectedDays);
                onClose();
              }}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: THEME.accent,
              }}
            >
              <Text style={{
                color: '#000',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}>
                Start Rest
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Rest Overlay - Shows when in rest mode (non-blocking bottom banner)
function RestOverlay({ 
  daysRemaining, 
  onEndRest 
}: { 
  daysRemaining: number; 
  onEndRest: () => void;
}) {
  return (
    <View style={{
      position: 'absolute',
      bottom: 70,
      left: 0,
      right: 0,
      zIndex: 50,
      pointerEvents: 'box-none',
      alignItems: 'center',
    }}>
      <View style={{
        backgroundColor: 'rgba(20, 28, 50, 0.97)',
        borderColor: 'rgba(147, 165, 220, 0.25)',
        borderWidth: 1,
        marginHorizontal: 24,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '85%',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Image source={ICON_MOON} style={{ width: 18, height: 18 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: THEME.text, fontWeight: '700', fontSize: 14 }}>Resting</Text>
            <Text style={{ color: 'rgba(232,224,214,0.55)', fontSize: 11, marginTop: 2 }}>
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining · streak frozen
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onEndRest}
          style={{
            backgroundColor: 'rgba(255,255,255,0.07)',
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 10,
            marginLeft: 12,
          }}
        >
          <Text style={{ color: 'rgba(232,224,214,0.7)', fontSize: 13, fontWeight: '600' }}>End Early</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Top Info Bar - clean minimal: stats row + next prayer line
// SVG-based countdown ring - reliable strokeDashoffset approach
function PremiumCountdownRing({ progress, size, strokeWidth, isComplete }: {
  progress: number;
  size: number;
  strokeWidth: number;
  isComplete: boolean;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  // Smoothly animate progress
  const animProgress = useRef(new Animated.Value(0)).current;
  const prevProgressRef = useRef(0);

  // Completion pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const wasComplete = useRef(false);

  useEffect(() => {
    const prev = prevProgressRef.current;
    prevProgressRef.current = progress;

    if (prev > 0.9 && progress < 0.1) {
      Animated.parallel([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 300, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 0.6, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
        animProgress.setValue(0);
        Animated.timing(animProgress, {
          toValue: progress,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      });
    } else {
      Animated.timing(animProgress, {
        toValue: progress,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [progress]);

  useEffect(() => {
    if (isComplete && !wasComplete.current) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 350, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.5, duration: 350, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
    wasComplete.current = isComplete;
  }, [isComplete]);

  const [displayProgress, setDisplayProgress] = useState(progress);
  useEffect(() => {
    const id = animProgress.addListener(({ value }) => setDisplayProgress(value));
    return () => animProgress.removeListener(id);
  }, []);

  const p = Math.min(Math.max(displayProgress, 0), 1);
  const offset = circumference * (1 - p);

  const activeColor = isComplete ? '#4ade80' : '#e8a87c';
  const brightColor = isComplete ? '#86efac' : '#fbbf24';

  return (
    <View style={{ width: size + 16, height: size + 16, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer glow layers */}
      <Animated.View style={{
        position: 'absolute',
        width: size + 12,
        height: size + 12,
        borderRadius: (size + 12) / 2,
        backgroundColor: activeColor,
        opacity: Animated.add(pulseOpacity, p > 0.01 ? 0.06 : 0),
        transform: [{ scale: pulseAnim }],
      }} />
      <Animated.View style={{
        position: 'absolute',
        width: size + 6,
        height: size + 6,
        borderRadius: (size + 6) / 2,
        backgroundColor: activeColor,
        opacity: p > 0.01 ? 0.08 : 0,
        transform: [{ scale: pulseAnim }],
      }} />

      {/* SVG ring */}
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={brightColor} />
            <Stop offset="1" stopColor={activeColor} />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}


// Subtle ambient floating particles for the sky area
const PARTICLE_COUNT = 14;
const PARTICLE_SEED = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: ((i * 47 + 13) % 97) / 100,
  y: ((i * 31 + 7) % 85) / 100,
  size: 1.2 + (i % 4) * 0.4,
  dur: 8000 + (i * 1337) % 6000,
  delay: (i * 571) % 3000,
  drift: 10 + (i % 3) * 8,
  opacity: 0.06 + (i % 5) * 0.025,
}));

const AmbientParticle = React.memo(function AmbientParticle({ p, screenW, screenH }: {
  p: typeof PARTICLE_SEED[0]; screenW: number; screenH: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: p.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true, delay: p.delay }),
      Animated.timing(anim, { toValue: 0, duration: p.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute',
      left: p.x * screenW,
      top: p.y * screenH * 0.5,
      width: p.size,
      height: p.size,
      borderRadius: p.size / 2,
      backgroundColor: '#c4d4f0',
      opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [p.opacity * 0.3, p.opacity, p.opacity * 0.3] }),
      transform: [
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -p.drift] }) },
        { translateX: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.drift * 0.3, 0] }) },
      ],
    }} />
  );
});

const AmbientParticles = React.memo(function AmbientParticles() {
  const { width: sw, height: sh } = Dimensions.get('window');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PARTICLE_SEED.map((p, i) => (
        <AmbientParticle key={i} p={p} screenW={sw} screenH={sh} />
      ))}
    </View>
  );
});

function TopInfoBar({ 
  streaks, 
  coins,
  xp, 
  nextPrayer, 
  nextPrayerTime,
  timeUntilNext,
  ringProgress,
  freezeCount,
  consistencyMultiplier,
  onMultiplierPress,
  activeBoostIcon,
  activeBoostName,
  activeBoostColor,
  boostTimeRemaining,
  onOpenSettings,
  onOpenQibla,
  userName,
}: {
  streaks: PrayerStreaks;
  coins: number;
  xp: number;
  nextPrayer: string | null;
  nextPrayerTime: string | null;
  timeUntilNext: string;
  ringProgress: number;
  freezeCount: number;
  consistencyMultiplier: number;
  onMultiplierPress: () => void;
  activeBoostIcon?: string;
  activeBoostName?: string;
  activeBoostColor?: string;
  boostTimeRemaining?: string;
  onOpenSettings: () => void;
  onOpenQibla: () => void;
  userName?: string | null;
}) {
  const bestStreak = Math.max(...Object.values(streaks));
  const combinedMultiplier = consistencyMultiplier;

  return (
    <View style={{ paddingTop: 6 }}>

      {/* Settings gear - top-right corner overlay */}
      <TouchableOpacity
        onPress={onOpenSettings}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          position: 'absolute',
          top: 6,
          right: 16,
          zIndex: 10,
          alignItems: 'center',
        }}
      >
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}>
          <MaterialCommunityIcons name="cog" size={18} color="rgba(232,224,214,0.55)" />
        </View>
        <Text style={{ fontSize: 8, fontWeight: '500', color: 'rgba(232,224,214,0.35)', letterSpacing: 0.5, marginTop: 2 }}>SETTINGS</Text>
      </TouchableOpacity>

      {/* Qibla compass - top-left corner overlay */}
      <TouchableOpacity
        onPress={onOpenQibla}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          position: 'absolute',
          top: 6,
          left: 16,
          zIndex: 10,
          alignItems: 'center',
        }}
      >
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}>
          <MaterialCommunityIcons name="compass-outline" size={18} color="rgba(232,224,214,0.55)" />
        </View>
        <Text style={{ fontSize: 8, fontWeight: '500', color: 'rgba(232,224,214,0.35)', letterSpacing: 0.5, marginTop: 2 }}>QIBLA</Text>
      </TouchableOpacity>

      {/* ── Top-edge stats row ── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingHorizontal: 20,
        paddingVertical: 6,
      }}>
        {/* Streak */}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Image source={ICON_FIRE} style={{ width: 13, height: 13 }} resizeMode="contain" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: bestStreak > 0 ? THEME.warning : THEME.textSecondary }}>
              {bestStreak}
            </Text>
          </View>
          <Text style={{ fontSize: 8, fontWeight: '500', color: 'rgba(232,224,214,0.35)', letterSpacing: 0.5, textAlign: 'center', width: '100%' }}>STREAK</Text>
        </View>

        {/* Coins */}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Image source={ICON_COIN} style={{ width: 13, height: 13 }} resizeMode="contain" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: THEME.coin }}>
              {coins}
            </Text>
          </View>
          <Text style={{ fontSize: 8, fontWeight: '500', color: 'rgba(232,224,214,0.35)', letterSpacing: 0.5, textAlign: 'center', width: '100%' }}>COINS</Text>
        </View>

        {/* XP */}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Image source={ICON_XP} style={{ width: 13, height: 13 }} resizeMode="contain" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: THEME.success }}>
              {xp}
            </Text>
          </View>
          <Text style={{ fontSize: 8, fontWeight: '500', color: 'rgba(232,224,214,0.35)', letterSpacing: 0.5, textAlign: 'center', width: '100%' }}>XP</Text>
        </View>

        {/* Multiplier */}
        <TouchableOpacity onPress={onMultiplierPress} activeOpacity={0.7} style={{ alignItems: 'center', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Image source={ICON_LIGHTNING} style={{ width: 13, height: 13 }} resizeMode="contain" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: combinedMultiplier > 1 ? THEME.coin : THEME.textSecondary }}>
              {combinedMultiplier}×
            </Text>
          </View>
          <Text style={{ fontSize: 8, fontWeight: '500', color: 'rgba(232,224,214,0.35)', letterSpacing: 0.5, textAlign: 'center', width: '100%' }}>BONUS</Text>
        </TouchableOpacity>

        {/* Freeze (only if > 0) */}
        {freezeCount > 0 && (
          <View style={{ alignItems: 'center', gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Image source={SINGLE_FREEZE_ICON} style={{ width: 13, height: 13 }} resizeMode="contain" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: THEME.purple }}>
                {freezeCount}
              </Text>
            </View>
            <Text style={{ fontSize: 8, fontWeight: '500', color: 'rgba(232,224,214,0.35)', letterSpacing: 0.5, textAlign: 'center', width: '100%' }}>FREEZE</Text>
          </View>
        )}
      </View>

      {/* Banners */}
      <View style={{ alignItems: 'center' }}>
        {/* Active Boost banner - tinted/bordered/glowing in the boost's rarity colour */}
        {activeBoostName && boostTimeRemaining && (() => {
          const bc = activeBoostColor || '#a855f7';
          return (
          <View style={{
            backgroundColor: bc + '26',
            borderColor: bc + '66',
            borderWidth: 1,
            borderRadius: 10,
            paddingVertical: 5,
            paddingHorizontal: 11,
            marginBottom: 6,
            marginTop: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            shadowColor: bc,
            shadowOpacity: 0.35,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 1 },
            elevation: 3,
          }}>
            <Text style={{ fontSize: 11 }}>{activeBoostIcon}</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: bc }}>
              {activeBoostName}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(232,224,214,0.7)' }}>
              · {boostTimeRemaining}
            </Text>
          </View>
          );
        })()}
      </View>

      {/* ── Greeting ──
          Onboarding asks for a name; before this it was stored and never shown
          again, which reads as collecting it for its own sake. Kept deliberately
          quiet (low opacity, small) so the countdown below stays the focal
          element, and omitted entirely when no name was given. */}
      {userName ? (
        <View style={{ alignItems: 'center', marginTop: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: 'rgba(232,224,214,0.62)',
              fontFamily: FONTS.display,
              maxWidth: '80%',
            }}
          >
            Assalamu alaikum, {userName}
          </Text>
        </View>
      ) : null}

      {/* ── Context label - subtle next prayer indicator with time ── */}
      <View style={{ alignItems: 'center' }}>
        {nextPrayer ? (
          <View style={{ alignItems: 'center', marginBottom: 10, marginTop: 6 }}>
            <Text style={{
              fontSize: 11,
              fontWeight: '500',
              color: 'rgba(232,224,214,0.5)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              Next: {nextPrayer}{nextPrayerTime ? ` · ${formatTime12h(nextPrayerTime)}` : ''}
            </Text>
          </View>
        ) : (
          <View style={{ height: 10, marginBottom: 10, marginTop: 6 }} />
        )}

        {/* ── Moonlight glow behind timer ── */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {/* Outer soft glow */}
          <View pointerEvents="none" style={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: 'rgba(140,170,220,0.04)',
          }} />
          {/* Inner brighter glow */}
          <View pointerEvents="none" style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(160,190,240,0.06)',
          }} />

          {/* ── Countdown Circle - sole focal element ── */}
          <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
            <PremiumCountdownRing
              progress={ringProgress}
              size={80}
              strokeWidth={3.5}
              isComplete={!nextPrayer}
            />
            {/* Center text */}
            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '800',
                color: THEME.text,
                letterSpacing: -0.5,
                fontFamily: FONTS.display,
              }}>
                {nextPrayer ? timeUntilNext : ''}
              </Text>
              {!nextPrayer ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
                  <Image source={ICON_MOON} style={{ width: 22, height: 22 }} resizeMode="contain" />
                  <Text style={{ fontSize: 8, fontWeight: '600', color: THEME.textSecondary, marginTop: 2, letterSpacing: 0.5 }}>Resting</Text>
                </View>
              ) : (
                <Text style={{
                  fontSize: 9,
                  fontWeight: '500',
                  color: THEME.textSecondary,
                  marginTop: 1,
                }}>
                  {`until ${nextPrayer}`}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// Gentle breathing glow for the active (next) prayer button
const BreathingGlow = React.memo(function BreathingGlow({ color, size }: { color: string; size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: color,
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
    }} />
  );
});

// Floating Prayer Bar - Bottom overlay with prayer icons
// Format 24h "HH:MM" to compact 12h string like "5:30am"
function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}${period}`;
}

function FloatingPrayerBar({
  timings,
  nextPrayer,
  completedPrayers,
  onTogglePrayer,
  getPrayerWindowStatus,
  streaks,
  debugPrayersUnlocked = false,
}: {
  timings: Record<string, string> | null;
  nextPrayer: string | null;
  completedPrayers: Set<string>;
  onTogglePrayer: (prayer: string) => void;
  getPrayerWindowStatus: (prayer: string) => 'active' | 'missed' | 'upcoming';
  streaks: PrayerStreaks;
  debugPrayersUnlocked?: boolean;
}) {
  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  const getPrayerStatus = (prayer: string): 'completed' | 'active' | 'missed' | 'upcoming' => {
    if (completedPrayers.has(prayer)) return 'completed';
    return getPrayerWindowStatus(prayer);
  };

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 4, paddingTop: 6 }}>
      {/* Liquid glass container */}
      <BlurView intensity={40} tint="dark" style={{
        borderRadius: 22,
        overflow: 'hidden',
      }}>
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
          }}
        >
          <View style={{
            paddingTop: 12,
            paddingBottom: 10,
            paddingHorizontal: 8,
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'flex-start',
          }}>
            {prayers.map((prayer) => {
              const status = getPrayerStatus(prayer);
              const isCompleted = status === 'completed';
              const isActive = status === 'active';
              const isMissed = status === 'missed';
              const canTap = debugPrayersUnlocked || isActive || isCompleted;

              let ringColor = 'rgba(255,255,255,0.08)';
              if (isCompleted) ringColor = THEME.success;
              else if (isActive) ringColor = THEME.accent;
              else if (isMissed) ringColor = 'rgba(239, 68, 68, 0.5)';

              let textColor = 'rgba(255,255,255,0.4)';
              if (isCompleted) textColor = THEME.success;
              else if (isActive) textColor = '#fff';
              else if (isMissed) textColor = THEME.danger;

              return (
                <View key={prayer} style={{ alignItems: 'center', flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => onTogglePrayer(prayer)}
                    disabled={!canTap}
                    activeOpacity={canTap ? 0.7 : 1}
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      borderWidth: 2,
                      borderColor: ringColor,
                      backgroundColor: isActive ? 'rgba(232,168,124,0.08)' : 'transparent',
                    }}
                  >
                    {isActive && <BreathingGlow color={THEME.accent} size={50} />}
                    <Image
                      source={PRAYER_ICONS[prayer as keyof typeof PRAYER_ICONS]}
                      style={{ width: 46, height: 46, borderRadius: 23 }}
                      resizeMode="cover"
                    />
                    {isCompleted && (
                      <View style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        backgroundColor: THEME.success,
                        borderRadius: 8,
                        width: 16,
                        height: 16,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1.5,
                        borderColor: 'rgba(15,21,38,0.8)',
                      }}>
                        <MaterialCommunityIcons name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>

                  <Text style={{
                    marginTop: 5,
                    fontSize: 9,
                    fontWeight: isActive ? '800' : '600',
                    color: textColor,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {prayer}
                  </Text>

                  {timings && timings[prayer] && (
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: isCompleted ? 'rgba(74,222,128,0.7)' : isActive ? 'rgba(232,168,124,0.9)' : 'rgba(255,255,255,0.3)',
                      marginTop: 2,
                    }}>
                      {formatTime12h(timings[prayer])}
                    </Text>
                  )}

                  {(streaks[prayer] || 0) > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                      <MaterialCommunityIcons name="fire" size={10} color={THEME.warning} />
                      <Text style={{ fontSize: 9, fontWeight: '700', color: THEME.warning }}>
                        {streaks[prayer]}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </LinearGradient>
      </BlurView>
    </View>
  );
}

// Bottom Tab Bar - Liquid glass navigation
function BottomTabBar({
  activeTab,
  onTabChange,
  challengeClaimable,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  challengeClaimable: number;
}) {
  const tabs = [
    { key: 'garden', icon: 'tree' as const, label: 'Garden', badge: 0 },
    { key: 'challenges', icon: 'trophy' as const, label: 'Challenges', badge: challengeClaimable },
    { key: 'shop', icon: 'store' as const, label: 'Shop', badge: 0 },
    { key: 'history', icon: 'calendar-month' as const, label: 'History', badge: 0 },
    { key: 'dhikr', icon: 'star-crescent' as const, label: 'Dhikr', badge: 0 },
  ];

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 4, paddingTop: 2 }}>
      <BlurView intensity={35} tint="dark" style={{
        borderRadius: 20,
        overflow: 'hidden',
      }}>
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: 'row',
            paddingTop: 10,
            paddingBottom: 8,
            paddingHorizontal: 4,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => onTabChange(tab.key)}
                activeOpacity={isActive ? 1 : 0.7}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 4,
                }}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: isActive ? 'rgba(232,168,124,0.15)' : 'transparent',
                }}>
                  <MaterialCommunityIcons
                    name={tab.icon}
                    size={22}
                    color={isActive ? THEME.accent : 'rgba(255,255,255,0.4)'}
                  />
                  {!!(tab.badge > 0) && (
                    <View style={{
                      position: 'absolute',
                      top: 2,
                      right: 0,
                      backgroundColor: THEME.danger,
                      borderRadius: 6,
                      minWidth: 12,
                      height: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 2,
                    }}>
                      <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>
                        {tab.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{
                  fontSize: 10,
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? THEME.accent : 'rgba(255,255,255,0.35)',
                  marginTop: 2,
                }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </LinearGradient>
      </BlurView>
    </View>
  );
}

// ─── Unified Reward Toast ──────────────────────────────────────────────────────
// Single notification combining XP + coins with clear visual hierarchy.
// One sound, one haptic, one animation - no sensory overload.
function RewardToast({ xp, baseXp, multiplier, coins, visible, onComplete }: {
  xp: number;
  baseXp: number;
  multiplier: number;
  coins: number;
  visible: boolean;
  onComplete: () => void;
}) {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(20))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  useEffect(() => {
    if (visible) {
      // Single haptic + sound for the whole reward
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      playSound();

      fadeAnim.setValue(0);
      translateY.setValue(20);
      scaleAnim.setValue(0.8);

      Animated.parallel([
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Slide up into place
        Animated.spring(translateY, {
          toValue: 0,
          tension: 200,
          friction: 18,
          useNativeDriver: true,
        }),
        // Gentle scale
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 200,
          friction: 18,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hold, then fade out
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 400,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: -12,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start(onComplete);
        }, 1200);
      });
    }
  }, [visible]);

  const playSound = async () => {
    try {
      if (_rewardSound) {
        await _rewardSound.setPositionAsync(0);
        _rewardSound.playAsync().catch(() => {});
      }
    } catch (_) { /* silent fail */ }
  };

  if (!visible) return null;

  const hasMultiplier = multiplier > 1;

  return (
    <View style={{
      position: 'absolute',
      top: '36%',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY }, { scale: scaleAnim }],
        backgroundColor: 'rgba(15, 20, 35, 0.85)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        minWidth: 120,
      }}>
        {/* XP - hero element */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Image
            source={XP_BADGE}
            style={{ width: 20, height: 20 }}
            resizeMode="contain"
          />
          <Text style={{
            fontSize: 20,
            fontWeight: '800',
            color: '#10b981',
            letterSpacing: 0.3,
          }}>
            +{xp} XP
          </Text>
        </View>

        {/* Multiplier breakdown - secondary, only if active */}
        {hasMultiplier && (
          <Text style={{
            fontSize: 10,
            fontWeight: '600',
            color: '#fbbf24',
            marginTop: 2,
            opacity: 0.9,
          }}>
            {baseXp} × {multiplier.toFixed(1)}
          </Text>
        )}

        {/* Thin divider */}
        <View style={{
          width: 40,
          height: 1,
          backgroundColor: 'rgba(232, 224, 214, 0.1)',
          marginVertical: 6,
        }} />

        {/* Coins - compact secondary line */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{
            fontSize: 13,
            fontWeight: '700',
            color: '#fbbf24',
          }}>
            +{coins}
          </Text>
          <Image source={ICON_COIN} style={{ width: 13, height: 13 }} resizeMode="contain" />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Streak Milestone Celebration Modal ────────────────────────────────────────
function MilestoneModal({ prayer, streak, bonus, visible, onClose }: {
  prayer: string;
  streak: number;
  bonus: number;
  visible: boolean;
  onClose: () => void;
}) {
  const scaleAnim = useState(new Animated.Value(0.3))[0];
  const rotateAnim = useState(new Animated.Value(0))[0];
  const glowPulse = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.3);
      rotateAnim.setValue(-0.1);
      glowPulse.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rotateAnim, { toValue: 0.08, duration: 80, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: -0.06, duration: 80, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: 0.03, duration: 60, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(glowPulse, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
          ])
        ),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const getTrophy = () => {
    if (streak >= 100) return ICON_CROWN;
    if (streak >= 30) return ICON_TROPHY;
    return ICON_STAR;
  };

  const getTitle = () => {
    if (streak >= 100) return '100 Day Streak!';
    if (streak >= 30) return '30 Day Streak!';
    return '7 Day Streak!';
  };

  const getColor = () => {
    if (streak >= 100) return '#f59e0b';
    if (streak >= 30) return '#fbbf24';
    return '#10b981';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
      }}>
        <Animated.View style={{
          transform: [
            { scale: scaleAnim },
            { rotate: rotateAnim.interpolate({
              inputRange: [-1, 1],
              outputRange: ['-1rad', '1rad'],
            }) },
          ],
          alignItems: 'center',
          backgroundColor: THEME.bg,
          borderRadius: 28,
          padding: 32,
          width: '100%',
          maxWidth: 320,
        }}>
          {/* Glow behind trophy */}
          <Animated.View style={{
            position: 'absolute',
            top: 30,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: getColor(),
            opacity: glowPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.05, 0.2],
            }),
          }} />

          <Image source={getTrophy()} style={{ width: 56, height: 56, marginBottom: 8 }} resizeMode="contain" />
          <Text style={{
            fontSize: 24,
            fontWeight: '900',
            color: getColor(),
            letterSpacing: 2,
            marginBottom: 4,
          }}>
            {getTitle()}
          </Text>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#e5e7eb',
            marginBottom: 2,
          }}>
            {prayer} - {streak} Day Streak
          </Text>
          <Text style={{
            fontSize: 14,
            color: '#9ca3af',
            marginBottom: 20,
            textAlign: 'center',
          }}>
            Keep it up - your garden is thriving.
          </Text>

          {bonus > 0 && (
            <View style={{
              backgroundColor: 'rgba(251, 191, 36, 0.15)',
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 20,
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '800',
                color: '#fbbf24',
                textAlign: 'center',
              }}>
                +{bonus} Coins Bonus!
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: getColor(),
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 40,
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              color: '#000',
              fontSize: 16,
              fontWeight: '800',
            }}>
              Continue
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Main Prayer State Management Hook
function usePrayerState(coinMultiplier: number = 1, xpMultiplier: number = 1, boostXpMultiplier: number = 1, boostCoinBonus: number = 0, prayerConfig?: PrayerTimesConfig) {
  const { timings, deadlines, nextPrayer, loading, detectedMethodKey, upcoming } = usePrayerTimes(prayerConfig);
  const [completedPrayers, setCompletedPrayers] = useState<Set<string>>(new Set());
  const [streaks, setStreaks] = useState<PrayerStreaks>({ ...DEFAULT_STREAKS });
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  // Prayer history log: { "2026-02-17": ["Fajr", "Dhuhr", ...], ... }
  const [prayerHistory, setPrayerHistory] = useState<Record<string, string[]>>({});

  const [timeUntilNext, setTimeUntilNext] = useState('--:--');
  const [ringProgress, setRingProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [rewardPopup, setRewardPopup] = useState<{ visible: boolean; xp: number; baseXp: number; multiplier: number; coins: number }>({ visible: false, xp: 0, baseXp: 0, multiplier: 1, coins: 0 });
  const [milestonePopup, setMilestonePopup] = useState<{ visible: boolean; prayer: string; streak: number; bonus: number }>({ visible: false, prayer: '', streak: 0, bonus: 0 });
  // Missed prayers pending freeze resolution (deferred streak reset)
  const [missedPrayers, setMissedPrayers] = useState<string[]>([]);
  const [stateLoaded, setStateLoaded] = useState(false);

  // Tracks the calendar-date string for which the Fajr reset has already been done.
  // Populated from AsyncStorage on load so app restarts after Fajr don't re-wipe prayers.
  const fajrResetDoneRef = useRef<string | null>(null);
  // Tracks the last location key so we can detect city changes and clear stale prayer ticks.
  const prevCoordKeyRef = useRef<string | null>(null);

  // Update current time every minute for prayer window calculations
  useEffect(() => {
    loadState(); // Load saved state on mount
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate time until next prayer + ring progress (updates every second)
  useEffect(() => {
    if (!timings || !nextPrayer) {
      setTimeUntilNext('--:--');
      setRingProgress(0);
      return;
    }

    const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const prayerTimezone = prayerConfig?.manualCoords?.timezone;

    // Parse "HH:MM" → Date object for today (or adjusted day)
    const parseTime = (timeStr: string, refDate: Date): Date => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(refDate);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const updateCountdown = () => {
      const now = new Date();

      // Re-derive which prayer is next on every tick rather than trusting the
      // `nextPrayer` state, which only refreshes on the hook's 30s watcher.
      // Using the state meant that the instant a prayer's time arrived the
      // countdown was still targeting the prayer that had just started: it had
      // already passed, so the branch below pushed it to tomorrow and the display
      // flashed "23h 59m" until the state caught up seconds later.
      const activeNext = nextPrayerFrom(timings, now, prayerTimezone) || nextPrayer;

      // ── Next prayer time ──
      const nextTimeStr = timings[activeNext];
      if (!nextTimeStr) return;
      let nextTime = parseTime(nextTimeStr, now);
      // If the next prayer's time reads earlier than now it belongs to tomorrow
      // (Fajr after Isha). With activeNext derived above this is now only ever
      // true for a genuine wrap past midnight, not for a stale target.
      if (nextTime <= now) {
        nextTime.setDate(nextTime.getDate() + 1);
      }

      // ── Previous prayer time ──
      const nextIdx = PRAYER_ORDER.indexOf(activeNext);
      const prevIdx = nextIdx > 0 ? nextIdx - 1 : PRAYER_ORDER.length - 1;
      const prevPrayer = PRAYER_ORDER[prevIdx];
      const prevTimeStr = timings[prevPrayer];
      let prevTime = prevTimeStr ? parseTime(prevTimeStr, now) : new Date(now);
      // Previous prayer should be before now
      if (prevTime > now) {
        prevTime.setDate(prevTime.getDate() - 1);
      }

      // ── Ring progress: (now - prev) / (next - prev) ──
      const totalSpan = nextTime.getTime() - prevTime.getTime();
      const elapsed = now.getTime() - prevTime.getTime();
      const progress = totalSpan > 0 ? Math.min(Math.max(elapsed / totalSpan, 0), 1) : 0;
      setRingProgress(progress);

      // ── Countdown text ──
      const diff = nextTime.getTime() - now.getTime();
      const diffHours = Math.floor(diff / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const diffSeconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (diffHours > 0) {
        setTimeUntilNext(`${diffHours}h ${diffMinutes}m`);
      } else if (diffMinutes > 0) {
        setTimeUntilNext(`${diffMinutes}m ${diffSeconds}s`);
      } else {
        setTimeUntilNext(`${diffSeconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000); // Update every second
    return () => clearInterval(interval);
  }, [timings, nextPrayer, prayerConfig?.manualCoords?.timezone]);

  // ── Location-change guard ─────────────────────────────────────────────────────
  // When the user switches between cities (or clears manual override back to GPS)
  // the displayed prayer times change timezone context.  Any prayers ticked under
  // the old context are no longer meaningful, so we wipe today's completed set.
  useEffect(() => {
    if (!stateLoaded) return;
    const key = prayerConfig?.manualCoords
      ? `${prayerConfig.manualCoords.lat.toFixed(3)},${prayerConfig.manualCoords.lng.toFixed(3)}`
      : 'gps';
    if (prevCoordKeyRef.current === null) {
      // First call after hydration - just record, don't wipe.
      prevCoordKeyRef.current = key;
      return;
    }
    if (prevCoordKeyRef.current !== key) {
      prevCoordKeyRef.current = key;
      const today = new Date().toDateString();
      setCompletedPrayers(new Set());
      AsyncStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify({ date: today, prayers: [] }));
    }
  }, [prayerConfig?.manualCoords, stateLoaded]);

  // ── Live Fajr reset ──────────────────────────────────────────────────────────
  // When the app is running and Fajr time arrives, clear the previous day's
  // completed prayers. Gated on stateLoaded so we don't race with loadState.
  useEffect(() => {
    if (!timings?.Fajr || !stateLoaded) return;

    const today = new Date().toDateString();
    const [fajrH, fajrM] = timings.Fajr.split(':').map(Number);
    const fajrMinutes = fajrH * 60 + fajrM;
    const nowMinutes = getPrayerTzMinutes(new Date(), prayerConfig?.manualCoords?.timezone);

    if (nowMinutes >= fajrMinutes && fajrResetDoneRef.current !== today) {
      fajrResetDoneRef.current = today;
      setCompletedPrayers(new Set());
      AsyncStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify({ date: today, prayers: [] }));
      AsyncStorage.setItem('@GrowPray:fajrResetDate', today);
    }
  }, [timings?.Fajr, currentTime, stateLoaded]);

  const loadState = async () => {
    try {
      const today = new Date().toDateString();

      // Load completed prayers - keep yesterday's if we haven't crossed Fajr yet
      // (the live Fajr effect will clear them at the right time once timings load)
      const storedPrayers = await AsyncStorage.getItem(COMPLETED_PRAYERS_KEY);
      let savedPrayersData = null;
      if (storedPrayers) {
        savedPrayersData = JSON.parse(storedPrayers);
        const prevDay = new Date();
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayStr = prevDay.toDateString();
        if (savedPrayersData.date === today) {
          // Same calendar day - restore as-is
          setCompletedPrayers(new Set(savedPrayersData.prayers));
        } else if (savedPrayersData.date === prevDayStr) {
          // Yesterday's prayers: keep them visible until the live Fajr effect clears them
          setCompletedPrayers(new Set(savedPrayersData.prayers));
        } else {
          // Older than yesterday - clear immediately
          await AsyncStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify({ date: today, prayers: [] }));
        }
      }

      // Load per-prayer streaks
      const storedStreaks = await AsyncStorage.getItem(STREAKS_KEY);
      let currentStreaks: PrayerStreaks = { ...DEFAULT_STREAKS };
      if (storedStreaks) {
        const parsed = JSON.parse(storedStreaks);
        currentStreaks = { ...DEFAULT_STREAKS, ...parsed.counts };
      }

      // Check each prayer individually - detect missed prayers for freeze prompt
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      
      // Check if freeze resolution already happened today
      const storedFreezeResolved = await AsyncStorage.getItem('@GrowPray:freezeResolvedDate');
      const freezeAlreadyResolved = storedFreezeResolved === today;

      let detectedMissed: string[] = [];

      if (savedPrayersData && savedPrayersData.date === yesterdayStr) {
        const completedYesterday = new Set(savedPrayersData.prayers);
        const allPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        
        allPrayers.forEach(prayer => {
          if (!completedYesterday.has(prayer)) {
            detectedMissed.push(prayer);
          }
        });
      } else if (savedPrayersData && savedPrayersData.date < yesterdayStr) {
        // Data is older than yesterday - all streaks broken
        detectedMissed = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      }

      if (detectedMissed.length > 0 && !freezeAlreadyResolved) {
        // Defer streak reset - let the freeze prompt handle it
        setMissedPrayers(detectedMissed);
        // Keep current streaks intact until resolved
        setStreaks(currentStreaks);
      } else {
        // No missed prayers, or freeze already resolved today - streaks stay as-is
        // Save updated streaks
        await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify({
          counts: currentStreaks,
          lastDate: today,
        }));
        setStreaks(currentStreaks);
      }

      // Load XP
      const storedXp = await AsyncStorage.getItem(XP_KEY);
      if (storedXp) {
        setXp(JSON.parse(storedXp));
      }

      // Load coins
      const storedCoins = await AsyncStorage.getItem(COINS_KEY);
      if (storedCoins) {
        setCoins(JSON.parse(storedCoins));
      }

      // Load prayer history
      const storedHistory = await AsyncStorage.getItem(PRAYER_HISTORY_KEY);
      if (storedHistory) {
        setPrayerHistory(JSON.parse(storedHistory));
      }

      // Restore fajr reset ref so we don't double-reset if app is opened after Fajr
      const storedFajrReset = await AsyncStorage.getItem('@GrowPray:fajrResetDate');
      if (storedFajrReset) {
        fajrResetDoneRef.current = storedFajrReset;
      }

      setStateLoaded(true);
    } catch (error) {
      console.error('Error loading state:', error);
      setStateLoaded(true);
    }
  };

  // Resolve streak freeze: protectedPrayers keep their streaks, others reset to 0
  const resolveStreakFreeze = async (protectedPrayers: string[]) => {
    try {
      const today = new Date().toDateString();
      const protectedSet = new Set(protectedPrayers);
      const updatedStreaks = { ...streaks };

      missedPrayers.forEach(prayer => {
        if (!protectedSet.has(prayer)) {
          updatedStreaks[prayer] = 0;
        }
      });

      setStreaks(updatedStreaks);
      setMissedPrayers([]);

      // Save updated streaks
      await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify({
        counts: updatedStreaks,
        lastDate: today,
      }));

      // Mark freeze as resolved for today so it doesn't re-prompt
      await AsyncStorage.setItem('@GrowPray:freezeResolvedDate', today);
    } catch (error) {
      console.error('Error resolving streak freeze:', error);
    }
  };

  // Helper: Convert time string (HH:MM) to minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper: current minutes since midnight expressed in the prayer location's timezone.
  // For GPS mode (no stored timezone) this falls back to the device's local clock,
  // which is correct because the device IS at the prayer location.
  // For a manually-selected city this reads the clock in that city so comparisons
  // against prayer times (which are also formatted in that city's timezone) are valid.
  const getPrayerTzMinutes = (date: Date, timezone?: string): number => {
    if (timezone) {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
        }).formatToParts(date);
        const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
        const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
        return (h === 24 ? 0 : h) * 60 + m;
      } catch { /* fall through */ }
    }
    return date.getHours() * 60 + date.getMinutes();
  };

  // Get the Islamic deadline for a prayer using explicit Muwaqqit-derived deadlines
  // Fajr → Sunrise, Dhuhr → Asr (Mithl al-Awwal), Asr → Sunset, Maghrib → Isha (red twilight), Isha → next Fajr
  const getPrayerEndTime = (prayer: string): number => {
    if (!timings) return 0;
    
    // Use explicit deadlines from Muwaqqit if available
    if (deadlines && deadlines[prayer as keyof typeof deadlines]) {
      const deadlineStr = deadlines[prayer as keyof typeof deadlines];
      const deadlineMinutes = timeToMinutes(deadlineStr);
      
      // Isha crosses midnight - deadline (next Fajr) is on the next day
      if (prayer === 'Isha') {
        return 24 * 60 + deadlineMinutes;
      }
      
      return deadlineMinutes;
    }
    
    // Fallback: derive from timings if deadlines unavailable
    if (prayer === 'Fajr') {
      const sunrise = timings['Sunrise'];
      return sunrise ? timeToMinutes(sunrise) : timeToMinutes(timings.Dhuhr);
    }
    if (prayer === 'Isha') {
      return 24 * 60 + timeToMinutes(timings.Fajr);
    }
    const prayerIndex = PRAYER_ORDER.indexOf(prayer as typeof PRAYER_ORDER[number]);
    const nextPrayerName = PRAYER_ORDER[prayerIndex + 1];
    if (nextPrayerName && timings[nextPrayerName]) {
      return timeToMinutes(timings[nextPrayerName]);
    }
    return 24 * 60;
  };

  // Determine the status of a prayer's time window
  // Uses actual Islamic deadlines: Fajr→Sunrise, Dhuhr→Asr, Asr→Maghrib, Maghrib→Isha, Isha→Fajr
  const getPrayerWindowStatus = (prayer: string): 'active' | 'missed' | 'upcoming' => {
    if (!timings) return 'upcoming';

    // Get "current minutes since midnight" in the same timezone as the displayed
    // prayer times.  This prevents the device clock (UK) from being compared
    // against prayer times formatted in a different city's timezone (e.g. New York).
    const currentMinutes = getPrayerTzMinutes(currentTime, prayerConfig?.manualCoords?.timezone);

    const prayerStartMinutes = timeToMinutes(timings[prayer]);
    const prayerEndMinutes = getPrayerEndTime(prayer);
    
    // Handle Isha special case (crosses midnight)
    if (prayer === 'Isha') {
      const isAfterIsha = currentMinutes >= prayerStartMinutes;
      const isBeforeFajr = currentMinutes < timeToMinutes(timings.Fajr);
      
      if (isAfterIsha || isBeforeFajr) {
        return 'active'; // Isha is active from Isha start until next Fajr
      }
    }
    
    // Prayer hasn't started yet
    if (currentMinutes < prayerStartMinutes) {
      return 'upcoming';
    }
    
    // Prayer is currently active (within its Islamic deadline)
    if (currentMinutes >= prayerStartMinutes && currentMinutes < prayerEndMinutes) {
      return 'active';
    }
    
    // Prayer deadline has passed
    return 'missed';
  };

  // Check if user can complete a prayer (must be within active window)
  const canCompletePrayer = (prayer: string): boolean => {
    return getPrayerWindowStatus(prayer) === 'active';
  };

  // Classify a completion as 'onTime' or 'grace' based on how far into the prayer's
  // window we are (grace = final quarter). Forward-looking data only; no UI yet.
  const getPrayerTimingLabel = (prayer: string): 'onTime' | 'grace' => {
    if (!timings) return 'onTime';
    try {
      const currentMinutes = getPrayerTzMinutes(currentTime, prayerConfig?.manualCoords?.timezone);
      let start = timeToMinutes(timings[prayer]);
      let end = getPrayerEndTime(prayer);
      let now = currentMinutes;
      // Isha crosses midnight: normalise to a continuous scale.
      if (prayer === 'Isha') {
        if (now < start) now += 24 * 60; // after midnight, before Fajr
      }
      const span = end - start;
      if (span <= 0) return 'onTime';
      const elapsed = (now - start) / span;
      return elapsed >= 0.75 ? 'grace' : 'onTime';
    } catch {
      return 'onTime';
    }
  };

  const togglePrayerCompleted = async (prayer: string) => {
    if (!canCompletePrayer(prayer)) return;

    const newCompleted = new Set(completedPrayers);
    const wasCompleted = newCompleted.has(prayer);
    
    if (wasCompleted) {
      // Uncompleting a prayer - no streak penalty (just undo)
      newCompleted.delete(prayer);
    } else {
      // Completing a prayer
      newCompleted.add(prayer);
      
      // Award XP (flat rate - prayer is within its Islamic deadline)
      // Friday (Jummah) bonus: getDay() === 5 is Friday
      const isFriday = new Date().getDay() === 5;
      const baseXp = XP_ON_TIME + (isFriday ? JUMMAH_XP_BONUS : 0);
      const totalXpMultiplier = xpMultiplier * boostXpMultiplier;
      const xpEarned = Math.round(baseXp * totalXpMultiplier);
      const newXp = xp + xpEarned;
      setXp(newXp);
      
      // Persist XP
      await AsyncStorage.setItem(XP_KEY, JSON.stringify(newXp));
      
      // Increment this prayer's streak
      const newStreaks = { ...streaks, [prayer]: (streaks[prayer] || 0) + 1 };
      setStreaks(newStreaks);
      await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify({ 
        counts: newStreaks, 
        lastDate: new Date().toDateString() 
      }));

      // --- Coin earning (premium multiplier + boost bonus applied) ---
      let coinsEarned = COINS_PER_PRAYER * coinMultiplier + boostCoinBonus;

      // Check for all-5-prayers bonus
      if (newCompleted.size === 5) {
        coinsEarned += COINS_ALL_FIVE_BONUS;
      }

      // Check for streak milestones on this prayer
      const newPrayerStreak = newStreaks[prayer];
      if (newPrayerStreak === 7) coinsEarned += COINS_7DAY_MILESTONE;
      if (newPrayerStreak === 30) coinsEarned += COINS_30DAY_MILESTONE;
      if (newPrayerStreak === 100) coinsEarned += COINS_100DAY_MILESTONE;

      const newCoins = coins + coinsEarned;
      setCoins(newCoins);
      await AsyncStorage.setItem(COINS_KEY, JSON.stringify(newCoins));

      // Show unified reward toast (XP + coins together)
      setRewardPopup({ visible: true, xp: xpEarned, baseXp, multiplier: totalXpMultiplier, coins: coinsEarned });

      // Show streak milestone celebration for 7/30/100 day streaks
      if (newPrayerStreak === 7 || newPrayerStreak === 30 || newPrayerStreak === 100) {
        const milestoneBonus = newPrayerStreak === 7 ? COINS_7DAY_MILESTONE
          : newPrayerStreak === 30 ? COINS_30DAY_MILESTONE : COINS_100DAY_MILESTONE;
        setTimeout(() => {
          setMilestonePopup({ visible: true, prayer, streak: newPrayerStreak, bonus: milestoneBonus });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 1800);
      }
    }
    setCompletedPrayers(newCompleted);

    // Persist completed prayers
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify({
        date: today,
        prayers: Array.from(newCompleted),
      }));

      // Also persist to prayer history log (keyed by YYYY-MM-DD)
      const dateKey = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })();
      const updatedHistory = { ...prayerHistory, [dateKey]: Array.from(newCompleted) };
      setPrayerHistory(updatedHistory);
      await AsyncStorage.setItem(PRAYER_HISTORY_KEY, JSON.stringify(updatedHistory));

      // Forward-only on-time/grace log (separate key; never mutates prayerHistory).
      // Only record when newly completing this prayer.
      if (!wasCompleted) {
        try {
          const raw = await AsyncStorage.getItem(PRAYER_TIMING_LOG_KEY);
          const log: Record<string, Record<string, 'onTime' | 'grace'>> = raw ? JSON.parse(raw) : {};
          const day = log[dateKey] || {};
          day[prayer] = getPrayerTimingLabel(prayer);
          log[dateKey] = day;
          await AsyncStorage.setItem(PRAYER_TIMING_LOG_KEY, JSON.stringify(log));
        } catch {
          // Non-critical; ignore timing-log failures.
        }
      }
    } catch (error) {
      console.error('Error saving completed prayers:', error);
    }
  };

  // Hide reward popup
  const hideRewardPopup = () => {
    setRewardPopup({ visible: false, xp: 0, baseXp: 0, multiplier: 1, coins: 0 });
  };

  // Debug: same as togglePrayerCompleted but bypasses the active-window check
  const debugTogglePrayer = async (prayer: string) => {
    const newCompleted = new Set(completedPrayers);
    const wasCompleted = newCompleted.has(prayer);
    if (wasCompleted) {
      newCompleted.delete(prayer);
    } else {
      newCompleted.add(prayer);
      const isFridayDebug = new Date().getDay() === 5;
      const baseXp = XP_ON_TIME + (isFridayDebug ? JUMMAH_XP_BONUS : 0);
      const totalXpMultiplier = xpMultiplier * boostXpMultiplier;
      const xpEarned = Math.round(baseXp * totalXpMultiplier);
      const newXp = xp + xpEarned;
      setXp(newXp);
      await AsyncStorage.setItem(XP_KEY, JSON.stringify(newXp));
      const newStreaks = { ...streaks, [prayer]: (streaks[prayer] || 0) + 1 };
      setStreaks(newStreaks);
      await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify({ counts: newStreaks, lastDate: new Date().toDateString() }));
      let coinsEarned = COINS_PER_PRAYER * coinMultiplier + boostCoinBonus;
      if (newCompleted.size === 5) coinsEarned += COINS_ALL_FIVE_BONUS;
      const newCoins = coins + coinsEarned;
      setCoins(newCoins);
      await AsyncStorage.setItem(COINS_KEY, JSON.stringify(newCoins));
      setRewardPopup({ visible: true, xp: xpEarned, baseXp, multiplier: totalXpMultiplier, coins: coinsEarned });
    }
    setCompletedPrayers(newCompleted);
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify({ date: today, prayers: Array.from(newCompleted) }));
    } catch (e) {}
  };

  const hideMilestonePopup = () => {
    setMilestonePopup({ visible: false, prayer: '', streak: 0, bonus: 0 });
  };

  // Spend coins (deduct from balance)
  const spendCoins = async (amount: number) => {
    const newCoins = Math.max(0, coins - amount);
    setCoins(newCoins);
    await AsyncStorage.setItem(COINS_KEY, JSON.stringify(newCoins));
  };

  // Earn coins (add to balance)
  const earnCoins = async (amount: number, _reason?: string) => {
    const newCoins = coins + amount;
    setCoins(newCoins);
    await AsyncStorage.setItem(COINS_KEY, JSON.stringify(newCoins));
  };

  return {
    timings,
    deadlines,
    nextPrayer,
    loading,
    completedPrayers,
    streaks,
    xp,
    coins,
    rewardPopup,
    hideRewardPopup,
    milestonePopup,
    hideMilestonePopup,
    timeUntilNext,
    ringProgress,
    canCompletePrayer,
    togglePrayerCompleted,
    debugTogglePrayer,
    getPrayerWindowStatus,
    spendCoins,
    earnCoins,
    missedPrayers,
    stateLoaded,
    resolveStreakFreeze,
    prayerHistory,
    detectedMethodKey,
    upcoming,
    debugSimulateMissed: async (prayers: string[]) => {
      // Clear the freeze-resolved guard so the prompt can fire again
      await AsyncStorage.removeItem('@GrowPray:freezeResolvedDate');
      setMissedPrayers(prayers);
    },
  };
}

const ONBOARDING_KEY = '@GrowPray:onboardingComplete';
const TOOLTIP_KEY = '@GrowPray:tooltipShown'; // kept for AsyncStorage migration cleanup
const MADHAB_KEY = '@GrowPray:madhab';
const CALC_METHOD_KEY = '@GrowPray:calcMethod';
const MANUAL_CITY_KEY = '@GrowPray:manualCity';
const MANUAL_COORDS_KEY = '@GrowPray:manualCoords';
const PRAYER_OFFSETS_KEY = '@GrowPray:prayerOffsets'; // kept for migration only - no longer written

// ─── Preparing Screen ────────────────────────────────────────────────────────────
// Shows after onboarding while the garden renders in the background.
// Each step is tied to a REAL loading/rendering flag AND advances sequentially
// with a minimum visible time so the user can see each step complete.
// Does NOT dismiss until the garden is fully rendered on screen.
type LoadingProgress = {
  prayerData: boolean;     // AsyncStorage prayer state loaded
  gardenData: boolean;     // AsyncStorage garden state loaded
  gardenRendered: boolean; // GardenScene has laid out and painted
};

const PREPARING_STEPS: { label: string; key: keyof LoadingProgress }[] = [
  { label: 'Setting up your prayer times', key: 'prayerData' },
  { label: 'Restoring your garden', key: 'gardenData' },
  { label: 'Rendering your garden', key: 'gardenRendered' },
];

const MIN_STEP_MS = 600; // Minimum visible time per step so user can see progress

const PREPARING_ICON = require('./assets/Garden Assets/Icons/Icon_Seedling.png');

function PreparingScreen({ progress, onDone }: { progress: LoadingProgress; onDone: () => void }) {
  // How many steps have been visually checked off (advances sequentially)
  const [visibleChecked, setVisibleChecked] = useState(0);
  const checkAnims = useRef(PREPARING_STEPS.map(() => new Animated.Value(0))).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sequential step advancement: advance to the next step only when
  // (a) the previous step animation has had its minimum display time AND
  // (b) the current step's real loading flag is true.
  useEffect(() => {
    if (visibleChecked >= PREPARING_STEPS.length) return;
    const currentStep = PREPARING_STEPS[visibleChecked];
    if (!progress[currentStep.key]) return; // wait for real flag

    // Real flag is ready - wait minimum display time then check off
    stepTimerRef.current = setTimeout(() => {
      Animated.spring(checkAnims[visibleChecked], {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
      setVisibleChecked(prev => prev + 1);
    }, MIN_STEP_MS);

    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, [visibleChecked, progress]);

  // Update progress bar as steps are visually checked off
  useEffect(() => {
    Animated.timing(barWidth, {
      toValue: visibleChecked / PREPARING_STEPS.length,
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [visibleChecked]);

  // Dismiss only when ALL steps are visually checked AND all real flags are true
  useEffect(() => {
    const allStepsShown = visibleChecked >= PREPARING_STEPS.length;
    const allFlagsReady = PREPARING_STEPS.every(s => progress[s.key]);
    if (allStepsShown && allFlagsReady && !finished.current) {
      finished.current = true;
      setTimeout(() => {
        Animated.timing(fadeOut, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => onDone());
      }, 500);
    }
  }, [visibleChecked, progress]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 10002, opacity: fadeOut }]}>
      <LinearGradient colors={['#08111c', '#0d1b2d', '#132437']} style={StyleSheet.absoluteFillObject} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Image source={PREPARING_ICON} style={{ width: 48, height: 48, marginBottom: 24 }} resizeMode="contain" />
        <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
          Preparing your garden
        </Text>
        <Text style={{ color: 'rgba(247,241,232,0.6)', fontSize: 15, marginBottom: 32, textAlign: 'center' }}>
          Tailoring everything to your preferences…
        </Text>
        <View style={{ width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999, marginBottom: 32, overflow: 'hidden' }}>
          <Animated.View style={{
            height: '100%',
            borderRadius: 999,
            backgroundColor: '#d9a75f',
            width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }} />
        </View>
        <View style={{ width: '100%', gap: 18 }}>
          {PREPARING_STEPS.map((step, i) => {
            const scale = checkAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
            const checked = i < visibleChecked;
            return (
              <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Animated.View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: checked ? 'rgba(217,167,95,0.22)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1.5,
                  borderColor: checked ? '#d9a75f' : 'rgba(255,255,255,0.12)',
                  alignItems: 'center', justifyContent: 'center',
                  transform: [{ scale }],
                  opacity: checkAnims[i],
                }}>
                  {checked && <MaterialCommunityIcons name="check" size={16} color="#d9a75f" />}
                </Animated.View>
                <Text style={{
                  color: checked ? '#f4efe6' : 'rgba(247,241,232,0.4)',
                  fontSize: 16, fontWeight: '600', flex: 1,
                }}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Loading Overlay ─────────────────────────────────────────────────────────────
// ─── Loading Overlay ─────────────────────────────────────────────────────────────
// Sits on top of the entire app tree at zIndex 9999. Stays fully visible while
// assets, garden state, and prayer state are loading behind it. Once `ready`
// is true, fades out and unmounts so gestures are no longer blocked.
const LOADING_SCREEN_IMAGE = require('./assets/Garden Assets/Icons/Loading_Screen.png');

const MIN_SPLASH_MS = 2000; // Show loading screen for at least 2 seconds

function LoadingOverlay({ ready, onImageLoaded }: { ready: boolean; onImageLoaded: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(true);
  const mountTime = useRef(Date.now()).current;

  useEffect(() => {
    if (!ready) return;
    // Ensure the loading screen is visible for at least MIN_SPLASH_MS
    const elapsed = Date.now() - mountTime;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, remaining);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'box-none'}
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 9999,
          opacity,
          backgroundColor: THEME.bg,
        },
      ]}
    >
      <Image
        source={LOADING_SCREEN_IMAGE}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        onLoad={onImageLoaded}
      />
    </Animated.View>
  );
}

// ─── Plant Tree Modal (isolated to prevent parent re-renders from blocking scroll) ─
const PlantTreeModal = React.memo(function PlantTreeModal({
  plantTarget,
  onClose,
  onOpenShop,
  onPlant,
  treeInventory,
  getOwnedTreeTypes,
  plantModalScale,
  plantModalOpacity,
}: {
  plantTarget: { row: number; col: number } | null;
  onClose: () => void;
  onOpenShop: () => void;
  onPlant: (treeType: string) => void;
  treeInventory: Record<string, number>;
  getOwnedTreeTypes: () => string[];
  plantModalScale: Animated.Value;
  plantModalOpacity: Animated.Value;
}) {
  const [selectedTreeType, setSelectedTreeType] = useState<string>('Basic');

  // Keep latest refs so we read fresh data on open without re-rendering during scroll
  const inventoryRef = useRef(treeInventory);
  inventoryRef.current = treeInventory;
  const getOwnedRef = useRef(getOwnedTreeTypes);
  getOwnedRef.current = getOwnedTreeTypes;

  // Snapshot owned types when modal opens (not on every parent render)
  const [ownedTypes, setOwnedTypes] = useState<string[]>([]);
  const [snapshotInventory, setSnapshotInventory] = useState<Record<string, number>>({});

  useEffect(() => {
    if (plantTarget !== null) {
      setSelectedTreeType('Basic');
      setOwnedTypes(getOwnedRef.current());
      setSnapshotInventory(inventoryRef.current);
    }
  }, [plantTarget]);

  return (
    <Modal
      visible={plantTarget !== null}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop - sibling, not parent, so it can't steal ScrollView gestures */}
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </Pressable>

        {/* Content float - pointerEvents="box-none" lets taps outside pass to backdrop */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }} pointerEvents="box-none">
          <Animated.View style={{
            backgroundColor: THEME.bg,
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            width: '100%',
            maxWidth: 340,
            transform: [{ scale: plantModalScale }],
            opacity: plantModalOpacity,
          }}>
            <Image source={ICON_SEEDLING} style={{ width: 36, height: 36, marginBottom: 8 }} resizeMode="contain" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.accent, marginBottom: 8 }}>
              Plant a Tree
            </Text>
            <Text style={{ fontSize: 14, color: THEME.text, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              Choose a tree type and watch it grow as you pray.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              removeClippedSubviews
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4, marginBottom: 16 }}
            >
              {ownedTypes.map((typeId) => {
                const catalogItem = TREE_CATALOG.find(t => t.id === typeId);
                if (!catalogItem) return null;
                const isSelected = selectedTreeType === typeId;
                const count = typeId === 'Basic' ? Infinity : (snapshotInventory[typeId] || 0);
                return (
                  <TouchableOpacity
                    key={typeId}
                    onPress={() => setSelectedTreeType(typeId)}
                    style={{
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: isSelected ? THEME.accent : 'transparent',
                      backgroundColor: isSelected ? 'rgba(232, 168, 124, 0.15)' : 'rgba(255,255,255,0.04)',
                      minWidth: 72,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: THEME.text, fontWeight: '600' }}>{catalogItem.name.replace(' Tree', '')}</Text>
                    {count !== Infinity && (
                      <Text style={{ fontSize: 10, color: THEME.textSecondary, marginTop: 2 }}>x{count}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {ownedTypes.length <= 1 && (
              <TouchableOpacity onPress={onOpenShop} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: '#fbbf24', fontWeight: '600' }}>
                  Visit Shop for more tree types
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                onPress={onClose}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: THEME.textSecondary, fontSize: 14, fontWeight: '600' }}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onPlant(selectedTreeType)}
                style={{
                  flex: 1,
                  backgroundColor: '#22c55e',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Plant!</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}, (prev, next) => {
  // Only re-render when visibility changes (plantTarget null↔non-null)
  return (prev.plantTarget === null) === (next.plantTarget === null)
    && prev.plantTarget?.row === next.plantTarget?.row
    && prev.plantTarget?.col === next.plantTarget?.col;
});

// Render icons off-screen at their exact display sizes so iOS decodes bitmaps
// before the components that use them first appear.
const PRAYER_PRERENDER_SOURCES = [
  require('./assets/Garden Assets/Icons/Fajr.png'),
  require('./assets/Garden Assets/Icons/Dhuhr.png'),
  require('./assets/Garden Assets/Icons/Asr.png'),
  require('./assets/Garden Assets/Icons/Maghrib.png'),
  require('./assets/Garden Assets/Icons/Isha.png'),
];
function PrayerIconsPrerender() {
  return (
    <View style={{ position: 'absolute', top: -9999, left: 0 }} pointerEvents="none">
      {/* Prayer icons at exact FloatingPrayerBar size */}
      {PRAYER_PRERENDER_SOURCES.map((src, i) => (
        <Image key={i} source={src} style={{ width: 46, height: 46 }} resizeMode="cover" />
      ))}
      {/* Sparkle at both sizes used by PaywallModal (header: 40x40, welcome: 60x60) */}
      <Image source={require('./assets/Garden Assets/Icons/Icon_Sparkle.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
      <Image source={require('./assets/Garden Assets/Icons/Icon_Sparkle.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
      {/* RewardToast images - XP badge and coin icon at their exact display sizes */}
      <Image source={XP_BADGE} style={{ width: 20, height: 20 }} resizeMode="contain" />
      <Image source={ICON_COIN} style={{ width: 13, height: 13 }} resizeMode="contain" />
    </View>
  );
}

// Freezes children when hidden - prevents re-renders of invisible tab pages
// so the JS thread stays responsive on the active tab.  Images inside the
// frozen tree remain mounted (bitmaps stay decoded), but React skips the
// entire subtree reconciliation when visible === false.
function FreezeWhenHidden({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const ref = useRef<React.ReactNode>(children);
  if (visible) ref.current = children;
  return <>{ref.current}</>;
}

function AppInner() {
  // Load the Fraunces display font used for headings across the app.
  // Fonts load at runtime; we fold readiness into the existing startup gate
  // so headings never flash in the system font before swapping.
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Amiri_400Regular,
  });

  const [assetsProgress, setAssetsProgress] = useState({
    groundTiles: false,
    trees: false,
    uiAssets: false,
  });
  const isReady = fontsLoaded && assetsProgress.groundTiles && assetsProgress.trees && assetsProgress.uiAssets;
  // Tracks when the loading overlay has fully faded out - gates auto-showing prompts
  const [appFullyReady, setAppFullyReady] = useState(false);

  const appMountTime = useRef(Date.now());
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null); // null = loading
  const [showPreparing, setShowPreparing] = useState(false);
  const [gardenRendered, setGardenRendered] = useState(false);
  // Garden starts invisible when coming from onboarding; fades in after PreparingScreen
  const gardenRevealAnim = useRef(new Animated.Value(1)).current;
  const cameFromOnboarding = useRef(false);
  const [showRestModal, setShowRestModal] = useState(false);
  // showSettingsModal removed - Settings is now a full tab page
  const [showExpansionModal, setShowExpansionModal] = useState(false);
  const [expansionDismissed, setExpansionDismissed] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugPrayersUnlocked, setDebugPrayersUnlocked] = useState(false);
  const [showMultiplierModal, setShowMultiplierModal] = useState(false);
  const [showChallengesModal, setShowChallengesModal] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // showMoreMenu removed - replaced by dedicated Settings tab
  const [activeTab, setActiveTab] = useState<'garden' | 'shop' | 'challenges' | 'history' | 'settings' | 'dhikr'>('garden');
  // Track which tabs have been opened at least once - mount lazily, keep alive after
  const visitedTabs = useRef<Set<string>>(new Set()).current;
  if (activeTab !== 'garden') visitedTabs.add(activeTab);

  // Name captured during onboarding, shown as the garden greeting.
  // Re-read when onboarding finishes so it appears without an app restart.
  const [userName, setUserName] = useState<string | null>(null);
  useEffect(() => {
    if (showOnboarding !== false) return;
    AsyncStorage.getItem('@JannahGarden:userName')
      .then((v) => setUserName(v && v.trim() ? v.trim() : null))
      .catch(() => {});
  }, [showOnboarding]);

  // ── Prayer calculation settings ──────────────────────────────────────────
  const [madhab, setMadhab] = useState<Madhab>('standard');
  const [calcMethodKey, setCalcMethodKey] = useState<PrayerMethodKey | null>(null);
  const [manualCity, setManualCity] = useState('');
  const [manualCoords, setManualCoords] = useState<{ lat: number; lng: number; countryCode?: string; timezone?: string } | undefined>(undefined);

  // Load prayer settings from AsyncStorage
  useEffect(() => {
    (async () => {
      const [savedMadhab, savedMethod, savedCity, savedCoords] = await Promise.all([
        AsyncStorage.getItem(MADHAB_KEY),
        AsyncStorage.getItem(CALC_METHOD_KEY),
        AsyncStorage.getItem(MANUAL_CITY_KEY),
        AsyncStorage.getItem(MANUAL_COORDS_KEY),
      ]);
      if (savedMadhab === 'hanafi' || savedMadhab === 'standard') setMadhab(savedMadhab);
      if (savedMethod && savedMethod in PRAYER_METHODS) setCalcMethodKey(savedMethod as PrayerMethodKey);
      if (savedCity) setManualCity(savedCity);
      if (savedCoords) { try { setManualCoords(JSON.parse(savedCoords)); } catch {} }
    })();
  }, []);

  const handleManualCitySearch = useCallback(async (city: string): Promise<{ lat: number; lng: number; countryCode?: string; displayName: string }[]> => {
    try {
      const query = encodeURIComponent(city.trim());
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=jsonv2&limit=8&addressdetails=1&dedupe=1`,
        { headers: { 'User-Agent': 'GrowPray/1.0 (com.antigravity.growpray)', 'Accept-Language': 'en' } }
      );
      if (!response.ok) return [];
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) return [];

      // Prefer city/town/village results over administrative boundaries
      const SETTLEMENT_TYPES = new Set(['city', 'town', 'village', 'suburb', 'municipality', 'borough', 'hamlet']);
      const sorted = [...data].sort((a: any, b: any) =>
        (SETTLEMENT_TYPES.has(a.type) ? 0 : 1) - (SETTLEMENT_TYPES.has(b.type) ? 0 : 1)
      );

      // Deduplicate: drop results within ~11km of an already-seen result
      const seenCoords = new Set<string>();
      return sorted
        .map((item: any) => ({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          countryCode: item.address?.country_code?.toUpperCase() ?? undefined,
          displayName: item.display_name as string,
        }))
        .filter((item) => {
          const key = `${Math.round(item.lat * 10)}:${Math.round(item.lng * 10)}`;
          if (seenCoords.has(key)) return false;
          seenCoords.add(key);
          return true;
        })
        .slice(0, 5);
    } catch {
      return [];
    }
  }, []);

  const handleManualCitySelect = useCallback(async (result: { lat: number; lng: number; countryCode?: string; displayName: string }) => {
    // Fetch the IANA timezone for the selected coordinates so prayer times
    // are displayed in the city's local time, not the device's timezone.
    let timezone: string | undefined;
    try {
      const tzResp = await fetch(
        `https://timeapi.io/api/TimeZone/coordinate?latitude=${result.lat}&longitude=${result.lng}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (tzResp.ok) {
        const tzData = await tzResp.json();
        timezone = typeof tzData.timeZone === 'string' ? tzData.timeZone : undefined;
      }
    } catch { /* ignore - falls back to device timezone */ }

    const coords = { lat: result.lat, lng: result.lng, countryCode: result.countryCode, timezone };
    setManualCoords(coords);
    setManualCity(result.displayName);
    await Promise.all([
      AsyncStorage.setItem(MANUAL_CITY_KEY, result.displayName),
      AsyncStorage.setItem(MANUAL_COORDS_KEY, JSON.stringify(coords)),
    ]);
  }, []);

  const handleClearManualCity = useCallback(async () => {
    setManualCity('');
    setManualCoords(undefined);
    await Promise.all([
      AsyncStorage.removeItem(MANUAL_CITY_KEY),
      AsyncStorage.removeItem(MANUAL_COORDS_KEY),
    ]);
  }, []);

  const prayerConfig = useMemo<PrayerTimesConfig>(() => ({
    madhab,
    methodKey: calcMethodKey,
    manualCoords,
    locationReady: showOnboarding === false,
  }), [madhab, calcMethodKey, manualCoords, showOnboarding]);

  const handleSetMadhab = useCallback(async (m: Madhab) => {
    setMadhab(m);
    await AsyncStorage.setItem(MADHAB_KEY, m);
  }, []);

  const handleSetCalcMethod = useCallback(async (key: PrayerMethodKey | null) => {
    setCalcMethodKey(key);
    if (key) {
      await AsyncStorage.setItem(CALC_METHOD_KEY, key);
    } else {
      await AsyncStorage.removeItem(CALC_METHOD_KEY);
    }
  }, []);

  // Streak freeze inventory
  const [freezeCount, setFreezeCount] = useState(0);
  // Tile interaction modals
  const [skipTileTarget, setSkipTileTarget] = useState<{ row: number; col: number } | null>(null);
  const [plantTarget, setPlantTarget] = useState<{ row: number; col: number } | null>(null);
  const [choppingTrees, setChoppingTrees] = useState<Set<string>>(new Set());
  const [removeTreeTarget, setRemoveTreeTarget] = useState<{ row: number; col: number } | null>(null);
  // Garden "edit mode" - entered from a tree's Move action. All planted trees
  // jiggle and can be dragged immediately (no long-press), iOS home-screen style.
  const [editMode, setEditMode] = useState(false);
  // Temporary "just planted" spotlight so a freshly placed tree is easy to spot.
  // seq increments on every plant so re-planting the same tile re-triggers it.
  const [justPlantedTile, setJustPlantedTile] = useState<{ row: number; col: number; seq: number } | null>(null);
  const plantSeqRef = useRef(0);

  // Modal animations
  const plantModalScale = useRef(new Animated.Value(0.85)).current;
  const plantModalOpacity = useRef(new Animated.Value(0)).current;
  const skipModalScale = useRef(new Animated.Value(0.85)).current;
  const skipModalOpacity = useRef(new Animated.Value(0)).current;
  
  const premium = usePremium();
  const consistency = useConsistencyMultiplier();
  // Set to true when auto-consume fires so the consistency useEffect skips the reset
  const allFreezeUsedTodayRef = useRef(false);
  // XP multiplier from consistency
  const combinedXpMultiplier = consistency.multiplier;

  // Boosts - refs used internally by useBoosts, so we can pass initial values
  // and wire them to prayerState after it's created
  const boostCoinsRef = useRef(0);
  const boostSpendRef = useRef<(amount: number, reason: string) => void>(() => {});
  const boosts = useBoosts(boostCoinsRef.current, boostSpendRef.current);

  const prayerState = usePrayerState(
    premium.limits.coinMultiplier,
    combinedXpMultiplier,
    boosts.xpMultiplier,
    boosts.coinBonus,
    prayerConfig,
  );

  // Wire boost refs to prayerState (useBoosts reads these via ref on user action)
  boostCoinsRef.current = prayerState.coins;
  boostSpendRef.current = (amount: number, _reason: string) => prayerState.spendCoins(amount);
  const challengesHook = useChallenges();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'garden_limit' | 'premium_tree' | 'settings' | 'insights' | 'dhikr_library' | 'reflection_archive' | 'general'>('general');
  const [showDhikrNudge, setShowDhikrNudge] = useState(false);
  const [showQibla, setShowQibla] = useState(false);
  const [qiblaSeen, setQiblaSeen] = useState(true); // default true so the pulse never flashes before load

  // Load the one-time Qibla-seen flag (drives the attention pulse).
  useEffect(() => {
    AsyncStorage.getItem('@GrowPray:qiblaSeen').then((v) => {
      setQiblaSeen(v === 'true');
    }).catch(() => setQiblaSeen(true));
  }, []);

  const openQibla = useCallback(() => {
    setShowQibla(true);
    if (!qiblaSeen) {
      setQiblaSeen(true);
      AsyncStorage.setItem('@GrowPray:qiblaSeen', 'true').catch(() => {});
    }
  }, [qiblaSeen]);

  // ── First-run tutorial ──────────────────────────────────────────────────────
  const tutorial = useTutorial();
  // Use window metrics directly (not the hook) since AppInner renders the provider.
  const insets = initialWindowMetrics?.insets ?? { top: 44, bottom: 34, left: 0, right: 0 };
  const tutorialTriggeredRef = useRef(false);

  // Approximate screen rects for each tutorial target (robust, no deep refs).
  const rectForStep = useCallback((id: string): TutorialRect | null => {
    const { width: SW, height: SH } = Dimensions.get('window');
    const top = insets.top;
    const bottom = insets.bottom;
    switch (id) {
      case 'garden':
        return null; // centered caption
      case 'qibla':
        return { x: 8, y: top + 2, width: 48, height: 50 };
      case 'settings':
        return { x: SW - 66, y: top + 2, width: 56, height: 50 };
      case 'stats':
        return { x: SW * 0.16, y: top + 2, width: SW * 0.68, height: 46 };
      case 'prayerBar':
        return { x: 20, y: SH - bottom - 195, width: SW - 40, height: 98 };
      case 'tabs':
        return { x: 20, y: SH - bottom - 70, width: SW - 40, height: 56 };
      default:
        return null;
    }
  }, [insets.top, insets.bottom]);

  const tutorialRect = tutorial.active && tutorial.currentStep
    ? rectForStep(tutorial.currentStep.id)
    : null;

  // Start the tour once the garden is visible for a user who hasn't seen it.
  useEffect(() => {
    if (showOnboarding !== false) return;       // still onboarding/loading
    if (showPreparing) return;                   // wait for garden reveal
    if (!tutorial.completedLoaded) return;
    if (tutorialTriggeredRef.current) return;
    if (tutorial.hasCompleted()) return;
    tutorialTriggeredRef.current = true;
    const t = setTimeout(() => tutorial.start(), 650);
    return () => clearTimeout(t);
  }, [showOnboarding, showPreparing, tutorial.completedLoaded]);

  // Garden state hook - organic tile recovery based on XP
  // Free users capped at limits.maxGridSize; premium gets full MAX_GRID_SIZE
  const gardenState = useGardenState(prayerState.xp, prayerState.coins, (amount) => {
    prayerState.spendCoins(amount);
  }, premium.limits.maxGridSize);

  // Stable refs for callbacks that need latest state without re-creating closures
  const gardenStateRef = useRef(gardenState);
  gardenStateRef.current = gardenState;
  const earnCoinsRef = useRef(prayerState.earnCoins);
  earnCoinsRef.current = prayerState.earnCoins;

  // Clean up choppingTrees only after gardenData confirms the removal is committed.
  // This prevents the flash where choppingTrees loses a key before isDeadTreeRemoved
  // returns true, which would briefly re-show the static dead tree.
  useEffect(() => {
    if (choppingTrees.size === 0) return;
    setChoppingTrees(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const key of prev) {
        const [r, c] = key.split(',').map(Number);
        if (gardenState.isDeadTreeRemoved(r, c)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [gardenState.isDeadTreeRemoved]);

  // Mark app as fully ready once loading overlay has completely faded out
  useEffect(() => {
    if (!isReady || gardenState.loading || !prayerState.stateLoaded || appFullyReady) return;
    const elapsed = Date.now() - appMountTime.current;
    const delay = Math.max(0, MIN_SPLASH_MS - elapsed) + 400 + 300; // fade (400ms) + buffer (300ms)
    const t = setTimeout(() => setAppFullyReady(true), delay);
    return () => clearTimeout(t);
  }, [isReady, gardenState.loading, prayerState.stateLoaded, appFullyReady]);

  // Prompt user when garden is ready to expand (opt-in, with delay to prevent rapid re-triggering)
  // Guard against loading: never show while AsyncStorage load is in progress
  // If user dismissed the prompt, don't auto-show again until a new expansion tier is reached
  useEffect(() => {
    if (!appFullyReady || gardenState.loading || !gardenState.canExpand || showExpansionModal || expansionDismissed) return;
    const timer = setTimeout(() => {
      setShowExpansionModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 500);
    return () => clearTimeout(timer);
  }, [appFullyReady, gardenState.loading, gardenState.canExpand, showExpansionModal, expansionDismissed]);

  // Reset dismissal flag when a new expansion tier becomes available
  const lastDismissedSizeRef = useRef<number | null>(null);
  useEffect(() => {
    if (gardenState.canExpand && gardenState.pendingGridSize !== lastDismissedSizeRef.current) {
      setExpansionDismissed(false);
    }
  }, [gardenState.canExpand, gardenState.pendingGridSize]);

  // Clear tile transitions after animations complete (~2s max stagger + animation time)
  useEffect(() => {
    if (gardenState.pendingTransitions.length > 0) {
      const timer = setTimeout(() => gardenState.clearTransitions(), 2500);
      return () => clearTimeout(timer);
    }
  }, [gardenState.pendingTransitions]);

  // Show paywall when garden hits free user's grid limit - wait for loading screen to finish
  useEffect(() => {
    if (!appFullyReady) return;
    if (gardenState.gridLimitReached && !premium.isPremium) {
      setPaywallReason('garden_limit');
      setShowPaywall(true);
    }
  }, [appFullyReady, gardenState.gridLimitReached, premium.isPremium]);

  // Consistency multiplier: record perfect day when all 5 prayers are completed
  useEffect(() => {
    if (prayerState.completedPrayers.size === 5) {
      consistency.recordPerfectDay();
    }
  }, [prayerState.completedPrayers.size]);

  // Consistency multiplier: reset when prayers are missed (after freeze resolution)
  useEffect(() => {
    if (!prayerState.stateLoaded) return;
    if (prayerState.missedPrayers.length > 0) return; // wait until freeze resolution
    // All-prayer freeze protects the consistency multiplier - skip reset for this render
    if (allFreezeUsedTodayRef.current) {
      allFreezeUsedTodayRef.current = false;
      consistency.preservePerfectDays();
      return;
    }
    const anyBroken = Object.values(prayerState.streaks).some(s => s === 0);
    if (anyBroken && consistency.perfectDays > 0) {
      consistency.resetPerfectDays();
    }
  }, [prayerState.stateLoaded, prayerState.missedPrayers.length, prayerState.streaks]);

  // Animate plant modal on visibility change
  useEffect(() => {
    if (plantTarget !== null) {
      plantModalScale.setValue(0.85);
      plantModalOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(plantModalScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(plantModalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [plantTarget]);

  // Animate skip modal on visibility change
  useEffect(() => {
    if (skipTileTarget !== null) {
      skipModalScale.setValue(0.85);
      skipModalOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(skipModalScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(skipModalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [skipTileTarget]);

  // Handle tile tap (recovering tiles → show skip modal)
  const handleTilePress = useCallback((row: number, col: number, state: TileState) => {
    if (state === 'recovering') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => {
        setSkipTileTarget({ row, col });
      }, 75);
    }
  }, []);

  // Handle dead tree tap (on recovering tiles → start chopping animation)
  const handleDeadTreePress = useCallback((row: number, col: number) => {
    // Only allow one tree to be chopped at a time
    if (choppingTrees.size > 0) return;
    const key = `${row},${col}`;
    setChoppingTrees(prev => new Set(prev).add(key));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [choppingTrees]);

  // Called when chopping animation completes
  const handleChoppingComplete = useCallback(async (row: number, col: number) => {
    // Use refs to avoid re-creating this callback when gardenState/prayerState change
    const reward = await gardenStateRef.current.removeDeadTree(row, col);
    if (reward > 0) {
      earnCoinsRef.current(reward, 'dead_tree_removal');
    }
    // choppingTrees cleanup is handled by the useEffect watching gardenState.isDeadTreeRemoved,
    // which fires only after gardenData is committed - eliminating the race condition.
  }, []);

  // Handle recovered tile tap (where dead tree was removed → offer to plant)
  const handlePlantPress = useCallback((row: number, col: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setPlantTarget({ row, col });
    }, 75);
  }, []);

  // Handle planted tree tap → offer to remove
  const handlePlantedTreePress = useCallback((row: number, col: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setRemoveTreeTarget({ row, col });
    }, 75);
  }, []);

  // Handle hold-to-move drag drop → relocate/swap the planted tree.
  // Pickup + success/error haptics are fired inside GardenScene. Returns the
  // commit result so the caller can keep the lifted "ghost" on screen until the
  // move is actually persisted (the tree either lands on the new tile or snaps
  // back - it can never vanish). Uses the ref so the callback stays stable.
  const handleMoveTree = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number): Promise<boolean> => {
    return gardenStateRef.current.movePlantedTree(fromRow, fromCol, toRow, toCol);
  }, []);

  // Refs for stable callbacks (avoid re-creating on every state change)
  const plantTargetRef = useRef(plantTarget);
  plantTargetRef.current = plantTarget;
  const challengesRef = useRef(challengesHook);
  challengesRef.current = challengesHook;
  const prayerXpRef = useRef(prayerState.xp);
  prayerXpRef.current = prayerState.xp;

  // Handle plant confirmation from PlantTreeModal - stable callback via refs
  const handlePlantConfirm = useCallback(async (selectedTreeType: string) => {
    const target = plantTargetRef.current;
    if (target) {
      const canUse = await gardenStateRef.current.useTreeFromInventory(selectedTreeType);
      if (canUse) {
        const success = await gardenStateRef.current.plantTree(
          target.row, target.col, selectedTreeType, prayerXpRef.current
        );
        if (success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          challengesRef.current.recordTreePlanted();
          plantSeqRef.current += 1;
          setJustPlantedTile({ row: target.row, col: target.col, seq: plantSeqRef.current });
        }
      }
    }
    setPlantTarget(null);
  }, []);

  // Stable close handler
  const handlePlantClose = useCallback(() => setPlantTarget(null), []);

  // Handle opening shop from plant modal
  const handleOpenShopFromPlant = useCallback(() => {
    setPlantTarget(null);
    setActiveTab('shop');
  }, []);

  // Handle shop tree purchase
  const handlePurchaseTree = useCallback(async (treeId: string): Promise<boolean> => {
    const item = TREE_CATALOG.find(t => t.id === treeId);
    if (!item) return false;
    return gardenState.purchaseTree(treeId, item.price);
  }, [gardenState]);

  const [showFreezeProtectedBanner, setShowFreezeProtectedBanner] = useState<string | null>(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const [freezeAutoResolved, setFreezeAutoResolved] = useState(false);

  // Handle streak freeze purchase
  const handlePurchaseFreeze = useCallback(async (cost: number): Promise<boolean> => {
    if (prayerState.coins < cost) return false;
    prayerState.spendCoins(cost);
    const updated = freezeCount + 1;
    setFreezeCount(updated);
    try {
      await AsyncStorage.setItem('@GrowPray:freezeInventory', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save freeze inventory:', e);
    }
    return true;
  }, [prayerState, freezeCount]);

  // Handle IAP coin purchase - routes through RevenueCat / App Store.
  // `productId` is the App Store product identifier (e.g. growpray_coins_500);
  // `coinAmount` is the trusted amount from COIN_PACKAGES to credit on success.
  const handlePurchaseCoins = useCallback(async (productId: string, coinAmount: number): Promise<boolean> => {
    try {
      const purchased = await premium.purchaseCoins(productId);
      if (!purchased) return false; // cancelled or failed - credit nothing
      await prayerState.earnCoins(coinAmount, `iap_${productId}`);
      return true;
    } catch (e) {
      console.error('Failed to process coin purchase:', e);
      return false;
    }
  }, [premium, prayerState]);

  // ─── Challenges wrappers ──────────────────────────────────────────────────
  // Wrap prayer toggle to also track challenge progress
  const handleTogglePrayerWithChallenges = useCallback(async (prayer: string) => {
    const wasCompleted = prayerState.completedPrayers.has(prayer);
    const status = prayerState.getPrayerWindowStatus(prayer);
    const isOnTime = status === 'active';

    // Execute prayer toggle - bypass time-window if debug mode is on
    await (debugPrayersUnlocked ? prayerState.debugTogglePrayer(prayer) : prayerState.togglePrayerCompleted(prayer));

    // Distinct prayers completed today AFTER this toggle. `completedPrayers` in
    // this closure is the pre-toggle set, so add/subtract the one we just changed.
    // This drives the "all 5" challenge off real distinct prayers, not raw taps.
    const distinctCompletedToday = wasCompleted
      ? Math.max(0, prayerState.completedPrayers.size - 1)
      : prayerState.completedPrayers.size + 1;

    // Update challenges
    if (wasCompleted) {
      challengesHook.undoPrayerCompletion(prayer, isOnTime, distinctCompletedToday);
    } else {
      challengesHook.recordPrayerCompletion(prayer, isOnTime, distinctCompletedToday);
      // Gentle, dismissible nudge to continue with dhikr. Never blocks completion.
      setTimeout(() => setShowDhikrNudge(true), 1600);
    }
  }, [prayerState, challengesHook, debugPrayersUnlocked]);

  // Claim challenge reward → credit coins
  const handleClaimChallengeReward = useCallback(async (challengeId: ChallengeId) => {
    const reward = await challengesHook.claimReward(challengeId);
    if (reward > 0) {
      await prayerState.earnCoins(reward, `challenge_${challengeId}`);
    }
  }, [challengesHook, prayerState]);

  // Stable callbacks for modals (prevents re-renders via React.memo)
  // closeSettingsModal removed
  const closeChallengesModal = useCallback(() => setShowChallengesModal(false), []);
  const openPaywallFromSettings = useCallback(() => {
    setPaywallReason('general');
    setShowPaywall(true);
  }, []);
  const noopResetProgress = useCallback(() => {}, []);

  // When any fullscreen modal is open, freeze the garden to free the JS thread
  const isAnyModalOpen = showChallengesModal || showShopModal || showPaywall || showRestModal || showHistoryModal || activeTab !== 'garden';

  // Load freeze inventory from storage (migrates old { single, all } format to a single count)
  useEffect(() => {
    AsyncStorage.getItem('@GrowPray:freezeInventory').then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (typeof parsed === 'number') {
            setFreezeCount(parsed);
          } else if (typeof parsed === 'object' && parsed !== null) {
            // Migrate old { single, all } format
            setFreezeCount((parsed.single || 0) + (parsed.all || 0));
          }
        } catch (e) {
          console.error('Failed to load freeze inventory:', e);
        }
      }
    });
  }, []);

  // Auto-consume freeze when missed prayers detected - fires after loading screen is gone
  useEffect(() => {
    if (!appFullyReady || !prayerState.stateLoaded || freezeAutoResolved) return;
    if (prayerState.missedPrayers.length === 0) return;

    const protectable = prayerState.missedPrayers.filter(p => (prayerState.streaks[p] || 0) > 0);

    if (protectable.length === 0) {
      // Nothing worth protecting - resolve immediately with no freeze
      prayerState.resolveStreakFreeze([]);
      setFreezeAutoResolved(true);
      return;
    }

    if (freezeCount > 0) {
      // Consume one freeze and protect all missed prayers silently
      allFreezeUsedTodayRef.current = true;
      const updated = freezeCount - 1;
      setFreezeCount(updated);
      AsyncStorage.setItem('@GrowPray:freezeInventory', JSON.stringify(updated));
      prayerState.resolveStreakFreeze([...prayerState.missedPrayers]);
      setFreezeAutoResolved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowFreezeProtectedBanner('Your Streak Freeze protected your streaks.');
      bannerAnim.setValue(0);
      Animated.sequence([
        Animated.timing(bannerAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.delay(2800),
        Animated.timing(bannerAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(() => setShowFreezeProtectedBanner(null));
    } else {
      // No freezes - let streaks break silently
      prayerState.resolveStreakFreeze([]);
      setFreezeAutoResolved(true);
    }
  }, [appFullyReady, prayerState.stateLoaded, prayerState.missedPrayers, freezeCount, freezeAutoResolved]);

  useEffect(() => {
    AsyncStorage.getItem('@GrowPray:onboardingComplete').then((val) => {
      setShowOnboarding(val !== 'true');
    }).catch(() => setShowOnboarding(true));
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    cameFromOnboarding.current = true;
    // Persist completion against the key App.tsx reads on launch, so onboarding
    // doesn't re-appear on every cold start. (OnboardingScreen writes a legacy
    // key under a different namespace; this is the authoritative one.)
    AsyncStorage.setItem('@GrowPray:onboardingComplete', 'true').catch(() => {});
    // Hide the garden before it first renders - revealed after PreparingScreen
    gardenRevealAnim.setValue(0);
    setShowOnboarding(false);
    setShowPreparing(true);
  }, []);

  // ── Onboarding hand-off: plant the niyyah seed ─────────────────────────────
  // Onboarding writes a pending flag when the user "plants" their intention;
  // we consume it here through the REAL gardenState.plantTree path so the seed
  // exists as an actual sapling when the garden first paints. Tries the four
  // starting cardinal tiles (all recovered from day one) until one takes.
  const niyyahSeedConsumed = useRef(false);
  useEffect(() => {
    if (niyyahSeedConsumed.current) return;
    if (showOnboarding !== false || gardenState.loading) return;
    niyyahSeedConsumed.current = true;
    (async () => {
      try {
        const pending = await AsyncStorage.getItem('@GrowPray:niyyahSeedPending');
        if (pending !== '1') return;
        const c = Math.floor(MAX_GRID_SIZE / 2);
        const spots: [number, number][] = [[c, c + 1], [c + 1, c], [c, c - 1], [c - 1, c]];
        for (const [r, col] of spots) {
          // eslint-disable-next-line no-await-in-loop
          const ok = await gardenState.plantTree(r, col, 'Basic', prayerState.xp);
          if (ok) break;
        }
        await AsyncStorage.removeItem('@GrowPray:niyyahSeedPending');
      } catch {
        // Non-critical: the niyyah record itself is already saved.
      }
    })();
  }, [showOnboarding, gardenState.loading]);

  // ── Onboarding hand-off: mark the first prayer ─────────────────────────────
  // If the user answered "Yes, alhamdulillah" during onboarding, mark that
  // prayer through the real togglePrayerCompleted path (XP, coins, streaks,
  // reward toast) once prayer times have loaded. If the window closed in the
  // meantime (rare), drop the flag quietly - never fake a completion.
  const [pendingFirstPrayer, setPendingFirstPrayer] = useState<string | null>(null);
  useEffect(() => {
    if (showOnboarding !== false) return;
    AsyncStorage.getItem('@GrowPray:onboardingPrayerMarked')
      .then((v) => { if (v) setPendingFirstPrayer(v); })
      .catch(() => {});
  }, [showOnboarding]);
  useEffect(() => {
    if (!pendingFirstPrayer) return;
    if (!prayerState.stateLoaded || !prayerState.timings) return;
    const p = pendingFirstPrayer;
    setPendingFirstPrayer(null);
    AsyncStorage.removeItem('@GrowPray:onboardingPrayerMarked').catch(() => {});
    if (prayerState.completedPrayers.has(p)) return;
    if (!prayerState.canCompletePrayer(p)) return;
    prayerState.togglePrayerCompleted(p);
  }, [pendingFirstPrayer, prayerState.stateLoaded, prayerState.timings, prayerState.completedPrayers]);

  const handleGardenRenderReady = useCallback(() => {
    setGardenRendered(true);
  }, []);

  const handlePreparingDone = useCallback(() => {
    setShowPreparing(false);
    // Fade the garden in as the PreparingScreen fades out
    Animated.timing(gardenRevealAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);
  
  // Rest period management
  const { 
    isResting, 
    startRestPeriod, 
    endRestPeriod, 
    getDaysRemaining 
  } = useRestPeriod();
  
  // Initialize notifications with prayer timings and completed prayers
  // Pass isResting to disable notifications during rest
  const { 
    notificationsEnabled, 
    toggleNotifications,
    cancelPrayerNotification,
    sendTestNotifications,
    reflectionReminderEnabled,
    toggleReflectionReminder,
  } = useNotifications(
    isResting ? null : prayerState.timings,  // Don't schedule if resting
    prayerState.completedPrayers,
    isResting ? null : prayerState.deadlines,
    gardenState.lastXPGainTimestamp,
    gardenState.totalRecoveredTiles > 0,
    showOnboarding === false,
    isResting ? null : prayerState.upcoming,
  );

  // Pre-load the loading screen image first, then load everything else
  useEffect(() => {
    const loadAssets = async () => {
      try {
        // Pre-load the loading screen image so it's immediately available
        await Asset.loadAsync([LOADING_SCREEN_IMAGE]);

        // Batch 1: Ground tiles & decorations
        await Asset.loadAsync([
          require('./assets/Garden Assets/Ground Tiles/Dead_Tile.png'),
          require('./assets/Garden Assets/Ground Tiles/Recovering_Tile.png'),
          require('./assets/Garden Assets/Ground Tiles/Recovered_Tile.png'),
          require('./assets/Garden Assets/Ground Tiles/Dead_Grass_Tuft.png'),
          require('./assets/Garden Assets/Ground Tiles/Pebbles.png'),
          require('./assets/Garden Assets/Ground Tiles/Wildflowers.png'),
          require('./assets/Garden Assets/Ground Tiles/Grass_Blades.png'),
          require('./assets/Garden Assets/Ground Tiles/Mushrooms.png'),
          require('./assets/Garden Assets/Ground Tiles/Clovers.png'),
        ]);
        setAssetsProgress(p => ({ ...p, groundTiles: true }));

        // Batch 2: All tree sprites
        await Asset.loadAsync([
          require('./assets/Garden Assets/Tree Types/Basic Trees/Sapling_converted.png'),
          require('./assets/Garden Assets/Tree Types/Basic Trees/Growing_Tree_converted.png'),
          require('./assets/Garden Assets/Tree Types/Basic Trees/Grown_Tree_converted.png'),
          require('./assets/Garden Assets/Tree Types/Basic Trees/Flourishing_Tree_converted.png'),
          require('./assets/Garden Assets/Tree Types/Basic Trees/Dead_Tree.png'),
          require('./assets/Garden Assets/Tree Types/Palm Trees/Palm_Sapling.png'),
          require('./assets/Garden Assets/Tree Types/Palm Trees/Palm_Growing.png'),
          require('./assets/Garden Assets/Tree Types/Palm Trees/Palm_Grown.png'),
          require('./assets/Garden Assets/Tree Types/Palm Trees/Palm_Flourishing.png'),
          require('./assets/Garden Assets/Tree Types/Willow Trees/Willow_Sapling.png'),
          require('./assets/Garden Assets/Tree Types/Willow Trees/Willow_Growing.png'),
          require('./assets/Garden Assets/Tree Types/Willow Trees/Willow_Grown.png'),
          require('./assets/Garden Assets/Tree Types/Willow Trees/Willow_Flourishing.png'),
          require('./assets/Garden Assets/Tree Types/Oak Trees/Oak_Sapling.png'),
          require('./assets/Garden Assets/Tree Types/Oak Trees/Oak_Growing.png'),
          require('./assets/Garden Assets/Tree Types/Oak Trees/Oak_Grown.png'),
          require('./assets/Garden Assets/Tree Types/Oak Trees/Oak_Flourishing.png'),
          require('./assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Sapling.png'),
          require('./assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Growing.png'),
          require('./assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Grown.png'),
          require('./assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Flourishing.png'),
          require('./assets/Garden Assets/Tree Types/Maple Trees/Maple_Sapling.png'),
          require('./assets/Garden Assets/Tree Types/Maple Trees/Maple_Growing.png'),
          require('./assets/Garden Assets/Tree Types/Maple Trees/Maple_Grown.png'),
          require('./assets/Garden Assets/Tree Types/Maple Trees/Maple_Flourishing.png'),
          require('./assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Sapling.png'),
          require('./assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Growing.png'),
          require('./assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Grown.png'),
          require('./assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Flourishing.png'),
          require('./assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Sapling.png'),
          require('./assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Growing.png'),
          require('./assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Grown.png'),
          require('./assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Flourished.png'),
        ]);
        setAssetsProgress(p => ({ ...p, trees: true }));

        // Batch 3: Effects & UI icons
        await Asset.loadAsync([
          require('./assets/Garden Assets/Effects/Ember_Mote.png'),
          require('./assets/Garden Assets/Effects/Dew_Sparkle.png'),
          require('./assets/Garden Assets/Effects/Pollen_Mote.png'),
          require('./assets/Garden Assets/Effects/Falling_Leaf.png'),
          require('./assets/Garden Assets/Effects/Fruit_Common.png'),
          require('./assets/Garden Assets/Effects/Fruit_Premium.png'),
          require('./assets/Garden Assets/Effects/xp_badge.png'),
          require('./assets/Garden Assets/Icons/Axe.png'),
          require('./assets/Garden Assets/Icons/Fajr.png'),
          require('./assets/Garden Assets/Icons/Dhuhr.png'),
          require('./assets/Garden Assets/Icons/Asr.png'),
          require('./assets/Garden Assets/Icons/Maghrib.png'),
          require('./assets/Garden Assets/Icons/Isha.png'),
          require('./assets/Garden Assets/Icons/Icon_Coin.png'),
          require('./assets/Garden Assets/Icons/Icon_Handful.png'),
          require('./assets/Garden Assets/Icons/Icon_Pouch.png'),
          require('./assets/Garden Assets/Icons/Icon_Chest.png'),
          require('./assets/Garden Assets/Icons/Icon_Treasury.png'),
          require('./assets/Garden Assets/Icons/Streak_Freeze.png'),
          require('./assets/Garden Assets/Icons/5_Streak_Freeze.png'),
          require('./assets/Garden Assets/Icons/Icon_Fire.png'),
          require('./assets/Garden Assets/Icons/Icon_XP.png'),
          require('./assets/Garden Assets/Icons/Icon_Lightning.png'),
          require('./assets/Garden Assets/Icons/Icon_Seedling.png'),
          require('./assets/Garden Assets/Icons/Icon_Moon.png'),
          require('./assets/Garden Assets/Icons/Icon_Trophy.png'),
          require('./assets/Garden Assets/Icons/Icon_Crown.png'),
          require('./assets/Garden Assets/Icons/Icon_Star.png'),
          require('./assets/Garden Assets/Icons/Icon_Sparkle.png'),
          require('./assets/Garden Assets/Icons/Icon_Bell.png'),
          require('./assets/Garden Assets/Icons/Icon_Location.png'),
          require('./assets/Garden Assets/Icons/Icon_Tree.png'),
          require('./assets/Garden Assets/Icons/Icon_Warning.png'),
          require('./assets/Garden Assets/Icons/Icon_Hands.png'),
        ]);
        setAssetsProgress(p => ({ ...p, uiAssets: true }));
      } catch (error) {
        console.error('Error loading assets:', error);
        // Mark all done on error so app doesn't hang
        setAssetsProgress({ groundTiles: true, trees: true, uiAssets: true });
      }
    };

    loadAssets();
  }, []);

  // Day/night state - must be called unconditionally before any early return below,
  // otherwise hook order changes across renders (onboarding -> app) and React throws.
  const isDay = useIsDay(prayerState.timings?.Sunrise, prayerState.timings?.Sunset);

  // Show onboarding for first-time users
  if (showOnboarding === null) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.bg }}>
        <StatusBar style="light" />
        <LoadingOverlay
          ready={false}
          onImageLoaded={() => SplashScreen.hideAsync().catch(() => {})}
        />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <>
        <OnboardingScreen
            onComplete={handleOnboardingComplete}
            onMadhabChange={setMadhab}
            onPurchaseMonthly={premium.purchaseMonthly}
            onPurchaseYearly={premium.purchaseYearly}
            prices={premium.prices}
          />
        <PrayerIconsPrerender />
        <LoadingOverlay
          ready={isReady}
          onImageLoaded={() => SplashScreen.hideAsync().catch(() => {})}
        />
      </>
    );
  }

  // After onboarding: show "Preparing" overlay while data loads,
  // then cloud-reveal transition, then the bare garden.
  const appDataReady = isReady && !gardenState.loading && prayerState.stateLoaded;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <SkyBackground isDay={isDay}>
      <StatusBar style="light" />
      {/* Decode prayer icons off-screen before FloatingPrayerBar first mounts */}
      <PrayerIconsPrerender />
      
      {/* Content area - fills space above bottom bar */}
      <View style={{ flex: 1 }}>

      {/* Fullscreen Garden Scene - invisible until PreparingScreen fades out */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gardenRevealAnim }]} pointerEvents="box-none">
      <GardenScene
        xp={prayerState.xp}
        gridSize={gardenState.gridSize}
        getTileState={gardenState.getTileState}
        isDeadTreeRemoved={gardenState.isDeadTreeRemoved}
        getPlantedTree={gardenState.getPlantedTree}
        choppingTrees={choppingTrees}
        daysSinceLastXP={gardenState.daysSinceLastXP}
        pendingTransitions={gardenState.pendingTransitions}
        onTilePress={handleTilePress}
        onDeadTreePress={handleDeadTreePress}
        onPlantPress={handlePlantPress}
        onPlantedTreePress={handlePlantedTreePress}
        onMoveTree={handleMoveTree}
        editMode={editMode}
        onExitEditMode={() => setEditMode(false)}
        justPlantedTile={justPlantedTile}
        onChoppingComplete={handleChoppingComplete}
        frozen={isAnyModalOpen}
        onRenderReady={handleGardenRenderReady}
      />
      </Animated.View>
      
      {/* Subtle expand button - shown when expansion is available but was dismissed */}
      {gardenState.canExpand && !showExpansionModal && expansionDismissed && activeTab === 'garden' && (
        <TouchableOpacity
          onPress={() => {
            setShowExpansionModal(true);
            Haptics.selectionAsync();
          }}
          activeOpacity={0.7}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            borderRadius: 12,
            paddingVertical: 6,
            paddingHorizontal: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            zIndex: 50,
          }}
        >
          <Image source={ICON_SEEDLING} style={{ width: 12, height: 12 }} resizeMode="contain" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(34, 197, 94, 0.8)' }}>Expand</Text>
        </TouchableOpacity>
      )}

      {/* Edit-mode exit - prominent centered "Done" pill + hint. Wrapped in a
          full-width box so it reliably centers regardless of content layout. */}
      {editMode && activeTab === 'garden' && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 100,
          }}
        >
          <View style={{
            backgroundColor: 'rgba(15,21,38,0.9)',
            borderRadius: 10,
            paddingVertical: 5,
            paddingHorizontal: 12,
            marginBottom: 10,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(232,224,214,0.7)', letterSpacing: 0.3 }}>
              Drag trees to rearrange
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setEditMode(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: THEME.accent,
              borderRadius: 12,
              paddingVertical: 13,
              paddingHorizontal: 44,
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rest Overlay - Shows when in rest mode */}
      {isResting && (
        <RestOverlay 
          daysRemaining={getDaysRemaining()} 
          onEndRest={endRestPeriod} 
        />
      )}
      
      {/* Reward Toast - unified XP + coins notification */}
      <RewardToast
        xp={prayerState.rewardPopup.xp}
        baseXp={prayerState.rewardPopup.baseXp}
        multiplier={prayerState.rewardPopup.multiplier}
        coins={prayerState.rewardPopup.coins}
        visible={prayerState.rewardPopup.visible}
        onComplete={prayerState.hideRewardPopup}
      />

      {/* Streak Milestone Celebration */}
      <MilestoneModal
        prayer={prayerState.milestonePopup.prayer}
        streak={prayerState.milestonePopup.streak}
        bonus={prayerState.milestonePopup.bonus}
        visible={prayerState.milestonePopup.visible}
        onClose={prayerState.hideMilestonePopup}
      />
      
      {/* Rest Period Modal */}
      <RestPeriodModal
        visible={showRestModal}
        onClose={() => setShowRestModal(false)}
        onConfirm={(days) => startRestPeriod(days, prayerState.streaks)}
        currentStreak={Math.max(...Object.values(prayerState.streaks))}
      />
      
      {/* Settings Modal removed - rendered as a full tab below */}

      {/* Prayer History Modal */}
      <PrayerHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        streaks={prayerState.streaks}
        prayerHistory={prayerState.prayerHistory}
        completedToday={prayerState.completedPrayers}
      />
      
      {/* Garden Expansion Confirmation Modal */}
      <Modal
        visible={showExpansionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExpansionModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}>
          <View style={{
            backgroundColor: THEME.bg,
            borderRadius: 24,
            padding: 32,
            alignItems: 'center',
            width: '100%',
            maxWidth: 340,
          }}>
            <Image source={ICON_SEEDLING} style={{ width: 48, height: 48, marginBottom: 12 }} resizeMode="contain" />
            <Text style={{ fontSize: 22, fontWeight: '800', color: THEME.accent, marginBottom: 8 }}>
              Ready to Expand!
            </Text>
            <Text style={{ fontSize: 16, color: THEME.text, textAlign: 'center', marginBottom: 4 }}>
              Your garden can grow to
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: THEME.text, marginBottom: 16 }}>
              {gardenState.pendingGridSize} × {gardenState.pendingGridSize}
            </Text>
            <Text style={{ fontSize: 14, color: THEME.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              New dead tiles will appear at the edges. Keep praying to heal them!
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await gardenState.confirmExpansion();
                setShowExpansionModal(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
              style={{
                backgroundColor: '#22c55e',
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 14,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                Expand!
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowExpansionModal(false);
                setExpansionDismissed(true);
                lastDismissedSizeRef.current = gardenState.pendingGridSize;
              }}
              style={{
                paddingHorizontal: 24,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: '#6b7280', fontSize: 14, fontWeight: '600' }}>
                Not yet
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Skip Tile Recovery Modal - spend coins to instantly recover a tile */}
      <Modal
        visible={skipTileTarget !== null}
        transparent
        animationType="none"
        onRequestClose={() => setSkipTileTarget(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}>
          <Animated.View style={{
            backgroundColor: THEME.bg,
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            width: '100%',
            maxWidth: 320,
            transform: [{ scale: skipModalScale }],
            opacity: skipModalOpacity,
          }}>
            <Image source={ICON_SEEDLING} style={{ width: 36, height: 36, marginBottom: 8 }} resizeMode="contain" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.accent, marginBottom: 8 }}>
              Speed Up Recovery?
            </Text>
            <Text style={{ fontSize: 14, color: THEME.text, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              This tile is recovering. Spend coins to restore it instantly!
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Image source={ICON_COIN} style={{ width: 18, height: 18 }} resizeMode="contain" />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fbbf24' }}>
                {skipTileTarget ? gardenState.getSkipCost(skipTileTarget.row, skipTileTarget.col) : 0} coins
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 20 }}>
              <Text style={{ fontSize: 12, color: THEME.textSecondary }}>You have:</Text>
              <Image source={ICON_COIN} style={{ width: 11, height: 11 }} resizeMode="contain" />
              <Text style={{ fontSize: 12, color: THEME.textSecondary }}>{prayerState.coins}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setSkipTileTarget(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: THEME.textSecondary, fontSize: 14, fontWeight: '600' }}>Wait</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (skipTileTarget) {
                    const success = await gardenState.skipRecoveryWithCoins(skipTileTarget.row, skipTileTarget.col);
                    if (success) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  }
                  setSkipTileTarget(null);
                }}
                disabled={skipTileTarget ? prayerState.coins < gardenState.getSkipCost(skipTileTarget.row, skipTileTarget.col) : true}
                style={{
                  flex: 1,
                  backgroundColor: skipTileTarget && prayerState.coins >= gardenState.getSkipCost(skipTileTarget.row, skipTileTarget.col)
                    ? '#22c55e' : '#374151',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Restore!</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Plant Tree Modal - tap recovered tile (with dead tree removed) to plant */}
      <PlantTreeModal
        plantTarget={plantTarget}
        onClose={handlePlantClose}
        onOpenShop={handleOpenShopFromPlant}
        onPlant={handlePlantConfirm}
        treeInventory={gardenState.treeInventory}
        getOwnedTreeTypes={gardenState.getOwnedTreeTypes}
        plantModalScale={plantModalScale}
        plantModalOpacity={plantModalOpacity}
      />

      {/* Planted Tree Options Modal - Move (enter edit mode) / Remove / Cancel */}
      <Modal
        visible={removeTreeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveTreeTarget(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}>
          <View style={{
            backgroundColor: THEME.bg,
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            width: '100%',
            maxWidth: 300,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.text, marginBottom: 14 }}>
              Tree Options
            </Text>
            {/* Growth progress - shown when tree is not yet flourishing */}
            {(() => {
              const planted = removeTreeTarget ? gardenState.getPlantedTree(removeTreeTarget.row, removeTreeTarget.col) : null;
              if (!planted) return null;
              const treeXP = prayerState.xp - planted.plantedAtXP;
              const STAGES = [
                { label: 'Sapling', min: 0, next: 15 },
                { label: 'Growing', min: 15, next: 75 },
                { label: 'Grown', min: 75, next: 175 },
                { label: 'Flourishing', min: 175, next: null },
              ];
              const stageIdx = [...STAGES].reverse().findIndex(s => treeXP >= s.min);
              const current = STAGES[STAGES.length - 1 - stageIdx];
              const progress = current.next ? Math.min((treeXP - current.min) / (current.next - current.min), 1) : 1;
              const xpLeft = current.next ? current.next - treeXP : 0;
              return (
                <View style={{ width: '100%', marginBottom: 18 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: '600' }}>{current.label}</Text>
                    {current.next ? (
                      <Text style={{ fontSize: 11, color: 'rgba(232,224,214,0.4)' }}>{xpLeft} XP to {STAGES[STAGES.length - 1 - stageIdx + 1]?.label}</Text>
                    ) : (
                      <Text style={{ fontSize: 11, color: THEME.success }}>Fully grown</Text>
                    )}
                  </View>
                  <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    <View style={{ height: 4, width: `${progress * 100}%`, backgroundColor: current.next ? THEME.accent : THEME.success, borderRadius: 2 }} />
                  </View>
                </View>
              );
            })()}

            {/* Move tree - primary action (accent fill, dark label) */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setRemoveTreeTarget(null);
                setEditMode(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={{
                width: '100%',
                backgroundColor: THEME.accent,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={{ color: '#000', fontSize: 16, fontWeight: '600' }}>Move tree</Text>
            </TouchableOpacity>

            {/* Remove tree - muted destructive (soft danger fill, danger label) */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={async () => {
                if (removeTreeTarget) {
                  await gardenState.removePlantedTree(removeTreeTarget.row, removeTreeTarget.col);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                setRemoveTreeTarget(null);
              }}
              style={{
                width: '100%',
                backgroundColor: THEME.dangerMuted,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text style={{ color: THEME.danger, fontSize: 16, fontWeight: '600' }}>Remove tree</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: THEME.textMuted, textAlign: 'center', marginBottom: 14 }}>
              Removing won't refund the tree.
            </Text>

            {/* Cancel - subtle card fill */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setRemoveTreeTarget(null)}
              style={{
                width: '100%',
                backgroundColor: THEME.bgCard,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: THEME.textSecondary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Consistency Multiplier Detail Modal */}
      <Modal
        visible={showMultiplierModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMultiplierModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMultiplierModal(false)}>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={{
                backgroundColor: THEME.bg,
                borderRadius: 24,
                width: '100%',
                maxWidth: 360,
                padding: 24,
              }}>
                {/* Header */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <Image source={ICON_LIGHTNING} style={{ width: 32, height: 32, marginBottom: 8 }} resizeMode="contain" />
                  <Text style={{ color: THEME.text, fontSize: 20, fontWeight: '800' }}>
                    Consistency Multiplier
                  </Text>
                  <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
                    Complete all 5 prayers daily to build your multiplier. All XP earned is boosted!
                  </Text>
                </View>

                {/* Current status */}
                <View style={{
                  backgroundColor: 'rgba(251, 191, 36, 0.08)',
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <Text style={{ color: '#fbbf24', fontSize: 28, fontWeight: '800' }}>
                    {consistency.multiplier}× XP
                  </Text>
                  <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                    {consistency.perfectDays} perfect {consistency.perfectDays === 1 ? 'day' : 'days'} in a row
                  </Text>
                  {consistency.nextTier && (
                    <View style={{ width: '100%', marginTop: 10 }}>
                      <View style={{
                        height: 6,
                        backgroundColor: 'rgba(107, 114, 128, 0.3)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}>
                        <View style={{
                          height: '100%',
                          backgroundColor: '#fbbf24',
                          borderRadius: 3,
                          width: (() => {
                            const thresholds = [0, 7, 14, 30, 60];
                            const nextThreshold = consistency.perfectDays + consistency.nextTier.daysNeeded;
                            const currentThreshold = thresholds[thresholds.indexOf(nextThreshold) - 1] || 0;
                            const bandWidth = nextThreshold - currentThreshold;
                            const progress = consistency.perfectDays - currentThreshold;
                            return `${Math.min(100, (progress / bandWidth) * 100)}%`;
                          })(),
                        }} />
                      </View>
                      <Text style={{ color: '#d4a939', fontSize: 11, textAlign: 'center', marginTop: 6, fontWeight: '600' }}>
                        {consistency.nextTier.daysNeeded} more {consistency.nextTier.daysNeeded === 1 ? 'day' : 'days'} until {consistency.nextTier.nextMultiplier}×
                      </Text>
                    </View>
                  )}
                  {!consistency.nextTier && (
                    <Text style={{ color: '#4ade80', fontSize: 11, marginTop: 6, fontWeight: '600' }}>
                      Maximum tier reached!
                    </Text>
                  )}
                </View>

                {/* Tier ladder */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                    Tier Ladder
                  </Text>
                  {[
                    { days: 60, mult: '2.0×', label: '60+ days', color: '#f59e0b' },
                    { days: 30, mult: '1.75×', label: '30 days', color: '#fbbf24' },
                    { days: 14, mult: '1.5×', label: '14 days', color: '#d4a939' },
                    { days: 7, mult: '1.25×', label: '7 days', color: '#b8943a' },
                    { days: 0, mult: '1.0×', label: 'Start', color: '#6b7280' },
                  ].map((tier, i) => {
                    const isCurrentTier = consistency.perfectDays >= tier.days && 
                      (i === 0 || consistency.perfectDays < [60, 30, 14, 7, 0][i - 1]);
                    return (
                      <View key={tier.days} style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 7,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: isCurrentTier ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                        marginBottom: 3,
                      }}>
                        <View style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: consistency.perfectDays >= tier.days ? tier.color : 'rgba(107, 114, 128, 0.3)',
                          marginRight: 10,
                        }} />
                        <Text style={{
                          color: consistency.perfectDays >= tier.days ? tier.color : '#4a5568',
                          fontSize: 13,
                          fontWeight: isCurrentTier ? '700' : '500',
                          flex: 1,
                        }}>
                          {tier.mult}
                        </Text>
                        <Text style={{
                          color: consistency.perfectDays >= tier.days ? '#9ca3af' : '#4a5568',
                          fontSize: 11,
                        }}>
                          {tier.label}
                        </Text>
                        {isCurrentTier && (
                          <Text style={{ fontSize: 10, marginLeft: 6 }}>◀</Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* How it works */}
                <View style={{
                  backgroundColor: 'rgba(107, 114, 128, 0.1)',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                }}>
                  <Text style={{ color: '#9ca3af', fontSize: 11, lineHeight: 16 }}>
                    Missing any prayer resets your streak to 0.{'\n'}
                    Use streak freezes from the shop to protect your progress.
                  </Text>
                </View>

                {/* Close button */}
                <TouchableOpacity
                  onPress={() => setShowMultiplierModal(false)}
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.15)',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '700' }}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Shop Modal */}
      <ShopModal
        visible={showShopModal}
        onClose={() => setShowShopModal(false)}
        coins={prayerState.coins}
        inventory={gardenState.treeInventory}
        onPurchaseTree={handlePurchaseTree}
        isPremium={premium.isPremium}
        onPremiumTap={() => {
          setShowShopModal(false);
          setPaywallReason('premium_tree');
          setShowPaywall(true);
        }}
        freezeCount={freezeCount}
        onPurchaseFreeze={handlePurchaseFreeze}
        onPurchaseCoins={handlePurchaseCoins}
        boostInventory={boosts.inventory}
        activeBoost={boosts.activeBoost}
        boostTimeRemainingMs={boosts.timeRemainingMs}
        onPurchaseBoost={boosts.purchaseBoost}
        onActivateBoost={boosts.activateBoost}
      />

      {/* Challenges Modal */}
      <ChallengesModal
        visible={showChallengesModal}
        onClose={closeChallengesModal}
        challenges={challengesHook.challengesList}
        onClaimReward={handleClaimChallengeReward}
      />

      {/* Streak Protected Banner */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 100,
          left: 24,
          right: 24,
          zIndex: 1000,
          alignItems: 'center',
          opacity: bannerAnim,
          transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        }}
      >
        <View style={{
          backgroundColor: 'rgba(6, 24, 44, 0.97)',
          borderWidth: 1,
          borderColor: 'rgba(120, 210, 240, 0.45)',
          paddingHorizontal: 18,
          paddingVertical: 11,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
          <Image source={SINGLE_FREEZE_ICON} style={{ width: 18, height: 18 }} resizeMode="contain" />
          <Text style={{
            color: '#b8e0f5',
            fontSize: 14,
            fontWeight: '600',
            letterSpacing: 0.1,
          }}>
            {showFreezeProtectedBanner}
          </Text>
        </View>
      </Animated.View>

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseMonthly={premium.purchaseMonthly}
        onPurchaseYearly={premium.purchaseYearly}
        onRestore={premium.restorePurchases}
        triggerReason={paywallReason}
        prices={premium.prices}
      />

      {/* Qibla compass - full-screen surface; unmounts on close so the magnetometer stops */}
      <Modal
        visible={showQibla}
        animationType="slide"
        onRequestClose={() => setShowQibla(false)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#0f1526' }}>
          <QiblaScreen
            manualCoords={manualCoords ? { lat: manualCoords.lat, lng: manualCoords.lng } : null}
            active={showQibla}
            onClose={() => setShowQibla(false)}
          />
        </SafeAreaView>
      </Modal>

      {/* Post-prayer dhikr nudge - gentle, dismissible, never blocks completion */}
      <Modal
        visible={showDhikrNudge}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDhikrNudge(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 }}
          onPress={() => setShowDhikrNudge(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#0f1526',
              borderRadius: 22,
              paddingVertical: 26,
              paddingHorizontal: 24,
              alignItems: 'center',
              width: '100%',
              maxWidth: 320,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <View style={{
              width: 54, height: 54, borderRadius: 27,
              backgroundColor: 'rgba(232,168,124,0.14)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <MaterialCommunityIcons name="star-crescent" size={26} color="#e8a87c" />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display, textAlign: 'center', marginBottom: 6 }}>
              Continue with dhikr?
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(232,224,214,0.6)', textAlign: 'center', lineHeight: 19, marginBottom: 20 }}>
              Take a moment for the adhkar after your salah.
            </Text>
            <TouchableOpacity
              onPress={() => { setShowDhikrNudge(false); setActiveTab('dhikr'); }}
              activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#e8a87c', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, width: '100%', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1205' }}>Open Dhikr</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDhikrNudge(false)} activeOpacity={0.7} style={{ paddingVertical: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 13, color: 'rgba(232,224,214,0.5)', fontWeight: '600' }}>Not now</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Debug Modal - Decay Testing (dev only - never shipped in production) */}
      {__DEV__ && (
      <Modal
        visible={showDebugModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDebugModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}>
          <View style={{
            backgroundColor: THEME.bg,
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            width: '100%',
            maxWidth: 340,
          }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🐛</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#ff6b6b', marginBottom: 8 }}>
              Debug: Decay Testing
            </Text>
            <Text style={{ fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 20 }}>
              Simulate inactivity to test tile decay and tree withering
            </Text>

            <View style={{ width: '100%', gap: 12 }}>
              <TouchableOpacity
                onPress={async () => {
                  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
                  await gardenState.setLastXPTimestamp(threeDaysAgo);
                  setShowDebugModal(false);
                }}
                style={{
                  backgroundColor: '#4a5568',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>📅 Simulate 3 Days Inactive</Text>
                <Text style={{ color: '#cbd5e0', fontSize: 11, marginTop: 4 }}>Outer ring decayed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                  await gardenState.setLastXPTimestamp(sevenDaysAgo);
                  setShowDebugModal(false);
                }}
                style={{
                  backgroundColor: '#742a2a',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>☠️ Simulate 7 Days Inactive</Text>
                <Text style={{ color: '#feb2b2', fontSize: 11, marginTop: 4 }}>Full decay (only center cross remains)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await gardenState.updateLastXPTimestamp();
                  setShowDebugModal(false);
                }}
                style={{
                  backgroundColor: '#2d5a2d',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>✅ Reset to Now</Text>
                <Text style={{ color: '#a3e6a3', fontSize: 11, marginTop: 4 }}>Stop decay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await premium.togglePremiumDebug();
                  setShowDebugModal(false);
                }}
                style={{
                  backgroundColor: premium.isPremium ? '#742a2a' : '#7c5d24',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  {premium.isPremium ? '🔒 Remove Premium' : '👑 Grant Premium'}
                </Text>
                <Text style={{ color: premium.isPremium ? '#feb2b2' : '#fbbf24', fontSize: 11, marginTop: 4 }}>
                  Currently: {premium.isPremium ? 'PREMIUM' : 'FREE'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  // Cycle through multiplier tiers for testing
                  const tiers = [0, 7, 14, 30, 60];
                  const currentIdx = tiers.findIndex(t => consistency.perfectDays < (tiers[tiers.indexOf(t) + 1] || Infinity));
                  const nextIdx = (currentIdx + 1) % tiers.length;
                  consistency.debugSetPerfectDays(tiers[nextIdx]);
                }}
                style={{
                  backgroundColor: '#1a365d',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  ⚡ Set Multiplier ({consistency.multiplier}×)
                </Text>
                <Text style={{ color: '#90cdf4', fontSize: 11, marginTop: 4 }}>
                  Perfect days: {consistency.perfectDays} → Tap to cycle
                </Text>
              </TouchableOpacity>

              {/* ── Replay onboarding (dev only) ──────────────── */}
              <TouchableOpacity
                onPress={async () => {
                  await AsyncStorage.multiRemove([
                    '@GrowPray:onboardingComplete',
                    '@JannahGarden:onboardingComplete',
                    '@JannahGarden:userName',
                  ]);
                  setShowDebugModal(false);
                  setShowOnboarding(true);
                }}
                style={{
                  backgroundColor: '#3b2f1a',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '600' }}>
                  🌱 Replay Onboarding
                </Text>
                <Text style={{ color: 'rgba(251,191,36,0.6)', fontSize: 11, marginTop: 4 }}>
                  Resets the intro flow so you can view it again
                </Text>
              </TouchableOpacity>

              {/* ── Prayer unlock toggle ──────────────────────── */}
              <TouchableOpacity
                onPress={() => setDebugPrayersUnlocked(v => !v)}
                style={{
                  backgroundColor: debugPrayersUnlocked ? '#2d5a2d' : '#2d3748',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: debugPrayersUnlocked ? '#48bb78' : '#4a5568',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  {debugPrayersUnlocked ? '🔓 Prayer Icons: Always Tappable' : '🔒 Prayer Icons: Time-Locked'}
                </Text>
                <Text style={{ color: debugPrayersUnlocked ? '#68d391' : '#cbd5e0', fontSize: 11, marginTop: 4 }}>
                  {debugPrayersUnlocked ? 'Tap to re-enable time locks' : 'Tap to bypass time windows'}
                </Text>
              </TouchableOpacity>

              {/* ── Freeze testing ───────────────────────────── */}
              <TouchableOpacity
                onPress={async () => {
                  // Grant 3 freezes to test inventory display and auto-consume
                  const updated = freezeCount + 3;
                  setFreezeCount(updated);
                  await AsyncStorage.setItem('@GrowPray:freezeInventory', JSON.stringify(updated));
                }}
                style={{
                  backgroundColor: '#1a3a4a',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#4fd1c5',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#4fd1c5', fontSize: 14, fontWeight: '600' }}>🧊 +3 Streak Freezes</Text>
                <Text style={{ color: '#81e6d9', fontSize: 11, marginTop: 4 }}>
                  Current: {freezeCount} freeze{freezeCount !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  // Simulate missed prayers + reset auto-resolve gate so the
                  // auto-consume effect fires again on next render cycle
                  const simMissed = ['Fajr', 'Dhuhr'];
                  const updatedStreaks = { ...prayerState.streaks };
                  simMissed.forEach(p => { if ((updatedStreaks[p] || 0) === 0) updatedStreaks[p] = 5; });
                  await AsyncStorage.setItem('@GrowPray:streaks', JSON.stringify({ counts: updatedStreaks, lastDate: new Date().toDateString() }));
                  await AsyncStorage.removeItem('@GrowPray:freezeResolvedDate');
                  await prayerState.debugSimulateMissed(simMissed);
                  setFreezeAutoResolved(false); // re-arms the auto-consume effect
                  setShowDebugModal(false);
                }}
                style={{
                  backgroundColor: '#1a3a4a',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#4fd1c5',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#4fd1c5', fontSize: 14, fontWeight: '600' }}>🧊 Test Auto-Consume</Text>
                <Text style={{ color: '#81e6d9', fontSize: 11, marginTop: 4 }}>
                  Fajr + Dhuhr missed - freeze consumes automatically
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowDebugModal(false)}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#aaa', fontSize: 14, fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: 'rgba(255,107,107,0.1)',
              borderRadius: 8,
            }}>
              <Text style={{ fontSize: 11, color: '#ff6b6b', textAlign: 'center' }}>
                Days since last XP: {gardenState.daysSinceLastXP.toFixed(1)}
              </Text>
              <Text style={{ fontSize: 11, color: '#ff6b6b', textAlign: 'center', marginTop: 4 }}>
                Decaying: {gardenState.isDecaying ? 'YES' : 'NO'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
      )}

      {/* Tab page views - lazy mount on first visit, then keep alive + frozen when hidden */}
      {visitedTabs.has('shop') && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: activeTab === 'shop' ? 1 : 0 }} pointerEvents={activeTab === 'shop' ? 'auto' : 'none'}>
        <FreezeWhenHidden visible={activeTab === 'shop'}>
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: 'rgba(10,14,28,0.75)' }}>
            <ShopModal
              asPage
              visible={activeTab === 'shop'}
              onClose={() => setActiveTab('garden')}
              coins={prayerState.coins}
              inventory={gardenState.treeInventory}
              onPurchaseTree={handlePurchaseTree}
              isPremium={premium.isPremium}
              onPremiumTap={() => { setActiveTab('garden'); setPaywallReason('premium_tree'); setShowPaywall(true); }}
              freezeCount={freezeCount}
              onPurchaseFreeze={handlePurchaseFreeze}
              onPurchaseCoins={handlePurchaseCoins}
              boostInventory={boosts.inventory}
              activeBoost={boosts.activeBoost}
              boostTimeRemainingMs={boosts.timeRemainingMs}
              onPurchaseBoost={boosts.purchaseBoost}
              onActivateBoost={boosts.activateBoost}
            />
          </SafeAreaView>
        </FreezeWhenHidden>
        </View>
      )}
      {visitedTabs.has('challenges') && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: activeTab === 'challenges' ? 1 : 0 }} pointerEvents={activeTab === 'challenges' ? 'auto' : 'none'}>
        <FreezeWhenHidden visible={activeTab === 'challenges'}>
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: 'rgba(10,14,28,0.75)' }}>
            <ChallengesModal
              asPage
              visible={activeTab === 'challenges'}
              onClose={() => setActiveTab('garden')}
              challenges={challengesHook.challengesList}
              onClaimReward={handleClaimChallengeReward}
            />
          </SafeAreaView>
        </FreezeWhenHidden>
        </View>
      )}
      {visitedTabs.has('history') && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: activeTab === 'history' ? 1 : 0 }} pointerEvents={activeTab === 'history' ? 'auto' : 'none'}>
        <FreezeWhenHidden visible={activeTab === 'history'}>
          {/* History's scrim is darker than the other tabs (0.88 vs 0.75) so its faint
              grid/grey text stays legible over the bright daytime sky. Applied to this
              single full-screen layer only, so the notch strip and body match (no seam). */}
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: 'rgba(10,14,28,0.88)' }}>
            <PrayerHistoryModal
              asPage
              visible={activeTab === 'history'}
              onClose={() => setActiveTab('garden')}
              streaks={prayerState.streaks}
              prayerHistory={prayerState.prayerHistory}
              completedToday={prayerState.completedPrayers}
              isPremium={premium.isPremium}
              onOpenPaywall={(reason) => { setActiveTab('garden'); setPaywallReason(reason); setShowPaywall(true); }}
            />
          </SafeAreaView>
        </FreezeWhenHidden>
        </View>
      )}
      {visitedTabs.has('dhikr') && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: activeTab === 'dhikr' ? 1 : 0 }} pointerEvents={activeTab === 'dhikr' ? 'auto' : 'none'}>
        <FreezeWhenHidden visible={activeTab === 'dhikr'}>
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: 'rgba(10,14,28,0.75)' }}>
            <DhikrScreen
              isPremium={premium.isPremium}
              onOpenPaywall={(reason) => { setActiveTab('garden'); setPaywallReason(reason); setShowPaywall(true); }}
              reflectionReminderEnabled={reflectionReminderEnabled}
              onToggleReflectionReminder={toggleReflectionReminder}
            />
          </SafeAreaView>
        </FreezeWhenHidden>
        </View>
      )}
      {visitedTabs.has('settings') && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: activeTab === 'settings' ? 1 : 0 }} pointerEvents={activeTab === 'settings' ? 'auto' : 'none'}>
        <FreezeWhenHidden visible={activeTab === 'settings'}>
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: 'rgba(10,14,28,0.95)' }}>
            <SettingsModal
              asPage
              visible={activeTab === 'settings'}
              onClose={() => setActiveTab('garden')}
              streaks={prayerState.streaks}
              madhab={madhab}
              onChangeMadhab={handleSetMadhab}
              calcMethodKey={calcMethodKey}
              detectedMethodKey={prayerState.detectedMethodKey}
              onChangeCalcMethod={handleSetCalcMethod}
              manualCity={manualCity}
              onManualCitySearch={handleManualCitySearch}
              onManualCitySelect={handleManualCitySelect}
              onClearManualCity={handleClearManualCity}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={toggleNotifications}
              isPremium={premium.isPremium}
              onOpenPaywall={openPaywallFromSettings}
              onRestorePurchases={premium.restorePurchases}
              onResetProgress={noopResetProgress}
              onRest={() => setShowRestModal(true)}
              onDebug={() => setShowDebugModal(true)}
              onReplayTutorial={() => { setActiveTab('garden'); setTimeout(() => tutorial.replay(), 400); }}
              monthlyPriceLabel={premium.prices.monthly}
            />
          </SafeAreaView>
        </FreezeWhenHidden>
        </View>
      )}

      {/* Top Info Bar - Floating overlay with gradient backdrop */}
      {activeTab === 'garden' && (
      <View
        pointerEvents="box-none"
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0,
          zIndex: 300,
        }}
      >
        {/* Soft gradient transition - deep navy fading into transparent */}
        <LinearGradient
          colors={[
            'rgba(10,14,28,0.88)',   // deep navy, near-opaque
            'rgba(10,14,28,0.65)',   // still strong
            'rgba(10,14,28,0.30)',   // semi-transparent
            'rgba(10,14,28,0.08)',   // light fade
            'rgba(10,14,28,0)',      // fully transparent
          ]}
          locations={[0, 0.3, 0.55, 0.8, 1]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 300,
          }}
          pointerEvents="none"
        />

        {/* Subtle ambient floating particles */}
        <AmbientParticles />

        <SafeAreaView 
          edges={['top']} 
          pointerEvents="box-none"
        >
        {prayerState.loading ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator size="small" color="#8b7355" />
          </View>
        ) : (
          <TopInfoBar 
            streaks={prayerState.streaks}
            coins={prayerState.coins}
            xp={prayerState.xp}
            nextPrayer={isResting ? null : prayerState.nextPrayer}
            nextPrayerTime={(!isResting && prayerState.nextPrayer && prayerState.timings) ? prayerState.timings[prayerState.nextPrayer] : null}
            timeUntilNext={isResting ? 'Resting' : prayerState.timeUntilNext}
            ringProgress={isResting ? 0 : prayerState.ringProgress}
            freezeCount={freezeCount}
            consistencyMultiplier={consistency.multiplier * boosts.xpMultiplier}
            onMultiplierPress={() => setShowMultiplierModal(true)}
            activeBoostIcon={boosts.activeBoost ? BOOST_CATALOG.find(b => b.id === boosts.activeBoost!.boostId)?.icon : undefined}
            activeBoostName={boosts.activeBoost ? BOOST_CATALOG.find(b => b.id === boosts.activeBoost!.boostId)?.name : undefined}
            activeBoostColor={boosts.activeBoost ? BOOST_CATALOG.find(b => b.id === boosts.activeBoost!.boostId)?.color : undefined}
            boostTimeRemaining={boosts.activeBoost ? (() => { const ms = boosts.timeRemainingMs; const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return h > 0 ? `${h}h ${m}m left` : `${m}m left`; })() : undefined}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenQibla={openQibla}
            userName={userName}
          />
        )}
        </SafeAreaView>
      </View>
      )}

      </View>
      {/* End content area */}

      {/* Bottom area: Prayer Bar + Tab Bar - liquid glass */}
      <SafeAreaView 
        edges={['bottom']} 
        style={{ 
          backgroundColor: activeTab === 'garden' ? 'transparent' : 'rgba(10,14,28,0.75)',
          zIndex: 300,
        }}
      >
        {/* Floating Prayer Bar - Hidden during rest or non-garden tabs */}
        {!isResting && activeTab === 'garden' && !prayerState.loading && prayerState.timings && (
          <FloatingPrayerBar 
            timings={prayerState.timings}
            nextPrayer={prayerState.nextPrayer}
            completedPrayers={prayerState.completedPrayers}
            onTogglePrayer={handleTogglePrayerWithChallenges}
            getPrayerWindowStatus={prayerState.getPrayerWindowStatus}
            streaks={prayerState.streaks}
            debugPrayersUnlocked={debugPrayersUnlocked}
          />
        )}

        {/* Bottom Tab Bar */}
        {!isResting && (
          <BottomTabBar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab as 'garden' | 'shop' | 'challenges' | 'history' | 'settings' | 'dhikr');
            }}
            challengeClaimable={challengesHook.totalClaimable}
          />
        )}
      </SafeAreaView>




    </SkyBackground>
      {/* Preparing overlay - hides the garden while it loads after onboarding */}
      {showPreparing && (
        <PreparingScreen
          progress={{
            prayerData: prayerState.stateLoaded,
            gardenData: !gardenState.loading,
            gardenRendered: gardenRendered,
          }}
          onDone={handlePreparingDone}
        />
      )}
      {/* Normal loading overlay for returning users (skip if we came from onboarding) */}
      {/* Gate on gardenRendered too: appDataReady only means assets finished
          DOWNLOADING - the splash must stay until the garden has actually PAINTED
          (center tree image decoded), or it lifts onto a half-drawn garden. */}
      {!cameFromOnboarding.current && !showPreparing && (
        <LoadingOverlay
          ready={appDataReady && gardenRendered}
          onImageLoaded={() => SplashScreen.hideAsync().catch(() => {})}
        />
      )}

      {/* First-run tutorial - overlays everything once the garden is visible */}
      <TutorialOverlay
        visible={tutorial.active}
        step={tutorial.currentStep}
        rect={tutorialRect}
        stepIndex={tutorial.stepIndex}
        totalSteps={tutorial.totalSteps}
        onNext={tutorial.next}
        onSkip={tutorial.skip}
      />
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
