import {
  Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3, VertexBuffer, VertexData,
  type AbstractMesh, type ArcRotateCamera, type Engine, type InstancedMesh,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock } from "@babylonjs/gui";
import { canExplore, homeOf, tileAt, type Tile, type TileKind, type World } from "@empire/core";
import { game, now } from "../game";
import { Materials, PALETTE, clampTarget, findMeta, onTap, orbitCamera, setupLighting } from "./common";
import { Kit } from "./kit";
import { mulberry } from "./kingdomView";
import { ModelLibrary } from "./models";
import { MeshPrefab, group, type Prefab } from "./prefab";
import type { View } from "./renderer";

/*
 * El mapa del mundo es un paisaje continuo: una sola malla de terreno con colinas, montañas, lagos y costa,
 * coloreada por vértices según lo que hay en cada casilla. Encima van los árboles, rocas y castillos,
 * y las nubes tapan lo que todavía no has explorado.
 */

/** Vértices del terreno por casilla: más = relieve más suave. */
const SUB = 5;
/** Casillas de mar alrededor de la isla. */
const MARGIN = 8;
/** Altura del agua (mar y lagos). */
const WATER = -0.12;

/** Altura de referencia de cada tipo de casilla. */
const BASE_HEIGHT: Record<TileKind, number> = {
  plain: 0.03, forest: 0.1, mountain: 0.8, gold: 0.14, water: -0.5, lair: 0.08, ruins: 0.05, kingdom: 0.04, home: 0.04,
};
const OUTSIDE = -0.75;

const C = (hex: string) => Color3.FromHexString(hex);
const COLORS = {
  grass: C("#86b450"), grassAlt: C("#6c9e3f"), forest: C("#4f7f35"), gold: C("#c2a45c"), lair: C("#5d6a3f"),
  sand: C("#ddc995"), shallow: C("#6fa59a"), deep: C("#2f5e6e"), rock: C("#8e877a"), rockDark: C("#6f695f"),
  snow: C("#f4f2ec"), mist: C("#c9d3d6"),
};

interface Cell {
  sig: string;
  node: TransformNode;
  label?: Rectangle;
}

export class WorldView implements View {
  readonly scene: Scene;
  private mats: Materials;
  private kit: Kit;
  private shadows;
  private models: ModelLibrary;
  private gui: AdvancedDynamicTexture;
  private root: TransformNode;
  private cells = new Map<number, Cell>();
  private prefabs!: Record<string, Prefab>;
  private terrain?: Mesh;
  private terrainSig = "";
  private fogSig = "";
  /** Alturas y pesos por casilla (incluido el margen de mar), para interpolar el relieve. */
  private grid?: { n: number; height: Float32Array; mountain: Float32Array; flat: Float32Array; fog: Float32Array; kinds: (TileKind | null)[] };
  private ring: AbstractMesh;
  private carts: InstancedMesh[] = [];
  private cartSource: AbstractMesh;
  private worldRef?: World;
  private camera: ArcRotateCamera;
  /** Nubes que se están deshaciendo tras explorar su casilla. */
  private fading: { node: TransformNode; start: number }[] = [];
  private labelsShown = true;
  private unsubscribe: () => void;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.mats = new Materials(this.scene);
    this.kit = new Kit(this.scene, this.mats);
    const { shadows } = setupLighting(this.scene, "#a9cde0", 0.014, game.world.size + 6);
    this.shadows = shadows;
    this.models = new ModelLibrary(this.scene);
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI("etiquetas", true, this.scene);
    this.root = new TransformNode("mundo", this.scene);
    this.buildPrefabs();

    const w = game.world;
    const h = this.pos(w, homeOf(w).x, homeOf(w).y);
    const cam = orbitCamera(this.scene, h, 14, { min: 5, max: 42 });
    this.camera = cam;
    clampTarget(cam, -w.size / 2, w.size / 2, -w.size / 2, w.size / 2);

    // Agua: un único plano para el mar y los lagos; el terreno que queda por debajo se ve a través.
    const water = MeshBuilder.CreateGround("agua", { width: 3000, height: 3000 }, this.scene);
    water.position.y = WATER;
    const wm = new StandardMaterial("agua", this.scene);
    wm.diffuseColor = C("#4aa3c4");
    wm.specularColor = new Color3(0.35, 0.35, 0.35);
    wm.specularPower = 48;
    wm.alpha = 0.78;
    water.material = wm;
    water.receiveShadows = true;
    water.isPickable = false;

