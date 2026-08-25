/**
 * BedSleep — conductor de la secuencia de sueño en CAMA de pueblo (CMDS.OVL 0x0552,
 * despacho por tile LeftBed 0xAB). Hermano de `ui/camp-sleep.ts`, y por la MISMA razón:
 * el core resuelve el sueño entero y sin conductor no se ve pasar el tiempo.
 *
 * ★ POR QUÉ EXISTE ESTE FICHERO (ficha #296, y es el orden que importa). El apagón del
 * viewport del original —`set_color(0)` + `fill_rect(8,8,0xb7,0xb7)`, CMDS 0x0614-0x0624—
 * NO se podía cablear solo: `main.ts` resolvía la cama con un `applyEvents(game.bedSleep(n))`
 * ATÓMICO, o sea las N horas en UN frame. Una cortina que se monta y se desmonta dentro del
 * mismo frame no la ve nadie, y su test habría pasado en verde midiendo un efecto invisible.
 * Primero se pacea el sueño (este fichero), y sobre el sueño paceado se monta la cortina.
 *
 * ESTRUCTURA DEL BUCLE, derivada (la lectura completa está en `re/notes/cama-241-acta.md`
 * §1 y `re/notes/sueno-cama-249.md` §10):
 * ```
 *   0611  call print("Zzzzzzz...")     ; DS 0x421e   (tras el roster 'G'→'S', 0x05f5)
 *   0614  sub ax,ax / push / call 0x4af0        ; ★ set_color(0)
 *   061a  push 8 / push 8 / push 0xb7 / push 0xb7 / call 0x4b26   ; ★ fill_rect INTERIOR
 *   0631  jmp 0x63b                    ; entra POR EL TEST
 *   0634  push 1 / call 0x617a         ; ★ delay_ticks_int1c(1) — UN tick por paso
 *   063b  cmp si, g_hour / je 0x692    ; ¿hora de destino? ⇒ epílogo
 *   0647  push 0xa / call advance_clock ; ★ DIEZ minutos por paso
 *   0671  call 0x6b68 / 0x6980         ; repintado + PANEL  (ver «precedencia», abajo)
 *   0677  call → TOWN 0x1694           ; snap de NPCs
 *   0688  call 0x368E find_object_at_xy ; gate de «Thrown out of bed!»
 *   068d  je 0x634                     ; otra vuelta
 * ```
 * ⇒ el apagón se pinta UNA vez, ANTES del bucle, y el bucle no vuelve a tocar el interior
 * de la ventana: aguanta toda la noche. Cielo/luna (fila 0) y la banda de vientos (fila 23,
 * y=184) quedan FUERA del rectángulo 8..183 por construcción, no por decisión nuestra.
 *
 * 🔴 PRECEDENCIA, no pintar-una-vez-y-rezar. El port no puede calcar «pintar y no repintar»
 * porque su piel REDIBUJA el frame entero con cada evento del paso (el reloj del panel
 * cambia seis veces por hora). Por eso la cortina es ESTADO del snapshot (`bedBlackout`) y
 * cada piel la pinta LA ÚLTIMA, encima de todo lo demás — que es la única forma de que
 * sobreviva a un repintado que en 1988 no existía. La equivalencia elegida se declara aquí.
 *
 * CADENCIA — Clase C con SUELO DERIVADO, y las dos mitades son distintas:
 *  · DERIVADO: el binario espera **1 tick de INT 1Ch por paso de 10 minutos** (0x0634
 *    `push 1; call 0x617a` → kernel 0x20FA `delay_ticks_int1c`). El número de esperas y su
 *    unidad salen del ASM: seis por hora dormida.
 *  · CLASE C: pasar ese tick a milisegundos. 1 tick ≈ 54.9 ms (PIT a 18.2065 Hz), pero el
 *    paso REAL del original es «1 tick + lo que cueste el repintado de 0x0671/0x0674», y el
 *    coste del repintado NO está en el ASM. Es la misma estructura que mordió a la escena
 *    del santuario, donde el testigo de vídeo refutó el «1 fotograma = 1 tick» por 2,22×
 *    (ver `main.ts`, `SHRINE_SCENE_UNIT_MS`). ⇒ 55 ms es el SUELO derivado, no una medida:
 *    si aparece un testigo de vídeo del sueño en cama, se recalibra AQUÍ y sólo aquí.
 *  · Sanidad del número: 55 ms × 6 pasos = 330 ms por hora dormida, contra los 360 ms/hora
 *    de la acampada (`CAMP_HOUR_MS`, Clase C calibrada aparte). Dos cadencias razonadas por
 *    caminos independientes caen a un 8 % — no lo prueba, pero habría sido una señal si no.
 */
