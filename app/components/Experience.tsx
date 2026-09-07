"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, OrbitControls, MeshReflectorMaterial, useProgress } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import gsap from "gsap";
import * as THREE from "three";
import { Car, type CarHandles } from "./Car";
import { FULL_CAR_VIEW, SCENE_CAMERAS, FINALE_DEPARTURE, type SceneCam } from "./cameraPath";

const TOTAL_SCENES = SCENE_CAMERAS.length; // 9: hero (0) + 8 directed shots (1-8)
const FINALE_SCENE = TOTAL_SCENES - 1;
const ENGINE_SCENE = 6;

type FlatCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function flatten(c: SceneCam): FlatCam {
  return { x: c.position[0], y: c.position[1], z: c.position[2], lx: c.lookAt[0], ly: c.lookAt[1], lz: c.lookAt[2], fov: c.fov };
}

// Every caption/panel uses this so text stays legible no matter what's behind
// it in the 3D scene, without needing an opaque backing panel.
const TEXT_GLOW = {
  textShadow: "0 2px 28px rgba(0,0,0,0.9), 0 1px 6px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.6)",
};

type SceneContent = { eyebrow: string; title: string; body?: string };

// Index 0 = scene 1 (wheel/brake) ... index 6 = scene 7 (performance).
// Scene 6 (engine/drivetrain, index 5 here) uses the dedicated white data
// panel instead, and scene 8 (finale) is fully custom - neither reads this.
const SCENE_CONTENT: SceneContent[] = [
  {
    eyebrow: "BRAKING SYSTEM",
    title: "Stops as hard as it goes.",
    body: "Carbon-ceramic discs and forged wheels — engineered to shed speed as fast as they build it.",
  },
  {
    eyebrow: "FORM WITH PURPOSE",
    title: "Every line has a job.",
    body: "The shoulder line channels air to the intake. Nothing on this body exists for decoration.",
  },
  {
    eyebrow: "SIGNATURE LIGHTING",
    title: "Unmistakable, even leaving.",
    body: "Full-width LED taillights and a quad exhaust — the last thing you see before it's gone.",
  },
  {
    eyebrow: "INSIDE",
    title: "Step inside.",
    body: "Nappa leather. Carbon trim. A cabin built around the driver, not the options list.",
  },
  {
    eyebrow: "DRIVER FOCUSED",
    title: "Everything within reach.",
    body: "Nothing without purpose. Every control exactly where your hands expect it.",
  },
  { eyebrow: "", title: "" }, // scene 6 - engine/drivetrain, uses the data panel instead
  {
    eyebrow: "COMPLETE PICTURE",
    title: "One machine. No compromise.",
    body: "503 horsepower, all-wheel drive, and a chassis tuned for one purpose.",
  },
];

