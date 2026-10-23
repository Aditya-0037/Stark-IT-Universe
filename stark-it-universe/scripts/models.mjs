// Builds the CC0 Kenney models used by the 3D world into public/models/<pack>/<pack>.glb
// (one file per pack, one named mesh per model, plus the pack's License.txt):
//  - bakes each model's colours (texture atlas or material colours) into
//    vertex colours, re-coloured to the house palette (src/art/palette.json)
//    with lighter tops and darker feet (fake GI), so nothing looks asset-flipped;
//  - drops textures, UVs and tangents and merges each model into one mesh
//    (node transforms applied), so every model is one draw call or one
//    InstancedMesh in the campus scene.
// usage: node scripts/models.mjs <folder with the extracted Kenney zips> [--report]
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const [, , srcRoot, flag] = process.argv;
const report = flag === '--report';
const outRoot = path.resolve('public/models');
const palette = JSON.parse(fs.readFileSync('src/art/palette.json', 'utf8'));

const PACKS = {
  'kenney-city': { dir: 'kenney_city-kit-commercial_2.1', glb: 'Models/GLB format' },
  'kenney-cars': { dir: 'kenney_car-kit', glb: 'Models/GLB format' },
  'kenney-nature': { dir: 'kenney_nature-kit', glb: 'Models/GLTF format' },
};

// model -> pack, and how its colours map onto the palette
const MODELS = [
  // town: flat-roofed 2-3 storey blocks (walls: off-white, cream or pale ochre)
  ...['a', 'b', 'c', 'd', 'e', 'h', 'i', 'k'].map((l, i) => ({ pack: 'kenney-city', name: `building-${l}`, map: 'building', wall: i % 3 })),
  { pack: 'kenney-cars', name: 'sedan', map: 'car', body: 'paper' },
  { pack: 'kenney-cars', name: 'van', map: 'car', body: 'steel' },
  // nature: Ashoka (columnar), neem (round), gulmohar (tiered, red-orange)
  { pack: 'kenney-nature', name: 'tree_tall', map: 'tree', leaf: 'treeA' },
  { pack: 'kenney-nature', name: 'tree_cone', map: 'tree', leaf: 'treeA' },
  { pack: 'kenney-nature', name: 'tree_default', map: 'tree', leaf: 'treeB' },
  { pack: 'kenney-nature', name: 'tree_oak', map: 'tree', leaf: 'treeC' },
  { pack: 'kenney-nature', name: 'tree_fat', map: 'tree', leaf: 'treeB' },
  { pack: 'kenney-nature', name: 'tree_plateau', map: 'tree', leaf: 'gulmohar' },
  { pack: 'kenney-nature', name: 'plant_bushLarge', map: 'tree', leaf: 'treeC' },
];

// ---- colour helpers (sRGB 0..1) -----------------------------------------------------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const tone = (group, name, shade = 1) => hex(palette[group][name][shade]);
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
function hsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}
const WALLS = [tone('surface', 'plaster', 0), tone('surface', 'plaster', 1), tone('surface', 'ochre', 0)];

/** Maps a source colour (sRGB) to a palette colour for this model (ny: the face's normal y). */
function remap(c, m, ny = 0) {
  const [h, s, l] = hsl(c);
  if (m.map === 'tree') {
    // leaves are the saturated teal-green; bark is the warm brown (or birch white)
    if (s > 0.35 && h > 60 && h < 200) return tone('surface', m.leaf, 1);
    return tone('surface', 'trunk', l > 0.9 ? 0 : 1);
  }
  if (m.map === 'car') {
    if (l < 0.3) return tone('surface', 'slate', 2); // tyres, trim
    if (h > 180 && h < 250 && s > 0.25 && l > 0.45) return tone('surface', 'glass', 0); // windows
    if (l > 0.85 && s < 0.2) return tone('surface', 'roof', 0); // lights, chrome
    if (s < 0.15) return tone('surface', 'steel', 0); // bumpers
    return m.body === 'paper' ? tone('brand', 'paper', 1) : m.body === 'steel' ? tone('surface', 'steel', 0) : tone('surface', 'brick', 1);
  }
  // buildings: white walls, blue-grey trims and roofs, blue windows, a few coloured accents
  if (l > 0.7 && s < 0.35) return WALLS[m.wall];
  if (h > 190 && h < 250 && s > 0.35) return tone('surface', 'glass', l > 0.6 ? 0 : 1);
  // flat concrete roofs (the grey tops), grey trims and shutters on the sides
  if (s < 0.3 && ny > 0.7) return tone('surface', 'roof', l > 0.42 ? 0 : 1);
  if (s < 0.3) return l > 0.42 ? tone('surface', 'roof', 1) : l > 0.28 ? tone('surface', 'steel', 0) : tone('surface', 'steel', 1);
  if (h > 80 && h < 180) return tone('surface', 'treeB', 1); // planters
  if (h < 60) return tone('surface', 'sandstone', 1); // awnings
  return tone('surface', 'accentBand', 1);
}

// ---- processing -------------------------------------------------------------------------
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const pngCache = new Map();
function texel(texture, u, v) {
  let img = pngCache.get(texture);
  if (!img) {
    img = PNG.sync.read(Buffer.from(texture.getImage()));
    pngCache.set(texture, img);
  }
  const x = Math.min(img.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.width)));
  const y = Math.min(img.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.height)));
  const i = (y * img.width + x) * 4;
  return [img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255];
}

const mul = (m, x, y, z, w) => [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];

