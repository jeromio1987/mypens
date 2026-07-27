---

# myPENS — Revisie-roadmap

**Versie:** 2026-07-26 · **Modus:** B (intern sparren — deze tekst is niet bedoeld om ongewijzigd in een dashboard of gedeeld document te belanden) · **Repo:** `C:\Users\jerom\Desktop\claude\Projects\mypens`

---

## A. Diagnostiek-appendix — wat er feitelijk in de code staat

Dit deel is geverifieerd tegen de bestanden, niet tegen mijn geheugen. Elke claim heeft een pad.

### A.1 Wat is PLU, en wat betekenen "Hard" en "Peak"?

**PLU = Pens Load Units.** Het is een zelfbedachte, intensiteitsgewogen trainingsbelasting, gedefinieerd in `scripts/lib/trainingLoad.mjs`. De kernformule is:

```
PLU ≈ minuten × sportgewicht × HR-intensiteit
```

- **Sportgewicht** is een vaste tabel: wandelen 0,22 · hiken 0,4 · fietsen 0,9 · hardlopen 1,0 · trail 1,1 · zwemmen 1,05 · kracht 1,15 · HIIT 1,25 · cardio 0,85 · overig 0,65 · rust 0. De sportklasse wordt geraden uit tekst (`classifySport()` doet regex-matching op de Garmin-sportnaam, sub-sport en activiteitsnaam).
- **HR-intensiteit** is een Banister-achtige TRIMP-factor: `ΔHR = (HRgem − HRrust) / (HRmax − HRrust)`, daarna `trimp = ΔHR × 0,64 × e^(1,92×ΔHR)`, geschaald naar ongeveer 0,35–1,9. **HRrust** komt per dag uit Garmin `resting_hr` wanneer die bestaat (`buildDailySignals` → `dayTrainingLoad({ restingHr: row.restingHr ?? 50 })`); **50 is alleen de fallback**. **HRmax = 185 is echt hardgecodeerd** en heeft geen override-pad — dat is het open stuk (één profielveld).
- Er zit ook een **calorie-nudge** in: als een "wandeling" meer dan 12 kcal/min verbrandt, wordt de intensiteit ×1,15 verhoogd. Dat is een heuristiek om verkeerd gelabelde HIIT te repareren.
- Voor gym-rijen zonder duur (`trainingEntryLoad()`) geldt een **volume-proxy**: `2000 kg·reps ≈ 45 "zachte" minuten`, geklemd tussen 20 en 90 minuten. Als je dus 4×10×60 kg squat logt zonder duur, verzint de code een tijdsduur.

**Hard versus Easy** is een simpele bucket-split in `dayTrainingLoad()`: wandelen, hiken en cardio tellen als *easy*, al het andere als *hard*. Geen zone-model, geen drempel — alleen de sportklasse bepaalt de emmer.

**Peak** is géén fysiologisch begrip. In `mypens-mobile/lib/cockpitWindow.ts` staat `summarizeTraining()`, en daar is `peak = Math.max(dagelijkse trainingLoad)` over het gekozen venster. Het is dus letterlijk "je zwaarste dag in deze 14 dagen, in PLU".

**Waarom "PLU hard peak" onbegrijpelijk is:** in `mypens-mobile/components/TrainingReviewCard.tsx` worden vier chips naast elkaar gerenderd — `PLU`, `Active`, `Hard`, `Peak` — met alleen een getal eronder. Er staat geen eenheid, geen venster, geen referentiewaarde, geen uitleg. Je leest dus "PLU 412 · Active 9 · Hard 250 · Peak 98" en dat is voor iedereen behalve de auteur van `trainingLoad.mjs` betekenisloos. De web-tegenhanger staat in `components/period-review/PeriodCockpit.tsx`.

### A.2 Waar komen "weekly volume" en de kilo's vandaan?

Twee volledig gescheiden bronnen, en dat is precies het probleem.

**1. De grafiek "Weekly volume (kg)" op de mobiele Training-tab** (`mypens-mobile/app/(tabs)/training.tsx`):

- `volume = sets × reps × weightKg`, berekend bij het opslaan van elke set en opgeslagen in het veld `TrainingEntry.volume`.
- De grafiek somt `volume` per week over de laatste 8 weken. De weekgrens is `startOfWeek = datum − getDay()`, dus **zondag-start**, niet maandag — dat wijkt af van elke andere weekindeling in het project (`lib/weekDates.ts`, PlannerWeek gebruikt maandag).
- De labels zijn `W1 … W7 … Now`. Geen datums. Je kunt dus niet zien welke week een balk is.
- **De bron is uitsluitend handmatig gelogde gymsets.** Elke Garmin-activiteit, elke Health Connect-sessie en elke gepushte workout heeft `volume = 0` of geen volume. Een week met vier zware Garmin-sessies en nul handmatige sets is in deze grafiek een lege week.
- Deze tab leest bovendien **rechtstreeks uit Supabase** (`supabase.from('TrainingEntry')`) wanneer `EXPO_PUBLIC_PENS_API_URL` niet is gezet, en anders via de API. Twee leespaden naar wat mogelijk twee databases zijn.

**2. "kg volume" in de Verdict-ledger** (`app/api/verdict/route.ts`): dezelfde `volume`-som over een **inclusief rollend 7-daags venster** (`lib/timeWindow.rollingWindow(7)` — vóór WP 0.9 was dit 8 dagen via `gte` zonder `lte`), omgerekend naar punten via `punten = min(max(1, round(volume / 80)), 20)`. Die deler 80 is nergens gedocumenteerd.

**3. PLU** (A.1) is een derde grootheid die *niets* met volume te maken heeft en toch in dezelfde app "training" heet.

Kortom: het antwoord op "van waar komen die kilo's" is *"van jouw handmatig getikte sets × reps × gewicht, opgeteld per zondag-week, exclusief alles wat je horloge weet"*. En dat staat nergens in de UI.

### A.3 De sleep-sync-keten, en waarom "hij synct niet" volkomen plausibel is

De keten:

```
Health Connect (Android)
  → mypens-mobile/lib/healthConnectSleepSync.ts   (leest SleepSession + HRV, 14 dagen terug)
  → POST /api/integrations/healthconnect/sleep-ingest   (Bearer = pairing token)
  → lib/integrations/healthconnect/sleepMapping.ts      (mapt naar SleepEntry)
  → prisma SleepEntry
  → GET /api/sleep  →  mobiele Sleep-tab
```

Er zijn minstens negen plekken waar dit stilletjes kan doodlopen. Op volgorde van waarschijnlijkheid:

1. **Er is geen automatische slaapsync.** In `mypens-mobile/app/_layout.tsx` wordt bij het opstarten alleen `ensureHealthConnectPermissions()` en `ensureHcPairingFromApi()` aangeroepen. Slaap wordt uitsluitend gesynchroniseerd wanneer je op de Sleep-tab op de knop **Sync** tikt in `HealthConnectSleepCard`. Als jij die knop niet elke dag indrukt, synct er niets. Dat alleen al verklaart het volledige klachtbeeld.
2. **De server slaat bestaande nachten over, altijd.** In `sleep-ingest/route.ts`: als er al een `SleepEntry` bestaat voor die wake-datum, dan `skipped++` en klaar. Er is geen update-pad. Eén keer een handmatige of foute rij voor een datum betekent dat Health Connect die nacht **nooit** meer kan corrigeren. De UI meldt dan "0 new · 14 already logged", wat leest als "hij doet niks".
3. **De slaap-permissie wordt pas bij de eerste tap gevraagd.** `syncHealthConnectSleep()` vraagt zelf `SleepSession` + `HeartRateVariabilityRmssd` aan. Android toont die dialoog na twee weigeringen niet meer opnieuw; je krijgt dan permanent "Health Connect sleep permission denied" zonder route naar de systeeminstellingen.
4. **De APK heeft de JavaScript ingebakken** (`debuggableVariants = []`, zie de verify-skill). Een fix in de sync-code die niet gevolgd wordt door een rebuild plus `adb install -r` bestaat niet op je telefoon. Dat is historisch een grote bron van "maar we hadden dit toch gefixt".
5. **Twee leespaden op de Sleep-tab.** `useApi = isPensApiConfigured()`. Is de API-URL gezet, dan lees je `/api/sleep` (Prisma). Is die niet gezet, dan lees je rechtstreeks uit Supabase. Health Connect schrijft *altijd* via de API. Staat de app op het Supabase-pad, dan zie je de gesynchroniseerde nachten simpelweg niet.
6. **Twee schrijvende clients.** Naast de React Native-sync bestaat er een aparte Kotlin-companion (`mobile-companions/android/HealthConnectCompanion/SyncWorker.kt`) die dezelfde endpoints kan aanroepen. Welke van de twee "de" sync is, is nergens vastgelegd.
7. **Datumtoewijzing en fragmenten.** De nacht krijgt de kalenderdag van het *ontwaken*, in de tijdzone van het toestel (`localYmd(endTime)`). De server houdt per datum alleen de **langste** sessie; dutjes en gefragmenteerde nachten (Garmin schrijft soms meerdere segmenten) verdwijnen zonder melding.
8. **Venster van 14 dagen.** Alles ouder komt nooit binnen — een gat van drie weken repareert zichzelf niet.
9. **Verzonnen kwaliteit.** `hrvToQuality()` geeft **3 van 5** terug wanneer er geen HRV is. Er staat dus een score van 3★ in je ledger op nachten waarvoor geen enkele kwaliteitsmeting bestaat. En die 3 telt daarna mee in de Verdict Sleep-pilaar (`avgQuality / 5 × 30`).

