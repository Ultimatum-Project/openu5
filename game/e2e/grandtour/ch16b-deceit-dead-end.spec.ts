/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **VEREDICTO-DE-FIDELIDAD.** Sus asertos se apoyan en DERIVACIÓN del binario/canon
 * (cita en esta misma cabecera). Un rojo acusa al PORT **o a la derivación**: se
 * investigan los DOS, con la carga de la prueba en quien NO cite el binario.
 * ──────────────────────────────────────────────────────────────────────────────────
 * GRAND TOUR — CAPÍTULO 16 (variante ASCENSO) — Deceit-desde-el-fondo: la sala de entrada
 * SE GANA PISANDO LA PLACA.
 *
 * ★ RE-BASELINE 2026-07-26 — RULING: el «DEAD-END FIEL» que este capítulo sellaba era
 * **FABRICADO**. Citas: `re/notes/ch16b-dead-end-fabricado.md` y
 * `re/notes/rebarrido-65-125-y-ch16b-5-5.md`. Lo que se cayó, y por qué:
 *
 *  · **La tabla estaba equivocada.** El sello citaba `0x6a86` (opacidad-de-LUZ del viewport)
 *    como LOS de proyectil. La tabla real es **`0x6a14`** (kernel `0x3F6E`, alcanzada por
 *    `COMSUBS 0x142a`). El `#44` estaba INVERTIDO. Aun así el muro `0x4f` bloquea en ambas,
 *    así que la LOS **nunca fue** lo que decidía: el sello se apoyaba en la pata equivocada.
 *  · **La sala no se gana disparando: se gana QUITANDO EL MURO.** Las 8 placas del combatmap 29
 *    tienen TODAS su `at` en **(5,5) = `0x44 BrickFloor`, PISABLE**, y escriben `0x44` en
 *    (1..3, 4..6) = EXACTAMENTE las celdas de los 9 Headless ((1,4) (2,5) (1,6) (1,5)×6).
 *  · **(5,5) es ALCANZABLE** desde el grupo de spawn `south` — el que resulta de entrar desde el
 *    bolsillo del Underworld moviéndose al NORTE (P0a: grupo = OPPOSITE(facing)). BFS a pie
 *    medido: **70 celdas, (5,5) dentro** (`re/tools/roomprobe.py`).
 *  · **Ni la premisa «melé-estático» era cierta**: Dragons y Headless tienen
 *    **`DoNotMove: FALSE`**. Estaban EMPAREDADOS, no quietos.
 *
 * ⇒ **Cae también el ruling del ASCENSO**: como (5,5) se alcanza desde el bolsillo, la vía
 * «re-entrar por el fondo y subir» deja de estar sellada como imposible.
 *
 * Y una lección de régimen que este capítulo encarna: `resolveArenaCombat` tenía `plates`
 * APAGADO por defecto **citando a este mismo capítulo** («para NO alterar los capítulos que
 * asertan un dead-end sin placa, p. ej. ch16b»). La capacidad del arnés se desactivó para
 * conservar el sello — y el sello estaba mal. Ahora el capítulo la enciende.
 *
 * QUÉ VERIFICA:
 *  1. Los 2 F-0 del (E)nter DESDE EL UNDERWORLD (main cab88af): (a) sin guard de planta,
 *     (E) despacha por tile aunque floor==0xFF; (b) enterDungeon desde el Underworld entra por
 *     el FONDO (floor 7, (7,7), facing OESTE) — no por la cima (excepto Doom). En CADENA (ch15).
 *  2. Que la sala (7,5) = combatmap 29 **se conquista** con `plates: true`.
 *
 * NO SELLA (.gam) ni encadena hacia delante.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, getPos, dungeonPos, resolveArenaCombat, type DPos } from "./nav";
import { Coverage } from "./coverage";

const PREV_CHAPTER = "ch15";
const DECEIT = 33;
const DOOR = { x: 240, y: 73 } as const; // entrada de Deceit en el Underworld (tile 0x18)
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;
const DN = 8;

type DFacing = "north" | "east" | "south" | "west";
const DCW: DFacing[] = ["north", "east", "south", "west"];
const press = (page: Page, k: string): Promise<void> => page.locator("body").press(k);
const inCombat = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat !== null);

const cov = new Coverage("ch16b-deceit-dead-end");

