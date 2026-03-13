import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { Text, View, ActivityIndicator, TouchableOpacity, Image, ImageBackground, Animated, Modal, ScrollView, TouchableWithoutFeedback, Easing, StyleSheet, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { GardenScene } from './components/GardenScene';
import { useGardenState, TileState } from './hooks/useGardenState';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ShopModal, TREE_CATALOG } from './components/ShopModal';
import { PaywallModal } from './components/PaywallModal';
import { usePremium } from './hooks/usePremium';
import { useConsistencyMultiplier } from './hooks/useConsistencyMultiplier';
import { useChallenges, ChallengeId } from './hooks/useChallenges';
import { ChallengesModal } from './components/ChallengesModal';
import { useRamadanMode } from './hooks/useRamadanMode';
import { useDifficultDay } from './hooks/useDifficultDay';
import { DifficultDayModal } from './components/DifficultDayModal';
import { SettingsModal } from './components/SettingsModal';
import { PrayerHistoryModal } from './components/PrayerHistoryModal';

import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePrayerTimes } from './hooks/usePrayerTimes';
import { useNotifications } from './hooks/useNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

// Keep the native splash visible until our custom loading screen image is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

// ─── Design Tokens ────────────────────────────────────────────────────────────
const THEME = {
  bg: '#0f1526',               // Deep navy — unified across all screens
  bgCard: 'rgba(255,255,255,0.04)',  // Subtle card fill (no borders)
  bgOverlay: 'rgba(0,0,0,0.7)',      // Modal overlay
  accent: '#e8a87c',           // Warm peach — active states, highlights
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
  purple: '#a78bfa',           // Rest, difficult day
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

// Per-prayer streak type
type PrayerStreaks = Record<string, number>;
const DEFAULT_STREAKS: PrayerStreaks = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };

// XP rewards
const XP_ON_TIME = 5;      // XP for completing during active window

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

// Rest Overlay - Shows when in rest mode
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
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(26, 26, 46, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 50,
    }}>
      {/* Rest indicator */}
      <View style={{
        backgroundColor: 'rgba(15, 21, 38, 0.95)',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        maxWidth: 280,
      }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🌙</Text>
        
        <Text style={{
          fontSize: 22,
          fontWeight: '700',
          color: THEME.text,
          marginBottom: 8,
        }}>
          Resting...
        </Text>
        
        <Text style={{
          fontSize: 16,
          color: THEME.accent,
          marginBottom: 4,
        }}>
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
        </Text>
        
        <Text style={{
          fontSize: 13,
          color: '#9ca3af',
          textAlign: 'center',
          marginBottom: 24,
        }}>
          Your streak is frozen during this time
        </Text>
        
        <TouchableOpacity
          onPress={onEndRest}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          }}
        >
          <Text style={{
            color: '#9ca3af',
            fontSize: 14,
            fontWeight: '600',
          }}>
            End Rest Early
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Top Info Bar — clean minimal: stats row + next prayer line
// Circular progress ring built with half-circle rotations (no SVG needed)
function CountdownRing({ progress, size, strokeWidth, color, trackColor }: {
  progress: number; // 0..1
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
}) {
  const radius = size / 2;
  const p = Math.min(Math.max(progress, 0), 1);

  // Right half: sweeps from 180° (hidden behind clip) to 0° (full right arc visible at 50%)
  const rightDeg = 180 - Math.min(p, 0.5) * 360;
  // Left half: stays hidden at 180° until 50%, then sweeps to 0° at 100%
  const leftDeg = p <= 0.5 ? 180 : 180 - (p - 0.5) * 360;

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: radius,
        borderWidth: strokeWidth,
        borderColor: trackColor,
      }} />
      {/* Right clip — shows right half of the rotating arc */}
      <View style={{
        position: 'absolute',
        left: radius,
        width: radius,
        height: size,
        overflow: 'hidden',
      }}>
        <View style={{
          width: size,
          height: size,
          left: -radius,
          borderRadius: radius,
          borderWidth: strokeWidth,
          borderTopColor: color,
          borderRightColor: color,
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          transform: [{ rotate: `${rightDeg}deg` }],
        }} />
      </View>
      {/* Left clip — shows left half of the rotating arc */}
      <View style={{
        position: 'absolute',
        left: 0,
        width: radius,
        height: size,
        overflow: 'hidden',
      }}>
        <View style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: strokeWidth,
          borderBottomColor: color,
          borderLeftColor: color,
          borderTopColor: 'transparent',
          borderRightColor: 'transparent',
          transform: [{ rotate: `${leftDeg}deg` }],
        }} />
      </View>
    </View>
  );
}

