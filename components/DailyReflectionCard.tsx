import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { useReflections } from '../hooks/useReflections';
import { Reflection } from '../data/reflections';
import { ReflectionsHub } from './ReflectionsHub';

const ACCENT = '#e8a87c';

interface DailyReflectionCardProps {
  isPremium?: boolean;
  onOpenPaywall?: (reason: 'reflection_archive') => void;
  reminderEnabled?: boolean;
  onToggleReminder?: (enabled: boolean) => void;
}

function ReflectionBody({ item }: { item: Reflection }) {
  return (
    <>
      {!!item.arabic && <Text style={styles.arabic}>{item.arabic}</Text>}
      <Text style={styles.translation}>{item.translation}</Text>
      <Text style={styles.source}>{item.source}</Text>
    </>
  );
}

export const DailyReflectionCard = React.memo(function DailyReflectionCard({
  isPremium = false,
  onOpenPaywall,
  reminderEnabled = false,
  onToggleReminder,
}: DailyReflectionCardProps) {
  const {
    today,
    savedReflections,
    savedCount,
    isSaved,
    toggleSave,
    saveAnnotation,
  } = useReflections();

  const [hubOpen, setHubOpen] = useState(false);
  const [hubTab, setHubTab] = useState<'quran' | 'saved'>('quran');

  const openHub = useCallback(
    (tab: 'quran' | 'saved') => {
      Haptics.selectionAsync();
      if (!isPremium) {
        onOpenPaywall?.('reflection_archive');
        return;
      }
      setHubTab(tab);
      setHubOpen(true);
    },
    [isPremium, onOpenPaywall],
  );

  const onHeartToday = useCallback(() => {
    if (!isPremium) {
      Haptics.selectionAsync();
      onOpenPaywall?.('reflection_archive');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSave(today!.id);
  }, [isPremium, onOpenPaywall, toggleSave, today]);

  if (!today) return null;

  const todayHearted = isPremium && isSaved(today.id);

  return (
    <View style={styles.wrap}>
      {/* Featured entry point - the Qur'an & Hadith library. This is deliberately
          the most prominent element on the Dhikr tab: full-width, its own icon
          and copy, not a small pill tucked into a header row. */}
      <TouchableOpacity style={styles.hero} onPress={() => openHub('quran')} activeOpacity={0.88}>
        <View style={styles.heroIconRing}>
          <MaterialCommunityIcons
            name={isPremium ? 'book-open-page-variant' : 'lock'}
            size={26}
            color={ACCENT}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroTitle}>Qur'an & Hadith</Text>
          <Text style={styles.heroSubtitle}>
            114 surahs · Nawawi's 40 · read, save & annotate
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(232,224,214,0.5)" />
      </TouchableOpacity>

      <View style={styles.labelRow}>
        <Text style={styles.sectionLabel}>Reflection of the day</Text>
        <TouchableOpacity onPress={() => openHub('saved')} activeOpacity={0.8} style={styles.entryBtn}>
          <MaterialCommunityIcons
            name={isPremium ? 'heart-outline' : 'lock'}
            size={13}
            color="rgba(232,224,214,0.7)"
          />
          <Text style={styles.entryText}>
            Saved{isPremium && savedCount > 0 ? ` · ${savedCount}` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Daily reflection card */}
      <View style={styles.card}>
        <View style={styles.kindRow}>
          <View style={styles.kindPill}>
            <Text style={styles.kindText}>{today.kind === 'ayah' ? "Qur'an" : 'Hadith'}</Text>
          </View>
          <TouchableOpacity onPress={onHeartToday} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons
              name={todayHearted ? 'heart' : 'heart-outline'}
              size={19}
              color={todayHearted ? '#f87171' : 'rgba(232,224,214,0.45)'}
            />
          </TouchableOpacity>
        </View>
        <ReflectionBody item={today} />
      </View>

      {/* Self-explanatory daily reminder toggle */}
      {onToggleReminder && (
        <TouchableOpacity
          style={[styles.reminderRow, reminderEnabled && styles.reminderRowOn]}
          activeOpacity={0.8}
          onPress={() => { Haptics.selectionAsync(); onToggleReminder(!reminderEnabled); }}
        >
          <MaterialCommunityIcons
            name={reminderEnabled ? 'bell-ring' : 'bell-outline'}
            size={16}
            color={reminderEnabled ? ACCENT : 'rgba(232,224,214,0.5)'}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.reminderLabel, reminderEnabled && { color: ACCENT }]}>Daily reminder</Text>
            <Text style={styles.reminderSub}>
              {reminderEnabled ? 'On · notifies you at 9:00 AM' : 'Get a nudge each morning at 9:00 AM'}
            </Text>
          </View>
          <View style={[styles.reminderPill, reminderEnabled && styles.reminderPillOn]}>
            <Text style={[styles.reminderPillText, reminderEnabled && styles.reminderPillTextOn]}>
              {reminderEnabled ? 'ON' : 'OFF'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Reflections hub (premium): full Qur'an + Saved with annotations */}
      <ReflectionsHub
        visible={hubOpen}
        initialTab={hubTab}
        onClose={() => setHubOpen(false)}
        savedReflections={savedReflections}
        isSaved={isSaved}
        toggleSave={toggleSave}
        saveAnnotation={saveAnnotation}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },

  // ── Featured Qur'an & Hadith hero ──
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(232,168,124,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.3)',
  },
  heroIconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(232,168,124,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  heroSubtitle: { fontSize: 12, color: 'rgba(232,224,214,0.55)', marginTop: 3 },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(232,224,214,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  entryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  entryText: { fontSize: 12, fontWeight: '600', color: 'rgba(232,224,214,0.75)' },

  // ── Daily card ──
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  kindRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  kindPill: { backgroundColor: 'rgba(232,168,124,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  kindText: { fontSize: 11, fontWeight: '700', color: ACCENT },

  arabic: { fontSize: 26, color: '#e8e0d6', textAlign: 'right', lineHeight: 48, paddingTop: 4, marginBottom: 12, fontFamily: FONTS.arabic },
  translation: { fontSize: 14, color: 'rgba(232,224,214,0.85)', lineHeight: 21, marginBottom: 8 },
  source: { fontSize: 12, color: ACCENT, fontWeight: '600' },

  // ── Reminder toggle ──
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reminderRowOn: {
    backgroundColor: 'rgba(232,168,124,0.08)',
    borderColor: 'rgba(232,168,124,0.28)',
  },
  reminderLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(232,224,214,0.8)' },
  reminderSub: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 1 },
  reminderPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reminderPillOn: { backgroundColor: 'rgba(232,168,124,0.2)' },
  reminderPillText: { fontSize: 10, fontWeight: '800', color: 'rgba(232,224,214,0.5)', letterSpacing: 0.5 },
  reminderPillTextOn: { color: ACCENT },
});