/** Loadout ranged (costura #47) — para probar que NI CON el mejor caso se gana la sala. */
async function seedLoadout(page: Page): Promise<void> {
  await page.evaluate(
    ([bow, ring, arrows]) => {
      const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (!c) continue;
        c.level = 8; c.maxHp = 240; c.currentHp = 240; c.strength = 30; c.dexterity = 30; c.intelligence = 30;
        c.status = "G"; c.weapon = bow; c.ring = ring;
      }
      st.equipmentQuantities[arrows] = 99;
      st.lightSpellMins = 9999;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

function facingToward(x: number, y: number, nx: number, ny: number): DFacing {
  let dx = nx - x, dy = ny - y;
  if (dx > 1) dx -= DN; if (dx < -1) dx += DN;
  if (dy > 1) dy -= DN; if (dy < -1) dy += DN;
  if (dy === -1) return "north"; if (dy === 1) return "south"; if (dx === -1) return "west"; return "east";
}
async function turnTo(page: Page, target: DFacing): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const p = await dungeonPos(page);
    if (!p || p.facing === target) return;
    const right = (DCW.indexOf(target) - DCW.indexOf(p.facing as DFacing) + 4) % 4;
    await press(page, right <= 2 ? "ArrowRight" : "ArrowLeft");
  }
}
async function dungeonStep(page: Page, nx: number, ny: number): Promise<void> {
  const cur = await dungeonPos(page);
  if (!cur) throw new Error("dungeonStep: fuera de mazmorra");
  await turnTo(page, facingToward(cur.x, cur.y, nx, ny));
  await press(page, "ArrowUp");
}

/** Chain: import ch15, camina al umbral (240,73), (E) → Deceit floor7 (fondo). */
async function enterDeceitBottom(page: Page): Promise<DPos> {
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  // ch15 sella en (240,75); sube al umbral (240,73) por flechas REALES (N = SmallMountain más
  // arriba, bloquea — el umbral es el techo caminable).
  for (let i = 0; i < 4; i++) {
    const p = await getPos(page);
    if (p.x === DOOR.x && p.y === DOOR.y) break;
    await press(page, "ArrowUp");
  }
  await press(page, "e"); // (E)nter REAL — sin guard de planta (F-0 #1)
  return (await dungeonPos(page))!;
}

