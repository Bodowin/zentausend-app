import { useEffect, useState } from 'react'
import { buzz } from '../lib/haptics'

// Pip-Positionen im 3×3-Raster je Augenzahl.
const PIP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// Würfel-Drehung [rx, ry], um die Augenzahl nach vorne (zur Kamera) zu bringen.
const BASE: Record<number, [number, number]> = {
  1: [0, 0],
  2: [90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  6: [0, 180],
}

const FACES: { v: number; t: string }[] = [
  { v: 1, t: 'translateZ(30px)' },
  { v: 6, t: 'rotateY(180deg) translateZ(30px)' },
  { v: 3, t: 'rotateY(90deg) translateZ(30px)' },
  { v: 4, t: 'rotateY(-90deg) translateZ(30px)' },
  { v: 5, t: 'rotateX(90deg) translateZ(30px)' },
  { v: 2, t: 'rotateX(-90deg) translateZ(30px)' },
]

const rnd = (n: number) => Math.floor(Math.random() * n)

interface DieState {
  value: number
  rx: number
  ry: number
  delay: number
}

/**
 * Zuverlässige CSS-3D-Würfel (kein WebGL): tumbeln gestaffelt und landen auf der
 * vorbestimmten Augenzahl. Funktioniert garantiert auf iOS, offline, design-treu.
 */
export default function DiceCss({ values, onSettle }: { values: number[]; onSettle: () => void }) {
  const [dice, setDice] = useState<DieState[]>([])

  useEffect(() => {
    buzz([16, 24, 16])
    setDice(
      values.map((value, i) => {
        const [brx, bry] = BASE[value]
        return { value, rx: 360 * (3 + rnd(3)) + brx, ry: 360 * (3 + rnd(3)) + bry, delay: i * 70 }
      }),
    )
    const t = window.setTimeout(() => {
      buzz(12)
      onSettle()
    }, 1300 + values.length * 70)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full flex-wrap content-center items-center justify-center gap-4 p-4">
      {dice.map((d, i) => (
        <div key={i} className="dice-scene">
          <div
            className="dice-cube"
            style={{ transform: `rotateX(${d.rx}deg) rotateY(${d.ry}deg)`, transitionDelay: `${d.delay}ms` }}
          >
            {FACES.map((f) => (
              <div key={f.v} className="dice-face" style={{ transform: f.t }}>
                {Array.from({ length: 9 }, (_, c) =>
                  PIP[f.v].includes(c) ? <span key={c} className="dice-pip" /> : <span key={c} />,
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
