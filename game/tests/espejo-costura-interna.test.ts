/**
 * ★★ COSTURA INTERNA — las dos ops que le faltaban al vocabulario del espejo.
 *
 * ## El agujero
 *
 * El `ctx`/costura de un segmento describe dónde **EMPIEZA**, no dónde ocurre cada beat. Cuando
 * el LP entra a una location **a mitad de segmento**, el runner se queda fuera: `resyncEnterLocation`
 * (`runner.ts`) existe desde el relevo-3, pero **sólo lo llama la costura de segmento**. Consecuencia
 * medida (`teclas-ad09-acta.md` §3): en `ad09-g04` la party sigue en el mapa grande durante toda la
 * visita al torreón, el ancla de NPC se abstiene por diseño (`if (pos.location === 0) → skip`) y el
 * delta −274 del herrero **no puede armar**.
 *
 * ## Qué conduce este fichero
 *
 * La función REAL (`applyInternalSeam`) contra un `Page` de mentira, patrón de
 * `espejo-ancla-npc.test.ts`. Y el test que ADJUDICA el ticket no mira el retorno de la op: encadena
 * `applyInternalSeam` con `resyncToNpcAnchor` —la función que hoy se abstiene— y mide si la party
 * acaba HABLANDO con el mercader. Su control negativo (sin la op) tiene que producir el `skip`
 * histórico, o el mundo de mentira no estaría probando nada. [[control-negativo-verde-sin-validar-no-prueba]]
 *
 * ## Por qué la capa de `exitOverworld` es un STRING y no un booleano
 *
 * La capa es exactamente el campo que este arnés ya se comió una vez: `resyncExitToOverworld` iba
 * sin pasar su tercer argumento y el default `false` depositaba SIEMPRE en Britannia, también en las
 * costuras del Underworld (E-2, documentado en el propio `runner.ts`). Un `exitOverworld: true`
 * reproduciría el agujero con otra caligrafía; el string OBLIGA a declarar la capa en el corpus.
 * [[valor-neutro-dentro-del-dominio]]
 *
 * ## Dónde corre cada bloque (frontera de `espejo-corpus.ts`)
 *
 * ★ De los 18 tests que este fichero tenía, **12 no tocaban corpus alguno** (los once que
 * conducen `applyInternalSeam`/`resyncToNpcAnchor` contra el `Page` de mentira, más la guarda
 * estática de orden, que lee `runner.ts` como TEXTO — y `runner.ts` sí viaja). Estaban fuera del
 * CI público como rehenes de un `leerRuta` en el cuerpo de un `describe`. Ya no: toda lectura de
 * corpus va por `ruta()`/`segmento()` y se invoca DENTRO del `it`.
 *
 * Reparto de hoy: 12 unitarios + 5 nuevos contra el corpus SINTÉTICO (`routes-sint/`, que viaja)
 * corren en TODAS partes; los 6 que son hecho del corpus REAL —los `ocrLn` y cardinales de
 * `ad09-g04`, el censo declarado `enterLoc: 1 · exitOverworld: 0`— van en `describeCorpusReal`.
 * Ninguno se ha borrado ni movido de sujeto.
 */
import { describe, expect, it } from "vitest";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyInternalSeam,
  resyncToNpcAnchor,
  seamLocationFromBanner,
  UNDERWORLD_FLOOR,
  type Op,
  type Route,
  type Segment,
} from "../e2e/espejo-tour/runner";
import { describeCorpusReal, PARTES_SINT } from "./espejo-corpus";

const HERE = dirname(fileURLToPath(import.meta.url));
const ESPEJO = join(HERE, "..", "e2e", "espejo-tour");
const leerRuta = (dir: string, part: string): Route =>
  JSON.parse(readFileSync(join(ESPEJO, dir, `${part}.route.json`), "utf8")) as Route;

/**
 * 🔴 TODA lectura de corpus va por aquí, y esto se invoca SÓLO DENTRO de un `it`.
 * Hasta hoy este fichero hacía `const ad09 = leerRuta("routes-ad","ad09")` en el CUERPO de un
 * `describe`, y eso no es carga de módulo pero da igual: el cuerpo del `describe` corre al
 * RECOLECTAR — también el de un `describe.skip` —, así que en el árbol público (donde
 * `routes-ad/` no viaja) el fichero ENTERO caía por ENOENT y se llevaba por delante los doce
 * unitarios y la guarda estática, que no tocan corpus ninguno.
 */