    this.ring = MeshBuilder.CreateTorus("seleccion", { diameter: 1.2, thickness: 0.05, tessellation: 4 }, this.scene);
    this.ring.rotation.y = Math.PI / 4;
    this.ring.material = this.mats.get(PALETTE.selection, { emissive: 0.8 });
    this.ring.isPickable = false;
    this.ring.setEnabled(false);

    this.cartSource = MeshBuilder.CreateSphere("recolector", { diameter: 0.2, segments: 6 }, this.scene);
    this.cartSource.material = this.mats.get(PALETTE.plaster);
    this.cartSource.isPickable = false;
    this.cartSource.setEnabled(false);

    onTap(this.scene, (mesh, point) => {
      let sel = findMeta<{ x: number; y: number }>(mesh);
      if (!sel && mesh === this.terrain && point) sel = this.tileFromPoint(point);
      game.select(sel ? { view: "world", ...sel } : null);
    });
    this.unsubscribe = game.onChange(() => this.refresh());
    void this.models.ready.then(() => {
      this.cells.forEach((c) => (c.sig = ""));
      this.refresh();
    });
    this.refresh();
  }

  private pos(w: World, x: number, y: number) {
    return new Vector3(x - w.size / 2 + 0.5, 0, w.size / 2 - y - 0.5);
  }

  private tileFromPoint(p: Vector3) {
    const n = game.world.size;
    const x = Math.floor(p.x + n / 2), y = Math.floor(n / 2 - p.z);
    return x >= 0 && y >= 0 && x < n && y < n ? { x, y } : undefined;
  }

  // ---------- Terreno ----------

  /** Recalcula las tablas por casilla. Devuelve si cambió el relieve (tipos) o solo la niebla. */
  private updateGrid(w: World) {
    const n = w.size + MARGIN * 2;
    const g = this.grid?.n === n ? this.grid : {
      n, height: new Float32Array(n * n), mountain: new Float32Array(n * n), flat: new Float32Array(n * n),
      fog: new Float32Array(n * n), kinds: new Array<TileKind | null>(n * n).fill(null),
    };
    let kinds = "", fog = "";
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const t = tileAt(w, i - MARGIN, j - MARGIN);
        const k = j * n + i;
        g.kinds[k] = t?.kind ?? null;
        g.height[k] = t ? BASE_HEIGHT[t.kind] : OUTSIDE;
        g.mountain[k] = t?.kind === "mountain" ? 1 : 0;
        g.flat[k] = t && (t.kind === "home" || t.kind === "kingdom") ? 1 : 0;
        g.fog[k] = !t ? 0 : t.seen ? 0 : canExplore(w, i - MARGIN, j - MARGIN) ? 0.45 : 1;
        kinds += t ? t.kind[0] + t.kind[1] : "_";
        fog += g.fog[k];
      }
    this.grid = g;
    const relief = kinds !== this.terrainSig, mist = fog !== this.fogSig;
    this.terrainSig = kinds;
    this.fogSig = fog;
    return { relief, mist };
  }

  /** Valor de una tabla por casilla interpolado suavemente en un punto del mundo. */
  private sample(arr: Float32Array, wx: number, wz: number) {
    const g = this.grid!, size = game.world.size;
    // Deformación suave de las coordenadas: rompe las líneas rectas de la cuadrícula y de la costa.
    const ox = wx, oz = wz;
    wx = ox + (valueNoise(ox * 0.45 + 11.3, oz * 0.45 - 4.1) - 0.5) * 1.1;
    wz = oz + (valueNoise(ox * 0.45 - 7.7, oz * 0.45 + 2.9) - 0.5) * 1.1;
    // Coordenadas continuas de casilla (centro de la casilla = entero), desplazadas por el margen.
    const fx = wx + size / 2 - 0.5 + MARGIN, fy = size / 2 - 0.5 - wz + MARGIN;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const sx = smooth(fx - x0), sy = smooth(fy - y0);
    const at = (i: number, j: number) => {
      const ci = Math.min(g.n - 1, Math.max(0, i)), cj = Math.min(g.n - 1, Math.max(0, j));
      return arr[cj * g.n + ci];
    };
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  }

  /** Altura del terreno en un punto del mundo. Los objetos se apoyan con esta misma función. */
  private heightAt(wx: number, wz: number) {
    const g = this.grid!;
    const base = this.sample(g.height, wx, wz);
    const mountain = this.sample(g.mountain, wx, wz);
    const flat = this.sample(g.flat, wx, wz);
    const rolling = (fbm(wx * 0.55, wz * 0.55) - 0.5) * 0.22 * (1 - flat);
    const peaks = mountain * mountain * (fbm(wx * 1.4 + 40, wz * 1.4 - 13) * 1.2 - 0.1);
    return base + rolling + peaks;
  }

  private buildTerrain(w: World) {
    const n = w.size + MARGIN * 2;
    this.terrain?.dispose();
    const t = MeshBuilder.CreateGround("terreno", { width: n, height: n, subdivisions: n * SUB, updatable: true }, this.scene);
    const pos = t.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = this.heightAt(pos[i], pos[i + 2]);
    t.updateVerticesData(VertexBuffer.PositionKind, pos);
    const normals = new Array<number>(pos.length);
    VertexData.ComputeNormals(pos, t.getIndices()!, normals);
    t.updateVerticesData(VertexBuffer.NormalKind, normals);
    t.setVerticesData(VertexBuffer.ColorKind, new Float32Array((pos.length / 3) * 4), true);
    const m = new StandardMaterial("terreno", this.scene);
    m.diffuseColor = Color3.White();
    m.specularColor = new Color3(0.04, 0.04, 0.04);
    t.material = m;
    t.receiveShadows = true;
    t.parent = this.root;
    this.terrain = t;
  }

  /** Colorea el terreno: hierba, bosque, arena, roca, nieve, fondo del agua y bruma sobre lo inexplorado. */
  private paintTerrain() {
    const t = this.terrain!, g = this.grid!;
    const pos = t.getVerticesData(VertexBuffer.PositionKind)!;
    const nor = t.getVerticesData(VertexBuffer.NormalKind)!;
    const col = new Float32Array((pos.length / 3) * 4);
    const forestW = this.kindTable("forest"), goldW = this.kindTable("gold"), lairW = this.kindTable("lair");
    const c = new Color3();
    for (let v = 0, k = 0; v < pos.length; v += 3, k += 4) {
      const x = pos[v], h = pos[v + 1], z = pos[v + 2];
      const n = fbm(x * 1.3 + 7, z * 1.3 - 3);
      Color3.LerpToRef(COLORS.grass, COLORS.grassAlt, n, c);
      mix(c, COLORS.forest, this.sample(forestW, x, z) * 0.85);
      mix(c, COLORS.gold, this.sample(goldW, x, z) * 0.6);
      mix(c, COLORS.lair, this.sample(lairW, x, z) * 0.7);
      // Roca en las laderas empinadas y en lo alto; nieve en las cumbres.
      const steep = 1 - nor[v + 1];
      mix(c, n > 0.5 ? COLORS.rock : COLORS.rockDark, clamp01(smoothRange(0.18, 0.4, steep) + smoothRange(0.35, 0.7, h)));
      mix(c, COLORS.snow, smoothRange(1.3, 1.55, h + n * 0.15));
      // Playa junto al agua y fondo cada vez más oscuro.
      mix(c, COLORS.sand, smoothRange(WATER + 0.16, WATER + 0.02, h));
      mix(c, COLORS.shallow, smoothRange(WATER - 0.02, WATER - 0.2, h));
      mix(c, COLORS.deep, smoothRange(WATER - 0.2, WATER - 0.6, h));
      mix(c, COLORS.mist, this.sample(g.fog, x, z) * 0.7);
      col[k] = c.r;
      col[k + 1] = c.g;
      col[k + 2] = c.b;
      col[k + 3] = 1;
    }
    t.updateVerticesData(VertexBuffer.ColorKind, col);
  }

  private kindTable(kind: TileKind) {
    const g = this.grid!;
    return Float32Array.from(g.kinds, (k) => (k === kind ? 1 : 0));
  }

  // ---------- Objetos ----------

  /** Piezas que se repiten por todo el mapa: se construyen una vez y se copian. */
  private buildPrefabs() {
    const s = this.scene, k = this.kit, sh = this.shadows;
    const pf = (name: string, parts: AbstractMesh[], shadows = sh) => new MeshPrefab(name, group(name, s, parts), shadows);
    const puff = (r: number, x: number, y: number, z: number) => {
      const m = MeshBuilder.CreateIcoSphere("nube", { radius: r, subdivisions: 2, flat: true }, s);
      m.position.set(x, y, z);
      m.scaling.y = 0.55;
      m.material = this.mats.get("#f3f6f8", { emissive: 0.32 });
      return m;
    };
    const castle = (name: string, wall: string, roof: string) => pf(name, [
      k.box(0.55, 0.35, 0.55, wall),
      k.cyl(0.2, 0.55, wall, -0.27, 0, -0.27), k.cone(0.26, 0.25, roof, -0.27, 0.55, -0.27),
      k.cyl(0.2, 0.55, wall, 0.27, 0, 0.27), k.cone(0.26, 0.25, roof, 0.27, 0.55, 0.27),
      k.box(0.28, 0.6, 0.28, wall), k.cone(0.4, 0.35, roof, 0, 0.6, 0, 4),
      k.box(0.7, 0.02, 0.7, PALETTE.path, 0, -0.01, 0),
    ]);
    this.prefabs = {
      pine: pf("pino", k.tree(0, 0, 1)),
      pineDark: pf("pino-oscuro", k.tree(0, 0, 1, true)),
      oak: pf("roble", k.broadleaf(0, 0, 1, "#5f9a3c")),
      oakLight: pf("roble-claro", k.broadleaf(0, 0, 1, "#7fb04a")),
      bush: pf("arbusto", [k.rock(0.1, "#5c8f3a", 0, -0.03, 0, 3)]),
      rock: pf("roca", [k.rock(0.13, PALETTE.stone, 0, -0.03, 0, 1)]),
      boulder: pf("pena", [k.rock(0.26, PALETTE.stoneDark, 0, -0.08, 0, 2), k.rock(0.12, PALETTE.stone, 0.2, -0.03, 0.1, 5)]),
      nugget: pf("pepita", [glow(k.rock(0.07, PALETTE.gold, 0, -0.02, 0, 4), this.mats.get(PALETTE.gold, { emissive: 0.5 }))]),
      vein: pf("veta", [
        k.rock(0.22, PALETTE.stoneDark, 0, -0.06, 0, 6),
        glow(k.rock(0.06, PALETTE.gold, 0.12, 0.06, -0.1, 2), this.mats.get(PALETTE.gold, { emissive: 0.5 })),
        glow(k.rock(0.05, PALETTE.gold, -0.08, 0.1, -0.12, 7), this.mats.get(PALETTE.gold, { emissive: 0.5 })),
      ]),
      flowers: pf("flores", [
        k.cyl(0.05, 0.06, "#f4e27a", 0, 0, 0, 5), k.cyl(0.05, 0.06, "#f2f0e8", 0.08, 0, 0.05, 5), k.cyl(0.05, 0.06, "#e58a7a", -0.06, 0, 0.07, 5),
      ], undefined),
      cloud: pf("nube", [puff(0.42, 0, 0, 0), puff(0.32, 0.38, -0.04, 0.12), puff(0.3, -0.36, -0.05, -0.1), puff(0.26, 0.1, 0.08, -0.32), puff(0.24, -0.1, 0.06, 0.34)], undefined),
      lair: pf("guarida", this.lairParts()),
      ruins: pf("ruinas", [
        k.cyl(0.14, 0.5, "#c9bfa6", -0.22, 0, -0.1, 8),
        k.cyl(0.14, 0.3, "#c9bfa6", 0.18, 0, -0.2, 8),
        k.box(0.6, 0.08, 0.2, "#c9bfa6", 0, 0, 0.22),
        k.rock(0.08, "#c9bfa6", 0.25, 0, 0.15, 1),
      ]),
      kingdom: castle("reino", PALETTE.stone, PALETTE.purple),
      home: castle("capital", PALETTE.plaster, PALETTE.roofGold),
    };
  }

  /** Redibuja el terreno si hace falta y solo las casillas que han cambiado. */
  private refresh() {
    if (this.scene.isDisposed) return;
    const w = game.world;
    if (this.worldRef && this.worldRef.size !== w.size) {
      this.cells.forEach((c) => this.disposeCell(c));
      this.cells.clear();
      this.terrainSig = "";
    }
    this.worldRef = w;
    const { relief, mist } = this.updateGrid(w);
    if (relief || !this.terrain) {
      this.buildTerrain(w);
      this.cells.forEach((c) => (c.sig = ""));
    }
    if (relief || mist) this.paintTerrain();

    const t0 = now();
    for (let y = 0; y < w.size; y++)
      for (let x = 0; x < w.size; x++) {
        const t = tileAt(w, x, y)!;
        const near = !t.seen && canExplore(w, x, y);
        const fill = t.max ? Math.ceil(((t.amount ?? 0) / t.max) * 3) : 0;
        const shield = t.kind === "kingdom" && (t.shieldUntil ?? 0) > t0;
        const sig = t.seen ? `${t.kind}|${t.level}|${fill}|${shield}|${this.models.version}` : near ? "near" : "fog";
        const i = y * w.size + x;
        const old = this.cells.get(i);
        if (old?.sig === sig) continue;
        if (old?.sig === "fog") {
          // La nube no desaparece de golpe: se hincha, sube y se deshace.
          this.fading.push({ node: old.node, start: performance.now() });
          old.label?.dispose();
        } else if (old) this.disposeCell(old);
        this.cells.set(i, this.buildCell(w, t, x, y, sig, fill, shield));
      }
    this.placeRing();
  }

  private disposeCell(c: Cell) {
    c.node.dispose(false, false);
    c.label?.dispose();
  }

  private buildCell(w: World, t: Tile, x: number, y: number, sig: string, fill: number, shield: boolean): Cell {
    const node = new TransformNode(`casilla-${x}-${y}`, this.scene);
    node.parent = this.root;
    node.position = this.pos(w, x, y);
    node.metadata = { select: { x, y } };
    const rnd = mulberry(x * 92821 + y * 68917);
    if (sig === "fog") {
      // Nubes sobre lo inexplorado, cada una algo distinta para que no se note la cuadrícula.
      this.place(node, this.prefabs.cloud, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4, { rotation: rnd() * 6, scale: 1 + rnd() * 0.45, lift: 0.75 + rnd() * 0.35, floor: true });
      return { sig, node };
    }
    if (sig === "near") return { sig, node };

    const model = this.models.tile(t.kind, Math.floor(rnd() * 100));
    if (model) {
      model.parent = node;
      model.position.y = Math.max(WATER, this.heightAt(node.position.x, node.position.z));
      for (const m of model.getChildMeshes(false)) {
        m.receiveShadows = true;
        this.shadows.addShadowCaster(m, false);
      }
    } else this.props(node, t.kind, fill, rnd);

    let label: Rectangle | undefined;
    const top = this.heightAt(node.position.x, node.position.z);
    if (t.kind === "lair") label = this.badge(node, String(t.level), PALETTE.danger, top + 0.9);
    if (t.kind === "kingdom") {
      label = this.badge(node, `${t.name} · ${t.level}`, "#4b3a6b", top + 1.3);
      if (shield) {
        const dome = MeshBuilder.CreateSphere("escudo", { diameter: 1.2, segments: 12, slice: 0.5 }, this.scene);
        dome.material = this.mats.get("#7fb3d6", { alpha: 0.28, emissive: 0.4 });
        dome.parent = node;
        dome.position.y = top;
        dome.isPickable = false;
      }
    }
    if (label) label.isVisible = this.labelsShown;
    return { sig, node, label };
  }

  /** Coloca un objeto apoyado en el terreno (o flotando `lift` por encima). Los que caerían al agua se omiten. */
  private place(node: TransformNode, prefab: Prefab, dx: number, dz: number, opts: { rotation?: number; scale?: number; lift?: number; floor?: boolean } = {}) {
    let h = this.heightAt(node.position.x + dx, node.position.z + dz);
    if (opts.floor) h = Math.max(h, WATER);
    else if (h < WATER + 0.03) return;
    prefab.place(node, dx, dz, { rotation: opts.rotation, scale: opts.scale, y: h + (opts.lift ?? 0) });
  }

  /** Decorado de una casilla según su tipo. `fill` (0-3) indica cuánto le queda al yacimiento. */
  private props(node: TransformNode, kind: TileKind, fill: number, rnd: () => number) {
    const p = this.prefabs;
    // Posiciones algo fuera de la casilla para que bosques y praderas se mezclen sin bordes rectos.
    const spot = (r = 0.95) => [(rnd() - 0.5) * r, (rnd() - 0.5) * r] as const;
    const put = (prefab: Prefab, scale: number, r?: number) => this.place(node, prefab, ...spot(r), { rotation: rnd() * 6.28, scale });
    switch (kind) {
      case "plain":
        if (rnd() < 0.18) put(rnd() < 0.5 ? p.oak : p.oakLight, 0.45 + rnd() * 0.25, 0.7);
        for (let i = 0; i < 1 + fill; i++) put(rnd() < 0.75 ? p.bush : p.flowers, 0.7 + rnd() * 0.6);
        break;
      case "forest": {
        const trees = 3 + fill * 2;
        for (let i = 0; i < trees; i++) {
          const r = rnd();
          put(r < 0.35 ? p.pine : r < 0.6 ? p.pineDark : r < 0.85 ? p.oak : p.oakLight, 0.38 + rnd() * 0.3, 1.05);
        }
        if (rnd() < 0.5) put(p.bush, 0.9);
        break;
      }
      case "mountain":
        if (rnd() < 0.35) put(p.boulder, 0.7 + rnd() * 0.4, 0.6);
        for (let i = 0; i < Math.ceil(fill / 2); i++) put(p.rock, 0.7 + rnd() * 0.5);
        if (rnd() < 0.5) put(p.pineDark, 0.35, 1.0);
        break;
      case "gold":
        // Cuanto más lleno el yacimiento, más vetas y pepitas brillantes.
        for (let i = 0; i < Math.max(1, fill); i++) put(p.vein, 0.9 + rnd() * 0.5, 0.6);
        for (let i = 0; i < fill * 2; i++) put(p.nugget, 1 + rnd() * 0.6, 0.8);
        break;
      case "lair":
        // La boca de la cueva mira más o menos hacia la cámara inicial.
        this.place(node, p.lair, 0, 0, { rotation: (rnd() - 0.5) * 1.4 });
        put(p.pineDark, 0.4);
        break;
      case "ruins":
        this.place(node, p.ruins, 0, 0, { rotation: rnd() * 6 });
        put(p.bush, 0.8);
        break;
      case "kingdom":
        this.place(node, p.kingdom, 0, 0);
        break;
      case "home":
        this.place(node, p.home, 0, 0, { scale: 1.3 });
        break;
      case "water":
        break;
    }
  }

  /** Guarida: colina de tierra con la boca de una cueva iluminada en rojo, huesos y un árbol seco. */
  private lairParts(): AbstractMesh[] {
    const s = this.scene, k = this.kit;
    const mouth = MeshBuilder.CreateDisc("boca", { radius: 0.17, arc: 0.5, tessellation: 16, sideOrientation: Mesh.DOUBLESIDE }, s);
    mouth.position.set(0, 0.0, -0.34);
    mouth.rotation.x = -0.25;
    mouth.material = this.mats.get("#140b08");
    const fire = MeshBuilder.CreateIcoSphere("fuego", { radius: 0.06, subdivisions: 1 }, s);
    fire.position.set(0, 0.05, -0.31);
    fire.material = this.mats.get("#ff6a2b", { emissive: 1 });
    const parts: AbstractMesh[] = [
      k.rock(0.42, "#6b5b46", 0, -0.14, 0, 3),
      k.rock(0.22, "#5d4f3d", 0.28, -0.08, 0.12, 8),
      mouth, fire,
      k.cyl(0.03, 0.34, PALETTE.woodDark, 0.3, 0, -0.32, 5),
      k.cyl(0.02, 0.16, PALETTE.woodDark, 0.33, 0.24, -0.32, 4),
      k.box(0.09, 0.03, 0.03, "#e8e0cc", -0.24, 0, -0.38, 0.6),
      k.box(0.07, 0.03, 0.03, "#e8e0cc", -0.18, 0, -0.44, -0.4),
    ];
    const skull = MeshBuilder.CreateIcoSphere("craneo", { radius: 0.04, subdivisions: 1 }, s);
    skull.position.set(-0.3, 0.03, -0.42);
    skull.material = this.mats.get("#e8e0cc");
    parts.push(skull);
    return parts;
  }

  private badge(node: TransformNode, text: string, color: string, h: number) {
    const a = new TransformNode("ancla", this.scene);
    a.parent = node;
    a.position.y = h;
    const r = new Rectangle();
    r.adaptWidthToChildren = true;
    r.height = "20px";
    r.cornerRadius = 10;
    r.thickness = 1.5;
    r.color = "#ebe5d4";
    r.background = color;
    r.isPointerBlocker = false;
    const t = new TextBlock();
    t.text = text;
    t.color = "#ebe5d4";
    t.fontSize = 11;
    t.fontFamily = '"IBM Plex Mono", monospace';
    t.resizeToFit = true;
    t.paddingLeft = "7px";
    t.paddingRight = "7px";
    r.addControl(t);
    this.gui.addControl(r);
    r.linkWithMesh(a);
    return r;
  }

  private placeRing() {
    const sel = game.selection?.view === "world" ? game.selection : null;
    this.ring.setEnabled(!!sel);
    if (!sel) return;
    const p = this.pos(game.world, sel.x, sel.y);
    p.y = Math.max(WATER, this.heightAt(p.x, p.z)) + 0.06;
    this.ring.position = p;
  }

  update() {
    const t = performance.now();
    this.fading = this.fading.filter((f) => {
      const k = (t - f.start) / 700;
      if (k >= 1) {
        f.node.dispose(false, false);
        return false;
      }
      f.node.scaling.setAll((1 + 0.35 * k) * (1 - k * k));
      f.node.position.y = k * 0.6;
      return true;
    });
    // Al alejar mucho la cámara, las etiquetas estorban más de lo que ayudan.
    const show = this.camera.radius < 26;
    if (show !== this.labelsShown) {
      this.labelsShown = show;
      this.cells.forEach((c) => c.label && (c.label.isVisible = show));
    }

    // Recolectores yendo y volviendo desde tu reino
    const w = game.world;
    const h = homeOf(w);
    const t0 = now();
    const exps = game.player.expeditions;
    while (this.carts.length < exps.length) {
      const c = (this.cartSource as unknown as { createInstance(n: string): InstancedMesh }).createInstance("recolector");
      this.shadows.addShadowCaster(c, false);
      this.carts.push(c);
    }
    this.carts.forEach((c, i) => {
      const e = exps[i];
      c.setEnabled(!!e);
      if (!e) return;
      const f = Math.min(1, Math.max(0, (t0 - e.start) / (e.end - e.start)));
      const k = f < 0.5 ? f * 2 : 2 - f * 2;
      const p = this.pos(w, h.x + (e.x - h.x) * k, h.y + (e.y - h.y) * k);
      c.position.set(p.x, Math.max(WATER, this.heightAt(p.x, p.z)) + 0.12 + Math.abs(Math.sin(t0 * 6)) * 0.05, p.z);
    });
  }

  dispose() {
    this.unsubscribe();
    this.scene.dispose();
  }
}

// ---------- Utilidades de relieve ----------

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** 0 en `a`, 1 en `b`, suave entre medias (sirve también con a > b). */
const smoothRange = (a: number, b: number, v: number) => smooth(clamp01((v - a) / (b - a)));
const mix = (c: Color3, to: Color3, t: number) => {
  if (t <= 0) return;
  Color3.LerpToRef(c, to, Math.min(1, t), c);
};

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const sx = smooth(x - x0), sy = smooth(y - y0);
  const a = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
  const b = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

/** Ruido suave de 0 a 1 con detalle a varias escalas. */
function fbm(x: number, y: number) {
  return valueNoise(x, y) * 0.55 + valueNoise(x * 2.1 + 5.2, y * 2.1 - 1.7) * 0.3 + valueNoise(x * 4.3 - 3.1, y * 4.3 + 8.4) * 0.15;
}

/** Cambia el material de una pieza (por ejemplo, para que brille). */
function glow<T extends AbstractMesh>(m: T, material: AbstractMesh["material"]): T {
  m.material = material;
  return m;
}
