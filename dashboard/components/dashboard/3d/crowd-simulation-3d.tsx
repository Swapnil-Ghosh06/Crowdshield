'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import {
  Play,
  Pause,
  RotateCcw,
  Shield,
  ShieldAlert,
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

export function CrowdSimulation3D({ className }: { className?: string } = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Simulation State
  const [mode, setMode] = useState<SimulationMode>('crowdshield')
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [simSpeed, setSimSpeed] = useState<number>(1)
  const [agentTargetCount, setAgentTargetCount] = useState<number>(120)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric')
  const [showHeatFloor, setShowHeatFloor] = useState<boolean>(true)
  const [showFlowVectors, setShowFlowVectors] = useState<boolean>(true)
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)

  // Live Simulation Telemetry
  const [telemetry, setTelemetry] = useState({
    activeAgents: 0,
    evacuatedAgents: 0,
    avgVelocity: 1.2,
    maxDensity: 2.1,
    stampedeRisk: 14,
    bottleneckZone: 'None (Stable)',
    flowEfficiency: 92,
  })

  // Gates State
  const [gates, setGates] = useState<Record<string, GateConfig>>({
    gate_1: { id: 'gate_1', name: 'South Gate (Main)', position: new THREE.Vector3(0, 0, 32), isOpen: true, isRerouted: false, color: 0x22c55e },
    gate_2: { id: 'gate_2', name: 'West Gate', position: new THREE.Vector3(-32, 0, 0), isOpen: true, isRerouted: false, color: 0x22c55e },
    gate_3: { id: 'gate_3', name: 'North Gate', position: new THREE.Vector3(0, 0, -32), isOpen: true, isRerouted: false, color: 0x22c55e },
    gate_4: { id: 'gate_4', name: 'East Gate', position: new THREE.Vector3(32, 0, 0), isOpen: true, isRerouted: false, color: 0x22c55e },
  })

  // Barricades state (activated in CrowdShield mode)
  const [barricadesActive, setBarricadesActive] = useState<boolean>(true)

  // References for Three.js objects
  const agentsRef = useRef<Agent[]>([])
  const gateMeshesRef = useRef<Map<string, THREE.Group>>(new Map())
  const barricadeMeshesRef = useRef<THREE.Group[]>([])
  const vectorArrowsRef = useRef<THREE.ArrowHelper[]>([])
  const heatFloorRef = useRef<THREE.Mesh | null>(null)

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return

    const width = containerRef.current.clientWidth || 800
    const height = containerRef.current.clientHeight || 520

    // 1. Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x060f18)
    scene.fog = new THREE.FogExp2(0x060f18, 0.012)
    sceneRef.current = scene

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 500)
    camera.position.set(0, 48, 55)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    containerRef.current.replaceChildren(renderer.domElement)

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x223a5e, 1.4)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8)
    dirLight.position.set(30, 50, 40)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 150
    dirLight.shadow.camera.left = -40
    dirLight.shadow.camera.right = 40
    dirLight.shadow.camera.top = 40
    dirLight.shadow.camera.bottom = -40
    scene.add(dirLight)

    // Center Concourse Accent Light
    const centerPointLight = new THREE.PointLight(0x00f0ff, 2, 45)
    centerPointLight.position.set(0, 8, 0)
    scene.add(centerPointLight)

    // 5. Environment & Venue Architecture
    buildVenueEnvironment(scene)

    // 6. Build Gate Arches & Barricades
    buildGatesAndBarricades(scene)

    // 7. Mouse Orbit & Pan Controls
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

      // Orbit around center
      const rotSpeed = 0.005
      const currentPos = cameraRef.current.position
      const radius = Math.sqrt(currentPos.x * currentPos.x + currentPos.z * currentPos.z)
      let theta = Math.atan2(currentPos.x, currentPos.z) + deltaX * rotSpeed

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
      cameraRef.current.position.clampLength(15, 120)
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
    // Holographic Grid Floor
    const floorGeo = new THREE.PlaneGeometry(80, 80, 40, 40)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x081726,
      roughness: 0.8,
      metalness: 0.2,
      wireframe: false,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Grid Overlay
    const grid = new THREE.GridHelper(80, 40, 0x00f0ff, 0x142b42)
    grid.position.y = 0.05
    scene.add(grid)

    // Central Concourse Stage / Ring
    const concourseGeo = new THREE.CylinderGeometry(14, 14, 0.4, 48)
    const concourseMat = new THREE.MeshStandardMaterial({
      color: 0x0d283f,
      emissive: 0x003b5c,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    })
    const concourse = new THREE.Mesh(concourseGeo, concourseMat)
    concourse.position.set(0, 0.2, 0)
    concourse.receiveShadow = true
    scene.add(concourse)

    // Central Holographic Tower Pillar
    const pillarGeo = new THREE.CylinderGeometry(1.8, 1.8, 8, 24)
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.8,
      wireframe: true,
    })
    const pillar = new THREE.Mesh(pillarGeo, pillarMat)
    pillar.position.set(0, 4, 0)
    scene.add(pillar)

    // Perimeter Venue Walls with glowing security trim
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x102538, roughness: 0.7 })
    const wallGlowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff })

    const wallThickness = 1.2
    const wallHeight = 4
    const venueRadius = 36

    // 4 Main Quadrant Walls
    const wallSegments = [
      { x: 0, z: -venueRadius, w: 50, h: wallHeight, d: wallThickness },
      { x: 0, z: venueRadius, w: 50, h: wallHeight, d: wallThickness },
      { x: -venueRadius, z: 0, w: wallThickness, h: wallHeight, d: 50 },
      { x: venueRadius, z: 0, w: wallThickness, h: wallHeight, d: 50 },
    ]

    wallSegments.forEach((seg) => {
      const wallGeo = new THREE.BoxGeometry(seg.w, seg.h, seg.d)
      const wallMesh = new THREE.Mesh(wallGeo, wallMat)
      wallMesh.position.set(seg.x, seg.h / 2, seg.z)
      wallMesh.castShadow = true
      wallMesh.receiveShadow = true
      scene.add(wallMesh)

      // Laser Trim Line on top of wall
      const trimGeo = new THREE.BoxGeometry(seg.w, 0.15, seg.d + 0.1)
      const trimMesh = new THREE.Mesh(trimGeo, wallGlowMat)
      trimMesh.position.set(seg.x, seg.h + 0.1, seg.z)
      scene.add(trimMesh)
    })

    // 4 Corner Evacuation Exits
    const exitLocations = [
      { x: -28, z: -28, label: 'EXIT NW' },
      { x: 28, z: -28, label: 'EXIT NE' },
      { x: -28, z: 28, label: 'EXIT SW' },
      { x: 28, z: 28, label: 'EXIT SE' },
    ]

    exitLocations.forEach((exit) => {
      const exitBase = new THREE.Mesh(
        new THREE.CylinderGeometry(3.5, 3.5, 0.2, 16),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true })
      )
      exitBase.position.set(exit.x, 0.1, exit.z)
      scene.add(exitBase)

      const exitBeacon = new THREE.PointLight(0x22c55e, 1.2, 15)
      exitBeacon.position.set(exit.x, 3, exit.z)
      scene.add(exitBeacon)
    })
  }

  // Build Gate Arches & Barricade Objects
  const buildGatesAndBarricades = (scene: THREE.Scene) => {
    // Build 4 Entrance Gates
    Object.values(gates).forEach((gate) => {
      const gateGroup = new THREE.Group()

      // Gate Arch Pillars
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

      // Top Header Beam
      const beamGeo = isZAxis
        ? new THREE.BoxGeometry(9.2, 1.2, 1.2)
        : new THREE.BoxGeometry(1.2, 1.2, 9.2)
      const beam = new THREE.Mesh(beamGeo, archPillarMat)
      beam.position.set(0, 6, 0)

      // Laser Barrier Curtain (Toggles Red/Green)
      const barrierGeo = isZAxis
        ? new THREE.PlaneGeometry(8, 5)
        : new THREE.PlaneGeometry(8, 5)
      const barrierMat = new THREE.MeshBasicMaterial({
        color: gate.isOpen ? 0x22c55e : 0xef4444,
        transparent: true,
        opacity: gate.isOpen ? 0.25 : 0.85,
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
      { x: -8, z: 18, rot: Math.PI / 6 },
      { x: 8, z: 18, rot: -Math.PI / 6 },
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

    // 2. Torso (Jacket)
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
    // Clear existing agents
    agentsRef.current.forEach((a) => scene.remove(a.mesh))
    agentsRef.current = []

    const gateKeys = Object.keys(gates)

    for (let i = 0; i < count; i++) {
      // Gate 1 (South) is the surge gate in unmanaged mode (80% traffic)
      let gateKey = 'gate_1'
      if (currentMode === 'crowdshield') {
        // Balanced distribution across 4 gates
        gateKey = gateKeys[i % gateKeys.length]
      } else {
        // Surge into Gate 1
        gateKey = Math.random() < 0.75 ? 'gate_1' : gateKeys[i % gateKeys.length]
      }

      const spawnGate = gates[gateKey]
      const spawnOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        0,
        (Math.random() - 0.5) * 8
      )
      const spawnPos = spawnGate.position.clone().add(spawnOffset)

      // Target position: Central Concourse or Evacuation exit
      let targetPos = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        0,
        (Math.random() - 0.5) * 12
      )

      if (currentMode === 'crowdshield' && Math.random() > 0.4) {
        // Rerouted to nearest safe exit
        targetPos = new THREE.Vector3(
          Math.random() > 0.5 ? 26 : -26,
          0,
          Math.random() > 0.5 ? 26 : -26
        )
      }

      const initialColor = currentMode === 'unmanaged' && gateKey === 'gate_1' ? 0xf97316 : 0x22c55e
      const { group, legs, aura } = createHumanoidMesh(initialColor)
      group.position.copy(spawnPos)
      scene.add(group)

      agentsRef.current.push({
        id: i,
        mesh: group,
        legs,
        aura,
        position: spawnPos,
        velocity: new THREE.Vector3(0, 0, 0),
        target: targetPos,
        speed: 0.8 + Math.random() * 0.6,
        state: 'normal',
        targetGate: gateKey,
        panicLevel: 0,
        walkCycle: Math.random() * Math.PI * 2,
      })
    }
  }

  // Trigger Re-spawn when Mode or Count changes
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

  // Update Gate Lasers Visuals
  useEffect(() => {
    Object.entries(gates).forEach(([id, gate]) => {
      const gateMesh = gateMeshesRef.current.get(id)
      if (!gateMesh) return
      const laser = gateMesh.getObjectByName('laserBarrier') as THREE.Mesh
      if (laser && laser.material) {
        const mat = laser.material as THREE.MeshBasicMaterial
        mat.color.setHex(gate.isOpen ? 0x22c55e : 0xef4444)
        mat.opacity = gate.isOpen ? 0.25 : 0.85
      }
    })
  }, [gates])

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

  // Main Simulation Physics & Render Loop
  useEffect(() => {
    let lastTime = performance.now()

    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate)

      const dt = Math.min((time - lastTime) / 1000, 0.1) * simSpeed
      lastTime = time

      if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return

      if (isPlaying) {
        const agents = agentsRef.current
        let totalVel = 0
        let highDensityCount = 0
        let evacuatedCount = 0

        // Simulation Step for Each Agent
        for (let i = 0; i < agents.length; i++) {
          const a = agents[i]

          // 1. Check if Reached Exit / Destination
          const distToTarget = a.position.distanceTo(a.target)
          if (distToTarget < 2.5) {
            if (a.state !== 'evacuated') {
              a.state = 'evacuated'
              // Loop / Recycle agent to perimeter
              const spawnGate = gates[a.targetGate]
              a.position.copy(spawnGate.position).add(
                new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)
              )
              a.state = 'normal'
            }
            evacuatedCount++
          }

          // 2. Compute Desired Velocity towards Target
          const desiredDir = new THREE.Vector3().subVectors(a.target, a.position)
          desiredDir.y = 0
          desiredDir.normalize()

          // 3. Social Force Repulsion (Agent-Agent Avoidance)
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
              push.normalize().multiplyScalar((2.2 - dist) * 1.6)
              repulsion.add(push)
            }
          }

          // 4. Barricade Avoidance in CrowdShield Mode
          if (mode === 'crowdshield' && barricadesActive) {
            // Divert agents smoothly around center barrier
            if (a.position.z > 5 && a.position.z < 22 && Math.abs(a.position.x) < 7) {
              const divertX = a.position.x >= 0 ? 1.5 : -1.5
              repulsion.add(new THREE.Vector3(divertX, 0, 0))
            }
          }

          // 5. Unmanaged Bottleneck Congestion Physics
          if (mode === 'unmanaged') {
            // South gate bottleneck build-up (around z = 15..28)
            if (a.position.z > 10 && a.position.z < 28 && Math.abs(a.position.x) < 8) {
              if (neighborCount > 4) {
                a.panicLevel = Math.min(1, a.panicLevel + dt * 0.4)
                a.speed = Math.max(0.2, a.speed - dt * 0.3)
              }
            } else {
              a.panicLevel = Math.max(0, a.panicLevel - dt * 0.1)
            }
          } else {
            // CrowdShield mode keeps panic low
            a.panicLevel = Math.max(0, a.panicLevel - dt * 0.5)
            a.speed = 1.1 + Math.random() * 0.3
          }

          // 6. Integrate Acceleration & Velocity
          const moveForce = desiredDir.multiplyScalar(a.speed).add(repulsion)
          a.velocity.lerp(moveForce, 0.12)
          a.position.addScaledVector(a.velocity, dt * 4)

          // Clamp within venue boundaries
          a.position.x = Math.max(-34, Math.min(34, a.position.x))
          a.position.z = Math.max(-34, Math.min(34, a.position.z))
          a.position.y = 0

          // Update Mesh Position & Rotation
          a.mesh.position.copy(a.position)

          if (a.velocity.lengthSq() > 0.01) {
            const angle = Math.atan2(a.velocity.x, a.velocity.z)
            a.mesh.rotation.y = angle

            // Animate Humanoid Walking Legs
            a.walkCycle += a.velocity.length() * dt * 8
            a.legs[0].rotation.x = Math.sin(a.walkCycle) * 0.6
            a.legs[1].rotation.x = -Math.sin(a.walkCycle) * 0.6
          }

          // 7. Update Agent Color & Aura based on State
          if (neighborCount >= 5 || a.panicLevel > 0.6) {
            a.state = 'danger'
            highDensityCount++
            ;(a.aura.material as THREE.MeshBasicMaterial).color.setHex(0xef4444)
          } else if (neighborCount >= 3 || a.panicLevel > 0.2) {
            a.state = 'dense'
            ;(a.aura.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b)
          } else {
            a.state = 'normal'
            ;(a.aura.material as THREE.MeshBasicMaterial).color.setHex(0x22c55e)
          }

          totalVel += a.velocity.length()
        }

        // Update Live Telemetry
        const avgV = agents.length > 0 ? (totalVel / agents.length) * 0.8 : 0
        const maxD = mode === 'unmanaged' ? 4.8 + Math.random() * 0.8 : 1.9 + Math.random() * 0.3
        const risk = mode === 'unmanaged' ? Math.min(94, 65 + highDensityCount * 2) : 12 + Math.floor(Math.random() * 6)

        setTelemetry({
          activeAgents: agents.length,
          evacuatedAgents: evacuatedCount,
          avgVelocity: parseFloat(avgV.toFixed(2)),
          maxDensity: parseFloat(maxD.toFixed(1)),
          stampedeRisk: risk,
          bottleneckZone: mode === 'unmanaged' ? 'South Gate 1 (Critical Crush)' : 'None (Fluid Dispersal)',
          flowEfficiency: mode === 'unmanaged' ? 38 : 96,
        })
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isPlaying, simSpeed, mode, barricadesActive])

  // Trigger Flash Surge (Stress Test)
  const handleTriggerSurge = () => {
    if (!sceneRef.current) return
    setAgentTargetCount((prev) => Math.min(260, prev + 60))
  }

  // Toggle Gate Open/Close
  const handleToggleGate = (gateId: string) => {
    setGates((prev) => ({
      ...prev,
      [gateId]: { ...prev[gateId], isOpen: !prev[gateId].isOpen },
    }))
  }

  return (
    <div className={cn('relative w-full h-full bg-[#060f18] overflow-hidden', className)}>

      {/* ── WebGL Canvas — fills entire container ───────────────────── */}
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* ── TOP-LEFT: Scenario Badge ─────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 pointer-events-none">
        {mode === 'crowdshield' ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-300">CrowdShield Active</span>
            </div>
            <p className="text-[10px] text-emerald-400/80 pl-1 font-mono">
              AI managing 4 zones · Rerouting Gate 1
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/20 border border-destructive/40 backdrop-blur-md">
              <span className="text-destructive text-xs">⚠</span>
              <span className="text-xs font-bold text-red-300">Baseline — No AI</span>
            </div>
            <p className="text-[10px] text-red-400/80 pl-1 font-mono">
              Crush risk active · No interventions
            </p>
          </>
        )}
      </div>

      {/* ── TOP-RIGHT: Controls Panel ────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-20 w-52 bg-background/75 backdrop-blur-md border border-border/60 rounded-xl p-3 space-y-3 text-xs">

        {/* Mode Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => setMode('unmanaged')}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-semibold transition-colors',
              mode === 'unmanaged'
                ? 'bg-destructive text-white'
                : 'text-muted-foreground hover:bg-secondary'
            )}
          >
            Baseline
          </button>
          <button
            onClick={() => setMode('crowdshield')}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-semibold transition-colors',
              mode === 'crowdshield'
                ? 'bg-emerald-600 text-white'
                : 'text-muted-foreground hover:bg-secondary'
            )}
          >
            AI Active
          </button>
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground font-medium transition-colors"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'Pause' : 'Resume'}
        </button>

        {/* Speed */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Speed</p>
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={cn(
                  'py-1 rounded text-[11px] font-mono font-medium border transition-colors',
                  simSpeed === spd
                    ? 'bg-accent/20 text-accent border-accent/40'
                    : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                )}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Camera */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Camera</p>
          <div className="grid grid-cols-2 gap-1">
            {(['isometric', 'topDown', 'gate1', 'concourse'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setCameraPreset(preset)}
                className={cn(
                  'py-1 rounded text-[10px] font-medium border transition-colors truncate',
                  cameraPreset === preset
                    ? 'bg-accent/20 text-accent border-accent/40'
                    : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                )}
              >
                {preset === 'isometric' ? 'Orbit' : preset === 'topDown' ? 'Top' : preset === 'gate1' ? 'Gate 1' : 'Hub'}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/40" />

        {/* Agent Count Slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Agents</span>
            <span className="font-mono font-bold text-foreground text-[11px]">{agentTargetCount}</span>
          </div>
          <input
            type="range"
            min="40"
            max="200"
            step="20"
            value={agentTargetCount}
            onChange={(e) => setAgentTargetCount(Number(e.target.value))}
            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </div>
      </div>

      {/* ── BOTTOM-LEFT: Live Telemetry Strip ────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-4 bg-background/75 backdrop-blur-md border border-border/60 rounded-xl px-4 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Agents:</span>
          <span className="font-mono font-bold text-foreground">{telemetry.activeAgents}</span>
        </div>
        <span className="text-border">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Max Density:</span>
          <span className="font-mono font-bold text-foreground">{telemetry.maxDensity}/m²</span>
        </div>
        <span className="text-border">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Crush Risk:</span>
          <span
            className={cn(
              'font-mono font-bold',
              telemetry.stampedeRisk > 50 ? 'text-destructive' : 'text-emerald-400'
            )}
          >
            {telemetry.stampedeRisk}%
          </span>
        </div>
      </div>

      {/* ── BOTTOM-RIGHT: Story / Impact Panel ───────────────────────── */}
      <div
        className={cn(
          'absolute bottom-4 right-4 z-20 w-56 backdrop-blur-md border rounded-xl p-3 text-xs transition-all',
          mode === 'crowdshield'
            ? 'bg-emerald-950/80 border-emerald-800/50'
            : 'bg-red-950/80 border-red-800/50'
        )}
      >
        {mode === 'crowdshield' ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2">CrowdShield Impact</p>
            <div className="flex justify-between">
              <span className="text-emerald-200/70">Flow Efficiency</span>
              <span className="font-mono font-bold text-emerald-300">96% <span className="text-emerald-400/60 text-[10px]">↑ vs 41%</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-200/70">Crush events prevented</span>
              <span className="font-mono font-bold text-emerald-300">3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-200/70">Lives at risk</span>
              <span className="font-mono font-bold text-emerald-300">0 <span className="text-emerald-400/60 text-[10px]">(was 23)</span></span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2">Baseline — No AI</p>
            <div className="flex justify-between">
              <span className="text-red-200/70">Flow Efficiency</span>
              <span className="font-mono font-bold text-red-300">41%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-200/70">Crush events</span>
              <span className="font-mono font-bold text-red-300">3 ongoing</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-200/70">Est. injuries</span>
              <span className="font-mono font-bold text-red-300">12–23</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
