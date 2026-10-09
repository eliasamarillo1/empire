import Phaser from "phaser";
import "./style.css";
import { game, type Tab } from "./game";
import { KingdomScene } from "./scenes/KingdomScene";
import { WorldScene } from "./scenes/WorldScene";
import { mountUi } from "./ui";

const phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#111915",
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true },
  scene: [KingdomScene, WorldScene],
});

/** Reino y Mapa son escenas de Phaser; Ejército e Informes son paneles encima de la escena actual. */
function showScene(tab: Tab) {
  const key = tab === "mapa" ? "world" : tab === "reino" ? "kingdom" : null;
  if (!key) return;
  const other = key === "world" ? "kingdom" : "world";
  if (phaser.scene.isActive(other)) phaser.scene.stop(other);
  if (!phaser.scene.isActive(key)) phaser.scene.start(key);
}

mountUi({ showScene });
void game.boot();
setInterval(() => game.tick(), 250);
setInterval(() => game.save(), 5000);
document.addEventListener("visibilitychange", () => document.hidden && game.save());

// Para depurar desde la consola del navegador
(window as unknown as { empire: typeof game }).empire = game;
