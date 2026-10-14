import {
  BUILDINGS, TILE_NAMES, attackTile, createPlayer, explore, feed, gather, hatch, startUpgrade, tickPlayer, train,
  type AttackOrders, type Bag, type Battle, type BuildingKey, type Player, type PlayerEvent, type Resource, type UnitKey, type World,
} from "@empire/core";
import { api, ApiError, type Target } from "./api";
import { loadMap } from "./maps";

export type Tab = "reino" | "mapa" | "ejercito" | "informes";
export type Selection = { view: "kingdom"; key: BuildingKey } | { view: "world"; x: number; y: number } | null;

/** Sin conexión: la partida vive en este navegador. Con cuenta: el servidor manda. */
export type Mode = { kind: "local" } | { kind: "online"; token: string; username: string; id: string };

const SAVE_KEY = "empire-save-v3";
const SESSION_KEY = "empire-session";
const SYNC_SECONDS = 15;
/** Mapa de Tiled de las partidas sin conexión (public/maps/mundo.tmj). Si no está, el mapa se genera. */
const LOCAL_MAP = "mundo";

let clockOffset = 0;
/** Hora del juego en segundos. Con cuenta se ajusta a la del servidor. */
export const now = () => Date.now() / 1000 + clockOffset;

export const lootText = (bag: Bag) =>
  (Object.entries(bag) as [Resource, number][])
    .filter(([, v]) => v > 0)
    .map(([r, v]) => `${Math.round(v)} de ${({ gold: "oro", wood: "madera", stone: "piedra", food: "comida" } as const)[r]}`)
    .join(", ") || "nada";

interface ServerPlayer extends Player {
  id: string;
  username: string;
  serverTime: number;
}

class Game {
  /** null hasta que el jugador elige cómo jugar. */
  mode: Mode | null = null;
  player: Player = createPlayer("Tu reino", Math.floor(Math.random() * 1e9), now());
  tab: Tab = "reino";
  selection: Selection = null;
  unread = 0;
  targets: Target[] = [];
  busy = false;
  /** Mapa de Tiled para las partidas nuevas sin conexión. */
  private localMap?: World;
  private lastSync = 0;
  private listeners = new Set<() => void>();
  private toastListeners = new Set<(msg: string, bad: boolean) => void>();

  get kingdom() {
    return this.player.kingdom;
  }
  get world() {
    return this.player.world;
  }
  get online() {
    return this.mode?.kind === "online";
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  onToast(fn: (msg: string, bad: boolean) => void) {
    this.toastListeners.add(fn);
  }
  changed() {
    this.listeners.forEach((fn) => fn());
  }
  toast(msg: string, bad = false) {
    this.toastListeners.forEach((fn) => fn(msg, bad));
  }

  // ---------- Arranque y sesión ----------

  /** Recupera la sesión guardada, si hay. Si no, se queda esperando a la pantalla de acceso. */
  async boot() {
    try {
      this.localMap = (await loadMap(LOCAL_MAP)).world;
    } catch (e) {
      console.warn("Sin mapa de Tiled: se usará un mapa generado.", e);
    }
    const saved = readJson<Mode>(SESSION_KEY);
    if (saved?.kind === "online") {
      try {
        this.adopt((await api.me(saved.token)).player);
        this.mode = saved;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) removeKey(SESSION_KEY);
        else this.toast("No se pudo conectar con el servidor. Puedes jugar sin conexión.", true);
      }
    } else if (saved?.kind === "local") this.playLocal();
    this.changed();
  }

  playLocal() {
    const save = readJson<Player>(SAVE_KEY);
    this.player = save ?? this.newPlayer();
    clockOffset = 0;
    this.mode = { kind: "local" };
    writeJson(SESSION_KEY, this.mode);
    this.changed();
  }

  async login(username: string, password: string, register: boolean, kingdom?: string) {
    const r = register ? await api.register(username, password, kingdom) : await api.login(username, password);
    this.adopt(r.player);
    this.mode = { kind: "online", token: r.token, username: r.player.username, id: r.player.id };
    writeJson(SESSION_KEY, this.mode);
    this.selection = null;
    this.changed();
  }

  async logout() {
    if (this.mode?.kind === "online") await api.logout(this.mode.token).catch(() => undefined);
    removeKey(SESSION_KEY);
    this.mode = null;
    this.selection = null;
    this.changed();
  }

  /** Borra la partida sin conexión. */
  reset() {
    this.player = this.newPlayer();
    this.selection = null;
    this.save();
    this.changed();
  }

  private newPlayer() {
    return createPlayer("Tu reino", Math.floor(Math.random() * 1e9), now(), this.localMap);
  }

  save() {
    if (this.mode?.kind === "local") writeJson(SAVE_KEY, this.player);
  }

  /** Sustituye la partida por la del servidor y avisa de lo nuevo (asaltos recibidos). */
  private adopt(p: ServerPlayer) {
    clockOffset = p.serverTime - Date.now() / 1000;
    const known = this.mode?.kind === "online" ? this.player.reports[0]?.at ?? 0 : Infinity;
    for (const r of p.reports) {
      if (r.at <= known) break;
      if (r.kind === "defense") {
        this.toast(r.won ? `Has rechazado un ataque: ${r.title}.` : `${r.title} y te robó ${lootText(r.loot)}.`, !r.won);
        if (this.tab !== "informes") this.unread++;
      }
    }
    this.player = p;
    this.lastSync = now();
  }

