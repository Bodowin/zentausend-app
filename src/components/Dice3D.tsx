import { useEffect, useRef } from 'react'
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

function targetQuat(value: number): THREE.Quaternion {
  const q = new THREE.Quaternion()
  const X = new THREE.Vector3(1, 0, 0)
  const Z = new THREE.Vector3(0, 0, 1)
  if (value === 6) q.setFromAxisAngle(X, Math.PI)
  else if (value === 2) q.setFromAxisAngle(Z, Math.PI / 2)
  else if (value === 5) q.setFromAxisAngle(Z, -Math.PI / 2)
  else if (value === 3) q.setFromAxisAngle(X, -Math.PI / 2)
  else if (value === 4) q.setFromAxisAngle(X, Math.PI / 2)
  return q
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

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const finish = () => {
      if (settledRef.current) return
      settledRef.current = true
      onSettle()
    }

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      finish()
      return
    }

    const width = mount.clientWidth || 320
    const height = mount.clientHeight || 320
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 8.5, 5.5)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const dir = new THREE.DirectionalLight(0xfff0d0, 1.1)
    dir.position.set(4, 10, 6)
    scene.add(dir)
    const fill = new THREE.DirectionalLight(0x7c8bff, 0.35)
    fill.position.set(-6, 4, -4)
    scene.add(fill)

    // dunkle "Schale" als Boden
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0e1320, roughness: 0.9, metalness: 0.1 })
    const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), floorMat)
    floorMesh.rotation.x = -Math.PI / 2
    scene.add(floorMesh)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.18, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0xf5b83d, roughness: 0.5, metalness: 0.4 }),
    )
    ring.rotation.x = -Math.PI / 2
    scene.add(ring)

    // Physik
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) })
    world.broadphase = new CANNON.NaiveBroadphase()
    world.allowSleep = true
    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() })
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    world.addBody(floorBody)
    const wallCfg: { p: [number, number, number]; ry: number }[] = [
      { p: [0, 0, -4], ry: 0 }, // Normal +Z → zur Mitte
      { p: [0, 0, 4], ry: Math.PI }, // Normal -Z → zur Mitte
      { p: [-4, 0, 0], ry: Math.PI / 2 }, // Normal +X → zur Mitte
      { p: [4, 0, 0], ry: -Math.PI / 2 }, // Normal -X → zur Mitte
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

    const dice = values.map((value, i) => {
      const geo = new THREE.BoxGeometry(1, 1, 1)
      const mats = FACE_VALUES.map((fv) => matFor(fv))
      const mesh = new THREE.Mesh(geo, mats)
      scene.add(mesh)
      const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
        allowSleep: true,
        sleepSpeedLimit: 0.25,
        sleepTimeLimit: 0.2,
      })
      body.position.set(rand(-1.6, 1.6), 3 + i * 0.7, rand(-1.6, 1.6))
      body.velocity.set(rand(-4, 4), rand(1, 3), rand(-4, 4))
      body.angularVelocity.set(rand(-10, 10), rand(-10, 10), rand(-10, 10))
      world.addBody(body)
      return { mesh, body, value, snapping: false }
    })

    let raf = 0
    let last = performance.now()
    const start = last
    let lastBuzz = 0
    let snapPhase = false

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      world.step(1 / 60, dt, 3)

      const elapsed = now - start
      const maxSpeed = Math.max(...dice.map((d) => d.body.velocity.length()))
      if (!snapPhase && (elapsed > 1500 || (elapsed > 600 && maxSpeed < 0.4))) {
        snapPhase = true
      }

      for (const d of dice) {
        d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z)
        if (snapPhase) {
          d.mesh.quaternion.slerp(targetQuat(d.value), 0.16)
        } else {
          d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w)
        }
      }

      if (!snapPhase && maxSpeed > 2 && now - lastBuzz > 90) {
        buzz(8)
        lastBuzz = now
      }

      renderer.render(scene, camera)

      // Snap fertig oder Sicherheits-Timeout → fertig.
      if ((snapPhase && elapsed > 2100) || elapsed > 4000) {
        buzz(12)
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
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

    return () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={mountRef} className="h-full w-full" />
}
