// ─── Daily Reflections (ayah / hadith) ───────────────────────────────────────
//
// ⚠️ OWNER VERIFICATION REQUIRED (Req 2.3):
// Before release, verify EVERY Arabic text, translation, and source citation in this
// file against an authentic reference. Items are marked with // VERIFY. Nothing here
// makes a network request; all content is bundled on-device and contains no images of
// faces, animals, or humans.

export type ReflectionKind = 'ayah' | 'hadith';

// Theme is used to weight the "reflection of the day" toward prayer/remembrance,
// while still occasionally surfacing general motivational verses & hadith.
export type ReflectionTheme = 'prayer' | 'general';

export interface Reflection {
  id: string;
  kind: ReflectionKind;
  theme: ReflectionTheme;
  arabic?: string;     // VERIFY
  translation: string; // VERIFY
  source: string;      // VERIFY
}

export const REFLECTIONS: Reflection[] = [
  // ── Qur'an · prayer & remembrance ──────────────────────────────────────────
  {
    id: 'r_2_152',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
    translation: 'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
    source: "Qur'an 2:152", // VERIFY
  },
  {
    id: 'r_13_28',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    translation: 'Those who believe, and whose hearts find rest in the remembrance of Allah. Verily, in the remembrance of Allah do hearts find rest.',
    source: "Qur'an 13:28", // VERIFY
  },
  {
    id: 'r_29_45',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ',
    translation: 'Indeed, prayer prohibits immorality and wrongdoing.',
    source: "Qur'an 29:45", // VERIFY
  },
  {
    id: 'r_20_14',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'إِنَّنِي أَنَا اللَّهُ لَا إِلَٰهَ إِلَّا أَنَا فَاعْبُدْنِي وَأَقِمِ الصَّلَاةَ لِذِكْرِي',
    translation: 'Indeed, I am Allah. There is no deity except Me, so worship Me and establish prayer for My remembrance.',
    source: "Qur'an 20:14", // VERIFY
  },
  {
    id: 'r_2_45',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى الْخَاشِعِينَ',
    translation: 'And seek help through patience and prayer; and indeed, it is difficult except for the humbly submissive.',
    source: "Qur'an 2:45", // VERIFY
  },
  {
    id: 'r_2_153',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
    translation: 'O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.',
    source: "Qur'an 2:153", // VERIFY
  },
  {
    id: 'r_23_1_2',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'قَدْ أَفْلَحَ الْمُؤْمِنُونَ ۝ الَّذِينَ هُمْ فِي صَلَاتِهِمْ خَاشِعُونَ',
    translation: 'Certainly will the believers have succeeded: they who are during their prayer humbly submissive.',
    source: "Qur'an 23:1–2", // VERIFY
  },
  {
    id: 'r_87_14_15',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'قَدْ أَفْلَحَ مَن تَزَكَّىٰ ۝ وَذَكَرَ اسْمَ رَبِّهِ فَصَلَّىٰ',
    translation: 'He has certainly succeeded who purifies himself, and mentions the name of his Lord and prays.',
    source: "Qur'an 87:14–15", // VERIFY
  },
  {
    id: 'r_11_114',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'وَأَقِمِ الصَّلَاةَ طَرَفَيِ النَّهَارِ وَزُلَفًا مِّنَ اللَّيْلِ ۚ إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ',
    translation: 'And establish prayer at the two ends of the day and at the approach of the night. Indeed, good deeds do away with misdeeds.',
    source: "Qur'an 11:114", // VERIFY
  },
  {
    id: 'r_4_103',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'فَإِذَا قَضَيْتُمُ الصَّلَاةَ فَاذْكُرُوا اللَّهَ قِيَامًا وَقُعُودًا وَعَلَىٰ جُنُوبِكُمْ',
    translation: 'And when you have completed the prayer, remember Allah standing, sitting, or lying on your sides.',
    source: "Qur'an 4:103", // VERIFY
  },
  {
    id: 'r_51_56',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'وَمَا خَلَقْتُ الْجِنَّ وَالْإِنسَ إِلَّا لِيَعْبُدُونِ',
    translation: 'And I did not create the jinn and mankind except to worship Me.',
    source: "Qur'an 51:56", // VERIFY
  },
  {
    id: 'r_62_9',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ فَاسْعَوْا إِلَىٰ ذِكْرِ اللَّهِ',
    translation: 'O you who have believed, when the call is made for prayer on the day of Jumu‘ah, then proceed to the remembrance of Allah.',
    source: "Qur'an 62:9", // VERIFY
  },
  {
    id: 'r_8_2',
    kind: 'ayah',
    theme: 'prayer',
    // VERIFY
    arabic: 'إِنَّمَا الْمُؤْمِنُونَ الَّذِينَ إِذَا ذُكِرَ اللَّهُ وَجِلَتْ قُلُوبُهُمْ',
    translation: 'The believers are only those who, when Allah is mentioned, their hearts become fearful.',
    source: "Qur'an 8:2", // VERIFY
  },

  // ── Qur'an · closeness, mercy & motivation ─────────────────────────────────
  {
    id: 'r_2_186',
    kind: 'ayah',
    theme: 'general',
    // VERIFY
    arabic: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ',
    translation: 'And when My servants ask you concerning Me, indeed I am near. I respond to the call of the caller when he calls upon Me.',
    source: "Qur'an 2:186", // VERIFY
  },
  {
    id: 'r_40_60',
    kind: 'ayah',
    theme: 'general',
    // VERIFY
    arabic: 'وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ',
    translation: 'And your Lord says: Call upon Me; I will respond to you.',
    source: "Qur'an 40:60", // VERIFY
  },
  {
    id: 'r_94_5_6',
    kind: 'ayah',
    theme: 'general',
    // VERIFY
    arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    translation: 'For indeed, with hardship comes ease. Indeed, with hardship comes ease.',
    source: "Qur'an 94:5–6", // VERIFY
  },
  {
    id: 'r_2_286',
    kind: 'ayah',
    theme: 'general',
    // VERIFY
    arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation: 'Allah does not burden a soul beyond that it can bear.',
    source: "Qur'an 2:286", // VERIFY
  },
  {
    id: 'r_65_3',
    kind: 'ayah',
    theme: 'general',
    // VERIFY
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    translation: 'And whoever relies upon Allah, then He is sufficient for him.',
    source: "Qur'an 65:3", // VERIFY
  },
  {
    id: 'r_39_53',
    kind: 'ayah',
    theme: 'general',
    // VERIFY
    arabic: 'قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ',
    translation: 'Say: O My servants who have transgressed against themselves, do not despair of the mercy of Allah.',
    source: "Qur'an 39:53", // VERIFY
  },
  {
    id: 'r_3_139',
    kind: 'ayah',
    theme: 'general',
    // VERIFY
    arabic: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ',
    translation: 'So do not weaken and do not grieve, and you will be superior if you are true believers.',
    source: "Qur'an 3:139", // VERIFY
  },
  {
    id: 'r_14_7',
    kind: 'ayah',
    theme: 'general',
    // VERIFY
    arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ',
    translation: 'If you are grateful, I will surely increase you in favour.',
    source: "Qur'an 14:7", // VERIFY
  },

  // ── Hadith ─────────────────────────────────────────────────────────────────
  {
    id: 'h_first_prayer',
    kind: 'hadith',
    theme: 'prayer',
    // VERIFY
    translation:
      'The first thing for which a servant will be brought to account on the Day of Judgement is the prayer.',
    source: 'Tirmidhi', // VERIFY
  },
  {
    id: 'h_qurrat_ayn',
    kind: 'hadith',
    theme: 'prayer',
    // VERIFY
    arabic: 'وَجُعِلَتْ قُرَّةُ عَيْنِي فِي الصَّلَاةِ',
    translation: 'And the coolness of my eyes has been placed in prayer.',
    source: "Nasa'i", // VERIFY
  },
  {
    id: 'h_arihna_bilal',
    kind: 'hadith',
    theme: 'prayer',
    // VERIFY
    arabic: 'يَا بِلَالُ أَرِحْنَا بِهَا',
    translation: 'O Bilal, call the prayer; give us comfort by it.',
    source: 'Abu Dawud', // VERIFY
  },
  {
    id: 'h_two_cool_prayers',
    kind: 'hadith',
    theme: 'prayer',
    // VERIFY
    translation:
      'Whoever prays the two cool prayers - Fajr and Asr - will enter Paradise.',
    source: 'Bukhari & Muslim', // VERIFY
  },
  {
    id: 'h_best_deeds_consistent',
    kind: 'hadith',
    theme: 'general',
    // VERIFY
    translation:
      'The most beloved of deeds to Allah are the most consistent, even if they are few.',
    source: 'Bukhari & Muslim', // VERIFY
  },
  {
    id: 'h_deeds_intentions',
    kind: 'hadith',
    theme: 'general',
    // VERIFY
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    translation: 'Actions are but by intentions.',
    source: 'Bukhari & Muslim', // VERIFY
  },
  {
    id: 'h_smile_charity',
    kind: 'hadith',
    theme: 'general',
    // VERIFY
    translation: 'Your smiling in the face of your brother is charity.',
    source: 'Tirmidhi', // VERIFY
  },
];