Daarnaast: de server registreert wél `lastError` en `lastErrorAt` op `HealthConnectConnection`, maar de telefoon toont dat nooit. Er is geen enkel scherm waar je kunt zien: *laatste geslaagde sync, laatste fout, aantal nachten in de laatste 14 dagen.*

### A.4 Discrepantie: wat er gebouwd is versus wat de engines weten

De rekenkernen lopen ver voor op de schermen, en de schermen tonen deels dingen die geen enkele kern kent. `lib/energyBalance.ts` is een serieuze energiemotor: hij scheidt EAT (sessies), NEAT (stappen- of residu-model), BMR (gewicht plus profiel), corrigeert Health Connect-duplicaten tegen Google Fit, kent een expliciete disclaimer dat Garmin-dagtotalen nooit worden meegeteld, en zet een `incompleteCapture`-vlag wanneer er sessies zijn zonder calorieën. `lib/engines/cockpitData.ts` plus `scripts/lib/periodAnalyze.mjs` en `periodCausal.mjs` vormen een tweede, causale motor over slaap, HRV, rust-hartslag, stappen, trainingsbelasting en gewicht — met confounders. En `app/api/verdict/route.ts` is een derde "motor" die **geen van beide** gebruikt: Nutrition is `70 + 3 per locked-in-dag − 15 per alcoholdag − 10 per zware-maaltijddag`, waarbij geen enkele `FoodEntry`, kcal of macro wordt geraadpleegd; Performance telt alleen het aantal *dagen met een handmatige TrainingEntry* en negeert al je Garmin-activiteiten. Ondertussen bevat `cockpitData.ts` nul verwijzingen naar voeding — ik heb er expliciet op gezocht: eten zit niet in de causale lens. Het gevolg: drie plekken die je week beoordelen, drie verschillende antwoorden, en het woord "verdict" betekent op de Verdict-pagina iets anders (P.E.N.S.-scores 0–99) dan in de cockpit (`read.verdict` = good/mixed/bad). Dat is geen cosmetisch probleem maar een waarheidsprobleem.

---

## B. Productprincipes en de definitie van "klaar"

Deze principes zijn de meetlat voor elke fase hieronder. Als een work package een principe schendt, gaat het niet door — ongeacht hoe mooi het scherm is.

**P1 — Geen getal zonder herkomst.** Elk cijfer op elk scherm kan één van drie dingen zijn: gemeten, afgeleid met een zichtbare formule, of geschat. Geschatte cijfers dragen een zichtbaar label. Een getal zonder aantoonbare bron wordt verwijderd, niet "voorlopig gelaten".

**P2 — Geen score zonder dekking.** Een score mag alleen verschijnen wanneer de invoer die hem hoort te voeden ook echt aanwezig is. Nutrition mag geen 70 tonen als er geen enkele maaltijd is gelogd. Bij onvoldoende dekking: "onvoldoende data", niet een getal.

**P3 — Eén bron per grootheid.** Er is precies één plek in de code die "wat at ik", "wat verbrandde ik", "hoe zwaar trainde ik" en "hoe sliep ik" berekent. Schermen renderen; ze rekenen niet. De mobiele Training-tab die zelf weekvolume optelt uit Supabase is per definitie een overtreding.

**P4 — Leegte is informatie.** Ontbrekende data is een zichtbaar feit met een actieknop, geen nul en geen gat. `incompleteCapture` bestaat al in de engine en moet in beeld.

**P5 — Vangen is bijzaak, lezen is hoofdzaak.** Het startscherm beantwoordt "wat is er aan de hand en wat doe ik vandaag", niet "welke van de negen dingen wil je invullen". Invoer is bereikbaar in één handeling, maar is niet de voorpagina.

**P6 — Ochtend beslist, avond onderzoekt.** Alles wat 's ochtends op de telefoon nodig is, moet in één scherm en binnen dertig seconden te beantwoorden zijn. Alles wat uitzoekwerk vraagt (correlaties, vensters, herkomst, exports) hoort op de laptop en mag daar diep zijn. Dit is geen stijlkeuze maar een indelingsregel: als een mobiel scherm om nadenken vraagt, staat het op de verkeerde plek.

**P7 — Web en mobiel zijn dezelfde app in twee vormen.** Zelfde ruggengraat, zelfde woorden, zelfde cijfers. Verschil zit in diepte, nooit in betekenis. Een getal dat op web anders is dan op mobiel is een bug met de hoogste prioriteit.

**P8 — Geen nieuwe scoretaal.** Er komt geen enkel nieuw samengesteld getal bij zolang de bestaande (PLU, Form, P.E.N.S., quality 1–5) niet uitgelegd of afgeschaft zijn.

**P9 — Eén definitie van tijd.** Er is precies één functie die "vandaag", "deze week" en "dit venster" bepaalt (`lib/timeWindow.ts` + twins), met expliciete bovengrens en middagsanker. Elke route, elk scherm en elk script leest daaruit. Een venster dat je zelf uitrekent is een bug, ook als het antwoord toevallig klopt. Twee labels: `rolling` (dagbeslissing) en `calendar` (Mon–Sun).

**Definitie van klaar** — een work package is pas af wanneer alle vijf punten waar zijn:

1. Het werkt op het toestel, niet alleen in de repo (APK herbouwd en geïnstalleerd waar mobiel geraakt is).
2. `mypens-verify-ship` staat op PASS, inclusief de nieuwe waarheids- en tegenspraakcontroles uit fase 0.
3. Web en mobiel tonen voor dezelfde dag hetzelfde getal, handmatig gecontroleerd op minstens één echte datum.
4. De lege staat is bekeken, niet alleen de gevulde staat.
5. Jij kunt de bijbehorende "klaar als ik…"-zin zonder aarzeling met ja beantwoorden.

---

## C. Doelarchitectuur — één waarheid, drie lenzen

### C.1 De laag die rekent

Eén canonieke dagberekening, gebouwd op wat er al staat, met `lib/energyBalance.ts` en `lib/engines/cockpitData.ts` als fundament:

| Laag | Verantwoordelijkheid | Bestaat als |
|---|---|---|
| Feiten | Ruwe rijen: FoodEntry, SleepEntry, TrainingEntry, GarminActivity, WeightEntry, GarminDailyMetric, DayEntry | Prisma-schema, staat er |
| Dagkern | Per dag: energie in/uit, dekking, slaap, belasting, gewicht, vlaggen | `energyBalance.ts` (energie) + `periodAnalyze.mjs` (belasting/slaap) — **moeten samengevoegd worden achter één functie** |
| Vensterkern | Rollend 7/14/30: trend, signaal, oorzaakkandidaten, confounders | `cockpitData.ts` + `periodCausal.mjs`, **voeding moet erin** |
| Rendering | Verdict, Read-kaart, cockpit, planner | Nu deels eigen rekenwerk — moet puur renderen worden |

De harde regel: **`app/api/verdict/route.ts` mag na fase 2 geen enkele eigen berekening meer bevatten.** Het wordt een presentatielaag over de vensterkern.

### C.2 De drie lenzen

Eén waarheid, drie manieren om ernaar te kijken. Geen vierde.

1. **Vandaag** — wat is er nu, wat mist er, wat is de eerstvolgende handeling. Dit is de ochtendlens.
2. **De Read** — wat gebeurde er over het venster en wat is de meest waarschijnlijke oorzaak. Signaal, oorzaak, bewijs. Dit is de avond- en weekendlens.
3. **Het Verdict** — de gestileerde weergave van de Read. Auditor-toon, oordeel, formulering. **Rendering, geen motor.** De cijfers eronder komen uit lens 2 of ze bestaan niet.

### C.3 Ruggengraat, en wat waar hoort

**Vier bestemmingen, op web en mobiel identiek benoemd: Fueling · Train · Read · Audit.** Plus een permanente Sync-indicator die geen eigen bestemming is maar overal in de kop zichtbaar.

| | Mobiel (ochtend, beslissen) | Web (avond, uitzoeken) |
|---|---|---|
| **Fueling** | Vandaag eten en energie, dekking, één-tap-toevoegen | Zelfde plus geschiedenis, macro's, micro's, kalibratie tegen gewicht |
| **Train** | Vandaag: gepland versus gedaan, belasting in gewone taal | Volledige belastinghistorie, per sport, herkomst per sessie |
| **Read** | Eén kaart: signaal, oorzaak, actie | Volledige cockpit, vensterkeuze, confounders, correlaties |
| **Audit** | Ledgers, sync-gezondheid, gaten, bloedwerk | Zelfde plus exports, herkomstweergave, ruwe rijen |

**Waar Weight en Sleep landen.** Geen aparte dagelijkse logtabs meer met invulplicht. Gewicht komt van de Tanita, slaap van Garmin via Health Connect. Beide verschijnen als *waarneming* binnen Read (trend, ware gewicht, retentie) en zijn corrigeerbaar vanuit Audit wanneer een meting mist of fout is. Handmatige invoer blijft mogelijk, maar als uitzondering achter Audit, niet als dagelijkse verplichting op de navigatiebalk.

