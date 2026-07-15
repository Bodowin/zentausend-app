# Paket O – iPhone-Vollbild und sauberer Spielerwechsel

## Anlass

Beim ersten längeren Spiel auf einem iPhone 17 Pro wurden unnötiges Seiten-Scrollen, eine unruhige Abfolge nach dem Sichern und eine linksbündige Punkteanzeige im virtuellen Würfelmodus beobachtet.

## Umsetzung

- Der laufende Spielscreen nutzt die tatsächlich sichtbare dynamische Viewport-Höhe (`100dvh`).
- Kopfzeile, Spielerleiste und Aktionsbereich bleiben innerhalb des sichtbaren Spielscreens.
- Die Seite selbst scrollt während eines laufenden Spiels weder vertikal noch horizontal.
- Die Punkte der aktuellen Würfelauswahl stehen mittig; die Gesamtpunkte des Zugs bleiben rechts klar sichtbar.
- Nach dem Sichern erscheint eine gemeinsame, zentrierte Übergabe mit erzielten Punkten, neuem Gesamtstand und nächstem Spieler.
- Ein neuer virtueller Wurf wird erst vorbereitet, nachdem „Würfeln starten“ bestätigt wurde.
- Spezialanimation und Spielerübergabe laufen nacheinander statt übereinander.
- Eine Niete erzeugt nur noch eine Übergabeanzeige.
- Laufende Cloud-Spielstände werden erst nach Eingabe des Familien-Codes gelesen oder geschrieben.
- Wird der Familien-Code in den Einstellungen gespeichert, startet die Cloud-Prüfung sofort; lokale Spielstände bleiben ohne Code vollständig erhalten.

## Abnahme

- Unit-Tests
- TypeScript-/Vite-Produktionsbuild
- vollständige Chromium-Browser-Suite
- WebKit-Smoke-Test im iPhone-Viewport
- eigener Ablauf: fortsetzen → würfeln → auswählen → 100 Punkte sichern → Übergabe bestätigen → neuer Wurf
- Prüfung auf vertikales und horizontales Dokument-Scrollen bei 393 × 852 Pixeln
- kein Zugriff auf einen laufenden Cloud-Spielstand ohne Familien-Code
- Geräteübernahme und Konfliktentscheidung mit Familien-Code
