'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  Play,
  Pause,
  RotateCcw,
  Shield,
  Zap,
  Sliders,
  Eye,
  Activity,
  Layers,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Users,
  Compass,
  Maximize2
} from 'lucide-react'
import type { RiskEvent } from '@/lib/crowdshield/types'
import { getRiskColor, RISK_COLORS } from '@/lib/crowdshield/theme'
import { cn } from '@/lib/utils'

export type SimulationMode = 'unmanaged' | 'crowdshield'
export type CameraPreset = 'isometric' | 'topDown' | 'gate1' | 'concourse'

interface Agent {
  id: number
  mesh: THREE.Group
  legs: [THREE.Mesh, THREE.Mesh]
  aura: THREE.Mesh
  position: THREE.Vector3
  velocity: THREE.Vector3
  target: THREE.Vector3
  speed: number
  state: 'normal' | 'dense' | 'danger' | 'evacuated'
  targetGate: string
  panicLevel: number
  walkCycle: number
}

interface GateConfig {
  id: string
  name: string
  position: THREE.Vector3
  isOpen: boolean
  isRerouted: boolean
  color: number
}

export interface CrowdSimulation3DProps {
  className?: string
  events?: Map<string, RiskEvent>
}

export function CrowdSimulation3D({ className, events }: CrowdSimulation3DProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const eventsRef = useRef<Map<string, RiskEvent> | undefined>(events)

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  // Simulation State
  const [mode, setMode] = useState<SimulationMode>('crowdshield')
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [simSpeed, setSimSpeed] = useState<number>(1)
  const [agentTargetCount, setAgentTargetCount] = useState<number>(120)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric')
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)

  // Live Simulation Telemetry
  const [telemetry, setTelemetry] = useState({
    activeAgents: 120,
    evacuatedAgents: 45,
    avgVelocity: 1.25,
    maxDensity: 1.9,
    stampedeRisk: 14,
    bottleneckZone: 'None (Fluid Dispersal)',
    flowEfficiency: 96,
  })

  // Gates State
  const [gates, setGates] = useState<Record<string, GateConfig>>({
    gate_1: { id: 'gate_1', name: 'South Gate (Main)', position: new THREE.Vector3(0, 0, 32), isOpen: true, isRerouted: false, color: 0x22c55e },
    gate_2: { id: 'gate_2', name: 'West Gate', position: new THREE.Vector3(-32, 0, 0), isOpen: true, isRerouted: false, color: 0x22c55e },
    gate_3: { id: 'gate_3', name: 'North Gate', position: new THREE.Vector3(0, 0, -32), isOpen: true, isRerouted: false, color: 0x22c55e },
    gate_4: { id: 'gate_4', name: 'East Gate', position: new THREE.Vector3(32, 0, 0), isOpen: true, isRerouted: false, color: 0x22c55e },
  })

  // Barricades active in CrowdShield mode
  const [barricadesActive, setBarricadesActive] = useState<boolean>(true)

  // References for Three.js objects
  const agentsRef = useRef<Agent[]>([])
  const gateMeshesRef = useRef<Map<string, THREE.Group>>(new Map())
  const barricadeMeshesRef = useRef<THREE.Group[]>([])

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return

    const width = containerRef.current.clientWidth || 800
    const height = containerRef.current.clientHeight || 560

    // 1. Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf6f1eb)
    scene.fog = new THREE.FogExp2(0xf6f1eb, 0.01)
    sceneRef.current = scene

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 500)
    camera.position.set(0, 48, 55)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    containerRef.current.replaceChildren(renderer.domElement)

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x1a2e4c, 1.8)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6)
    dirLight.position.set(35, 50, 40)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    scene.add(dirLight)

    // Central Concourse Point Light
    const centerPointLight = new THREE.PointLight(0x00f0ff, 2.5, 45)
    centerPointLight.position.set(0, 6, 0)
    scene.add(centerPointLight)

    // 5. Environment & Venue Architecture
    buildVenueEnvironment(scene)

    // 6. Build Gate Arches & Barricades
    buildGatesAndBarricades(scene)

    // 7. Orbit & Pan Controls
    let isDragging = false
    let prevMouseX = 0
    let prevMouseY = 0

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !cameraRef.current) return
      const deltaX = e.clientX - prevMouseX
      const deltaY = e.clientY - prevMouseY

      const rotSpeed = 0.004
      const currentPos = cameraRef.current.position
      const radius = Math.sqrt(currentPos.x * currentPos.x + currentPos.z * currentPos.z)
      const theta = Math.atan2(currentPos.x, currentPos.z) + deltaX * rotSpeed

      currentPos.x = radius * Math.sin(theta)
      currentPos.z = radius * Math.cos(theta)
      currentPos.y = Math.max(12, Math.min(80, currentPos.y - deltaY * 0.1))

      cameraRef.current.lookAt(0, 0, 0)

      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!cameraRef.current) return
      const zoomFactor = 1 + e.deltaY * 0.001
      cameraRef.current.position.multiplyScalar(zoomFactor)
      cameraRef.current.position.clampLength(15, 110)
    }

    const dom = renderer.domElement
    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    dom.addEventListener('wheel', onWheel, { passive: false })

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(w, h)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(containerRef.current)

    // Spawn Initial Agents
    spawnAgents(scene, agentTargetCount, mode)

    // Clean up
    return () => {
      dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      dom.removeEventListener('wheel', onWheel)
      resizeObserver.disconnect()
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      renderer.dispose()
    }
  }, [])

  // Build Venue 3D Architecture
  const buildVenueEnvironment = (scene: THREE.Scene) => {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(80, 80, 40, 40)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xeae0d4,
      roughness: 0.8,
      metalness: 0.1,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Warm Architectural Grid Overlay
    const grid = new THREE.GridHelper(80, 40, 0x44492b, 0xc2af96)
    grid.position.y = 0.05
    scene.add(grid)

    // Central Concourse Ring
    const concourseGeo = new THREE.CylinderGeometry(14, 14, 0.4, 48)
    const concourseMat = new THREE.MeshStandardMaterial({
      color: 0xefe7dd,
      emissive: 0x44492b,
      emissiveIntensity: 0.2,
      roughness: 0.3,
    })
    const concourse = new THREE.Mesh(concourseGeo, concourseMat)
    concourse.position.set(0, 0.2, 0)
    concourse.receiveShadow = true
    scene.add(concourse)

    // Central Pillar
    const pillarGeo = new THREE.CylinderGeometry(1.8, 1.8, 8, 24)
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x44492b,
      emissive: 0x44492b,
      emissiveIntensity: 0.4,
      wireframe: true,
    })
    const pillar = new THREE.Mesh(pillarGeo, pillarMat)
    pillar.position.set(0, 4, 0)
    scene.add(pillar)

    // Perimeter Venue Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8c9b7, roughness: 0.7 })
    const wallGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff })

    const wallThickness = 1.2
    const wallHeight = 3.5
    const venueRadius = 36

    const wallSegments = [
      { x: 0, z: -venueRadius, w: 52, h: wallHeight, d: wallThickness },
      { x: 0, z: venueRadius, w: 52, h: wallHeight, d: wallThickness },
      { x: -venueRadius, z: 0, w: wallThickness, h: wallHeight, d: 52 },
      { x: venueRadius, z: 0, w: wallThickness, h: wallHeight, d: 52 },
    ]

    wallSegments.forEach((seg) => {
      const wallGeo = new THREE.BoxGeometry(seg.w, seg.h, seg.d)
      const wallMesh = new THREE.Mesh(wallGeo, wallMat)
      wallMesh.position.set(seg.x, seg.h / 2, seg.z)
      wallMesh.castShadow = true
      wallMesh.receiveShadow = true
      scene.add(wallMesh)

      const trimGeo = new THREE.BoxGeometry(seg.w, 0.12, seg.d + 0.1)
      const trimMesh = new THREE.Mesh(trimGeo, wallGlowMat)
      trimMesh.position.set(seg.x, seg.h + 0.06, seg.z)
      scene.add(trimMesh)
    })

    // 4 Corner Evacuation Exits (Green Glowing Zones)
    const exitLocations = [
      { x: -28, z: -28 },
      { x: 28, z: -28 },
      { x: -28, z: 28 },
      { x: 28, z: 28 },
    ]

    exitLocations.forEach((exit) => {
      const exitBase = new THREE.Mesh(
        new THREE.CylinderGeometry(3.8, 3.8, 0.2, 24),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true })
      )
      exitBase.position.set(exit.x, 0.1, exit.z)
      scene.add(exitBase)

      const exitBeacon = new THREE.PointLight(0x22c55e, 1.5, 18)
      exitBeacon.position.set(exit.x, 2.5, exit.z)
      scene.add(exitBeacon)
    })
  }

  // Build Gate Arches & Barricade Objects
  const buildGatesAndBarricades = (scene: THREE.Scene) => {
    Object.values(gates).forEach((gate) => {
      const gateGroup = new THREE.Group()
      const archPillarMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f })

      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), archPillarMat)
      const pillarR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), archPillarMat)

      const isZAxis = gate.position.z !== 0
      if (isZAxis) {
        pillarL.position.set(-4, 3, 0)
        pillarR.position.set(4, 3, 0)
      } else {
        pillarL.position.set(0, 3, -4)
        pillarR.position.set(0, 3, 4)
      }

      const beamGeo = isZAxis
        ? new THREE.BoxGeometry(9.2, 1.2, 1.2)
        : new THREE.BoxGeometry(1.2, 1.2, 9.2)
      const beam = new THREE.Mesh(beamGeo, archPillarMat)
      beam.position.set(0, 6, 0)

      const barrierGeo = new THREE.PlaneGeometry(8, 5)
      const barrierMat = new THREE.MeshBasicMaterial({
        color: gate.isOpen ? 0x22c55e : 0xef4444,
        transparent: true,
        opacity: gate.isOpen ? 0.2 : 0.8,
        side: THREE.DoubleSide,
      })
      const laserBarrier = new THREE.Mesh(barrierGeo, barrierMat)
      if (!isZAxis) laserBarrier.rotation.y = Math.PI / 2
      laserBarrier.position.set(0, 2.5, 0)
      laserBarrier.name = 'laserBarrier'

      gateGroup.add(pillarL)
      gateGroup.add(pillarR)
      gateGroup.add(beam)
      gateGroup.add(laserBarrier)
      gateGroup.position.copy(gate.position)

      scene.add(gateGroup)
      gateMeshesRef.current.set(gate.id, gateGroup)
    })

    // CrowdShield Dynamic Diverter Barricades
    const barricadeConfigs = [
      { x: -7, z: 18, rot: Math.PI / 6 },
      { x: 7, z: 18, rot: -Math.PI / 6 },
      { x: 0, z: 8, rot: 0 },
    ]

    barricadeConfigs.forEach((cfg) => {
      const bGroup = new THREE.Group()
      const bGeo = new THREE.BoxGeometry(6, 1.6, 0.4)
      const bMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.3,
      })
      const bMesh = new THREE.Mesh(bGeo, bMat)
      bMesh.position.y = 0.8
      bGroup.add(bMesh)
      bGroup.position.set(cfg.x, 0, cfg.z)
      bGroup.rotation.y = cfg.rot
      bGroup.visible = barricadesActive

      scene.add(bGroup)
      barricadeMeshesRef.current.push(bGroup)
    })
  }

  // Create 3D Humanoid Model
  const createHumanoidMesh = (colorHex: number): { group: THREE.Group; legs: [THREE.Mesh, THREE.Mesh]; aura: THREE.Mesh } => {
    const group = new THREE.Group()

    // 1. Head
    const headGeo = new THREE.SphereGeometry(0.35, 12, 12)
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd1b3, roughness: 0.5 })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.9
    group.add(head)

    // Visor / Face Direction
    const visorGeo = new THREE.BoxGeometry(0.3, 0.12, 0.15)
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    const visor = new THREE.Mesh(visorGeo, visorMat)
    visor.position.set(0, 1.9, 0.28)
    group.add(visor)

    // 2. Torso
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.85, 12)
    const torsoMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 })
    const torso = new THREE.Mesh(torsoGeo, torsoMat)
    torso.position.y = 1.25
    group.add(torso)

    // 3. Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.8, 8)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 })

    const legL = new THREE.Mesh(legGeo, legMat)
    legL.position.set(-0.16, 0.4, 0)
    group.add(legL)

    const legR = new THREE.Mesh(legGeo, legMat)
    legR.position.set(0.16, 0.4, 0)
    group.add(legR)

    // 4. Aura Status Ring under feet
    const auraGeo = new THREE.RingGeometry(0.45, 0.6, 16)
    const auraMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    })
    const aura = new THREE.Mesh(auraGeo, auraMat)
    aura.rotation.x = -Math.PI / 2
    aura.position.y = 0.04
    group.add(aura)

    return { group, legs: [legL, legR], aura }
  }

  // Spawn Agents Function
  const spawnAgents = (scene: THREE.Scene, count: number, currentMode: SimulationMode) => {
    agentsRef.current.forEach((a) => scene.remove(a.mesh))
    agentsRef.current = []

    const gateKeys = Object.keys(gates)
    const currentEvents = eventsRef.current

    // Compute gate weights from event.density_per_sqm
    const gateWeights: Record<string, number> = {}
    let totalWeight = 0
    gateKeys.forEach((k) => {
      const ev = currentEvents?.get(k)
      const d = ev?.density_per_sqm ?? (currentMode === 'unmanaged' && k === 'gate_1' ? 6.5 : 1.5)
      gateWeights[k] = Math.max(0.2, d)
      totalWeight += gateWeights[k]
    })

    for (let i = 0; i < count; i++) {
      let gateKey = 'gate_1'
      if (totalWeight > 0) {
        let r = Math.random() * totalWeight
        for (const k of gateKeys) {
          r -= gateWeights[k]
          if (r <= 0) {
            gateKey = k
            break
          }
        }
      } else {
        gateKey = gateKeys[i % gateKeys.length]
      }

      const spawnGate = gates[gateKey]
      const spawnOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        0,
        (Math.random() - 0.5) * 8
      )
      const spawnPos = spawnGate.position.clone().add(spawnOffset)

      let targetPos = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        0,
        (Math.random() - 0.5) * 12
      )

      if (currentMode === 'crowdshield' && Math.random() > 0.4) {
        targetPos = new THREE.Vector3(
          Math.random() > 0.5 ? 26 : -26,
          0,
          Math.random() > 0.5 ? 26 : -26
        )
      }

      const ev = currentEvents?.get(gateKey)
      const riskLevel = ev?.risk_level ?? (currentMode === 'unmanaged' && gateKey === 'gate_1' ? 'high' : 'low')
      const hex = RISK_COLORS[riskLevel] ?? RISK_COLORS.low
      const initialColor = parseInt(hex.replace('#', ''), 16)

      const { group, legs, aura } = createHumanoidMesh(initialColor)
      group.position.copy(spawnPos)
      scene.add(group)

      const flowSpeed = ev?.flow_speed_mps ?? (0.85 + Math.random() * 0.5)

      agentsRef.current.push({
        id: i,
        mesh: group,
        legs,
        aura,
        position: spawnPos,
        velocity: new THREE.Vector3(0, 0, 0),
        target: targetPos,
        speed: Math.max(0.35, flowSpeed),
        state: 'normal',
        targetGate: gateKey,
        panicLevel: 0,
        walkCycle: Math.random() * Math.PI * 2,
      })
    }
  }

  // Synchronize density target from events
  useEffect(() => {
    if (!events || events.size === 0) return
    const evArray = Array.from(events.values())
    const avgDensity =
      evArray.reduce((acc, e) => acc + (e.density_per_sqm ?? 1.2), 0) / evArray.length
    // Map 0-8 p/m² -> 40-200 agent count range
    const mappedCount = Math.min(200, Math.max(40, Math.round(40 + (avgDensity / 8) * 160)))
    setAgentTargetCount(mappedCount)
  }, [events])

  // Synchronize Gate open/closed visual states from events (risk_level === 'critical')
  useEffect(() => {
    gateMeshesRef.current.forEach((gateGroup, gateId) => {
      const event = events?.get(gateId)
      const isCritical = event ? event.risk_level === 'critical' : false
      const riskLevel = event?.risk_level ?? 'low'
      const hex = RISK_COLORS[riskLevel] ?? RISK_COLORS.low
      const colorNum = parseInt(hex.replace('#', ''), 16)

      const barrier = gateGroup.getObjectByName('laserBarrier') as THREE.Mesh | undefined
      if (barrier && barrier.material) {
        const mat = barrier.material as THREE.MeshBasicMaterial
        mat.color.setHex(isCritical ? 0xef4444 : colorNum)
        mat.opacity = isCritical ? 0.85 : 0.2
      }
    })
  }, [events])

  // Trigger Re-spawn when Mode, Count, or Events changes
  useEffect(() => {
    if (!sceneRef.current) return
    spawnAgents(sceneRef.current, agentTargetCount, mode)
  }, [mode, agentTargetCount])

  // Update Barricades visibility
  useEffect(() => {
    barricadeMeshesRef.current.forEach((b) => {
      b.visible = mode === 'crowdshield' && barricadesActive
    })
  }, [mode, barricadesActive])

  // Camera Presets Controller
  useEffect(() => {
    if (!cameraRef.current) return
    const cam = cameraRef.current
    if (cameraPreset === 'isometric') {
      cam.position.set(0, 48, 55)
      cam.lookAt(0, 0, 0)
    } else if (cameraPreset === 'topDown') {
      cam.position.set(0, 75, 0.1)
      cam.lookAt(0, 0, 0)
    } else if (cameraPreset === 'gate1') {
      cam.position.set(0, 10, 48)
      cam.lookAt(0, 2, 20)
    } else if (cameraPreset === 'concourse') {
      cam.position.set(16, 12, 16)
      cam.lookAt(0, 2, 0)
    }
  }, [cameraPreset])

  // Main Simulation Physics & Render Loop with smooth continuous interpolation
  useEffect(() => {
    let lastTime = performance.now()

    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate)

      const dt = Math.min((time - lastTime) / 1000, 0.05) * simSpeed
      lastTime = time

      if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return

      if (isPlaying) {
        const agents = agentsRef.current
        const currentEvents = eventsRef.current
        let totalVel = 0
        let highDensityCount = 0
        let evacuatedCount = 0

        for (let i = 0; i < agents.length; i++) {
          const a = agents[i]
          const ev = currentEvents?.get(a.targetGate)
          const isCritical = ev ? ev.risk_level === 'critical' : false
          const flowSpeed = ev?.flow_speed_mps ?? (mode === 'crowdshield' ? 1.2 : 0.8)
          const riskLevel = ev?.risk_level ?? 'low'
          const hex = RISK_COLORS[riskLevel] ?? RISK_COLORS.low
          const colorNum = parseInt(hex.replace('#', ''), 16)

          // 1. Check if Reached Exit / Destination
          const distToTarget = a.position.distanceTo(a.target)
          if (distToTarget < 2.5) {
            if (a.state !== 'evacuated') {
              a.state = 'evacuated'
              const spawnGate = gates[a.targetGate]
              a.position.copy(spawnGate.position).add(
                new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)
              )
              a.state = 'normal'
            }
            evacuatedCount++
          }

          // 2. Compute Desired Direction Vector
          const desiredDir = new THREE.Vector3().subVectors(a.target, a.position)
          desiredDir.y = 0
          desiredDir.normalize()

          // 3. Social Force Repulsion (Continuous Damped Avoidance)
          const repulsion = new THREE.Vector3(0, 0, 0)
          let neighborCount = 0

          for (let j = 0; j < agents.length; j++) {
            if (i === j) continue
            const b = agents[j]
            const dist = a.position.distanceTo(b.position)

            if (dist < 2.2 && dist > 0.001) {
              neighborCount++
              const push = new THREE.Vector3().subVectors(a.position, b.position)
              push.y = 0
              push.normalize().multiplyScalar((2.2 - dist) * 1.4)
              repulsion.add(push)
            }
          }

          // 4. Barricade Guidance in CrowdShield Mode
          if (mode === 'crowdshield' && barricadesActive) {
            if (a.position.z > 5 && a.position.z < 22 && Math.abs(a.position.x) < 7) {
              const divertX = a.position.x >= 0 ? 1.6 : -1.6
              repulsion.add(new THREE.Vector3(divertX, 0, 0))
            }
          }

          // 5. Unmanaged Mode vs CrowdShield Mode Speed & Panic
          if (mode === 'unmanaged') {
            if (a.position.z > 10 && a.position.z < 28 && Math.abs(a.position.x) < 8) {
              if (neighborCount > 4) {
                a.panicLevel = Math.min(1, a.panicLevel + dt * 0.3)
                a.speed = Math.max(0.2, flowSpeed * 0.5 - dt * 0.25)
              }
            } else {
              a.panicLevel = Math.max(0, a.panicLevel - dt * 0.1)
              a.speed = Math.max(0.3, flowSpeed)
            }
          } else {
            a.panicLevel = Math.max(0, a.panicLevel - dt * 0.4)
            a.speed = Math.max(0.35, flowSpeed)
          }

          // 6. Smooth Acceleration & Velocity Lerping
          const targetForce = desiredDir.multiplyScalar(a.speed).add(repulsion)
          a.velocity.lerp(targetForce, 0.08)
          a.position.addScaledVector(a.velocity, dt * 4)

          // Boundaries Clamp
          a.position.x = Math.max(-34, Math.min(34, a.position.x))
          a.position.z = Math.max(-34, Math.min(34, a.position.z))
          a.position.y = 0

          a.mesh.position.copy(a.position)

          if (a.velocity.lengthSq() > 0.01) {
            const angle = Math.atan2(a.velocity.x, a.velocity.z)
            a.mesh.rotation.y = angle

            // Animate Humanoid Walking Legs
            a.walkCycle += a.velocity.length() * dt * 7
            a.legs[0].rotation.x = Math.sin(a.walkCycle) * 0.5
            a.legs[1].rotation.x = -Math.sin(a.walkCycle) * 0.5
          }

          // 7. Update Aura Status Indicator from event risk level and density
          if (neighborCount >= 5 || a.panicLevel > 0.6 || isCritical) {
            a.state = 'danger'
            highDensityCount++
            ;(a.aura.material as THREE.MeshBasicMaterial).color.setHex(0xef4444)
          } else if (neighborCount >= 3 || a.panicLevel > 0.2 || riskLevel === 'high' || riskLevel === 'medium') {
            a.state = 'dense'
            ;(a.aura.material as THREE.MeshBasicMaterial).color.setHex(colorNum)
          } else {
            a.state = 'normal'
            ;(a.aura.material as THREE.MeshBasicMaterial).color.setHex(colorNum)
          }

          totalVel += a.velocity.length()
        }

        const eventList = currentEvents ? Array.from(currentEvents.values()) : []
        const criticalEvent = eventList.find((e) => e.risk_level === 'critical' || e.risk_level === 'high')
        const avgV = eventList.length > 0
          ? eventList.reduce((acc, e) => acc + (e.flow_speed_mps ?? 1.2), 0) / eventList.length
          : agents.length > 0 ? (totalVel / agents.length) * 0.8 : 0
        const maxD = eventList.length > 0
          ? Math.max(...eventList.map((e) => e.density_per_sqm ?? 1.2))
          : mode === 'unmanaged' ? 4.6 + Math.random() * 0.6 : 1.8 + Math.random() * 0.3
        const risk = eventList.length > 0
          ? Math.round(Math.max(...eventList.map((e) => e.risk_score ?? 0.2)) * 100)
          : mode === 'unmanaged' ? Math.min(94, 68 + highDensityCount * 2) : 12 + Math.floor(Math.random() * 5)
        const bottleneck = criticalEvent
          ? `${criticalEvent.zone_name} (${criticalEvent.risk_level.toUpperCase()})`
          : 'None (Fluid Dispersal)'

        setTelemetry({
          activeAgents: agents.length,
          evacuatedAgents: evacuatedCount,
          avgVelocity: parseFloat(avgV.toFixed(2)),
          maxDensity: parseFloat(maxD.toFixed(1)),
          stampedeRisk: risk,
          bottleneckZone: bottleneck,
          flowEfficiency: risk > 60 ? 38 : 96,
        })
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isPlaying, simSpeed, mode, barricadesActive])

  return (
    <div className={cn('relative w-full h-full bg-[#060f18] overflow-hidden select-none', className)}>

      {/* ── WebGL Canvas ────────────────────────────────────────────── */}
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* ── TOP-LEFT: Scenario Badge ─────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 pointer-events-none">
        {mode === 'crowdshield' ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-emerald-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>CrowdShield AI Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            <span className="text-xs font-bold text-rose-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>Baseline Congestion (No AI)</span>
          </div>
        )}
      </div>

      {/* ── TOP-RIGHT: Controls Panel ────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-20 w-56 glass-panel border border-border rounded-2xl p-3.5 space-y-3 text-xs shadow-lg">
        {/* Mode Toggle */}
        <div className="flex rounded-xl overflow-hidden border border-border p-0.5 bg-secondary">
          <button
            onClick={() => setMode('unmanaged')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer',
              mode === 'unmanaged'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Baseline
          </button>
          <button
            onClick={() => setMode('crowdshield')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer',
              mode === 'crowdshield'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            AI Active
          </button>
        </div>

        {/* Play/Pause & Speed */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-bold transition-all cursor-pointer"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {isPlaying ? <Pause className="w-3 h-3 text-cyan-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
            <span>{isPlaying ? 'Pause' : 'Resume'}</span>
          </button>

          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={cn(
                  'px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer',
                  simSpeed === spd ? 'bg-cyan-500 text-slate-950' : 'text-muted-foreground hover:text-foreground'
                )}
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Camera Preset Switcher */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-bold" style={{ fontFamily: "'Montserrat', sans-serif" }}>Camera Perspective</p>
          <div className="grid grid-cols-2 gap-1">
            {(['isometric', 'topDown', 'gate1', 'concourse'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setCameraPreset(preset)}
                className={cn(
                  'py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer truncate',
                  cameraPreset === preset
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-white/5 text-muted-foreground border-white/5 hover:text-foreground'
                )}
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {preset === 'isometric' ? 'Orbit 45°' : preset === 'topDown' ? 'Top-Down' : preset === 'gate1' ? 'Gate 1 Cam' : 'Hub Cam'}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Count Slider */}
        <div className="pt-1 border-t border-white/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold" style={{ fontFamily: "'Montserrat', sans-serif" }}>Agents</span>
            <span className="font-extrabold text-cyan-400" style={{ fontFamily: "'Montserrat', sans-serif" }}>{agentTargetCount}</span>
          </div>
          <input
            type="range"
            min="40"
            max="200"
            step="20"
            value={agentTargetCount}
            onChange={(e) => setAgentTargetCount(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* ── BOTTOM-LEFT: Live Telemetry Strip ────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-4 glass-panel border border-white/10 rounded-2xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium">Agents:</span>
          <span className="font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>{telemetry.activeAgents}</span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium">Max Density:</span>
          <span className="font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>{telemetry.maxDensity} p/m²</span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium">Crush Hazard:</span>
          <span
            className={cn(
              'font-extrabold',
              telemetry.stampedeRisk > 50 ? 'text-rose-400' : 'text-emerald-400'
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {telemetry.stampedeRisk}%
          </span>
        </div>
      </div>

      {/* ── BOTTOM-RIGHT: Impact Comparison Panel ─────────────────────── */}
      <div
        className={cn(
          'absolute bottom-4 right-4 z-20 w-60 glass-panel border rounded-2xl p-3.5 text-xs transition-all',
          mode === 'crowdshield'
            ? 'border-emerald-500/30 bg-emerald-950/60'
            : 'border-rose-500/30 bg-rose-950/60'
        )}
      >
        {mode === 'crowdshield' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-emerald-500/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400" style={{ fontFamily: "'Montserrat', sans-serif" }}>CrowdShield Efficacy</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-200/70">Flow Efficiency</span>
              <span className="font-bold text-emerald-300">96% <span className="text-emerald-400/60 text-[10px]">↑ vs 38%</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-200/70">Crush Prevented</span>
              <span className="font-bold text-emerald-300">3 Events</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-200/70">Lives at Risk</span>
              <span className="font-bold text-emerald-300">0 <span className="text-emerald-400/60 text-[10px]">(was 23)</span></span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-rose-500/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Baseline (No AI)</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            </div>
            <div className="flex justify-between">
              <span className="text-rose-200/70">Flow Efficiency</span>
              <span className="font-bold text-rose-300">38%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rose-200/70">Crush Events</span>
              <span className="font-bold text-rose-300">3 ongoing</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rose-200/70">Est. Injuries</span>
              <span className="font-bold text-rose-300">12 – 23</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