**Waar Dopamine Debt landt.** Nergens, voorlopig. Uit de hub, uit de navigatie. De liquidatieprotocol-schermen (`mypens-mobile/app/dopamine-debt.tsx`) zijn statische suggestieteksten met een chip waarop letterlijk "Shell" staat. Ze mogen als losse, niet-gelinkte route blijven bestaan, maar ze horen niet in een hub die verder echte ledgers ontsluit. Fase 5 beschrijft wat er nodig is om hem écht te bouwen, voor als je dat later wilt.

---

## D. De roadmap

---

## FASE 0 — De bloeding stelpen

**Duur: 6–9 werkavonden (M).** **Geen nieuwe architectuur, geen nieuwe schermen.** (Was 3–5 — te optimistisch met WP 0.2 migratie, 0.7 homepage, 0.8 poort, plus 0.9–0.11.)

### Doel in gewone taal

Zorgen dat de app niet meer liegt en niet meer zwijgt. Aan het eind van deze fase klopt wat er staat, of er staat eerlijk "dit weten we niet". Er is nog niets herbouwd — er is alleen niets meer wat je op het verkeerde been zet.

### Waarom deze volgorde

Je kunt geen navigatie herbouwen bovenop cijfers die je niet vertrouwt. Elke fase hierna gaat ervan uit dat een getal op het scherm betekent wat het zegt. Bovendien: fase 0 kost weinig en haalt de dagelijkse ergernis weg, wat het draagvlak geeft om de zwaardere fases rustig te doen. En specifiek voor slaap geldt dat het een *diagnose* is, geen bouwklus — dat moet vóór alles, want als de sync stuk is, is elke slaapgedreven conclusie in de app onbetrouwbaar.

**Volgorde (addendum 2026-07-26):** R0 connectietest → **WP 0.9** (venster) → **WP 0.8** (poort + T8) → 0.1 → 0.2 → **WP 0.10** (Verdict-rekenfouten) → 0.4/0.5 → 0.3 → 0.6/0.7 → **WP 0.11** (dubbeltelling docs). Zie `docs/roadmap/REVIEW_ADDENDUM_FASE0.md`.

### Work packages

---

**WP 0.9 — Eén vensterfunctie** *(M — eerst)*

Eén module `lib/timeWindow.ts` (+ `scripts/lib/timeWindow.mjs` + mobile twin) exporteert `today()`, `rollingWindow(days)`, `calendarWeek(anchor)`. Beide grenzen gezet, lokaal, middagsanker. Payload-label `rolling` | `calendar`. Herschrijf verdict/dashboard/cockpit; consolideer `weekDates`. Poort **T8**.

---

**WP 0.1 — Slaap-sync: diagnose vóór fix** *(S, halve avond)*

Eerst meten, dan pas repareren. Bouw een tijdelijk diagnosescherm of, sneller, een enkel API-antwoord dat de hele keten in één blik toont.

*Bouwen/wijzigen:*
- Nieuw: `GET /api/integrations/healthconnect/sleep-diagnostics` dat teruggeeft: aantal `SleepEntry` per dag over de laatste 30 dagen, met per rij de herkomst (bevat `notes` "Health Connect" of niet), plus `lastSyncAt`, `lastError`, `lastErrorAt` uit `HealthConnectConnection`.
- Mobiel: in `HealthConnectSleepCard` het resultaat van de laatste sync uitbreiden van `stored/skipped` naar `read / stored / skipped / eerste-datum / laatste-datum`, plus de serverfout tonen als die er is.

*Uit te sluiten hypothesen, in deze volgorde:* is er een pairing-token · geeft Health Connect überhaupt sessies terug (`read`) · komen ze aan bij de server (`stored + skipped`) · worden ze overgeslagen wegens bestaande rijen (`skipped`) · leest de tab uit de API of uit Supabase · draait de huidige JavaScript wel op het toestel.

*Data of UX:* pure diagnostiek.
*Parity:* alleen mobiel plus één API-endpoint; de web-kant komt in WP 0.2.

---

**WP 0.2 — Slaap-sync: de fix** *(M, één tot twee avonden)*

Afhankelijk van de uitkomst van 0.1, maar deze vier zijn hoe dan ook nodig:

1. **Automatisch synchroniseren bij openen van de app.** In `mypens-mobile/app/_layout.tsx` naast de bestaande `ensureHealthConnectPermissions()` ook een slaap-sync afvuren, met een demper zodat het maximaal één keer per bijvoorbeeld zes uur gebeurt (AsyncStorage-sleutel bestaat al: `@mypens/hc_last_sleep_sync_iso`).
2. **Bijwerken in plaats van overslaan.** In `app/api/integrations/healthconnect/sleep-ingest/route.ts` de logica omkeren: een bestaande rij die zelf uit Health Connect kwam wordt **bijgewerkt**; alleen een rij die jij handmatig hebt gemaakt wordt beschermd. Dat vraagt om een expliciet bronveld op `SleepEntry` (`source: 'manual' | 'healthconnect' | 'garmin'`) plus het opslaan van de `externalId` die `sleepMapping.ts` al produceert maar die nu wordt weggegooid. Kleine migratie, groot effect.
3. **Geen verzonnen kwaliteit.** `hrvToQuality()` geeft nu 3 terug zonder HRV. Dat moet `null` worden, en de UI toont dan "geen kwaliteitsmeting". Let op de vervolgeffecten: de Verdict Sleep-pilaar rekent met `avgQuality` en moet nachten zonder kwaliteit uitsluiten in plaats van als 3 meetellen.
4. **Sync-gezondheid zichtbaar.** Eén regel, zowel in de mobiele kop als op web: laatste geslaagde sync, aantal nachten in de laatste 7 dagen, en de laatste fout indien aanwezig. Dit is de kiem van de Sync-chip uit fase 1.

*Data/engine versus UX:* dit is een echte datawijziging (migratie plus schrijfpad). Behandel het als zodanig: eerst een export van de huidige `SleepEntry`-tabel maken.
*Parity:* de fix zit server-side, dus web profiteert automatisch; de statusregel moet op beide.

---

**WP 0.3 — Lege staten voor EAT en NEAT** *(S)*

`incompleteCapture` en `foodIncomplete` bestaan al in `lib/energyBalance.ts` en worden in het antwoord teruggegeven, maar de UI gooit ze weg.

*Bouwen/wijzigen:*
- `components/food/EnergyBalanceCard.tsx` (web) en de energie-weergave in `mypens-mobile/app/(tabs)/food.tsx`: wanneer `incompleteCapture` waar is, toon geen delta-getal maar een expliciete strook: *"Deze dag is onvolledig — er zijn sessies zonder calorieën"* of *"eten deels gelogd"*, met een knop naar het ontbrekende item.
- Toon EAT en NEAT nooit als 0 wanneer de reden "niet gemeten" is. Onderscheid nul van onbekend, ook in de kleur.
- Neem de bestaande `DISCLAIMER`-tekst uit `energyBalance.ts` op als uitklapbare toelichting in plaats van hem alleen in de payload te laten zitten.

*Acceptatie-detail:* een dag waarop je een Garmin-sessie hebt zonder calorieën mag nooit een schoon energiesaldo tonen.

---

**WP 0.4 — Jargon vertalen of verbergen** *(S)*

Zie het woordenboek in deel E voor de exacte formuleringen.

*Bouwen/wijzigen:*
- `mypens-mobile/components/TrainingReviewCard.tsx`: de vier kale chips vervangen door één zin in gewone taal plus maximaal twee getallen mét eenheid en venster. Voorstel: *"Laatste 14 dagen: 9 actieve dagen, waarvan 4 zwaar. Zwaarste dag: dinsdag 21."* Het woord PLU verdwijnt van het hoofdscherm en verhuist naar een informatie-uitklap met de formule.
- Idem in `components/period-review/PeriodCockpit.tsx` op web, met dezelfde bewoording.
- "Form score" krijgt óf een uitleg-uitklap óf verdwijnt tot fase 4.

*Regel:* geen enkele afkorting mag zonder uitleg op een primair scherm staan. Als de uitleg niet in één zin past, hoort het getal daar niet.

---

**WP 0.5 — Weekvolume: bronlabel of weghalen** *(S)*

*Bouwen/wijzigen* in `mypens-mobile/app/(tabs)/training.tsx`:
- Titel wordt eerlijk: *"Handmatig gelogde gym-tonnage per week"* in plaats van "Weekly volume (kg)".
- Onderschrift dat expliciet zegt wat er níét in zit: *"Alleen sets die je zelf hebt getikt. Garmin- en Health Connect-sessies staan hier niet in."*
- Labels worden datums (weekbegin) in plaats van W1…W7.
- Weekgrens naar maandag, gelijk aan `lib/weekDates.ts` en `PlannerWeek`.

*Alternatief dat ik zou verkiezen:* haal de grafiek in fase 0 gewoon weg en breng hem in fase 2 terug op basis van de dagkern, met álle sessies erin. Een half-verklaarde grafiek is nog steeds een grafiek die je verkeerd leest. Jouw keuze — maar kies bewust, laat hem niet ongelabeld staan.

