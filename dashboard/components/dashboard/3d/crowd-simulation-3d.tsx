'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Activity, Pause, Play, Eye, RotateCcw, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RiskEvent } from '@/lib/crowdshield/types'

// ── Static constants (module-level, created once) ─────────────────────────

const GATE_ENTRIES = [
  { id: 'gate_1', name: 'South Gate', x: 0, z: 26, axis: 'z' as const },
  { id: 'gate_2', name: 'West Gate', x: -26, z: 0, axis: 'x' as const },
  { id: 'gate_3', name: 'North Gate', x: 0, z: -26, axis: 'z' as const },
  { id: 'gate_4', name: 'East Gate', x: 26, z: 0, axis: 'x' as const },
] as const

const EXIT_CORNERS: [number, number][] = [
  [-23, -23],
  [23, -23],
  [-23, 23],
  [23, 23],
]

// Pre-computed label positions in 3D space (above each gate + hub)
const LABEL_POS_3D = [
  new THREE.Vector3(0, 6, 26), // South Gate
  new THREE.Vector3(-26, 6, 0), // West Gate
  new THREE.Vector3(0, 6, -26), // North Gate
  new THREE.Vector3(26, 6, 0), // East Gate
  new THREE.Vector3(0, 7, 0), // Central Hub
]

const MAX_AGENTS = 160
const REPEL_DIST = 2.0
const REPEL_STR = 1.6
const BOUND = 27.5

// Flat-ring quaternion for aura (rotate to lie on XZ plane)
const AURA_QUAT = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2
)
const UP_AXIS = new THREE.Vector3(0, 1, 0)
const UNIT_SCALE = new THREE.Vector3(1, 1, 1)

// Agent colors: 0=safe 1=medium 2=high 3=critical
const AGENT_COLORS = [
  new THREE.Color('#22c55e'),
  new THREE.Color('#eab308'),
  new THREE.Color('#f97316'),
  new THREE.Color('#ef4444'),
]

// ── Types ─────────────────────────────────────────────────────────────────

interface Agent {
  px: number
  pz: number // position (y is always 0)
  vx: number
  vz: number // velocity
  tx: number
  tz: number // target
  homeGate: number // index into GATE_ENTRIES
  speed: number
  colorIdx: number
}

// ── Spatial Hash Grid — O(1) avg neighbour lookup ─────────────────────────

class SpatialGrid {
  private cells = new Map<number, number[]>()
  private cs: number

  constructor(cellSize = 2.5) {
    this.cs = cellSize
  }

  clear() {
    this.cells.clear()
  }

  private key(x: number, z: number) {
    return (
      (Math.floor(x / this.cs) & 0xffff) * 65536 +
      (Math.floor(z / this.cs) & 0xffff)
    )
  }

  insert(idx: number, x: number, z: number) {
    const k = this.key(x, z)
    let c = this.cells.get(k)
    if (!c) {
      c = []
      this.cells.set(k, c)
    }
    c.push(idx)
  }

