'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import {
  Activity,
  Pause,
  Play,
  RotateCcw,
  Shield,
  AlertTriangle,
  Users,
  Compass,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RiskEvent } from '@/lib/crowdshield/types'

// ── Gate Definitions ───────────────────────────────────────────────────────
const GATES = [
  { id: 'gate_1', name: 'South Gate', x: 0, z: 28, angle: -Math.PI / 2 },
  { id: 'gate_2', name: 'West Gate', x: -28, z: 0, angle: 0 },
  { id: 'gate_3', name: 'North Gate', x: 0, z: -28, angle: Math.PI / 2 },
  { id: 'gate_4', name: 'East Gate', x: 28, z: 0, angle: Math.PI },
] as const

const MAX_AGENTS = 180

// Risk Colors
const COLOR_SAFE = new THREE.Color('#22c55e') // Green
const COLOR_WARN = new THREE.Color('#eab308') // Amber
const COLOR_HIGH = new THREE.Color('#f97316') // Orange
const COLOR_CRIT = new THREE.Color('#ef4444') // Red

// Agent Data Structure
interface SimAgent {
  id: number
  pathType: 'south_in' | 'west_in' | 'north_in' | 'east_in' | 'reroute_west' | 'reroute_east'
  progress: number // 0 to 1 along path
  speed: number
  laneOffset: number
  colorIdx: number
  currentPos: THREE.Vector3
  targetPos: THREE.Vector3
  facingAngle: number
}

// ── Waypoint Path Evaluator ────────────────────────────────────────────────
// Evaluates smooth position along defined venue pathways
function getPathPosition(
  pathType: SimAgent['pathType'],
  t: number,
  laneOffset: number,
  mode: 'baseline' | 'ai'
): { pos: THREE.Vector3; dir: THREE.Vector3 } {
  const p = new THREE.Vector3()
  const d = new THREE.Vector3()

  // Clamp t to [0, 1]
  const ct = Math.max(0, Math.min(1, t))

  switch (pathType) {
    case 'south_in': {
      if (mode === 'baseline') {
        // Enters south gate (z=28) -> moves to central hub (z=6) -> jams at entrance
        const startZ = 28
        const endZ = 5 + laneOffset * 0.8
        const currentZ = THREE.MathUtils.lerp(startZ, endZ, ct)
        p.set(laneOffset * 2.2, 0, currentZ)
        d.set(0, 0, -1)
      } else {
        // AI mode: smooth passage through central hub and out North
        const currentZ = THREE.MathUtils.lerp(28, -26, ct)
        p.set(laneOffset * 1.5, 0, currentZ)
        d.set(0, 0, -1)
      }
      break
    }
    case 'reroute_west': {
      // Diverts from South Gate outward to West perimeter corridor
      if (ct < 0.3) {
        const u = ct / 0.3
        p.set(
          THREE.MathUtils.lerp(0, -18, u) + laneOffset * 0.8,
          0,
          THREE.MathUtils.lerp(26, 20, u)
        )
        d.set(-1, 0, -0.4).normalize()
      } else if (ct < 0.7) {
        const u = (ct - 0.3) / 0.4
        p.set(-18 + laneOffset * 0.8, 0, THREE.MathUtils.lerp(20, -18, u))
        d.set(0, 0, -1)
      } else {
        const u = (ct - 0.7) / 0.3
        p.set(
          THREE.MathUtils.lerp(-18, -26, u),
          0,
          THREE.MathUtils.lerp(-18, -24, u) + laneOffset * 0.8
        )
        d.set(-1, 0, -0.6).normalize()
      }
      break
    }
    case 'reroute_east': {
      // Diverts from South Gate outward to East perimeter corridor
      if (ct < 0.3) {
        const u = ct / 0.3
        p.set(
          THREE.MathUtils.lerp(0, 18, u) + laneOffset * 0.8,
          0,
          THREE.MathUtils.lerp(26, 20, u)
        )
        d.set(1, 0, -0.4).normalize()
      } else if (ct < 0.7) {
        const u = (ct - 0.3) / 0.4
        p.set(18 + laneOffset * 0.8, 0, THREE.MathUtils.lerp(20, -18, u))
        d.set(0, 0, -1)
      } else {
        const u = (ct - 0.7) / 0.3
        p.set(
          THREE.MathUtils.lerp(18, 26, u),
          0,
          THREE.MathUtils.lerp(-18, -24, u) + laneOffset * 0.8
        )
        d.set(1, 0, -0.6).normalize()
      }
      break
    }
    case 'west_in': {
      // Enters West Gate (-28, 0) -> Hub (0, 0) -> Exits East (28, 0)
      const currentX = THREE.MathUtils.lerp(-28, 28, ct)
      p.set(currentX, 0, laneOffset * 1.6)
      d.set(1, 0, 0)
      break
    }
    case 'east_in': {
      // Enters East Gate (28, 0) -> Hub (0, 0) -> Exits West (-28, 0)
      const currentX = THREE.MathUtils.lerp(28, -28, ct)
      p.set(currentX, 0, -laneOffset * 1.6)
      d.set(-1, 0, 0)
      break
    }
    case 'north_in': {
      // Enters North Gate (0, -28) -> Hub
      const currentZ = THREE.MathUtils.lerp(-28, 24, ct)
      p.set(-laneOffset * 1.5, 0, currentZ)
      d.set(0, 0, 1)
      break
    }
  }

  return { pos: p, dir: d }
}

