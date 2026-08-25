/**
 * ★★ EL RESYNC DE ANCLA-NPC APUNTA A UNA CELDA QUE SU PROPIO TELEPORT VACÍA.
 *
 * `resyncToNpcAnchor` (`e2e/espejo-tour/runner.ts`) hace, en este orden:
 *   1. `liveNpcs(page)` — lee dónde están los NPC AHORA
 *   2. `resolveNpcAnchor(...)` — elige el mercader y la celda adyacente donde plantarse
 *   3. `teleportSmall(...)` — planta la party en esa celda
 *   4. (T)alk hacia el NPC y verifica `shopOpen()`
 *
 * El paso 3 pasa por `__u5debug.teleportSmallMap`, que llama a `npcManager.enterMap`
 * (`src/debug/debugApi.ts:337`), y `enterMap` **reconstruye cada NPC en su celda de
 * HORARIO** (`src/core/npc/manager.ts:186-199`: `x: s.x[idx], y: s.y[idx]`), DESCARTANDO
 * la posición a la que hubiera derivado. O sea: el paso 3 invalida la lectura del paso 1.
 * Si el NPC no estaba exactamente en su puesto cuando se le leyó, la party aterriza
 * adyacente a una celda que el teleport acaba de dejar VACÍA, el (T)alk cae al aire
 * («Funny, no response!» en el transcript del port) y `shopOpen()` sale falso.
 *
 * MEDIDO EN CORRIDA (ventana `anclas-f4`, réplicas R1/R2 del corpus AD sobre `41fb755f`):
 * de las anclas de tienda cuya celda leída NO era una celda de horario, **el 100 % falló**
 * — 0 contraejemplos. Y `ANCHOR-MISS` en AD es HOY 100 % de este canal.
 *
 * Este fichero conduce la función REAL contra un `Page` de mentira cuyo mundo modela las
 * dos reglas que importan —el teleport re-coloca a los NPC en su puesto, y el (T)alk abre
 * tienda sólo si hay mercader en la celda encarada—, siguiendo el patrón de
 * `espejo-rune-echo.test.ts`. Lo que se mide no es el retorno de una función pura: es si
 * la party acaba HABLANDO con el mercader.
 *
 * El control POSITIVO (NPC ya en su puesto ⇒ engancha) no es decorado: sin él, un «no
 * engancha» podría venir de que el mundo de mentira no sepa abrir tiendas, y el test no
 * probaría nada.
 */
import { describe, expect, it } from "vitest";
import type { Page } from "@playwright/test";
import { resyncToNpcAnchor } from "../e2e/espejo-tour/runner";

/** Minoc (loc 5), Healer (dialogNumber 0x87). Horario REAL de `assets/npcs.json` slot 2:
 *  x [7,6,25] · y [25,26,8] · times [21,5,11,13] · ai [FIJO, WANDER, WANDER].
 *  A las 9:00 el índice es 1 ⇒ puesto (6,26), con AI de wander. */
const PUESTO = { x: 6, y: 26 };
const DERIVADO = { x: 8, y: 26 }; // dos celdas al este del puesto: wander de radio 3

interface Mundo {
  pos: { location: number; floor: number; x: number; y: number };
  /** celda VIVA del mercader (la que `npcsAt` devuelve) */
  npc: { x: number; y: number };
  /** ¿la tienda está abierta? La pone el (T)alk si hay mercader en la celda encarada. */
  shopOpen: boolean;
  /** cuántas veces se ABRIÓ (el resync la cierra al salir: «cerrada al final» ≠ «nunca abrió») */
  aperturas: number;
  /** teclas que llegaron al mundo, en orden (para poder asertar la secuencia real) */
  teclas: string[];
  /** cuántas veces el teleport re-colocó a los NPC en su puesto */
  reposicionados: number;
  /** ¿hay un yesno de tributo de guardia VIVO? (Flow 2: se traga toda tecla salvo y/n) */
  tributo: boolean;
  /** turnos CONSUMIDOS por teclas de limpieza (cada uno corre npc_tick_all → wander) */
  turnos: number;
}

/**
 * Mundo de mentira con las DOS reglas del port que este defecto necesita:
 *  · `teleportSmallMap` → `enterMap` → el NPC vuelve a su celda de HORARIO (el reset)
 *  · (T)alk + flecha → `shopOpen` sólo si hay mercader en la celda encarada
 */
