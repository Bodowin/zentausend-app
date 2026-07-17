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
    .map((point, originalIndex) => ({ ...point, originalIndex, labelY: point.y }))
    .sort((a, b) => a.y - b.y || a.originalIndex - b.originalIndex)

  // Jeder Rang erhält einen noch verfügbaren Korridor. Dadurch bleibt selbst
  // bei gleichzeitig dicht belegter Ober- und Unterkante genug Platz für alle
  // folgenden Labels; ein abschließendes Clamping kann keine Kollision erzeugen.
  for (let index = 0; index < sorted.length; index += 1) {
    const minAllowed = lower + index * gap
    const maxAllowed = upper - (sorted.length - 1 - index) * gap
    sorted[index].labelY = clamp(sorted[index].y, minAllowed, maxAllowed)
    if (index > 0) {
      sorted[index].labelY = Math.max(sorted[index].labelY, sorted[index - 1].labelY + gap)
    }
  }

  return sorted
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(({ originalIndex: _originalIndex, ...point }) => point)
}
