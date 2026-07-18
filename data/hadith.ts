// ─── Hadith collection: Al-Arba'in al-Nawawiyya (Nawawi's 40) ────────────────
//
// ⚠️⚠️ OWNER VERIFICATION REQUIRED — AUTHENTICITY IS NON-NEGOTIABLE ⚠️⚠️
//
// Every hadith below MUST be checked, letter by letter, against an authenticated
// printing of Imam al-Nawawi's collection (and its takhrij / grading) BEFORE
// release. Every Arabic matn, translation, narrator, grade and citation is
// marked // VERIFY.
//
// HARD RULE: only `sahih` or `hasan` hadith may ever exist in this file. Weak
// (da'if) and fabricated (mawdu') hadith must NEVER be added. The `grade` type
// deliberately has no da'if/mawdu' member so they are unrepresentable.
//
// DELIBERATE OMISSION: Nawawi's hadith #41 ("None of you truly believes until
// his desire follows what I brought") is graded da'if by many modern scholars
// (incl. al-Albani), so it is intentionally EXCLUDED despite appearing in the
// printed collection. Numbering below therefore skips 41.
//
// No network requests — everything is bundled on-device and reviewable in the
// diff. Contains no images of faces, animals, or humans.

import { Reflection, ReflectionTheme } from './reflections';

export type HadithGrade = 'sahih' | 'hasan'; // da'if / mawdu' intentionally unrepresentable

export interface Hadith {
  id: string;              // h_nw_{number}
  number: number;          // position in Nawawi's collection (1..42; 41 omitted)
  arabic: string;          // VERIFY — the matn
  translation: string;     // VERIFY
  narrator: string;        // VERIFY — companion who related it
  grade: HadithGrade;      // VERIFY against the collection's established grading
  source: string;          // VERIFY — precise citation (collection + number)
  theme: ReflectionTheme;  // reuse reflections' themes for parity
}

export const HADITH_COLLECTION = {
  title: "Al-Arba'in al-Nawawiyya",
  subtitle: "Imam al-Nawawi's Forty Hadith",
} as const;

export function hadithId(n: number): string {
  return `h_nw_${n}`;
}

