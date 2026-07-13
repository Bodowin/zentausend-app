# Paket F – Spielerprofile verwalten

## Ziel

Bereits getrennte Namensvarianten können ausdrücklich zu einem Spielerprofil zusammengeführt werden, ohne historische Spiele umzuschreiben oder Originalnamen zu verlieren.

## Bedienung

Im Statistikbereich öffnet „Spielerprofile verwalten“ eine Übersicht aller erkannten Identitäten. Für eine Zusammenführung werden ein Quellprofil und ein Zielprofil gewählt. Das Zielprofil behält seinen Anzeigenamen; vor der Bestätigung werden die betroffenen Spiele und die resultierende Gesamtstatistik gezeigt.

Quell- und Zielrichtung lassen sich direkt umkehren: Wird das aktuelle Ziel als Quelle ausgewählt, tauscht die Oberfläche beide Rollen automatisch. Dadurch kann kein Profil durch gegenseitig deaktivierte Auswahlwerte blockiert werden.

## Sicherheitsmodell

- Keine automatische Ähnlichkeits- oder Tippfehler-Erkennung führt selbstständig eine Zusammenführung aus.
- Die Aktion erfordert eine ausdrückliche Auswahl und Bestätigung.
- Historische Spiele bleiben unverändert.
- Technisch wird nur eine ID-Weiterleitung gespeichert.
- Vor jeder Zusammenführung wird zwingend ein Recovery-Snapshot geschrieben.
- Kann der Snapshot wegen Gerätespeicher nicht gesichert werden, wird die Aktion abgebrochen.
- Bis zu fünf frühere Zustände können lokal aufbewahrt werden.
- Die letzte Zusammenführung lässt sich direkt im Dialog rückgängig machen.
- Weiterleitungen werden transitiv aufgelöst, sodass auch mehrere aufeinanderfolgende Zusammenführungen konsistent bleiben.

## Backups

Backup-Format v2 enthält neben Spielen auch Alias-, Weiterleitungs- und Anzeigenamen-Zuordnungen. V1-Backups bleiben importierbar. Beim Import werden Identitätsdaten ausschließlich additiv übernommen; widersprüchliche lokale Zuordnungen werden nicht überschrieben und als Konflikte gemeldet.

## Validierung

Der kontrollierte Paketlauf hat folgende Prüfungen erfolgreich abgeschlossen:

- vollständige Unit-Test-Suite,
- TypeScript- und Vite-Production-Build,
- alle fünf bestehenden Browser-Journeys,
- neuer Chromium-Pfad für Zusammenführen, Statistik-Neuberechnung und Rückgängig.

Der finale Diff enthält ausschließlich sieben dauerhafte Quell-, Test- und Dokumentationsdateien; sämtliche temporären Workflows, Patchskripte und Diagnosedateien wurden entfernt.

## Geräteübergreifende Grenze

Manuelle Zusammenführungen werden über Backup v2 auf andere Geräte übertragen. Sie werden noch nicht als eigener Cloud-Datensatz synchronisiert. Neue Spiele verwenden nach der Zusammenführung bereits die Ziel-ID und tragen diese über den bestehenden Spiele-Sync weiter.
