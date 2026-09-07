"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  PerspectiveCamera,
} from "@react-three/drei";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { Car } from "./Car";

gsap.registerPlugin(ScrollTrigger);

const SCROLL_HEIGHT_VH = 400;

type ScrollState = { progress: number };

function Rig({ scroll }: { scroll: React.RefObject<ScrollState> }) {
  const carRef = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    const p = scroll.current.progress;

    // Act 2 "The machine": car spins a full turn as the user scrolls through this section
    const rotateP = THREE.MathUtils.clamp((p - 0.08) / 0.42, 0, 1);
    const revealP = THREE.MathUtils.clamp(p / 0.08, 0, 1);

    if (carRef.current) {
      carRef.current.rotation.y = rotateP * Math.PI * 2;
      const scale = THREE.MathUtils.lerp(0.9, 1, revealP);
      carRef.current.scale.setScalar(scale);
    }

    if (cameraRef.current) {
      cameraRef.current.position.z = THREE.MathUtils.lerp(11, 9, revealP);
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        fov={28}
        position={[0, 1.1, 11]}
      />
      <Car ref={carRef} position={[0, -0.75, 0]} />
    </>
  );
}

export default function Experience() {
  const scroll = useRef<ScrollState>({ progress: 0 });
  const taglineRef = useRef<HTMLDivElement>(null);
  const blackoutRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const applyProgress = (p: number) => {
      scroll.current.progress = p;

      // Act 1 "Arrival": tagline holds, then fades as the reveal begins
      const taglineOpacity = 1 - THREE.MathUtils.clamp(p / 0.05, 0, 1);
      const blackoutOpacity = 1 - THREE.MathUtils.clamp((p - 0.02) / 0.1, 0, 1);
      // Act 2 "The machine": stats fade in once the car is rotating
      const statsOpacity =
        THREE.MathUtils.clamp((p - 0.18) / 0.08, 0, 1) *
        (1 - THREE.MathUtils.clamp((p - 0.85) / 0.1, 0, 1));

      if (taglineRef.current) taglineRef.current.style.opacity = String(taglineOpacity);
      if (blackoutRef.current) blackoutRef.current.style.opacity = String(blackoutOpacity);
      if (statsRef.current) statsRef.current.style.opacity = String(statsOpacity);
    };

    // Set the correct initial (scroll = 0) state immediately, since
    // ScrollTrigger's onUpdate only fires once the user actually scrolls.
    applyProgress(0);

    const trigger = ScrollTrigger.create({
      trigger: "#scroll-root",
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => applyProgress(self.progress),
    });

    return () => trigger.kill();
  }, []);

  return (
    <div id="scroll-root" className="relative bg-black" style={{ height: `${SCROLL_HEIGHT_VH}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
          <color attach="background" args={["#000000"]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow />
          <directionalLight position={[-6, 3, -4]} intensity={0.6} color="#5588ff" />
          <Environment preset="city" />
          <Rig scroll={scroll} />
          <ContactShadows
            position={[0, -0.95, 0]}
            opacity={0.55}
            scale={12}
            blur={2.2}
            far={4}
          />
        </Canvas>

        {/* Fade-from-black overlay driving the silhouette emergence (masks the canvas only) */}
        <div
          ref={blackoutRef}
          className="pointer-events-none absolute inset-0 bg-black"
        />

        {/* Act 1: black reveal tagline (sits above the blackout so it's visible on pure black) */}
        <div
          ref={taglineRef}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
        >
          <span className="text-sm tracking-[0.5em] text-white/60 uppercase">
            Meridian
          </span>
          <h1 className="text-2xl sm:text-4xl font-light tracking-wide text-white">
            The future, engineered.
          </h1>
        </div>

        {/* Act 2: key numbers */}
        <div
          ref={statsRef}
          className="pointer-events-none absolute inset-x-0 bottom-16 flex items-center justify-center gap-10 sm:gap-20 opacity-0"
        >
          <Stat value="1,200" label="HP" />
          <Stat value="1.9s" label="0–100 km/h" />
          <Stat value="420" label="km/h Top Speed" />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-white">
      <span className="text-3xl sm:text-5xl font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] sm:text-xs tracking-[0.2em] text-white/60 uppercase mt-1">
        {label}
      </span>
    </div>
  );
}
