export interface ChartLabelPoint {
  id: string
  y: number
}

export interface ChartLabelPosition extends ChartLabelPoint {
  labelY: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Verteilt Direktlabels vertikal, ohne ihre Reihenfolge zu verändern. Die
 * eigentlichen Linienendpunkte bleiben unverändert; nur die Beschriftungen
 * werden bei nahen Ergebnissen auseinandergezogen und per Verbindungslinie
 * wieder eindeutig zugeordnet.
 */
export function spreadChartLabels(
  points: ChartLabelPoint[],
  minY: number,
  maxY: number,
  preferredGap = 12,
): ChartLabelPosition[] {
  if (points.length === 0) return []

  const lower = Math.min(minY, maxY)
  const upper = Math.max(minY, maxY)
  const range = upper - lower
  const gap = points.length <= 1 ? 0 : Math.min(Math.max(0, preferredGap), range / (points.length - 1))
  const sorted = points
    .map((point, originalIndex) => ({ ...point, originalIndex, labelY: clamp(point.y, lower, upper) }))
    .sort((a, b) => a.y - b.y || a.originalIndex - b.originalIndex)

  for (let index = 1; index < sorted.length; index += 1) {
    sorted[index].labelY = Math.max(sorted[index].labelY, sorted[index - 1].labelY + gap)
  }

  const overflow = sorted[sorted.length - 1].labelY - upper
  if (overflow > 0) {
    for (const point of sorted) point.labelY -= overflow
  }

  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    sorted[index].labelY = Math.min(sorted[index].labelY, sorted[index + 1].labelY - gap)
  }

  const underflow = lower - sorted[0].labelY
  if (underflow > 0) {
    for (const point of sorted) point.labelY += underflow
  }

  return sorted
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(({ originalIndex: _originalIndex, ...point }) => ({ ...point, labelY: clamp(point.labelY, lower, upper) }))
}
