# Paket G – Cloud-Provisionierung und Spieler-Zuordnungs-Sync

## Ausgangslage

Das bestehende Supabase-Projekt war pausiert. Nach der Wiederherstellung wurden eine vorhandene Spielzeile, die Tabelle `games`, private Code-Prüffunktionen und ein früher öffentlich bekannter Clique-Default festgestellt.

## Datenbank-Härtung

- Bestehende Spielzeile vor Änderungen serverseitig nach `private.games_backup_20260713` kopiert.
- Eingabe-Constraints für IDs, Namen, Events, Scores, Spieler-JSON und Zug-JSON ergänzt und validiert.
- Clique- und Admin-Code von Klartext auf SHA-256-Hashes migriert.
- Früher öffentlicher Clique-Default rotiert und deaktiviert.
- `SECURITY DEFINER`-Funktionen auf einen festen `search_path` begrenzt.
- `PUBLIC`-Ausführungsrechte entzogen.
- Überbreite Grants wie `TRUNCATE`, `TRIGGER` und `REFERENCES` für Client-Rollen entfernt.
- Fehlende UPDATE-RLS-Policy für Spiel-Events ergänzt.
- Security Advisors nach Migration ohne Befunde.

## Gemeinsamer Spielerzustand

`public.clique_state` speichert den Zustand `player_identity` als versioniertes JSON:

- `state_key`
- `version`
- `payload`
- `updated_at`

Lesen bleibt öffentlich. Insert und Update erfordern den gültigen Clique-Code; Löschen erfordert den Admin-Code.

## Konfliktmodell

Der Client führt einen Drei-Wege-Merge aus:

1. zuletzt bestätigte Cloud-Basis,
2. aktueller lokaler Zustand,
3. aktuelle Cloud-Version.

Unabhängige Änderungen werden kombiniert. Bei derselben abweichend geänderten Zuordnung gewinnt lokal und der Konflikt wird sichtbar gezählt. Das Schreiben erfolgt als Compare-and-Swap über die Cloud-Version und wird nach einem Versionskonflikt einmal neu berechnet.

## Ehrlicher Code-Status

Der read-only RPC `check_clique_code()` gibt ausschließlich `true/false` zurück. Dadurch erkennt die App einen rotierten oder falschen gespeicherten Code und zeigt nicht fälschlich „synchronisiert“ an. Weder Code noch Hash werden offengelegt.

## Abnahme

Direkte RLS-Tests unter der Datenbankrolle `anon` wurden vollständig in einer Rollback-Transaktion ausgeführt:

- Insert ohne Clique-Code verweigert.
- Insert und Update mit Clique-Code erlaubt.
- Delete ohne Admin-Code verweigert.
- Delete mit Admin-Code erlaubt.
- Versioniertes CAS-Update des gemeinsamen Zustands erlaubt.

Die Browser-Suite verwendet ausschließlich fiktive Testcodes und interceptet Supabase-Aufrufe; sie greift nicht auf Produktivdaten zu.
