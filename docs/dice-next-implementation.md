# Würfel: Übergabe für die nächste Umsetzung

## Nachjustierung am 19.09.2026

Auf Bodos Feedback „zu globig“: individuelle fortlaufende Drehung mit leicht unterschiedlichen Geschwindigkeiten und kleinen versetzten Hüpfbewegungen im Bereitschaftszustand. Die sichtbare Drehung und der Positionsversatz werden beim Loslassen übernommen und innerhalb von 240 ms weich in die bestehende Physikbahn überführt. Die letzte Fingergeschwindigkeit beeinflusst den kurzen visuellen Übergang, nicht die aufgezeichnete Bahn oder Augenzahlen. Veraltete Geschwindigkeit nach einer Haltepause wird ignoriert. Reduzierte Bewegung bleibt respektiert. Die kleineren Auswahl-Hübe und Kontaktklänge bleiben erhalten. Subjektive Zufriedenheit auf dem echten iPhone ist weiterhin durch Spielen zu beurteilen.

## Umsetzung am 18.09.2026

Paket A sowie die anschließend von Bodo beauftragte Ziehgeste und der kleinere Auswahl-Hub sind mit `81d89981a139d235762a6b54352c381f4cac9cbd` auf main veröffentlicht. Vercel-Produktion: `dpl_3Q16fy1sWx6vbTfbv48shELnfee5`, READY.

- Kontaktklänge unterscheiden Filz, Rand und Würfel; Paar-Ereignisse werden zusammengeführt und der stärkste frische Kontakt pro Wiedergabeframe ausgewählt. AudioBuffer sind je AudioContext gecacht.
- Ziehen verschiebt die Würfelgruppe (nicht die Schale), Loslassen startet den Wurf mit 170-ms-Rückführung des visuellen Versatzes. Die Geste verändert keine Augenzahlen oder Physikparameter. Das vollständige Energieprofil-Konzept aus Paket D wurde nicht implementiert.
- Pointer-Abbruch kehrt zur Bereitschaft zurück, zusätzliche Finger und Nicht-Linksklicks werden ignoriert; Schütteln löst während einer aktiven Ziehgeste keinen zweiten Start aus. Reduzierte Bewegung unterdrückt den Drag-Versatz.
- Der Auswahl-Hub wurde von 1,9 auf 0,68 Schalen-Einheiten reduziert.
- Lokal und CI: 185 Tests und Build bestanden. WebKit Smoke bestanden. Browser E2E: 43/44 bestanden, darunter alle drei neuen Fälle für 1/2/6 Würfel (Ziehen, Abbruch, Landung und sämtliche Würfelflächen nach Auswahl innerhalb der Arena bei 375×667).
- Offenes unabhängiges Prüfproblem: `e2e/event-cup.spec.ts:87` findet den erwarteten Text `1 Spiel hat noch keinen Anlass.` nicht, auch beim Retry. Die Ursache ist noch nicht gesichert; die betroffenen Cup-/Statistikdateien wurden in diesem Paket nicht geändert. Lauf: https://github.com/Bodowin/zentausend-app/actions/runs/35319661320 . Keine pauschale Freigabe der gesamten Browsersuite behaupten.
- Live zusätzlich geprüft: Zieh-und-Loslass-Wurf mit sechs Würfeln, Auswahl eines Würfels vollständig sichtbar, Fortsetzung nach PWA-Update. Während des Deployments war eine alte, noch geöffnete Version kurz von einem fehlenden dynamischen Chunk betroffen; Reload und das angebotene „Update laden“ stellten das gespeicherte Testspiel wieder her.
- Physische iPhone-Touchbedienung und subjektiver Klang auf dem Gerät bleiben ungeprüft. B/C/D sind weiterhin offen.

Der folgende ursprüngliche Plan bleibt als technische Referenz erhalten. Sein Startprompt für Paket A ist damit erledigt und nicht erneut auszuführen.

