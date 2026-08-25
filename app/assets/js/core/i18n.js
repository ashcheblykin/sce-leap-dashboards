/* Localisation, following axion.gen.web frontend/src/shared/lib/i18n.

   Axion Gen ships en.json + ar.json and flips `<html dir>`; the same contract
   here, minus next-intl. One flat table with both languages side by side so a
   missing translation is visible in the diff rather than in a second file:
   `messages/en.json` and `messages/ar.json` must stay in sync is a rule you
   can only follow by hand, and this shape follows it by construction.

   Numbers stay in Western digits in both locales, exactly as Axion Gen does —
   an ar-SA numbering system would break tabular alignment and read worse to a
   mixed conference audience. RTL isolation for numeric runs is handled by
   `Fmt.num()` and the chart renderers (see ChartText.tsx's NUMERIC_ISOLATE). */

(function (global) {
  'use strict';

  var STORAGE = 'sce.leap.locale';

  /* --- The message table --- */
  var M = {
    /* Shell */
    'app.title': ['Smart Monitoring Center', 'المركز الذكي للرصد والمراقبة'],

    'nav.ecosystem': ['Ecosystem', 'المنظومة'],
    'nav.profession': ['Profession', 'المهنة'],
    'nav.operations': ['Operations', 'العمليات'],
    'nav.field': ['Field', 'الميدان'],

    'ctl.play': ['Play', 'تشغيل'],
    'ctl.pause': ['Pause', 'إيقاف'],
    'ctl.reset': ['Reset layout', 'استعادة الترتيب'],
    'ctl.lang': ['Language', 'اللغة'],

    /* Splash. The headline pair is verbatim from the LEAP hero design
       (Figma node 2421-648), casing included. */
    'splash.title1': ['AI-driven oversight', 'الرقابة المدعومة بالذكاء الاصطناعي'],
    'splash.title2': ['for future cities', 'من أجل مدن المستقبل'],

    /* Panel titles */
    'w.eco': ['National Ecosystem', 'المنظومة الوطنية'],
    'w.spec': ['Top Specialties', 'أبرز التخصصات'],
    'w.reach': ['National Reach', 'التغطية الوطنية'],
    'w.map': ['National Map', 'الخريطة الوطنية'],
    'w.struct': ['Profession Structure', 'البنية المهنية'],
    'w.mon': ['Proactive Monitoring', 'المراقبة الاستباقية'],
    'w.enf': ['Enforcement Delivery', 'الإنفاذ'],
    'w.register': ['The Register', 'السجل'],
    'w.flow': ['Register Flow', 'توزيع السجل'],
    'w.grades': ['Career Grades', 'الدرجات المهنية'],
    'w.nat': ['Global Talent Base', 'قاعدة الكفاءات'],
    'w.compare': ['Class Profile', 'ملامح الفئات'],
    'w.pipeline': ['Renewal Pipeline', 'مسار التجديد'],
    'w.trend': ['Enforcement Activity', 'نشاط الإنفاذ'],
    'w.regions': ['Regional Enforcement', 'الإنفاذ حسب المنطقة'],
    'w.money': ['Enforced vs Collected', 'المفروض مقابل المحصل'],
    'w.field': ['Field Verification', 'التحقق الميداني'],
    'w.fieldmap': ['Verified Offices', 'المكاتب المتحقق منها'],
    'w.coverage': ['Licensing Coverage', 'تغطية الترخيص'],
    'w.topcities': ['Top Cities', 'أبرز المدن'],
    'w.capture': ['What the Field Captured', 'مخرجات العمل الميداني'],
    'w.staffcities': ['Cities by Size', 'المدن حسب الحجم'],

    /* Chips */
    'c.totals': ['Totals', 'الإجمالي'],
    'c.register': ['Register', 'السجل'],
    'c.engineers': ['Engineers', 'المهندسون'],
    'c.technicians': ['Technicians', 'الفنيون'],
    'c.specialists': ['Specialists', 'الأخصائيون'],
    'c.coverage': ['Coverage', 'التغطية'],
    'c.saudishare': ['Saudi share', 'نسبة السعوديين'],
    'c.workforce': ['Workforce', 'القوى العاملة'],
    'c.registered': ['SCE registered', 'مسجلو الهيئة'],
    'c.reach': ['Reach %', 'نسبة التغطية'],
    'c.enforcement': ['Enforcement', 'الإنفاذ'],
    'c.classes': ['Classes', 'الفئات'],
    'c.nationalities': ['Nationalities', 'الجنسيات'],
    'c.pipeline': ['Pipeline', 'المسار'],
    'c.bytrack': ['By track', 'حسب الفئة'],
    'c.headline': ['Headline', 'الملخص'],
    'c.trend': ['Activity trend', 'منحنى النشاط'],
    'c.status': ['By status', 'حسب الحالة'],
    'c.flow': ['Flow', 'التوزيع'],
    'c.rings': ['Rings', 'الحلقات'],
    'c.bars': ['Bars', 'الأعمدة'],
    'c.share': ['Share', 'النسبة'],
    'c.profile': ['Profile', 'الملامح'],
    'c.windows': ['Windows', 'النوافذ'],
    'c.actions': ['Actions', 'الإجراءات'],
    'c.value': ['Value', 'القيمة'],
    'c.money': ['Money', 'المبالغ'],
    'c.kpis': ['KPIs', 'المؤشرات'],
    'c.cities': ['Cities', 'المدن'],
    'c.offices': ['Offices', 'المكاتب'],
    'c.licensing': ['Licensing', 'الترخيص'],
    'c.capture': ['Capture', 'المخرجات'],
    'c.staff': ['Staff', 'الموارد البشرية'],
    'c.table': ['Table', 'الجدول'],
    'c.dual': ['Dual licence', 'الترخيص المزدوج'],

    /* Metric labels */
    'm.eco': ['Professionals in regulated roles', 'المهنيون في المهن المنظمة'],
    'm.reg': ['Registered with SCE', 'المسجلون في الهيئة'],
    'm.offices': ['Offices & firms network', 'شبكة المكاتب والشركات'],
    'm.saudis': ['Saudi engineering talent', 'الكفاءات الهندسية السعودية'],
    'm.nonsaudi': ['Global talent', 'الكفاءات الوافدة'],
    'm.active': ['Active memberships', 'العضويات السارية'],
    'm.near': ['In the renewal window', 'في نافذة التجديد'],
    'm.expired': ['Expired', 'منتهية'],
    'm.frozen': ['Frozen', 'مجمدة'],
    'm.lapsed': ['Historic / lapsed', 'منتهية أو مجمدة'],
    'm.proact': ['Licences tracked', 'الرخص المتابعة'],
    'm.engage': ['Engaged per cycle', 'المستهدفون لكل دورة'],
    'm.cases': ['Efaa enforcement actions', 'إجراءات الإنفاذ'],
    'm.enforced': ['SAR enforced', 'المبالغ المفروضة (ر.س)'],
    'm.collected': ['SAR collected', 'المبالغ المحصلة (ر.س)'],
    'm.outstanding': ['SAR outstanding', 'المبالغ المستحقة (ر.س)'],
    'm.surveyed': ['Offices field-surveyed', 'المكاتب الممسوحة ميدانياً'],
    'm.activeoff': ['Active offices verified', 'المكاتب العاملة المتحقق منها'],
    'm.scecov': ['SCE licensing coverage', 'تغطية ترخيص الهيئة'],
    'm.dual': ['Dual-licensed', 'مزدوجة الترخيص'],
    'm.workers': ['Professionals verified on site', 'المهنيون المتحقق منهم ميدانياً'],
    'm.avgw': ['Average per office', 'المتوسط لكل مكتب'],
    'm.geo': ['Offices geo-located', 'المكاتب المحددة جغرافياً'],
    'm.lic': ['Licence records updated', 'سجلات الرخص المحدّثة'],
    'm.contact': ['Contact channels captured', 'قنوات التواصل المسجلة'],
    'm.regions': ['Regions covered', 'المناطق المشمولة'],
    'm.tuvcities': ['Cities covered', 'المدن المشمولة'],
    'm.natreach': ['National SCE reach', 'تغطية الهيئة وطنياً'],

    /* Series / category labels */
    's.engineers': ['Engineers', 'المهندسون'],
    's.technicians': ['Technicians', 'الفنيون'],
    's.specialists': ['Specialists', 'الأخصائيون'],
    's.active': ['Active', 'سارية'],
    's.near': ['Renewal window', 'نافذة التجديد'],
    's.expired': ['Expired', 'منتهية'],
    's.frozen': ['Frozen', 'مجمدة'],
    's.engineer': ['Engineer', 'مهندس'],
    's.professional': ['Professional', 'مهندس محترف'],
    's.associate': ['Associate', 'مهندس مشارك'],
    's.consultant': ['Consultant', 'مهندس استشاري'],
    's.collected': ['Collected', 'محصل'],
    's.licensed': ['SCE-licensed', 'مرخّص من الهيئة'],
    's.unlicensed': ['Not licensed', 'غير مرخّص'],
    's.offices': ['Offices', 'مكاتب'],
    's.pct': ['% licensed', '% مرخّص'],
    's.city': ['City', 'المدينة'],
    's.cases': ['Actions', 'الإجراءات'],
    's.d30': ['≤ 30 days', '≤ 30 يوماً'],
    's.d60': ['≤ 60 days', '≤ 60 يوماً'],
    's.d90': ['≤ 90 days', '≤ 90 يوماً'],
    's.notreg': ['Not SCE-registered', 'غير مسجل في الهيئة'],

    /* Notes and footnotes. `{n}` placeholders are filled by Fmt/I18N.t. */
    'n.offnote': [
      '{a} licensed + {b} structured feed',
      '{a} مرخّص + {b} من التغذية المنظمة',
    ],
    'n.bubbleWorkforce': [
      'Bubble ≈ regulated workforce per city · {n} cities mapped',
      'حجم الدائرة ≈ القوى العاملة لكل مدينة · {n} مدينة',
    ],
    'n.bubbleRegistered': [
      'Bubble ≈ SCE-registered professionals per city',
      'حجم الدائرة ≈ مسجلو الهيئة لكل مدينة',
    ],
    'n.bubbleReach': [
      'Bubble ≈ registered ÷ workforce per city',
      'حجم الدائرة ≈ المسجلون ÷ القوى العاملة',
    ],
    'n.bubbleRegions': [
      'Bubble ≈ enforcement actions · ten most active regions ({n} of {total} actions)',
      'حجم الدائرة ≈ إجراءات الإنفاذ · أكثر عشر مناطق نشاطاً ({n} من {total})',
    ],
    'n.bubbleOffices': [
      'One dot per geo-valid verified office · {n} of {geo} located · colour = SCE licence',
      'نقطة لكل مكتب متحقق محدد جغرافياً · {n} من {geo} · اللون = الترخيص',
    ],
    'n.bubbleCoverage': [
      'Bubble ≈ verified offices · colour = share SCE-licensed · {n} cities with 3+ offices',
      'حجم الدائرة ≈ المكاتب المتحقق منها · اللون = نسبة الترخيص · {n} مدينة',
    ],
    'n.reachNote': [
      'SCE-registered share of the mapped city workforce',
      'نسبة مسجلي الهيئة من القوى العاملة في المدن المشمولة',
    ],
    'n.saudiNote': [
      'Saudi share of the regulated engineering workforce',
      'نسبة السعوديين من القوى العاملة الهندسية المنظمة',
    ],
    'n.gradesNote': [
      'Grades break down the {n} engineer memberships only',
      'الدرجات توزع عضويات المهندسين ({n}) فقط',
    ],
    'n.pipeCumulative': [
      'Windows are cumulative — ≤60 includes ≤30; never summed',
      'النوافذ تراكمية — ≤60 تشمل ≤30؛ لا تُجمع',
    ],
    'n.trendNote': [
      'Efaa activity, 36 monthly points to {last}, plotted unitless · not the all-years case count ({cases}); 2023-11 absent in the source',
      'نشاط الإنفاذ، 36 نقطة شهرية حتى {last}، بدون وحدة · ليس عدد الحالات الكلي ({cases})؛ شهر 2023-11 غير موجود في المصدر',
    ],
    'n.regionsNote': [
      'Ten most active regions — {n} of {total} national actions',
      'أكثر عشر مناطق نشاطاً — {n} من {total} إجراء',
    ],
    'n.regionsFines': [
      'Ten most active regions — {n} SAR of {total} SAR enforced',
      'أكثر عشر مناطق نشاطاً — {n} من {total} ر.س',
    ],
    'n.moneyNote': [
      'Of {total}M SAR enforced · {paid}M collected, {due}M in collection',
      'من {total} مليون ر.س مفروضة · {paid} محصلة، {due} قيد التحصيل',
    ],
    'n.coverageNote': [
      'Of {n} active verified offices',
      'من {n} مكتباً عاملاً متحققاً منه',
    ],
    'n.flowNote': [
      'All {n} membership records by class and status',
      'جميع العضويات ({n}) حسب الفئة والحالة',
    ],
    'n.profileNote': [
      'Each class as a share of its own maximum across the four measures',
      'كل فئة كنسبة من أعلى قيمة في المقاييس الأربعة',
    ],
    'n.topcitiesNote': [
      'Eight largest cities by verified offices',
      'أكبر ثماني مدن حسب عدد المكاتب',
    ],
    'n.captureNote': [
      'Records captured at the door across all {n} surveyed offices',
      'بيانات مسجلة ميدانياً في {n} مكتباً',
    ],
    'n.staffNote': [
      'Professionals counted on site in the eight largest cities',
      'المهنيون المحتسبون ميدانياً في أكبر ثماني مدن',
    ],
    'n.natNote': [
      'Top five nationalities in the register',
      'أبرز خمس جنسيات في السجل',
    ],
    'n.specNote': [
      'Top five specialties by member count',
      'أبرز خمسة تخصصات حسب عدد الأعضاء',
    ],

    'n.inCollection': ['In collection', 'قيد التحصيل'],
    'n.underReview': ['Under review', 'قيد المراجعة'],

    /* Ticker */
    't.eco': ['professionals in the national engineering ecosystem', 'مهنياً في المنظومة الهندسية الوطنية'],
    't.reg': ['professionals registered with SCE', 'مهنياً مسجلاً في الهيئة'],
    't.offices': ['engineering offices and firms in the network', 'مكتباً وشركة هندسية في الشبكة'],
    't.scecov': ['of field-verified active offices hold an SCE licence', 'من المكاتب العاملة المتحقق منها تحمل ترخيص الهيئة'],
    't.proact': ['licences tracked proactively by digital monitoring', 'رخصة تتابع استباقياً بالمراقبة الرقمية'],
    't.engage': ['professionals engaged each renewal cycle', 'مهنياً يُستهدفون في كل دورة تجديد'],
    't.money': ['SAR enforced, {n} SAR collected through Efaa', 'ر.س مفروضة، {n} ر.س محصلة'],
    't.surveyed': ['offices verified on the ground across {n} regions', 'مكتباً تم التحقق منه ميدانياً في {n} منطقة'],
    't.active': ['memberships active and in good standing today', 'عضوية سارية ومنتظمة اليوم'],
    't.workers': ['professionals verified on site at active offices', 'مهنياً تم التحقق منه في المواقع'],
    't.saudis': ['Saudi professionals in the regulated workforce', 'مهنياً سعودياً في القوى العاملة المنظمة'],
  };

  var LOCALES = ['en', 'ar'];
  var INDEX = { en: 0, ar: 1 };

  var locale = 'en';
  try {
    var saved = localStorage.getItem(STORAGE);
    if (saved && INDEX[saved] !== undefined) locale = saved;
  } catch (e) {
    /* private mode */
  }

  var listeners = [];

  function isRtl(l) {
    return (l || locale) === 'ar';
  }

  /** Look up `key`, interpolating `{name}` placeholders from `vars`. */
  function t(key, vars) {
    var entry = M[key];
    if (!entry) {
      if (global.console) console.warn('i18n: missing key ' + key);
      return key;
    }
    var s = entry[INDEX[locale]] || entry[0];
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, name) {
      return vars[name] === undefined ? m : vars[name];
    });
  }

  /**
   * The string in the OTHER language. The four source dashboards title every
   * panel bilingually ("National Ecosystem · المنظومة"); this keeps that in
   * both directions, so the Arabic board carries the English gloss too.
   */
  function other(key) {
    var entry = M[key];
    if (!entry) return '';
    return entry[locale === 'en' ? 1 : 0] || '';
  }

  function apply() {
    var html = document.documentElement;
    html.setAttribute('lang', locale);
    html.setAttribute('dir', isRtl() ? 'rtl' : 'ltr');
  }

  function set(next) {
    if (INDEX[next] === undefined || next === locale) return;
    locale = next;
    try {
      localStorage.setItem(STORAGE, locale);
    } catch (e) {
      /* ignore */
    }
    apply();
    for (var i = 0; i < listeners.length; i++) listeners[i](locale);
  }

  function toggle() {
    set(locale === 'en' ? 'ar' : 'en');
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  apply();

  global.I18N = {
    t: t,
    other: other,
    get locale() {
      return locale;
    },
    get dir() {
      return isRtl() ? 'rtl' : 'ltr';
    },
    isRtl: isRtl,
    set: set,
    toggle: toggle,
    onChange: onChange,
    LOCALES: LOCALES,
    /** Exposed for the coverage check in tools/i18n-check.mjs. */
    keys: Object.keys(M),
  };
})(window);
