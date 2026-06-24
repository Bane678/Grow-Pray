// ─── Daily Reflections (ayah / hadith) ───────────────────────────────────────
//
// ⚠️ OWNER VERIFICATION REQUIRED (Req 2.3):
// Before release, verify EVERY Arabic text, translation, and source citation in this
// file against an authentic reference. Items are marked with // VERIFY. Nothing here
// makes a network request; all content is bundled on-device and contains no images of
// faces, animals, or humans.

export type ReflectionKind = 'ayah' | 'hadith';

export interface Reflection {
  id: string;
  kind: ReflectionKind;
  arabic?: string;     // VERIFY
  translation: string; // VERIFY
  source: string;      // VERIFY
}

export const REFLECTIONS: Reflection[] = [
  {
    id: 'r_2_152',
    kind: 'ayah',
    // VERIFY
    arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
    translation: 'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
    source: "Qur'an 2:152", // VERIFY
  },
  {
    id: 'r_13_28',
    kind: 'ayah',
    // VERIFY
    arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    translation: 'Verily, in the remembrance of Allah do hearts find rest.',
    source: "Qur'an 13:28", // VERIFY
  },
  {
    id: 'r_94_6',
    kind: 'ayah',
    // VERIFY
    arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    translation: 'Indeed, with hardship comes ease.',
    source: "Qur'an 94:6", // VERIFY
  },
  {
    id: 'r_2_286',
    kind: 'ayah',
    // VERIFY
    arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation: 'Allah does not burden a soul beyond that it can bear.',
    source: "Qur'an 2:286", // VERIFY
  },
  {
    id: 'r_65_3',
    kind: 'ayah',
    // VERIFY
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    translation: 'And whoever relies upon Allah, then He is sufficient for him.',
    source: "Qur'an 65:3", // VERIFY
  },
  {
    id: 'r_29_45',
    kind: 'ayah',
    // VERIFY
    arabic: 'إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ',
    translation: 'Indeed, prayer prohibits immorality and wrongdoing.',
    source: "Qur'an 29:45", // VERIFY
  },
  {
    id: 'h_deeds_intentions',
    kind: 'hadith',
    // VERIFY
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    translation: 'Actions are but by intentions.',
    source: 'Bukhari & Muslim', // VERIFY
  },
  {
    id: 'h_best_deeds_consistent',
    kind: 'hadith',
    translation:
      'The most beloved of deeds to Allah are the most consistent, even if they are few.',
    source: 'Bukhari & Muslim', // VERIFY
  },
  {
    id: 'h_first_prayer',
    kind: 'hadith',
    translation:
      'The first thing for which a servant will be brought to account on the Day of Judgement is the prayer.',
    source: 'Tirmidhi', // VERIFY
  },
  {
    id: 'h_smile_charity',
    kind: 'hadith',
    translation: 'Your smiling in the face of your brother is charity.',
    source: 'Tirmidhi', // VERIFY
  },
];

/**
 * Deterministic index for a given date: the same reflection shows all day and
 * rotates day to day. Uses the local day-of-year.
 */
export function reflectionIndexForDate(date: Date, length = REFLECTIONS.length): number {
  if (length <= 0) return 0;
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return ((dayOfYear % length) + length) % length;
}