---

**WP 0.6 — Audit vindbaar maken** *(S)*

`mypens-mobile/app/audit.tsx` is een goede hub (Verdict, Weekly Feedback, Bloodwork, Planner, Period review, Journal, Body) maar staat niet in de tabbalk — je moet ernaartoe navigeren zonder ingang. De tabbalk is nu Weight · Fueling · Sleep · Training.

*Tussenoplossing voor fase 0:* voeg Audit toe als vijfde tab of als permanente knop rechtsboven op elk hoofdscherm. De volledige herindeling naar vier bestemmingen is fase 1 — dit is puur "maak het bereikbaar".
*Web:* zet Audit in de hoofdnavigatie van `app/HomeClient.tsx`, waar hij nu volledig ontbreekt.

---

**WP 0.7 — Web-home: van tegelmuur naar richting** *(M)*

`app/HomeClient.tsx` bevat een negen-tegels-raster (`MODULES`: Weight, Food, Sleep, Sync, Anchor, Body, Labs, Overview, Journal) plus een groot moduskeuze-blok. Het is een invoermenu vermomd als startpagina.

*Bouwen/wijzigen, minimale versie voor fase 0:*
- Het negen-tegels-raster uit de primaire positie halen; laat het als compacte rij onderaan of achter "Meer" staan.
- Bovenaan komt de Read-kaart: de huidige stand plus de belangrijkste observatie van het venster. Hergebruik wat `EngineReadCard` op mobiel al doet, gevoed door `/api/period-review`.
- Modus en context-tags blijven, maar compact — ze zijn invoer, geen kop.

*Waarschuwing:* dit is de enige plek in fase 0 waar de verleiding groot is om meteen fase 1 te doen. Niet doen. Verplaatsen en herordenen, niet herbouwen.

---

**WP 0.8 — De waarheids- en tegenspraak-poort opzetten** *(M)* — *dit loopt door alle fases heen; bouw staat bovenaan fase 0 (vóór 0.3)*

Zie deel D, "Dwars door alle fases" hieronder voor de volledige specificatie. In fase 0 bouw je: getal-zonder-bron (**T1 versmald**, zie S3), score-zonder-dekking (T2), ontbrekende lege staat (T3), en **T8** (datumidentiteit buiten `timeWindow`).

---

**WP 0.10 — Vier rekenfouten in de Verdict-route** *(S)*

Geen herbouw van de scorelogica (dat blijft WP 2.2). Alleen aantoonbare fouten in `app/api/verdict/route.ts`:

- **M2** — deler uit vensterlengte, nooit hard `7`; dekking nooit >100%.
- **M3** — `enduSleep` capped met `Math.min(..., 40)`.
- **M4** — ledger: `Math.max(1, round(vol/80))` i.p.v. `|| 8` (kleine sessies kregen meer punten dan grote).
- **M5** — dekkingspoort per pijler ≥4 dagen eigen invoer; onder de drempel: `score: null` + reden. Endurance ontgrendelt niet op slaap alleen.
- **P1** — `clamp` max = 100 (was 99).

---

**WP 0.11 — Dubbeltelling vastleggen** *(S, documentatie)*

Slaap voedt `scoreE` én `scoreS`; training voedt `scoreP` én `scoreE`. `buildAuditorNote` middeleert over vier pilaren → slaap weegt dubbel in de toon. **Motivering voor WP 2.2 om Endurance te schrappen: dubbeltelling, niet "vulmiddel".** Geen code in fase 0.

### Acceptatiecriteria fase 0 — "klaar als ik…"

- …'s ochtends mijn telefoon open en mijn slaap van vannacht er gewoon in staat, zonder dat ik ergens op een knop moest drukken.
- …kan zien wanneer de sync voor het laatst werkte, en als hij faalde, waarom.
- …geen enkel getal meer op een hoofdscherm zie waarvan ik me afvraag "waar komt dat vandaan".
- …bij de grafiek met kilo's in één regel lees dat het alleen mijn handmatige gymsets zijn.
- …de Audit-hub kan bereiken zonder te zoeken.
- …op web niet meer word begroet door negen invoertegels maar door wat er aan de hand is.
- …een dag met een onvolledige log herken zonder de cijfers te hoeven natrekken.

### Test- en verificatiepoorten

- `mypens-verify-ship` op PASS: mobiele `tsc`, scoped web-`tsc`, API-smoke, APK-embed.
- **Handmatig op het toestel:** APK herbouwd en met `adb install -r` geïnstalleerd, Health Connect-toestemmingen behouden.
- **Slaap-terugkeertest:** verwijder één Health Connect-nacht uit `SleepEntry`, sync opnieuw, controleer dat hij terugkomt. Werk daarna dezelfde nacht handmatig bij en controleer dat de sync hem niet overschrijft.
- **Lege-staat-test:** kies een datum zonder eten en een datum met een sessie zonder calorieën; beide schermen moeten "onvolledig" zeggen, niet "0".
- **Jargon-controle:** doorloop elk primair scherm en noteer elk woord dat je aan een buitenstaander niet in één zin kunt uitleggen. De lijst moet leeg zijn.

### Expliciet buiten scope in fase 0

Navigatie-herindeling · Verdict-berekening aanpassen · eten in de causale motor · doelen (cut/bulk) · Continental-skin · Dopamine Debt · nieuwe grafieken · nieuwe modellen · elke databasewijziging behalve `SleepEntry.source` en `externalId`.

---

## FASE 1 — De ruggengraat, tegelijk op web en mobiel

**Duur: 4–6 werkavonden (M/L).**

### Doel in gewone taal

De app krijgt vier bestemmingen met dezelfde namen op beide apparaten: Fueling, Train, Read, Audit. Je hoeft nooit meer te onthouden waar iets staat, omdat het op web en telefoon op dezelfde plek staat.

### Waarom deze volgorde

Na fase 0 klopt de inhoud. Nu moet de vindbaarheid kloppen. Dit vóór de waarheidsfusie (fase 2), omdat je bij het samenvoegen van engines moet weten waar het resultaat landt — anders bouw je een motor voor een dashboard dat je daarna weggooit. En expliciet **tegelijk** op beide platforms, omdat elke week waarin ze uit elkaar lopen de latere samenvoeging duurder maakt.

### Work packages

---

**WP 1.1 — De ruggengraat vaststellen als code, niet als afspraak** *(S)*

Eén gedeeld bestand dat de vier bestemmingen, hun labels, iconen en onderliggende routes definieert. Web leest het, mobiel leest het. Nieuwe schermen moeten zich hierin registreren, anders zijn ze niet bereikbaar. Dit voorkomt dat er over drie maanden weer een vijfde tab opduikt "omdat het even handig was".

---

**WP 1.2 — Mobiele tabbalk herbouwen** *(M)*

*Wijzigen:* `mypens-mobile/app/(tabs)/_layout.tsx`.
- Nieuw: Fueling (`food`) · Train (`training`) · Read (nieuw scherm, gevoed door `/api/period-review`) · Audit (`audit` verhuist van stack naar tab).
- `index` (nu Weight-hub) wordt geen tab meer. De gewichtsgrafiek en Tanita-invoer verhuizen naar Read (waarneming) en Audit (correctie).
- `sleep` wordt geen tab meer. Slaap verschijnt in Read; handmatig corrigeren gebeurt vanuit Audit.
- `measurements` en `journal` blijven zoals ze zijn: geregistreerd maar verborgen, bereikbaar via Audit.

*Let op:* dit raakt diep-links en `router.push`-aanroepen door de hele app. Doorzoek op `(tabs)/weight`, `(tabs)/sleep` en `(tabs)/index`.

---

**WP 1.3 — Webnavigatie herbouwen** *(M)*

*Wijzigen:* `app/HomeClient.tsx` en de layout.
- De huidige kopnavigatie (Brief, Investing, About, Dashboard, Journal, Modes, Anchor, Vault, Share — negen items) wordt vervangen door dezelfde vier bestemmingen plus een "Meer"-menu voor de rest.
- `/` wordt de Read-pagina. Het moduskeuze-blok verhuist naar een compacte strook binnen Fueling of Read, want het is invoer.
- Het negen-tegels-raster onderaan verdwijnt volledig; alles wat het ontsloot, is via de vier bestemmingen bereikbaar.

---

**WP 1.4 — Sync-chip als permanent element** *(S/M)*

Eén component, twee implementaties, één contract: wat is de laatste geslaagde synchronisatie per bron (Garmin, Health Connect workouts, Health Connect slaap, Tanita), en waar hapert het. Web heeft al `components/shared/SyncStatusBadge`; breid dat uit tot het volledige contract en bouw de mobiele tegenhanger. Aantikken opent Audit met de sync-sectie open.

---

**WP 1.5 — De Read-pagina, eerste versie** *(M)*

Nog niet de volledige signaal-naar-plan-keten uit fase 4, wel de plek waar hij komt te staan. Mobiel: één scherm met de bestaande `EngineReadCard`, de gewichtstrend en de slaaptrend. Web: dezelfde kop, daaronder de volledige cockpit uit `PeriodCockpit.tsx`. **Zelfde kop, zelfde woorden, zelfde getallen** — verschil zit alleen in wat eronder hangt.

