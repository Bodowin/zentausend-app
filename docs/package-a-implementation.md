# Paket A – Implementierungsübersicht

## Behobene Stabilitätsrisiken

- Virtuelle Würfe speichern das unveränderliche Wurfergebnis im aktiven Spielstand.
- Nach Reload oder App-Neustart wird dasselbe Ergebnis erneut dargestellt; die Auswahl wird bewusst zurückgesetzt.
- Eine Niete wird sofort in Spielern, Zugverlauf und gespeichertem Spielstand verbucht. Das Banner dient nur noch der Geräteübergabe.
- Undo stellt auch bei virtuellen Würfen dasselbe vorherige Ergebnis wieder her.
- Der Würfelmodus kann vor einem virtuellen Wurf gewechselt werden, aber nicht während oder nach dem Wurf.
- Das Letzte-Chance-Banner zeigt den tatsächlichen Führungsstand.

## Cloud- und Offline-Verhalten

- Anlass-Änderungen werden lokal sofort gespeichert und in einer kleinen Retry-Warteschlange vermerkt.
- Bei normalen Duplikaten gewinnt die Cloud-Kopie; eine ausdrücklich ausstehende lokale Anlass-Änderung bleibt bis zur Bestätigung erhalten.
- Upload, Update und Löschen besitzen kurze Abbruchzeiten für schwaches Netz.
- Die Statistik zeigt offene Änderungen an und meldet erst bei leerer Warteschlange „synchronisiert“.
- Offline-Löschen wird nicht mehr nur optisch ausgeblendet und später überraschend wiederhergestellt.

## Qualitätssicherung

- Neue Unit-Tests prüfen aktive Spielstände und deterministische Cloud-Merges.
- Eine GitHub-Actions-CI führt auf Pull Requests `npm test` und den Production-Build aus.
- Das PWA-Manifest erlaubt Hoch- und Querformat; Browser-Zoom wird nicht mehr blockiert.
- Der Geräte-Testplan liegt unter `docs/package-a-device-test-plan.md`.
