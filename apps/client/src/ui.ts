import {
  BUILDINGS, DRAGON_STAGES, FEED_COST, HATCH_COST, HATCH_TIME, RESOURCES, RESOURCE_NAMES, TILE_NAMES, TILE_RESOURCE, UNITS, UNIT_KEYS,
  aiKingdomArmy, buildingCost, buildingTime, canExplore, capacity, carryCapacity, distance, dragonLevel, dragonMaxLevel, dragonReady,
  dragonStage, dragonStats, exploreCost, isHatched, lairArmy, lairLoot, maxExpeditions, playerLevel, power, productionRate,
  protectedAmount, scaleBag, tileAt, trainTime, upgradeBlocker,
  type Bag, type BuildingKey, type Resource, type UnitKey,
} from "@empire/core";
import { game, lootText, now, type Battle, type Tab } from "./game";

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (n: number) => (n >= 100000 ? Math.round(n / 1000) + "k" : Math.floor(n).toLocaleString("es-ES"));
const mmss = (s: number) => {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60);
  return m ? `${m}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
};

function cost(bag: Bag) {
  return `<div class="cost">${(Object.entries(bag) as [Resource, number][])
    .map(([r, v]) => `<span data-r="${r}" data-v="${v}"><i class="dot d-${r}"></i><span class="num">${fmt(v)}</span></span>`)
    .join("")}</div>`;
}
const need = (bag: Bag) => `data-need='${JSON.stringify(bag)}'`;
const bar = (start: number, end: number) => `<div class="prog"><i data-start="${start}" data-end="${end}"></i></div>`;

const TABS: [Tab, string][] = [["reino", "Reino"], ["mapa", "Mapa"], ["ejercito", "Ejército"], ["informes", "Informes"]];

export interface UiHooks {
  showScene(tab: Tab): void;
}

export function mountUi(hooks: UiHooks) {
  game.onChange(render);
  game.onToast(toast);
  render();
  setInterval(tickUi, 250);

  function render() {
    const login = !game.mode;
    for (const id of ["hud", "tabs", "panel", "sheet", "game"]) $(id).classList.toggle("off", login);
    renderLogin();
    if (login) return;
    renderHud();
    renderTabs();
    renderPanel();
    renderSheet();
    bind();
    tickUi();
  }

  /** Pantalla de acceso: entrar, crear cuenta o jugar sin conexión. */
  function renderLogin() {
    const el = $("login");
    el.hidden = !!game.mode;
    if (el.hidden) return void (el.innerHTML = "");
    if (el.childElementCount) return;
    el.innerHTML = `<form class="box login" id="loginForm" novalidate>
      <div class="brand big">Empire</div>
      <p class="lead">Construye tu reino, cría a tu dragón y ataca a otros jugadores.</p>
      <div class="seg" role="tablist"><button type="button" class="on" data-mode="login" aria-selected="true">Entrar</button><button type="button" data-mode="register" aria-selected="false">Crear cuenta</button></div>
      <label for="lUser">Usuario</label><input id="lUser" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+">
      <label for="lPass">Contraseña</label><input id="lPass" type="password" autocomplete="current-password" required minlength="8">
      <div id="lKingdomRow" hidden><label for="lKingdom">Nombre de tu reino</label><input id="lKingdom" maxlength="30" placeholder="Reino de …"></div>
      <p class="error" id="lError" role="alert"></p>
      <button class="btn primary" id="lSubmit" type="submit">Entrar</button>
      <button class="btn" type="button" id="lLocal">Jugar sin conexión</button>
      <p class="small muted">Sin conexión la partida se guarda solo en este dispositivo y los rivales los controla la máquina.</p>
    </form>`;
    let register = false;
    el.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => (b.onclick = () => {
      register = b.dataset.mode === "register";
      el.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-selected", String(x === b));
      });
      $("lKingdomRow").hidden = !register;
      $("lSubmit").textContent = register ? "Crear cuenta" : "Entrar";
      ($("lPass") as HTMLInputElement).autocomplete = register ? "new-password" : "current-password";
    }));
    $("lLocal").onclick = () => game.playLocal();
    ($("loginForm") as HTMLFormElement).onsubmit = async (ev) => {
      ev.preventDefault();
      const user = ($("lUser") as HTMLInputElement).value.trim();
      const pass = ($("lPass") as HTMLInputElement).value;
      const err = $("lError");
      if (!/^[A-Za-z0-9_]{3,20}$/.test(user)) return void (err.textContent = "El usuario debe tener de 3 a 20 letras, números o guiones bajos.");
      if (pass.length < 8) return void (err.textContent = "La contraseña debe tener al menos 8 caracteres.");
      err.textContent = "";
      const btn = $("lSubmit") as HTMLButtonElement;
      btn.disabled = true;
      try {
        await game.login(user, pass, register, ($("lKingdom") as HTMLInputElement).value);
        el.innerHTML = "";
        hooks.showScene(game.tab);
      } catch (e) {
        err.textContent = e instanceof Error && e.message !== "Failed to fetch" ? e.message + "." : "No se pudo conectar con el servidor.";
      } finally {
        btn.disabled = false;
      }
    };
  }

  function renderHud() {
    const k = game.kingdom;
    const cap = capacity(k);
    const pl = playerLevel(k), cur = 40 * (pl - 1) ** 2, nxt = 40 * pl ** 2;
    $("hud").innerHTML = `
      <div class="brand">Empire</div>
      <div class="res">${RESOURCES.map((r) => `<div class="chip" title="${RESOURCE_NAMES[r]}"><i class="dot d-${r}"></i><span><b class="num" data-res="${r}">${fmt(k.res[r])}</b><span class="cap num">/${fmt(cap)}</span><br><span class="rate num">+${(productionRate(k, r) * 60).toFixed(0)}/min</span></span></div>`).join("")}</div>
      <div class="status"><span>Castillo <b class="num">${k.buildings.castle}</b></span>
        <span>Nivel <b class="num">${pl}</b> <span class="xpbar"><i style="width:${(((k.xp - cur) / (nxt - cur)) * 100).toFixed(0)}%"></i></span></span>
        <span>Poder <b class="num">${fmt(power(k))}</b></span><span id="shield"></span></div>`;
  }

  function renderTabs() {
    $("tabs").innerHTML = TABS.map(([t, n]) => `<button data-tab="${t}" aria-selected="${game.tab === t}">${n}${t === "informes" && game.unread ? `<span class="badge">${game.unread}</span>` : ""}</button>`).join("");
  }

  function renderPanel() {
    const p = $("panel");
    const sel = game.selection;
    const sheetOpen = game.tab === "ejercito" || game.tab === "informes";
    p.hidden = sheetOpen || !sel;
    if (p.hidden) return void (p.innerHTML = "");
    p.innerHTML = `<button class="close" data-deselect aria-label="Cerrar">×</button>` + (sel!.view === "kingdom" ? buildingPanel(sel!.key) : tilePanel(sel!.x, sel!.y));
  }

  function buildingPanel(key: BuildingKey) {
    const k = game.kingdom, d = BUILDINGS[key], level = k.buildings[key], up = k.upgrade;
    let info = "";
    if (d.produces) info = `<p class="small">Produce <b class="num">${((d.rate ?? 0) * level * 60).toFixed(0)}</b> de ${RESOURCE_NAMES[d.produces].toLowerCase()} por minuto.</p>`;
    if (key === "storage") info = `<p class="small">Capacidad <b class="num">${fmt(capacity(k))}</b>. Protege <b class="num">${protectedAmount(k)}</b> de cada recurso.</p>`;
    if (key === "wall" && level) info = `<p class="small">Resistencia <b class="num">${level * 250}</b> PV.</p>`;
    if (key === "tower" && level) info = `<p class="small">Daño <b class="num">${level * 25}</b> por ronda.</p>`;
    let action: string;
    if (up?.key === key) action = `${bar(up.endsAt - up.duration, up.endsAt)}<p class="small muted">Construyendo… <span class="num" data-left="${up.endsAt}"></span></p>`;
    else {
      const blocker = upgradeBlocker(k, key);
      const hard = blocker && blocker !== "Faltan recursos" && blocker !== "El constructor está ocupado";
      action = hard
        ? `<p class="small muted">${blocker}.</p>`
        : `${cost(buildingCost(key, level))}<div class="btns"><button class="btn primary" data-upgrade="${key}" ${need(buildingCost(key, level))} ${up ? "disabled data-busy" : ""}>${level ? "Mejorar" : "Construir"} · ${mmss(buildingTime(key, level))}</button></div>${up ? `<p class="small muted">El constructor está ocupado con ${BUILDINGS[up.key].name}.</p>` : ""}`;
    }
    return `<div class="row"><h3>${d.name}</h3><span class="lvl">${level ? "nivel " + level : "sin construir"}</span></div><p class="desc">${d.description}</p>${info}${action}`;
  }

  function tilePanel(x: number, y: number) {
    const w = game.world, t = tileAt(w, x, y)!, d = distance(w, x, y), k = game.kingdom;
    if (!t.seen) {
      return `<h3>Territorio sin explorar</h3><p class="desc">A ${d} casillas de tu reino.</p>${canExplore(w, x, y)
        ? `${cost(exploreCost(w, x, y))}<div class="btns"><button class="btn primary" data-explore ${need(exploreCost(w, x, y))}>Enviar exploradores</button></div>`
        : `<p class="small muted">Explora primero una casilla vecina.</p>`}`;
    }
    const head = `<div class="row"><h3>${t.kind === "kingdom" ? esc(t.name!) : TILE_NAMES[t.kind]}</h3><span class="lvl num">${x},${y}</span></div>`;
    const busy = game.player.expeditions.length >= maxExpeditions(k.buildings.castle);
    const gatherBtn = (label: string) => `<div class="btns"><button class="btn primary" data-gather ${busy ? "disabled data-busy" : ""}>${label}</button></div>${busy ? `<p class="small muted">Todos tus recolectores están fuera.</p>` : ""}`;
    switch (t.kind) {
      case "home":
        return head + `<p class="desc">Tu capital. Sus defensas se mejoran en la pestaña Reino.</p>`;
      case "water":
        return head + `<p class="desc">Agua tranquila. Aquí no hay nada que recoger.</p>`;
      case "ruins":
        return head + `<p class="desc">Restos de un imperio antiguo. Excavar da ${lootText({ gold: 60 * t.level, wood: 40 * t.level, stone: 40 * t.level })}, una sola vez.</p>` + gatherBtn("Excavar");
      case "lair":
        return head + `<p class="desc">Nivel ${t.level}. Defensores: ${lairArmy(t.level).map((g) => `${g.count} ${g.name.toLowerCase()}`).join(", ")}.</p><p class="small muted">Botín: ${lootText(lairLoot(t.level))}.</p><div class="btns"><button class="btn danger" data-attack>Atacar</button></div>`;
      case "kingdom": {
        const shielded = (t.shieldUntil ?? 0) > now();
        return head + `<p class="desc">Reino rival con castillo de nivel ${t.level}. Tesoro estimado: ${fmt(t.treasure!)} de cada recurso.</p><p class="small muted">Guarnición: ${aiKingdomArmy(t.level).map((g) => `${g.count} ${g.name.toLowerCase()}`).join(", ")}${t.level > 1 ? ", muralla y torres" : ""}.</p>${shielded ? `<span class="pill shield">Escudo <span class="num" data-left="${t.shieldUntil}"></span></span>` : `<div class="btns"><button class="btn danger" data-attack>Atacar</button></div>`}`;
      }
      default: {
        const r = TILE_RESOURCE[t.kind]!;
        return head + `<p class="desc">Quedan <b class="num">${fmt(t.amount!)}</b> de ${fmt(t.max!)} de ${RESOURCE_NAMES[r].toLowerCase()}. Se regenera con el tiempo.</p><p class="small muted">Cada grupo carga hasta ${carryCapacity(k.buildings.castle)}. Ida y vuelta: ${mmss(6 + 2 * d)}.</p>` + gatherBtn("Enviar recolectores");
      }
    }
  }

  function renderSheet() {
    const s = $("sheet");
    s.hidden = game.tab !== "ejercito" && game.tab !== "informes";
    if (s.hidden) return void (s.innerHTML = "");
    s.innerHTML = game.tab === "ejercito" ? armySheet() : reportsSheet();
  }

  function armySheet() {
    const k = game.kingdom;
    const rows = UNIT_KEYS.map((u) => {
      const d = UNITS[u], ok = k.buildings[d.building] >= d.buildingLevel;
      return `<tr><td><b>${d.name}</b><br><span class="small muted">${d.tip}</span></td><td class="num">${d.atk}</td><td class="num">${d.hp}</td><td class="num"><b>${k.army[u]}</b></td>
        <td>${ok ? `${cost(d.cost)}<div class="btns"><button class="btn" data-train="${u}" data-n="1" ${need(d.cost)}>+1</button><button class="btn" data-train="${u}" data-n="5" ${need(scaleBag(d.cost, 5))}>+5</button></div>` : `<span class="small muted">Requiere ${BUILDINGS[d.building].name} nv ${d.buildingLevel}</span>`}</td></tr>`;
    }).join("");
    const q = k.queue.length
      ? `<p class="small">Entrenando ${UNITS[k.queue[0]].name.toLowerCase()} <span class="muted num" data-left="${k.queueEndsAt}"></span>${k.queue.length > 1 ? ` · ${k.queue.length - 1} en cola` : ""}</p>${bar(k.queueEndsAt - trainTime(k, k.queue[0]), k.queueEndsAt)}`
      : `<p class="small muted">No hay nada entrenándose.</p>`;
    let dragon: string;
    if (!k.buildings.nest) dragon = `<p class="desc">Construye el Nido de dragón (Castillo 2) para conseguir un huevo.</p>`;
    else if (!k.dragon) dragon = `<p class="desc">Tu nido está listo. Un huevo tarda ${HATCH_TIME} segundos en eclosionar.</p>${cost(HATCH_COST)}<div class="btns"><button class="btn primary" data-hatch ${need(HATCH_COST)}>Incubar huevo</button></div>`;
    else if (k.dragon.hatchesAt > 0) dragon = `<p class="desc">El huevo se mueve… <span class="num" data-left="${k.dragon.hatchesAt}"></span></p>${bar(k.dragon.hatchesAt - HATCH_TIME, k.dragon.hatchesAt)}`;
    else {
      const l = dragonLevel(k.dragon), s = dragonStats(k.dragon), cur = 30 * (l - 1) ** 2, nxt = 30 * l * l;
      dragon = `<div class="row"><h3>${k.dragon.name}</h3><span class="lvl">${DRAGON_STAGES[dragonStage(l)]} · nv ${l}/${dragonMaxLevel(k)}</span></div>
        <p class="desc">Ataque <b class="num">${s.atk}</b> · Vida <b class="num">${s.hp}</b>. Vuela por encima de las murallas.</p>
        <div class="prog"><i style="width:${(((k.dragon.xp - cur) / (nxt - cur)) * 100).toFixed(0)}%"></i></div>
        ${dragonReady(k, now()) ? "" : `<span class="pill warn">Herido, se recupera en <span class="num" data-left="${k.dragon.woundedUntil}"></span></span>`}
        ${cost(FEED_COST)}<div class="btns"><button class="btn primary" data-feed ${need(FEED_COST)}>Alimentar (+30 xp)</button></div>
        <p class="small muted">Etapas: Cría (1), Joven (4), Adulto (7), Anciano (11). El nivel del Nido limita su crecimiento.</p>`;
    }
    return `<h2>Ejército y criaturas</h2><p class="lead">Las tropas que tienes en casa defienden el reino automáticamente cuando te atacan.</p>
      <div class="cols"><div class="card"><div class="tablewrap"><table class="units"><thead><tr><th>Unidad</th><th>Atq</th><th>Vida</th><th>Tienes</th><th>Entrenar</th></tr></thead><tbody>${rows}</tbody></table></div>${q}</div>
      <div class="card"><h3>Dragón</h3>${dragon}</div></div>`;
  }

  function reportsSheet() {
    const reports = game.player.reports;
    const body = reports.length
      ? reports.map((r) => {
          const lost = r.lost.length ? r.lost.map((l) => `${l.lost} ${(UNITS[l.key as UnitKey]?.name ?? l.key).toLowerCase()}`).join(", ") : "ninguna";
          const loot = r.kind === "defense" ? (r.won ? "No se llevaron nada." : `Te robaron ${lootText(r.loot)}.`) : r.won ? `Botín: ${lootText(r.loot)}.` : "Sin botín.";
          const verdict = r.kind === "defense" ? (r.won ? "Defensa con éxito" : "Defensa fallida") : r.won ? "Victoria " + "★".repeat(r.stars) + "☆".repeat(3 - r.stars) : "Derrota";
          return `<div class="report ${r.won ? "win" : "loss"}"><div class="row"><b>${esc(r.title)}</b><span class="small muted">${new Date(r.at * 1000).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span></div><p class="small">${verdict}. Bajas propias: ${lost}. ${loot}</p></div>`;
        }).join("")
      : `<p class="desc">Aquí verás tus ataques y quién ha atacado tu reino. El primer ataque enemigo llega a los pocos minutos de empezar.</p>`;
    const account = game.mode?.kind === "online"
      ? `<div class="btns"><span class="small muted">Has entrado como <b>${esc(game.mode.username)}</b>.</span><button class="btn small" data-logout>Cerrar sesión</button></div>`
      : `<div class="btns" id="resetZone"><button class="btn small" data-logout>Jugar con cuenta</button><button class="btn danger small" data-reset>Empezar de nuevo</button></div>`;
    return `<h2>Informes</h2>${rivals()}${body}${account}`;
  }

  /** Otros jugadores en tu rango de poder (solo con cuenta). */
  function rivals() {
    if (!game.online) return "";
    const list = game.targets.length
      ? game.targets.map((t) => `<div class="report"><div class="row"><b>${esc(t.name)}</b><span class="small muted">${esc(t.username)}</span></div><div class="btns"><span class="small">Castillo <b class="num">${t.castle}</b> · Poder <b class="num">${fmt(t.power)}</b></span><button class="btn danger small" data-attack-player="${esc(t.id)}">Atacar</button></div></div>`).join("")
      : `<p class="desc">Ahora mismo no hay jugadores en tu rango de poder sin escudo. Vuelve a mirar más tarde.</p>`;
    return `<div class="card"><div class="row"><h3>Rivales</h3><button class="btn small" data-refresh-targets>Actualizar</button></div>${list}</div>`;
  }

  function bind() {
    document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => (b.onclick = () => {
      const tab = b.dataset.tab as Tab;
      game.setTab(tab);
      hooks.showScene(tab);
    }));
    const on = (sel: string, fn: (el: HTMLElement) => void) => document.querySelectorAll<HTMLElement>(sel).forEach((el) => (el.onclick = () => fn(el)));
    on("[data-deselect]", () => game.select(null));
    on("[data-upgrade]", (el) => game.upgrade(el.dataset.upgrade as BuildingKey));
    on("[data-train]", (el) => game.train(el.dataset.train as UnitKey, Number(el.dataset.n)));
    on("[data-hatch]", () => game.hatch());
    on("[data-feed]", () => game.feed());
    const sel = game.selection;
    if (sel?.view === "world") {
      on("[data-explore]", () => game.explore(sel.x, sel.y));
      on("[data-gather]", () => game.gather(sel.x, sel.y));
      on("[data-attack]", () => openAttack({ kind: "tile", x: sel.x, y: sel.y }));
    }
    on("[data-attack-player]", (el) => openAttack({ kind: "player", id: el.dataset.attackPlayer! }));
    on("[data-refresh-targets]", () => void game.loadTargets());
    on("[data-logout]", () => void game.logout());
    on("[data-reset]", () => {
      $("resetZone").innerHTML = `<span class="small">¿Borrar la partida?</span><button class="btn danger small" data-reset-yes>Sí, borrar</button><button class="btn small" data-reset-no>No</button>`;
      on("[data-reset-yes]", () => game.reset());
      on("[data-reset-no]", render);
    });
  }

  function tickUi() {
    const t = now(), k = game.kingdom;
    document.querySelectorAll<HTMLElement>("[data-res]").forEach((el) => (el.textContent = fmt(k.res[el.dataset.res as Resource])));
    document.querySelectorAll<HTMLElement>("[data-end]").forEach((el) => {
      const s = Number(el.dataset.start), e = Number(el.dataset.end);
      el.style.width = Math.min(100, Math.max(0, ((t - s) / (e - s)) * 100)) + "%";
    });
    document.querySelectorAll<HTMLElement>("[data-left]").forEach((el) => (el.textContent = mmss(Number(el.dataset.left) - t)));
    document.querySelectorAll<HTMLButtonElement>("[data-need]").forEach((b) => {
      if (b.hasAttribute("data-busy")) return;
      if (game.busy) return void (b.disabled = true);
      const bag = JSON.parse(b.dataset.need!) as Bag;
      b.disabled = !(Object.entries(bag) as [Resource, number][]).every(([r, v]) => k.res[r] >= v);
    });
    document.querySelectorAll<HTMLElement>(".cost span[data-r]").forEach((s) => s.classList.toggle("short", k.res[s.dataset.r as Resource] < Number(s.dataset.v)));
    const shield = document.getElementById("shield");
    if (shield) shield.innerHTML = k.shieldUntil > t ? `<span class="pill shield">Escudo ${mmss(k.shieldUntil - t)}</span>` : !game.online && game.player.nextRaid - t < 25 ? `<span class="pill warn">Ejército enemigo acercándose</span>` : "";
  }

  // ---------- Ataque y batalla ----------
  function modal(html: string) {
    $("modal").innerHTML = `<div class="backdrop" role="dialog" aria-modal="true"><div class="box">${html}</div></div>`;
    $("modal").querySelectorAll<HTMLElement>("[data-close]").forEach((b) => (b.onclick = closeModal));
  }
  function closeModal() {
    $("modal").innerHTML = "";
  }

  function openAttack(target: { kind: "tile"; x: number; y: number } | { kind: "player"; id: string }) {
    const k = game.kingdom;
    const rows = UNIT_KEYS.filter((u) => k.army[u] > 0).map((u) => `<label for="pick-${u}">${UNITS[u].name} <span class="muted small">(${k.army[u]})</span></label><input type="number" id="pick-${u}" min="0" max="${k.army[u]}" value="${k.army[u]}">`).join("");
    const dragon = isHatched(k.dragon) ? (dragonReady(k, now()) ? `<label for="pick-dragon">${k.dragon.name}, ${DRAGON_STAGES[dragonStage(dragonLevel(k.dragon))].toLowerCase()}</label><input type="checkbox" id="pick-dragon" checked>` : `<span class="muted">${k.dragon.name} está herido</span><span></span>`) : "";
    const any = rows || dragon.includes("checkbox");
    let name: string;
    if (target.kind === "tile") {
      const t = tileAt(game.world, target.x, target.y)!;
      name = t.kind === "lair" ? `la guarida (nivel ${t.level})` : esc(t.name!);
    } else name = esc(game.targets.find((x) => x.id === target.id)?.name ?? "al rival");
    modal(`<h2>Atacar ${name}</h2>
      ${any ? `<div class="pick">${rows}${dragon}</div>` : `<p class="muted">No tienes tropas. Entrena algunas en la pestaña Ejército.</p>`}
      <p class="desc small">Infantería gana a caballería, arqueros a infantería y voladores, caballería a arqueros. Los voladores ignoran la muralla.</p>
      <div class="btns"><button class="btn primary" id="go" ${any ? "" : "disabled"}>Lanzar ataque</button><button class="btn" data-close>Cancelar</button></div>`);
    $("go").onclick = async () => {
      const units: Partial<Record<UnitKey, number>> = {};
      for (const u of UNIT_KEYS) {
        const el = document.getElementById("pick-" + u) as HTMLInputElement | null;
        if (el) units[u] = Math.max(0, Math.min(k.army[u], Math.floor(Number(el.value) || 0)));
      }
      const dEl = document.getElementById("pick-dragon") as HTMLInputElement | null;
      const orders = { units, dragon: !!dEl?.checked };
      ($("go") as HTMLButtonElement).disabled = true;
      const battle = target.kind === "tile" ? await game.attackTile(target.x, target.y, orders) : await game.attackPlayer(target.id, orders);
      if (!battle) return closeModal();
      if (battle) playBattle(battle);
    };
  }

  function playBattle({ title, result, loot }: Battle) {
    const side = (groups: typeof result.attacker, cls: string) =>
      groups.map((g, i) => `<div class="grp ${cls}"><span>${esc(g.name)}</span><span class="num" id="${cls}c${i}">${g.count}</span><div class="prog"><i id="${cls}b${i}" style="width:100%"></i></div></div>`).join("");
    modal(`<h2>${esc(title)}</h2><div class="sides"><div><h3>Tus fuerzas</h3>${side(result.attacker, "att")}</div>
      <div><h3>Enemigo</h3>${side(result.defender, "def")}${result.wall ? `<div class="grp def"><span>Muralla</span><span class="num" id="wallc">${result.wall}</span><div class="prog"><i id="wallb" style="width:100%"></i></div></div>` : ""}</div></div>
      <div class="log" id="blog"></div><div id="bend"></div>`);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0;
    const step = () => {
      const r = result.rounds[i];
      const paint = (groups: typeof result.attacker, pools: number[], cls: string) =>
        pools.forEach((p, j) => {
          const g = groups[j];
          $(`${cls}c${j}`).textContent = String(Math.max(0, Math.ceil(p / g.hp - 1e-9)));
          $(`${cls}b${j}`).style.width = Math.max(0, Math.min(100, (p / (g.count * g.hp)) * 100)) + "%";
        });
      paint(result.attacker, r.attacker, "att");
      paint(result.defender, r.defender, "def");
      if (result.wall) {
        $("wallc").textContent = String(Math.round(r.wall));
        $("wallb").style.width = (r.wall / result.wall) * 100 + "%";
      }
      const log = $("blog");
      log.textContent += i === 0 ? "Comienza la batalla.\n" : `Ronda ${i}: infliges ${r.damageDealt} de daño y recibes ${r.damageTaken}.${r.wallFell ? " ¡La muralla cae!" : ""}\n`;
      log.scrollTop = 1e6;
      i++;
      if (i < result.rounds.length) setTimeout(step, reduced ? 60 : 650);
      else {
        $("bend").innerHTML = `<div class="stars">${"★".repeat(result.stars)}${"☆".repeat(3 - result.stars)}</div><p><b>${result.attackerWon ? "¡Victoria!" : "Derrota."}</b> ${result.attackerWon ? `Botín: ${lootText(loot)}.` : "Tus supervivientes vuelven a casa."}</p><div class="btns"><button class="btn primary" data-close>Cerrar</button></div>`;
        $("bend").querySelector<HTMLElement>("[data-close]")!.onclick = closeModal;
      }
    };
    step();
  }

  function toast(msg: string, bad: boolean) {
    const el = document.createElement("div");
    el.className = "toast" + (bad ? " bad" : "");
    el.textContent = msg;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
}
