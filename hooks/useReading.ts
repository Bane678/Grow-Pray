import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Reading position & bookmarks ──────────────────────────────────────────────
//
// Two different things, deliberately kept apart:
//
//   POSITION  is automatic and implicit - "where I had got to". One per
//             collection, overwritten as you scroll, never managed by hand.
//   BOOKMARK  is explicit and plural - "take me back to this exact ayah". The
//             user places and removes them.
//
// Both are FREE. Saving an ayah to the Reflections collection (the heart) stays
// premium, and these do not overlap with it: the heart curates, these navigate.
// Gating "where was I" behind a subscription would make the reader worse at the
// one thing a reader has to do.

const QURAN_KEY     = '@GrowPray:reading:quran';
const HADITH_KEY    = '@GrowPray:reading:hadith';
const BOOKMARKS_KEY = '@GrowPray:reading:bookmarks';

/** Debounce for position writes - scroll fires far faster than we should persist. */
const WRITE_DELAY_MS = 700;

export interface QuranPosition {
  surah: number;   // 1..114
  ayah: number;    // 1-based within the surah
  at: number;      // epoch ms, for "last read" copy
}

export interface HadithPosition {
  number: number;  // position in Nawawi's collection
  at: number;
}

/** A bookmark id is an ayah id (`q_2_255`) or a hadith id (`h_nw_5`). */
export interface Bookmark {
  id: string;
  at: number;
}

export interface ReadingState {
  /** False until AsyncStorage has been read - callers should not write before this. */
  loaded: boolean;
  quran: QuranPosition | null;
  hadith: HadithPosition | null;
  bookmarks: Bookmark[];
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => void;
  recordQuran: (surah: number, ayah: number) => void;
  recordHadith: (n: number) => void;
  clearQuran: () => void;
  clearHadith: () => void;
}

export function useReading(): ReadingState {
  const [loaded, setLoaded] = useState(false);
  const [quran, setQuran] = useState<QuranPosition | null>(null);
  const [hadith, setHadith] = useState<HadithPosition | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Hydrate once. Any malformed value is discarded rather than crashing the
  // reader - a lost scroll position is not worth a red screen.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [q, h, b] = await Promise.all([
          AsyncStorage.getItem(QURAN_KEY),
          AsyncStorage.getItem(HADITH_KEY),
          AsyncStorage.getItem(BOOKMARKS_KEY),
        ]);
        if (!alive) return;
        if (q) {
          const p = JSON.parse(q);
          if (typeof p?.surah === 'number' && typeof p?.ayah === 'number') setQuran(p);
        }
        if (h) {
          const p = JSON.parse(h);
          if (typeof p?.number === 'number') setHadith(p);
        }
        if (b) {
          const list = JSON.parse(b);
          if (Array.isArray(list)) {
            setBookmarks(list.filter((x: any) => typeof x?.id === 'string'));
          }
        }
      } catch {
        // Fall through with empty state.
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Debounced position writes ───────────────────────────────────────────────
  // The pending value lives in a ref so the timer always flushes the latest
  // position rather than whichever one happened to schedule it.
  const pendingQuran = useRef<QuranPosition | null>(null);
  const pendingHadith = useRef<HadithPosition | null>(null);
  const quranTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadithTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushQuran = useCallback(() => {
    quranTimer.current = null;
    const p = pendingQuran.current;
    if (p) AsyncStorage.setItem(QURAN_KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  const flushHadith = useCallback(() => {
    hadithTimer.current = null;
    const p = pendingHadith.current;
    if (p) AsyncStorage.setItem(HADITH_KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  // Flush on unmount so closing the sheet mid-scroll still records where you were.
  useEffect(() => () => {
    if (quranTimer.current) { clearTimeout(quranTimer.current); flushQuran(); }
    if (hadithTimer.current) { clearTimeout(hadithTimer.current); flushHadith(); }
  }, [flushQuran, flushHadith]);

  const recordQuran = useCallback((surah: number, ayah: number) => {
    const next: QuranPosition = { surah, ayah, at: Date.now() };
    // Skip the state write when nothing moved - onViewableItemsChanged fires
    // repeatedly on the same top item during a slow scroll.
    setQuran((prev) => (prev && prev.surah === surah && prev.ayah === ayah ? prev : next));
    pendingQuran.current = next;
    if (!quranTimer.current) quranTimer.current = setTimeout(flushQuran, WRITE_DELAY_MS);
  }, [flushQuran]);

  const recordHadith = useCallback((n: number) => {
    const next: HadithPosition = { number: n, at: Date.now() };
    setHadith((prev) => (prev && prev.number === n ? prev : next));
    pendingHadith.current = next;
    if (!hadithTimer.current) hadithTimer.current = setTimeout(flushHadith, WRITE_DELAY_MS);
  }, [flushHadith]);

  const clearQuran = useCallback(() => {
    pendingQuran.current = null;
    if (quranTimer.current) { clearTimeout(quranTimer.current); quranTimer.current = null; }
    setQuran(null);
    AsyncStorage.removeItem(QURAN_KEY).catch(() => {});
  }, []);

  const clearHadith = useCallback(() => {
    pendingHadith.current = null;
    if (hadithTimer.current) { clearTimeout(hadithTimer.current); hadithTimer.current = null; }
    setHadith(null);
    AsyncStorage.removeItem(HADITH_KEY).catch(() => {});
  }, []);

  // ── Bookmarks ───────────────────────────────────────────────────────────────
  // Derived DURING render, not in an effect. Held in a ref this was always one
  // render stale: a tap set the new list, the row re-rendered and asked a ref
  // the effect had not refreshed yet, and since refs do not re-render, the
  // icon only caught up when something unrelated next rendered the list. That
  // is the lag - the bookmark was right in state and wrong on screen.
  const bookmarkIds = useMemo(() => new Set(bookmarks.map((b) => b.id)), [bookmarks]);
  const isBookmarked = useCallback((id: string) => bookmarkIds.has(id), [bookmarkIds]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks((prev) => (
      prev.some((b) => b.id === id)
        ? prev.filter((b) => b.id !== id)
        : [...prev, { id, at: Date.now() }]
    ));
  }, []);

  // Persist after commit rather than inside the updater - a write in there is
  // a side effect during render, and would also fire twice under StrictMode.
  // Gated on `loaded` so the empty initial state cannot clobber stored
  // bookmarks before hydration lands.
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks)).catch(() => {});
  }, [bookmarks, loaded]);

  return {
    loaded,
    quran,
    hadith,
    bookmarks,
    isBookmarked,
    toggleBookmark,
    recordQuran,
    recordHadith,
    clearQuran,
    clearHadith,
  };
}
