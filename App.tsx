import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { Text, View, ActivityIndicator, TouchableOpacity, Image, Animated, Modal, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GardenScene } from './components/GardenScene';
import { useGardenState, TileState } from './hooks/useGardenState';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ShopModal, TREE_CATALOG } from './components/ShopModal';
import { Asset } from 'expo-asset';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePrayerTimes } from './hooks/usePrayerTimes';
import { useNotifications } from './hooks/useNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const COMPLETED_PRAYERS_KEY = '@GrowPray:completedPrayers';
const STREAKS_KEY = '@GrowPray:streaks'; // Per-prayer streaks
const XP_KEY = '@GrowPray:xp';
const COINS_KEY = '@GrowPray:coins';
const GRACE_PERIOD_KEY = '@GrowPray:gracePeriodMinutes';
const REST_PERIOD_KEY = '@GrowPray:restPeriod';

// Per-prayer streak type
type PrayerStreaks = Record<string, number>;
const DEFAULT_STREAKS: PrayerStreaks = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };

// XP rewards
const XP_ON_TIME = 5;      // Full XP for completing during active window
const XP_GRACE_PERIOD = 3; // Reduced XP for completing during grace period

// Grace period default in minutes (user can configure 15/30/45/60)
const DEFAULT_GRACE_PERIOD_MINUTES = 30;

// Coin rewards
const COINS_PER_PRAYER = 2;          // Base coins per prayer
const COINS_ALL_FIVE_BONUS = 10;     // Bonus for completing all 5 in a day
const COINS_7DAY_MILESTONE = 50;     // Bonus at 7-day streak
const COINS_30DAY_MILESTONE = 200;   // Bonus at 30-day streak

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
          backgroundColor: '#1a1a2e',
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 320,
          borderWidth: 1,
          borderColor: 'rgba(139, 92, 246, 0.3)',
        }}>
          {/* Header */}
          <Text style={{
            fontSize: 20,
            fontWeight: '700',
            color: '#e8dcc8',
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
                    ? 'rgba(139, 92, 246, 0.8)' 
                    : 'rgba(55, 65, 81, 0.5)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: selectedDays === days ? 2 : 1,
                  borderColor: selectedDays === days 
                    ? '#a78bfa' 
                    : 'rgba(75, 85, 99, 0.5)',
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
            color: '#a78bfa',
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
                backgroundColor: 'rgba(55, 65, 81, 0.5)',
                borderWidth: 1,
                borderColor: 'rgba(75, 85, 99, 0.5)',
              }}
            >
              <Text style={{
                color: '#9ca3af',
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
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderWidth: 1,
                borderColor: '#10b981',
              }}
            >
              <Text style={{
                color: '#fff',
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
        backgroundColor: 'rgba(26, 26, 46, 0.95)',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
        maxWidth: 280,
      }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🌙</Text>
        
        <Text style={{
          fontSize: 22,
          fontWeight: '700',
          color: '#e8dcc8',
          marginBottom: 8,
        }}>
          Resting...
        </Text>
        
        <Text style={{
          fontSize: 16,
          color: '#a78bfa',
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
            backgroundColor: 'rgba(55, 65, 81, 0.5)',
            borderWidth: 1,
            borderColor: 'rgba(75, 85, 99, 0.5)',
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

// Top Info Bar - Shows best streak, coins, next prayer countdown, XP
function TopInfoBar({ 
  streaks, 
  coins,
  xp, 
  nextPrayer, 
  timeUntilNext 
}: { 
  streaks: PrayerStreaks; 
  coins: number;
  xp: number; 
  nextPrayer: string | null; 
  timeUntilNext: string;
}) {
  const bestStreak = Math.max(...Object.values(streaks));
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 6,
    }}>
      {/* Streak Badge */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(26, 26, 46, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: bestStreak > 0 ? 'rgba(251, 146, 60, 0.4)' : 'rgba(107, 114, 128, 0.3)',
      }}>
        <Text style={{ fontSize: 14, marginRight: 3 }}>🔥</Text>
        <Text style={{ 
          fontSize: 14, 
          fontWeight: '700', 
          color: bestStreak > 0 ? '#fb923c' : '#6b7280',
        }}>
          {bestStreak}
        </Text>
      </View>

      {/* Coin Badge */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(26, 26, 46, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
      }}>
        <Text style={{ fontSize: 14, marginRight: 3 }}>🪙</Text>
        <Text style={{ 
          fontSize: 14, 
          fontWeight: '700', 
          color: '#fbbf24',
        }}>
          {coins}
        </Text>
      </View>

      {/* Next Prayer Countdown */}
      <View style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(26, 26, 46, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.4)',
      }}>
        <Text style={{ 
          fontSize: 11, 
          fontWeight: '600', 
          color: '#fbbf24',
        }}>
          {nextPrayer ? `${nextPrayer} in ${timeUntilNext}` : 'All done! ✨'}
        </Text>
      </View>

      {/* XP Badge */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(26, 26, 46, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
      }}>
        <Image 
          source={XP_BADGE}
          style={{ 
            width: 18, 
            height: 18,
            marginRight: 4,
          }}
          resizeMode="contain"
        />
        <Text style={{ 
          fontSize: 14, 
          fontWeight: '700', 
          color: '#10b981',
        }}>
          {xp}
        </Text>
      </View>
    </View>
  );
}

