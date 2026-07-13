# Paket C – Geräte- und Datenabnahme

## 1. Bestehender Verlauf

1. Statistik öffnen.
2. Prüfen, dass alle bekannten Spiele weiterhin sichtbar sind.
3. Awards, Form, Tabelle und einzelne Analysen öffnen.

Erwartung: Kein sichtbarer Unterschied bei gesunden Daten.

## 2. Gültiges Backup

1. Aktuelles Backup exportieren.
2. Dasselbe Backup wieder importieren.

Erwartung: Keine Duplikate, keine Quarantäne und verständliche Importmeldung.

## 3. Reparierbares Altformat

Ein Test-Backup mit numerischer ID als Text, fehlenden `busts` oder falsch geschriebenem Sieger importieren.

Erwartung: Spiel wird importiert, Meldung nennt reparierte Datensätze und der Statistik-Bildschirm bietet einen Prüfbericht an.

## 4. Nicht rekonstruierbarer Datensatz

Ein Test-Backup mit leerem Spielerarray oder uneindeutigem Sieger importieren.

Erwartung: Das fehlerhafte Spiel erscheint nicht in der Statistik, wird aber im exportierbaren Prüfbericht vollständig mit Begründung aufgeführt.

## 5. Offline und Cloud

1. Statistik offline öffnen.
2. Wieder online gehen und Statistik erneut öffnen.

Erwartung: Lokaler Verlauf bleibt verfügbar; Cloud-Sync übernimmt nur validierte Datensätze und verändert keine gesunden Spiele.
