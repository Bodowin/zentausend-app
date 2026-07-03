# 10.000 – Die Clique

Intelligenter Begleit-Rechner (Companion App) für das physische Würfelspiel
**Zehntausend** (Farkle, High-Stakes-Variante). Offline-fähige Progressive Web App.

> **Außerdem in diesem Repo:** das **Invest-Cockpit** unter `/cockpit` –
> ein eigenständiger Stock-Screener + Portfolio-Manager (siehe unten).

## Stack

- **Vite + React + TypeScript** – schnelles, typsicheres Fundament
- **Tailwind CSS v4** – Design-System per `@theme` in `src/index.css`
- **vite-plugin-pwa** – installierbar auf dem Homescreen, funktioniert offline
- Deployment-Ziel: **Vercel** (`vercel.json` enthalten)
- Daten: **offline-first localStorage** (Schema v3) + optionale **Supabase**-Cloud-Sync
  für die geteilte ewige Tabelle

## Entwicklung

```bash
npm install
npm run dev        # Dev-Server (http://localhost:5173)
npm run build      # Production-Build nach dist/
npm run preview    # Build lokal testen
```

## Projektstruktur

```
src/
  lib/
    scoring.ts   High-Stakes-Punktelogik (Drillinge, +1000-Regel, Straße, 3 Paare)
    risk.ts      Wahrscheinlichkeits-Engine (Szenario A: Basis, B: aktiver Pasch)
    storage.ts   localStorage-Verlauf v3 + ewige Bestenliste (Siege, Nieten)
    supabase.ts  Supabase-Client (Defaults eingebaut, per Env überschreibbar)
    cloud.ts     Cloud-Sync: Push beim Spielende, Pull + Merge in der Statistik
    database.types.ts  generierte DB-Typen
    types.ts     gemeinsame Typen
    haptics.ts   Vibrations-Feedback
  components/
    SetupScreen  Spielerwahl, Gäste, Event-Tagging
    GameScreen   Spielfeld, Würfel-Eingabe, Risiko-Meter, Aktionen
    StatsScreen  Ewige Bestenliste + Verlauf (nach Event filterbar)
    Icons        Inline-SVG-Icons
  App.tsx        Spielzustand, Runden-/Endspiel-Logik, einstufiger Undo
legacy/
  gemini-prototype.html   ursprünglicher Single-File-Prototyp (Referenz)
```

## Cloud-Sync (Supabase)

Die App funktioniert vollständig offline. Ist ein Supabase-Projekt hinterlegt
(Defaults sind eingebaut, überschreibbar via `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`, siehe `.env.example`), werden beendete Spiele in eine
geteilte Tabelle gepusht und die Statistik zieht alle Geräte zusammen.

- Tabelle `public.games`, Row-Level-Security aktiv
- Öffentlich **lesen**; **Einfügen** nur mit gültiger Datenform und gültigem
  **Clique-Code** (Header `x-clique-code`, einmalig pro Gerät einzugeben)
- **Löschen** nur mit dem geheimen **Admin-Code** (Header `x-admin-code`) –
  damit kann ausschließlich die Admin-Person Spiele aus der Tabelle entfernen
- Sync ist idempotent über die lokale Spiel-ID (`client_id`)
- Sicherheits-Backup: Statistik → „Backup sichern/laden" (JSON-Export/-Import)

Auf Vercel die beiden `VITE_SUPABASE_*`-Variablen unter *Settings → Environment
Variables* setzen (optional – ohne sie greifen die eingebauten Defaults).

## Invest-Cockpit (`/cockpit`)

Zweite, unabhängige App im selben Deployment (eigener Vite-Einstiegspunkt
`cockpit.html`, Code unter `src/cockpit/`). Design-System „Aurum –
Mitternachtsbörse“: tiefes Tinten-Navy, Champagner-Gold, Smaragd/Koralle für
Gewinn/Verlust; die Chart-Palette ist CVD-/Kontrast-validiert.

**Module**

- **Cockpit** – Depotwert, G/V, Verlaufs-Kurve (Wert vs. Einzahlungen),
  Allokations-Donut, Top/Flop, Watchlist-Scores
- **Portfolio** – Positionen (Durchschnittskosten aus Transaktionen),
  Käufe/Verkäufe, Sparpläne, Zinseszins-Projektion mit Slidern
- **Screener** – ~25 Aktien + 7 ETFs als editierbare Kennzahlen-Bibliothek
  (Beispieldaten, Stand ca. Mitte 2025), Qualitäts-Score (5 Teil-Scores,
  gewichtet nach Risikoprofil), Filter/Sortierung, Radar-Vergleich (bis 4 Titel)
- **DCF** – interaktiver Fair-Value-Rechner (Gordon + Exit-Multiple,
  Sensitivitätsmatrix WACC × ewiges Wachstum)
- **Risiko** – Diversifikations-Score, Sektor-/Regionen-Konzentration,
  Warn-Flags, Stress-Szenarien
- **Dividenden** – Ausschüttungs-Kalender (erwartete Zahlungen je Monat),
  Yield on Cost, editierbare Dividenden-Profile je Titel
- **Rebalancing** – Ziel-Allokation je Position, Order-Vorschläge wahlweise
  steuerschonend mit frischem Geld (keine Verkäufe) oder als Umschichtung
  inkl. Steuerkosten-Schätzung je Verkauf
- **Steuer** – deutsches Privatdepot/Interactive Brokers: Sparer-Pauschbetrag-
  Tracker, Abgeltungsteuer-Schätzung (Soli/Kirchensteuer), 30 % Teilfrei-
  stellung für Aktien-ETFs, Verlusttöpfe (Aktien vs. Sonstige), Vorabpauschale
  und automatisch abgeleitete Optimierungs-Tipps (Pauschbetrag ausschöpfen,
  Verlust-Ernte, Anlage-KAP-Rücklage)
- **Research** – 10 institutionelle Analyse-Prompts (Screening, DCF, Risiko,
  Earnings, Allokation, TA, Dividenden, Wettbewerb, Muster, Makro),
  automatisch mit Depot + Profil befüllt, zum Kopieren in Claude – plus
  **KI-Daten-Import**: Daten-Prompt kopieren, JSON-Antwort der KI einfügen,
  Kennzahlen/Kurse/Dividenden-Profile aktualisieren sich (neue Ticker werden
  angelegt)

**Daten**: komplett offline-first in `localStorage` (Export/Import als JSON).
Live-Kurse optional über die Vercel-Function `api/quote.ts`, historische
Kurs-Charts (6M/1J/5J/Max, im Aktien-Detail) über `api/history.ts` (beides
Yahoo Finance, EUR-Umrechnung bei Kursen) – lokal ohne Deployment werden Kurse
manuell gepflegt. Keine Anlage- oder Steuerberatung; alle Kennzahlen sind
editierbare Beispieldaten.

## Status & Roadmap

Umgesetzt: vollständige High-Stakes-Regeln, Wurf-für-Wurf-Spiel (Würfel
beiseitelegen & Rest weiterwürfeln, heiße Würfel), korrigierter Risiko-Rechner
(Szenario A + B, live an die Restwürfel gekoppelt), Fair-Play-Endspiel,
Nieten-Zählung, Event-Tagging, ewige Bestenliste, Undo, Haptik, PWA,
Supabase-Cloud-Sync.

Als Nächstes: Vercel-Deployment (einmalig verbinden) · optional „Clique-Code"
oder Login, falls die Tabelle stärker abgesichert werden soll.
