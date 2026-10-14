import { randomInt } from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import {
  BUILDING_KEYS, UNIT_KEYS, addReport, attackTile, createPlayer, explore, feed, gather, hatch, power, resolvePvp, startUpgrade,
  tickPlayer, train, validateOrders,
  type AttackOrders, type BuildingKey, type Player, type UnitKey, type World,
} from "@empire/core";
import { SESSION_SECONDS, checkPassword, credentialsProblem, hashPassword, newToken } from "./auth";
import { Store } from "./store";

export interface AppOptions {
  store?: Store;
  /** Reloj en segundos; se puede sustituir en los tests. */
  clock?: () => number;
  /** Semilla de cada batalla y de cada mapa nuevo; la decide siempre el servidor. */
  seed?: () => number;
  /** Mapa de Tiled para las partidas nuevas. Sin él, cada jugador recibe un mapa generado. */
  world?: World;
}

/** Rango de poder en el que se puede elegir rival (70 % a 130 % del tuyo). */
export const MATCH_RANGE = [0.7, 1.3] as const;

type Authed = FastifyRequest & { accountId: string };

/**
 * Lo que ve el cliente de su partida. Las casillas sin explorar se mandan vacías
 * para que nadie pueda leer el mapa escondido en la respuesta.
 */
export function playerView(id: string, username: string, p: Player, serverTime: number) {
  const tiles = p.world.tiles.map((t) => (t.seen ? t : { kind: "plain" as const, seen: false, level: t.level }));
  return { id, username, power: power(p.kingdom), serverTime, ...p, world: { ...p.world, seed: 0, tiles }, seed: 0 };
}
export type PlayerView = ReturnType<typeof playerView>;

