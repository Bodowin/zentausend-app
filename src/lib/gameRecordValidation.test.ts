import { describe, expect, it } from 'vitest'
import { validateGameRecord, validateGameRecordArray } from './gameRecordValidation'

const validGame = {
  id: 1_750_000_000_000,
  date: '2025-06-15T15:06:40.000Z',
  event: 'Sommerabend',
  winner: 'Bodo',
  winnerScore: 10_250,
  players: [
    { name: 'Bodo', score: 10_250, busts: 2 },
    { name: 'Anna', score: 8_600, busts: 3 },
  ],
  turns: [{ round: 1, player: 'Bodo', points: 350, bust: false }],
}

describe('game record validation', () => {
  it('keeps a valid current record intact', () => {
    const result = validateGameRecord(validGame)
    expect(result.errors).toEqual([])
    expect(result.repairs).toEqual([])
    expect(result.game).toEqual(validGame)
  })

  it('repairs common legacy shapes without changing the result', () => {
    const result = validateGameRecord({
      id: String(validGame.id),
      players: [
        { name: 'Bodo', score: '10250' },
        { name: 'Anna', score: 8600, busts: '3' },
      ],
      winner: 'bodo',
      winnerScore: 1,
      turns: [{ round: '1', player: 'bodo', points: '350', bust: 0 }],
    })

    expect(result.errors).toEqual([])
    expect(result.game).toMatchObject({
      id: validGame.id,
      date: validGame.date,
      event: '',
      winner: 'Bodo',
      winnerScore: 10_250,
      players: [
        { name: 'Bodo', score: 10_250, busts: 0 },
        { name: 'Anna', score: 8600, busts: 3 },
      ],
    })
    expect(result.repairs.length).toBeGreaterThan(0)
  })

  it('preserves legacy cloud rows with a nonnumeric client id', () => {
    const result = validateGameRecord({ ...validGame, id: 'legacy-cloud-row' })

    expect(result.errors).toEqual([])
    expect(result.game?.id).toBe(Date.parse(validGame.date))
    expect(result.repairs).toContain('id wurde aus dem Spieldatum rekonstruiert')
  })

  it('corrects a stored winner that contradicts the unique highest score', () => {
    const result = validateGameRecord({ ...validGame, winner: 'Anna', winnerScore: 8_600 })

    expect(result.errors).toEqual([])
    expect(result.game?.winner).toBe('Bodo')
    expect(result.game?.winnerScore).toBe(10_250)
    expect(result.repairs.some((repair) => repair.includes('widersprach dem Endstand'))).toBe(true)
  })

  it('keeps the game but omits malformed analysis turns', () => {
    const result = validateGameRecord({
      ...validGame,
      turns: [
        validGame.turns[0],
        { round: 2, player: 'Unbekannt', points: 500, bust: false },
      ],
    })

    expect(result.errors).toEqual([])
    expect(result.game?.turns).toEqual([validGame.turns[0]])
    expect(result.repairs.some((repair) => repair.includes('wurde ausgelassen'))).toBe(true)
  })

  it('quarantines records whose result cannot be reconstructed', () => {
    const batch = validateGameRecordArray(
      [
        {
          id: validGame.id,
          date: validGame.date,
          winner: '',
          players: [
            { name: 'Bodo', score: 9000, busts: 1 },
            { name: 'Anna', score: 9000, busts: 1 },
          ],
        },
      ],
      'backup',
    )

    expect(batch.games).toEqual([])
    expect(batch.quarantined).toHaveLength(1)
    expect(batch.quarantined[0].reasons).toContain('winner ist nicht eindeutig rekonstruierbar')
    expect(batch.quarantined[0].raw).toBeTruthy()
  })

  it('keeps the newer conflicting duplicate and quarantines the other copy', () => {
    const older = { ...validGame, date: '2025-01-01T00:00:00.000Z', event: 'Alt' }
    const newer = { ...validGame, date: '2025-02-01T00:00:00.000Z', event: 'Neu' }
    const batch = validateGameRecordArray([older, newer], 'cloud')

    expect(batch.games).toHaveLength(1)
    expect(batch.games[0].event).toBe('Neu')
    expect(batch.quarantined).toHaveLength(1)
    expect(batch.quarantined[0].raw).toEqual(older)
  })

  it('quarantines a malformed root instead of pretending it is empty', () => {
    const batch = validateGameRecordArray({ games: [] }, 'local')
    expect(batch.games).toEqual([])
    expect(batch.quarantined[0].index).toBe(-1)
  })
})