const cacheRutas = new Map<string, Route>();
function ruta(dir: string, part: string): Route {
  const clave = `${dir}/${part}`;
  let r = cacheRutas.get(clave);
  if (!r) {
    r = leerRuta(dir, part);
    cacheRutas.set(clave, r);
  }
  return r;
}
function segmento(dir: string, part: string, id: string): Segment {
  const s = ruta(dir, part).segments.find((x) => x.id === id);
  expect(s, `el segmento ${id} no existe en ${dir}/${part}`).toBeDefined();
  return s!;
}

/** Bordermarch = loc 26. `data.locationNames[20]`, con el mapeo empaquetado de
 *  `Game.locationNameBanner` (ids ≥19 → idx id−6). Es el mismo 26 del `shopTownIndex("Blacksmith", 26)`. */
const BORDERMARCH = 26;
/** Celda de entrada estándar de un small map (`loadSmallMap` → `SMALL_MAP_ENTRY`). */
const ENTRADA = { x: 15, y: 31 };
/** Tile de overworld del torreón (`data.locationsX/Y[25]`). */
const TILE_BORDERMARCH = { x: 15, y: 160 };
/** El herrero de Bordermarch en su puesto. */
const HERRERO = { x: 10, y: 10 };

interface Mundo {
  pos: { location: number; floor: number; x: number; y: number };
  dungeonState: unknown;
  /** cuántas veces se llamó a cada hook sancionado (para separar «no hizo falta» de «no lo hizo») */
  goToLocation: number[];
  teleportOverworld: Array<{ x: number; y: number; u: boolean }>;
  teclas: string[];
  shopOpen: boolean;
  aperturas: number;
}

/**
 * Mundo de mentira con las reglas del port que estas ops tocan:
 *  · `goToLocation(id)` → position = {location:id, floor:0, entrada estándar} (cero-rand)
 *  · `teleportOverworld(x,y,u)` → location 0 y la CAPA que se le pase (floor 0xFF si underworld)
 *  · (T)alk + flecha → `shopOpen` sólo si hay mercader en la celda encarada
 */
