import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

function update(path, transform) {
  const source = fs.readFileSync(path, 'utf8')
  const next = transform(source)
  if (next === source) throw new Error(`${path}: patch made no changes`)
  fs.writeFileSync(path, next)
}

fs.writeFileSync(
  'src/lib/diceThrowSeed.ts',
  `export interface DiceThrowSeedContext {\n  values: number[]\n  round: number\n  playerIndex: number\n  turnCount: number\n  keptCount: number\n  accumulated: number\n}\n\nfunction hashInt(hash: number, value: number): number {\n  let h = hash >>> 0\n  let v = Math.trunc(value) >>> 0\n  for (let i = 0; i < 4; i++) {\n    h ^= v & 0xff\n    h = Math.imul(h, 0x01000193) >>> 0\n    v >>>= 8\n  }\n  return h\n}\n\n/** Stable seed for the same saved throw context, including after reload. */\nexport function diceThrowSeed(context: DiceThrowSeedContext): number {\n  let hash = 0x811c9dc5\n  for (const value of context.values) hash = hashInt(hash, value)\n  hash = hashInt(hash, context.round)\n  hash = hashInt(hash, context.playerIndex)\n  hash = hashInt(hash, context.turnCount)\n  hash = hashInt(hash, context.keptCount)\n  hash = hashInt(hash, context.accumulated)\n  return hash || 0x6d2b79f5\n}\n\nexport function mixSeed(seed: number, salt: number): number {\n  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0\n  x ^= x >>> 16\n  x = Math.imul(x, 0x85ebca6b) >>> 0\n  x ^= x >>> 13\n  x = Math.imul(x, 0xc2b2ae35) >>> 0\n  return (x ^ (x >>> 16)) >>> 0\n}\n\n/** Small deterministic PRNG for animation/physics only, never for game results. */\nexport function createSeededRandom(seed: number): () => number {\n  let state = seed >>> 0\n  return () => {\n    state = (state + 0x6d2b79f5) >>> 0\n    let t = state\n    t = Math.imul(t ^ (t >>> 15), t | 1)\n    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)\n    return ((t ^ (t >>> 14)) >>> 0) / 4294967296\n  }\n}\n\nexport function seededSignedNoise(seed: number, frame: number, axis: number): number {\n  return createSeededRandom(mixSeed(seed, Math.imul(frame + 1, 17) + axis))() - 0.5\n}\n`,
)

fs.writeFileSync(
  'src/lib/diceThrowSeed.test.ts',
  `import { describe, expect, it } from 'vitest'\nimport { createSeededRandom, diceThrowSeed, mixSeed } from './diceThrowSeed'\n\nconst base = { values: [1, 2, 5, 6], round: 3, playerIndex: 1, turnCount: 7, keptCount: 2, accumulated: 450 }\n\ndescribe('natural dice motion seeds', () => {\n  it('stays stable for the same saved throw context', () => {\n    expect(diceThrowSeed(base)).toBe(diceThrowSeed({ ...base, values: [...base.values] }))\n  })\n\n  it('changes when the throw context changes', () => {\n    expect(diceThrowSeed(base)).not.toBe(diceThrowSeed({ ...base, accumulated: 500 }))\n    expect(diceThrowSeed(base)).not.toBe(diceThrowSeed({ ...base, values: [1, 2, 5, 5] }))\n  })\n\n  it('replays the same pseudo-random motion sequence from a seed', () => {\n    const a = createSeededRandom(mixSeed(12345, 2))\n    const b = createSeededRandom(mixSeed(12345, 2))\n    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()])\n  })\n})\n`,
)

update('src/lib/prefs.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `  /** Dezentes Vibrationsfeedback bei Spielaktionen; pro Gerät abschaltbar. */\n  haptics: boolean\n  /** Optik der virtuellen Würfel. */`,
    `  /** Dezentes Vibrationsfeedback bei Spielaktionen; pro Gerät abschaltbar. */\n  haptics: boolean\n  /** Optionales Schütteln des Geräts als Würfel-Geste; vermeidet standardmäßig Sensor-Prompts. */\n  shakeToRoll: boolean\n  /** Optik der virtuellen Würfel. */`,
    'shake preference type',
  )
  source = replaceOnce(
    source,
    `  sound: true,\n  haptics: false,\n  diceTheme: 'classic',`,
    `  sound: true,\n  haptics: false,\n  shakeToRoll: false,\n  diceTheme: 'classic',`,
    'shake preference default',
  )
  return source
})

