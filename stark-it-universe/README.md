# Stark IT Universe: website

A prerendered React website with the original interactive homepage and 23 supporting pages for services, AMC, school buying guides, solutions, locations, contact and website policies. Every production page has its own HTML, metadata and structured data. The enquiry form prepares a WhatsApp or email draft for the visitor to review and send; it has no website lead database.

The search-visibility implementation and remaining business inputs are documented in [docs/SEO_IMPLEMENTATION.md](docs/SEO_IMPLEMENTATION.md). The older stage notes below describe the existing 3D journey; the new document pages do not require the 3D layer.

> **Status: Stage 3 of 4.** Done: all real content, the header, the mobile bar, the form, the complete **LITE (2D)** version, and in **FULL** mode the intro, the 3D space hero, the five planets, the orbit route, the descent through the clouds, the 3D classroom diorama and the Switch on moment. Still to come in Stage 4: the 3D configurator room, the proof and success-state motion, and the final performance and accessibility passes. Until then the configurator shows its 2D version in both modes. Stage 4 so far: the descent from orbit to the campus has been rebuilt (see "The descent").

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build (type-check, build, then pre-render the HTML):

```bash
npm run build
npm run preview      # http://localhost:4173
```

Use Node 22 or newer. On Windows PowerShell, use `npm.cmd` if execution policy prevents `npm` from running.

After building, run `npm run check:seo` and `npm run check:browser`. The browser check uses an installed Playwright Chromium or Microsoft Edge, and starts its own preview on port 4175. Set `BROWSER_EXECUTABLE` to use another Chromium executable. `npm run preview` serves the build on port 4173 with directory pages, redirects and real 404 responses.

Set the canonical origin and indexing mode in `.env.local` using `.env.example`. Production defaults to `https://starkituniverse.in`; staging builds should use `VITE_SITE_INDEXABLE=false`. Rebuild after changing either value. Deploy the whole `dist` directory and configure the host to serve directory `index.html` files and `404.html` with HTTP 404; do not rewrite unknown paths to the homepage.

## How the page works

- **HTML first.** Every heading, paragraph, button and the form is normal HTML. `npm run build` pre-renders the whole page into `dist/index.html` (`scripts/prerender.mjs`), so the content is on screen before any JavaScript runs.
- **One journey, ten scenes.** Each scene is a `<section>` with an id: `#intro` (added in Stage 2), `#space`, `#planets`, `#route`, `#descent`, `#classroom`, `#switch-on`, `#build`, `#proof` (FAQ is `#faq` inside it) and `#quote`.
- **Two device tiers.** A small script in `index.html` picks the tier before the first paint, so the layout never jumps:
  - **FULL** for desktops and strong devices.
  - **LITE** when any of these apply: `navigator.deviceMemory <= 4`, Save-Data is on, Reduce Motion is on, the window is under 768 px wide, WebGL is unavailable or software-only (no GPU), or the frame rate stays under 45 fps for 2 s. The frame-rate drop is remembered for the browser session.
  - The header's **Lite mode** switch overrides the automatic choice and is remembered in `localStorage` (key `siu-lite`).
  - `src/hooks/useDeviceTier.ts` keeps the tier up to date after load, on resize, on Reduce Motion changes and on the Lite switch. The current tier is written to `<html data-tier="full|lite">`.
