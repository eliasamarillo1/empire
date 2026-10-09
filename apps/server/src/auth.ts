import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_SECONDS = 30 * 24 * 3600;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

export function checkPassword(password: string, salt: string, hash: string) {
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const newToken = () => randomBytes(32).toString("base64url");

/** Devuelve el motivo si el nombre de usuario o la contraseña no valen. */
export function credentialsProblem(username: unknown, password: unknown): string | null {
  if (typeof username !== "string" || !/^[A-Za-z0-9_]{3,20}$/.test(username))
    return "El usuario debe tener de 3 a 20 letras, números o guiones bajos";
  if (typeof password !== "string" || password.length < 8 || password.length > 200) return "La contraseña debe tener al menos 8 caracteres";
  return null;
}
