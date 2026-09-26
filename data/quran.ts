// ─── Full Qur'an (bundled, on-device) ────────────────────────────────────────
//
// SOURCES:
//   Arabic     - Tanzil (Uthmani script), via the `quran-json` dataset.
//   Translation - "The Holy Qur'an: Text, Translation and Commentary" by
//                 Abdullah Yusuf Ali (1934), which is in the public domain.
//
// The translation was previously Saheeh International, which is under
// copyright and was not licensed for this app. It was replaced wholesale
// ahead of release - all 6,236 ayat, swapped verse-for-verse against
// alquran.cloud's `en.yusufali` edition with the surah and ayah counts
// asserted equal before writing. (Pickthall was used briefly in between and
// replaced for being too archaic to read comfortably.) The excerpts in
// data/reflections.ts,
// data/adhkar.ts, the onboarding ayah card and the win-back notification were
// moved to Yusuf Ali in the same pass; if you add another verse quote
// anywhere, take it from Yusuf Ali too.
//
// Verified counts: 114 surahs / 6,236 ayat. No network requests - everything
// ships in the bundle.
//
// PERF: the ~2.4 MB JSON is loaded LAZILY on first access (require() inside a
// function body), so it costs nothing at app startup - only when the Qur'an
// tab is first opened or a saved q_* ayah needs resolving.

import { Reflection } from './reflections';

export interface QuranVerse {
  id: number;          // ayah number within the surah (1-based)
  text: string;        // Arabic (Uthmani)
  translation: string; // English (Yusuf Ali, public domain)
}

export interface QuranSurah {
  id: number;              // surah number 1..114
  name: string;            // Arabic name
  transliteration: string; // e.g. "Al-Fatihah"
  translation: string;     // English meaning of the name, e.g. "The Opener"
  type: 'meccan' | 'medinan';
  total_verses: number;
  verses: QuranVerse[];
}

// Shown above every surah except Al-Fatihah (bismillah IS ayah 1:1) and
// At-Tawbah (traditionally opens without it).
export const BISMILLAH = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

let _quran: QuranSurah[] | null = null;
function load(): QuranSurah[] {
  if (!_quran) {
    // Deferred require: Metro executes the JSON module factory on first call.
    _quran = require('./quran.json') as QuranSurah[];
  }
  return _quran;
}

/** All 114 surahs (loads the dataset on first call). */
export function getSurahs(): QuranSurah[] {
  return load();
}

/** One surah by number (1..114), or null. */
export function getSurah(n: number): QuranSurah | null {
  if (n < 1 || n > 114) return null;
  return load()[n - 1] ?? null;
}

/** Stable id for an ayah, matching the reflections id style (e.g. q_2_255). */
export function ayahId(surah: number, ayah: number): string {
  return `q_${surah}_${ayah}`;
}

/** Parse a q_{surah}_{ayah} id. Returns null for anything else. */
export function parseAyahId(id: string): { surah: number; ayah: number } | null {
  const m = /^q_(\d+)_(\d+)$/.exec(id);
  if (!m) return null;
  return { surah: parseInt(m[1], 10), ayah: parseInt(m[2], 10) };
}

/**
 * Resolve a saved q_* id to a Reflection-shaped object so Qur'an ayat flow
 * through the existing save/annotate plumbing untouched. Returns null for
 * non-Qur'an ids WITHOUT loading the dataset (cheap guard for legacy users).
 */
export function getAyahAsReflection(id: string): Reflection | null {
  const ref = parseAyahId(id);
  if (!ref) return null;
  const surah = getSurah(ref.surah);
  const verse = surah?.verses[ref.ayah - 1];
  if (!surah || !verse) return null;
  return {
    id,
    kind: 'ayah',
    theme: 'general',
    arabic: verse.text,
    translation: verse.translation,
    source: `Qur'an ${ref.surah}:${ref.ayah} · ${surah.transliteration}`,
  };
}
