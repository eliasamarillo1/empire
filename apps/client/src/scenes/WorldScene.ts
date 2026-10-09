import Phaser from "phaser";
import { canExplore, center, tileAt, type Tile, type TileKind } from "@empire/core";
import { game, now } from "../game";
import { cameraControls, fit } from "./camera";
import { TH, TW, drawBlock, fillDiamond, fromIso, iso, strokeDiamond } from "./iso";

export const TILE_COLORS: Record<TileKind, number> = {
  plain: 0x5f7d43, forest: 0x2f5a34, mountain: 0x6d695f, gold: 0x8c7330, water: 0x284660,
  lair: 0x4c6638, ruins: 0x5d5546, kingdom: 0x4c6638, home: 0x4c6638,
};

export class WorldScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private markers!: Phaser.GameObjects.Graphics;
  private unsubscribe?: () => void;

  constructor() {
    super("world");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0b100e");
    this.layer = this.add.container(0, 0);
    this.markers = this.add.graphics().setDepth(1000);
    const w = game.world;
    // Empieza centrado en tu reino, con zoom para ver lo explorado
    const c = iso(center(w) + 0.5, center(w) + 0.5);
    fit(this, c.x, c.y, TW * 9, TH * 11);
    cameraControls(this, (x, y) => this.tap(x, y));
    this.unsubscribe = game.onChange(() => this.draw());
    this.events.once("shutdown", () => this.unsubscribe?.());
    this.draw();
  }

  private tap(wx: number, wy: number) {
    const { x, y } = fromIso(wx, wy);
    if (!tileAt(game.world, x, y)) return game.select(null);
    game.select({ view: "world", x, y });
  }

  private draw() {
    this.layer.removeAll(true);
    const w = game.world;
    const g = this.add.graphics();
    const deco = this.add.graphics();
    const labels: Phaser.GameObjects.GameObject[] = [];
    this.layer.add([g, deco]);
    const t0 = now();

    for (let s = 0; s < w.size * 2; s++)
      for (let y = 0; y < w.size; y++) {
        const x = s - y;
        const t = tileAt(w, x, y);
        if (!t) continue;
        if (!t.seen) {
          fillDiamond(g, x, y, (x + y) % 2 ? 0x0e1512 : 0x111a16);
          if (canExplore(w, x, y)) fillDiamond(g, x, y, 0xd6a64c, 0.1);
          continue;
        }
        fillDiamond(g, x, y, TILE_COLORS[t.kind]);
        strokeDiamond(g, x, y, 0x000000, 1, 0.12);
        const label = this.decorate(deco, t, x, y, t0);
        if (label) labels.push(label);
      }
    this.layer.add(labels);

    const sel = game.selection?.view === "world" ? game.selection : null;
    if (sel) {
      const hl = this.add.graphics();
      strokeDiamond(hl, sel.x, sel.y, 0xd6a64c, 3);
      this.layer.add(hl);
    }
  }

  /** Dibuja el elemento de la casilla. Devuelve una etiqueta de nivel si la lleva. */
  private decorate(g: Phaser.GameObjects.Graphics, t: Tile, x: number, y: number, t0: number) {
    const c = iso(x + 0.5, y + 0.5);
    const tri = (cx: number, cy: number, w: number, h: number, color: number) => {
      g.fillStyle(color, 1).fillTriangle(cx - w / 2, cy, cx + w / 2, cy, cx, cy - h);
    };
    switch (t.kind) {
      case "forest":
        tri(c.x - 9, c.y + 2, 14, 20, 0x1a3a22);
        tri(c.x + 8, c.y - 2, 14, 22, 0x204828);
        tri(c.x, c.y + 6, 12, 16, 0x1a3a22);
        break;
      case "mountain":
        tri(c.x, c.y + 6, 40, 30, 0x4d4a43);
        tri(c.x, c.y - 14, 12, 10, 0xd9d6cc);
        break;
      case "gold":
        g.fillStyle(0x4d4a43, 1).fillEllipse(c.x, c.y + 2, 30, 14);
        g.fillStyle(0xf0c85a, 1).fillCircle(c.x - 5, c.y - 2, 5).fillCircle(c.x + 5, c.y, 4);
        break;
      case "plain":
        g.lineStyle(2, 0x7d9a52, 1);
        for (let i = -1; i <= 1; i++) g.lineBetween(c.x + i * 8, c.y + 3, c.x + i * 8 + 2, c.y - 5);
        break;
      case "water":
        g.lineStyle(1.5, 0x5c86a8, 1).lineBetween(c.x - 12, c.y, c.x + 12, c.y);
        break;
      case "ruins":
        g.fillStyle(0xb5ab92, 1).fillRect(c.x - 10, c.y - 14, 5, 16).fillRect(c.x + 4, c.y - 8, 5, 10).fillRect(c.x - 12, c.y + 2, 24, 3);
        break;
      case "lair":
        g.fillStyle(0x2a1210, 1).fillEllipse(c.x, c.y + 2, 30, 16);
        g.fillStyle(0x7a2b25, 1).fillEllipse(c.x, c.y, 22, 11);
        return this.badge(c.x, c.y - 16, String(t.level), 0x7a2b25);
      case "kingdom":
      case "home": {
        const home = t.kind === "home";
        drawBlock(g, x, y, 1, 1, 14, home ? 0xd6a64c : 0x9b7fd0, home ? 0x7b3b34 : 0x4b3a6b, 12, 0.18);
        if (!home && (t.shieldUntil ?? 0) > t0) g.lineStyle(2, 0x7fb3d6, 0.9).strokeEllipse(c.x, c.y - 8, 54, 34);
        return home ? null : this.badge(c.x, c.y - 34, String(t.level), 0x4b3a6b);
      }
    }
    // Barra de lo que queda en el yacimiento
    if (t.max !== undefined) {
      const f = (t.amount ?? 0) / t.max;
      g.fillStyle(0x000000, 0.5).fillRect(c.x - 12, c.y + 9, 24, 3);
      g.fillStyle(0xebe5d4, 1).fillRect(c.x - 12, c.y + 9, 24 * f, 3);
    }
    return null;
  }

  private badge(x: number, y: number, text: string, color: number) {
    const ct = this.add.container(x, y);
    ct.add(this.add.circle(0, 0, 9, color, 1).setStrokeStyle(1.5, 0xebe5d4, 0.8));
    ct.add(this.add.text(0, 0, text, { fontFamily: '"IBM Plex Mono", monospace', fontSize: "11px", color: "#ebe5d4" }).setOrigin(0.5));
    return ct;
  }

  update() {
    // Recolectores yendo y volviendo desde tu reino
    const g = this.markers;
    g.clear();
    const w = game.world;
    const c = center(w);
    const t0 = now();
    for (const e of game.data.expeditions) {
      const f = Phaser.Math.Clamp((t0 - e.start) / (e.end - e.start), 0, 1);
      const k = f < 0.5 ? f * 2 : 2 - f * 2;
      const p = iso(c + 0.5 + (e.x - c) * k, c + 0.5 + (e.y - c) * k);
      g.fillStyle(0xebe5d4, 1).fillCircle(p.x, p.y - 4, 4);
      g.lineStyle(1, 0x111915, 1).strokeCircle(p.x, p.y - 4, 4);
    }
  }
}
