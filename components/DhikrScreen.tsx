import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { useDhikr, TapResult } from '../hooks/useDhikr';
import { DailyReflectionCard } from './DailyReflectionCard';
import {
  DHIKR_CATEGORIES,
  TASBIH_SEQUENCE,
  DhikrItem,
} from '../data/adhkar';

interface DhikrScreenProps {
  isPremium?: boolean;
  onOpenPaywall?: (reason: 'dhikr_library' | 'reflection_archive') => void;
  reflectionReminderEnabled?: boolean;
  onToggleReflectionReminder?: (enabled: boolean) => void;
}

const ACCENT = '#e8a87c';

function ProgressRing({ progress, size = 210 }: { progress: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={ACCENT}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function DhikrItemCard({ item }: { item: DhikrItem }) {
  return (
    <View style={styles.itemCard}>
      <Text style={styles.itemArabic}>{item.arabic}</Text>
      <Text style={styles.itemTranslit}>{item.transliteration}</Text>
      <Text style={styles.itemTranslation}>{item.translation}</Text>
      <View style={styles.itemMeta}>
        <View style={styles.repeatPill}>
          <MaterialCommunityIcons name="repeat" size={11} color={ACCENT} />
          <Text style={styles.repeatText}>×{item.repeat}</Text>
        </View>
        {!!item.source && <Text style={styles.itemSource}>{item.source}</Text>}
      </View>
    </View>
  );
}

const CUSTOM_QUICK = [33, 99, 100];

export const DhikrScreen = React.memo(function DhikrScreen({
  isPremium = false,
  onOpenPaywall,
  reflectionReminderEnabled = false,
  onToggleReflectionReminder,
}: DhikrScreenProps) {
  const dhikr = useDhikr();
  const [expanded, setExpanded] = useState<string | null>('after_salah');

  // ── Tap feedback animation ──
  const tapScale = useRef(new Animated.Value(1)).current;
  const ripple = useRef(new Animated.Value(1)).current;

  const pulse = useCallback((strong: boolean) => {
    tapScale.stopAnimation();
    Animated.sequence([
      Animated.timing(tapScale, {
        toValue: strong ? 1.12 : 1.07,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(tapScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: strong ? 520 : 420,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [tapScale, ripple]);

  const onTap = useCallback(() => {
    const isComplete = dhikr.mode === 'sequence' ? dhikr.sequenceComplete : dhikr.customComplete;
    if (isComplete) {
      Haptics.selectionAsync();
      dhikr.reset();
      pulse(false);
      return;
    }
    const result: TapResult = dhikr.increment();
    if (result === 'allComplete') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse(true);
      if (isPremium) dhikr.recordDhikrStreak();
    } else if (result === 'stepComplete') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse(true);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      pulse(false);
    }
  }, [dhikr, isPremium, pulse]);

  const toggleCategory = useCallback(
    (id: string, premium: boolean) => {
      if (premium && !isPremium) {
        Haptics.selectionAsync();
        onOpenPaywall?.('dhikr_library');
        return;
      }
      Haptics.selectionAsync();
      setExpanded((cur) => (cur === id ? null : id));
    },
    [isPremium, onOpenPaywall],
  );

  const onSwitchMode = useCallback(
    (m: 'sequence' | 'custom') => {
      if (m === 'custom' && !isPremium) {
        Haptics.selectionAsync();
        onOpenPaywall?.('dhikr_library');
        return;
      }
      Haptics.selectionAsync();
      dhikr.switchMode(m);
    },
    [dhikr, isPremium, onOpenPaywall],
  );

  const progress = dhikr.target > 0 ? dhikr.count / dhikr.target : 0;
  const complete = dhikr.mode === 'sequence' ? dhikr.sequenceComplete : dhikr.customComplete;

  const rippleScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.25] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dhikr</Text>
        {isPremium && dhikr.dhikrStreak > 0 && (
          <View style={styles.streakBadge}>
            <MaterialCommunityIcons name="fire" size={13} color="#fbbf24" />
            <Text style={styles.streakText}>{dhikr.dhikrStreak}</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ── Reflection of the day ── */}
        <DailyReflectionCard
          isPremium={isPremium}
          onOpenPaywall={onOpenPaywall}
          reminderEnabled={reflectionReminderEnabled}
          onToggleReminder={onToggleReflectionReminder}
        />

        {/* ── Tasbih ── */}
        <Text style={styles.sectionLabel}>Tasbih</Text>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          {([
            { key: 'sequence', label: 'After Salah' },
            { key: 'custom', label: 'Custom' },
          ] as const).map((m) => {
            const active = dhikr.mode === m.key;
            const locked = m.key === 'custom' && !isPremium;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => onSwitchMode(m.key)}
                activeOpacity={0.85}
                style={[styles.modeChip, active && styles.modeChipActive]}
              >
                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{m.label}</Text>
                {locked && <MaterialCommunityIcons name="lock" size={10} color="rgba(232,224,214,0.45)" style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.tasbihCard}>
          <Pressable onPress={onTap} style={styles.counterWrap}>
            <ProgressRing progress={complete ? 1 : progress} size={210} />
            {/* Ripple */}
            <Animated.View
              pointerEvents="none"
              style={[styles.ripple, { opacity: rippleOpacity, transform: [{ scale: rippleScale }] }]}
            />
            <Animated.View style={[styles.counterInner, { transform: [{ scale: tapScale }] }]}>
              {complete ? (
                <>
                  <MaterialCommunityIcons name="check-circle" size={40} color={ACCENT} />
                  <Text style={styles.completeText}>Complete</Text>
                </>
              ) : (
                <>
                  <Text style={styles.counterArabic}>
                    {dhikr.mode === 'sequence' ? dhikr.currentStep.arabic : 'Custom'}
                  </Text>
                  <Text style={styles.counterCount}>{dhikr.count}</Text>
                  <Text style={styles.counterTarget}>of {dhikr.target}</Text>
                </>
              )}
            </Animated.View>
          </Pressable>

          <Text style={styles.tapHint}>
            {complete ? 'Tap the circle to begin again' : 'Tap the circle to count'}
          </Text>

          {/* Sequence step indicator */}
          {dhikr.mode === 'sequence' && (
            <View style={styles.stepRow}>
              {TASBIH_SEQUENCE.map((step, i) => {
                const done = complete || i < dhikr.stepIndex;
                const active = !complete && i === dhikr.stepIndex;
                return (
                  <View key={step.id} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        done && styles.stepDotDone,
                        active && styles.stepDotActive,
                      ]}
                    >
                      {done ? (
                        <MaterialCommunityIcons name="check" size={12} color="#1a1205" />
                      ) : (
                        <Text style={[styles.stepDotNum, active && styles.stepDotNumActive]}>{i + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.stepLabel, active && styles.stepLabelActive]} numberOfLines={1}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Custom target stepper */}
          {dhikr.mode === 'custom' && (
            <View style={styles.customWrap}>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); dhikr.updateCustomTarget(dhikr.customTarget - 1); }}
                  style={styles.stepperBtn}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="minus" size={20} color="#e8e0d6" />
                </TouchableOpacity>
                <View style={styles.stepperValue}>
                  <Text style={styles.stepperValueText}>{dhikr.customTarget}</Text>
                  <Text style={styles.stepperValueLabel}>target</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); dhikr.updateCustomTarget(dhikr.customTarget + 1); }}
                  style={styles.stepperBtn}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#e8e0d6" />
                </TouchableOpacity>
              </View>
              <View style={styles.quickRow}>
                {CUSTOM_QUICK.map((q) => (
                  <TouchableOpacity
                    key={q}
                    onPress={() => { Haptics.selectionAsync(); dhikr.updateCustomTarget(q); }}
                    style={[styles.quickChip, dhikr.customTarget === q && styles.quickChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.quickChipText, dhikr.customTarget === q && styles.quickChipTextActive]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); dhikr.reset(); }} style={styles.resetBtn} activeOpacity={0.8}>
            <MaterialCommunityIcons name="refresh" size={15} color="rgba(232,224,214,0.6)" />
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* ── Duas & Adhkar ── */}
        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>Duas & Adhkar</Text>

        {DHIKR_CATEGORIES.map((cat) => {
          const locked = cat.premium && !isPremium;
          const isOpen = expanded === cat.id && !locked;
          return (
            <View key={cat.id} style={styles.catCard}>
              <TouchableOpacity
                onPress={() => toggleCategory(cat.id, cat.premium)}
                activeOpacity={0.8}
                style={styles.catHeader}
              >
                <View style={styles.catIcon}>
                  <MaterialCommunityIcons name={cat.icon as any} size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catTitle}>{cat.title}</Text>
                  <Text style={styles.catSub}>{cat.subtitle}</Text>
                </View>
                {locked ? (
                  <View style={styles.catLock}>
                    <MaterialCommunityIcons name="lock" size={14} color={ACCENT} />
                  </View>
                ) : (
                  <MaterialCommunityIcons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color="rgba(232,224,214,0.5)"
                  />
                )}
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.catBody}>
                  {cat.items.map((item) => (
                    <DhikrItemCard key={item.id} item={item} />
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {!isPremium && DHIKR_CATEGORIES.some((c) => c.premium) && (
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); onOpenPaywall?.('dhikr_library'); }}
            activeOpacity={0.85}
            style={styles.unlockBanner}
          >
            <MaterialCommunityIcons name="crown" size={16} color="#1a1205" />
            <Text style={styles.unlockBannerText}>Unlock the full library with Premium</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  streakText: { fontSize: 13, fontWeight: '800', color: '#fbbf24' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(232,224,214,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modeChipActive: { backgroundColor: 'rgba(232,168,124,0.16)' },
  modeChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(232,224,214,0.55)' },
  modeChipTextActive: { color: ACCENT, fontWeight: '700' },

  tasbihCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  counterWrap: { width: 210, height: 210, alignItems: 'center', justifyContent: 'center' },
  ripple: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(232,168,124,0.18)',
  },
  counterInner: { alignItems: 'center', justifyContent: 'center' },
  counterArabic: { fontSize: 28, lineHeight: 44, color: '#e8e0d6', marginBottom: 6, fontFamily: FONTS.arabic },
  counterCount: { fontSize: 52, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display, lineHeight: 58 },
  counterTarget: { fontSize: 13, color: 'rgba(232,224,214,0.5)' },
  completeText: { fontSize: 18, fontWeight: '800', color: ACCENT, fontFamily: FONTS.display, marginTop: 8 },
  tapHint: { fontSize: 12, color: 'rgba(232,224,214,0.4)', marginTop: 16 },

  // Sequence stepper
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 },
  stepItem: { alignItems: 'center', flex: 1, maxWidth: 100 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  stepDotActive: { backgroundColor: 'rgba(232,168,124,0.2)', borderWidth: 1, borderColor: ACCENT },
  stepDotDone: { backgroundColor: ACCENT },
  stepDotNum: { fontSize: 12, fontWeight: '700', color: 'rgba(232,224,214,0.5)' },
  stepDotNumActive: { color: ACCENT },
  stepLabel: { fontSize: 10, color: 'rgba(232,224,214,0.45)', fontWeight: '600' },
  stepLabelActive: { color: '#e8e0d6' },

  // Custom stepper
  customWrap: { width: '100%', alignItems: 'center', marginTop: 16 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { alignItems: 'center', minWidth: 70 },
  stepperValueText: { fontSize: 26, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  stepperValueLabel: { fontSize: 10, color: 'rgba(232,224,214,0.45)', letterSpacing: 0.5 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  quickChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  quickChipActive: { backgroundColor: 'rgba(232,168,124,0.16)' },
  quickChipText: { fontSize: 13, fontWeight: '700', color: 'rgba(232,224,214,0.55)' },
  quickChipTextActive: { color: ACCENT },

  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingVertical: 6, paddingHorizontal: 14 },
  resetText: { fontSize: 13, color: 'rgba(232,224,214,0.6)', fontWeight: '600' },

  catCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(232,168,124,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTitle: { fontSize: 15, fontWeight: '700', color: '#e8e0d6', fontFamily: FONTS.display },
  catSub: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 1 },
  catLock: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(232,168,124,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },

  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
  },
  itemArabic: { fontSize: 26, color: '#e8e0d6', textAlign: 'right', lineHeight: 52, paddingTop: 4, marginBottom: 8, fontFamily: FONTS.arabic },
  itemTranslit: { fontSize: 13, fontWeight: '600', color: ACCENT, marginBottom: 4 },
  itemTranslation: { fontSize: 13, color: 'rgba(232,224,214,0.75)', lineHeight: 19 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  repeatPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(232,168,124,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  repeatText: { fontSize: 11, fontWeight: '700', color: ACCENT },
  itemSource: { fontSize: 10, color: 'rgba(232,224,214,0.4)', fontStyle: 'italic' },

  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 14,
  },
  unlockBannerText: { fontSize: 14, fontWeight: '800', color: '#1a1205' },
});
