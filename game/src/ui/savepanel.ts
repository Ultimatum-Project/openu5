/**
 * Panel de guardado libre: lista de slots + acciones (Guardar, Cargar, Borrar,
 * Exportar, Importar). Patrón DOM de DialoguePanel. El orquestador abre el panel
 * con show(state, locationName), pasándole el GameState vivo que se guardará/
 * exportará; los cambios de carga vuelven por el callback onLoad.
 */
import type { GameState } from "../core/state.js";
import { EV } from "../web/eventos.js";
import { ts } from "../i18n/shell.js";
import {
  listSaves,
  saveGame,
  loadGame,
  deleteSave,
  exportSave,
  downloadNativeSave,
  importSave,
  importNativeSaveFiles,
  type SaveMeta,
} from "../core/persistence.js";
import { readSaveShot } from "../core/save-keys.js";
import { SAVED_GAM_SIZE } from "../core/saveNative.js";
import { isU5gamName } from "../core/u5gam.js";
// El índice guarda el nombre del sitio COMO CADENA, y las partidas de antes del fix llevan
// dentro el identificador del extractor. Se traduce al PINTAR, no migrando el índice ajeno.
import { legibleLocationName } from "../core/location-display.js";
import { escapeHtml } from "../core/escape-html.js";
import { soltarFoco } from "./foco.js";

export interface SavePanelCallbacks {
  onLoad(state: GameState): void;
  onMessage(text: string): void;
  /** Emite telemetría consentida desde las acciones exitosas del panel. */
  onAnalyticsEvent(event: string): void;
  /** Maqueta #23: se invoca tras cada (re)render con el root del panel, para re-aplicar
   *  la fuente 8×8 a los slots recién pintados. Ausente ⇒ no-op (default byte-idéntico). */
  afterRender?(root: HTMLElement): void;
  /**
   * Miniatura de la pantalla en el instante de guardar, para la tarjeta de `/byo`.
   * Ausente ⇒ la partida se guarda igual y sin foto (respaldo: el minimapa). El panel
   * NO sabe leer el canvas: se lo pide al orquestador, que es quien lo tiene.
   */
  snapshot?(): string | null;
}

export class SavePanel {
  private root: HTMLElement;
  private listEl: HTMLElement;
  private form: HTMLFormElement;
  private nameInput: HTMLInputElement;
  private fileInput: HTMLInputElement;
  private state: GameState | null = null;
  private locationName = "";
  /** Plantilla base de 4192 B (/assets/init.gam) para el export SAVED.GAM nativo. */
  private saveTemplate: Uint8Array | null = null;

