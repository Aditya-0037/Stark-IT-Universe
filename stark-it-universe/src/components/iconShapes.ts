/**
 * The five service icons as plain shape data (24 x 24 grid, stroked).
 * One source for every place they appear: the HTML <Icon> component, the
 * 2D emblem and the canvas textures on the 3D planets.
 */
export type Shape =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx: number };

export type ServiceIconName = 'cap' | 'panel' | 'projector' | 'laptop' | 'router';

export const SERVICE_ICON_SHAPES: Record<ServiceIconName, Shape[]> = {
  cap: [
    { t: 'path', d: 'M2 9.5 12 5l10 4.5-10 4.5L2 9.5Z' },
    { t: 'path', d: 'M6 11.3V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.7' },
    { t: 'path', d: 'M21 10v5' },
    { t: 'circle', cx: 21, cy: 16.4, r: 1.1 },
  ],
  panel: [
    { t: 'rect', x: 3, y: 3, w: 18, h: 12, rx: 1.6 },
    { t: 'path', d: 'M12 15v5M7.5 20.5h9' },
    { t: 'circle', cx: 14.5, cy: 9.2, r: 1.5 },
    { t: 'path', d: 'M14.5 5.9a3.3 3.3 0 0 1 3.3 3.3' },
  ],
  projector: [
    { t: 'rect', x: 2, y: 9, w: 13, h: 8, rx: 2 },
    { t: 'circle', cx: 10.5, cy: 13, r: 2.2 },
    { t: 'path', d: 'M5 17v2M12 17v2' },
    { t: 'path', d: 'M17 11.2 22 8.5M17 13h5M17 14.8l5 2.7' },
  ],
  laptop: [
    { t: 'path', d: 'M4 16V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V16' },
    { t: 'path', d: 'M2 16h20l-1.2 2.4a1 1 0 0 1-.9.6H4.1a1 1 0 0 1-.9-.6L2 16Z' },
  ],
  router: [
    { t: 'rect', x: 7, y: 2.5, w: 10, h: 6, rx: 1.5 },
    { t: 'path', d: 'M10 5.5h.01M12.5 5.5h2' },
    { t: 'path', d: 'M12 8.5V13M12 13l-5.6 3.6M12 13l5.6 3.6M12 13v4.3' },
    { t: 'circle', cx: 5, cy: 18.3, r: 2 },
    { t: 'circle', cx: 12, cy: 19.5, r: 2 },
    { t: 'circle', cx: 19, cy: 18.3, r: 2 },
  ],
};

/** Strokes an icon onto a 2D canvas, scaled from the 24 x 24 grid. */
export function strokeIcon(
  g: CanvasRenderingContext2D,
  name: ServiceIconName,
  x: number,
  y: number,
  size: number,
  color: string,
  lineWidth: number,
) {
  const s = size / 24;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = color;
  g.lineWidth = lineWidth / s;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const sh of SERVICE_ICON_SHAPES[name]) {
    const p = new Path2D();
    if (sh.t === 'path') p.addPath(new Path2D(sh.d));
    else if (sh.t === 'circle') p.arc(sh.cx, sh.cy, sh.r, 0, Math.PI * 2);
    else p.roundRect(sh.x, sh.y, sh.w, sh.h, sh.rx);
    g.stroke(p);
  }
  g.restore();
}
