# Paket C – Verlauf, Backup und Cloud-Daten absichern

## Ziel

Alle gespeicherten Spiele werden vor Statistik, Merge oder Import durch dieselbe Validierung geführt. Bestehende Daten werden nicht still verworfen.

## Regeln

- Eindeutig reparierbare Altformate werden normalisiert, etwa numerische String-IDs, fehlende `busts`, abweichende Groß-/Kleinschreibung oder ein rekonstruierbarer `winnerScore`.
- Fehlerhafte Analyse-Züge werden ausgelassen, ohne ein ansonsten belastbares Spielergebnis zu verlieren.
- Ein Spiel wird nur isoliert, wenn zentrale Ergebnisdaten wie Spieler, ID, Datum oder Sieger nicht eindeutig rekonstruierbar sind.
- Widersprüchliche Datensätze mit derselben Spiel-ID werden nicht überschrieben: Die neuere Fassung bleibt aktiv, die andere wird mit Begründung quarantänisiert.

## Datensicherheit

Vor einer automatischen lokalen Bereinigung wird der vollständige rohe Verlauf als Recovery-Snapshot gesichert. Bis zu drei Snapshots und bis zu 100 quarantänisierte Einträge werden lokal aufbewahrt.

Der Statistik-Bildschirm zeigt Reparaturen und Quarantäne transparent an. Über **Prüfbericht sichern** lassen sich Bericht, Originaleinträge und Recovery-Snapshots als JSON exportieren.

## Quellen

Die gemeinsame Prüfung gilt für:

- lokalen Verlauf in `localStorage`,
- importierte Backup-Dateien,
- JSON-Felder aus Supabase.

## Bewusste Grenze

Dieses Paket migriert noch keine historische Spieleridentität. Spieler bleiben vorerst über ihren Namen aggregiert; stabile Spieler-IDs und ein kontrolliertes Zusammenführen von Namensvarianten gehören in ein eigenes Folgepaket.
