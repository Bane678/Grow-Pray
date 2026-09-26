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
    translation: 'Then do ye remember Me; I will remember you. Be grateful to Me, and reject not Faith.',
    source: "Qur'an 2:152",
  },
  {
    id: 'r_13_28',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    translation: 'Those who believe, and whose hearts find satisfaction in the remembrance of Allah: for without doubt in the remembrance of Allah do hearts find satisfaction.',
    source: "Qur'an 13:28",
  },
  {
    id: 'r_29_45',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ',
    translation: 'For Prayer restrains from shameful and unjust deeds.',
    source: "Qur'an 29:45",
  },
  {
    id: 'r_20_14',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'إِنَّنِي أَنَا اللَّهُ لَا إِلَٰهَ إِلَّا أَنَا فَاعْبُدْنِي وَأَقِمِ الصَّلَاةَ لِذِكْرِي',
    translation: 'Verily, I am Allah: there is no god but I. So serve thou Me (only), and establish regular prayer for celebrating My praise.',
    source: "Qur'an 20:14",
  },
  {
    id: 'r_2_45',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى الْخَاشِعِينَ',
    translation: 'Seek (Allah\'s) help with patient perseverance and prayer: it is indeed hard, except to those who bring a lowly spirit.',
    source: "Qur'an 2:45",
  },
  {
    id: 'r_2_153',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
    translation: 'O ye who believe! Seek help with patient perseverance and prayer; for Allah is with those who patiently persevere.',
    source: "Qur'an 2:153",
  },
  {
    id: 'r_23_1_2',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'قَدْ أَفْلَحَ الْمُؤْمِنُونَ ۝ الَّذِينَ هُمْ فِي صَلَاتِهِمْ خَاشِعُونَ',
    translation: 'The believers must (eventually) win through, those who humble themselves in their prayers.',
    source: "Qur'an 23:1–2",
  },
  {
    id: 'r_87_14_15',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'قَدْ أَفْلَحَ مَن تَزَكَّىٰ ۝ وَذَكَرَ اسْمَ رَبِّهِ فَصَلَّىٰ',
    translation: 'But those will prosper who purify themselves, and glorify the name of their Guardian-Lord, and (lift their hearts) in prayer.',
    source: "Qur'an 87:14–15",
  },
  {
    id: 'r_11_114',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'وَأَقِمِ الصَّلَاةَ طَرَفَيِ النَّهَارِ وَزُلَفًا مِّنَ اللَّيْلِ ۚ إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ',
    translation: 'And establish regular prayers at the two ends of the day and at the approaches of the night: for those things that are good remove those that are evil.',
    source: "Qur'an 11:114",
  },
  {
    id: 'r_4_103',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'فَإِذَا قَضَيْتُمُ الصَّلَاةَ فَاذْكُرُوا اللَّهَ قِيَامًا وَقُعُودًا وَعَلَىٰ جُنُوبِكُمْ',
    translation: 'When ye pass (congregational) prayers, celebrate Allah\'s praises, standing, sitting down, or lying down on your sides.',
    source: "Qur'an 4:103",
  },
  {
    id: 'r_51_56',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'وَمَا خَلَقْتُ الْجِنَّ وَالْإِنسَ إِلَّا لِيَعْبُدُونِ',
    translation: 'I have only created Jinns and men, that they may serve Me.',
    source: "Qur'an 51:56",
  },
  {
    id: 'r_62_9',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ فَاسْعَوْا إِلَىٰ ذِكْرِ اللَّهِ',
    translation: 'O ye who believe! When the call is proclaimed to prayer on Friday (the Day of Assembly), hasten earnestly to the Remembrance of Allah.',
    source: "Qur'an 62:9",
  },
  {
    id: 'r_8_2',
    kind: 'ayah',
    theme: 'prayer',
    arabic: 'إِنَّمَا الْمُؤْمِنُونَ الَّذِينَ إِذَا ذُكِرَ اللَّهُ وَجِلَتْ قُلُوبُهُمْ',
    translation: 'For, Believers are those who, when Allah is mentioned, feel a tremor in their hearts.',
    source: "Qur'an 8:2",
  },

  // ── Qur'an · closeness, mercy & motivation ─────────────────────────────────
  {
    id: 'r_2_186',
    kind: 'ayah',
    theme: 'general',
    arabic: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ',
    translation: 'When My servants ask thee concerning Me, I am indeed close (to them): I listen to the prayer of every suppliant when he calleth on Me.',
    source: "Qur'an 2:186",
  },
  {
    id: 'r_40_60',
    kind: 'ayah',
    theme: 'general',
    arabic: 'وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ',
    translation: 'And your Lord says: Call on Me; I will answer your prayer.',
    source: "Qur'an 40:60",
  },
  {
    id: 'r_94_5_6',
    kind: 'ayah',
    theme: 'general',
    arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    translation: 'So, verily, with every difficulty, there is relief. Verily, with every difficulty there is relief.',
    source: "Qur'an 94:5–6",
  },
  {
    id: 'r_2_286',
    kind: 'ayah',
    theme: 'general',
    arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation: 'On no soul doth Allah place a burden greater than it can bear.',
    source: "Qur'an 2:286",
  },
  {
    id: 'r_65_3',
    kind: 'ayah',
    theme: 'general',
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    translation: 'And if any one puts his trust in Allah, sufficient is Allah for him.',
    source: "Qur'an 65:3",
  },
  {
    id: 'r_39_53',
    kind: 'ayah',
    theme: 'general',
    arabic: 'قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ',
    translation: 'Say: O my Servants who have transgressed against their souls! Despair not of the Mercy of Allah.',
    source: "Qur'an 39:53",
  },
  {
    id: 'r_3_139',
    kind: 'ayah',
    theme: 'general',
    arabic: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ',
    translation: 'So lose not heart, nor fall into despair: for ye must gain mastery if ye are true in Faith.',
    source: "Qur'an 3:139",
  },
  {
    id: 'r_14_7',
    kind: 'ayah',
    theme: 'general',
    arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ',
    translation: 'If ye are grateful, I will add more (favours) unto you.',
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
