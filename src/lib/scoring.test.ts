import { describe, it, expect } from 'vitest'
import { calculateScore, rollHasScore } from './scoring'

describe('calculateScore – Einzelwerte', () => {
  it('einzelne 1 = 100', () => expect(calculateScore([1]).score).toBe(100))
  it('einzelne 5 = 50', () => expect(calculateScore([5]).score).toBe(50))
  it('1 und 5 = 150', () => expect(calculateScore([1, 5]).score).toBe(150))
  it('leere Hand = 0, gültig', () => {
    const r = calculateScore([])
    expect(r.score).toBe(0)
    expect(r.isValid).toBe(true)
  })
})

describe('calculateScore – Drillinge & Pasch (Plus-1000-Hausregel)', () => {
  it('drei 1er = 1000 (nicht 300)', () => expect(calculateScore([1, 1, 1]).score).toBe(1000))
  it('vier 1er = 2000', () => expect(calculateScore([1, 1, 1, 1]).score).toBe(2000))
  it('sechs 1er = 4000', () => expect(calculateScore([1, 1, 1, 1, 1, 1]).score).toBe(4000))
  it('drei 5er = 500', () => expect(calculateScore([5, 5, 5]).score).toBe(500))
  it('sechs 5er = 3500', () => expect(calculateScore([5, 5, 5, 5, 5, 5]).score).toBe(3500))
  it('drei 2er = 200', () => expect(calculateScore([2, 2, 2]).score).toBe(200))
  it('vier 3er = 1300 (300 + 1000)', () => expect(calculateScore([3, 3, 3, 3]).score).toBe(1300))
  it('Drilling 1er + einzelne 5 = 1050', () => expect(calculateScore([1, 1, 1, 5]).score).toBe(1050))
  it('zwei Drillinge 1er+2er = 1200', () => expect(calculateScore([1, 1, 1, 2, 2, 2]).score).toBe(1200))
})

describe('calculateScore – Sonderwürfe (nur bei 6 Würfeln)', () => {
  it('Straße 1–6 = 1500, keine Extra-Punkte für 1/5', () => {
    const r = calculateScore([1, 2, 3, 4, 5, 6])
    expect(r.score).toBe(1500)
    expect(r.label).toBe('Straße!')
  })
  it('drei Paare = 1500', () => {
    const r = calculateScore([1, 1, 2, 2, 5, 5])
    expect(r.score).toBe(1500)
    expect(r.label).toBe('3 Paare!')
  })
})

describe('calculateScore – Joker-Pasch (Szenario B nur bei 2/3/4/6)', () => {
  it('Drilling 2er setzt hasJokerTriple', () => {
    const r = calculateScore([2, 2, 2])
    expect(r.hasTriple).toBe(true)
    expect(r.hasJokerTriple).toBe(true)
  })
  it('Drilling 1er ist KEIN Joker-Pasch', () => {
    const r = calculateScore([1, 1, 1])
    expect(r.hasTriple).toBe(true)
    expect(r.hasJokerTriple).toBe(false)
  })
  it('Drilling 5er ist KEIN Joker-Pasch', () => {
    const r = calculateScore([5, 5, 5])
    expect(r.hasJokerTriple).toBe(false)
  })
})

describe('calculateScore – Ungültige Eingaben', () => {
  it('einzelne 2 ist ungültig (kein wertbarer Würfel)', () => {
    const r = calculateScore([2])
    expect(r.isValid).toBe(false)
    expect(r.invalidDice).toEqual([2])
  })
  it('1 + nicht wertbare 3 → 100, aber ungültig markiert', () => {
    const r = calculateScore([1, 3])
    expect(r.score).toBe(100)
    expect(r.isValid).toBe(false)
    expect(r.invalidDice).toEqual([3])
  })
  it('Wert außerhalb 1–6 macht die Hand ungültig (kaputte Daten)', () => {
    const r = calculateScore([1, 2, 3, 4, 5, 7])
    expect(r.isValid).toBe(false)
    expect(r.score).toBe(0)
  })
})

describe('rollHasScore – Niete-Erkennung', () => {
  it('1 oder 5 ist wertbar', () => {
    expect(rollHasScore([2, 3, 4, 1])).toBe(true)
    expect(rollHasScore([5])).toBe(true)
  })
  it('Drilling 2/3/4/6 ist wertbar', () => expect(rollHasScore([2, 2, 2])).toBe(true))
  it('reine Niete ohne 1/5/Drilling', () => expect(rollHasScore([2, 3, 4])).toBe(false))
  it('Straße/3 Paare bei 6 Würfeln zählen', () => {
    expect(rollHasScore([1, 2, 3, 4, 5, 6])).toBe(true)
    expect(rollHasScore([2, 2, 3, 3, 4, 4])).toBe(true)
  })
})
