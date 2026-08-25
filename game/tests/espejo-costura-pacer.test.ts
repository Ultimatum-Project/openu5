/**
 * ★★ LA COSTURA HACE SU `goToLocation` MIENTRAS UNA ESCENA A RELOJ DE PARED SIGUE VIVA,
 * Y EL TELEPORT DE LA ESCENA LLEGA DESPUÉS Y LO PISA.
 *
 * `runSegment` abre cada segmento con `purgeLiveModes` (Escape ×2) y luego resuelve la costura
 * de entrada con `goToLocation`. Pero los pacers a RELOJ DE PARED —`refuging`, `camping`,
 * `moongate`, `trollSneak`, `endgame`— **no se despejan con teclas**: `handleGameKey`
 * (`src/main.ts`) hace `preventDefault()+return` mientras corren. El Escape ×2 pasa de largo y
 * la escena sigue su cuenta atrás POR DEBAJO de la costura.
 *
 * El peor de los cinco es `refuging` (party-wipe + resurrección, BLCKTHRN 0x0910): al terminar,
 * `runRefugeScene` llama a `game.resolveRefuge()` → `partyRefuge`, que **despierta a la party en
 * el castillo de Lord British** (loc 0x11 = 17, planta 1, (10,10)) y pone el reloj a 6:00
 * (`core/game.ts`). Si eso ocurre DESPUÉS del `goToLocation` de la costura, el segmento entero
 * se conduce y se mide en el mapa EQUIVOCADO.
 *
 * MEDIDO EN CORRIDA (ventana `f4bc-residuales`, corpus AD, `ad06-g18`, réplicas B y C
 * IDÉNTICAS): la costura anota `enter TRINSIC: resync por goToLocation` y pocas ops después el
 * ancla de mercader falla con `NPC-ANCHOR-MISS 'shop:Blacksmith' @loc17`. Tres testigos
 * independientes lo cierran:
 *   · el transcript del propio segmento ABRE con los últimos beats del refuge
 *     («There is a peal of thunder!» → discurso de LB → «Strange words are intoned.» →
 *     «Vertigo...»), o sea: la escena TERMINÓ dentro del segmento, después de la costura;
 *   · `@loc17` es exactamente el destino de `partyRefuge` (loc 0x11);
 *   · la costura de salida del segmento SIGUIENTE dice «el replay no salió de loc=17».
 *
 * Este fichero conduce la función REAL contra un `Page` de mentira cuyo mundo modela las dos
 * reglas que importan: el pacer se declara vivo por `inputSinks` durante N sondeos, y AL
 * TERMINAR aplica el teleport de `partyRefuge`. Los DOS BRAZOS son el experimento: la costura
 * SIN espera (el comportamiento de antes) tiene que acabar en el castillo, y la costura CON
 * espera en la location que pide la ruta. Sin el brazo «sin espera» el verde no probaría que lo
 * que arregla es el ORDEN.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { waitOutSeamPacers } from "../e2e/espejo-tour/runner";

const LOC_TRINSIC = 6;
/** `partyRefuge`: castillo de Lord British, loc 0x11, planta 1, (10,10). */
const REFUGE_DESTINO = { location: 17, floor: 1, x: 10, y: 10 };

interface Mundo {
  pos: { location: number; floor: number; x: number; y: number };
  /** sondeos de `inputSinks` que quedan antes de que la escena termine */
  beatsRestantes: number;
  /** ¿ha resuelto ya la escena su teleport? */
  refugeResuelto: boolean;
  /** teclas que llegaron al mundo (el Escape ×2 de la purga NO debe despejar el pacer) */
  teclas: string[];
  /** cuántas veces se sondeó `inputSinks` */
  sondeos: number;
}

/**
 * Mundo de mentira con las dos reglas del port que este defecto necesita:
 *  · `inputSinks().refuging` es true mientras a la escena le quedan beats — y NINGUNA tecla lo
 *    baja (main.ts se come el teclado durante la escena);
 *  · cuando se agota, `resolveRefuge` teletransporta a la party al castillo de LB.
 * El reloj de la escena avanza con cada `waitForTimeout` (el pacer es de RELOJ DE PARED: lo que
 * lo consume es el TIEMPO, no las teclas).
 */
function pageFalsa(beats: number): { page: Page; mundo: Mundo } {
  const mundo: Mundo = {
    pos: { location: LOC_TRINSIC, floor: 0, x: 15, y: 30 },
    beatsRestantes: beats,
    refugeResuelto: false,
    teclas: [],
    sondeos: 0,
  };
  /** un beat de reloj de pared; al agotarse la escena aplica su mutación (partyRefuge). */
  const tic = (): void => {
    if (mundo.beatsRestantes > 0) {
      mundo.beatsRestantes--;
      if (mundo.beatsRestantes === 0) {
        mundo.refugeResuelto = true;
        mundo.pos = { ...REFUGE_DESTINO };
      }
    }
  };
  const ventana = {
    __u5test: {
      state: () => ({ position: mundo.pos }),
      inputSinks: () => {
        mundo.sondeos++;
        return { refuging: mundo.beatsRestantes > 0, camping: false, trollSneak: false, moongate: false, endgame: false };
      },
    },
    __u5debug: {
      goToLocation: (l: number) => {
        mundo.pos = { location: l, floor: 0, x: 15, y: 30 };
      },
    },
  };
  const page = {
    evaluate: async (fn: (arg?: unknown) => unknown, arg?: unknown) => {
      const g = globalThis as unknown as { window?: unknown };
      const previo = g.window;
      g.window = ventana;
      try {
        return fn(arg);
      } finally {
        g.window = previo;
      }
    },
    keyboard: { press: async (k: string) => void mundo.teclas.push(k) },
    waitForTimeout: async () => tic(),
  } as unknown as Page;
  return { page, mundo };
}

