# Paket R – Pausenbibliothek

## Verhalten

- Es gibt weiterhin genau ein **aktuell laufendes** Spiel.
- Wird aus dem Startbildschirm ein neues Spiel begonnen, wird der bisherige Stand nicht mehr überschrieben, sondern in die Pausenbibliothek verschoben.
- Mehrere pausierte Spiele können nebeneinander bestehen.
- Ein pausiertes Spiel bleibt 14 Tage direkt in der Pausenliste sichtbar.
- Nach 14 Tagen wird es automatisch ins Archiv verschoben, aber **nicht gelöscht**.
- Archivierte Spiele lassen sich weiterhin fortsetzen.
- Endgültiges Löschen erfordert eine sichtbare Bestätigung.
- Wird ein anderes pausiertes Spiel geöffnet, landet der bisherige aktive Stand zuerst sicher in der Pausenbibliothek.

## Speicherung

- Die Bibliothek wird sofort lokal im Browser gespeichert.
- Mit gültigem Familien-Code wird sie zusätzlich über den bestehenden versionierten `clique_state`-Mechanismus synchronisiert.
- Mehrgeräteänderungen werden pro Spiel anhand einer stabilen Sitzungs-ID und des jüngsten Änderungszeitpunkts zusammengeführt.
- Löschungen bleiben vorübergehend als Tombstone erhalten, damit ein altes Gerät ein gelöschtes Spiel nicht wiederherstellt.
- Keine neue Tabelle und keine Datenbankmigration sind erforderlich.

## Sicherheitsregeln

- Erst wenn das Pausieren lokal erfolgreich gespeichert wurde, wird der aktive Slot geleert.
- Die drei bestehenden Notfall-Sicherheitskopien bleiben während eines laufenden Spiels unverändert erhalten.
- Beim Fortsetzen wird das ausgewählte Bibliotheksspiel erst nach erfolgreichem Entfernen aus der Bibliothek zum aktiven Stand.
- Ohne Familien-Code bleibt die Bibliothek vollständig lokal.

## Abnahme

- mehrere pausierte Spiele gleichzeitig
- automatisches Archiv nach 14 Tagen ohne Datenverlust
- Fortsetzen eines archivierten Spiels
- Wechsel zwischen aktivem und pausiertem Spiel
- Lösch-Tombstone verhindert Wiederauftauchen auf einem anderen Gerät
- Reload und lokale Persistenz
- Unit-Tests, Production-Build, Chromium und WebKit
- finaler Produktstand ohne Patch-, Workflow- oder Diagnoseartefakte geprüft
