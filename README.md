# 10.000 – Die Clique

Intelligenter Begleit-Rechner (Companion App) für das physische Würfelspiel
**Zehntausend** (Farkle, High-Stakes-Variante). Offline-fähige Progressive Web App.

## Stack

- **Vite + React + TypeScript** – schnelles, typsicheres Fundament
- **Tailwind CSS v4** – Design-System per `@theme` in `src/index.css`
- **vite-plugin-pwa** – installierbar auf dem Homescreen, funktioniert offline
- Deployment-Ziel: **Vercel** (`vercel.json` enthalten)
- Daten: aktuell **localStorage** (Schema v3); Cloud-Sync via **Supabase** geplant

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

## Status & Roadmap

Umgesetzt: vollständige High-Stakes-Regeln, korrigierter Risiko-Rechner
(Szenario A + B), Fair-Play-Endspiel, Nieten-Zählung, Event-Tagging, ewige
Bestenliste, Undo, Haptik, PWA.

Als Nächstes: Deployment auf Vercel · Supabase-Anbindung für geräteübergreifende
Cloud-Synchronisation der ewigen Tabelle.
