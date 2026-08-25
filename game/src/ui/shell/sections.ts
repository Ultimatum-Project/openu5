/**
 * MENÚ SISTEMA (shell del UI EXTERNO al juego) — declara las secciones del
 * drawer "SISTEMA" reutilizando el modelo del menú debug (DebugSection/
 * DebugField; el motor de render es DebugPanel). Vive FUERA de core/ (cero
 * strings del binario, cero estado de juego): sólo settings de presentación
 * (piel, aspecto, audio) y lanzadores de los paneles QoL ya existentes.
 * main.ts (raíz de composición) inyecta las deps; ver ShellDeps.
 */
import type { DebugSection } from "../../debug/types.js";
import { aspectStretchEnabled, setAspectStretch } from "../../skin/fiel/skin.js";
import { ts } from "../../i18n/shell.js";
import { getLang } from "../../i18n/index.js";
import { COMPANION_URL } from "./companion.js";

/** Fachadas mínimas que inyecta main.ts. Todo QoL: nada toca estado/RNG del juego. */
export interface ShellDeps {
  /** ¿Existe el layout partido en esta sesión? (sin él, la casilla no se ofrece). */
  layoutPartidoDisponible?(): boolean;
  /** ¿Está activo el layout partido? */
  layoutPartido?(): boolean;
  /** Enciende/apaga el layout partido (re-monta la piel). */
  setLayoutPartido?(on: boolean): void;
  /** Etiqueta legible de la piel activa (p.ej. "1988 (fiel)") — sólo display. */
  currentSkinId(): string | null;
  /** Pieles ofrecidas al usuario (id + etiqueta), sin la dev (task #79). */
  availableSkins(): { id: string; label: string }[];
  /** Salta directamente a una piel por id (MISMO camino que F9: persiste + perfil música). */
  selectSkin(id: string): void;
  musicEnabled(): boolean;
  setMusicEnabled(on: boolean): void;
  /** Volumen vivo 0..1. */
  musicVolume(): number;
  setMusicVolume(v: number): void;
  speakerEnabled(): boolean;
  setSpeakerEnabled(on: boolean): void;
  openSaves(): void;
  /**
   * Abre el panel de REPETICIONES (grabar tus teclas y volver a ver tu partida). Todo
   * local: esta dep no habla con ninguna red. Ausente ⇒ la fila no se pinta.
   */
  openReplays?: () => void;
  /** Sólo DEV: abre el drawer debug. Ausente ⇒ la sección Debug no se pinta. */
  openDebug?: () => void;
  /**
   * ¿Está desplegado el atlas /companion? Ausente o `false` ⇒ la sección Ayuda no
   * se pinta (la demo pública y el repo público no lo llevan: el enlace sería un
   * 404). Lo cablea main.ts a la sonda de `companion.ts`.
   */
  companionAvailable?: () => boolean;
  /**
   * Reabre el panel de consentimiento (carril 1). Es la ÚNICA vía que tiene el
   * jugador para RETIRAR un permiso desde dentro del juego, sin volver a la portada
   * — y poder retirarlo es un requisito, no una comodidad (UE). Ausente ⇒ la fila
   * no se pinta (p. ej. un montaje del juego sin la capa web).
   */
  openPrivacidad?: () => void;
  /**
   * IDIOMA — fila del drawer (arquitectura híbrida, ficha #154).
   *
   * En TÁCTIL los tres FAB (🌐 ◧ ⚙) están ocultos por CSS y sus funciones vivían en el
   * popover del ☰. Al desaparecer ese popover (el ☰ pasa a abrir este drawer DIRECTAMENTE),
   * el idioma se quedaría sin ninguna vía táctil: la piel ya tenía la suya en «Vídeo» y el
   * ⚙ ERA este drawer, pero el 🌐 no tenía sitio. Ésta es su casa.
   *
   * Ausente ⇒ la fila no se pinta (montaje sin capa i18n).
   */
  languages?(): { code: string; label: string; seed: boolean }[];
  currentLang?(): string;
  selectLang?(code: string): void;
  /**
   * LADO DEL PAD (⇄) — la cuarta entrada del popover difunto, y la única SIN casa previa.
   *
   * 🔴 Exige una dep de DISPONIBILIDAD y no basta con `swapPadSide` a secas, pero el
   * criterio es «¿hay deck táctil?», NO «¿estamos en apaisado?». Esta línea decía lo
   * segundo durante un rato, citando un comentario del popover difunto que afirmaba que su
   * CSS ocultaba el ⇄ en vertical: **ese CSS no existe** (comprobado sobre el `index.html`
   * anterior al cambio) y el atributo `data-pad-side` tiene consumidores sin gate de
   * orientación. Estrechar la fila a apaisado era una regresión con cita heredada; el
   * razonamiento completo está en `padSideOfrecible()` (ui/touch.ts).
   *
   * Lo que sí hace falta es el gate del DECK: en escritorio no hay pad que cambiar de lado,
   * y la dep devuelve `false` ahí — mejor que un botón que no hace nada.
   */
  padSideDisponible?(): boolean;
  swapPadSide?(): void;
  /** Cierra el propio shell (los lanzadores lo cierran antes de abrir su panel). */
  close(): void;
}