function pageFalsa(
  npcInicial: { x: number; y: number },
  opts: { tributoPendiente?: boolean } = {},
): { page: Page; mundo: Mundo } {
  const mundo: Mundo = {
    pos: { location: 5, floor: 0, x: 15, y: 30 },
    npc: { ...npcInicial },
    shopOpen: false,
    aperturas: 0,
    teclas: [],
    reposicionados: 0,
    tributo: opts.tributoPendiente ?? false,
    turnos: 0,
  };
  const enterMap = (): void => {
    // manager.ts:186-199 — CADA NPC a su celda de horario; lo derivado se descarta.
    if (mundo.npc.x !== PUESTO.x || mundo.npc.y !== PUESTO.y) mundo.reposicionados++;
    mundo.npc = { ...PUESTO };
  };
  let esperandoDir = false;
  const pulsa = (k: string): void => {
    mundo.teclas.push(k);
    // Yesno de Flow 2 VIVO (tributo de guardia): INMUNE al Escape, se traga toda tecla salvo
    // la respuesta. Pagar ('y') es una ACCIÓN DE JUEGO: consume turno, y el cierre del turno
    // de pueblo corre npc_tick_all (game.ts townTurn → afterHousekeeping → tickNpcs, calco de
    // TOWN 0x166E) — el mercader con AI de wander puede moverse. Ésta es la regla del port
    // que la ficha E2 necesita: entre el resync y la 't' pueden consumirse turnos.
    if (mundo.tributo) {
      if (k === "y") {
        mundo.tributo = false;
        mundo.turnos++;
        mundo.npc = { x: mundo.npc.x + 1, y: mundo.npc.y }; // wander determinista: 1 al este
      }
      return;
    }
    // Con la tienda ABIERTA el prompt es suyo (main.ts:2306) y nada llega al mapa. El saludo del
    // curandero para en el gate Y/N (getkey 0x1510): sólo la 'n' despide — Space y ESC se RE-LEEN.
    if (mundo.shopOpen) {
      if (k === "n") mundo.shopOpen = false;
      return;
    }
    if (k === "t") {
      esperandoDir = true;
      return;
    }
    if (!esperandoDir) return;
    esperandoDir = false;
    const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] }[k];
    if (!d) return;
    const cx = mundo.pos.x + d[0]!;
    const cy = mundo.pos.y + d[1]!;
    mundo.shopOpen = mundo.npc.x === cx && mundo.npc.y === cy; // main.ts:2350-2373
    if (mundo.shopOpen) mundo.aperturas++;
  };

  // `window` de mentira: la MISMA forma que leen getPos/liveNpcs/gridSnapshot/teleportSmall.
  const ventana = {
    __u5test: {
      state: () => ({ position: mundo.pos }),
      shopOpen: () => mundo.shopOpen,
      shopConsole: () => (mundo.shopOpen ? { type: "Healer", phase: "greet-yn", options: [] } : null),
      // La MISMA forma que lee `resolveBlockingYesNo` (runner.ts): el tributo pendiente se
      // declara como yesno de guardia; sin tributo, prompt nulo (= la ventana histórica).
      promptType: () => (mundo.tributo ? "yesno" : null),
      guardPromptOpen: () => (mundo.tributo ? "guard-tribute" : null),
      consoleLines: () => [],
      game: {
        state: { position: mundo.pos, worldObjects: [] },
        npcManager: {
          npcsAt: (l: number, f: number) =>
            l === 5 && f === 0 ? [{ x: mundo.npc.x, y: mundo.npc.y, type: 84, aiTypes: [0, 1, 1], dialogNumber: 0x87 }] : [],
        },
        // rejilla toda pisable (tile 4): la pisabilidad no es lo que este test mide
        activeMap: { width: 32, height: 32, tileAt: () => 4 },
        world: { smallMaps: { get: () => undefined } },
      },
    },
    __u5debug: {
      teleportSmallMap: (l: number, f: number, x: number, y: number) => {
        mundo.pos = { location: l, floor: f, x, y };
        enterMap(); // debugApi.ts:337 — el teleport SIEMPRE re-entra el mapa
      },
    },
  };

  const page = {
    locator: () => ({ count: async () => 0 }),
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
    keyboard: { press: async (k: string) => pulsa(k), type: async (t: string) => { for (const c of t) pulsa(c); } },
    waitForTimeout: async () => {},
  } as unknown as Page;
  return { page, mundo };
}

const ANCLA = { kind: "npc", cmd: "talk", match: "shop:Healer" } as const;

