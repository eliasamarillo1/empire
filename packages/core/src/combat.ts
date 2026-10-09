import { rng } from "./rng";
import type { UnitClass } from "./rules";

export interface Group {
  key: string;
  name: string;
  cls: UnitClass;
  fly?: boolean;
  atk: number;
  hp: number;
  count: number;
}

export interface Round {
  /** Vida restante de cada grupo atacante. */
  attacker: number[];
  defender: number[];
  wall: number;
  damageDealt: number;
  damageTaken: number;
  wallFell: boolean;
}

export interface Losses {
  key: string;
  lost: number;
  left: number;
}

export interface BattleResult {
  attacker: Group[];
  defender: Group[];
  wall: number;
  rounds: Round[];
  attackerLosses: Losses[];
  defenderLosses: Losses[];
  /** Gana el atacante si no queda ningún defensor (la muralla no cuenta). */
  attackerWon: boolean;
  stars: 0 | 1 | 2 | 3;
}

export interface Defenses {
  /** Vida de la muralla. */
  wall: number;
  /** Daño de las torres por ronda. */
  tower: number;
}

export const MAX_ROUNDS = 8;

/** Ventajas tipo piedra-papel-tijera. */
export function advantage(a: Pick<Group, "cls" | "fly">, t: Pick<Group, "cls" | "fly">): number {
  if (a.cls === "dragon") return t.cls === "tank" ? 1 : 1.3;
  let m = 1;
  if (a.cls === "inf" && t.cls === "cav") m = 1.6;
  if (a.cls === "arc" && (t.cls === "inf" || t.fly)) m = 1.6;
  if (a.cls === "cav" && t.cls === "arc") m = 1.6;
  if (a.cls === "fly" && t.cls === "arc") m = 1.4;
  if (a.cls === "beast" && t.cls === "arc") m = 1.3;
  if (t.cls === "tank") m *= 0.7;
  return m;
}

/**
 * Simula una batalla. Es determinista: con los mismos ejércitos y la misma semilla
 * el resultado es idéntico, así el servidor puede repetir lo que vio el cliente.
 */
export function simulate(attackerIn: Group[], defenderIn: Group[], defenses: Defenses, seed: number): BattleResult {
  const random = rng(seed);
  const attacker = attackerIn.filter((g) => g.count > 0).map((g) => ({ ...g }));
  const defender = defenderIn.filter((g) => g.count > 0).map((g) => ({ ...g }));
  const A = attacker.map((g) => g.count * g.hp);
  const D = defender.map((g) => g.count * g.hp);
  let wall = defenses.wall;
  const alive = (pool: number, g: Group) => Math.max(0, Math.ceil(pool / g.hp - 1e-9));
  const sum = (a: number[]) => a.reduce((s, v) => s + Math.max(0, v), 0);
  const rounds: Round[] = [{ attacker: [...A], defender: [...D], wall, damageDealt: 0, damageTaken: 0, wallFell: false }];

  for (let i = 0; i < MAX_ROUNDS && sum(A) > 0 && sum(D) > 0; i++) {
    const toD = D.map(() => 0);
    const toA = A.map(() => 0);
    let toWall = 0;
    const totalD = sum(D);
    const totalA = sum(A);

    attacker.forEach((g, gi) => {
      if (A[gi] <= 0) return;
      const base = g.atk * alive(A[gi], g) * (0.9 + random() * 0.2);
      if (wall > 0 && !g.fly) {
        toWall += base;
        return;
      }
      defender.forEach((t, ti) => {
        if (D[ti] > 0) toD[ti] += base * (D[ti] / totalD) * advantage(g, t);
      });
    });
    defender.forEach((g, gi) => {
      if (D[gi] <= 0) return;
      const base = g.atk * alive(D[gi], g) * (0.9 + random() * 0.2);
      attacker.forEach((t, ti) => {
        if (A[ti] > 0) toA[ti] += base * (A[ti] / totalA) * advantage(g, t);
      });
    });
    if (defenses.tower > 0) {
      attacker.forEach((t, ti) => {
        if (A[ti] > 0) toA[ti] += defenses.tower * (A[ti] / totalA) * (t.fly ? 1.3 : 1);
      });
    }

    toD.forEach((d, j) => (D[j] -= d));
    toA.forEach((d, j) => (A[j] -= d));
    const wallHit = Math.min(wall, toWall);
    const wallBefore = wall;
    wall = Math.max(0, wall - toWall);
    rounds.push({
      attacker: [...A],
      defender: [...D],
      wall,
      damageDealt: Math.round(toD.reduce((a, b) => a + b, 0) + wallHit),
      damageTaken: Math.round(toA.reduce((a, b) => a + b, 0)),
      wallFell: wallBefore > 0 && wall === 0,
    });
  }

  const attackerLosses = attacker.map((g, i) => ({ key: g.key, lost: g.count - alive(A[i], g), left: alive(A[i], g) }));
  const defenderLosses = defender.map((g, i) => ({ key: g.key, lost: g.count - alive(D[i], g), left: alive(D[i], g) }));
  const attackerWon = sum(D) <= 0 && sum(A) > 0;
  const startHp = attacker.reduce((s, g) => s + g.count * g.hp, 0);
  const kept = startHp ? sum(A) / startHp : 0;
  const stars = (attackerWon ? 1 + (kept > 0.5 ? 1 : 0) + (kept > 0.8 ? 1 : 0) : 0) as BattleResult["stars"];
  return { attacker, defender, wall: defenses.wall, rounds, attackerLosses, defenderLosses, attackerWon, stars };
}
