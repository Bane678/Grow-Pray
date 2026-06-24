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

interface DailyReflectionCardProps {
  isPremium?: boolean;
  onOpenPaywall?: (reason: 'reflection_archive') => void;
  reminderEnabled?: boolean;
  onToggleReminder?: (enabled: boolean) => void;
}

function ReflectionBody({ item, compact }: { item: Reflection; compact?: boolean }) {
  return (
    <>
      {!!item.arabic && (
        <Text style={[styles.arabic, compact && styles.arabicCompact]}>{item.arabic}</Text>
      )}
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
  const { today, archive, isFavourite, toggleFavourite } = useReflections();
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

  if (!today) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.sectionLabel}>Reflection of the day</Text>
        <View style={styles.labelActions}>
          {onToggleReminder && (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); onToggleReminder(!reminderEnabled); }}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons
                name={reminderEnabled ? 'bell' : 'bell-outline'}
                size={16}
                color={reminderEnabled ? ACCENT : 'rgba(232,224,214,0.45)'}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={openArchive} activeOpacity={0.8} style={styles.archiveBtn}>
            <Text style={styles.archiveBtnText}>Archive</Text>
            {!isPremium ? (
              <MaterialCommunityIcons name="lock" size={11} color="rgba(232,224,214,0.45)" />
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={14} color="rgba(232,224,214,0.5)" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.kindRow}>
          <View style={styles.kindPill}>
            <Text style={styles.kindText}>{today.kind === 'ayah' ? "Qur'an" : 'Hadith'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (!isPremium) {
                Haptics.selectionAsync();
                onOpenPaywall?.('reflection_archive');
                return;
              }
              Haptics.selectionAsync();
              toggleFavourite(today.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={isPremium && isFavourite(today.id) ? 'heart' : 'heart-outline'}
              size={18}
              color={isPremium && isFavourite(today.id) ? '#f87171' : 'rgba(232,224,214,0.45)'}
            />
          </TouchableOpacity>
        </View>
        <ReflectionBody item={today} />
      </View>

      {/* Archive modal (premium) */}
      <Modal
        visible={archiveOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setArchiveOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Reflections</Text>
              <TouchableOpacity onPress={() => setArchiveOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
              {archive.map((item) => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.kindRow}>
                    <View style={styles.kindPill}>
                      <Text style={styles.kindText}>{item.kind === 'ayah' ? "Qur'an" : 'Hadith'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => { Haptics.selectionAsync(); toggleFavourite(item.id); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name={isFavourite(item.id) ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isFavourite(item.id) ? '#f87171' : 'rgba(232,224,214,0.45)'}
                      />
                    </TouchableOpacity>
                  </View>
                  <ReflectionBody item={item} compact />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  labelActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(232,224,214,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  archiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  archiveBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(232,224,214,0.55)' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  kindRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  kindPill: { backgroundColor: 'rgba(232,168,124,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  kindText: { fontSize: 11, fontWeight: '700', color: ACCENT },

  arabic: { fontSize: 26, color: '#e8e0d6', textAlign: 'right', lineHeight: 46, marginBottom: 12, fontFamily: FONTS.arabic },
  arabicCompact: { fontSize: 22, lineHeight: 40 },
  translation: { fontSize: 14, color: 'rgba(232,224,214,0.85)', lineHeight: 21, marginBottom: 8 },
  source: { fontSize: 12, color: ACCENT, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f1526',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 20,
    paddingHorizontal: 16,
  } as any,
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
});
