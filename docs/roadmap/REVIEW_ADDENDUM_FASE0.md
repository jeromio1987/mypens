# Addendum bij REVISIE_ROADMAP.md — reviewbevindingen voor fase 0

**Datum:** 2026-07-26 · **Status:** fase 0 code batch uitgevoerd (R0, WP 0.1–0.11, 0.8–0.10) — device APK + sleep HRV sync nog open · **Repo:** `C:\Users\jerom\Desktop\claude\Projects\mypens`

Dit document is een aanvulling op `docs/roadmap/REVISIE_ROADMAP.md`, niet een vervanging. De roadmap blijft leidend voor fasering, principes en acceptatiecriteria. Dit addendum bevat drie dingen die daar niet in staan:

1. Zes defecten die de eigen principes P1/P2/P7 schenden en die in fase 0 horen (M1–M6).
2. Twee feitelijke correcties op appendix A.
3. Drie structurele wijzigingen aan het plan (R0, S2, S3).

Plus, expliciet: één onderdeel dat **niet** aangeraakt mag worden.

> **Regelnummers.** Alle verwijzingen zijn geverifieerd op 2026-07-26. Ze schuiven zodra er iets verandert. Zoek altijd op de aangehaalde code-tekst, niet blind op het regelnummer.

> **Wat NIET geverifieerd is.** Ik heb `mypens-verify-ship`, de APK-embed-keten, de Kotlin-companion (`mobile-companions/`), de Continental-designbestanden en de claim "geen cut/bulk/recomp in het schema" **niet** nagetrokken. Behandel de roadmap-claims daarover als onbevestigd, niet als fout.

---

## 0. Niet aanraken: de alcohol- en confounderlaag

`scripts/lib/periodCausal.mjs` is af en correct. Concreet:

- `attachConfounders()` (r.83–123) verenigt drie alcoholbronnen met expliciete voorrang: Anchor `RecoveryEntry.alcoholDrinks` → anders `WeightEntry.alcoholUnits` als proxy → plus de `DayEntry`-tag `alcohol` als boolean via `isDrinkDay`.
- `classifyDrinkLoad()` (r.20): clean / light ≤2 / moderate ≤5 / heavy ≤9 / binge ≥10.
- `classifyRhrDrinkBand()` (r.35): onafhankelijke fysiologische kruischeck op rust-HR (≥50 likely_drinking, ≥55 heavy_stack). Werkt óók bij lege logging.
- Volgende-dag-lag (r.125 e.v.) met `deltasDrinkVsClean` over RHR, HRV, stress, slaapuren, stappen.
- `alcoholDominant` (r.574) voorkomt dat een vleiend lage RHR als "fit" wordt gelezen terwijl drank de verklaring is.
- Meelift uit Anchor: `cocaineUsed`, `escortUsed`, `anchorMood`, `anchorEnergy`, `hoursSinceAlcohol`, `illnessDay`.

**Instructie:** geen wijzigingen in `classifyDrinkLoad`, `classifyRhrDrinkBand`, `attachConfounders` of de lag-berekening. Wie alcohol nodig heeft, roept deze laag aan.

Gevolg voor WP 2.2 in de roadmap: de alcoholberekening in `app/api/verdict/route.ts` (r.248, `alcoholPenalty += 15 * w`) is geen ontwerpvraag maar een schrapklus. Verwijderen en de confounderlaag bevragen. Dat is kleiner werk dan de roadmap suggereert.

---

## 1. Nieuwe work packages voor fase 0

### WP 0.9 — Eén vensterfunctie *(M — doe deze eerst)*

**Probleem.** Er bestaan drie onverenigbare definities van "deze week", plus twee tijdzonesemantieken:

| Plek | Venster | Datumsemantiek |
|---|---|---|
| `app/api/verdict/route.ts:191` (`cutoff7`) | `gte: today−7`, **geen `lte`** → 8 dagen + toekomstige rijen | UTC (`new Date().toISOString()`, r.5) |
| `app/api/dashboard/route.ts` (`nDaysAgo(7)`, r.176/187) | idem, 8 dagen, geen bovengrens | UTC |
| `lib/energyWeek.ts:22` (`rolling7Window`) | `asOf−6 .. asOf`, exact 7 | lokaal, geankerd op `T12:00:00` (r.17) |
| `mypens-mobile/lib/cockpitWindow.ts:16` (`cockpitRange`) | `days−1 .. today`, exact 7 | lokaal (r.3–11) |
| `scripts/lib/weekDates.mjs:29` (`mondayOf`) | maandag–zondag, 7 | lokaal |

Tussen 00:00 en 02:00 Brussel is "vandaag" in de Verdict-route gisteren. Alleen `lib/energyWeek.ts` ankert op het middaguur — dat is de juiste truc, in één van de vijf bestanden.

