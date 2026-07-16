import { useState } from 'react'
import { IconRefresh, IconTrash } from './Icons'
import { PAUSE_ARCHIVE_AFTER_DAYS, type PausedGameItem } from '../lib/pausedGames'

interface Props {
  paused: PausedGameItem[]
  archived: PausedGameItem[]
  onResume: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

const DAY_MS = 24 * 60 * 60 * 1000

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Zeitpunkt unbekannt'
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function daysUntilArchive(item: PausedGameItem): number {
  const paused = Date.parse(item.pausedAt)
  if (!Number.isFinite(paused)) return PAUSE_ARCHIVE_AFTER_DAYS
  const elapsed = Math.max(0, Date.now() - paused)
  return Math.max(0, Math.ceil(PAUSE_ARCHIVE_AFTER_DAYS - elapsed / DAY_MS))
}

function GameCard({
  item,
  archived,
  deleting,
  onResume,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  item: PausedGameItem
  archived: boolean
  deleting: boolean
  onResume: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  const game = item.game
  if (!game) return null
  const names = game.players.map((player) => player.name).join(', ')
  const current = game.players[game.idx]?.name ?? 'Unbekannt'

  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900/70 p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onResume}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-label={`${archived ? 'Archiviertes' : 'Pausiertes'} Spiel ${names} fortsetzen`}
        >
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              archived ? 'bg-ink-700 text-fog-400' : 'bg-gold-500/20 text-gold-400'
            }`}
          >
            <IconRefresh className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-bold text-fog-100">{game.event || names}</span>
            <span className="mt-0.5 text-xs text-fog-400">
              Runde {game.round} · {current} ist dran{game.testMode ? ' · TEST' : ''}
            </span>
            <span className="mt-1 truncate text-[11px] text-fog-500">
              {game.players.map((player) => `${player.name} ${player.score.toLocaleString('de-DE')}`).join(' · ')}
            </span>
            <span className="mt-1 text-[10px] text-fog-600">
              {archived
                ? `Archiviert · pausiert am ${formatDate(item.pausedAt)}`
                : `${daysUntilArchive(item)} Tage bis zum Archiv · ${formatDate(item.pausedAt)}`}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onAskDelete}
          className="shrink-0 rounded-lg p-2 text-fog-600 transition-colors hover:bg-coral-500/10 hover:text-coral-400"
          aria-label={`${names} endgültig löschen`}
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </div>

      {deleting && (
        <div className="mt-3 rounded-xl border border-coral-500/30 bg-coral-500/10 p-3" role="alert">
          <p className="text-xs font-semibold text-coral-200">Dieses pausierte Spiel wirklich endgültig löschen?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs font-bold text-fog-300"
            >
              Behalten
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg bg-coral-500 px-3 py-2 text-xs font-black text-white"
            >
              Löschen
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

export function PausedGamesPanel({ paused, archived, onResume, onDelete }: Props) {
  const [showArchive, setShowArchive] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  if (paused.length === 0 && archived.length === 0) return null

  return (
    <section className="mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-xl shadow-black/30 animate-rise">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-fog-100">Pausierte Spiele</h2>
          <p className="mt-0.5 text-[10px] text-fog-500">14 Tage direkt sichtbar, danach sicher im Archiv.</p>
        </div>
        <span className="rounded-full bg-ink-800 px-2.5 py-1 text-xs font-black text-gold-400">{paused.length}</span>
      </div>

      {paused.length > 0 ? (
        <div className="space-y-2">
          {paused.map((item) => (
            <GameCard
              key={item.sessionId}
              item={item}
              archived={false}
              deleting={deleteId === item.sessionId}
              onResume={() => onResume(item.sessionId)}
              onAskDelete={() => setDeleteId(item.sessionId)}
              onCancelDelete={() => setDeleteId(null)}
              onDelete={() => {
                onDelete(item.sessionId)
                setDeleteId(null)
              }}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-ink-800 bg-ink-900/50 px-3 py-2 text-xs text-fog-500">
          Derzeit kein Spiel in der direkten Pausenliste.
        </p>
      )}

      {archived.length > 0 && (
        <div className="mt-3 border-t border-ink-800 pt-3">
          <button
            type="button"
            onClick={() => setShowArchive((current) => !current)}
            className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left text-sm font-bold text-fog-300"
            aria-expanded={showArchive}
          >
            <span>Archiv ({archived.length})</span>
            <span className="text-fog-600">{showArchive ? '▲' : '▼'}</span>
          </button>
          {showArchive && (
            <div className="mt-2 space-y-2">
              {archived.map((item) => (
                <GameCard
                  key={item.sessionId}
                  item={item}
                  archived
                  deleting={deleteId === item.sessionId}
                  onResume={() => onResume(item.sessionId)}
                  onAskDelete={() => setDeleteId(item.sessionId)}
                  onCancelDelete={() => setDeleteId(null)}
                  onDelete={() => {
                    onDelete(item.sessionId)
                    setDeleteId(null)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
