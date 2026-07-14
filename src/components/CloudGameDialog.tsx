import type { ActiveGameCloudPrompt } from '../lib/activeGameCloud'
import type { ActiveGame } from '../lib/activeGame'

interface Props {
  prompt: ActiveGameCloudPrompt
  busy: boolean
  onUseCloud: () => void
  onKeepLocal: () => void
  onDiscardLocal: () => void
  onClose: () => void
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Zeitpunkt unbekannt'
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function gameSummary(label: string, game: ActiveGame) {
  const current = game.players[game.idx]?.name ?? 'Unbekannt'
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-950/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-fog-600">{label}</div>
      <div className="mt-1 text-sm font-bold text-fog-100">
        Runde {game.round} · {current} ist dran
      </div>
      <div className="mt-1 truncate text-xs text-fog-400">
        {game.players.map((player) => `${player.name} ${player.score.toLocaleString('de-DE')}`).join(' · ')}
      </div>
      <div className="mt-1 text-[10px] text-fog-600">Gespeichert: {formatTime(game.savedAt)}</div>
    </div>
  )
}

export function CloudGameDialog({
  prompt,
  busy,
  onUseCloud,
  onKeepLocal,
  onDiscardLocal,
  onClose,
}: Props) {
  const cloudGame = prompt.snapshot.game
  const localGame = prompt.local

  const title =
    prompt.reason === 'available'
      ? 'Spiel aus der Cloud gefunden'
      : prompt.reason === 'cloud-newer'
        ? 'Neuerer Stand in der Cloud'
        : prompt.reason === 'different-game'
          ? 'Zwei laufende Spiele gefunden'
          : prompt.reason === 'cloud-cleared'
            ? 'Spiel wurde auf einem anderen Gerät beendet'
            : 'Spiel ist auf einem anderen Gerät aktiv'

  const explanation =
    prompt.reason === 'available'
      ? 'Du kannst dieses Spiel bewusst auf diesem Gerät übernehmen und hier fortsetzen.'
      : prompt.reason === 'cloud-newer'
        ? 'Der Cloud-Stand ist neuer als die lokale Kopie. Nichts wird automatisch überschrieben.'
        : prompt.reason === 'different-game'
          ? 'Lokal und in der Cloud liegen unterschiedliche Spiele. Entscheide ausdrücklich, welches bleiben soll.'
          : prompt.reason === 'cloud-cleared'
            ? 'Die Cloud meldet diesen Spielstand als beendet oder verworfen. Die lokale Kopie bleibt erhalten, bis du entscheidest.'
            : 'Ein anderes Gerät hat den Stand übernommen. Änderungen dieses Geräts werden erst wieder gesichert, wenn du ihn hier zurückholst.'

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/75 px-4 py-8" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-3xl border border-gold-500/40 bg-ink-900 p-5 shadow-2xl shadow-black/60"
      >
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gold-500">Cloud-Sicherung</div>
        <h2 className="mt-1 text-xl font-black text-fog-100">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-fog-400">{explanation}</p>

        <div className="mt-4 space-y-2">
          {localGame && gameSummary('Auf diesem Gerät', localGame)}
          {cloudGame && gameSummary('In der Cloud', cloudGame)}
        </div>

        {prompt.reason === 'cloud-cleared' ? (
          <>
            <button
              type="button"
              disabled={busy || !localGame}
              onClick={onKeepLocal}
              className="mt-5 w-full rounded-xl bg-gold-500 px-4 py-3 font-bold text-ink-950 disabled:opacity-50"
            >
              {busy ? 'Wird übernommen…' : 'Lokalen Stand behalten'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDiscardLocal}
              className="mt-2 w-full rounded-xl border border-coral-500/40 bg-coral-500/10 px-4 py-3 font-bold text-coral-300 disabled:opacity-50"
            >
              Lokalen Stand verwerfen
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || !cloudGame}
              onClick={onUseCloud}
              className="mt-5 w-full rounded-xl bg-gold-500 px-4 py-3 font-bold text-ink-950 disabled:opacity-50"
            >
              {busy ? 'Wird übernommen…' : 'Cloud-Spiel auf diesem Gerät übernehmen'}
            </button>
            {localGame && (
              <button
                type="button"
                disabled={busy}
                onClick={onKeepLocal}
                className="mt-2 w-full rounded-xl border border-mint-500/40 bg-mint-500/10 px-4 py-3 font-bold text-mint-300 disabled:opacity-50"
              >
                Lokales Spiel behalten
              </button>
            )}
          </>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-fog-500 disabled:opacity-50"
        >
          Später entscheiden
        </button>
      </div>
    </div>
  )
}