Stand: 2026-09-10. Geprüfte Codebasis: `17de0ccfca0c63713930e56de5d1a302785f4701` in `Bodowin/zentausend-app`.

## Auftrag und Arbeitsweise

Ziel ist ein glaubwürdigerer, angenehm spielbarer virtueller Würfelwurf. Dieses Dokument bereitet die nächsten Änderungen vor; es implementiert sie noch nicht. Arbeite jeweils genau ein Paket ab. Beginne mit A. B ist unabhängig davon optional. C und D haben ausdrücklich genannte Voraussetzungen und werden nicht automatisch mit umgesetzt.

Vor Änderungen aktuellen Remote-Stand und lokale Änderungen prüfen. In der vorbereitenden Sitzung liegt der lokale Git-HEAD noch vor dem genannten Commit, während DiceArena.tsx und der untracked Physiktest bereits dessen Inhalt enthalten. Diese Dateien nicht blind zurücksetzen, erneut veröffentlichen oder als neue eigene Änderungen behandeln. Bei Bedarf einen frischen Checkout des aktuellen main verwenden. Neuere Änderungen in main haben Vorrang vor dieser Bestandsaufnahme.

Keine zusätzlichen Bibliotheken, kein WebGL-Umbau, keine Änderungen an Supabase, Spielregeln, Wertung oder Cloud-Schema für A/B. Keine umfassende Komponenten-Aufteilung. Kleine Hilfsmodule sind sinnvoll, wenn sie Verhalten unabhängig testbar machen. Keine flüchtigen Sound- oder Sensorwerte als neue Quelle für Augenzahlen verwenden.

## Bereits fertig – nicht erneut implementieren

- cannon-es berechnet die Flugbahn vorab; CSS-3D spielt sie ab.
- Unregelmäßige, auseinanderliegende Startpositionen; aufgezeichnete exakte Startpose.
- Kleines Wippen im Bereitschaftszustand, 90-ms-Übergang in die Wurfrotation.
- Kein Aufprall-Vergrößern, Kamerawackeln oder Staub.
- Lokal erzeugter kurzer Aufprallklang; Kontakt-Cooldowns und Unterdrückung veralteter Klänge.
- Basis-Abspielgeschwindigkeit 1,45; lange Bahnen werden auf höchstens 2,8 Sekunden rechnerische Wiedergabe beschleunigt. Das ist keine Garantie für Rechenzeit oder Browser-Scheduling.
- Deterministische Bewegungs-Seeds; Augenzahlen kommen separat aus dem Spielzustand und werden vor dem ersten sichtbaren Frame passend beschriftet.
- Letzte vorherige Prüfung: 181 Tests sowie Build, Browser-E2E und WebKit-Smoke erfolgreich. Das ist historische Evidenz, keine Prüfung künftiger Änderungen.

## Kleine Leseliste

| Datei / Symbol | Verantwortung |
| --- | --- |
| `src/components/DiceArena.tsx`: `runAttempt`, `Impact` | Physik, Kontaktaufnahme, aufgezeichnete Bahnen |
| gleiche Datei: `playClick`, `unlockDiceAudio`, `playTap` | Aufprall- und Auswahlklang, Audiofreigabe |
| gleiche Datei: Rolling-Effect mit `impactPtr` | Wiedergabe, Klang/Haptik-Taktung |
| gleiche Datei: `handleTap`, `onMotion` | Start per Tipp oder optionalem Sensor |
| `src/components/DiceArena.physics.test.ts` | Startabstände, Determinismus, Beschriftung, Dauer |
| `src/lib/diceThrowSeed.ts` + Test | Bewegungs-Seed, deterministischer PRNG nur für Animation |
| `src/App.tsx`: `rnd6`, `newThrow` | Erzeugung und Speicherung neuer Augenzahlen |
| `src/components/GameScreen.tsx` | Arena-Props, Wurfsequenz und Anzeige |
| `src/lib/prefs.ts`, `src/lib/haptics.ts` | Nutzerpräferenzen und optionale Vibration |
| `src/naturalDiceWiring.test.ts` | Bestehende Integrationsanforderungen |