// Decoupled from `sceneIndex` on purpose: sceneIndex flips immediately (so
// captions/effects react right away), but camera ownership (`heroActive`)
// only flips once a transition has actually visually arrived - see goToScene.
function CameraRig({
  heroActive,
  camState,
}: {
  heroActive: React.RefObject<boolean>;
  camState: React.RefObject<FlatCam>;
}) {
  const { camera } = useThree();
  const lookAtVec = useRef(new THREE.Vector3());

  useFrame(() => {
    if (heroActive.current) return; // hero: OrbitControls owns the camera
    const c = camState.current;
    camera.position.set(c.x, c.y, c.z);
    lookAtVec.current.set(c.lx, c.ly, c.lz);
    camera.lookAt(lookAtVec.current);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = c.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function HeroRig({
  heroActive,
  live,
  controlsRef,
  camState,
}: {
  heroActive: React.RefObject<boolean>;
  live: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  camState: React.RefObject<FlatCam>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...FULL_CAR_VIEW.position);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = FULL_CAR_VIEW.fov;
      camera.updateProjectionMatrix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    if (!heroActive.current) return;
    // Keep camState mirroring the *real* live camera while the hero owns it,
    // so the moment we hand off to a scripted transition, it blends from
    // wherever auto-rotate/drag actually left the camera - never a snap.
    const c = camState.current;
    c.x = camera.position.x;
    c.y = camera.position.y;
    c.z = camera.position.z;
    if (controlsRef.current) {
      c.lx = controlsRef.current.target.x;
      c.ly = controlsRef.current.target.y;
      c.lz = controlsRef.current.target.z;
    }
    if (camera instanceof THREE.PerspectiveCamera) c.fov = camera.fov;
  });

  // Fully unmounted (not just `enabled={false}`) whenever a scripted scene
  // owns the camera: three.js's OrbitControls.update() runs every frame
  // regardless of `enabled` and would keep nudging position/orientation
  // toward its own fixed hero target, causing a subtle per-frame fight with
  // CameraRig during every non-hero scene.
  if (!live) return null;

  return (
    <OrbitControls
      ref={controlsRef}
      enabled
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      autoRotate
      autoRotateSpeed={1.1}
      minPolarAngle={Math.PI * 0.22}
      maxPolarAngle={Math.PI * 0.48}
      target={FULL_CAR_VIEW.lookAt}
    />
  );
}

function HeadTailLights({
  sceneIndex,
  handles,
}: {
  sceneIndex: React.RefObject<number>;
  handles: React.RefObject<CarHandles | null>;
}) {
  const startedAt = useRef<number | null>(null);

  useFrame((_, delta) => {
    const h = handles.current;
    if (!h) return;

    // Headlights power on once, shortly after the page loads.
    if (startedAt.current === null) startedAt.current = 0;
    startedAt.current += delta;
    const headOn = THREE.MathUtils.clamp(startedAt.current / 1.4, 0, 1);
    h.headlightMaterials.forEach((m) => {
      m.emissiveIntensity = THREE.MathUtils.lerp(0.6, 4, headOn);
    });

    // Taillights come alive from scene 3 (rear/taillight) onward and stay lit.
    const tailTarget = sceneIndex.current >= 3 ? 6 : 0.3;
    h.taillightMaterials.forEach((m) => {
      m.emissiveIntensity += (tailTarget - m.emissiveIntensity) * Math.min(delta * 4, 1);
    });
  });

  return null;
}

function WheelAndDrivetrain({
  sceneIndex,
  handles,
  pulseMesh,
  pulseMaterial,
}: {
  sceneIndex: React.RefObject<number>;
  handles: React.RefObject<CarHandles | null>;
  pulseMesh: React.RefObject<THREE.Mesh | null>;
  pulseMaterial: React.RefObject<THREE.MeshBasicMaterial | null>;
}) {
  const elapsed = useRef(0);
  const visibility = useRef(0);

  useFrame((_, delta) => {
    const active = sceneIndex.current === ENGINE_SCENE;
    const h = handles.current;

    if (active) elapsed.current += delta;
    visibility.current += ((active ? 1 : 0) - visibility.current) * Math.min(delta * 5, 1);

    if (h) {
      const speed = active ? 10 : 0;
      h.wheels.forEach((w) => {
        w.rotation.x -= speed * delta;
      });
    }

    const wave = (Math.sin(elapsed.current * 1.6 - Math.PI / 2) + 1) / 2;
    const z = THREE.MathUtils.lerp(2.1, -2.3, wave);
    if (pulseMesh.current) {
      pulseMesh.current.position.set(0, 0.28, z);
      pulseMesh.current.scale.setScalar(0.5 + visibility.current * 0.5);
    }
    if (pulseMaterial.current) pulseMaterial.current.opacity = visibility.current;
  });

  return (
    <mesh ref={pulseMesh}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial ref={pulseMaterial} color="#7fd8ff" transparent toneMapped={false} />
    </mesh>
  );
}

function GradientBackdrop() {
  return (
    <mesh scale={40}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#0a0c10" side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

function StudioFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <planeGeometry args={[80, 80]} />
      <MeshReflectorMaterial
        blur={[300, 80]}
        resolution={400}
        mixBlur={3}
        mixStrength={20}
        roughness={1}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.3}
        color="#050506"
        metalness={0.4}
      />
    </mesh>
  );
}

