// ─── Dhikr & Dua content ─────────────────────────────────────────────────────
//
// ⚠️ OWNER VERIFICATION REQUIRED (Req 2.7):
// Before release, the app owner must verify EVERY Arabic text, transliteration,
// English translation, and source citation in this file against an authentic
// reference (e.g. Hisnul Muslim / Fortress of the Muslim). Items are marked with
// // VERIFY comments. Nothing here makes a network request; all content is bundled
// on-device and contains no images of faces, animals, or humans.

export interface TasbihStep {
  id: string;
  label: string;
  arabic: string;
  target: number;
}

export interface DhikrItem {
  id: string;
  arabic: string;
  transliteration: string;
  translation: string;
  /** Recommended repeat count for this dhikr. */
  repeat: number;
  /** Short source/reference, shown small. */
  source?: string;
}

export interface DhikrCategory {
  id: string;
  title: string;
  subtitle: string;
  /** MaterialCommunityIcons glyph name (no faces/animals/humans). */
  icon: string;
  premium: boolean;
  items: DhikrItem[];
}

// ─── Tasbih ──────────────────────────────────────────────────────────────────
// The guided after-salah tasbih, performed in order. (Sahih Muslim 596: SubhanAllah
// ×33, Alhamdulillah ×33, Allahu Akbar ×34 → 100.) Free for everyone.
export const TASBIH_SEQUENCE: TasbihStep[] = [
  // VERIFY: SubhanAllah ×33
  { id: 'subhanallah', label: 'SubhanAllah', arabic: 'سُبْحَانَ اللَّهِ', target: 33 },
  // VERIFY: Alhamdulillah ×33
  { id: 'alhamdulillah', label: 'Alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', target: 33 },
  // VERIFY: Allahu Akbar ×34
  { id: 'allahuakbar', label: 'Allahu Akbar', arabic: 'اللَّهُ أَكْبَرُ', target: 34 },
];

// Total beads in the guided sequence (33 + 33 + 34 = 100).
export const TASBIH_SEQUENCE_TOTAL = TASBIH_SEQUENCE.reduce((s, step) => s + step.target, 0);

// ─── Categories ──────────────────────────────────────────────────────────────
export const DHIKR_CATEGORIES: DhikrCategory[] = [
  {
    id: 'after_salah',
    title: 'After Salah',
    subtitle: 'Adhkar after the obligatory prayer',
    icon: 'book-open-page-variant',
    premium: false,
    items: [
      {
        id: 'astaghfirullah',
        // VERIFY
        arabic: 'أَسْتَغْفِرُ اللَّهَ',
        transliteration: 'Astaghfirullah',
        translation: 'I seek the forgiveness of Allah.',
        repeat: 3,
        source: 'Muslim', // VERIFY
      },
      {
        id: 'allahumma_antas_salam',
        // VERIFY
        arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
        transliteration: "Allahumma antas-salam wa minkas-salam, tabarakta ya dhal-jalali wal-ikram",
        translation:
          'O Allah, You are Peace and from You comes peace. Blessed are You, O Possessor of majesty and honour.',
        repeat: 1,
        source: 'Muslim', // VERIFY
      },
      {
        id: 'subhanallah_33',
        arabic: 'سُبْحَانَ اللَّهِ',
        transliteration: 'SubhanAllah',
        translation: 'Glory be to Allah.',
        repeat: 33,
        source: 'Bukhari & Muslim', // VERIFY
      },
      {
        id: 'alhamdulillah_33',
        arabic: 'الْحَمْدُ لِلَّهِ',
        transliteration: 'Alhamdulillah',
        translation: 'All praise is for Allah.',
        repeat: 33,
        source: 'Bukhari & Muslim', // VERIFY
      },
      {
        id: 'allahuakbar_34',
        arabic: 'اللَّهُ أَكْبَرُ',
        transliteration: 'Allahu Akbar',
        translation: 'Allah is the Greatest.',
        repeat: 34,
        source: 'Bukhari & Muslim', // VERIFY
      },
    ],
  },
  {
    id: 'morning',
    title: 'Morning',
    subtitle: 'Adhkar for the morning',
    icon: 'weather-sunset-up',
    premium: false,
    items: [
      {
        id: 'morning_asbahna',
        // VERIFY
        arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
        transliteration: "Asbahna wa asbahal-mulku lillah, wal-hamdu lillah",
        translation: 'We have entered the morning and the dominion belongs to Allah, and all praise is for Allah.',
        repeat: 1,
        source: 'Muslim', // VERIFY
      },
      {
        id: 'morning_sayyidul_istighfar',
        // VERIFY — Sayyid al-Istighfar (abbreviated; verify full text before release)
        arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ',
        transliteration: "Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana 'abduka",
        translation: 'O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your servant.',
        repeat: 1,
        source: 'Bukhari', // VERIFY
      },
    ],
  },
  {
    id: 'evening',
    title: 'Evening',
    subtitle: 'Adhkar for the evening',
    icon: 'weather-night',
    premium: false,
    items: [
      {
        id: 'evening_amsayna',
        // VERIFY
        arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
        transliteration: "Amsayna wa amsal-mulku lillah, wal-hamdu lillah",
        translation: 'We have entered the evening and the dominion belongs to Allah, and all praise is for Allah.',
        repeat: 1,
        source: 'Muslim', // VERIFY
      },
    ],
  },
  {
    id: 'sleep',
    title: 'Before Sleep',
    subtitle: 'Adhkar before sleeping',
    icon: 'moon-waning-crescent',
    premium: false,
    items: [
      {
        id: 'sleep_bismika',
        // VERIFY
        arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
        transliteration: "Bismika Allahumma amutu wa ahya",
        translation: 'In Your name, O Allah, I die and I live.',
        repeat: 1,
        source: 'Bukhari', // VERIFY
      },
    ],
  },
  {
    id: 'travel',
    title: 'Travel',
    subtitle: 'Duas for the traveller',
    icon: 'bag-suitcase',
    premium: false,
    items: [
      {
        id: 'travel_subhanalladhi',
        // VERIFY
        arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ',
        transliteration: "Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin",
        translation: 'Glory be to the One who has subjected this to us, and we could never have accomplished it.',
        repeat: 1,
        source: "Qur'an 43:13, Muslim", // VERIFY
      },
    ],
  },
];

export const FREE_CATEGORY_IDS = DHIKR_CATEGORIES.filter((c) => !c.premium).map((c) => c.id);
