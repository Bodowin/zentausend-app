import { describe, expect, it } from 'vitest'
import { spreadChartLabels } from './chartLabelLayout'

describe('spreadChartLabels', () => {
  it('separates nearby labels while keeping player order stable', () => {
    const result = spreadChartLabels(
      [
        { id: 'anna', y: 80 },
        { id: 'bodo', y: 82 },
        { id: 'clara', y: 84 },
      ],
      10,
      160,
      12,
    )

    expect(result.map((entry) => entry.id)).toEqual(['anna', 'bodo', 'clara'])
    const sorted = [...result].sort((a, b) => a.labelY - b.labelY)
    expect(sorted[1].labelY - sorted[0].labelY).toBeGreaterThanOrEqual(12)
    expect(sorted[2].labelY - sorted[1].labelY).toBeGreaterThanOrEqual(12)
  })

  it('keeps labels inside the available chart area near both edges', () => {
    const result = spreadChartLabels(
      [
        { id: 'top-a', y: 1 },
        { id: 'top-b', y: 2 },
        { id: 'bottom-a', y: 169 },
        { id: 'bottom-b', y: 170 },
      ],
      8,
      162,
      12,
    )

    expect(result.every((entry) => entry.labelY >= 8 && entry.labelY <= 162)).toBe(true)
    const sorted = [...result].sort((a, b) => a.labelY - b.labelY)
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index].labelY - sorted[index - 1].labelY).toBeGreaterThanOrEqual(12)
    }
  })
})
