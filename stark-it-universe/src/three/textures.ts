import * as THREE from 'three';
import { strokeIcon, type ServiceIconName } from '../components/iconShapes';

/**
 * Small textures drawn on a canvas at runtime, so the 3D layer needs no
 * image downloads. All are cached.
 */
const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function finish(c: HTMLCanvasElement, key: string, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/**
 * Web fonts load after the first paint, so canvas text is first drawn with
 * the fallback font. This redraws it (same texture, so no shader change)
 * whenever fonts finish loading.
 */
export function redrawOnFonts(draw: () => void, tex: THREE.Texture) {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;
  const redraw = () => {
    draw();
    tex.needsUpdate = true;
  };
  fonts.addEventListener('loadingdone', redraw);
  fonts.ready.then(redraw, () => {});
}

/** Soft round glow (white, alpha falls off to the edge). */
export function glowTexture() {
  const key = 'glow';
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256, 256);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return finish(c, key, false);
}

// Deterministic noise so textures look the same on every visit.
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Banded planet surface in shades of the planet colour. */
export function planetTexture(hex: string, seed: number) {
  const key = `planet-${hex}-${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(512, 256);
  const base = new THREE.Color(hex);
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  const dark = base.clone().lerp(new THREE.Color('#0b1640'), 0.4);
  const r = rng(seed * 977 + 13);

  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 512, 256);
  // bands
  let y = 0;
  while (y < 256) {
    const h = 6 + r() * 26;
    const mixT = r();
    const col = mixT > 0.5 ? light.clone().lerp(base, r() * 0.6) : dark.clone().lerp(base, r() * 0.6);
    g.globalAlpha = 0.35 + r() * 0.4;
    g.fillStyle = `#${col.getHexString()}`;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x / 40 + seed) * 3);
    for (let x = 512; x >= 0; x -= 16) g.lineTo(x, y + h + Math.sin(x / 33 + seed * 2) * 3);
    g.closePath();
    g.fill();
    y += h * (0.6 + r() * 0.8);
  }
  // speckles
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.08 + r() * 0.12;
    g.fillStyle = r() > 0.5 ? '#ffffff' : `#${dark.getHexString()}`;
    g.beginPath();
    g.ellipse(r() * 512, r() * 256, 2 + r() * 10, 1 + r() * 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  const t = finish(c, key);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Ring texture: concentric stripes, transparent gaps. */
export function ringTexture() {
  const key = 'ring';
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(512, 16);
  const r = rng(42);
  for (let x = 0; x < 512; x++) {
    const a = 0.25 + 0.55 * Math.abs(Math.sin(x / 9)) * (0.6 + r() * 0.4);
    const edge = Math.min(x / 40, (512 - x) / 40, 1);
    g.fillStyle = `rgba(200,255,232,${(a * edge).toFixed(3)})`;
    g.fillRect(x, 0, 1, 16);
  }
  return finish(c, key);
}

/** Cloudy nebula puff in a given colour (used on far-away sprites). */
export function nebulaTexture(hex: string, seed: number) {
  const key = `nebula-${hex}-${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  const col = new THREE.Color(hex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  for (let i = 0; i < 26; i++) {
    const x = 256 + (r() - 0.5) * 260;
    const y = 256 + (r() - 0.5) * 200;
    const rad = 60 + r() * 150;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${rgb},${(0.08 + r() * 0.1).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
  }
  return finish(c, key);
}

/** A service icon for a planet's face: white strokes on a dark outline. */
export function planetIconTexture(name: ServiceIconName) {
  const key = `icon-${name}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256, 256);
  strokeIcon(g, name, 40, 40, 176, 'rgba(11,22,64,0.6)', 26);
  strokeIcon(g, name, 40, 40, 176, '#FFFFFF', 13);
  return finish(c, key);
}

/**
 * A planet's name on a deep-space pill. Returns the texture and its aspect
 * ratio. Drawn at once with the fallback font, then redrawn when Poppins
 * has loaded (same texture object, so materials never need recompiling).
 */
export function planetLabelTexture(text: string) {
  const key = `label-${text}`;
  const H = 96;
  if (cache.has(key)) return { texture: cache.get(key)!, aspect: 512 / H };
  const [c, g] = canvas(512, H);
  const draw = () => {
    g.clearRect(0, 0, 512, H);
    g.font = '600 52px Poppins, Arial, sans-serif';
    const w = Math.min(512, g.measureText(text).width + 64);
    const x = (512 - w) / 2;
    g.fillStyle = 'rgba(11,22,64,0.92)';
    g.beginPath();
    g.roundRect(x + 2, 6, w - 4, H - 12, (H - 12) / 2);
    g.fill();
    g.strokeStyle = 'rgba(147,172,255,0.45)';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#FFFFFF';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, H / 2 + 2);
  };
  draw();
  const t = finish(c, key);
  redrawOnFonts(draw, t);
  return { texture: t, aspect: 512 / H };
}

/** "SIU" lettering for the star, in Unbounded 800 (deep-space). */
export async function siuLabelTexture() {
  const key = 'siu-label';
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(512, 256);
  const draw = () => {
    g.clearRect(0, 0, 512, 256);
    g.fillStyle = '#0B1640';
    g.font = '800 150px Unbounded, "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SIU', 256, 136);
  };
  draw();
  const t = finish(c, key);
  redrawOnFonts(draw, t);
  return t;
}
