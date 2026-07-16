# Paket R – Pausierte Spiele und Archiv

## Ziel

Mehrere laufende Partien dürfen gleichzeitig sicher pausiert bleiben. Ein neues Spiel ersetzt keinen früheren Stand mehr.

## Verhalten

- Der aktuell pausierte Hauptstand bleibt wie bisher sofort fortsetzbar.
- Beim Start einer neuen Partie wird der bisherige Stand in die Pausenbibliothek verschoben.
- Mehrere pausierte Partien können einzeln fortgesetzt oder ausdrücklich gelöscht werden.
- Bis 14 Tage seit der letzten Spielaktivität erscheinen Partien unter „Pausiert“.
- Danach erscheinen sie automatisch unter „Archiv“.
- Archivierte Partien werden nicht automatisch endgültig gelöscht.
- Beim Fortsetzen einer älteren Partie wird ein eventuell aktueller Stand vorher ebenfalls sicher pausiert.
- Die Bibliothek wird mit Crew-Code über den vorhandenen versionierten `clique_state`-Mechanismus geräteübergreifend zusammengeführt.
- Ohne Crew-Code bleibt sie vollständig lokal.

## Sicherheit

- Validierung jedes gespeicherten Spielstands über das bestehende `ActiveGame`-Schema.
- Zusammenführung nach stabiler `sessionId` und Änderungszeit.
- Löschungen werden als Tombstones synchronisiert, damit andere Geräte alte Partien nicht wiederherstellen.
- Der bestehende aktive Cloud-Spielstand bleibt separat und konfliktgeschützt.
- Keine Änderung an Spielregeln oder abgeschlossenen Statistiken.
