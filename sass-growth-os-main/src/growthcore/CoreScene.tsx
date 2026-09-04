/**
 * Growth Core — the 3D signature object.
 *
 * A small matte ceramic solid with a few signals orbiting it. Not a glowing
 * orb, not a brain, not a hologram. Lighting is soft and boring on purpose;
 * the drama comes from the choreography, not the material.
 *
 * Lazy-loaded. Never rendered when the user asks for reduced motion, and
 * never rendered more than once on a page.
 */

import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { cn } from '@/lib/cn'
import {
  SHAPE,
  SIGNAL_LINKS,
  SIGNALS,
  SIGNAL_PUSH,
  WINNER_INDEX,
  type CoreState,
} from './state'

/**
 * The seeds describe an arrangement, not a size. This pulls that arrangement
 * onto a shell that fits inside the camera's frustum at every state — the
 * canvas clips at its edges, and a signal node sliced in half by the edge of
 * the frame reads as a bug rather than as a signal leaving the argument.
 * The flat SVG draws into an overflow-visible viewBox and needs no equivalent.
 */
const SHELL = 0.7

const ACCENT = new THREE.Color('#4F6BFF')
// Deliberately darker than the canvas it sits on. A near-white ceramic under
// this much light renders as #FFF on every face and the form disappears; the
// object needs to be able to go *below* #FAFAF8 in shadow to read as a solid.
const CERAMIC = new THREE.Color('#E8E8E2')
const NODE_NEUTRAL = new THREE.Color('#C9C9C3')

/** Frame-rate-independent damping. */
function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt)
}

/* ------------------------------------------------------------------
   Central object
   ------------------------------------------------------------------ */

