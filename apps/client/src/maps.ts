import { externalTilesets, withTilesets, worldFromTiled, type TiledMap, type TiledTileset, type World } from "@empire/core";

/** Un mapa de Tiled ya cargado, con las rutas de sus imágenes resueltas. */
export interface LoadedMap {
  name: string;
  map: TiledMap;
  world: World;
}

const cache = new Map<string, Promise<LoadedMap>>();

/** Pone rutas absolutas a las imágenes de un tileset (Tiled las guarda relativas a su archivo). */
function absolutize(ts: TiledTileset, base: string): TiledTileset {
  const abs = (p?: string) => (p ? new URL(p, base).href : p);
  return { ...ts, image: abs(ts.image), tiles: ts.tiles?.map((t) => ({ ...t, image: abs(t.image) })) };
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar ${url}`);
  return (await r.json()) as T;
}

/** Carga maps/<name>.tmj y sus tilesets externos. Se guarda en caché: cada mapa se descarga una vez. */
export function loadMap(name: string): Promise<LoadedMap> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      const url = new URL(`maps/${name}.tmj`, document.baseURI).href;
      const raw = await fetchJson<TiledMap>(url);
      const loaded: Record<string, TiledTileset> = {};
      for (const src of externalTilesets(raw)) {
        const tsUrl = new URL(src, url).href;
        loaded[src] = absolutize(await fetchJson<TiledTileset>(tsUrl), tsUrl);
      }
      const resolved = withTilesets(raw, loaded);
      const map = { ...resolved, tilesets: resolved.tilesets.map((t) => (t.source ? t : absolutize(t, url))) };
      return { name, map, world: worldFromTiled(map, name) };
    })();
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p;
}