import type { Game } from "../core/game.js";
// Los seis pasos por hora vienen del CORE, no de una copia: la capa `ui/` sí puede
// importar valores del core en runtime (lo hacen ya autowalk, pickers, endgame-pacer…);
// la guarda que lo prohíbe es la de las PIELES. Con la constante importada, cambiar la
// cadencia en `camp.ts` mueve también el conductor, que es lo que se quiere.
import { BED_STEPS_PER_HOUR } from "../core/world/camp.js";

/**
 * ms por PASO de diez minutos. Suelo derivado de `delay_ticks_int1c(1)`; la conversión
 * tick→ms es Clase C (ver la cabecera antes de moverlo).
 */
export const BED_STEP_MS = 55;

export interface BedSleepDeps {
  game: Game;
  view: {
    /** Monta/desmonta la CORTINA NEGRA del viewport (CMDS 0x0614-0x0624). */
    setBedBlackout(on: boolean): void;
  };
  hud: { message(text: string): void };
  applyEvents: (events: ReturnType<Game["move"]>) => void;
  refreshAwaiting: () => void;
  cancelAutoWalk: () => void;
  /** Delay efectivo de un beat de escena (knob `?scenebeat`). */
  sceneMs: (ms: number) => number;
}

export class BedSleep {
  private timer: number | null = null;
  private _sleeping = false;

  constructor(private readonly deps: BedSleepDeps) {}

  /** ¿La party duerme en cama AHORA? (modal: el input se traga hasta despertar). */
  get sleeping(): boolean {
    return this._sleeping;
  }

  /** Cancela el temporizador del sueño (sin tocar el flag ni la vista). */
  cancel(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Teardown completo (cargar partida a mitad del sueño, patrón `CampSleep.reset`):
   * cancela el temporizador, baja el flag modal y DESMONTA la cortina. Sin lo último, un
   * `load` dentro de la ventana de sueño dejaba el viewport en negro para siempre.
   */
  reset(): void {
    this.cancel();
    this._sleeping = false;
    this.deps.view.setBedBlackout(false);
  }

  /**
   * Conduce el sueño de `hours` horas: entrada (roster 'G'→'S' + «Zzzzzzz...») → cortina →
   * 6 pasos de 10 min por hora, uno por tick → epílogo. El gate de «Thrown out of bed!»
   * (0x0688) corta el sueño en el paso que acierta, como el binario.
   */
  run(hours: number): void {
    const { game, view, applyEvents, refreshAwaiting, cancelAutoWalk, sceneMs } = this.deps;
    cancelAutoWalk();
    this.cancel();
    this._sleeping = true;
    applyEvents(game.bedSleepBegin()); // "Zzzzzzz..." + roster a 'S' (0x05f5-0x0611)
    view.setBedBlackout(true); // 0x0614 set_color(0) + 0x061a fill_rect(8,8,0xb7,0xb7)
    refreshAwaiting();
    const steps = hours * BED_STEPS_PER_HOUR;
    let done = 0;
    const wake = (): void => {
      this.cancel();
      this._sleeping = false;
      view.setBedBlackout(false);
      applyEvents(game.bedSleepEnd()); // 'S'→'G' + el +1 al este (epílogo 0x0692)
      refreshAwaiting();
    };
    this.timer = window.setInterval(() => {
      if (done >= steps) {
        wake();
        return;
      }
      const step = game.bedSleepStep();
      done++;
      applyEvents(step.events); // avanza el reloj (visible en el HUD) + «Thrown out of bed!»
      if (step.thrownOut) wake(); // 0x068f: no vuelve a 0x0634, cae al epílogo
    }, sceneMs(BED_STEP_MS));
  }
}
