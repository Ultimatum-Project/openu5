/**
 * ★★ EL (T)ALK DE VERIFICACIÓN DEL ANCLA DEJA LA TIENDA ABIERTA, Y EL DIÁLOGO SE COME EL RESTO
 * DEL GUION DEL SEGMENTO.
 *
 * `resyncToNpcAnchor` (`e2e/espejo-tour/runner.ts`) planta la party adyacente al mercader y le
 * habla para que el saludo se EMITA; luego verifica el enganche con `shopOpen()` y **se va sin
 * cerrar**. A partir de ahí, cada tecla del guion entra por el prompt de la tienda en vez de por
 * el del mapa.
 *
 * MEDIDO EN CORRIDA (acta `anclas-lp1-acta.md` §5.4-bis, corpus LP1): en `part09-g10` el ancla
 * nº12 cae en el **op[1]** — el primero del segmento — y los ~88 ops restantes caen DENTRO del
 * menú de compra de Gwenneth. El port no emite un solo `Open-`/`Look-` en todo el segmento
 * (**154 → 0** ocurrencias de material de mapa) y el segmento pierde **12 bloques casados**,
 * pese a que el saludo en sí GANA su bloque. Es [[punto-de-muerte-aguas-abajo-del-defecto]]
 * visto desde el otro lado: el ancla es legítima como adjudicación y dañina como colocada.
 *
 * Este fichero conduce la función REAL contra un `Page` de mentira cuyo mundo modela las tres
 * reglas que importan, todas leídas de `src/ui/shop-console.ts` y `src/main.ts`:
 *   · con la tienda abierta, el prompt es SUYO: las teclas NO llegan al mapa (`main.ts:2306`);
 *   · la salida depende de la FASE — el gate global sale con Space/ESC, pero el getkey de las
 *     fases Y/N los **RE-LEE** y sólo acepta 'n' (`shop-console.ts:1288-1373`);
 *   · la 'n' SOBRE EL MAPA no es inocua: es (N)ew Order (`main.ts:4297`) y abre un picker de
 *     miembro que se traga las teclas siguientes.
 *
 * LOS DOS BRAZOS SON EL EXPERIMENTO: sin cierre, los ops de mapa del guion desaparecen del
 * transcript; con cierre, aterrizan. Sin el brazo «sin cierre» el verde no probaría que lo que
 * arregla es el CIERRE y no que el mundo de mentira sepa emitir `Open-`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { closeShopDialog, resyncToNpcAnchor } from "../e2e/espejo-tour/runner";

/** Minoc (loc 5) — mismo escenario que `espejo-ancla-npc.test.ts`: Healer 0x87 en su puesto de
 *  horario (6,26) y, para el brazo del herrero, un Blacksmith 0x81 en (10,26). */
const PUESTO_HEALER = { x: 6, y: 26 };
const PUESTO_HERRERO = { x: 10, y: 26 };

type Tipo = "Healer" | "Blacksmith";

interface Mundo {
  pos: { location: number; floor: number; x: number; y: number };
  /** tienda viva: tipo + fase, o null si el diálogo está cerrado */
  shop: { tipo: Tipo; phase: string } | null;
  /** cuántas veces se ABRIÓ una tienda (para que «cerrada al final» no se confunda con «nunca abrió») */
  abiertas: number;
  /** modo vivo del MAPA que una tecla suelta haya podido dejar (picker de New Order) */
  modoVivo: string | null;
  /** fases cuyo getkey RE-LEE todo lo que no sea Y/N (la familia de `greet-yn`). El control de
   *  presupuesto mete aquí un nombre que la tabla del runner NO conoce, que es el riesgo real:
   *  una fase nueva de la consola sin entrada en `SHOP_EXIT_KEY`. */
  fasesYN: Set<string>;
  /** lo que el port EMITE al mapa: `Open-East`, `Look-West`… (el material de §5.4-bis) */
  transcript: string[];
  /** teclas que llegaron al mundo, en orden */
  teclas: string[];
}

