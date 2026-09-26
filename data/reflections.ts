// ─── Daily Reflections (ayah / hadith) ───────────────────────────────────────
//
// Every Arabic text, translation and source citation below was verified against an
// authentic reference ahead of the 1.0 release; re-verify anything you add. Nothing
// here makes a network request; all content is bundled on-device and contains no
// images of faces, animals, or humans.

export type ReflectionKind = 'ayah' | 'hadith';

// Theme is used to weight the "reflection of the day" toward prayer/remembrance,
// while still occasionally surfacing general motivational verses & hadith.
export type ReflectionTheme = 'prayer' | 'general';

export interface Reflection {
  id: string;
  kind: ReflectionKind;
  theme: ReflectionTheme;
  arabic?: string;
  translation: string;
  source: string;
}

export const REFLECTIONS: Reflection[] = [
  // ── Qur'an · prayer & remembrance ──────────────────────────────────────────
  {
    id: 'r_2_152',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
    translation: 'Therefore remember Me, I will remember you. Give thanks to Me, and reject not Me.',
    source: "Qur'an 2:152",
  },
  {
    id: 'r_13_28',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    translation: 'Who have believed and whose hearts have rest in the remembrance of Allah. Verily in the remembrance of Allah do hearts find rest!',
    source: "Qur'an 13:28",
  },
  {
    id: 'r_29_45',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ',
    translation: 'Lo! worship preserveth from lewdness and iniquity.',
    source: "Qur'an 29:45",
  },
  {
    id: 'r_20_14',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'إِنَّنِي أَنَا اللَّهُ لَا إِلَٰهَ إِلَّا أَنَا فَاعْبُدْنِي وَأَقِمِ الصَّلَاةَ لِذِكْرِي',
    translation: 'Lo! I, even I, am Allah. There is no Allah save Me. So serve Me and establish worship for My remembrance.',
    source: "Qur'an 20:14",
  },
  {
    id: 'r_2_45',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى الْخَاشِعِينَ',
    translation: 'Seek help in patience and prayer; and truly it is hard save for the humble-minded.',
    source: "Qur'an 2:45",
  },
  {
    id: 'r_2_153',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
    translation: 'O ye who believe! Seek help in steadfastness and prayer. Lo! Allah is with the steadfast.',
    source: "Qur'an 2:153",
  },
  {
    id: 'r_23_1_2',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'قَدْ أَفْلَحَ الْمُؤْمِنُونَ ۝ الَّذِينَ هُمْ فِي صَلَاتِهِمْ خَاشِعُونَ',
    translation: 'Successful indeed are the believers, who are humble in their prayers.',
    source: "Qur'an 23:1–2",
  },
  {
    id: 'r_87_14_15',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'قَدْ أَفْلَحَ مَن تَزَكَّىٰ ۝ وَذَكَرَ اسْمَ رَبِّهِ فَصَلَّىٰ',
    translation: 'He is successful who groweth, and remembereth the name of his Lord, so prayeth.',
    source: "Qur'an 87:14–15",
  },
  {
    id: 'r_11_114',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'وَأَقِمِ الصَّلَاةَ طَرَفَيِ النَّهَارِ وَزُلَفًا مِّنَ اللَّيْلِ ۚ إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ',
    translation: 'Establish worship at the two ends of the day and in some watches of the night. Lo! good deeds annul ill-deeds.',
    source: "Qur'an 11:114",
  },
  {
    id: 'r_4_103',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'فَإِذَا قَضَيْتُمُ الصَّلَاةَ فَاذْكُرُوا اللَّهَ قِيَامًا وَقُعُودًا وَعَلَىٰ جُنُوبِكُمْ',
    translation: 'When ye have performed the act of worship, remember Allah, standing, sitting and reclining.',
    source: "Qur'an 4:103",
  },
  {
    id: 'r_51_56',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'وَمَا خَلَقْتُ الْجِنَّ وَالْإِنسَ إِلَّا لِيَعْبُدُونِ',
    translation: 'I created the jinn and humankind only that they might worship Me.',
    source: "Qur'an 51:56",
  },
  {
    id: 'r_62_9',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ فَاسْعَوْا إِلَىٰ ذِكْرِ اللَّهِ',
    translation: 'O ye who believe! When the call is heard for the prayer of the day of congregation, haste unto remembrance of Allah.',
    source: "Qur'an 62:9",
  },
  {
    id: 'r_8_2',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'إِنَّمَا الْمُؤْمِنُونَ الَّذِينَ إِذَا ذُكِرَ اللَّهُ وَجِلَتْ قُلُوبُهُمْ',
    translation: 'They only are the (true) believers whose hearts feel fear when Allah is mentioned.',
    source: "Qur'an 8:2",
  },

  // ── Qur'an · closeness, mercy & motivation ─────────────────────────────────
  {
    id: 'r_2_186',
    kind: 'ayah',
    theme: 'general',
    arabic: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ',
    translation: 'And when My servants question thee concerning Me, then surely I am nigh. I answer the prayer of the suppliant when he crieth unto Me.',
    source: "Qur'an 2:186",
  },
  {
    id: 'r_40_60',
    kind: 'ayah',
    theme: 'general',
    arabic: 'وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ',
    translation: 'And your Lord hath said: Pray unto Me and I will hear your prayer.',
    source: "Qur'an 40:60",
  },
  {
    id: 'r_94_5_6',
    kind: 'ayah',
    theme: 'general',
    arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    translation: 'But lo! with hardship goeth ease. Lo! with hardship goeth ease.',
    source: "Qur'an 94:5–6",
  },
  {
    id: 'r_2_286',
    kind: 'ayah',
    theme: 'general',
    arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation: 'Allah tasketh not a soul beyond its scope.',
    source: "Qur'an 2:286",
  },
  {
    id: 'r_65_3',
    kind: 'ayah',
    theme: 'general',
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    translation: 'And whosoever putteth his trust in Allah, He will suffice him.',
    source: "Qur'an 65:3",
  },
  {
    id: 'r_39_53',
    kind: 'ayah',
    theme: 'general',
    arabic: 'قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ',
    translation: 'Say: O My slaves who have been prodigal to their own hurt! Despair not of the mercy of Allah.',
    source: "Qur'an 39:53",
  },
  {
    id: 'r_3_139',
    kind: 'ayah',
    theme: 'general',
    arabic: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ',
    translation: 'Faint not nor grieve, for ye will overcome them if ye are (indeed) believers.',
    source: "Qur'an 3:139",
  },
  {
    id: 'r_14_7',
    kind: 'ayah',
    theme: 'general',
    arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ',
    translation: 'If ye give thanks, I will give you more.',
    source: "Qur'an 14:7",
  },

  // ── Hadith ─────────────────────────────────────────────────────────────────
  {
    id: 'h_first_prayer',
    kind: 'hadith',
    theme: 'prayer',
    translation:
      'The first thing for which a servant will be brought to account on the Day of Judgement is the prayer.',
    source: 'Tirmidhi',
  },
  {
    id: 'h_qurrat_ayn',
    kind: 'hadith',
    theme: 'prayer',
    arabic: 'وَجُعِلَتْ قُرَّةُ عَيْنِي فِي الصَّلَاةِ',
    translation: 'And the coolness of my eyes has been placed in prayer.',
    source: "Nasa'i",
  },
  {
    id: 'h_arihna_bilal',
    kind: 'hadith',
    theme: 'prayer',
    arabic: 'يَا بِلَالُ أَرِحْنَا بِهَا',
    translation: 'O Bilal, call the prayer; give us comfort by it.',
    source: 'Abu Dawud',
  },
  {
    id: 'h_two_cool_prayers',
    kind: 'hadith',
    theme: 'prayer',
    translation:
      'Whoever prays the two cool prayers - Fajr and Asr - will enter Paradise.',
    source: 'Bukhari & Muslim',
  },
  {
    id: 'h_best_deeds_consistent',
    kind: 'hadith',
    theme: 'general',
    translation:
      'The most beloved of deeds to Allah are the most consistent, even if they are few.',
    source: 'Bukhari & Muslim',
  },
  {
    id: 'h_deeds_intentions',
    kind: 'hadith',
    theme: 'general',
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    translation: 'Actions are but by intentions.',
    source: 'Bukhari & Muslim',
  },
  {
    id: 'h_smile_charity',
    kind: 'hadith',
    theme: 'general',
    translation: 'Your smiling in the face of your brother is charity.',
    source: 'Tirmidhi',
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
