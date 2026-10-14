/*
 * Iconos del juego, dibujados a mano en SVG (24 × 24). Usan `currentColor` para el trazo o el relleno,
 * así que toman el color del texto que los rodea.
 */

const svg = (body: string, cls = "") =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  gold: svg(`<ellipse cx="12" cy="15" rx="8" ry="4" fill="#b8862b"/><ellipse cx="12" cy="12" rx="8" ry="4" fill="#e9b949"/><ellipse cx="12" cy="9" rx="8" ry="4" fill="#f6d36b"/><ellipse cx="12" cy="9" rx="4.5" ry="2" fill="none" stroke="#c99a35" stroke-width="1.2"/>`),
  wood: svg(`<rect x="3" y="9" width="16" height="7" rx="3.5" fill="#8d5f34"/><rect x="5" y="4" width="14" height="6" rx="3" fill="#a8743f"/><ellipse cx="19" cy="7" rx="2.6" ry="3" fill="#e2b77c"/><circle cx="19" cy="7" r="1" fill="#a8743f"/><ellipse cx="19" cy="12.5" rx="3" ry="3.5" fill="#e2b77c"/><circle cx="19" cy="12.5" r="1.2" fill="#8d5f34"/>`),
  stone: svg(`<path d="M3 17l3-7 5-3 5 2 4 6-2 4H5z" fill="#9b9a93"/><path d="M6 10l5-3 5 2-3 4z" fill="#c4c2b9"/><path d="M13 13l3-4 4 6-2 4z" fill="#7e7c75"/>`),
  food: svg(`<path d="M12 21V8" stroke="#c9a24a" stroke-width="1.6"/><g fill="#e6c25a"><ellipse cx="9.5" cy="9" rx="2" ry="3" transform="rotate(-25 9.5 9)"/><ellipse cx="14.5" cy="9" rx="2" ry="3" transform="rotate(25 14.5 9)"/><ellipse cx="9.5" cy="13.5" rx="2" ry="3" transform="rotate(-25 9.5 13.5)"/><ellipse cx="14.5" cy="13.5" rx="2" ry="3" transform="rotate(25 14.5 13.5)"/><ellipse cx="12" cy="5" rx="1.8" ry="2.8"/></g>`),
  castle: svg(`<path fill="currentColor" d="M4 21V9h2V6h2v3h2V6h4v3h2V6h2v3h2v12h-6v-4a2 2 0 0 0-4 0v4z"/>`),
  map: svg(`<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>`),
  swords: svg(`<g fill="currentColor"><path d="M4 3l2 0 9 9-2 2-9-9z"/><path d="M20 3l-2 0-9 9 2 2 9-9z"/><path d="M6.5 13.5l4 4-1.5 1.5-1.2-1.2-2.3 2.3-1.3-1.3 2.3-2.3-1.2-1.2z"/><path d="M17.5 13.5l-4 4 1.5 1.5 1.2-1.2 2.3 2.3 1.3-1.3-2.3-2.3 1.2-1.2z"/></g>`),
  scroll: svg(`<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M7 4h11a2 2 0 0 1 0 4h-2v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h2V6a2 2 0 0 0-2-2zM11 10h3M11 13h3"/>`),
  hammer: svg(`<path fill="currentColor" d="M14 3l7 7-2 2-2-2-1.5 1.5L5 22l-3-3 10.5-10.5L11 7l3-4z"/>`),
  clock: svg(`<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
  shield: svg(`<path fill="currentColor" d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>`),
  power: svg(`<path fill="currentColor" d="M13 2L4 14h6l-1 8 9-12h-6z"/>`),
  up: svg(`<path fill="currentColor" d="M12 4l7 8h-4v8H9v-8H5z"/>`),
  plus: svg(`<path fill="currentColor" d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>`),
  lock: svg(`<path fill="currentColor" d="M7 10V7a5 5 0 0 1 10 0v3h1v11H6V10zm2 0h6V7a3 3 0 0 0-6 0z"/>`),
  heart: svg(`<path fill="currentColor" d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>`),
  close: svg(`<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>`),
  dragon: svg(`<path fill="currentColor" d="M3 14c3-1 5-4 6-8 1 3 3 4 5 4l3-4 1 5 3 1-3 2c-1 4-5 6-9 6l1-3c-3 0-5-1-7-3z"/>`),
  eye: svg(`<path fill="none" stroke="currentColor" stroke-width="1.8" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>`),
  cart: svg(`<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 6h3l2 9h10l2-7H7"/><circle cx="10" cy="19" r="1.6" fill="currentColor"/><circle cx="17" cy="19" r="1.6" fill="currentColor"/>`),
  sound: svg(`<path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>`),
  mute: svg(`<path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 9l5 6M21 9l-5 6"/>`),
} as const;

export type IconName = keyof typeof ICONS;
