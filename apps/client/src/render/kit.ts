import { MeshBuilder, TransformNode, type AbstractMesh, type Mesh, type Scene } from "@babylonjs/core";
import type { BuildingKey } from "@empire/core";
import { PALETTE, box, cone, cylinder, gableRoof, type Materials } from "./common";

/*
 * Modelos low-poly construidos en código. Son provisionales: cuando haya modelos glTF comprados,
 * models.ts los usa en su lugar (ver public/models/LEEME.md).
 * Unidades: 1 = una casilla. Los edificios ocupan 2×2 casillas y se centran en el origen.
 */

type Part = Mesh | AbstractMesh;

export class Kit {
  constructor(private scene: Scene, private mats: Materials) {}

  private paint<T extends Part>(m: T, color: string, x = 0, y = 0, z = 0, ry = 0): T {
    m.material = this.mats.get(color);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    return m;
  }

  private node(name: string, parts: Part[]) {
    const root = new TransformNode(name, this.scene);
    for (const p of parts) p.parent = root;
    return root;
  }

  box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, ry = 0) {
    return this.paint(box("caja", w, h, d, this.scene), color, x, y, z, ry);
  }
  cyl(diam: number, h: number, color: string, x = 0, y = 0, z = 0, tess = 10, top?: number) {
    return this.paint(cylinder("cilindro", diam, h, this.scene, tess, top), color, x, y, z);
  }
  cone(diam: number, h: number, color: string, x = 0, y = 0, z = 0, tess = 8) {
    return this.paint(cone("cono", diam, h, this.scene, tess), color, x, y, z);
  }
  roof(w: number, d: number, h: number, color: string, x = 0, y = 0, z = 0, ry = 0) {
    return this.paint(gableRoof("tejado", w, d, h, this.scene), color, x, y, z, ry);
  }
  rock(size: number, color: string, x = 0, y = 0, z = 0, seed = 0) {
    const m = MeshBuilder.CreatePolyhedron("roca", { type: 3, size }, this.scene);
    m.scaling.set(1, 0.7, 0.9);
    m.rotation.set(seed * 1.3, seed * 2.1, seed * 0.7);
    return this.paint(m, color, x, y + size * 0.45, z, seed * 2.1);
  }
  flag(color: string, x: number, y: number, z: number, h = 0.6) {
    const pole = this.cyl(0.04, h, PALETTE.woodDark, x, y, z, 5);
    const cloth = this.box(0.28, 0.16, 0.02, color, x + 0.15, y + h - 0.12, z);
    return [pole, cloth];
  }

  /** Casa encalada con tejado rojo; el ancho y alto dependen del tamaño. */
  cottage(w: number, d: number, h: number, x: number, z: number, ry = 0, roof: string = PALETTE.roofRed) {
    const parts: Part[] = [this.box(w, h, d, PALETTE.plaster, x, 0, z, ry)];
    parts.push(this.roof(w + 0.12, d + 0.12, h * 0.75, roof, x, h, z, ry));
    parts.push(this.box(0.18, 0.28, 0.02, PALETTE.woodDark, x, 0, z - d / 2 - 0.01, ry));
    return parts;
  }

  tree(x: number, z: number, s = 1, dark = false) {
    return [
      this.cyl(0.1 * s, 0.3 * s, PALETTE.woodDark, x, 0, z, 6),
      this.cone(0.55 * s, 0.7 * s, dark ? PALETTE.leavesDark : PALETTE.leaves, x, 0.22 * s, z, 7),
      this.cone(0.42 * s, 0.5 * s, dark ? PALETTE.leaves : PALETTE.leavesDark, x, 0.55 * s, z, 7),
    ];
  }

  /** Árbol de copa redonda (roble, haya): da variedad junto a los pinos. */
  broadleaf(x: number, z: number, s = 1, color: string = PALETTE.leaves) {
    const top = MeshBuilder.CreateIcoSphere("copa", { radius: 0.34 * s, subdivisions: 1, flat: true }, this.scene);
    top.scaling.y = 0.85;
    return [this.cyl(0.09 * s, 0.38 * s, PALETTE.woodDark, x, 0, z, 6), this.paint(top, color, x, 0.6 * s, z)];
  }

  /** Edificio del reino según su tipo y nivel. Nivel 0 = solar vacío. */
  building(key: BuildingKey, level: number, locked: boolean): TransformNode {
    if (level <= 0) return this.lot(locked);
    const t = Math.min(3, 1 + Math.floor((level - 1) / 3)); // tramo visual: 1 (nv 1-3), 2 (4-6), 3 (7+)
    const parts: Part[] = [];
    const g = (h: number) => 0.2 * level + h;
    switch (key) {
      case "castle": {
        const h = 1.1 + 0.18 * level;
        parts.push(this.box(1.5, h, 1.5, PALETTE.stone));
        for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) {
          parts.push(this.cyl(0.5, h + 0.45, PALETTE.stoneDark, x, 0, z, 10));
          parts.push(this.cone(0.62, 0.55, PALETTE.roofBlue, x, h + 0.45, z, 10));
        }
        parts.push(this.box(0.8, h + 0.9, 0.8, PALETTE.stone, 0, 0, 0));
        parts.push(this.cone(1.0, 0.8, PALETTE.roofGold, 0, h + 0.9, 0, 4));
        parts.push(this.box(0.4, 0.55, 0.05, PALETTE.woodDark, 0, 0, -0.76));
        parts.push(...this.flag(PALETTE.roofRed, 0, h + 1.65, 0, 0.6));
        if (t >= 2) for (const [x, z] of [[-0.75, -0.75], [0.75, 0.75]]) parts.push(...this.flag(PALETTE.roofGold, x, h + 0.95, z, 0.4));
        break;
      }
      case "house":
        parts.push(...this.cottage(0.9, 0.7, 0.55 + 0.04 * level, -0.35, -0.3));
        if (t >= 2) parts.push(...this.cottage(0.7, 0.6, 0.5, 0.5, 0.45, Math.PI / 2));
        if (t >= 3) {
          parts.push(...this.cottage(0.6, 0.6, 0.85, 0.5, -0.45, 0, PALETTE.roofBlue));
          parts.push(this.box(0.12, 0.4, 0.12, PALETTE.stoneDark, -0.6, 0.8, -0.2));
        }
        parts.push(...this.tree(-0.6, 0.6, 0.8));
        break;
      case "farm": {
        parts.push(this.box(1.8, 0.04, 1.3, PALETTE.dirt, 0, 0, 0.2));
        const rows = 4 + Math.min(4, level);
        for (let i = 0; i < rows; i++) parts.push(this.box(1.6, 0.12, 0.08, "#9cc35a", 0, 0.04, -0.35 + (i * 1.1) / rows));
        parts.push(...this.cottage(0.6, 0.45, 0.4, 0.55, -0.7, 0, PALETTE.roofRed));
        break;
      }
      case "sawmill":
        parts.push(this.box(1.1, g(0.45), 0.8, PALETTE.wood, -0.2, 0, -0.2));
        parts.push(this.roof(1.25, 0.95, 0.45, PALETTE.woodDark, -0.2, g(0.45), -0.2));
        for (let i = 0; i < 3 + Math.min(3, level); i++) {
          const log = this.cyl(0.16, 0.9, "#a07a4a", 0.25, 0.08 + Math.floor(i / 3) * 0.14, 0.45 + (i % 3) * 0.17 - 0.17, 7);
          log.rotation.z = Math.PI / 2;
          parts.push(log);
        }
        parts.push(...this.tree(-0.7, 0.65, 0.9, true));
        break;
      case "quarry":
        parts.push(this.box(1.8, 0.05, 1.8, PALETTE.stoneDark));
        for (let i = 0; i < 3 + Math.min(4, level); i++) parts.push(this.rock(0.2 + (i % 3) * 0.06, PALETTE.stone, -0.6 + (i % 4) * 0.4, 0, -0.5 + Math.floor(i / 4) * 0.6, i));
        parts.push(this.box(0.1, 1.0, 0.1, PALETTE.woodDark, 0.6, 0, 0.5));
        parts.push(this.box(0.7, 0.08, 0.08, PALETTE.woodDark, 0.35, 0.95, 0.5));
        break;
      case "storage":
        parts.push(this.box(1.3, g(0.6), 1.0, PALETTE.wood));
        parts.push(this.roof(1.45, 1.15, 0.5, PALETTE.woodDark, 0, g(0.6), 0, Math.PI / 2));
        for (let i = 0; i < Math.min(5, 1 + level); i++) parts.push(this.box(0.25, 0.25, 0.25, "#c49a5c", -0.7 + i * 0.32, 0, 0.72));
        break;
      case "barracks":
        parts.push(this.box(1.4, g(0.6), 0.9, PALETTE.stone, 0, 0, -0.2));
        parts.push(this.roof(1.55, 1.05, 0.45, PALETTE.roofRed, 0, g(0.6), -0.2));
        parts.push(...this.flag(PALETTE.roofRed, 0.75, 0, 0.6, 1.0));
        for (const x of [-0.5, -0.1, 0.3]) {
          parts.push(this.cyl(0.06, 0.35, PALETTE.woodDark, x, 0, 0.6, 5));
          parts.push(this.box(0.25, 0.06, 0.06, PALETTE.woodDark, x, 0.28, 0.6));
        }
        break;
      case "stable":
        parts.push(this.box(1.5, g(0.5), 0.75, PALETTE.wood, 0, 0, -0.35));
        parts.push(this.roof(1.65, 0.9, 0.4, PALETTE.roofRed, 0, g(0.5), -0.35));
        for (let i = 0; i < 6; i++) parts.push(this.box(0.06, 0.3, 0.06, PALETTE.woodDark, -0.75 + i * 0.3, 0, 0.75));
        parts.push(this.box(1.6, 0.05, 0.04, PALETTE.woodDark, 0, 0.22, 0.75));
        break;
      case "den":
        parts.push(this.rock(0.9, "#5b5146", 0, -0.2, 0, 1));
        parts.push(this.rock(0.5, "#6a5f52", 0.55, -0.1, 0.4, 3));
        parts.push(this.cyl(0.55, 0.05, "#1d1612", 0, 0.35, -0.72, 12));
        parts[parts.length - 1].rotation.x = Math.PI / 2;
        parts.push(...this.tree(-0.75, 0.6, 0.9, true));
        break;
      case "nest":
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          parts.push(this.rock(0.25, "#5b5146", Math.cos(a) * 0.65, 0, Math.sin(a) * 0.65, i));
        }
        parts.push(this.cyl(1.1, 0.15, "#8a6a3a", 0, 0, 0, 14));
        break;
      default:
        parts.push(this.box(1.4, g(0.5), 1.4, PALETTE.stone));
    }
    return this.node(`edificio-${key}`, parts);
  }

  /** Solar vacío: tierra con estacas en las esquinas. */
  private lot(locked: boolean) {
    const parts: Part[] = [this.box(1.7, 0.03, 1.7, locked ? "#4d5b40" : PALETTE.dirt)];
    if (!locked) for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) parts.push(this.box(0.06, 0.25, 0.06, PALETTE.wood, x, 0, z));
    return this.node("solar", parts);
  }

  /** Huevo o dragón en el nido. */
  dragon(stage: number, egg: boolean) {
    if (egg) return this.node("huevo", [this.paint(MeshBuilder.CreateSphere("huevo", { diameterX: 0.4, diameterY: 0.55, diameterZ: 0.4, segments: 8 }, this.scene), "#e2653c", 0, 0.42, 0)]);
    const s = 0.6 + 0.25 * stage;
    const body = this.paint(MeshBuilder.CreateSphere("cuerpo", { diameterX: 0.5 * s, diameterY: 0.4 * s, diameterZ: 0.9 * s, segments: 8 }, this.scene), "#c2412d");
    const head = this.paint(MeshBuilder.CreateSphere("cabeza", { diameter: 0.3 * s, segments: 6 }, this.scene), "#c2412d", 0, 0.12 * s, 0.5 * s);
    const wingL = this.box(0.9 * s, 0.03, 0.4 * s, "#e2653c", -0.5 * s, 0.05 * s, 0);
    const wingR = this.box(0.9 * s, 0.03, 0.4 * s, "#e2653c", 0.5 * s, 0.05 * s, 0);
    const tail = this.cone(0.18 * s, 0.6 * s, "#c2412d", 0, 0, -0.45 * s, 5);
    tail.rotation.x = -Math.PI / 2;
    const root = this.node("dragon", [body, head, wingL, wingR, tail]);
    root.metadata = { wings: [wingL, wingR] };
    return root;
  }

  /** Tramo de muralla de una casilla, del material que toca por nivel. Gira según el lado. */
  wallSegment(level: number, gate: boolean) {
    const tier = wallTier(level);
    const parts: Part[] = [];
    if (gate) {
      const c = tier.color;
      parts.push(this.box(0.25, tier.h + 0.25, 0.5, c, -0.4, 0, 0), this.box(0.25, tier.h + 0.25, 0.5, c, 0.4, 0, 0));
      parts.push(this.box(1, 0.2, 0.5, c, 0, tier.h + 0.05, 0));
      parts.push(this.box(0.55, tier.h * 0.8, 0.06, PALETTE.woodDark, 0, 0, 0.05));
    } else if (tier.name === "madera") {
      for (let i = 0; i < 5; i++) {
        const x = -0.4 + i * 0.2;
        parts.push(this.cyl(0.17, tier.h, PALETTE.wood, x, 0, 0, 6), this.cone(0.17, 0.15, PALETTE.wood, x, tier.h, 0, 6));
      }
    } else {
      parts.push(this.box(1, tier.h, 0.4, tier.color));
      for (const x of [-0.35, 0, 0.35]) parts.push(this.box(0.18, 0.16, 0.42, tier.color, x, tier.h, 0));
    }
    return this.node("muralla", parts);
  }

  tower(level: number, wallLevel: number) {
    const tier = wallTier(Math.max(1, wallLevel));
    const h = 1.0 + 0.12 * level;
    const color = tier.name === "madera" ? PALETTE.wood : tier.color;
    return this.node("torre", [this.cyl(0.75, h, color, 0, 0, 0, 10), this.cone(0.9, 0.6, PALETTE.roofRed, 0, h, 0, 10)]);
  }
}

/** Material de la muralla según su nivel: madera, piedra, ladrillo y fortaleza. */
export function wallTier(level: number) {
  if (level <= 2) return { name: "madera", color: PALETTE.wood, h: 0.55 };
  if (level <= 4) return { name: "piedra", color: PALETTE.stone, h: 0.65 };
  if (level <= 6) return { name: "ladrillo", color: PALETTE.brick, h: 0.75 };
  return { name: "fortaleza", color: PALETTE.stoneDark, h: 0.9 };
}