### Acceptatiecriteria fase 1 — "klaar als ik…"

- …op mijn telefoon en op mijn laptop dezelfde vier woorden onderaan of bovenaan zie staan, en op beide hetzelfde vind onder dezelfde naam.
- …niet meer hoef na te denken over waar iets staat.
- …in één oogopslag zie of alles gesynchroniseerd is, op elk scherm.
- …'s ochtends de app open en meteen op de Read-pagina beland, niet in een invoermenu.
- …geen dagelijkse verplichting meer voel om gewicht en slaap in te tikken.

### Test- en verificatiepoorten

- `mypens-verify-ship` PASS, plus **routing-controle**: elke oude route levert een geldige bestemming of een bewuste doorverwijzing op — geen enkel scherm mag onbereikbaar worden.
- **Parity-controle:** doorloop alle vier de bestemmingen op web en mobiel naast elkaar en noteer elk verschil in benaming. Nul verschillen toegestaan.
- **Tegenspraakcontrole:** laat een tweede beoordelaar (agent of jij op een andere avond) proberen een scherm te vinden dat níét via de vier bestemmingen bereikbaar is.

### Expliciet buiten scope in fase 1

Verdict-berekening · eten in de Read · doelen · visuele stijl (dat is fase 3 — deze fase gaat over structuur, en het mag er tijdelijk lelijk uitzien) · Dopamine Debt.

---

## FASE 2 — Eén waarheid

**Duur: 6–10 werkavonden (L). Dit is de zwaarste fase en de belangrijkste.**

### Doel in gewone taal

Er is nog maar één plek die rekent. Eten telt eindelijk mee in het oordeel over je week. Het Verdict blijft bestaan als stem, maar verzint geen cijfers meer. En als je zegt dat je in een cut zit, verandert de app daadwerkelijk je voedingsdoelen en je trainingsplan.

### Waarom deze volgorde

Nu de schermen op hun plek staan, kun je de motoren erachter samenvoegen zonder dat je halverwege niet meer weet waar iets landt. En dit moet vóór de visuele fase, omdat een mooie schil over drie tegenstrijdige motoren de tegenstrijdigheid alleen maar overtuigender maakt.

### Work packages

---

**WP 2.1 — Voeding in de dagkern en in de vensterkern** *(L)*

Dit is de kern van de fase.

*Bouwen/wijzigen:*
- `scripts/lib/periodAnalyze.mjs`: `buildDailySignals()` uitbreiden met voedingsvelden per dag — kcal in, eiwit, koolhydraten, vet, dekkingsvlag, en het energiesaldo uit `getDayEnergyBalance()`.
- `lib/engines/cockpitData.ts`: `CockpitDay` uitbreiden met diezelfde velden, zodat `/api/period-review` ze meelevert.
- `scripts/lib/periodCausal.mjs`: voeding toevoegen als kandidaat-oorzaak en als confounder. Hier zitten de echte verbanden die je zoekt: energiesaldo tegen gewichtsverandering, koolhydraten tegen retentie, avondeten tegen slaapkwaliteit, alcohol tegen rust-hartslag (de rust-hartslag-drankband bestaat al in `classifyRhrDrinkBand`).
- Prestatiewaarschuwing: `cockpitData.ts` roept `loadGarminData(prisma, { allTime: true })` aan. Voeding er ongefilterd bij trekken maakt dat traag. Bouw het vensterbeperkt.

*Data of UX:* zuiver data-engine.
*Parity:* één API, beide clients profiteren.

---

**WP 2.2 — Verdict wordt rendering** *(M)*

*Wijzigen:* `app/api/verdict/route.ts` wordt gestript van alle eigen berekening en gaat de vensterkern bevragen.

- **Nutrition** komt uit werkelijke voedingsdata: dekking (hoeveel dagen gelogd), energiesaldo ten opzichte van het doel, eiwit ten opzichte van het doel. Alcohol en zware maaltijden blijven bestaan als *context*, niet meer als de volledige berekening. Bij minder dan bijvoorbeeld vier gelogde dagen: geen score, maar "onvoldoende gelogd".
- **Performance** gaat de trainingsbelasting uit de dagkern gebruiken (alle bronnen, inclusief Garmin) in plaats van alleen het aantal dagen met een handmatige `TrainingEntry`.
- **Sleep** gebruikt alleen nachten met een echte kwaliteitsmeting (volgt uit WP 0.2, punt 3).
- **Endurance** mengt slaap en trainingsfrequentie én **telt slaap/training dubbel** mee (slaap zit al in Sleep, training al in Performance; de auditor-toon middeleert over vier pilaren). Dat is de echte reden om Endurance te schrappen — niet omdat het "een vulmiddel" is. Drie eerlijke pilaren zonder dubbele weging zijn beter. P.E.N.S. als letterwoord sneuvelt; dat is een bewuste prijs.
- **Naamconflict oplossen:** `read.verdict` (good/mixed/bad in de cockpit) en de Verdict-pagina heten nu allebei "verdict". Hernoem het cockpit-veld naar iets als `tone` of `readSignal`.

---

**WP 2.3 — Doel (cut / bulk / recomp) dat écht stuurt** *(L)* — **verplaatst uit fase 2**

> **S2:** Dit is de enige WP in de oude fase 2 die een *nieuwe productfunctie* bouwt (model, afgeleide doelen, planner, fasewissel). Fase 2 heet "Eén waarheid" en moet bronnen samenvoegen — niet een faseknop bouwen. **Landt in fase 2.5 of aan het begin van fase 4** (ingreep-en-bewijs). Fase 2 zonder 2.3: 4–6 avonden.

Het bestaat vandaag niet: in het schema staan `Goal` (module, metricKey, targetValue) en `PlannerGoal` (kind: vo2max, bodyfat, marathon, custom) — nergens een fase-begrip. En de voedingsdoelen op de mobiele Fueling-tab staan hard op 2000/150/200/70 met het onderschrift *"Not a diet target — only soft context for the planner."* Dat is precies het theater dat je wilt vermijden.

*Bouwen/wijzigen (wanneer fase 2.5 / 4 start):*
1. Nieuw model of uitbreiding van `PlannerGoal`: een expliciete **fase** (`cut | bulk | recomp | maintain`), met begindatum, streeftempo (kg per week) en een verwachte einddatum.
2. **Afgeleide voedingsdoelen**, niet handmatig getikt: kcal-doel volgt uit de onderhoudsschatting van de energiemotor (BMR + EAT + NEAT, met de gewichtskalibratie uit `energyWeightCalibration.ts`) plus of min het fasetempo. Eiwit volgt uit lichaamsgewicht en fase (in een cut hoger). Deze doelen zijn zichtbaar afgeleid en tonen hun herkomst.
3. **Planner-parameters volgen de fase:** in een cut verschuift de nadruk naar behoud van kracht en meer laag-intensieve arbeid; in een bulk naar progressieve overbelasting. Concreet in `app/api/planner` en `prisma PlannerWeek.planJson`. Hoe geavanceerd dit wordt, is aan jou — maar de regel is: **als het schema niet zichtbaar verandert wanneer je van fase wisselt, dan mag de faseknop niet bestaan.**
4. Fasewissel is een gebeurtenis met een datum, zodat de Read hem later als verklaring kan gebruiken ("gewicht vlak sinds de overgang naar recomp op 14 juni").

*Acceptatie-detail:* zet de fase van cut naar bulk en er moeten minstens drie dingen zichtbaar veranderen: kcal-doel, eiwitdoel, en de weekstructuur van de planner.

---

**WP 2.4 — Weekvolume opnieuw, nu uit de kern** *(S/M)*

Nu WP 2.1 klaar is: de weekgrafiek op de Train-bestemming komt uit de dagkern, met alle bronnen, maandag-weken, datumlabels, en een expliciete scheiding tussen "tonnage uit gelogde sets" en "belasting uit alle sessies". Twee grootheden, twee grafieken, of één grafiek met een schakelaar — maar nooit één balk die stiekem maar één bron bevat. De rechtstreekse Supabase-leesactie in `mypens-mobile/app/(tabs)/training.tsx` verdwijnt.

---

**WP 2.5 — Ware gewicht en retentie bevriezen** *(M)*

`lib/retentionModels.ts` en `lib/enrichWeightSeries.ts` bestaan. Kies één model, leg het vast, documenteer het in één alinea, en verander het daarna niet meer zonder expliciete beslissing. Reden: als het model waarmee je "ware gewicht" berekent blijft schuiven, is elke trendvergelijking over de tijd onzin. Bevriezen betekent hier: één functie, één plek, een versienummer in de uitvoer, en een aantekening bij elke wijziging.

### Acceptatiecriteria fase 2 — "klaar als ik…"

- …een week met slecht eten in het Verdict terugzie, ook als ik geen enkele tag heb aangeklikt.
- …een week zonder gelogd eten "onvoldoende data" zie tonen, niet een score van 70.
- …mijn doel op cut zet en meteen zie dat mijn kcal-doel, eiwitdoel en weekplan veranderen.
- …in de Read kan zien dat mijn gewicht stilstaat *omdat* mijn energiesaldo de laatste tien dagen rond nul lag — dat verband staat er, in plaats van dat ik het zelf moet leggen.
- …niet meer twee verschillende antwoorden krijg op de vraag "hoe was mijn week".
- …weet dat wanneer ik "ware gewicht" zie, dat volgende maand nog met dezelfde formule berekend is.

