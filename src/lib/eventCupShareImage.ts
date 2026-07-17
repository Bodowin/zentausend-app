import { playerColor } from './colors'
import type { EventCupSummary } from './eventCup'
import type { ShareImageResult } from './shareImage'

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const W = 1080
const H = 1350

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

function card(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = 'rgba(18,25,40,0.92)',
  stroke = 'rgba(102,114,143,0.18)',
) {
  roundedPath(ctx, x, y, width, height, 28)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.stroke()
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, startSize: number, weight = 800): number {
  let size = startSize
  while (size > 22) {
    ctx.font = `${weight} ${size}px ${FONT}`
    if (ctx.measureText(value).width <= maxWidth) return size
    size -= 2
  }
  ctx.font = `${weight} ${size}px ${FONT}`
  return size
}

function date(value: string): string {
  return new Date(value).toLocaleDateString('de-DE')
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'event-cup'
}

export async function shareEventCupImage(summary: EventCupSummary): Promise<ShareImageResult> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return 'text'

  const background = ctx.createLinearGradient(0, 0, W, H)
  background.addColorStop(0, '#111827')
  background.addColorStop(0.55, '#090e19')
  background.addColorStop(1, '#05070c')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(820, 160, 10, 820, 160, 540)
  glow.addColorStop(0, 'rgba(245,184,61,0.24)')
  glow.addColorStop(1, 'rgba(245,184,61,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 700)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#f5b83d'
  ctx.font = `900 65px ${FONT}`
  ctx.fillText('10.000', 70, 105)
  ctx.fillStyle = '#75819d'
  ctx.font = `800 22px ${FONT}`
  ctx.fillText('U R L A U B S - C U P', 72, 144)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#8d98b0'
  ctx.font = `650 22px ${FONT}`
  ctx.fillText(`${date(summary.from)} – ${date(summary.to)}`, W - 70, 104)
  ctx.fillText(`${summary.games.length} ${summary.games.length === 1 ? 'Spiel' : 'Spiele'}`, W - 70, 140)

  card(ctx, 70, 192, W - 140, 272, 'rgba(18,25,40,0.94)', 'rgba(245,184,61,0.36)')
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8d98b0'
  ctx.font = `850 22px ${FONT}`
  ctx.fillText(summary.champions.length > 1 ? 'GEMEINSAME CHAMPIONS' : 'URLAUBS-CHAMPION', W / 2, 250)
  fitText(ctx, summary.event, W - 260, 38, 750)
  ctx.fillStyle = '#c5cde0'
  ctx.fillText(summary.event, W / 2, 302)
  const championNames = summary.champions.map((entry) => entry.name).join(' & ')
  fitText(ctx, championNames, W - 220, 66, 900)
  ctx.fillStyle = '#f5c75f'
  ctx.fillText(championNames, W / 2, 386)
  const champion = summary.champions[0]
  ctx.fillStyle = '#8d98b0'
  ctx.font = `700 23px ${FONT}`
  ctx.fillText(
    `${champion.wins} ${champion.wins === 1 ? 'Sieg' : 'Siege'} · ${(champion.winRate * 100).toFixed(0)} % · Ø Platz ${champion.averagePlacement.toFixed(2).replace('.', ',')}`,
    W / 2,
    432,
  )

  ctx.textAlign = 'left'
  ctx.fillStyle = '#75819d'
  ctx.font = `800 21px ${FONT}`
  ctx.fillText('GESAMTSTAND', 74, 526)

  const displayed = summary.standings.slice(0, 6)
  const rowHeight = 76
  let y = 548
  for (let index = 0; index < displayed.length; index += 1) {
    const standing = displayed[index]
    const highlight = standing.rank === 1
    card(
      ctx,
      70,
      y,
      W - 140,
      rowHeight - 8,
      highlight ? 'rgba(245,184,61,0.11)' : 'rgba(20,27,43,0.78)',
      highlight ? 'rgba(245,184,61,0.30)' : 'rgba(102,114,143,0.16)',
    )
    ctx.textAlign = 'center'
    ctx.fillStyle = highlight ? '#f5b83d' : '#303a50'
    ctx.beginPath()
    ctx.arc(112, y + 34, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = highlight ? '#111827' : '#c5cde0'
    ctx.font = `900 21px ${FONT}`
    ctx.fillText(String(standing.rank), 112, y + 41)

    ctx.fillStyle = playerColor(standing.name)
    ctx.beginPath()
    ctx.arc(160, y + 34, 9, 0, Math.PI * 2)
    ctx.fill()

    ctx.textAlign = 'left'
    fitText(ctx, standing.name, 345, 30, highlight ? 850 : 700)
    ctx.fillStyle = highlight ? '#f5c75f' : '#d7ddec'
    ctx.fillText(standing.name, 188, y + 42)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#8d98b0'
    ctx.font = `700 20px ${FONT}`
    ctx.fillText(`${standing.wins} S`, 620, y + 41)
    ctx.fillText(`${Math.round(standing.winRate * 100)} %`, 740, y + 41)
    ctx.fillText(`Ø ${standing.averagePlacement.toFixed(2).replace('.', ',')}`, 865, y + 41)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#75819d'
    ctx.font = `650 18px ${FONT}`
    ctx.fillText(`${standing.games} Sp.`, W - 92, y + 40)
    y += rowHeight
  }

  if (summary.standings.length > displayed.length) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#75819d'
    ctx.font = `650 18px ${FONT}`
    ctx.fillText(`+ ${summary.standings.length - displayed.length} weitere`, W / 2, y + 8)
  }

  if (summary.records.length > 0) {
    const recordsY = 1065
    ctx.textAlign = 'left'
    ctx.fillStyle = '#75819d'
    ctx.font = `800 21px ${FONT}`
    ctx.fillText('EVENT-REKORDE', 74, recordsY)
    const shown = summary.records.slice(0, 3)
    const gap = 14
    const width = (W - 140 - gap * (shown.length - 1)) / shown.length
    shown.forEach((record, index) => {
      const x = 70 + index * (width + gap)
      card(ctx, x, recordsY + 20, width, 170)
      ctx.textAlign = 'left'
      ctx.font = `900 27px ${FONT}`
      ctx.fillStyle = '#f5b83d'
      ctx.fillText(record.emoji, x + 18, recordsY + 58)
      fitText(ctx, record.title.toUpperCase(), width - 36, 17, 800)
      ctx.fillStyle = '#75819d'
      ctx.fillText(record.title.toUpperCase(), x + 18, recordsY + 91)
      fitText(ctx, record.name, width - 36, 25, 850)
      ctx.fillStyle = '#eef2fb'
      ctx.fillText(record.name, x + 18, recordsY + 126)
      fitText(ctx, record.detail, width - 36, 16, 650)
      ctx.fillStyle = '#8d98b0'
      ctx.fillText(record.detail, x + 18, recordsY + 154)
    })
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#56617a'
  ctx.font = `650 19px ${FONT}`
  ctx.fillText('Erstellt mit 10.000 – Die Clique', W / 2, H - 42)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return 'text'

  const fileName = `10000-${slug(summary.event)}-cup.png`
  const file = new File([blob], fileName, { type: 'image/png' })
  try {
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: `${summary.event} – Urlaubs-Cup` })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'downloaded'
}