`docs/roadmap-natural-dice.md` ist eine ältere Longlist, keine Liste noch offener Aufgaben. Insbesondere seedbare Bewegung ist schon vorhanden. Für die hier geplanten Pakete gilt diese aktualisierte Bestandsaufnahme.

## Paket A – Unterschiedliche Kontaktklänge (erster Auftrag)

**Ergebnis:** Filz klingt weich und kurz, Randkontakt trockener, Würfelkontakt heller. Lautstärke folgt der Aufprallstärke. Die Flugbahn bleibt unverändert.

**Änderungsfläche:** DiceArena.tsx; neues `src/lib/diceImpact.ts` und zugehöriger Test für Klassifikation/Auswahl; optional `src/lib/diceAudio.ts`, falls Audio sonst unübersichtlich wird. Bestehenden Auswahlklang zunächst erhalten.

1. `Impact` um `kind: 'felt' | 'rim' | 'dice'` erweitern. Boden-Body, Rand-Bodies und Würfel-Bodies beim Erstellen über Referenzen bzw. eine lokale Map klassifizieren. Boden und Rand verwenden aktuell dasselbe Material: Materialname allein unterscheidet sie nicht. Body-IDs nicht als stabile IDs über mehrere Simulationsläufe speichern.
2. Im Collision-Listener den anderen Body über den tatsächlich installierten cannon-es-Typ bestimmen; alternativ `contact.bi`/`bj` relativ zum eigenen Body. Vor Implementierung die lokalen Typdefinitionen lesen. Unbekannte Kontakte ignorieren, keine zufällige Materialwahl. Bestehende Physikparameter und Reihenfolge der PRNG-Aufrufe erhalten.
3. Bestehende Schwelle `v > 1.2` und Cooldown von fünf Simulationsframes je Würfel zunächst erhalten. Ein Würfelpaar kann von beiden Bodies gemeldet werden: pro Paar und Frame nur ein logisches Kontakt-Ereignis aufnehmen. Falls der stärkere Kontakt gewählt wird, Intensität per Maximum zusammenführen. Stabile lokale Würfelindizes für Gleichstände verwenden.
4. Playback weiterhin alte Ereignisse verwerfen (`i0 - frame > 6`). Von den gerade fälligen frischen Ereignissen höchstens eines auswählen, das den bestehenden Abstand von vier Simulationsframes zum letzten Klang erfüllt. Höchste Intensität gewinnt; Gleichstand nach Frame und Würfelindex. Keine neue Warteschlange, die Klänge erst nach dem sichtbaren Kontakt abspielt. Diese Auswahl als reine Funktion testen. Haptik folgt demselben ausgewählten Ereignis.
5. Drei gecachte, lokal synthetisierte AudioBuffer verwenden. Startwerte, ausdrücklich zum Anhören: Filz 35 ms, dunkles tiefpassähnliches Rauschen, Gain-Faktor 0,6; Rand 55 ms, bisheriger Klang, Faktor 1,0; Würfel 35 ms, helleres Rauschen, Faktor 0,8. Alle Werte auf die bisherige Gain-Kurve beziehen. Keine externen Audiodateien nötig. Audio-Zufall vom Physik-PRNG getrennt halten.
6. AudioContext weiterhin nur durch bestehende Gesten freigeben. `sound=false`, fehlende Audio-API und suspendierter Context bleiben stille, fehlerfreie Fälle. Buffer an den verwendeten Context binden; Quellen/Gains nach Ende trennen. Präferenzen bei Wiedergabe beachten.

**Abnahme:** Alle drei Body-Klassen werden korrekt erkannt; Paar-Kollisionen lösen keinen Doppelklang aus; stärkster frischer Kontakt gewinnt reproduzierbar; bei Tab-Rückkehr kein Klangstau. Gleiche Seeds liefern weiterhin gleiche Positionen/Quaternionen, gleiche Werte erscheinen nach Reload. 1/2/6 Würfel sowie Klang an/aus im Browser prüfen. Natürlichkeit des Sounds auf einem echten Telefon anhören; ohne Gerät nur funktionale Prüfung melden, keine akustische Gerätefreigabe behaupten.

