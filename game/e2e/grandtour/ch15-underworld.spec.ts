/**
 * GRAND TOUR — CAPÍTULO 15: UNDERWORLD (punto de emergencia de Deceit).
 *
 * ch14b sacó a la party del FONDO de Deceit al Underworld (Des Por en floor 7 →
 * `location 0, floor 0xFF`) en (x=240, y=73), tile 24 = DoomEntrance. Este capítulo juega
 * ESE punto de emergencia.
 *
 * HALLAZGO TOPOLÓGICO (BFS sobre maps/underworld.json + TileData.json, verificado en vivo):
 * la emergencia es una CUENCA DE 12 TILES (hierba/colinas) ANILLADA POR MONTAÑAS
 * (SmallMountains=12 klimbables, TallMountains=13 impasables). ANDANDO Y SIN GARFIO la party
 * no sale de esas 12 casillas.
 *
 * ★ NO ES UN DEAD-END FIEL — corrección del barrido prosa-autofiel (2026-07-27). Este bloque
 * decía «dead-end FIEL de U5» apoyado en una sola pata: «(E)nter en el Underworld → "Enter
 * What?" (game.ts:4336)». ESA GUARDA YA NO EXISTE: la borró `cab88af4` ("(E)nter sin guarda de
 * planta") POR NO DERIVADA, y el comentario vivo que la sustituye (game.ts:4351) dice lo
 * contrario — MAINOUT `cmd_enter` 0x08de despacha (E)nter POR TILE bajo la party, sin mirar
 * g_floor, y el loader 0x790 recorre las 8 mazmorras sin comprobar planta. Y la party emerge
 * ENCIMA de una de ellas: underworld.json[73][240] = tile 24 (DoomEntrance) y
 * data.json locationsX/Y[32] = (240,73) = Deceit ⇒ pulsar E en la casilla de emergencia
 * CARGA Deceit. Lo que este capítulo mide de verdad es lo de abajo (Klimb sin garfio), no la
 * inganabilidad del bolsillo. Mismo defecto que `re/notes/ch16b-dead-end-fabricado.md`:
 * afirmar que el juego no deja salir cuando la mecánica que sí saca no la ejercita el test.
 *
 * ★ RE-VERIFICADO A MANO 2026-07-30 (#21), y con TRES cifras que la corrección de 27-07 no
 * traía. Se leyó `cmd_enter` entera en `re/disasm/MAINOUT.OVL.asm`:
 *   (1) La rutina son 125 líneas y tiene **CERO** referencias a `g_floor` — la afirmación
 *       «sin mirar g_floor» pasa de aserto a MEDIDA. El despacho sale de
 *       `0x08fb call tile_addr(party_x, party_y)` → `0x0900 mov al,[bx]`: el TILE, y nada más.
 *   (2) El tile 24 tiene RAMA PROPIA, no es un caso por defecto: `0x09e9 cmp ax,0x18 /
 *       je 0x9b8`, y 0x9b8 empuja su cadena y salta al tronco común `0x9ab push ax /
 *       call 0x790`, el mismo por el que entran las demás localizaciones.
 *   (3) ★ Las casillas con tile 24 en el Underworld son **TRES**, no una: (y,x) = (20,126),
 *       (27,156) y (73,240). La corrección de 27-07 sólo conocía la tercera, que es la de
 *       emergencia de esta cadena. Es decir, el bolsillo tiene tres bocas derivadas, y este
 *       capítulo sólo pisa una.
 * Lo que sigue SIN hacer es el run: pulsar (E) en el port y ver qué pasa. Un run es evidencia
 * sobre el PORT, así que no cambia nada de (1)-(3), pero es lo que falta para re-sellar.
 *
 *   · No hay moongate en la cuenca (moongateAt exige moonstone enterrada z=0xFF; ninguna en
 *     esta cadena arranca en el Underworld).
 *   · Con garfio (Klimb-con-garfio sobre SmallMountains, game.ts:2461) se abre el Underworld
 *     ORIENTAL (BFS 7223 tiles), pero los 3 shards y el amuleto de LB quedan agua-locked
 *     incluso con garfio → travesía NAVAL (reservada por el README), fuera del alcance
 *     melé-only de este capítulo.
 *
 * El Underworld es OSCURO por naturaleza (lightLevel survival.ts:266: floorByte>0x7f→luz 2).
 * La party emerge AÚN ALUMBRADA (el sello ch14b lleva lightSpellMins=66, In Lor de la
 * mazmorra) — continuidad fiel. In Lor (círculo 1, qty/maná/nivel HEREDADOS de ch14b, sin
 * sembrar nada) la RE-ALUMBRA en el mapa grande (lightSpellMins→100, "A light surrounds thee!").
 *
 * CÓMO TERMINA: SELLA DENTRO del Underworld (el capítulo ELIGE quedarse; NO «porque no haya
 * salida» — ver la corrección de arriba: la casilla de emergencia es una entrada de mazmorra).
 * Sella en la cuenca
 * tras recorrerla. La CONTINUACIÓN de la cadena (shards/amuleto → Codex) es un capítulo de
 * travesía NAVAL posterior; ch15 documenta la ruta de escape (garfio → Underworld ancho) como
 * test de CAPACIDAD, sin sellar por ella.
 *
 * CADENA: encadenado sobre ch14b.gam, entryClock 10:00, reseed(0). El sello ch15.gam es estado
 * de Underworld tras el recorrido. El miembro índice 1 sigue MUERTO (heredado de ch14b).
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, chapterTimeout, getPos, dungeonPos, type Pos } from "./nav";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";
import { tr } from "./tourLang";

const PREV_CHAPTER = "ch14b";
const EMERGE = { x: 240, y: 73 } as const; // punto de emergencia de Deceit en el Underworld

const cov = new Coverage("ch15");

/** Lee un campo del estado vivo. */
const readNum = (page: Page, expr: string) =>
  page.evaluate(
    (e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()),
    expr,
  ) as Promise<number>;