function LoadingOverlay({ ready }: { ready: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { progress } = useProgress();
  const shown = Math.min(Math.round(progress), 100);

  useEffect(() => {
    if (!ready || !rootRef.current) return;
    gsap.to(rootRef.current, {
      opacity: 0,
      duration: 0.9,
      delay: 0.2,
      ease: "power2.out",
      onComplete: () => {
        if (rootRef.current) rootRef.current.style.visibility = "hidden";
      },
    });
  }, [ready]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0a0c10]"
    >
      <span
        className="text-3xl sm:text-4xl text-white tracking-[0.08em] font-[family-name:var(--font-display)] font-extrabold"
        style={TEXT_GLOW}
      >
        BMW M4
      </span>
      <div className="relative h-[2px] w-48 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[#1b4fd6] via-[#5c3fd6] to-[#d61f36] transition-[width] duration-200 ease-out"
          style={{ width: `${shown}%` }}
        />
      </div>
      <span className="text-[10px] tracking-[0.4em] text-white/40 tabular-nums">{shown}%</span>
    </div>
  );
}

function SoundToggleButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? "Unmute engine sound" : "Mute engine sound"}
      className="absolute left-5 top-5 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/80 backdrop-blur-sm transition hover:bg-black/50 hover:text-white"
    >
      {muted ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="4,9 8,9 12,5 12,19 8,15 4,15" fill="currentColor" stroke="none" />
          <line x1="16" y1="9" x2="21" y2="15" />
          <line x1="21" y1="9" x2="16" y2="15" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="4,9 8,9 12,5 12,19 8,15 4,15" fill="currentColor" stroke="none" />
          <path d="M16 8.5c1 1 1 6 0 7" />
          <path d="M18.5 6c2 2 2 10 0 12" />
        </svg>
      )}
    </button>
  );
}

