# 10.000 – Die Clique

Intelligenter Begleit-Rechner (Companion App) für das physische Würfelspiel
**Zehntausend** (Farkle, High-Stakes-Variante). Offline-fähige Progressive Web App.

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
- Öffentlich **lesen**; **Einfügen** nur mit gültiger Datenform; **kein**
  Ändern/Löschen vom Client
- Sync ist idempotent über die lokale Spiel-ID (`client_id`)

Auf Vercel die beiden `VITE_SUPABASE_*`-Variablen unter *Settings → Environment
Variables* setzen (optional – ohne sie greifen die eingebauten Defaults).

## Status & Roadmap

Umgesetzt: vollständige High-Stakes-Regeln, korrigierter Risiko-Rechner
(Szenario A + B), Fair-Play-Endspiel, Nieten-Zählung, Event-Tagging, ewige
Bestenliste, Undo, Haptik, PWA, Supabase-Cloud-Sync.

Als Nächstes: Vercel-Deployment (einmalig verbinden) · optional „Clique-Code"
oder Login, falls die Tabelle stärker abgesichert werden soll.