describe("resync de ancla-NPC — la lectura de NPC que el propio teleport invalida", () => {
  it("★★ NPC DERIVADO de su puesto: el resync tiene que acabar HABLANDO con el mercader, no al aire", async () => {
    const { page, mundo } = pageFalsa(DERIVADO);
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { ...ANCLA }, log);

    // Lo que se mide es el ENGANCHE, no el valor de retorno: el (T)alk tiene que caer
    // sobre el mercader tal y como el teleport lo dejó.
    expect(mundo.reposicionados, "el teleport SÍ re-colocó al NPC (si no, el test no mide nada)").toBeGreaterThan(0);
    expect(mundo.aperturas, `el (T)alk tiene que ENGANCHAR · log: ${log.join(" // ")}`).toBe(1);
    // Y el diálogo se cierra al salir (carril `cierre-dialogo`): dejarlo abierto hace que los ops
    // siguientes del guion caigan DENTRO de la tienda — el −12 de `part09-g10`, §5.4-bis.
    expect(mundo.shopOpen, "el resync no deja el diálogo vivo detrás").toBe(false);
    expect(out.status).toBe("resolved-jump");
  });

  it("★★ FICHA E2 — la adyacencia se verifica AL PULSAR, no al resincronizar: un turno consumido entre medias (el 'y' del tributo) mueve al mercader y el Talk tiene que corregir, no caer al aire", async () => {
    // NPC en su puesto al leerse (resync impecable) + un yesno de tributo VIVO. El orden del
    // runner es: lectura autoritativa → teleport final → resolveBlockingYesNo ('y' = turno
    // consumido → npc_tick_all → el mercader wanderea) → Escape ×2 → 't'. Antes del fix la
    // dirección del Talk era la del INSTANTE DEL RESYNC: la 't' caía sobre la celda ya vacía
    // («Funny, no response!» tras un resync verde) y las teclas de la transacción median
    // deltas falsos. El aserto NIEGA ese desenlace (nada de miss con el mercader EN el mapa)
    // Y AFIRMA el rasgo correcto: el Talk ENGANCHA (aperturas=1) tras re-verificar al pulsar.
    const { page, mundo } = pageFalsa(PUESTO, { tributoPendiente: true });
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { ...ANCLA }, log);

    expect(mundo.teclas, "control del vehículo: el tributo se pagó ('y') ANTES de la 't'").toContain("y");
    expect(mundo.turnos, "control del vehículo: EXACTAMENTE un turno consumido entre resync y 't'").toBe(1);
    expect(mundo.reposicionados, "el teleport CORRECTIVO devolvió al mercader a su puesto (re-verificación al pulsar)").toBeGreaterThan(0);
    expect(mundo.aperturas, `el (T)alk tiene que ENGANCHAR pese al wander intermedio · log: ${log.join(" // ")}`).toBe(1);
    expect(mundo.shopOpen, "el resync no deja el diálogo vivo detrás").toBe(false);
    expect(out.status).toBe("resolved-jump");
  });

  it("CONTROL POSITIVO — NPC ya en su puesto: engancha (el mundo de mentira sabe abrir tiendas)", async () => {
    const { page, mundo } = pageFalsa(PUESTO);
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { ...ANCLA }, log);

    expect(mundo.reposicionados, "aquí el teleport no mueve a nadie: ya estaba en su puesto").toBe(0);
    expect(mundo.aperturas).toBe(1);
    expect(mundo.shopOpen).toBe(false);
    expect(out.status).toBe("resolved-jump");
  });

  it("CONTROL de la SECUENCIA — se conduce el (T)alk real: Escape ×2, 't' y flecha", async () => {
    const { page, mundo } = pageFalsa(PUESTO);
    await resyncToNpcAnchor(page, { ...ANCLA }, []);
    expect(mundo.teclas.slice(0, 4)).toEqual(["Escape", "Escape", "t", expect.stringMatching(/^Arrow/)]);
    // …y la 'n' del CIERRE detrás (la fase `greet-yn` re-lee Space/ESC; ver `espejo-cierre-dialogo`).
    expect(mundo.teclas.slice(4)).toEqual(["n"]);
  });

  it("CONTROL NEGATIVO — sin mercader en el mapa vivo el resync declara MISS por el canal 2a", async () => {
    const { page } = pageFalsa(PUESTO);
    const log: string[] = [];
    const out = await resyncToNpcAnchor(page, { kind: "npc", cmd: "talk", match: "shop:Blacksmith" }, log);
    expect(out.status).toBe("miss");
    expect(log.join(" ")).toContain("NPC-ANCHOR-MISS");
  });
});