export default function Experience() {
  const { active: assetsActive, progress: assetsProgress } = useProgress();
  const ready = !assetsActive && assetsProgress >= 100;

  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  // Mirrors heroActive, but as state - so <OrbitControls> can be fully
  // unmounted (not just disabled) while a scripted scene owns the camera.
  const [heroLive, setHeroLive] = useState(true);

  const sceneIndex = useRef(0);
  const heroActive = useRef(true);
  const transitioning = useRef(false);
  const camState = useRef<FlatCam>(flatten(FULL_CAR_VIEW));
  const heroControls = useRef<OrbitControlsImpl>(null);
  const carHandles = useRef<CarHandles | null>(null);
  const pulseMesh = useRef<THREE.Mesh>(null);
  const pulseMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const engineAudio = useRef<HTMLAudioElement | null>(null);
  const finaleTimeline = useRef<gsap.core.Timeline | null>(null);

  const heroWordmarkRef = useRef<HTMLDivElement>(null);
  const heroHintRef = useRef<HTMLDivElement>(null);
  const captionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const statRefs = useRef<Array<HTMLDivElement | null>>([]);
  const finaleFadeRef = useRef<HTMLDivElement>(null);
  const finaleWordmarkRef = useRef<HTMLDivElement>(null);

  // Hoisted to component scope (rather than defined inside the setup effect
  // below) so the ready-watching effect can call it safely regardless of
  // effect execution order.
  const setHeroUI = (visible: boolean) => {
    gsap.to([heroWordmarkRef.current, heroHintRef.current], {
      opacity: visible ? 1 : 0,
      y: visible ? 0 : -14,
      filter: visible ? "blur(0px)" : "blur(6px)",
      duration: visible ? 0.6 : 0.25,
      delay: visible ? 0.7 : 0,
      overwrite: true,
    });
  };

  useEffect(() => {
    mutedRef.current = muted;
    if (muted) engineAudio.current?.pause();
  }, [muted]);

  // Hero reveal waits for the model to actually finish loading instead of
  // firing unconditionally on mount.
  useEffect(() => {
    if (ready) setHeroUI(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    engineAudio.current = new Audio("/sound/bmw-sound.mp3");
    engineAudio.current.loop = false;
    engineAudio.current.volume = 0.6;

    // Every scene change restarts the clip from frame zero so it always
    // plays a full, fresh blip - never a fade that makes it seem to "stop".
    // Restarts fresh on every scroll tick and keeps playing as long as ticks
    // keep coming; killTweensOf cancels any pending fade-out from a previous
    // tick, so rapid scrolling just keeps the sound alive. Only once scrolling
    // actually stops does the scheduled fade-out get to run.
    const playBlip = () => {
      const a = engineAudio.current;
      if (!a || mutedRef.current) return;
      gsap.killTweensOf(a);
      a.currentTime = 0;
      a.volume = 0;
      a.playbackRate = 1 + Math.random() * 0.06;
      a.play().catch(() => {});
      // Short percussive envelope - a quick tick effect, not the whole clip.
      gsap.to(a, { volume: 0.5, duration: 0.06, ease: "power1.out" });
      gsap.to(a, {
        volume: 0,
        duration: 0.3,
        delay: 0.16,
        ease: "power1.out",
        onComplete: () => a.pause(),
      });
    };

    const setCaptionUI = (index: number, visible: boolean) => {
      const contentIndex = index - 1;
      if (contentIndex < 0 || contentIndex >= SCENE_CONTENT.length || contentIndex === ENGINE_SCENE - 1) return;
      const el = captionRefs.current[contentIndex];
      if (!el) return;
      gsap.to(el, {
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 18,
        filter: visible ? "blur(0px)" : "blur(6px)",
        duration: visible ? 0.6 : 0.25,
        delay: visible ? 0.8 : 0,
        overwrite: true,
      });
    };

    const setPanelUI = (visible: boolean) => {
      if (!panelRef.current) return;
      gsap.to(panelRef.current, {
        opacity: visible ? 1 : 0,
        x: visible ? 0 : 48,
        duration: visible ? 0.5 : 0.25,
        delay: visible ? 0.7 : 0,
        overwrite: true,
      });
      if (visible) {
        const tl = gsap.timeline({ delay: 0.5 });
        statRefs.current.forEach((el) => {
          if (el) tl.to(el, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.3 }, "+=0.06");
        });
      } else {
        statRefs.current.forEach((el) => {
          if (el) gsap.set(el, { opacity: 0, y: 18, filter: "blur(6px)" });
        });
      }
    };

    const resetFinale = () => {
      finaleTimeline.current?.kill();
      finaleTimeline.current = null;
      gsap.set(finaleFadeRef.current, { opacity: 0 });
      gsap.set(finaleWordmarkRef.current, { opacity: 0, y: 18, filter: "blur(6px)" });
    };

    const runFinaleSequence = (onDone: () => void) => {
      const tl = gsap.timeline({ delay: 0.9, onComplete: onDone });
      tl.to(camState.current, {
        x: FINALE_DEPARTURE.position[0],
        y: FINALE_DEPARTURE.position[1],
        z: FINALE_DEPARTURE.position[2],
        lx: FINALE_DEPARTURE.lookAt[0],
        ly: FINALE_DEPARTURE.lookAt[1],
        lz: FINALE_DEPARTURE.lookAt[2],
        fov: FINALE_DEPARTURE.fov,
        duration: 2.2,
        ease: "power1.in",
      })
        .to(finaleFadeRef.current, { opacity: 1, duration: 0.9 }, "-=0.4")
        .to(finaleWordmarkRef.current, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.0 }, "-=0.2");
      finaleTimeline.current = tl;
    };

    const setSceneUI = (index: number, visible: boolean) => {
      if (index === 0) setHeroUI(visible);
      else if (index === ENGINE_SCENE) setPanelUI(visible);
      else if (index === FINALE_SCENE) {
        if (!visible) resetFinale();
      } else setCaptionUI(index, visible);
    };

    const goToScene = (target: number) => {
      if (transitioning.current) return;
      const from = sceneIndex.current;
      const clamped = THREE.MathUtils.clamp(target, 0, TOTAL_SCENES - 1);
      if (clamped === from) return;

      transitioning.current = true;
      playBlip();
      setSceneUI(from, false);
      // heroActive flips immediately when *leaving* the hero (so the scripted
      // path takes over camState right away, blending from wherever HeroRig's
      // live sync last left it) but only flips back *on arrival* when
      // *returning* to the hero - see the onComplete below.
      if (from === 0) {
        heroActive.current = false;
        setHeroLive(false);
      }

      const targetCam = flatten(SCENE_CAMERAS[clamped]);

      gsap.to(camState.current, {
        ...targetCam,
        duration: 1.3,
        ease: "power2.inOut",
        onComplete: () => {
          if (clamped === 0) {
            heroActive.current = true;
            setHeroLive(true);
          }
          if (clamped === FINALE_SCENE) {
            runFinaleSequence(() => {
              transitioning.current = false;
            });
          } else {
            transitioning.current = false;
          }
        },
      });

      sceneIndex.current = clamped;
      setSceneUI(clamped, true);
    };

    let touchStartY = 0;
    let touchConsumed = false;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (transitioning.current || Math.abs(e.deltaY) < 2) return;
      goToScene(sceneIndex.current + (e.deltaY > 0 ? 1 : -1));
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
      touchConsumed = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (touchConsumed || transitioning.current) return;
      const dy = touchStartY - (e.touches[0]?.clientY ?? touchStartY);
      if (Math.abs(dy) > 40) {
        touchConsumed = true;
        goToScene(sceneIndex.current + (dy > 0 ? 1 : -1));
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (transitioning.current) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") goToScene(sceneIndex.current + 1);
      if (e.key === "ArrowUp" || e.key === "PageUp") goToScene(sceneIndex.current - 1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      gsap.killTweensOf(camState.current);
      finaleTimeline.current?.kill();
      if (engineAudio.current) {
        engineAudio.current.pause();
        engineAudio.current.src = "";
      }
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <Canvas dpr={1} gl={{ antialias: false, powerPreference: "high-performance" }}>
        <fog attach="fog" args={["#0a0c10", 14, 32]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 4]} intensity={2.6} color="#fff4e0" />
        <directionalLight position={[-5, 2, -4]} intensity={0.9} color="#4a6fff" />
        <directionalLight position={[0, 3, -6]} intensity={0.6} color="#ffffff" />
        <Environment preset="night" environmentIntensity={0.75} />

        <GradientBackdrop />
        <CameraRig heroActive={heroActive} camState={camState} />
        <HeroRig heroActive={heroActive} live={heroLive} controlsRef={heroControls} camState={camState} />
        <HeadTailLights sceneIndex={sceneIndex} handles={carHandles} />
        <WheelAndDrivetrain sceneIndex={sceneIndex} handles={carHandles} pulseMesh={pulseMesh} pulseMaterial={pulseMaterial} />

        <Car
          onReady={(h) => {
            carHandles.current = h;
          }}
        />

        <StudioFloor />
        <ContactShadows frames={1} position={[0, 0.001, 0]} opacity={0.7} scale={14} blur={2.4} far={4} />

        <EffectComposer>
          <Bloom luminanceThreshold={0.55} intensity={0.7} mipmapBlur radius={0.5} />
          <Vignette eskil={false} offset={0.15} darkness={0.7} />
        </EffectComposer>
      </Canvas>

      {/* Persistent vignette for cinematic framing */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.5) 100%)" }}
      />

      <SoundToggleButton muted={muted} onToggle={() => setMuted((m) => !m)} />
      <LoadingOverlay ready={ready} />

      {/* Scene 0: hero wordmark + hint */}
      <div ref={heroWordmarkRef} className="pointer-events-none absolute inset-x-0 top-[7%] flex flex-col items-center gap-3 opacity-0">
        <span className="text-4xl sm:text-6xl text-white tracking-[0.08em] font-[family-name:var(--font-display)] font-extrabold" style={TEXT_GLOW}>
          BMW M4
        </span>
        <span className="text-xs sm:text-sm tracking-[0.55em] text-white/85 uppercase" style={TEXT_GLOW}>
          Competition · M xDrive
        </span>
        <span className="flex h-[3px] w-16 overflow-hidden rounded-full" style={{ boxShadow: "0 0 12px rgba(0,0,0,0.6)" }}>
          <span className="flex-1 bg-[#1b4fd6]" />
          <span className="flex-1 bg-[#5c3fd6]" />
          <span className="flex-1 bg-[#d61f36]" />
        </span>
      </div>
      <div ref={heroHintRef} className="pointer-events-none absolute inset-x-0 bottom-[8%] flex flex-col items-center opacity-0">
        <span className="text-[10px] tracking-[0.5em] text-white/90 uppercase" style={TEXT_GLOW}>
          Drag to explore — scroll for the full story
        </span>
      </div>

      {/* Scenes 1,2,3,4 (generic captions, bottom-center) */}
      {SCENE_CONTENT.map((c, i) =>
        i === ENGINE_SCENE - 1 ? null : (
          <div
            key={i}
            ref={(el) => {
              captionRefs.current[i] = el;
            }}
            className="pointer-events-none absolute inset-x-0 bottom-[13%] flex flex-col items-center gap-3 px-6 text-center opacity-0"
          >
            {c.eyebrow && (
              <span className="text-[10px] tracking-[0.5em] text-white/70 uppercase" style={TEXT_GLOW}>
                {c.eyebrow}
              </span>
            )}
            <h2 className="font-[family-name:var(--font-display)] font-semibold text-2xl sm:text-4xl text-white tracking-wide" style={TEXT_GLOW}>
              {c.title}
            </h2>
            {c.body && (
              <p className="max-w-md text-sm sm:text-base text-white/85 font-light" style={TEXT_GLOW}>
                {c.body}
              </p>
            )}
          </div>
        )
      )}

      {/* Scene 6: engine / drivetrain - white data panel */}
      <div
        ref={panelRef}
        className="pointer-events-none absolute inset-y-0 right-0 w-full sm:w-[45%] flex flex-col justify-center gap-10 bg-white px-8 py-16 sm:px-14 opacity-0"
      >
        <div>
          <span className="text-[10px] tracking-[0.5em] text-black/50 uppercase">Under the skin</span>
          <h2 className="font-[family-name:var(--font-display)] font-semibold text-2xl sm:text-4xl text-black tracking-wide mt-3">
            The heart of the machine.
          </h2>
        </div>
        <div className="flex flex-col gap-7 sm:gap-8">
          {[
            { word: "Power", value: "503 HP" },
            { word: "Response", value: "0–100 km/h · 3.5s" },
            { word: "Control", value: "M xDrive AWD" },
            { word: "Precision", value: "250 km/h" },
          ].map((s, i) => (
            <div
              key={s.word}
              ref={(el) => {
                statRefs.current[i] = el;
              }}
              className="flex items-baseline justify-between gap-4 border-b border-black/15 pb-4 opacity-0"
            >
              <span className="text-xs sm:text-sm tracking-[0.5em] text-black/55 uppercase">{s.word}</span>
              <span className="text-2xl sm:text-4xl text-black tabular-nums font-medium text-right">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scene 8: finale fade + wordmark */}
      <div ref={finaleFadeRef} className="pointer-events-none absolute inset-0 bg-black opacity-0" />
      <div ref={finaleWordmarkRef} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-0">
        <span className="text-2xl sm:text-3xl text-white tracking-[0.15em] font-[family-name:var(--font-display)] font-medium" style={TEXT_GLOW}>
          BMW M4
        </span>
        <h2
          className="font-[family-name:var(--font-display)] font-light text-lg sm:text-2xl text-white/90 tracking-[0.25em] text-center px-6"
          style={TEXT_GLOW}
        >
          Performance, experienced differently.
        </h2>
      </div>
    </div>
  );
}
