/**
 * The same 103 Syrian cities, in the same 14 governorates, that the mobile
 * app's city picker shows — ported from `src/data/syriaCities.js` in the
 * React Native app so both clients offer users an identical list.
 *
 * `governorateId` uses this web app's own governorate ids (see
 * `src/data/syria-places.json`), mapped from the mobile app's numeric
 * `governorate_id` by matching Arabic governorate names (both lists agree on
 * all 14).
 *
 * The backend has no `cities` table yet (every `/cities` route 404s — see
 * `scripts/build-places.mjs`), so this is a static, hand-synced copy rather
 * than a live fetch, exactly like the mobile app falls back to its own
 * bundled copy when the server list is unavailable. Keep it in sync by hand
 * with the mobile app's list until a shared backend endpoint exists.
 */

export interface CanonicalCity {
  id: number;
  ar: string;
  en: string;
  isPopular: boolean;
  governorateId: string;
}

export const SYRIA_CITIES: CanonicalCity[] = [
  {id: 1, ar: 'دمشق', en: 'Damascus', isPopular: true, governorateId: 'di'},
  {id: 2, ar: 'دوما', en: 'Douma', isPopular: false, governorateId: 'rd'},
  {id: 3, ar: 'جرمانا', en: 'Jaramana', isPopular: false, governorateId: 'rd'},
  {id: 4, ar: 'داريا', en: 'Daraya', isPopular: false, governorateId: 'rd'},
  {id: 5, ar: 'قدسيا', en: 'Qudsaya', isPopular: false, governorateId: 'rd'},
  {id: 6, ar: 'صحنايا', en: 'Sahnaya', isPopular: false, governorateId: 'rd'},
  {id: 7, ar: 'جديدة عرطوز', en: 'Jdeidet Artouz', isPopular: false, governorateId: 'rd'},
  {id: 8, ar: 'حرستا', en: 'Harasta', isPopular: false, governorateId: 'rd'},
  {id: 9, ar: 'عربين', en: 'Arbin', isPopular: false, governorateId: 'rd'},
  {id: 10, ar: 'سقبا', en: 'Saqba', isPopular: false, governorateId: 'rd'},
  {id: 11, ar: 'زملكا', en: 'Zamalka', isPopular: false, governorateId: 'rd'},
  {id: 12, ar: 'المعضمية', en: 'Muadamiyat al-Sham', isPopular: false, governorateId: 'rd'},
  {id: 13, ar: 'السيدة زينب', en: 'Sayyidah Zaynab', isPopular: false, governorateId: 'rd'},
  {id: 14, ar: 'الكسوة', en: 'Al-Kiswah', isPopular: false, governorateId: 'rd'},
  {id: 15, ar: 'التل', en: 'Al-Tall', isPopular: false, governorateId: 'rd'},
  {id: 16, ar: 'قطنا', en: 'Qatana', isPopular: false, governorateId: 'rd'},
  {id: 17, ar: 'الزبداني', en: 'Al-Zabadani', isPopular: false, governorateId: 'rd'},
  {id: 18, ar: 'بلودان', en: 'Bloudan', isPopular: false, governorateId: 'rd'},
  {id: 19, ar: 'مضايا', en: 'Madaya', isPopular: false, governorateId: 'rd'},
  {id: 20, ar: 'يبرود', en: 'Yabroud', isPopular: false, governorateId: 'rd'},
  {id: 21, ar: 'النبك', en: 'Al-Nabk', isPopular: false, governorateId: 'rd'},
  {id: 22, ar: 'الضمير', en: 'Al-Dumayr', isPopular: false, governorateId: 'rd'},
  {id: 23, ar: 'جيرود', en: 'Jayrud', isPopular: false, governorateId: 'rd'},
  {id: 24, ar: 'حلب', en: 'Aleppo', isPopular: true, governorateId: 'hl'},
  {id: 25, ar: 'منبج', en: 'Manbij', isPopular: false, governorateId: 'hl'},
  {id: 26, ar: 'الباب', en: 'Al-Bab', isPopular: false, governorateId: 'hl'},
  {id: 27, ar: 'عفرين', en: 'Afrin', isPopular: false, governorateId: 'hl'},
  {id: 28, ar: 'أعزاز', en: 'Azaz', isPopular: false, governorateId: 'hl'},
  {id: 29, ar: 'جرابلس', en: 'Jarabulus', isPopular: false, governorateId: 'hl'},
  {id: 30, ar: 'عين العرب', en: 'Ayn al-Arab', isPopular: false, governorateId: 'hl'},
  {id: 31, ar: 'مسكنة', en: 'Maskanah', isPopular: false, governorateId: 'hl'},
  {id: 32, ar: 'دير حافر', en: 'Deir Hafer', isPopular: false, governorateId: 'hl'},
  {id: 33, ar: 'السفيرة', en: 'As-Safira', isPopular: false, governorateId: 'hl'},
  {id: 34, ar: 'تل رفعت', en: 'Tell Rifaat', isPopular: false, governorateId: 'hl'},
  {id: 35, ar: 'حمص', en: 'Homs', isPopular: true, governorateId: 'hi'},
  {id: 36, ar: 'تدمر', en: 'Palmyra', isPopular: false, governorateId: 'hi'},
  {id: 37, ar: 'القصير', en: 'Al-Qusayr', isPopular: false, governorateId: 'hi'},
  {id: 38, ar: 'الرستن', en: 'Al-Rastan', isPopular: false, governorateId: 'hi'},
  {id: 39, ar: 'تلبيسة', en: 'Talbiseh', isPopular: false, governorateId: 'hi'},
  {id: 40, ar: 'تلكلخ', en: 'Talkalakh', isPopular: false, governorateId: 'hi'},
  {id: 41, ar: 'القريتين', en: 'Al-Qaryatayn', isPopular: false, governorateId: 'hi'},
  {id: 42, ar: 'مهين', en: 'Mheen', isPopular: false, governorateId: 'hi'},
  {id: 43, ar: 'حماة', en: 'Hama', isPopular: true, governorateId: 'hm'},
  {id: 44, ar: 'سلمية', en: 'Salamiyah', isPopular: false, governorateId: 'hm'},
  {id: 45, ar: 'مصياف', en: 'Masyaf', isPopular: false, governorateId: 'hm'},
  {id: 46, ar: 'محردة', en: 'Mahardah', isPopular: false, governorateId: 'hm'},
  {id: 47, ar: 'السقيلبية', en: 'As-Suqaylabiyah', isPopular: false, governorateId: 'hm'},
  {id: 48, ar: 'كفرزيتا', en: 'Kafr Zita', isPopular: false, governorateId: 'hm'},
  {id: 49, ar: 'طيبة الإمام', en: 'Taybat al-Imam', isPopular: false, governorateId: 'hm'},
  {id: 50, ar: 'حلفايا', en: 'Halfaya', isPopular: false, governorateId: 'hm'},
  {id: 51, ar: 'مورك', en: 'Morek', isPopular: false, governorateId: 'hm'},
  {id: 52, ar: 'اللاذقية', en: 'Latakia', isPopular: true, governorateId: 'la'},
  {id: 53, ar: 'جبلة', en: 'Jableh', isPopular: false, governorateId: 'la'},
  {id: 54, ar: 'القرداحة', en: 'Qardaha', isPopular: false, governorateId: 'la'},
  {id: 55, ar: 'الحفة', en: 'Al-Haffah', isPopular: false, governorateId: 'la'},
  {id: 56, ar: 'كسب', en: 'Kessab', isPopular: false, governorateId: 'la'},
  {id: 57, ar: 'طرطوس', en: 'Tartus', isPopular: true, governorateId: 'ta'},
  {id: 58, ar: 'بانياس', en: 'Baniyas', isPopular: false, governorateId: 'ta'},
  {id: 59, ar: 'صافيتا', en: 'Safita', isPopular: false, governorateId: 'ta'},
  {id: 60, ar: 'دريكيش', en: 'Duraykish', isPopular: false, governorateId: 'ta'},
  {id: 61, ar: 'الشيخ بدر', en: 'Sheikh Badr', isPopular: false, governorateId: 'ta'},
  {id: 62, ar: 'القدموس', en: 'Al-Qadmus', isPopular: false, governorateId: 'ta'},
  {id: 63, ar: 'أرواد', en: 'Arwad', isPopular: false, governorateId: 'ta'},
  {id: 64, ar: 'إدلب', en: 'Idlib', isPopular: true, governorateId: 'id'},
  {id: 65, ar: 'معرة النعمان', en: 'Maarat al-Numan', isPopular: false, governorateId: 'id'},
  {id: 66, ar: 'جسر الشغور', en: 'Jisr ash-Shughur', isPopular: false, governorateId: 'id'},
  {id: 67, ar: 'أريحا', en: 'Ariha', isPopular: false, governorateId: 'id'},
  {id: 68, ar: 'سراقب', en: 'Saraqib', isPopular: false, governorateId: 'id'},
  {id: 69, ar: 'خان شيخون', en: 'Khan Shaykhun', isPopular: false, governorateId: 'id'},
  {id: 70, ar: 'حارم', en: 'Harem', isPopular: false, governorateId: 'id'},
  {id: 71, ar: 'سلقين', en: 'Salqin', isPopular: false, governorateId: 'id'},
  {id: 72, ar: 'بنش', en: 'Binnish', isPopular: false, governorateId: 'id'},
  {id: 73, ar: 'كفرنبل', en: 'Kafranbel', isPopular: false, governorateId: 'id'},
  {id: 74, ar: 'درعا', en: 'Daraa', isPopular: true, governorateId: 'dr'},
  {id: 75, ar: 'إزرع', en: 'Izra', isPopular: false, governorateId: 'dr'},
  {id: 76, ar: 'بصرى الشام', en: 'Busra al-Sham', isPopular: false, governorateId: 'dr'},
  {id: 77, ar: 'جاسم', en: 'Jasim', isPopular: false, governorateId: 'dr'},
  {id: 78, ar: 'نوى', en: 'Nawa', isPopular: false, governorateId: 'dr'},
  {id: 79, ar: 'الصنمين', en: 'Al-Sanamayn', isPopular: false, governorateId: 'dr'},
  {id: 80, ar: 'طفس', en: 'Tafas', isPopular: false, governorateId: 'dr'},
  {id: 81, ar: 'الحراك', en: 'Al-Harak', isPopular: false, governorateId: 'dr'},
  {id: 82, ar: 'إنخل', en: 'Inkhil', isPopular: false, governorateId: 'dr'},
  {id: 83, ar: 'السويداء', en: 'As-Suwayda', isPopular: true, governorateId: 'su'},
  {id: 84, ar: 'شهبا', en: 'Shahba', isPopular: false, governorateId: 'su'},
  {id: 85, ar: 'صلخد', en: 'Salkhad', isPopular: false, governorateId: 'su'},
  {id: 86, ar: 'قنوات', en: 'Qanawat', isPopular: false, governorateId: 'su'},
  {id: 87, ar: 'القنيطرة', en: 'Quneitra', isPopular: true, governorateId: 'qu'},
  {id: 88, ar: 'خان أرنبة', en: 'Khan Arnabah', isPopular: false, governorateId: 'qu'},
  {id: 89, ar: 'الخشنية', en: 'Al-Khushniyah', isPopular: false, governorateId: 'qu'},
  {id: 90, ar: 'دير الزور', en: 'Deir ez-Zor', isPopular: true, governorateId: 'dy'},
  {id: 91, ar: 'الميادين', en: 'Mayadin', isPopular: false, governorateId: 'dy'},
  {id: 92, ar: 'البوكمال', en: 'Abu Kamal', isPopular: false, governorateId: 'dy'},
  {id: 93, ar: 'الرقة', en: 'Raqqa', isPopular: true, governorateId: 'ra'},
  {id: 94, ar: 'الطبقة', en: 'Tabqa', isPopular: false, governorateId: 'ra'},
  {id: 95, ar: 'تل أبيض', en: 'Tell Abyad', isPopular: false, governorateId: 'ra'},
  {id: 96, ar: 'الحسكة', en: 'Al-Hasakah', isPopular: true, governorateId: 'ha'},
  {id: 97, ar: 'القامشلي', en: 'Qamishli', isPopular: false, governorateId: 'ha'},
  {id: 98, ar: 'رأس العين', en: 'Ras al-Ayn', isPopular: false, governorateId: 'ha'},
  {id: 99, ar: 'المالكية', en: 'Al-Malikiyah', isPopular: false, governorateId: 'ha'},
  {id: 100, ar: 'عامودا', en: 'Amuda', isPopular: false, governorateId: 'ha'},
  {id: 101, ar: 'الشدادي', en: 'Al-Shaddadi', isPopular: false, governorateId: 'ha'},
  {id: 102, ar: 'الدرباسية', en: 'Al-Darbasiyah', isPopular: false, governorateId: 'ha'},
  {id: 103, ar: 'تل تمر', en: 'Tell Tamer', isPopular: false, governorateId: 'ha'},
];