### Test- en verificatiepoorten

- `mypens-verify-ship` PASS.
- **Kruiscontrole per dag:** kies drie echte datums en vergelijk kcal in, kcal uit, belasting en slaapuren tussen de Fueling-pagina, de Read en het Verdict. Alle drie moeten identiek zijn. Dit is de belangrijkste test van de hele roadmap.
- **Dekkingstest:** maak een venster met opzettelijk ontbrekende voedingsdagen en controleer dat er geen score verschijnt.
- **Faseschakeltest:** wissel cut → bulk → recomp en leg per stap vast wat er veranderde. Verandert er niets, dan is WP 2.3 niet klaar.
- **Tegenspraakronde:** laat een beoordelaar expliciet zoeken naar een scherm dat nog zelf rekent. Zoektermen: `reduce(`, `Math.round(` en `/ 7` in componentbestanden.

### Expliciet buiten scope in fase 2

Visuele stijl · Dopamine Debt · nieuwe grafieksoorten · alles wat het aantal getallen op het scherm vergroot.

---

## FASE 3 — De Continental-schil, echt

**Duur: 4–6 werkavonden (M).**

### Doel in gewone taal

De app krijgt de uitstraling die je voor ogen had — maar alleen op schermen die daadwerkelijk iets doen. Geen enkel scherm mag mooi zijn en leeg tegelijk.

### Waarom deze volgorde

Stijl na waarheid. De componenten staan er al (`mypens-mobile/components/continental`, `constants/continental`, `app/design/continental`), maar ze worden nu ook gebruikt om lege hulzen te bekleden — `dopamine-debt.tsx` is een Continental-scherm met een chip waarop "Shell" staat. Een verzorgde presentatie van niets is erger dan een lelijke presentatie van iets, omdat je jezelf gaat geloven.

### Work packages

**WP 3.1 — Huls-inventarisatie** *(S).* Loop elk scherm langs en categoriseer: echt (leest live data), gedeeltelijk (deels statisch), huls (volledig statisch). Bekende hulzen: `dopamine-debt.tsx`, delen van de Audit-chips, delen van `app/mockups`. Uitkomst is een lijst met per scherm één van drie besluiten: afmaken, verbergen, verwijderen.

**WP 3.2 — Hulzen verbergen of verwijderen** *(S).* Alles op de lijst dat niet in fase 3 wordt afgemaakt, gaat uit de navigatie. Dopamine Debt uit de Audit-hub. Geen "shell"-etiketten meer in de gebruikersinterface — als je een etiket nodig hebt om te zeggen dat iets niet werkt, hoort het er niet te zijn.

**WP 3.3 — Continental toepassen op de vier bestemmingen** *(M).* Consistente typografie, kleur, ruimte en toon over Fueling, Train, Read en Audit, op web en mobiel. De componentenbibliotheek in `components/continental` wordt de enige bron van stijl; losse `StyleSheet.create`-blokken met eigen kleuren verdwijnen geleidelijk.

**WP 3.4 — Lege staten in de stijl** *(S).* Elke lege staat uit fase 0 krijgt de Continental-behandeling: een nette, expliciete mededeling met één handeling. Leegte hoort er verzorgd uit te zien, niet als een fout.

**WP 3.5 — Toon één keer vastleggen** *(S).* De auditor-stem staat nu verspreid over `pillarsComment()`, `buildHeadline()`, `buildAuditorNote()` in de Verdict-route en over losse teksten in `lib/explanationCopy.ts`. Eén tekstenbestand, één stem. En één regel: **de toon mag streng zijn, het cijfer eronder moet waar zijn.**

### Acceptatiecriteria fase 3 — "klaar als ik…"

- …door de hele app kan lopen zonder een scherm tegen te komen dat mooi is maar niets doet.
- …het woord "shell" nergens meer zie.
- …een lege dag open en dat er iets verzorgds staat dat me vertelt wat er ontbreekt.
- …de app aan iemand kan laten zien zonder ergens "dit werkt nog niet" te hoeven zeggen.

### Poorten

`mypens-verify-ship` PASS · **huls-controle**: elk scherm in de navigatie doet minstens één netwerkverzoek of toont minstens één opgeslagen waarde · visuele doorloop op beide platforms · geen nieuwe getallen toegevoegd tijdens deze fase (stijlfases zijn berucht om het binnensmokkelen van nieuwe cijfers).

### Buiten scope

Elke data- of engine-wijziging. Als je tijdens fase 3 een fout in de cijfers vindt: noteren, niet repareren, meenemen naar een fase-2-nabrander.

---

## FASE 4 — Signaal → oorzaak → plan → bewijs

**Duur: 6–10 werkavonden (L).**

### Doel in gewone taal

De app zegt niet alleen wat er gebeurde, maar waarom, wat je eraan doet, en of het gewerkt heeft. Dat laatste is het stuk dat overal ontbreekt.

### Waarom deze volgorde

Dit kan pas als voeding, training, slaap en gewicht in dezelfde motor zitten (fase 2) en er een plek is om het te tonen (fase 1). En het is de enige fase die de app werkelijk van "logboek" naar "assistent" tilt — dus hij moet af, niet half.

### Work packages

**WP 4.1 — Signaaldetectie** *(M).* Een expliciete lijst detecteerbare signalen boven op de vensterkern: gewicht stagneert terwijl het saldo negatief is · slaap onder de norm gedurende meerdere nachten · rust-hartslag verhoogd ten opzichte van de basislijn · trainingsbelasting sterk gestegen of ingezakt · eiwit structureel onder het doel · dekking van de log verslechtert. Elk signaal heeft een naam, een drempel, en een venster. **Drempels staan in één configuratiebestand, niet verspreid in de code.**

**WP 4.2 — Oorzaakkandidaten met bewijs** *(L).* Bij elk signaal een geordende lijst van kandidaat-oorzaken uit de causale laag, elk met de onderliggende cijfers zichtbaar. Verplicht element: **hoe zeker is dit**, met daarbij het aantal dagen waarop de conclusie rust. Even verplicht: **wat we niet weten** — als er drie dagen aan voeding ontbreken in het venster, staat dat erbij.

**WP 4.3 — Van oorzaak naar plan** *(M).* Elke oorzaak heeft één voorgestelde ingreep, met een verwachte richting en een termijn. Die ingreep wordt vastgelegd met een datum, want zonder registratie is er geen bewijsstap. Koppelen aan de planner en aan de voedingsdoelen uit WP 2.3.

**WP 4.4 — De bewijsstap** *(M).* Na de afgesproken termijn: is het signaal veranderd in de voorspelde richting? Ja, nee, of niet te zeggen wegens gebrek aan data. Dit is de enige eerlijke terugkoppellus in de app en het onderscheidt hem van elk ander logboek. Bewaar de uitkomst — na een half jaar heb je een geschiedenis van wat bij jou wél en niet werkt.

**WP 4.5 — De weekcyclus** *(M).* Eén vast moment per week (er bestaat al `scripts/weekly-feedback.mjs` en `app/weekly-feedback`) dat de vier stappen doorloopt: wat gebeurde er, waarom waarschijnlijk, wat doen we, en wat werd er van het vorige plan waar. Op web diep, op mobiel als samenvatting van vier regels.

### Acceptatiecriteria fase 4 — "klaar als ik…"

- …op zondagavond in vier regels lees wat er deze week gebeurde, wat waarschijnlijk de oorzaak was, wat we gaan doen, en of het vorige plan gewerkt heeft.
- …bij elke bewering kan doorklikken naar de cijfers eronder.
- …zie staan wanneer er te weinig data is om iets te beweren, in plaats van een beleefde gok.
- …over drie maanden kan terugkijken op welke ingrepen bij mij daadwerkelijk iets deden.

### Poorten

`mypens-verify-ship` PASS · **elke bewering is aanklikbaar** naar de onderliggende cijfers, zonder uitzondering · **onzekerheidscontrole**: kunstmatig een venster met gaten aanbieden en controleren dat het systeem zijn mond houdt in plaats van te gokken · **tegenspraakronde**: laat een beoordelaar proberen een bewering te vinden die niet door data wordt gedragen.

### Buiten scope

Machine learning · voorspellingen verder dan één week · Dopamine Debt · alles wat een nieuwe samengestelde score introduceert.

---

## FASE 5 — Dopamine Debt, écht (optioneel, alleen op jouw teken)

**Duur: 5–8 werkavonden (L). Start pas als fase 4 draait.**

### Doel

Van statische suggestielijst naar een echt grootboek van verlangen en weerstand. Vandaag is het: `mypens-mobile/app/dopamine-debt.tsx` met een vaste tabel van negen suggesties (energie laag/midden/hoog × 15/45/90 minuten), en chips die zelf melden dat de ledger een huls is. Er is een `CravingEvent`-model en er is een router-prototype (`prototypes/dopamine_router.html`). De dubbele korte/lange grafiek waar je naar zocht **bestaat niet in de code** — noch op web, noch op mobiel. Ik heb het hele project doorzocht; het zit in het ontwerp (`docs/design/continental/06-dopamine-debt.html`) en in de plannen, niet in de app.

