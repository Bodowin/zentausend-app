import { describe, expect, it } from 'vitest'
import { mergeHistories } from './cloud'
import type { GameRecord } from './types'

const game = (id: number, event: string, winnerScore = 10000): GameRecord => ({
  id,
  date: `2026-07-${String(id).padStart(2, '0')}T12:00:00.000Z`,
  event,
  winner: 'Bodo',
  winnerScore,
  players: [
    { name: 'Bodo', score: winnerScore, busts: 1 },
    { name: 'Dana', score: 8500, busts: 2 },
  ],
  turns: [],
})

describe('mergeHistories', () => {
  it('bevorzugt ohne offenen Edit die Cloud-Kopie derselben Spiel-ID', () => {
    const merged = mergeHistories([game(1, 'Lokal alt', 10000)], [game(1, 'Cloud neu', 10500)])
    expect(merged).toHaveLength(1)
    expect(merged[0].event).toBe('Cloud neu')
    expect(merged[0].winnerScore).toBe(10500)
  })

  it('legt einen ausstehenden lokalen Anlass über die Cloud-Kopie', () => {
    const merged = mergeHistories(
      [game(1, 'Lokal alt')],
      [game(1, 'Cloud alt')],
      { '1': 'Offline korrigiert' },
    )
    expect(merged[0].event).toBe('Offline korrigiert')
  })

  it('vereinigt lokale und Cloud-only Spiele dedupliziert und chronologisch', () => {
    const merged = mergeHistories([game(1, 'Lokal')], [game(2, 'Cloud')])
    expect(merged.map((entry) => entry.id)).toEqual([2, 1])
  })
})