- **The 3D layer is optional.** In FULL mode it loads with a dynamic import after the page has painted, as one fixed, `aria-hidden` canvas behind the HTML (`src/three/World.tsx`). If the chunk or WebGL fails, the page drops to LITE; the content never depends on it.
  - **One camera, one world.** Scroll drives the camera from the hero, to each planet in turn, along the orbit route, down through the clouds to the school campus, and in through the glowing classroom window (see "The descent" below). Inside, the camera visits each classroom device, then pulls back for Switch on (`src/three/CameraRig.tsx`). `src/three/Director.tsx` turns scroll progress and the HTML controls into one shared stage state each frame: which region is drawn, sky phase, clouds, and room power and night. The pinned scenes use CSS `position: sticky`. The story moves in named steps (`src/story/steps.ts`): one wheel notch, trackpad swipe, touch swipe or arrow key plays exactly one move, at that move's fixed speed, by animating the real scroll position with Lenis (`src/three/scrollDriver.ts`). After the story (Build, Proof, Quote) Lenis gives normal smooth scrolling. Under Reduce Motion there is no scroll control: native scrolling, and the 3D cuts between stills. See "Smoothness pass" below.
  - **HTML twins.** Every 3D object you can click has an HTML control. The tabs 01–05 are the planets, the station buttons are the route stations, and the numbered buttons 1–5 are the classroom hotspots. Inactive service cards are `inert`, so keyboard focus only reaches the card on screen.
  - **Shared classroom state.** The Classroom colour dots, the Switch on slider and the Day / Night toggle write to `src/lib/classroomState.ts`. The 3D room reads it every frame and eases smoothly between states.
  - **Text over 3D** sits on a panel that is at least 88% opaque behind the text, with edges that fade out beyond it (`.scrim`).
  - **Performance guards.**
    - Pixel ratio is capped at 1.75.
    - Rendering stops when the 3D zone (hero to Switch on) is scrolled away, or the tab is hidden.
    - Bloom applies only to things that glow: the star, the gold route, screens, lamps and the classroom window (threshold 0.95).
    - Every shader, including the hidden campus and classroom ones, compiles in parallel off the main thread before the first frame. It compiles against the post-processing buffer, so the variants match what is actually drawn. Both steps wait until the intro has finished.
    - Only the space, campus or classroom region is drawn at a time.
    - Shadows are static: each sun's shadow map is rendered once, while the page loads.
    - The campus is its own chunk (34 KB gzip, plus the 560 KB of Kenney models). It loads and is built in small idle-time slices while the hero is on screen. The story's first move waits until every region is built, compiled and drawn once (and the page's text too), so no first draw ever lands in a move.
