import Phaser from "phaser";

/** Tamaño de una casilla isométrica en píxeles (rombo de 2:1). */
export const TW = 64;
export const TH = 32;

/** Casilla (x, y) a coordenadas de pantalla: esquina norte del rombo. */
export const iso = (x: number, y: number) => ({ x: ((x - y) * TW) / 2, y: ((x + y) * TH) / 2 });

/** Punto de pantalla a casilla. */
export function fromIso(sx: number, sy: number) {
  const a = sx / (TW / 2);
  const b = sy / (TH / 2);
  return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) };
}

export const shade = (color: number, amount: number) =>
  amount >= 0
    ? Phaser.Display.Color.IntegerToColor(color).lighten(amount).color
    : Phaser.Display.Color.IntegerToColor(color).darken(-amount).color;

/** Rombo de una zona de w×h casillas. */
export function diamond(x: number, y: number, w = 1, h = 1) {
  const n = iso(x, y), e = iso(x + w, y), s = iso(x + w, y + h), wv = iso(x, y + h);
  return [n, e, s, wv];
}

export function fillDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha = 1, w = 1, h = 1) {
  g.fillStyle(color, alpha);
  g.fillPoints(diamond(x, y, w, h).map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
}

export function strokeDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, width = 2, alpha = 1, w = 1, h = 1) {
  g.lineStyle(width, color, alpha);
  g.strokePoints(diamond(x, y, w, h).map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
}

const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/**
 * Bloque isométrico sobre una huella de w×h casillas: dos caras laterales con sombra,
 * tapa y, si se pide, tejado a cuatro aguas.
 */
export function drawBlock(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  height: number, wall: number, roof?: number, roofHeight = 0, inset = 0.15,
) {
  const [n, e, s, wv] = diamond(x + inset, y + inset, w - inset * 2, h - inset * 2);
  g.fillStyle(shade(wall, -18), 1);
  g.fillPoints([v(wv.x, wv.y), v(s.x, s.y), v(s.x, s.y - height), v(wv.x, wv.y - height)], true);
  g.fillStyle(shade(wall, -34), 1);
  g.fillPoints([v(s.x, s.y), v(e.x, e.y), v(e.x, e.y - height), v(s.x, s.y - height)], true);
  g.fillStyle(wall, 1);
  g.fillPoints([v(n.x, n.y - height), v(e.x, e.y - height), v(s.x, s.y - height), v(wv.x, wv.y - height)], true);
  if (roof !== undefined && roofHeight > 0) {
    const cx = (n.x + s.x) / 2, cy = (n.y + s.y) / 2 - height - roofHeight;
    g.fillStyle(shade(roof, -10), 1);
    g.fillTriangle(wv.x, wv.y - height, s.x, s.y - height, cx, cy);
    g.fillStyle(shade(roof, -20), 1);
    g.fillTriangle(s.x, s.y - height, e.x, e.y - height, cx, cy);
    g.fillStyle(shade(roof, 8), 1);
    g.fillTriangle(n.x, n.y - height, wv.x, wv.y - height, cx, cy);
  }
  return { top: (n.y + s.y) / 2 - height - roofHeight, cx: (n.x + s.x) / 2 };
}
