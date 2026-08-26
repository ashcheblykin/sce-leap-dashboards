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
    'app.title': ['Smart monitoring center', 'مركز الرقابة الذكي'],

    /* The four surfaces of the original deliverable, in its own order and its
       own words: bigscreen.html, index.html, kpis.html, field-survey.html.
       Arabic taken verbatim from the translators' `pages` table — see
       i18n-source/SCE_LEAP_*_AR.html. */
    'nav.bigscreen': ['Big Screen', 'الشاشة الكبرى'],
    'nav.ecosystem': ['Ecosystem', 'المنظومة'],
    'nav.library': ['KPI Library', 'مكتبة المؤشرات'],
    'nav.field': ['Field Verification', 'التحقق الميداني'],

    /* Big Screen scenes — the wall cycles these three, as the original did. */
    'sc.overview': ['Overview', 'نظرة عامة'],
    'sc.profession': ['Profession', 'المهن'],
    'sc.operations': ['Operations', 'العمليات'],

    'hdr.event': ['LEAP 2026', 'LEAP 2026'],

    'ctl.play': ['Play', 'تشغيل'],
    'ctl.pause': ['Pause', 'إيقاف'],
    'ctl.reset': ['Reset layout', 'إعادة ضبط التخطيط'],
    'ctl.lang': ['Language', 'اللغة'],

    /* Splash */
    'splash.eyebrow': [
      'Saudi Council of Engineers · LEAP 2026',
      'الهيئة السعودية للمهندسين · LEAP 2026',
    ],
    'splash.title1': ['AI-Driven Oversight', 'رقابة مدعومة بالذكاء الاصطناعي'],
    'splash.title2': ['for Future Cities', 'لمدن المستقبل'],
    'splash.sub': [
      "One live picture of the Kingdom's engineering profession — the registered workforce, the renewal pipeline, enforcement delivery and every office verified at the door.",
      'صورة حية واحدة لمهنة الهندسة في المملكة — القوى العاملة المسجلة، ومسار التجديد، والإنفاذ، وكل مكتب تم التحقق منه ميدانياً.',
    ],
    'splash.cta': ['Start exploration', 'ابدأ الاستعراض'],
    'splash.stat1': ['Professionals in regulated roles', 'المهنيون في الأدوار المنظمة'],
    'splash.stat2': ['Registered with SCE', 'المسجلون لدى الهيئة'],
    'splash.stat3': ['Offices verified on the ground', 'المكاتب المتحقق منها ميدانياً'],

    /* Panel titles */
    'w.eco': ['National ecosystem', 'المنظومة الوطنية'],
    'w.spec': ['Top specialties', 'أبرز التخصصات'],
    'w.reach': ['National reach', 'التغطية الوطنية'],
    'w.map': ['National map', 'الخريطة الوطنية'],
    'w.struct': ['Profession structure', 'البنية المهنية'],
    'w.mon': ['Proactive monitoring', 'المراقبة الاستباقية'],
    'w.enf': ['Enforcement delivery', 'أداء الإنفاذ'],
    'w.register': ['The register', 'السجل'],
    'w.flow': ['Register flow', 'توزيع السجل'],
    'w.grades': ['Career grades', 'الدرجات المهنية'],
    'w.nat': ['Global talent base', 'قاعدة الكفاءات العالمية'],
    'w.compare': ['Class profile', 'ملامح الفئات'],
    'w.pipeline': ['Renewal pipeline', 'مسار التجديد'],
    'w.trend': ['Enforcement activity', 'نشاط الإنفاذ'],
    'w.regions': ['Regional enforcement', 'الإنفاذ حسب المنطقة'],
    'w.money': ['Enforced vs collected', 'القيمة المنفَّذة والمحصَّلة'],
    'w.field': ['Field verification', 'التحقق الميداني'],
    'w.fieldmap': ['Verified offices', 'المكاتب المتحقق منها'],
    'w.coverage': ['Licensing coverage', 'تغطية الترخيص'],
    'w.topcities': ['Top cities', 'أبرز المدن'],
    'w.capture': ['What the field captured', 'نتائج المسح'],
    'w.staffcities': ['Cities by size', 'المدن حسب الحجم'],

    /* Chips */
    'c.totals': ['Totals', 'الإجماليات'],
    'c.register': ['Register', 'التسجيل'],
    'c.engineers': ['Engineers', 'المهندسون'],
    'c.technicians': ['Technicians', 'التقنيون'],
    'c.specialists': ['Specialists', 'الأخصائيون'],
    'c.coverage': ['Coverage', 'التغطية'],
    'c.saudishare': ['Saudi share', 'نسبة السعوديين'],
    'c.workforce': ['Workforce', 'القوى العاملة'],
    'c.registered': ['SCE registered', 'مسجلون لدى الهيئة'],
    'c.reach': ['Reach %', 'نسبة التغطية %'],
    'c.enforcement': ['Enforcement', 'الإنفاذ'],
    'c.classes': ['Classes', 'الفئات'],
    'c.nationalities': ['Nationalities', 'الجنسيات'],
    'c.pipeline': ['Pipeline', 'المسار'],
    'c.bytrack': ['By track', 'حسب الفئة'],
    'c.headline': ['Headline', 'الملخص'],
    'c.trend': ['Activity trend', 'اتجاه النشاط'],
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
    'c.dual': ['Dual licence', 'ترخيص مزدوج'],
    'c.grades': ['Grades', 'الرتب'],
    'c.fieldsurvey': ['Field survey', 'التحقق الميداني'],
    'c.surveycov': ['Survey coverage', 'نطاق التحقق'],
    'c.topcities': ['Top cities', 'أبرز المدن'],
    'c.number': ['Number', 'الرقم'],
    'c.bycity': ['By city', 'حسب المدينة'],
    'c.byclass': ['By class', 'حسب الفئة'],
    'c.registermix': ['Register mix', 'توزيع التسجيل'],
    'c.donut': ['Donut', 'دائري'],
    'c.gauge': ['Gauge', 'مقياس'],
    'c.split': ['Split', 'التوزيع'],
    'c.more': ['More', 'أخرى'],
    'c.trendshort': ['Trend', 'الاتجاه'],

    /* Metric labels */
    'm.eco': ['Professionals in regulated roles', 'المهنيون في الأدوار المنظمة'],
    'm.reg': ['Registered with SCE', 'المسجلون لدى الهيئة'],
    'm.offices': ['Offices & firms network', 'شبكة المكاتب والمنشآت'],
    'm.saudis': ['Saudi engineering talent', 'الكفاءات الهندسية السعودية'],
    'm.nonsaudi': ['Global talent', 'الكفاءات العالمية'],
    'm.active': ['Active memberships', 'العضويات الفعالة'],
    'm.near': ['In the renewal window', 'ضمن نافذة التجديد'],
    'm.expired': ['Expired', 'منتهية'],
    'm.frozen': ['Frozen', 'مجمدة'],
    'm.lapsed': ['Historic / lapsed', 'تاريخية / منتهية'],
    'm.proact': ['Licences tracked', 'التراخيص المتابَعة استباقيًا'],
    'm.engage': ['Engaged per cycle', 'متفاعلون في كل دورة تجديد'],
    'm.cases': ['Efaa enforcement actions', 'إجراءات إنفاذ Efaa'],
    'm.enforced': ['SAR enforced', 'ريال منفَّذ'],
    'm.collected': ['SAR collected', 'ريال محصَّل'],
    'm.outstanding': ['SAR outstanding', 'ريال مستحق'],
    'm.surveyed': ['Offices field-surveyed', 'مكاتب تم مسحها ميدانياً'],
    'm.activeoff': ['Active offices verified', 'مكاتب نشطة تم التحقق منها'],
    'm.scecov': ['SCE licensing coverage', 'تغطية ترخيص الهيئة'],
    'm.dual': ['Dual-licensed', 'مرخّصة ازدواجياً'],
    'm.workers': ['Professionals verified on site', 'مهنيون تم التحقق منهم في الموقع'],
    'm.avgw': ['Average per office', 'المتوسط لكل مكتب'],
    'm.geo': ['Offices geo-located', 'مكاتب محددة الموقع جغرافيًا'],
    'm.lic': ['Licence records updated', 'سجلات ترخيص الهيئة المحدّثة ميدانياً'],
    'm.contact': ['Contact channels captured', 'قنوات تواصل مسجلة'],
    'm.regions': ['Regions covered', 'المناطق المشمولة'],
    'm.tuvcities': ['Cities covered', 'المدن المشمولة'],
    'm.natreach': ['National SCE reach', 'تغطية الهيئة وطنياً'],

    /* Series / category labels */
    's.engineers': ['Engineers', 'المهندسون'],
    's.technicians': ['Technicians', 'التقنيون'],
    's.specialists': ['Specialists', 'الأخصائيون'],
    's.active': ['Active', 'فعالة'],
    's.near': ['Renewal window', 'نافذة التجديد'],
    's.expired': ['Expired', 'منتهية'],
    's.frozen': ['Frozen', 'مجمدة'],
    's.engineer': ['Engineer', 'مهندس'],
    's.professional': ['Professional', 'مهندس مهني'],
    's.associate': ['Associate', 'مهندس مساعد'],
    's.consultant': ['Consultant', 'مهندس استشاري'],
    's.collected': ['Collected', 'محصَّل'],
    's.licensed': ['SCE-licensed', 'مرخّص من الهيئة'],
    's.unlicensed': ['Not licensed', 'غير مرخّص'],
    's.offices': ['Offices', 'مكاتب'],
    's.pct': ['% licensed', '% مرخّصة'],
    's.city': ['City', 'المدينة'],
    's.cases': ['Actions', 'الإجراءات'],
    's.d30': ['≤ 30 days', '≤ 30 يومًا'],
    's.d60': ['≤ 60 days', '≤ 60 يومًا'],
    's.d90': ['≤ 90 days', '≤ 90 يومًا'],
    's.notreg': ['Not SCE-registered', 'غير مسجل في الهيئة'],

    /* Notes and footnotes. `{n}` placeholders are filled by Fmt/I18N.t. */
    'n.offnote': [
      '{a} licensed + {b} structured feed',
      '{a} مرخّص + {b} من التغذية الرقمية المنظمة',
    ],
    'n.bubbleWorkforce': [
      'Bubble ≈ regulated workforce per city · {n} cities mapped',
      'حجم الدائرة ≈ القوى العاملة لكل مدينة · {n} مدينة',
    ],
    'n.bubbleRegistered': [
      'Bubble ≈ SCE-registered professionals per city',
      'حجم الدائرة ≈ عدد المسجلين في كل مدينة',
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
      'من {total} مليون ريال منفَّذة · {paid} محصَّلة، {due} قيد التحصيل',
    ],
    'n.coverageNote': [
      'Of {n} active verified offices',
      'من {n} مكتباً نشطاً متحققاً منه',
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

    /* --- KPI Library ---
       Categories, the twenty card titles and the line each NUMBER view prints
       under its figure. Every Arabic string is the translators' own, lifted
       from i18n-source/SCE_LEAP_KPI_Library_AR.html card for card. */
    'lib.all': ['All', 'الكل'],
    'lib.ecosystem': ['Ecosystem', 'المنظومة'],
    'lib.profession': ['Profession', 'المهنة'],
    'lib.monitoring': ['Monitoring', 'الرصد'],
    'lib.enforcement': ['Enforcement', 'الإنفاذ'],
    'lib.field': ['Field Verification', 'التحقق الميداني'],
    'lib.count': ['{n} indicators', '{n} مؤشراً'],

    'k.ecosize': ['Engineering ecosystem size', 'حجم منظومة المهن الهندسية'],
    'k.registered': ['Registered with SCE', 'المسجلون لدى الهيئة'],
    'k.offices': ['Offices & firms network', 'شبكة المكاتب والمنشآت'],
    'k.saudis': ['Saudi engineering talent', 'الكفاءات الهندسية السعودية'],
    'k.activemem': ['Active memberships', 'العضويات الفعالة'],
    'k.engspec': ['Top engineering specialties', 'أبرز التخصصات الهندسية'],
    'k.techspec': ['Top technician specialties', 'أبرز تخصصات التقنيين'],
    'k.specfields': ['Top specialist fields', 'أبرز مجالات الأخصائيين'],
    'k.grades': ['Career-grade pipeline', 'مسار الدرجات المهنية'],
    'k.nat': ['Global talent base', 'قاعدة الكفاءات العالمية'],
    'k.proact': ['Licences tracked proactively', 'التراخيص المتابَعة استباقيًا'],
    'k.engage': ['Renewal engagement', 'التفاعل مع التجديد'],
    'k.pipeline': ['Renewal outreach pipeline', 'مسار التواصل للتجديد'],
    'k.cases': ['Enforcement actions', 'إجراءات الإنفاذ'],
    'k.money': ['Value enforced & collected', 'القيمة المنفَّذة والمحصَّلة'],
    'k.regions': ['Enforcement by region', 'الإنفاذ حسب المنطقة'],
    'k.surveyed': ['Offices field-surveyed', 'المكاتب التي شملها المسح الميداني'],
    'k.coverage': ['SCE licensing coverage', 'نطاق تراخيص الهيئة'],
    'k.onsite': ['Verified on site', 'التحقق الميداني في الموقع'],
    'k.records': ['Records verified in the field', 'السجلات المُحقّقة ميدانيًا'],

    'kn.ecosize': [
      'professionals in regulated engineering roles',
      'من المهنيين في الأدوار الهندسية المنظمة',
    ],
    'kn.registered': [
      'professionals ever registered across all classes',
      'مهنيًا سبق تسجيلهم ضمن جميع الفئات',
    ],
    'kn.saudis': [
      'Saudi professionals in the regulated workforce',
      'مهنيًا سعوديًا ضمن القوى العاملة المنظمة',
    ],
    'kn.saudishare': ['share of the in-scope workforce', 'من نسبة القوى العاملة المستهدفة'],
    'kn.activemem': ['in good standing today', 'بحالة سارية حاليًا'],
    'kn.proact': [
      'flagged in advance for renewal by digital monitoring',
      'تم رصدها استباقيًا للتجديد عبر الرصد الرقمي',
    ],
    'kn.engage': [
      'professionals engaged per renewal cycle',
      'مهنيًا تم التواصل معهم في كل دورة تجديد',
    ],
    'kn.cases': [
      'violation cases processed through Efaa',
      'قضية مخالفة تمت معالجتها عبر منصة إفعاء',
    ],
    'kn.money': ['SAR enforced · {n} SAR collected', 'ريال سعودي منفَّذ · {n} ريال محصَّل'],
    'kn.surveyed': ['across {r} regions · {c} cities', 'عبر {r} منطقة · {c} مدينة'],
    'kn.coverage': [
      'of verified active offices hold an SCE licence',
      'من المكاتب النشطة المتحقق منها تحمل ترخيص الهيئة',
    ],
    'kn.dual': [
      'hold both SCE and municipal licences',
      'تحمل ترخيصًا من الهيئة وترخيصًا بلديًا معًا',
    ],
    'kn.onsite': [
      'professionals counted at active offices · avg {n} per office',
      'مهنيًا في المكاتب النشطة · بمعدل {n} لكل مكتب',
    ],
    'kn.records': [
      'SCE licence numbers updated at the door',
      'أرقام ترخيص الهيئة المحدَّثة ميدانيًا',
    ],
    'kn.actions': ['{n} actions', '{n} إجراء'],

    /* Ticker */
    't.eco': ['professionals in the national engineering ecosystem', 'مهني في المنظومة الهندسية الوطنية'],
    't.reg': ['professionals registered with SCE', 'مهني مسجل لدى الهيئة'],
    't.offices': ['engineering offices and firms in the network', 'مكتب وشركة هندسية في الشبكة'],
    't.scecov': ['of field-verified active offices hold an SCE licence', 'من المكاتب النشطة المتحقق منها ميدانياً تحمل ترخيص الهيئة'],
    't.proact': ['licences tracked proactively by digital monitoring', 'ترخيص قيد المتابعة الاستباقية عبر الرصد الرقمي'],
    't.engage': ['professionals engaged each renewal cycle', 'مهني متفاعل في كل دورة تجديد'],
    't.money': ['SAR enforced, {n} SAR collected through Efaa', 'ريال منفَّذ، {n} ريال محصَّل عبر Efaa'],
    't.surveyed': ['offices verified on the ground across {n} regions', 'مكتب تم التحقق منه ميدانياً في {n} منطقة'],
    't.active': ['memberships active and in good standing today', 'عضوية نشطة وبوضع سليم حالياً'],
    't.workers': ['professionals verified on site at active offices', 'مهني تم التحقق منه في موقع المكاتب النشطة'],
    't.saudis': ['Saudi professionals in the regulated workforce', 'مهني سعودي في القوى العاملة المنظمة'],
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
