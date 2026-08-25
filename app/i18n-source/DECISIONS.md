# Which translation the boards use, where the four files disagree

The four dashboards were translated as four files, and they do not always agree
with each other. `GLOSSARY.md` keeps every variant verbatim; this file records
which one `assets/js/core/i18n.js` uses, so the choice is reviewable and so a
later pass does not quietly reopen it.

Two patterns are worth knowing before reading the table.

**Big Screen is the looser pass.** It drops tanwīn (`ميدانيا`, not `ميدانياً`),
says `الفنيون` where the other three say `التقنيون`, and leaves *Efaa* in Latin
inside Arabic prose. Where it differs from the other three on spelling or
diacritics alone, the boards follow the others.

**SCE is rendered `الهيئة`, not `SCE`.** Ecosystem and KPI Library write
`الهيئة`; Big Screen and Field leave the Latin acronym inside Arabic sentences.
The boards use `الهيئة` throughout, because the same label appears on four
boards and a wall that alternates between the two reads as an oversight. The
wording around it is the translators' — only the acronym is normalised.

## The choices

| English | Used on the boards | Also offered | Why |
| --- | --- | --- | --- |
| Technicians | التقنيون | الفنيون (Big Screen), تقنيون (Ecosystem) | Two files of three; definite form matches المهندسون / الأخصائيون beside it |
| Professional (grade) | مهندس مهني | مهندس ممارس (Big Screen), مهني (Ecosystem) | KPI Library; keeps the مهندس + qualifier shape the other three grades use |
| Associate (grade) | مهندس مساعد | مساعد مهني (Ecosystem) | Big Screen and KPI Library agree |
| Consultant (grade) | مهندس استشاري | استشاري (Ecosystem) | Big Screen and KPI Library agree |
| Offices & firms network | شبكة المكاتب والمنشآت | شبكة المكاتب والشركات (Big Screen) | KPI Library and Ecosystem agree; منشآت covers firms that are not شركات |
| Saudi engineering talent | الكفاءات الهندسية السعودية | الكوادر الهندسية السعودية (Big Screen), الكفاءات السعودية في الهندسة (Ecosystem) | KPI Library; shares كفاءات with the Global Talent Base panel |
| Enforcement Delivery | أداء الإنفاذ | منجزات الإنفاذ (Ecosystem) | Big Screen; reads as a panel title rather than a claim |
| By track | حسب الفئة | حسب المسار (KPI Library) | Big Screen and Ecosystem agree — and on this board the chip sits beside المسار, which حسب المسار would echo |
| REACH % | نسبة التغطية % | نسبة الانتشار % (Big Screen) | Ecosystem; matches التغطية الوطنية on the same board |
| Offices field-surveyed | مكاتب تم مسحها ميدانياً | مكاتب تم استطلاعها ميدانيا (Big Screen), المكاتب التي شملها المسح الميداني (KPI Library) | Field's own wording, and short enough for a KPI tile |
| Offices geo-located | مكاتب محددة الموقع جغرافيًا | مكاتب تم تحديد موقعها جغرافيا (Big Screen) | KPI Library |
| % licensed | % مرخّصة | % مرخص (Big Screen) | Field; agrees with مكاتب |
| Dual-licensed | مرخّصة ازدواجياً | ترخيص مزدوج (KPI Library) | Field, as the metric label; the chip beside it uses KPI Library's ترخيص مزدوج |
| Reset layout | إعادة ضبط التخطيط | إعادة تعيين التخطيط (KPI Library) | Ecosystem and Field agree |
| SAR enforced / collected | ريال منفَّذ · ريال محصَّل | ريال منفذ · ريال محصل (Big Screen) | Ecosystem, with the diacritics |
| ≤ 30/60/90 days | ≤ 30 يومًا | ≤ 30 يوما (Big Screen) | Ecosystem and KPI Library agree |

**Efaa stays in Latin.** The three files that name the platform write it three
ways — `Efaa` (Big Screen), `إفاء` (Ecosystem), `إفعاء` (KPI Library) — and no
two agree, so none of them can be treated as the platform's own spelling. The
boards use Big Screen's `Efaa`, which reads the same on both boards and cannot
be the wrong Arabic: `إجراءات إنفاذ Efaa` and `… ريال محصَّل عبر Efaa`. If SCE
confirms an official Arabic form, it is a two-string change (`m.cases`,
`t.money`).

## Not covered by the translations

These strings have no counterpart in the four files, because the app has panels
and controls the source dashboards did not:

- the splash screen — eyebrow, headline, subtitle and CTA;
- the settings panel (`index.html`) — *Autoplay slideshow*, *Show ticker*,
  *Pause ticker*, *Show splash screen* — English in both locales by decision:
  it is an operator control that only appears on hover, and inventing Arabic
  for it would put unverified text on the wall;
- panel titles `The Register`, `Register Flow`, `Class Profile`,
  `Cities by Size`, `National Reach`;
- chips `Headline`, `By status`, `Rings`, `Profile`, `Windows`, `Value`,
  `Money`, `Staff`, `Capture`, `Saudi share`;
- `SAR outstanding` — rendered `ريال مستحق` rather than `ريال قيد التحصيل`,
  which the same panel already uses for the smaller *In collection* figure;
- most of the `n.*` footnotes, which are longer than anything the source
  dashboards carried.

Their Arabic is the app's own and predates these files. It is the obvious next
thing to send for verification.