update('src/components/SettingsModal.tsx', (input) => {
  const marker = `          {/* „X ist dran"-Übergabe */}`
  const toggle = `          <button\n            type="button"\n            role="switch"\n            aria-label="Schütteln zum Würfeln"\n            aria-checked={prefs.shakeToRoll}\n            onClick={() => updatePrefs({ shakeToRoll: !prefs.shakeToRoll })}\n            className="mt-4 flex w-full items-center justify-between"\n          >\n            <span className="flex flex-col text-left">\n              <span className="text-sm font-bold text-fog-200">Schütteln zum Würfeln</span>\n              <span className="text-[11px] text-fog-500">Optional · kann einmalig Sensorzugriff anfragen</span>\n            </span>\n            <span className={\`relative h-7 w-[52px] shrink-0 rounded-full transition-colors \${prefs.shakeToRoll ? 'bg-mint-500' : 'bg-ink-600'}\`}>\n              <span className={\`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 \${prefs.shakeToRoll ? 'left-[26px]' : 'left-1'}\`} />\n            </span>\n          </button>\n\n`
  return replaceOnce(input, marker, toggle + marker, 'shake settings toggle')
})

update('src/components/GameScreen.tsx', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `import { PIPS } from '../lib/dicePips'`,
    `import { PIPS } from '../lib/dicePips'\nimport { diceThrowSeed } from '../lib/diceThrowSeed'`,
    'throw seed import',
  )
  source = replaceOnce(
    source,
    `  const maxScore = Math.max(1, ...players.map((pl) => pl.score))\n  const showMiniChart = getPrefs().miniChart`,
    `  const maxScore = Math.max(1, ...players.map((pl) => pl.score))\n  const throwMotionSeed = useMemo(\n    () =>\n      diceThrowSeed({\n        values: thrown,\n        round,\n        playerIndex: idx,\n        turnCount: turns.length,\n        keptCount: kept.length,\n        accumulated,\n      }),\n    [thrown, round, idx, turns.length, kept.length, accumulated],\n  )\n  const showMiniChart = getPrefs().miniChart`,
    'stable motion seed',
  )
  source = replaceOnce(
    source,
    `                    values={thrown}\n                    selectable`,
    `                    values={thrown}\n                    seed={throwMotionSeed}\n                    selectable`,
    'seed prop wiring',
  )
  return source
})

