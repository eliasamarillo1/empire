import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { externalTilesets, withTilesets, worldFromTiled, type TiledMap, type TiledTileset, type World } from "@empire/core";

/** Mapa de ejemplo que también sirve el cliente (apps/client/public/maps). */
export const DEFAULT_MAP_FILE = resolve(dirname(new URL(import.meta.url).pathname), "../../client/public/maps/mundo.tmj");

/**
 * Lee un mapa de Tiled (.tmj) con sus tilesets externos (.tsj) y lo convierte en mapa del mundo.
 * El nombre del mapa es el del archivo, para que el cliente cargue el mismo desde maps/<nombre>.tmj.
 */
export function loadTiledWorld(file: string): World {
  const read = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
  const map = read<TiledMap>(file);
  const loaded: Record<string, TiledTileset> = {};
  for (const src of externalTilesets(map)) loaded[src] = read<TiledTileset>(resolve(dirname(file), src));
  return worldFromTiled(withTilesets(map, loaded), basename(file, extname(file)));
}

/** El mapa que usarán las partidas nuevas: el de MAP_FILE, el de ejemplo, o ninguno (mapa generado). */
export function mapFromEnv(env: string | undefined): World | undefined {
  if (env === "") return undefined;
  const file = env ?? DEFAULT_MAP_FILE;
  if (!env && !existsSync(file)) return undefined;
  return loadTiledWorld(file);
}