/** El `goToLocation` de la costura, tal cual lo hace `runSegment` (misma forma que el helper
 *  real `goToLocationSeam`: se lee la posición y, si no es la pedida, se salta). */
async function costuraGoToLocation(page: Page, loc: number): Promise<void> {
  await page.evaluate((l) => {
    (window as unknown as { __u5debug?: { goToLocation?: (l: number) => void } }).__u5debug?.goToLocation?.(l as number);
  }, loc);
}

/** El Escape ×2 de `purgeLiveModes`: no despeja un pacer de reloj de pared (se comprueba). */
async function purga(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

describe("costura del espejo — el pacer a reloj de pared que pisa el resync de location", () => {
  it("★★ CON espera: la costura acaba en la location de la RUTA, no donde la deja el refuge", async () => {
    const { page, mundo } = pageFalsa(6);
    const log: string[] = [];

    const esperados = await waitOutSeamPacers(page, log);
    await purga(page);
    await costuraGoToLocation(page, LOC_TRINSIC);

    expect(mundo.refugeResuelto, "el refuge TENÍA que resolverse (si no, el test no mide nada)").toBe(true);
    expect(esperados, "la espera tiene que NOMBRAR el pacer que esperó").toEqual(["refuging"]);
    expect(mundo.pos.location, `la party tiene que quedarse en la loc de la ruta · log: ${log.join(" // ")}`).toBe(LOC_TRINSIC);
    expect(log.join(" ")).toContain("refuging");
  });

  it("★★ BRAZO SIN ESPERA (lo de antes): el teleport del refuge PISA el resync → castillo de LB", async () => {
    const { page, mundo } = pageFalsa(6);

    // exactamente lo que hacía `runSegment`: purgar con Escape ×2 y resincronizar location.
    await purga(page);
    await costuraGoToLocation(page, LOC_TRINSIC);
    // la escena sigue viva y termina más tarde, DENTRO del segmento
    while (mundo.beatsRestantes > 0) await page.waitForTimeout(0);

    expect(mundo.pos.location, "sin la espera la party acaba en el castillo (loc 17), que es el miss medido").toBe(17);
  });

  it("CONTROL — el Escape ×2 NO despeja el pacer (por eso la espera va ANTES de la purga)", async () => {
    const { page, mundo } = pageFalsa(6);
    await purga(page);
    expect(mundo.teclas).toEqual(["Escape", "Escape"]);
    expect(mundo.beatsRestantes, "las teclas no consumen el reloj de pared").toBe(6);
  });

  it("CONTROL NEGATIVO — sin pacer vivo la espera no sondea de más ni escribe en el log", async () => {
    const { page, mundo } = pageFalsa(0);
    const log: string[] = [];

    const esperados = await waitOutSeamPacers(page, log);

    expect(esperados).toEqual([]);
    expect(log).toEqual([]);
    expect(mundo.sondeos, "un solo sondeo: sale al primer `livePacers` vacío").toBe(1);
  });

  it("CONTROL DE PRESUPUESTO — un pacer que no acaba NO cuelga la parte: se declara y se sigue", async () => {
    const { page } = pageFalsa(Number.MAX_SAFE_INTEGER); // no termina nunca
    const log: string[] = [];

    const esperados = await waitOutSeamPacers(page, log, 0); // presupuesto agotado de salida

    expect(esperados).toEqual(["refuging"]);
    expect(log.join(" ")).toContain("SIGUEN vivos");
  });

  /**
   * PRUEBA DE EJECUCIÓN (mismo papel que `filterFed` en el reporte): los tests de arriba
   * conducen la función, no la COSTURA. Una función correcta que nadie llama sería un
   * cinturón dentro de una rama muerta y todos ellos seguirían verdes. Esto ata el call-site
   * Y SU ORDEN: la espera va ANTES del Escape ×2, porque el Escape no despeja el pacer.
   */
  it("EJECUCIÓN — `runSegment` llama a la espera, y ANTES de `purgeLiveModes`", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour", "runner.ts"), "utf8");
    const cuerpo = src.slice(src.indexOf("const mark = await accLength(page);"));
    const iEspera = cuerpo.indexOf("await waitOutSeamPacers(page, resyncs)");
    const iPurga = cuerpo.indexOf("---- PURGA DE MODOS del segmento anterior");
    expect(iEspera, "`runSegment` no llama a waitOutSeamPacers").toBeGreaterThan(-1);
    expect(iPurga, "no encuentro la purga de la costura de entrada").toBeGreaterThan(-1);
    expect(iEspera, "la espera tiene que ir ANTES de la purga").toBeLessThan(iPurga);
  });
});