/**
 * Mundo de mentira. La máquina de fases es la del binario, recortada a lo que este defecto
 * necesita:
 *   Blacksmith: start → `blacksmith-pause` (getkey 0x83dc: DESCARTA la tecla) → `menu`
 *               (Buy/Sell; gate global Space/ESC → cierra)
 *   Healer:     start → `greet-yn` (getkey 0x1510: sólo Y/N; Space y ESC se RE-LEEN)
 *               'n' → cierra · 'y' → `healer-need` (acepta C/H/R/Space/CR)
 */
function pageFalsa(
  tipo: Tipo,
  opciones: {
    /** consola RANCIA ya viva ANTES del ancla — el escenario medido en `ad06-g34`: la del
     *  CURANDERO sigue abierta 43 teclas después y se traga el bloque de venta del herrero. */
    rancia?: { tipo: Tipo; phase: string };
    /** fases extra cuyo getkey RE-LEE lo que no sea Y/N. Con una que `SHOP_EXIT_KEY` no conoce,
     *  el cierre AGOTA su presupuesto sin cerrar — y ahí es donde se ve si la comparación de
     *  TIPO tiene dientes por sí sola o vivía dominada por el cierre. */
    fasesYN?: string[];
  } = {},
): { page: Page; mundo: Mundo } {
  const puesto = tipo === "Healer" ? PUESTO_HEALER : PUESTO_HERRERO;
  const dialogNumber = tipo === "Healer" ? 0x87 : 0x81;
  const mundo: Mundo = {
    pos: { location: 5, floor: 0, x: 15, y: 30 },
    shop: opciones.rancia ? { ...opciones.rancia } : null,
    abiertas: 0,
    modoVivo: null,
    fasesYN: new Set(["greet-yn", ...(opciones.fasesYN ?? [])]),
    transcript: [],
    teclas: [],
  };
  let esperandoDir: string | null = null;
  const DIR: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] };
  const NOMBRE: Record<string, string> = { ArrowUp: "North", ArrowDown: "South", ArrowRight: "East", ArrowLeft: "West" };

  /** Despacho de tecla de la CONSOLA DE TIENDA (shop-console.ts:1250-1411). */
  const teclaTienda = (k: string): void => {
    const s = mundo.shop!;
    if (s.phase === "blacksmith-pause") {
      s.phase = "menu"; // la tecla se DESCARTA; sale la pregunta Buy/Sell
      return;
    }
    if (mundo.fasesYN.has(s.phase)) {
      if (k === "n") mundo.shop = null; // `No` + despedida 0x202
      else if (k === "y") s.phase = "healer-need";
      return; // Space/ESC/cualquier otra: el getkey RE-LEE — la fase NO cambia
    }
    if (s.phase === "healer-need") {
      if (k === " " || k === "Space" || k === "Enter") mundo.shop = null;
      return;
    }
    if (k === " " || k === "Space" || k === "Escape") mundo.shop = null; // gate global → leave()
  };

  /** Despacho de tecla del MAPA (main.ts). */
  const teclaMapa = (k: string): void => {
    if (mundo.modoVivo) return; // el picker vivo se come la tecla (y no la devuelve)
    if (k === "n") {
      mundo.modoVivo = "new-order"; // (N)ew Order — main.ts:4297
      return;
    }
    if (k === "t" || k === "o" || k === "l") {
      esperandoDir = k;
      return;
    }
    const d = DIR[k];
    if (!esperandoDir || !d) return;
    const cmd = esperandoDir;
    esperandoDir = null;
    const cx = mundo.pos.x + d[0]!;
    const cy = mundo.pos.y + d[1]!;
    if (cmd === "t") {
      if (puestoVivo.x === cx && puestoVivo.y === cy) {
        mundo.shop = { tipo, phase: tipo === "Blacksmith" ? "blacksmith-pause" : "greet-yn" };
        mundo.abiertas++;
      }
      return;
    }
    mundo.transcript.push(`${cmd === "o" ? "Open" : "Look"}-${NOMBRE[k]}`);
  };

  const puestoVivo = { ...puesto };
  const pulsa = (k: string): void => {
    mundo.teclas.push(k);
    if (mundo.shop) teclaTienda(k);
    else teclaMapa(k);
  };

  const ventana = {
    __u5test: {
      state: () => ({ position: mundo.pos }),
      shopOpen: () => mundo.shop != null,
      shopConsole: () => (mundo.shop ? { type: mundo.shop.tipo, phase: mundo.shop.phase, options: [] } : null),
      game: {
        state: { position: mundo.pos, worldObjects: [] },
        npcManager: {
          npcsAt: (l: number, f: number) =>
            l === 5 && f === 0 ? [{ x: puestoVivo.x, y: puestoVivo.y, type: 84, aiTypes: [0, 1, 1], dialogNumber }] : [],
        },
        activeMap: { width: 32, height: 32, tileAt: () => 4 },
        world: { smallMaps: { get: () => undefined } },
      },
    },
    __u5debug: {
      teleportSmallMap: (l: number, f: number, x: number, y: number) => {
        mundo.pos = { location: l, floor: f, x, y };
        // enterMap: cada NPC a su celda de horario (aquí ya está en ella)
        puestoVivo.x = puesto.x;
        puestoVivo.y = puesto.y;
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

/** Los ops de MAPA que en `part09-g10` venían DESPUÉS del ancla (Open-East / Look-West). */
async function opsDeMapaDelGuion(page: Page): Promise<void> {
  for (const k of ["o", "ArrowRight", "l", "ArrowLeft"]) await page.keyboard.press(k);
}

const ANCLA_SALUDO = { kind: "npc", cmd: "talk", match: "shop:Healer" } as const;
const ANCLA_HERRERO = { kind: "npc", cmd: "talk", match: "shop:Blacksmith" } as const;

describe("cierre del diálogo de tienda tras el Talk del ancla — el segmento que se traga la tienda", () => {
  it("★★ CON cierre: el saludo se emite Y los ops de mapa del guion aterrizan en el transcript", async () => {
    const { page, mundo } = pageFalsa("Healer");
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { ...ANCLA_SALUDO }, log);
    await opsDeMapaDelGuion(page);

    expect(out.status).toBe("resolved-jump");
    expect(mundo.abiertas, "el ancla TIENE que haber abierto la tienda (si no, el test no mide nada)").toBe(1);
    expect(mundo.shop, `el diálogo tiene que quedar CERRADO · log: ${log.join(" // ")}`).toBeNull();
    expect(mundo.transcript, "el material de mapa del guion es lo que §5.4-bis vio desaparecer").toEqual(["Open-East", "Look-West"]);
    expect(log.join(" ")).toContain("SHOP-CLOSE");
  });

  it("★★ BRAZO SIN CIERRE (lo de antes): la MISMA secuencia sin cerrar deja el transcript VACÍO", async () => {
    const { page, mundo } = pageFalsa("Healer");

    // exactamente lo que hacía el resync: purga Escape ×2, (T)alk + flecha, y a otra cosa.
    for (const k of ["Escape", "Escape"]) await page.keyboard.press(k);
    mundo.pos = { location: 5, floor: 0, x: PUESTO_HEALER.x, y: PUESTO_HEALER.y - 1 };
    for (const k of ["t", "ArrowDown"]) await page.keyboard.press(k);
    await opsDeMapaDelGuion(page);

    expect(mundo.abiertas, "el Talk abrió la tienda igual que en el brazo de arriba").toBe(1);
    expect(mundo.shop, "sin cierre el diálogo sigue vivo").not.toBeNull();
    expect(mundo.transcript, "los 154→0 de part09-g10: el diálogo se come el material de mapa").toEqual([]);
  });

  it("★★ HERRERO — la pausa de pacing exige DOS teclas: `blacksmith-pause` → `menu` → cierra", async () => {
    const { page, mundo } = pageFalsa("Blacksmith");
    const log: string[] = [];

    await resyncToNpcAnchor(page, { ...ANCLA_HERRERO }, log);
    const anotado = log.join(" ");

    expect(mundo.abiertas).toBe(1);
    expect(mundo.shop, `Gwenneth es un Blacksmith: es el caso de part09-g10 · log: ${anotado}`).toBeNull();
    expect(anotado).toContain("SHOP-CLOSE 'shop:Blacksmith' diálogo cerrado con [Escape,Escape]");
  });

  it("★★ FASE Y/N — el Escape NO cierra el saludo del curandero: la tabla por fase tiene que sacar la 'n'", async () => {
    const { page, mundo } = pageFalsa("Healer");
    mundo.pos = { location: 5, floor: 0, x: PUESTO_HEALER.x, y: PUESTO_HEALER.y - 1 };
    for (const k of ["t", "ArrowDown"]) await page.keyboard.press(k);
    expect(mundo.shop?.phase).toBe("greet-yn");

    // CONTROL de la premisa: el gate global no vale aquí (el getkey 0x1510 re-lee Space/ESC).
    for (const k of ["Escape", " ", "Escape"]) await page.keyboard.press(k);
    expect(mundo.shop, "si el Escape cerrase, la tabla por fase sería adorno y este test no mediría nada").not.toBeNull();

    const log: string[] = [];
    const pulsadas = await closeShopDialog(page, "shop:Healer", log);
    expect(pulsadas).toEqual(["n"]);
    expect(mundo.shop).toBeNull();
  });

  it("★★ INOCUO cuando el Talk NO enganchó: con el diálogo cerrado se pulsan CERO teclas", async () => {
    const { page, mundo } = pageFalsa("Healer");
    const log: string[] = [];

    const pulsadas = await closeShopDialog(page, "shop:Healer", log);
    await opsDeMapaDelGuion(page);

    expect(pulsadas, "sin tienda abierta el cierre no toca el teclado").toEqual([]);
    expect(mundo.teclas.filter((k) => k === "n"), "una 'n' a ciegas abriría (N)ew Order sobre el mapa").toEqual([]);
    expect(mundo.modoVivo, "y ese picker se tragaría los ops siguientes — el defecto que este fix arregla, al revés").toBeNull();
    expect(mundo.transcript, "los ops del guion siguen aterrizando").toEqual(["Open-East", "Look-West"]);
    expect(log, "y no se escribe ruido en el log de resyncs").toEqual([]);
  });

  it("CONTROL DE PRESUPUESTO — una tienda que no cierra NO cuelga la parte: se declara y se sigue", async () => {
    const { page, mundo } = pageFalsa("Healer");
    mundo.pos = { location: 5, floor: 0, x: PUESTO_HEALER.x, y: PUESTO_HEALER.y - 1 };
    for (const k of ["t", "ArrowDown"]) await page.keyboard.press(k);
    // fase desconocida para la tabla ⇒ Escape por defecto, que en Y/N se RE-LEE: no cierra nunca.
    mundo.shop!.phase = "fase-que-no-existe";
    mundo.fasesYN.add("fase-que-no-existe"); // su getkey re-lee el Escape, como toda la familia Y/N
    const log: string[] = [];

    const pulsadas = await closeShopDialog(page, "shop:Healer", log, 3);

    expect(pulsadas).toEqual(["Escape", "Escape", "Escape"]);
    expect(log.join(" ")).toContain("NO cerró el diálogo");
    expect(mundo.shop, "la tienda sigue abierta y el log lo DICE en vez de tragárselo").not.toBeNull();
  });

  /**
   * GUARDA DEL LEDGER. Las 3 anclas `buy`/`sell` de los dos corpus llevan `expectDelta` y las
   * teclas de compra del guion NECESITAN el diálogo abierto: cerrarlo pondría a 0 los deltas
   * verdes (+36 `part04-g03`, −954 `part05-g05`). El cierre se condiciona AL ANCLA.
   */
  it("★★ ANCLA DE TRANSACCIÓN (`expectDelta`): el diálogo se queda ABIERTO — el ledger vive de él", async () => {
    const { page, mundo } = pageFalsa("Blacksmith");
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { kind: "npc", cmd: "buy", match: "shop:Blacksmith", expectDelta: -954 }, log);

    expect(out.status).toBe("resolved-jump");
    expect(mundo.abiertas).toBe(1);
    expect(mundo.shop, "las teclas de compra del guion caen aquí dentro a propósito").not.toBeNull();
    expect(log.join(" "), "y no se anota cierre ninguno").not.toContain("SHOP-CLOSE");
  });

  /**
   * ★★ LA CONSOLA RANCIA DE **OTRA** TIENDA — el defecto de la ficha #12, reproducido.
   *
   * MEDIDO en `ad06-g34` (acta `ad06-teclas-acta.md` §3): la consola del CURANDERO, abierta por
   * la tecla `t` del op del ancla de saludo ANTERIOR, sigue viva 43 teclas después. El ancla de
   * VENTA del herrero llega, sus teclas caen dentro de la consola del curandero (que las RE-LEE),
   * el herrero no abre nunca — y la verificación cantaba `[shopOpen✓]` porque `shopOpen()`
   * contesta «¿hay ALGUNA tienda abierta?», no «¿la que pedí?». Delta medido: `+220` → `0`.
   *
   * Con el arreglo, la rancia se cierra ANTES del Talk y el herrero engancha de verdad.
   */
  it("★★ RANCIA DE OTRA TIENDA: se cierra antes del Talk y el ancla engancha LA QUE PIDIÓ", async () => {
    const { page, mundo } = pageFalsa("Blacksmith", { rancia: { tipo: "Healer", phase: "greet-yn" } });
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { kind: "npc", cmd: "sell", match: "shop:Blacksmith", expectDelta: 220 }, log);

    expect(out.status, `log: ${log.join(" // ")}`).toBe("resolved-jump");
    expect(mundo.abiertas, "el herrero TIENE que haber abierto — con la rancia viva se abría CERO veces").toBe(1);
    expect(mundo.shop?.tipo, "y la tienda viva al salir es la del ancla, no la rancia").toBe("Blacksmith");
    expect(log.join(" "), "el cierre de la rancia se DECLARA (si no, nadie sabría que pasó)").toContain("SHOP-RANCIA");
  });

  /**
   * ★★ LA COMPARACIÓN DE TIPO, **SOLA** — con el cierre DERROTADO a propósito.
   *
   * 🔴 Sin este caso, el `engaged` por tipo sería [[cinturon-dentro-de-la-rama-es-codigo-muerto]]:
   * si el cierre de la rancia SIEMPRE funciona, el tipo nunca discrepa y un mutante que devuelva
   * el predicado viejo (`engaged = vivo.abierta`) sobrevive con todo en verde. Aquí la rancia está
   * en una fase que `SHOP_EXIT_KEY` **no conoce** y que además RE-LEE el Escape del default: el
   * cierre agota su presupuesto de 4 teclas y la deja viva. Entonces, y sólo entonces, se ve si la
   * verificación distingue la tienda pedida de la que hay.
   *
   * El resultado que se exige NO es que el ancla funcione — es que **FALLE RUIDOSAMENTE**
   * (`miss`) en vez de dar un verde falso. Un `miss` lo cuenta el arnés; un verde falso se
   * publicó como divergencia de fidelidad del port durante toda la ficha #12.
   */
  it("★★ RANCIA QUE NO SE DEJA CERRAR: el ancla sale MISS ruidosa, no en verde falso", async () => {
    const { page, mundo } = pageFalsa("Blacksmith", {
      rancia: { tipo: "Healer", phase: "misterio-yn" },
      fasesYN: ["misterio-yn"],
    });
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { kind: "npc", cmd: "sell", match: "shop:Blacksmith", expectDelta: 220 }, log);

    expect(mundo.shop?.tipo, "el control: la rancia sigue viva (si se cerrase, este test no mediría el tipo)").toBe("Healer");
    expect(mundo.abiertas, "y el herrero no llegó a abrir — sus teclas se las comió la rancia").toBe(0);
    expect(out.status, `TIENE que ser miss, no verde falso · log: ${log.join(" // ")}`).toBe("miss");
    expect(log.join(" "), "y el log NO puede cantar el enganche").not.toContain("[shopOpen✓]");
  });

  /**
   * ★ LA EXENCIÓN, APLICADA DE VERDAD. `anchorIsShop` es true también por `cmd:"buy"|"sell"` con
   * un match que NO es `shop:<tipo>` (p. ej. `d129`, dialogNumber exacto). Ahí **no hay tipo
   * pedido que comparar**, y exigirlo convertiría en `miss` anclas que hoy enganchan bien. El
   * predicado tiene que caer al `shopOpen()` de siempre — y eso se comprueba, no se declara.
   */
  it("★ SIN TIPO PEDIDO (match `d129`, no `shop:`): el predicado cae a shopOpen y el ancla engancha", async () => {
    const { page, mundo } = pageFalsa("Blacksmith");
    const log: string[] = [];

    const out = await resyncToNpcAnchor(page, { kind: "npc", cmd: "buy", match: "d129", expectDelta: -10 }, log);

    expect(out.status, `log: ${log.join(" // ")}`).toBe("resolved-jump");
    expect(mundo.abiertas, "engancha igual que antes: sin tipo pedido no se puede exigir tipo").toBe(1);
    expect(mundo.shop?.tipo).toBe("Blacksmith");
  });

  /**
   * PRUEBA DE EJECUCIÓN: los tests de arriba conducen la función. Una función de cierre correcta
   * que nadie llamase sería un cinturón dentro de una rama muerta y todos seguirían verdes. Esto
   * ata el call-site Y SUS DOS GUARDAS (enganche verificado + ancla sin `expectDelta`).
   */
  it("EJECUCIÓN — `resyncToNpcAnchor` llama al cierre, DESPUÉS del Talk y bajo sus dos guardas", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour", "runner.ts"), "utf8");
    const cuerpo = src.slice(src.indexOf("export async function resyncToNpcAnchor"));
    // Aguja movida DOS veces, y la segunda por un cambio de significado, no de forma: el arreglo
    // de la ficha #12 hace que `engaged` compare el TIPO de tienda (`shop:Blacksmith`) y no sólo
    // que haya alguna abierta. Se fija la forma NUEVA — y aparte se asserta la comparación en sí,
    // porque una aguja que sólo casa texto no distinguiría el predicado viejo del nuevo.
    const iTalk = cuerpo.indexOf("engaged = vivo.abierta &&");
    expect(iTalk, "el predicado de enganche ya no compara el TIPO — es el defecto de la ficha #12").toBeGreaterThan(-1);
    const predicado = cuerpo.slice(iTalk, iTalk + 120);
    expect(predicado, "sin el `pedido === ''` la exención de los match sin tipo (`d129`) no existe").toContain('pedido === ""');
    expect(predicado, "y sin `casa` no se compara nada").toContain("casa");
    const iCierre = cuerpo.indexOf("await closeShopDialog(page, anchor.match, log)");
    expect(iCierre, "`resyncToNpcAnchor` no llama a closeShopDialog").toBeGreaterThan(-1);
    expect(iTalk, "no encuentro la verificación del enganche").toBeGreaterThan(-1);
    expect(iCierre, "el cierre va DESPUÉS de verificar que la tienda enganchó").toBeGreaterThan(iTalk);
    // Las DOS guardas que tienen dientes. (La tercera, `engaged`, es explícita pero está
    // DOMINADA por el `return miss` de arriba: con `isShop` no se puede llegar aquí sin
    // enganche. No se asserta lo que no puede fallar.)
    const guarda = cuerpo.slice(cuerpo.lastIndexOf("if (", iCierre), iCierre);
    expect(guarda, "sin la guarda de `expectDelta` el cierre mataría los deltas del ledger").toContain("expectDelta == null");
    expect(guarda, "sin la guarda de `cmd` una compra futura sin expectDelta se cerraría en falso").toContain("talk");
  });
});
