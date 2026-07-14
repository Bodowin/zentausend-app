import { useMemo } from 'react'
import type { GameRecord } from '../lib/types'
import { computePlayerProfile } from '../lib/playerProfiles'
import { playerColor } from '../lib/colors'
import { IconBack, IconTrophy } from './Icons'

const fmt = (value: number) => value.toLocaleString('de-DE')
const pct = (value: number) => `${Math.round(value * 100)} %`

export function PlayerProfileScreen({
  playerId,
  games,
  event,
  onBack,
}: {
  playerId: string
  games: GameRecord[]
  event?: string
  onBack: () => void
}) {
  const profile = useMemo(() => computePlayerProfile(playerId, games, event), [playerId, games, event])

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
        <header className="mb-6 mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-black text-fog-100">Spielerprofil</h1>
          <button onClick={onBack} className="rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm font-semibold text-fog-300">
            <IconBack className="mr-1 inline h-4 w-4" /> Zurück
          </button>
        </header>
        <div className="grid flex-1 place-items-center text-center text-fog-500">Für dieses Profil wurden keine Spiele gefunden.</div>
      </div>
    )
  }

  const color = playerColor(profile.name)
  const scoreMax = Math.max(1, ...profile.recentResults.map((result) => result.score))
  const turnCoverage = profile.games ? profile.gamesWithTurnData / profile.games : 0

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
      <header className="mb-4 mt-2 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog-600">Persönliches Profil</div>
          <h1 className="truncate text-2xl font-black text-fog-100">{profile.name}</h1>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm font-semibold text-fog-300 transition-colors hover:text-fog-100"
        >
          <IconBack className="h-4 w-4" /> Zurück
        </button>
      </header>

      <section className="mb-4 overflow-hidden rounded-3xl border border-ink-700/80 bg-ink-850/80 p-5">
        <div className="flex items-center gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border text-2xl font-black shadow-lg"
            style={{ borderColor: `${color}80`, backgroundColor: `${color}1f`, color }}
          >
            {profile.name.trim().slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <IconTrophy className="h-4 w-4 text-gold-400" />
              <span className="font-bold text-gold-400">
                {profile.wins} {profile.wins === 1 ? 'Sieg' : 'Siege'}
              </span>
            </div>
            <div className="mt-1 text-sm text-fog-400">
              {profile.games} {profile.games === 1 ? 'Spiel' : 'Spiele'} · Siegquote {pct(profile.winRate)}
            </div>
            {event && <div className="mt-1 truncate text-xs font-semibold text-mint-400">Gefiltert: {event}</div>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Metric label="Ø Endstand" value={fmt(profile.avgScore)} />
          <Metric label="Bestwert" value={fmt(profile.bestScore)} />
          <Metric label="Nieten / Spiel" value={profile.bustsPerGame.toFixed(1)} />
          <Metric label="Längste Siegesserie" value={`${profile.longestWinStreak}`} />
        </div>
      </section>

      {profile.recentResults.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-end justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-fog-500">Letzte Spiele</h2>
            <span className="text-[10px] text-fog-600">neuestes rechts</span>
          </div>
          <div className="rounded-2xl border border-ink-700/80 bg-ink-850/70 p-4">
            <div className="flex h-28 items-end gap-2">
              {[...profile.recentResults].reverse().map((result) => {
                const height = Math.max(12, Math.round((result.score / scoreMax) * 88))
                return (
                  <div key={result.gameId} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[9px] font-mono text-fog-500">{Math.round(result.score / 100) / 10}k</span>
                    <div
                      className={`w-full rounded-t-lg ${result.won ? 'bg-gold-500/70' : 'bg-ink-600/80'}`}
                      style={{ height }}
                      title={`${new Date(result.date).toLocaleDateString('de-DE')}: ${fmt(result.score)} Punkte`}
                    />
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-black ${result.won ? 'bg-gold-500/20 text-gold-400' : 'bg-ink-800 text-fog-500'}`}>
                      {result.won ? 'S' : result.rank}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-fog-600">
              <span>S = Sieg</span>
              <span>Aktuelle Serie: {profile.currentWinStreak}</span>
            </div>
          </div>
        </section>
      )}

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Spielweise</h2>
        <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/70">
          <ProfileRow label="Ø erfolgreicher Zug" value={profile.avgSuccessfulTurn === null ? '–' : fmt(profile.avgSuccessfulTurn)} />
          <ProfileRow label="Bester Einzelzug" value={profile.bestTurn ? fmt(profile.bestTurn.points) : '–'} />
          <ProfileRow label="Ø Spieldauer" value={profile.avgRounds === null ? '–' : `${profile.avgRounds.toLocaleString('de-DE')} Runden`} />
          <ProfileRow label="Schnellster Sieg" value={profile.fastestWinRounds === null ? '–' : `${profile.fastestWinRounds} Runden`} />
        </div>
        <div className="mt-2 rounded-xl border border-ink-700/60 bg-ink-900/40 px-3 py-2 text-[10px] leading-relaxed text-fog-500">
          Zugdaten vorhanden für {profile.gamesWithTurnData} von {profile.games} Spielen ({pct(turnCoverage)}).
          {profile.gamesWithTurnData < profile.games && ' Ältere Spiele bleiben in Endstand, Siegen und Nieten enthalten.'}
        </div>
      </section>

      {profile.nemesis && (
        <section className="mb-5 rounded-2xl border border-coral-500/25 bg-coral-500/8 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-coral-400">Angstgegner</div>
          <div className="mt-1 text-lg font-black text-fog-100">{profile.nemesis.name}</div>
          <div className="mt-1 text-xs text-fog-400">
            In {profile.nemesis.ahead} von {profile.nemesis.games} gemeinsamen Spielen vor {profile.name}.
          </div>
        </section>
      )}

      {profile.events.length > 1 && !event && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Nach Anlass</h2>
          <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/70">
            {profile.events.map((entry) => (
              <div key={entry.event} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-ink-800/60 px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-fog-100">{entry.event}</div>
                  <div className="text-[10px] text-fog-500">{entry.games} Spiele · Ø {fmt(entry.avgScore)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-gold-400">{entry.wins} S</div>
                  <div className="text-[10px] text-fog-500">{pct(entry.winRate)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Jüngste Ergebnisse</h2>
        <div className="space-y-2">
          {profile.recentResults.map((result) => (
            <div key={result.gameId} className="flex items-center justify-between gap-3 rounded-2xl border border-ink-700/70 bg-ink-850/60 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-fog-300">{new Date(result.date).toLocaleDateString('de-DE')}</div>
                <div className="truncate text-[10px] text-fog-600">{result.event || 'Ohne Anlass'}</div>
              </div>
              <div className="text-right">
                <div className={`font-mono font-bold ${result.won ? 'text-gold-400' : 'text-fog-300'}`}>{fmt(result.score)}</div>
                <div className="text-[10px] text-fog-600">Platz {result.rank} von {result.playerCount}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-700/70 bg-ink-900/50 px-3 py-3">
      <div className="text-[9px] font-bold uppercase tracking-wider text-fog-600">{label}</div>
      <div className="mt-1 font-mono text-lg font-black text-fog-100">{value}</div>
    </div>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-800/60 px-4 py-3 text-sm last:border-0">
      <span className="text-fog-500">{label}</span>
      <span className="text-right font-mono font-bold text-fog-200">{value}</span>
    </div>
  )
}
