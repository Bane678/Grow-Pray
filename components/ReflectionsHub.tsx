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
import { AnnotationEditor, AnnotationPreview } from './AnnotationEditor';

const ACCENT = '#e8a87c';
// Per-kind accent so Qur'an vs Hadith read distinctly throughout the hub.
const KIND_ACCENT: Record<Reflection['kind'], string> = {
  ayah: '#e8a87c',   // warm gold
  hadith: '#8fbf9f', // soft sage
};

type HubTab = 'explore' | 'saved';
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
  allReflections: Reflection[];
  savedReflections: SavedReflectionEntry[];
  isSaved: (id: string) => boolean;
  toggleSave: (id: string) => void;
  saveAnnotation: (id: string, note: string, annotation?: Annotation) => void;
}

function kindLabel(kind: Reflection['kind']) {
  return kind === 'ayah' ? "Qur'an" : 'Hadith';
}

// ── Explore card: a reflection with a save toggle. ──
function ExploreCard({
  item,
  saved,
  onToggleSave,
}: {
  item: Reflection;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const kindColor = KIND_ACCENT[item.kind];
  return (
    <View style={[styles.card, { borderLeftColor: kindColor }]}>
      <View style={styles.cardTop}>
        <View style={[styles.kindChip, { backgroundColor: kindColor + '1f' }]}>
          <Text style={[styles.kindChipText, { color: kindColor }]}>{kindLabel(item.kind)}</Text>
        </View>
        <TouchableOpacity
          onPress={onToggleSave}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={saved ? 'heart' : 'heart-outline'}
            size={19}
            color={saved ? '#f87171' : 'rgba(232,224,214,0.4)'}
          />
        </TouchableOpacity>
      </View>

      {!!item.arabic && <Text style={styles.arabic}>{item.arabic}</Text>}
      <Text style={styles.translation}>{item.translation}</Text>

      <View style={styles.cardDivider} />
      <Text style={[styles.source, { color: kindColor }]}>{item.source}</Text>
    </View>
  );
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
  const hasMarks = !!item.annotation && item.annotation.strokes.length > 0;

  const onPageLayout = useCallback((e: LayoutChangeEvent) => {
    setPageW(e.nativeEvent.layout.width);
  }, []);

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

      {/* Verse + the user's marks overlaid */}
      <View style={styles.savedPage} onLayout={onPageLayout}>
        {!!item.arabic && <Text style={styles.arabic}>{item.arabic}</Text>}
        <Text style={styles.translation}>{item.translation}</Text>
        {hasMarks && pageW > 0 && (
          <AnnotationPreview annotation={item.annotation as Annotation} width={pageW} />
        )}
      </View>

      {/* Handwritten-feel note */}
      {hasNote && (
        <View style={styles.noteStrip}>
          <View style={styles.noteAccent} />
          <Text style={styles.noteText}>{item.note}</Text>
        </View>
      )}

      <View style={styles.savedFooter}>
        <Text style={[styles.source, { color: kindColor }]}>{item.source}</Text>
        <View style={styles.savedFooterRight}>
          {hasMarks && <MaterialCommunityIcons name="draw" size={13} color="rgba(232,224,214,0.5)" />}
          <Text style={styles.openHint}>{hasNote || hasMarks ? 'Open' : 'Add notes'}</Text>
          <MaterialCommunityIcons name="chevron-right" size={15} color="rgba(232,224,214,0.5)" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function ReflectionsHub({
  visible,
  initialTab,
  onClose,
  allReflections,
  savedReflections,
  isSaved,
  toggleSave,
  saveAnnotation,
}: ReflectionsHubProps) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [filter, setFilter] = useState<KindFilter>('all');
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [editorEntry, setEditorEntry] = useState<SavedReflectionEntry | null>(null);

  // Sync to the requested tab each time the hub opens.
  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  const filteredAll = useMemo(
    () => (filter === 'all' ? allReflections : allReflections.filter((r) => r.kind === filter)),
    [filter, allReflections],
  );
  const filteredSaved = useMemo(
    () => (filter === 'all' ? savedReflections : savedReflections.filter((r) => r.kind === filter)),
    [filter, savedReflections],
  );

  const pickSpotlight = useCallback((pool: Reflection[], excludeId?: string) => {
    if (pool.length === 0) { setSpotlightId(null); return; }
    if (pool.length === 1) { setSpotlightId(pool[0].id); return; }
    let choice = pool[Math.floor(Math.random() * pool.length)];
    let guard = 0;
    while (choice.id === excludeId && guard < 8) {
      choice = pool[Math.floor(Math.random() * pool.length)];
      guard++;
    }
    setSpotlightId(choice.id);
  }, []);

  // Keep the spotlight valid: pick one when opening Explore or when the filter
  // narrows the pool so the current pick no longer belongs.
  useEffect(() => {
    if (!visible || tab !== 'explore') return;
    if (!spotlightId || !filteredAll.some((r) => r.id === spotlightId)) {
      pickSpotlight(filteredAll);
    }
  }, [visible, tab, filteredAll, spotlightId, pickSpotlight]);

  const spotlight = useMemo(
    () => allReflections.find((r) => r.id === spotlightId) ?? null,
    [allReflections, spotlightId],
  );

  const onShuffle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pickSpotlight(filteredAll, spotlightId ?? undefined);
  }, [pickSpotlight, filteredAll, spotlightId]);

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
                {tab === 'explore'
                  ? `Browse all ${allReflections.length} · Qur'an & hadith`
                  : `${savedCount} saved · your collection`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.close}
            >
              <MaterialCommunityIcons name="close" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {([
              { key: 'explore', label: 'Explore', icon: 'compass-outline' },
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
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t.label}{t.key === 'saved' && savedCount > 0 ? ` · ${savedCount}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Filter chips */}
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

          {/* Content */}
          {tab === 'explore' ? (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Shuffle spotlight - a fresh verse on demand, no daily wait */}
              {spotlight && (
                <View style={styles.spotlightWrap}>
                  <View style={styles.spotlightHeader}>
                    <Text style={styles.spotlightLabel}>✨ Spotlight</Text>
                    <TouchableOpacity style={styles.shuffleBtn} onPress={onShuffle} activeOpacity={0.85}>
                      <MaterialCommunityIcons name="shuffle-variant" size={15} color={ACCENT} />
                      <Text style={styles.shuffleText}>Shuffle</Text>
                    </TouchableOpacity>
                  </View>
                  <ExploreCard
                    item={spotlight}
                    saved={isSaved(spotlight.id)}
                    onToggleSave={() => onToggleSave(spotlight.id)}
                  />
                </View>
              )}

              <Text style={styles.listLabel}>All reflections · {filteredAll.length}</Text>
              {filteredAll.map((item) => (
                <ExploreCard
                  key={item.id}
                  item={item}
                  saved={isSaved(item.id)}
                  onToggleSave={() => onToggleSave(item.id)}
                />
              ))}
            </ScrollView>
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
                  ? 'Tap the heart on any reflection in Explore to keep it here - then draw, highlight and write on it.'
                  : 'Try a different filter, or save more from Explore.'}
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
    // inner content scrolls/reflows to fit, matching the Explore tab's feel.
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
    gap: 8,
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
    gap: 6,
    paddingVertical: 9,
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

  // Spotlight
  spotlightWrap: { marginBottom: 18 },
  spotlightHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  spotlightLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(232,224,214,0.55)', letterSpacing: 0.5 },
  shuffleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(232,168,124,0.14)',
    borderWidth: 1, borderColor: 'rgba(232,168,124,0.3)',
  },
  shuffleText: { fontSize: 12, fontWeight: '700', color: ACCENT },

  listLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(232,224,214,0.4)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2,
  },

  // Content fills the fixed-height sheet so it never grows/shrinks with content.
  scroll: { flex: 1 },

  // ── Explore card ──
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  kindChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  kindChipText: { fontSize: 11, fontWeight: '700' },
  arabic: { fontSize: 23, color: '#e8e0d6', textAlign: 'right', lineHeight: 44, paddingTop: 8, marginBottom: 10, fontFamily: FONTS.arabic },
  translation: { fontSize: 14, color: 'rgba(232,224,214,0.85)', lineHeight: 21, marginTop: 4 },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 14, marginBottom: 10 },
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
  noteStrip: {
    flexDirection: 'row',
    marginTop: 14,
    paddingLeft: 2,
  },
  noteAccent: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(232,168,124,0.5)',
    marginRight: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(232,224,214,0.8)',
    lineHeight: 22,
    fontStyle: 'italic',
    fontFamily: FONTS.display,
  },
  savedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
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
