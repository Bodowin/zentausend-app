// Lokale Geräte-Einstellungen (Sound, Würfel-Design). Bewusst simpel gehalten
// und vom Spielstand getrennt – rein kosmetisch / pro Gerät.

const KEY = '10k_prefs_v1'

import type { DiceMode } from './types'

export type DiceTheme = 'classic' | 'ruby' | 'onyx' | 'sky' | 'emerald'

export interface Prefs {
  /** Aufprall-/Tipp-Sounds im virtuellen Würfelmodus. */
  sound: boolean
  /** Optik der virtuellen Würfel. */
  diceTheme: DiceTheme
  /** Zuletzt genutzter Würfelmodus (Vorauswahl im Startbildschirm). */
  defaultDiceMode: DiceMode
  /** „X ist dran"-Einblendung beim Spielerwechsel. */
  handoff: boolean
  /** Mini-Punktekurve in den Spieler-Kacheln. */
  miniChart: boolean
  /** Zuletzt verwendeter Anlass – Vorschlag fürs nächste Spiel (z. B. ein
   * mehrtägiger Urlaub, ohne ihn jedes Mal neu eintippen zu müssen). */
  lastEvent: string
}

const DEFAULTS: Prefs = {
  sound: true,
  diceTheme: 'classic',
  defaultDiceMode: 'real',
  handoff: true,
  miniChart: true,
  lastEvent: '',
}

export function getPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Prefs>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/** Farbwerte je Würfel-Design: Flächen-Verlauf (hi/mid/lo) + Augen (a/b). */
export const DICE_THEMES: Record<
  DiceTheme,
  { label: string; hi: string; mid: string; lo: string; pipA: string; pipB: string }
> = {
  classic: { label: 'Klassisch', hi: '#fbf8f0', mid: '#efeadb', lo: '#e1dbca', pipA: '#2b2b2b', pipB: '#131313' },
  ruby: { label: 'Rubin', hi: '#ff8a8a', mid: '#e7443f', lo: '#b81f28', pipA: '#fff5f5', pipB: '#f0d0d0' },
  onyx: { label: 'Onyx', hi: '#4a4a55', mid: '#2b2b33', lo: '#16161c', pipA: '#f4f7ff', pipB: '#cfd6e6' },
  sky: { label: 'Eisblau', hi: '#cdebff', mid: '#5cb6f0', lo: '#2f7fc4', pipA: '#0a2233', pipB: '#04101a' },
  emerald: { label: 'Smaragd', hi: '#9ff0c9', mid: '#28b97f', lo: '#127a52', pipA: '#04241a', pipB: '#021109' },
}
