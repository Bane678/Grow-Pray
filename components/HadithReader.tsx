import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
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
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  // useReading hands back a fresh object every render, so its actions are
  // reached through refs - depending on `reading` directly would rebuild
  // renderItem on every recorded scroll tick and defeat HadithCard's memo.
  const toggleBookmarkRef = useRef(reading.toggleBookmark);
  useEffect(() => { toggleBookmarkRef.current = reading.toggleBookmark; }, [reading.toggleBookmark]);

  // Membership computed during render, so a tap shows immediately.
  const bookmarkedIds = useMemo(
    () => new Set(reading.bookmarks.map((b) => b.id)),
    [reading.bookmarks],
  );

  const onToggleSave = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      toggleSave(id);
    },
    [toggleSave],
  );

  const onToggleBookmark = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleBookmarkRef.current(id);
  }, []);

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
  const hadithBookmarks = useMemo(
    () => hadiths.map((h, index) => ({ h, index })).filter(({ h }) => bookmarkedIds.has(h.id)),
    [bookmarkedIds, hadiths],
  );

  const jumpTo = useCallback((index: number) => {
    if (index < 0) return;
    Haptics.selectionAsync();
    scrollAttempts.current = 0;
    setBookmarksOpen(false);   // get the tray out of the way of what was tapped
    if (index === 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
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
        bookmarked={bookmarkedIds.has(item.id)}
        onToggleSave={onToggleSave}
        onToggleBookmark={onToggleBookmark}
        onAnnotate={onOpenAnnotate}
      />
    ),
    [isSaved, bookmarkedIds, onToggleSave, onToggleBookmark, onOpenAnnotate],
  );

  return (
    <View style={styles.fill}>
      {/* Fixed, outside the list. These used to be ListHeaderComponent, which
          meant the only way to reach your bookmarks was to scroll the whole
          collection back to the top - and adding the first bookmark while
          scrolled down grew the header and shunted the content under your
          thumb. Out here they are always one tap away and the list never
          moves on its own. */}
      <View style={styles.collectionHeader}>
        <View style={styles.collectionTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.collectionTitle}>{HADITH_COLLECTION.title}</Text>
            <Text style={styles.collectionSub}>{HADITH_COLLECTION.subtitle}</Text>
          </View>

          {resumeHadith && resumeIndex > 0 && (
            <TouchableOpacity
              style={styles.headBtn}
              onPress={() => jumpTo(resumeIndex)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="book-clock-outline" size={16} color={HADITH_ACCENT} />
              <Text style={styles.headBtnText}>{resumeHadith.number}</Text>
            </TouchableOpacity>
          )}

          {hadithBookmarks.length > 0 && (
            <TouchableOpacity
              style={[styles.headBtn, bookmarksOpen && styles.headBtnOn]}
              onPress={() => { Haptics.selectionAsync(); setBookmarksOpen((v) => !v); }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={bookmarksOpen ? 'bookmark' : 'bookmark-multiple-outline'}
                size={16}
                color={bookmarksOpen ? '#0f1526' : HADITH_ACCENT}
              />
              <Text style={[styles.headBtnText, bookmarksOpen && styles.headBtnTextOn]}>
                {hadithBookmarks.length}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {bookmarksOpen && hadithBookmarks.length > 0 && (
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
        )}
      </View>
      <FlatList
        ref={listRef}
        style={styles.fill}
        data={hadiths}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        extraData={[isSaved, bookmarkedIds]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 40 }}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // ── Fixed header controls ──
  collectionTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(143,191,159,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(143,191,159,0.32)',
  },
  headBtnOn: { backgroundColor: HADITH_ACCENT, borderColor: HADITH_ACCENT },
  headBtnText: { fontSize: 12, fontWeight: '800', color: HADITH_ACCENT },
  headBtnTextOn: { color: '#0f1526' },

  bmChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
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
