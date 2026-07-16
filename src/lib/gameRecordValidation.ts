import type { GameRecord, RiskAttempt, Turn } from './types'

export type GameRecordSource = 'local' | 'backup' | 'cloud'

export interface QuarantinedGameRecord {
  source: GameRecordSource
  index: number
  id?: string
  reasons: string[]
  raw: unknown
}

export interface GameRecordValidationBatch {
  games: GameRecord[]
  quarantined: QuarantinedGameRecord[]
  repaired: number
}

interface SingleValidation {
  game: GameRecord | null
  repairs: string[]
  errors: string[]
}

const MIN_REASONABLE_DATE = Date.UTC(2000, 0, 1)
const MAX_REASONABLE_DATE = Date.UTC(2100, 0, 1)

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function integerValue(value: unknown, minimum = 0): { value: number | null; repaired: boolean } {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum) {
    return { value, repaired: false }
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim())
    if (Number.isSafeInteger(parsed) && parsed >= minimum) return { value: parsed, repaired: true }
  }
  return { value: null, repaired: false }
}

function textValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeRiskAttempt(value: unknown, path: string): { attempt: RiskAttempt | null; repairs: string[] } {
  if (!isObject(value)) return { attempt: null, repairs: [`${path} war kein Objekt und wurde ausgelassen`] }
  const successPct = value.successPct
  const dice = integerValue(value.dice, 1)
  const pot = integerValue(value.pot, 0)
  if (
    typeof successPct !== 'number' ||
    !Number.isFinite(successPct) ||
    successPct < 0 ||
    successPct > 100 ||
    dice.value === null ||
    dice.value > 6 ||
    pot.value === null ||
    typeof value.scenarioB !== 'boolean' ||
    typeof value.success !== 'boolean'
  ) {
    return { attempt: null, repairs: [`${path} war ungültig und wurde ausgelassen`] }
  }
  const repairs: string[] = []
  if (dice.repaired) repairs.push(`${path}.dice wurde normalisiert`)
  if (pot.repaired) repairs.push(`${path}.pot wurde normalisiert`)
  return {
    attempt: { successPct, dice: dice.value, scenarioB: value.scenarioB, pot: pot.value, success: value.success },
    repairs,
  }
}

function normalizeTurn(value: unknown, players: string[], index: number): { turn: Turn | null; repairs: string[] } {
  const repairs: string[] = []
  if (!isObject(value)) return { turn: null, repairs: [`turns[${index}] ist kein Objekt`] }

  const round = integerValue(value.round, 1)
  const points = integerValue(value.points, 0)
  const playerInput = textValue(value.player)
  const matchedPlayer = playerInput
    ? players.find((name) => name === playerInput) ??
      players.find((name) => name.toLocaleLowerCase() === playerInput.toLocaleLowerCase())
    : undefined

  const playerId = textValue(value.playerId)
  if (value.playerId !== undefined && !playerId) repairs.push(`turns[${index}].playerId war ungültig und wurde ausgelassen`)

  let bust: boolean | null = typeof value.bust === 'boolean' ? value.bust : null
  if (bust === null && (value.bust === 0 || value.bust === 1)) {
    bust = value.bust === 1
    repairs.push(`turns[${index}].bust wurde normalisiert`)
  }

  if (round.value === null || points.value === null || !matchedPlayer || bust === null) {
    return { turn: null, repairs: [...repairs, `turns[${index}] war unvollständig und wurde ausgelassen`] }
  }
  if (round.repaired) repairs.push(`turns[${index}].round wurde normalisiert`)
  if (points.repaired) repairs.push(`turns[${index}].points wurde normalisiert`)
  if (matchedPlayer !== playerInput) repairs.push(`turns[${index}].player wurde vereinheitlicht`)

  let riskAttempts: RiskAttempt[] | undefined
  if (value.riskAttempts !== undefined && value.riskAttempts !== null) {
    if (!Array.isArray(value.riskAttempts)) {
      repairs.push(`turns[${index}].riskAttempts war kein Array und wurde ausgelassen`)
    } else {
      riskAttempts = []
      value.riskAttempts.forEach((candidate, riskIndex) => {
        const normalized = normalizeRiskAttempt(candidate, `turns[${index}].riskAttempts[${riskIndex}]`)
        repairs.push(...normalized.repairs)
        if (normalized.attempt) riskAttempts?.push(normalized.attempt)
      })
    }
  }

  return {
    turn: {
      round: round.value,
      player: matchedPlayer,
      ...(playerId ? { playerId } : {}),
      points: points.value,
      bust,
      ...(riskAttempts ? { riskAttempts } : {}),
    },
    repairs,
  }
}