export function buildApp(opts: AppOptions = {}) {
  const store = opts.store ?? new Store();
  const clock = opts.clock ?? (() => Date.now() / 1000);
  const seed = opts.seed ?? (() => randomInt(2 ** 31 - 1));
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });

  // El cliente puede estar en otro origen (la app móvil); usamos tokens, no cookies.
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Headers", "content-type, authorization");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return reply.code(204).send();
  });

  const d = () => store.data;
  const bad = (reply: FastifyReply, code: number, error: string) => reply.code(code).send({ error });

  /** Comprueba el token y deja el id de cuenta en la petición. */
  const auth = async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const s = d().sessions[token];
    if (!s || s.expiresAt < clock()) return bad(reply, 401, "Inicia sesión de nuevo");
    (req as Authed).accountId = s.accountId;
  };

  /** Carga la partida del jugador y la pone al día (incluidos los asaltos de la IA). */
  const me = (req: FastifyRequest) => {
    const id = (req as Authed).accountId;
    const p = d().players[id];
    tickPlayer(p, clock());
    return { id, p };
  };
  const view = (id: string) => playerView(id, d().accounts[id].username, d().players[id], clock());
  const done = (id: string) => {
    store.changed();
    return { player: view(id) };
  };

  const startSession = (accountId: string) => {
    const token = newToken();
    const now = clock();
    for (const [t, s] of Object.entries(d().sessions)) if (s.expiresAt < now) delete d().sessions[t];
    d().sessions[token] = { accountId, expiresAt: now + SESSION_SECONDS };
    return token;
  };

  app.get("/api/health", async () => ({ ok: true }));

  // ---------- Cuentas ----------
  app.post<{ Body: { username?: string; password?: string; kingdom?: string } }>("/api/auth/register", async (req, reply) => {
    const { username, password } = req.body ?? {};
    const problem = credentialsProblem(username, password);
    if (problem) return bad(reply, 400, problem);
    if (store.findAccount(username!)) return bad(reply, 409, "Ese usuario ya existe");
    const id = store.newId();
    const { salt, hash } = hashPassword(password!);
    d().accounts[id] = { id, username: username!, passwordHash: hash, salt, createdAt: clock() };
    const kingdomName = (req.body?.kingdom ?? "").trim().slice(0, 30) || `Reino de ${username}`;
    d().players[id] = createPlayer(kingdomName, seed(), clock(), opts.world);
    const token = startSession(id);
    store.changed();
    return reply.code(201).send({ token, player: view(id) });
  });

  app.post<{ Body: { username?: string; password?: string } }>("/api/auth/login", async (req, reply) => {
    const { username, password } = req.body ?? {};
    const account = typeof username === "string" ? store.findAccount(username) : undefined;
    if (!account || typeof password !== "string" || !checkPassword(password, account.salt, account.passwordHash))
      return bad(reply, 401, "Usuario o contraseña incorrectos");
    const token = startSession(account.id);
    tickPlayer(d().players[account.id], clock());
    store.changed();
    return { token, player: view(account.id) };
  });

  app.post("/api/auth/logout", { preHandler: auth }, async (req) => {
    const token = req.headers.authorization!.replace(/^Bearer /, "");
    delete d().sessions[token];
    store.changed();
    return { ok: true };
  });

  // ---------- Tu partida ----------
  app.get("/api/me", { preHandler: auth }, async (req) => {
    const { id } = me(req);
    return done(id);
  });

  app.post<{ Body: { building: BuildingKey } }>("/api/me/upgrade", { preHandler: auth }, async (req, reply) => {
    const { id, p } = me(req);
    if (!BUILDING_KEYS.includes(req.body?.building)) return bad(reply, 400, "Edificio desconocido");
    const r = startUpgrade(p.kingdom, req.body.building, clock());
    return r.ok ? done(id) : bad(reply, 409, r.reason);
  });

  app.post<{ Body: { unit: UnitKey; count: number } }>("/api/me/train", { preHandler: auth }, async (req, reply) => {
    const { id, p } = me(req);
    const { unit, count } = req.body ?? ({} as { unit: UnitKey; count: number });
    if (!UNIT_KEYS.includes(unit) || !Number.isInteger(count) || count < 1 || count > 100) return bad(reply, 400, "Orden de entrenamiento no válida");
    const r = train(p.kingdom, unit, count, clock());
    return r.ok ? done(id) : bad(reply, 409, r.reason);
  });

  app.post<{ Body: { action: "hatch" | "feed" } }>("/api/me/dragon", { preHandler: auth }, async (req, reply) => {
    const { id, p } = me(req);
    const action = req.body?.action;
    if (action !== "hatch" && action !== "feed") return bad(reply, 400, "Acción desconocida");
    const r = action === "hatch" ? hatch(p.kingdom, clock(), seed() / 2 ** 31) : feed(p.kingdom);
    return r.ok ? done(id) : bad(reply, 409, r.reason);
  });

  const isCoord = (v: unknown) => Number.isInteger(v);

  app.post<{ Body: { x: number; y: number } }>("/api/me/explore", { preHandler: auth }, async (req, reply) => {
    const { id, p } = me(req);
    if (!isCoord(req.body?.x) || !isCoord(req.body?.y)) return bad(reply, 400, "Casilla no válida");
    const r = explore(p, req.body.x, req.body.y);
    return r.ok ? done(id) : bad(reply, 409, r.reason);
  });

  app.post<{ Body: { x: number; y: number } }>("/api/me/gather", { preHandler: auth }, async (req, reply) => {
    const { id, p } = me(req);
    if (!isCoord(req.body?.x) || !isCoord(req.body?.y)) return bad(reply, 400, "Casilla no válida");
    const r = gather(p, req.body.x, req.body.y, clock());
    return r.ok ? done(id) : bad(reply, 409, r.reason);
  });

  const cleanOrders = (o: AttackOrders | undefined): AttackOrders => ({ units: o?.units && typeof o.units === "object" ? o.units : {}, dragon: !!o?.dragon });

  app.post<{ Body: { x: number; y: number; orders: AttackOrders } }>("/api/me/attack-tile", { preHandler: auth }, async (req, reply) => {
    const { id, p } = me(req);
    if (!isCoord(req.body?.x) || !isCoord(req.body?.y)) return bad(reply, 400, "Casilla no válida");
    const r = attackTile(p, req.body.x, req.body.y, cleanOrders(req.body.orders), clock());
    if (!r.ok) return bad(reply, 409, r.reason);
    return { battle: r.value, ...done(id) };
  });

  // ---------- Contra otros jugadores ----------
  /** Rivales que puedes atacar: en tu rango de poder y sin escudo. */
  app.get("/api/me/targets", { preHandler: auth }, async (req) => {
    const { id, p } = me(req);
    const mine = power(p.kingdom);
    const now = clock();
    const targets = Object.entries(d().players)
      .filter(([other]) => other !== id)
      .map(([other, q]) => {
        tickPlayer(q, now);
        return { id: other, username: d().accounts[other].username, name: q.kingdom.name, power: power(q.kingdom), castle: q.kingdom.buildings.castle, shielded: q.kingdom.shieldUntil > now };
      })
      .filter((t) => !t.shielded && t.power >= mine * MATCH_RANGE[0] && t.power <= mine * MATCH_RANGE[1])
      .sort((a, b) => b.power - a.power)
      .slice(0, 20);
    store.changed();
    return { targets };
  });

  /**
   * Ataque PvP asíncrono. El cliente solo envía qué tropas manda; el servidor elige la semilla,
   * simula la batalla y devuelve las rondas para que el cliente la reproduzca.
   */
  app.post<{ Body: { defenderId: string; orders: AttackOrders } }>("/api/me/attack-player", { preHandler: auth }, async (req, reply) => {
    const { id, p } = me(req);
    const defenderId = String(req.body?.defenderId ?? "");
    const q = d().players[defenderId];
    if (defenderId === id) return bad(reply, 400, "No puedes atacarte a ti mismo");
    if (!q) return bad(reply, 404, "Reino no encontrado");
    const now = clock();
    tickPlayer(q, now);
    if (q.kingdom.shieldUntil > now) return bad(reply, 409, "El reino tiene escudo");
    const mine = power(p.kingdom), theirs = power(q.kingdom);
    if (theirs < mine * MATCH_RANGE[0] || theirs > mine * MATCH_RANGE[1]) return bad(reply, 409, "Rival fuera de tu rango de poder");
    const orders = cleanOrders(req.body?.orders);
    const invalid = validateOrders(p.kingdom, orders, now);
    if (invalid) return bad(reply, 400, invalid);

    const battleSeed = seed();
    const { result, loot } = resolvePvp(p.kingdom, q.kingdom, orders, battleSeed, now);
    const title = `Ataque a ${q.kingdom.name}`;
    addReport(p, { at: now, kind: "attack", won: result.attackerWon, stars: result.stars, title, loot, lost: result.attackerLosses.filter((l) => l.lost > 0 && l.key !== "dragon") });
    addReport(q, { at: now, kind: "defense", won: !result.attackerWon, stars: result.stars, title: `${p.kingdom.name} atacó tu reino`, loot, lost: result.defenderLosses.filter((l) => l.lost > 0 && l.key !== "dragon") });
    return { battle: { title, seed: battleSeed, result, loot }, ...done(id) };
  });

  return app;
}