/**
 * ENLACES SALIENTES A `/byo` — la sección «Más» (ficha #154, arquitectura HÍBRIDA).
 *
 * La decisión de arquitectura fue: lo frecuente DENTRO del juego, la gestión pesada en la
 * web, **pero el juego tiene que enseñar que la web existe**. Sin esta sección la mitad de
 * la web era inalcanzable desde `/play`: quien entra por el enlace de jugar no vuelve a
 * ver una portada nunca, y récords y momentos legendarios no tienen NINGUNA entrada desde
 * dentro — no es que estuvieran escondidos, es que no había puerta.
 *
 * Pestaña nueva y `noopener`: el juego que estás jugando no se descarga por mirar tus
 * partidas, y la página abierta no gana un handle sobre la del juego. Misma decisión y
 * mismo par de razones que `openCompanion()` arriba.
 */
const BYO_URL = "/byo.html";
function openByo(hash = ""): void {
  window.open(`${BYO_URL}${hash}`, "_blank", "noopener");
}

/**
 * Companion atlas + walkthrough (docs/manual/companion). El dev server y el build
 * lo sirven bajo /companion/ (ver vite.config.ts): ruta relativa al origen ⇒ el
 * enlace funciona igual en :5199 y en cualquier puerto e2e. Pestaña nueva, aislada
 * (noopener) para no darle a la web handle sobre la del juego.
 *
 * El companion es bilingüe (?lang=en|es, default es). Le pasamos el idioma ACTIVO
 * del shell para que abra en el mismo idioma que el juego; sólo soporta es/en, así
 * que cualquier otro código cae a es (su propio default).
 *
 * La fila SÓLO se pinta si el atlas está DESPLEGADO (dep `companionAvailable`, que
 * main.ts cablea a la sonda de companion.ts): la demo pública y el repo público no
 * lo llevan, y el enlace incondicional abría un 404 allí.
 */
function openCompanion(): void {
  const lang = getLang() === "en" ? "en" : "es";
  window.open(`${COMPANION_URL}?lang=${lang}`, "_blank", "noopener");
}

/** Alterna fullscreen del documento. Nunca lanza (sin soporte ⇒ no-op). */
function toggleFullscreen(): void {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  } catch {
    /* Fullscreen API no disponible/permitida: el botón es un no-op */
  }
}

/**
 * Teclas globales (QoL, NO comandos del original: getkey mapea F1..F10 a
 * 0xC9..0xD2 → "What?"). Fuente única de la sección "Teclas". El primer elemento
 * es la tecla (nombre literal, no se traduce); el segundo es la descripción (base
 * inglesa, traducida por `ts()`). La fila del menú debug se añade sólo en DEV
 * (`buildShellSections`), para no anunciar el atajo QA a usuarios fiel/shader.
 */
const KEY_ROWS: readonly [string, string][] = [
  ["F10", "open/close this menu"],
  ["Escape", "close this menu or an open panel"],
  ["F5", "save / load game"],
  ["F7", "music on/off"],
  ["F8", "PC speaker on/off"],
  ["F9", "change skin (1988 ↔ shader)"],
];
/** Fila del atajo debug — SÓLO DEV (se concatena si `deps.openDebug` existe). */
const DEBUG_KEY_ROW: readonly [string, string] = ["` / F4", "debug menu (QA)"];

/**
 * Referencia de COMANDOS del original (la «ayuda» de U5 era la refcard de papel —
 * u5-refcard-ibm; en el juego F1..F10 mapean a "What?"). Contenido AUTORADO de shell
 * (descripciones cortas), NO strings del binario → capa ts(), no es.json. Censo #35:
 * la ayuda in-game era el único hueco del pilar shell.
 */