export function validateGameRecord(value: unknown): SingleValidation {
  const repairs: string[] = []
  const errors: string[] = []
  if (!isObject(value)) return { game: null, repairs, errors: ['Datensatz ist kein Objekt'] }

  let id = integerValue(value.id, 1)
  if (id.value !== null && id.repaired) repairs.push('id wurde von Text in eine Zahl umgewandelt')

  const playersRaw = value.players
  const players: GameRecord['players'] = []
  if (!Array.isArray(playersRaw) || playersRaw.length === 0) {
    errors.push('players fehlt oder ist leer')
  } else {
    playersRaw.forEach((candidate, index) => {
      if (!isObject(candidate)) {
        errors.push(`players[${index}] ist kein Objekt`)
        return
      }
      const name = textValue(candidate.name)
      const playerId = textValue(candidate.playerId)
      const score = integerValue(candidate.score, 0)
      const busts = candidate.busts === undefined ? { value: 0, repaired: true } : integerValue(candidate.busts, 0)
      if (!name) errors.push(`players[${index}].name fehlt`)
      if (candidate.playerId !== undefined && !playerId) repairs.push(`players[${index}].playerId war ungültig und wurde ausgelassen`)
      if (score.value === null) errors.push(`players[${index}].score ist ungültig`)
      if (busts.value === null) errors.push(`players[${index}].busts ist ungültig`)
      if (!name || score.value === null || busts.value === null) return
      if (score.repaired) repairs.push(`players[${index}].score wurde normalisiert`)
      if (busts.repaired) repairs.push(`players[${index}].busts wurde ergänzt oder normalisiert`)
      players.push({ ...(playerId ? { playerId } : {}), name, score: score.value, busts: busts.value })
    })
  }

  const duplicateNames = players
    .map((player) => player.name.toLocaleLowerCase())
    .filter((name, index, all) => all.indexOf(name) !== index)
  if (duplicateNames.length > 0) errors.push('Spieler-Namen sind innerhalb des Spiels nicht eindeutig')

  const duplicatePlayerIds = players
    .map((player) => player.playerId)
    .filter((id): id is string => Boolean(id))
    .filter((id, index, all) => all.indexOf(id) !== index)
  if (duplicatePlayerIds.length > 0) errors.push('Spieler-IDs sind innerhalb des Spiels nicht eindeutig')

  let date: string | null = null
  if (typeof value.date === 'string' && Number.isFinite(Date.parse(value.date))) {
    date = new Date(value.date).toISOString()
    if (date !== value.date) repairs.push('date wurde in ISO-Format normalisiert')
  } else if (id.value !== null && id.value >= MIN_REASONABLE_DATE && id.value < MAX_REASONABLE_DATE) {
    date = new Date(id.value).toISOString()
    repairs.push('date wurde aus der Spiel-ID rekonstruiert')
  } else {
    errors.push('date fehlt oder ist nicht rekonstruierbar')
  }

  // Frühere Cloud-Versionen leiteten bei nichtnumerischen client_ids die lokale
  // Spiel-ID aus played_at ab. Diese Datensätze bleiben dadurch kompatibel.
  if (id.value === null && date) {
    const derivedId = Date.parse(date)
    if (Number.isSafeInteger(derivedId) && derivedId > 0) {
      id = { value: derivedId, repaired: true }
      repairs.push('id wurde aus dem Spieldatum rekonstruiert')
    }
  }
  if (id.value === null) errors.push('id fehlt oder ist ungültig')

  let winner = textValue(value.winner)
  let winnerPlayer = winner
    ? players.find((player) => player.name === winner) ??
      players.find((player) => player.name.toLocaleLowerCase() === winner?.toLocaleLowerCase())
    : undefined
  const bestScore = players.length > 0 ? Math.max(...players.map((player) => player.score)) : null
  const leaders = bestScore === null ? [] : players.filter((player) => player.score === bestScore)

  if (!winnerPlayer && players.length > 0) {
    if (leaders.length === 1) {
      winnerPlayer = leaders[0]
      winner = winnerPlayer.name
      repairs.push('winner wurde aus dem eindeutigen Höchststand rekonstruiert')
    } else {
      errors.push('winner ist nicht eindeutig rekonstruierbar')
    }
  } else if (winnerPlayer && bestScore !== null && winnerPlayer.score !== bestScore) {
    if (leaders.length === 1) {
      winnerPlayer = leaders[0]
      winner = winnerPlayer.name
      repairs.push('winner widersprach dem Endstand und wurde aus dem Höchststand rekonstruiert')
    } else {
      errors.push('winner widerspricht dem Endstand und ist nicht eindeutig rekonstruierbar')
    }
  } else if (winnerPlayer && winnerPlayer.name !== winner) {
    winner = winnerPlayer.name
    repairs.push('winner wurde an den gespeicherten Spielernamen angeglichen')
  }

  let winnerScore = integerValue(value.winnerScore, 0)
  if (winnerPlayer && winnerScore.value !== winnerPlayer.score) {
    winnerScore = { value: winnerPlayer.score, repaired: true }
    repairs.push('winnerScore wurde aus dem Siegerstand rekonstruiert')
  } else if (winnerScore.repaired) {
    repairs.push('winnerScore wurde normalisiert')
  }

  let event = ''
  if (typeof value.event === 'string') event = value.event.trim()
  else if (value.event !== undefined && value.event !== null) repairs.push('event war ungültig und wurde geleert')

  let turns: Turn[] | undefined
  if (value.turns !== undefined && value.turns !== null) {
    if (!Array.isArray(value.turns)) {
      repairs.push('turns war kein Array und wurde ausgelassen')
    } else {
      turns = []
      value.turns.forEach((candidate, index) => {
        const normalized = normalizeTurn(candidate, players.map((player) => player.name), index)
        repairs.push(...normalized.repairs)
        if (normalized.turn) turns?.push(normalized.turn)
      })
    }
  }

  if (errors.length > 0 || id.value === null || !date || !winner || !winnerPlayer || winnerScore.value === null) {
    return { game: null, repairs, errors }
  }

  return {
    game: {
      id: id.value,
      date,
      event,
      winner,
      winnerScore: winnerScore.value,
      players,
      ...(turns ? { turns } : {}),
    },
    repairs,
    errors,
  }
}