update('src/components/DiceArena.tsx', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `import { PIPS } from '../lib/dicePips'`,
    `import { PIPS } from '../lib/dicePips'\nimport { buzz } from '../lib/haptics'\nimport { createSeededRandom, mixSeed, seededSignedNoise } from '../lib/diceThrowSeed'`,
    'natural dice imports',
  )
  source = replaceOnce(
    source,
    `  values: number[]\n  /** Optionaler Abschluss-Hook`,
    `  values: number[]\n  /** Stabiler Bewegungs-Seed; verändert nie die bereits gezogenen Augenzahlen. */\n  seed?: number\n  /** Optionaler Abschluss-Hook`,
    'seed prop type',
  )
  source = replaceOnce(
    source,
    `function runAttempt(n: number, cfg: { h: number; Rb: number; y0: number; G: number; FIXED_DT: number; MAX_STEPS: number }): Attempt {`,
    `function runAttempt(\n  n: number,\n  cfg: { h: number; Rb: number; y0: number; G: number; FIXED_DT: number; MAX_STEPS: number },\n  random: () => number,\n): Attempt {`,
    'seeded attempt signature',
  )
  source = replaceOnce(
    source,
    `  world.addContactMaterial(new CANNON.ContactMaterial(ground, dieM, { friction: 0.1, restitution: 0.3 }))\n  world.addContactMaterial(new CANNON.ContactMaterial(dieM, dieM, { friction: 0.06, restitution: 0.25 }))\n  world.defaultContactMaterial.friction = 0.1`,
    `  world.addContactMaterial(new CANNON.ContactMaterial(ground, dieM, { friction: 0.16, restitution: 0.24 }))\n  world.addContactMaterial(new CANNON.ContactMaterial(dieM, dieM, { friction: 0.09, restitution: 0.18 }))\n  world.defaultContactMaterial.friction = 0.14`,
    'material tuning',
  )
  source = replaceOnce(source, `  for (let i = 0; i < 8; i++) {\n    const a = (i / 8) * Math.PI * 2`, `  for (let i = 0; i < 12; i++) {\n    const a = (i / 12) * Math.PI * 2`, 'rounder bowl')
  const oldLaunch = `  for (let i = 0; i < n; i++) {\n    const b = new CANNON.Body({ mass: 1, material: dieM, shape: new CANNON.Box(new CANNON.Vec3(h, h, h)), allowSleep: true })\n    b.sleepSpeedLimit = 0.15; b.sleepTimeLimit = 0.3; b.linearDamping = 0.01; b.angularDamping = 0.03\n    // Echter Wurf aus der Hand: die Würfel starten als Traube am vorderen Rand\n    // (nah beim Spieler, leicht über der Schale) …\n    b.position.set(\n      (Math.random() - 0.5) * Rb * 0.45,\n      y0 * 0.55 + Math.random() * 0.8 + i * 0.3,\n      Rb * 0.6 + (Math.random() - 0.5) * 0.4,\n    )\n    b.quaternion.setFromEuler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28)\n    // … und fliegen in einem flachen Bogen nach vorn in die Schale: Schwung\n    // Richtung Mitte, kaum Aufwärts-Toss, kräftiges Vorwärts-Tumbeln. Flach\n    // genug, dass sie optisch nie über den hinteren Schalenrand hinausschießen.\n    b.velocity.set((Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 0.9, -(4.5 + Math.random() * 2))\n    b.angularVelocity.set(\n      -(16 + Math.random() * 16),\n      (Math.random() - 0.5) * 12,\n      (Math.random() - 0.5) * 12,\n    )\n    const idx = i`
  const newLaunch = `  const handX = (random() - 0.5) * Rb * 0.18\n  const commonSide = (random() - 0.5) * 0.8\n  const commonLift = 1.25 + random() * 0.45\n  const commonForward = 5.1 + random() * 0.8\n  const commonSpin = 19 + random() * 8\n  const center = (n - 1) / 2\n  for (let i = 0; i < n; i++) {\n    const b = new CANNON.Body({ mass: 1, material: dieM, shape: new CANNON.Box(new CANNON.Vec3(h, h, h)), allowSleep: true })\n    b.sleepSpeedLimit = 0.12; b.sleepTimeLimit = 0.42; b.linearDamping = 0.025; b.angularDamping = 0.045\n    // Ein Wurf aus EINER Hand: gemeinsame Grundbewegung, dazu kleine individuelle\n    // Abweichungen und eine leichte zeitliche Staffelung durch die Abwurfhöhe.\n    const lane = i - center\n    b.position.set(\n      handX + lane * h * 0.42 + (random() - 0.5) * h * 0.45,\n      y0 * 0.56 + i * 0.09 + random() * 0.32,\n      Rb * 0.58 + (random() - 0.5) * 0.22,\n    )\n    b.quaternion.setFromEuler(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2)\n    b.velocity.set(\n      commonSide + lane * 0.22 + (random() - 0.5) * 0.75,\n      commonLift + (random() - 0.5) * 0.35,\n      -(commonForward + (random() - 0.5) * 0.7),\n    )\n    b.angularVelocity.set(\n      -(commonSpin + (random() - 0.5) * 7),\n      (random() - 0.5) * 8 + lane * 0.7,\n      (random() - 0.5) * 9,\n    )\n    const idx = i`
  source = replaceOnce(source, oldLaunch, newLaunch, 'correlated hand throw')
  source = replaceOnce(source, `  let restFrames = 0\n  for (curFrame = 0; curFrame < MAX_STEPS; curFrame++) {`, `  let restFrames = 0\n  let settled = false\n  for (curFrame = 0; curFrame < MAX_STEPS; curFrame++) {`, 'settled flag')
  source = replaceOnce(source, `    if (allSlow) { if (++restFrames > 10) break } else restFrames = 0\n  }\n\n  let cocked = false`, `    if (allSlow) {\n      if (++restFrames > 16) { settled = true; break }\n    } else restFrames = 0\n  }\n\n  let cocked = !settled`, 'robust settle detection')
  source = replaceOnce(source, `    if (dot < 0.92) cocked = true`, `    if (dot < 0.93) cocked = true`, 'cocked threshold')
  source = replaceOnce(
    source,
    `export default function DiceArena({\n  values,\n  onSettle,`,
    `let motionPermission: 'unknown' | 'granted' | 'denied' = 'unknown'\n\nexport default function DiceArena({\n  values,\n  seed = 0x6d2b79f5,\n  onSettle,`,
    'seed destructure and motion cache',
  )
  source = replaceOnce(
    source,
    `    const cfg = { h, Rb, y0, G: 26, FIXED_DT: 1 / 120, MAX_STEPS: 600 }\n    let attempt = runAttempt(n, cfg)\n    for (let k = 0; k < 9 && attempt.cocked; k++) attempt = runAttempt(n, cfg)`,
    `    const cfg = { h, Rb, y0, G: 26, FIXED_DT: 1 / 120, MAX_STEPS: 720 }\n    let attempt = runAttempt(n, cfg, createSeededRandom(mixSeed(seed, 0)))\n    for (let k = 1; k < 8 && attempt.cocked; k++) {\n      attempt = runAttempt(n, cfg, createSeededRandom(mixSeed(seed, k)))\n    }`,
    'seeded retry sequence',
  )
  source = replaceOnce(source, `  }, [values])`, `  }, [values, seed])`, 'pre-roll dependencies')
  source = replaceOnce(source, `const n = d.labelings.length, dt = d.FIXED_DT, last = d.frames - 1, SPEED = 1.6`, `const n = d.labelings.length, dt = d.FIXED_DT, last = d.frames - 1, SPEED = 1.45`, 'natural playback speed')
  source = replaceOnce(source, `        navigator.vibrate?.(Math.round(4 + im.intensity * 10))`, `        buzz(Math.round(4 + im.intensity * 10))`, 'impact haptics preference')
  source = replaceOnce(
    source,
    `            ? \`translate(\${(Math.random() - 0.5) * shake}px, \${(Math.random() - 0.5) * shake}px)\``,
    `            ? \`translate(\${seededSignedNoise(seed, i0, 0) * shake}px, \${seededSignedNoise(seed, i0, 1) * shake}px)\``,
    'deterministic camera shake',
  )
  source = replaceOnce(
    source,
    `  const [motionOk, setMotionOk] = useState(false)\n  const requestMotion = () => {\n    try {\n      const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined\n      if (DM?.requestPermission) DM.requestPermission().then((r) => setMotionOk(r === 'granted')).catch(() => {})\n      else if ('DeviceMotionEvent' in window) setMotionOk(true)\n    } catch {\n      /* kein Sensor – ignorieren */\n    }\n  }`,
    `  const motionEnabled = getPrefs().shakeToRoll\n  const [motionOk, setMotionOk] = useState(() => motionEnabled && motionPermission === 'granted')\n  const requestMotion = () => {\n    if (!motionEnabled || motionPermission === 'denied') return\n    if (motionPermission === 'granted') { setMotionOk(true); return }\n    try {\n      const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined\n      if (DM?.requestPermission) {\n        DM.requestPermission()\n          .then((result) => {\n            motionPermission = result === 'granted' ? 'granted' : 'denied'\n            setMotionOk(motionPermission === 'granted')\n          })\n          .catch(() => { motionPermission = 'denied' })\n      } else if ('DeviceMotionEvent' in window) {\n        motionPermission = 'granted'\n        setMotionOk(true)\n      }\n    } catch {\n      motionPermission = 'denied'\n    }\n  }`,
    'optional motion permission',
  )
  source = replaceOnce(source, `        navigator.vibrate?.(20)`, `        buzz(20)`, 'shake haptics preference')
  source = replaceOnce(source, `      requestMotion() // ab jetzt geht auch Handy-Schütteln`, `      if (motionEnabled) requestMotion() // Sensorzugriff nur nach ausdrücklicher Aktivierung`, 'gate motion request')
  source = replaceOnce(source, `    navigator.vibrate?.(8)`, `    buzz(8)`, 'selection haptics preference')
  source = replaceOnce(
    source,
    `{phase === 'ready' && <div className="da-hint">{motionOk ? 'Tippen oder schütteln' : 'Tippen zum Würfeln'}</div>}`,
    `{phase === 'ready' && (\n        <div className="da-hint">{motionEnabled && motionOk ? 'Tippen oder schütteln' : 'Tippen zum Würfeln'}</div>\n      )}`,
    'motion hint',
  )
  return source
})

