import { LoadAssetContainerAsync, TransformNode, type AssetContainer, type Scene } from "@babylonjs/core";
import type { BuildingKey, TileKind } from "@empire/core";

/*
 * Modelos 3D comprados o descargados (glTF / .glb), descritos en public/models/modelos.json.
 * Si un edificio o una casilla no aparece ahí, se usa el modelo provisional hecho en código (kit.ts).
 * Formato y ejemplo en public/models/LEEME.md.
 */

interface ModelEntry {
  /** Archivo dentro de public/models. */
  archivo: string;
  /** A partir de qué nivel se usa este modelo (para edificios con varios aspectos). */
  desde?: number;
  escala?: number;
  /** Giro en grados alrededor del eje vertical. */
  giro?: number;
  /** Desplazamiento vertical, en casillas. */
  altura?: number;
}

interface Manifest {
  edificios?: Partial<Record<BuildingKey, ModelEntry | ModelEntry[]>>;
  casillas?: Partial<Record<TileKind, ModelEntry | ModelEntry[]>>;
}

let manifestPromise: Promise<Manifest> | undefined;
function loadManifest(): Promise<Manifest> {
  manifestPromise ??= fetch(new URL("models/modelos.json", document.baseURI))
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : {}))
    .catch(() => ({}));
  return manifestPromise;
}

const list = (e?: ModelEntry | ModelEntry[]) => (e ? (Array.isArray(e) ? e : [e]) : []).sort((a, b) => (a.desde ?? 0) - (b.desde ?? 0));

/** Modelos cargados para una escena. Cada vista tiene la suya porque Babylon no comparte mallas entre escenas. */
export class ModelLibrary {
  private manifest: Manifest = {};
  private containers = new Map<string, AssetContainer>();
  /** Cambia cada vez que termina de cargar algo, para que las vistas se redibujen. */
  version = 0;
  readonly ready: Promise<void>;

  constructor(private scene: Scene) {
    this.ready = this.load();
  }

  private async load() {
    this.manifest = await loadManifest();
    const files = new Set<string>();
    for (const group of [this.manifest.edificios, this.manifest.casillas])
      for (const e of Object.values(group ?? {})) for (const m of list(e)) files.add(m.archivo);
    if (!files.size) return;
    await import("@babylonjs/loaders/glTF");
    await Promise.all(
      [...files].map(async (file) => {
        try {
          const url = new URL(`models/${file}`, document.baseURI).href;
          this.containers.set(file, await LoadAssetContainerAsync(url, this.scene));
        } catch (e) {
          console.warn(`No se pudo cargar el modelo ${file}; se usa el provisional.`, e);
        }
      }),
    );
    this.version++;
  }

  private instance(entry: ModelEntry | undefined, name: string) {
    const c = entry && this.containers.get(entry.archivo);
    if (!c) return undefined;
    const root = new TransformNode(name, this.scene);
    const inst = c.instantiateModelsToScene((n) => `${name}-${n}`, false, { doNotInstantiate: true });
    for (const n of inst.rootNodes) n.parent = root;
    root.scaling.setAll(entry.escala ?? 1);
    root.rotation.y = ((entry.giro ?? 0) * Math.PI) / 180;
    root.position.y = entry.altura ?? 0;
    const holder = new TransformNode(`${name}-modelo`, this.scene);
    root.parent = holder;
    return holder;
  }

  /** Modelo de un edificio para su nivel, o undefined si no hay ninguno cargado. */
  building(key: BuildingKey, level: number) {
    if (level <= 0) return undefined;
    const entries = list(this.manifest.edificios?.[key]).filter((e) => (e.desde ?? 1) <= level);
    return this.instance(entries[entries.length - 1], `edificio-${key}`);
  }

  /** Modelo de una casilla del mapa del mundo, o undefined si no hay ninguno cargado. */
  tile(kind: TileKind, variant: number) {
    const entries = list(this.manifest.casillas?.[kind]);
    return this.instance(entries[variant % Math.max(1, entries.length)], `casilla-${kind}`);
  }
}