// Premium animated countdown ring with glow, leading dot, smooth animation & completion pulse
function PremiumCountdownRing({ progress, size, strokeWidth, isComplete }: {
  progress: number;
  size: number;
  strokeWidth: number;
  isComplete: boolean; // true when all prayers done
}) {
  const radius = size / 2;
  // Smoothly animate the displayed progress
  const animProgress = useRef(new Animated.Value(0)).current;
  const prevProgressRef = useRef(0);

  // Completion pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const wasComplete = useRef(false);

  // Leading edge glow pulse
  const edgeGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(edgeGlow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(edgeGlow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    const prev = prevProgressRef.current;
    prevProgressRef.current = progress;

    // Detect reset (progress jumped backward significantly = new prayer cycle)
    if (prev > 0.9 && progress < 0.1) {
      // Fire completion pulse, then reset
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
      // Normal smooth interpolation
      Animated.timing(animProgress, {
        toValue: progress,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [progress]);

  // Completion state pulse (all prayers done)
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

  // Use listener to drive the non-animated CountdownRing
  const [displayProgress, setDisplayProgress] = useState(progress);
  useEffect(() => {
    const id = animProgress.addListener(({ value }) => setDisplayProgress(value));
    return () => animProgress.removeListener(id);
  }, []);

  const activeColor = isComplete ? '#4ade80' : '#e8a87c';
  const brightColor = isComplete ? '#86efac' : '#fbbf24';

  // Leading edge position — angle in the -90deg rotated coordinate system
  // progress 0 = top (12 o'clock), progress 1 = full circle back to top
  const edgeAngle = displayProgress * 2 * Math.PI - Math.PI / 2;
  const dotX = radius + (radius - strokeWidth / 2) * Math.cos(edgeAngle);
  const dotY = radius + (radius - strokeWidth / 2) * Math.sin(edgeAngle);

  return (
    <View style={{ width: size + 16, height: size + 16, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer glow layers */}
      <Animated.View style={{
        position: 'absolute',
        width: size + 12,
        height: size + 12,
        borderRadius: (size + 12) / 2,
        backgroundColor: activeColor,
        opacity: Animated.add(
          pulseOpacity,
          displayProgress > 0.01 ? 0.06 : 0,
        ),
        transform: [{ scale: pulseAnim }],
      }} />
      <Animated.View style={{
        position: 'absolute',
        width: size + 6,
        height: size + 6,
        borderRadius: (size + 6) / 2,
        backgroundColor: activeColor,
        opacity: displayProgress > 0.01 ? 0.08 : 0,
        transform: [{ scale: pulseAnim }],
      }} />

      {/* The ring itself (rotated so 0 = top, 1 = full clockwise) */}
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Base warm-orange arc */}
        <CountdownRing
          progress={displayProgress}
          size={size}
          strokeWidth={strokeWidth}
          color={activeColor}
          trackColor="rgba(255,255,255,0.06)"
        />
        {/* Overlay lighter gold arc at slightly less progress to simulate gradient tail */}
        {displayProgress > 0.02 && (
          <View style={{ position: 'absolute' }}>
            <CountdownRing
              progress={Math.max(0, displayProgress - 0.08)}
              size={size}
              strokeWidth={strokeWidth}
              color={brightColor}
              trackColor="transparent"
            />
          </View>
        )}
      </View>

      {/* Leading edge glowing dot */}
      {displayProgress > 0.01 && displayProgress < 0.99 && (
        <Animated.View style={{
          position: 'absolute',
          left: 8 + dotX - 4,
          top: 8 + dotY - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: brightColor,
          opacity: edgeGlow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
          shadowColor: brightColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 6,
          elevation: 6,
        }} />
      )}
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
  timeUntilNext,
  ringProgress,
  freezeCount,
  consistencyMultiplier,
  onMultiplierPress,
  isRamadan,
  ramadanDay,
  ramadanMultiplier,
  difficultDayActive,
}: { 
  streaks: PrayerStreaks; 
  coins: number;
  xp: number; 
  nextPrayer: string | null; 
  timeUntilNext: string;
  ringProgress: number;
  freezeCount: number;
  consistencyMultiplier: number;
  onMultiplierPress: () => void;
  isRamadan: boolean;
  ramadanDay: number;
  ramadanMultiplier: number;
  difficultDayActive: boolean;
}) {
  const bestStreak = Math.max(...Object.values(streaks));
  const combinedMultiplier = consistencyMultiplier * ramadanMultiplier;
  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={{ alignItems: 'center', paddingTop: 16 }}>

      {/* Difficult Day banner — compact */}
      {difficultDayActive && (
        <View style={{
          backgroundColor: THEME.purpleMuted,
          borderRadius: 9,
          paddingVertical: 4,
          paddingHorizontal: 10,
          marginBottom: 8,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: THEME.purple }}>
            Difficult Day Active
          </Text>
        </View>
      )}

      {/* ── Context label — subtle next prayer indicator ── */}
      {nextPrayer ? (
        <Text style={{
          fontSize: 11,
          fontWeight: '500',
          color: 'rgba(232,224,214,0.5)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          Next: {nextPrayer}
        </Text>
      ) : (
        <Text style={{
          fontSize: 11,
          fontWeight: '500',
          color: 'rgba(74,222,128,0.5)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          All Prayers Complete
        </Text>
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

        {/* ── Countdown Circle — focal element ── */}
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
            }}>
              {nextPrayer ? timeUntilNext : '✓'}
            </Text>
            <Text style={{
              fontSize: 9,
              fontWeight: '500',
              color: THEME.textSecondary,
              marginTop: 1,
            }}>
              {nextPrayer ? `until ${nextPrayer}` : 'All done'}
            </Text>
          </View>
        </View>
      </View>

      {/* 18px gap between timer and stats */}
      <View style={{ height: 18 }} />

      {/* ── Floating Pill Stats Panel — Liquid Glass ── */}
      <View style={{
        width: screenWidth * 0.65,
        borderRadius: 18,
        overflow: 'hidden',
      }}>
        <BlurView intensity={25} tint="dark" style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          paddingVertical: 9,
          paddingHorizontal: 6,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
        }}>
          {/* Glass surface fill */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(20,30,50,0.30)',
            borderRadius: 18,
          }} />
          {/* Top-edge highlight */}
          <View style={{
            position: 'absolute', top: 0, left: 12, right: 12, height: 1,
            backgroundColor: 'rgba(255,255,255,0.08)',
          }} />

          {/* Streak */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11 }}>🔥</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: bestStreak > 0 ? THEME.warning : THEME.textSecondary }}>
              {bestStreak}
            </Text>
          </View>

          {/* Coins */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11 }}>🪙</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: THEME.coin }}>
              {coins}
            </Text>
          </View>

          {/* XP */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11 }}>✨</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: THEME.success }}>
              {xp}
            </Text>
          </View>

          {/* Combined Multiplier */}
          <TouchableOpacity onPress={onMultiplierPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11 }}>⚡</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: combinedMultiplier > 1 ? THEME.coin : THEME.textSecondary }}>
              {combinedMultiplier}×
            </Text>
          </TouchableOpacity>

          {/* Freeze (only if > 0) */}
          {freezeCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <MaterialCommunityIcons name="shield-check" size={12} color={THEME.purple} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: THEME.purple }}>
                {freezeCount}
              </Text>
            </View>
          )}
        </BlurView>
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

  // Combine window status with completion status
  const getPrayerStatus = (prayer: string): 'completed' | 'active' | 'missed' | 'upcoming' => {
    if (completedPrayers.has(prayer)) return 'completed';
    return getPrayerWindowStatus(prayer);
  };

  return (
    <View style={{
      paddingTop: 10,
      paddingBottom: 8,
      paddingHorizontal: 16,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
    }}>
      {prayers.map((prayer) => {
        const status = getPrayerStatus(prayer);
        const isCompleted = status === 'completed';
        const isActive = status === 'active';
        const isMissed = status === 'missed';
        const isUpcoming = status === 'upcoming';
        const canTap = debugPrayersUnlocked || isActive || isCompleted;
        
        // Subtle ring color for status
        let ringColor = 'rgba(255,255,255,0.1)'; // upcoming
        if (isCompleted) ringColor = THEME.success;
        else if (isActive) ringColor = THEME.accent;
        else if (isMissed) ringColor = 'rgba(239, 68, 68, 0.5)';

        // Text color
        let textColor = THEME.textSecondary;
        if (isCompleted) textColor = THEME.success;
        else if (isActive) textColor = THEME.accent;
        else if (isMissed) textColor = THEME.danger;
        
        return (
          <View
            key={prayer}
            style={{
              alignItems: 'center',
            }}
          >
            <TouchableOpacity 
              onPress={() => onTogglePrayer(prayer)}
              disabled={!canTap}
              activeOpacity={canTap ? 0.7 : 1}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 52,
                height: 52,
                borderRadius: 26,
                borderWidth: 2,
                borderColor: ringColor,
                backgroundColor: 'transparent',
              }}
            >
              {/* Breathing glow for active prayer */}
              {isActive && <BreathingGlow color={THEME.accent} size={52} />}
              {/* Prayer icon - ALWAYS fully visible */}
              <Image 
                source={PRAYER_ICONS[prayer as keyof typeof PRAYER_ICONS]}
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 24,
                }}
                resizeMode="cover"
              />
            
            {/* Small corner badge for completed - just a tiny checkmark */}
            {isCompleted && (
              <View style={{ 
                position: 'absolute', 
                bottom: -2, 
                right: -2, 
                backgroundColor: THEME.success,
                borderRadius: 9,
                width: 16,
                height: 16,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: THEME.bg,
              }}>
                <MaterialCommunityIcons name="check" size={10} color="#fff" />
              </View>
            )}
            </TouchableOpacity>
            
            {/* Prayer Name - always visible, now OUTSIDE the TouchableOpacity */}
            <Text 
              style={{
                marginTop: 5,
                fontSize: 9,
                fontWeight: '600',
                color: textColor,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {prayer}
            </Text>
            
            {/* Per-prayer streak count */}
            {(streaks[prayer] || 0) > 0 && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 2,
              }}>
                <MaterialCommunityIcons name="fire" size={10} color={THEME.warning} />
                <Text style={{
                  fontSize: 9,
                  fontWeight: '700',
                  color: THEME.warning,
                }}>
                  {streaks[prayer]}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// Bottom Tab Bar - Finch-style navigation
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
    { key: 'garden', icon: 'tree' as const, label: 'Garden', color: THEME.accent, badge: 0 },
    { key: 'challenges', icon: 'trophy' as const, label: 'Challenges', color: THEME.accent, badge: challengeClaimable },
    { key: 'shop', icon: 'store' as const, label: 'Shop', color: THEME.accent, badge: 0 },
    { key: 'history', icon: 'calendar-month' as const, label: 'History', color: THEME.accent, badge: 0 },
    { key: 'more', icon: 'dots-horizontal' as const, label: 'More', color: THEME.accent, badge: 0 },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: THEME.bg,
      paddingTop: 10,
      paddingBottom: 6,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: THEME.divider,
    }}>
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
            <View>
              <MaterialCommunityIcons
                name={tab.icon}
                size={24}
                color={isActive ? tab.color : THEME.tabInactive}
              />
              {!!(tab.badge > 0) && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  backgroundColor: THEME.danger,
                  borderRadius: 7,
                  minWidth: 14,
                  height: 14,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                    {tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{
              fontSize: 10,
              fontWeight: isActive ? '700' : '400',
              color: isActive ? tab.color : THEME.tabInactive,
              marginTop: 2,
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// "More" popup menu for secondary actions
function MoreMenu({
  visible,
  onClose,
  onSettings,
  onDifficultDay,
  onRest,
  onPremium,
  onDebug,
  difficultDayActive,
  isPremium,
}: {
  visible: boolean;
  onClose: () => void;
  onSettings: () => void;
  onDifficultDay: () => void;
  onRest: () => void;
  onPremium: () => void;
  onDebug: () => void;
  difficultDayActive: boolean;
  isPremium: boolean;
}) {
  if (!visible) return null;

  const items = [
    ...(!isPremium ? [{ icon: 'crown' as const, label: 'Premium', color: '#fbbf24', onPress: onPremium }] : []),
    { icon: 'cog' as const, label: 'Settings', color: '#9ca3af', onPress: onSettings },
    { icon: 'weather-night' as const, label: difficultDayActive ? 'Difficult Day ✓' : 'Difficult Day', color: difficultDayActive ? '#a78bfa' : '#9ca3af', onPress: onDifficultDay },
    { icon: 'moon-waning-crescent' as const, label: 'Rest Period', color: '#10b981', onPress: onRest },
    { icon: 'bug' as const, label: 'Debug', color: '#ff6b6b', onPress: onDebug },
  ];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback>
            <View style={{
              backgroundColor: THEME.bg,
              marginHorizontal: 16,
              marginBottom: 100,
              borderRadius: 16,
              paddingVertical: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 20,
            }}>
              {items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => { item.onPress(); onClose(); }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderBottomWidth: i < items.length - 1 ? 1 : 0,
                    borderBottomColor: THEME.divider,
                  }}
                >
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                  <Text style={{ 
                    marginLeft: 14, 
                    fontSize: 15, 
                    fontWeight: '500', 
                    color: THEME.text,
                  }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// Particle component for XP burst effect
function Particle({ delay, angle }: { delay: number; angle: number }) {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateX = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(1))[0];

  // Varied size and color per particle
  const size = 4 + Math.random() * 5;
  const colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#a7f3d0'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  useEffect(() => {
    fadeAnim.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    scaleAnim.setValue(1);

    const distance = 35 + Math.random() * 25;
    const xDist = Math.cos(angle) * distance;
    const yDist = Math.sin(angle) * distance;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: xDist,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: yDist,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: fadeAnim,
        transform: [{ translateX }, { translateY }, { scale: scaleAnim }],
      }}
    />
  );
}

