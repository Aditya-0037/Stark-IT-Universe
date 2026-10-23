# Smoothness pass: diagnosis and fixes

Versions checked in package.json: gsap 3.15.0 (ScrollTrigger, Observer), lenis 1.3.27,
@react-three/fiber 8.18.0, @react-three/drei 9.122.0, three 0.170.0, react 18.3.1.

## Step 1: diagnosis (before), 1920 × 994

### Scroll triggers

| Trigger | Start / end | Pin | Scrub | Snap | Scroll distance |
| --- | --- | --- | --- | --- | --- |
| `#proof` ghost numbers (2 tweens) | top bottom / bottom top | no | `true` | no | 3077 px |
| `.projects` cards (3 tweens) | top bottom / bottom top | no | `true` | no | ≈ 2400 px |
| The story scenes | none: pinned with CSS `position: sticky` inside sections sized by `--budget` | sticky | none (a damped playhead reads scrollY) | Lenis snap to the nearest hold 180 ms after input stops | see below |

### Scenes (FULL, pinned with sticky)

| Scene | Section height | Pinned range | Holds (scrollY) |
| --- | --- | --- | --- |
| space (hero) | 994 px (100vh) | not pinned | 0 |
| planets | 5169 px (520vh) | 4175 px | 1412, 2247, 3082, 3917, 4752 |
| route | 4175 px (420vh) | 3181 px | 6481, 7117, 7753, 8390, 9026 |
| descent | 2982 px (300vh) | 1988 px | 11690 |
| classroom | 3380 px (340vh) | 2386 px | 13559, 14036, 14513, 14990, 15467 |
| switch-on | 1988 px (200vh) | 994 px | 17196 |

The whole story is 17 196 px (17.3 screens) for 19 steps.

### Steps: scroll needed and dead scroll (nothing on screen changes)

| Step | Scroll px | Dead | Where the dead scroll is |
| --- | --- | --- | --- |
| hero → planet 1 | 1412 | 30 % | first 10 % of the planets pin (the dwell curve holds planet 1) |
| planet n → n+1 (×4) | 835 | 55 % | the dwell curve rests on each planet for 55 % of its slot |
| planet 5 → station 1 | 1729 | 43 % | end of the planets pin + start of the route pin |
| station n → n+1 (×4) | 636 | 55 % | dwell; the camera is still, the satellite moves 45 % of the slot |
| station 5 → campus | 2664 | 49 % | end of route pin + the whole descent section scrolling in (descent = 0 for 994 px) |
| campus → device 1 | 1869 | 13 % | start of the classroom pin |
| device n → n+1 (×4) | 477 | 55 % | dwell |
| device 5 → switch on | 1729 | 43 % | end of the classroom pin + the first half of the switch-on pin |

### Double smoothing

Three layers act on the same progress value:
1. Lenis (lerp 0.11, wheelMultiplier 0.9);
2. a damped playhead in `useFrame` (0.34 per frame while scrolling, 0.075 once stopped);
3. the dwell curve and `ease()` inside the camera moves.

The route satellite also has its own damping (6/s), and the snap animation runs on top of all of it. Together they feel stuck, then the move lurches forward.

### Animation loops

There are two continuous loops: GSAP's ticker (Lenis and the scroll driver) and React Three Fiber's own requestAnimationFrame loop.

On top of those, up to six rAF callbacks are scheduled on every scroll event: useStickyProgress ×3, useRegionNeeds, useScrollSpy and the cursor.

### Long frames (Chrome trace while scrolling slowly down the story)

See `before.png`. Tracing itself slows the page, so the baseline is 33 ms there. The spikes are what matters.

| Where | Frames | Cause |
| --- | --- | --- |
| Planets pin starts (y≈1029) | 866 ms | GPU stall with the main thread idle: first draw of the classroom, warmed in idle time (ANGLE compiles D3D shaders at first draw) |
| Route scene scrolls in (y≈5650–5760) | 525 ms compile + 483 ms JS | the campus chunk arrives: shader precompile blocks on link status; the campus is built in idle slices, some of them 180–480 ms (ground, town, contact canvas, cloud texture) |
| Route pin (y≈6230–6430) | 13 frames of 80–600 ms | the rest of the campus build and upload while scrolling |
| Cloud swap (y≈11000–11220) | 66 ms compile, then 25 frames of 80–117 ms | first draw of the campus behind the clouds (shadow map, programs), cloud overdraw |
| Beam appears (y≈11500) | 150 ms | its shader compiles at first use (it was invisible during the precompile) |
| Room entry (y≈13280–13340) | 84–217 ms | style/layout at the pin boundary + first room shadow-map render |
| Classroom and switch on | 9 frames of 150–380 ms | GPU stalls: region re-entry warm draws (GPU parking frees and re-uploads regions) |
| Every pin boundary | 10–26 ms style/layout | text-zone rects read every frame while the copy opacity changes |

