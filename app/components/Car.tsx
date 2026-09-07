"use client";

import { forwardRef } from "react";
import { useGLTF } from "@react-three/drei";
import type { Group } from "three";
import type { ComponentProps } from "react";

const MODEL_URL = "/models/bmw-m4-prototype.glb";

export const Car = forwardRef<Group, ComponentProps<"group">>(
  function Car(props, ref) {
    const { scene } = useGLTF(MODEL_URL);
    return <primitive ref={ref} object={scene} {...props} />;
  }
);

useGLTF.preload(MODEL_URL);
