import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  getSurah,
  QuranSurah,
  QuranVerse,
  ayahId,
  parseAyahId,
  BISMILLAH,
} from '../data/quran';
import type { ReadingState } from '../hooks/useReading';

const ACCENT = '#e8a87c';
const TOTAL_SURAHS = 114;

interface QuranReaderProps {
  isSaved: (id: string) => boolean;
  toggleSave: (id: string) => void;
  /** Open the annotation editor for an already-saved ayah. */
  onOpenAnnotate: (id: string) => void;
  /** Reading position + bookmarks. Both free; the heart stays premium. */
  reading: ReadingState;
}

// ── One surah row in the index ──────────────────────────────────────────────
const SurahRow = React.memo(function SurahRow({
  surah,
  onPress,
  resumeAyah,
  bookmarkCount,
}: {
  surah: QuranSurah;
  onPress: (s: QuranSurah, ayah?: number) => void;
  /** Set when this is the surah last read, and past its first ayah. */
  resumeAyah: number | null;
  bookmarkCount: number;
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
        {/* Only the two states worth their own row: mid-read, and bookmarked. */}
        {(resumeAyah != null || bookmarkCount > 0) && (
          <View style={styles.rowTags}>
            {resumeAyah != null && (
              <View style={styles.rowTag}>
                <MaterialCommunityIcons name="book-clock-outline" size={11} color={ACCENT} />
                <Text style={styles.rowTagText}>ayah {resumeAyah}</Text>
              </View>
            )}
            {bookmarkCount > 0 && (
              <View style={styles.rowTag}>
                <MaterialCommunityIcons name="bookmark" size={11} color={ACCENT} />
                <Text style={styles.rowTagText}>{bookmarkCount}</Text>
              </View>
            )}
          </View>
        )}
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
  bookmarked,
  onToggleSave,
  onToggleBookmark,
  onAnnotate,
}: {
  verse: QuranVerse;
  surahNum: number;
  saved: boolean;
  bookmarked: boolean;
  onToggleSave: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onAnnotate: (id: string) => void;
}) {
  const id = ayahId(surahNum, verse.id);
  return (
    <View style={[styles.verseRow, bookmarked && styles.verseRowBookmarked]}>
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
          {/* Bookmark means "come back here" - free, and deliberately distinct
              from the heart, which curates the premium Reflections collection. */}
          <TouchableOpacity
            onPress={() => onToggleBookmark(id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={bookmarked ? ACCENT : 'rgba(232,224,214,0.35)'}
            />
          </TouchableOpacity>
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

export function QuranReader({ isSaved, toggleSave, onOpenAnnotate, reading }: QuranReaderProps) {
  // Loads the bundled dataset on first render of the Qur'an tab (lazy).
  const surahs = useMemo(() => getSurahs(), []);
  const [active, setActive] = useState<QuranSurah | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const listRef = useRef<FlatList<QuranVerse>>(null);

  // The ayah index the reader should land on once the list has mounted. Set
  // when opening a surah and consumed by the restore effect below.
  const pendingIndex = useRef(0);
  const scrollAttempts = useRef(0);

  // useReading hands back a fresh object every render, so the hook's actions
  // are reached through refs. Depending on `reading` directly would rebuild
  // renderVerse on every recorded scroll tick and break VerseRow's memo at
  // precisely the moment the list is being scrolled.
  const recordRef = useRef(reading.recordQuran);
  const toggleBookmarkRef = useRef(reading.toggleBookmark);
  useEffect(() => {
    recordRef.current = reading.recordQuran;
    toggleBookmarkRef.current = reading.toggleBookmark;
  }, [reading.recordQuran, reading.toggleBookmark]);

  const openSurah = useCallback((s: QuranSurah, ayah?: number) => {
    Haptics.selectionAsync();
    const target = ayah != null ? Math.min(Math.max(ayah, 1), s.total_verses) : 1;
    pendingIndex.current = target - 1;
    scrollAttempts.current = 0;
    setActive(s);
    // Record the move immediately instead of waiting for onViewableItemsChanged.
    // That event only fires when the set of viewable KEYS changes, so stepping
    // between two surahs while near the top of both (Al-Baqarah -> Ali 'Imran
    // at ayah 1, say) produced no event at all and left "Continue reading"
    // pointing at the surah just left. Opening a surah IS the position change,
    // so it should not be inferred from scrolling.
    recordRef.current(s.id, target);
  }, []);

  const backToIndex = useCallback(() => {
    Haptics.selectionAsync();
    setActive(null);
  }, []);

  // ── Position tracking ───────────────────────────────────────────────────────
  // FlatList refuses a changing onViewableItemsChanged identity, so the handler
  // is built once and reads everything it needs through refs.
  const activeRef = useRef<QuranSurah | null>(null);
  useEffect(() => { activeRef.current = active; }, [active]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 40 }).current;
  const onViewableItemsChanged = useRef((info: { viewableItems: Array<{ item?: QuranVerse }> }) => {
    const top = info.viewableItems[0]?.item;
    const surah = activeRef.current;
    if (surah && top) recordRef.current(surah.id, top.id);
  }).current;

  // ── Restore position on open ────────────────────────────────────────────────
  // Verse heights vary, so there is no getItemLayout and initialScrollIndex is
  // not available; scrollToIndex has to be issued after mount and retried until
  // enough rows have been measured.
  useEffect(() => {
    if (!active) return;
    const index = pendingIndex.current;
    const t = setTimeout(() => {
      // Belt and braces alongside the surah-scoped keyExtractor: the keys now
      // differ between chapters, but the underlying ScrollView can still hold
      // its contentOffset across a data swap. Stepping from ayah 200 of
      // Al-Baqarah into Ali 'Imran has to land at the top.
      if (index <= 0) {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        return;
      }
      try { listRef.current?.scrollToIndex({ index, animated: false }); } catch { /* retried below */ }
    }, 0);
    return () => clearTimeout(t);
  }, [active]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      // Capped, so a bad index can never spin forever.
      if (scrollAttempts.current >= 8) { pendingIndex.current = 0; return; }
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

  // ── Index-level derived data ────────────────────────────────────────────────
  // Reactive membership for the rows - reading.isBookmarked reads a ref, which
  // is stable but would not re-render anything when a bookmark is toggled.
  const bookmarkedIds = useMemo(
    () => new Set(reading.bookmarks.map((b) => b.id)),
    [reading.bookmarks],
  );

  const bookmarkCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const b of reading.bookmarks) {
      const ref = parseAyahId(b.id);
      if (ref) counts.set(ref.surah, (counts.get(ref.surah) ?? 0) + 1);
    }
    return counts;
  }, [reading.bookmarks]);

  // Resolved and put back in mushaf order - insertion order is not how anyone
  // thinks about where an ayah sits.
  const quranBookmarks = useMemo(() => {
    const out: { id: string; surah: QuranSurah; ayah: number }[] = [];
    for (const b of reading.bookmarks) {
      const ref = parseAyahId(b.id);
      if (!ref) continue;                       // a hadith bookmark, not ours
      const surah = getSurah(ref.surah);
      if (surah) out.push({ id: b.id, surah, ayah: ref.ayah });
    }
    out.sort((a, z) => (a.surah.id - z.surah.id) || (a.ayah - z.ayah));
    return out;
  }, [reading.bookmarks]);

  const resume = reading.quran;
  const resumeSurah = resume ? getSurah(resume.surah) : null;

  const renderSurah = useCallback(
    ({ item }: { item: QuranSurah }) => (
      <SurahRow
        surah={item}
        onPress={openSurah}
        resumeAyah={resume && resume.surah === item.id && resume.ayah > 1 ? resume.ayah : null}
        bookmarkCount={bookmarkCounts.get(item.id) ?? 0}
      />
    ),
    [openSurah, resume, bookmarkCounts],
  );

  const renderVerse = useCallback(
    ({ item }: { item: QuranVerse }) => (
      <VerseRow
        verse={item}
        surahNum={active!.id}
        saved={isSaved(ayahId(active!.id, item.id))}
        bookmarked={bookmarkedIds.has(ayahId(active!.id, item.id))}
        onToggleSave={onToggleSave}
        onToggleBookmark={onToggleBookmark}
        onAnnotate={onOpenAnnotate}
      />
    ),
    [active, isSaved, bookmarkedIds, onToggleSave, onToggleBookmark, onOpenAnnotate],
  );

  // ── Surah index ──
  if (!active) {
    return (
      <FlatList
        style={styles.fill}
        data={surahs}
        keyExtractor={(s) => String(s.id)}
        renderItem={renderSurah}
        extraData={[resume, bookmarkCounts]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={16}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            {/* The most useful thing the index can offer: get me back to where
                I stopped, without having to remember the number. */}
            {resumeSurah && resume ? (
              <TouchableOpacity
                style={styles.resumeCard}
                onPress={() => openSurah(resumeSurah, resume.ayah)}
                activeOpacity={0.85}
              >
                <View style={styles.resumeIcon}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={18} color="#0f1526" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resumeLabel}>Continue reading</Text>
                  <Text style={styles.resumeWhere} numberOfLines={1}>
                    {resumeSurah.transliteration} · ayah {resume.ayah} of {resumeSurah.total_verses}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={ACCENT} />
              </TouchableOpacity>
            ) : null}

            {/* Placing a bookmark is only half of it - without somewhere that
                jumps straight back, finding ayah 217 of Al-Baqarah again still
                means scrolling. Collapsed by default so the index stays an
                index, and at the TOP because a panel below 114 rows may as
                well not exist. */}
            {quranBookmarks.length > 0 && (
              <View style={styles.bmBlock}>
                <TouchableOpacity
                  style={styles.bmHeader}
                  onPress={() => { Haptics.selectionAsync(); setBookmarksOpen((v) => !v); }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="bookmark-multiple-outline" size={16} color={ACCENT} />
                  <Text style={styles.bmHeaderText}>Bookmarks · {quranBookmarks.length}</Text>
                  <MaterialCommunityIcons
                    name={bookmarksOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={ACCENT}
                  />
                </TouchableOpacity>
                {bookmarksOpen && quranBookmarks.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.bmRow}
                    onPress={() => openSurah(b.surah, b.ayah)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.bmRef}>{b.surah.id}:{b.ayah}</Text>
                    <Text style={styles.bmName} numberOfLines={1}>{b.surah.transliteration}</Text>
                    <TouchableOpacity
                      onPress={() => onToggleBookmark(b.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="close" size={16} color="rgba(232,224,214,0.4)" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {quranBookmarks.length > 0 || resumeSurah ? <View style={{ height: 12 }} /> : null}
          </View>
        }
        ListFooterComponent={<Text style={styles.credit}>{TRANSLATION_CREDIT}</Text>}
      />
    );
  }

  // ── Reader ──
  const showBismillah = active.id !== 1 && active.id !== 9;
  const prevSurah = active.id > 1 ? surahs[active.id - 2] : null;
  const nextSurah = active.id < TOTAL_SURAHS ? surahs[active.id] : null;

  return (
    <View style={styles.fill}>
      <View style={styles.readerHeader}>
        <TouchableOpacity
          onPress={backToIndex}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#e8e0d6" />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.readerTitle} numberOfLines={1}>
            {active.transliteration} <Text style={styles.readerTitleArabic}>{active.name}</Text>
          </Text>
          <Text style={styles.readerMeta} numberOfLines={1}>
            {active.translation} · {active.type === 'meccan' ? 'Meccan' : 'Medinan'} · {active.total_verses} verses
          </Text>
        </View>
        {/* Move between surahs without going back to the index first. */}
        <View style={styles.navPair}>
          <TouchableOpacity
            onPress={() => prevSurah && openSurah(prevSurah)}
            disabled={!prevSurah}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={[styles.navBtn, !prevSurah && styles.navBtnOff]}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={20}
              color={prevSurah ? ACCENT : 'rgba(232,224,214,0.18)'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => nextSurah && openSurah(nextSurah)}
            disabled={!nextSurah}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={[styles.navBtn, !nextSurah && styles.navBtnOff]}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={nextSurah ? ACCENT : 'rgba(232,224,214,0.18)'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={styles.fill}
        data={active.verses}
        // Scoped to the surah: ayah numbers restart at 1 in every chapter, so a
        // bare v.id made FlatList treat Ali 'Imran ayah 5 as the same row as
        // Al-Baqarah ayah 5 - no viewability change to report, and a retained
        // scroll offset to go with it.
        keyExtractor={(v) => `${active.id}:${v.id}`}
        renderItem={renderVerse}
        extraData={[isSaved, bookmarkedIds]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 40 }}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={onScrollToIndexFailed}
        ListHeaderComponent={
          showBismillah ? <Text style={styles.bismillah}>{BISMILLAH}</Text> : null
        }
        ListFooterComponent={
          <View>
            {/* Finishing a surah is exactly when you want the next one, so the
                big target belongs here as well as in the header. */}
            {nextSurah && (
              <TouchableOpacity
                style={styles.nextCard}
                onPress={() => openSurah(nextSurah)}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.nextLabel}>Next surah</Text>
                  <Text style={styles.nextName} numberOfLines={1}>
                    {nextSurah.id}. {nextSurah.transliteration} · {nextSurah.total_verses} verses
                  </Text>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={20} color={ACCENT} />
              </TouchableOpacity>
            )}
            <Text style={styles.credit}>{TRANSLATION_CREDIT}</Text>
          </View>
        }
      />
    </View>
  );
}

// Shown at the foot of the index and of every surah. The Arabic is Tanzil's
// Uthmani text and the English is Yusuf Ali (1934), which is public domain -
// crediting both is what keeps that provenance visible to a reader.
const TRANSLATION_CREDIT =
  'Arabic: Tanzil (Uthmani) · English translation: Abdullah Yusuf Ali (1934), public domain';

const styles = StyleSheet.create({
  fill: { flex: 1 },

  credit: {
    fontSize: 10.5,
    lineHeight: 15,
    color: 'rgba(232,224,214,0.38)',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
  },

  // ── Continue reading ──
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(232,168,124,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.32)',
    marginBottom: 12,
  },
  resumeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  resumeWhere: { fontSize: 14, fontWeight: '700', color: '#e8e0d6', marginTop: 2 },

  // ── Bookmark jump panel ──
  bmBlock: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  bmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  bmHeaderText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#e8e0d6' },
  bmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  bmRef: { fontSize: 11, fontWeight: '800', color: ACCENT, minWidth: 44 },
  bmName: { flex: 1, fontSize: 13, color: 'rgba(232,224,214,0.8)' },

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
  rowTags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  rowTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(232,168,124,0.12)',
  },
  rowTagText: { fontSize: 10, fontWeight: '700', color: ACCENT },

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
  readerTitleArabic: { fontSize: 16, color: ACCENT, fontFamily: FONTS.arabic },
  readerMeta: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 1 },

  navPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(232,168,124,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnOff: { backgroundColor: 'rgba(255,255,255,0.035)' },

  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(232,168,124,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.28)',
    marginTop: 4,
  },
  nextLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  nextName: { fontSize: 14, fontWeight: '700', color: '#e8e0d6', marginTop: 2 },

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
  verseRowBookmarked: { borderLeftColor: ACCENT, backgroundColor: 'rgba(232,168,124,0.07)' },
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
    fontSize: 21,
    lineHeight: 42,
    color: '#f0e9df',
    fontFamily: FONTS.arabic,
    textAlign: 'right',
    marginBottom: 8,
  },
  verseTranslation: { fontSize: 13, color: 'rgba(232,224,214,0.8)', lineHeight: 20 },
});