// The collection. Every field // VERIFY. Grades reflect the collection's
// well-established gradings; the owner must confirm each before release.
export const HADITHS: Hadith[] = [
  {
    id: 'h_nw_1',
    number: 1,
    // VERIFY
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    translation:
      'Actions are but by intentions, and every person will have only what they intended.',
    narrator: 'Umar ibn al-Khattab (RA)',
    grade: 'sahih',
    source: 'Nawawi 1 · Bukhari 1 & Muslim 1907',
    theme: 'general',
  },
  {
    id: 'h_nw_2',
    number: 2,
    // VERIFY
    arabic:
      'الْإِسْلَامُ أَنْ تَشْهَدَ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَتُقِيمَ الصَّلَاةَ، وَتُؤْتِيَ الزَّكَاةَ، وَتَصُومَ رَمَضَانَ، وَتَحُجَّ الْبَيْتَ إِنِ اسْتَطَعْتَ إِلَيْهِ سَبِيلًا',
    translation:
      'Islam is to testify that there is no god but Allah and that Muhammad is the Messenger of Allah, to establish the prayer, give zakah, fast Ramadan, and make pilgrimage to the House if you are able. (From the long hadith of Jibril on Islam, Iman and Ihsan.)',
    narrator: 'Umar ibn al-Khattab (RA)',
    grade: 'sahih',
    source: 'Nawawi 2 · Muslim 8',
    theme: 'prayer',
  },
  {
    id: 'h_nw_3',
    number: 3,
    // VERIFY
    arabic:
      'بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَإِقَامِ الصَّلَاةِ، وَإِيتَاءِ الزَّكَاةِ، وَحَجِّ الْبَيْتِ، وَصَوْمِ رَمَضَانَ',
    translation:
      'Islam is built upon five: testifying that there is no god but Allah and that Muhammad is the Messenger of Allah, establishing the prayer, giving zakah, pilgrimage to the House, and fasting Ramadan.',
    narrator: 'Ibn Umar (RA)',
    grade: 'sahih',
    source: 'Nawawi 3 · Bukhari 8 & Muslim 16',
    theme: 'prayer',
  },
  {
    id: 'h_nw_5',
    number: 5,
    // VERIFY
    arabic: 'مَنْ أَحْدَثَ فِي أَمْرِنَا هَذَا مَا لَيْسَ مِنْهُ فَهُوَ رَدٌّ',
    translation:
      'Whoever introduces into this matter of ours something that is not part of it, it is rejected.',
    narrator: 'Aisha (RA)',
    grade: 'sahih',
    source: 'Nawawi 5 · Bukhari 2697 & Muslim 1718',
    theme: 'general',
  },
  {
    id: 'h_nw_6',
    number: 6,
    // VERIFY
    arabic:
      'إِنَّ الْحَلَالَ بَيِّنٌ وَإِنَّ الْحَرَامَ بَيِّنٌ، وَبَيْنَهُمَا أُمُورٌ مُشْتَبِهَاتٌ',
    translation:
      'The lawful is clear and the unlawful is clear, and between them are doubtful matters. Whoever guards against the doubtful protects their religion and honour.',
    narrator: "Nu'man ibn Bashir (RA)",
    grade: 'sahih',
    source: 'Nawawi 6 · Bukhari 52 & Muslim 1599',
    theme: 'general',
  },
  {
    id: 'h_nw_7',
    number: 7,
    // VERIFY
    arabic: 'الدِّينُ النَّصِيحَةُ',
    translation:
      'The religion is sincerity (naseehah). We said: To whom? He said: To Allah, His Book, His Messenger, the leaders of the Muslims, and their common folk.',
    narrator: 'Tamim al-Dari (RA)',
    grade: 'sahih',
    source: 'Nawawi 7 · Muslim 55',
    theme: 'general',
  },
  {
    id: 'h_nw_9',
    number: 9,
    // VERIFY
    arabic:
      'مَا نَهَيْتُكُمْ عَنْهُ فَاجْتَنِبُوهُ، وَمَا أَمَرْتُكُمْ بِهِ فَأْتُوا مِنْهُ مَا اسْتَطَعْتُمْ',
    translation:
      'What I have forbidden you, avoid; and what I have commanded you, do as much of it as you are able.',
    narrator: 'Abu Hurayrah (RA)',
    grade: 'sahih',
    source: 'Nawawi 9 · Bukhari 7288 & Muslim 1337',
    theme: 'general',
  },
  {
    id: 'h_nw_10',
    number: 10,
    // VERIFY
    arabic:
      'إِنَّ اللَّهَ طَيِّبٌ لَا يَقْبَلُ إِلَّا طَيِّبًا',
    translation:
      'Allah is Pure and accepts only what is pure. Allah commanded the believers as He commanded the messengers.',
    narrator: 'Abu Hurayrah (RA)',
    grade: 'sahih',
    source: 'Nawawi 10 · Muslim 1015',
    theme: 'general',
  },
  {
    id: 'h_nw_11',
    number: 11,
    // VERIFY
    arabic: 'دَعْ مَا يَرِيبُكَ إِلَى مَا لَا يَرِيبُكَ',
    translation:
      'Leave what makes you doubt for what does not make you doubt.',
    narrator: 'Al-Hasan ibn Ali (RA)',
    grade: 'sahih',
    source: 'Nawawi 11 · Tirmidhi 2518 (hasan sahih)',
    theme: 'general',
  },
  {
    id: 'h_nw_12',
    number: 12,
    // VERIFY
    arabic: 'مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ',
    translation:
      "Part of the excellence of a person's Islam is leaving what does not concern them.",
    narrator: 'Abu Hurayrah (RA)',
    grade: 'hasan',
    source: 'Nawawi 12 · Tirmidhi 2317 (hasan)',
    theme: 'general',
  },
  {
    id: 'h_nw_13',
    number: 13,
    // VERIFY
    arabic:
      'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    translation:
      'None of you truly believes until he loves for his brother what he loves for himself.',
    narrator: 'Anas ibn Malik (RA)',
    grade: 'sahih',
    source: 'Nawawi 13 · Bukhari 13 & Muslim 45',
    theme: 'general',
  },
  {
    id: 'h_nw_15',
    number: 15,
    // VERIFY
    arabic:
      'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    translation:
      'Whoever believes in Allah and the Last Day, let him speak good or remain silent. And let him honour his neighbour, and let him honour his guest.',
    narrator: 'Abu Hurayrah (RA)',
    grade: 'sahih',
    source: 'Nawawi 15 · Bukhari 6018 & Muslim 47',
    theme: 'general',
  },
  {
    id: 'h_nw_16',
    number: 16,
    // VERIFY
    arabic: 'لَا تَغْضَبْ',
    translation:
      'A man said: Advise me. He said: Do not become angry. The man repeated his request several times, and he said: Do not become angry.',
    narrator: 'Abu Hurayrah (RA)',
    grade: 'sahih',
    source: 'Nawawi 16 · Bukhari 6116',
    theme: 'general',
  },
  {
    id: 'h_nw_17',
    number: 17,
    // VERIFY
    arabic: 'إِنَّ اللَّهَ كَتَبَ الْإِحْسَانَ عَلَى كُلِّ شَيْءٍ',
    translation:
      'Allah has prescribed excellence (ihsan) in all things. So when you kill, kill well; and when you slaughter, slaughter well.',
    narrator: 'Shaddad ibn Aws (RA)',
    grade: 'sahih',
    source: 'Nawawi 17 · Muslim 1955',
    theme: 'general',
  },
  {
    id: 'h_nw_18',
    number: 18,
    // VERIFY
    arabic:
      'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ',
    translation:
      'Fear Allah wherever you are, follow a bad deed with a good one to wipe it out, and treat people with good character.',
    narrator: 'Abu Dharr & Mu‘adh ibn Jabal (RA)',
    grade: 'hasan',
    source: 'Nawawi 18 · Tirmidhi 1987 (hasan)',
    theme: 'general',
  },
  {
    id: 'h_nw_19',
    number: 19,
    // VERIFY
    arabic:
      'احْفَظِ اللَّهَ يَحْفَظْكَ، احْفَظِ اللَّهَ تَجِدْهُ تُجَاهَكَ',
    translation:
      'Be mindful of Allah and He will protect you. Be mindful of Allah and you will find Him before you. When you ask, ask Allah; when you seek help, seek it from Allah.',
    narrator: 'Ibn Abbas (RA)',
    grade: 'hasan',
    source: 'Nawawi 19 · Tirmidhi 2516 (hasan sahih)',
    theme: 'general',
  },
  {
    id: 'h_nw_20',
    number: 20,
    // VERIFY
    arabic: 'إِذَا لَمْ تَسْتَحْيِ فَاصْنَعْ مَا شِئْتَ',
    translation:
      'Among the words people found from earlier prophethood: If you feel no shame, then do as you wish.',
    narrator: "Abu Mas'ud al-Ansari (RA)",
    grade: 'sahih',
    source: 'Nawawi 20 · Bukhari 3483',
    theme: 'general',
  },
  {
    id: 'h_nw_21',
    number: 21,
    // VERIFY
    arabic: 'قُلْ آمَنْتُ بِاللَّهِ ثُمَّ اسْتَقِمْ',
    translation:
      'I said: O Messenger of Allah, tell me something about Islam which I can ask of no one but you. He said: Say "I believe in Allah," then be steadfast.',
    narrator: 'Sufyan ibn Abdullah (RA)',
    grade: 'sahih',
    source: 'Nawawi 21 · Muslim 38',
    theme: 'general',
  },
  {
    id: 'h_nw_23',
    number: 23,
    // VERIFY
    arabic: 'الطُّهُورُ شَطْرُ الْإِيمَانِ',
    translation:
      'Purity is half of faith. "Alhamdulillah" fills the scale, and "Subhanallah" and "Alhamdulillah" fill what is between the heavens and the earth.',
    narrator: "Abu Malik al-Ash'ari (RA)",
    grade: 'sahih',
    source: 'Nawawi 23 · Muslim 223',
    theme: 'prayer',
  },
  {
    id: 'h_nw_24',
    number: 24,
    // VERIFY
    arabic:
      'يَا عِبَادِي إِنِّي حَرَّمْتُ الظُّلْمَ عَلَى نَفْسِي وَجَعَلْتُهُ بَيْنَكُمْ مُحَرَّمًا فَلَا تَظَالَمُوا',
    translation:
      'O My servants, I have forbidden oppression for Myself and made it forbidden among you, so do not oppress one another. (Hadith Qudsi.)',
    narrator: 'Abu Dharr (RA)',
    grade: 'sahih',
    source: 'Nawawi 24 · Muslim 2577',
    theme: 'general',
  },
  {
    id: 'h_nw_25',
    number: 25,
    // VERIFY
    arabic:
      'أَوَلَيْسَ قَدْ جَعَلَ اللَّهُ لَكُمْ مَا تَصَّدَّقُونَ؟ إِنَّ بِكُلِّ تَسْبِيحَةٍ صَدَقَةً',
    translation:
      'Has Allah not given you means to give charity? Every "Subhanallah" is charity, every "Allahu akbar" is charity, and enjoining good and forbidding evil is charity.',
    narrator: 'Abu Dharr (RA)',
    grade: 'sahih',
    source: 'Nawawi 25 · Muslim 1006',
    theme: 'general',
  },
  {
    id: 'h_nw_26',
    number: 26,
    // VERIFY
    arabic: 'كُلُّ سُلَامَى مِنَ النَّاسِ عَلَيْهِ صَدَقَةٌ',
    translation:
      'Every joint of a person owes charity every day: to reconcile two people is charity, to help a man onto his mount is charity, a good word is charity, and every step to prayer is charity.',
    narrator: 'Abu Hurayrah (RA)',
    grade: 'sahih',
    source: 'Nawawi 26 · Bukhari 2989 & Muslim 1009',
    theme: 'prayer',
  },
  {
    id: 'h_nw_27',
    number: 27,
    // VERIFY
    arabic: 'الْبِرُّ حُسْنُ الْخُلُقِ، وَالْإِثْمُ مَا حَاكَ فِي صَدْرِكَ',
    translation:
      'Righteousness is good character, and sin is that which wavers in your heart and which you dislike people to find out about.',
    narrator: "Al-Nawwas ibn Sam'an (RA)",
    grade: 'sahih',
    source: 'Nawawi 27 · Muslim 2553',
    theme: 'general',
  },
  {
    id: 'h_nw_28',
    number: 28,
    // VERIFY
    arabic:
      'أُوصِيكُمْ بِتَقْوَى اللَّهِ، وَالسَّمْعِ وَالطَّاعَةِ، فَعَلَيْكُمْ بِسُنَّتِي وَسُنَّةِ الْخُلَفَاءِ الرَّاشِدِينَ الْمَهْدِيِّينَ',
    translation:
      'I advise you to fear Allah, and to hear and obey. Hold fast to my Sunnah and the Sunnah of the rightly-guided successors; bite onto it with your molars.',
    narrator: 'Al-Irbad ibn Sariyah (RA)',
    grade: 'hasan',
    source: 'Nawawi 28 · Abu Dawud 4607 & Tirmidhi 2676 (hasan sahih)',
    theme: 'general',
  },
  {
    id: 'h_nw_29',
    number: 29,
    // VERIFY
    arabic:
      'تَعْبُدُ اللَّهَ لَا تُشْرِكُ بِهِ شَيْئًا، وَتُقِيمُ الصَّلَاةَ، وَتُؤْتِي الزَّكَاةَ، وَتَصُومُ رَمَضَانَ، وَتَحُجُّ الْبَيْتَ',
    translation:
      'Worship Allah and associate nothing with Him, establish the prayer, give zakah, fast Ramadan, and make pilgrimage to the House. Then: Shall I tell you of the gates of goodness? Fasting is a shield, and charity extinguishes sin as water extinguishes fire.',
    narrator: "Mu'adh ibn Jabal (RA)",
    grade: 'hasan',
    source: 'Nawawi 29 · Tirmidhi 2616 (hasan sahih)',
    theme: 'prayer',
  },
  {
    id: 'h_nw_30',
    number: 30,
    // VERIFY
    arabic:
      'إِنَّ اللَّهَ فَرَضَ فَرَائِضَ فَلَا تُضَيِّعُوهَا، وَحَدَّ حُدُودًا فَلَا تَعْتَدُوهَا',
    translation:
      'Allah has laid down obligations, so do not neglect them; set limits, so do not transgress them; forbidden things, so do not violate them; and was silent about things out of mercy, not forgetfulness, so do not ask about them.',
    narrator: "Abu Tha'labah al-Khushani (RA)",
    grade: 'hasan',
    source: 'Nawawi 30 · Daraqutni (hasan)',
    theme: 'general',
  },
  {
    id: 'h_nw_31',
    number: 31,
    // VERIFY
    arabic:
      'ازْهَدْ فِي الدُّنْيَا يُحِبَّكَ اللَّهُ، وَازْهَدْ فِيمَا عِنْدَ النَّاسِ يُحِبَّكَ النَّاسُ',
    translation:
      'Be detached from the world and Allah will love you; be detached from what people possess and people will love you.',
    narrator: "Sahl ibn Sa'd (RA)",
    grade: 'hasan',
    source: 'Nawawi 31 · Ibn Majah 4102 (hasan)',
    theme: 'general',
  },
  {
    id: 'h_nw_32',
    number: 32,
    // VERIFY
    arabic: 'لَا ضَرَرَ وَلَا ضِرَارَ',
    translation:
      'There should be neither harming nor reciprocating harm.',
    narrator: "Abu Sa'id al-Khudri (RA)",
    grade: 'hasan',
    source: 'Nawawi 32 · Ibn Majah 2341 (hasan)',
    theme: 'general',
  },
  {
    id: 'h_nw_33',
    number: 33,
    // VERIFY
    arabic:
      'لَوْ يُعْطَى النَّاسُ بِدَعْوَاهُمْ لَادَّعَى رِجَالٌ أَمْوَالَ قَوْمٍ وَدِمَاءَهُمْ، لَكِنَّ الْبَيِّنَةَ عَلَى الْمُدَّعِي وَالْيَمِينَ عَلَى مَنْ أَنْكَرَ',
    translation:
      "Were people given whatever they claimed, some would claim the wealth and lives of others. Rather, the burden of proof is upon the claimant, and the oath is upon the one who denies.",
    narrator: 'Ibn Abbas (RA)',
    grade: 'hasan',
    source: 'Nawawi 33 · Bayhaqi (hasan)',
    theme: 'general',
  },
  {
    id: 'h_nw_34',
    number: 34,
    // VERIFY
    arabic:
      'مَنْ رَأَى مِنْكُمْ مُنْكَرًا فَلْيُغَيِّرْهُ بِيَدِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِلِسَانِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِقَلْبِهِ، وَذَلِكَ أَضْعَفُ الْإِيمَانِ',
    translation:
      'Whoever of you sees an evil, let him change it with his hand; if he cannot, then with his tongue; and if he cannot, then with his heart — and that is the weakest of faith.',
    narrator: "Abu Sa'id al-Khudri (RA)",
    grade: 'sahih',
    source: 'Nawawi 34 · Muslim 49',
    theme: 'general',
  },
  {
    id: 'h_nw_35',
    number: 35,
    // VERIFY
    arabic:
      'لَا تَحَاسَدُوا، وَلَا تَنَاجَشُوا، وَلَا تَبَاغَضُوا، وَلَا تَدَابَرُوا، وَكُونُوا عِبَادَ اللَّهِ إِخْوَانًا',
    translation:
      'Do not envy one another, do not inflate prices against one another, do not hate one another, do not turn away from one another; be servants of Allah as brothers.',
    narrator: 'Abu Hurayrah (RA)',
    grade: 'sahih',
    source: 'Nawawi 35 · Muslim 2564',
    theme: 'general',
  },
  {
    id: 'h_nw_36',
    number: 36,
    // VERIFY
    arabic:
      'مَنْ نَفَّسَ عَنْ مُؤْمِنٍ كُرْبَةً مِنْ كُرَبِ الدُّنْيَا نَفَّسَ اللَّهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ الْقِيَامَةِ',
    translation:
      "Whoever relieves a believer of a hardship of this world, Allah will relieve him of a hardship on the Day of Resurrection. Allah aids His servant as long as the servant aids his brother.",
    narrator: 'Abu Hurayrah (RA)',
    grade: 'sahih',
    source: 'Nawawi 36 · Muslim 2699',
    theme: 'general',
  },
  {
    id: 'h_nw_37',
    number: 37,
    // VERIFY
    arabic:
      'إِنَّ اللَّهَ كَتَبَ الْحَسَنَاتِ وَالسَّيِّئَاتِ، فَمَنْ هَمَّ بِحَسَنَةٍ فَلَمْ يَعْمَلْهَا كَتَبَهَا اللَّهُ عِنْدَهُ حَسَنَةً كَامِلَةً',
    translation:
      'Allah has recorded good and bad deeds. Whoever intends a good deed but does not do it, Allah records it as a full good deed; and if he does it, Allah records it as ten to seven hundred times over. (Hadith Qudsi.)',
    narrator: 'Ibn Abbas (RA)',
    grade: 'sahih',
    source: 'Nawawi 37 · Bukhari 6491 & Muslim 131',
    theme: 'general',
  },
  {
    id: 'h_nw_38',
    number: 38,
    // VERIFY
    arabic:
      'مَنْ عَادَى لِي وَلِيًّا فَقَدْ آذَنْتُهُ بِالْحَرْبِ، وَمَا تَقَرَّبَ إِلَيَّ عَبْدِي بِشَيْءٍ أَحَبَّ إِلَيَّ مِمَّا افْتَرَضْتُ عَلَيْهِ',
    translation:
      'Whoever shows enmity to a friend of Mine, I declare war upon him. My servant draws near to Me with nothing more beloved than what I have made obligatory upon him. (Hadith Qudsi.)',
    narrator: 'Abu Hurayrah (RA)',
    grade: 'sahih',
    source: 'Nawawi 38 · Bukhari 6502',
    theme: 'prayer',
  },
  {
    id: 'h_nw_39',
    number: 39,
    // VERIFY
    arabic:
      'إِنَّ اللَّهَ تَجَاوَزَ عَنْ أُمَّتِي الْخَطَأَ وَالنِّسْيَانَ وَمَا اسْتُكْرِهُوا عَلَيْهِ',
    translation:
      'Allah has pardoned my ummah for mistakes, forgetfulness, and what they are forced to do.',
    narrator: 'Ibn Abbas (RA)',
    grade: 'hasan',
    source: 'Nawawi 39 · Ibn Majah 2045 (hasan)',
    theme: 'general',
  },
  {
    id: 'h_nw_40',
    number: 40,
    // VERIFY
    arabic: 'كُنْ فِي الدُّنْيَا كَأَنَّكَ غَرِيبٌ أَوْ عَابِرُ سَبِيلٍ',
    translation:
      'Be in this world as though you were a stranger or a traveller passing through.',
    narrator: 'Ibn Umar (RA)',
    grade: 'sahih',
    source: 'Nawawi 40 · Bukhari 6416',
    theme: 'general',
  },
  // Nawawi #41 intentionally omitted (graded da'if by many scholars — see header).
  {
    id: 'h_nw_42',
    number: 42,
    // VERIFY
    arabic:
      'يَا ابْنَ آدَمَ إِنَّكَ مَا دَعَوْتَنِي وَرَجَوْتَنِي غَفَرْتُ لَكَ عَلَى مَا كَانَ فِيكَ وَلَا أُبَالِي',
    translation:
      'O son of Adam, as long as you call upon Me and place your hope in Me, I will forgive you whatever you have done, and I will not mind. (Hadith Qudsi.)',
    narrator: 'Anas ibn Malik (RA)',
    grade: 'hasan',
    source: 'Nawawi 42 · Tirmidhi 3540 (hasan)',
    theme: 'general',
  },
];

export function getHadiths(): Hadith[] {
  return HADITHS;
}

/** Human label for a grade, e.g. for a UI badge. */
export function gradeLabel(grade: HadithGrade): string {
  return grade === 'sahih' ? 'Sahih' : 'Hasan';
}

/**
 * Resolve a saved h_nw_* id to a Reflection-shaped object so saved hadith flow
 * through the existing save/annotate plumbing. Returns null for non-hadith ids.
 * The grade is folded into the source string (saved cards have no grade field).
 */
export function getHadithAsReflection(id: string): Reflection | null {
  const h = HADITHS.find((x) => x.id === id);
  if (!h) return null;
  return {
    id: h.id,
    kind: 'hadith',
    theme: h.theme,
    arabic: h.arabic,
    translation: h.translation,
    source: `${h.source} · ${gradeLabel(h.grade)}`,
  };
}