export function validateGameRecordArray(input: unknown, source: GameRecordSource): GameRecordValidationBatch {
  if (!Array.isArray(input)) {
    return {
      games: [],
      repaired: 0,
      quarantined: [{ source, index: -1, reasons: ['Spieleliste fehlt oder ist kein Array'], raw: input }],
    }
  }

  const accepted = new Map<number, { game: GameRecord; raw: unknown; index: number }>()
  const quarantined: QuarantinedGameRecord[] = []
  let repaired = 0

  input.forEach((raw, index) => {
    const result = validateGameRecord(raw)
    if (!result.game) {
      quarantined.push({
        source,
        index,
        id: isObject(raw) && raw.id !== undefined ? String(raw.id) : undefined,
        reasons: result.errors.length > 0 ? result.errors : ['Datensatz konnte nicht normalisiert werden'],
        raw,
      })
      return
    }
    if (result.repairs.length > 0) repaired += 1

    const previous = accepted.get(result.game.id)
    if (!previous) {
      accepted.set(result.game.id, { game: result.game, raw, index })
      return
    }

    if (JSON.stringify(previous.game) === JSON.stringify(result.game)) {
      repaired += 1
      return
    }

    const currentIsNewer = Date.parse(result.game.date) >= Date.parse(previous.game.date)
    const discarded = currentIsNewer ? previous : { game: result.game, raw, index }
    if (currentIsNewer) accepted.set(result.game.id, { game: result.game, raw, index })
    quarantined.push({
      source,
      index: discarded.index,
      id: String(result.game.id),
      reasons: [`Widersprüchlicher Datensatz mit doppelter Spiel-ID ${result.game.id}`],
      raw: discarded.raw,
    })
  })

  return {
    games: [...accepted.values()].map((entry) => entry.game).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    quarantined,
    repaired,
  }
}
