"use client";

import { forwardRef, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ComponentProps } from "react";

const MODEL_URL = "/models/bmw-m4-prototype.glb";

const WHEEL_NAMES = [
  "M4_2024_wheels_m_black",
  "M4_2024_wheels_m_black.001",
  "M4_2024_wheels_m_black.002",
  "M4_2024_wheels_m_black.003",
];

const HEADLIGHT_BEAM_MESH_NAMES = [
  "M4_2024_headlight_L_M4_2024_lowhighbeam_0",
  "M4_2024_headlight_R_M4_2024_lowhighbeam_0",
];

const TAILLIGHT_MESH_NAMES = [
  "M4_2024_taillight_L_M4_2024_LS5_0",
  "M4_2024_taillight_R_M4_2024_RS3_0",
];

export type CarHandles = {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  headlightMaterials: THREE.MeshStandardMaterial[];
  taillightMaterials: THREE.MeshStandardMaterial[];
};

function cloneMaterialForMesh(name: string, scene: THREE.Object3D) {
  const obj = scene.getObjectByName(name) as THREE.Mesh | undefined;
  if (!obj || !(obj.material instanceof THREE.MeshStandardMaterial)) return null;
  const cloned = obj.material.clone();
  obj.material = cloned;
  return cloned;
}

export const Car = forwardRef<
  THREE.Group,
  ComponentProps<"group"> & { onReady?: (handles: CarHandles) => void }
>(function Car({ onReady, ...props }, ref) {
  const { scene } = useGLTF(MODEL_URL);

  // Clone once per loaded scene so headlight/taillight glow never bleeds into
  // the other ~95 meshes sharing the same base materials.
  const handles = useMemo<CarHandles>(() => {
    const wheels = WHEEL_NAMES.map((n) => scene.getObjectByName(n)).filter(
      (o): o is THREE.Object3D => !!o
    );
    const headlightMaterials = HEADLIGHT_BEAM_MESH_NAMES.map((n) =>
      cloneMaterialForMesh(n, scene)
    ).filter((m): m is THREE.MeshStandardMaterial => !!m);
    const taillightMaterials = TAILLIGHT_MESH_NAMES.map((n) =>
      cloneMaterialForMesh(n, scene)
    ).filter((m): m is THREE.MeshStandardMaterial => !!m);

    headlightMaterials.forEach((m) => {
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveIntensity = 0;
      m.toneMapped = false;
    });
    taillightMaterials.forEach((m) => {
      m.emissive = new THREE.Color(0xff0000);
      m.emissiveIntensity = 0;
      m.toneMapped = false;
    });

    return { root: scene as unknown as THREE.Group, wheels, headlightMaterials, taillightMaterials };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    onReady?.(handles);
  }, [handles, onReady]);

  return <primitive ref={ref} object={scene} {...props} />;
});

useGLTF.preload(MODEL_URL);