  setTab(tab: Tab) {
    this.tab = tab;
    if (tab === "informes") {
      this.unread = 0;
      if (this.online) void this.loadTargets();
    }
    if (tab === "reino" && this.selection?.view === "world") this.selection = null;
    if (tab === "mapa" && this.selection?.view === "kingdom") this.selection = null;
    this.changed();
  }

  select(sel: Selection) {
    this.selection = sel;
    this.changed();
  }

  // ---------- Tiempo ----------

  /** Avanza el reloj. Sin conexión decide también los asaltos; con cuenta solo anima y resincroniza. */
  tick() {
    if (!this.mode) return;
    const events = tickPlayer(this.player, now(), { raids: !this.online });
    for (const e of events) this.announce(e);
    if (events.length) {
      this.save();
      this.changed();
    }
    if (this.online && !this.busy && now() - this.lastSync > SYNC_SECONDS) void this.sync();
  }

  private async sync() {
    if (this.mode?.kind !== "online") return;
    this.lastSync = now();
    try {
      this.adopt((await api.me(this.mode.token)).player);
      this.changed();
    } catch (e) {
      this.handleError(e);
    }
  }

  private announce(e: PlayerEvent) {
    switch (e.type) {
      case "upgraded":
        return this.toast(`${BUILDINGS[e.key].name} sube a nivel ${e.level}.`);
      case "hatched":
        return this.toast(`¡Tu huevo ha eclosionado! Ha nacido ${e.name}.`);
      case "expedition":
        return this.toast(`Los recolectores vuelven con ${lootText(e.loot)}.`);
      case "raid":
        if (this.tab !== "informes") this.unread++;
        return this.toast(e.lost ? `${e.from} ha saqueado tu reino. Revisa Informes.` : `Has rechazado el ataque de ${e.from}.`, e.lost);
    }
  }

  // ---------- Acciones ----------

  private handleError(e: unknown) {
    if (e instanceof ApiError) {
      if (e.status === 401) {
        removeKey(SESSION_KEY);
        this.mode = null;
        this.changed();
      }
      this.toast(e.message, true);
    } else this.toast("No se pudo conectar con el servidor.", true);
  }

  /**
   * Ejecuta una acción: sin conexión, con las reglas de core sobre la partida local;
   * con cuenta, pidiéndosela al servidor y quedándose con su respuesta.
   */
  private async act<T>(local: () => { ok: true; value?: T } | { ok: false; reason: string }, remote: (token: string) => Promise<{ player: ServerPlayer; battle?: T }>): Promise<T | undefined> {
    if (this.mode?.kind === "online") {
      if (this.busy) return;
      this.busy = true;
      this.changed();
      try {
        const r = await remote(this.mode.token);
        this.adopt(r.player);
        return r.battle;
      } catch (e) {
        this.handleError(e);
      } finally {
        this.busy = false;
        this.changed();
      }
      return;
    }
    const r = local();
    if (!r.ok) this.toast(r.reason, true);
    this.save();
    this.changed();
    return r.ok ? r.value : undefined;
  }

  upgrade(key: BuildingKey) {
    return this.act(() => startUpgrade(this.kingdom, key, now()), (t) => api.post(t, "/api/me/upgrade", { building: key }));
  }
  train(unit: UnitKey, count: number) {
    return this.act(() => train(this.kingdom, unit, count, now()), (t) => api.post(t, "/api/me/train", { unit, count }));
  }
  hatch() {
    return this.act(() => hatch(this.kingdom, now()), (t) => api.post(t, "/api/me/dragon", { action: "hatch" }));
  }
  feed() {
    return this.act(() => feed(this.kingdom), (t) => api.post(t, "/api/me/dragon", { action: "feed" }));
  }
  explore(x: number, y: number) {
    return this.act(() => explore(this.player, x, y), (t) => api.post(t, "/api/me/explore", { x, y }));
  }
  gather(x: number, y: number) {
    return this.act(() => gather(this.player, x, y, now()), (t) => api.post(t, "/api/me/gather", { x, y }));
  }
  attackTile(x: number, y: number, orders: AttackOrders): Promise<Battle | undefined> {
    return this.act<Battle>(() => attackTile(this.player, x, y, orders, now()), (t) => api.post(t, "/api/me/attack-tile", { x, y, orders }));
  }
  attackPlayer(defenderId: string, orders: AttackOrders): Promise<Battle | undefined> {
    return this.act<Battle>(() => ({ ok: false, reason: "Necesitas una cuenta para atacar a otros jugadores" }), async (t) => {
      const r = await api.post<{ player: ServerPlayer; battle: Battle }>(t, "/api/me/attack-player", { defenderId, orders });
      this.targets = this.targets.filter((x) => x.id !== defenderId);
      return r;
    });
  }

  async loadTargets() {
    if (this.mode?.kind !== "online") return;
    try {
      this.targets = (await api.targets(this.mode.token)).targets;
      this.changed();
    } catch (e) {
      this.handleError(e);
    }
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: la partida dura lo que la pestaña */
  }
}
function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nada que borrar */
  }
}

export { TILE_NAMES };
export type { Battle };
export const game = new Game();
