import { createStore } from '../lib/createStore';
import { readStore, writeStore } from '../lib/storage';

/**
 * Device tiers from the brief.
 *  FULL: 3D world, scroll-driven camera.
 *  LITE: every 3D scene is replaced by its 2D version.
 *
 * The first decision is made by the inline script in index.html before the
 * first paint (so the layout never jumps). This module takes over after the
 * app mounts: the header's Lite switch, the frame-rate check, window resizes
 * and Reduce Motion changes all update the tier here.
 */
export type Tier = 'full' | 'lite';
export type TierReason =
  | ''
  | 'reduced-motion'
  | 'small-screen'
  | 'low-memory'
  | 'save-data'
  | 'no-webgl'
  | 'software-webgl'
  | 'low-fps';
type Override = 'on' | 'off' | null;

export interface TierState {
  /** The tier in use. */
  tier: Tier;
  /** What the automatic checks chose. */
  auto: Tier;
  reason: TierReason;
  /** The visitor's Lite switch choice ('on' = force Lite, 'off' = force full). */
  override: Override;
  webgl: boolean;
}

const LITE_KEY = 'siu-lite';
const FPS_KEY = 'siu-low-fps';

const SERVER_STATE: TierState = { tier: 'lite', auto: 'lite', reason: '', override: null, webgl: true };

function readInitial(): TierState {
  if (typeof document === 'undefined') return SERVER_STATE;
  const d = document.documentElement;
  const raw = readStore('local', LITE_KEY);
  const override: Override = raw === 'on' || raw === 'off' ? raw : null;
  return {
    tier: d.dataset.tier === 'full' ? 'full' : 'lite',
    auto: d.dataset.tierAuto === 'full' ? 'full' : 'lite',
    reason: (d.dataset.tierReason as TierReason) || '',
    override,
    webgl: d.dataset.webgl !== 'no',
  };
}

export const tierStore = createStore<TierState>(readInitial(), SERVER_STATE);

let webglChecked = false;
let softwareGL = typeof document !== 'undefined' && document.documentElement.dataset.tierReason === 'software-webgl';
function checkWebGL(): boolean {
  if (webglChecked) return tierStore.get().webgl;
  webglChecked = true;
  try {
    const canvas = document.createElement('canvas');
    const ctx = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!ctx) return false;
    // Software WebGL (no GPU) can't run the 3D scenes smoothly.
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    softwareGL = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    ctx.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function autoReason(webgl: boolean): TierReason {
  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;
  if (mm('(prefers-reduced-motion: reduce)')) return 'reduced-motion';
  if (window.innerWidth < 768) return 'small-screen';
  const nav = navigator;
  if (nav.deviceMemory && nav.deviceMemory <= 4) return 'low-memory';
  if (nav.connection?.saveData) return 'save-data';
  if (readStore('session', FPS_KEY) === '1') return 'low-fps';
  if (!webgl) return 'no-webgl';
  return '';
}

function resolve(auto: Tier, override: Override, webgl: boolean): Tier {
  if (!webgl) return 'lite';
  if (override === 'on') return 'lite';
  if (override === 'off') return 'full';
  return auto;
}

function apply(next: Partial<TierState>) {
  tierStore.set(next);
  const s = tierStore.get();
  const d = document.documentElement;
  d.dataset.tier = s.tier;
  d.dataset.tierAuto = s.auto;
  if (s.reason) d.dataset.tierReason = s.reason;
  else delete d.dataset.tierReason;
}

/** Re-run the automatic checks (after resize or a Reduce Motion change). */
export function recomputeTier() {
  const reasonNoGl = autoReason(true);
  // Only spend time on a WebGL check when nothing else already says LITE.
  const webgl = reasonNoGl ? tierStore.get().webgl : checkWebGL();
  const reason = reasonNoGl || (webgl ? (softwareGL ? 'software-webgl' : '') : 'no-webgl');
  const auto: Tier = reason ? 'lite' : 'full';
  const { override } = tierStore.get();
  apply({ auto, reason, webgl, tier: resolve(auto, override, webgl) });
}

/** The header's Lite mode switch. Remembered in localStorage. */
export function setLiteMode(on: boolean) {
  const override: Override = on ? 'on' : 'off';
  writeStore('local', LITE_KEY, override);
  const { auto } = tierStore.get();
  // Forcing full mode on a device whose WebGL was never tested: test it now.
  const webgl = !on ? checkWebGL() : tierStore.get().webgl;
  apply({ override, webgl, tier: resolve(auto, override, webgl) });
}

/** Called by the 3D layer when the frame rate stays under 45 fps for 2 s. */
export function reportLowFrameRate() {
  writeStore('session', FPS_KEY, '1');
  const { override, webgl } = tierStore.get();
  apply({ auto: 'lite', reason: 'low-fps', tier: resolve('lite', override, webgl) });
}

/** Called by the 3D layer if WebGL fails to start or the context is lost. */
export function reportWebGLFailure() {
  webglChecked = true;
  apply({ webgl: false, auto: 'lite', reason: 'no-webgl', tier: 'lite' });
}

/** Starts the resize and Reduce Motion listeners. Call once on mount. */
export function watchTier(): () => void {
  let timer = 0;
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(recomputeTier, 250);
  };
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = () => {
    document.documentElement.toggleAttribute('data-motion', false);
    if (mq.matches) document.documentElement.dataset.motion = 'reduce';
    recomputeTier();
  };
  window.addEventListener('resize', onResize, { passive: true });
  mq.addEventListener('change', onMotion);
  return () => {
    window.removeEventListener('resize', onResize);
    mq.removeEventListener('change', onMotion);
    window.clearTimeout(timer);
  };
}

export function useDeviceTier(): TierState {
  return tierStore.useStore();
}
