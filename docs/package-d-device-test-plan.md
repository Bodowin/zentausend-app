# Paket D – Geräte- und Abnahmetest

## Automatisch

- Alle bestehenden Unit-Tests.
- Identitätstests für Altformat, explizite IDs und Umbenennung.
- Statistiktests für Bestenliste, Form, Duell und Angstgegner.
- TypeScript- und Vite-Production-Build.

## Manuell auf einem Testgerät

1. Statistik vor der Änderung öffnen und Anzahl der Spieler merken.
2. Im Kader einen Stammspieler umbenennen.
3. Eine kurze Testrunde mit diesem Spieler beenden.
4. Prüfen, dass die Bestenliste weiterhin nur einen Eintrag für diese Person zeigt.
5. Form, Duell und Angstgegner öffnen und auf zusammengeführte Werte prüfen.
6. App neu laden und kontrollieren, dass Kadername und Statistik stabil bleiben.
7. Dasselbe Spiel auf einem zweiten Gerät über Cloud-Sync laden.
8. Backup exportieren und erneut importieren; Spieler-ID und Werte müssen erhalten bleiben.

## Nicht automatisch zusammenführen

Zwei verschiedene Namen ohne explizite Kader-Umbenennung bleiben getrennte Personen. Eine spätere Verwaltungsoberfläche darf diese nur nach ausdrücklicher Nutzerentscheidung verknüpfen.