const press = (page: Page, key: string): Promise<void> => page.locator("body").press(key);
const consoleTail = (page: Page, n: number): Promise<string[]> =>
  page.evaluate(
    (k) => (window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().slice(-k),
    n,
  );

/** Pulsa una flecha y espera (determinista) a que el world-turn avance o la posición cambie. */
async function stepArrow(page: Page, key: string): Promise<Pos> {
  const before = await getPos(page);
  const turnsBefore = await readNum(page, "turnsSinceStart");
  await press(page, key);
  await page
    .waitForFunction(
      ({ tb, bx, by }) => {
        const s = (window as unknown as { __u5test: { state: () => { turnsSinceStart: number; position: { x: number; y: number } } } }).__u5test.state();
        return s.turnsSinceStart > tb || s.position.x !== bx || s.position.y !== by;
      },
      { tb: turnsBefore, bx: before.x, by: before.y },
      { timeout: 10_000, polling: 16 },
    )
    .catch(() => {});
  return getPos(page);
}

/** In Lor por el cableado REAL de la UI del mapa grande (C → "IL" → Enter). El caster activo
 *  ya está fijado (activeCharacter heredado, Good) → pickCaster va directo a "Spell name:". */
async function castInLor(page: Page): Promise<string[]> {
  await press(page, "c");
  await press(page, "i");
  await press(page, "l");
  await press(page, "Enter");
  return consoleTail(page, 6);
}

/**
 * Secuencia de SELLADO canónica (una sola fuente para el sello y para el ×2). Import fresco de
 * ch14b + reseed(0), In Lor, recorrido determinista de la cuenca, y export. Devuelve todo lo
 * que los asserts necesitan (bytes + testigos), sin duplicar la secuencia de teclas.
 */
async function playAndSeal(page: Page): Promise<{
  gam: Uint8Array;
  inLorLog: string;
  lightInherited: number;
  lightAfterCast: number;
  blockedPos: Pos;
  trail: Pos[];
  klimbLog: string;
  finalPos: Pos;
  gold: number;
  karma: number;
  keys: number;
  gems: number; // #65: el canal de GEMAS, declarado
  intelligence: number;
}> {
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));

  const intelligence = await readNum(page, "characters[0].intelligence");
  const gold = await readNum(page, "gold");
  const karma = await readNum(page, "karma");
  const keys = await readNum(page, "keys");
  const gems = await readNum(page, "gems"); // #65: el canal de GEMAS, declarado
  const lightInherited = await readNum(page, "lightSpellMins");

  // In Lor re-alumbra el Underworld oscuro (heredó qty/maná/nivel de ch14b; sin sembrar).
  const inLorLog = (await castInLor(page)).join("\n");
  const lightAfterCast = await readNum(page, "lightSpellMins");

  // Anillo de montaña: N de (240,73) = SmallMountain 12 → movimiento RECHAZADO (no mueve).
  const blockedPos = await stepArrow(page, "ArrowUp");

  // Recorrido determinista de la cuenca por flechas REALES (termina en (240,75)).
  const trail: Pos[] = [];
  for (const k of ["ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowRight", "ArrowLeft"]) {
    trail.push(await stepArrow(page, k));
  }

  // Dead-end a pie: (K)limb sin garfio → "With what?" (no se anilla la montaña sin garfio).
  await press(page, "k");
  await page.waitForFunction(
    () => /With what\?/i.test(((window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().slice(-2).join("\n"))),
    undefined,
    { timeout: 5_000, polling: 16 },
  ).catch(() => {});
  const klimbLog = (await consoleTail(page, 2)).join("\n");

  const finalPos = await getPos(page);
  const { gam } = await exportCheckpoint(page, "ch15");
  return { gam, inLorLog, lightInherited, lightAfterCast, blockedPos, trail, klimbLog, finalPos, gold, karma, keys, gems, intelligence };
}

