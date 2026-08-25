/* Latin glosses for the Arabic labels that arrive inside leap_data.js.

   IMPORTANT — this file adds no data. Every count, coordinate and percentage
   still comes from leap_data.js; this is a presentation-layer transliteration
   of the place names and a translation of the profession titles, so the English
   board is readable to a visitor who does not read Arabic. The Arabic string
   from the dataset stays the key AND the fallback: a label with no entry here
   renders in Arabic verbatim, exactly as the four source dashboards render
   every label in both languages.

   `Labels.t(ar)` returns the Latin gloss under `en` and the original under
   `ar`; `Labels.pair(ar)` returns both, for tooltips. */

(function (global) {
  'use strict';

  /* City names — standard romanisations, as used by the General Authority for
     Statistics and on SCE's own English pages. */
  var CITY = {
    'الرياض': 'Riyadh',
    'الجبيل': 'Jubail',
    'جدة': 'Jeddah',
    'بريدة': 'Buraydah',
    'المدينة المنورة': 'Madinah',
    'الخبر': 'Khobar',
    'الدمام': 'Dammam',
    'رأس تنورة': 'Ras Tanura',
    'مكة المكرمة': 'Makkah',
    'حائل': 'Hail',
    'الخرج': 'Al Kharj',
    'الرس': 'Ar Rass',
    'أبها': 'Abha',
    'الزلفي': 'Az Zulfi',
    'عرعر': 'Arar',
    'تبوك': 'Tabuk',
    'ينبع': 'Yanbu',
    'المجمعة': 'Al Majmaah',
    'الباحة': 'Al Bahah',
    'الخفجي': 'Khafji',
    'الدوادمي': 'Ad Dawadmi',
    'نجران': 'Najran',
    'الطائف': 'Taif',
    'الجوف': 'Al Jawf',
    'الأحساء': 'Al Ahsa',
    'العلا': 'AlUla',
    'عنيزة': 'Unayzah',
    'جازان': 'Jazan',
    'الوجه': 'Al Wajh',
    'بقيق': 'Abqaiq',
    'شقراء': 'Shaqra',
    'طريف': 'Turaif',
    'بيشة': 'Bisha',
    'وادي الدواسر': 'Wadi ad-Dawasir',
    'حفر الباطن': 'Hafar al-Batin',
    'القنفذة': 'Al Qunfudhah',
    'الافلاج': 'Al Aflaj',
    'القريات': 'Al Qurayyat',
    /* The field survey reached 64 cities — 33 of them are not on the workforce
       map, so their names only appear here. Every one of the 64 is covered. */
    'أحد المسارحة': 'Ahad al-Masarihah',
    'أحد رفيده': 'Ahad Rufaydah',
    'البدائع': 'Al Badai',
    'البكيرية': 'Al Bukayriyah',
    'الجموم': 'Al Jumum',
    'الدرعية': 'Diriyah',
    'الظهران': 'Dhahran',
    'العويقيلة': 'Al Uwayqilah',
    'القطيف': 'Qatif',
    'القويعية': 'Al Quwayiyah',
    'الليث': 'Al Lith',
    'المبرز': 'Al Mubarraz',
    'المخواة': 'Al Makhwah',
    'الموية': 'Al Muwayh',
    'النعيرية': 'An Nuayriyah',
    'النماص': 'An Namas',
    'الهفوف': 'Hofuf',
    'بقعاء': 'Baqa',
    'بلقرن': 'Balqarn',
    'تاروت': 'Tarut',
    'تربة': 'Turabah',
    'حقل': 'Haql',
    'خليص': 'Khulays',
    'خميس مشيط': 'Khamis Mushait',
    'دومة الجندل': 'Dumat al-Jandal',
    'رابغ': 'Rabigh',
    'رفحاء': 'Rafha',
    'رنية': 'Ranyah',
    'سكاكا': 'Sakaka',
    'سيهات': 'Sayhat',
    'شروره': 'Sharurah',
    'قلوة': 'Qilwah',
    'محايل عسير': 'Muhayil Asir',
  };

  var REGION = {
    'منطقة الرياض': 'Riyadh Region',
    'منطقة مكة المكرمة': 'Makkah Region',
    'منطقة الشرقية': 'Eastern Region',
    'منطقة عسير': 'Asir Region',
    'منطقة جازان': 'Jazan Region',
    'منطقة القصيم': 'Qassim Region',
    'منطقة الجوف': 'Al Jawf Region',
    'منطقة المدينة المنورة': 'Madinah Region',
    'منطقة حائل': 'Hail Region',
    'منطقة نجران': 'Najran Region',
  };

  /* Profession titles, translated rather than transliterated — these are the
     occupational names in the register, and their English forms are the ones
     the professions lookup itself uses. */
  var PROFESSION = {
    'مهندس مدني': 'Civil engineer',
    'مهندس كهربائي': 'Electrical engineer',
    'مهندس ميكانيكي': 'Mechanical engineer',
    'مهندس معماري': 'Architect',
    'مهندس حاسب آلي': 'Computer engineer',

    'فني صيانة ميكانيكية': 'Mechanical maintenance technician',
    'مراقب الجودة': 'Quality inspector',
    'موصل كابلات كهربائية': 'Electrical cable jointer',
    'مشرف صيانة': 'Maintenance supervisor',
    'فني تدفئة وتهوية وتكييف': 'HVAC technician',

    'محلل نظم المعلومات': 'Information systems analyst',
    'أخصائي إدارة مشاريع': 'Project management specialist',
    'أخصائي علوم حاسب آلي': 'Computer science specialist',
    'أخصائي دعم فني': 'Technical support specialist',
    'أخصائي صحة وسلامة مهنية': 'Occupational health & safety specialist',
  };

  var NATIONALITY = {
    'السعودية': 'Saudi Arabia',
    'مصر': 'Egypt',
    'الهند': 'India',
    'الباكستان': 'Pakistan',
    'الفلبين': 'Philippines',
  };

  var ALL = {};
  [CITY, REGION, PROFESSION, NATIONALITY].forEach(function (table) {
    for (var k in table) if (table.hasOwnProperty(k)) ALL[k] = table[k];
  });

  /** The gloss for the active locale; the Arabic original when none exists. */
  function t(ar) {
    if (I18N.locale === 'ar') return ar;
    return ALL[ar] || ar;
  }

  /** `{ en, ar }` — for tooltips, which show both. */
  function pair(ar) {
    return { en: ALL[ar] || ar, ar: ar };
  }

  /** True when the label rendered for the active locale is Arabic script. */
  function isArabic(ar) {
    return I18N.locale === 'ar' || !ALL[ar];
  }

  global.Labels = { t: t, pair: pair, isArabic: isArabic, table: ALL };
})(window);
