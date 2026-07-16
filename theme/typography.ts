// ─── Typography ───────────────────────────────────────────────────────────────
// Centralised font definitions. Headings use Fraunces - a warm, characterful
// "old-style" serif that gives the app a premium, spiritual personality and
// pairs with the dark navy + gold palette. Body stays on the system font for
// crisp legibility and reliable weight rendering.
//
// To switch the heading face later (e.g. to an Islamic Naskh serif like Amiri),
// change the family names here and the import/useFonts call in App.tsx - nothing
// else needs to touch.

export const FONTS = {
  /** Primary heading face - section titles, screen titles, hero copy */
  display: 'Fraunces_600SemiBold',
  /** Slightly lighter heading face - subtitles, large numerals */
  displayMedium: 'Fraunces_500Medium',
  /** Regular weight display - quotes, softer headings */
  displayRegular: 'Fraunces_400Regular',
  /** Arabic script - Indopak-style (Amiri) for all Arabic text */
  arabic: 'Amiri_400Regular',
} as const;

// Convenience style fragments to spread into a heading's style object.
export const HEADING = {
  display: { fontFamily: FONTS.display },
  displayMedium: { fontFamily: FONTS.displayMedium },
  displayRegular: { fontFamily: FONTS.displayRegular },
  arabic: { fontFamily: FONTS.arabic },
} as const;
