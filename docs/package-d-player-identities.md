# Paket D – stabile Spieleridentitäten

## Ziel

Statistiken sollen eine Person nicht allein aufgrund einer sichtbaren Namensänderung aufteilen. Neue Spiele speichern deshalb zusätzlich zum Anzeigenamen eine stabile Spieler-ID.

## Kompatibilitätsregeln

- Alte Spiele ohne `playerId` bleiben unverändert lesbar.
- Für Altspiele wird aus dem normalisierten Namen eine deterministische Fallback-ID gebildet.
- Groß-/Kleinschreibung, führende Leerzeichen und Mehrfach-Leerzeichen erzeugen keine neue Person.
- Eine ausdrücklich vorgenommene Kader-Umbenennung verknüpft alten und neuen Namen mit derselben ID.
- Neue Spiele speichern `playerId` je Spieler und je Zug.
- Supabase benötigt keine Schemaänderung, da Spieler und Züge bereits als JSON gespeichert werden.
- Unterschiedliche echte Namen werden nicht automatisch zusammengeführt.

## Betroffene Auswertungen

- Ewige Bestenliste
- Aktuelle Form
- Direkter Vergleich
- Angstgegner
- Awards und Rekorde
- Siegesserien und Einzelzug-Rekorde

## Sicherheitsgrenze

Dieses Paket verändert keine historischen Datensätze massenhaft. Die Zuordnung erfolgt beim Lesen über stabile IDs und explizite Alias-Verknüpfungen. Eine spätere Verwaltungsoberfläche kann zusätzliche Namensvarianten kontrolliert zusammenführen, ohne die Originaldaten zu verlieren.
