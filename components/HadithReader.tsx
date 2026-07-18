import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { getHadiths, Hadith, HADITH_COLLECTION, gradeLabel } from '../data/hadith';

// Sage accent for hadith - matches KIND_ACCENT.hadith in the hub.
const HADITH_ACCENT = '#8fbf9f';

interface HadithReaderProps {
  isSaved: (id: string) => boolean;
  toggleSave: (id: string) => void;
  /** Open the annotation editor for an already-saved hadith. */
  onOpenAnnotate: (id: string) => void;
}

const HadithCard = React.memo(function HadithCard({
  hadith,
  saved,
  onToggleSave,
  onAnnotate,
}: {
  hadith: Hadith;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onAnnotate: (id: string) => void;
}) {
  const isSahih = hadith.grade === 'sahih';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.numChip}>
          <Text style={styles.numChipText}>Hadith {hadith.number}</Text>
        </View>
        <View style={styles.topRight}>
          {/* Grade badge - authentication shown, not just claimed */}
          <View style={[styles.gradeBadge, isSahih ? styles.gradeSahih : styles.gradeHasan]}>
            <MaterialCommunityIcons
              name="shield-check"
              size={11}
              color={isSahih ? '#0f1526' : HADITH_ACCENT}
            />
            <Text style={[styles.gradeText, isSahih ? styles.gradeTextSahih : styles.gradeTextHasan]}>
              {gradeLabel(hadith.grade)}
            </Text>
          </View>
          {saved && (
            <TouchableOpacity
              onPress={() => onAnnotate(hadith.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="draw" size={17} color={HADITH_ACCENT} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onToggleSave(hadith.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={saved ? 'heart' : 'heart-outline'}
              size={18}
              color={saved ? '#f87171' : 'rgba(232,224,214,0.35)'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.arabic}>{hadith.arabic}</Text>
      <Text style={styles.translation}>{hadith.translation}</Text>

      <View style={styles.divider} />
      <View style={styles.footer}>
        <Text style={styles.narrator}>{hadith.narrator}</Text>
        <Text style={styles.source}>{hadith.source}</Text>
      </View>
    </View>
  );
});

export function HadithReader({ isSaved, toggleSave, onOpenAnnotate }: HadithReaderProps) {
  const hadiths = useMemo(() => getHadiths(), []);

  const onToggleSave = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      toggleSave(id);
    },
    [toggleSave],
  );

  const renderItem = useCallback(
    ({ item }: { item: Hadith }) => (
      <HadithCard
        hadith={item}
        saved={isSaved(item.id)}
        onToggleSave={onToggleSave}
        onAnnotate={onOpenAnnotate}
      />
    ),
    [isSaved, onToggleSave, onOpenAnnotate],
  );

  return (
    <View style={styles.fill}>
      <View style={styles.collectionHeader}>
        <Text style={styles.collectionTitle}>{HADITH_COLLECTION.title}</Text>
        <Text style={styles.collectionSub}>{HADITH_COLLECTION.subtitle}</Text>
      </View>
      <FlatList
        style={styles.fill}
        data={hadiths}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        extraData={isSaved}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  collectionHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    marginBottom: 10,
  },
  collectionTitle: { fontSize: 17, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  collectionSub: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 1 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(143,191,159,0.4)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  numChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(143,191,159,0.14)',
  },
  numChipText: { fontSize: 11, fontWeight: '700', color: HADITH_ACCENT },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gradeSahih: { backgroundColor: HADITH_ACCENT },
  gradeHasan: { backgroundColor: 'rgba(143,191,159,0.16)', borderWidth: 1, borderColor: 'rgba(143,191,159,0.4)' },
  gradeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  gradeTextSahih: { color: '#0f1526' },
  gradeTextHasan: { color: HADITH_ACCENT },

  arabic: {
    fontSize: 21,
    color: '#e8e0d6',
    textAlign: 'right',
    lineHeight: 40,
    fontFamily: FONTS.arabic,
    marginBottom: 10,
    paddingTop: 4,
  },
  translation: { fontSize: 13, color: 'rgba(232,224,214,0.82)', lineHeight: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 12, marginBottom: 9 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  narrator: { fontSize: 12, fontWeight: '700', color: 'rgba(232,224,214,0.6)' },
  source: { fontSize: 11, color: HADITH_ACCENT, fontWeight: '600' },
});