Dit is een P7-schending ("een getal dat op web anders is dan op mobiel is een bug met de hoogste prioriteit") en de oorzaak van M2 en M3 hieronder.

**Te bouwen.**
1. Eén module — voorstel `lib/timeWindow.ts` met een `.mjs`-tegenhanger of een gedeelde build — die exporteert: `today()`, `rollingWindow(days)`, `calendarWeek(anchor)`. Alle drie geven `{ from, to }` met **beide grenzen gezet**, lokale datums, middagsanker tegen tijdzonedrift.
2. Twee vensters blijven bestaan, bij ontwerp, en ze worden expliciet benoemd in de payload: `rolling` (dagbeslissing, "hoe sta ik nu") en `calendar` (weekvergelijking, PROOF-loop). Elk getal dat een scherm bereikt draagt het label van zijn venster.
3. Herschrijf `app/api/verdict/route.ts`, `app/api/dashboard/route.ts` en `mypens-mobile/lib/cockpitWindow.ts` zodat ze uitsluitend hieruit lezen. `scripts/lib/weekDates.mjs` blijft de kalenderweek, maar wordt door dezelfde module doorgegeven.
4. `lib/weekDates.ts` en `scripts/lib/weekDates.mjs` zijn logisch identieke duplicaten (alleen comments en types verschillen). Nu is er nog geen drift; consolideer ze meteen.

**Verificatie.** Kies één datum. `/api/verdict`, `/api/dashboard`, `/api/period-review` en de mobiele cockpit moeten voor die datum hetzelfde `{from, to}` melden per vensterlabel. Zet de systeemklok op 00:30 lokaal en herhaal — de datum mag niet verschuiven.

**Nieuwe poortcontrole.** `T8`: elke `toISOString()`, `getDay()`, `setDate()` of `new Date()` buiten `lib/timeWindow.*` faalt hard. Dit is de enige van de nieuwe checks die volledig automatiseerbaar is — maak hem hard.

**Nieuw principe voor deel B van de roadmap.**
> **P9 — Eén definitie van tijd.** Er is precies één functie die "vandaag", "deze week" en "dit venster" bepaalt, met expliciete bovengrens en middagsanker. Elke route, elk scherm en elk script leest daaruit. Een venster dat je zelf uitrekent is een bug, ook als het antwoord toevallig klopt.

---

### WP 0.10 — De vier rekenfouten in de Verdict-route *(S)*

Alle vier in `app/api/verdict/route.ts`. Dit is bewust géén herbouw van de scorelogica — dat blijft WP 2.2. Dit repareert alleen wat aantoonbaar fout is.

**M2 — "8/7 nights" is drukbaar.** r.62 print `Sleep consistency at ${sleepDays}/7 nights`. `sleepDaysLogged` (r.215) is `sleepEntries.length` en kan met het 8-daagse venster 8 zijn (`SleepEntry.date` is unique). Na WP 0.9 kan dit niet meer boven 7, maar de deler moet alsnog uit de vensterlengte komen in plaats van hardgecodeerd `7` te zijn. Nooit een dekking boven 100% tonen.

**M3 — `enduSleep` is ongecapt.** r.277: `(sleepDaysLogged / 7) * 40`, zonder `Math.min`. Acht nachten levert 45,7 op een nominale 40. Regel 292 in dezelfde functie heeft wél `Math.min(..., 14)`. Cap toevoegen.

**M4 — De ledger keert kleine sessies om.** r.329: `Math.min(Math.round(vol / 80), 20) || 8`. Volume 100 kg → `round(1.25)` = 1 punt. Volume 20 kg → `round(0.25)` = 0 → falsy → **8 punten**. Een sessie van 20 kg verslaat er een van 100 kg met 8 tegen 1. Vervang de `|| 8` door een expliciete ondergrens (`Math.max(1, ...)`) of laat de fallback weg. De deler 80 blijft ongedocumenteerd — documenteer hem of haal hem uit de dagkern in fase 2.

**M5 — De dekkingspoort staat op twee signalen.** r.265: `hasEnoughData = totalSignals >= 2`. Eén trainingssessie plus één slaapnacht ontgrendelt vier volledige scores én zelfverzekerde copy ("A clean week, Member", r.108). Dit is de meest directe P2-schending in de codebase. WP 2.2 zet een drempel van ≥4 gelogde dagen op Nutrition; til die drempel nu al naar **alle vier de pijlers**, per pijler gemeten op zijn eigen invoer. Onder de drempel: geen getal, wél de reden.

Kleinigheid, maar het is P1: `clamp()` r.15 heeft `max = 99`. Een score van 100 is onbereikbaar zonder dat iemand dat weet. Documenteer of zet op 100.