// Floating Prayer Bar - Bottom overlay with prayer icons
function FloatingPrayerBar({
  timings,
  nextPrayer,
  completedPrayers,
  onTogglePrayer,
  getPrayerWindowStatus,
  streaks,
}: {
  timings: Record<string, string> | null;
  nextPrayer: string | null;
  completedPrayers: Set<string>;
  onTogglePrayer: (prayer: string) => void;
  getPrayerWindowStatus: (prayer: string) => 'active' | 'grace' | 'missed' | 'upcoming';
  streaks: PrayerStreaks;
}) {
  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  // Combine window status with completion status
  const getPrayerStatus = (prayer: string): 'completed' | 'active' | 'grace' | 'missed' | 'upcoming' => {
    if (completedPrayers.has(prayer)) return 'completed';
    return getPrayerWindowStatus(prayer);
  };

  return (
    <View style={{
      backgroundColor: 'rgba(26, 26, 46, 0.9)',
      paddingTop: 12,
      paddingBottom: 28,
      paddingHorizontal: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 24,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
      borderWidth: 1,
      borderColor: 'rgba(232, 220, 200, 0.15)',
    }}>
      {prayers.map((prayer) => {
        const status = getPrayerStatus(prayer);
        const isCompleted = status === 'completed';
        const isActive = status === 'active';
        const isGrace = status === 'grace';
        const isMissed = status === 'missed';
        const isUpcoming = status === 'upcoming';
        const canTap = isActive || isGrace || isCompleted;
        
        // Subtle border color to indicate status - never blocks the image
        let borderColor = 'rgba(107, 114, 128, 0.3)'; // Default gray for upcoming
        if (isCompleted) borderColor = '#4ade80';
        else if (isActive) borderColor = '#4ade80';
        else if (isGrace) borderColor = '#fbbf24';
        else if (isMissed) borderColor = 'rgba(239, 68, 68, 0.6)';

        // Text color matches border
        let textColor = '#9ca3af';
        if (isCompleted) textColor = '#4ade80';
        else if (isActive) textColor = '#4ade80';
        else if (isGrace) textColor = '#fbbf24';
        else if (isMissed) textColor = '#ef4444';
        
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
                width: 56,
                height: 56,
                borderRadius: 28,
                borderWidth: 2,
                borderColor: borderColor,
                backgroundColor: 'transparent',
              }}
            >
              {/* Prayer icon - ALWAYS fully visible */}
              <Image 
                source={PRAYER_ICONS[prayer as keyof typeof PRAYER_ICONS]}
                style={{ 
                  width: 52, 
                  height: 52, 
                  borderRadius: 26,
                }}
                resizeMode="cover"
              />
            
            {/* Small corner badge for completed - just a tiny checkmark */}
            {isCompleted && (
              <View style={{ 
                position: 'absolute', 
                bottom: -2, 
                right: -2, 
                backgroundColor: '#4ade80',
                borderRadius: 10,
                width: 18,
                height: 18,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: 'rgba(26, 26, 46, 0.9)',
              }}>
                <MaterialCommunityIcons name="check" size={12} color="#fff" />
              </View>
            )}

            {/* Small corner badge for grace period - tiny clock */}
            {isGrace && !isCompleted && (
              <View style={{ 
                position: 'absolute', 
                bottom: -2, 
                right: -2, 
                backgroundColor: '#fbbf24',
                borderRadius: 10,
                width: 18,
                height: 18,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: 'rgba(26, 26, 46, 0.9)',
              }}>
                <MaterialCommunityIcons name="clock-alert-outline" size={11} color="#1a1a2e" />
              </View>
            )}
            </TouchableOpacity>
            
            {/* Prayer Name - always visible, now OUTSIDE the TouchableOpacity */}
            <Text 
              style={{
                marginTop: 6,
                fontSize: 10,
                fontWeight: '700',
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
                <Text style={{ fontSize: 9, color: '#fb923c' }}>🔥</Text>
                <Text style={{
                  fontSize: 9,
                  fontWeight: '700',
                  color: '#fb923c',
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

// Particle component for XP burst effect
function Particle({ delay, angle }: { delay: number; angle: number }) {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateX = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(0))[0];

  useEffect(() => {
    fadeAnim.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);

    const distance = 40;
    const xDist = Math.cos(angle) * distance;
    const yDist = Math.sin(angle) * distance;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: xDist,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: yDist,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
        opacity: fadeAnim,
        transform: [{ translateX }, { translateY }],
      }}
    />
  );
}

// XP Popup Component - With particles, sound, and haptics
function XPPopup({ amount, visible, onComplete }: { amount: number; visible: boolean; onComplete: () => void }) {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];
  const glowAnim = useState(new Animated.Value(0))[0];
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    if (visible) {
      // Play haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Play sound effect (using system sound for now)
      playSound();

      // Reset values
      fadeAnim.setValue(1);
      translateY.setValue(0);
      scaleAnim.setValue(0.8);
      glowAnim.setValue(0);
      setShowParticles(true);
      
      // Multi-stage animation
      Animated.parallel([
        // Badge pop-in with bounce
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
        // Glow pulse
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 200,
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
          toValue: -70,
          duration: 1200,
          useNativeDriver: true,
        }),
        // Fade out
        Animated.sequence([
          Animated.delay(700),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
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

  // Generate 8 particles in a circle pattern
  const particles = Array.from({ length: 8 }, (_, i) => ({
    angle: (Math.PI * 2 * i) / 8,
    delay: i * 20,
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
          transform: [{ translateY }, { scale: scaleAnim }],
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
        </View>
      </Animated.View>
    </View>
  );
}

// Main Prayer State Management Hook
function usePrayerState() {
  const { timings, nextPrayer, loading } = usePrayerTimes();
  const [completedPrayers, setCompletedPrayers] = useState<Set<string>>(new Set());
  const [streaks, setStreaks] = useState<PrayerStreaks>({ ...DEFAULT_STREAKS });
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(DEFAULT_GRACE_PERIOD_MINUTES);
  const [timeUntilNext, setTimeUntilNext] = useState('--:--');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [xpPopup, setXpPopup] = useState<{ visible: boolean; amount: number }>({ visible: false, amount: 0 });

  // Update current time every minute for prayer window calculations
  useEffect(() => {
    loadState(); // Load saved state on mount
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate time until next prayer
  useEffect(() => {
    if (!timings || !nextPrayer) {
      setTimeUntilNext('--:--');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const timeStr = timings[nextPrayer];
      if (!timeStr) return;

      const [hours, minutes] = timeStr.split(':').map(Number);
      const prayerTime = new Date();
      prayerTime.setHours(hours, minutes, 0, 0);

      // If prayer time has passed, it's likely tomorrow's first prayer
      if (prayerTime <= now) {
        prayerTime.setDate(prayerTime.getDate() + 1);
      }

      const diff = prayerTime.getTime() - now.getTime();
      const diffHours = Math.floor(diff / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHours > 0) {
        setTimeUntilNext(`${diffHours}h ${diffMinutes}m`);
      } else {
        setTimeUntilNext(`${diffMinutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
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

      // Check each prayer individually - reset streak only for missed prayers
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      
      if (savedPrayersData && savedPrayersData.date === yesterdayStr) {
        const completedYesterday = new Set(savedPrayersData.prayers);
        const allPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        
        // Only reset streaks for prayers that were missed
        allPrayers.forEach(prayer => {
          if (!completedYesterday.has(prayer)) {
            currentStreaks[prayer] = 0;
          }
        });
      } else if (savedPrayersData && savedPrayersData.date < yesterdayStr) {
        // Data is older than yesterday - all streaks broken
        currentStreaks = { ...DEFAULT_STREAKS };
      }

      // Save updated streaks
      await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify({
        counts: currentStreaks,
        lastDate: today,
      }));
      setStreaks(currentStreaks);

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

      // Load grace period setting
      const storedGrace = await AsyncStorage.getItem(GRACE_PERIOD_KEY);
      if (storedGrace) {
        setGracePeriodMinutes(JSON.parse(storedGrace));
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  };

  // Helper: Convert time string (HH:MM) to minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Get the end time of a prayer (when the next prayer starts)
  const getPrayerEndTime = (prayer: string): number => {
    if (!timings) return 0;
    
    const prayerIndex = PRAYER_ORDER.indexOf(prayer as typeof PRAYER_ORDER[number]);
    
    // For Isha, it ends at Fajr next day (midnight + Fajr time)
    if (prayer === 'Isha') {
      const fajrMinutes = timeToMinutes(timings.Fajr);
      return 24 * 60 + fajrMinutes; // Next day's Fajr
    }
    
    // For other prayers, they end when the next prayer starts
    const nextPrayerName = PRAYER_ORDER[prayerIndex + 1];
    if (nextPrayerName && timings[nextPrayerName]) {
      return timeToMinutes(timings[nextPrayerName]);
    }
    
    return 24 * 60; // End of day fallback
  };

  // Determine the status of a prayer's time window
  const getPrayerWindowStatus = (prayer: string): 'active' | 'grace' | 'missed' | 'upcoming' => {
    if (!timings) return 'upcoming';
    
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const prayerStartMinutes = timeToMinutes(timings[prayer]);
    const prayerEndMinutes = getPrayerEndTime(prayer);
    
    // Handle Isha special case (crosses midnight)
    if (prayer === 'Isha') {
      const isAfterIsha = currentMinutes >= prayerStartMinutes;
      const isBeforeFajr = currentMinutes < timeToMinutes(timings.Fajr);
      
      if (isAfterIsha) {
        // After Isha start, check if within grace
        const graceEndMinutes = prayerEndMinutes + gracePeriodMinutes;
        const adjustedCurrent = currentMinutes;
        if (adjustedCurrent < prayerEndMinutes || adjustedCurrent < graceEndMinutes) {
          return 'active'; // Isha is active until Fajr
        }
      } else if (isBeforeFajr) {
        return 'active'; // Still in Isha time (after midnight but before Fajr)
      }
    }
    
    // Prayer hasn't started yet
    if (currentMinutes < prayerStartMinutes) {
      return 'upcoming';
    }
    
    // Prayer is currently active (within its time window)
    if (currentMinutes >= prayerStartMinutes && currentMinutes < prayerEndMinutes) {
      return 'active';
    }
    
    // Check if in grace period (prayer ended but within grace window)
    const graceEndMinutes = prayerEndMinutes + gracePeriodMinutes;
    if (currentMinutes >= prayerEndMinutes && currentMinutes < graceEndMinutes) {
      return 'grace';
    }
    
    // Prayer window and grace period have passed
    return 'missed';
  };

  // Check if user can complete a prayer (active or grace period)
  const canCompletePrayer = (prayer: string): boolean => {
    const status = getPrayerWindowStatus(prayer);
    return status === 'active' || status === 'grace';
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
      
      // Award XP based on whether it's active or grace period
      const status = getPrayerWindowStatus(prayer);
      const xpEarned = status === 'active' ? XP_ON_TIME : XP_GRACE_PERIOD;
      const newXp = xp + xpEarned;
      setXp(newXp);
      
      // Show XP popup
      setXpPopup({ visible: true, amount: xpEarned });
      
      // Persist XP
      await AsyncStorage.setItem(XP_KEY, JSON.stringify(newXp));
      
      // Increment this prayer's streak
      const newStreaks = { ...streaks, [prayer]: (streaks[prayer] || 0) + 1 };
      setStreaks(newStreaks);
      await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify({ 
        counts: newStreaks, 
        lastDate: new Date().toDateString() 
      }));

      // --- Coin earning ---
      let coinsEarned = COINS_PER_PRAYER;

      // Check for all-5-prayers bonus
      if (newCompleted.size === 5) {
        coinsEarned += COINS_ALL_FIVE_BONUS;
      }

      // Check for streak milestones on this prayer
      const newPrayerStreak = newStreaks[prayer];
      if (newPrayerStreak === 7) coinsEarned += COINS_7DAY_MILESTONE;
      if (newPrayerStreak === 30) coinsEarned += COINS_30DAY_MILESTONE;

      const newCoins = coins + coinsEarned;
      setCoins(newCoins);
      await AsyncStorage.setItem(COINS_KEY, JSON.stringify(newCoins));
    }
    setCompletedPrayers(newCompleted);

    // Persist completed prayers
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify({
        date: today,
        prayers: Array.from(newCompleted),
      }));
    } catch (error) {
      console.error('Error saving completed prayers:', error);
    }
  };

  // Hide XP popup
  const hideXpPopup = () => {
    setXpPopup({ visible: false, amount: 0 });
  };

  const updateGracePeriod = async (minutes: number) => {
    setGracePeriodMinutes(minutes);
    await AsyncStorage.setItem(GRACE_PERIOD_KEY, JSON.stringify(minutes));
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
    nextPrayer,
    loading,
    completedPrayers,
    streaks,
    xp,
    coins,
    gracePeriodMinutes,
    updateGracePeriod,
    xpPopup,
    hideXpPopup,
    timeUntilNext,
    canCompletePrayer,
    togglePrayerCompleted,
    getPrayerWindowStatus,
    spendCoins,
    earnCoins,
  };
}

const ONBOARDING_KEY = '@JannahGarden:onboardingComplete';
const TOOLTIP_KEY = '@JannahGarden:tooltipShown';

// Settings Modal
function SettingsModal({
  visible,
  onClose,
  gracePeriodMinutes,
  onGracePeriodChange,
  streaks,
}: {
  visible: boolean;
  onClose: () => void;
  gracePeriodMinutes: number;
  onGracePeriodChange: (minutes: number) => void;
  streaks: PrayerStreaks;
}) {
  const graceOptions = [15, 30, 45, 60];

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
          backgroundColor: '#1a1a2e',
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 340,
          borderWidth: 1,
          borderColor: 'rgba(16, 185, 129, 0.3)',
          maxHeight: '80%',
        }}>
          {/* Header */}
          <Text style={{
            fontSize: 20,
            fontWeight: '700',
            color: '#e8dcc8',
            textAlign: 'center',
            marginBottom: 20,
          }}>
            ⚙️ Settings
          </Text>

          {/* Grace Period Section */}
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 12,
          }}>
            Grace Period
          </Text>
          <Text style={{
            fontSize: 12,
            color: '#6b7280',
            marginBottom: 12,
          }}>
            How long after a prayer window ends can you still earn grace XP?
          </Text>
          <View style={{
            flexDirection: 'row',
            gap: 8,
            marginBottom: 24,
          }}>
            {graceOptions.map((mins) => (
              <TouchableOpacity
                key={mins}
                onPress={() => onGracePeriodChange(mins)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: gracePeriodMinutes === mins
                    ? 'rgba(16, 185, 129, 0.8)'
                    : 'rgba(55, 65, 81, 0.5)',
                  borderWidth: gracePeriodMinutes === mins ? 2 : 1,
                  borderColor: gracePeriodMinutes === mins
                    ? '#10b981'
                    : 'rgba(75, 85, 99, 0.5)',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: gracePeriodMinutes === mins ? '#fff' : '#9ca3af',
                }}>
                  {mins}
                </Text>
                <Text style={{
                  fontSize: 10,
                  color: gracePeriodMinutes === mins ? 'rgba(255,255,255,0.7)' : '#6b7280',
                }}>
                  min
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Per-Prayer Streaks Section */}
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 12,
          }}>
            Prayer Streaks
          </Text>
          {PRAYER_ORDER.map((prayer) => (
            <View key={prayer} style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(75, 85, 99, 0.2)',
            }}>
              <Text style={{ fontSize: 15, color: '#e8dcc8' }}>{prayer}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#fb923c', marginRight: 4 }}>🔥</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fb923c' }}>
                  {streaks[prayer] || 0}
                </Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>days</Text>
              </View>
            </View>
          ))}

          {/* DEV: Reset Progress Button */}
          <TouchableOpacity
            onPress={async () => {
              // Clear all progress
              await AsyncStorage.multiRemove([
                COMPLETED_PRAYERS_KEY,
                STREAKS_KEY,
                XP_KEY,
                COINS_KEY,
                '@GrowPray:gardenState',
                REST_PERIOD_KEY,
              ]);
              // Reload the app
              onClose();
              alert('Progress reset! Reload the app to see changes.');
            }}
            style={{
              marginTop: 24,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(220, 38, 38, 0.8)',
              borderWidth: 1,
              borderColor: '#dc2626',
            }}
          >
            <Text style={{
              color: '#fff',
              fontSize: 14,
              fontWeight: '600',
              textAlign: 'center',
            }}>
              🔄 DEV: Reset All Progress
            </Text>
          </TouchableOpacity>

          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              marginTop: 12,
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              borderWidth: 1,
              borderColor: '#10b981',
            }}
          >
            <Text style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
            }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  // Streak freeze inventory
  const [freezeInventory, setFreezeInventory] = useState<{ single: number; all: number }>({ single: 0, all: 0 });
  // Tile interaction modals
  const [skipTileTarget, setSkipTileTarget] = useState<{ row: number; col: number } | null>(null);
  const [plantTarget, setPlantTarget] = useState<{ row: number; col: number } | null>(null);
  const [selectedTreeType, setSelectedTreeType] = useState<string>('Basic');
  const [choppingTree, setChoppingTree] = useState<{ row: number; col: number } | null>(null);
  const [removeTreeTarget, setRemoveTreeTarget] = useState<{ row: number; col: number } | null>(null);
  const tooltipFade = useRef(new Animated.Value(0)).current;
  const prayerState = usePrayerState();

  // Garden state hook — organic tile recovery based on XP
  const gardenState = useGardenState(prayerState.xp, prayerState.coins, (amount) => {
    prayerState.spendCoins(amount);
  });

  // Detect garden expansion
  useEffect(() => {
    if (gardenState.gridJustExpanded) {
      setShowExpansionModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      gardenState.clearExpansionFlag();
    }
  }, [gardenState.gridJustExpanded]);

  // Handle tile tap (recovering tiles → show skip modal)
  const handleTilePress = useCallback((row: number, col: number, state: TileState) => {
    if (state === 'recovering') {
      setSkipTileTarget({ row, col });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Handle dead tree tap (on recovering tiles → start chopping animation)
  const handleDeadTreePress = useCallback((row: number, col: number) => {
    // Don't start new chop if already chopping something
    if (choppingTree) return;
    setChoppingTree({ row, col });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [choppingTree]);

  // Called when chopping animation completes
  const handleChoppingComplete = useCallback(async (row: number, col: number) => {
    // Clear choppingTree first to unmount animation cleanly
    setChoppingTree(null);
    
    // Small delay to let React complete render cycle before state updates
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Now remove tree from garden state and award coins
    const reward = await gardenState.removeDeadTree(row, col);
    if (reward > 0) {
      prayerState.earnCoins(reward, 'dead_tree_removal');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [gardenState, prayerState]);

  // Handle recovered tile tap (where dead tree was removed → offer to plant)
  const handlePlantPress = useCallback((row: number, col: number) => {
    setPlantTarget({ row, col });
    setSelectedTreeType('Basic'); // Reset to default
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle planted tree tap → offer to remove
  const handlePlantedTreePress = useCallback((row: number, col: number) => {
    setRemoveTreeTarget({ row, col });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    prayerState.completedPrayers
  );

  useEffect(() => {
    const loadAssets = async () => {
      try {
        await Asset.loadAsync([
          require('./assets/Garden Assets/Ground Tiles/Dead_Tile.png'),
          require('./assets/Garden Assets/Ground Tiles/Recovered_Tile.png'),
          require('./assets/Garden Assets/Tree Types/Sapling_converted.png'),
          require('./assets/Garden Assets/Tree Types/Growing_Tree_converted.png'),
          require('./assets/Garden Assets/Tree Types/Grown_Tree_converted.png'),
          require('./assets/Garden Assets/Tree Types/Dead_Tree.png'),
          require('./assets/Garden Assets/Effects/xp_badge.png'),
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
    // Still checking AsyncStorage
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#e8dcc8', marginBottom: 8 }}>🌳 Jannah Garden</Text>
        <ActivityIndicator size="large" color="#8b7355" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <StatusBar style="light" />
      
      {/* Fullscreen Garden Scene - Behind everything, receives XP for tree growth */}
      <GardenScene
        xp={prayerState.xp}
        gridSize={gardenState.gridSize}
        getTileState={gardenState.getTileState}
        isDeadTreeRemoved={gardenState.isDeadTreeRemoved}
        getPlantedTree={gardenState.getPlantedTree}
        choppingTree={choppingTree}
        daysSinceLastXP={gardenState.daysSinceLastXP}
        onTilePress={handleTilePress}
        onDeadTreePress={handleDeadTreePress}
        onPlantPress={handlePlantPress}
        onPlantedTreePress={handlePlantedTreePress}
        onChoppingComplete={handleChoppingComplete}
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
        visible={prayerState.xpPopup.visible}
        onComplete={prayerState.hideXpPopup}
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
        onClose={() => setShowSettingsModal(false)}
        gracePeriodMinutes={prayerState.gracePeriodMinutes}
        onGracePeriodChange={prayerState.updateGracePeriod}
        streaks={prayerState.streaks}
      />
      
      {/* Garden Expansion Celebration Modal */}
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
            backgroundColor: '#1a2e1a',
            borderRadius: 24,
            padding: 32,
            alignItems: 'center',
            width: '100%',
            maxWidth: 340,
            borderWidth: 2,
            borderColor: '#2d5a2d',
          }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🌳</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#4ade80', marginBottom: 8 }}>
              Garden Expanded!
            </Text>
            <Text style={{ fontSize: 16, color: '#a3e6a3', textAlign: 'center', marginBottom: 4 }}>
              Your garden has grown to
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 16 }}>
              {gardenState.gridSize} × {gardenState.gridSize}
            </Text>
            <Text style={{ fontSize: 14, color: '#7cb87c', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              New dead tiles have appeared at the edges. Keep praying to heal your garden!
            </Text>
            <TouchableOpacity
              onPress={() => setShowExpansionModal(false)}
              style={{
                backgroundColor: '#22c55e',
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                Mashallah! 🌿
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Skip Tile Recovery Modal — spend coins to instantly recover a tile */}
      <Modal
        visible={skipTileTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSkipTileTarget(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}>
          <View style={{
            backgroundColor: '#1a2e1a',
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            width: '100%',
            maxWidth: 320,
            borderWidth: 1,
            borderColor: '#2d5a2d',
          }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#4ade80', marginBottom: 8 }}>
              Speed Up Recovery?
            </Text>
            <Text style={{ fontSize: 14, color: '#a3e6a3', textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              This tile is recovering. Spend coins to restore it instantly!
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fbbf24', marginBottom: 4 }}>
              🪙 {skipTileTarget ? gardenState.getSkipCost(skipTileTarget.row, skipTileTarget.col) : 0} coins
            </Text>
            <Text style={{ fontSize: 12, color: '#7cb87c', marginBottom: 20 }}>
              You have: 🪙 {prayerState.coins}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setSkipTileTarget(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#2d5a2d',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#7cb87c', fontSize: 14, fontWeight: '600' }}>Wait</Text>
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
          </View>
        </View>
      </Modal>

      {/* Plant Tree Modal — tap recovered tile (with dead tree removed) to plant */}
      <Modal
        visible={plantTarget !== null}
        transparent
        animationType="fade"
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
              <View style={{
                backgroundColor: '#1a2e1a',
                borderRadius: 20,
                padding: 24,
                alignItems: 'center',
                width: '100%',
                maxWidth: 340,
                borderWidth: 1,
                borderColor: '#2d5a2d',
              }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#4ade80', marginBottom: 8 }}>
              Plant a Tree
            </Text>
            <Text style={{ fontSize: 14, color: '#a3e6a3', textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
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
                        borderWidth: 2,
                        borderColor: isSelected ? '#4ade80' : 'rgba(74, 222, 128, 0.2)',
                        backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.04)',
                        minWidth: 72,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: '#e8dcc8', fontWeight: '600' }}>{catalogItem.name.replace(' Tree', '')}</Text>
                      {count !== Infinity && (
                        <Text style={{ fontSize: 10, color: '#7cb87c', marginTop: 2 }}>x{count}</Text>
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
                  borderWidth: 1,
                  borderColor: '#2d5a2d',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#7cb87c', fontSize: 14, fontWeight: '600' }}>Not Now</Text>
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
          </View>
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
            backgroundColor: '#2e1a1a',
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            width: '100%',
            maxWidth: 300,
            borderWidth: 1,
            borderColor: '#5a2d2d',
          }}>
            <Image source={AXE_ICON} style={{ width: 64, height: 64, marginBottom: 8 }} resizeMode="contain" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#f87171', marginBottom: 8 }}>
              Remove Tree?
            </Text>
            <Text style={{ fontSize: 14, color: '#e6a3a3', textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
              This tree will be removed and won't be refunded.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                onPress={() => setRemoveTreeTarget(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#5a2d2d',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#c87c7c', fontSize: 14, fontWeight: '600' }}>Keep</Text>
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

      {/* Shop Modal */}
      <ShopModal
        visible={showShopModal}
        onClose={() => setShowShopModal(false)}
        coins={prayerState.coins}
        inventory={gardenState.treeInventory}
        onPurchaseTree={handlePurchaseTree}
        freezeInventory={freezeInventory}
        onPurchaseFreeze={handlePurchaseFreeze}
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
            backgroundColor: '#1a1a2e',
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            width: '100%',
            maxWidth: 340,
            borderWidth: 2,
            borderColor: '#ff6b6b',
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
                onPress={() => setShowDebugModal(false)}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#4a5568',
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
              borderWidth: 1,
              borderColor: 'rgba(255,107,107,0.3)',
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

      {/* Top Info Bar - Floating overlay */}
      <SafeAreaView 
        edges={['top']} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0,
        }}
      >
        {/* Debug Button - Top Left */}
        <TouchableOpacity
          onPress={() => setShowDebugModal(true)}
          style={{
            position: 'absolute',
            top: 48,
            left: 16,
            backgroundColor: 'rgba(255, 107, 107, 0.9)',
            padding: 8,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: '#ff6b6b',
            zIndex: 9999,
          }}
        >
          <Text style={{ fontSize: 16 }}>🐛</Text>
        </TouchableOpacity>

        {prayerState.loading ? (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator size="small" color="#8b7355" />
          </View>
        ) : (
          <>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              paddingRight: 16,
            }}>
              <View style={{ flex: 1 }}>
                <TopInfoBar 
                  streaks={prayerState.streaks}
                  coins={prayerState.coins}
                  xp={prayerState.xp}
                  nextPrayer={isResting ? null : prayerState.nextPrayer}
                  timeUntilNext={isResting ? 'Resting' : prayerState.timeUntilNext}
                />
              </View>
              
              {/* Settings, Shop & Rest Buttons */}
              {!isResting && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setShowShopModal(true)}
                    style={{
                      backgroundColor: 'rgba(26, 26, 46, 0.85)',
                      padding: 10,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(251, 191, 36, 0.3)',
                    }}
                  >
                    <MaterialCommunityIcons 
                      name="store" 
                      size={20} 
                      color="#fbbf24" 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowSettingsModal(true)}
                    style={{
                      backgroundColor: 'rgba(26, 26, 46, 0.85)',
                      padding: 10,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(107, 114, 128, 0.3)',
                    }}
                  >
                    <MaterialCommunityIcons 
                      name="cog" 
                      size={20} 
                      color="#9ca3af" 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowRestModal(true)}
                    style={{
                      backgroundColor: 'rgba(26, 26, 46, 0.85)',
                      padding: 10,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <MaterialCommunityIcons 
                      name="moon-waning-crescent" 
                      size={20} 
                      color="#10b981" 
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {/* Test Notification Button (for development) */}
            <TouchableOpacity
              onPress={sendTestNotifications}
              style={{
                alignSelf: 'center',
                backgroundColor: 'rgba(16, 185, 129, 0.9)',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                marginTop: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                🔔 Test Notifications
              </Text>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>

      {/* Bottom Floating Prayer Bar - Hidden during rest */}
      {!isResting && (
        <SafeAreaView 
          edges={['bottom']} 
          style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0,
          }}
        >
          {!prayerState.loading && prayerState.timings && (
            <FloatingPrayerBar 
              timings={prayerState.timings}
              nextPrayer={prayerState.nextPrayer}
              completedPrayers={prayerState.completedPrayers}
              onTogglePrayer={prayerState.togglePrayerCompleted}
              getPrayerWindowStatus={prayerState.getPrayerWindowStatus}
              streaks={prayerState.streaks}
            />
          )}
        </SafeAreaView>
      )}

      {/* First-time tooltip */}
      {showTooltip && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 140,
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
    </View>
  );
}
