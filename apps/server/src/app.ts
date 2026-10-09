import Fastify from "fastify";
import {
  BUILDING_KEYS, UNIT_KEYS, advance, createKingdom, hatch, feed, power, resolvePvp, startUpgrade, train, validateOrders,
  type AttackOrders, type BuildingKey, type Kingdom, type UnitKey,
} from "@empire/core";
import { memoryStore, type KingdomStore } from "./store";

export interface AppOptions {
  store?: KingdomStore;
  /** Reloj en segundos; se puede sustituir en los tests. */
  clock?: () => number;
  /** Semilla de cada batalla; la decide siempre el servidor. */
  seed?: () => number;
}

/** Rango de poder en el que se puede elegir rival (70 % a 130 % del tuyo). */
export const MATCH_RANGE = [0.7, 1.3] as const;

export function buildApp(opts: AppOptions = {}) {
  const store = opts.store ?? memoryStore();
  const clock = opts.clock ?? (() => Date.now() / 1000);
  const seed = opts.seed ?? (() => Math.floor(Math.random() * 2 ** 31));
  const app = Fastify({ logger: false });

  /** Carga un reino y lo pone al día antes de cualquier acción. */
  const load = (id: string): Kingdom | undefined => {
    const k = store.get(id);
    if (k) advance(k, clock());
    return k;
  };
  const view = (id: string, k: Kingdom) => ({ id, power: power(k), kingdom: k });

  app.get("/api/health", async () => ({ ok: true }));

  app.post<{ Body: { name?: string } }>("/api/kingdoms", async (req, reply) => {
    const name = (req.body?.name ?? "").trim().slice(0, 30) || "Reino sin nombre";
    const k = createKingdom(name, clock());
    const id = store.create(k);
    return reply.code(201).send(view(id, k));
  });

  app.get<{ Params: { id: string } }>("/api/kingdoms/:id", async (req, reply) => {
    const k = load(req.params.id);
    if (!k) return reply.code(404).send({ error: "Reino no encontrado" });
    return view(req.params.id, k);
  });

  app.post<{ Params: { id: string }; Body: { building: BuildingKey } }>("/api/kingdoms/:id/upgrade", async (req, reply) => {
    const k = load(req.params.id);
    if (!k) return reply.code(404).send({ error: "Reino no encontrado" });
    if (!BUILDING_KEYS.includes(req.body?.building)) return reply.code(400).send({ error: "Edificio desconocido" });
    const r = startUpgrade(k, req.body.building, clock());
    return r.ok ? view(req.params.id, k) : reply.code(409).send({ error: r.reason });
  });

  app.post<{ Params: { id: string }; Body: { unit: UnitKey; count: number } }>("/api/kingdoms/:id/train", async (req, reply) => {
    const k = load(req.params.id);
    if (!k) return reply.code(404).send({ error: "Reino no encontrado" });
    const { unit, count } = req.body ?? ({} as { unit: UnitKey; count: number });
    if (!UNIT_KEYS.includes(unit) || !Number.isInteger(count) || count < 1 || count > 100)
      return reply.code(400).send({ error: "Orden de entrenamiento no válida" });
    const r = train(k, unit, count, clock());
    return r.ok ? view(req.params.id, k) : reply.code(409).send({ error: r.reason });
  });

  app.post<{ Params: { id: string }; Body: { action: "hatch" | "feed" } }>("/api/kingdoms/:id/dragon", async (req, reply) => {
    const k = load(req.params.id);
    if (!k) return reply.code(404).send({ error: "Reino no encontrado" });
    const r = req.body?.action === "hatch" ? hatch(k, clock()) : req.body?.action === "feed" ? feed(k) : { ok: false as const, reason: "Acción desconocida" };
    return r.ok ? view(req.params.id, k) : reply.code(409).send({ error: r.reason });
  });

  /** Rivales que puedes atacar: en tu rango de poder y sin escudo. */
  app.get<{ Params: { id: string } }>("/api/kingdoms/:id/targets", async (req, reply) => {
    const me = load(req.params.id);
    if (!me) return reply.code(404).send({ error: "Reino no encontrado" });
    const p = power(me);
    const now = clock();
    const targets = store
      .list()
      .filter(([id]) => id !== req.params.id)
      .map(([id, k]) => (advance(k, now), { id, name: k.name, power: power(k), castle: k.buildings.castle, shielded: k.shieldUntil > now }))
      .filter((t) => !t.shielded && t.power >= p * MATCH_RANGE[0] && t.power <= p * MATCH_RANGE[1]);
    return { targets };
  });

  /**
   * Ataque PvP asíncrono. El cliente solo envía qué tropas manda; el servidor elige la semilla,
   * simula la batalla y devuelve las rondas para que el cliente la reproduzca.
   */
  app.post<{ Body: { attackerId: string; defenderId: string; orders: AttackOrders } }>("/api/attacks", async (req, reply) => {
    const { attackerId, defenderId, orders } = req.body ?? ({} as never);
    if (attackerId === defenderId) return reply.code(400).send({ error: "No puedes atacarte a ti mismo" });
    const attacker = load(attackerId);
    const defender = load(defenderId);
    if (!attacker || !defender) return reply.code(404).send({ error: "Reino no encontrado" });
    const now = clock();
    if (defender.shieldUntil > now) return reply.code(409).send({ error: "El reino tiene escudo" });
    const p = power(attacker), q = power(defender);
    if (q < p * MATCH_RANGE[0] || q > p * MATCH_RANGE[1]) return reply.code(409).send({ error: "Rival fuera de tu rango de poder" });
    const safeOrders: AttackOrders = { units: orders?.units ?? {}, dragon: !!orders?.dragon };
    const invalid = validateOrders(attacker, safeOrders, now);
    if (invalid) return reply.code(400).send({ error: invalid });
    const battleSeed = seed();
    const report = resolvePvp(attacker, defender, safeOrders, battleSeed, now);
    return { seed: battleSeed, ...report, attacker: view(attackerId, attacker) };
  });

  return app;
}