function pageFalsa(inicial: Partial<Mundo["pos"]> = {}): { page: Page; mundo: Mundo } {
  const mundo: Mundo = {
    pos: { location: 0, floor: 0, x: TILE_BORDERMARCH.x, y: TILE_BORDERMARCH.y, ...inicial },
    dungeonState: null,
    goToLocation: [],
    teleportOverworld: [],
    teclas: [],
    shopOpen: false,
    aperturas: 0,
  };
  let esperandoDir = false;
  const pulsa = (k: string): void => {
    mundo.teclas.push(k);
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
    mundo.shopOpen = mundo.pos.location === BORDERMARCH && HERRERO.x === cx && HERRERO.y === cy;
    if (mundo.shopOpen) mundo.aperturas++;
  };
  const locationsX: number[] = [];
  const locationsY: number[] = [];
  locationsX[BORDERMARCH - 1] = TILE_BORDERMARCH.x;
  locationsY[BORDERMARCH - 1] = TILE_BORDERMARCH.y;

  const ventana = {
    __u5test: {
      state: () => ({ position: mundo.pos }),
      shopOpen: () => mundo.shopOpen,
      shopConsole: () => (mundo.shopOpen ? { type: "Blacksmith", phase: "greet", options: [] } : null),
      game: {
        get dungeonState() {
          return mundo.dungeonState;
        },
        set dungeonState(v: unknown) {
          mundo.dungeonState = v;
        },
        // `position` va por GETTER, no por referencia capturada: `goToLocation` REEMPLAZA el
        // objeto (igual que el core), y un `{ position: mundo.pos }` literal dejaría a
        // `liveNpcs` —que lee `game.state.position`— mirando la location ANTERIOR para siempre.
        state: {
          get position() {
            return mundo.pos;
          },
          worldObjects: [],
        },
        data: { locationsX, locationsY },
        npcManager: {
          npcsAt: (l: number, f: number) =>
            l === BORDERMARCH && f === 0
              ? [{ x: HERRERO.x, y: HERRERO.y, type: 84, aiTypes: [0, 0, 0], dialogNumber: 0x81 }]
              : [],
        },
        activeMap: { width: 32, height: 32, tileAt: () => 4 },
        world: { smallMaps: { get: () => undefined } },
      },
    },
    __u5debug: {
      goToLocation: (id: number) => {
        mundo.goToLocation.push(id);
        mundo.pos = { location: id, floor: 0, ...ENTRADA };
      },
      teleportOverworld: (x: number, y: number, u?: boolean) => {
        mundo.teleportOverworld.push({ x, y, u: !!u });
        mundo.pos = { location: 0, floor: u ? UNDERWORLD_FLOOR : 0, x, y };
      },
      teleportSmallMap: (l: number, f: number, x: number, y: number) => {
        mundo.pos = { location: l, floor: f, x, y };
      },
      dungeonPos: () => null,
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

describe("costura interna — op `enterLoc`", () => {
  it("★★ desde el mapa grande mete a la party DENTRO de la location, por el hook sancionado", async () => {
    const { page, mundo } = pageFalsa();
    const log: string[] = [];

    const manejado = await applyInternalSeam(page, { enterLoc: BORDERMARCH }, log);

    expect(manejado, "la op tiene que declararse manejada (o el bucle la trataría como beat)").toBe(true);
    expect(mundo.goToLocation, "cero-rand: goToLocation, no teleport+(E)").toEqual([BORDERMARCH]);
    expect(mundo.pos.location).toBe(BORDERMARCH);
    expect(log.join(" // ")).toMatch(/costura INTERNA enterLoc 26/);
  });

  it("IDEMPOTENCIA: si la party YA está dentro, no re-teleporta (borraría la posición ganada) y lo DECLARA", async () => {
    const { page, mundo } = pageFalsa({ location: BORDERMARCH, x: 7, y: 9 });
    const log: string[] = [];

    await applyInternalSeam(page, { enterLoc: BORDERMARCH }, log);

    expect(mundo.goToLocation, "no se llama al hook: ya estaba dentro").toEqual([]);
    expect(mundo.pos).toMatchObject({ x: 7, y: 9 });
    expect(log.join(" // ")).toMatch(/ya dentro/);
  });

  it("RANGO: una MAZMORRA (33..40) se rechaza — goToLocation dejaría un estado imposible", async () => {
    const { page, mundo } = pageFalsa();
    const log: string[] = [];

    await expect(applyInternalSeam(page, { enterLoc: 35 }, log)).rejects.toThrow(/setDungeonPos|mazmorra/i);
    expect(mundo.goToLocation, "y no se llega a tocar el hook").toEqual([]);
  });

  it("RANGO: un id fuera de 1..32 aborta en vez de resincronizar a la nada", async () => {
    const { page } = pageFalsa();
    await expect(applyInternalSeam(page, { enterLoc: 0 }, [])).rejects.toThrow();
    await expect(applyInternalSeam(page, { enterLoc: 99 }, [])).rejects.toThrow();
  });
});

describe("costura interna — op `exitOverworld`", () => {
  it("saca a la party al tile-entrada de su location, en BRITANNIA", async () => {
    const { page, mundo } = pageFalsa({ location: BORDERMARCH, x: 7, y: 9 });
    const log: string[] = [];

    const manejado = await applyInternalSeam(page, { exitOverworld: "britannia" }, log);

    expect(manejado).toBe(true);
    expect(mundo.teleportOverworld).toEqual([{ ...TILE_BORDERMARCH, u: false }]);
    expect(mundo.pos).toMatchObject({ location: 0, floor: 0 });
    expect(log.join(" // ")).toMatch(/costura INTERNA exitOverworld britannia/);
  });

  it("★★ la CAPA viaja: `underworld` deposita en el Underworld (floor 0xFF), no en Britannia", async () => {
    const { page, mundo } = pageFalsa({ location: BORDERMARCH, x: 7, y: 9 });
    const log: string[] = [];

    await applyInternalSeam(page, { exitOverworld: "underworld" }, log);

    expect(mundo.teleportOverworld, "el 3er argumento de teleportOverworld es la capa (bug E-2)").toEqual([
      { ...TILE_BORDERMARCH, u: true },
    ]);
    expect(mundo.pos.floor).toBe(UNDERWORLD_FLOOR);
    expect(log.join(" // ")).not.toMatch(/RESYNC-FAIL/);
  });

  it("SALIR ES TAMBIÉN DEJAR EL 3D: el dungeonState vivo se cierra (el core hace las dos cosas)", async () => {
    const { page, mundo } = pageFalsa({ location: BORDERMARCH, x: 7, y: 9 });
    mundo.dungeonState = { dungeon: 35, floor: 0 };

    await applyInternalSeam(page, { exitOverworld: "britannia" }, []);

    expect(mundo.dungeonState).toBeNull();
  });

  it("una capa que no es del vocabulario aborta (no cae al default silencioso de Britannia)", async () => {
    const { page } = pageFalsa({ location: BORDERMARCH });
    await expect(
      applyInternalSeam(page, { exitOverworld: "britania" as unknown as "britannia" }, []),
    ).rejects.toThrow();
  });
});

describe("costura interna — las ops que NO son suyas", () => {
  it("una op cualquiera NO se declara manejada (el bucle tiene que seguir conduciéndola)", async () => {
    const { page } = pageFalsa();
    const log: string[] = [];
    for (const op of [{ key: "b" }, { nav: [{ m: "north", v: "walk", n: 1 }] }, { seedGold: 3000 }] as Op[]) {
      expect(await applyInternalSeam(page, op, log)).toBe(false);
    }
    expect(log).toEqual([]);
  });
});

describe("★★ EL DEFECTO QUE ABRE EL TICKET: el ancla de NPC en territorio overworld", () => {
  it("CONTROL NEGATIVO — sin la op, el ancla se abstiene (`skip`) y el ledger no puede armar", async () => {
    const { page, mundo } = pageFalsa();
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { kind: "npc", cmd: "buy", match: "shop:Blacksmith", expectDelta: -274 }, log);

    expect(out.status, "es el estado histórico: sin él este fichero no probaría nada").toBe("skip");
    expect(log.join(" ")).toContain("skip (overworld, sin resync fino)");
    expect(mundo.aperturas).toBe(0);
  });

  it("★★ CON la op, la party acaba HABLANDO con el herrero — que es lo que el ledger necesita", async () => {
    const { page, mundo } = pageFalsa();
    const log: string[] = [];

    await applyInternalSeam(page, { enterLoc: BORDERMARCH }, log);
    const out = await resyncToNpcAnchor(page, { kind: "npc", cmd: "buy", match: "shop:Blacksmith", expectDelta: -274 }, log);

    expect(out.status, `log: ${log.join(" // ")}`).not.toBe("skip");
    expect(mundo.aperturas, "el (T)alk ENGANCHA la tienda: sin esto las teclas de compra caen al mapa").toBe(1);
    expect(log.join(" ")).not.toContain("skip (overworld");
    // El diálogo se deja ABIERTO a propósito en las anclas de transacción (`expectDelta` != null):
    // las teclas de compra del guion lo necesitan. Cerrarlo pondría el delta a 0.
    expect(mundo.shopOpen).toBe(true);
  });
});

/**
 * ★★ LA PROPIEDAD DE HERRAMIENTA, sobre el corpus SINTÉTICO (corre en el árbol PÚBLICO).
 *
 * Lo que hace útil a un `enterLoc` no es dónde lo puso el curador en `ad09-g04`: es que
 * **preceda a un ancla de transacción**. Un `enterLoc` detrás de todas ellas es exactamente el
 * mutante [[fix-localizado-pero-inerte]] — la op cableada, el corpus «correcto», todo verde, y
 * el ancla leyendo `location === 0` igual que antes.
 *
 * 🔴 Y ese predicado NO es «índice del enterLoc < índice del PRIMER ancla de NPC», que es como
 * lo dice la versión del corpus real. En `sint03-g02` el primer ancla va en el índice 1 y el
 * `enterLoc` en el 5: con aquella formulación este test sería ROJO sobre un corpus que está
 * bien. Lo que hay que exigir es que **quede al menos un ancla de transacción DESPUÉS**, que es
 * la condición de la que depende que la op no sea inerte.
 */
describe("cableado en el corpus SINTÉTICO — `sint03-g02` (público)", () => {
  const SEG_SINT = { dir: "routes-sint", part: "sint03", id: "sint03-g02" } as const;
  /** ¿La costura interna de este guion tiene a quién servir? = hay ancla de transacción DETRÁS. */
  const precedeATransaccion = (script: Op[]): boolean => {
    const i = script.findIndex((o) => o.enterLoc != null);
    if (i < 0) return false;
    return script.slice(i + 1).some((o) => o.anchor?.kind === "npc" && o.anchor.expectDelta != null);
  };

  it("lleva UNA op `enterLoc` de procedencia overlay", () => {
    const seg = segmento(SEG_SINT.dir, SEG_SINT.part, SEG_SINT.id);
    const ops = seg.script.filter((o) => o.enterLoc != null);
    expect(ops.length, "guarda de población: sin ops `enterLoc` este bloque no mediría nada").toBeGreaterThan(0);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.src).toBe("overlay");
  });

  it("★★ la op precede a un ancla de transacción — detrás de todas ellas quedaría inerte", () => {
    const seg = segmento(SEG_SINT.dir, SEG_SINT.part, SEG_SINT.id);
    const anclas = seg.script.filter((o) => o.anchor?.kind === "npc" && o.anchor.expectDelta != null);
    expect(anclas.length, "guarda de población: contaba anclas de transacción del segmento").toBeGreaterThan(0);
    expect(precedeATransaccion(seg.script)).toBe(true);
  });

  it("★★ CONTROL NEGATIVO: con la op movida al FINAL, el predicado se pone en falso", () => {
    // El mutante se construye sobre una COPIA EN MEMORIA. El fichero del corpus no se toca:
    // es punto fijo de las tres herramientas y editarlo lo sacaría de ahí (README §Régimen).
    // Sin este control, «precede a una transacción» podría ser cierto por construcción del
    // predicado y no del corpus. [[control-negativo-verde-sin-validar-no-prueba]]
    const seg = segmento(SEG_SINT.dir, SEG_SINT.part, SEG_SINT.id);
    const i = seg.script.findIndex((o) => o.enterLoc != null);
    expect(i, "guarda de población: sin `enterLoc` no hay nada que mover").toBeGreaterThanOrEqual(0);
    const mutante = seg.script.filter((_, k) => k !== i).concat(seg.script[i]!);
    expect(mutante).toHaveLength(seg.script.length); // la mutación MUEVE, no borra
    expect(precedeATransaccion(mutante)).toBe(false);
  });
});

// ⚠ CORPUS REAL. Los `ocrLn` y los cardinales de bloque de `ad09-g04` son de la captura del LP:
// su sujeto es el corpus, no la herramienta, y en sintético los escribiríamos nosotros.
// Las dos primeras se quedan aquí ADEMÁS de tener gemela sintética: dicen algo distinto —
// que el CURADOR cableó bien ESTE segmento, no que la op tenga la forma que debe.
describeCorpusReal("cableado en el corpus — `ad09-g04`", () => {
  it("lleva UNA op `enterLoc` de procedencia overlay", () => {
    const seg = segmento("routes-ad", "ad09", "ad09-g04");
    const ops = seg.script.filter((o) => o.enterLoc != null);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.src).toBe("overlay");
  });

  it("★★ va ANTES del ancla de transacción — colocarla después la dejaría inerte", () => {
    const seg = segmento("routes-ad", "ad09", "ad09-g04");
    const iEnter = seg.script.findIndex((o) => o.enterLoc != null);
    const iAncla = seg.script.findIndex((o) => o.anchor?.kind === "npc");
    expect(iEnter).toBeGreaterThanOrEqual(0);
    expect(iAncla).toBeGreaterThanOrEqual(0);
    expect(iEnter, "el resync de location tiene que preceder al resync del ancla").toBeLessThan(iAncla);
  });

  it("★ el único tramo de OVERWORLD REAL del segmento (107-163) queda ANTES de la op", () => {
    // La premisa del ticket decía que 412-1082 era vuelo por Britannia. No lo es: es el INTERIOR
    // del torreón (pre-registro §0). El overworld de verdad son 15 bloques, y todos preceden a la
    // entrada — por eso la op no puede degradarlos.
    const seg = segmento("routes-ad", "ad09", "ad09-g04");
    const enterOp = seg.script.find((o) => o.enterLoc != null)!;
    expect(enterOp.ocrLn).toBe(164);
    expect(seg.expect.filter((b) => b.ocrLn < 164)).toHaveLength(15);
    expect(seg.expect.filter((b) => b.ocrLn >= 164)).toHaveLength(204);
  });
});

