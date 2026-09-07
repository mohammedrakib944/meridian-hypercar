// Camera data for the discrete scene sequence. Authored in the model's real
// coordinate space (Three.js / glTF, Y-up), derived from the actual exported
// car geometry:
//   width (X):  -1.05 .. 1.05
//   height (Y):  0 .. 1.46
//   length (Z): -2.52 (rear) .. 2.31 (front)

export type SceneCam = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
};

// Scene 0 "Full car reveal" - the hero shot. Free auto-rotate + drag own the
// camera here; this is only the reference framing OrbitControls starts from
// and the target the hero->scene-1 transition blends away from.
// fov must match R3F's implicit default camera fov (75) - this is also the
// very first frame ever rendered (before any scripted camera code has run),
// so the two must agree or returning to the hero after leaving it will look
// suddenly zoomed in compared to first load.
export const FULL_CAR_VIEW: SceneCam = {
  position: [2.5, 0.9, 2.85],
  lookAt: [0, 0.45, 0],
  fov: 75,
};

// Scenes 1-8, each a single fixed, composed shot (index 0 is the hero above).
export const SCENE_CAMERAS: SceneCam[] = [
  FULL_CAR_VIEW,
  { position: [1.8, 0.55, 1.75], lookAt: [0.86, 0.35, 1.44], fov: 18 }, // 1: front wheel / brake
  { position: [5.4, 1.0, 0.2], lookAt: [0, 0.6, 0], fov: 29 }, // 2: door / side body
  { position: [0, 0.9, -4.3], lookAt: [0, 0.65, -1.6], fov: 27 }, // 3: rear / taillight
  { position: [1.3, 1.05, 0.35], lookAt: [0.2, 0.9, 0], fov: 30 }, // 4: interior
  { position: [0.15, 1.0, -0.05], lookAt: [0.38, 0.93, 0.26], fov: 38 }, // 5: dashboard / steering
  { position: [-7.5, 1.7, 3.8], lookAt: [1.6, 0.4, 0.3], fov: 34 }, // 6: engine / drivetrain
  { position: [0, 0.85, 5.6], lookAt: [0, 0.6, 0], fov: 26 }, // 7: full-car performance
  { position: [0, 0.75, -4.8], lookAt: [0, 0.55, -1.6], fov: 30 }, // 8: final cinematic (start; auto-continues)
];

// Where the scene 8 auto-sequence (accelerate away) ends up, right before fade to black.
export const FINALE_DEPARTURE: SceneCam = {
  position: [0, 0.7, -8.5],
  lookAt: [0, 0.5, -5],
  fov: 34,
};