  constructor(parent: HTMLElement, private cb: SavePanelCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "save-panel";
    this.root.innerHTML = `
      <div class="save-title">${ts("Journeys")}</div>
      <div class="save-list"></div>
      <form class="save-new">
        <input type="text" class="save-name" placeholder="${ts("Name this save…")}" autocomplete="off" maxlength="40" />
        <button type="submit" class="save-btn save-btn-save">${ts("Save")}</button>
      </form>
      <div class="save-io">
        <button type="button" class="save-btn save-btn-export">${ts("Export")}</button>
        <button type="button" class="save-btn save-btn-export-gam">${ts("Export .GAM")}</button>
        <button type="button" class="save-btn save-btn-import">${ts("Import")}</button>
        <button type="button" class="save-btn save-btn-close">${ts("Close")}</button>
        <input type="file" class="save-file" accept="application/json,.json,.gam,.GAM,.u5gam" hidden multiple />
      </div>`;
    this.listEl = this.root.querySelector(".save-list")!;
    this.form = this.root.querySelector(".save-new")!;
    this.nameInput = this.root.querySelector(".save-name")!;
    this.fileInput = this.root.querySelector(".save-file")!;

    this.form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      this.doSave();
    });
    this.root.querySelector(".save-btn-export")!.addEventListener("click", () => {
      if (!this.state) return;
      exportSave(this.state);
      this.cb.onAnalyticsEvent(EV.GUARDADO_EXPORTADO);
    });
    this.root.querySelector(".save-btn-export-gam")!.addEventListener("click", () => {
      if (!this.state) return;
      if (!this.saveTemplate) {
        this.cb.onMessage(ts("Native .GAM export unavailable (missing init.gam template)."));
        return;
      }
      // Plantilla del SAVED.OOL (init.ool = BRIT.OOL++UNDER.OOL, la emite el
      // extractor): fetch perezoso y cacheado aquí mismo (sin tocar el arranque).
      // Si falta el asset, se exporta con bloques a cero (degradación declarada
      // de buildNativeOol) — el .GAM/sidecar no cambian.
      void this.fetchOolTemplate().then((ool) => {
        if (!this.state || !this.saveTemplate) return;
        downloadNativeSave(this.state, this.saveTemplate, ool);
        this.cb.onAnalyticsEvent(EV.GUARDADO_EXPORTADO);
        this.cb.onMessage(ts("Exported SAVED.GAM + SAVED.OOL + sidecar."));
      });
    });
    this.root.querySelector(".save-btn-import")!.addEventListener("click", () => {
      this.fileInput.click();
    });
    this.root.querySelector(".save-btn-close")!.addEventListener("click", () => this.hide());
    this.fileInput.addEventListener("change", () => void this.doImport());

    // 🔴 ESCAPE ANTES DEL `stopPropagation`, Y ÉSE ERA EXACTAMENTE EL DEFECTO (F1 de la
    // auditoría UX). `show()` enfoca `.save-name`, así que TODO keydown nace DENTRO de este
    // root; la línea de abajo lo paraba aquí y el manejador global de `window` (main.ts, que
    // sí tiene su rama `if (savePanel.visible) … hide()`) no llegaba a verlo nunca. La rama
    // existía y era inalcanzable: el panel no se cerraba con Escape aunque el código dijera
    // que sí. Se resuelve donde nace el evento —igual que `DebugPanel` (debug/panel.ts:124)—
    // y NO quitando el stopPropagation: escribir el nombre de una partida no debe jugar.
    //
    // Y todo ello SÓLO MIENTRAS SE VE (#370, mitad 2 del patrón de ui/foco.ts): oculto,
    // el panel es INERTE al teclado. Sin la guarda, la tecla nacida en el foco retenido
    // dentro del panel `display:none` (Chromium lo recoloca a body UN FRAME después del
    // cierre — medido) moría aquí y no llegaba al `keydown` de window (main.ts), que es
    // donde el juego consume.
    this.root.addEventListener("keydown", (ev) => {
      if (!this.visible) return;
      if (ev.key === "Escape") {
        ev.stopPropagation();
        this.hide();
        return;
      }
      ev.stopPropagation();
    });
    parent.appendChild(this.root);
    this.hide();
  }

  /** Inyecta la plantilla base para el export SAVED.GAM (cargada en el arranque). */
  setSaveTemplate(bytes: Uint8Array | null): void {
    this.saveTemplate = bytes;
  }

  /** Plantilla de SAVED.OOL (512 B) cacheada; null = asset ausente o corto. */
  private oolTemplate: Uint8Array | null | undefined;

  /** Fetch perezoso de /assets/init.ool (BRIT.OOL++UNDER.OOL). */
  private async fetchOolTemplate(): Promise<Uint8Array | null> {
    if (this.oolTemplate !== undefined) return this.oolTemplate;
    try {
      const res = await fetch("/assets/init.ool");
      if (!res.ok) throw new Error(String(res.status));
      const bytes = new Uint8Array(await res.arrayBuffer());
      this.oolTemplate = bytes.length >= 0x200 ? bytes : null;
    } catch {
      this.oolTemplate = null;
    }
    return this.oolTemplate;
  }

  show(state: GameState, locationName: string): void {
    this.state = state;
    this.locationName = locationName;
    this.nameInput.value = "";
    this.renderList();
    this.root.style.display = "flex";
    this.nameInput.focus();
  }

  hide(): void {
    this.root.style.display = "none";
    // #370 (mitad 1 del patrón de ui/foco.ts): el clic que cerró (Close/Load) dejó el
    // foco en su botón dentro del panel ya oculto; se devuelve al documento para que la
    // SIGUIENTE tecla del usuario nazca en `body` y llegue al juego, no al árbol oculto.
    soltarFoco(this.root);
  }

  get visible(): boolean {
    return this.root.style.display !== "none";
  }

  /** Raíz DOM del panel (para hooks externos, p.ej. el marco original de la maqueta #23). */
  get rootEl(): HTMLElement {
    return this.root;
  }

  private doSave(): void {
    if (!this.state) return;
    const name =
      this.nameInput.value.trim() ||
      ts("Save {n}").replace("{n}", String(listSaves().length + 1));
    const result = saveGame(this.state, name, this.locationName, this.cb.snapshot?.() ?? null);
    if (!result.ok) {
      // localStorage lleno: aviso accionable, sin excepción (hallazgo soak #35).
      this.cb.onMessage(
        result.reason === "quota"
          ? ts("Couldst not save — storage full! Delete or export a journey.")
          : ts("Couldst not save the journey."),
      );
      return;
    }
    this.nameInput.value = "";
    this.renderList();
    this.cb.onAnalyticsEvent(EV.GUARDADO_MANUAL_CREADO);
    this.cb.onMessage(`${ts("Saved:")} ${result.meta.name}`);
  }

  private doLoad(id: string): void {
    try {
      const state = loadGame(id);
      this.cb.onLoad(state);
      this.cb.onAnalyticsEvent(EV.GUARDADO_CARGADO);
      this.cb.onMessage(ts("Game loaded."));
      this.hide();
    } catch (err) {
      this.cb.onMessage(err instanceof Error ? err.message : ts("Load failed."));
    }
  }

  private doDelete(id: string): void {
    deleteSave(id);
    this.renderList();
    this.cb.onAnalyticsEvent(EV.GUARDADO_ELIMINADO);
    this.cb.onMessage(ts("Save deleted."));
  }

  /**
   * IMPORTAR: acepta el JSON del propio port **y un SAVED.GAM nativo de 1988**.
   *
   * El motor nativo (`importNativeSaveFiles`) existía desde el carril #27 y sólo lo
   * alcanzaba un hook DEV: el `<input>` estaba en `accept=".json"`, así que un jugador que
   * llegara con su partida de DOSBox no tenía por dónde meterla. Aquí se abre esa puerta.
   *
   * ── EL DISCRIMINANTE ES LA EXTENSIÓN, CON EL TAMAÑO DE RESPALDO ──────────────────────
   * El `.GAM` son 4192 B exactos y el JSON es texto, así que los dos criterios coinciden
   * casi siempre; se combinan porque cada uno falla por su lado: la extensión miente cuando
   * el fichero se ha renombrado (un `SAVED.GAM` copiado como `saved.bin`), y el tamaño
   * miente cuando el JSON casualmente mide 4192 B. Se pregunta primero por la extensión —
   * es lo que el usuario controla— y el tamaño sólo decide entre los que no la llevan.
   *
   * 🔴 Y EL `.u5gam` HAY QUE NOMBRARLO APARTE, porque los DOS criterios fallan sobre él y
   * eso no se ve leyendo (medido, #229): `/\.gam$/i` NO casa —el carácter anterior a «gam»
   * es un `5`, no un punto— y el tamaño tampoco —lleva el sobre pegado detrás, 4463 B en el
   * testigo—. O sea que el fichero que el propio proyecto emite para llevarse una partida
   * caía por la rama del JSON y moría con un «Import failed.» genérico. El `accept` de
   * arriba tampoco lo ofrecía, así que el diálogo del sistema ni siquiera lo dejaba elegir.
   * Quien lo reconoce es `isU5gamName` (`core/u5gam.ts`), que es donde vive el formato; el
   * SOBRE lo lee `importNativeSaveFiles`, no este fichero.
   *
   * 🔴 Y EL SIDECAR NO ES UNA PARTIDA, aunque también sea `.json`. `downloadNativeSave`
   * emite TRES ficheros (`SAVED.GAM` + `SAVED.OOL` + `SAVED-*.sidecar.json`) y el jugador
   * los va a seleccionar juntos, que es justo lo que el `multiple` permite. Si un `.json`
   * se tratara como partida completa por el hecho de serlo, seleccionar los tres cargaría
   * el SIDECAR como si fuera el estado — deserializar un objeto que no lo es. La regla:
   * **si hay un `.GAM` en la selección, manda el `.GAM`** y cualquier `.json` que venga con
   * él es su sidecar. Sólo sin `.GAM` un `.json` es una partida exportada.
   */
  private async doImport(): Promise<void> {
    const files = [...(this.fileInput.files ?? [])];
    this.fileInput.value = "";
    if (files.length === 0) return;
    const esGam = (f: File): boolean =>
      /\.gam$/i.test(f.name) ||
      isU5gamName(f.name) ||
      (!/\.json$/i.test(f.name) && f.size === SAVED_GAM_SIZE);
    const gam = files.find(esGam);
    const json = files.find((f) => f !== gam && /\.json$/i.test(f.name));
    try {
      // 🔴 EL RÓTULO SE DERIVA DE `sidecarSource`, NO DE QUÉ FICHEROS SE ELIGIERON. Un
      // `.u5gam` trae el sidecar pegado sin que haya un `.json` en la selección, y un
      // `.u5gam` con el sobre ROTO se llama igual que uno sano: mirar los ficheros diría
      // «sin sidecar» sobre uno bueno y «con sidecar» sobre uno roto. Los dos casos en que
      // la trama NO viajó comparten frase, que es lo que el jugador necesita saber.
      const importado = gam ? await importNativeSaveFiles(gam, json) : null;
      const state = importado ? importado.state : await importSave(files[0]!);
      this.cb.onLoad(state);
      this.cb.onAnalyticsEvent(EV.GUARDADO_IMPORTADO);
      this.cb.onMessage(
        importado
          ? importado.sidecarSource === "none"
            ? ts("SAVED.GAM imported. Without its sidecar, what the 1988 format does not store starts fresh.")
            : ts("SAVED.GAM imported (with sidecar).")
          : ts("Save imported."),
      );
      this.hide();
    } catch (err) {
      this.cb.onMessage(err instanceof Error ? err.message : ts("Import failed."));
    }
  }

  private renderList(): void {
    this.listEl.innerHTML = "";
    const saves = listSaves();
    if (saves.length === 0) {
      const empty = document.createElement("div");
      empty.className = "save-empty";
      empty.textContent = ts("No saved journeys yet.");
      this.listEl.appendChild(empty);
      this.cb.afterRender?.(this.root);
      return;
    }
    for (const meta of saves) {
      this.listEl.appendChild(this.renderSlot(meta));
    }
    this.cb.afterRender?.(this.root);
  }

  private renderSlot(meta: SaveMeta): HTMLElement {
    const row = document.createElement("div");
    row.className = "save-slot";
    row.appendChild(miniatura(readSaveShot(meta.id)));

    const info = document.createElement("div");
    info.className = "save-slot-info";
    const when = new Date(meta.timestamp).toLocaleString();
    info.innerHTML = `
      <div class="save-slot-name">${escapeHtml(meta.name)}</div>
      <div class="save-slot-meta">${escapeHtml(legibleLocationName(meta.locationName))} · ${ts("turn")} ${meta.turns} · ${escapeHtml(when)}</div>`;

    const actions = document.createElement("div");
    actions.className = "save-slot-actions";
    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "save-btn save-btn-load";
    loadBtn.textContent = ts("Load");
    loadBtn.addEventListener("click", () => this.doLoad(meta.id));
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "save-btn save-btn-delete";
    delBtn.textContent = ts("Delete");
    delBtn.addEventListener("click", () => this.doDelete(meta.id));
    actions.append(loadBtn, delBtn);

    row.append(info, actions);
    return row;
  }
}