/**
 * Deterministic day-of-year for a given date (local time). Same all day; +1 each day.
 */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

/**
 * The reflection to show for a given calendar day.
 *
 * Deterministic per day (stable all day, rotates day-to-day) but weighted so that
 * ~7 of every 10 days draw from the prayer/remembrance pool, with the remaining
 * days surfacing a general motivational verse or hadith. Falls back gracefully if
 * either pool is empty.
 */
export function reflectionForDate(date: Date = new Date()): Reflection | null {
  if (REFLECTIONS.length === 0) return null;

  const doy = dayOfYear(date);
  const prayerPool = REFLECTIONS.filter((r) => r.theme === 'prayer');
  const generalPool = REFLECTIONS.filter((r) => r.theme !== 'prayer');

  // 0–6 → prayer, 7–9 → general (≈70/30), with graceful fallback.
  const wantsPrayer = doy % 10 < 7;
  let pool = wantsPrayer ? prayerPool : generalPool;
  if (pool.length === 0) pool = REFLECTIONS;

  const idx = ((doy % pool.length) + pool.length) % pool.length;
  return pool[idx];
}

/**
 * Deterministic index into the FULL list for a date (kept for backwards compat).
 */
export function reflectionIndexForDate(date: Date, length = REFLECTIONS.length): number {
  if (length <= 0) return 0;
  const doy = dayOfYear(date);
  return ((doy % length) + length) % length;
}
