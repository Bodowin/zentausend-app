import { describe, it, expect } from 'vitest'
import { computeRisk, recommendAction } from './risk'

/**
 * Unabhängige Wahrscheinlichkeits-Verifikation: Wir zählen über ALLE 6^k
 * möglichen Würfe aus, wie oft der nächste Wurf KEINE Niete ist, und vergleichen
 * das mit den im Code hinterlegten Tabellen. So ist sichergestellt, dass die
 * Prozentwerte tatsächlich stimmen (und nicht nur unverändert sind).
 */
function counts(dice: number[]): Record<number, number> {
  const c: Record<number, number> = {}
  dice.forEach((d) => (c[d] = (c[d] || 0) + 1))
  return c
}

// Szenario A: Rettung durch 1, 5 oder einen (neuen) Drilling; bei 6 Würfeln
// zusätzlich Straße oder drei Paare.
function nonBustA(dice: number[]): boolean {
  const c = counts(dice)
  if (c[1] || c[5]) return true
  if (Object.values(c).some((n) => n >= 3)) return true
  if (dice.length === 6) {
    if (Object.keys(c).length === 6) return true
    if (Object.values(c).filter((n) => n === 2).length === 3) return true
  }
  return false
}

// Szenario B: zusätzlich rettet die aktive Joker-Augenzahl x.
function nonBustB(dice: number[], x: number): boolean {
  const c = counts(dice)
  if (c[1] || c[5] || c[x]) return true
  if (Object.values(c).some((n) => n >= 3)) return true
  if (dice.length === 6) {
    if (Object.keys(c).length === 6) return true
    if (Object.values(c).filter((n) => n === 2).length === 3) return true
  }
  return false
}

function successPct(k: number, fn: (dice: number[]) => boolean): number {
  let ok = 0
  const total = 6 ** k
  const dice = new Array(k).fill(1)
  for (let n = 0; n < total; n++) {
    let x = n
    for (let i = 0; i < k; i++) {
      dice[i] = (x % 6) + 1
      x = Math.floor(x / 6)
    }
    if (fn(dice)) ok++
  }
  return Math.round((ok / total) * 10000) / 100
}

describe('computeRisk – Szenario A stimmt mit Enumeration überein', () => {
  for (let k = 1; k <= 6; k++) {
    it(`${k} Würfel`, () => {
      expect(computeRisk(k, false)!.pct).toBe(successPct(k, nonBustA))
    })
  }
})

describe('computeRisk – Szenario B stimmt mit Enumeration überein', () => {
  // Joker-Augenzahl x ∈ {2,3,4,6}; aus Symmetrie genügt ein Vertreter (x=2).
  for (let k = 1; k <= 6; k++) {
    it(`${k} Würfel`, () => {
      expect(computeRisk(k, true)!.pct).toBe(successPct(k, (d) => nonBustB(d, 2)))
    })
  }
  it('6 Würfel mit aktivem Pasch sind garantiert (100 %)', () => {
    expect(computeRisk(6, true)!.pct).toBe(100)
  })
})

describe('computeRisk – Grenzen', () => {
  it('0 oder >6 Würfel → null', () => {
    expect(computeRisk(0, false)).toBeNull()
    expect(computeRisk(7, false)).toBeNull()
  })
})

describe('recommendAction – topf-bewusste Empfehlung', () => {
  it('Sichern gewinnt → Sieg-Hinweis', () => {
    expect(recommendAction(50, 500, true, true)).toEqual({ text: 'Sichern = Sieg!', tone: 'good' })
  })
  it('Einstieg noch nicht geschafft → weiterwürfeln', () => {
    const a = recommendAction(90, 200, false, false)
    expect(a.tone).toBe('ok')
  })
  it('hohe Chance + kleiner Topf → sicher (good)', () => {
    expect(recommendAction(97.69, 300, true, false)).toEqual({ text: 'Weiter ist sicher', tone: 'good' })
  })
  it('hohe Chance + RIESIGER Topf → nicht mehr pauschal "sicher"', () => {
    const a = recommendAction(97.69, 3000, true, false)
    expect(a.tone).toBe('ok')
    expect(a.text).not.toBe('Weiter ist sicher')
  })
  it('gute Chance + großer Topf → Warnung', () => {
    expect(recommendAction(88, 1600, true, false).tone).toBe('warn')
  })
  it('gute Chance + kleiner Topf → gut', () => {
    expect(recommendAction(88, 400, true, false).tone).toBe('good')
  })
  it('mittlere Chance + großer Topf → Gefahr', () => {
    expect(recommendAction(72, 1800, true, false).tone).toBe('danger')
  })
  it('mittlere Chance + kleiner Topf → geht noch', () => {
    expect(recommendAction(72, 400, true, false).tone).toBe('warn')
  })
  it('niedrige Chance → sichern', () => {
    expect(recommendAction(33, 400, true, false)).toEqual({ text: 'Lieber sichern', tone: 'danger' })
  })
})
