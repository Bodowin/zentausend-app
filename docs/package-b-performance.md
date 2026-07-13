# Paket B – Start- und Laufzeit-Performance

Dieses Paket verschiebt schwere Module hinter echte Nutzeraktionen, ohne die Spielregeln oder Datenmodelle zu ändern.

## Ziele

- `cannon-es` erst laden, wenn der virtuelle Würfelmodus sichtbar wird.
- Statistik und Rundenanalyse erst beim Öffnen laden.
- Supabase-Code erst beim Cloud-Zugriff laden.
- Bildfreigabe erst beim Tippen auf „Teilen“ laden.
- Startbundle verkleinern und initiale JavaScript-Auswertung reduzieren.

## Absicherung

- Bestehende Unit-Tests.
- Production-Build mit dokumentierter Chunk-Aufteilung.
- Architektur-Test `src/performanceBoundaries.test.ts`, der statische Rückimporte schwerer Module verhindert.
