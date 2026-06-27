import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { buzz } from '../lib/haptics'

// Pip-Positionen im 3×3-Raster (0..8) je Augenzahl.
const PIP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// Würfelnetz: gegenüberliegende Flächen ergeben 7.
// BoxGeometry-Materialreihenfolge: [+X, -X, +Y, -Y, +Z, -Z]
const FACE_VALUES = [2, 5, 1, 6, 3, 4]

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function makeFaceTexture(value: number): THREE.CanvasTexture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')!
  const g = x.createLinearGradient(0, 0, s, s)
  g.addColorStop(0, '#f6f8ff')
  g.addColorStop(1, '#dde3f1')
  x.fillStyle = g
  roundRect(x, 3, 3, s - 6, s - 6, 20)
  x.fill()
  x.fillStyle = '#0a0e16'
  const r = s * 0.082
  const pos = [
    [0.27, 0.27], [0.5, 0.27], [0.73, 0.27],
    [0.27, 0.5], [0.5, 0.5], [0.73, 0.5],
    [0.27, 0.73], [0.5, 0.73], [0.73, 0.73],
  ]
  for (const idx of PIP[value]) {
    const [px, py] = pos[idx]
    x.beginPath()
    x.arc(px * s, py * s, r, 0, Math.PI * 2)
    x.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  return t
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/**
 * Echte 3D-Würfel (three.js + cannon-es). Die Werte sind vorbestimmt; die
 * Physik tumbelt & kollidiert nur als Show, am Ende dreht sich jeder Würfel zur
 * vorgegebenen Augenzahl. Offline-tauglich (keine externen Assets). Bei WebGL-
 * Problemen wird sofort `onSettle` aufgerufen (Fallback auf den 2D-Flow).
 */
export default function Dice3D({ values, onSettle }: { values: number[]; onSettle: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const settledRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const finish = () => {
      if (settledRef.current) return
      settledRef.current = true
      onSettle()
    }

    let cleanup = () => {}
    try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

    const width = mount.clientWidth || 320
    const height = mount.clientHeight || 320
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100)
    camera.position.set(0, 6.8, 5.0)
    camera.lookAt(0, 0.2, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const dir = new THREE.DirectionalLight(0xfff0d0, 1.1)
    dir.position.set(4, 10, 6)
    scene.add(dir)
    const fill = new THREE.DirectionalLight(0x7c8bff, 0.35)
    fill.position.set(-6, 4, -4)
    scene.add(fill)

    // dunkle "Schale" als Boden
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0e1320, roughness: 0.9, metalness: 0.1 })
    const ARENA = 2.5 // halbe Spielfeldbreite – kompakt, damit alle Würfel im Bild bleiben
    const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(ARENA + 0.5, 48), floorMat)
    floorMesh.rotation.x = -Math.PI / 2
    scene.add(floorMesh)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA + 0.5, 0.14, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0xf5b83d, roughness: 0.5, metalness: 0.4 }),
    )
    ring.rotation.x = -Math.PI / 2
    scene.add(ring)

    // Physik
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0) })
    world.broadphase = new CANNON.NaiveBroadphase()
    world.allowSleep = true
    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() })
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    world.addBody(floorBody)
    const wallCfg: { p: [number, number, number]; ry: number }[] = [
      { p: [0, 0, -ARENA], ry: 0 }, // Normal +Z → zur Mitte
      { p: [0, 0, ARENA], ry: Math.PI }, // Normal -Z → zur Mitte
      { p: [-ARENA, 0, 0], ry: Math.PI / 2 }, // Normal +X → zur Mitte
      { p: [ARENA, 0, 0], ry: -Math.PI / 2 }, // Normal -X → zur Mitte
    ]
    for (const w of wallCfg) {
      const b = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() })
      b.quaternion.setFromEuler(0, w.ry, 0)
      b.position.set(w.p[0], w.p[1], w.p[2])
      world.addBody(b)
    }

    const textures = [1, 2, 3, 4, 5, 6].map(makeFaceTexture)
    const matFor = (v: number) =>
      new THREE.MeshStandardMaterial({ map: textures[v - 1], roughness: 0.45, metalness: 0.05 })

    const S = 0.85 // Würfel-Kantenlänge
    const dice = values.map((value, i) => {
      const geo = new THREE.BoxGeometry(S, S, S)
      const mats = FACE_VALUES.map((fv) => matFor(fv))
      const mesh = new THREE.Mesh(geo, mats)
      scene.add(mesh)
      const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(S / 2, S / 2, S / 2)),
        allowSleep: true,
        sleepSpeedLimit: 0.2,
        sleepTimeLimit: 0.15,
      })
      const col = i % 3
      const row = Math.floor(i / 3)
      body.position.set(-1 + col * 1, 2.4 + row * 0.9, -0.5 + row * 1)
      body.velocity.set(rand(-2.5, 2.5), rand(0, 1.5), rand(-2.5, 2.5))
      body.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8))
      world.addBody(body)
      return { mesh, body, value, relabeled: false }
    })

    // Lokale Flächennormalen → Materialindex (BoxGeometry: +X,-X,+Y,-Y,+Z,-Z).
    const FACE_NORMALS: [THREE.Vector3, number][] = [
      [new THREE.Vector3(1, 0, 0), 0],
      [new THREE.Vector3(-1, 0, 0), 1],
      [new THREE.Vector3(0, 1, 0), 2],
      [new THREE.Vector3(0, -1, 0), 3],
      [new THREE.Vector3(0, 0, 1), 4],
      [new THREE.Vector3(0, 0, -1), 5],
    ]
    // Relabel-Technik: die obenliegende Fläche bekommt die vorbestimmte Augenzahl,
    // ohne den Würfel zu drehen → kein "Umspringen".
    const relabel = (d: (typeof dice)[number]) => {
      const tmp = new THREE.Vector3()
      let bestIdx = 2
      let bestY = -Infinity
      for (const [n, idx] of FACE_NORMALS) {
        tmp.copy(n).applyQuaternion(d.mesh.quaternion)
        if (tmp.y > bestY) {
          bestY = tmp.y
          bestIdx = idx
        }
      }
      const mat = (d.mesh.material as THREE.MeshStandardMaterial[])[bestIdx]
      mat.map = textures[d.value - 1]
      mat.needsUpdate = true
      d.relabeled = true
    }

    let raf = 0
    let last = performance.now()
    const start = last
    let lastBuzz = 0
    let settledAt = 0

    const tick = (now: number) => {
      try {
        const dt = Math.min((now - last) / 1000, 1 / 30)
        last = now
        world.step(1 / 60, dt, 3)

        const elapsed = now - start
        for (const d of dice) {
          d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z)
          d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w)
        }

        const maxSpeed = Math.max(...dice.map((d) => d.body.velocity.length()))
        if (maxSpeed > 1.5 && now - lastBuzz > 90) {
          buzz(8)
          lastBuzz = now
        }

        // Zur Ruhe gekommen (oder Sicherheits-Timeout) → Augenzahl auf die
        // obenliegende Fläche legen (kein Drehen) und fertig.
        const calm = elapsed > 700 && maxSpeed < 0.25
        if (calm || elapsed > 3500) {
          if (!settledAt) settledAt = now
          // kurz nachschwingen lassen, dann relabeln
          if (now - settledAt > 120 || elapsed > 3500) {
            dice.forEach((d) => !d.relabeled && relabel(d))
            renderer.render(scene, camera)
            buzz(12)
            // einen Moment das Ergebnis zeigen, dann zum Tippen weiter
            window.setTimeout(finish, 650)
            return
          }
        }

        renderer.render(scene, camera)
        raf = requestAnimationFrame(tick)
      } catch (e) {
        cancelAnimationFrame(raf)
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    raf = requestAnimationFrame(tick)

    const onResize = () => {
      const w = mount.clientWidth || width
      const h = mount.clientHeight || height
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    cleanup = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      textures.forEach((t) => t.dispose())
      dice.forEach((d) => {
        d.mesh.geometry.dispose()
        ;(d.mesh.material as THREE.Material[]).forEach((m) => m.dispose())
      })
      floorMesh.geometry.dispose()
      floorMat.dispose()
      ring.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
    } catch (e) {
      // 3D-Setup fehlgeschlagen → Fehlermeldung zeigen (per „Überspringen" weiter).
      setError(e instanceof Error ? e.message : String(e))
    }
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <div className="mb-2 text-sm font-bold text-coral-400">3D nicht verfügbar</div>
          <div className="text-[11px] leading-relaxed text-fog-500">{error}</div>
          <div className="mt-2 text-[10px] text-fog-600">(Tippe „Überspringen" – das Spiel läuft normal weiter.)</div>
        </div>
      </div>
    )
  }

  return <div ref={mountRef} className="h-full w-full" />
}
