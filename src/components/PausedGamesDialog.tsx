import { useMemo, useState } from 'react'
import type { ActiveGame } from '../lib/activeGame'
import { splitPausedGames } from '../lib/pausedGames'
import { IconRefresh, IconTrash, IconX } from './Icons'

interface Props {
  games: ActiveGame[]
  onResume: (game: ActiveGame) => void
  onDelete: (sessionId: string) => void
  onClose: () => void
}

const formatSavedAt = (savedAt: string) => {
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return 'Zeitpunkt unbekannt'
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const gameTitle = (game: ActiveGame) => game.event.trim() || game.players.map((player) => player.name).join(', ')

function GameCard({
  game,
  archived,
  deletePending,
  onResume,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  game: ActiveGame
  archived: boolean
  deletePending: boolean
  onResume: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  const title = gameTitle(game)
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-3">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onResume} className="min-w-0 flex-1 text-left" aria-label={`${title} fortsetzen`}>
          <span className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${archived ? 'bg-ink-700 text-fog-400' : 'bg-gold-500/15 text-gold-300'}`}>
              {archived ? 'Archiv' : 'Pausiert'}
            </span>
            {game.testMode && <span className="text-[9px] font-bold uppercase tracking-wide text-fog-600">Test</span>}
          </span>
          <span className="mt-1 block truncate font-bold text-fog-100">{title}</span>
          <span className="mt-0.5 block text-xs text-fog-400">
            Runde {game.round} · {game.players[game.idx]?.name ?? 'Unbekannt'} ist dran
          </span>
          <span className="mt-1 block truncate text-[11px] text-fog-500">
            {game.players.map((player) => `${player.name} ${player.score.toLocaleString('de-DE')}`).join(' · ')}
          </span>
          <span className="mt-1 block text-[10px] text-fog-600">Zuletzt gespielt: {formatSavedAt(game.savedAt)}</span>
        </button>
        <button
          type="button"
          onClick={onAskDelete}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-fog-600 transition-colors hover:bg-coral-500/10 hover:text-coral-400"
          aria-label={`${title} löschen`}
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </div>

      {deletePending && (
        <div className="mt-3 rounded-xl border border-coral-500/30 bg-coral-500/10 p-3 animate-pop">
          <p className="text-xs leading-relaxed text-fog-300">Dieses pausierte Spiel wirklich endgültig löschen?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={onCancelDelete} className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs font-bold text-fog-300">
              Behalten
            </button>
            <button type="button" onClick={onConfirmDelete} className="rounded-lg bg-coral-500 px-3 py-2 text-xs font-bold text-white">
              Löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PausedGamesDialog({ games, onResume, onDelete, onClose }: Props) {
  const [deleteSession, setDeleteSession] = useState<string | null>(null)
  const { paused, archived } = useMemo(() => splitPausedGames(games), [games])
  const [archiveOpen, setArchiveOpen] = useState(paused.length === 0)

  const renderGame = (game: ActiveGame, isArchived: boolean) => (
    <GameCard
      key={game.sessionId}
      game={game}
      archived={isArchived}
      deletePending={deleteSession === game.sessionId}
      onResume={() => {
        onResume(game)
        onClose()
      }}
      onAskDelete={() => setDeleteSession(game.sessionId)}
      onCancelDelete={() => setDeleteSession(null)}
      onConfirmDelete={() => {
        onDelete(game.sessionId)
        setDeleteSession(null)
      }}
    />
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 py-[max(env(safe-area-inset-top),1rem)]" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pausierte Spiele"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-ink-700 bg-ink-950 shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-black tracking-tight text-fog-100">Pausierte Spiele</h2>
            <p className="mt-1 text-xs leading-relaxed text-fog-500">
              Nach 14 Tagen wandert ein Spiel automatisch ins Archiv. Dort bleibt es erhalten, bis du es fortsetzt oder löschst.
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-fog-500 hover:bg-ink-800 hover:text-fog-200" aria-label="Pausierte Spiele schließen">
            <IconX />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          {games.length === 0 && (
            <div className="rounded-2xl border border-dashed border-ink-700 px-4 py-8 text-center">
              <IconRefresh className="mx-auto h-6 w-6 text-fog-600" />
              <p className="mt-2 text-sm font-bold text-fog-400">Keine pausierten Spiele</p>
            </div>
          )}

          {paused.length > 0 && (
            <section aria-label="Aktuell pausiert">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-gold-400">Pausiert</h3>
                <span className="text-[10px] text-fog-600">{paused.length}</span>
              </div>
              <div className="space-y-2">{paused.map((game) => renderGame(game, false))}</div>
            </section>
          )}

          {archived.length > 0 && (
            <section aria-label="Archivierte Spiele">
              <button
                type="button"
                onClick={() => setArchiveOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-xl border border-ink-800 bg-ink-900/50 px-3 py-2 text-left"
                aria-expanded={archiveOpen}
              >
                <span className="text-xs font-black uppercase tracking-[0.18em] text-fog-400">Archiv</span>
                <span className="text-xs text-fog-600">{archived.length} · {archiveOpen ? 'schließen' : 'öffnen'}</span>
              </button>
              {archiveOpen && <div className="mt-2 space-y-2">{archived.map((game) => renderGame(game, true))}</div>}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
