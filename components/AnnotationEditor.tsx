import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { SavedReflectionEntry, Stroke, Annotation } from '../hooks/useReflections';

const ACCENT = '#e8a87c';
const PEN_WIDTH = 3.5;
const HIGHLIGHT_WIDTH = 22;

// Warm ink palette that reads well on the dark "paper".
const PALETTE = ['#f2e9dc', '#e8a87c', '#8fbf9f', '#7fb0d9', '#e07a8b', '#f4d06f'];

type Tool = 'pen' | 'highlight';

// Highlighter marks render translucent + fat; pen marks solid + thin.
function strokeOpacity(kind: Stroke['kind']) {
  return kind === 'highlight' ? 0.32 : 1;
}

interface AnnotationEditorProps {
  visible: boolean;
  entry: SavedReflectionEntry | null;
  onClose: () => void;
  onSave: (id: string, note: string, annotation?: Annotation) => void;
}

export function AnnotationEditor({ visible, entry, onClose, onSave }: AnnotationEditorProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [note, setNote] = useState('');
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(PALETTE[1]);

  // Live stroke being drawn.
  const [currentPath, setCurrentPath] = useState('');
  const currentRef = useRef('');

  // Canvas size at draw time, stored so previews can scale via viewBox.
  const canvas = useRef({ w: 1, h: 1 });

  // Load the entry's saved state whenever the editor opens.
  useEffect(() => {
    if (visible && entry) {
      setStrokes(entry.annotation?.strokes ?? []);
      setNote(entry.note ?? '');
      setTool('pen');
      setColor(PALETTE[1]);
      currentRef.current = '';
      setCurrentPath('');
    }
  }, [visible, entry]);

  // Keep the latest tool/color available to the (memoized) PanResponder.
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  toolRef.current = tool;
  colorRef.current = color;

  const onCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    canvas.current = { w: width, h: height };
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCurrentPath(currentRef.current);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentRef.current = `${currentRef.current} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCurrentPath(currentRef.current);
        },
        onPanResponderRelease: () => {
          const d = currentRef.current;
          currentRef.current = '';
          setCurrentPath('');
          if (!d || d.indexOf('L') === -1) return; // ignore taps with no movement
          const kind: Stroke['kind'] = toolRef.current === 'highlight' ? 'highlight' : 'pen';
          setStrokes((prev) => [
            ...prev,
            {
              d,
              color: colorRef.current,
              width: kind === 'highlight' ? HIGHLIGHT_WIDTH : PEN_WIDTH,
              kind,
            },
          ]);
        },
      }),
    [],
  );

  const undo = useCallback(() => {
    Haptics.selectionAsync();
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    Haptics.selectionAsync();
    setStrokes([]);
  }, []);

  const handleSave = useCallback(() => {
    if (!entry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const annotation: Annotation | undefined = strokes.length
      ? { strokes, w: canvas.current.w, h: canvas.current.h }
      : undefined;
    onSave(entry.id, note.trim(), annotation);
    onClose();
  }, [entry, strokes, note, onSave, onClose]);

  if (!entry) return null;

  const kindLabel = entry.kind === 'ayah' ? "Qur'an" : 'Hadith';
  const hasMarks = strokes.length > 0 || currentPath.length > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleSave}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerBack}>
            <MaterialCommunityIcons name="chevron-left" size={26} color="#e8e0d6" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>My reflection</Text>
            <Text style={styles.headerSub}>{kindLabel} · {entry.source}</Text>
          </View>
          <TouchableOpacity onPress={handleSave} style={styles.doneBtn} activeOpacity={0.85}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* The reflection "paper" you draw on */}
            <Text style={styles.canvasHint}>Draw or highlight right on the verse</Text>
            <View style={styles.page} onLayout={onCanvasLayout} {...panResponder.panHandlers}>
              <View style={styles.pageText} pointerEvents="none">
                {!!entry.arabic && <Text style={styles.arabic}>{entry.arabic}</Text>}
                <Text style={styles.translation}>{entry.translation}</Text>
                <Text style={styles.source}>{entry.source}</Text>
              </View>
              {/* Drawing layer on top of the text */}
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {strokes.map((s, i) => (
                  <Path
                    key={i}
                    d={s.d}
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeOpacity={strokeOpacity(s.kind)}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath ? (
                  <Path
                    d={currentPath}
                    stroke={color}
                    strokeWidth={tool === 'highlight' ? HIGHLIGHT_WIDTH : PEN_WIDTH}
                    strokeOpacity={strokeOpacity(tool === 'highlight' ? 'highlight' : 'pen')}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </Svg>
            </View>

            {/* Toolbar */}
            <View style={styles.toolbar}>
              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[styles.toolBtn, tool === 'pen' && styles.toolBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setTool('pen'); }}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="pencil" size={18} color={tool === 'pen' ? '#0f1526' : 'rgba(232,224,214,0.7)'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolBtn, tool === 'highlight' && styles.toolBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setTool('highlight'); }}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="marker" size={18} color={tool === 'highlight' ? '#0f1526' : 'rgba(232,224,214,0.7)'} />
                </TouchableOpacity>
              </View>

              <View style={styles.swatchRow}>
                {PALETTE.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => { Haptics.selectionAsync(); setColor(c); }}
                    style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
                    activeOpacity={0.8}
                  />
                ))}
              </View>

              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[styles.toolBtn, !hasMarks && styles.toolBtnDisabled]}
                  onPress={undo}
                  disabled={!hasMarks}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="undo-variant" size={18} color="rgba(232,224,214,0.7)" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolBtn, !hasMarks && styles.toolBtnDisabled]}
                  onPress={clear}
                  disabled={!hasMarks}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="eraser" size={18} color="rgba(232,224,214,0.7)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Journal notes */}
            <View style={styles.journal}>
              <View style={styles.journalHeader}>
                <MaterialCommunityIcons name="notebook-outline" size={15} color={ACCENT} />
                <Text style={styles.journalLabel}>Notes</Text>
              </View>
              <TextInput
                style={styles.journalInput}
                value={note}
                onChangeText={setNote}
                placeholder="Write what this verse stirred in you, a du'a, a memory..."
                placeholderTextColor="rgba(232,224,214,0.3)"
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// Read-only preview of a reflection's strokes, scaled to the given width.
export function AnnotationPreview({
  annotation,
  width,
}: {
  annotation: Annotation;
  width: number;
}) {
  const { w, h } = annotation;
  if (!w || !h || width <= 0) return null;
  const height = (h / w) * width;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${w} ${h}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {annotation.strokes.map((s, i) => (
        <Path
          key={i}
          d={s.d}
          stroke={s.color}
          strokeWidth={s.width}
          strokeOpacity={strokeOpacity(s.kind)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f1c' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  headerSub: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 1 },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: ACCENT },
  doneText: { fontSize: 13, fontWeight: '800', color: '#0f1526' },

  canvasHint: { fontSize: 11, color: 'rgba(232,224,214,0.4)', textAlign: 'center', marginBottom: 8, letterSpacing: 0.3 },

  // The reflection "paper"
  page: {
    minHeight: 220,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    overflow: 'hidden',
  },
  pageText: {},
  arabic: { fontSize: 24, color: '#e8e0d6', textAlign: 'right', lineHeight: 46, marginBottom: 14, fontFamily: FONTS.arabic },
  translation: { fontSize: 16, color: 'rgba(232,224,214,0.9)', lineHeight: 26, marginBottom: 12 },
  source: { fontSize: 13, color: ACCENT, fontWeight: '700' },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  toolGroup: { flexDirection: 'row', gap: 6 },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  toolBtnActive: { backgroundColor: ACCENT },
  toolBtnDisabled: { opacity: 0.35 },
  swatchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#fff', transform: [{ scale: 1.15 }] },

  // Journal
  journal: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  journalHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  journalLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(232,224,214,0.75)', letterSpacing: 0.3 },
  journalInput: {
    minHeight: 120,
    fontSize: 16,
    color: '#e8e0d6',
    lineHeight: 26,
    fontFamily: FONTS.display,
  },
});