describe("★★ EL ORDEN DENTRO DEL BUCLE — la guarda que los tests de arriba NO pueden dar", () => {
  /**
   * MEDIDO, no supuesto: se mutó el `runner.ts` moviendo la llamada a `applyInternalSeam` a
   * DESPUÉS del bloque de anclas y **los 18 tests siguieron verdes**. Y esa mutación es
   * justamente la que deja el ticket INERTE: el ancla leería `location === 0`, se abstendría
   * igual que antes y el delta volvería a 0 — con la op cableada, el corpus correcto y todo
   * en verde. [[mutante-que-no-muta]] · [[fix-localizado-pero-inerte]]
   *
   * Ningún test de comportamiento de este fichero puede cerrarlo: los unitarios llaman a
   * `applyInternalSeam` directamente y el del corpus mira el orden en la RUTA, no en el
   * bucle. `runSegment` no es exportable a un `Page` de mentira sin arrastrar medio arnés.
   * Así que la guarda es ESTÁTICA y lo dice: pina el orden de las tres fases dentro del
   * cuerpo del bucle de conducción.
   */
  const fuente = readFileSync(join(ESPEJO, "runner.ts"), "utf8");
  const idx = (s: string): number => {
    const i = fuente.indexOf(s);
    expect(i, `el ancla textual de la guarda ya no existe en runner.ts: ${s}`).toBeGreaterThan(-1);
    return i;
  };

  it("la costura interna se despacha ANTES del bloque de anclas y ANTES del armado del ledger", () => {
    const bucle = idx("for (const op of seg.script) {");
    const costura = fuente.indexOf("await applyInternalSeam(page, op, resyncs)", bucle);
    const ancla = fuente.indexOf("if (op.anchor && op.anchor.kind === \"face\")", bucle);
    const ledger = fuente.indexOf("const arm = ledgerArm(op);", bucle);

    expect(costura, "la llamada tiene que estar DENTRO del bucle de conducción").toBeGreaterThan(bucle);
    expect(costura, "si la costura va después del ancla, el ancla sigue viendo location 0 y el ticket queda inerte").toBeLessThan(ancla);
    expect(costura, "y el oro se captura después de la costura, no antes").toBeLessThan(ledger);
  });
});

