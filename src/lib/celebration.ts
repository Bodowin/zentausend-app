import type { CelebrationData } from '../components/Celebration'

const fmtPts = (n: number) => `${n.toLocaleString('de-DE')} Punkte`

/**
 * Highlight-Feier für besondere Würfe – abgestuft nach Seltenheit/Wert.
 * Kleine, häufige Sachen (einzelne 1en/5en, Paare) lösen bewusst NICHTS aus,
 * weil sie kaum Punkte bringen und eine Feier dafür schnell nervt.
 *
 * `dice` ist die komplette gewertete Hand, `isHotDice` true, wenn alle sechs
 * Würfel werten („Alles zählt").
 */
export function celebrationFor(dice: number[], isHotDice: boolean): CelebrationData | null {
  if (dice.length === 0) return null
  const counts: Record<number, number> = {}
  for (const d of dice) counts[d] = (counts[d] || 0) + 1
  const distinct = Object.keys(counts).length
  const pairs = Object.values(counts).filter((c) => c === 2).length
  const triples = Object.entries(counts)
    .filter(([, c]) => c >= 3)
    .map(([v, c]) => ({ value: Number(v), count: c }))

  // Legendär: Straße / 3 Paare / zwei Drillinge
  if (dice.length === 6 && distinct === 6) return { title: 'STRASSE!', sub: '1.500 Punkte', tier: 'legend' }
  if (dice.length === 6 && pairs === 3) return { title: 'DREI PAARE!', sub: '1.500 Punkte', tier: 'legend' }
  if (triples.length >= 2) return { title: 'DOPPEL-PASCH!', sub: 'Zwei Drillinge!', tier: 'legend' }

  if (triples.length === 1) {
    const { value, count } = triples[0]
    const points = (value === 1 ? 1000 : value === 5 ? 500 : value * 100) + (count - 3) * 1000
    if (count === 6) return { title: '6ER-PASCH!', sub: fmtPts(points), tier: 'legend' }
    if (count === 5) return { title: '5ER-PASCH!', sub: fmtPts(points), tier: 'epic' }
    if (count === 4) return { title: '4ER-PASCH!', sub: fmtPts(points), tier: 'epic' }
    // Drilling (genau 3 gleiche)
    if (value === 1) return { title: 'DREI EINSER!', sub: fmtPts(1000), tier: 'strong' }
    if (value >= 4) return { title: 'DRILLING!', sub: `${value}-${value}-${value} · ${fmtPts(points)}`, tier: 'nice' }
    // 2er/3er-Drilling: wenig Punkte → dezent
    return { title: 'DRILLING!', sub: `${value}-${value}-${value}`, tier: 'mini' }
  }

  // Alles zählt (heiße Würfel) ohne Sonderwurf
  if (isHotDice) return { title: 'ALLES ZÄHLT!', sub: 'Heiße Würfel!', tier: 'hot' }
  return null
}
