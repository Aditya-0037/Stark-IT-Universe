import * as THREE from 'three';
import { services } from '../content/services';
import { redrawOnFonts } from './textures';

/**
 * Canvas textures for the 3D classroom (no image downloads). With
 * `withText`, the texture is redrawn once web fonts have loaded.
 */
function make(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, withText = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (withText) {
    redrawOnFonts(() => {
      g.clearRect(0, 0, w, h);
      draw(g);
    }, t);
  }
  return t;
}

/** Smart board home screen: tiles in the planet colours and a handwritten line. */
export function boardTexture() {
  return make(512, 300, (g) => {
    const grad = g.createLinearGradient(0, 0, 512, 300);
    grad.addColorStop(0, '#0891B2');
    grad.addColorStop(1, '#1E3A8A');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 300);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(0, 0, 512, 30);
    services.slice(0, 3).forEach((s, i) => {
      g.fillStyle = s.color;
      g.beginPath();
      g.roundRect(32 + i * 155, 62, 130, 90, 12);
      g.fill();
    });
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(40, 230);
    for (let x = 40; x <= 400; x += 10) g.lineTo(x, 230 + Math.sin(x / 22) * 14);
    g.stroke();
    g.fillStyle = '#FFB52E';
    g.beginPath();
    g.arc(450, 232, 16, 0, Math.PI * 2);
    g.fill();
  });
}

/** Laptop and desktop screens. */
export function screenTexture() {
  return make(256, 160, (g) => {
    const grad = g.createLinearGradient(0, 0, 256, 160);
    grad.addColorStop(0, '#7DD3FC');
    grad.addColorStop(1, '#3B82F6');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(22, 22, 110, 16);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(22, 54, 190, 10);
    g.fillRect(22, 76, 150, 10);
  });
}

/** The lesson slide shown on the projector screen. */
export async function slideTexture(title: string, sub: string) {
  return make(640, 480, (g) => {
    g.fillStyle = '#0B1640';
    g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#ffffff';
    g.font = '700 40px Unbounded, "Arial Black", sans-serif';
    g.fillText(title, 40, 80);
    g.fillStyle = '#B9C4EE';
    g.font = '400 22px Poppins, Arial, sans-serif';
    g.fillText(sub, 40, 118);
    const cx = 320;
    const cy = 300;
    services.forEach((s, i) => {
      const rx = 70 + i * 48;
      const ry = rx * 0.34;
      g.strokeStyle = 'rgba(111,134,255,0.75)';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      g.stroke();
      const t = [0.4, 2.2, 3.6, 5.1, 1.2][i];
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, 10, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = '#FFB52E';
    g.beginPath();
    g.arc(cx, cy, 30, 0, Math.PI * 2);
    g.fill();
  }, true);
}

/** Numbered hotspot badge (normal = deep space, active = gold). */
export function badgeTexture(n: number, active: boolean) {
  return make(128, 128, (g) => {
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fillStyle = active ? '#FFB52E' : '#0B1640';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = active ? '#0B1640' : '#ffffff';
    g.stroke();
    g.fillStyle = active ? '#0B1640' : '#ffffff';
    g.font = '600 56px "JetBrains Mono", Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 64, 68);
  }, true);
}