test.describe.serial("GT ch16-ascenso — Deceit-desde-el-fondo: la sala se gana con la placa", () => {
  test("(E) desde el Underworld re-entra Deceit por el FONDO (floor 7, 7,7, OESTE) — los 2 F-0 en cadena", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
    expect(await getPos(page), "arranca en la cuenca del Underworld (ch15)").toMatchObject({ location: 0, floor: 0xff, x: 240, y: 75 });

    const ds = await enterDeceitBottom(page);
    // F-0 #1 (sin guard de planta) + F-0 #2 (Underworld → FONDO): floor 7, (7,7), facing OESTE.
    expect(ds, "(E) desde el Underworld entra a Deceit por el FONDO (floor 7, 7,7, oeste)").toMatchObject({
      dungeon: DECEIT, floor: 7, x: 7, y: 7, facing: "west",
    });
    cov.mark("command-e").mark("dungeon-deceit").mark("map-underworld");
  });

  test("la sala de entrada (combatmap 29) SE GANA pisando la placa de (5,5) — el dead-end anterior era FABRICADO", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page);
    const ds = await enterDeceitBottom(page);
    expect(ds, "en el fondo de Deceit (7,7)").toMatchObject({ dungeon: DECEIT, floor: 7, x: 7, y: 7 });
    await seedLoadout(page); // el mejor caso posible: Magic Bow + Ring of Invisibility

    // La ÚNICA salida del bolsillo (7,7)/(7,6) es pisar la SALA (7,5) → combatmap 29.
    await dungeonStep(page, 7, 6); // norte, celda libre
    await dungeonStep(page, 7, 5); // norte → entra en la sala (combate)
    expect(await inCombat(page), "pisar (7,5) dispara el combate de sala (combatmap 29)").toBe(true);

    const enemiesAtStart = await page.evaluate(() => {
      const c = (window as unknown as { __u5test: { game: { combat: any } } }).__u5test.game.combat;
      const es = c.combatants.filter((u: any) => u.kind === "enemy");
      const byName: Record<string, number> = {};
      for (const e of es) { const n = e.enemyDef?.name ?? "?"; byName[n] = (byName[n] ?? 0) + 1; }
      return { total: es.length, byName };
    });
    expect(enemiesAtStart.byName["Dragon"], "2 Dragons").toBe(2);
    expect(enemiesAtStart.byName["Headless"], "9 Headless (sellados)").toBe(9);

    // ★ RE-BASELINE 2026-07-26 — el «dead-end fiel» era FABRICADO. Cita:
    // `re/notes/ch16b-dead-end-fabricado.md` + `re/notes/rebarrido-65-125-y-ch16b-5-5.md`.
    // La sala se gana QUITANDO EL MURO, no disparando a través de él:
    //  · las 8 placas del combatmap 29 tienen TODAS su `at` en (5,5) = `0x44 BrickFloor`,
    //    **PISABLE** (`TileData.IsWalking_Passable`);
    //  · (5,5) es ALCANZABLE a pie desde el grupo de spawn `south` — el que da entrar desde
    //    el bolsillo del Underworld moviéndose al NORTE (P0a: grupo = OPPOSITE(facing)):
    //    BFS a pie = 70 celdas, y (5,5) está dentro (medido, `re/tools/roomprobe.py`);
    //  · esas 8 placas escriben `0x44` en (1..3, 4..6) = EXACTAMENTE las celdas donde están
    //    los 9 Headless ((1,4) (2,5) (1,6) (1,5)×6) ⇒ abren su bolsillo;
    //  · y los Headless son **`DoNotMove: FALSE`** (AdditionalEnemyFlags[36]): estaban
    //    EMPAREDADOS, no quietos — la premisa «melé-estático» del sello anterior era falsa.
    // `plates: true` estaba APAGADO por defecto citando A ESTE capítulo (ver `resolveArenaCombat`
    // en nav.ts) — la capacidad del arnés se desactivó para conservar un sello equivocado.
    const won = await resolveArenaCombat(page, { maxRounds: 400, plates: true });
    const after = await page.evaluate(() => {
      const g = (window as unknown as { __u5test: { game: { combat: any; state: any } } }).__u5test.game;
      const c = g.combat;
      const alive = c ? c.combatants.filter((u: any) => u.kind === "enemy" && u.status !== "dead" && u.status !== "fled") : [];
      const headlessAlive = alive.filter((u: any) => u.enemyDef?.name === "Headless").length;
      const partyDeaths = g.state.characters.slice(0, g.state.partySize).filter((c2: any) => c2.status === "D").length;
      return { stillInCombat: c !== null, enemiesAlive: alive.length, headlessAlive, partyDeaths };
    });

    // ASERCIÓN DE FIDELIDAD (clase «veredicto», con derivación del binario detrás — no
    // detector calibrado): el bolsillo de los Headless SE ABRE al pisar (5,5), luego NO
    // pueden quedar los 9 sellados. Un rojo aquí acusa al PORT/resolvedor o a la
    // derivación — se investigan los dos, y la carga cae en quien no cite el binario.
    expect(after.headlessAlive, "el bolsillo se abre con la placa (5,5): NO quedan los 9 sellados").toBeLessThan(9);
    expect(won, "la sala de Deceit r13 ES ganable pisando la placa (dead-end anterior FABRICADO)").toBe(true);
    expect(after.partyDeaths, "se gana sin bajas (Magic Bow + Ring of Invisibility)").toBe(0);

    cov.mark("cell-deceit-room").mark("enemy-39-dragons");
    cov.note(
      `Deceit-desde-el-fondo (loc 33): la sala de entrada (7,5) = combatmap 29 SE GANA. ` +
        `RE-BASELINE 2026-07-26 — el «DEAD-END FIEL» anterior era FABRICADO (ruling; citas ` +
        `re/notes/ch16b-dead-end-fabricado.md + re/notes/rebarrido-65-125-y-ch16b-5-5.md). ` +
        `Los 2 F-0 del (E)nter desde el Underworld (main cab88af) siguen en pie: sin guard de planta ` +
        `+ entrada por el FONDO (floor 7, (7,7), oeste); la party cae en un bolsillo (7,7)/(7,6) cuya ` +
        `única salida es la SALA (7,5) (2 Dragon + 9 Headless). LO QUE CAMBIA: la sala NO se gana ` +
        `disparando —se gana QUITANDO EL MURO—. Las 8 placas del combatmap 29 tienen TODAS su 'at' en ` +
        `(5,5) = 0x44 BrickFloor PISABLE, y escriben 0x44 en (1..3,4..6) = EXACTAMENTE las celdas de ` +
        `los 9 Headless ((1,4)(2,5)(1,6)(1,5)x6), abriendo su bolsillo. (5,5) es ALCANZABLE a pie desde ` +
        `el grupo de spawn 'south' (P0a: OPPOSITE del facing norte con que se entra): BFS medido = 70 ` +
        `celdas, (5,5) dentro. Y los Headless son DoNotMove:FALSE — estaban EMPAREDADOS, no quietos, ` +
        `así que la premisa 'melé-estático' del sello anterior también era falsa. La cita de LOS del ` +
        `sello viejo (0x6a86) estaba además EQUIVOCADA: la tabla de proyectil es 0x6a14 (kernel 0x3F6E ` +
        `vía COMSUBS 0x142a) — el #44 estaba INVERTIDO —, aunque el muro 0x4f bloquea en AMBAS, o sea ` +
        `que la LOS nunca fue la pata que decidía. COROLARIO: cae también el ruling del ASCENSO por ` +
        `Deceit (deja de estar sellado como imposible). NOTA DE RÉGIMEN: resolveArenaCombat tenía ` +
        `'plates' apagado por defecto CITANDO A ESTE CAPÍTULO — la capacidad del arnés se desactivó ` +
        `para conservar un sello equivocado; ahora el capítulo la enciende.`,
    );
    cov.write();
  });
});
