import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView } from 'react-native';
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

const GradeBadge = React.memo(function GradeBadge({ grade }: { grade: Hadith['grade'] }) {
  const isSahih = grade === 'sahih';
  return (
    <View style={[styles.gradeBadge, isSahih ? styles.gradeSahih : styles.gradeHasan]}>
      <MaterialCommunityIcons name="shield-check" size={11} color={isSahih ? '#0f1526' : HADITH_ACCENT} />
      <Text style={[styles.gradeText, isSahih ? styles.gradeTextSahih : styles.gradeTextHasan]}>
        {gradeLabel(grade)}
      </Text>
    </View>
  );
});

// ── One hadith row in the index ─────────────────────────────────────────────
// Mirrors SurahRow: a number, something to recognise it by, and the two states
// worth a tag of their own.
const HadithRow = React.memo(function HadithRow({
  hadith,
  onPress,
  isResume,
  bookmarked,
}: {
  hadith: Hadith;
  onPress: (h: Hadith) => void;
  isResume: boolean;
  bookmarked: boolean;
}) {
  return (
    <TouchableOpacity style={styles.indexRow} onPress={() => onPress(hadith)} activeOpacity={0.8}>
      <View style={styles.indexNum}>
        <Text style={styles.indexNumText}>{hadith.number}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* The opening words are what people actually recognise a hadith by -
            far more than its number or its narrator. */}
        <Text style={styles.indexTitle} numberOfLines={2}>{hadith.translation}</Text>
        <Text style={styles.indexMeta} numberOfLines={1}>{hadith.narrator}</Text>
        {(isResume || bookmarked) && (
          <View style={styles.rowTags}>
            {isResume && (
              <View style={styles.rowTag}>
                <MaterialCommunityIcons name="book-clock-outline" size={11} color={HADITH_ACCENT} />
                <Text style={styles.rowTagText}>last read</Text>
              </View>
            )}
            {bookmarked && (
              <View style={styles.rowTag}>
                <MaterialCommunityIcons name="bookmark" size={11} color={HADITH_ACCENT} />
                <Text style={styles.rowTagText}>saved spot</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <GradeBadge grade={hadith.grade} />
    </TouchableOpacity>
  );
});

export function HadithReader({ isSaved, toggleSave, onOpenAnnotate, reading }: HadithReaderProps) {
  const hadiths = useMemo(() => getHadiths(), []);
  const [active, setActive] = useState<Hadith | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  // useReading hands back a fresh object every render, so its actions are
  // reached through refs - depending on `reading` directly would rebuild the
  // row renderer on every position write and defeat HadithRow's memo.
  const recordRef = useRef(reading.recordHadith);
  const toggleBookmarkRef = useRef(reading.toggleBookmark);
  useEffect(() => {
    recordRef.current = reading.recordHadith;
    toggleBookmarkRef.current = reading.toggleBookmark;
  }, [reading.recordHadith, reading.toggleBookmark]);

  // Membership computed during render, so a tap shows immediately.
  const bookmarkedIds = useMemo(
    () => new Set(reading.bookmarks.map((b) => b.id)),
    [reading.bookmarks],
  );

  const openHadith = useCallback((h: Hadith) => {
    Haptics.selectionAsync();
    setBookmarksOpen(false);
    setActive(h);
    // Opening IS the position change - same reasoning as the Qur'an reader,
    // where inferring it from scroll events left the position stale.
    recordRef.current(h.number);
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

  const onToggleBookmark = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleBookmarkRef.current(id);
  }, []);

  // ── Index-level derived data ────────────────────────────────────────────────
  const resume = reading.hadith;
  const resumeHadith = useMemo(
    () => (resume ? hadiths.find((h) => h.number === resume.number) ?? null : null),
    [resume, hadiths],
  );

  const hadithBookmarks = useMemo(
    () => hadiths.filter((h) => bookmarkedIds.has(h.id)),
    [bookmarkedIds, hadiths],
  );

  const renderRow = useCallback(
    ({ item }: { item: Hadith }) => (
      <HadithRow
        hadith={item}
        onPress={openHadith}
        isResume={resume?.number === item.number}
        bookmarked={bookmarkedIds.has(item.id)}
      />
    ),
    [openHadith, resume, bookmarkedIds],
  );

  // ── Index ──
  if (!active) {
    return (
      <FlatList
        style={styles.fill}
        data={hadiths}
        keyExtractor={(h) => h.id}
        renderItem={renderRow}
        extraData={[resume, bookmarkedIds]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <View style={styles.collectionHeader}>
              <Text style={styles.collectionTitle}>{HADITH_COLLECTION.title}</Text>
              <Text style={styles.collectionSub}>
                {HADITH_COLLECTION.subtitle} · {hadiths.length} hadith
              </Text>
            </View>

            {resumeHadith ? (
              <TouchableOpacity
                style={styles.resumeCard}
                onPress={() => openHadith(resumeHadith)}
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

            {hadithBookmarks.length > 0 && (
              <View style={styles.bmBlock}>
                <TouchableOpacity
                  style={styles.bmHeader}
                  onPress={() => { Haptics.selectionAsync(); setBookmarksOpen((v) => !v); }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="bookmark-multiple-outline" size={16} color={HADITH_ACCENT} />
                  <Text style={styles.bmHeaderText}>Bookmarks · {hadithBookmarks.length}</Text>
                  <MaterialCommunityIcons
                    name={bookmarksOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={HADITH_ACCENT}
                  />
                </TouchableOpacity>
                {bookmarksOpen && hadithBookmarks.map((h) => (
                  <TouchableOpacity
                    key={h.id}
                    style={styles.bmRow}
                    onPress={() => openHadith(h)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.bmRef}>{h.number}</Text>
                    <Text style={styles.bmName} numberOfLines={1}>{h.translation}</Text>
                    <TouchableOpacity
                      onPress={() => onToggleBookmark(h.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="close" size={16} color="rgba(232,224,214,0.4)" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {resumeHadith || hadithBookmarks.length > 0 ? <View style={{ height: 12 }} /> : null}
          </View>
        }
      />
    );
  }

  // ── Reader ──
  const pos = hadiths.findIndex((h) => h.id === active.id);
  const prev = pos > 0 ? hadiths[pos - 1] : null;
  const next = pos >= 0 && pos < hadiths.length - 1 ? hadiths[pos + 1] : null;
  const saved = isSaved(active.id);
  const bookmarked = bookmarkedIds.has(active.id);

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
          <Text style={styles.readerTitle} numberOfLines={1}>Hadith {active.number}</Text>
          <Text style={styles.readerMeta} numberOfLines={1}>
            {pos + 1} of {hadiths.length} · {active.narrator}
          </Text>
        </View>
        <View style={styles.navPair}>
          <TouchableOpacity
            onPress={() => prev && openHadith(prev)}
            disabled={!prev}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={[styles.navBtn, !prev && styles.navBtnOff]}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={20}
              color={prev ? HADITH_ACCENT : 'rgba(232,224,214,0.18)'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => next && openHadith(next)}
            disabled={!next}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={[styles.navBtn, !next && styles.navBtnOff]}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={next ? HADITH_ACCENT : 'rgba(232,224,214,0.18)'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* One hadith is a short read, so it scrolls as a page rather than a
          list - no virtualisation to fight, and it always opens at the top. */}
      <ScrollView
        style={styles.fill}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={[styles.card, bookmarked && styles.cardBookmarked]}>
          <View style={styles.cardTop}>
            <GradeBadge grade={active.grade} />
            <View style={styles.topRight}>
              {saved && (
                <TouchableOpacity
                  onPress={() => onOpenAnnotate(active.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="draw" size={17} color={HADITH_ACCENT} />
                </TouchableOpacity>
              )}
              {/* Bookmark means "come back here" - free, and deliberately
                  distinct from the heart, which curates the premium
                  Reflections collection. */}
              <TouchableOpacity
                onPress={() => onToggleBookmark(active.id)}
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
                onPress={() => onToggleSave(active.id)}
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

          <Text style={styles.arabic}>{active.arabic}</Text>
          <Text style={styles.translation}>{active.translation}</Text>

          <View style={styles.divider} />
          <View style={styles.footer}>
            <Text style={styles.narrator}>{active.narrator}</Text>
            <Text style={styles.source}>{active.source}</Text>
          </View>
        </View>

        {next && (
          <TouchableOpacity style={styles.nextCard} onPress={() => openHadith(next)} activeOpacity={0.85}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.nextLabel}>Next hadith</Text>
              <Text style={styles.nextName} numberOfLines={1}>
                {next.number}. {next.translation}
              </Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={20} color={HADITH_ACCENT} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  collectionHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    marginBottom: 12,
  },
  collectionTitle: { fontSize: 17, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  collectionSub: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 1 },

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

  // ── Bookmark jump panel ──
  bmBlock: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  bmHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 12 },
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
  bmRef: { fontSize: 11, fontWeight: '800', color: HADITH_ACCENT, minWidth: 22 },
  bmName: { flex: 1, fontSize: 13, color: 'rgba(232,224,214,0.8)' },

  // ── Index rows ──
  indexRow: {
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
  indexNum: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(143,191,159,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexNumText: { fontSize: 12, fontWeight: '800', color: HADITH_ACCENT },
  indexTitle: { fontSize: 13.5, fontWeight: '600', color: '#e8e0d6', lineHeight: 19 },
  indexMeta: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 3 },
  rowTags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  rowTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(143,191,159,0.12)',
  },
  rowTagText: { fontSize: 10, fontWeight: '700', color: HADITH_ACCENT },

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

  navPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(143,191,159,0.12)',
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
    backgroundColor: 'rgba(143,191,159,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(143,191,159,0.28)',
    marginTop: 4,
  },
  nextLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: HADITH_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  nextName: { fontSize: 14, fontWeight: '700', color: '#e8e0d6', marginTop: 2 },

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
