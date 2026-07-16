from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one anchor in {path}, found {text.count(old)}")
    file.write_text(text.replace(old, new, 1))


game_screen = Path('src/components/GameScreen.tsx')
text = game_screen.read_text()

import_anchor = "import { TurnLogDialog } from './TurnLogDialog'\n"
if "import { GameOverDialog } from './GameOverDialog'" not in text:
    if text.count(import_anchor) != 1:
        raise SystemExit('GameScreen import anchor missing')
    text = text.replace(import_anchor, import_anchor + "import { GameOverDialog } from './GameOverDialog'\n", 1)

for unused in ["  IconRefresh,\n", "  IconShare,\n", "  IconTrophy,\n"]:
    if text.count(unused) != 1:
        raise SystemExit(f'Expected icon import once: {unused!r}')
    text = text.replace(unused, '', 1)

start_marker = "      {/* Sieg-Overlay – oder, umgeschaltet, die Runden-Analyse desselben Spiels. */}\n"
end_marker = "    </div>\n  )\n}"
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
game_screen.write_text(text)

share_image = r'''import type { Player, Turn } from './types'
import { playerColor } from './colors'
import { computeGameAwards, gameAwardNames } from './gameAwards'
import { shareResult } from './share'

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const W = 1080
const H = 1350

export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled' | 'text'

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function fillRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  roundedPath(ctx, x, y, width, height, radius)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, startSize: number, weight = 800): number {
  let size = startSize
  while (size > 24) {
    ctx.font = `${weight} ${size}px ${FONT}`
    if (ctx.measureText(value).width <= maxWidth) return size
    size -= 2
  }
  ctx.font = `${weight} ${size}px ${FONT}`
  return size
}

/**
 * Rendert ein 4:5-Ergebnisbild ohne Zusatzpaket. Native Dateifreigabe wird
 * bevorzugt; Desktop und Browser ohne Web Share laden die PNG-Datei herunter.
 */
export async function shareResultImage(
  winner: Player,
  players: Player[],
  event: string,
  turns: Turn[] = [],
): Promise<ShareImageResult> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    await shareResult(winner, players, event)
    return 'text'
  }

  const background = ctx.createLinearGradient(0, 0, W, H)
  background.addColorStop(0, '#111827')
  background.addColorStop(0.55, '#090e19')
  background.addColorStop(1, '#05070c')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(840, 180, 10, 840, 180, 520)
  glow.addColorStop(0, 'rgba(245,184,61,0.22)')
  glow.addColorStop(1, 'rgba(245,184,61,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 700)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#f5b83d'
  ctx.font = `900 70px ${FONT}`
  ctx.fillText('10.000', 72, 112)
  ctx.fillStyle = '#75819d'
  ctx.font = `800 23px ${FONT}`
  ctx.fillText('D I E   C L I Q U E', 74, 150)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#8d98b0'
  ctx.font = `650 25px ${FONT}`
  ctx.fillText(new Date().toLocaleDateString('de-DE'), W - 72, 108)
  if (event) {
    fitText(ctx, event, 430, 28, 700)
    ctx.fillStyle = '#c5cde0'
    ctx.fillText(event, W - 72, 148)
  }

  fillRounded(ctx, 72, 205, W - 144, 300, 42, 'rgba(18,25,40,0.92)', 'rgba(245,184,61,0.34)')
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8d98b0'
  ctx.font = `850 24px ${FONT}`
  ctx.fillText('CHAMPION DER CLIQUE', W / 2, 270)
  ctx.fillStyle = '#f5b83d'
  ctx.beginPath()
  ctx.arc(W / 2, 332, 38, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ctx.font = `900 38px ${FONT}`
  ctx.fillText('1', W / 2, 345)
  fitText(ctx, winner.name, W - 280, 76, 900)
  ctx.fillStyle = '#f2f5fb'
  ctx.fillText(winner.name, W / 2, 425)
  ctx.fillStyle = '#f5b83d'
  ctx.font = `900 45px ${FONT}`
  ctx.fillText(`${winner.score.toLocaleString('de-DE')} Punkte`, W / 2, 476)

  const sorted = [...players].sort((a, b) => b.score - a.score)
  const rounds = new Set(turns.map((turn) => turn.round)).size
  const margin = sorted.length > 1 ? Math.max(0, winner.score - sorted[1].score) : winner.score
  ctx.textAlign = 'left'
  ctx.fillStyle = '#75819d'
  ctx.font = `800 22px ${FONT}`
  ctx.fillText('ENDSTAND', 76, 572)
  ctx.textAlign = 'right'
  ctx.font = `650 20px ${FONT}`
  const summary = [rounds ? `${rounds} Runden` : '', sorted.length > 1 ? `+${margin.toLocaleString('de-DE')} Vorsprung` : '']
    .filter(Boolean)
    .join('  ·  ')
  ctx.fillText(summary, W - 76, 572)

  const displayed = sorted.slice(0, 8)
  const rowHeight = displayed.length <= 4 ? 74 : 58
  let y = 602
  for (let index = 0; index < displayed.length; index += 1) {
    const player = displayed[index]
    const highlight = index === 0
    fillRounded(
      ctx,
      72,
      y,
      W - 144,
      rowHeight - 8,
      20,
      highlight ? 'rgba(245,184,61,0.11)' : 'rgba(20,27,43,0.76)',
      highlight ? 'rgba(245,184,61,0.28)' : 'rgba(102,114,143,0.16)',
    )
    ctx.textAlign = 'center'
    ctx.fillStyle = highlight ? '#f5b83d' : '#303a50'
    ctx.beginPath()
    ctx.arc(112, y + (rowHeight - 8) / 2, 19, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = highlight ? '#111827' : '#c5cde0'
    ctx.font = `900 21px ${FONT}`
    ctx.fillText(String(index + 1), 112, y + (rowHeight - 8) / 2 + 7)

    ctx.fillStyle = playerColor(player.name)
    ctx.beginPath()
    ctx.arc(160, y + (rowHeight - 8) / 2, 9, 0, Math.PI * 2)
    ctx.fill()

    ctx.textAlign = 'left'
    fitText(ctx, player.name, 450, highlight ? 35 : 31, highlight ? 850 : 700)
    ctx.fillStyle = highlight ? '#f5c75f' : '#d7ddec'
    ctx.fillText(player.name, 188, y + (rowHeight - 8) / 2 + 9)
    ctx.fillStyle = '#75819d'
    ctx.font = `650 19px ${FONT}`
    ctx.fillText(`${player.busts} N`, 590, y + (rowHeight - 8) / 2 + 7)

    ctx.textAlign = 'right'
    ctx.fillStyle = highlight ? '#f5c75f' : '#d7ddec'
    ctx.font = `850 31px ${FONT}`
    ctx.fillText(player.score.toLocaleString('de-DE'), W - 102, y + (rowHeight - 8) / 2 + 9)
    y += rowHeight
  }

  if (sorted.length > displayed.length) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#75819d'
    ctx.font = `650 18px ${FONT}`
    ctx.fillText(`+ ${sorted.length - displayed.length} weitere Spieler`, W / 2, y + 10)
  }

  const awards = computeGameAwards(players, turns).slice(0, 3)
  if (awards.length > 0) {
    const awardsY = 1080
    ctx.textAlign = 'left'
    ctx.fillStyle = '#75819d'
    ctx.font = `800 22px ${FONT}`
    ctx.fillText('AUSZEICHNUNGEN', 76, awardsY)
    const gap = 16
    const cardWidth = (W - 144 - gap * (awards.length - 1)) / awards.length
    const tones = {
      gold: ['rgba(245,184,61,0.12)', 'rgba(245,184,61,0.30)', '#f5c75f'],
      mint: ['rgba(77,217,171,0.10)', 'rgba(77,217,171,0.26)', '#70e0ba'],
      coral: ['rgba(255,111,97,0.10)', 'rgba(255,111,97,0.26)', '#ff8b80'],
    } as const
    awards.forEach((award, index) => {
      const x = 72 + index * (cardWidth + gap)
      const [fill, stroke, accent] = tones[award.tone]
      fillRounded(ctx, x, awardsY + 22, cardWidth, 150, 22, fill, stroke)
      ctx.textAlign = 'left'
      ctx.fillStyle = accent
      ctx.font = `850 19px ${FONT}`
      ctx.fillText(award.title.toUpperCase(), x + 20, awardsY + 58)
      fitText(ctx, gameAwardNames(award), cardWidth - 40, 28, 850)
      ctx.fillStyle = '#eef2fb'
      ctx.fillText(gameAwardNames(award), x + 20, awardsY + 98)
      fitText(ctx, award.detail, cardWidth - 40, 19, 600)
      ctx.fillStyle = '#8d98b0'
      ctx.fillText(award.detail, x + 20, awardsY + 130)
    })
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#56617a'
  ctx.font = `650 20px ${FONT}`
  ctx.fillText('Erstellt mit 10.000 – Die Clique', W / 2, H - 45)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) {
    await shareResult(winner, players, event)
    return 'text'
  }

  const file = new File([blob], '10000-ergebnis.png', { type: 'image/png' })
  try {
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: '10.000 – Die Clique' })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '10000-ergebnis.png'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'downloaded'
}
'''
Path('src/lib/shareImage.ts').write_text(share_image)

for config_path in ['playwright.config.ts', 'playwright.webkit.config.ts']:
    config = Path(config_path)
    config_text = config.read_text()
    old = 'production-hardening|iphone-gameflow|setup-responsive|turn-corrections|paused-games'
    new = old + '|game-finale'
    if config_text.count(old) != 1:
        raise SystemExit(f'Playwright anchor missing in {config_path}')
    config.write_text(config_text.replace(old, new, 1))

print('Package S product patch applied')
