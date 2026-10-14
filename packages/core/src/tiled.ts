import { distance, initTile, tileAt, type Tile, type TileKind, type World } from "./world";

/*
 * Lectura de mapas hechos con Tiled (https://www.mapeditor.org), guardados en JSON (.tmj).
 *
 * Convenciones (ver docs/mapas-tiled.md):
 * - El mapa es cuadrado, no infinito, y sus capas de casillas usan el formato CSV.
 * - Cada casilla del tileset dice qué es con su clase (o una propiedad `tipo`):
 *   pradera, bosque, montaña, oro, agua, guarida o ruinas.
 * - Las capas de casillas se aplican de abajo arriba: la última casilla con tipo gana.
 * - En capas de objetos, un objeto de clase `inicio` marca tu reino y uno de clase `reino`
 *   coloca un reino rival (su nombre es el del objeto). Cualquier otro tipo también vale como objeto.
 * - La propiedad `nivel` (en casillas u objetos) fija el nivel en lugar de calcularlo por distancia.
 */

export interface TiledProperty {
  name: string;
  type?: string;
  value: unknown;
}

export interface TiledTile {
  id: number;
  type?: string;
  class?: string;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  properties?: TiledProperty[];
}

export interface TiledTileset {
  firstgid?: number;
  /** Tileset externo (.tsj) sin resolver. */
  source?: string;
  name?: string;
  tilewidth?: number;
  tileheight?: number;
  tilecount?: number;
  columns?: number;
  margin?: number;
  spacing?: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  tileoffset?: { x: number; y: number };
  tiles?: TiledTile[];
}

export interface TiledObject {
  id: number;
  name?: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
  gid?: number;
  properties?: TiledProperty[];
}

export interface TiledLayer {
  type: "tilelayer" | "objectgroup" | "imagelayer" | "group";
  name: string;
  visible?: boolean;
  width?: number;
  height?: number;
  data?: number[] | string;
  encoding?: string;
  chunks?: unknown[];
  objects?: TiledObject[];
  layers?: TiledLayer[];
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: string;
  infinite?: boolean;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
}

export class TiledError extends Error {}

/** Bits altos de cada gid: volteos de la casilla. */
export const GID_MASK = 0x0fffffff;
export const FLIP_X = 0x80000000;

const KIND_ALIASES: Record<string, TileKind> = {
  pradera: "plain", hierba: "plain", llanura: "plain", plain: "plain", grass: "plain",
  bosque: "forest", forest: "forest",
  montana: "mountain", mountain: "mountain",
  oro: "gold", mina: "gold", gold: "gold",
  agua: "water", lago: "water", water: "water",
  guarida: "lair", lair: "lair",
  ruinas: "ruins", ruins: "ruins",
  reino: "kingdom", kingdom: "kingdom",
  inicio: "home", home: "home",
};

/** Normaliza un nombre de tipo (sin tildes ni mayúsculas) a un tipo de casilla del juego. */
export function parseKind(name: unknown): TileKind | undefined {
  if (typeof name !== "string") return undefined;
  const key = name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return KIND_ALIASES[key];
}

const prop = (props: TiledProperty[] | undefined, name: string) => props?.find((p) => p.name.toLowerCase() === name)?.value;
const levelProp = (props: TiledProperty[] | undefined) => {
  const v = Number(prop(props, "nivel") ?? prop(props, "level"));
  return Number.isFinite(v) && v >= 1 ? Math.round(v) : undefined;
};
const kindOf = (o: { type?: string; class?: string; properties?: TiledProperty[] }) =>
  parseKind(prop(o.properties, "tipo") ?? prop(o.properties, "kind")) ?? parseKind(o.class) ?? parseKind(o.type);

/** Tilesets externos que hay que cargar antes de leer el mapa. */
export const externalTilesets = (map: TiledMap) => map.tilesets.filter((t) => t.source && !t.tiles && !t.image).map((t) => t.source!);

/** Sustituye los tilesets externos por su contenido ya cargado (manteniendo su `firstgid`). */
export function withTilesets(map: TiledMap, loaded: Record<string, TiledTileset>): TiledMap {
  return {
    ...map,
    tilesets: map.tilesets.map((t) => (t.source && loaded[t.source] ? { ...loaded[t.source], firstgid: t.firstgid, source: t.source } : t)),
  };
}

/** Busca la casilla de tileset a la que apunta un gid. */
export function tileForGid(map: TiledMap, gid: number): { tileset: TiledTileset; id: number; tile?: TiledTile } | undefined {
  const g = gid & GID_MASK;
  if (!g) return undefined;
  let best: TiledTileset | undefined;
  for (const ts of map.tilesets) if ((ts.firstgid ?? 1) <= g && (!best || (ts.firstgid ?? 1) > (best.firstgid ?? 1))) best = ts;
  if (!best) return undefined;
  const id = g - (best.firstgid ?? 1);
  return { tileset: best, id, tile: best.tiles?.find((t) => t.id === id) };
}