In total: 393 frames over 50 ms, 43 over 100 ms, a worst frame of 866 ms, and 46 React commits during one slow run.

### CSS

- `html { scroll-behavior: smooth }`. Lenis overrides it while running, but it applies before Lenis starts and to instant jumps.
- `scroll-snap-type: x mandatory` only on the LITE swipe deck (a horizontal carousel, not page scroll).
- `backdrop-filter` blur on the header pill (1320 × 64), the section index and the Proof glass cards.
- No `top`/`height` transitions. The overlays already animate opacity and transform only.

## Step 2: the step controller

`src/story/steps.ts` is the table: 20 steps (hero, planets 1–5, stations 1–5, the dive, the campus, the window, devices 1–5, Switch on), each with id, label, scene, duration, ease and overlay. Durations: 1.0–1.2 s for small moves inside a scene (stations, devices), 1.4 s for planets and Switch on, 1.6 s into a new scene, 2.0–2.2 s for the dive, the campus and the window. Every move uses `power2.inOut` and ends exactly on its resting frame. There are no holds: each step is one screen of scroll (the story is 19 screens), so the scroll position stays the single source of truth.

- Input: GSAP Observer (wheel, touch) with `preventDefault`, plus keys. Lenis is the only smoothing layer (`lerp 0.1`, wheel and touch multipliers 1, `syncTouch: false`), driven by GSAP's ticker.
- Gating: input is ignored until the move is 75 % done; then one gesture in the same direction queues one move (at most one); a gesture the other way reverses the move from where it is; input is ignored for 200 ms after a move lands.
- Trackpads: a new gesture needs 150 ms without wheel events, or a sharp rise in the deltas after they had decayed (Lethargy-style), using the events' own time stamps.
- Touch: 50 px of mostly vertical travel is one step. No rubber band (`overscroll-behavior-y: none` while the story has control).
- Edges: at the last step a forward gesture releases into Build (0.9 s ease-out); scrolling up from Build re-enters at the last step.
- Overlays fade in over 400 ms when a step lands; the per-step card fades out when a move starts.
- Fast travel (nav links, Home/End, jumps of more than one step): at most 1 s, behind a 250 ms crossfade.
- Scrollbar drags settle on the nearest step within 0.6 s. `history.scrollRestoration = 'manual'`; a reload lands on the nearest resting step.

## Step 3: hitches and fixes

Each item from the Step 1 list, plus the ones found while fixing them.

