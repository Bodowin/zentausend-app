# Paket C – Implementierungsübersicht

Dieses Paket führt eine gemeinsame, abwärtskompatible Validierungsschicht für abgeschlossene Spiele ein.

## Enthalten

- Normalisierung reparierbarer Altformate.
- Quarantäne mit Originalinhalt und konkreten Fehlergründen.
- Recovery-Snapshots vor lokaler Bereinigung.
- Gemeinsame Prüfung für lokalen Verlauf, Backup und Cloud.
- Exportierbarer Datenprüfbericht.
- Sichtbare Hinweise im Statistik-Bildschirm.
- Unit-Tests und Verdrahtungstests.

## Nicht enthalten

- Keine automatische Zusammenführung historischer Spielernamen.
- Keine Einführung stabiler Spieler-IDs in alten Datensätzen.
- Keine Löschung von Quarantäne oder Recovery-Snapshots.
