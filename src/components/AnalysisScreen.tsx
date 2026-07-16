import { useMemo } from 'react'
import type { GameRecord } from '../lib/types'
import { computeGameAnalysis } from '../lib/storage'
import { playerColor } from '../lib/colors'
import { GameChart } from './GameChart'
import { IconBack, IconTrophy } from './Icons'

const fmt = (n: number) => n.toLocaleString('de-DE')

export function AnalysisScreen({ game, onBack }: { game: GameRecord; onBack: () => void }) {
  const a = useMemo(() => computeGameAnalysis(game), [game])

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
      <header className="mb-4 mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-fog-100">Runden-Analyse</h1>
          <p className="text-[11px] text-fog-500">
            {new Date(game.date).toLocaleDateString('de-DE')}
            {game.event ? ` · ${game.event}` : ''} · 🏆 {game.winner}
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm font-semibold text-fog-300 transition-colors hover:text-fog-100"
        >
          <IconBack className="h-4 w-4" /> Zurück
        </button>
      </header>

      {!a.hasTurns && (
        <div className="mb-4 rounded-2xl border border-ink-700/70 bg-ink-850/70 p-4 text-sm text-fog-400">
          Für dieses Spiel gibt es noch keine Zug-Daten (vor dem Update gespielt). Endstand und
          Nieten siehst du unten – die Rundentabelle entsteht ab dem nächsten Spiel.
        </div>
      )}

      {/* Highlights */}
      {a.hasTurns && (
        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <Card emoji="💥" title="Bester Zug">
            {a.bestTurn ? (
              <>
                <div className="font-bold text-fog-100">{a.bestTurn.name}</div>
                <div className="text-xs text-gold-400">
                  {fmt(a.bestTurn.points)} · R{a.bestTurn.round}
                </div>
              </>
            ) : (
              <div className="text-fog-600">–</div>
            )}
          </Card>
          <Card emoji="💀" title="Nieten">
            {a.mostBusts ? (
              <>
                <div className="font-bold text-fog-100">{a.mostBusts.name}</div>
                <div className="text-xs text-coral-400">{a.mostBusts.count}×</div>
              </>
            ) : (
              <div className="text-fog-600">keine</div>
            )}
          </Card>
          <Card emoji="🔁" title="Runden">
            <div className="text-xl font-black text-fog-100">{a.roundsCount}</div>
          </Card>
          <Card emoji="📈" title="Statistik">
            {a.statisticsDefier ? (
              <>
                <div className="truncate font-bold text-fog-100">{a.statisticsDefier.name}</div>
                <div className="text-xs text-mint-400">
                  +{a.statisticsDefier.balance.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Würfe
                </div>
              </>
            ) : (
              <div className="text-fog-600">im Soll</div>
            )}
          </Card>
        </div>
      )}

      {/* Spielverlauf: Kopf-an-Kopf-Rennen als Kurve */}
      {a.hasTurns && a.roundsCount >= 2 && <GameChart analysis={a} />}

      {/* Spieler-Tabelle */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Spieler</h2>
        <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/80">
          <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr_0.6fr_0.6fr] gap-1 border-b border-ink-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-fog-600">
            <span>Spieler</span>
            <span className="text-right">Gesamt</span>
            <span className="text-right">Ø/Zug</span>
            <span className="text-right">Züge</span>
            <span className="text-right">Niet.</span>
          </div>
          {a.players.map((p, i) => (
            <div
              key={p.name}
              className="grid grid-cols-[1.5fr_0.9fr_0.8fr_0.6fr_0.6fr] items-center gap-1 border-b border-ink-800/60 px-3 py-2.5 text-sm last:border-0"
            >
              <span className="flex items-center gap-2 font-semibold text-fog-100">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: playerColor(p.name) }} />
                {i === 0 && <IconTrophy className="h-3 w-3 text-gold-400" />}
                <span className="truncate">{p.name}</span>
              </span>
              <span className="text-right font-mono font-bold text-gold-400">{fmt(p.total)}</span>
              <span className="text-right font-mono text-fog-300">{a.hasTurns ? fmt(p.avg) : '–'}</span>
              <span className="text-right font-mono text-fog-400">{a.hasTurns ? p.turns : '–'}</span>
              <span className="text-right font-mono text-coral-400">{p.busts}</span>
            </div>
          ))}
        </div>
      </section>

      {a.hasRiskData && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Risiko-Bilanz</h2>
          <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/80">
            {a.players
              .filter((player) => player.riskAttempts > 0)
              .map((player) => (
                <div key={player.name} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-ink-800/60 px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-bold text-fog-100">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: playerColor(player.name) }} />
                      <span className="truncate">{player.name}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-fog-500">
                      {player.riskSuccesses}/{player.riskAttempts} geschafft · {player.riskExpected.toLocaleString('de-DE', { maximumFractionDigits: 1 })} erwartet
                    </div>
                  </div>
                  <div className={`font-mono text-lg font-black ${player.riskBalance >= 0 ? 'text-mint-400' : 'text-coral-400'}`}>
                    {player.riskBalance >= 0 ? '+' : ''}{player.riskBalance.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-fog-600">
            Tatsächlich überstandene Weiterwürfe minus Summe ihrer jeweiligen Erfolgswahrscheinlichkeiten. +1,8 heißt: 1,8 Würfe mehr geschafft als statistisch erwartet.
          </p>
        </section>
      )}

      {/* Runde × Spieler */}
      {a.hasTurns && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">
            Punkte pro Runde
          </h2>
          <div className="scrollbar-hide overflow-x-auto rounded-2xl border border-ink-700/80 bg-ink-850/80">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[10px] uppercase tracking-wide text-fog-600">
                  <th className="px-3 py-2 text-left font-bold">Rd.</th>
                  {a.players.map((p) => (
                    <th key={p.name} className="px-3 py-2 text-right font-bold">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: playerColor(p.name) }} />
                        <span className="max-w-[56px] truncate">{p.name}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.roundNumbers.map((r) => (
                  <tr key={r} className="border-b border-ink-800/50 last:border-0">
                    <td className="px-3 py-2 font-mono text-fog-500">{r}</td>
                    {a.players.map((p) => {
                      const v = a.roundPoints[r][p.name] ?? 0
                      return (
                        <td
                          key={p.name}
                          className={`px-3 py-2 text-right font-mono ${
                            v > 0 ? 'text-fog-200' : 'text-fog-700'
                          }`}
                        >
                          {v > 0 ? fmt(v) : '·'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="border-t border-ink-700 bg-ink-900/40 font-bold">
                  <td className="px-3 py-2 text-[10px] uppercase text-fog-500">Σ</td>
                  {a.players.map((p) => (
                    <td key={p.name} className="px-3 py-2 text-right font-mono text-gold-400">
                      {fmt(p.total)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-fog-600">
            Werte = in der jeweiligen Runde gesicherte Punkte. „·" = Niete oder kein Eintrag.
          </p>
        </section>
      )}
    </div>
  )
}

function Card({
  emoji,
  title,
  children,
}: {
  emoji: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-ink-700/70 bg-ink-850/70 p-3">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-fog-500">
        <span className="text-sm">{emoji}</span> {title}
      </div>
      {children}
    </div>
  )
}
