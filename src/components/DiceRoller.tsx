import { useCallback, useEffect, useRef, useState } from 'react'
import { buzz } from '../lib/haptics'
import { IconX } from './Icons'

// Pip-Positionen im 3×3-Raster (0..8) je Augenzahl.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// Würfel-Drehung, um die jeweilige Augenzahl nach vorne zu bringen.
const BASE: Record<number, [number, number]> = {
  1: [0, 0],
  2: [90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  6: [0, 180],
}

// Feste Position der 6 Flächen am Würfel (gegenüberliegende ergeben 7).
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
 * Virtuelle 3D-Würfel als Notlösung. Das Ergebnis ist fairer Zufall; die Physik
 * (Tumbeln, gestaffeltes Landen, Anstoßen) ist Show. Es wird NICHT automatisch
 * gewertet – die Werte tippt man danach wie gewohnt selbst ein.
 */
export function DiceRoller({ count, onClose }: { count: number; onClose: () => void }) {
  const [dice, setDice] = useState<DieState[]>([])
  const [rolling, setRolling] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const prev = useRef<DieState[]>([])

  const roll = useCallback(() => {
    setRolling(true)
    setShakeKey((k) => k + 1)
    buzz([16, 24, 16])
    const next: DieState[] = Array.from({ length: count }, (_, i) => {
      const value = 1 + rnd(6)
      const [brx, bry] = BASE[value]
      const base = prev.current[i] ?? { rx: 0, ry: 0 }
      // an die letzte Drehung anknüpfen + 3–5 ganze Zusatzdrehungen (Tumble)
      const rx = Math.ceil(base.rx / 360) * 360 + 360 * (3 + rnd(3)) + brx
      const ry = Math.ceil(base.ry / 360) * 360 + 360 * (3 + rnd(3)) + bry
      return { value, rx, ry, delay: i * 70 }
    })
    prev.current = next
    setDice(next)
    window.setTimeout(() => {
      setRolling(false)
      buzz(12)
    }, 1100 + count * 70)
  }, [count])

  useEffect(() => {
    roll()
  }, [roll])

  return (
    <div className="glass fixed inset-0 z-[60] flex flex-col items-center justify-center p-6">
      <button
        onClick={onClose}
        className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] grid h-10 w-10 place-items-center rounded-full text-fog-400 hover:text-fog-100"
        aria-label="Schließen"
      >
        <IconX />
      </button>

      <h2 className="font-display text-2xl font-black tracking-tight text-fog-100">Virtuelle Würfel</h2>
      <p className="mt-1 max-w-xs text-center text-xs text-fog-500">
        Notlösung ohne echte Würfel. Tippe die Werte danach wie gewohnt selbst ein.
      </p>

      <div
        key={shakeKey}
        className={`my-9 flex max-w-xs flex-wrap items-center justify-center gap-4 ${
          rolling ? 'tray-shake' : ''
        }`}
        style={rolling ? { animation: 'tray-shake 0.5s ease' } : undefined}
      >
        {dice.map((d, i) => (
          <div key={i} className="dice-scene">
            <div
              className="dice-cube"
              style={{
                transform: `rotateX(${d.rx}deg) rotateY(${d.ry}deg)`,
                transitionDelay: `${d.delay}ms`,
              }}
            >
              {FACES.map((f) => (
                <div key={f.v} className="dice-face" style={{ transform: f.t }}>
                  {Array.from({ length: 9 }, (_, c) =>
                    PIPS[f.v].includes(c) ? (
                      <span key={c} className="dice-pip" />
                    ) : (
                      <span key={c} />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="h-7">
        {!rolling && dice.length > 0 && (
          <div className="animate-pop text-sm text-fog-300">
            Wurf:{' '}
            <span className="font-mono font-bold text-gold-400">
              {[...dice.map((d) => d.value)].sort((a, b) => a - b).join(' · ')}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={roll}
        disabled={rolling}
        className="mt-6 flex items-center gap-2 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 px-8 py-4 text-lg font-bold text-ink-950 shadow-lg shadow-gold-500/20 transition-all active:scale-95 disabled:opacity-60"
      >
        🎲 {rolling ? 'Würfelt…' : 'Würfeln'}
      </button>
    </div>
  )
}
