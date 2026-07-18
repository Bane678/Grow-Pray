import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { Reflection } from '../data/reflections';
import { SavedReflectionEntry, Annotation } from '../hooks/useReflections';
import { AnnotationEditor, AnnotationPreview, VersePaper } from './AnnotationEditor';
import { QuranReader } from './QuranReader';
import { HadithReader } from './HadithReader';

const ACCENT = '#e8a87c';
// Per-kind accent so Qur'an vs Hadith read distinctly throughout the hub.
const KIND_ACCENT: Record<Reflection['kind'], string> = {
  ayah: '#e8a87c',   // warm gold
  hadith: '#8fbf9f', // soft sage
};

type HubTab = 'quran' | 'hadith' | 'saved';
type KindFilter = 'all' | 'ayah' | 'hadith';

const FILTERS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ayah', label: "Qur'an" },
  { key: 'hadith', label: 'Hadith' },
];

interface ReflectionsHubProps {
  visible: boolean;
  initialTab: HubTab;
  onClose: () => void;
  savedReflections: SavedReflectionEntry[];
  isSaved: (id: string) => boolean;
  toggleSave: (id: string) => void;
  saveAnnotation: (id: string, note: string, annotation?: Annotation) => void;
}

function kindLabel(kind: Reflection['kind']) {
  return kind === 'ayah' ? "Qur'an" : 'Hadith';
}

