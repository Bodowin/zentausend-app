# Paket L – Persönliche Spielerprofile

## Ziel

Die ewige Bestenliste wird zum Einstieg in persönliche, identitätsbasierte Profile. Bestehende Endstände, Siege und Nieten bleiben vollständig nutzbar; neuere Zugdaten ergänzen detaillierte Leistungswerte.

## Kennzahlen

- Spiele, Siege, Siegquote, durchschnittlicher und bester Endstand
- Nieten pro Spiel
- längste und aktuelle Siegesserie
- Verlauf der letzten Spiele mit Platzierung und Endstand
- durchschnittlicher erfolgreicher Zug und bester Einzelzug
- durchschnittliche Spieldauer und schnellster Sieg
- Angstgegner aus gemeinsamen Spielen
- Aufteilung nach Anlass

## Datenqualität

Zugbasierte Werte zeigen ihre eigene Datenabdeckung. Ältere Spiele ohne Zugverlauf fließen weiterhin in Endstand, Siege, Siegquote und Nieten ein und werden niemals still ausgeschlossen.

## Bedienung

Jede Zeile der ewigen Bestenliste ist antippbar. Ein aktiver Anlassfilter wird in das Profil übernommen. Zurück führt ohne Datenverlust in dieselbe Statistikansicht.

## Abnahme

Unit-Tests prüfen stabile IDs, Namenswechsel, Serien, Anlassfilter, Turn-Coverage und Altspiele. Browser-Tests prüfen das Öffnen des Profils sowie die Übernahme des Anlassfilters. Die vollständige bestehende Browser-Suite deckt zusätzlich Spieler-Zusammenführen und Rückgängig gegen die neue antippbare Bestenliste ab.
