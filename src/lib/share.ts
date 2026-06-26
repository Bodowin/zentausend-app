import type { Player } from './types'

/**
 * Teilt den Endstand über die native Teilen-Funktion (Web Share API, z. B. an
 * WhatsApp). Fällt auf die Zwischenablage zurück, wo Teilen nicht verfügbar ist.
 */
export async function shareResult(
  winner: Player,
  players: Player[],
  event: string,
): Promise<void> {
  const ranking = [...players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => `${i + 1}. ${p.name}: ${p.score.toLocaleString('de-DE')}`)
    .join('\n')

  const text =
    `🎲 10.000 – Die Clique\n` +
    `🏆 Sieger: ${winner.name}\n` +
    (event ? `📍 ${event}\n` : '') +
    `\n${ranking}`

  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: '10.000 – Die Clique', text })
      return
    }
  } catch {
    return // Nutzer hat den Teilen-Dialog abgebrochen.
  }

  try {
    await navigator.clipboard.writeText(text)
    alert('Ergebnis in die Zwischenablage kopiert!')
  } catch {
    /* nichts möglich */
  }
}
