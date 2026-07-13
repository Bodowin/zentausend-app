# Paket E – Browser-End-to-End-Tests

## Ziel

Kritische Nutzerabläufe sollen nicht nur als isolierte Funktionen, sondern im gebauten React-PWA-Bundle in einem echten Chromium-Browser geprüft werden.

## Automatisierte Journeys

1. Zwei Spieler auswählen, Ziel und Einstieg konfigurieren und ein Testspiel starten.
2. Würfel eingeben, Punkte sichern, Niete verbuchen, Undo ausführen und eine angefangene Eingabe nach Reload fortsetzen.
3. Einen wiederhergestellten Spielstand beenden, die letzte Chance abwickeln und eine Revanche vorbereiten.
4. Ein JSON-Backup über den echten versteckten Datei-Input importieren und in der Statistik anzeigen.
5. Einen Stammspieler im Kader umbenennen und prüfen, dass die stabile Spieler-ID erhalten bleibt.

## Browserprofil

- Chromium
- mobiles Viewport 390 × 844
- deutsche Locale
- Service Worker im Test blockiert, damit kein alter PWA-Cache Ergebnisse verfälscht
- ein Worker für deterministische localStorage-Flows

## Fehlerdiagnose

Bei einem CI-Fehler werden Playwright-HTML-Bericht, Trace, Screenshot und Video als GitHub-Actions-Artefakt für sieben Tage gespeichert.

## Scope-Grenze

Supabase-Requests werden in diesem ersten Browserpaket nicht gegen die produktive Datenbank ausgeführt. Cloud-Merge, JSON-Schema und Offline-Queue bleiben durch Unit- und Integrationstests abgesichert. Ein eigener Preview-Supabase-E2E-Pfad kann später ergänzt werden, sobald eine isolierte Testdatenbank und rotierbare Testzugänge vorhanden sind.
