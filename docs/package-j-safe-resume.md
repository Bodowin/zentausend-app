# Paket J – Sichere Spielwiederaufnahme

## Problem

Ein bereits gespeichertes laufendes Spiel konnte bisher durch den Start eines neuen Spiels ohne zusätzliche Warnung überschrieben werden. Außerdem gab es bei einem beschädigten localStorage-Hauptwert keinen automatischen Rückfall auf einen älteren gültigen Stand.

## Lösung

- Vor jedem neuen Autosave wird der vorherige gültige Stand in einer Rotation von maximal drei lokalen Sicherheitskopien erhalten.
- Ist der Hauptstand vorhanden, aber beschädigt, wird die jüngste gültige Kopie automatisch wiederhergestellt und sichtbar gekennzeichnet.
- Fehlt der Hauptstand vollständig, wird keine Kopie reaktiviert. So bleibt bewusstes Verwerfen endgültig.
- Vor dem Start eines neuen Spiels muss zwischen Fortsetzen, Abbrechen und bewusstem Ersetzen gewählt werden.
- Das Verwerfen nutzt einen eigenen In-App-Dialog und löscht Hauptstand, Sicherungen und Diagnosekopie gemeinsam.
- Die Fortsetzen-Karte zeigt Runde, aktuellen Spieler, Punktestände und Speicherzeitpunkt.

## Abnahme

Unit-Tests prüfen Rotation, Wiederherstellung und endgültiges Verwerfen. Browser-Tests prüfen den Konfliktdialog und die sichtbare Wiederherstellung einer beschädigten Sitzung.
