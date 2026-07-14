# Longlist – natürlicher virtueller Würfelwurf

## Ausgangspunkt

Die App verwendet bereits cannon-es für einen unsichtbaren, festen Physik-Pre-Roll und spielt die aufgezeichnete Bahn anschließend mit CSS-3D ab. Die Augenzahlen werden vor dem ersten sichtbaren Frame passend zur natürlichen Endlage beschriftet; dadurch gibt es kein sichtbares Umspringen und kein WebGL-Risiko.

## Nächster Qualitätsausbau

1. **Seedbarer Wurf:** Ein Seed aus Spiel-ID und Wurfsequenz erzeugt bei Reload dieselbe Bahn und dasselbe Ergebnis.
2. **Gemeinsame Handbewegung:** Würfel starten als korrelierte Traube mit leicht versetzten Freigabezeitpunkten statt als unabhängige Zufallsobjekte.
3. **Natürlichere Streuung:** Vorwärtsimpuls, seitliche Streuung und Drehachsen folgen begrenzten Verteilungen; extreme Raketenwürfe werden ausgeschlossen.
4. **Rundere Schale:** Mehr Randsegmente und feinere Neigung reduzieren sichtbare achteckige Abpraller.
5. **Material-Tuning:** Reibung und Rückprall werden anhand aufgezeichneter Kennzahlen kalibriert: erster Aufprall, Anzahl Abpraller, Rollzeit und Restbewegung.
6. **Robustes Ausrollen:** cannon-es-Sleep-Zustand plus Grenzwerte für lineare und Winkelgeschwindigkeit bestimmen das Ende; gestapelte oder gekippte Würfel werden unsichtbar neu simuliert.
7. **Leistungsbudget:** Maximaldauer und Simulationsversuche bleiben gedeckelt; reduzierte Bewegung und schwächere Geräte erhalten eine kürzere Variante.
8. **Fairness unverändert:** Das Ergebnis bleibt gleichverteilt und reload-sicher. Die Physik gestaltet die sichtbare Bewegung, nicht die Gewinnchance.

## Akzeptanzkriterien

- Kein sichtbarer Endsprung oder Slerp-Zwang.
- Gleicher gespeicherter Wurf nach Reload.
- Stabile Ausführung auf iPhone Safari ohne WebGL.
- 1 bis 6 Würfel kollidieren sichtbar miteinander und mit der Schale.
- Median der Animation ungefähr 1,4–2,2 Sekunden; harter Timeout als Fallback.
- Automatischer statistischer Test für gleichmäßige Werteverteilung.
- Haptik bleibt vollständig optional und unabhängig von der Animation.

## Technische Quellen

- cannon-es Body: https://pmndrs.github.io/cannon-es/docs/classes/Body.html
- cannon-es ContactMaterial: https://pmndrs.github.io/cannon-es/docs/classes/ContactMaterial.html
- MDN Navigator.vibrate(): https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
