import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  PanResponder,
  KeyboardAvoidingView,
  Keyboard,
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
const ERASE_RADIUS = 16; // finger tolerance for the eraser, in canvas px

// Warm ink palette that reads well on the dark "paper".
const PALETTE = ['#f2e9dc', '#e8a87c', '#8fbf9f', '#7fb0d9', '#e07a8b', '#f4d06f'];

type Tool = 'pen' | 'highlight' | 'erase';

// Highlighter marks render translucent + fat; pen marks solid + thin.
function strokeOpacity(kind: Stroke['kind']) {
  return kind === 'highlight' ? 0.32 : 1;
}

// Parse an SVG "M x y L x y ..." path into its points.
function parsePoints(d: string): { x: number; y: number }[] {
  const nums = d.match(/-?\d+(\.\d+)?/g);
  if (!nums) return [];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
  }
  return pts;
}

// Shortest distance from point p to segment ab.
function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Turn a list of points back into an SVG "M x y L x y ..." path.
function pointsToPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  return d;
}

// Erase the part of a stroke within reach of the touch at (x,y), keeping the
// rest. Returns the resulting stroke pieces: 0 (fully rubbed out), 1 (nicked an
// end), or 2+ (rubbed a gap in the middle, splitting it). This is what makes the
// eraser rub out SECTIONS of a line rather than deleting the whole thing.
function eraseFromStroke(s: Stroke, x: number, y: number): Stroke[] {
  const pts = parsePoints(s.d);
  if (pts.length === 0) return [s];
  const threshold = ERASE_RADIUS + s.width / 2;

  // Keep every point outside the eraser; break the run wherever points are erased.
  const runs: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const pt of pts) {
    if (Math.hypot(pt.x - x, pt.y - y) <= threshold) {
      if (current.length) { runs.push(current); current = []; }
    } else {
      current.push(pt);
    }
  }
  if (current.length) runs.push(current);

  // Nothing erased -> stroke unchanged. Otherwise each surviving run (of 2+
  // points, so it still draws a line) becomes its own stroke piece.
  if (runs.length === 1 && runs[0].length === pts.length) return [s];
  return runs
    .filter((r) => r.length >= 2)
    .map((r) => ({ ...s, d: pointsToPath(r) }));
}

