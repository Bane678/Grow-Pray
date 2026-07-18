import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import {
  getSurahs,
  QuranSurah,
  QuranVerse,
  ayahId,
  BISMILLAH,
} from '../data/quran';

const ACCENT = '#e8a87c';

interface QuranReaderProps {
  isSaved: (id: string) => boolean;
  toggleSave: (id: string) => void;
  /** Open the annotation editor for an already-saved ayah. */
  onOpenAnnotate: (id: string) => void;
}

// ── One surah row in the index ──────────────────────────────────────────────
const SurahRow = React.memo(function SurahRow({
  surah,
  onPress,
}: {
  surah: QuranSurah;
  onPress: (s: QuranSurah) => void;
}) {
  return (
    <TouchableOpacity style={styles.surahRow} onPress={() => onPress(surah)} activeOpacity={0.8}>
      <View style={styles.surahNum}>
        <Text style={styles.surahNumText}>{surah.id}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.surahName}>{surah.transliteration}</Text>
        <Text style={styles.surahMeta}>
          {surah.translation} · {surah.total_verses} verses
        </Text>
      </View>
      <Text style={styles.surahArabic}>{surah.name}</Text>
    </TouchableOpacity>
  );
});

// ── One ayah row in the reader ──────────────────────────────────────────────
const VerseRow = React.memo(function VerseRow({
  verse,
  surahNum,
  saved,
  onToggleSave,
  onAnnotate,
}: {
  verse: QuranVerse;
  surahNum: number;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onAnnotate: (id: string) => void;
}) {
  const id = ayahId(surahNum, verse.id);
  return (
    <View style={styles.verseRow}>
      <View style={styles.verseTop}>
        <View style={styles.verseChip}>
          <Text style={styles.verseChipText}>{surahNum}:{verse.id}</Text>
        </View>
        <View style={styles.verseActions}>
          {saved && (
            <TouchableOpacity
              onPress={() => onAnnotate(id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="draw" size={17} color={ACCENT} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onToggleSave(id)}
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
      <Text style={styles.verseArabic}>{verse.text}</Text>
      <Text style={styles.verseTranslation}>{verse.translation}</Text>
    </View>
  );
});

export function QuranReader({ isSaved, toggleSave, onOpenAnnotate }: QuranReaderProps) {
  // Loads the bundled dataset on first render of the Qur'an tab (lazy).
  const surahs = useMemo(() => getSurahs(), []);
  const [active, setActive] = useState<QuranSurah | null>(null);

  const openSurah = useCallback((s: QuranSurah) => {
    Haptics.selectionAsync();
    setActive(s);
  }, []);

  const backToIndex = useCallback(() => {
    Haptics.selectionAsync();
    setActive(null);
  }, []);

  const onToggleSave = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      toggleSave(id);
    },
    [toggleSave],
  );

  const renderSurah = useCallback(
    ({ item }: { item: QuranSurah }) => <SurahRow surah={item} onPress={openSurah} />,
    [openSurah],
  );

  const renderVerse = useCallback(
    ({ item }: { item: QuranVerse }) => (
      <VerseRow
        verse={item}
        surahNum={active!.id}
        saved={isSaved(ayahId(active!.id, item.id))}
        onToggleSave={onToggleSave}
        onAnnotate={onOpenAnnotate}
      />
    ),
    [active, isSaved, onToggleSave, onOpenAnnotate],
  );

  // ── Surah index ──
  if (!active) {
    return (
      <FlatList
        style={styles.fill}
        data={surahs}
        keyExtractor={(s) => String(s.id)}
        renderItem={renderSurah}
        showsVerticalScrollIndicator={false}
        initialNumToRender={16}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    );
  }

  // ── Reader ──
  const showBismillah = active.id !== 1 && active.id !== 9;
  return (
    <View style={styles.fill}>
      <View style={styles.readerHeader}>
        <TouchableOpacity
          onPress={backToIndex}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color="#e8e0d6" />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.readerTitle}>{active.transliteration}</Text>
          <Text style={styles.readerMeta}>
            {active.translation} · {active.type === 'meccan' ? 'Meccan' : 'Medinan'} · {active.total_verses} verses
          </Text>
        </View>
        <Text style={styles.readerArabicName}>{active.name}</Text>
      </View>

      <FlatList
        style={styles.fill}
        data={active.verses}
        keyExtractor={(v) => String(v.id)}
        renderItem={renderVerse}
        extraData={isSaved}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          showBismillah ? <Text style={styles.bismillah}>{BISMILLAH}</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // ── Surah index ──
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  surahNum: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(232,168,124,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahNumText: { fontSize: 12, fontWeight: '800', color: ACCENT },
  surahName: { fontSize: 15, fontWeight: '700', color: '#e8e0d6' },
  surahMeta: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 1 },
  surahArabic: { fontSize: 20, color: 'rgba(232,224,214,0.85)', fontFamily: FONTS.arabic, marginLeft: 8 },

  // ── Reader ──
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    marginBottom: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerTitle: { fontSize: 17, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  readerMeta: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 1 },
  readerArabicName: { fontSize: 22, color: ACCENT, fontFamily: FONTS.arabic, marginLeft: 8 },

  bismillah: {
    fontSize: 22,
    color: 'rgba(232,224,214,0.9)',
    fontFamily: FONTS.arabic,
    textAlign: 'center',
    lineHeight: 44,
    marginTop: 6,
    marginBottom: 14,
  },

  verseRow: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(232,168,124,0.35)',
  },
  verseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  verseChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(232,168,124,0.12)',
  },
  verseChipText: { fontSize: 11, fontWeight: '700', color: ACCENT },
  verseActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  verseArabic: {
    fontSize: 22,
    color: '#e8e0d6',
    textAlign: 'right',
    lineHeight: 42,
    fontFamily: FONTS.arabic,
    marginBottom: 8,
    paddingTop: 4,
  },
  verseTranslation: { fontSize: 13, color: 'rgba(232,224,214,0.8)', lineHeight: 20 },
});