/**
 * La miniatura de una partida — o su HUECO ROTULADO si esa partida no tiene.
 *
 * ── LA FOTO YA SE TOMABA Y YA SE PERSISTÍA; LO QUE FALTABA ERA PINTARLA ────────────────
 * `doSave` pasa `snapshot()` a `saveGame` (arriba), `putSave` la escribe en
 * `u5clone:shot:<id>` y `/byo` la enseña desde hace semanas. El único sitio donde NO
 * aparecía era la lista del propio juego, que es donde el jugador elige qué cargar: la
 * pantalla que más necesita reconocer la partida de un vistazo era la única sin foto.
 * `readSaveShot` (core/save-keys.ts) es el lector que ya existía para el otro consumidor.
 *
 * 🔴 SIEMPRE DEVUELVE UN NODO, por el MISMO motivo que su gemela de la lista de
 * repeticiones (ui/replay-ui.ts `miniatura`, de donde se copia la geometría 96×60 = la
 * proporción 320×200 exacta): estas son FILAS, y una fila sin su primera columna corre el
 * texto a la izquierda y descuadra la lista entera. Toda partida anterior a la captura no
 * puede tener foto nunca, así que el hueco es un estado permanente, no un cargando.
 *
 * 🔴 Y NO SE COMPARTE EL HELPER CON `replay-ui.ts` AUNQUE HAGAN LO MISMO: aquel vive en el
 * panel de repeticiones y se pinta con SU hoja (`.u5-replay-shot`, tema oscuro moderno);
 * éste tiene que teñirse con la piel del panel de partidas (EGA fiel / shader / marrón),
 * y son tres reglas distintas por piel en `index.html`. Unificarlos exigiría un tercer
 * módulo con parámetro de clase para ahorrar seis líneas.
 */
function miniatura(png: string | null): HTMLElement {
  if (png === null) {
    const hueco = document.createElement("div");
    hueco.className = "save-shot save-shot-vacia";
    hueco.dataset.testid = "u5-save-shot-vacia";
    hueco.textContent = ts("No preview");
    return hueco;
  }
  const img = document.createElement("img");
  img.className = "save-shot";
  img.dataset.testid = "u5-save-shot";
  img.src = png;
  img.alt = ""; // decorativa: el nombre y los metadatos de al lado ya lo dicen
  img.loading = "lazy";
  return img;
}