**Nicht mit erledigen:** Neue Einstellungen für Soundprofile, Physik-Tuning, neue Gesten, neue Zufallsquelle. Wenn die Klangmischung unangenehm wirkt, die drei Profile vereinfachen statt zusätzliche Effekte einzubauen.

## Paket B – Gleichverteilte Augenzahlen mit WebCrypto (separat)

Dieses Paket verbessert die Zufallsquelle, nicht das sichtbare Würfelgefühl. Nur nach eigenem Auftrag umsetzen.

**Änderungsfläche:** neues `src/lib/randomDie.ts` mit Tests; ausschließlich `rnd6`/dessen Verwendung in App.tsx anbinden. Bewegungs-PRNG und gespeicherte Würfe unangetastet lassen.

- Eine Byte-Zufallsquelle injizierbar machen. Produktion nutzt `globalThis.crypto.getRandomValues` auf einem Uint8Array; Werte 252–255 verwerfen, sonst `1 + byte % 6`. Damit haben alle sechs Ergebnisse genau 42 akzeptierte Byte-Werte.
- Funktionsname beispielsweise `randomDie(readByte = cryptoByte): number`. Produktionsquelle muss die API mit korrektem Receiver aufrufen. Keine Modulo-Abbildung aller 256 Werte und kein stiller Math.random-Fallback.
- Fehlt WebCrypto, Fehler vor der Zustandsänderung auffangen und verständlichen Hinweis im vorhandenen UI-Muster anzeigen. Bereits gespeichertes Spiel bleibt erhalten. Erst alle neuen Werte lokal erzeugen, dann bestehenden State aktualisieren.
- Nur neue Würfe verwenden die Quelle. Sortierung, Zeitpunkt des Speicherns und vorhandene Wiederherstellung unverändert lassen. Reload darf niemals erneut würfeln.

**Tests:** Akzeptierte Bytes 0–251 vollständig prüfen (jedes Ergebnis 42-mal); Sequenz 252,253,254,255,0 liefert 1; gültige Grenzwerte 0 und 251; fehlende API behandelt; gespeicherte Augenzahlen bleiben bei Wiederaufnahme gleich. Keine zufällig fehlschlagenden Histogrammtests und keine Behauptung, eine endliche Stichprobe beweise Fairness.

## Paket C – Wurfgefühl auf echtem Gerät abstimmen

Vor weiterem Physik-Tuning folgende kleine Messung durchführen. Ohne echtes Gerät darf das Modell die Vorbereitung erledigen, aber keine Geräteergebnisse erfinden.

Test auf iPhone in Safari und installierter PWA, optional Android als Vergleich: je zehn Würfe mit 1, 3 und 6 Würfeln; Ton an/aus; reduzierte Bewegung; Spiel fortsetzen nach Reload; während eines Wurfs kurz in den Hintergrund wechseln. Gerät, OS/Browser, Commit und Modus notieren.

Pro Serie erfassen: auffällige Wartezeit vor Bereitschaft, Ruckeln, unplausible Kollisionen, Klang zu hart/leise, sichtbarer Schluss-Sprung, Zahl vor/nach Reload. Aufzeichnung in `docs/dice-device-results.md` erst bei Durchführung erstellen; offene Punkte als „nicht geprüft“ markieren. Browser-Automationslaufzeit einschließlich Tool-Latenz ist keine Animationsmessung.

Falls eine Verzögerung sichtbar ist: lokal im Development-Modus Pre-Roll-Gesamtzeit einschließlich aller Retries, Zahl der Versuche und Wiedergabedauer getrennt mit performance.now messen. Keine Telemetrie oder Datenbank einführen. Worker erst erwägen, wenn wiederholt eine zusammenhängende Pre-Roll-Blockade über 50 ms auf dem Zielgerät gemessen wird (Projekt-Entscheidungsschwelle, keine bereits gemessene Zahl). Ein Worker ist ein eigener Auftrag mit separatem Entwurf für Abbruch, Fallback und Stale-Result-Schutz.