/** Capas de casillas visibles, en el orden en que Tiled las dibuja (también dentro de grupos). */
export function tileLayers(map: TiledMap): TiledLayer[] {
  const out: TiledLayer[] = [];
  const walk = (layers: TiledLayer[]) => {
    for (const l of layers) {
      if (l.visible === false) continue;
      if (l.type === "group") walk(l.layers ?? []);
      else if (l.type === "tilelayer") out.push(l);
    }
  };
  walk(map.layers);
  return out;
}

function objectLayers(map: TiledMap): TiledLayer[] {
  const out: TiledLayer[] = [];
  const walk = (layers: TiledLayer[]) => {
    for (const l of layers) {
      if (l.type === "group") walk(l.layers ?? []);
      else if (l.type === "objectgroup") out.push(l);
    }
  };
  walk(map.layers);
  return out;
}

function layerData(map: TiledMap, l: TiledLayer): number[] {
  if (l.chunks || map.infinite) throw new TiledError("El mapa es infinito. Desactiva «Infinito» en las propiedades del mapa.");
  if (l.encoding && l.encoding !== "csv") throw new TiledError(`La capa «${l.name}» está comprimida. Cambia el formato de capa a CSV en las propiedades del mapa.`);
  if (!Array.isArray(l.data) || l.data.length !== map.width * map.height) throw new TiledError(`La capa «${l.name}» no tiene el tamaño del mapa.`);
  return l.data;
}

/** Casilla del mapa que ocupa un objeto de Tiled. */
export function objectCell(map: TiledMap, o: TiledObject) {
  // Los objetos con imagen se anclan por su borde inferior (en isométrico, por la esquina sur de la casilla).
  const y = o.gid ? o.y - 1 : o.y;
  if (map.orientation === "isometric") {
    const x = o.gid ? o.x - 1 : o.x;
    return { x: Math.floor(x / map.tileheight), y: Math.floor(y / map.tileheight) };
  }
  return { x: Math.floor(o.x / map.tilewidth), y: Math.floor(y / map.tileheight) };
}

/**
 * Convierte un mapa de Tiled en el mapa del mundo del juego.
 * `name` identifica el mapa para que el cliente cargue sus imágenes (maps/<name>.tmj).
 */
export function worldFromTiled(map: TiledMap, name: string): World {
  if (map.width !== map.height) throw new TiledError(`El mapa tiene que ser cuadrado (ahora es ${map.width} × ${map.height}).`);
  if (map.width < 7 || map.width > 200) throw new TiledError("El mapa tiene que medir entre 7 y 200 casillas de lado.");
  const missing = externalTilesets(map);
  if (missing.length) throw new TiledError(`Falta cargar el tileset ${missing[0]}.`);

  const size = map.width;
  const kinds: (TileKind | undefined)[] = new Array(size * size).fill(undefined);
  const levels: (number | undefined)[] = new Array(size * size).fill(undefined);
  const base: (TileKind | undefined)[] = new Array(size * size).fill(undefined);
  const names: (string | undefined)[] = new Array(size * size).fill(undefined);

  for (const layer of tileLayers(map)) {
    const data = layerData(map, layer);
    for (let i = 0; i < data.length; i++) {
      const tile = tileForGid(map, data[i])?.tile;
      if (!tile) continue;
      const k = kindOf(tile);
      if (!k) continue;
      kinds[i] = k;
      if (k === "plain" || k === "forest" || k === "mountain" || k === "gold" || k === "water") base[i] = k;
      levels[i] = levelProp(tile.properties) ?? levels[i];
    }
  }

  let home: { x: number; y: number } | undefined;
  for (const layer of objectLayers(map))
    for (const o of layer.objects ?? []) {
      const k = kindOf(o) ?? (o.gid ? kindOf(tileForGid(map, o.gid)?.tile ?? { id: 0 }) : undefined);
      if (!k) continue;
      const { x, y } = objectCell(map, o);
      if (x < 0 || y < 0 || x >= size || y >= size) throw new TiledError(`El objeto «${o.name || k}» está fuera del mapa.`);
      if (k === "home") {
        if (home) throw new TiledError("Solo puede haber un objeto «inicio».");
        home = { x, y };
        continue;
      }
      const i = y * size + x;
      kinds[i] = k;
      levels[i] = levelProp(o.properties) ?? levels[i];
      if (o.name) names[i] = o.name;
    }

  home ??= { x: Math.floor(size / 2), y: Math.floor(size / 2) };
  const w: World = { size, seed: 0, tiles: [], home, map: name };
  for (let i = 0; i < size * size; i++) {
    const t: Tile = { kind: kinds[i] ?? "plain", seen: false, level: 1 };
    if (base[i] && base[i] !== t.kind) t.base = base[i];
    w.tiles.push(t);
  }
  const h = tileAt(w, home.x, home.y)!;
  h.kind = "home";

  let unnamed = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const t = tileAt(w, x, y)!;
      if (t.kind === "kingdom") t.name = names[i] ?? `Reino sin nombre ${++unnamed}`;
      initTile(t, distance(w, x, y), t.kind === "home" ? undefined : levels[i]);
    }
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const t = tileAt(w, home.x + i, home.y + j);
    if (t) t.seen = true;
  }
  return w;
}