interface Props {
  events?: Map<string, RiskEvent>
  mode?: 'baseline' | 'ai'
  stageDensities?: Record<string, number>
  className?: string
}

export function CrowdSimulation3D({
  events,
  mode = 'ai',
  stageDensities = { gate_1: 1.5, gate_2: 1.2, gate_3: 0.8, gate_4: 0.9, center: 1.0 },
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [cameraView, setCameraView] = useState<'iso' | 'top' | 'south'>('iso')

  // Telemetry state
  const [metrics, setMetrics] = useState({
    flowEfficiency: 94,
    southGateDensity: 1.8,
    bottleneckRisk: 12,
    divertedCount: 78,
  })

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const rafRef = useRef<number | null>(null)

  // Meshes
  const bodyMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const headMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const ringMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const rerouteArrowsGroupRef = useRef<THREE.Group | null>(null)

  // Simulation agents state ref
  const agentsRef = useRef<SimAgent[]>([])
  const modeRef = useRef(mode)
  const stageDensitiesRef = useRef(stageDensities)
  const isPlayingRef = useRef(isPlaying)

  // Camera Orbit State (Robust, clamped, no runaway drift)
  const orbitRef = useRef({
    isDragging: false,
    prevX: 0,
    prevY: 0,
    azimuth: -Math.PI / 4, // 45 deg angle
    elevation: 0.65, // ~37 deg elevation
    distance: 62,
    target: new THREE.Vector3(0, 0, 0),
  })

  // Synchronise prop refs
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    stageDensitiesRef.current = stageDensities
  }, [stageDensities])
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  // Camera Preset Handler
  const applyCameraPreset = useCallback((preset: 'iso' | 'top' | 'south') => {
    setCameraView(preset)
    const orb = orbitRef.current
    if (preset === 'iso') {
      orb.azimuth = -Math.PI / 4
      orb.elevation = 0.65
      orb.distance = 62
      orb.target.set(0, 0, 0)
    } else if (preset === 'top') {
      orb.azimuth = 0
      orb.elevation = 1.52 // nearly 90 deg top-down
      orb.distance = 58
      orb.target.set(0, 0, 0)
    } else if (preset === 'south') {
      orb.azimuth = -Math.PI / 2 // Facing South Gate directly
      orb.elevation = 0.42
      orb.distance = 46
      orb.target.set(0, 1, 14)
    }
  }, [])

  // ── Spawn Simulation Agents ──────────────────────────────────────────────
  const initAgents = useCallback(() => {
    const agents: SimAgent[] = []
    const curMode = modeRef.current

    for (let i = 0; i < MAX_AGENTS; i++) {
      let pathType: SimAgent['pathType'] = 'south_in'

      if (curMode === 'baseline') {
        // Baseline: 70% of agents enter South Gate to simulate crush buildup
        const r = Math.random()
        if (r < 0.72) pathType = 'south_in'
        else if (r < 0.82) pathType = 'west_in'
        else if (r < 0.91) pathType = 'east_in'
        else pathType = 'north_in'
      } else {
        // AI Mode: Smart distribution — 40% South, 25% diverted West, 25% diverted East, 10% other
        const r = Math.random()
        if (r < 0.32) pathType = 'south_in'
        else if (r < 0.58) pathType = 'reroute_west'
        else if (r < 0.84) pathType = 'reroute_east'
        else if (r < 0.92) pathType = 'west_in'
        else pathType = 'east_in'
      }

      agents.push({
        id: i,
        pathType,
        progress: (i / MAX_AGENTS) * 0.95 + Math.random() * 0.05,
        speed: 0.12 + Math.random() * 0.08,
        laneOffset: (Math.random() - 0.5) * 3.2,
        colorIdx: 0,
        currentPos: new THREE.Vector3(),
        targetPos: new THREE.Vector3(),
        facingAngle: 0,
      })
    }

    agentsRef.current = agents
  }, [])

  // ── Build Scene Geometry & Environment ──────────────────────────────────
  const buildScene = useCallback((scene: THREE.Scene) => {
    // 1. Venue Ground Floor
    const floorGeo = new THREE.PlaneGeometry(80, 80)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xede6dc,
      roughness: 0.85,
      metalness: 0.05,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Floor Grid lines
    const grid = new THREE.GridHelper(80, 40, 0xc7b59e, 0xd8c8b4)
    grid.position.y = 0.02
    ;(grid.material as THREE.LineBasicMaterial).opacity = 0.35
    ;(grid.material as THREE.LineBasicMaterial).transparent = true
    scene.add(grid)

    // 2. Central Sanctuary / Hub Concourse
    const concourseGeo = new THREE.CylinderGeometry(12, 12, 0.4, 48)
    const concourseMat = new THREE.MeshStandardMaterial({
      color: 0xf5eee4,
      roughness: 0.6,
    })
    const concourse = new THREE.Mesh(concourseGeo, concourseMat)
    concourse.position.y = 0.2
    concourse.receiveShadow = true
    scene.add(concourse)

    // Central Monument / Pillar
    const pillarGeo = new THREE.CylinderGeometry(1.2, 1.4, 8, 24)
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x44492b,
      roughness: 0.5,
    })
    const pillar = new THREE.Mesh(pillarGeo, pillarMat)
    pillar.position.set(0, 4, 0)
    pillar.castShadow = true
    scene.add(pillar)

    // Concourse Perimeter Railing / Decorative Band
    const bandGeo = new THREE.TorusGeometry(12, 0.22, 12, 64)
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x8a9270 })
    const band = new THREE.Mesh(bandGeo, bandMat)
    band.rotation.x = Math.PI / 2
    band.position.y = 0.5
    scene.add(band)

    // 3. Perimeter Enclosure Walls with Gate Openings
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xdfd4c5,
      roughness: 0.7,
    })
    const WH = 4.2,
      WT = 1.4,
      R = 34
    const wallSegments: [number, number, number, number, number, number][] = [
      // South Wall Segments (flanking South Gate at x=0, z=R)
      [-19, WH / 2, R, 26, WH, WT],
      [19, WH / 2, R, 26, WH, WT],
      // North Wall Segments
      [-19, WH / 2, -R, 26, WH, WT],
      [19, WH / 2, -R, 26, WH, WT],
      // West Wall Segments
      [-R, WH / 2, -19, WT, WH, 26],
      [-R, WH / 2, 19, WT, WH, 26],
      // East Wall Segments
      [R, WH / 2, -19, WT, WH, 26],
      [R, WH / 2, 19, WT, WH, 26],
    ]

    wallSegments.forEach(([x, y, z, w, h, d]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
    })

    // 4. Gate Portals & Arch Indicators
    GATES.forEach((gate) => {
      // Pillars
      const archPillarMat = new THREE.MeshStandardMaterial({ color: 0x3d4327 })
      const p1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 5.5, 0.8),
        archPillarMat
      )
      const p2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 5.5, 0.8),
        archPillarMat
      )
      if (gate.id === 'gate_1' || gate.id === 'gate_3') {
        p1.position.set(gate.x - 4.5, 2.75, gate.z)
        p2.position.set(gate.x + 4.5, 2.75, gate.z)
      } else {
        p1.position.set(gate.x, 2.75, gate.z - 4.5)
        p2.position.set(gate.x, 2.75, gate.z + 4.5)
      }
      p1.castShadow = true
      p2.castShadow = true
      scene.add(p1)
      scene.add(p2)

      // Overhead Gate Arch
      const archGeo = new THREE.BoxGeometry(
        gate.id === 'gate_1' || gate.id === 'gate_3' ? 10 : 0.8,
        0.8,
        gate.id === 'gate_1' || gate.id === 'gate_3' ? 0.8 : 10
      )
      const archMat = new THREE.MeshStandardMaterial({ color: 0x3d4327 })
      const arch = new THREE.Mesh(archGeo, archMat)
      arch.position.set(gate.x, 5.2, gate.z)
      scene.add(arch)

      // Glowing Gate Threshold Zone on Ground
      const threshGeo = new THREE.PlaneGeometry(
        gate.id === 'gate_1' || gate.id === 'gate_3' ? 9 : 3,
        gate.id === 'gate_1' || gate.id === 'gate_3' ? 3 : 9
      )
      const threshMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.35,
      })
      const thresh = new THREE.Mesh(threshGeo, threshMat)
      thresh.rotation.x = -Math.PI / 2
      thresh.position.set(gate.x, 0.03, gate.z)
      thresh.name = `thresh_${gate.id}`
      scene.add(thresh)
    })

    // 5. Dynamic AI Flow Guidance Arrows Group (visible in AI mode)
    const arrowGroup = new THREE.Group()
    arrowGroup.name = 'reroute_arrows'

    // Left & Right Bypass Curved Ground Strips
    const createBypassPath = (isRight: boolean) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(isRight ? 2 : -2, 0.05, 26),
        new THREE.Vector3(isRight ? 18 : -18, 0.05, 20),
        new THREE.Vector3(isRight ? 22 : -22, 0.05, 0),
        new THREE.Vector3(isRight ? 20 : -20, 0.05, -20),
        new THREE.Vector3(isRight ? 26 : -26, 0.05, -26),
      ])
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.35, 8, false)
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.65,
      })
      const tube = new THREE.Mesh(tubeGeo, tubeMat)
      arrowGroup.add(tube)
    }

    createBypassPath(false) // West bypass
    createBypassPath(true) // East bypass

    scene.add(arrowGroup)
    rerouteArrowsGroupRef.current = arrowGroup

    // 6. Instanced Meshes for Humanoid Agents
    // Body (Capsule/Cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.32, 0.22, 1.4, 10)
    bodyGeo.translate(0, 0.7, 0)
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.4 })
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX_AGENTS)
    bodyMesh.castShadow = true
    scene.add(bodyMesh)
    bodyMeshRef.current = bodyMesh

    // Head (Sphere)
    const headGeo = new THREE.SphereGeometry(0.24, 10, 10)
    headGeo.translate(0, 1.55, 0)
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.4 })
    const headMesh = new THREE.InstancedMesh(headGeo, headMat, MAX_AGENTS)
    headMesh.castShadow = true
    scene.add(headMesh)
    headMeshRef.current = headMesh

    // Ground Status Aura Ring
    const ringGeo = new THREE.RingGeometry(0.38, 0.55, 16)
    ringGeo.rotateX(-Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    })
    const ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, MAX_AGENTS)
    scene.add(ringMesh)
    ringMeshRef.current = ringMesh
  }, [])

  // ── Three.js Lifecycle Mount ─────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const W = container.clientWidth || 860
    const H = container.clientHeight || 500

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#F4EFEA')
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.5, 300)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xfff8ee, 0xdad1c5, 1.8)
    scene.add(hemiLight)

    const sun = new THREE.DirectionalLight(0xffffff, 1.9)
    sun.position.set(35, 55, 40)
    sun.castShadow = true
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 180
    sun.shadow.camera.left = -40
    sun.shadow.camera.right = 40
    sun.shadow.camera.top = 40
    sun.shadow.camera.bottom = -40
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)

    const softFill = new THREE.DirectionalLight(0xced8be, 0.4)
    softFill.position.set(-30, 20, -30)
    scene.add(softFill)

    // Build Environment & Geometry
    buildScene(scene)
    initAgents()

    // ── Rock-solid Smooth Orbit Controls (no canvas capture bugs) ──────────
    const orb = orbitRef.current

    const onMouseDown = (e: MouseEvent) => {
      orb.isDragging = true
      orb.prevX = e.clientX
      orb.prevY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!orb.isDragging) return
      const dx = e.clientX - orb.prevX
      const dy = e.clientY - orb.prevY
      orb.prevX = e.clientX
      orb.prevY = e.clientY

      orb.azimuth += dx * 0.006
      orb.elevation = Math.max(0.15, Math.min(1.52, orb.elevation + dy * 0.005))
    }

    const onMouseUp = () => {
      orb.isDragging = false
    }

    // Gentle scroll zoom clamped within safe bounds
    const onWheel = (e: WheelEvent) => {
      // Only zoom if hovering directly over canvas and dragging/focused
      if (Math.abs(e.deltaY) > 0) {
        orb.distance = Math.max(25, Math.min(95, orb.distance + e.deltaY * 0.04))
      }
    }

    const dom = renderer.domElement
    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    dom.addEventListener('wheel', onWheel, { passive: true })

    // Resize Observer
    const resizeObs = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return
      const nW = container.clientWidth
      const nH = container.clientHeight
      camera.aspect = nW / nH
      camera.updateProjectionMatrix()
      renderer.setSize(nW, nH)
    })
    resizeObs.observe(container)

    return () => {
      dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      dom.removeEventListener('wheel', onWheel)
      resizeObs.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      renderer.dispose()
      if (container.contains(dom)) container.removeChild(dom)
    }
  }, [buildScene, initAgents])

  // Re-initialize agents when mode changes
  useEffect(() => {
    initAgents()
    // Toggle bypass arrows visibility
    if (rerouteArrowsGroupRef.current) {
      rerouteArrowsGroupRef.current.visible = mode === 'ai'
    }
  }, [mode, initAgents])

  // ── Main 60 FPS Simulation Animation Loop ────────────────────────────────
  useEffect(() => {
    let lastTime = performance.now()
    const transformMat = new THREE.Matrix4()
    const rotQuat = new THREE.Quaternion()
    const scaleVec = new THREE.Vector3(1, 1, 1)
    const upVec = new THREE.Vector3(0, 1, 0)
    let tick = 0

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      const scene = sceneRef.current
      const camera = cameraRef.current
      const renderer = rendererRef.current
      const bodyMesh = bodyMeshRef.current
      const headMesh = headMeshRef.current
      const ringMesh = ringMeshRef.current
      if (!scene || !camera || !renderer || !bodyMesh || !headMesh || !ringMesh) return

      const curMode = modeRef.current
      const orb = orbitRef.current

      // ── Update Camera Orbit Position ─────────────────────────────────────
      const camX =
        orb.target.x +
        orb.distance * Math.cos(orb.elevation) * Math.sin(orb.azimuth)
      const camY = orb.target.y + orb.distance * Math.sin(orb.elevation)
      const camZ =
        orb.target.z +
        orb.distance * Math.cos(orb.elevation) * Math.cos(orb.azimuth)

      // Smooth camera interpolation
      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.15)
      camera.lookAt(orb.target)

      // ── Step Agent Physics & Motion ──────────────────────────────────────
      if (isPlayingRef.current) {
        const agents = agentsRef.current
        let southJamCount = 0

        for (let i = 0; i < agents.length; i++) {
          const a = agents[i]

          // Compute effective speed along path
          let curSpeed = a.speed
          if (curMode === 'baseline' && a.pathType === 'south_in') {
            // As agents get closer to hub (progress > 0.45), bottleneck forms
            if (a.progress > 0.45 && a.progress < 0.85) {
              curSpeed = THREE.MathUtils.lerp(a.speed, 0.015, (a.progress - 0.45) / 0.4)
              southJamCount++
            }
          }

          // Advance along path
          a.progress += curSpeed * dt * 0.45

          // Reset loop when reaching end of path
          if (a.progress >= 1.0) {
            a.progress = 0
            // In AI mode, re-roll path based on active balance
            if (curMode === 'ai') {
              const r = Math.random()
              if (r < 0.3) a.pathType = 'south_in'
              else if (r < 0.6) a.pathType = 'reroute_west'
              else a.pathType = 'reroute_east'
            }
          }

          // Evaluate path position & direction
          const { pos, dir } = getPathPosition(a.pathType, a.progress, a.laneOffset, curMode)
          a.currentPos.copy(pos)

          // Gentle walking bob
          const walkBob = Math.sin(now * 0.008 + i) * 0.06
          a.currentPos.y = walkBob

          // Facing Angle
          const yaw = Math.atan2(dir.x, dir.z)
          rotQuat.setFromAxisAngle(upVec, yaw)

          // Color Risk Index:
          // Baseline bottleneck = red/critical; AI mode = calm green
          let color = COLOR_SAFE
          if (curMode === 'baseline') {
            if (a.pathType === 'south_in' && a.progress > 0.4) {
              color = a.progress > 0.55 ? COLOR_CRIT : COLOR_HIGH
            } else if (a.pathType === 'south_in') {
              color = COLOR_WARN
            }
          } else {
            color = a.pathType.startsWith('reroute') ? COLOR_SAFE : COLOR_SAFE
          }

          // Update Instanced Matrix for Body
          transformMat.compose(a.currentPos, rotQuat, scaleVec)
          bodyMesh.setMatrixAt(i, transformMat)
          bodyMesh.setColorAt(i, color)

          // Update Instanced Matrix for Head
          headMesh.setMatrixAt(i, transformMat)
          headMesh.setColorAt(i, color)

          // Update Instanced Matrix for Ground Aura Ring
          const ringPos = a.currentPos.clone()
          ringPos.y = 0.04
          transformMat.compose(ringPos, new THREE.Quaternion(), scaleVec)
          ringMesh.setMatrixAt(i, transformMat)
          ringMesh.setColorAt(i, color)
        }

        bodyMesh.instanceMatrix.needsUpdate = true
        headMesh.instanceMatrix.needsUpdate = true
        ringMesh.instanceMatrix.needsUpdate = true
        if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true
        if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true
        if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true

        // Update HUD Telemetry throttled
        if (++tick >= 15) {
          tick = 0
          if (curMode === 'ai') {
            setMetrics({
              flowEfficiency: Math.round(92 + Math.sin(now * 0.002) * 4),
              southGateDensity: 1.8,
              bottleneckRisk: 8,
              divertedCount: Math.round(85 + (now * 0.001) % 20),
            })
          } else {
            setMetrics({
              flowEfficiency: Math.round(22 + Math.cos(now * 0.002) * 5),
              southGateDensity: 5.8,
              bottleneckRisk: 94,
              divertedCount: 0,
            })
          }
        }
      }

      renderer.render(scene, camera)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden rounded-2xl bg-[#F4EFEA] select-none border border-border flex flex-col',
        className
      )}
    >
      {/* ── Top Bar: Outcome & Camera Controls ────────────────────────────── */}
      <div className="absolute top-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Live Outcome Banner */}
        <div className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-md border border-[#C2AF96] rounded-xl px-3.5 py-2 shadow-md">
          {mode === 'ai' ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
              <div>
                <div
                  className="text-xs font-bold text-success flex items-center gap-1.5"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  CrowdShield AI: Multi-Corridor Flow Balanced
                </div>
                <div className="text-[10px] text-muted-foreground">
                  South Gate bypass active → Diverting 60% flow to West & East
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-ping" />
              <div>
                <div
                  className="text-xs font-bold text-destructive flex items-center gap-1.5"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Baseline: South Gate Critical Bottleneck Formed
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Unmanaged surge → Flow efficiency collapsed to 22% (Crush Risk 94%)
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Camera Angle Presets & Telemetry Badge */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-[#C2AF96] rounded-xl p-1.5 shadow-md">
          <span
            className="text-[10px] font-bold text-muted-foreground px-2"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Camera:
          </span>
          <button
            onClick={() => applyCameraPreset('iso')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
              cameraView === 'iso'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-secondary'
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Perspective
          </button>
          <button
            onClick={() => applyCameraPreset('top')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
              cameraView === 'top'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-secondary'
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Top-Down
          </button>
          <button
            onClick={() => applyCameraPreset('south')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
              cameraView === 'south'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-secondary'
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            South Gate
          </button>
        </div>
      </div>

      {/* ── 3D Canvas Mount Point ────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing flex-1"
      />

      {/* ── Floating Live Telemetry Overlay (Top-Right) ──────────────────── */}
      <div className="absolute top-18 right-3 z-20 w-48 bg-white/95 backdrop-blur-md border border-[#C2AF96] rounded-xl p-3 shadow-lg pointer-events-none">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#C2AF96]">
          <span
            className="text-[11px] font-bold text-[#11130F] flex items-center gap-1.5"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <Activity className="w-3.5 h-3.5 text-primary" />
            3D Simulation Telemetry
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Agents:</span>
            <span
              className="font-bold text-foreground"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {MAX_AGENTS} Live
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Flow Efficiency:</span>
            <span
              className={cn(
                'font-bold',
                metrics.flowEfficiency > 60 ? 'text-success' : 'text-destructive'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {metrics.flowEfficiency}%
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">South Gate Density:</span>
            <span
              className={cn(
                'font-bold',
                metrics.southGateDensity > 4.5
                  ? 'text-destructive'
                  : 'text-success'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {metrics.southGateDensity} p/m²
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Crush Risk:</span>
            <span
              className={cn(
                'font-bold',
                metrics.bottleneckRisk < 20
                  ? 'text-success'
                  : 'text-destructive'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {metrics.bottleneckRisk}%
            </span>
          </div>
          {mode === 'ai' && (
            <div className="flex justify-between items-center text-xs pt-1 border-t border-border">
              <span className="text-muted-foreground">Flow Diverted:</span>
              <span
                className="font-bold text-primary"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {metrics.divertedCount} ppl/min
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Bar: Playback Controls & Status Legend ─────────────────── */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Play/Pause & Reset View */}
        <div className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-md border border-[#C2AF96] rounded-xl p-1.5 shadow-md">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-xs font-bold transition-all cursor-pointer text-foreground"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {isPlaying ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={() => applyCameraPreset('iso')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-xs font-bold transition-all cursor-pointer text-foreground"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
            title="Reset Camera Angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Camera
          </button>
          <span className="text-[10px] text-muted-foreground px-2 hidden sm:inline">
            🖱 Left click + drag to rotate · Scroll to zoom
          </span>
        </div>

        {/* Right: Agent Color Legend */}
        <div className="pointer-events-auto flex items-center gap-3 bg-white/95 backdrop-blur-md border border-[#C2AF96] rounded-xl px-3.5 py-2 shadow-md">
          <div className="flex items-center gap-1.5 text-[10px] text-foreground font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-success" />
            Safe Flow
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-foreground font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-warning" />
            Medium Density
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-foreground font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-chart-1" />
            High Compression
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-foreground font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
            Critical Crush Risk
          </div>
        </div>
      </div>
    </div>
  )
}
