# Paket N – iPhone-, PWA- und Produktionshärtung

## Ziel

Die App soll nach iPhone-Hintergrundwechseln, PWA-Updates, blockiertem Gerätespeicher und unerwarteten Laufzeitfehlern verständlich und ohne stillen Datenverlust reagieren.

## Umsetzung

- PWA-Updateprüfung beim Wieder-online-Gehen, `pageshow`, Sichtbarwerden und App-Resume
- sauberes Entfernen aller Timer und Listener
- kein automatischer Reload während einer laufenden Runde
- sichtbarer Offline-bereit-Hinweis
- globaler React-Auffangschirm mit sicherem Neuladen
- lokaler Diagnose-Ringpuffer mit maximal 20 Einträgen
- automatische Schwärzung von Familien-, Clique- und Admin-Codes in Diagnosen
- automatische Gerätespeicher-Probe beim Start und nach App-Rückkehr
- klare Warnung, falls lokale Speicherung blockiert oder voll ist
- eigener WebKit-Smoke-Test mit iPhone-Viewport

## Datenschutz

Diagnosen bleiben ausschließlich lokal im Browser. Sie enthalten maximal Fehlertyp, gekürzte Meldung, Zeitpunkt und Build-Version. Bekannte Codes sowie Token-/Key-Parameter werden vor dem Speichern entfernt.

## Grenzen

Playwright WebKit ist eine Safari-nahe Browserprüfung, aber kein vollständiger Ersatz für einen manuellen Test auf echter iPhone-Hardware. Die bestehende Chromium-Suite bleibt zusätzlich bestehen.

## Abnahme

- Unit-Tests für Redaction, Ringpuffer und Gesundheitsbewertung
- Production-Build
- vollständige Chromium-Suite
- separater WebKit-Smoke-Test für Speicherwarnung, Offline-Start, Einstellungen und horizontales Layout
