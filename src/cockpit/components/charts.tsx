// Eigene, leichtgewichtige SVG-Charts nach den Dataviz-Regeln:
// dünne Marken (2px-Linien, Flächen als 10%-Wash), Haarlinien-Grid,
// Crosshair + Tooltip, Legende ab 2 Serien, Text immer in Tinten-Tokens.

import { useEffect, useRef, useState, type ReactNode } from 'react'

export const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
] as const

/** Container-Breite beobachten (responsive Charts ohne Lib). */
export function useMeasure<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** „Schöne“ Achsen-Ticks (1/2/5er-Raster). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min]
  }
  const span = max - min
  const step0 = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(v)
  return ticks
}

function TooltipBox({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-edge bg-raised px-3 py-2 text-xs shadow-xl"
      style={{ left: x, top: y, transform: 'translate(-50%, calc(-100% - 10px))', maxWidth: 240 }}
    >
      {children}
    </div>
  )
}

export function LegendRow({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden>
            <line
              x1="0" y1="4" x2="16" y2="4"
              stroke={it.color} strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={it.dashed ? '3 4' : undefined}
            />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Linien-/Flächen-Chart mit Crosshair-Tooltip
// ---------------------------------------------------------------------------

export interface LineSeries {
  name: string
  color: string
  /** y-Werte; alle Serien teilen sich dieselben x-Positionen/Labels */
  values: number[]
  area?: boolean
  dashed?: boolean
}

export function LineChart({
  labels,
  series,
  height = 220,
  formatY,
  formatLabel,
  yMinZero = false,
}: {
  labels: string[]
  series: LineSeries[]
  height?: number
  formatY: (v: number) => string
  formatLabel?: (label: string, index: number) => string
  yMinZero?: boolean
}) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const pad = { top: 12, right: 16, bottom: 24, left: 8 }
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const rawMin = yMinZero ? 0 : Math.min(...all)
  const rawMax = Math.max(...all)
  const spanPad = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.08
  const yMin = yMinZero ? 0 : rawMin - spanPad
  const yMax = rawMax + spanPad
  const ticks = niceTicks(yMin, yMax, 4)

  // Platz links für die Achsen-Beschriftung reservieren
  const yLabelW = Math.max(...ticks.map((t) => formatY(t).length), 4) * 7 + 8
  const plotLeft = pad.left + yLabelW
  const plotW = Math.max(10, width - plotLeft - pad.right)
  const plotH = height - pad.top - pad.bottom

  const x = (i: number) =>
    plotLeft + (labels.length > 1 ? (i / (labels.length - 1)) * plotW : plotW / 2)
  const y = (v: number) => pad.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH

  const pathFor = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const t = (mx - plotLeft) / (plotW || 1)
    const idx = Math.round(t * (labels.length - 1))
    setHover(Math.min(labels.length - 1, Math.max(0, idx)))
  }

  const fmtL = formatLabel ?? ((l: string) => l)
  const labelStep = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(plotW / 70))))

  return (
    <div className="relative" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Grid (Haarlinien, durchgezogen) + y-Beschriftung */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={plotLeft} x2={plotLeft + plotW} y1={y(t)} y2={y(t)}
                stroke="var(--color-grid)" strokeWidth="1"
              />
              <text
                x={plotLeft - 6} y={y(t) + 3} textAnchor="end"
                className="tnum" fontSize="10" fill="var(--color-ink-mute)"
              >
                {formatY(t)}
              </text>
            </g>
          ))}
          {/* x-Beschriftung */}
          {labels.map((l, i) =>
            i % labelStep === 0 ? (
              <text
                key={i} x={x(i)} y={height - 6} textAnchor="middle"
                fontSize="10" fill="var(--color-ink-mute)"
              >
                {fmtL(l, i)}
              </text>
            ) : null,
          )}
          {/* Flächen-Wash */}
          {series.map((s) =>
            s.area ? (
              <path
                key={`a-${s.name}`}
                d={`${pathFor(s.values)} L${x(s.values.length - 1)},${y(Math.max(yMin, 0))} L${x(0)},${y(Math.max(yMin, 0))} Z`}
                fill={s.color}
                opacity="0.1"
              />
            ) : null,
          )}
          {/* Linien */}
          {series.map((s) => (
            <path
              key={s.name}
              d={pathFor(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '4 5' : undefined}
            />
          ))}
          {/* Crosshair + Marker mit Flächen-Ring */}
          {hover !== null && (
            <g>
              <line
                x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH}
                stroke="var(--color-edge)" strokeWidth="1"
              />
              {series.map((s) => (
                <circle
                  key={s.name}
                  cx={x(hover)} cy={y(s.values[hover])} r="4.5"
                  fill={s.color} stroke="var(--color-card)" strokeWidth="2"
                />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <TooltipBox x={x(hover)} y={pad.top + 4}>
          <div className="mb-1 font-medium text-ink">{fmtL(labels[hover], hover)}</div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-ink-soft">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span>{s.name}</span>
              <span className="tnum ml-auto pl-3 text-ink">{formatY(s.values[hover])}</span>
            </div>
          ))}
        </TooltipBox>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Donut (Allokation) – max. 6 Segmente + „Übrige“, 2px Flächen-Lücken
// ---------------------------------------------------------------------------

export interface DonutSlice {
  label: string
  value: number
  color: string
}

export function Donut({
  slices,
  centerLabel,
  centerValue,
  size = 168,
  format,
}: {
  slices: DonutSlice[]
  centerLabel: string
  centerValue: string
  size?: number
  format: (v: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = size / 2 - 10
  const rInner = r - 16
  const cx = size / 2
  const cy = size / 2

  let angle = -Math.PI / 2
  const arcs = slices.map((s) => {
    const frac = total > 0 ? s.value / total : 0
    const a0 = angle
    const a1 = angle + frac * Math.PI * 2
    angle = a1
    return { ...s, a0, a1, frac }
  })

  const point = (a: number, radius: number) =>
    `${cx + Math.cos(a) * radius},${cy + Math.sin(a) * radius}`

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img">
          {arcs.map((a, i) => {
            const large = a.a1 - a.a0 > Math.PI ? 1 : 0
            const rr = hover === i ? r + 3 : r
            return (
              <path
                key={a.label}
                d={`M${point(a.a0, rr)} A${rr},${rr} 0 ${large} 1 ${point(a.a1, rr)} L${point(a.a1, rInner)} A${rInner},${rInner} 0 ${large} 0 ${point(a.a0, rInner)} Z`}
                fill={a.color}
                stroke="var(--color-card)"
                strokeWidth="2"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ transition: 'all 0.15s ease' }}
              >
                <title>{`${a.label}: ${format(a.value)} (${Math.round(a.frac * 100)} %)`}</title>
              </path>
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hover !== null && arcs[hover] ? (
            <>
              <div className="text-[11px] text-ink-mute">{arcs[hover].label}</div>
              <div className="text-base font-semibold text-ink">
                {Math.round(arcs[hover].frac * 100)} %
              </div>
              <div className="text-[11px] text-ink-soft">{format(arcs[hover].value)}</div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-ink-mute">{centerLabel}</div>
              <div className="text-base font-semibold text-ink">{centerValue}</div>
            </>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 text-xs">
        {arcs.map((a, i) => (
          <div
            key={a.label}
            className="flex items-center gap-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: a.color }} />
            <span className="truncate text-ink-soft">{a.label}</span>
            <span className="tnum ml-auto whitespace-nowrap pl-2 text-ink">
              {Math.round(a.frac * 100)} %
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Segmente auf max. `maxSlices` begrenzen, Rest als „Übrige“ bündeln. */
export function foldSlices(
  items: { label: string; value: number }[],
  maxSlices = 6,
): DonutSlice[] {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, maxSlices - 1)
  const rest = sorted.slice(maxSlices - 1)
  const out: DonutSlice[] = head.map((it, i) => ({ ...it, color: CHART_COLORS[i] }))
  if (rest.length === 1) {
    out.push({ ...rest[0], color: CHART_COLORS[head.length] })
  } else if (rest.length > 1) {
    out.push({
      label: 'Übrige',
      value: rest.reduce((s, x) => s + x.value, 0),
      color: 'var(--color-ink-mute)',
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Horizontale Balkenliste (Gewichte, Exposures) – div-basiert
// ---------------------------------------------------------------------------

export function HBarList({
  items,
  format,
  maxItems = 8,
}: {
  items: { label: string; value: number; pct: number; color?: string }[]
  format: (v: number) => string
  maxItems?: number
}) {
  const shown = items.slice(0, maxItems)
  const maxPct = Math.max(...shown.map((i) => i.pct), 1)
  return (
    <div className="space-y-2.5">
      {shown.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-ink-soft">{it.label}</span>
            <span className="tnum shrink-0 text-ink">
              {Math.round(it.pct)} % · {format(it.value)}
            </span>
          </div>
          <div className="h-[10px] overflow-hidden rounded-r-[4px] bg-inset">
            <div
              className="h-full rounded-r-[4px]"
              style={{
                width: `${(it.pct / maxPct) * 100}%`,
                background: it.color ?? 'var(--color-chart-1)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Radar (Score-Vergleich, 2–4 Serien à 5 Achsen)
// ---------------------------------------------------------------------------

export function Radar({
  axes,
  series,
  size = 260,
}: {
  axes: string[]
  series: { name: string; color: string; values: (number | null)[] }[]
  size?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 34
  const n = axes.length
  const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2
  const pt = (i: number, v: number) =>
    `${cx + Math.cos(angle(i)) * r * (v / 100)},${cy + Math.sin(angle(i)) * r * (v / 100)}`

  return (
    <div>
      <svg
        width={size}
        height={size}
        role="img"
        className="mx-auto block"
        style={{ overflow: 'visible' }}
      >
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={axes.map((_, i) => pt(i, ring)).join(' ')}
            fill="none"
            stroke="var(--color-grid)"
            strokeWidth="1"
          />
        ))}
        {axes.map((a, i) => (
          <g key={a}>
            <line
              x1={cx} y1={cy}
              x2={cx + Math.cos(angle(i)) * r} y2={cy + Math.sin(angle(i)) * r}
              stroke="var(--color-grid)" strokeWidth="1"
            />
            <text
              x={cx + Math.cos(angle(i)) * (r + 16)}
              y={cy + Math.sin(angle(i)) * (r + 16) + 3}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-ink-mute)"
            >
              {a}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <polygon
              points={s.values.map((v, i) => pt(i, v ?? 0)).join(' ')}
              fill={s.color}
              opacity="0.12"
            />
            <polygon
              points={s.values.map((v, i) => pt(i, v ?? 0)).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {s.values.map((v, i) => (
              <circle
                key={i}
                cx={cx + Math.cos(angle(i)) * r * ((v ?? 0) / 100)}
                cy={cy + Math.sin(angle(i)) * r * ((v ?? 0) / 100)}
                r="3.5"
                fill={s.color}
                stroke="var(--color-card)"
                strokeWidth="2"
              />
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-center">
        <LegendRow items={series.map((s) => ({ label: s.name, color: s.color }))} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline für Stat-Kacheln
// ---------------------------------------------------------------------------

export function Sparkline({
  values,
  color = 'var(--color-chart-1)',
  width = 88,
  height = 28,
}: {
  values: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = (i: number) => (i / (values.length - 1)) * (width - 8) + 4
  const y = (v: number) => height - 5 - ((v - min) / (max - min || 1)) * (height - 10)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle
        cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3"
        fill={color} stroke="var(--color-card)" strokeWidth="2"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Score-Meter (0–100) – Füllung trägt die Bewertung, Track als dunkler Schritt
// ---------------------------------------------------------------------------

export function ScoreMeter({ value, color }: { value: number; color?: string }) {
  const c =
    color ??
    (value >= 65
      ? 'var(--color-gain)'
      : value >= 45
        ? 'var(--color-warn)'
        : 'var(--color-loss)')
  return (
    <div className="h-[8px] w-full overflow-hidden rounded-r-[4px] bg-inset">
      <div className="h-full rounded-r-[4px]" style={{ width: `${value}%`, background: c }} />
    </div>
  )
}
