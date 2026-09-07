# Cinematic Scene-Snap Camera System

How this site's scroll experience works, and a ready-to-use prompt for
rebuilding the same pattern against a different 3D model / project.

This is **not** an infinite smooth-scroll camera path. It's a fixed set of
directed "shots" (like a storyboard) that the viewer snaps between one at a
time, wheel-tick by wheel-tick, with text, camera, and lighting always
arriving together.

## The core idea

Traditional scroll-driven 3D sites tie camera position to scroll *distance*
(e.g. via ScrollTrigger `scrub`), which tends to feel mushy and makes it easy
for the camera to end up somewhere the copy doesn't match ("text describes
the wheel while the camera shows the door"). This system throws that model
out entirely:

- Scroll/swipe/keyboard input is **hijacked** (`preventDefault`) and treated
  as discrete "next / previous" ticks, like a slide deck — not a scrollbar.
- Each tick tweens a **single shared camera-state object** from wherever it
  currently is to a **hand-authored fixed shot**, over a fixed duration.
- Text for a shot is choreographed relative to that *same* tween, not to
  scroll position, so it can never desync from the camera.
- A boolean lock blocks new input until the current tween (and any
  scene-specific sequence chained after it) has fully finished.

## Architecture

### 1. Author the shots as data, not code

```ts
// cameraPath.ts
export type SceneCam = { position: [number,number,number]; lookAt: [number,number,number]; fov: number };

export const SCENE_CAMERAS: SceneCam[] = [
  HERO_VIEW,                 // 0: establishing shot
  { position: [...], lookAt: [...], fov: 18 },  // 1: detail shot
  { position: [...], lookAt: [...], fov: 29 },  // 2: ...
  // ... 8-10 total is the sweet spot. Fewer feels thin, more dilutes focus.
];
```

Pick real coordinates from the model's actual bounding box (ask Blender /
your DCC tool for it, or `console.log` the loaded mesh bounds) — don't guess.
Each entry is a *directed* shot: something specific the shot exists to show
(a wheel, a badge, the interior), not an arbitrary waypoint along a path.

### 2. One mutable "flattened" camera-state object, tweened by GSAP

```ts
type FlatCam = { x:number; y:number; z:number; lx:number; ly:number; lz:number; fov:number };
const camState = useRef<FlatCam>(flatten(SCENE_CAMERAS[0]));
```

GSAP tweens plain object properties well but doesn't tween `THREE.Vector3` /
array tuples cleanly — flatten to numbers first. A `useFrame` reads this
object every render frame and applies it to the real camera:

```ts
useFrame(() => {
  if (heroActive.current) return; // see "ownership handoff" below
  camera.position.set(c.x, c.y, c.z);
  camera.lookAt(c.lx, c.ly, c.lz);
  camera.fov = c.fov; camera.updateProjectionMatrix();
});
```

### 3. The transition function — this is the whole system

```ts
function goToScene(target: number) {
  if (transitioning.current) return;        // lock: ignore input mid-flight
  const clamped = clamp(target, 0, TOTAL - 1);
  if (clamped === sceneIndex.current) return;

  transitioning.current = true;
  playSound();
  setSceneUI(sceneIndex.current, false);      // fade OUT current caption now
  gsap.to(camState.current, {
    ...flatten(SCENE_CAMERAS[clamped]),
    duration: 1.3,
    ease: "power2.inOut",
    onComplete: () => { transitioning.current = false; },
  });
  sceneIndex.current = clamped;
  setSceneUI(clamped, true);                  // fade IN next caption, DELAYED
}
```

The trick that keeps text and camera glued together: the outgoing caption
fades fast and **immediately** (before the camera has visibly moved far),
while the incoming caption's GSAP tween carries its own `delay` timed to land
near the *end* of the 1.3s camera tween, not the start. Same idea for a
finale sequence, a stat panel's staggered reveal, etc. — anything that must
feel "arrived" waits until the camera basically has.

### 4. Hijack input as discrete ticks, not scroll position

```ts
window.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (transitioning.current || Math.abs(e.deltaY) < 2) return;
  goToScene(sceneIndex.current + (e.deltaY > 0 ? 1 : -1));
}, { passive: false });
// + touchstart/touchmove with a ~40px drag threshold and a "consumed" flag
//   per gesture, + ArrowUp/ArrowDown/PageUp/PageDown/Space on keydown.
```

No scroll container, no `scrollHeight` math, no `IntersectionObserver`. The
page is just `h-screen overflow-hidden` — there's nothing to actually scroll.

### 5. Ownership handoff for a "free-look" first scene

If shot 0 is a free-orbiting hero view (`OrbitControls` with `autoRotate` and
drag), it needs to hand off to the scripted system without a visual snap:

