import * as THREE from 'three';

export type Rgb = THREE.Color;
const tmpC = new THREE.Color();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const normalMat = new THREE.Matrix3();

/** A colour from a hex string (sRGB in, linear stored), optionally scaled. */
export const rgb = (hex: string, k = 1) => new THREE.Color(hex).multiplyScalar(k);

type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
export interface BoxOpts {
  skip?: Face[];
  ao?: number;
  top?: Rgb;
}

/**
 * Collects many vertex-coloured parts (boxes, rounded boxes, lathes...) into
 * one indexed geometry, so a whole static model costs one draw call. Much
 * faster than creating a BoxGeometry per part and merging them.
 */
export class Builder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  get vertexCount() {
    return this.pos.length / 3;
  }

  private quad(
    a: number[],
    b: number[],
    c: number[],
    d: number[],
    n: number[],
    color: Rgb,
    bottomShade = 1,
    bottomY = -Infinity,
  ) {
    const base = this.vertexCount;
    for (const v of [a, b, c, d]) {
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(n[0], n[1], n[2]);
      const k = v[1] <= bottomY ? bottomShade : 1;
      this.col.push(color.r * k, color.g * k, color.b * k);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Axis-aligned box between two corners. `skip` leaves out hidden faces;
   * `ao` darkens the bottom edge of the side faces (cheap contact shading).
   */
  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: Rgb,
    opts: BoxOpts = {},
  ) {
    const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 < z1 ? [z0, z1] : [z1, z0];
    const skip = opts.skip ?? [];
    const ao = opts.ao ? 1 - opts.ao : 1;
    const top = opts.top ?? color;
    if (!skip.includes('px')) this.quad([bx, ay, bz], [bx, ay, az], [bx, by, az], [bx, by, bz], [1, 0, 0], color, ao, ay);
    if (!skip.includes('nx')) this.quad([ax, ay, az], [ax, ay, bz], [ax, by, bz], [ax, by, az], [-1, 0, 0], color, ao, ay);
    if (!skip.includes('py')) this.quad([ax, by, bz], [bx, by, bz], [bx, by, az], [ax, by, az], [0, 1, 0], top);
    if (!skip.includes('ny')) this.quad([ax, ay, az], [bx, ay, az], [bx, ay, bz], [ax, ay, bz], [0, -1, 0], color);
    if (!skip.includes('pz')) this.quad([ax, ay, bz], [bx, ay, bz], [bx, by, bz], [ax, by, bz], [0, 0, 1], color, ao, ay);
    if (!skip.includes('nz')) this.quad([bx, ay, az], [ax, ay, az], [ax, by, az], [bx, by, az], [0, 0, -1], color, ao, ay);
  }

  /** A flat quad facing +y (paths, court lines, painted markings). */
  flat(x0: number, z0: number, x1: number, z1: number, y: number, color: Rgb) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], color);
  }

  /** A vertical quad with a top and bottom colour (window glass). */
  pane(a: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, normal: THREE.Vector3, bottom: Rgb, top: Rgb) {
    const base = this.vertexCount;
    const corners = [
      [0, 0, bottom],
      [1, 0, bottom],
      [1, 1, top],
      [0, 1, top],
    ] as const;
    for (const [s, t, c] of corners) {
      tmpV.copy(a).addScaledVector(right, s).addScaledVector(up, t);
      this.pos.push(tmpV.x, tmpV.y, tmpV.z);
      this.nor.push(normal.x, normal.y, normal.z);
      this.col.push(c.r, c.g, c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Appends another geometry (rounded box, lathe, cylinder...) transformed
   * by `matrix`. `color` is one colour or a function of the world position.
   */
  add(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color: Rgb | ((p: THREE.Vector3, n: THREE.Vector3) => Rgb)) {
    const p = geo.getAttribute('position');
    let n = geo.getAttribute('normal');
    if (!n) {
      geo.computeVertexNormals();
      n = geo.getAttribute('normal');
    }
    normalMat.getNormalMatrix(matrix);
    const base = this.vertexCount;
    for (let i = 0; i < p.count; i++) {
      tmpV.fromBufferAttribute(p, i).applyMatrix4(matrix);
      tmpN.fromBufferAttribute(n, i).applyMatrix3(normalMat).normalize();
      this.pos.push(tmpV.x, tmpV.y, tmpV.z);
      this.nor.push(tmpN.x, tmpN.y, tmpN.z);
      const c = typeof color === 'function' ? color(tmpV, tmpN) : color;
      this.col.push(c.r, c.g, c.b);
    }
    if (geo.index) {
      const ix = geo.index;
      for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
    } else {
      for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const big = this.vertexCount > 65535;
    g.setIndex(big ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Matrix for a part placed at (x, y, z), turned `ry` radians about y, scaled. */
export function place(x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Small deterministic random generator (same campus every visit). */
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Scales a colour's lightness by (1 + v), e.g. v = ±0.08. */
export function vary(c: Rgb, v: number) {
  return tmpC.copy(c).multiplyScalar(1 + v).clone();
}