### Wat er nodig zou zijn

1. **Vastleggen van gebeurtenissen:** `CravingEvent` daadwerkelijk vullen — moment, trigger, intensiteit, wat je deed, hoe het afliep. Zonder een paar honderd rijen is elke grafiek versiering.
2. **Twee tijdschalen:** de korte curve (verlangen binnen de dag, hoe lang een aanval duurt en hoe hij afneemt) en de lange curve (het patroon over weken). Dat is vermoedelijk wat je zocht met "short/long graph".
3. **Verbinding met de rest:** verlangen tegen slaap, tegen alcohol, tegen trainingsbelasting, tegen energiesaldo. Anders is het een tweede app in dezelfde app.
4. **De router:** de bestaande suggestietabel wordt pas zinvol wanneer hij kiest op grond van jouw eigen historie, niet op grond van een vaste tabel.

**Randvoorwaarde:** dit gaat pas gebouwd worden als je minstens vier weken lang echt gebeurtenissen registreert. Anders bouw je fase 5 twee keer. Tot dan blijft Dopamine Debt buiten de navigatie.

---

## Dwars door alle fases — de waarheids- en tegenspraakpoort

Je vraagt om strengere productpoorten dan alleen `tsc`. Dit is de opzet. Bouwen in WP 0.8, daarna verplicht bij elke oplevering.

### Nieuwe vaardigheid: `mypens-truth-check`

Draait naast `mypens-verify-ship`, niet in plaats daarvan. Deels automatisch, deels een gestructureerde beoordeling door een tweede agent.

**Automatische controles** (script, faalt hard):

| # | Controle | Hoe |
|---|---|---|
| T1 | Geen engine-rekenwerk in components | Alleen rekenwerk op velden uit een API-responstype, of een expliciet `allowlist`-bestand. **Niet** elke `/` of `*` in grafieklayout (S3 — oude literal-scan was onhoudbaar) |
| T2 | Score zonder dekking | Elk pad dat een score teruggeeft moet een dekkingsveld meesturen; ontbreekt dat, dan falen |
| T3 | Lege staat ontbreekt | Elk scherm dat een lijst of aggregatie toont moet een aantoonbaar leeg-geval hebben |
| T4 | Jargon-controle | Woordenlijst uit deel E; elk verboden woord dat buiten een uitleg-component staat, faalt |
| T5 | Parity | De ruggengraat-definitie uit WP 1.1 moet op beide platforms identieke labels opleveren |
| T6 | Dubbel leespad | Elk rechtstreeks `supabase.from(...)`-gebruik in de mobiele app naast een bestaand API-endpoint faalt |
| T7 | Huls | Elk scherm in de navigatie moet minstens één gegevensbron aanroepen |
| T8 | Datumidentiteit | `toISOString().slice(0,10)` / lokale `nDaysAgo` buiten `lib/timeWindow.*` faalt hard op kritieke lanes (verdict, dashboard, energy, mode, sleep, streaks, mobile cockpit/training/food) |

**Tegenspraak-beoordeling** (tweede agent, aparte context, mag de bouwer niet geloven). De opdracht luidt letterlijk: *"Zoek het duurste onwaarheidje in deze wijziging. Aannemen dat de bouwer zichzelf gunstig beoordeeld heeft."* Vaste vragen:

1. Welk getal op het scherm kan de gebruiker niet herleiden tot een bron?
2. Welke score verschijnt terwijl de invoer ontbreekt?
3. Welk scherm ziet er af uit maar doet niets?
4. Waar tonen web en mobiel voor dezelfde dag een ander cijfer?
5. Wat zou een sceptische buitenstaander na twee minuten als eerste ontmaskeren?
6. Wat beweert deze wijziging in de commit-tekst dat niet blijkt uit de code?

De uitkomst is een lijst met bevindingen, elk geclassificeerd als blokkerend, te repareren, of geaccepteerd-met-reden. **Blokkerend betekent: niet opgeleverd.**

### Haak

Uitbreiding van de bestaande stop-haak (`.cursor/hooks/mypens-verify-on-stop.mjs`): wanneer myPENS-paden vuil zijn, draait naast de mobiele `tsc` ook `mypens-truth-check`. Bij falen een luide vervolgmelding, geen stille doorgang.

### Regel voor mij en elke andere agent

Nooit "klaar" of "verzonden" zeggen zonder een geslaagd verificatierapport in het antwoord, en bij mobiele wijzigingen zonder herbouwde en geïnstalleerde APK. Bij falen: het rapport tonen, niet herformuleren.

---

## E. Jargon-woordenboek voor de gebruikersinterface

Drie besluiten per term: **tonen** (mag blijven zoals het is), **hernoemen** (nieuwe naam) of **uitleggen** (mag blijven mits er een uitleg naast staat). Termen zonder besluit horen niet op het scherm.

| Term | Wat het werkelijk is | Besluit | Wat de gebruiker ziet |
|---|---|---|---|
| **PLU** | Minuten × sportgewicht × HR-intensiteit, `trainingLoad.mjs` | Hernoemen op primaire schermen, uitleggen in de uitklap | "Belasting" — met uitleg: *"schatting van hoe zwaar een sessie was: duur, sportsoort en hartslag samen"* |
| **Hard load** | Som van belasting van niet-wandel/hike/cardio-sessies | Hernoemen | "Zware sessies" |
| **Easy load** | Wandelen, hiken, cardio | Hernoemen | "Rustige beweging" |
| **Peak** | Hoogste dagbelasting in het venster | Hernoemen | "Zwaarste dag" — mét de datum erbij |
| **Volume** | Sets × reps × kg, alleen handmatige sets | Hernoemen en afbakenen | "Getilde tonnage (alleen handmatig gelogde sets)" |
| **Tonnage** | Zelfde als volume | Kies één woord | Gebruik "tonnage", schrap "volume" volledig |
| **EAT** | Calorieën uit gelogde sessies | Uitleggen | "Verbrand tijdens sessies" |
| **NEAT** | Geschatte dagelijkse beweging uit stappen of het actieve-calorie-residu | Uitleggen én markeren als schatting | "Overige dagelijkse beweging (geschat)" |
| **BMR** | Rustverbranding uit gewicht en profiel | Uitleggen | "Rustverbranding (geschat)" |
| **Delta** | Eten min (BMR + EAT + NEAT) | Hernoemen | "Saldo" — positief is overschot, negatief is tekort, en dat staat erbij |
| **incompleteCapture** | Vlag: sessies zonder calorieën, of eten deels gelogd | Uitleggen, prominent | "Onvolledige dag" met de reden erbij |
| **True weight** | Gewicht gecorrigeerd voor retentie | Uitleggen, model bevriezen | "Gecorrigeerd gewicht" met uitleg van de correctie |
| **Retention** | Geschat vochtverschil | Uitleggen | "Geschat vocht" |
| **Form score** | Samengesteld uit slaap, HRV, rust-hartslag, belasting | Uitleggen of verwijderen | Ofwel volledige uitleg met de ingrediënten, ofwel weg tot fase 4 |
| **Quality 1–5** | HRV-banden; **3 zonder HRV** | Repareren (WP 0.2) en uitleggen | "Kwaliteit uit HRV" of "niet gemeten" — nooit een verzonnen 3 |
| **P.E.N.S.** | Vier pilaren waarvan Nutrition tag-gebaseerd is | Herbouwen in fase 2; Endurance mogelijk schrappen | Alleen tonen wat op echte data rust |
| **Verdict** | Twee betekenissen: de pagina met scores, en `read.verdict` good/mixed/bad | Hernoemen | "Verdict" blijft de pagina; het cockpit-veld wordt "toon" of "signaal" |
| **The Read** | Vensteranalyse met oorzaken | Tonen | Blijft "The Read" — het is een eigen naam, geen jargon |
| **Mode / Locked In / Balanced / Off** | Dagintentie plus wegingsfactor in Verdict | Uitleggen | Zichtbaar maken dat de modus het oordeel beïnvloedt, en met hoeveel |
| **Dopamine debt** | Statische suggestielijst | Verbergen | Uit de navigatie tot fase 5 |
| **HRrust 50 / HRmax 185** | HRrust: per-dag Garmin `resting_hr` met fallback 50; HRmax 185 hardgecodeerd | Uitleggen; HRmax instelbaar maken | In de uitleg tonen; **alleen HRmax** nog afleiden/instellen — HRrust-pad bestaat al |

---

## F. Risico's en valkuilen

**R0 — DB-bereikbaarheid is een voorwaarde, geen aanname.** (Hoogste prioriteit.) Op 2026-07-18 weigerde de Supabase-pooler de tenant. Elke export/migratie-avond begint met **één connectietest** (`SELECT 1` + row counts). Faalt die: eerst credentials, dan pas schema. Geen mislukking — dat ís stap 1.

**R1 — Alleen op mobiel opleveren.** De grootste productrisico. Elke wijziging die alleen mobiel landt, vergroot de kloof en maakt fase 2 duurder. *Tegenmaatregel:* de parity-controle in de waarheidspoort; geen oplevering zonder web-tegenhanger of een expliciet genoteerde uitzondering met datum.