/** Todas las ops de un corpus, con su dirección. PEREZOSA: se invoca dentro del `it`. */
const opsDe = (dir: string, partes: readonly string[]): Array<{ part: string; seg: string; op: Op }> => {
  const out: Array<{ part: string; seg: string; op: Op }> = [];
  for (const p of partes) {
    let r: Route;
    try {
      r = ruta(dir, p);
    } catch {
      continue;
    }
    for (const s of r.segments) for (const op of s.script) out.push({ part: p, seg: s.id, op });
  }
  return out;
};

/**
 * ★★ AQUÍ ES DONDE `exitOverworld` DEJA DE SER VACUO, y merece decirse.
 *
 * Sobre los corpus reales el aserto «toda capa de `exitOverworld` es del vocabulario cerrado»
 * recorre CERO ops: la op nació sin consumidores y así sigue (el censo declarado de abajo lo
 * fija en 0). Un `for` sobre un conjunto vacío pasa siempre — es un verde sin dientes.
 * El corpus sintético trae las DOS capas (`sint04-g03` underworld, `sint03-g03`/`sint04-g04`
 * britannia) y `enterLoc` en los DOS bordes de su rango (32 en `sint04-g03`, 1 en `sint04-g04`,
 * 12 en `sint03-g02`), así que estos dos asertos recorren población de verdad — y por eso van
 * con guarda de población explícita: sin ella no se distinguiría «pasó» de «no había nada».
 * [[control-verde-sin-dientes]]
 */
