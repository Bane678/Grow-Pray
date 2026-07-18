import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REFLECTIONS, Reflection, reflectionForDate } from '../data/reflections';
import { getAyahAsReflection } from '../data/quran';
import { getHadithAsReflection } from '../data/hadith';

const FAVOURITES_KEY = '@GrowPray:reflectionFavourites';

// A single freehand mark drawn over a reflection.
export interface Stroke {
  d: string;                    // SVG path data (M/L commands)
  color: string;
  width: number;
  kind: 'pen' | 'highlight';
}

// The user's mark-up of a reflection: strokes + the canvas size they were drawn
// at, so a preview can scale them to any width via an SVG viewBox.
export interface Annotation {
  strokes: Stroke[];
  w: number;
  h: number;
}

// A saved reflection carries the user's own note + annotation + when they saved
// it, so the archive reads as a personal journal rather than a flat list.
export interface SavedReflection {
  id: string;
  note: string;
  savedAt: number;
  annotation?: Annotation;
}

// A saved reflection joined with its verse/hadith content, for rendering.
export type SavedReflectionEntry = Reflection & {
  note: string;
  savedAt: number;
  annotation?: Annotation;
};

function coerceAnnotation(raw: any): Annotation | undefined {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.strokes)) return undefined;
  const strokes: Stroke[] = raw.strokes
    .filter((s: any) => s && typeof s.d === 'string')
    .map((s: any) => ({
      d: s.d,
      color: typeof s.color === 'string' ? s.color : '#e8a87c',
      width: typeof s.width === 'number' ? s.width : 3,
      kind: s.kind === 'highlight' ? 'highlight' : 'pen',
    }));
  const w = typeof raw.w === 'number' && raw.w > 0 ? raw.w : 1;
  const h = typeof raw.h === 'number' && raw.h > 0 ? raw.h : 1;
  return strokes.length ? { strokes, w, h } : undefined;
}

// Accept both the legacy string[] shape and the new object[] shape on load.
function migrateSaved(raw: unknown): SavedReflection[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedReflection[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      // Legacy favourite id -> seed with empty note / unknown save time.
      out.push({ id: entry, note: '', savedAt: 0 });
    } else if (entry && typeof entry === 'object' && typeof (entry as any).id === 'string') {
      const e = entry as any;
      out.push({
        id: e.id,
        note: typeof e.note === 'string' ? e.note : '',
        savedAt: typeof e.savedAt === 'number' ? e.savedAt : 0,
        annotation: coerceAnnotation(e.annotation),
      });
    }
  }
  return out;
}

export function useReflections() {
  const [saved, setSaved] = useState<SavedReflection[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
        if (raw) setSaved(migrateSaved(JSON.parse(raw)));
      } catch {
        // Safe default: empty list.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Today's reflection - deterministic per calendar day, prayer-weighted.
  const today: Reflection | null = useMemo(() => reflectionForDate(new Date()), []);

  const persist = useCallback((next: SavedReflection[]) => {
    AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const isSaved = useCallback((id: string) => saved.some((s) => s.id === id), [saved]);

  // Toggle save state. Adds a fresh record (empty note) or removes the existing one.
  const toggleSave = useCallback(
    (id: string) => {
      setSaved((prev) => {
        const exists = prev.some((s) => s.id === id);
        const next = exists
          ? prev.filter((s) => s.id !== id)
          : [...prev, { id, note: '', savedAt: Date.now() }];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // Save the user's note + drawn annotation together (from the editor).
  const saveAnnotation = useCallback(
    (id: string, note: string, annotation?: Annotation) => {
      setSaved((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...s, note, annotation } : s,
        );
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // Saved reflections joined with their content, newest saved first.
  // Ids resolve against the curated pool first, then the full Qur'an (q_* ids),
  // then the hadith collection (h_nw_* ids) - so any hearted item shows up in
  // Saved exactly like curated verses.
  const savedReflections: SavedReflectionEntry[] = useMemo(() => {
    const byId = new Map(REFLECTIONS.map((r) => [r.id, r]));
    return saved
      .map((s): SavedReflectionEntry | null => {
        const r = byId.get(s.id) ?? getAyahAsReflection(s.id) ?? getHadithAsReflection(s.id);
        return r ? { ...r, note: s.note, savedAt: s.savedAt, annotation: s.annotation } : null;
      })
      .filter((x): x is SavedReflectionEntry => x !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
  }, [saved]);

  return {
    today,
    allReflections: REFLECTIONS,
    saved,
    savedReflections,
    savedCount: saved.length,
    isSaved,
    toggleSave,
    saveAnnotation,
    loaded,
  };
}
