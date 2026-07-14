# Paket H – Familienfreundliche Sicherung

## Ziel

Der Cloud-Status verwendet Alltagssprache statt technischer Sync-Begriffe. Familienmitglieder können die Sicherung bewusst mit einem einzigen Knopf prüfen.

## Verhalten

- **Alles gesichert:** Keine lokale Änderung wartet; Geräte- und Cloud-Anzahl sind sichtbar.
- **Noch nicht alles gesichert:** Lokale Änderungen bleiben erhalten und werden gezählt.
- **Crew-Code prüfen:** Der Code ist falsch oder wurde rotiert; lokale Spiele werden nicht gelöscht.
- **Gerade offline:** Die Statistik bleibt offline lesbar und kann später erneut gesichert werden.
- **Jetzt sichern:** Startet jederzeit einen vollständigen Abgleich.

## Haptik

Haptisches Feedback ist eine lokale Geräteeinstellung, standardmäßig ausgeschaltet und jederzeit in den Einstellungen änderbar. Es gibt keine wiederkehrende Nachfrage.

## Abnahme

Unit-Tests, Production-Build und mobile Chromium-Journeys prüfen Statusanzeige, manuellen Abgleich, ungültigen Code sowie persistente Haptik-Einstellung.
