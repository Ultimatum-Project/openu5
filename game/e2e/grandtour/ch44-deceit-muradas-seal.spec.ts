/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **VEREDICTO-DE-FIDELIDAD.** Sus asertos se apoyan en DERIVACIÓN del binario/canon
 * (cita en esta misma cabecera). Un rojo acusa al PORT **o a la derivación**: se
 * investigan los DOS, con la carga de la prueba en quien NO cite el binario.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b (carril f2b-resto) — ch44: CONFIRMACIÓN RUNTIME del sello de las 3 muradas de
 * Deceit: r0 (#16, f1 5,3), r1 (#17, f1 5,7), r3 (#19, f4 5,7).
 *
 * DERIVACIÓN ESTÁTICA (mirror `re/tools/dungeon_pocket_reach.py --loc 33`, modelo MÁS
 * generoso: rooms_passable=True + encadenado realista de fosos + wrap toroidal + Des Por):
 *   cierre(cima 0,1,1) ∪ cierre(fondo 7,7,7) = 138 celdas; su intersección con el conjunto
 *   who(sala) es VACÍA para las tres:
 *   · r0: who = 4 celdas {f0(5,3)=escalera, f0(5,4)=secreta, f0(5,5)=foso-encadenante, la sala}
 *     — bolsillo geométrico; el único borde exterior es el foso f0(5,5), que ENCADENA
 *     (f1(5,5) también es foso) → no detenible (patrón r9/ch33).
 *   · r1: who = 46 celdas (floors 0-3) — compartimento sur (columna x5 + corredor y7 de
 *     f0/f1/f2 + escalera f2(5,7)b) SIN conexión con el mundo alcanzable.
 *   · r3: who = 66 celdas (floors 0-5) — el MISMO compartimento sur extendido hacia abajo.
 *   Las tres comparten compartimento: sus semillas de escalera (f0(5,3), f0(5,7), f3(5,7))
 *   viven DENTRO de él.
 *
 * INMUNIDAD A LOS DOS ARTEFACTOS DE PATHER CONOCIDOS (orden del lead 2026-07-22):
 *   · fieldsPassable (cetro-vs-campo): Deceit tiene 0 celdas type-8 (dungeons.json) — no
 *     hay campo que disolver en ninguna ruta posible.
 *   · flee-cross (salas atravesables huyendo): la derivación ya usó rooms_passable=True
 *     (toda sala tratada como cruzable) y aun así la intersección es ∅.
 *
 * VEREDICTO ESPERADO: SIN-ENTRADA por cima Y por fondo, para cada semilla/approach
 * intentado. Cualquier outcome de combate REFUTARÍA el sello (hallazgo, el test falla y
 * se investiga — jamás se fabrica). Determinismo ×2.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, enterFromUnderworld, conquerRoomAt } from "./nav";

const PREV_CHAPTER = "ch13";
const DECEIT = 33;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Cada murada con su(s) intento(s) de entrada: la semilla vertical derivada (escalera a la
// misma (x,y) en la planta adyacente) y, donde existe, el approach andando.
const ATTEMPTS: Array<{
  label: string;
  roomCell: { floor: number; x: number; y: number };
  spec: { enterByLadder?: "down" | "up"; approachDir?: "north" | "south" | "east" | "west" };
}> = [
  // r0 (#16, f1 5,3): única semilla = LadderDown f0(5,3); en f1 la sala está murada 4 lados.
  { label: "r0-ladder-down", roomCell: { floor: 1, x: 5, y: 3 }, spec: { enterByLadder: "down" } },
  // r1 (#17, f1 5,7): semillas = LadderDown f0(5,7) y LadderBoth f2(5,7) (klimb-up desde abajo);
  // approach andando = f1(5,6) entrando al sur.
  { label: "r1-ladder-down", roomCell: { floor: 1, x: 5, y: 7 }, spec: { enterByLadder: "down" } },
  { label: "r1-ladder-up", roomCell: { floor: 1, x: 5, y: 7 }, spec: { enterByLadder: "up" } },
  { label: "r1-walk-south", roomCell: { floor: 1, x: 5, y: 7 }, spec: { approachDir: "south" } },
  // r3 (#19, f4 5,7): semilla = LadderUpDn f3(5,7); approach andando = f4(5,6) al sur.
  { label: "r3-ladder-down", roomCell: { floor: 4, x: 5, y: 7 }, spec: { enterByLadder: "down" } },
  { label: "r3-walk-south", roomCell: { floor: 4, x: 5, y: 7 }, spec: { approachDir: "south" } },
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

/** Corre TODOS los intentos desde una entrada; digest label:resultado por intento. */
async function tryAll(page: Page, entry: "cima" | "fondo"): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  if (entry === "cima") await enterDungeon(page, DECEIT);
  else await enterFromUnderworld(page, DECEIT);
  const parts: string[] = [];
  for (const a of ATTEMPTS) {
    let res: string;
    try {
      // El pather lanza «sin plan» ANTES de mover un solo paso cuando el objetivo es
      // inalcanzable desde la posición de entrada → los intentos no se contaminan entre sí.
      const v = await conquerRoomAt(page, { roomCell: a.roomCell, ...a.spec, maxRounds: 600 });
      res = v.outcome; // un combate real aquí REFUTA el sello (assert abajo)
    } catch (e) {
      res = /sin plan/.test((e as Error).message) ? "SIN-ENTRADA" : `THROW:${(e as Error).message.slice(0, 40)}`;
    }
    parts.push(`${a.label}=${res}`);
  }
  return parts.join("|");
}

test.describe.serial("FASE 2b — ch44 sello Deceit r0/r1/r3 (SIN-ENTRADA por cima Y fondo)", () => {
  test("las 3 muradas son SIN-ENTRADA por todas sus semillas, desde cima y fondo", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const cima = await tryAll(page, "cima");
    const fondo = await tryAll(page, "fondo");
    console.log(`[ch44-deceit-muradas] cima: ${cima}`);
    console.log(`[ch44-deceit-muradas] fondo: ${fondo}`);
    for (const [entry, digest] of [["cima", cima], ["fondo", fondo]] as const) {
      for (const part of digest.split("|")) {
        expect(part.endsWith("=SIN-ENTRADA"), `${entry} ${part}: todo intento debe dar SIN-ENTRADA (un combate refutaría el sello)`).toBe(true);
      }
    }
  });

  test("determinismo ×2: el sello se repite byte-idéntico", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = `${await tryAll(page, "cima")}#${await tryAll(page, "fondo")}`;
    const b = `${await tryAll(page, "cima")}#${await tryAll(page, "fondo")}`;
    expect(b, "digest del sello byte-idéntico bajo reseed(0)").toBe(a);
  });
});
