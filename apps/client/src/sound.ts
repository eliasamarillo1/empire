/*
 * Sonidos del juego (Kenney Interface Sounds y RPG Audio, CC0), en public/sonidos.
 * El silencio se guarda en el dispositivo. Si un sonido no carga, el juego sigue sin él.
 */

export type SoundName = "clic" | "pestana" | "abrir" | "cerrar" | "listo" | "error" | "obra" | "monedas" | "espada";

const KEY = "empire.silencio";
const cache = new Map<SoundName, HTMLAudioElement>();
let muted = read();
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Sin almacenamiento (modo privado): el silencio dura hasta recargar.
  }
  listeners.forEach((fn) => fn());
}

export function onMuteChange(fn: () => void) {
  listeners.add(fn);
}

export function play(name: SoundName, volume = 0.5) {
  if (muted) return;
  let a = cache.get(name);
  if (!a) {
    a = new Audio(new URL(`sonidos/${name}.ogg`, document.baseURI).href);
    a.preload = "auto";
    cache.set(name, a);
  }
  // Una copia por reproducción para que dos clics seguidos no se corten.
  const s = a.cloneNode() as HTMLAudioElement;
  s.volume = volume;
  // El navegador bloquea el sonido hasta que el jugador toca algo: se ignora ese caso.
  s.play().catch(() => {});
}

/** Qué suena al pulsar cada botón, según sus atributos. */
function soundFor(b: HTMLElement): SoundName {
  if (b.matches("[data-tab]")) return "pestana";
  if (b.matches("[data-deselect], [data-close]")) return "cerrar";
  if (b.matches("[data-upgrade]")) return "obra";
  if (b.matches("[data-train], [data-gather], [data-feed], [data-hatch]")) return "monedas";
  if (b.matches("[data-attack], [data-attack-player], #go")) return "espada";
  return "clic";
}

/** Engancha los sonidos a los botones de toda la página. */
export function mountSounds() {
  document.addEventListener(
    "click",
    (ev) => {
      const b = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");
      if (!b || b.disabled) return;
      play(soundFor(b));
    },
    true,
  );
}