/** One model -> merged positions, normals, linear vertex colours and indices. */
async function bake(m) {
  const pack = PACKS[m.pack];
  const doc = await io.read(path.join(srcRoot, pack.dir, pack.glb, `${m.name}.glb`));
  const parts = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const wm = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const uv = prim.getAttribute('TEXCOORD_0');
      const mat = prim.getMaterial();
      const tex = mat?.getBaseColorTexture();
      const factor = (mat?.getBaseColorFactor() ?? [1, 1, 1, 1]).slice(0, 3).map(toSrgb);
      const n = pos.getCount();
      const p = new Float32Array(n * 3);
      const nn = new Float32Array(n * 3);
      const src = [];
      for (let i = 0; i < n; i++) {
        const [x, y, z] = pos.getElement(i, []);
        const w = mul(wm, x, y, z, 1);
        p.set(w, i * 3);
        minY = Math.min(minY, w[1]);
        maxY = Math.max(maxY, w[1]);
        const [a, b, c] = nor ? nor.getElement(i, []) : [0, 1, 0];
        const wn = mul(wm, a, b, c, 0);
        const len = Math.hypot(...wn) || 1;
        nn.set(wn.map((v) => v / len), i * 3);
        let col = factor;
        if (tex && uv) {
          const [u, v] = uv.getElement(i, []);
          col = texel(tex, u, v).map((t, k) => t * factor[k]);
        }
        src.push(col);
      }
      const ix = prim.getIndices();
      const idx = ix ? Array.from(ix.getArray()) : [...Array(n).keys()];
      parts.push({ p, nn, src, idx });
    }
  }
  const seen = {};
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  for (const part of parts) {
    const base = pos.length / 3;
    for (let i = 0; i < part.src.length; i++) {
      const s = part.src[i];
      const key = s.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
      seen[key] = (seen[key] ?? 0) + 1;
      const y = part.p[i * 3 + 1];
      const t = maxY > minY ? (y - minY) / (maxY - minY) : 1;
      const gi = 0.86 + 0.18 * t; // darker feet, lighter tops
      remap(s, m, part.nn[i * 3 + 1]).forEach((c) => col.push(toLin(Math.min(1, c * gi))));
    }
    pos.push(...part.p);
    nor.push(...part.nn);
    for (const k of part.idx) idx.push(base + k);
  }
  // bounds, with the model's feet at y = 0
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      box[k] = Math.min(box[k], pos[i + k]);
      box[k + 3] = Math.max(box[k + 3], pos[i + k]);
    }
  }
  for (let i = 1; i < pos.length; i += 3) pos[i] -= box[1];
  box[4] -= box[1];
  box[1] = 0;
  // weld identical vertices; 8-bit normals and colours
  const map = new Map();
  const wp = [];
  const wn = [];
  const wc = [];
  const remapIdx = new Uint32Array(pos.length / 3);
  for (let i = 0; i < pos.length / 3; i++) {
    const n8 = [0, 1, 2].map((k) => Math.round(nor[i * 3 + k] * 127));
    const c8 = [0, 1, 2].map((k) => Math.round(col[i * 3 + k] * 255));
    const key = [0, 1, 2].map((k) => pos[i * 3 + k].toFixed(4)).concat(n8, c8).join(',');
    let j = map.get(key);
    if (j === undefined) {
      j = wp.length / 3;
      map.set(key, j);
      wp.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      wn.push(...n8);
      wc.push(...c8);
    }
    remapIdx[i] = j;
  }
  const widx = idx.map((k) => remapIdx[k]);
  return { pos: wp, nor: wn, col: wc, idx: widx, box, seen, tris: idx.length / 3 };
}

const byPack = {};
for (const m of MODELS) (byPack[m.pack] ??= []).push(m);
for (const [packName, models] of Object.entries(byPack)) {
  const out = new Document();
  const buffer = out.createBuffer();
  const scene = out.createScene(packName);
  const material = out.createMaterial('clay').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.85).setMetallicFactor(0);
  for (const m of models) {
    const r = await bake(m);
    const size = r.box.slice(3).map((v, k) => (v - r.box[k]).toFixed(2)).join(' x ');
    if (report) {
      const top = Object.entries(r.seen).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `#${k}:${n}`).join(' ');
      console.log(m.name.padEnd(24), `${r.tris} tris`.padEnd(10), size.padEnd(20), top);
      continue;
    }
    const acc = (type, arr) => out.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
    const vertices = r.pos.length / 3;
    const prim = out
      .createPrimitive()
      .setAttribute('POSITION', acc('VEC3', new Float32Array(r.pos)))
      .setAttribute('NORMAL', acc('VEC3', new Int8Array(r.nor)).setNormalized(true))
      .setAttribute('COLOR_0', acc('VEC3', new Uint8Array(r.col)).setNormalized(true))
      .setIndices(acc('SCALAR', vertices > 65535 ? new Uint32Array(r.idx) : new Uint16Array(r.idx)))
      .setMaterial(material);
    const mesh = out.createMesh(m.name).addPrimitive(prim);
    scene.addChild(out.createNode(m.name).setMesh(mesh));
  }
  if (report) continue;
  const dir = path.join(outRoot, packName);
  fs.mkdirSync(dir, { recursive: true });
  await io.write(path.join(dir, `${packName}.glb`), out);
  fs.copyFileSync(path.join(srcRoot, PACKS[packName].dir, 'License.txt'), path.join(dir, 'License.txt'));
  console.log('wrote', path.join(dir, `${packName}.glb`), fs.statSync(path.join(dir, `${packName}.glb`)).size, 'bytes,', models.length, 'models');
}
