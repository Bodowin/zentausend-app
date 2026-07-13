import { useMemo, useState } from 'react'
import type { GameRecord, PlayerStats } from '../lib/types'
import {
  aliasesForIdentity,
  getPlayerIdentityRecoveryCount,
  mergePlayerIdentities,
  undoLastPlayerIdentityMerge,
} from '../lib/playerIdentity'
import { IconX } from './Icons'

interface Props {
  games: GameRecord[]
  players: PlayerStats[]
  onClose: () => void
  onChanged: (message: string) => void
}

export function PlayerManager({ games, players, onClose, onChanged }: Props) {
  const [sourceId, setSourceId] = useState(players[1]?.id ?? '')
  const [targetId, setTargetId] = useState(players[0]?.id ?? '')
  const recoveryCount = getPlayerIdentityRecoveryCount()
  const source = players.find((player) => player.id === sourceId)
  const target = players.find((player) => player.id === targetId)

  const profiles = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        aliases: aliasesForIdentity(player.id, games),
      })),
    [games, players],
  )

  const merge = () => {
    if (!source || !target || source.id === target.id) return
    const confirmed = window.confirm(
      `„${source.name}“ mit „${target.name}“ zusammenführen?\n\n` +
        `${source.games} Spiel${source.games === 1 ? '' : 'e'} werden künftig dem Zielprofil zugerechnet. ` +
        `Die Originalspiele bleiben unverändert und die Aktion kann rückgängig gemacht werden.`,
    )
    if (!confirmed) return

    try {
      const result = mergePlayerIdentities(source.id, target.id, games)
      const variants = result.sourceNames.length ? ` (${result.sourceNames.join(', ')})` : ''
      onChanged(`${source.name}${variants} wurde mit ${result.targetName} zusammengeführt.`)
    } catch (error) {
      onChanged(error instanceof Error ? error.message : 'Zusammenführen fehlgeschlagen.')
    }
  }

  const undo = () => {
    if (!window.confirm('Letzte Spieler-Zusammenführung rückgängig machen?')) return
    if (undoLastPlayerIdentityMerge()) onChanged('Letzte Spieler-Zusammenführung wurde rückgängig gemacht.')
    else onChanged('Keine Zusammenführung zum Rückgängigmachen gefunden.')
  }

  return (
    <div
      className="glass fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Spieler verwalten"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-md rounded-3xl border border-ink-700 bg-ink-850 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-fog-100">Spieler verwalten</h2>
            <p className="mt-1 text-xs leading-relaxed text-fog-500">
              Namensvarianten werden nur nach deiner ausdrücklichen Auswahl verbunden. Spiele bleiben unverändert.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ink-700 bg-ink-900 text-fog-400"
            aria-label="Spielerverwaltung schließen"
          >
            <IconX className="h-4 w-4" />
          </button>
        </header>

        <section className="mb-5">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-fog-600">Erkannte Profile</h3>
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-xl border border-ink-700/70 bg-ink-900/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-fog-100">{profile.name}</span>
                  <span className="text-[10px] text-fog-500">
                    {profile.games} Sp. · {profile.wins} S.
                  </span>
                </div>
                {profile.aliases.length > 1 && (
                  <div className="mt-1 text-[10px] text-gold-400/80">Varianten: {profile.aliases.join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {players.length >= 2 ? (
          <section className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-4">
            <h3 className="font-bold text-gold-300">Zwei Profile zusammenführen</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-fog-500">
              Das Zielprofil behält seinen Namen. Statistiken werden sofort gemeinsam berechnet.
            </p>

            <label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-fog-600" htmlFor="merge-source">
              Dieses Profil auflösen
            </label>
            <select
              id="merge-source"
              value={sourceId}
              onChange={(event) => {
                const next = event.target.value
                if (next === targetId) setTargetId(sourceId)
                setSourceId(next)
              }}
              className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-sm font-semibold text-fog-100"
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} · {player.games} {player.games === 1 ? 'Spiel' : 'Spiele'}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-fog-600" htmlFor="merge-target">
              In dieses Zielprofil
            </label>
            <select
              id="merge-target"
              value={targetId}
              onChange={(event) => {
                const next = event.target.value
                if (next === sourceId) setSourceId(targetId)
                setTargetId(next)
              }}
              className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-sm font-semibold text-fog-100"
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} · {player.games} {player.games === 1 ? 'Spiel' : 'Spiele'}
                </option>
              ))}
            </select>

            {source && target && source.id !== target.id && (
              <div className="mt-3 rounded-xl bg-ink-950/60 px-3 py-2 text-xs text-fog-400">
                Danach: <strong className="text-fog-200">{target.name}</strong> mit {source.games + target.games} Spielen und{' '}
                {source.wins + target.wins} Siegen.
              </div>
            )}

            <button
              type="button"
              onClick={merge}
              disabled={!source || !target || source.id === target.id}
              className="mt-3 w-full rounded-xl bg-gold-500 px-4 py-3 text-sm font-black text-ink-950 disabled:opacity-40"
            >
              Profile sicher zusammenführen
            </button>
          </section>
        ) : (
          <p className="rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-3 text-xs text-fog-500">
            Für eine Zusammenführung werden mindestens zwei Spielerprofile benötigt.
          </p>
        )}

        {recoveryCount > 0 && (
          <button
            type="button"
            onClick={undo}
            className="mt-3 w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-xs font-semibold text-fog-300"
          >
            Letzte Zusammenführung rückgängig · {recoveryCount} Sicherung{recoveryCount === 1 ? '' : 'en'}
          </button>
        )}
      </div>
    </div>
  )
}
