# Paket K – Laufende Spiele in der Cloud

## Ziel

Ein laufendes Spiel bleibt weiterhin sofort lokal und offline-first gespeichert. Zusätzlich liegt eine versionierte Sicherheitskopie in `public.clique_state` unter `state_key = active_game`.

## Konfliktschutz

- Jede Partie besitzt eine stabile `sessionId`.
- Jedes Gerät besitzt eine lokale, zufällige Geräte-ID.
- Nur das aktuell eingetragene Besitzergerät darf automatische Updates schreiben.
- Schreiben erfolgt per Compare-and-Swap über die Spalte `version`.
- Ein neuerer Cloud-Stand, ein anderes Spiel oder ein fremdes Besitzergerät wird niemals still überschrieben.
- Die App zeigt stattdessen einen In-App-Dialog für die bewusste Übernahme.

## Abschluss und Verwerfen

Ein abgeschlossenes oder bewusst verworfenes Spiel wird als versionierter `cleared`-Tombstone gespeichert. Ein älteres Gerät darf dieselbe Sitzung dadurch nicht automatisch wiederbeleben.

## Offline-Verhalten

Ohne Netz bleibt der bestehende lokale Autosave vollständig funktionsfähig. Beim nächsten erreichbaren Sync wird nur dann geschrieben, wenn kein Cloud-Konflikt besteht.

## Abnahme

- Unit-Tests decken neuer/lokaler Stand, fremdes Besitzergerät, unterschiedliche Sitzungen und Tombstones ab.
- Browser-Tests decken die Übernahme auf einem neuen Gerät und die ausdrückliche Entscheidung zwischen zwei laufenden Spielen ab.
- Datenbankänderung: idempotenter Seed der vorhandenen `clique_state`-Tabelle; keine neue Tabelle und keine gelockerten RLS-Regeln.
