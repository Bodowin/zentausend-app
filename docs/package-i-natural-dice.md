# Paket I – Natürlicherer virtueller Würfelwurf

## Bewegung

- Ein stabiler Seed aus Würfelwerten, Runde, Spieler, Zugverlauf und Topf reproduziert denselben sichtbaren Wurf nach einem Reload.
- Die gezogenen Augenzahlen bleiben davon vollständig getrennt; der Seed steuert nur die Bewegung.
- Würfel verlassen eine gemeinsame virtuelle Handbewegung und erhalten nur begrenzte individuelle Abweichungen.
- Zwölf statt acht unsichtbare Randsegmente lassen die Schale runder reagieren.
- Reibung, Rückprall, Dämpfung und Sleep-Grenzen wurden für weniger gummiartige und sauber ausrollende Würfel abgestimmt.
- Nicht sauber ausgerollte, gekippte oder gestapelte Würfe werden weiterhin unsichtbar neu simuliert.

## Gerätesensor und Haptik

- **Schütteln zum Würfeln** ist eine eigene Geräteeinstellung und standardmäßig aus.
- Ohne Aktivierung wird kein Bewegungssensor-Zugriff angefragt.
- Eine erteilte oder abgelehnte Sensorentscheidung wird während der Sitzung wiederverwendet statt bei jedem Wurf erneut angefragt.
- Alle Vibrationen laufen über die bestehende Haptik-Einstellung, die ebenfalls standardmäßig aus ist.

## Stabilität

Die Darstellung bleibt CSS-3D ohne WebGL. Die cannon-es-Simulation läuft unsichtbar vorab, die sichtbare Bahn wird anschließend abgespielt.
