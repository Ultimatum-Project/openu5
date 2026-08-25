/**
 * UI de REPETICIONES (shell QoL, fuera del juego): grabar, listar, reproducir.
 *
 * Es DOM hermano del canvas, como el resto del shell: cero impacto en el render fiel.
 * Todo el teclado que reciba su propio árbol MIENTRAS SE VE se detiene aquí
 * (`stopPropagation`), igual que hacen el panel de partidas y el selector — si no,
 * escribir el nombre de una repetición sería jugar. Oculto, el árbol es INERTE (#368):
 * cerrar con el ratón dejaba el foco en el botón pulsado y la primera tecla del
 * usuario moría en el panel invisible en vez de llegar al juego.
 *
 * 🔴 Nada de esto envía nada a ningún sitio. La lista sale de IndexedDB y ahí se queda.
 */
import type { KeyRecorder } from "../replay/recorder.js";
import { measureLog } from "../replay/recorder.js";
import type { ReplayPlayer, PlayerStatus } from "../replay/player.js";
import type { ReplayAnchor, ReplayLog, ReplayMeta } from "../replay/types.js";
import {
  deleteLog,
  exportLogFile,
  getLog,
  getThumbs,
  listLogs,
  saveLog,
  saveThumb,
  storeAvailable,
} from "../replay/store.js";
import { captureScreenshot } from "./screenshot.js";
import { ts } from "../i18n/shell.js";

/**
 * Dispara la descarga de un texto como fichero (mismo gesto que `triggerDownload` de
 * `core/persistence.ts`, revocación diferida incluida — ver allí el porqué: revocar en
 * la línea de después del `click()` da descargas vacías en Safari/iOS).
 */
