import { describe, expect, it } from 'vitest'
import { celebrationFor } from './celebration'

describe('celebrationFor', () => {
  it('feiert NICHT bei einzelnen oder doppelten 1en/5en', () => {
    expect(celebrationFor([1], false)).toBeNull()
    expect(celebrationFor([5], false)).toBeNull()
    expect(celebrationFor([1, 1], false)).toBeNull()
    expect(celebrationFor([5, 5], false)).toBeNull()
    expect(celebrationFor([1, 5], false)).toBeNull()
    // gemischte Hand ohne Sonderwurf
    expect(celebrationFor([1, 5, 5], false)).toBeNull()
  })

  it('feiert die Straße legendär', () => {
    const c = celebrationFor([1, 2, 3, 4, 5, 6], true)
    expect(c?.title).toBe('STRASSE!')
    expect(c?.tier).toBe('legend')
  })

  it('feiert drei Paare legendär', () => {
    const c = celebrationFor([2, 2, 4, 4, 6, 6], true)
    expect(c?.title).toBe('DREI PAARE!')
    expect(c?.tier).toBe('legend')
  })

  it('feiert zwei Drillinge als Doppel-Pasch', () => {
    const c = celebrationFor([2, 2, 2, 3, 3, 3], true)
    expect(c?.title).toBe('DOPPEL-PASCH!')
    expect(c?.tier).toBe('legend')
  })

  it('stuft Pasch-Größen ab', () => {
    expect(celebrationFor([6, 6, 6, 6, 6, 6], true)?.tier).toBe('legend')
    expect(celebrationFor([4, 4, 4, 4, 4], false)?.tier).toBe('epic')
    expect(celebrationFor([3, 3, 3, 3], false)?.tier).toBe('epic')
  })

  it('feiert den Einser-Drilling stark, hohe Drillinge nett, niedrige dezent', () => {
    expect(celebrationFor([1, 1, 1], false)).toMatchObject({ title: 'DREI EINSER!', tier: 'strong' })
    expect(celebrationFor([6, 6, 6], false)).toMatchObject({ title: 'DRILLING!', tier: 'nice' })
    expect(celebrationFor([4, 4, 4], false)).toMatchObject({ tier: 'nice' })
    // 2er/3er bringen wenig Punkte → nur Mini-Feier
    expect(celebrationFor([2, 2, 2], false)?.tier).toBe('mini')
    expect(celebrationFor([3, 3, 3], false)?.tier).toBe('mini')
  })

  it('nutzt „Alles zählt" nur als Auffangstufe, wenn kein Sonderwurf greift', () => {
    // Eine volle wertende Hand ist praktisch immer schon ein Pasch/Sonderwurf
    // (sechs 1er/5er enthalten zwangsläufig einen Drilling) – der greift zuerst:
    expect(celebrationFor([1, 1, 5, 5, 1, 5], true)?.title).toBe('DOPPEL-PASCH!')
    // Der hot-Fallback selbst (kein Drilling, kein Sonderwurf):
    expect(celebrationFor([1, 5], true)?.tier).toBe('hot')
    expect(celebrationFor([1, 5], false)).toBeNull()
  })

  it('gibt bei leerer Hand null zurück', () => {
    expect(celebrationFor([], false)).toBeNull()
    expect(celebrationFor([], true)).toBeNull()
  })
})
