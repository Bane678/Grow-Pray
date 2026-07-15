import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { useReflections } from '../hooks/useReflections';
import { Reflection } from '../data/reflections';

const ACCENT = '#e8a87c';
// Per-kind accent so Qur'an vs Hadith read distinctly in the archive.
const KIND_ACCENT: Record<Reflection['kind'], string> = {
  ayah: '#e8a87c',   // warm gold
  hadith: '#8fbf9f', // soft sage
};

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

// ── Archive: one saved reflection, "elegant collection card" ──
function ArchiveCard({
  item,
  onUnsave,
}: {
  item: Reflection;
  onUnsave: () => void;
}) {
  const kindColor = KIND_ACCENT[item.kind];
  return (
    <View style={[styles.archiveCard, { borderLeftColor: kindColor }]}>
      <View style={styles.archiveTopRow}>
        <Text style={[styles.quoteGlyph, { color: kindColor }]}>❝</Text>
        <View style={[styles.kindChip, { backgroundColor: kindColor + '1f' }]}>
          <Text style={[styles.kindChipText, { color: kindColor }]}>
            {item.kind === 'ayah' ? "Qur'an" : 'Hadith'}
          </Text>
        </View>
      </View>

      {!!item.arabic && <Text style={styles.archiveArabic}>{item.arabic}</Text>}
      <Text style={styles.archiveTranslation}>{item.translation}</Text>

      <View style={styles.archiveDivider} />

      <View style={styles.archiveFooter}>
        <Text style={[styles.archiveSource, { color: kindColor }]}>{item.source}</Text>
        <TouchableOpacity
          onPress={onUnsave}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="heart" size={18} color="#f87171" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const DailyReflectionCard = React.memo(function DailyReflectionCard({
  isPremium = false,
  onOpenPaywall,
  reminderEnabled = false,
  onToggleReminder,
}: DailyReflectionCardProps) {
  const { today, favouriteReflections, isFavourite, toggleFavourite } = useReflections();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const openArchive = useCallback(() => {
    if (!isPremium) {
      Haptics.selectionAsync();
      onOpenPaywall?.('reflection_archive');
      return;
    }
    Haptics.selectionAsync();
    setArchiveOpen(true);
  }, [isPremium, onOpenPaywall]);

  const onHeartToday = useCallback(() => {
    if (!isPremium) {
      Haptics.selectionAsync();
      onOpenPaywall?.('reflection_archive');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavourite(today!.id);
  }, [isPremium, onOpenPaywall, toggleFavourite, today]);

  if (!today) return null;

  const savedCount = favouriteReflections.length;
  const todayHearted = isPremium && isFavourite(today.id);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.sectionLabel}>Reflection of the day</Text>
        <TouchableOpacity onPress={openArchive} activeOpacity={0.8} style={styles.archiveBtn}>
          <MaterialCommunityIcons
            name={isPremium ? 'bookmark-multiple-outline' : 'lock'}
            size={13}
            color="rgba(232,224,214,0.6)"
          />
          <Text style={styles.archiveBtnText}>
            Saved{isPremium && savedCount > 0 ? ` · ${savedCount}` : ''}
          </Text>
          {isPremium && <MaterialCommunityIcons name="chevron-right" size={14} color="rgba(232,224,214,0.5)" />}
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

      {/* Archive modal (premium) — your saved reflections */}
      <Modal
        visible={archiveOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setArchiveOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sheetTitle}>Your Reflections</Text>
                <Text style={styles.sheetSubtitle}>
                  {savedCount === 0
                    ? 'Saved verses & hadith'
                    : `${savedCount} saved verse${savedCount === 1 ? '' : 's'}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setArchiveOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.sheetClose}
              >
                <MaterialCommunityIcons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {savedCount === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconRing}>
                  <MaterialCommunityIcons name="heart-outline" size={30} color={ACCENT} />
                </View>
                <Text style={styles.emptyTitle}>No saved reflections yet</Text>
                <Text style={styles.emptyBody}>
                  Tap the{'  '}
                  <MaterialCommunityIcons name="heart-outline" size={13} color="#f87171" />
                  {'  '}on any reflection to keep it here for whenever you need it.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {favouriteReflections.map((item) => (
                  <ArchiveCard
                    key={item.id}
                    item={item}
                    onUnsave={() => { Haptics.selectionAsync(); toggleFavourite(item.id); }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(232,224,214,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  archiveBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(232,224,214,0.7)' },

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

  // ── Archive sheet ──
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f1526',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
    minHeight: '46%',
    paddingTop: 10,
    paddingHorizontal: 16,
  } as any,
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 14,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  sheetSubtitle: { fontSize: 12, color: 'rgba(232,224,214,0.45)', marginTop: 2 },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // ── Empty state ──
  emptyWrap: { alignItems: 'center', paddingTop: 34, paddingBottom: 48, paddingHorizontal: 24 },
  emptyIconRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(232,168,124,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#e8e0d6', marginBottom: 8, fontFamily: FONTS.display },
  emptyBody: { fontSize: 13, color: 'rgba(232,224,214,0.55)', textAlign: 'center', lineHeight: 20 },

  // ── Archive card ──
  archiveCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
  },
  archiveTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  quoteGlyph: { fontSize: 26, lineHeight: 26, fontWeight: '800' },
  kindChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  kindChipText: { fontSize: 11, fontWeight: '700' },
  archiveArabic: { fontSize: 23, color: '#e8e0d6', textAlign: 'right', lineHeight: 44, paddingTop: 6, marginBottom: 12, fontFamily: FONTS.arabic },
  archiveTranslation: { fontSize: 14, color: 'rgba(232,224,214,0.85)', lineHeight: 21, marginTop: 4 },
  archiveDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 14, marginBottom: 12 },
  archiveFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  archiveSource: { fontSize: 12, fontWeight: '700' },
});