| Hitch (before) | Cause | Fix | After |
| --- | --- | --- | --- |
| 866 ms when the planets pin starts | first draw of the classroom, warmed in idle time while scrolling | every region stays resident and is drawn once offscreen, with everything in it shown, before the first move (`Park.tsx`); the first move waits for it (`prewarm` in `stage.ts`) | gone |
| 525 ms compile + 483 ms JS as the route scrolls in | the campus chunk arrived and was built while scrolling | campus loaded and built in idle slices while the hero is on screen; shader link status not read synchronously (`checkShaderErrors` off outside debug) | gone |
| 13 frames of 80–600 ms in the route pin | campus uploads while scrolling | as above | gone |
| Cloud swap: 66 ms compile, then 25 frames of 80–117 ms | first draw of the campus behind the clouds; shadow map rendered on entry | clouds always mounted; the campus warm draw shows every part (veil, beam, clouds); shadow maps rendered once during the warm-up and never again | gone |
| 150 ms when the beam appears | its shader compiled at first use | drawn in the warm-up | gone |
| 84–217 ms at room entry | style/layout at the pin boundary + room shadow map on entry | static shadow map rendered once at load; text zones measured once after a step lands (not every frame) | gone |
| 150–380 ms in the classroom and Switch on | GPU parking freed regions and re-uploaded them | parking removed: all regions resident | gone |
| 10–26 ms style/layout at every pin boundary | text-zone rects read every frame | read once, 450 ms after a step lands | gone |
| 383–467 ms just after landing on planet 1 | Chrome compiling GPU raster shaders the first time it drew the planets text and card | every scene's text drawn once at 0.4 % opacity, moved into view, before the first move (`warmText` in `scrollDriver.ts`) | gone |
| 167–200 ms landing on planet 5 | first draw of the fifth card's art | all five service cards drawn in the warm-up, not only the current one | gone |
| 338 ms when Proof first scrolls in; 20–78 ms compiles and one 176 ms compositor first-draw in Build | Chrome compiling GPU shaders the first time it draws them | tried: inert copies of these sections drawn in advance at 0.4 %. Removed again: it held the hero at about 8 fps for a second right after loading, which is worse than a one-time stall in normal scrolling | **open** (once per visit, see below) |
| Forced layout every frame | `window.scrollY` read in the 3D loop; ScrollTrigger reading `pageYOffset` on every scroll | the 3D reads Lenis's value; Proof's parallax is played from the frame loop against positions measured once (ScrollTrigger removed) | gone |
| 46 React commits in one slow run | sticky-progress hooks and per-frame state | story state changes only when a move starts and lands (`src/story/store.ts`); scroll spy at most every 120 ms | 0 commits while a move plays |
| Triple smoothing | Lenis + damped playhead + dwell curve | Lenis only; camera mixes follow the step progress exactly | — |
| Two loops + up to six rAF callbacks per scroll event | R3F's own loop, sticky-progress hooks | one loop: GSAP's ticker drives Lenis and the 3D (`frameloop="never"`) | — |
| Phones (LITE): 20 fps median with the CPU slowed 4× | the SVG emblem's orbits are animated inside the SVG, which Chrome redraws on the main thread every frame, even off screen; the 2D classroom illustration mounted in the middle of a scroll | emblem paused while off screen; the illustration mounts in idle time a few seconds after load (React renders it in slices) | 60 fps median |
| CSS | `scroll-behavior: smooth` on html | removed; Lenis's CSS updated to 1.3.27 | — |

The warm-up costs no load time in the end. The text warm-up runs after the 3D regions are warm (0.25–0.55 s), so the two never compete for the GPU. The story is ready about 3 s after navigation on a warm cache (7.7 s on a cold first visit on this laptop). A gesture made before that plays as soon as the story is ready.

### After (`after.png`)

The same story with a Chrome trace running, travelled one wheel notch per step, down to Build and back up: 6008 frames, median 16.7 ms, p95 16.8 ms, worst 50 ms, 1 frame over 50 ms, none over 100 ms, 59.8 fps on average. React committed 60 times: 3 per step, when a move starts and when it lands, never during a move.

Before (`before.png`): median 32.9 ms, p95 50.2 ms, worst 866 ms, 393 frames over 50 ms, 43 over 100 ms.

The "before" run used a slow continuous wheel (14 px every 30 ms). With the step controller that stream never pauses, so it is one gesture and plays one move, as the brief asks. That is why the "after" chart uses one notch per step.

The numbers on this laptop vary a lot from run to run, because other apps share its integrated GPU. The same build gave the clean run above, a run locked at 30 fps (median 33 ms, nothing over 100 ms), and a 60 fps run with a few 100–970 ms GPU stalls.

## Step 4: devices and modes