describe("censo del vocabulario nuevo sobre el corpus SINTÉTICO (público)", () => {
  it("★★ ningún `enterLoc` apunta a una MAZMORRA ni sale del rango de small map (bordes 1 y 32 incluidos)", () => {
    const ops = opsDe("routes-sint", PARTES_SINT).filter((x) => x.op.enterLoc != null);
    expect(ops.length, "guarda de población: contaba ops `enterLoc` del corpus sintético").toBeGreaterThan(0);
    for (const { seg, op } of ops) {
      expect(op.enterLoc, `${seg}: enterLoc fuera de 1..32`).toBeGreaterThanOrEqual(1);
      expect(op.enterLoc, `${seg}: enterLoc en rango de mazmorra`).toBeLessThanOrEqual(32);
    }
    // Y los BORDES están instanciados: si el corpus perdiera el 1 o el 32, el rango de arriba
    // dejaría de estar ejercitado en sus extremos sin que ningún aserto se enterase.
    const valores = new Set(ops.map((x) => x.op.enterLoc));
    expect([...valores].sort((a, z) => a! - z!)).toContain(1);
    expect([...valores].sort((a, z) => a! - z!)).toContain(32);
  });

  it("★★ toda capa de `exitOverworld` es del vocabulario cerrado — y las DOS están pobladas", () => {
    const ops = opsDe("routes-sint", PARTES_SINT).filter((x) => x.op.exitOverworld != null);
    expect(ops.length, "guarda de población: contaba ops `exitOverworld` del corpus sintético").toBeGreaterThan(0);
    for (const { seg, op } of ops) {
      expect(["britannia", "underworld"], `${seg}`).toContain(op.exitOverworld);
    }
    const capas = new Set(ops.map((x) => x.op.exitOverworld));
    expect(capas, "el bug E-2 vivía en la capa que NO es el default: las dos tienen que estar").toEqual(
      new Set(["britannia", "underworld"]),
    );
  });
});

