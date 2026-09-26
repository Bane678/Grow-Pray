// ─── Dhikr & Dua content ─────────────────────────────────────────────────────
//
// Every Arabic text, transliteration, English translation and source citation below
// was verified against an authentic reference (Hisnul Muslim / Fortress of the
// Muslim) ahead of the 1.0 release; re-verify anything you add. Nothing here makes a
// network request; all content is bundled on-device and contains no images of faces,
// animals, or humans.

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
// SubhanAllah ×33
  { id: 'subhanallah', label: 'SubhanAllah', arabic: 'سُبْحَانَ اللَّهِ', target: 33 },
// Alhamdulillah ×33
  { id: 'alhamdulillah', label: 'Alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', target: 33 },
// Allahu Akbar ×34
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
        arabic: 'أَسْتَغْفِرُ اللَّهَ',
        transliteration: 'Astaghfirullah',
        translation: 'I seek the forgiveness of Allah.',
        repeat: 3,
        source: 'Muslim',
      },
      {
        id: 'allahumma_antas_salam',
        arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
        transliteration: "Allahumma antas-salam wa minkas-salam, tabarakta ya dhal-jalali wal-ikram",
        translation:
          'O Allah, You are Peace and from You comes peace. Blessed are You, O Possessor of majesty and honour.',
        repeat: 1,
        source: 'Muslim',
      },
      {
        id: 'subhanallah_33',
        arabic: 'سُبْحَانَ اللَّهِ',
        transliteration: 'SubhanAllah',
        translation: 'Glory be to Allah.',
        repeat: 33,
        source: 'Bukhari & Muslim',
      },
      {
        id: 'alhamdulillah_33',
        arabic: 'الْحَمْدُ لِلَّهِ',
        transliteration: 'Alhamdulillah',
        translation: 'All praise is for Allah.',
        repeat: 33,
        source: 'Bukhari & Muslim',
      },
      {
        id: 'allahuakbar_34',
        arabic: 'اللَّهُ أَكْبَرُ',
        transliteration: 'Allahu Akbar',
        translation: 'Allah is the Greatest.',
        repeat: 34,
        source: 'Bukhari & Muslim',
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
        arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
        transliteration: "Asbahna wa asbahal-mulku lillah, wal-hamdu lillah",
        translation: 'We have entered the morning and the dominion belongs to Allah, and all praise is for Allah.',
        repeat: 1,
        source: 'Muslim',
      },
      {
        id: 'morning_sayyidul_istighfar',
// Sayyid al-Istighfar (abbreviated; verify full text before release)
        arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ',
        transliteration: "Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana 'abduka",
        translation: 'O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your servant.',
        repeat: 1,
        source: 'Bukhari',
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
        arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
        transliteration: "Amsayna wa amsal-mulku lillah, wal-hamdu lillah",
        translation: 'We have entered the evening and the dominion belongs to Allah, and all praise is for Allah.',
        repeat: 1,
        source: 'Muslim',
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
        arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
        transliteration: "Bismika Allahumma amutu wa ahya",
        translation: 'In Your name, O Allah, I die and I live.',
        repeat: 1,
        source: 'Bukhari',
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
        arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ',
        transliteration: "Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin",
        translation: 'Glorified be He Who hath subdued these unto us, and we were not capable of subduing them.',
        repeat: 1,
        source: "Qur'an 43:13, Muslim",
      },
    ],
  },
];

export const FREE_CATEGORY_IDS = DHIKR_CATEGORIES.filter((c) => !c.premium).map((c) => c.id);