function descarga(nombre: string, texto: string): void {
  const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Suelta el foco si vive DENTRO de `root` (#368). Cerrar el panel con el RATÓN dejaba
 * el foco en el botón pulsado; con el panel ya oculto, el siguiente keydown del usuario
 * nacía en ese botón, burbujeaba por el panel y moría en su `stopPropagation` — la
 * PRIMERA tecla tras cerrar no llegaba al juego (medido: 5 de 6 grabadas en el e2e).
 * Mismo gesto condicional que el teclado nativo del deck (`skin/portrait/deck-nativo.ts`,
 * `if (document.activeElement === input) input.blur()`): sólo se toca el foco si es
 * nuestro — robárselo a otro widget sería el defecto simétrico.
 */
function soltarFoco(root: HTMLElement): void {
  const activo = document.activeElement;
  if (activo instanceof HTMLElement && root.contains(activo)) activo.blur();
}

export interface ReplayUiDeps {
  recorder: KeyRecorder;
  player: ReplayPlayer;
  /** Ancla VIVA: el estado serializado + la semilla del RNG, ahora mismo. */
  anchor(): ReplayAnchor;
  /** Rótulo por defecto de una grabación nueva (p. ej. "Britannia · turno 120"). */
  defaultLabel(): string;
  /** Mensaje corto al usuario (va a la consola del juego). */
  message(text: string): void;
  /**
   * Modo «sólo UI» del popover de /byo (`?embed=1`): la barra de transporte se aparta
   * y vuelve con el ratón / el teclado / un toque (ver el CSS `--limpia`). Es una
   * OPCIÓN DE PRESENTACIÓN: no cambia nada del reproductor ni de la grabación.
   */
  embedded?: boolean;
  /**
   * Qué hace el ✕ cuando la PÁGINA ENTERA es la repetición (llegada con `?replay=<id>`,
   * el enlace «ver repetición» de la lista de partidas de /byo). Sin esto el ✕ sólo
   * descarga el reproductor y te deja de pie en el estado final de la partida de otro,
   * con la UI en el régimen de repetición: en un móvil eso es una pantalla SIN deck
   * táctil, o sea sin nada con lo que jugar (ver `soloUiOriginal` en main.ts).
   *
   * NO lo usa la repetición lanzada DESDE una sesión viva (F10 → Replays → ▶): allí el
   * ✕ tiene que seguir devolviéndote a TU partida en memoria, y recargar la perdería.
   * Tampoco el popover, donde el ✕ ni se pinta (`--limpia`).
   */
  onExit?: () => void;
  /**
   * Se invoca tras cada (re)pintado del panel, con su raíz. Espejo exacto del
   * `afterRender` de `SavePanel` y por el mismo motivo (F3): la lista se pinta de forma
   * ASÍNCRONA (viene de IndexedDB), así que un pixelizado hecho una sola vez al montar
   * dejaría los rótulos de las FILAS en su fuente moderna mientras el resto de la tarjeta
   * ya está en la de 1988 — media unificación, que se ve peor que ninguna.
   * Ausente ⇒ no-op (default byte-idéntico).
   */
  afterRender?: (root: HTMLElement) => void;
}

export interface ReplayUiHandle {
  /** La TARJETA del panel (no el telón): sobre ella monta main.ts el marco de 1988. */
  cardEl: HTMLElement;
  /** Abre el panel de repeticiones. */
  open(): void;
  close(): void;
  recording(): boolean;
  /** Empieza o cierra una grabación (misma acción que el botón del panel). */
  toggleRecording(): void;
  /**
   * Pinta la barra de transporte con el estado del reproductor. main.ts lo cablea al
   * `onChange` del `ReplayPlayer`: la barra LEE el estado del reproductor, no lo duplica.
   */
  onPlayerStatus(s: PlayerStatus): void;
  destroy(): void;
}

const PANEL_CSS = `
.u5-replay-panel{position:fixed;inset:0;z-index:60;display:flex;align-items:center;
 justify-content:center;background:rgba(0,0,0,.62);font:13px/1.45 system-ui,sans-serif}
.u5-replay-panel[hidden]{display:none}
/* 🔴 F3 (auditoría UX) — LA TARJETA YA NO SCROLLEA; SCROLLEA SU CUERPO. No es cosmético:
   el marco ornamental de 1988 (shell/originalFrame.ts) se monta como un overlay
   position:absolute inset:0 DENTRO de este elemento, y con overflow:auto aqui el marco se
   iria con el scroll y dejaria de enmarcar nada a la segunda rueda. El scroll baja a
   [data-role=list], que es lo unico que crece. position:relative para que el overlay tenga
   a quien anclarse (sin el, se ancla al viewport). */
.u5-replay-card{background:#14161c;color:#dfe3ec;border:1px solid #39405a;border-radius:8px;
 width:min(560px,92vw);max-height:82vh;overflow:visible;position:relative;
 display:flex;flex-direction:column;padding:18px 20px;box-shadow:0 18px 48px rgba(0,0,0,.6)}
.u5-replay-card [data-role=list]{overflow-y:auto;min-height:0;flex:0 1 auto}
.u5-replay-card h2{margin:0 0 4px;font-size:15px;letter-spacing:.04em}
.u5-replay-card p.hint{margin:0 0 14px;color:#8d95ab;font-size:12px}
/* 🔴 LA FILA ENVUELVE, Y LO PIDIÓ LA MEDICIÓN (F3). Con la fuente 8x8 los tres botones
   (Repetir / Exportar / Borrar) piden ~110 px cada uno; sumados a la miniatura de 96 px
   dejaban al bloque de texto 23 px de ancho en una tarjeta de 560 — la fecha salia una
   PALABRA POR LINEA, en vertical. flex-wrap mas una base real en .grow hacen que el texto
   se lleve su propia linea cuando no cabe, en vez de estrangularse. Sin la fuente 8x8 no se
   notaba: por eso el defecto nace al unificar la tipografia y se arregla en el mismo sitio. */
.u5-replay-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px 0;border-top:1px solid #262b3a}
.u5-replay-row .grow{flex:1 1 220px;min-width:0}
/* ── MINIATURA ──────────────────────────────────────────────────────────────────────
   Ancho fijo en las DOS variantes (foto y hueco) para que las filas no bailen segun
   tengan o no captura: una lista mixta con las columnas descuadradas se lee peor que
   una sin fotos. 96x60 = la proporcion 320x200 exacta, o sea sin deformar el pixel.
   image-rendering:pixelated porque esto es pixel art reducido: con el suavizado del
   navegador el fotograma de 1988 sale como un borron. (Y sin acentos graves aqui
   dentro, por lo que avisa la cabecera del bloque de abajo: un backtick suelto cierra
   la cadena y el fichero deja de compilar — me pillo escribiendo esta misma linea.) */
/* box-sizing EN LA BASE, no solo en el hueco: el borde de 1px del <img> sumaria POR
   FUERA y las dos variantes de la misma columna medirian distinto (medido en la lista
   gemela de /byo: 114x72 la foto contra 112x70 el hueco). Aqui hoy no se nota porque la
   pagina trae su propio reset, pero esta hoja no debe depender de eso. */
.u5-replay-shot{width:96px;height:60px;flex:0 0 96px;border:1px solid #39405a;border-radius:3px;
 image-rendering:pixelated;object-fit:cover;background:#0f1117;box-sizing:border-box}
.u5-replay-shot--vacia{display:flex;align-items:center;justify-content:center;text-align:center;
 color:#6b7288;font-size:9px;line-height:1.15;padding:2px}
.u5-replay-row .name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.u5-replay-row .meta{color:#8d95ab;font-size:11px}
.u5-replay-panel button{background:#232838;color:#dfe3ec;border:1px solid #39405a;border-radius:5px;
 padding:5px 11px;cursor:pointer;font:inherit}
.u5-replay-panel button:hover{background:#2e3446}
.u5-replay-panel button.primary{background:#3c5a9a;border-color:#4b6fbb}
.u5-replay-panel input[type=text]{background:#0f1117;color:#dfe3ec;border:1px solid #39405a;
 border-radius:5px;padding:5px 8px;font:inherit;width:100%}
.u5-replay-actions{display:flex;gap:8px;margin:14px 0 4px}
.u5-replay-empty{color:#8d95ab;padding:14px 0}
.u5-replay-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:59;
 display:flex;gap:8px;align-items:center;background:#14161cee;color:#dfe3ec;border:1px solid #39405a;
 border-radius:8px;padding:8px 12px;font:12px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.u5-replay-bar[hidden]{display:none}
.u5-replay-bar button{background:#232838;color:#dfe3ec;border:1px solid #39405a;border-radius:5px;
 padding:4px 9px;cursor:pointer;font:inherit}
.u5-replay-bar input[type=range]{width:170px}
.u5-replay-bar .status{min-width:150px;color:#a9b1c6}
.u5-replay-bar .status.diverged{color:#ff9a9a}
/* ── «SÓLO UI» (?embed=1, el popover de /byo) ───────────────────────────────────────
   Feedback del usuario: en el popover se viene a VER la pantalla del juego, no a
   manejar un reproductor. La barra se aparta y vuelve al acercar el ratón
   (:root:hover = el puntero está sobre el documento del iframe), al llegar con el
   TECLADO (:focus-within — ése es el motivo de que esto sea CSS y no un atributo
   hidden) o al tocar en táctil (clase .mostrada, que pone el escuchador de
   mountReplayUi: con el dedo no hay hover que valga).
   🔴 pointer-events:none MIENTRAS ESTÁ APARTADA: una barra invisible que sigue
   capturando clics es peor que una visible. Vuelve a auto en el mismo sitio donde
   vuelve la opacidad, para que nunca haya un estado visible-e-inerte.
   🔴 Y el ✕ SE RETIRA en este modo: dentro del popover habría DOS cerrar a un
   centímetro haciendo cosas distintas — éste tira el reproductor y deja el juego
   corriendo dentro del iframe; el del cromo cierra el popover y mata el iframe. El
   que el visitante quiere es el de fuera, que además está SIEMPRE accesible (vive en
   el cromo del dialog, no depende de este hover, y el Escape cierra igual).
   (Y sin acentos graves aquí dentro: esto vive en un template literal — un backtick
   suelto en el comentario cierra la cadena y el fichero deja de compilar.) */
.u5-replay-bar--limpia{opacity:0;pointer-events:none;transition:opacity .18s ease}
.u5-replay-bar--limpia:focus-within,
.u5-replay-bar--limpia.mostrada{opacity:1;pointer-events:auto}
@media (hover:hover){:root:hover .u5-replay-bar--limpia{opacity:1;pointer-events:auto}}
.u5-replay-bar--limpia [data-act="exit"]{display:none}
.u5-replay-dot{position:fixed;right:12px;top:12px;z-index:59;background:#a3282888;color:#fff;
 border-radius:12px;padding:3px 10px;font:11px/1.3 system-ui,sans-serif;pointer-events:none}
.u5-replay-dot[hidden]{display:none}
/* ── F3: LA TARJETA HABLA EL IDIOMA DEL PANEL DE PARTIDAS EN LA PIEL FIEL ──────────────
   Mismo negro sobre azul EGA, mismo filo, mismas esquinas rectas y misma fuente de pixeles
   (la pone syncPixelFontReplays desde main.ts). Antes esto era una tarjeta gris moderna a
   UN CLIC de la otra —las dos cuelgan de la misma seccion del mismo drawer—, y la mezcla se
   leia como dos aplicaciones distintas. El rizo de pergamino NO entra: ver el bloque F3 de
   main.ts, donde se explica por que se replego. */
[data-shell-skin="faithful"] .u5-replay-card{background:#000;border:2px solid #0000aa;border-radius:0}
[data-shell-skin="faithful"] .u5-replay-h2{color:#fff;background:#0000aa;padding:3px 8px;margin:-2px -2px 6px;
 text-align:center;letter-spacing:.1em}
[data-shell-skin="faithful"] .u5-replay-row{border-top-color:#0000aa}
[data-shell-skin="faithful"] .u5-replay-panel button{background:#000;color:#fff;border:1px solid #0000aa;border-radius:0}
[data-shell-skin="faithful"] .u5-replay-panel button:hover{background:#fff;color:#000}
[data-shell-skin="faithful"] .u5-replay-panel button.primary{background:#000;border-color:#fff}
[data-shell-skin="faithful"] .u5-replay-shot{border-color:#fff;border-radius:0;background:#000}
[data-shell-skin="faithful"] .u5-replay-row .meta,
[data-shell-skin="faithful"] .u5-replay-card p.hint{color:#8a8ac8}
`;

const SPEEDS = [0.5, 1, 2, 4, 8];

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
function fmtBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

/**
 * La miniatura de una fila — o su HUECO ROTULADO si esa grabación no tiene.
 *
 * 🔴 SIEMPRE DEVUELVE UN NODO, y ésa es la decisión: toda grabación anterior a esta
 * entrega se quedó sin fotograma y no puede tenerlo nunca (el canvas de aquel momento
 * ya no existe). Devolver `null` como hace `ilustracion()` en las tarjetas de `/byo`
 * sería copiar el gesto sin copiar su motivo: allí las tarjetas son bloques y una sin
 * foto se cierra sola; aquí son FILAS de una lista, y una fila sin la primera columna
 * corre el texto a la izquierda y descuadra la lista entera. El hueco lleva rótulo —no
 * es un cuadro vacío— para que se lea «esta grabación es de antes» y no «esto no ha
 * cargado». Ni una imagen rota: sin dataURL no se crea `<img>`.
 */
function miniatura(png: string | undefined): HTMLElement {
  if (png === undefined) {
    const hueco = document.createElement("div");
    hueco.className = "u5-replay-shot u5-replay-shot--vacia";
    hueco.dataset.testid = "u5-replay-shot-vacia";
    hueco.textContent = ts("No preview");
    return hueco;
  }
  const img = document.createElement("img");
  img.className = "u5-replay-shot";
  img.dataset.testid = "u5-replay-shot";
  img.src = png;
  img.alt = ""; // decorativa: lo que dice está en el rótulo y los metadatos de al lado
  img.loading = "lazy";
  return img;
}

export function mountReplayUi(parent: HTMLElement, deps: ReplayUiDeps): ReplayUiHandle {
  const style = document.createElement("style");
  style.textContent = PANEL_CSS;
  parent.appendChild(style);

  // ── panel ──────────────────────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.className = "u5-replay-panel";
  panel.hidden = true;
  panel.dataset.testid = "u5-replay-panel";
  panel.innerHTML = `
    <div class="u5-replay-card">
      <h2 class="u5-replay-h2"></h2>
      <p class="hint"></p>
      <div class="u5-replay-actions">
        <button class="primary" data-act="rec"></button>
        <button data-act="close"></button>
      </div>
      <div data-role="list"></div>
    </div>`;
  parent.appendChild(panel);
  // El teclado del panel es del panel (escribir un nombre no debe jugar la partida) —
  // pero SÓLO mientras se ve (#368): oculto ⇒ inerte, la misma doctrina que ya rige la
  // barra apartada («una barra invisible que sigue capturando clics es peor que una
  // visible», bloque `--limpia` del CSS). Sin la guarda, un keydown nacido en el foco
  // retenido dentro del panel oculto moría aquí y nunca llegaba al `keydown` de window
  // (main.ts), que es donde consume y GRABA el juego.
  panel.addEventListener("keydown", (ev) => {
    if (!panel.hidden) ev.stopPropagation();
  });
  panel.addEventListener("click", (ev) => {
    if (ev.target === panel) close();
  });

  const h2 = panel.querySelector("h2")!;
  const hint = panel.querySelector("p.hint")!;
  const recBtn = panel.querySelector<HTMLButtonElement>('[data-act="rec"]')!;
  const closeBtn = panel.querySelector<HTMLButtonElement>('[data-act="close"]')!;
  const list = panel.querySelector<HTMLElement>('[data-role="list"]')!;

  // ── piloto de grabación ────────────────────────────────────────────────────
  const dot = document.createElement("div");
  dot.className = "u5-replay-dot";
  dot.hidden = true;
  dot.dataset.testid = "u5-replay-dot";
  parent.appendChild(dot);

  // ── barra de transporte ────────────────────────────────────────────────────
  const bar = document.createElement("div");
  bar.className = "u5-replay-bar";
  bar.hidden = true;
  bar.dataset.testid = "u5-replay-bar";
  bar.innerHTML = `
    <button data-act="playpause" title="play/pause">▶</button>
    <button data-act="back" title="-25">⏪</button>
    <input type="range" min="0" max="0" value="0" data-act="seek">
    <button data-act="fwd" title="+25">⏩</button>
    <button data-act="speed">1×</button>
    <span class="status"></span>
    <button data-act="exit">✕</button>`;
  parent.appendChild(bar);
  // Misma pareja guarda+foco que el panel (#368): la contención sólo vale visible.
  bar.addEventListener("keydown", (ev) => {
    if (!bar.hidden) ev.stopPropagation();
  });

  // ── «sólo UI» embebido: la barra se aparta (CSS `--limpia`, arriba) ─────────
  // El hover y el foco los resuelve el CSS. Lo único que el CSS NO puede es el
  // TÁCTIL —con el dedo no hay hover—, así que un toque FUERA de la barra la
  // muestra/oculta. Un toque DENTRO es usar un control y no debe esconderla en el
  // mismo gesto (si no, pulsar «pausa» apagaría la barra que acabas de pulsar).
  let tapToggle: ((ev: PointerEvent) => void) | null = null;
  if (deps.embedded) {
    bar.classList.add("u5-replay-bar--limpia");
    tapToggle = (ev: PointerEvent) => {
      if (ev.pointerType !== "touch") return;
      if (ev.target instanceof Node && bar.contains(ev.target)) return;
      bar.classList.toggle("mostrada");
    };
    window.addEventListener("pointerdown", tapToggle, true);
  }

  const playPauseBtn = bar.querySelector<HTMLButtonElement>('[data-act="playpause"]')!;
  const seekEl = bar.querySelector<HTMLInputElement>('[data-act="seek"]')!;
  const speedBtn = bar.querySelector<HTMLButtonElement>('[data-act="speed"]')!;
  const statusEl = bar.querySelector<HTMLElement>(".status")!;

  let speedIdx = 1;
  let seeking = false;

  playPauseBtn.addEventListener("click", () => {
    const s = deps.player.status();
    if (s.state === "playing" || s.state === "seeking") deps.player.pause();
    else deps.player.play();
  });
  bar.querySelector('[data-act="back"]')!.addEventListener("click", () => {
    deps.player.seek(Math.max(0, deps.player.status().index - 25));
  });
  bar.querySelector('[data-act="fwd"]')!.addEventListener("click", () => {
    deps.player.seek(deps.player.status().index + 25);
  });
  speedBtn.addEventListener("click", () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    deps.player.setSpeed(SPEEDS[speedIdx]!);
    renderBar(deps.player.status());
  });
  seekEl.addEventListener("input", () => {
    seeking = true;
  });
  seekEl.addEventListener("change", () => {
    seeking = false;
    deps.player.seek(Number(seekEl.value));
  });
  bar.querySelector('[data-act="exit"]')!.addEventListener("click", () => {
    if (deps.onExit) {
      deps.onExit();
      return;
    }
    deps.player.dispose();
    bar.hidden = true;
    soltarFoco(bar); // #368: mismo cierre-con-ratón que el panel, mismo remedio
  });

  /** Pinta la barra. Es la ÚNICA lectura del reproductor: no duplica su estado. */
  function renderBar(s: PlayerStatus): void {
    bar.hidden = s.state === "idle";
    // #368: si la barra acaba de ocultarse con el foco en uno de sus controles (p. ej.
    // ⏸ pulsado justo cuando la repetición termina), se suelta — oculto ⇒ sin foco.
    if (bar.hidden) soltarFoco(bar);
    playPauseBtn.textContent = s.state === "playing" || s.state === "seeking" ? "❚❚" : "▶";
    speedBtn.textContent = `${s.speed}×`;
    seekEl.max = String(s.total);
    if (!seeking) seekEl.value = String(s.index);
    statusEl.classList.toggle("diverged", s.state === "diverged");
    if (s.state === "diverged" && s.divergence) {
      // Se DICE. Seguir pintando una partida que ya no es la del jugador sería peor
      // que pararse: el registro sólo vale si se sabe cuándo dejó de valer.
      statusEl.textContent = `${ts("Diverged at key")} ${s.divergedAt} (${ts("turn")} ${s.divergence.expected} ≠ ${s.divergence.got})`;
    } else {
      statusEl.textContent = `${s.index}/${s.total} · ${ts("turn")} ${s.turn}/${s.lastTurn}`;
    }
  }

  // ── lista ──────────────────────────────────────────────────────────────────
  async function renderList(): Promise<void> {
    if (!storeAvailable()) {
      list.innerHTML = `<div class="u5-replay-empty">${ts("Local storage is not available in this browser.")}</div>`;
      deps.afterRender?.(panel);
      return;
    }
    let metas: ReplayMeta[] = [];
    try {
      metas = await listLogs();
    } catch {
      list.innerHTML = `<div class="u5-replay-empty">${ts("Could not read the local recordings.")}</div>`;
      deps.afterRender?.(panel);
      return;
    }
    if (!metas.length) {
      list.innerHTML = `<div class="u5-replay-empty">${ts("No recordings yet.")}</div>`;
      deps.afterRender?.(panel);
      return;
    }
    // Las miniaturas se piden EN LOTE y con su propio fracaso: si el almacén de fotos
    // no responde, la lista se pinta entera con huecos rotulados en vez de no pintarse.
    let fotos = new Map<string, string>();
    try {
      fotos = await getThumbs(metas.map((m) => m.id));
    } catch {
      fotos = new Map();
    }
    list.textContent = "";
    for (const m of metas) {
      const row = document.createElement("div");
      row.className = "u5-replay-row";
      row.dataset.id = m.id;
      row.appendChild(miniatura(fotos.get(m.id)));
      const info = document.createElement("div");
      info.className = "grow";
      const name = document.createElement("strong");
      name.className = "name";
      name.textContent = m.label;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${fmtDate(m.createdAt)} · ${m.count} ${ts("keys")} · ${m.lastTurn} ${ts("turns")} · ${fmtBytes(m.bytes)}`;
      info.append(name, meta);
      const play = document.createElement("button");
      play.className = "primary";
      play.dataset.act = "play";
      play.textContent = ts("Replay");
      play.addEventListener("click", () => void startPlayback(m.id));
      // EXPORTAR (ficha #154, ítem 5): hasta ahora una grabación no salía de este navegador
      // por ninguna superficie. El fichero NO lleva la miniatura — ver `exportLogFile`, que
      // es donde vive ese invariante y por qué.
      const exp = document.createElement("button");
      exp.dataset.act = "export";
      exp.textContent = ts("Export");
      exp.addEventListener("click", () => {
        void exportLogFile(m.id)
          .then((f) => {
            if (!f) {
              deps.message(ts("That recording is no longer on this device."));
              return;
            }
            descarga(f.nombre, f.json);
          })
          .catch(() => deps.message(ts("Could not read the local recordings.")));
      });
      const del = document.createElement("button");
      del.dataset.act = "delete";
      del.textContent = ts("Delete");
      del.addEventListener("click", () => {
        void deleteLog(m.id).then(renderList);
      });
      row.append(info, play, exp, del);
      list.appendChild(row);
    }
    deps.afterRender?.(panel);
  }

  async function startPlayback(id: string): Promise<void> {
    const log: ReplayLog | null = await getLog(id);
    if (!log) return;
    close();
    deps.player.load(log);
    deps.player.setSpeed(SPEEDS[speedIdx]!);
    deps.player.play();
  }

  // ── grabación ──────────────────────────────────────────────────────────────
  function toggleRecording(): void {
    if (deps.recorder.recording) {
      const log = deps.recorder.stop(deps.defaultLabel());
      dot.hidden = true;
      if (!log || !log.count) {
        deps.message(ts("Recording discarded (no keys)."));
        renderControls();
        return;
      }
      const m = measureLog(log);
      // ── LA MINIATURA ES EL ÚLTIMO FOTOGRAMA, Y SE TOMA AQUÍ MISMO ────────────────
      // 🔴 SÍNCRONO Y ANTES DE CUALQUIER `await`: lo que se quiere retratar es la
      // pantalla del instante de PARAR. En cuanto se cede el control al bucle de
      // eventos el juego sigue animando (agua, antorchas, NPC) y medio segundo después
      // ya no es el mismo dibujo.
      //
      // 🔴 Y ES EL ÚLTIMO FOTOGRAMA, NO EL PRIMERO — decidido POR MEDICIÓN, no por
      // gusto. Comparando fracción de píxeles distintos contra el suelo de ruido de la
      // propia animación (0,08 % en 0,9 s sin tocar nada): dos grabaciones del MISMO
      // arranque difieren en su fotograma inicial un 0,12 %, o sea NADA — el inicial
      // daría la misma miniatura para todas las repeticiones de una partida, que es
      // justo lo único que una miniatura tiene que evitar. Los fotogramas FINALES de
      // esas mismas dos grabaciones difieren un 19,44 %.
      //
      // Leer el canvas no mueve el juego: turno y `g_rng_seed` idénticos con la semilla
      // en 29079 (el control vale porque la semilla NO era 0 — con 0, «no se movió»
      // sería cierto aunque la captura rompiera el juego). Coste medido: 0,5 ms.
      const png = captureScreenshot();
      void saveLog(log)
        .then(async () => {
          // La foto va DESPUÉS del registro y su fracaso no se propaga: es un adorno, y
          // «no se pudo guardar la repetición» sería mentira si lo único que faltó fue
          // la miniatura. Sin ella, la fila sale con su hueco rotulado.
          if (png !== null) await saveThumb(log.id, png);
          deps.message(
            `${ts("Recording saved")}: ${log.count} ${ts("keys")}, ${fmtBytes(m.totalBytes)}.`,
          );
          return renderList();
        })
        .catch(() => deps.message(ts("Could not save the recording.")));
    } else {
      deps.recorder.start(deps.anchor());
      dot.hidden = false;
      deps.message(ts("Recording your game (stays on this device)."));
    }
    renderControls();
  }

  function renderControls(): void {
    const rec = deps.recorder.recording;
    h2.textContent = ts("Replays");
    hint.textContent = ts(
      "A game is its starting state plus the keys you pressed. Nothing leaves your device.",
    );
    recBtn.textContent = rec ? ts("Stop recording") : ts("Record my game");
    recBtn.dataset.recording = rec ? "1" : "0";
    closeBtn.textContent = ts("Close");
    dot.textContent = `● ${ts("REC")} ${deps.recorder.length}`;
    dot.hidden = !rec;
    // 🔴 Y AQUÍ TAMBIÉN, no sólo en `renderList`: esta función reescribe `textContent` del
    // h2 y de los dos botones de cabecera, lo que BORRA sus glifos y su marca `pxDone` —
    // o sea que un pixelizado anterior queda deshecho justo en el texto más visible de la
    // tarjeta. Se corre en las dos porque son dos escritores distintos del mismo DOM.
    deps.afterRender?.(panel);
  }

  recBtn.addEventListener("click", toggleRecording);
  closeBtn.addEventListener("click", () => close());

  // Refresca el contador del piloto sin acoplar el grabador al DOM.
  const dotTimer = setInterval(() => {
    if (deps.recorder.recording) dot.textContent = `● ${ts("REC")} ${deps.recorder.length}`;
  }, 500);

  function open(): void {
    renderControls();
    panel.hidden = false;
    void renderList();
  }
  function close(): void {
    panel.hidden = true;
    // #368: el clic que cerró dejó el foco en su botón; se devuelve al documento para
    // que la SIGUIENTE tecla del usuario nazca en `body` y llegue al juego (y a su
    // grabador), no al árbol de un panel oculto.
    soltarFoco(panel);
  }

  return {
    cardEl: panel.querySelector<HTMLElement>(".u5-replay-card")!,
    open,
    close,
    recording: () => deps.recorder.recording,
    toggleRecording,
    onPlayerStatus: renderBar,
    destroy: () => {
      clearInterval(dotTimer);
      if (tapToggle) window.removeEventListener("pointerdown", tapToggle, true);
      panel.remove();
      bar.remove();
      dot.remove();
      style.remove();
    },
  };
}