function CoreSolid({ state }: { state: CoreState }) {
  const mesh = useRef<THREE.Mesh>(null)
  const rimRef = useRef<THREE.Mesh>(null)

  // Radius kept below half the half-width so the faces survive. Round it much
  // further and the solid stops reading as a considered geometric object.
  const geo = useMemo(() => new RoundedBoxGeometry(1.34, 1.34, 1.34, 8, 0.3), [])
  const rimGeo = useMemo(() => new RoundedBoxGeometry(1.34, 1.34, 1.34, 6, 0.3), [])

  useFrame((_, dt) => {
    const target = SHAPE[state]
    const m = mesh.current
    if (!m) return
    const s = damp(m.scale.x, target.coreScale, 3.2, dt)
    m.scale.setScalar(s)
    rimRef.current?.scale.setScalar(s * 1.024)

    // Barely moving. A slow, considered turn — never a spin.
    m.rotation.y += dt * 0.075
    m.rotation.x = Math.sin(m.rotation.y * 0.34) * 0.075
    if (rimRef.current) {
      rimRef.current.rotation.copy(m.rotation)
    }
  })

  return (
    <group>
      {/* The solid: warm ceramic, high roughness, no shine to speak of. */}
      <mesh ref={mesh} geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={CERAMIC}
          roughness={0.62}
          metalness={0}
          clearcoat={0.28}
          clearcoatRoughness={0.72}
          sheen={0.4}
          sheenColor={new THREE.Color('#EDF0FF')}
          sheenRoughness={0.9}
        />
      </mesh>

      {/* A single hairline of blue where the light leaves the form. */}
      <mesh ref={rimRef} geometry={rimGeo}>
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.17}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------
   Signals + connections
   ------------------------------------------------------------------ */

type NodeRefs = React.MutableRefObject<Array<THREE.Mesh | null>>

function Constellation({ state, nodes }: { state: CoreState; nodes: NodeRefs }) {
  const group = useRef<THREE.Group>(null)
  const spokes = useRef<THREE.LineSegments>(null)
  const links = useRef<THREE.LineSegments>(null)
  const clock = useRef(0)

  /**
   * Emphasis, damped. The winner's colour has to be a function of the beat we
   * are on, not of which index happens to win: read it straight off `SHAPE`
   * and the value steps (0 → 0.25 → 1) and the node snaps blue. Damping it
   * here lets the accent arrive at the speed the rest of the object moves.
   */
  const emph = useRef(0)

  /** Resting positions, on the shell. Fixed for the life of the scene. */
  const rest = useMemo(
    () => SIGNALS.map((s) => new THREE.Vector3(...s.seed).multiplyScalar(SHELL)),
    []
  )

  // Live positions, damped toward their per-state targets.
  const live = useMemo(() => rest.map((v) => v.clone()), [rest])

  /** Scratch for the per-frame target. Allocating six vectors a frame is not
      free at 60fps, and this loop runs on every screen in the product. */
  const aim = useMemo(() => new THREE.Vector3(), [])

  const spokeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SIGNALS.length * 6), 3))
    return g
  }, [])

  const linkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SIGNAL_LINKS.length * 6), 3))
    return g
  }, [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30)
    clock.current += dt
    const t = clock.current
    const target = SHAPE[state]
    emph.current = damp(emph.current, target.emphasis, 3.4, dt)

    if (group.current) {
      group.current.rotation.y += dt * target.churn
    }

    const spokePos = spokeGeo.attributes.position.array as Float32Array
    const linkPos = linkGeo.attributes.position.array as Float32Array

    SIGNALS.forEach((sig, i) => {
      const isWinner = i === WINNER_INDEX

      // Weak signals are pushed further out as we prioritise. The winner does
      // not move at all — it holds the orbit it has always had while every
      // other signal leaves, which is what makes it read as the one that
      // survived rather than the one that arrived. Drawing it inward instead
      // buries it in the core, and at `decision` it is the only signal left.
      const pull = isWinner
        ? 1
        : 1 + (target.spread - 1) * (1 + (1 - sig.weight) * SIGNAL_PUSH)

      aim.copy(rest[i]).multiplyScalar(pull)

      // A slow drift, so the object never feels frozen — but nothing orbits
      // fast enough to read as "loading".
      const drift = state === 'decision' ? 0 : 1
      aim.x += Math.sin(t * sig.speed + i * 1.7) * 0.11 * drift
      aim.y += Math.cos(t * sig.speed * 0.82 + i * 2.3) * 0.1 * drift
      aim.z += Math.sin(t * sig.speed * 0.63 + i) * 0.09 * drift

      live[i].set(
        damp(live[i].x, aim.x, 2.6, dt),
        damp(live[i].y, aim.y, 2.6, dt),
        damp(live[i].z, aim.z, 2.6, dt)
      )

      const mesh = nodes.current[i]
      if (mesh) {
        mesh.position.copy(live[i])
        const targetScale = isWinner ? 1 + target.emphasis * 0.85 : 1
        const sc = damp(mesh.scale.x, targetScale, 3.4, dt)
        mesh.scale.setScalar(sc)

        const mat = mesh.material as THREE.MeshBasicMaterial
        // The winner outlives every other signal. At `decision` it is the only
        // thing left in the scene besides the core — which is the entire point
        // of the object: many signals in, one thing worth looking at out.
        const op = isWinner
          ? Math.max(target.signalOpacity, target.emphasis)
          : target.signalOpacity
        mat.opacity = damp(mat.opacity, op, 3.4, dt)
        // The winner is not blue because it is the winner. It is blue because
        // the object has finished deciding. Binding the accent to a constant
        // meant "Analytics" was already the answer in the first frame of
        // `idle`, four seconds before the sequence claims to work it out —
        // the hero giving away its own ending. Below `prioritizing` this is
        // near enough to 0.06 that the winner is indistinguishable.
        mat.color.lerpColors(NODE_NEUTRAL, ACCENT, isWinner ? Math.max(0.06, emph.current) : 0.06)
      }

      // Spoke: core → signal
      spokePos[i * 6 + 0] = 0
      spokePos[i * 6 + 1] = 0
      spokePos[i * 6 + 2] = 0
      spokePos[i * 6 + 3] = live[i].x
      spokePos[i * 6 + 4] = live[i].y
      spokePos[i * 6 + 5] = live[i].z
    })

    SIGNAL_LINKS.forEach(([a, b], i) => {
      linkPos[i * 6 + 0] = live[a].x
      linkPos[i * 6 + 1] = live[a].y
      linkPos[i * 6 + 2] = live[a].z
      linkPos[i * 6 + 3] = live[b].x
      linkPos[i * 6 + 4] = live[b].y
      linkPos[i * 6 + 5] = live[b].z
    })

    spokeGeo.attributes.position.needsUpdate = true
    linkGeo.attributes.position.needsUpdate = true

    if (spokes.current) {
      const m = spokes.current.material as THREE.LineBasicMaterial
      m.opacity = damp(m.opacity, target.spokeOpacity, 3, dt)
    }
    if (links.current) {
      const m = links.current.material as THREE.LineBasicMaterial
      m.opacity = damp(m.opacity, target.linkOpacity, 3, dt)
    }
  })

  return (
    <group ref={group}>
      <lineSegments ref={spokes} geometry={spokeGeo}>
        <lineBasicMaterial color="#B9BAC4" transparent opacity={0} depthWrite={false} />
      </lineSegments>

      <lineSegments ref={links} geometry={linkGeo}>
        <lineBasicMaterial color={ACCENT} transparent opacity={0} depthWrite={false} />
      </lineSegments>

      {SIGNALS.map((sig, i) => (
        <mesh
          key={sig.id}
          ref={(el) => {
            nodes.current[i] = el
          }}
          position={rest[i]}
        >
          <sphereGeometry args={[0.078, 20, 20]} />
          <meshBasicMaterial color={NODE_NEUTRAL} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------
   Soft contact shadow — a blurred ellipse, not a shadow map
   ------------------------------------------------------------------ */

function ContactShadow() {
  const texture = useMemo(() => {
    const size = 128
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(17,17,17,0.20)')
    g.addColorStop(0.4, 'rgba(17,17,17,0.07)')
    g.addColorStop(1, 'rgba(17,17,17,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(c)
    tex.needsUpdate = true
    return tex
  }, [])

  return (
    // Sits just under the form's lowest face, not on an imaginary floor below
    // it. A gap here is what turns a contact shadow into a decorative blob.
    <mesh position={[0, -0.86, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]}>
      <planeGeometry args={[2.4, 2.4]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

/* ------------------------------------------------------------------
   Signal labels — DOM text pinned to the projected 3D nodes

   Written straight to the elements' styles inside the frame loop. Labels
   follow the nodes every frame, so putting their positions in React state
   would mean re-rendering the tree 60 times a second to move six spans.
   ------------------------------------------------------------------ */

function LabelProjector({
  state,
  nodes,
  els,
}: {
  state: CoreState
  nodes: NodeRefs
  els: React.MutableRefObject<Array<HTMLSpanElement | null>>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const target = SHAPE[state]

    SIGNALS.forEach((_, i) => {
      const el = els.current[i]
      const mesh = nodes.current[i]
      if (!el || !mesh) return

      mesh.getWorldPosition(v).project(camera)

      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height

      // Same opacity rule as the node itself, so text and dot never disagree.
      const isWinner = i === WINNER_INDEX
      const op = isWinner
        ? Math.max(target.signalOpacity, target.emphasis)
        : target.signalOpacity

      // A label sits on the far side of its node, away from the core. Offset
      // uniformly upward instead, and the signals below the object get their
      // names printed onto the solid — which reads as text stuck to the shape
      // rather than as the name of the node it belongs to. The camera looks at
      // the origin, so the core's centre projects to NDC 0 and the sign of v.y
      // is exactly "is this node above the object".
      const dy = v.y >= 0 ? -27 : 27

      el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${(y + dy).toFixed(1)}px, 0)`
      el.style.opacity = String(op)

      // The winning label turns blue on the beat the object prioritises, not
      // on mount. Same threshold as the flat renderer, so the two drawings of
      // the same object never disagree about when the answer is known.
      if (isWinner) {
        el.style.color = target.emphasis > 0.3 ? 'var(--color-accent)' : ''
      }
    })
  })

  return null
}

/* ------------------------------------------------------------------
   Gentle pointer parallax on the whole scene
   ------------------------------------------------------------------ */

function Parallax({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const { pointer } = useThree()

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    g.rotation.y = damp(g.rotation.y, pointer.x * 0.18, 2.4, dt)
    g.rotation.x = damp(g.rotation.x, -pointer.y * 0.12, 2.4, dt)
  })

  return <group ref={group}>{children}</group>
}

/* ------------------------------------------------------------------
   Scene
   ------------------------------------------------------------------ */

export default function CoreScene({
  state = 'idle',
  showLabels = false,
}: {
  state?: CoreState
  showLabels?: boolean
}) {
  const nodes = useRef<Array<THREE.Mesh | null>>([])
  const els = useRef<Array<HTMLSpanElement | null>>([])

  return (
    <>
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      // Far enough back that the widest state still has air around it. The
      // core is meant to dominate the frame, but not to touch its edges.
      camera={{ position: [0, 0.77, 6], fov: 34 }}
      // Looking very slightly down on the object. Enough that the contact
      // shadow reads as a pool underneath rather than an edge-on band floating
      // below it — which is the difference between grounding and a blob.
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      // Measure the container's untransformed box, not its bounding rect. The
      // core sits inside elements that get scaled during layout transitions,
      // and a transform-aware measurement makes the renderer chase the
      // animation — reallocating the drawing buffer every frame and settling
      // on whatever size the last frame happened to have.
      resize={{ offsetSize: true }}
      style={{ pointerEvents: 'none' }}
    >
      {/* Soft studio light. Nothing dramatic — but enough falloff between the
          lit and unlit faces that the form has an edge without an outline. */}
      <ambientLight intensity={0.8} color="#FFFDF8" />
      <directionalLight position={[3.4, 4.6, 3.6]} intensity={1.7} color="#FFFFFF" />
      <directionalLight position={[-4, 1.2, -2.4]} intensity={0.42} color="#DDE3FF" />
      <hemisphereLight args={['#FFFFFF', '#DCDCD5', 0.5]} />

      <Parallax>
        <CoreSolid state={state} />
        <Constellation state={state} nodes={nodes} />
        <ContactShadow />
      </Parallax>

      {showLabels && <LabelProjector state={state} nodes={nodes} els={els} />}
    </Canvas>

    {showLabels && (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {SIGNALS.map((sig, i) => (
          <span
            key={sig.id}
            ref={(el) => {
              els.current[i] = el
            }}
            // Every label starts neutral. The winner's is coloured per frame
            // by LabelProjector once the object has actually prioritised —
            // colouring it here would name the answer before the run.
            className="absolute left-0 top-0 whitespace-nowrap text-[10.5px] font-[500] tracking-[-0.005em] text-faint"
            style={{ opacity: 0 }}
          >
            {sig.label}
          </span>
        ))}
      </div>
    )}
    </>
  )
}