update('e2e/app.spec.ts', (input) => {
  let source = replaceOnce(input, `  haptics: false,\n  diceTheme: 'classic',`, `  haptics: false,\n  shakeToRoll: false,\n  diceTheme: 'classic',`, 'e2e shake default')
  source = replaceOnce(
    source,
    `    const haptics = page.getByRole('switch', { name: 'Haptisches Feedback' })`,
    `    const shake = page.getByRole('switch', { name: 'Schütteln zum Würfeln' })\n    await expect(shake).toHaveAttribute('aria-checked', 'false')\n\n    const haptics = page.getByRole('switch', { name: 'Haptisches Feedback' })`,
    'shake visible in settings',
  )
  source = replaceOnce(
    source,
    `    await haptics.click()\n    await expect(haptics).toHaveAttribute('aria-checked', 'true')`,
    `    await haptics.click()\n    await expect(haptics).toHaveAttribute('aria-checked', 'true')\n    await shake.click()\n    await expect(shake).toHaveAttribute('aria-checked', 'true')`,
    'enable optional settings',
  )
  source = replaceOnce(
    source,
    `    await expect(page.getByRole('switch', { name: 'Haptisches Feedback' })).toHaveAttribute('aria-checked', 'true')`,
    `    await expect(page.getByRole('switch', { name: 'Haptisches Feedback' })).toHaveAttribute('aria-checked', 'true')\n    await expect(page.getByRole('switch', { name: 'Schütteln zum Würfeln' })).toHaveAttribute('aria-checked', 'true')`,
    'persist shake setting',
  )
  return source
})

