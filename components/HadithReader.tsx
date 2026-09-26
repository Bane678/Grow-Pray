import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { getHadiths, Hadith, HADITH_COLLECTION, gradeLabel } from '../data/hadith';
import type { ReadingState } from '../hooks/useReading';

// Sage accent for hadith - matches KIND_ACCENT.hadith in the hub.
const HADITH_ACCENT = '#8fbf9f';

interface HadithReaderProps {
  isSaved: (id: string) => boolean;
  toggleSave: (id: string) => void;
  /** Open the annotation editor for an already-saved hadith. */
  onOpenAnnotate: (id: string) => void;
  /** Reading position + bookmarks. Both free; the heart stays premium. */
  reading: ReadingState;
}

const HadithCard = React.memo(function HadithCard({
  hadith,
  saved,
  bookmarked,
  onToggleSave,
  onToggleBookmark,
  onAnnotate,
}: {
  hadith: Hadith;
  saved: boolean;
  bookmarked: boolean;
  onToggleSave: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onAnnotate: (id: string) => void;
}) {
  const isSahih = hadith.grade === 'sahih';
  return (
    <View style={[styles.card, bookmarked && styles.cardBookmarked]}>
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
          {/* Bookmark means "come back here" - free, and deliberately distinct
              from the heart, which curates the premium Reflections collection. */}
          <TouchableOpacity
            onPress={() => onToggleBookmark(hadith.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={bookmarked ? HADITH_ACCENT : 'rgba(232,224,214,0.35)'}
            />
          </TouchableOpacity>
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

export function HadithReader({ isSaved, toggleSave, onOpenAnnotate, reading }: HadithReaderProps) {
  const hadiths = useMemo(() => getHadiths(), []);
  const listRef = useRef<FlatList<Hadith>>(null);
  const scrollAttempts = useRef(0);

  const onToggleSave = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      toggleSave(id);
    },
    [toggleSave],
  );

  const onToggleBookmark = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      reading.toggleBookmark(id);
    },
    [reading],
  );

  // ── Position tracking ───────────────────────────────────────────────────────
  // FlatList refuses a changing onViewableItemsChanged identity, so the handler
  // is built once and reaches the current recorder through a ref.
  const recordRef = useRef(reading.recordHadith);
  useEffect(() => { recordRef.current = reading.recordHadith; }, [reading.recordHadith]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 40 }).current;
  const onViewableItemsChanged = useRef((info: { viewableItems: Array<{ item?: Hadith }> }) => {
    const top = info.viewableItems[0]?.item;
    if (top) recordRef.current(top.number);
  }).current;

  // Nawawi's numbering skips 41, so a hadith's number is not its list index.
  const resume = reading.hadith;
  const resumeIndex = useMemo(
    () => (resume ? hadiths.findIndex((h) => h.number === resume.number) : -1),
    [resume, hadiths],
  );
  const resumeHadith = resumeIndex >= 0 ? hadiths[resumeIndex] : null;

  // Bookmarked hadith, in collection order, each carrying the list index it
  // sits at so a tap is a direct scroll rather than a search.
  const hadithBookmarks = useMemo(() => {
    const marked = new Set(reading.bookmarks.map((b) => b.id));
    return hadiths
      .map((h, index) => ({ h, index }))
      .filter(({ h }) => marked.has(h.id));
  }, [reading.bookmarks, hadiths]);

  const jumpTo = useCallback((index: number) => {
    if (index <= 0) return;
    Haptics.selectionAsync();
    scrollAttempts.current = 0;
    try { listRef.current?.scrollToIndex({ index, animated: false }); } catch { /* retried below */ }
  }, []);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      // Card heights vary, so there is no getItemLayout; nudge to an estimated
      // offset and retry, capped so a bad index can never spin forever.
      if (scrollAttempts.current >= 8) return;
      scrollAttempts.current += 1;
      listRef.current?.scrollToOffset({
        offset: info.index * Math.max(info.averageItemLength, 1),
        animated: false,
      });
      setTimeout(() => {
        try { listRef.current?.scrollToIndex({ index: info.index, animated: false }); } catch { /* give up quietly */ }
      }, 80);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: Hadith }) => (
      <HadithCard
        hadith={item}
        saved={isSaved(item.id)}
        bookmarked={reading.isBookmarked(item.id)}
        onToggleSave={onToggleSave}
        onToggleBookmark={onToggleBookmark}
        onAnnotate={onOpenAnnotate}
      />
    ),
    [isSaved, reading, onToggleSave, onToggleBookmark, onOpenAnnotate],
  );

  return (
    <View style={styles.fill}>
      <View style={styles.collectionHeader}>
        <Text style={styles.collectionTitle}>{HADITH_COLLECTION.title}</Text>
        <Text style={styles.collectionSub}>{HADITH_COLLECTION.subtitle}</Text>
      </View>
      <FlatList
        ref={listRef}
        style={styles.fill}
        data={hadiths}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        extraData={[isSaved, reading.bookmarks]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 40 }}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={onScrollToIndexFailed}
        ListHeaderComponent={
          <View>
            {/* One flat list of 41, so "continue" is a scroll rather than a
                navigation - but the user still should not have to hunt for it. */}
            {resumeHadith && resumeIndex > 0 ? (
              <TouchableOpacity
                style={styles.resumeCard}
                onPress={() => jumpTo(resumeIndex)}
                activeOpacity={0.85}
              >
                <View style={styles.resumeIcon}>
                  <MaterialCommunityIcons name="script-text-outline" size={18} color="#0f1526" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resumeLabel}>Continue reading</Text>
                  <Text style={styles.resumeWhere} numberOfLines={1}>
                    Hadith {resumeHadith.number} of {hadiths.length}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={HADITH_ACCENT} />
              </TouchableOpacity>
            ) : null}

            {/* Short collection, so numbered chips beat a collapsible list. */}
            {hadithBookmarks.length > 0 && (
              <View style={styles.bmBlock}>
                <View style={styles.bmHeader}>
                  <MaterialCommunityIcons name="bookmark-multiple-outline" size={16} color={HADITH_ACCENT} />
                  <Text style={styles.bmHeaderText}>Bookmarks</Text>
                </View>
                <View style={styles.bmChips}>
                  {hadithBookmarks.map(({ h, index }) => (
                    <TouchableOpacity
                      key={h.id}
                      style={styles.bmChip}
                      onPress={() => jumpTo(index)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.bmChipText}>{h.number}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // ── Continue reading ──
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(143,191,159,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(143,191,159,0.32)',
    marginBottom: 12,
  },
  resumeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HADITH_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: HADITH_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  resumeWhere: { fontSize: 14, fontWeight: '700', color: '#e8e0d6', marginTop: 2 },

  // ── Bookmark jump chips ──
  bmBlock: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 10,
  },
  bmHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  bmHeaderText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#e8e0d6' },
  bmChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 12 },
  bmChip: {
    minWidth: 32,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: 'rgba(143,191,159,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(143,191,159,0.35)',
  },
  bmChipText: { fontSize: 12, fontWeight: '800', color: HADITH_ACCENT },

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
  cardBookmarked: { borderLeftColor: HADITH_ACCENT, backgroundColor: 'rgba(143,191,159,0.07)' },
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