## Paket D – Wisch-/Schüttelstärke (noch kein Implementierungsauftrag)

**Abhängigkeit:** Aktuell ist die gesamte Bahn fertig, bevor handleTap/onMotion den Wurf startet. Einfach beim Start die Anfangsgeschwindigkeit zu ändern hat daher keine Wirkung auf diese Bahn. Neu simulieren in der Startgeste kann ruckeln. Ein kleineres Modell soll diese Architekturentscheidung nicht beiläufig treffen.

Empfohlener späterer Entwurf: drei begrenzte Energieprofile (sanft/normal/kräftig), gespeichertes Profil gehört zum Wurf. Gleicher Seed plus Profil ergibt gleiche Bahn; Augenzahlen bleiben ausschließlich aus dem gespeicherten Wurf. Normal entspricht dem bisherigen Verhalten. Profil ändert zunächst nur lineare und Winkel-Anfangsgeschwindigkeit, nicht Schwerkraft, Beschriftung oder Gewinnchancen.

Vor Umsetzung entscheiden und dokumentieren: wann das Profil erfasst wird, wann die Bahn berechnet wird, wie Profil und Wurf atomar gespeichert werden, wie alte Spielstände auf normal migrieren, wie ein noch nicht abgeschlossener Pre-Roll abgebrochen wird. Betroffen wären Arena, GameScreen, App und bestehende Speicherung/Replay-Tests. Kein Schema ändern, bevor diese Bestandsaufnahme abgeschlossen ist. Sensoren bleiben opt-in, abgelehnte Berechtigung und reine Tippbedienung müssen funktionieren.

## Verifikation und Abschluss je implementiertem Paket

1. Zielgerichtete neue Tests ausführen, dann `npm test` und `npm run build`.
2. Für A Browser-Spielablauf mit virtuellen Würfeln prüfen; vorhandene Playwright-Suite über `npm run test:e2e`, sofern Browser installiert. Fehlt die Laufzeit, Einschränkung melden und vorhandene CI nutzen, keine erfolgreichen Tests erfinden.
3. Keine neuen Tests für dieses reine Planungsdokument nötig. Keine unnötigen Wiederholungen nach bestandenem Gate.
4. Veröffentlichung gemäß der bestehenden Arbeitsvereinbarung über main, ohne Force-Push. Vorher Remote-Spitze erneut prüfen und fremde Änderungen erhalten. Dokumentationsänderung und jeweilige Funktionsänderung separat committen.
5. Bei Veröffentlichung Vercel-Deployment und CI prüfen; in der PWA „Update laden“ verwenden, wenn angeboten. Ein URL-Query allein ersetzt keinen Service-Worker-Update.
6. Abschluss: geändertes Verhalten, Commit, wirklich durchgeführte Tests und offene Geräteprüfung nennen. Rücknahme bei Regression durch gezielten Revert des jeweiligen Pakets; keine Datenmigration für A/B.

## Startprompt für das kleinere Modell

> Arbeite im Repository Bodowin/zentausend-app. Lies docs/dice-next-implementation.md und prüfe den aktuellen Code-/Git-Stand. Setze ausschließlich Paket A (Kontaktklänge) vollständig um. Erhalte bestehende Physikbahnen, gespeicherte Augenzahlen, Präferenzen und Offline-Fähigkeit. Nutze die angegebenen kleinen Tests und prüfe Build und Spielablauf. Dokumentiere tatsächliche Ergebnisse und Einschränkungen. B, C und D nicht beiläufig implementieren. Beachte die bestehende Veröffentlichungsvereinbarung und erhalte fremde Änderungen. Stelle keine Rückfragen zu bereits festgelegten Routineentscheidungen.