**R2 — Nieuwe scoretaal introduceren.** De verleiding tijdens fase 4 om nog een samengesteld getal te maken ("Recovery Index", "Consistency Score") is enorm. Elke nieuwe score is een nieuwe leugen om uit te leggen. *Tegenmaatregel:* principe P8 is blokkerend in de tegenspraakronde.

**R3 — Hulzen in de Audit-hub.** Audit wordt de plek waar alles heen gaat wat nergens past. Daarmee wordt het een tweede tegelmuur. *Tegenmaatregel:* de huls-controle T7 geldt ook binnen Audit; elk item in de hub toont een echt cijfer of verdwijnt.

**R4 — De APK-embed-val.** De JavaScript zit in de APK. Een fix zonder herbouw bestaat niet op je telefoon en leidt tot een uur zoeken naar een fout die al opgelost was. *Tegenmaatregel:* de bestaande APK-poort in `mypens-verify-ship`, en de stempel na installatie.

**R5 — Stilzwijgend gegevensverlies bij WP 0.2.** Het schrijfpad van slaap veranderen kan bestaande rijen overschrijven. *Tegenmaatregel:* exporteer `SleepEntry` vóór de migratie; test eerst het bijwerkpad op één datum.

**R6 — Fase 2 wordt eindeloos.** Voeding in de causale laag is de meest open klus in de hele roadmap; daar kun je maanden in verdwijnen. *Tegenmaatregel:* WP 2.1 levert alleen de *velden* en drie *vaste* verbanden. Meer verbanden zijn fase 4, niet fase 2.

**R7 — Twee schrijvende clients voor Health Connect.** De React Native-sync en de Kotlin-companion kunnen allebei dezelfde endpoints aanroepen. Dat geeft dubbele of tegenstrijdige rijen. *Tegenmaatregel:* kies er één in fase 0 en schakel de ander expliciet uit; noteer die keuze.

**R8 — Rechtstreeks lezen uit Supabase naast de API.** Bestaat vandaag in Training en Sleep. Dat is de bron van "op mijn telefoon staat iets anders dan op mijn laptop". *Tegenmaatregel:* controle T6.

**R9 — Prestaties.** `cockpitData.ts` laadt Garmin-data met `allTime: true`. Daar voeding aan toevoegen zonder venster maakt de Read traag, en een trage Read wordt niet gebruikt. *Tegenmaatregel:* meet de responstijd van `/api/period-review` vóór en na WP 2.1; boven de twee seconden is het niet klaar.

**R10 — De faseknop als theater.** Als cut/bulk/recomp erin komt zonder dat er iets meetbaar verandert, heb je precies het probleem verplaatst dat je bij Verdict Nutrition hebt opgelost. *Tegenmaatregel:* het acceptatiecriterium van WP 2.3 is dat er drie zichtbare dingen veranderen. Geen drie dingen, geen knop.

**R11 — Stijl vóór waarheid.** Fase 3 vóór fase 2 doen voelt bevredigender en is een val. Een verzorgde presentatie van tegenstrijdige cijfers is overtuigender en dus schadelijker dan een lelijke.

**R12 — Alles tegelijk willen.** Fase 0 heeft in zijn eentje al meer dagelijks effect dan fase 3 en 4 samen. Als de energie halverwege opraakt, is fase 0 plus 1 een geldige eindtoestand van deze ronde.

---

## G. De eerste 72 uur — exacte startvolgorde

Ingedeeld volgens jouw ritme: 's ochtends op de telefoon beslissen, 's avonds op de laptop uitzoeken. Geen code voordat de diagnose er ligt.

### Maandagochtend — telefoon, 10 minuten, alleen waarnemen

1. Open de app zoals altijd. **Niets repareren.** Noteer in je telefoonnotities elk moment waarop je denkt "hè?".
2. Ga naar de Sleep-tab, tik één keer op **Sync**, en schrijf de exacte statusregel over. Die tekst bepaalt welke tak van WP 0.1 je 's avonds neemt: `0 new · N already logged` betekent hypothese 2 (de server slaat over), een foutmelding betekent hypothese 3 of 5, en `No sleep sessions in HC` betekent dat het aan de Health Connect-kant zit.
3. Kijk of de nacht van gisteren nu in de lijst staat. Ja of nee.
4. Ga naar Training en noteer wat er in de kilo-grafiek staat voor de laatste week. Klopt dat met wat je werkelijk deed?

### Maandagavond — laptop, twee tot drie uur

5. Zet de repo op een schone tak, bijvoorbeeld `revisie/fase-0`.
5a. **R0 — connectietest.** `SELECT 1` + `SleepEntry`/`TrainingEntry` counts. Faalt die: credentials repareren; export schuift. Geslaagd op 2026-07-26 (pooler OK).
6. Exporteer `SleepEntry` en `TrainingEntry` naar een bestand buiten de repo. Dat is je vangnet voor de migratie.
6b. **WP 0.9** (vensterfunctie) + **WP 0.8** eerste poorten/T8 — vóór verdere getalwijzigingen.
7. Bouw **WP 0.1** in zijn geheel: het diagnose-endpoint plus de uitgebreide statusregel in de mobiele kaart. Dit is bewust klein.
8. Herbouw de APK en installeer met `adb install -r`. Zet de stempel `mypens-mobile/docs/.verify_apk_rebuilt`.
9. Draai `mypens-verify-ship`. Plak het rapport in je aantekeningen.

### Dinsdagochtend — telefoon, 5 minuten

10. Open de app, tik op Sync, lees het uitgebreide rapport: gelezen / opgeslagen / overgeslagen / eerste datum / laatste datum / laatste fout.
11. **Nu weet je welke hypothese uit A.3 het is.** Schrijf hem op. Dit is het beslismoment van de hele fase 0.

### Dinsdagavond — laptop, drie tot vier uur

12. Bouw **WP 0.2** volgens de vastgestelde hypothese. Doe hoe dan ook de vier standaardonderdelen: automatische sync bij openen, bijwerken in plaats van overslaan (met `source` en `externalId` op `SleepEntry`), geen verzonnen kwaliteit, en de zichtbare syncstatus.
13. Migratie draaien op een kopie eerst, dan pas echt.
14. Terugkeertest: verwijder één Health Connect-nacht, sync, controleer dat hij terugkomt. Werk daarna dezelfde nacht handmatig bij en controleer dat de sync hem met rust laat.
15. APK herbouwen, installeren, `mypens-verify-ship` draaien.

### Woensdagochtend — telefoon, 3 minuten

16. Open de app en doe **niets**. De slaap van vannacht hoort er te staan. Zo niet, dan is fase 0 nog niet begonnen en herhaal je dinsdagavond.

### Woensdagavond — laptop, twee tot drie uur

17. **WP 0.4** (jargon) en **WP 0.5** (bronlabel bij de kilo's). Dit zijn kleine, zichtbare overwinningen die de rest van fase 0 lichter maken.
18. **WP 0.3** (lege staten voor EAT en NEAT) als er tijd over is; anders donderdag.
19. Start **WP 0.8**: de eerste drie automatische controles van de waarheidspoort. Ook al is het maar een script van vijftig regels — vanaf nu draait het mee.
20. APK, verificatie, rapport.

**Daarna:** WP 0.3, 0.6 en 0.7 afronden in de resterende avonden van die week. Fase 1 begint pas als elk acceptatiecriterium van fase 0 met ja beantwoord is — niet met "grotendeels".

### Wat je de eerste 72 uur beslist niet doet

Geen navigatie aanraken. Geen Verdict-formule aanpassen. Geen Continental-stijl. Geen doelen. Geen Dopamine Debt. Geen nieuwe grafieken. Als je halverwege dinsdagavond zin krijgt om de tabbalk te herbouwen: opschrijven, en fase 1 doen zoals gepland.

---

## Samenvattend overzicht

| Fase | Kern | Omvang | Voorwaarde om te beginnen |
|---|---|---|---|
| 0 | Bloeding stelpen: venster, poort, slaap, Verdict-bugs, lege staten, jargon, bronlabels, vindbaarheid | M · 6–9 avonden | R0 connectietest groen |
| 1 | Ruggengraat op web en mobiel tegelijk | M/L · 4–6 avonden | Alle acceptatiecriteria van 0 op ja |
| 2 | Eén waarheid: voeding in de kern, Verdict als rendering (zonder cut/bulk) | L · 4–6 avonden | Ruggengraat staat |
| 2.5 / 4-start | Doel cut/bulk/recomp (ex-WP 2.3) | L | Fase 2 kern klaar |
| 3 | Continental-schil, echt | M · 4–6 avonden | Cijfers kloppen |
| 4 | Signaal → oorzaak → plan → bewijs | L · 6–10 avonden | Eén waarheid draait |
| 5 | Dopamine Debt (optioneel) | L · 5–8 avonden | Vier weken echte gebeurtenissen vastgelegd |

Twee dingen die ik in deze roadmap heb **niet** gevonden en die dus geen aanname mogen worden: er is nergens een cut/bulk/recomp-begrip in de code, en er bestaat geen korte/lange dopamine-grafiek. Beide worden in deze roadmap als nieuwbouw behandeld, niet als reparatie.