**Verificatie.** Zeven achtereenvolgende nachten loggen en niets anders → geen pijler mag boven zijn nominale maximum uitkomen, en E mag geen score tonen op basis van slaap alleen.

---

### WP 0.11 — Dubbeltelling benoemen (documentatie, geen code) *(S)*

Slaap voedt zowel `scoreE` (r.277–280) als `scoreS` (r.290–297). Training voedt zowel `scoreP` (r.271–274) als `scoreE` (r.279). `buildAuditorNote` (r.137) neemt het gemiddelde over de vier pijlers — waardoor slaap dubbel weegt in de toon.

De roadmap stelt in WP 2.2 voor Endurance te schrappen omdat het "een vulmiddel" is. **De echte reden is dubbeltelling, en dat is een sterker argument** — je haalt geen lege pilaar weg, je haalt een dubbele weging weg. Pas de motivering in WP 2.2 aan, anders valt die beslissing later om zodra iemand een definitie voor Endurance verzint.

Geen codewijziging in fase 0. Alleen de motivering vastleggen zodat de beslissing in fase 2 standhoudt.

---

## 2. Correcties op appendix A

**F1 — A.1 over de hartslagaannames is half fout.** De roadmap zegt dat HRrust 50 en HRmax 185 "nergens uit jouw eigen Garmin-data worden afgeleid". `scripts/lib/trainingLoad.mjs:14` zegt zelf het tegendeel: *"Defaults: HRrest=50, HRmax=185 (override per day when resting_hr exists)."* En `buildDailySignals()` in `scripts/lib/periodAnalyze.mjs` geeft bij de `dayTrainingLoad(...)`-aanroep `restingHr: row.restingHr ?? 50` mee, waarbij `row.restingHr` uit de Garmin `resting_hr`-metriek komt.

**HRrust wordt dus wél per dag uit eigen data gehaald**; 50 is alleen de fallback. **HRmax 185 is echt hardgecodeerd** en heeft geen override-pad. Gevolg: het punt in deel E ("op termijn afleiden uit je eigen Garmin-data") is voor de helft al gebouwd. Alleen HRmax is open, en dat is één profielveld. Pas A.1 en de deel-E-regel aan.

**F2 — A.2 zegt "over 7 dagen" bij de Verdict-ledger.** Het zijn 8 dagen (`gte` zonder `lte`, r.191/196). Zie WP 0.9.

---

## 3. Structurele wijzigingen aan het plan

**R0 (nieuw risico, hoogste prioriteit) — DB-bereikbaarheid is een voorwaarde, geen aanname.** Deel G stap 6 is *"Exporteer `SleepEntry` en `TrainingEntry`"*. Op 2026-07-18 weigerde de Supabase-pooler de tenant (`postgres.eiyyblruwqqfrdroerhk not found`, aws-0 én aws-1, ook de directe host). Jerome heeft aangegeven dit zelf te repareren.

→ Maandagavond begint met **één connectietest**, niet met de export. Faalt die, dan is de hele avond credentials repareren en schuift het schema op. Dat is geen mislukking; dat is stap 1. Neem dit op als R0 in deel F en als stap 5a in deel G.

**S2 — WP 2.3 (cut/bulk/recomp) moet uit fase 2.** Fase 2 heet "Eén waarheid" en elke andere WP daarin voegt bronnen samen. WP 2.3 is de enige WP in de hele roadmap die een nieuwe productfunctie bouwt: nieuw model, afgeleide doelen, planner-koppeling, fasewissel als gebeurtenis. Het is (L), in de fase die al (L) is met 2.1 + 2.2 + 2.4 + 2.5.

R6 waarschuwt dat fase 2 eindeloos wordt, maar de tegenmaatregel begrenst alleen WP 2.1. Het onbegrensde stuk is 2.3.

→ Verplaats naar een eigen fase 2.5, of naar het begin van fase 4 (waar het inhoudelijk hoort: een fase is een *ingreep*, en fase 4 gaat over ingreep-en-bewijs). Fase 2 wordt dan 4–6 avonden.

**S3 — T1 is niet handhaafbaar en wordt binnen twee weken uitgezet.** *"Zoek numerieke literals en berekeningen (`reduce`, `/`, `*`) in `components/`; elke rekenkundige bewerking op weergavegegevens is verdacht."* Elke grafiekcomponent deelt en vermenigvuldigt voor lay-out, assen en percentages. Deze check vuurt op elk bestand, wordt onderdrukt, en sterft — en een uitgezette poort geeft valse rust.

→ Versmal tot: markeer alleen rekenwerk op velden die uit een API-responstype komen, óf houd één expliciet `allowlist`-bestand bij dat bewust uitgebreid moet worden. De regel die je wil is niet "geen rekenkunde in componenten" maar **"geen componentberekening die een engine ook had kunnen doen"**.