- **The descent** (`#descent`, FULL): we follow the satellite down through the clouds to one glowing window. The section is pinned for about two screens of scrolling. The timings, the satellite's path and the follow camera are in `src/three/dive.ts`; the camera keys under the clouds are `DESCENT` in `src/three/CameraRig.tsx`. The route scene has finished pinning before the descent starts, so none of its list or cards are on screen.
  - 0–8 %: the satellite leaves route station 05 and the camera tips in above it.
  - 8–35 %: it falls toward Earth with the camera close behind. The sky changes with altitude: the brand night (#060A22), #1B2A6B, then universe blue, with Earth's curved edge glowing a thin gold line under a cyan glow while high up. Below lies the cloud deck: drei `<Clouds>` (one instanced draw), three layers of a few big clouds, warm white on top (#FFF7EC) and cool blue underneath (#B8C6E0), which dissolve as the camera passes through them; two clouds on the camera's path sweep past the lens. No mauve, no streaks.
  - About 37 %: inside the deck the frame is fully clouded (a cloudy full-screen veil). That is where space swaps to the campus; the two never show together.
  - 37–52 %: down through the clouds behind the satellite (a third cloud sweeps past). The fog starts thick and opens, so the town appears out of the haze.
  - 52–80 %: under the clouds the camera levels out: the town and the campus ahead, the horizon in the top quarter of the frame, the school's front and right facades towards the camera. The satellite flies ahead to the school, hovers and shines a gold beam on one first-floor window; that window glows from then on (with its pulsing SIU-gold outline and "Your classroom" label). The heading shows only here, bottom-left, on a solid deep-space panel (92 %). The satellite rises away before 86 %.
  - 80–100 %: a glide to that window. As it fills the screen its glass fades and the classroom shows through it (the room is drawn into the window), so the switch into the classroom diorama is invisible.
  - Reduce Motion: no flight. Three stills (in the clouds over the town, the campus with the satellite's light on the window, the classroom) crossfade, 400 ms each.
  - LITE: one still of the same campus with the satellite's beam (`public/images/campus-1600.webp` and `-800.webp`, rendered from the 3D scene) with the heading on its panel.
  - The campus (`src/three/campus/`): a three-storey U-shaped school with verandas, recessed windows with frames, mullions, grills and sunshades, an entrance tower with a "YOUR SCHOOL" signboard, roof parapets, water tank and solar panels, an assembly ground with a stage, a red-earth basketball court, a bus bay with two school buses, paths, flower beds, benches, lamp posts, a boundary wall with railings and an arched gate. One merged vertex-coloured model (no image textures).
  - The campus stands on the ground of a small town (`town.ts`): dusty earth, scrub and fields out past the far plane (the camera never sees an edge), a main road past the gate (the bus route), a few lanes, open plots, flat-roofed two- and three-storey houses in rows along the roads (Kenney models, re-coloured off-white, cream and pale ochre) and simple flat-roofed blocks further out, in the haze. Everything is instanced, one draw call per model.
  - Light: one morning sun 30° above the horizon from the front left (warm gold, the only shadow caster, a 2048 px shadow map over 270 m), a cool blue sky fill with a warm bounce from the ground (lit and shadowed walls differ by about half their brightness), and contact shadows drawn once from the plan of everything that stands on the ground (`contact.ts`). The fog is measured by horizontal distance from the camera: it starts just past the campus wall and is solid at 2.5 times that distance, in the same haze colour as the background and the bottom of the sky dome, so the town melts into the sky. N8AO adds light ambient occlusion on the campus only (it switches itself off for the session if the campus view runs under 55 fps with it).
  - Life (`Life.tsx`): one yellow school bus drives along the main road and turns in through the gate to the bus lane; an auto-rickshaw passes on the main road and another waits by the gate; sixteen students in uniform (stylised capsules, no faces) walk across the assembly ground, up the drive and wait at the bus stop. Each has a soft blob shadow. All of it stands still under Reduce Motion.
  - Trees: Kenney Nature Kit models re-coloured as Ashoka (tall and narrow) along the boundary wall and the drive, Neem (round crowns) on the lawns and in clumps around the town, two Gulmohar (tiered, orange-red) by the entrance. One instanced mesh per model, varied in scale, rotation and tint, with a wind sway of at most 1° (off under Reduce Motion).
- **The intro** (FULL only, once per session, never under Reduce Motion or when the URL has a `#target`). It is drawn on a small 2D canvas, so it never waits for the 3D download. The star forms exactly where the 3D star sits, and the intro ends in under 2 s. A Skip button is always visible. The page is already rendered underneath, and it comes back on its own after 3 s even if JavaScript fails.

## Art direction rework: Phase 0 (foundation)

The art-direction brief turns the page into one continuous early morning, told in one look. Phase 0 lays the foundation; later phases rebuild the scenes on it.

- **Style bible:** `STYLE_BIBLE.md` (one page) and `src/art/styleBible.ts`: the bevel rule, four material families, three values per surface, one palette (`src/art/palette.json`, rendered as `docs/palette.png` and a 64 × 64 palette texture), one light rig, Khronos PBR Neutral tone mapping and selective bloom (threshold 1, intensity 0.6).
- **One brand night:** every dark scene (3D space, Proof, footer, Lite space and Switch on) renders #060A22 at the top to #0B1640 at the bottom. Behind the 3D the gradient is pre-compensated for the Neutral tone mapper, so it comes out as the same colours.
- **Master timeline:** `src/lib/timeline.ts` is the scene table: each scene's scroll budget (FULL section heights come from it). `src/story/steps.ts` lists the story's steps, each one screen of scroll.
  - A scene's copy appears when one of its steps lands (a 400 ms fade) and goes when a move to another scene starts. Nothing from the previous scene is on screen when the next scene's eyebrow appears. Switch on is a pinned scene too.
  - The camera follows the scroll position exactly: Lenis is the only smoothing layer. Camera roll is 0.
  - Every region stays on the GPU for the whole visit (`src/three/Park.tsx`); each is drawn once offscreen, with everything in it shown, before the first move.
  - The 3D layer fades out, and stops rendering, before Proof comes on screen.
- **Colour script:** `docs/colour-script.png` shows one hold frame per scene beside its target in the brief's table, with measured values (median luma, share of pixels in the top 40 % of brightness, dominant colours) and the page's nights against the brand night. `scripts/cscript.mjs` captures the frames (it needs `playwright-core` and a local Chrome) and `scripts/cscript.py` composes the sheet.

## Smoothness pass

How scroll input turns into the story's moves, their timing, and the frame-rate hitches. No model, material, light, camera path, colour or art direction changed in this pass. Details, measurements and what is still open: `docs/perf/notes.md`; charts `docs/perf/before.png` and `docs/perf/after.png`; a recording of tests 1, 3, 5 and 7 with the HUD: `docs/perf/recording.mp4`.

- **Steps:** `src/story/steps.ts` is the table (id, label, duration, ease, overlay). 20 steps: hero, five planets, five stations, the dive, the campus, the window, five devices, Switch on. Moves take 1.0–2.2 s with `power2.inOut` and settle exactly on the step's resting frame. There are no holds: each step is one screen of scroll, and the scroll position stays the single source of truth (scrollbar, anchors and reloads keep working).
- **Input:** wheel and touch through GSAP Observer, plus keys (arrows, Page Up/Down, Space, Home/End). One gesture plays one move. While a move plays, input is ignored until it is 75 % done; then one more gesture in the same direction queues one move (at most one). A gesture the other way reverses the move smoothly. Input is ignored for 200 ms after a move lands. A trackpad's inertia tail never counts as a new gesture. A touch swipe of 50 px is one step.
- **Edges:** at the last step, a forward gesture carries on into Build as normal scrolling; scrolling back up re-enters the story at its last step. Nav links and jumps of more than one step travel at once behind a 250 ms crossfade. A reload lands on the nearest resting step.
- **One loop:** GSAP's ticker drives Lenis and the 3D (`frameloop="never"`). Nothing re-renders in React while a move plays (only when it starts and lands).
- **Warm-up:** before the first move, every 3D region is built, compiled and drawn once offscreen, and every scene's text and all service cards are drawn once at 0.4 % opacity, so Chrome compiles its GPU shaders while the page loads. A gesture made before that plays as soon as it is ready.
- **Debug HUD:** add `?debug=1` for the current and target step, timeline position, FPS, the longest frame in the last 5 s, frames over 50 ms since loading finished, and gestures received versus moves accepted.

## Folder structure

```
public/
  brand/          brand SVGs (see "Brand files")
  images/         the LITE campus still (WebP, 1600 and 800 px)
  models/         glTF models (Stage 2 and 3)
  photos/         real installation photos
scripts/
  prerender.mjs   injects the server-rendered page into dist/index.html
  models.mjs      builds the Kenney models into public/models (palette colours)
src/
  content/        en.ts, hi.ts, services.ts, contact.ts: all copy lives here
  scenes/         one component per scene
  components/     Header, SectionIndex, ServiceCard, Button, QuoteForm,
                  MobileBar, LiteToggle, LangToggle, Cursor, ArcSlider, …
  components/illustrations/
                  the 2D (LITE) artwork, drawn in code: emblem placeholder,
                  isometric classroom, satellite
  hooks/          useDeviceTier, useReducedMotion, useScrollSpy, useMediaQuery
  lib/            i18n, quote pre-fill store, scrolling, storage helpers
  three/          the 3D world: World (canvas), Director (stage state),
                  CameraRig, Atmosphere (sky, fog, lights), Star, Planet,
                  Orbit, Satellite, RouteScene, Particles, ClassroomModel,
                  dive (the descent's timeline), textures, models
  three/campus/   the descent's campus (own chunk): layout (plan and sizes),
                  school (the model), town (ground, roads, houses), models
                  (Kenney loader), contact (contact shadows), Life (bus,
                  autos, students), DiveSatellite (the satellite and its
                  beam), trees, Clouds, TargetWindow, CampusScene
  styles/         tokens.css (brand colours and type), global.css
```

## Changing copy

All text lives in `src/content/`:

| File | What's in it |
| --- | --- |
| `en.ts` | Every English string on the page, grouped by scene |
| `hi.ts` | Hindi versions of the header links, the hero H1, the hero buttons and the quote buttons. Each line is marked `// needs human review`. |
| `services.ts` | The five services: name, one line, "What's included" bullets, price |
| `contact.ts` | Phone, WhatsApp, email, address and map link |
| `business.ts` | Canonical business identity, coverage, official profiles, guide preparation date and service URLs |
| `pages.ts` | All supporting page copy, HTML tables, FAQs and related links |

Two conventions work in any string:

- `*word*` renders in the heavy weight (for example `Smart *Classrooms*`).
- `[text]` is supported by the historical placeholder renderer. Current public copy uses quote-based scope statements and contains no unconfirmed fact chips.

Hindi text is rendered with `lang="hi"` and the Poppins Devanagari font. Unbounded has no Devanagari glyphs, so Hindi headings fall back to Poppins.

## Changing the phone number

Edit `src/content/contact.ts`. The header, mobile bar, quote section and footer all read from it. Keep `phoneHref` and `whatsappHref` in international format with no spaces (`tel:+91…`, `https://wa.me/91…`).

## Brand files

Put these files in `public/brand/`:

- `siu-header-logo.svg`: header logo for light backgrounds
- `siu-header-logo-dark.svg`: header and footer logo for dark backgrounds
- `siu-emblem-animated.svg`: the animated solar system shown in the LITE hero. Include a `prefers-reduced-motion` rule inside the SVG so it stops for visitors who ask for less motion.
- `siu-app-icon.svg`: favicon and app icon

While a file is missing, the page draws a placeholder: a gold "SIU" circle with five small planets. The dev server notices when a file is added or removed and reloads. For a production build, run `npm run build` again.

## Real photos

The homepage Proof section always shows the project cards and the school testimonials from `src/content/en.ts` (the owner's decision; do not hide or filter them). Each project card shows a visible placeholder until its photo is added: put the photo in `public/photos/`, set its `image` and `alt` in `en.ts`, and replace the bracketed school and detail text at the same time. Publish full case studies only with the school's permission, named scope, dates and attributable results; `/projects/` is `noindex` until it contains actual case studies. Use 4:3 photos about 1200 px wide, compressed to WebP or AVIF.

## glTF models

The town around the campus uses CC0 models from Kenney (kenney.nl): City Kit (Commercial) for the houses, Car Kit for the parked cars and Nature Kit for the trees. They live in `public/models/kenney-city/`, `kenney-cars/` and `kenney-nature/`, one `.glb` per pack with the pack's `License.txt` beside it (about 560 KB in all). `scripts/models.mjs` builds them from the downloaded packs: it bakes every model's colours into vertex colours re-coloured to `src/art/palette.json` (with lighter tops and darker feet), drops the textures and UVs, merges each model into one mesh and quantises the normals and colours. Run `node scripts/models.mjs <folder with the extracted Kenney zips>` after changing the palette.

Everything else in 3D is built from primitives and canvas-drawn textures. To replace a primitive with a real model, put a compressed `.glb` in `public/models/` with one of these names:

| File | Replaces |
| --- | --- |
| `planet-smartclass.glb`, `planet-ifp.glb`, `planet-projector.glb`, `planet-laptop.glb`, `planet-network.glb` | the planet sphere (the atmosphere glow and highlight ring stay) |
| `satellite.glb` | the gold satellite on the orbit route |
| `classroom.glb` | the classroom room and furniture (the numbered hotspot pins stay) |

The classroom's Switch on effects are wired to the primitive version's materials: screen glow, the projector beam, the lamps and the lesson slide. A real `classroom.glb` gets the scene lighting changes, but its screens and lamps need the same materials attached (see `ClassroomModel.tsx`). Model the asset about 1 unit across and centred on the origin, then adjust `scale` where `ModelOr` is used in `src/three/`. Compress the geometry with Draco or Meshopt, and the textures as KTX2 (for example `gltf-transform optimize in.glb out.glb --compress draco --texture-compress ktx2`).

The loader code is a separate 45 KB chunk that downloads only when a model file exists. The Draco and Basis decoders are served from `public/draco/` and `public/basis/`, so nothing loads from a third-party CDN. File names are read when the dev server starts (it reloads when files are added or removed) and at build time. Keep all 3D assets together under 3 MB.

## Accessibility notes

- One H1 per page, H2 for sections and H3 for the buyer-check cards. Supporting pages have native HTML tables, breadcrumbs and FAQ disclosure controls.
- A skip link goes to `#main`. Every section has `scroll-margin-top`, so the sticky header never covers a focused element.
- The focus ring is 2 px gold plus 2 px deep-space on every control.
- Service cards: the round button in the corner flips the card (Enter or Space) and reports `aria-expanded`. The back of the card is `inert` until it is flipped.
- Switch on: the arc is a real `role="slider"` with `aria-valuenow` and `aria-valuetext`. Arrow keys, Page Up/Down, Home and End move between steps. The **Switch on** button plays the same sequence.
- Form: errors appear as text next to each field and are linked with `aria-describedby`. Typed values are never cleared. Focus moves to the first field that needs fixing.
- Reduce Motion: no intro, no text scramble, no smooth scrolling, no camera flights, no parallax, no card tilt. If FULL mode is switched on anyway, the camera cuts between fixed views with a short crossfade, and the orbits stand still. Cards crossfade instead of flipping. The emblem and the pulsing hotspots stop.
- The H1 "decode" effect draws on an `aria-hidden` copy laid over the real heading. Screen readers only ever get the real text, and the layout never moves.
- Reduce Transparency and More Contrast: glass surfaces become solid deep-space.

## Testing notes

- Add `?debug` to the URL in FULL mode to expose the 3D camera and object positions as `window.__siu`, and load-phase timings as `window.__siuT`, in the browser console. `?debug&nofx` turns off post-processing and `?debug&noshadow` turns off shadows, for performance comparisons on a given machine.
- To review FULL mode on a laptop that the automatic checks put in LITE, switch **Lite mode** off in the header.
- With `?debug` the campus also exposes `window.__siuCampus` (triangle counts, the stage state) and every frame's renderer totals over all passes as `window.__siuStats`. `?debug&noao` and `?debug&noclouds` turn off the campus ambient occlusion and the clouds.
- The LITE campus still: open the FULL page at 1600 x 1000, scroll to 70 % of the descent with the HTML hidden, take a screenshot, and save it as WebP at 1600 and 800 px wide.

## Checks run so far (Stages 1–3)

All checks ran on the production build (`npm run build && npm run preview`) in headless Chrome 155 on Windows 11. FULL-mode checks used the laptop's integrated GPU (Intel UHD Graphics), where the 3D page holds 60 fps at 1440 x 900. The full checklist (Lighthouse mobile scores, contrast spot checks, a manual keyboard-only walkthrough, a Reduce Motion check) is completed in Stage 4.

- [x] Type check: `tsc --noEmit` passes.
- [x] JavaScript before the 3D layer: 110 KB gzip (budget 200 KB). The 3D layer, loaded after paint in FULL mode only, is 315 KB gzip. The glTF loader (45 KB) loads only if a model exists. The 3D world downloads no model or texture files.
- [x] Pre-rendered HTML contains the full page; no hydration warnings or console errors, in the production build or in `npm run dev`.
- [x] Scripted interaction test at 1280 px (LITE forced) and 390 px (phone, LITE), all passing:
  - Enter flips a service card, and its back stops being inert.
  - "Get a quote for this" pre-selects the service and focuses the form.
  - Classroom hotspot 5 opens the network panel, and the accent colour changes.
  - Slider: two Arrow Right presses reach 50 ("Projector on"), End reaches "Lesson ready", the Day / Night toggle appears, and the Switch off button plays back to 0.
  - The configurator summary fills the form's message field.
  - An empty submit shows text errors linked with `aria-describedby`, keeps typed values and focuses the first error.
  - The current form prepares a reviewable WhatsApp draft after validation; its browser check verifies the payload without sending it.
  - The Hindi switch sets `lang="hi"` on the H1. The Lite switch changes the tier and stores the choice; switching Lite off loads the 3D layer.
- [x] FULL mode at 1440 and 1280 px:
  - Scrolling shows planets 1–5 in turn, with exactly one active card and the other four inert.
  - Tab 02 jumps to the IFP planet and focuses its card's flip button; Enter flips it.
  - The route activates stations 1, 3 and 5 as you scroll, and the station 02 button jumps to station 2.
  - Rendering pauses once the 3D zone is scrolled past.
- [x] Intro: plays once per session and reveals the page 1.75–1.82 s after it appears, measured on four runs with both cold and warm GPU shader caches. It does not play under Reduce Motion. No 3D work blocks the main thread during it.
- [x] Keyboard order in FULL mode: tab 05, then the active card's flip button, then the route stations. Focus never lands inside an inert card.
- [x] Reduce Motion with FULL forced: no intro, Lenis off, and the camera cuts with a crossfade (canvas opacity 0, then 1).
- [x] No-GPU fallback: with Chrome's software renderer (SwiftShader) the page is LITE from the first paint (reason `software-webgl`) and never creates the 3D canvas.
- [x] Layout shift (CLS) during load: 0.053 in FULL at 1440 px, 0.046 in LITE at 390 px (target 0.1 or less). The fallback fonts are sized to the web fonts so headings wrap the same before and after they load.
- [x] H1 text scramble runs, then removes its overlay, in both tiers.
- [x] axe-core (WCAG 2.0–2.2 A/AA rules): no violations at 1280 px (LITE), 390 px (LITE) or 1440 px (FULL with 3D running, with and without Reduce Motion).
- [x] Header fits without overflow at 768, 900, 1024, 1180, 1240, 1280, 1366 and 1440 px, in English and in Hindi.
- [x] Stage 3 in FULL mode at 1440, 1280 and 1024 px:
  - The descent (replaced in Stage 4, see below).
  - Scrolling the classroom shows devices 1–5, with matching panel text. The hotspot 4 button jumps to the teacher's desktop, and the colour dots recolour the room.
  - Switch on, by keyboard: the room starts dark, then the board, projector beam, lights and lesson slide come on in turn. Day lights the windows.
- [x] Keyboard path from the route through the classroom hotspots, the panel button, the colour dots, the slider and the Switch on button: every focused control is on screen, with smooth scrolling on and off.
- [x] Reduce Motion with FULL forced: classroom device changes are crossfade cuts.
- [x] Main-thread frames while jumping between every 3D scene: longest 66 ms (it was 515 ms before shaders were precompiled against the post-processing buffer). First 3D frame after the intro: 0.07–0.5 s (warm and cold shader cache).
- [x] axe-core with the 3D room rendered, in the Classroom and Switch on scenes: no violations, with and without Reduce Motion.
- [x] The new descent, at 1440 x 900 on the integrated Intel UHD GPU (production build):
  - A recording of a wheel scroll from the end of the route into the classroom and back (about 1,800 frames, analysed frame by frame): no frame during the descent is more than 56 % one colour (limit 80 %), so there are no blank frames; the route's list and cards are never on screen once the descent has started; the heading panel never overlaps the school block or the target window; scrolling back up retraces the same path (the progress never changes by more than 0.003 per frame).
  - Frame rate through the descent: 58.3–59.2 fps on average (p95 19–24 ms), with no shader compiled mid-scroll.
  - Campus and trees: 51,130 triangles (school model 30,378, glass 218, 79 trees 20,376, contact shadows 158) and 11 draw calls (plus 4 into the shadow map when it refreshes). Whole frames, all passes, post-processing included: 27–35 draw calls over the campus, up to 140 while the window also draws the classroom. Largest texture: 512 px.
  - Reduce Motion (FULL forced): the camera stays still within each still, and route → sky → campus → classroom each dissolve over 400 ms.
  - LITE at 1440 and 390 px: the campus still loads (1600 px and 800 px WebP), with the heading on its 92 % panel; the LITE classroom after it is unchanged.
- [ ] Lighthouse mobile scores: Stage 4
- [ ] Manual contrast spot checks over 3D: Stage 4
- [ ] Full keyboard-only walkthrough of every scene with 3D enabled: Stage 4