const COMMAND_ROWS: readonly [string, string][] = [
  ["A", "Attack"], ["B", "Board (horse/carpet/ship)"], ["C", "Cast a spell"],
  ["E", "Enter (town/dungeon/shrine)"], ["F", "Fire cannon"], ["G", "Get"],
  ["H", "Hole up & camp"], ["I", "Ignite a torch"], ["J", "Jimmy a lock"],
  ["K", "Klimb (ladders/mountains)"], ["L", "Look"], ["M", "Mix reagents"],
  ["N", "New order (party)"], ["O", "Open"], ["P", "Push/pull"],
  ["Q", "Quit & save (original)"], ["R", "Ready weapons/armour"], ["S", "Search"],
  ["T", "Talk (also shops)"], ["U", "Use an item"], ["V", "View (gem)"],
  ["X", "X-it (dismount)"], ["Y", "Yell (word of power)"], ["Z", "Ztats (stats/inventory)"],
  ["↑↓←→", "move / aim"], ["Space", "pass a turn"],
];

export function buildShellSections(deps: ShellDeps): DebugSection[] {
  const panels: DebugSection = {
    id: "shell-panels",
    title: ts("Saves & panels"),
    fields: [
      {
        widget: "button",
        label: ts("Save / Load (F5)"),
        hint: ts("Not available in dungeons or combat (same as F5)."),
        run: () => {
          deps.close();
          deps.openSaves();
        },
      },
      ...(deps.openReplays
        ? [
            {
              widget: "button" as const,
              label: ts("Replays"),
              hint: ts("Record your keys and watch your game again. Stays on this device."),
              run: () => {
                deps.close();
                deps.openReplays!();
              },
            },
          ]
        : []),
    ],
  };

  const video: DebugSection = {
    id: "shell-video",
    title: ts("Video"),
    fields: [
      {
        widget: "text",
        label: ts("Active skin"),
        get: () => deps.currentSkinId() ?? "—",
        set: () => {},
        disabled: () => true,
      },
      // Selección DIRECTA de piel: un botón por piel user-facing (dev jubilada,
      // task #79). Un click salta a esa piel (mismo camino de persistencia que F9).
      // La activa se ve en "Piel activa" arriba; reclicarla es no-op (swap early-return).
      // La etiqueta de piel es NOMBRE PROPIO (no se traduce); sólo el prefijo "Skin".
      ...deps.availableSkins().map((skin) => ({
        widget: "button" as const,
        label: `${ts("Skin")}: ${skin.label}`,
        run: () => deps.selectSkin(skin.id),
      })),
      {
        widget: "checkbox",
        label: ts("4:3 period aspect (1988 skin)"),
        hint: ts(
          "Stretches 320×200 to 4:3 like a CRT of the era (1:1.2 pixel). Default: square pixel (F-0 decision). Applied live with the 1988 skin mounted.",
        ),
        get: () => aspectStretchEnabled(),
        set: (v) => setAspectStretch(v),
      },
      // LAYOUT PARTIDO (petición del usuario 27-07). La vía del SHELL es imprescindible, no
      // un duplicado por comodidad: el botón ▤ vive en la botonera del layout partido, así
      // que al APAGARLO desaparece con él — sin esta casilla el toggle sería de ida y sin
      // vuelta, y el jugador se quedaría encerrado en el layout original. El shell está en
      // los dos layouts, así que es la única vía que puede DEVOLVERLE el partido.
      ...(deps.layoutPartidoDisponible?.()
        ? [
            {
              widget: "checkbox" as const,
              label: ts("Split layout (portrait)"),
              hint: ts(
                "Splits the screen in portrait: square map on top, players and log below, buttons at the bottom. Changing it remounts the skin.",
              ),
              get: () => deps.layoutPartido?.() ?? false,
              set: (v: boolean) => deps.setLayoutPartido?.(v),
            },
          ]
        : []),
      // LADO DEL PAD: heredado del popover ☰ (ficha #154). Con deck táctil montado, en
      // las DOS orientaciones — como lo ofrecía el popover (ver `padSideDisponible`).
      //
      // 🔴 #248 — LA ETIQUETA NO LLEVA GLIFO DECORATIVO, y la razón es MEDIDA, no de gusto.
      // Llevaba un `⇄ ` heredado del popover. En la piel fiel el texto se pixeliza con el
      // atlas IBM.CH, que sólo cubre 0x00-0x7F: U+21C4 **no tiene glifo, pero sí ocupa
      // ancho**. Medido en el drawer vivo (WebKit iPhone): la CAJA de esta fila estaba a
      // x=52 igual que todas sus hermanas, con el mismo `text-align:left` y el mismo
      // `padding-left:6px` — y la TINTA arrancaba en x=92 frente a los 58-60 de las demás.
      // 32 px de sangría que no venía de CSS sino de un carácter invisible. El usuario lo
      // reportó como «sale centrado» (#248) y las tres sospechas de layout eran falsas.
      // ★ Por eso el aserto de su guarda mide TINTA y no `getBoundingClientRect()`: el rect
      //   es idéntico en la fila sana y en la enferma — es justo lo que NO lo cazaba.
      //
      // El `testId` es la CONSECUENCIA de #248 (ficha #259): los specs móviles localizaban
      // esta fila por el glifo, así que retirarlo del producto dejó 26 rojos e2e. La
      // etiqueta pasa por `ts()` y los proyectos corren ES y EN — un localizador por texto
      // vuelve a atar el instrumento a algo que el producto puede cambiar legítimamente.
      ...(deps.padSideDisponible?.() && deps.swapPadSide
        ? [
            {
              widget: "button" as const,
              label: ts("Swap pad side"),
              testId: "u5-shell-swap-pad-side",
              hint: ts("Moves the D-pad to the other side of the screen (landscape)."),
              run: () => deps.swapPadSide!(),
            },
          ]
        : []),
      { widget: "button", label: ts("Fullscreen"), run: () => toggleFullscreen() },
    ],
  };

  // IDIOMA (ficha #154): heredado del 🌐 del popover ☰. Un `select` y no un botón por
  // idioma como hace la piel: las pieles son DOS y los idiomas crecen, y una lista de
  // botones que crece dentro de un acordeón empuja el resto de secciones bajo el pliegue.
  const idioma: DebugSection = {
    id: "shell-lang",
    title: ts("Language"),
    fields: [
      {
        widget: "select",
        label: ts("Language"),
        // La etiqueta de un idioma es su NOMBRE PROPIO (Español, English): no se traduce.
        // El sufijo «beta» sí — es una advertencia nuestra sobre lo incompleto, no un nombre.
        options: (deps.languages?.() ?? []).map((l) => ({
          label: l.seed ? `${l.label} (${ts("beta")})` : l.label,
          value: l.code,
        })),
        get: () => deps.currentLang?.() ?? "",
        set: (v) => deps.selectLang?.(String(v)),
      },
    ],
  };

  const audio: DebugSection = {
    id: "shell-audio",
    title: ts("Audio"),
    fields: [
      {
        widget: "checkbox",
        label: ts("Music (F7)"),
        hint: ts(
          "'Enhanced' tracks (XMI→OGG patch). On the 1988 skin the profile default is OFF; turning it on here is the same explicit opt-in as F7.",
        ),
        get: () => deps.musicEnabled(),
        set: (v) => deps.setMusicEnabled(v),
      },
      {
        widget: "number",
        label: ts("Music volume (%)"),
        min: 0,
        max: 100,
        step: 5,
        get: () => Math.round(deps.musicVolume() * 100),
        set: (v) => deps.setMusicVolume(v / 100),
      },
      {
        widget: "checkbox",
        label: ts("PC speaker 1988 (F8)"),
        get: () => deps.speakerEnabled(),
        set: (v) => deps.setSpeakerEnabled(v),
      },
    ],
  };

  // Filas de teclas: base + la fila debug SÓLO en DEV (no anunciar el atajo QA en fiel/shader).
  const keyRows = deps.openDebug ? [...KEY_ROWS, DEBUG_KEY_ROW] : KEY_ROWS;
  const keys: DebugSection = {
    id: "shell-keys",
    title: ts("Keys"),
    custom: () => {
      const el = document.createElement("div");
      for (const [key, what] of keyRows) {
        const row = document.createElement("div");
        row.className = "u5dbg-hint";
        row.textContent = `${key} — ${ts(what)}`;
        el.appendChild(row);
      }
      return el;
    },
  };

  const commands: DebugSection = {
    id: "shell-commands",
    title: ts("Commands (original)"),
    custom: () => {
      const el = document.createElement("div");
      for (const [key, what] of COMMAND_ROWS) {
        const row = document.createElement("div");
        row.className = "u5dbg-hint";
        row.textContent = `${key} — ${ts(what)}`;
        el.appendChild(row);
      }
      return el;
    },
  };

  const help: DebugSection = {
    id: "shell-help",
    title: ts("Help"),
    fields: [
      {
        widget: "button",
        label: ts("Atlas & guide (new tab)"),
        hint: ts(
          "Interactive map of Britannia and the Underworld, interiors, NPCs, game controls and walkthrough. Opens outside the game.",
        ),
        run: () => openCompanion(),
      },
    ],
  };

  // PRIVACIDAD (carril 1): la vía de REVOCACIÓN dentro del juego. La fila se pinta
  // siempre que exista la capa web, haya o no analítica desplegada: sin clave de
  // proyecto no se envía nada, pero el jugador sigue teniendo que poder ver y
  // cambiar lo que decidió.
  const privacidad: DebugSection = {
    id: "shell-privacidad",
    title: ts("Privacy"),
    fields: [
      {
        widget: "button",
        label: ts("Privacy & data"),
        hint: ts(
          "What this site sends and with what permission. Your game files never leave your device. You can withdraw any permission here.",
        ),
        run: () => deps.openPrivacidad?.(),
      },
    ],
  };

  // MÁS — la puerta a la web (ficha #154). Va después de los paneles del juego y antes de
  // las referencias: es acción, no documentación. Los dos destinos son la MISMA página con
  // distinto ancla; se ofrecen por separado porque responden a dos preguntas distintas
  // («¿dónde está lo mío?» y «¿qué hay que ver?») y quien busca una no encuentra la otra
  // por dentro de la primera.
  const mas: DebugSection = {
    id: "shell-mas",
    title: ts("More"),
    fields: [
      {
        widget: "button",
        label: ts("My games, records and moments (new tab)"),
        hint: ts(
          "Your saved games, the record boards and the legendary moments gallery. Opens outside the game; your files never leave this device.",
        ),
        run: () => openByo(),
      },
      {
        widget: "button",
        label: ts("Legendary moments (new tab)"),
        hint: ts("Ten scenes from the game, ready to load and play. Opens outside the game."),
        run: () => openByo("#momentos"),
      },
    ],
  };

  /**
   * SALIDA ROTULADA DEL DRAWER — la que sustituye al botón `esc` de la esquina que el
   * usuario mandó quitar el 14-08 (#263). No es una comodidad: es el requisito que ese
   * botón cumplía y que no se puede perder al retirarlo (el razonamiento, con el reporte
   * que lo destapó en su día, vive en `DebugPanelOpts.closeButton`). En un teléfono no hay
   * Escape físico, y tocar fuera o volver a pulsar el ☰ son convenciones mudas para un
   * lector de pantalla.
   *
   * Lleva el `data-testid` que tenía el ✕ a propósito: el identificador nombra «la salida
   * rotulada del drawer», no «el botón de la esquina», así que los cuatro e2e que ya lo
   * localizaban siguen midiendo la misma propiedad sin re-apuntarlos a otro sujeto.
   */
  const cerrar: DebugSection = {
    id: "shell-close",
    title: ts("Close"),
    fields: [
      {
        widget: "button",
        // Las DOS etiquetas ya estaban traducidas en `i18n/shell.ts` («Cerrar» / «Cerrar
        // este menú»): «Close this menu» era una entrada HUÉRFANA desde que se jubiló el
        // popover del ☰ (#154) y su ítem «✗ Cerrar». Reusarlas en vez de inventar un
        // literal nuevo evita estrenar una clave sin ES — el defecto de #109.
        label: ts("Close this menu"),
        hint: ts("Also with Escape, or by tapping outside the panel."),
        testId: "u5-shell-drawer-close",
        run: () => deps.close(),
      },
    ],
  };

  const sections = [panels, video, audio, mas, keys, commands];
  if (deps.languages) sections.splice(sections.indexOf(video) + 1, 0, idioma);
  if (deps.openPrivacidad) sections.push(privacidad);
  // Ayuda = SÓLO la fila del atlas: si el atlas no está desplegado, la sección
  // entera sobra (no queda ningún campo que pintar).
  if (deps.companionAvailable?.()) sections.push(help);
  sections.push(cerrar);
  if (deps.openDebug) {
    const openDebug = deps.openDebug;
    sections.push({
      id: "shell-debug",
      title: ts("Debug (QA)"),
      fields: [
        {
          widget: "button",
          label: ts("Open debug menu (` / F4)"),
          run: () => {
            deps.close();
            openDebug();
          },
        },
      ],
    });
  }
  return sections;
}
