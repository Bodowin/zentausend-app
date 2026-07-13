# Paket A – Geräte-Testplan

## Ziel

Die Änderungen sichern laufende Partien gegen Reloads, App-Wechsel und schwaches Netz ab. Der Test soll vor dem Merge auf mindestens einem iPhone und nach Möglichkeit zusätzlich auf einem iPad erfolgen.

## 1. Virtueller Wurf bleibt identisch

1. Spiel mit virtuellen Würfeln starten.
2. Würfeln und das Ergebnis notieren.
3. Einen oder mehrere Würfel auswählen.
4. App vollständig schließen oder Seite neu laden.
5. Spiel fortsetzen.

Erwartung: Es erscheinen dieselben Augen wie vor dem Reload. Die Auswahl ist bewusst zurückgesetzt und kann erneut getroffen werden.

## 2. Niete kann nicht zurückgenommen werden

1. Einen Zug mit Punkten im Topf spielen.
2. „Niete“ auslösen.
3. Während das große Nieten-Banner sichtbar ist, App schließen oder neu laden.
4. Spiel fortsetzen.

Erwartung: Nietenzähler und Zugverlauf enthalten die Niete bereits; der vorherige Spieler darf den Zug nicht wiederholen.

## 3. Undo nach Niete

1. Niete auslösen und Banner bestätigen.
2. Beim nächsten Spieler „Zurück“ drücken.

Erwartung: Der Zustand direkt vor der Niete wird wiederhergestellt, einschließlich desselben virtuellen Wurfergebnisses.

## 4. Würfelmodus wechseln

1. Im virtuellen Modus einen neuen Zug beginnen, aber noch nicht würfeln.
2. Auf „Virtuell“ tippen und zu echten Würfeln wechseln.
3. Zurück zu virtuellen Würfeln wechseln und würfeln.

Erwartung: Wechsel vor dem Wurf ist möglich. Während ein Wurf läuft oder bereits gelandet ist, bleibt der Wechsel gesperrt.

## 5. Letzte Chance

1. Testspiel mit Ziel 5.000 starten.
2. Einen Spieler über das Ziel bringen, zum Beispiel auf 5.600.

Erwartung: Das Banner zeigt den tatsächlichen Führungsstand 5.600 und die korrekt zu überbietende Marke.

## 6. Anlass offline bearbeiten

1. In der Statistik einen Anlass ändern.
2. Währenddessen offline gehen oder schlechten Empfang simulieren.
3. Statistik schließen und erneut öffnen.
4. Später mit Netz erneut öffnen.

Erwartung: Die lokale Änderung bleibt sichtbar. Der Status zeigt eine wartende Änderung und erst nach erfolgreichem Upload „Mit Cloud synchronisiert“.

## 7. PWA und Layout

- Auf iPhone prüfen, dass Pinch-to-Zoom grundsätzlich möglich ist.
- Installierte PWA auf iPad ins Querformat drehen.

Erwartung: Keine erzwungene Hochformat-Sperre; Header, Schale und Aktionsleiste bleiben erreichbar.
