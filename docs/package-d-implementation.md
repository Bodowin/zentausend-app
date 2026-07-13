# Paket D – Implementierungsübersicht

Die Identitätsschicht bleibt bewusst klein und additiv:

1. `playerIdentity.ts` liefert deterministische Altformat-IDs, explizite Alias-Verknüpfungen und gemeinsame Auflösungsfunktionen.
2. Neue Spiele und Züge speichern die bereits im laufenden Spiel vorhandene Spieler-ID mit.
3. Der Validator erhält optionale IDs und verwirft ungültige optionale IDs, ohne ein sonst gültiges Spiel zu verlieren.
4. Sämtliche mehrspielbezogenen Statistiken aggregieren nach Identität und verwenden den neuesten bekannten Anzeigenamen.
5. Die Duell-Auswahl verwendet stabile IDs als technische Werte und Namen nur zur Anzeige.
6. Kader-Umbenennen ist die ausdrückliche Nutzeraktion, die alten und neuen Namen verbindet.