// ⚠ CORPUS REAL. El CENSO DECLARADO (`enterLoc: 1 · exitOverworld: 0`) es un hecho del corpus
// real y un pin a propósito; sobre el sintético no querría decir nada. Los dos asertos de rango
// se quedan aquí ADEMÁS de tener gemelo sintético: allí miden la REGLA, aquí que el corpus real
// la cumple. `todas()` sólo se invoca DENTRO de cada `it`.
describeCorpusReal("censo del vocabulario nuevo sobre los DOS corpus", () => {
  const todas = (): Array<{ part: string; seg: string; op: Op }> => [
    ...opsDe("routes-ad", Array.from({ length: 25 }, (_, i) => `ad${String(i + 1).padStart(2, "0")}`)),
    ...opsDe("routes", Array.from({ length: 24 }, (_, i) => `part${String(i + 1).padStart(2, "0")}`)),
  ];

  it("ningún `enterLoc` del corpus apunta a una MAZMORRA ni sale del rango de small map", () => {
    for (const { seg, op } of todas()) {
      if (op.enterLoc == null) continue;
      expect(op.enterLoc, `${seg}: enterLoc fuera de 1..32`).toBeGreaterThanOrEqual(1);
      expect(op.enterLoc, `${seg}: enterLoc en rango de mazmorra`).toBeLessThanOrEqual(32);
    }
  });

  it("toda capa de `exitOverworld` es del vocabulario cerrado", () => {
    for (const { seg, op } of todas()) {
      if (op.exitOverworld == null) continue;
      expect(["britannia", "underworld"], `${seg}`).toContain(op.exitOverworld);
    }
  });

  it("★ CENSO DECLARADO — enterLoc: 1 · exitOverworld: 0 (si mueves esto, muévelo con motivo)", () => {
    // `exitOverworld` nace SIN consumidores y eso está pre-registrado (§1): el censo propio de los
    // dos corpus encontró 16 entradas a mitad de segmento contra 5 salidas, y ninguna de las 5
    // tiene cierre de ledger. Los 177 `leave` restantes caen en la COLA del segmento, donde la
    // costura del segmento SIGUIENTE ya los resuelve. Este pin obliga a que quien la cablee lo
    // DECLARE, en vez de que la cifra se mueva sola. [[cifra-censo-sin-sha-es-foto]]
    const ops = todas();
    expect(ops.filter((x) => x.op.enterLoc != null).map((x) => x.seg)).toEqual(["ad09-g04"]);
    expect(ops.filter((x) => x.op.exitOverworld != null)).toHaveLength(0);
  });
});