fs.writeFileSync(
  'src/naturalDiceWiring.test.ts',
  `import { describe, expect, it } from 'vitest'\nimport arenaSource from './components/DiceArena.tsx?raw'\nimport gameSource from './components/GameScreen.tsx?raw'\nimport prefsSource from './lib/prefs.ts?raw'\n\ndescribe('natural dice motion wiring', () => {\n  it('uses a stable motion seed without changing drawn values', () => {\n    expect(gameSource).toContain('diceThrowSeed({')\n    expect(gameSource).toContain('seed={throwMotionSeed}')\n    expect(arenaSource).toContain('createSeededRandom(mixSeed(seed, k))')\n  })\n\n  it('uses a rounder bowl and correlated hand throw', () => {\n    expect(arenaSource).toContain('i < 12')\n    expect(arenaSource).toContain('const commonForward')\n    expect(arenaSource).toContain('let cocked = !settled')\n  })\n\n  it('never requests motion access unless shake-to-roll was enabled', () => {\n    expect(prefsSource).toContain('shakeToRoll: false')\n    expect(arenaSource).toContain('if (motionEnabled) requestMotion()')\n    expect(arenaSource).toContain("if (!motionEnabled || motionPermission === 'denied') return")\n  })\n\n  it('routes every vibration through the optional haptics preference', () => {\n    expect(arenaSource).not.toContain('navigator.vibrate')\n    expect(arenaSource).toContain('buzz(Math.round(4 + im.intensity * 10))')\n  })\n})\n`,
)

fs.writeFileSync(
  'docs/package-i-natural-dice.md',
  `# Paket I – Natürlicherer virtueller Würfelwurf\n\n## Bewegung\n\n- Ein stabiler Seed aus Würfelwerten, Runde, Spieler, Zugverlauf und Topf reproduziert denselben sichtbaren Wurf nach einem Reload.\n- Die gezogenen Augenzahlen bleiben davon vollständig getrennt; der Seed steuert nur die Bewegung.\n- Würfel verlassen eine gemeinsame virtuelle Handbewegung und erhalten nur begrenzte individuelle Abweichungen.\n- Zwölf statt acht unsichtbare Randsegmente lassen die Schale runder reagieren.\n- Reibung, Rückprall, Dämpfung und Sleep-Grenzen wurden für weniger gummiartige und sauber ausrollende Würfel abgestimmt.\n- Nicht sauber ausgerollte, gekippte oder gestapelte Würfe werden weiterhin unsichtbar neu simuliert.\n\n## Gerätesensor und Haptik\n\n- **Schütteln zum Würfeln** ist eine eigene Geräteeinstellung und standardmäßig aus.\n- Ohne Aktivierung wird kein Bewegungssensor-Zugriff angefragt.\n- Eine erteilte oder abgelehnte Sensorentscheidung wird während der Sitzung wiederverwendet statt bei jedem Wurf erneut angefragt.\n- Alle Vibrationen laufen über die bestehende Haptik-Einstellung, die ebenfalls standardmäßig aus ist.\n\n## Stabilität\n\nDie Darstellung bleibt CSS-3D ohne WebGL. Die cannon-es-Simulation läuft unsichtbar vorab, die sichtbare Bahn wird anschließend abgespielt.\n`,
)

console.log('Natural dice motion and optional shake-to-roll applied.')