- A `heroActive` ref says who currently owns the camera.
- While active, a small rig **continuously mirrors the live camera
  position/target into `camState`** every frame — so the moment control
  hands off, the first scripted tween blends from wherever the user's last
  drag/auto-rotate actually left the camera, never from a stale fixed point.
- `heroActive` flips to `false` the instant the user leaves shot 0 (so the
  scripted path takes over immediately), but only flips back to `true` on
  *arrival* back at shot 0 (in the tween's `onComplete`) — never mid-flight.
- **Fully unmount** `<OrbitControls>` (don't just set `enabled={false}`)
  whenever it doesn't own the camera. `OrbitControls.update()` runs every
  frame regardless of `enabled`, and if `autoRotate` is on it will keep
  quietly rotating the camera around its own fixed target every frame,
  fighting whatever the scripted rig just set. Disabling isn't enough —
  unmount it.
- Match the free-look camera's `fov` to whatever your 3D framework's actual
  default camera fov is (e.g. **75** for `@react-three/fiber`'s implicit
  default), and use that *same* number as shot 0's authored fov. If they
  differ, first load and "scroll back to the start" will look like two
  different framings even though both claim to be "the hero shot."

### 6. Loading screen gated on real asset progress

Use your 3D library's global loading-progress hook (`useProgress` in `drei`)
rather than a fixed timer, and gate the hero's reveal animation on it too —
otherwise the intro animation can start playing before the model has
actually streamed in.

```ts
const { active, progress } = useProgress();
const ready = !active && progress >= 100;
useEffect(() => { if (ready) revealHeroUI(); }, [ready]);
```

### 7. One-shot sound per tick, not a scroll-scrubbed sound

If you want an engine-rev/UI blip per scene change: restart the clip from
frame zero and let it play through naturally on every tick
(`pause(); currentTime = 0; play()`), rather than tying its volume/pitch to
scroll velocity — that reads as "broken" far more often than it reads as
responsive. Gate it behind a single `mutedRef` boolean and give the user a
visible mute toggle.

## Gotchas worth knowing up front

- **The transitioning lock must span the *entire* sequence**, including any
  chained finale/reveal sequence fired from a tween's `onComplete` — not
  just the camera tween itself. Otherwise a second input mid-finale can
  start a competing tween.
- **`OrbitControls` target mismatch**: if you keep an orbit rig mounted
  during scripted scenes "just in case," its fixed `target` prop doesn't
  match the scripted shot's `lookAt` — see point 5.
- **FOV parity between "implicit first frame" and "authored hero shot"** —
  see point 5. This is the single easiest thing to get subtly wrong, because
  the bug only shows up the *second* time the user reaches that scene, never
  on first load.
- Author shot count as "however many distinct things are worth a dedicated
  shot," typically 8-10. Resist the urge to interpolate extra in-between
  shots — the snap *is* the feature.

## Reusable prompt

Copy-paste this (swap in your own model/subject and shot list) to have an
AI coding assistant rebuild this pattern from scratch on a new project:

> Build a scroll-driven 3D showcase using React Three Fiber + GSAP with a
> **discrete scene-snap** camera system, not a continuous scroll-scrubbed
> camera path. Requirements:
>
> 1. Divide the experience into 8-10 fixed, hand-composed camera shots
>    (position + lookAt + fov), each showing one specific thing worth
>    focusing on (list them out).
> 2. Hijack wheel/touch/keyboard input as discrete "advance one scene"
>    ticks (`preventDefault`, no real scrollbar, no scroll container) —
>    one gesture = exactly one scene jump, snapping the camera and its
>    caption together.
> 3. Use a single flattened, GSAP-tweenable camera-state object driving the
>    real camera every frame; a boolean "transitioning" lock blocks new
>    input until the current transition (and anything chained after it)
>    fully completes.
> 4. Outgoing captions fade out immediately when a transition starts;
>    incoming captions fade in with a delay timed to land near the *end*
>    of the camera's transition, so text and camera framing are always in
>    sync — never showing text for a shot the camera hasn't reached yet.
> 5. Scene 0 (or whichever shot is the "hero") should support free
>    orbit/drag instead of being fixed; hand off between free-look and
>    scripted control by continuously mirroring the live camera pose into
>    the shared camera-state while free-look owns it, and fully *unmount*
>    the orbit-control component (not just disable it) whenever a scripted
>    shot owns the camera.
> 6. Make the free-look shot's authored fov exactly match the 3D
>    framework's default camera fov, so the very first frame (before any
>    scripted code runs) and any later return to that shot look identical.
> 7. Gate the hero reveal animation and show a branded loading screen keyed
>    to the real asset-loading progress (not a fixed timer).
> 8. If including a sound effect per scene change, restart it from frame
>    zero and let it play naturally each tick, with a visible mute toggle.
>
> Ask me for the actual camera coordinates / shot list and copy for each
> scene before writing the final version — don't invent product copy.
