/**
 * Syrian governorates and key cities for SEO landing pages, breadcrumbs,
 * sitemaps, and internal linking.
 *
 * Syria has 14 official governorates plus prominent regional commercial hubs.
 * All slugs support both ASCII transliterations and Arabic direct paths.
 */

export interface SyrianCity {
  slug: string;
  nameAr: string;
  nameEn: string;
  governorateAr: string;
  lat: number;
  lon: number;
  description: string;
  aliases: string[];
  isGovernorate: boolean;
  priority: string;
}

export const SYRIAN_CITIES: SyrianCity[] = [
  {
    slug: 'damascus',
    nameAr: 'دمشق',
    nameEn: 'Damascus',
    governorateAr: 'دمشق',
    lat: 33.5138,
    lon: 36.2765,
    description: 'تصفح آلاف الإعلانات للبيع والشراء في دمشق على سوقنا. سيارات، عقارات، موبايلات، أثاث وإلكترونيات بأفضل الأسعار في العاصمة دمشق وجميع أحيائها.',
    aliases: ['dimashq', 'damas', 'دمشق', 'الشام'],
    isGovernorate: true,
    priority: '0.9',
  },
  {
    slug: 'aleppo',
    nameAr: 'حلب',
    nameEn: 'Aleppo',
    governorateAr: 'حلب',
    lat: 36.2021,
    lon: 37.1343,
    description: 'تصفح أكبر سوق إلكتروني للبيع والشراء في حلب. سيارات مستعملة وجديدة، شقق وعقارات للبيع والإيجار، أجهزة كهربائية وموبايلات في حلب وريفها.',
    aliases: ['halab', 'حلب'],
    isGovernorate: true,
    priority: '0.9',
  },
  {
    slug: 'homs',
    nameAr: 'حمص',
    nameEn: 'Homs',
    governorateAr: 'حمص',
    lat: 34.7324,
    lon: 36.7137,
    description: 'سوق حمص المفتوح للبيع والشراء على سوقنا. شقق للبيع والإيجار، سيارات، هواتف ذكية ومستلزمات منزلية بأسعار منافسة في حمص.',
    aliases: ['hims', 'حمص'],
    isGovernorate: true,
    priority: '0.8',
  },
  {
    slug: 'hama',
    nameAr: 'حماة',
    nameEn: 'Hama',
    governorateAr: 'حماة',
    lat: 35.1318,
    lon: 36.7578,
    description: 'إعلانات مبوبة مجانية في حماة. تصفح آلاف العروض للسيارات، العقارات، الأجهزة الإلكترونية والوظائف في حماة ومحيطها.',
    aliases: ['hamah', 'حماة', 'حماه'],
    isGovernorate: true,
    priority: '0.8',
  },
  {
    slug: 'latakia',
    nameAr: 'اللاذقية',
    nameEn: 'Latakia',
    governorateAr: 'اللاذقية',
    lat: 35.5317,
    lon: 35.7901,
    description: 'سوق اللاذقية للبيع والشراء. شاليهات وعقارات بحرية، سيارات، موبايلات وخدمات متنوعة في محافظة اللاذقية والساحل السوري.',
    aliases: ['lattakia', 'ladhiqiyah', 'اللاذقية', 'لاذقية'],
    isGovernorate: true,
    priority: '0.8',
  },
  {
    slug: 'tartus',
    nameAr: 'طرطوس',
    nameEn: 'Tartus',
    governorateAr: 'طرطوس',
    lat: 34.889,
    lon: 35.8866,
    description: 'عقارات وسيارات وأجهزة إلكترونية للبيع والشراء في طرطوس. تواصل مع البائعين وتصفح أحدث الإعلانات اليومية على سوقنا طرطوس.',
    aliases: ['tartous', 'طرطوس'],
    isGovernorate: true,
    priority: '0.8',
  },
  {
    slug: 'rif-dimashq',
    nameAr: 'ريف دمشق',
    nameEn: 'Rif Dimashq',
    governorateAr: 'ريف دمشق',
    lat: 33.5138,
    lon: 36.3765,
    description: 'إعلانات البيع والشراء في ريف دمشق. مزارع، فلل، أراضي، سيارات ومعدات صناعية وزراعية في جميع مناطق ريف دمشق.',
    aliases: ['rif-damascus', 'ريف-دمشق', 'ريف دمشق'],
    isGovernorate: true,
    priority: '0.8',
  },
  {
    slug: 'qudsaya',
    nameAr: 'قدسيا',
    nameEn: 'Qudsaya',
    governorateAr: 'ريف دمشق',
    lat: 33.5358,
    lon: 36.2167,
    description: 'شقق للبيع والإيجار وسيارات وإلكترونيات في قدسيا وضاحية قدسيا. تصفح أحدث عروض السوق المحلي مباشرة على سوقنا.',
    aliases: ['qudsayah', 'قدسيا', 'ضاحية قدسيا'],
    isGovernorate: false,
    priority: '0.7',
  },
  {
    slug: 'douma',
    nameAr: 'دوما',
    nameEn: 'Douma',
    governorateAr: 'ريف دمشق',
    lat: 33.5714,
    lon: 36.4022,
    description: 'سوق دوما والغوطة للبيع والشراء. مزارع، عقارات، قطع غيار وسيارات متوفرة للتواصل المباشر مع أصحابها في دوما.',
    aliases: ['duma', 'دوما'],
    isGovernorate: false,
    priority: '0.7',
  },
  {
    slug: 'daraa',
    nameAr: 'درعا',
    nameEn: 'Daraa',
    governorateAr: 'درعا',
    lat: 32.6255,
    lon: 36.1044,
    description: 'إعلانات مبوبة للبيع والشراء في درعا وحوران. سيارات، عقارات، مواشي ومعدات زراعية بأسعار مناسبة في محافظة درعا.',
    aliases: ['dara', 'dar\'a', 'درعا'],
    isGovernorate: true,
    priority: '0.7',
  },
  {
    slug: 'as-suwayda',
    nameAr: 'السويداء',
    nameEn: 'As-Suwayda',
    governorateAr: 'السويداء',
    lat: 32.7089,
    lon: 36.5695,
    description: 'سوق السويداء الإلكتروني للبيع والشراء على سوقنا. سيارات، عقارات، هواتف وأجهزة منزلية في محافظة السويداء وجبل العرب.',
    aliases: ['sweida', 'suwayda', 'سويداء', 'السويداء'],
    isGovernorate: true,
    priority: '0.7',
  },
  {
    slug: 'idlib',
    nameAr: 'إدلب',
    nameEn: 'Idlib',
    governorateAr: 'إدلب',
    lat: 35.9306,
    lon: 36.6339,
    description: 'إعلانات البيع والشراء في إدلب وريفها. سيارات، دراجات نارية، أجهزة، عقارات ومواد غذائية وتجارية على منصة سوقنا.',
    aliases: ['idleb', 'ادلب', 'إدلب'],
    isGovernorate: true,
    priority: '0.7',
  },
  {
    slug: 'jableh',
    nameAr: 'جبلة',
    nameEn: 'Jableh',
    governorateAr: 'اللاذقية',
    lat: 35.3614,
    lon: 35.9256,
    description: 'عقارات وسيارات وموبايلات للبيع والإيجار في مدينة جبلة وريفها. تصفح عروض السوق المفتوح على سوقنا.',
    aliases: ['jebleh', 'جبلة', 'جبله'],
    isGovernorate: false,
    priority: '0.7',
  },
  {
    slug: 'baniyas',
    nameAr: 'بانياس',
    nameEn: 'Baniyas',
    governorateAr: 'طرطوس',
    lat: 35.1822,
    lon: 35.9389,
    description: 'إعلانات بانياس للبيع والشراء. شقق، سيارات، إلكترونيات ومستلزمات في بانياس ومحيطها على سوقنا.',
    aliases: ['banyas', 'بانياس'],
    isGovernorate: false,
    priority: '0.7',
  },
  {
    slug: 'deir-ez-zor',
    nameAr: 'دير الزور',
    nameEn: 'Deir ez-Zor',
    governorateAr: 'دير الزور',
    lat: 35.337,
    lon: 40.144,
    description: 'سوق دير الزور والمنطقة الشرقية للبيع والشراء. سيارات، عقارات ومختلف البضائع والخدمات على سوقنا.',
    aliases: ['deir-ezzor', 'دير الزور', 'ديرالزور'],
    isGovernorate: true,
    priority: '0.7',
  },
  {
    slug: 'ar-raqqa',
    nameAr: 'الرقة',
    nameEn: 'Ar-Raqqa',
    governorateAr: 'الرقة',
    lat: 35.9594,
    lon: 39.0089,
    description: 'إعلانات الرقة للبيع والشراء. تصفح العروض وتواصل مع المعلنين مباشرة في محافظة الرقة.',
    aliases: ['raqqa', 'الرقة', 'رقة'],
    isGovernorate: true,
    priority: '0.7',
  },
  {
    slug: 'al-hasakah',
    nameAr: 'الحسكة',
    nameEn: 'Al-Hasakah',
    governorateAr: 'الحسكة',
    lat: 36.5024,
    lon: 40.7483,
    description: 'سوق الحسكة والقامشلي للبيع والشراء على سوقنا. سيارات، هواتف، عقارات وأدوات تجارية في محافظة الحسكة.',
    aliases: ['hasaka', 'qamishli', 'الحسكة', 'القامشلي'],
    isGovernorate: true,
    priority: '0.7',
  },
  {
    slug: 'quneitra',
    nameAr: 'القنيطرة',
    nameEn: 'Al-Quneitra',
    governorateAr: 'القنيطرة',
    lat: 33.1261,
    lon: 35.8242,
    description: 'إعلانات القنيطرة والجولان للبيع والشراء على سوقنا. سيارات وعقارات وسلع متنوعة.',
    aliases: ['quneitrah', 'القنيطرة', 'قنيطرة'],
    isGovernorate: true,
    priority: '0.6',
  },
];

/** Lookup city by slug, English name, or Arabic name/alias. */
export const findCityBySlugOrName = (input: string): SyrianCity | null => {
  if (!input) return null;
  const normalized = decodeURIComponent(input).trim().toLowerCase().replace(/_+/g, '-');
  for (const city of SYRIAN_CITIES) {
    if (city.slug.toLowerCase() === normalized) return city;
    if (city.nameAr === normalized || city.nameAr.replace(/\s+/g, '-') === normalized) return city;
    if (city.nameEn.toLowerCase() === normalized) return city;
    for (const alias of city.aliases) {
      if (alias.toLowerCase() === normalized) return city;
    }
  }
  return null;
};