// XP Popup Component - With particles, sound, and haptics
function XPPopup({ amount, baseAmount, multiplier, visible, onComplete }: { amount: number; baseAmount: number; multiplier: number; visible: boolean; onComplete: () => void }) {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.3))[0];
  const rotateAnim = useState(new Animated.Value(0))[0];
  const glowAnim = useState(new Animated.Value(0))[0];
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    if (visible) {
      // Play haptic feedback - medium impact for XP
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Play sound effect
      playSound();

      // Reset values
      fadeAnim.setValue(1);
      translateY.setValue(0);
      scaleAnim.setValue(0.3);
      rotateAnim.setValue(-0.05);
      glowAnim.setValue(0);
      setShowParticles(true);
      
      // Multi-stage animation
      Animated.parallel([
        // Badge pop-in with stronger bounce
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 180,
          friction: 6,
          useNativeDriver: true,
        }),
        // Slight rotation wobble
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 0.06,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -0.04,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0.02,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
        ]),
        // Glow pulse (two pulses for emphasis)
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        // Float up
        Animated.timing(translateY, {
          toValue: -80,
          duration: 1400,
          useNativeDriver: true,
        }),
        // Fade out
        Animated.sequence([
          Animated.delay(800),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setShowParticles(false);
        onComplete();
      });
    }
  }, [visible]);

  const playSound = async () => {
    try {
      // Set audio mode to play sound even when phone is on silent
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        staysActiveInBackground: false,
      });
      
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/sounds/xp_sound.mp3'),
        { shouldPlay: true, volume: 0.5 }
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      // Silently fail if sound file doesn't exist yet
    }
  };

  if (!visible) return null;

  // Generate 12 particles in a circle pattern for richer burst
  const particles = Array.from({ length: 12 }, (_, i) => ({
    angle: (Math.PI * 2 * i) / 12,
    delay: i * 15,
  }));

  return (
    <View style={{ 
      position: 'absolute', 
      top: '35%', 
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 1000,
    }}>
      {/* Main animated container - particles and badge move together */}
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [
            { translateY },
            { scale: scaleAnim },
            { rotate: rotateAnim.interpolate({
              inputRange: [-1, 1],
              outputRange: ['-1rad', '1rad'],
            }) },
          ],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Glow background - behind everything */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#10b981',
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.3],
            }),
            zIndex: 1,
          }}
        />

        {/* Particles - burst from center */}
        {showParticles && particles.map((p, i) => (
          <View key={i} style={{ position: 'absolute', zIndex: 2 }}>
            <Particle delay={p.delay} angle={p.angle} />
          </View>
        ))}

        {/* Badge content - icon + text on top */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          zIndex: 3,
        }}>
          {/* Small pixel art icon */}
          <Image 
            source={XP_BADGE}
            style={{ 
              width: 24, 
              height: 24,
              marginRight: 8,
            }}
            resizeMode="contain"
          />
          
          {/* XP text */}
          <View style={{ alignItems: 'center' }}>
            {multiplier > 1 ? (
              <>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: '#10b981',
                  letterSpacing: 0.5,
                  textShadowColor: 'rgba(0, 0, 0, 0.9)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 6,
                }}>
                  +{amount} XP
                </Text>
                <Text style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: '#fbbf24',
                  textShadowColor: 'rgba(0, 0, 0, 0.9)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                  marginTop: 1,
                }}>
                  {baseAmount} × {multiplier}×
                </Text>
              </>
            ) : (
              <Text style={{
                fontSize: 16,
                fontWeight: '800',
                color: '#10b981',
                letterSpacing: 0.5,
                textShadowColor: 'rgba(0, 0, 0, 0.9)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 6,
              }}>
                +{amount} XP
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Coin Popup Component ──────────────────────────────────────────────────────
function CoinPopup({ amount, visible, onComplete }: { amount: number; visible: boolean; onComplete: () => void }) {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.5))[0];

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      fadeAnim.setValue(1);
      translateY.setValue(0);
      scaleAnim.setValue(0.5);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 200,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -50,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start(onComplete);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={{
      position: 'absolute',
      top: '45%',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 999,
    }}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY }, { scale: scaleAnim }],
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '800',
          color: '#fbbf24',
          textShadowColor: 'rgba(0, 0, 0, 0.8)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 6,
        }}>
          +{amount} 🪙
        </Text>
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
    if (streak >= 100) return '👑';
    if (streak >= 30) return '🏆';
    return '⭐';
  };

  const getTitle = () => {
    if (streak >= 100) return 'LEGENDARY!';
    if (streak >= 30) return 'INCREDIBLE!';
    return 'MILESTONE!';
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

          <Text style={{ fontSize: 56, marginBottom: 8 }}>{getTrophy()}</Text>
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
            {prayer} — {streak} Day Streak
          </Text>
          <Text style={{
            fontSize: 14,
            color: '#9ca3af',
            marginBottom: 20,
            textAlign: 'center',
          }}>
            Your dedication is paying off. Keep going!
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
                +{bonus} 🪙 Bonus!
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
function usePrayerState(coinMultiplier: number = 1, xpMultiplier: number = 1, difficultDayActive: boolean = false) {
  const { timings, deadlines, nextPrayer, loading } = usePrayerTimes();
  const [completedPrayers, setCompletedPrayers] = useState<Set<string>>(new Set());
  const [streaks, setStreaks] = useState<PrayerStreaks>({ ...DEFAULT_STREAKS });
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  // Prayer history log: { "2026-02-17": ["Fajr", "Dhuhr", ...], ... }
  const [prayerHistory, setPrayerHistory] = useState<Record<string, string[]>>({});

  const [timeUntilNext, setTimeUntilNext] = useState('--:--');
  const [ringProgress, setRingProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [xpPopup, setXpPopup] = useState<{ visible: boolean; amount: number; baseAmount: number; multiplier: number }>({ visible: false, amount: 0, baseAmount: 0, multiplier: 1 });
  const [coinPopup, setCoinPopup] = useState<{ visible: boolean; amount: number }>({ visible: false, amount: 0 });
  const [milestonePopup, setMilestonePopup] = useState<{ visible: boolean; prayer: string; streak: number; bonus: number }>({ visible: false, prayer: '', streak: 0, bonus: 0 });
  // Missed prayers pending freeze resolution (deferred streak reset)
  const [missedPrayers, setMissedPrayers] = useState<string[]>([]);
  const [stateLoaded, setStateLoaded] = useState(false);

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

    // Parse "HH:MM" → Date object for today (or adjusted day)
    const parseTime = (timeStr: string, refDate: Date): Date => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(refDate);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const updateCountdown = () => {
      const now = new Date();

      // ── Next prayer time ──
      const nextTimeStr = timings[nextPrayer];
      if (!nextTimeStr) return;
      let nextTime = parseTime(nextTimeStr, now);
      // If nextPrayer time already passed today, it's tomorrow (Fajr after Isha)
      if (nextTime <= now) {
        nextTime.setDate(nextTime.getDate() + 1);
      }

      // ── Previous prayer time ──
      const nextIdx = PRAYER_ORDER.indexOf(nextPrayer);
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
  }, [timings, nextPrayer]);

  const loadState = async () => {
    try {
      const today = new Date().toDateString();
      
      // Load completed prayers for today
      const storedPrayers = await AsyncStorage.getItem(COMPLETED_PRAYERS_KEY);
      let savedPrayersData = null;
      if (storedPrayers) {
        savedPrayersData = JSON.parse(storedPrayers);
        if (savedPrayersData.date === today) {
          setCompletedPrayers(new Set(savedPrayersData.prayers));
        } else {
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
        // Defer streak reset — let the freeze prompt handle it
        setMissedPrayers(detectedMissed);
        // Keep current streaks intact until resolved
        setStreaks(currentStreaks);
      } else {
        // No missed prayers, or freeze already resolved today — streaks stay as-is
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

  // Get the Islamic deadline for a prayer using explicit Muwaqqit-derived deadlines
  // Fajr → Sunrise, Dhuhr → Asr (Mithl al-Awwal), Asr → Sunset, Maghrib → Isha (red twilight), Isha → next Fajr
  const getPrayerEndTime = (prayer: string): number => {
    if (!timings) return 0;
    
    // Use explicit deadlines from Muwaqqit if available
    if (deadlines && deadlines[prayer as keyof typeof deadlines]) {
      const deadlineStr = deadlines[prayer as keyof typeof deadlines];
      const deadlineMinutes = timeToMinutes(deadlineStr);
      
      // Isha crosses midnight — deadline (next Fajr) is on the next day
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
    
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
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
      
      // Award XP (flat rate — prayer is within its Islamic deadline)
      const baseXp = XP_ON_TIME;
      const xpEarned = Math.round(baseXp * xpMultiplier * 10) / 10; // Round to 1 decimal
      const newXp = xp + xpEarned;
      setXp(newXp);
      
      // Show XP popup (include multiplier info for display)
      setXpPopup({ visible: true, amount: xpEarned, baseAmount: baseXp, multiplier: xpMultiplier });
      
      // Persist XP
      await AsyncStorage.setItem(XP_KEY, JSON.stringify(newXp));
      
      // Increment this prayer's streak
      const newStreaks = { ...streaks, [prayer]: (streaks[prayer] || 0) + 1 };
      setStreaks(newStreaks);
      await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify({ 
        counts: newStreaks, 
        lastDate: new Date().toDateString() 
      }));

      // --- Coin earning (premium multiplier applied) ---
      let coinsEarned = COINS_PER_PRAYER * coinMultiplier;

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

      // Show coin popup after a slight delay so it doesn't overlap XP popup
      setTimeout(() => {
        setCoinPopup({ visible: true, amount: coinsEarned });
      }, 300);

      // Show streak milestone celebration for 7/30/100 day streaks
      if (newPrayerStreak === 7 || newPrayerStreak === 30 || newPrayerStreak === 100) {
        const milestoneBonus = newPrayerStreak === 7 ? COINS_7DAY_MILESTONE
          : newPrayerStreak === 30 ? COINS_30DAY_MILESTONE : COINS_100DAY_MILESTONE;
        setTimeout(() => {
          setMilestonePopup({ visible: true, prayer, streak: newPrayerStreak, bonus: milestoneBonus });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 1200);
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
    } catch (error) {
      console.error('Error saving completed prayers:', error);
    }
  };

  // Hide XP popup
  const hideXpPopup = () => {
    setXpPopup({ visible: false, amount: 0, baseAmount: 0, multiplier: 1 });
  };

  // Debug: same as togglePrayerCompleted but bypasses the active-window check
  const debugTogglePrayer = async (prayer: string) => {
    const newCompleted = new Set(completedPrayers);
    const wasCompleted = newCompleted.has(prayer);
    if (wasCompleted) {
      newCompleted.delete(prayer);
    } else {
      newCompleted.add(prayer);
      const baseXp = XP_ON_TIME;
      const xpEarned = Math.round(baseXp * xpMultiplier * 10) / 10;
      const newXp = xp + xpEarned;
      setXp(newXp);
      setXpPopup({ visible: true, amount: xpEarned, baseAmount: baseXp, multiplier: xpMultiplier });
      await AsyncStorage.setItem(XP_KEY, JSON.stringify(newXp));
      const newStreaks = { ...streaks, [prayer]: (streaks[prayer] || 0) + 1 };
      setStreaks(newStreaks);
      await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify({ counts: newStreaks, lastDate: new Date().toDateString() }));
      let coinsEarned = COINS_PER_PRAYER * coinMultiplier;
      if (newCompleted.size === 5) coinsEarned += COINS_ALL_FIVE_BONUS;
      const newCoins = coins + coinsEarned;
      setCoins(newCoins);
      await AsyncStorage.setItem(COINS_KEY, JSON.stringify(newCoins));
      setTimeout(() => setCoinPopup({ visible: true, amount: coinsEarned }), 300);
    }
    setCompletedPrayers(newCompleted);
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify({ date: today, prayers: Array.from(newCompleted) }));
    } catch (e) {}
  };

  const hideCoinPopup = () => {
    setCoinPopup({ visible: false, amount: 0 });
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
    xpPopup,
    hideXpPopup,
    coinPopup,
    hideCoinPopup,
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
  };
}

const ONBOARDING_KEY = '@JannahGarden:onboardingComplete';
const TOOLTIP_KEY = '@JannahGarden:tooltipShown';

// Freeze Prompt Modal — shown when missed prayers detected and user has freezes
function FreezePromptModal({
  visible,
  missedPrayers,
  freezeInventory,
  streaks,
  onUseSingleFreeze,
  onUseAllFreeze,
  onLetBreak,
}: {
  visible: boolean;
  missedPrayers: string[];
  freezeInventory: { single: number; all: number };
  streaks: PrayerStreaks;
  onUseSingleFreeze: (prayer: string) => void;
  onUseAllFreeze: () => void;
  onLetBreak: () => void;
}) {
  const [selectingPrayer, setSelectingPrayer] = useState(false);

  if (!visible || missedPrayers.length === 0) return null;

  const hasSingle = freezeInventory.single > 0;
  const hasAll = freezeInventory.all > 0;
  // Only show prayers that actually have a streak worth protecting
  const protectablePrayers = missedPrayers.filter(p => (streaks[p] || 0) > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onLetBreak}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
        <View style={{
          backgroundColor: THEME.bg,
          borderRadius: 24,
          padding: 28,
          width: '100%',
          maxWidth: 340,
          alignItems: 'center',
        }}>
          {/* Header */}
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🛡️</Text>
          <Text style={{
            fontSize: 20,
            fontWeight: '800',
            color: THEME.text,
            marginBottom: 6,
          }}>
            Streak at Risk!
          </Text>
          
          {/* Missed prayers list */}
          <Text style={{
            fontSize: 14,
            color: '#94a3b8',
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 20,
          }}>
            You missed {missedPrayers.length === 5 ? 'all prayers' : missedPrayers.join(', ')} yesterday
          </Text>

          {/* Streak info for missed prayers */}
          {protectablePrayers.length > 0 && (
            <View style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 12,
              padding: 12,
              width: '100%',
              marginBottom: 16,
            }}>
              {protectablePrayers.map(prayer => (
                <View key={prayer} style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 14, color: '#fca5a5' }}>{prayer}</Text>
                  <Text style={{ fontSize: 14, color: '#fca5a5', fontWeight: '600' }}>
                    🔥 {streaks[prayer]} day streak
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Prayer selection mode for single freeze */}
          {selectingPrayer ? (
            <View style={{ width: '100%' }}>
              <Text style={{
                fontSize: 13,
                color: '#94a3b8',
                textAlign: 'center',
                marginBottom: 10,
              }}>
                Select a prayer to protect:
              </Text>
              {protectablePrayers.map(prayer => (
                <TouchableOpacity
                  key={prayer}
                  onPress={() => {
                    setSelectingPrayer(false);
                    onUseSingleFreeze(prayer);
                  }}
                  style={{
                    backgroundColor: 'rgba(232, 168, 124, 0.15)',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    marginBottom: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 15, color: THEME.text, fontWeight: '600' }}>
                    {prayer}
                  </Text>
                  <Text style={{ fontSize: 13, color: THEME.accent }}>
                    🔥 {streaks[prayer]} → Protected
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setSelectingPrayer(false)}
                style={{
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: '100%' }}>
              {/* Use All Prayers Freeze */}
              {hasAll && (
                <TouchableOpacity
                  onPress={onUseAllFreeze}
                  style={{
                    backgroundColor: 'rgba(232, 168, 124, 0.2)',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    marginBottom: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: THEME.text }}>
                    🛡️ Use All Prayers Freeze
                  </Text>
                  <Text style={{ fontSize: 12, color: THEME.accent, marginTop: 2 }}>
                    Protect all streaks • {freezeInventory.all} remaining
                  </Text>
                </TouchableOpacity>
              )}

              {/* Use Single Prayer Freeze */}
              {hasSingle && protectablePrayers.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    if (protectablePrayers.length === 1) {
                      // Only one prayer to protect — use directly
                      onUseSingleFreeze(protectablePrayers[0]);
                    } else {
                      setSelectingPrayer(true);
                    }
                  }}
                  style={{
                    backgroundColor: 'rgba(232, 168, 124, 0.1)',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    marginBottom: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: THEME.text }}>
                    🛡️ Use Single Prayer Freeze
                  </Text>
                  <Text style={{ fontSize: 12, color: THEME.accent, marginTop: 2 }}>
                    Protect one streak • {freezeInventory.single} remaining
                  </Text>
                </TouchableOpacity>
              )}

              {/* Let Streaks Break */}
              <TouchableOpacity
                onPress={onLetBreak}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#f87171' }}>
                  Let Streaks Break
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

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

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null); // null = loading
  const [showTooltip, setShowTooltip] = useState(false);
  const [showRestModal, setShowRestModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExpansionModal, setShowExpansionModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugPrayersUnlocked, setDebugPrayersUnlocked] = useState(false);
  const [showMultiplierModal, setShowMultiplierModal] = useState(false);
  const [showChallengesModal, setShowChallengesModal] = useState(false);
  const [showDifficultDayModal, setShowDifficultDayModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'garden' | 'shop' | 'challenges' | 'history'>('garden');
  // Streak freeze inventory
  const [freezeInventory, setFreezeInventory] = useState<{ single: number; all: number }>({ single: 0, all: 0 });
  // Tile interaction modals
  const [skipTileTarget, setSkipTileTarget] = useState<{ row: number; col: number } | null>(null);
  const [plantTarget, setPlantTarget] = useState<{ row: number; col: number } | null>(null);
  const [selectedTreeType, setSelectedTreeType] = useState<string>('Basic');
  const [choppingTrees, setChoppingTrees] = useState<Set<string>>(new Set());
  const [removeTreeTarget, setRemoveTreeTarget] = useState<{ row: number; col: number } | null>(null);
  const tooltipFade = useRef(new Animated.Value(0)).current;
  
  // Modal animations
  const plantModalScale = useRef(new Animated.Value(0.85)).current;
  const plantModalOpacity = useRef(new Animated.Value(0)).current;
  const skipModalScale = useRef(new Animated.Value(0.85)).current;
  const skipModalOpacity = useRef(new Animated.Value(0)).current;
  
  const premium = usePremium();
  const consistency = useConsistencyMultiplier();
  const ramadan = useRamadanMode();
  const difficultDay = useDifficultDay(premium.isPremium);
  // XP multiplier stacks: consistency × Ramadan
  const combinedXpMultiplier = consistency.multiplier * ramadan.multiplier;
  const prayerState = usePrayerState(
    premium.limits.coinMultiplier,
    combinedXpMultiplier,
    difficultDay.isActive,
  );
  const challengesHook = useChallenges();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'garden_limit' | 'premium_tree' | 'settings' | 'general'>('general');

  // Garden state hook — organic tile recovery based on XP
  // Free users capped at limits.maxGridSize; premium gets full MAX_GRID_SIZE
  const gardenState = useGardenState(prayerState.xp, prayerState.coins, (amount) => {
    prayerState.spendCoins(amount);
  }, premium.limits.maxGridSize);

  // Stable refs for callbacks that need latest state without re-creating closures
  const gardenStateRef = useRef(gardenState);
  gardenStateRef.current = gardenState;
  const earnCoinsRef = useRef(prayerState.earnCoins);
  earnCoinsRef.current = prayerState.earnCoins;

  // Prompt user when garden is ready to expand (opt-in, with delay to prevent rapid re-triggering)
  // Guard against loading: never show while AsyncStorage load is in progress
  useEffect(() => {
    if (gardenState.loading || !gardenState.canExpand || showExpansionModal) return;
    const timer = setTimeout(() => {
      setShowExpansionModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 500);
    return () => clearTimeout(timer);
  }, [gardenState.loading, gardenState.canExpand, showExpansionModal]);

  // Clear tile transitions after animations complete (~2s max stagger + animation time)
  useEffect(() => {
    if (gardenState.pendingTransitions.length > 0) {
      const timer = setTimeout(() => gardenState.clearTransitions(), 2500);
      return () => clearTimeout(timer);
    }
  }, [gardenState.pendingTransitions]);

  // Show paywall when garden hits free user's grid limit
  useEffect(() => {
    if (gardenState.gridLimitReached && !premium.isPremium) {
      setPaywallReason('garden_limit');
      setShowPaywall(true);
    }
  }, [gardenState.gridLimitReached, premium.isPremium]);

  // Consistency multiplier: record perfect day when all 5 prayers are completed
  useEffect(() => {
    if (prayerState.completedPrayers.size === 5) {
      consistency.recordPerfectDay();
    }
  }, [prayerState.completedPrayers.size]);

  // Consistency multiplier: reset when prayers are missed (after freeze resolution)
  useEffect(() => {
    if (!prayerState.stateLoaded) return;
    // If there are missed prayers that weren't frozen, reset the streak
    // This runs after freeze resolution (missedPrayers cleared = some broke)
    if (prayerState.missedPrayers.length > 0) {
      // Don't reset yet — wait until freeze resolution
      return;
    }
    // Check if any streak is 0 and state is loaded (meaning it was just reset)
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
    const key = `${row},${col}`;
    setChoppingTrees(prev => new Set(prev).add(key));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // Called when chopping animation completes
  const handleChoppingComplete = useCallback(async (row: number, col: number) => {
    const key = `${row},${col}`;
    
    // Use refs to avoid re-creating this callback when gardenState/prayerState change
    const reward = await gardenStateRef.current.removeDeadTree(row, col);
    if (reward > 0) {
      earnCoinsRef.current(reward, 'dead_tree_removal');
    }
    
    // Small delay to let React complete render cycle before clearing animation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Now remove from chopping set to unmount animation cleanly
    setChoppingTrees(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Handle recovered tile tap (where dead tree was removed → offer to plant)
  const handlePlantPress = useCallback((row: number, col: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setPlantTarget({ row, col });
      setSelectedTreeType('Basic'); // Reset to default
    }, 75);
  }, []);

  // Handle planted tree tap → offer to remove
  const handlePlantedTreePress = useCallback((row: number, col: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setRemoveTreeTarget({ row, col });
    }, 75);
  }, []);

  // Handle shop tree purchase
  const handlePurchaseTree = useCallback(async (treeId: string): Promise<boolean> => {
    const item = TREE_CATALOG.find(t => t.id === treeId);
    if (!item) return false;
    return gardenState.purchaseTree(treeId, item.price);
  }, [gardenState]);

  // Handle streak freeze purchase
  const handlePurchaseFreeze = useCallback(async (type: 'single' | 'all', cost: number): Promise<boolean> => {
    if (prayerState.coins < cost) return false;
    prayerState.spendCoins(cost);
    const updated = {
      ...freezeInventory,
      [type]: freezeInventory[type] + 1,
    };
    setFreezeInventory(updated);
    try {
      await AsyncStorage.setItem('@GrowPray:freezeInventory', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save freeze inventory:', e);
    }
    return true;
  }, [prayerState, freezeInventory]);

  // Handle IAP coin purchase (stub — replace with real RevenueCat/IAP flow before production)
  const handlePurchaseCoins = useCallback(async (packageId: string, coinAmount: number): Promise<boolean> => {
    // TODO: Replace this stub with real IAP purchase flow via RevenueCat:
    //   const product = await Purchases.getProducts([packageId]);
    //   const { customerInfo } = await Purchases.purchaseProduct(packageId);
    //   if (customerInfo) { ... credit coins ... }
    // For now, simulate successful purchase and credit coins immediately
    try {
      await prayerState.earnCoins(coinAmount, `iap_${packageId}`);
      return true;
    } catch (e) {
      console.error('Failed to process coin purchase:', e);
      return false;
    }
  }, [prayerState]);

  // ─── Challenges wrappers ──────────────────────────────────────────────────
  // Wrap prayer toggle to also track challenge progress
  const handleTogglePrayerWithChallenges = useCallback(async (prayer: string) => {
    const wasCompleted = prayerState.completedPrayers.has(prayer);
    const status = prayerState.getPrayerWindowStatus(prayer);
    const isOnTime = status === 'active';

    // Execute prayer toggle — bypass time-window if debug mode is on
    await (debugPrayersUnlocked ? prayerState.debugTogglePrayer(prayer) : prayerState.togglePrayerCompleted(prayer));

    // Update challenges
    if (wasCompleted) {
      challengesHook.undoPrayerCompletion(prayer, isOnTime);
    } else {
      challengesHook.recordPrayerCompletion(prayer, isOnTime);
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
  const closeSettingsModal = useCallback(() => setShowSettingsModal(false), []);
  const closeChallengesModal = useCallback(() => setShowChallengesModal(false), []);
  const openPaywallFromSettings = useCallback(() => {
    setPaywallReason('general');
    setShowPaywall(true);
  }, []);
  const noopResetProgress = useCallback(() => {}, []);

  // When any fullscreen modal is open, freeze the garden to free the JS thread
  const isAnyModalOpen = showSettingsModal || showChallengesModal || showShopModal || showPaywall || showRestModal || showDifficultDayModal || showExpansionModal || showHistoryModal || activeTab !== 'garden';

  // Load freeze inventory from storage
  useEffect(() => {
    AsyncStorage.getItem('@GrowPray:freezeInventory').then((val) => {
      if (val) {
        try {
          setFreezeInventory(JSON.parse(val));
        } catch (e) {
          console.error('Failed to load freeze inventory:', e);
        }
      }
    });
  }, []);

  // Freeze prompt state
  const [showFreezePrompt, setShowFreezePrompt] = useState(false);
  const [freezePromptResolved, setFreezePromptResolved] = useState(false);
  const [showFreezeProtectedBanner, setShowFreezeProtectedBanner] = useState<string | null>(null);

  // Show freeze prompt when missed prayers detected and state is loaded
  useEffect(() => {
    if (!prayerState.stateLoaded || freezePromptResolved) return;
    if (prayerState.missedPrayers.length === 0) return;

    const hasFreezes = freezeInventory.single > 0 || freezeInventory.all > 0;
    if (hasFreezes) {
      // Show prompt modal
      setShowFreezePrompt(true);
    } else {
      // No freezes — auto-resolve (let all streaks break)
      prayerState.resolveStreakFreeze([]);
      setFreezePromptResolved(true);
    }
  }, [prayerState.stateLoaded, prayerState.missedPrayers, freezeInventory, freezePromptResolved]);

  // Handle using a single prayer freeze
  const handleUseSingleFreeze = useCallback(async (prayer: string) => {
    // Deduct from inventory
    const updated = { ...freezeInventory, single: freezeInventory.single - 1 };
    setFreezeInventory(updated);
    await AsyncStorage.setItem('@GrowPray:freezeInventory', JSON.stringify(updated));

    // Resolve — protect only this prayer
    await prayerState.resolveStreakFreeze([prayer]);
    setShowFreezePrompt(false);
    setFreezePromptResolved(true);

    // Show success banner
    setShowFreezeProtectedBanner(`${prayer} streak protected! 🛡️`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setShowFreezeProtectedBanner(null), 3000);
  }, [freezeInventory, prayerState]);

  // Handle using all-prayers freeze
  const handleUseAllFreeze = useCallback(async () => {
    // Deduct from inventory
    const updated = { ...freezeInventory, all: freezeInventory.all - 1 };
    setFreezeInventory(updated);
    await AsyncStorage.setItem('@GrowPray:freezeInventory', JSON.stringify(updated));

    // Resolve — protect all missed prayers
    await prayerState.resolveStreakFreeze([...prayerState.missedPrayers]);
    setShowFreezePrompt(false);
    setFreezePromptResolved(true);

    // Show success banner
    setShowFreezeProtectedBanner('All streaks protected! 🛡️');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setShowFreezeProtectedBanner(null), 3000);
  }, [freezeInventory, prayerState]);

  // Handle letting streaks break
  const handleLetStreaksBreak = useCallback(async () => {
    await prayerState.resolveStreakFreeze([]);
    setShowFreezePrompt(false);
    setFreezePromptResolved(true);
  }, [prayerState]);

  // Check if onboarding is needed
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setShowOnboarding(val !== 'true');
    });
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    // Show tooltip after onboarding
    AsyncStorage.getItem(TOOLTIP_KEY).then((val) => {
      if (val !== 'true') {
        setShowTooltip(true);
        Animated.timing(tooltipFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          Animated.timing(tooltipFade, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowTooltip(false));
          AsyncStorage.setItem(TOOLTIP_KEY, 'true');
        }, 5000);
      }
    });
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
    sendTestNotifications
  } = useNotifications(
    isResting ? null : prayerState.timings,  // Don't schedule if resting
    prayerState.completedPrayers,
    isResting ? null : prayerState.deadlines,
    gardenState.lastXPGainTimestamp,
    gardenState.totalRecoveredTiles > 0,
  );

  // Pre-load the loading screen image first, then load everything else
  useEffect(() => {
    const loadAssets = async () => {
      try {
        // Step 1: Pre-load the loading screen image so it's immediately available
        await Asset.loadAsync([LOADING_SCREEN_IMAGE]);

        // Step 2: Load all remaining game assets behind the loading screen
        await Asset.loadAsync([
          // Ground tiles
          require('./assets/Garden Assets/Ground Tiles/Dead_Tile.png'),
          require('./assets/Garden Assets/Ground Tiles/Recovering_Tile.png'),
          require('./assets/Garden Assets/Ground Tiles/Recovered_Tile.png'),
          // Tile decorations
          require('./assets/Garden Assets/Ground Tiles/Dead_Grass_Tuft.png'),
          require('./assets/Garden Assets/Ground Tiles/Pebbles.png'),
          require('./assets/Garden Assets/Ground Tiles/Wildflowers.png'),
          require('./assets/Garden Assets/Ground Tiles/Grass_Blades.png'),
          require('./assets/Garden Assets/Ground Tiles/Mushrooms.png'),
          require('./assets/Garden Assets/Ground Tiles/Clovers.png'),
          // Trees
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
          // Effects
          require('./assets/Garden Assets/Effects/Ember_Mote.png'),
          require('./assets/Garden Assets/Effects/Dew_Sparkle.png'),
          require('./assets/Garden Assets/Effects/Pollen_Mote.png'),
          require('./assets/Garden Assets/Effects/Falling_Leaf.png'),
          require('./assets/Garden Assets/Effects/Fruit_Common.png'),
          require('./assets/Garden Assets/Effects/Fruit_Premium.png'),
          require('./assets/Garden Assets/Effects/xp_badge.png'),
          // Icons
          require('./assets/Garden Assets/Icons/Axe.png'),
          require('./assets/Garden Assets/Icons/Fajr.png'),
          require('./assets/Garden Assets/Icons/Dhuhr.png'),
          require('./assets/Garden Assets/Icons/Asr.png'),
          require('./assets/Garden Assets/Icons/Maghrib.png'),
          require('./assets/Garden Assets/Icons/Isha.png'),
        ]);
      } catch (error) {
        console.error('Error loading assets:', error);
      } finally {
        setIsReady(true);
      }
    };

    loadAssets();
  }, []);

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
        <OnboardingScreen onComplete={handleOnboardingComplete} />
        <LoadingOverlay
          ready={isReady}
          onImageLoaded={() => SplashScreen.hideAsync().catch(() => {})}
        />
      </>
    );
  }

  return (
    <SafeAreaProvider>
    <ImageBackground
        source={require('./assets/Garden Assets/Icons/Starry_Night_Sky.png')}
        style={{ flex: 1, backgroundColor: THEME.bg }}
        resizeMode="cover"
      >
      <StatusBar style="light" />
      
      {/* Content area — fills space above bottom bar */}
      <View style={{ flex: 1 }}>

      {/* Fullscreen Garden Scene - Behind everything, receives XP for tree growth */}
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
        onChoppingComplete={handleChoppingComplete}
        frozen={isAnyModalOpen}
      />
      
      {/* Rest Overlay - Shows when in rest mode */}
      {isResting && (
        <RestOverlay 
          daysRemaining={getDaysRemaining()} 
          onEndRest={endRestPeriod} 
        />
      )}
      
      {/* XP Popup - Floating animation when earning XP */}
      <XPPopup 
        amount={prayerState.xpPopup.amount}
        baseAmount={prayerState.xpPopup.baseAmount}
        multiplier={prayerState.xpPopup.multiplier}
        visible={prayerState.xpPopup.visible}
        onComplete={prayerState.hideXpPopup}
      />

      {/* Coin Popup - Floating "+X 🪙" animation */}
      <CoinPopup
        amount={prayerState.coinPopup.amount}
        visible={prayerState.coinPopup.visible}
        onComplete={prayerState.hideCoinPopup}
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
      
      {/* Settings Modal */}
      <SettingsModal
        visible={showSettingsModal}
        onClose={closeSettingsModal}
        streaks={prayerState.streaks}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={toggleNotifications}
        isPremium={premium.isPremium}
        onOpenPaywall={openPaywallFromSettings}
        onRestorePurchases={premium.restorePurchases}
        onResetProgress={noopResetProgress}
      />

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
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🌱</Text>
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
                Expand! 🌿
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowExpansionModal(false)}
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

      {/* Skip Tile Recovery Modal — spend coins to instantly recover a tile */}
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
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.accent, marginBottom: 8 }}>
              Speed Up Recovery?
            </Text>
            <Text style={{ fontSize: 14, color: THEME.text, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              This tile is recovering. Spend coins to restore it instantly!
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fbbf24', marginBottom: 4 }}>
              🪙 {skipTileTarget ? gardenState.getSkipCost(skipTileTarget.row, skipTileTarget.col) : 0} coins
            </Text>
            <Text style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 20 }}>
              You have: 🪙 {prayerState.coins}
            </Text>
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

      {/* Plant Tree Modal — tap recovered tile (with dead tree removed) to plant */}
      <Modal
        visible={plantTarget !== null}
        transparent
        animationType="none"
        onRequestClose={() => setPlantTarget(null)}
      >
        <TouchableWithoutFeedback onPress={() => setPlantTarget(null)}>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
          }}>
            <TouchableWithoutFeedback>
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
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.accent, marginBottom: 8 }}>
              Plant a Tree
            </Text>
            <Text style={{ fontSize: 14, color: THEME.text, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              Choose a tree type and watch it grow as you pray.
            </Text>

            {/* Tree type picker */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4, marginBottom: 16 }}
            >
              {(() => {
                const ownedTypes = gardenState.getOwnedTreeTypes();
                return ownedTypes.map((typeId) => {
                  const catalogItem = TREE_CATALOG.find(t => t.id === typeId);
                  if (!catalogItem) return null;
                  const isSelected = selectedTreeType === typeId;
                  const count = typeId === 'Basic' ? Infinity : (gardenState.treeInventory[typeId] || 0);
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
                });
              })()}
            </ScrollView>

            {gardenState.getOwnedTreeTypes().length <= 1 && (
              <TouchableOpacity
                onPress={() => {
                  setPlantTarget(null);
                  setShowShopModal(true);
                }}
                style={{ marginBottom: 12 }}
              >
                <Text style={{ fontSize: 12, color: '#fbbf24', fontWeight: '600' }}>
                  🏠 Visit Shop for more tree types
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                onPress={() => setPlantTarget(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: THEME.textSecondary, fontSize: 14, fontWeight: '600' }}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (plantTarget) {
                    // Consume from inventory (Basic is free/unlimited)
                    const canUse = await gardenState.useTreeFromInventory(selectedTreeType);
                    if (canUse) {
                      const success = await gardenState.plantTree(
                        plantTarget.row, plantTarget.col, selectedTreeType, prayerState.xp
                      );
                      if (success) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        // Track for weekly challenges
                        challengesHook.recordTreePlanted();
                      }
                    }
                  }
                  setPlantTarget(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#22c55e',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Plant! 🌳</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
            </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Remove Planted Tree Modal */}
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
            <Image source={AXE_ICON} style={{ width: 64, height: 64, marginBottom: 8 }} resizeMode="contain" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#f87171', marginBottom: 8 }}>
              Remove Tree?
            </Text>
            <Text style={{ fontSize: 14, color: THEME.text, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
              This tree will be removed and won't be refunded.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                onPress={() => setRemoveTreeTarget(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: THEME.textSecondary, fontSize: 14, fontWeight: '600' }}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (removeTreeTarget) {
                    await gardenState.removePlantedTree(removeTreeTarget.row, removeTreeTarget.col);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                  setRemoveTreeTarget(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#dc2626',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Remove</Text>
              </TouchableOpacity>
            </View>
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
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>⚡</Text>
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
                      🏆 Maximum tier reached!
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
                    ⚠️ Missing any prayer resets your streak to 0.{'\n'}
                    💡 Use streak freezes from the shop to protect your prayers — if no prayer breaks, your perfect day streak stays alive!
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
        freezeInventory={freezeInventory}
        onPurchaseFreeze={handlePurchaseFreeze}
        onPurchaseCoins={handlePurchaseCoins}
      />

      {/* Challenges Modal */}
      <ChallengesModal
        visible={showChallengesModal}
        onClose={closeChallengesModal}
        challenges={challengesHook.challengesList}
        onClaimReward={handleClaimChallengeReward}
      />

      {/* Difficult Day Modal */}
      <DifficultDayModal
        visible={showDifficultDayModal}
        onClose={() => setShowDifficultDayModal(false)}
        onActivate={async () => {
          const success = await difficultDay.activate();
          if (success) {
            setShowDifficultDayModal(false);
          }
        }}
        usesRemaining={difficultDay.usesRemaining}
        maxUses={difficultDay.maxUses}
        isPremium={premium.isPremium}
      />

      {/* Freeze Prompt Modal */}
      <FreezePromptModal
        visible={showFreezePrompt}
        missedPrayers={prayerState.missedPrayers}
        freezeInventory={freezeInventory}
        streaks={prayerState.streaks}
        onUseSingleFreeze={handleUseSingleFreeze}
        onUseAllFreeze={handleUseAllFreeze}
        onLetBreak={handleLetStreaksBreak}
      />

      {/* Streak Protected Banner */}
      {showFreezeProtectedBanner && (
        <View style={{
          position: 'absolute',
          top: 100,
          left: 24,
          right: 24,
          zIndex: 1000,
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: 'rgba(232, 168, 124, 0.9)',
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 16,
          }}>
            <Text style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '700',
              textAlign: 'center',
            }}>
              {showFreezeProtectedBanner}
            </Text>
          </View>
        </View>
      )}

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseMonthly={premium.purchaseMonthly}
        onPurchaseYearly={premium.purchaseYearly}
        onRestore={premium.restorePurchases}
        triggerReason={paywallReason}
      />

      {/* Debug Modal - Decay Testing */}
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

      {/* Tab page views — full screen when non-garden tab is active */}
      {activeTab !== 'garden' && (
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: THEME.bg }}>
          {activeTab === 'shop' && (
            <ShopModal
              asPage
              visible
              onClose={() => setActiveTab('garden')}
              coins={prayerState.coins}
              inventory={gardenState.treeInventory}
              onPurchaseTree={handlePurchaseTree}
              isPremium={premium.isPremium}
              onPremiumTap={() => { setActiveTab('garden'); setPaywallReason('premium_tree'); setShowPaywall(true); }}
              freezeInventory={freezeInventory}
              onPurchaseFreeze={handlePurchaseFreeze}
              onPurchaseCoins={handlePurchaseCoins}
            />
          )}
          {activeTab === 'challenges' && (
            <ChallengesModal
              asPage
              visible
              onClose={() => setActiveTab('garden')}
              challenges={challengesHook.challengesList}
              onClaimReward={handleClaimChallengeReward}
            />
          )}
          {activeTab === 'history' && (
            <PrayerHistoryModal
              asPage
              visible
              onClose={() => setActiveTab('garden')}
              streaks={prayerState.streaks}
              prayerHistory={prayerState.prayerHistory}
              completedToday={prayerState.completedPrayers}
            />
          )}
        </SafeAreaView>
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
        {/* Soft gradient transition — deep navy fading into transparent */}
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
            timeUntilNext={isResting ? 'Resting' : prayerState.timeUntilNext}
            ringProgress={isResting ? 0 : prayerState.ringProgress}
            freezeCount={freezeInventory.single + freezeInventory.all}
            consistencyMultiplier={consistency.multiplier}
            onMultiplierPress={() => setShowMultiplierModal(true)}
            isRamadan={ramadan.isRamadan}
            ramadanDay={ramadan.ramadanDay}
            ramadanMultiplier={ramadan.multiplier}
            difficultDayActive={difficultDay.isActive}
          />
        )}
        </SafeAreaView>
      </View>
      )}

      </View>
      {/* End content area */}

      {/* Bottom area: Prayer Bar + Tab Bar — in normal flex flow */}
      <SafeAreaView 
        edges={['bottom']} 
        style={{ 
          backgroundColor: THEME.bg,
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
              if (tab === 'more') { setShowMoreMenu(true); return; }
              setActiveTab(tab as 'garden' | 'shop' | 'challenges' | 'history');
            }}
            challengeClaimable={challengesHook.totalClaimable}
          />
        )}
      </SafeAreaView>

      {/* More Menu popup */}
      <MoreMenu
        visible={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        onSettings={() => setShowSettingsModal(true)}
        onDifficultDay={() => setShowDifficultDayModal(true)}
        onRest={() => setShowRestModal(true)}
        onPremium={() => { setPaywallReason('settings'); setShowPaywall(true); }}
        onDebug={() => setShowDebugModal(true)}
        difficultDayActive={difficultDay.isActive}
        isPremium={premium.isPremium}
      />

      {/* First-time tooltip */}
      {showTooltip && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 200,
            left: 24,
            right: 24,
            opacity: tooltipFade,
            alignItems: 'center',
            zIndex: 200,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.95)',
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
              👇 Tap a prayer icon when you complete it
            </Text>
          </View>
          {/* Arrow pointing down */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 10,
              borderRightWidth: 10,
              borderTopWidth: 10,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: 'rgba(16, 185, 129, 0.95)',
              marginTop: -1,
            }}
          />
        </Animated.View>
      )}
    </ImageBackground>
      <LoadingOverlay
        ready={isReady && !gardenState.loading && prayerState.stateLoaded}
        onImageLoaded={() => SplashScreen.hideAsync().catch(() => {})}
      />
    </SafeAreaProvider>
  );
}
