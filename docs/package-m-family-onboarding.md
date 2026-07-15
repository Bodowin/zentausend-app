# Paket M – Familienfreundlicher Gerätewechsel

## Ziel

Ein neues Handy oder Tablet soll ohne technische Hilfe mit der Familienrunde verbunden werden können. Der Ablauf bleibt offline-first und verändert keine bestehenden Spiele.

## Bedienung

1. Auf einem bereits eingerichteten Gerät in den Einstellungen den Familien-Code teilen oder kopieren.
2. Auf dem neuen Gerät die App öffnen und den Familien-Code eingeben.
3. „Code prüfen & Daten laden“ antippen.
4. Bei erfolgreicher Verbindung erscheint „Dieses Gerät ist bereit“ mit lokaler und Cloud-Spielanzahl.

## Sicherheit

- Der Admin-Code wird nie in eine Teilen-Nachricht aufgenommen.
- Ohne Familien-Code wird kein Sync gestartet.
- Ein falscher Code, ein Netzproblem und ein erfolgreicher Abgleich werden klar unterschieden.
- Bei fehlendem Internet bleibt der Familien-Code lokal gespeichert; bestehende lokale Spiele bleiben unangetastet.
- Der Abgleich nutzt weiterhin den bestehenden validierten Merge, die RLS-Regeln und die stabile Spieleridentität.

## Technik

- Native Web-Share-Funktion auf unterstützten Geräten
- Clipboard-Fallback ohne externe Dienste
- Keine neue Datenbanktabelle und keine QR-/Tracking-Abhängigkeit
- Unit-Tests für Teilenachricht und alle Verbindungszustände
- Browser-Test für Eltern-Onboarding, Teilen und Offline-Wiederaufnahme
