import "./style.css";
import { game, type Tab } from "./game";
import { Renderer } from "./render/renderer";
import { mountUi } from "./ui";

const renderer = new Renderer(document.getElementById("game")!);

/** Reino y Mapa son vistas 3D; Ejército e Informes son paneles encima de la vista actual. */
function showScene(tab: Tab) {
  if (tab === "mapa") renderer.show("world");
  else if (tab === "reino") renderer.show("kingdom");
}

// Al entrar con otra cuenta o volver a jugar sin conexión, la partida es otra: se rehace la vista.
const session = () => (game.mode?.kind === "online" ? game.mode.id : game.mode?.kind ?? "");
let lastSession = session();
game.onChange(() => {
  // La primera vez que hay partida (al arrancar o al entrar) se abre la vista de la pestaña actual.
  if (game.mode && !renderer.active) renderer.show(game.tab === "mapa" ? "world" : "kingdom");
  if (session() === lastSession) return;
  const changed = lastSession !== "";
  lastSession = session();
  if (changed) renderer.reload();
});

mountUi({ showScene });
void game.boot();
setInterval(() => game.tick(), 250);
setInterval(() => game.save(), 5000);
document.addEventListener("visibilitychange", () => document.hidden && game.save());

// Para depurar desde la consola del navegador
(window as unknown as { empire: typeof game }).empire = game;
