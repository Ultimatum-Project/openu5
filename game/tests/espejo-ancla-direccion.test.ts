/**
 * ★★ EL RESYNC DE ANCLA-NPC TIRA UN DATO QUE EL CORPUS SÍ TIENE: **la dirección del (T)alk**.
 *
 * `resolveNpcAnchor` (`e2e/espejo-tour/anchors.ts`) elige la celda donde plantar la party por
 * **distancia Manhattan mínima a la posición actual** — o sea, por dónde venía el replay:
 *
 *     for (const dir of ["north","south","east","west"]) { … const d = manhattan(from, c);
 *                                                           if (d < bestD) { bestD = d; best = c; } }
 *
 * …y `resyncToNpcAnchor` DERIVA después la dirección de esa colocación (`runner.ts`:
 * «Dirección = party→NPC»). Pero el guion del corpus **ya trae la dirección que pulsó el
 * humano**: el op del ancla va seguido de un `{"key":"ArrowXxx"}` con el MISMO `ocrLn`.
 *
 * CASO QUE ABRE LA FICHA (**F-A3**, `ad10-g21`, Minoc):
 *   guion  : {"key":"t", anchor:{match:"shop:Healer"}} + {"key":"ArrowDown"}  (sur)
 *   OCR    : línea 3660 → «>Talk-South» … «"Fair morning, adventurer. I, Regina…"»
 *   arnés  : plantó al OESTE y habló al ESTE
 * La tienda abre igual, pero la party queda en OTRA celda que la del LP, y las ~30 órdenes de
 * movimiento que el LP encadena después (`>Fly South`, `>Open-East`…) parten de otro punto.
 *
 * POBLACIÓN (censo `re/tools/censo_ancla_direccion.mjs`): de las **72** anclas de NPC de los dos
 * corpus, **63 traen dirección en el guion**; de las 60 que ejecutaron (T)alk en la corrida del
 * 02-08, **47 se ejecutaron en una dirección DISTINTA de la del guion**. No es un caso: es el 78 %.
 *
 * EL CRITERIO DE ESTE TEST es la MISMA expresión que consume el runner (`dx = npc − cell`), no
 * una re-derivación: si alguien cambia la fórmula de la dirección en el runner, este test tiene
 * que moverse con ella o deja de significar lo que dice.
 */
import { describe, expect, it } from "vitest";
import { resolveNpcAnchor, ARROW_TO_DIR, type Dir4 } from "../e2e/espejo-tour/anchors";

/** Minoc (loc 5) a las 9:00: el Healer (slot 2, dlg 0x87) está en su puesto (6,26). */
const NPC = { x: 6, y: 26 };
const HEALER = [{ x: NPC.x, y: NPC.y, floor: 0, dialogNumber: 0x87, name: "Regina", type: "healer" }];

/** Mundo pisable salvo donde se diga: el `standable` de verdad decide por tile. */
const SUELO = 1;
const MURO = 0;
function snapCon(bloqueadas: Array<{ x: number; y: number }> = []) {
  const W = 32, H = 32;
  const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => SUELO));
  for (const c of bloqueadas) grid[c.y]![c.x] = MURO;
  return { W, H, grid };
}
const standable = (t: number) => t !== MURO;

/** LA MISMA fórmula que `resyncToNpcAnchor` usa para mandar la tecla. */
function dirDeLaColocacion(cell: { x: number; y: number }, npc: { x: number; y: number }): Dir4 {
  const dx = npc.x - cell.x;
  const dy = npc.y - cell.y;
  return dx > 0 ? "east" : dx < 0 ? "west" : dy > 0 ? "south" : "north";
}

describe("F-A3 — el ancla de NPC respeta la dirección del guion", () => {
  it("★ el guion dice SUR y la party viene del oeste: se planta al NORTE para hablar al SUR", () => {
    // `from` al oeste ⇒ la celda más cercana es la del OESTE, que es lo que el arnés elegía.
    const from = { x: 1, y: 26 };
    const res = resolveNpcAnchor(HEALER, { kind: "npc", cmd: "talk", match: "shop:Healer" } as never, from, {
      snap: snapCon(),
      standable,
      preferDir: "south",
    } as never);
    expect(res.status).toBe("resolved");
    // la party tiene que quedar al NORTE del NPC para que el (T)alk vaya al SUR
    expect(res.cell).toEqual({ x: NPC.x, y: NPC.y - 1 });
    expect(dirDeLaColocacion(res.cell!, NPC)).toBe("south");
  });

  it("★ CONTROL NEGATIVO — sin `preferDir` se conserva la conducta histórica (la más cercana)", () => {
    const from = { x: 1, y: 26 };
    const res = resolveNpcAnchor(HEALER, { kind: "npc", cmd: "talk", match: "shop:Healer" } as never, from, {
      snap: snapCon(),
      standable,
    } as never);
    expect(res.status).toBe("resolved");
    // La celda más cercana sigue siendo la del lado OESTE del NPC…
    expect(res.cell).toEqual({ x: NPC.x - 1, y: NPC.y });
    // …y desde ahí el (T)alk va al ESTE. ★ El lado en el que ESTÁ la party y la dirección a la
    // que MIRA son opuestos: confundirlos es lo que hace que este test valga escribirlo.
    expect(dirDeLaColocacion(res.cell!, NPC)).toBe("east");
  });

  it("★ FALLBACK — si la celda que pide el guion NO es pisable, se cae a la más cercana", () => {
    const from = { x: 1, y: 26 };
    const res = resolveNpcAnchor(HEALER, { kind: "npc", cmd: "talk", match: "shop:Healer" } as never, from, {
      snap: snapCon([{ x: NPC.x, y: NPC.y - 1 }]), // el norte, tapiado
      standable,
      preferDir: "south",
    } as never);
    expect(res.status).toBe("resolved");
    expect(res.cell).toEqual({ x: NPC.x - 1, y: NPC.y });
    expect(res.dirPedidaNoPisable).toBe(true); // y lo DECLARA, no se lo calla
  });

  it("★ las cuatro direcciones, para que no valga acertar una por casualidad", () => {
    const from = { x: 1, y: 26 };
    const esperado: Record<Dir4, { x: number; y: number }> = {
      south: { x: NPC.x, y: NPC.y - 1 },
      north: { x: NPC.x, y: NPC.y + 1 },
      east: { x: NPC.x - 1, y: NPC.y },
      west: { x: NPC.x + 1, y: NPC.y },
    };
    for (const dir of ["north", "south", "east", "west"] as Dir4[]) {
      const res = resolveNpcAnchor(HEALER, { kind: "npc", cmd: "talk", match: "shop:Healer" } as never, from, {
        snap: snapCon(), standable, preferDir: dir,
      } as never);
      expect(res.cell, `dir ${dir}`).toEqual(esperado[dir]);
      expect(dirDeLaColocacion(res.cell!, NPC), `dir ${dir}`).toBe(dir);
    }
  });

  it("★ el mapeo tecla→dirección del CENSO es el mismo que el del arnés (no pueden divergir)", () => {
    // `re/tools/censo_ancla_direccion.mjs` lleva su propia tabla porque es un .mjs suelto.
    const delCenso: Record<string, string> = { ArrowUp: "north", ArrowDown: "south", ArrowLeft: "west", ArrowRight: "east" };
    for (const [tecla, dir] of Object.entries(delCenso)) expect(ARROW_TO_DIR[tecla]).toBe(dir);
    expect(Object.keys(delCenso).length).toBe(Object.keys(ARROW_TO_DIR).length);
  });
});