// Long verses get slightly smaller type so the paper always fits on screen
// without scrolling (the editor deliberately has NO scroll view - a scroll
// gesture would steal touches mid-stroke and break drawing).
function arabicFontSize(len: number) {
  if (len > 150) return 19;
  if (len > 90) return 21;
  return 24;
}
function translationFontSize(len: number) {
  if (len > 220) return 13;
  if (len > 140) return 14;
  return 16;
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
  const [notesFocused, setNotesFocused] = useState(false);

  // Live stroke being drawn.
  const [currentPath, setCurrentPath] = useState('');
  const currentRef = useRef('');

  // Canvas size at draw time, stored so previews can scale via viewBox.
  const canvas = useRef({ w: 1, h: 1 });

  // The keyboard may ONLY be dismissed via the notebook tick. Any other touch
  // (tools, colours, canvas) blurs the field on iOS, so we hold focus: on blur
  // we refocus UNLESS `allowDismiss` was set. The tick sets it on onPressIn -
  // touch-DOWN, which fires before the blur - so the tick's own tap is honoured
  // while every other tap keeps the keyboard up.
  const inputRef = useRef<TextInput>(null);
  const notesFocusedRef = useRef(false);
  const allowDismiss = useRef(false);

  // Load the entry's saved state whenever the editor opens.
  useEffect(() => {
    if (visible && entry) {
      setStrokes(entry.annotation?.strokes ?? []);
      setNote(entry.note ?? '');
      setTool('pen');
      setColor(PALETTE[1]);
      currentRef.current = '';
      setCurrentPath('');
      setNotesFocused(false);
      notesFocusedRef.current = false;
      allowDismiss.current = false;
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

  // Rub out the sections of any strokes within reach of the eraser, keeping the
  // untouched parts. Called live as the finger moves - drag along a line and it
  // erodes only the portion you follow, splitting or shortening strokes.
  const eraseAt = useCallback((x: number, y: number) => {
    setStrokes((prev) => {
      let changed = false;
      const next: Stroke[] = [];
      for (const s of prev) {
        const pieces = eraseFromStroke(s, x, y);
        if (pieces.length !== 1 || pieces[0] !== s) changed = true;
        next.push(...pieces);
      }
      if (changed) Haptics.selectionAsync();
      return changed ? next : prev;
    });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // While the notebook keyboard is up, the paper is inert - a touch here
        // must not steal focus and drop the keyboard. Press the tick first.
        onStartShouldSetPanResponder: () => !notesFocusedRef.current,
        onMoveShouldSetPanResponder: () => !notesFocusedRef.current,
        // Never surrender the touch mid-stroke - this is what kept "deleting
        // the line you were drawing" when a parent tried to take over.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        // Note: deliberately does NOT dismiss the keyboard - the tick in the
        // notebook header is the one and only way to put the keyboard away.
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          if (toolRef.current === 'erase') {
            eraseAt(locationX, locationY);
            return;
          }
          currentRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCurrentPath(currentRef.current);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          if (toolRef.current === 'erase') {
            eraseAt(locationX, locationY);
            return;
          }
          currentRef.current = `${currentRef.current} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCurrentPath(currentRef.current);
        },
        onPanResponderRelease: () => {
          if (toolRef.current === 'erase') return; // erasing handled live in grant/move
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

  // Dismiss the keyboard - the deliberate path (the notebook tick).
  // allowDismiss is set on the tick's onPressIn (before the blur) so onBlur
  // lets go instead of refocusing.
  const dismissKeyboard = useCallback(() => {
    allowDismiss.current = true;
    notesFocusedRef.current = false;
    inputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleSave = useCallback(() => {
    if (!entry) return;
    allowDismiss.current = true; // let the field blur freely as we close
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
        >
          {/* Workspace: tools left, verse centre-stage, colours right.
              NO scroll view anywhere - the pen owns every touch on the paper. */}
          <View style={styles.workspace}>
            {/* Left rail - tools */}
            <View style={styles.rail}>
              <TouchableOpacity
                style={[styles.railBtn, tool === 'pen' && styles.railBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setTool('pen'); }}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="pencil" size={19} color={tool === 'pen' ? '#0f1526' : 'rgba(232,224,214,0.7)'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.railBtn, tool === 'highlight' && styles.railBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setTool('highlight'); }}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="marker" size={19} color={tool === 'highlight' ? '#0f1526' : 'rgba(232,224,214,0.7)'} />
              </TouchableOpacity>

              {/* Eraser - a selectable tool: rub across marks to erase them */}
              <TouchableOpacity
                style={[styles.railBtn, tool === 'erase' && styles.railBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setTool('erase'); }}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="eraser" size={19} color={tool === 'erase' ? '#0f1526' : 'rgba(232,224,214,0.7)'} />
              </TouchableOpacity>

              <View style={styles.railGap} />

              <TouchableOpacity
                style={[styles.railBtn, !hasMarks && styles.railBtnDisabled]}
                onPress={undo}
                disabled={!hasMarks}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="undo-variant" size={19} color="rgba(232,224,214,0.7)" />
              </TouchableOpacity>
              {/* Delete-all - clears every mark, sits below the eraser */}
              <TouchableOpacity
                style={[styles.railBtn, styles.railBtnDanger, !hasMarks && styles.railBtnDisabled]}
                onPress={clear}
                disabled={!hasMarks}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="delete-outline" size={19} color={hasMarks ? '#e07a8b' : 'rgba(232,224,214,0.7)'} />
              </TouchableOpacity>
            </View>

            {/* Centre - the verse paper (the canvas) */}
            <View style={styles.paperColumn}>
              <VersePaper entry={entry} scale={1} onLayout={onCanvasLayout} panHandlers={panResponder.panHandlers}>
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
                  {currentPath && tool !== 'erase' ? (
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

                {/* First-open hint, fades once anything is drawn */}
                {!hasMarks && tool !== 'erase' && (
                  <View style={styles.pageHint} pointerEvents="none">
                    <MaterialCommunityIcons name="gesture" size={14} color="rgba(232,224,214,0.35)" />
                    <Text style={styles.pageHintText}>draw or highlight anywhere on the verse</Text>
                  </View>
                )}
                {hasMarks && tool === 'erase' && (
                  <View style={styles.pageHint} pointerEvents="none">
                    <MaterialCommunityIcons name="eraser" size={14} color="rgba(232,224,214,0.35)" />
                    <Text style={styles.pageHintText}>rub across a mark to erase it</Text>
                  </View>
                )}
              </VersePaper>
            </View>

            {/* Right rail - ink colours */}
            <View style={styles.rail}>
              {PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => { Haptics.selectionAsync(); setColor(c); }}
                  style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
                  activeOpacity={0.8}
                />
              ))}
            </View>
          </View>

          {/* Bottom - notebook. Fills the lower third so the page feels balanced. */}
          <View style={styles.notebook}>
            <View style={styles.notebookHeader}>
              <MaterialCommunityIcons name="pencil-outline" size={14} color={ACCENT} />
              <Text style={styles.notebookLabel}>My notes</Text>
              {notesFocused && (
                <TouchableOpacity
                  onPressIn={() => { allowDismiss.current = true; }}
                  onPress={dismissKeyboard}
                  style={styles.keyboardDone}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="check" size={15} color="#0f1526" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.notebookMargin} />
            <TextInput
              ref={inputRef}
              style={styles.notebookInput}
              value={note}
              onChangeText={setNote}
              onFocus={() => { notesFocusedRef.current = true; allowDismiss.current = false; setNotesFocused(true); }}
              onBlur={() => {
                if (allowDismiss.current) {
                  // Sanctioned dismissal (tick or editor close).
                  allowDismiss.current = false;
                  notesFocusedRef.current = false;
                  setNotesFocused(false);
                } else {
                  // Any other tap blurred us - hold the keyboard up.
                  inputRef.current?.focus();
                }
              }}
              placeholder="What did this verse stir in you? A du'a, a memory, a promise..."
              placeholderTextColor="rgba(232,224,214,0.3)"
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// The verse "paper". SHARED by the editor (scale 1, interactive) and the saved-
// card preview (scaled down). Because it's one component rendered at a uniform
// scale, the card reproduces the editor's exact text layout - so strokes, which
// are stored relative to this box, always line up with the words they marked.
export function VersePaper({
  entry,
  scale = 1,
  forcedHeight,
  onLayout,
  panHandlers,
  children,
}: {
  entry: { arabic?: string; translation: string; source: string };
  scale?: number;
  forcedHeight?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  panHandlers?: any;
  children?: React.ReactNode;
}) {
  const aSize = arabicFontSize(entry.arabic?.length ?? 0) * scale;
  const tSize = translationFontSize(entry.translation.length) * scale;
  return (
    <View
      style={[
        styles.page,
        {
          padding: 18 * scale,
          paddingBottom: 30 * scale,
          borderRadius: 20 * scale,
          ...(forcedHeight != null ? { height: forcedHeight, minHeight: 0 } : { minHeight: 220 }),
        },
      ]}
      onLayout={onLayout}
      {...(panHandlers || {})}
    >
      <View pointerEvents="none">
        {!!entry.arabic && (
          <Text style={[styles.arabic, { fontSize: aSize, lineHeight: aSize * 1.9, marginBottom: 12 * scale }]}>
            {entry.arabic}
          </Text>
        )}
        <Text style={[styles.translation, { fontSize: tSize, lineHeight: tSize * 1.6, marginBottom: 10 * scale }]}>
          {entry.translation}
        </Text>
        <Text style={[styles.pageSource, { fontSize: 12 * scale }]}>{entry.source}</Text>
      </View>
      {children}
    </View>
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

  // ── Workspace: rails frame the verse so it's the centre of attention ──
  workspace: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  rail: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  railBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  railBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  railBtnDanger: { borderColor: 'rgba(224,122,139,0.4)' },
  railBtnDisabled: { opacity: 0.3 },
  railGap: { height: 14 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#fff', transform: [{ scale: 1.2 }] },

  // The verse paper
  paperColumn: { flex: 1, justifyContent: 'center', minHeight: 0, paddingHorizontal: 4 },
  page: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.18)',
    padding: 18,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  arabic: { color: '#e8e0d6', textAlign: 'right', marginBottom: 12, fontFamily: FONTS.arabic },
  translation: { color: 'rgba(232,224,214,0.9)', marginBottom: 10 },
  pageSource: { fontSize: 12, color: ACCENT, fontWeight: '700' },
  pageHint: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pageHintText: { fontSize: 11, color: 'rgba(232,224,214,0.35)', fontStyle: 'italic' },

  // ── Notebook (bottom third) ──
  notebook: {
    marginHorizontal: 14,
    marginBottom: 24,
    borderRadius: 18,
    backgroundColor: 'rgba(232,168,124,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.18)',
    padding: 14,
    paddingTop: 10,
  },
  notebookHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  notebookLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  keyboardDone: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notebookMargin: {
    position: 'absolute',
    left: 34,
    top: 38,
    bottom: 14,
    width: 1,
    backgroundColor: 'rgba(232,168,124,0.15)',
  },
  notebookInput: {
    minHeight: 74,
    maxHeight: 120,
    paddingLeft: 28,
    fontSize: 15,
    color: '#e8e0d6',
    lineHeight: 24,
    fontStyle: 'italic',
    fontFamily: FONTS.display,
  },
});
