from pathlib import Path

path = Path('src/components/GameScreen.tsx')
text = path.read_text()

if "import { GameOverDialog } from './GameOverDialog'" not in text:
    anchor = "import { TurnLogDialog } from './TurnLogDialog'\n"
    if text.count(anchor) != 1:
        raise SystemExit('GameScreen import anchor missing')
    text = text.replace(anchor, anchor + "import { GameOverDialog } from './GameOverDialog'\n", 1)

for unused in ["  IconRefresh,\n", "  IconShare,\n", "  IconTrophy,\n"]:
    if unused in text:
        text = text.replace(unused, '', 1)

start_marker = "      {/* Sieg-Overlay – oder, umgeschaltet, die Runden-Analyse desselben Spiels. */}\n"
end_marker = "    </div>\n  )\n}"

if '<GameOverDialog' not in text:
    start = text.find(start_marker)
    end = text.rfind(end_marker)
    if start < 0 or end < 0 or end <= start:
        raise SystemExit('GameScreen winner overlay anchors missing')

    replacement = """      {/* Sieg-Overlay – oder, umgeschaltet, die Runden-Analyse desselben Spiels. */}
      {winner && showAnalysis && finishedGameRecord ? (
        <div className=\"absolute inset-0 z-50 overflow-y-auto bg-ink-950 animate-pop\">
          <Suspense fallback={<AnalysisFallback />}>
            <AnalysisScreen game={finishedGameRecord} onBack={() => setShowAnalysis(false)} />
          </Suspense>
        </div>
      ) : (
        winner && (
          <GameOverDialog
            winner={winner}
            players={players}
            turns={turns}
            event={event}
            onRematch={p.onRematch}
            onAnalysis={() => setShowAnalysis(true)}
            onNewGame={p.onNewGame}
          />
        )
      )}
"""
    text = text[:start] + replacement + text[end:]

path.write_text(text)
print('Package S GameScreen integration applied')