  query(x: number, z: number, out: number[]) {
    out.length = 0
    const cx = Math.floor(x / this.cs)
    const cz = Math.floor(z / this.cs)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const k = ((cx + dx) & 0xffff) * 65536 + ((cz + dz) & 0xffff)
        const c = this.cells.get(k)
        if (c) for (const i of c) out.push(i)
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function dIdx(d: number) {
  return d >= 5 ? 3 : d >= 3 ? 2 : d >= 1.5 ? 1 : 0
}

function exitTarget(): [number, number] {
  const [ex, ez] = EXIT_CORNERS[Math.floor(Math.random() * 4)]
  return [ex + (Math.random() - 0.5) * 3, ez + (Math.random() - 0.5) * 3]
}

function gateSpawn(gi: number): [number, number] {
  const g = GATE_ENTRIES[gi]
  return [g.x + (Math.random() - 0.5) * 9, g.z + (Math.random() - 0.5) * 9]
}

function gateTarget(gi: number): [number, number] {
  const g = GATE_ENTRIES[gi]
  return [g.x + (Math.random() - 0.5) * 5, g.z + (Math.random() - 0.5) * 5]
}

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  events?: Map<string, RiskEvent>
  mode?: 'baseline' | 'ai'
  stageDensities?: Record<string, number>
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────

export function CrowdSimulation3D({
  events,
  mode = 'ai',
  stageDensities = { gate_1: 1.5, gate_2: 1.2, gate_3: 0.8, gate_4: 0.9, center: 1.0 },
  className,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])

  // Three.js objects kept in refs (never trigger re-renders)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const camRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rdrRef = useRef<THREE.WebGLRenderer | null>(null)
  const bodyRef = useRef<THREE.InstancedMesh | null>(null)
  const auraRef = useRef<THREE.InstancedMesh | null>(null)
  const rafRef = useRef<number | null>(null)
  const agentsRef = useRef<Agent[]>([])
  const sgRef = useRef(new SpatialGrid())
  const nearbyBuf = useRef<number[]>([])
  const projV = useRef(new THREE.Vector3())

  // Stable mutable refs for hot-path data
  const isPlayRef = useRef(true)
  const modeRef = useRef(mode)
  const densRef = useRef(stageDensities)

  // Pre-allocated matrix/quat/pos (avoid GC pressure in the loop)
  const mat4 = useRef(new THREE.Matrix4())
  const quat = useRef(new THREE.Quaternion())
  const pos3 = useRef(new THREE.Vector3())

  const [isPlaying, setIsPlaying] = useState(true)
  const [hud, setHud] = useState({ flow: 94, risk: 12 })

  // Keep refs in sync with latest props/state
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    densRef.current = stageDensities
  }, [stageDensities])
  useEffect(() => {
    isPlayRef.current = isPlaying
  }, [isPlaying])

  // ── Agent Spawner ────────────────────────────────────────────────────────

  const spawn = useCallback(
    (
      body: THREE.InstancedMesh,
      aura: THREE.InstancedMesh,
      curMode: 'baseline' | 'ai',
      dens: Record<string, number>
    ) => {
      // Weighted gate distribution based on density + mode
      const weights = GATE_ENTRIES.map((g, i) => {
        const d = dens[g.id] ?? 1
        return curMode === 'baseline'
          ? (i === 0 ? d * 2.8 : d * 0.4) // baseline: overload south gate
          : d * 0.95 // ai: distribute proportionally
      })
      const totalW = weights.reduce((a, b) => a + b, 0)

      const agents: Agent[] = []
      for (let i = 0; i < MAX_AGENTS; i++) {
        // Pick gate by weight
        let pick = Math.random() * totalW
        let gi = 0
        for (let g = 0; g < weights.length; g++) {
          pick -= weights[g]
          if (pick <= 0) {
            gi = g
            break
          }
        }

        const [spawnX, spawnZ] = gateSpawn(gi)
        const [tx, tz] =
          curMode === 'ai'
            ? Math.random() > 0.35
              ? exitTarget()
              : gateTarget(gi)
            : [
                (Math.random() - 0.5) * 12,
                gi === 0 ? Math.random() * 14 : (Math.random() - 0.5) * 18,
              ]

        agents.push({
          px: spawnX,
          pz: spawnZ,
          vx: 0,
          vz: 0,
          tx,
          tz,
          homeGate: gi,
          speed:
            curMode === 'ai'
              ? 0.9 + Math.random() * 0.45
              : 0.5 + Math.random() * 0.3,
          colorIdx: dIdx(dens[GATE_ENTRIES[gi].id] ?? 1),
        })
      }
      agentsRef.current = agents

      // Initialise all instance matrices & colours up front
      for (let i = 0; i < MAX_AGENTS; i++) {
        const a = agents[i]
        pos3.current.set(a.px, 0.8, a.pz)
        mat4.current.compose(pos3.current, quat.current, UNIT_SCALE)
        body.setMatrixAt(i, mat4.current)
        body.setColorAt(i, AGENT_COLORS[a.colorIdx])

        pos3.current.set(a.px, 0.04, a.pz)
        mat4.current.compose(pos3.current, AURA_QUAT, UNIT_SCALE)
        aura.setMatrixAt(i, mat4.current)
        aura.setColorAt(i, AGENT_COLORS[a.colorIdx])
      }
      body.instanceMatrix.needsUpdate = true
      aura.instanceMatrix.needsUpdate = true
      if (body.instanceColor) body.instanceColor.needsUpdate = true
      if (aura.instanceColor) aura.instanceColor.needsUpdate = true
    },
    []
  )

  // ── Scene Builder ────────────────────────────────────────────────────────

  const buildScene = useCallback((scene: THREE.Scene) => {
    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshLambertMaterial({ color: 0xeae0d4 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Subtle grid
    const grid = new THREE.GridHelper(70, 35, 0xc2af96, 0xc2af96)
    grid.position.y = 0.025
    ;(grid.material as THREE.LineBasicMaterial).opacity = 0.28
    ;(grid.material as THREE.LineBasicMaterial).transparent = true
    scene.add(grid)

    // Perimeter walls with gate openings
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xd4c4af })
    const WH = 4,
      WT = 1.2,
      WR = 30.5
    const segs: [number, number, number, number, number, number][] = [
      [-18, WH / 2, WR, 24, WH, WT],
      [18, WH / 2, WR, 24, WH, WT], // S wall
      [-18, WH / 2, -WR, 24, WH, WT],
      [18, WH / 2, -WR, 24, WH, WT], // N wall
      [-WR, WH / 2, -18, WT, WH, 24],
      [-WR, WH / 2, 18, WT, WH, 24], // W wall
      [WR, WH / 2, -18, WT, WH, 24],
      [WR, WH / 2, 18, WT, WH, 24], // E wall
    ]
    segs.forEach(([x, y, z, w, h, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
      m.position.set(x, y, z)
      m.castShadow = true
      scene.add(m)
    })

    // Central concourse platform + pillar
    const conc = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11, 0.35, 48),
      new THREE.MeshLambertMaterial({ color: 0xefe7dd })
    )
    conc.position.y = 0.17
    scene.add(conc)

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 7, 16),
      new THREE.MeshLambertMaterial({ color: 0x44492b })
    )
    pillar.position.set(0, 3.5, 0)
    scene.add(pillar)

    // Concourse ring detail
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(11, 0.25, 8, 64),
      new THREE.MeshLambertMaterial({ color: 0x44492b })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.52
    scene.add(ring)

    // Gate arch indicators (coloured planes, named for later update)
    GATE_ENTRIES.forEach((g) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(
          g.axis === 'z' ? 9 : 0.45,
          5,
          g.axis === 'z' ? 0.45 : 9
        ),
        new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0.22,
        })
      )
      m.position.set(g.x, 2.5, g.z)
      m.name = `gate-${g.id}`
      scene.add(m)

      // Arch pillars
      const pillarMat = new THREE.MeshLambertMaterial({ color: 0x44492b })
      const pA = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), pillarMat)
      const pB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), pillarMat)
      if (g.axis === 'z') {
        pA.position.set(g.x - 4, 2.5, g.z)
        pB.position.set(g.x + 4, 2.5, g.z)
      } else {
        pA.position.set(g.x, 2.5, g.z - 4)
        pB.position.set(g.x, 2.5, g.z + 4)
      }
      scene.add(pA)
      scene.add(pB)

      // Gate glow
      const gl = new THREE.PointLight(0x22c55e, 1.4, 16)
      gl.position.set(g.x, 5, g.z)
      gl.name = `glow-${g.id}`
      scene.add(gl)
    })

    // Exit corner beacons
    EXIT_CORNERS.forEach(([ex, ez]) => {
      const disk = new THREE.Mesh(
        new THREE.CylinderGeometry(3.5, 3.5, 0.1, 24),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true })
      )
      disk.position.set(ex, 0.06, ez)
      scene.add(disk)
      const beacon = new THREE.PointLight(0x22c55e, 1.8, 14)
      beacon.position.set(ex, 3.5, ez)
      scene.add(beacon)
    })
  }, [])

  // ── Scene Initialisation (once on mount) ─────────────────────────────────

  useEffect(() => {
    const container = mountRef.current
    if (!container) return
    const W = container.clientWidth || 880
    const H = container.clientHeight || 480

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#F4F1EA')
    sceneRef.current = scene

    // Camera
    const cam = new THREE.PerspectiveCamera(50, W / H, 0.3, 300)
    cam.position.set(0, 44, 50)
    cam.lookAt(0, 0, 0)
    camRef.current = cam

    // Renderer
    const rdr = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    rdr.setSize(W, H)
    rdr.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rdr.shadowMap.enabled = true
    rdr.shadowMap.type = THREE.PCFSoftShadowMap
    rdrRef.current = rdr
    container.appendChild(rdr.domElement)

    // Lighting
    scene.add(new THREE.AmbientLight(0xfdf8f0, 2.4))

    const sun = new THREE.DirectionalLight(0xffffff, 1.8)
    sun.position.set(30, 60, 40)
    sun.castShadow = true
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 200
    sun.shadow.camera.left = -42
    sun.shadow.camera.right = 42
    sun.shadow.camera.top = 42
    sun.shadow.camera.bottom = -42
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)

    const fill = new THREE.DirectionalLight(0xd4c4af, 0.5)
    fill.position.set(-25, -12, -30)
    scene.add(fill)

    const hub = new THREE.PointLight(0x8fa06e, 2.5, 24)
    hub.position.set(0, 9, 0)
    scene.add(hub)

    // Build venue
    buildScene(scene)

    // Instanced agent body (low-poly capsule-like cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.34, 0.26, 1.6, 8)
    const bodyMat = new THREE.MeshLambertMaterial()
    const body = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX_AGENTS)
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    body.castShadow = false
    scene.add(body)
    bodyRef.current = body

    // Instanced aura ring (XZ-plane ring under each agent)
    const auraGeo = new THREE.RingGeometry(0.42, 0.6, 12)
    const auraMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    })
    const aura = new THREE.InstancedMesh(auraGeo, auraMat, MAX_AGENTS)
    aura.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(aura)
    auraRef.current = aura

    spawn(body, aura, mode, stageDensities)

    // ── Orbit controls (manual, lightweight) ──────────────────────────────
    let dragging = false
    let prevX = 0,
      prevY = 0

    const onMD = (e: MouseEvent) => {
      dragging = true
      prevX = e.clientX
      prevY = e.clientY
    }
    const onMM = (e: MouseEvent) => {
      if (!dragging || !camRef.current) return
      const c = camRef.current
      const r = c.position.length()
      const theta =
        Math.atan2(c.position.x, c.position.z) + (e.clientX - prevX) * 0.004
      c.position.x = r * Math.sin(theta)
      c.position.z = r * Math.cos(theta)
      c.position.y = Math.max(
        10,
        Math.min(82, c.position.y - (e.clientY - prevY) * 0.12)
      )
      c.lookAt(0, 0, 0)
      prevX = e.clientX
      prevY = e.clientY
    }
    const onMU = () => {
      dragging = false
    }
    const onW = (e: WheelEvent) => {
      e.preventDefault()
      if (!camRef.current) return
      camRef.current.position.multiplyScalar(1 + e.deltaY * 0.001)
      camRef.current.position.clampLength(12, 92)
    }
    rdr.domElement.addEventListener('mousedown', onMD)
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
    rdr.domElement.addEventListener('wheel', onW, { passive: false })

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!container || !rdrRef.current || !camRef.current) return
      const w = container.clientWidth,
        h = container.clientHeight
      camRef.current.aspect = w / h
      camRef.current.updateProjectionMatrix()
      rdrRef.current.setSize(w, h)
    })
    ro.observe(container)

    return () => {
      rdr.domElement.removeEventListener('mousedown', onMD)
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseup', onMU)
      rdr.domElement.removeEventListener('wheel', onW)
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rdr.dispose()
      if (container.contains(rdr.domElement))
        container.removeChild(rdr.domElement)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-spawn when scenario stage or mode changes
  useEffect(() => {
    const body = bodyRef.current,
      aura = auraRef.current
    if (!body || !aura) return
    spawn(body, aura, mode, stageDensities)
  }, [mode, stageDensities, spawn])

  // Sync gate indicator colours with density
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    GATE_ENTRIES.forEach((g) => {
      const mesh = scene.getObjectByName(`gate-${g.id}`) as
        | THREE.Mesh
        | undefined
      const light = scene.getObjectByName(`glow-${g.id}`) as
        | THREE.PointLight
        | undefined
      if (!mesh) return
      const d = stageDensities[g.id] ?? 1
      const hex =
        d > 5 ? 0xef4444 : d > 3 ? 0xf97316 : d > 1.5 ? 0xeab308 : 0x22c55e
      ;(mesh.material as THREE.MeshBasicMaterial).color.setHex(hex)
      if (light) light.color.setHex(hex)
    })
  }, [stageDensities])

  // ── Animation / Physics Loop (runs once, reads from refs) ─────────────────

  useEffect(() => {
    let lastT = performance.now()
    let tick = 0

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      const dt = Math.min((now - lastT) / 1000, 0.05)
      lastT = now

      const scene = sceneRef.current,
        cam = camRef.current
      const rdr = rdrRef.current
      const body = bodyRef.current,
        aura = auraRef.current
      if (!scene || !cam || !rdr || !body || !aura) return

      // ── Physics update ──────────────────────────────────────────────────
      if (isPlayRef.current) {
        const agents = agentsRef.current
        const curMode = modeRef.current
        const grid = sgRef.current
        const nearby = nearbyBuf.current

        // Rebuild spatial hash
        grid.clear()
        for (let i = 0; i < agents.length; i++) {
          grid.insert(i, agents[i].px, agents[i].pz)
        }

        let highD = 0

        for (let i = 0; i < agents.length; i++) {
          const a = agents[i]

          // Reached target? Pick a new one.
          const dTx = a.tx - a.px,
            dTz = a.tz - a.pz
          if (dTx * dTx + dTz * dTz < 2.2 * 2.2) {
            if (curMode === 'ai') {
              const [ntx, ntz] =
                Math.random() > 0.35 ? exitTarget() : gateTarget(a.homeGate)
              a.tx = ntx
              a.tz = ntz
            } else {
              a.tx = (Math.random() - 0.5) * 12
              a.tz =
                a.homeGate === 0
                  ? Math.random() * 14
                  : (Math.random() - 0.5) * 18
            }
          }

          // Desired direction (normalised)
          const dl = Math.sqrt(dTx * dTx + dTz * dTz)
          const ndx = dl > 0 ? dTx / dl : 0
          const ndz = dl > 0 ? dTz / dl : 0

          // Repulsion from neighbours via spatial grid
          let rx = 0,
            rz = 0,
            nc = 0
          grid.query(a.px, a.pz, nearby)
          for (const j of nearby) {
            if (j === i) continue
            const b = agents[j]
            const ex = a.px - b.px,
              ez = a.pz - b.pz
            const d2 = ex * ex + ez * ez
            if (d2 < REPEL_DIST * REPEL_DIST && d2 > 0.001) {
              nc++
              const d = Math.sqrt(d2)
              const s = ((REPEL_DIST - d) * REPEL_STR) / REPEL_DIST
              rx += (ex / d) * s
              rz += (ez / d) * s
            }
          }

          // Baseline mode: agents slow down when crowded (stampede dynamics)
          const spd =
            curMode === 'baseline' && nc > 5
              ? Math.max(0.15, a.speed * (1 - nc * 0.09))
              : a.speed

          // Smooth velocity (low-pass filter)
          const fx = ndx * spd + rx,
            fz = ndz * spd + rz
          a.vx += (fx - a.vx) * 0.1
          a.vz += (fz - a.vz) * 0.1

          // Integrate
          a.px = Math.max(-BOUND, Math.min(BOUND, a.px + a.vx * dt * 4))
          a.pz = Math.max(-BOUND, Math.min(BOUND, a.pz + a.vz * dt * 4))

          // Update colour from local crowd pressure
          const localD = nc * 0.42
          const ci = dIdx(localD)
          if (ci !== a.colorIdx) a.colorIdx = ci
          if (ci >= 2) highD++

          // ── Update instanced body matrix ──────────────────────────────
          const yaw =
            a.vx * a.vx + a.vz * a.vz > 0.01 ? Math.atan2(a.vx, a.vz) : 0
          quat.current.setFromAxisAngle(UP_AXIS, yaw)
          pos3.current.set(a.px, 0.8, a.pz)
          mat4.current.compose(pos3.current, quat.current, UNIT_SCALE)
          body.setMatrixAt(i, mat4.current)
          body.setColorAt(i, AGENT_COLORS[a.colorIdx])

          // ── Update instanced aura matrix (always flat on ground) ──────
          pos3.current.set(a.px, 0.04, a.pz)
          mat4.current.compose(pos3.current, AURA_QUAT, UNIT_SCALE)
          aura.setMatrixAt(i, mat4.current)
          aura.setColorAt(i, AGENT_COLORS[a.colorIdx])
        }

        body.instanceMatrix.needsUpdate = true
        aura.instanceMatrix.needsUpdate = true
        if (body.instanceColor) body.instanceColor.needsUpdate = true
        if (aura.instanceColor) aura.instanceColor.needsUpdate = true

        // HUD update throttled to every 20 frames (~3 Hz)
        if (++tick >= 20) {
          tick = 0
          const curMode2 = modeRef.current
          const flow =
            curMode2 === 'ai'
              ? Math.round(87 + Math.random() * 9)
              : Math.round(Math.max(18, 54 - highD * 1.8))
          const risk =
            curMode2 === 'ai'
              ? Math.round(5 + Math.random() * 11)
              : Math.round(Math.min(95, 36 + highD * 3.5))
          setHud({ flow, risk })
        }
      }

      // ── Project zone labels to screen space (DOM-updated, no React re-render) ──
      const W = rdr.domElement.clientWidth
      const H = rdr.domElement.clientHeight
      for (let i = 0; i < LABEL_POS_3D.length; i++) {
        const el = labelRefs.current[i]
        if (!el) continue
        projV.current.copy(LABEL_POS_3D[i]).project(cam)
        if (projV.current.z > 1) {
          el.style.opacity = '0'
          continue
        }
        el.style.opacity = '1'
        el.style.left = `${((projV.current.x + 1) / 2) * W}px`
        el.style.top = `${(-(projV.current.y - 1) / 2) * H}px`
      }

      rdr.render(scene, cam)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zone label content (re-renders only when stageDensities changes) ──────
  const labelData = [
    ...GATE_ENTRIES.map((g) => ({
      id: g.id,
      name: g.name,
      d: stageDensities[g.id] ?? 0,
    })),
    { id: 'center', name: 'Central Hub', d: stageDensities.center ?? 0 },
  ]

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden rounded-2xl bg-[#F4F1EA]',
        className
      )}
    >
      {/* Three.js canvas mount point */}
      <div
        ref={mountRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />

      {/* ── Zone density labels (position managed via DOM ref, content via React) */}
      {labelData.map((l, i) => {
        const c =
          l.d > 5
            ? '#c53030'
            : l.d > 3
              ? '#ea580c'
              : l.d > 1.5
                ? '#d97706'
                : '#38663e'
        return (
          <div
            key={l.id}
            ref={(el) => {
              labelRefs.current[i] = el
            }}
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ transition: 'opacity 0.25s' }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="px-2 py-0.5 rounded-full text-white text-[9px] font-bold shadow-lg whitespace-nowrap"
                style={{
                  background: c,
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {l.name}
              </div>
              <div
                className="px-1.5 rounded text-[9px] font-bold bg-white/90 border shadow-sm whitespace-nowrap"
                style={{
                  color: c,
                  borderColor: c,
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {l.d.toFixed(1)} p/m²
              </div>
            </div>
          </div>
        )
      })}

      {/* ── Mode badge (top-left) ─────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-20">
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-sm',
            mode === 'ai'
              ? 'bg-[#38663e]/15 border-[#38663e]/40'
              : 'bg-[#c53030]/15 border-[#c53030]/40'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              mode === 'ai'
                ? 'bg-[#22c55e] animate-pulse'
                : 'bg-[#ef4444] animate-ping'
            )}
          />
          <span
            className={cn(
              'text-xs font-bold',
              mode === 'ai' ? 'text-[#38663e]' : 'text-[#c53030]'
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {mode === 'ai'
              ? 'CrowdShield AI — Rerouting Active'
              : 'Baseline — No Intervention'}
          </span>
        </div>
      </div>

      {/* ── Live Telemetry HUD (top-right) ───────────────────────────────── */}
      <div className="absolute top-3 right-3 z-20 w-48 bg-white/90 backdrop-blur-md border border-[#C2AF96] rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#C2AF96]">
          <span
            className="text-[11px] font-bold text-[#11130F]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Live Telemetry
          </span>
          <Activity className="w-3.5 h-3.5 text-[#44492B]" />
        </div>
        <div className="space-y-1">
          {[
            { label: 'Agents', val: `${MAX_AGENTS}`, col: '#11130F' },
            {
              label: 'Flow Efficiency',
              val: `${hud.flow}%`,
              col: hud.flow > 70 ? '#38663e' : '#c53030',
            },
            {
              label: 'Crush Risk',
              val: `${hud.risk}%`,
              col:
                hud.risk < 20
                  ? '#38663e'
                  : hud.risk < 50
                    ? '#d97706'
                    : '#c53030',
            },
            {
              label: 'Bottleneck',
              val: mode === 'ai' ? 'None' : 'South Gate',
              col: mode === 'ai' ? '#38663e' : '#c53030',
            },
          ].map(({ label, val, col }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-[11px] text-[#424735]">{label}</span>
              <span
                className="text-[11px] font-bold"
                style={{
                  color: col,
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scenario context (centre top) ─────────────────────────────────── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-white/90 backdrop-blur-sm border border-[#C2AF96] rounded-xl px-4 py-2 text-center shadow-sm">
          <p
            className="text-[10px] font-bold text-[#44492B]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {mode === 'baseline'
              ? '⚠ Unmanaged crowd — South Gate congestion building'
              : '✓ CrowdShield distributing flow across all gates'}
          </p>
        </div>
      </div>

      {/* ── Controls (bottom-left) ────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
        <button
          onClick={() => setIsPlaying((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border border-[#C2AF96] text-[#11130F] text-xs font-bold hover:bg-[#44492B] hover:text-white transition-all cursor-pointer shadow-sm"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {isPlaying ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          {isPlaying ? 'Pause' : 'Resume'}
        </button>
        <span className="text-[10px] text-[#424735] bg-white/80 border border-[#C2AF96] px-2 py-1.5 rounded-lg backdrop-blur-sm">
          🖱 Drag to orbit · Scroll to zoom
        </span>
      </div>

      {/* ── Density legend (bottom-right) ─────────────────────────────────── */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-[#C2AF96] rounded-xl px-3 py-2 shadow-sm">
        {(
          [
            ['#22c55e', 'Safe'],
            ['#eab308', 'Medium'],
            ['#f97316', 'High'],
            ['#ef4444', 'Critical'],
          ] as const
        ).map(([c, l]) => (
          <div
            key={l}
            className="flex items-center gap-1 text-[9px] text-[#424735]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: c }}
            />
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}
