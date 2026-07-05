# Design brief — Dagplanner

## Context

Klikbaar mobile-first prototype (viewport 390px) van een dagplanner, geïnspireerd op de app **Structured**. Wordt later geïmplementeerd in **Next.js + Tailwind + Supabase** als uitbreiding van een bestaande PWA voor emotie- en motivatietracking.

- Nederlandse UI-teksten.
- Gebruik realistische voorbeelddata.

## Schermen

### 1. Tijdlijn (hoofdscherm)

- **Header:** "Juli 2026" met chevrons voor week terug en vooruit.
- **Week-strip:** 7 dagen (Z M D W D V Z) met dagnummer; geselecteerde dag is een gevulde koraal cirkel; onder elke dag maximaal 4 mini-dots in de taakkleuren van die dag.
- **Verticale tijdlijn:**
  - Per taak een gevulde cirkel-node in de taakkleur, verbonden met een gestippelde verticale connector.
  - Tijdlabel links van de node (starttijd, klein en gedimd).
  - Rechts van de node: tijdspanne met duur ("13:00 - 13:30 (30 min)") klein, daaronder de taaktitel groot en semibold.
  - Uiterst rechts een ronde checkbox in de taakkleur; afgevinkt = gevuld met vinkje, titel doorgestreept en gedimd.
  - **Nu-indicator:** dunne koraal horizontale lijn op de huidige tijd.
- **Floating action button** rechtsonder (koraal, plus), opent de taak-sheet.
- **Bottom nav:** Inbox, Tijdlijn (actief), Instellingen (placeholder, niet functioneel).

**Voorbeelddata:** Opstaan 07:30, Dagplanning maken 09:00 (15 min), Sporten 17:30 (1 uur), Naar bed 22:30.

### 2. Inbox

- Bovenaan een invoerveld "Nieuwe gedachte..." met plusknop; enter of plus voegt direct toe.
- Lijst van inbox-items: kleur-dot, titel, en per item een knop "Inplannen" die de taak-sheet opent met de titel voorgevuld.
- **Lege staat:** groot rond icoon, kop "Ongestructureerde gedachten", subtekst: "Vang taken en gedachten zodra ze opkomen. Verplaats ze naar je tijdlijn wanneer je klaar bent om te plannen."

### 3. Taak-sheet (bottom sheet, aanmaken en bewerken)

- **Header** in de gekozen taakkleur met live preview: groot titelveld (placeholder "Structureer je dag"), daarboven de tijdspanne die live meebeweegt.
- **Datumveld,** standaard vandaag.
- **Tijd:** starttijd-picker plus duur-presets als chips: 15m, 30m, 45m, 1u, 1u30, 2u; eindtijd wordt berekend en live getoond.
- **Kleurkiezer:** horizontale rij van 8 kleurcirkels, gekozen kleur krijgt een ring en kleurt de header direct mee.
- **Notitieveld** (optioneel, placeholder "Notities, links of telefoonnummers...").
- **Primaire knop** "Taak aanmaken", uitgeschakeld zolang de titel leeg is; in bewerkmodus "Bijwerken" plus een prullenbak-knop linksonder.

## Interacties

- Tik op een taak op de tijdlijn: sheet opent in bewerkmodus.
- Checkbox tikken: afvinken met een subtiele animatie.
- Dag tikken in de week-strip: wisselt de getoonde dag.
- Inbox "Inplannen": na opslaan verdwijnt het item uit de inbox en verschijnt het op de tijdlijn.
- FAB: sheet in aanmaakmodus.

## Bewust niet in dit prototype (fase 2 van het project)

Herhalende taken, iconen per taak, maandweergave, gap-nudges tussen taken, agenda-import, subtaken, en de koppeling met het emotie-kwadrant van de bestaande app.
