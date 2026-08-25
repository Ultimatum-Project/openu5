/**
 *
 * ── `0xec`: LA PREMISA VIEJA QUEDA RETIRADA (corrección propagada por el carril
 * cabos-353, 2026-08-16; texto canónico en ch24-salas-covetous, pieza 14 del lote #54) ──
 * Lo que este encabezado decía — «el fix saca la familia `0xEC` del roster y NO está
 * derivado QUÉ coloca el original en su lugar; los 4 bytes que lee son pila sin
 * inicializar y sólo la sonda-oráculo puede decirlo» — **está REFUTADO por derivación**:
 * esos 4 bytes SÍ se inicializan. `DNGLOOK.OVL 0x1273-0x128c` tira `rand(0,7)` CUATRO
 * veces contra la tabla de 8 índices de DS `0x385e` (= `DATA.OVL` fileoff `0x386e`:
 * `14 15 16 22 21 18 1f 18`) y el consumo `0x12ee-0x12f7` lee `pool[tile & 3]` ⇒ los
 * tiles 236-239 sacan enemigos DISTINTOS («Random enemy groups»). El port lo cablea
 * (`rollEcGroupPool`): estas salas ya NO «pierden remolinos» ni quedan vacías —
 * reciben ENEMIGOS REALES que hay que PELEAR. Derivación: re/notes/dnglook-117e-body.md.
 *
 * LO QUE SIGUE SIN DERIVAR (por lo que el spec SIGUE SIENDO DETECTOR): qué especie toca
 * en una corrida dada — depende de por dónde va el stream RNG al entrar, y la siembra de
 * objetos de #353 (main ef914dd9) MOVIÓ ese stream en 35 registros. Baselines calibrados
 * antes de ese aterrizaje están caducados por declaración (nota #353 §6): se re-calibran
 * MIDIENDO, jamás citando al port.
 * Salas de Wrong de este capítulo con familia 0xEC en el roster: hoy roster del pool.
 * ──────────────────────────────────────────────────────────────────────────────────
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b — ch32: Wrong floors 2-7 (r7-r14) por la pasada de FONDO. Wrong es CIMA-ACOTADA (la cima
 * sólo alcanza floors 0-1); estas 8 salas viven floors 2-7, así que su ÚNICA vía candidata es el
 * fondo (Underworld) — HIPÓTESIS de veredicto ABIERTO DE VERDAD, incluida la posibilidad de que el
 * fondo TAMPOCO llegue (→ sello SIN-ENTRADA-fiel, resultado VÁLIDO).
 *
 * DERIVACIÓN estática (mirror planDungeonDescent, orientativa — no fiable en Wrong por fosos/Des
 * Por): desde el FONDO (`enterFromUnderworld` → floor7 (7,7) oeste) SÓLO se alcanza floor7, y el
 * bolsillo (7,7) está AISLADO de las salas → predice SIN-ENTRADA para las 8. El pather REAL (esta
 * corrida) es la fuente de verdad; la estática sólo orienta.
 *
 * VEREDICTO ABIERTO (más abierto que los demás carriles): cada sala es (a) RESUELTA
 * (VICTORY|DEADEND|DEADEND-STUCK) si el fondo la alcanza, o (b) SIN-ENTRADA (THROW:sin-plan) =
 * inalcanzable desde cima Y fondo → dead-end-fiel-por-inaccesibilidad (patrón #29, cita). Lo ÚNICO
 * prohibido es FAIL (party derrotada = rojo del arnés/port). Determinismo ×2.
 * ⚠️ ESCRITO SIN CORRER — depende de `enterFromUnderworld` (rama 2f3f5a75); se valida DESPUÉS de que
 * el smoke-FONDO pase (dependencia explícita en el grafo de ramas).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterFromUnderworld, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const WRONG = 36;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Wrong floors 2-7 (approach del mapa fresco; el pather decide alcanzabilidad desde el fondo).
const ROOMS: Array<{ roomNo: number; floor: number; x: number; y: number; approachDir: DFacing }> = [
  { roomNo: 11, floor: 2, x: 1, y: 1, approachDir: "west" },
  { roomNo: 12, floor: 2, x: 5, y: 1, approachDir: "east" },
  { roomNo: 7, floor: 5, x: 0, y: 1, approachDir: "north" },
  { roomNo: 8, floor: 5, x: 2, y: 1, approachDir: "north" },
  { roomNo: 9, floor: 5, x: 4, y: 1, approachDir: "north" },
  { roomNo: 10, floor: 5, x: 6, y: 1, approachDir: "north" },
  { roomNo: 13, floor: 5, x: 3, y: 4, approachDir: "north" },
  { roomNo: 14, floor: 7, x: 3, y: 5, approachDir: "south" },
];

async function seedLoadout(page: Page): Promise<void> {
  await page.evaluate(
    ([bow, ring, arrows]) => {
      const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (!c) continue;
        c.level = 8; c.maxHp = 240; c.currentHp = 240; c.strength = 30; c.dexterity = 30; c.intelligence = 30;
        c.status = "G"; c.weapon = bow; c.ring = ring; c.currentMp = 99;
      }
      st.equipmentQuantities[arrows] = 99;
      st.lightSpellMins = 9999;
      st.spellQuantities[22] = 99; // Des Por
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Entra por el FONDO y prueba, con el continuo, alcanzar cada sala de floors 2-7. */
async function runWrongFondo(page: Page): Promise<{ digest: string; outcomes: Record<number, string> }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterFromUnderworld(page, WRONG); // → floor 7 (7,7) oeste (aserta dentro)

  const outcomes: Record<number, string> = {};
  const resolved = (o?: string) => !!o && !o.startsWith("THROW");
  let progress = true;
  while (progress) {
    progress = false;
    for (const r of ROOMS) {
      if (resolved(outcomes[r.roomNo])) continue;
      try {
        const v = await conquerRoomAt(page, { roomCell: { floor: r.floor, x: r.x, y: r.y }, approachDir: r.approachDir, maxRounds: 600 });
        outcomes[r.roomNo] = v.outcome;
        progress = true;
      } catch (e) {
        // "sin plan" desde el fondo = inalcanzable → SIN-ENTRADA (resultado VÁLIDO, no reintentar como bug).
        outcomes[r.roomNo] = /sin plan/.test((e as Error).message) ? "SIN-ENTRADA" : `THROW:${(e as Error).message.slice(0, 40)}`;
      }
    }
  }
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes };
}

test.describe.serial("FASE 2b — ch32 Wrong floors 2-7 por el FONDO (veredicto ABIERTO, SIN-ENTRADA válido)", () => {
  test("cada sala de floors 2-7: RESUELTA por el fondo o SIN-ENTRADA-fiel (nunca FAIL)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runWrongFondo(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => {
      const k = o.startsWith("THROW") ? "THROW" : o;
      a[k] = (a[k] ?? 0) + 1; return a;
    }, {});
    console.log(`[ch32-wrong-fondo] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch32-wrong-fondo] digest=${digest}`);
    // ABIERTO: resuelta (VICTORY/DEADEND/STUCK) O SIN-ENTRADA (inaccesible-fiel). PROHIBIDO: FAIL/THROW-otro.
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK", "SIN-ENTRADA"];
    for (const r of ROOMS) expect(OK, `sala ${r.roomNo}: resuelta o SIN-ENTRADA (no FAIL)`).toContain(outcomes[r.roomNo]);
  });

  test("determinismo ×2: dos pasadas de fondo frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runWrongFondo(page);
    const b = await runWrongFondo(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