// ── Saved card: journal-style, shows the user's own marks + note. Tap to open. ──
function SavedCard({
  item,
  onOpen,
  onUnsave,
}: {
  item: SavedReflectionEntry;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  const kindColor = KIND_ACCENT[item.kind];
  const [pageW, setPageW] = useState(0);
  const hasNote = !!item.note && item.note.trim().length > 0;
  const annotation = item.annotation;
  const hasMarks = !!annotation && annotation.strokes.length > 0;

  const onPageLayout = useCallback((e: LayoutChangeEvent) => {
    setPageW(e.nativeEvent.layout.width);
  }, []);

  // When annotated, render a faithful scaled clone of the editor page (same
  // layout, uniformly scaled) so the strokes sit exactly where they were drawn.
  const showReplica = hasMarks && !!annotation && pageW > 0;
  const scale = showReplica ? pageW / annotation!.w : 1;
  const paperH = showReplica ? annotation!.h * scale : 0;

  return (
    <TouchableOpacity
      style={[styles.savedCard, { borderLeftColor: kindColor }]}
      onPress={onOpen}
      activeOpacity={0.9}
    >
      <View style={styles.cardTop}>
        <View style={[styles.kindChip, { backgroundColor: kindColor + '1f' }]}>
          <Text style={[styles.kindChipText, { color: kindColor }]}>{kindLabel(item.kind)}</Text>
        </View>
        <TouchableOpacity
          onPress={onUnsave}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="heart" size={19} color="#f87171" />
        </TouchableOpacity>
      </View>

      {/* Verse. Annotated -> scaled clone of the editor page + marks overlaid so
          they line up. Plain -> simple text with the source. */}
      <View style={styles.savedVerseWrap} onLayout={onPageLayout}>
        {showReplica && annotation ? (
          <View style={{ height: paperH }}>
            <VersePaper entry={item} scale={scale} forcedHeight={paperH} />
            <AnnotationPreview annotation={annotation} width={pageW} />
          </View>
        ) : (
          <View>
            {!!item.arabic && <Text style={styles.arabic}>{item.arabic}</Text>}
            <Text style={styles.translation}>{item.translation}</Text>
            <Text style={[styles.source, { color: kindColor, marginTop: 10 }]}>{item.source}</Text>
          </View>
        )}
      </View>

      {/* The user's own note - labelled + sticky-note styling so it can't be
          mistaken for the quote's source. */}
      {hasNote && (
        <View style={styles.noteCardBox}>
          <View style={styles.noteHeader}>
            <MaterialCommunityIcons name="pencil-outline" size={12} color={ACCENT} />
            <Text style={styles.noteLabel}>My note</Text>
          </View>
          <Text style={styles.noteText} numberOfLines={3}>{item.note}</Text>
        </View>
      )}

      <View style={styles.savedFooter}>
        {hasMarks && <MaterialCommunityIcons name="draw" size={13} color="rgba(232,224,214,0.5)" />}
        <Text style={styles.openHint}>{hasNote || hasMarks ? 'Open' : 'Add notes'}</Text>
        <MaterialCommunityIcons name="chevron-right" size={15} color="rgba(232,224,214,0.5)" />
      </View>
    </TouchableOpacity>
  );
}

export function ReflectionsHub({
  visible,
  initialTab,
  onClose,
  savedReflections,
  isSaved,
  toggleSave,
  saveAnnotation,
}: ReflectionsHubProps) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [filter, setFilter] = useState<KindFilter>('all');
  const [editorEntry, setEditorEntry] = useState<SavedReflectionEntry | null>(null);

  // Sync to the requested tab each time the hub opens.
  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  const filteredSaved = useMemo(
    () => (filter === 'all' ? savedReflections : savedReflections.filter((r) => r.kind === filter)),
    [filter, savedReflections],
  );

  const onToggleSave = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      toggleSave(id);
    },
    [toggleSave],
  );

  const openEditor = useCallback((entry: SavedReflectionEntry) => {
    Haptics.selectionAsync();
    setEditorEntry(entry);
  }, []);

  // From the Qur'an reader: open the annotation editor for a saved ayah.
  const openAnnotateById = useCallback(
    (id: string) => {
      const entry = savedReflections.find((e) => e.id === id);
      if (entry) {
        Haptics.selectionAsync();
        setEditorEntry(entry);
      }
    },
    [savedReflections],
  );

  const savedCount = savedReflections.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title}>Reflections</Text>
              <Text style={styles.subtitle}>
                {tab === 'quran'
                  ? '114 surahs · read, save & annotate'
                  : tab === 'hadith'
                  ? "Nawawi's 40 · authenticated & cited"
                  : `${savedCount} saved · your collection`}
              </Text>
            </View>
            <TouchableOpacity
              // onPressIn (touch-DOWN), not onPress (touch-release): while the
              // Qur'an FlatList is still flinging, a release-based tap can sit
              // queued until the scroll settles. Touch-down fires immediately,
              // so the sheet closes the instant you touch the X - no waiting.
              onPressIn={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.close}
            >
              <MaterialCommunityIcons name="close" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {([
              { key: 'quran', label: "Qur'an", icon: 'book-open-page-variant' },
              { key: 'hadith', label: 'Hadith', icon: 'script-text-outline' },
              { key: 'saved', label: 'Saved', icon: 'heart-outline' },
            ] as const).map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => { Haptics.selectionAsync(); setTab(t.key); }}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons
                    name={t.icon}
                    size={15}
                    color={active ? '#0f1526' : 'rgba(232,224,214,0.6)'}
                  />
                  <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Filter chips - only meaningful on the Saved tab */}
          {tab === 'saved' && (
            <View style={styles.filterRow}>
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Content */}
          {tab === 'quran' ? (
            <QuranReader
              isSaved={isSaved}
              toggleSave={onToggleSave}
              onOpenAnnotate={openAnnotateById}
            />
          ) : tab === 'hadith' ? (
            <HadithReader
              isSaved={isSaved}
              toggleSave={onToggleSave}
              onOpenAnnotate={openAnnotateById}
            />
          ) : filteredSaved.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyRing}>
                <MaterialCommunityIcons name="heart-outline" size={30} color={ACCENT} />
              </View>
              <Text style={styles.emptyTitle}>
                {savedCount === 0 ? 'No saved reflections yet' : `No ${filter === 'ayah' ? "Qur'an" : 'hadith'} saved`}
              </Text>
              <Text style={styles.emptyBody}>
                {savedCount === 0
                  ? "Heart any ayah in the Qur'an tab (or the daily reflection) to keep it here - then draw, highlight and write on it."
                  : "Try a different filter, or save more from the Qur'an tab."}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {filteredSaved.map((item) => (
                <SavedCard
                  key={item.id}
                  item={item}
                  onOpen={() => openEditor(item)}
                  onUnsave={() => onToggleSave(item.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Full-screen annotation editor */}
      <AnnotationEditor
        visible={!!editorEntry}
        entry={editorEntry}
        onClose={() => setEditorEntry(null)}
        onSave={saveAnnotation}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f1526',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    // Fixed height so switching tabs/filters never resizes the sheet - only the
    // inner content scrolls/reflows to fit - the sheet frame never moves.
    height: '92%',
    paddingTop: 10,
    paddingHorizontal: 16,
  } as any,
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 14,
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  subtitle: { fontSize: 12, color: 'rgba(232,224,214,0.45)', marginTop: 2 },
  close: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: ACCENT },
  tabText: { fontSize: 13, fontWeight: '700', color: 'rgba(232,224,214,0.6)' },
  tabTextActive: { color: '#0f1526' },

  // Filter chips
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: { backgroundColor: 'rgba(232,168,124,0.16)', borderColor: 'rgba(232,168,124,0.4)' },
  chipText: { fontSize: 12, fontWeight: '600', color: 'rgba(232,224,214,0.55)' },
  chipTextActive: { color: ACCENT },

  // Content fills the fixed-height sheet so it never grows/shrinks with content.
  scroll: { flex: 1 },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  kindChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  kindChipText: { fontSize: 11, fontWeight: '700' },
  arabic: { fontSize: 23, color: '#e8e0d6', textAlign: 'right', lineHeight: 44, paddingTop: 8, marginBottom: 10, fontFamily: FONTS.arabic },
  translation: { fontSize: 14, color: 'rgba(232,224,214,0.85)', lineHeight: 21, marginTop: 4 },
  source: { fontSize: 12, fontWeight: '700' },

  // ── Saved card (journal) ──
  savedCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
  },
  savedPage: { position: 'relative', overflow: 'hidden', marginBottom: 4 },
  savedVerseWrap: { marginBottom: 4 },
  noteCardBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(232,168,124,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.22)',
    borderStyle: 'dashed',
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  noteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noteText: {
    fontSize: 14,
    color: 'rgba(232,224,214,0.82)',
    lineHeight: 22,
    fontStyle: 'italic',
    fontFamily: FONTS.display,
  },
  savedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 14 },
  savedFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openHint: { fontSize: 12, fontWeight: '600', color: 'rgba(232,224,214,0.5)' },

  // Empty state - centered in the flex area so it doesn't drag the sheet height.
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40, paddingHorizontal: 24 },
  emptyRing: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: 'rgba(232,168,124,0.1)',
    borderWidth: 1, borderColor: 'rgba(232,168,124,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#e8e0d6', marginBottom: 8, fontFamily: FONTS.display },
  emptyBody: { fontSize: 13, color: 'rgba(232,224,214,0.55)', textAlign: 'center', lineHeight: 20 },
});
