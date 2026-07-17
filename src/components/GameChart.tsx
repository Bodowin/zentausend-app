import { useMemo, useRef, useState } from 'react'
import type { GameAnalysis } from '../lib/storage'
import { playerColor } from '../lib/colors'
import { spreadChartLabels } from '../lib/chartLabelLayout'

/**
 * Spielverlaufs-Kurve: kumulierte Punkte pro Runde, eine Linie je Spieler.
 * Identität nie nur über Farbe: Legende + Direktlabels an den Linienenden,
 * die Rundentabelle darunter ist die Tabellen-Ansicht derselben Daten.
 */
export function GameChart({ analysis }: { analysis: GameAnalysis }) {
  const names = analysis.players.map((p) => p.name)
  const rounds = analysis.roundNumbers
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Kumulierte Serie je Spieler; Index 0 = Start (0 Punkte), dann je Runde.
  const series = useMemo(
    () =>
      names.map((name) => {
        let cum = 0
        const pts = [0]
        for (const r of rounds) {
          cum += analysis.roundPoints[r]?.[name] ?? 0
          pts.push(cum)
        }
        return { name, pts }
      }),
    [analysis, names, rounds],
  )

  const steps = rounds.length // x-Schritte nach dem Start
  const maxVal = Math.max(1, ...series.map((s) => s.pts[s.pts.length - 1]))
  // Runde y-Obergrenze in 500er-Schritten für saubere Gitterlinien.
  const yMax = Math.max(500, Math.ceil(maxVal / 500) * 500)

  const W = 340, H = 180
  const directLabels = names.length <= 4
  const PAD = { l: 34, r: directLabels ? 46 : 10, t: 8, b: 18 }
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (steps === 0 ? 0 : (i / steps) * iw)
  const y = (v: number) => PAD.t + ih - (v / yMax) * ih
  const endLabels = new Map(
    directLabels
      ? spreadChartLabels(
          series.map((entry) => ({
            id: entry.name,
            y: y(entry.pts[entry.pts.length - 1]),
          })),
          PAD.t + 6,
          PAD.t + ih - 6,
          12,
        ).map((entry) => [entry.id, entry.labelY] as const)
      : [],
  )

  const fmtShort = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('de-DE')}k` : `${v}`)
  const grid = [0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || steps === 0) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - PAD.l) / iw) * steps)
    setHover(Math.max(0, Math.min(steps, i)))
  }

  // Tooltip-Daten am Hover-Punkt (nach Punktestand sortiert).
  const tip =
    hover === null
      ? null
      : [...series].map((s) => ({ name: s.name, v: s.pts[hover] ?? 0 })).sort((a, b) => b.v - a.v)

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Spielverlauf</h2>
      <div className="rounded-2xl border border-ink-700/80 bg-ink-850/80 p-3">
        {/* Legende (Identität nie nur über Farbe) */}
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1">
          {names.map((n) => (
            <span key={n} className="flex items-center gap-1.5 text-[11px] font-semibold text-fog-300">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: playerColor(n) }} />
              {n}
            </span>
          ))}
        </div>

        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {/* Gitter (zurückhaltend) + y-Beschriftung in Text-Tönen */}
            {grid.map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#1c2333" strokeWidth={1} />
                <text x={PAD.l - 5} y={y(v) + 3} textAnchor="end" fontSize={8} fill="#5c6679">
                  {fmtShort(v)}
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#2a3348" strokeWidth={1} />
            {/* x-Beschriftung: Runden */}
            {rounds.map((r, ri) => (
              <text key={r} x={x(ri + 1)} y={H - 5} textAnchor="middle" fontSize={8} fill="#5c6679">
                {r}
              </text>
            ))}

            {/* Crosshair */}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="#3a4560" strokeWidth={1} />
            )}

            {/* Linien je Spieler */}
            {series.map((s) => {
              const d = s.pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
              const c = playerColor(s.name)
              const lastV = s.pts[s.pts.length - 1]
              const lineY = y(lastV)
              const labelY = endLabels.get(s.name) ?? lineY
              return (
                <g key={s.name}>
                  <path d={d} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {/* Endpunkt mit Surface-Ring (hebt Überlappungen ab) */}
                  <circle cx={x(steps)} cy={y(lastV)} r={3.5} fill={c} stroke="#0e1320" strokeWidth={2} />
                  {directLabels && (
                     <>
                       {Math.abs(labelY - lineY) > 1 && (
                         <line
                           x1={x(steps) + 3}
                           x2={x(steps) + 7}
                           y1={lineY}
                           y2={labelY}
                           stroke={c}
                           strokeWidth={1}
                           opacity={0.65}
                         />
                       )}
                       <text
                         x={x(steps) + 8}
                         y={labelY + 3}
                         fontSize={9}
                         fontWeight={700}
                         fill="#c4ccdc"
                         stroke="#0e1320"
                         strokeWidth={3}
                         paintOrder="stroke"
                       >
                         {s.name.length > 6 ? `${s.name.slice(0, 6)}…` : s.name}
                       </text>
                     </>
                   )}
                  {/* Hover-Marker */}
                  {hover !== null && (
                    <circle cx={x(hover)} cy={y(s.pts[hover] ?? 0)} r={3} fill={c} stroke="#0e1320" strokeWidth={2} />
                  )}
                </g>
              )
            })}
          </svg>

          {/* Tooltip */}
          {tip && hover !== null && (
            <div
              className="pointer-events-none absolute top-1 z-10 rounded-lg border border-ink-700 bg-ink-900/95 px-2.5 py-1.5 shadow-lg"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                transform: `translateX(${hover > steps / 2 ? '-108%' : '8%'})`,
              }}
            >
              <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-fog-500">
                {hover === 0 ? 'Start' : `Runde ${rounds[hover - 1]}`}
              </div>
              {tip.map((t) => (
                <div key={t.name} className="flex items-center gap-1.5 text-[10px] text-fog-200">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: playerColor(t.name) }} />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="font-mono font-bold text-fog-100">{t.v.toLocaleString('de-DE')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