test.describe.serial("GT ch15 — Underworld (emergencia de Deceit)", () => {
  test("emerge del Underworld, re-alumbra con In Lor, recorre la cuenca de emergencia y SELLA", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page);

    // Premisas de cadena verificadas ANTES de jugar (import dentro de playAndSeal).
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    const entry = await getPos(page);
    expect(entry, "arranca en el punto de emergencia del Underworld").toMatchObject({ location: 0, floor: 0xff, x: EMERGE.x, y: EMERGE.y });
    expect(await page.evaluate(() => (window as unknown as { __u5test: { game: { activeMap: { kind: string } } } }).__u5test.game.activeMap.kind), "mapa activo = underworld").toBe("underworld");

    const r = await playAndSeal(page);

    // (1) Premisas de cadena.
    expect(r.intelligence, "INT 22 (bracket all-A de ch01)").toBe(22);
    expect(r.karma, "karma 80 heredado").toBe(80);
    // Árbol COMBINADO (cadena + botín real del cofre): 1 heredada de la CADENA + 2 del
    // botín real del cofre de floor 7 de ch14b.
    // RE-BASELINE 2026-07-31 (ventana del ORO, #52): 2 → 3. La suma es la MISMA fórmula,
    // con el término de CADENA de vuelta a 1: antes 0 (cadena) + 2 (botín) = 2; ahora
    // 1 + 2 = 3. Y vuelve porque la llave de cadena NUNCA la rompió el (J)immy de Yew: se
    // la llevó la CONFISCACIÓN del arresto de ch08 (`guardArrestJail`, `g_keys=0`, TOWN
    // 0x1332), cuyo sello se escribió con el party encarcelado por no poder pagar el
    // tributo. Refutación medida en `re/notes/auditoria-estatica-sellos.md` §3; con el pin
    // `entryGold` (#52) el tributo se paga y no hay confiscación. ★ El término del BOTÍN
    // sigue valiendo 2 —lo fija ch14-deceitb.spec.ts en RELATIVO (`keysIn + 2`), que pasó
    // verde—, así que el delta de aquí es exactamente la llave de cadena y nada más.
    expect(r.keys, "3 llaves heredadas = 1 de cadena (vuelve: sin arresto en ch08 no hay CONFISCACIÓN — el «lo rompió el (J)immy» quedó REFUTADO en auditoria-estatica-sellos.md §3) + 2 del botín real del cofre de ch14b").toBe(3);

    // (2) Luz: emergió alumbrada (In Lor de la mazmorra) y In Lor la re-alumbra a 100.
    expect(r.lightInherited, "emergió con luz de In Lor de la mazmorra (continuidad fiel)").toBeGreaterThan(0);
    // In Lor global → éxito SILENCIOSO (CAST 0x11a6): sin "A light surrounds thee" (flavor
    // fabricado, purgado). lightAfterCast=100 (abajo) prueba el efecto; eco rúnico "IN LOR".
    expect(r.inLorLog, "eco rúnico IN LOR").toMatch(/IN LOR/);
    expect(r.inLorLog, "sin flavor fabricado").not.toMatch(/surrounds/i);
    expect(r.lightAfterCast, "In Lor fija lightSpellMins a 100").toBe(100);
    cov.mark("map-underworld").mark("spell-0-in-lor").mark("command-c");

    // (3) Anillo de montaña: el paso al N (SmallMountain 12) NO mueve.
    expect(r.blockedPos, "N es SmallMountain → movimiento rechazado (sigue en la emergencia)").toMatchObject({ x: EMERGE.x, y: EMERGE.y });

    // (4) Recorrido determinista de la cuenca (todas las casillas dentro del Underworld).
    expect(r.trail.map((p) => `${p.x},${p.y}`)).toEqual(["240,74", "240,75", "239,75", "240,75", "241,75", "240,75"]);
    for (const p of r.trail) expect(p, "cada paso sigue en el Underworld").toMatchObject({ location: 0, floor: 0xff });

    // (5) Dead-end a pie: (K)limb sin garfio → "With what?".
    // Ésta SÍ es fidelidad derivada (a diferencia del «sin salida» del bloque de cabecera):
    // CMDS 0x1c28 `cmp [g_grapple 0x57AF],0` → sin garfio imprime "With what?" (re/notes/klimb-grapple.md:27-29).
    expect(r.klimbLog, "Klimb sin garfio → «With what?» — FIEL por CMDS 0x1c28 (g_grapple 0x57AF)").toMatch(/With what\?/i);
    cov.mark("command-k");

    // (6) Sello byte-exacto en la cuenca (240,75), en el Underworld.
    expect(r.finalPos, "sella en (240,75) dentro de la cuenca").toMatchObject({ location: 0, floor: 0xff, x: 240, y: 75 });
    expect(r.gam.length).toBe(4192);
    expect(r.gam[PARTY.location], "sello en el mapa (overworld id)").toBe(0);
    expect(r.gam[PARTY.floor], "sello en el UNDERWORLD (0xFF)").toBe(0xff);
    expect(r.gam[PARTY.x], "x del sello").toBe(240);
    expect(r.gam[PARTY.y], "y del sello").toBe(75);
    expect(r.gam[PARTY.karma], "karma intacto en el .gam").toBe(80);

    cov.note(
      `Underworld (emergencia de Deceit, location 0 · floor 0xFF · 240,73 · tile 24 DoomEntrance). ` +
        `GEMAS ${r.gems}→${r.gems} (#65: HEREDADAS del cofre de ch14b e INVARIANTES aquí — este capítulo ` +
        `no las gasta; declararlo convierte «no lo sé» en «medido y quieto»). ` +
        `HALLAZGO topológico (BFS underworld.json+TileData.json, verificado en vivo): la emergencia es ` +
        `una CUENCA de 12 tiles anillada por montañas (SmallMountains=12 klimbables, TallMountains=13 ` +
        `impasables). ANDANDO Y SIN GARFIO la party no sale de esas 12 casillas — MEDIDA del PORT, NO ` +
        `dead-end fiel: la pata «(E)nter → "Enter What?"» que sellaba esto citaba game.ts:4336, guarda ` +
        `BORRADA por cab88af4 POR NO DERIVADA (hoy game.ts:4351 dice lo contrario: MAINOUT cmd_enter ` +
        `0x08de despacha por TILE sin mirar g_floor), y la casilla de emergencia (240,73) ES tile 24 ` +
        `DoomEntrance = Deceit ⇒ pulsar E carga la mazmorra. No hay moongate en la cuenca (ninguna moonstone ` +
        `enterrada z=0xFF). El Underworld es OSCURO (lightLevel floorByte>0x7f→2); la party EMERGE aún ` +
        `alumbrada (sello ch14b lightSpellMins=66) e In Lor la re-alumbra (→100, éxito SILENCIOSO sin string; ` +
        `qty/maná/nivel HEREDADOS de ch14b, sin sembrar). Recorrido REAL por flechas de la cuenca ` +
        `(240,73→74→75, 239/240/241,75). Con garfio (test de capacidad) se anilla la montaña y se abre el ` +
        `Underworld ORIENTAL (BFS 7223 tiles) — pero shards ((192,80)/(130,65)/(176,184)) y amuleto de LB ` +
        `((105,225)) quedan AGUA-LOCKED incluso con garfio → travesía NAVAL futura (README), fuera del ` +
        `alcance melé-only. SELLA dentro del Underworld en (240,75) — el capítulo ELIGE quedarse; NO es ` +
        `un veredicto de «sin salida». ` +
        `karma/keys/gold/INT intactos; el miembro 1 sigue MUERTO (heredado de ch14b). Comandos c/k. ` +
        `Delta: lightSpellMins (In Lor + decaimiento), time (recorrido; el import lo re-normaliza aguas ` +
        `abajo). HORA 10:00, encadenado sobre ch14b.gam.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds).toEqual(["command-c", "command-k", "map-underworld", "spell-0-in-lor"]);
  });

  test("capacidad de ESCAPE: con garfio, Klimb sobre la montaña que anilla la cuenca → Underworld ancho (no sella)", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    // Prueba de CAPACIDAD (no sella): re-import fresco + siembra grapple (costura de arnés
    // declarada, CLASE #47 — key-item que un playthrough real ya tendría; NO viaja al sello de
    // ch15 porque este test no exporta). Klimb-con-garfio sobre la SmallMountain del N cruza la
    // party FUERA de la cuenca de 12, al Underworld oriental. Documenta que la cadena PUEDE
    // continuar (garfio → 7223 tiles → travesía naval a shards/amuleto).
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await page.evaluate(() => {
      const t = window as unknown as { __u5test: { game: { state: { grapple: boolean } }; reseed: (s: number) => void } };
      t.__u5test.game.state.grapple = true;
      t.__u5test.reseed(0);
    });

    const before = await getPos(page);
    expect(before).toMatchObject({ location: 0, floor: 0xff, x: EMERGE.x, y: EMERGE.y });

    await press(page, "k"); // Klimb-con-garfio pide dirección ("Klimb-")
    await page.waitForFunction(
      () => /Klimb-/i.test((window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().slice(-1).join("")),
      undefined,
      { timeout: 5_000, polling: 16 },
    ).catch(() => {});
    await press(page, "ArrowUp"); // grapple-klimb sobre la SmallMountain del N
    await page.waitForFunction(
      (by) => (window as unknown as { __u5test: { state: () => { position: { y: number } } } }).__u5test.state().position.y !== by,
      before.y,
      { timeout: 10_000, polling: 16 },
    ).catch(() => {});

    const after = await getPos(page);
    const inCombat = await page.evaluate(() => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat !== null);
    const klimbLog = (await consoleTail(page, 4)).join("\n");

    expect(inCombat, "el escape con garfio no dispara encuentro bajo seed-0").toBe(false);
    // Eco de comando (K)limb: en es la consola traduce el verbo "Klimb-"→"Trepar-" (cmd-strings,
    // pushConsole→t()); la dirección "North" se conserva. Assert parametrizado por idioma.
    expect(klimbLog, "Klimb-North con tirada de caída determinista").toMatch(new RegExp(tr({ en: "Klimb-North", es: "Trepar-North" }), "i"));
    expect(after, "la party salió de la cuenca (y = 72, sobre la montaña anular)").toMatchObject({ location: 0, floor: 0xff, x: 240, y: 72 });
    const inBasin = after.y >= 73 && after.y <= 76;
    expect(inBasin, "cruzó FUERA de la cuenca de 12 tiles (escape verificado)").toBe(false);
  });

  test("el ch15.gam exportado es un save NATIVO que el port re-importa a idéntico estado (Underworld)", async ({ page }) => {
    await bootWorld(page, { debug: false });
    const { gam, sidecar } = readCheckpointFiles("ch15");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 0, floor: 0xff }); // Underworld
    expect(await dungeonPos(page), "el save de emergencia NO está en mazmorra").toBeNull();
  });

  test("SELLO ×2 byte-idéntico: jugar el capítulo dos veces produce el MISMO ch15.gam", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page);
    const a = (await playAndSeal(page)).gam;
    const b = (await playAndSeal(page)).gam;
    expect(a.length).toBe(4192);
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b)), "el sello es determinista (×2 idéntico)").toBe(0);
  });
});