**Sequentie — WP 0.8 te laat in deel D.** De eerste drie controles van de waarheidspoort zouden falen op de code die WP 0.2 t/m 0.7 gaan schrijven. Deel G doet dit al beter (stap 19, woensdag). Trek WP 0.8 in deel D naar vóór WP 0.3, en WP 0.9 helemaal vooraan.

**Omvang fase 0.** 3–5 avonden is te optimistisch. WP 0.2 is een schemamigratie plus omkering van het schrijfpad plus export plus terugkeertest; 0.7 is (M) en raakt de homepage; 0.8 is een nieuw check-harnas. Met WP 0.9 t/m 0.11 erbij: **6–9 avonden**. Geen bezwaar — R12 zegt zelf dat fase 0+1 een geldige eindtoestand is — maar verkoop fase 0 niet als de korte fase.

---

## 4. Voorgestelde volgorde binnen fase 0

Aangepast ten opzichte van deel D, met de nieuwe WP's ingevoegd:

| # | WP | Waarom hier |
|---|---|---|
| 0 | Connectietest DB (R0) | Alles hieronder heeft data nodig |
| 1 | **WP 0.9** — één vensterfunctie | Elke latere getalvergelijking hangt hieraan |
| 2 | WP 0.8 — eerste drie poortcontroles + T8 | Poort staat vóór de code die hij moet keuren |
| 3 | WP 0.1 — slaapdiagnose | Diagnose vóór fix, ongewijzigd |
| 4 | WP 0.2 — slaapfix + migratie | Ongewijzigd; export eerst |
| 5 | **WP 0.10** — vier rekenfouten Verdict | Klein, zichtbaar, en het venster staat er nu |
| 6 | WP 0.4 + 0.5 — jargon en bronlabels | Kleine zichtbare overwinningen |
| 7 | WP 0.3 — lege staten EAT/NEAT | |
| 8 | WP 0.6 + 0.7 — Audit vindbaar, web-home | |
| 9 | **WP 0.11** — dubbeltelling vastleggen | Documentatie, kan als laatste |

---

## 5. Bekende neveneffecten om te verwachten, niet te ontdekken

- **WP 0.2 punt 3** (geen verzonnen slaapkwaliteit) maakt `quality` `null` zonder HRV. `hrvToQuality()` staat in `lib/integrations/garmin/sleepSync.ts:19` en geeft nu `3` terug bij ontbrekende HRV. Als Garmin historisch weinig HRV heeft geleverd, **verdwijnt de Sleep-pijler voor een groot deel van de historie**. Dat is de bedoeling (P2), maar verwacht het.
- **WP 0.9** verandert de vensterlengte van 8 naar 7 dagen in Verdict en Dashboard. Alle scores schuiven daardoor eenmalig. Dat is een correctie, geen regressie — noteer de oude en nieuwe waarde voor één datum zodat het verschil verklaarbaar blijft.
- **WP 2.4** haalt de directe Supabase-leesactie uit `mypens-mobile/app/(tabs)/training.tsx` (dubbel pad: `isPensApiConfigured()` r.64 en `pensFetch('/api/training')` r.122 náást `supabase.from('TrainingEntry')` r.196/251). De zondag-weekgrens staat op r.269 (`d.getDate() - d.getDay()`) en valt onder WP 0.9.

---

## 6. Referentiepunten, geverifieerd 2026-07-26

Voor wie de bevindingen wil natrekken:

- Tabbalk bevat geen oordeelsoppervlak: `mypens-mobile/app/(tabs)/_layout.tsx` — Weight · Fueling · Sleep · Training (+ `measurements`/`journal` verborgen via `href: null`).
- Audit is een `router.push('/audit')` vanuit het weeglogformulier: `mypens-mobile/app/(tabs)/index.tsx:397`.
- Web-home doet één netwerkcall (`/api/mode`, `app/HomeClient.tsx:82`) en toont geen enkel getal.
- `lib/engines/cockpitData.ts` bevat **nul** verwijzingen naar voeding (grep op food/kcal/protein/nutri = 0). Bevestigt A.4 en de noodzaak van WP 2.1.
- Verdict leest exact drie tabellen: `TrainingEntry`, `SleepEntry`, `DayEntry` (r.194–207). Geen voeding, geen gewicht, geen Garmin, geen Anchor.
- Nutrition is de constante 70 plus tags (r.283–287).
- Mobiel `verdict.tsx:46` is een dunne client over `/api/verdict` — dat is het gewenste patroon en het model voor WP 2.2.
- `mypens-mobile/lib/fuelingRead.ts` is een tweede, lokale oordeelsmachine op de telefoon die zijn output óók `verdict` noemt (r.4) en eigen drempels hardcodeert. Valt onder het naamconflict in WP 2.2; hoort op termijn ook uit de client.