| Check | Setup | Result |
| --- | --- | --- |
| Tablet touch, swipe per step | 1024 × 768, touch, FULL forced at 1× pixel density (at 2× this laptop's GPU drops it to LITE through the existing frame-rate check) | 8 / 8 swipes moved exactly one step (6 forward, 2 back) |
| Tablet, normal CPU | same | median 16.7 ms (60 fps), mean 58 fps, worst 100 ms |
| Tablet, CPU slowed 4× | same | **fails**: median 33 ms (30 fps), frames over 100 ms. The 3D costs about 5 ms of script per frame on this CPU, so about 20 ms when slowed 4× |
| Phone, CPU slowed 4× | 390 × 844 at 3×, auto tier = LITE (phones under 768 px get LITE by the brief's tier rule, so phones have no 3D story and no step control: native scrolling) | median 16.7 ms (60 fps, was 20 fps); **fails** "no frame over 100 ms": 17–22 frames of 100–567 ms per run, from paint and hit-testing at 3× density |
| Reduce Motion | `prefers-reduced-motion: reduce` | auto tier = LITE (brief rule). FULL forced: no scroll control, no Lenis, native scrolling, text crossfades 0.3 s |
| LITE | any | works: normal scrolling 2D scenes. The step controller drives the 3D moves, so LITE has no steps |
| Build / Proof / Quote | FULL | Lenis smooth scrolling (lerp 0.1, multipliers 1); Proof parallax unchanged |
| Draw calls | FULL, 1920 × 994 | 29–91 per frame at the resting steps (most 40–75); 123 during the window approach |

## Done-when tests (this laptop: Intel UHD Graphics, i7-13620H, Chrome, 1920 × 994)

Tests 1–9 are automated (`story-test.mjs`, kept outside the repo) and were run five times on the last two builds. Every check passed in three runs. In the other two, one check failed each time (test 5 once, test 2b once), both while the laptop was overloaded (it had just run out of process slots). The test sends synthetic wheel events from a script, and under load their timing slips: a swipe's tail arrives with a long gap and counts as a second swipe. Real trackpad events carry the system's own time stamps.

| # | Test | Result |
| --- | --- | --- |
| 1 | One wheel notch = one full move, settles on the resting frame | PASS |
| 2 | Trackpad swipe with a long inertia tail = one step (gentle and hard) | PASS |
| 3 | 10 notches in 1 s = at most 2 steps | PASS (2) |
| 4 | Scrolling up plays the moves back | PASS |
| 5 | Opposite input mid-move reverses smoothly | PASS |
| 6 | Arrow keys, Space, Page Up / Down | PASS |
| 7 | Last step → Build; back up re-enters at the last step | PASS |
| 8 | Nav link travels in ≤ 1 s | PASS (101–106 ms) |
| 9 | Reload restores to the nearest resting step | PASS |
| 10 | HUD ">50 ms" counter stays 0 for a full run down and up; FPS ≥ 55 during transitions | **FAIL on this laptop**. Best run: 1 frame at 50.1 ms (none longer), 59.8 fps. Other runs: 13–20 frames over 50 ms, and in one run a few GPU stalls of 100–970 ms; some runs locked at 30 fps |
| 11 | Phone / 4× CPU: one swipe one step, no frame over 100 ms, median ≥ 40 fps | one swipe = one step PASS; median PASS on phones (60 fps, LITE); **FAIL** on frames over 100 ms (phones) and on the FULL tablet at 4× (30 fps) |

Why test 10 fails here: the remaining long frames are GPU-bound (the main thread is busy only 4–15 ms in them). On this integrated GPU one 3D frame costs about 17–25 ms at 1920 × 994: 4× MSAA, bloom on the half-float buffer and, at the campus, ambient occlusion. Frames that miss two screen refreshes show as 50 ms. Measured at the resting steps, a frame is 4–5 ms faster without MSAA and 16.6 ms (60 fps) without any post-processing; 2× MSAA saves only about 1.5 ms. Each of these changes the look, which this pass may not do, so they are left for the owner to decide:

1. 2× MSAA instead of 4× (smallest visual change, small gain);
2. a lower render scale on slow GPUs, chosen once at rest before the first move (slightly softer 3D on those machines only);
3. no MSAA, with a cheaper edge filter.

Test 10 has to be read on the owner's machine with `?debug=1`. This laptop's results also swing from run to run (other apps, GPU clocks): the same code gave a 16.7 ms median in one run and 33 ms in the next.

## Still open

- GPU-bound 50–70 ms frames on integrated graphics (above).
- The first time Build, Proof and Quote scroll into view, Chrome compiles GPU shaders for them: one-time stalls of 100–340 ms on this laptop (one 805 ms in Quote in one run). Drawing them in advance was tried and removed (see Step 3).
- On a cold first visit, the story's first move can wait up to ~8 s (13 s in one run) while the 3D warms up; a second visit is ready in about 3 s.
- drei's `<Clouds>` updates every puff each frame even while hidden (about 0.5 ms per frame); it has no pause option without patching the library.
- The FULL tablet at 4× CPU, and phone frames over 100 ms (Step 4).
- The recording (`recording.mp4`) was captured from headless Chrome's screencast, which delivers about 10 frames per second at 1920 × 994. It shows the behaviour and the HUD numbers, not the smoothness itself. For a 60 fps recording, use Win + Alt + R (Xbox Game Bar) on the owner's machine with `?debug=1`.

## Confirmation

No model, material, light, camera path, colour or art direction was changed in this pass. The camera's keyframes and paths are the same; only their timing changed (each move now follows its step's eased scroll animation exactly, instead of a dwell curve and a second ease).
