import type { Player } from './types'
import { playerColor } from './colors'
import { shareResult } from './share'

const FONT = '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif'

/**
 * Rendert den Endstand als hübsche Bildkarte (Canvas, ohne Extra-Paket) und
 * teilt sie über die native Teilen-Funktion. Fällt auf Download bzw. Text zurück.
 */
export async function shareResultImage(
  winner: Player,
  players: Player[],
  event: string,
): Promise<void> {
  const W = 1080
  const H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return shareResult(winner, players, event)

  // Hintergrund
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#0e1320')
  grad.addColorStop(1, '#060910')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Rahmen
  ctx.strokeStyle = 'rgba(245,184,61,0.35)'
  ctx.lineWidth = 4
  ctx.strokeRect(40, 40, W - 80, H - 80)

  ctx.textAlign = 'center'

  // Kopf
  ctx.fillStyle = '#f5b83d'
  ctx.font = `800 76px ${FONT}`
  ctx.fillText('10.000', W / 2, 160)
  ctx.fillStyle = '#66728f'
  ctx.font = `700 30px ${FONT}`
  ctx.fillText('D I E   C L I Q U E', W / 2, 210)

  // Pokal + Sieger
  ctx.font = '120px serif'
  ctx.fillText('🏆', W / 2, 360)
  ctx.fillStyle = '#eef2fb'
  ctx.font = `800 58px ${FONT}`
  ctx.fillText('SIEG', W / 2, 430)
  ctx.fillStyle = '#f5b83d'
  ctx.font = `800 72px ${FONT}`
  ctx.fillText(winner.name, W / 2, 510)

  // Rangliste
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const left = 200
  const right = W - 200
  let y = 620
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]
    ctx.beginPath()
    ctx.fillStyle = playerColor(p.name)
    ctx.arc(left - 36, y - 16, 13, 0, Math.PI * 2)
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = i === 0 ? '#f5b83d' : '#c2cbe0'
    ctx.font = `${i === 0 ? 800 : 600} 46px ${FONT}`
    ctx.fillText(`${i + 1}. ${p.name}`, left, y)

    ctx.textAlign = 'right'
    ctx.font = `700 46px ${FONT}`
    ctx.fillText(p.score.toLocaleString('de-DE'), right, y)

    ctx.textAlign = 'center'
    y += 86
  }

  // Fußzeile
  ctx.fillStyle = '#66728f'
  ctx.font = `500 30px ${FONT}`
  const date = new Date().toLocaleDateString('de-DE')
  ctx.fillText((event ? `${event} · ` : '') + date, W / 2, H - 90)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return shareResult(winner, players, event)

  const file = new File([blob], '10000-ergebnis.png', { type: 'image/png' })

  try {
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: '10.000 – Die Clique' })
      return
    }
  } catch {
    return // Nutzer hat abgebrochen.
  }

  // Fallback: Bild herunterladen.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '10000-ergebnis.png'
  a.click()
  URL.revokeObjectURL(url)
}
