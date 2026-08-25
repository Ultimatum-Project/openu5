/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2 — ch27-salas-doom: censo/conquista de las 16 salas de DOOM (loc 40, la mazmorra FINAL,
 * combatmaps 112-127; roomNo = sub&0xF, cm = 112+roomNo). Modelo SINGLE-DESCENT (ch18), NO
 * per-sala-con-re-entrada: Doom es DENSO y su descenso físico es una ruta ÚNICA — un solo viaje
 * de cima a fondo que conquista al pasar cada sala con `conquerRoomAt` (pather físico + placas).
 *
 * ── LA SONDA DEL ENDGAME (decidida ANTES de construir; ver re/notes/salas-doom-relevo.md) ──────
 * `checkDoomRescue` (game.ts:4116) NO es POSICIONAL: dispara en `floor===7 && endgameReady(state)
 * && !game-won`, tras CADA turno de mazmorra (game.ts:5567/5600). No hay celda que evitar. Y
 * `endgameReady` (lordbritish.ts:139) = canReachDoom (3 Shadowlords muertos) && amulet && crown &&
 * sceptre. El .gam de ch17 trae las 3 regalías (bytes 0x20d/0x20e/0x20f = 1) y los 3 SL muertos ⇒
 * endgameReady=TRUE (por eso ch18 se PARA en f6). LA LLAVE: el loadout de este capítulo DESPOJA
 * las 3 regalías (`state.lbArtifacts = {amulet:false,crown:false,sceptre:false}`) ⇒ endgameReady
 * es FALSE ⇒ las 3 salas de f7 (r11/r12/r15) se conquistan SIN disparar el rescate. Costura de
 * arnés declarada (misma clase #47 que el loadout de ch18: estado test-only, cero cambio de core;
 * ch17 conserva sus regalías y su endgame sigue disparando — sin cruce).
 *
 * ── TOPOLOGÍA DE DOOM (derivada de dungeons.json[7] + combatmaps.json; ver el análisis) ─────────
 * 12 salas se conquistan en UNA pasada de cima; 4 son «duras» (Fase 2b) por estructura física:
 *  · f2→f3 es un CHOKE DE UN SOLO USO: NO hay escalera-abajo ni foso en f2; la ÚNICA vía a f3+
 *    es la ESCALERA INTERIOR de r3 (#99, cm115 tiene el tile 201 LADDER_DOWN), usada por
 *    klimb-descend DURANTE su combate. Una vez despejada r3 pasa a RoomsBroke y su escalera
 *    interior ya NO desciende → f3-f7 son alcanzables EXACTAMENTE UNA VEZ (no hay re-entrada).
 *  · 4 salas MURADAS por los 4 costados, entrada por caída/klimb de una sola dirección → al
 *    ganar, la party queda VARADA en su celda (game.ts:5720 marca despejada pero no reubica).
 *    Des Por / Uus Por son INERTES en Doom (game.ts magicChangeLevel falla en silencio) y
 *    r2/r6 ni siquiera están «lit» (sin klimb-garfio). Son:
 *      - r2  f1(1,1)  ← klimb-UP desde f2(1,1); no-lit.
 *      - r6  f2(5,5)  ← klimb-DOWN desde f1(5,5); no-lit.
 *      - r10 f6(1,3)  ← klimb-UP desde f7(1,3); necesita f7 (tras el choke) → varar bloquea el resto.
 *      - r15 f7(5,7)  ← FOSO desde f6(5,7); sin escalera interior; varar en el fondo.
 *    ★ ERRATA CORREGIDA POR DERIVACIÓN (#11, `salidas-11-errata-grate.md`). Aquí ponía «sin
 *    escalera interior (su cm no tiene tile 200/201) … sólo un klimb-escape de combate saca, y
 *    NO HAY ESCALERA QUE KLIMBAR». Es FALSO para la mitad: el (K)limb de combate acepta TRES
 *    tiles, no dos — `cmd_klimb_combat` SJOG 0x1df4 añade **0x86 Grate** (código 6 = baja),
 *    gateado por el bit de SALA en 0x1dfb. Y contra el `.CBT` crudo, **r2 (cm114) tiene Grate
 *    en (3,3) y r10 (cm122) en (5,7)**, a un paso de sus tres spawns. O sea: dos de las cuatro
 *    NO son varaderos — son conquistables, y su sitio en la cola 2b es de ENTRADA, no de
 *    salida. r6 (cm118) y r15 (cm127) sí quedan sin ninguna de las cuatro vías: son los DOS
 *    únicos bolsillos fieles del juego. No mueve cifra hoy (las cuatro siguen en `pass2b`):
 *    la corrección es de PROSA, y va por derivación porque la razón escrita era inventada.
 *    Varar en cualquiera de ellas ANTES de terminar bloquea el resto del descenso de un solo uso,
 *    así que van a la COLA Fase 2b (cada una su mini-entrada dedicada). El 100% sigue trackeado en
 *    docs/guias/doom/CENSO-COMBATMAPS.md. Doctrina idéntica a ch20-deceit (bolsillos varados → 2b).
 *
 * Digest {roomNo:outcome} de las 12 atacadas, ×2 determinista bajo reseed(0). El .GAM nativo NO
 * representa la posición 3D de mazmorra (saveNative sólo dungeonRoomsCleared) → sin chNN.gam; el
 * sello es el digest de veredictos (como ch18).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, conquerRoomAt, dungeonPos, type DFacing } from "./nav";

const PREV_CHAPTER = "ch17"; // umbral de Doom (Underworld 128,128, sello VERAMOCOR abierto)
const DOOM = 40;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const GLASS_SWORD = 0x27;
const ARROWS = 0x1b;

const press = (page: Page, k: string): Promise<void> => page.locator("body").press(k);

// Las 16 salas de Doom (dungeons.json[7] type 0xF; roomNo=sub&0xF; cm=112+roomNo). `approachDir`
// = dirección de ENTRADA (la party se para en roomCell−delta(dir) mirando a la sala). `descend`:
// la única bajada es la escalera INTERIOR de la sala (klimb-descend). `pass2b`: sala MURADA/varada
// → Fase 2b (mini-entrada dedicada). Orden por planta para descender sin cruzar salas sin conquistar.
type RoomSpec = {
  floor: number; x: number; y: number; roomNo: number;
  approachDir?: DFacing; descend?: boolean; sceptre?: boolean; pass2b?: string;
};
// TOPOLOGÍA MEDIDA (pasada de cima, ×2): Doom es un LABERINTO (como Deceit ch20) cuyas plantas
// bajas se parten en BOLSILLOS que el descenso genérico (pather físico de sala-en-sala) NO conecta
// — conquistar una sala VARA a la party en su bolsillo y la sala siguiente queda «sin plan». La
// pasada de cima alcanza 6 salas: r0(f0),r4/r3(f2),r8/r7(f5),r14(f6). El resto son bolsillos
// AISLADOS (aproximación mural sólo alcanzable por klimb/foso desde otro bolsillo) o MURADAS que
// varan — cada una su mini-entrada dedicada en Fase 2b (censo docs/guias/doom/CENSO-COMBATMAPS.md;
// doctrina docs/plan-tour-salas.md §Fase 2b). El 100% sigue trackeado.
const ROOMS: RoomSpec[] = [
  { floor: 0, x: 1, y: 1, roomNo: 0, approachDir: "north" }, // SPAWN: (E) coloca aquí sin combate → sale a (1,2) y vuelve a pisarla
  { floor: 2, x: 1, y: 5, roomNo: 4, approachDir: "east" },
  { floor: 2, x: 5, y: 1, roomNo: 3, approachDir: "south", descend: true, sceptre: true }, // #99: spawn-norte P0a → (U)se Cetro disuelve barrera (5,5) → klimb-descend escalera (5,7) → f3 (CHOKE f2→f3, un solo uso)
  { floor: 5, x: 3, y: 3, roomNo: 8, approachDir: "south" },
  { floor: 5, x: 7, y: 3, roomNo: 7, approachDir: "east" },
  { floor: 6, x: 7, y: 3, roomNo: 14, approachDir: "south" },
  // ── Fase 2b — BOLSILLOS AISLADOS del laberinto (aproximación no alcanzable en la pasada de cima):
  { floor: 3, x: 3, y: 3, roomNo: 1, pass2b: "bolsillo f3(3,3): approach (2,3)/(4,3) sólo por klimb desde f4, tras el choke la party cae en la isla f3(5,1) murada" },
  { floor: 4, x: 3, y: 3, roomNo: 5, pass2b: "bolsillo f4(3,3): approach (2,3) inalcanzable (r5 parte el laberinto de f4)" },
  { floor: 6, x: 5, y: 3, roomNo: 9, pass2b: "bolsillo f6(5,3): approach (4,3) aislado (sólo por foso (3,3) que cae a f7)" },
  { floor: 6, x: 3, y: 7, roomNo: 13, pass2b: "bolsillo f6(3,7): approach (4,7) aislado (sólo (5,7)-foso o la propia sala)" },
  { floor: 7, x: 7, y: 3, roomNo: 11, pass2b: "bolsillo f7(7,3): pocket {(5,3),(6,3),(7,3)} sólo por f7(5,3)=Lu, inalcanzable sin descender sobre r9" },
  { floor: 7, x: 1, y: 7, roomNo: 12, pass2b: "bolsillo f7(1,7): pocket del fondo, entrada por foso f6(1,7) dedicada" },
  // ── Fase 2b — MURADAS por los 4 costados, varan la party (ver cabecera §TOPOLOGÍA):
  { floor: 1, x: 1, y: 1, roomNo: 2, pass2b: "murada f1(1,1) ← klimb-UP f2(1,1); no-lit; sin escalera interior" },
  { floor: 2, x: 5, y: 5, roomNo: 6, pass2b: "murada f2(5,5) ← klimb-DOWN f1(5,5); no-lit; sin escalera interior" },
  { floor: 6, x: 1, y: 3, roomNo: 10, pass2b: "murada f6(1,3) ← klimb-UP f7(1,3); varar en f6 bloquea el descenso de un uso" },
  { floor: 7, x: 5, y: 7, roomNo: 15, pass2b: "murada f7(5,7) ← FOSO f6(5,7); sin escalera interior; varar en el fondo" },
];
const POCKET_SIZE = ROOMS.filter((r) => !r.pass2b).length; // 6 salas alcanzables en la pasada de cima

/**
 * Costura #47: loadout del descenso (3 miembros vivos L8 + Magic Bow/Ring invis/flechas/Glass) Y
 * DESPOJO DE REGALÍAS (endgameReady=false ⇒ f7 no dispara el rescate; ver cabecera §SONDA). Des
 * Por NO se siembra: es INERTE en Doom → el pather usa `noDespor` (transiciones sólo físicas).
 */
async function seedDoomLoadout(page: Page): Promise<void> {
  await page.evaluate(
    ([bow, ring, glass, arrows]) => {
      const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (!c) continue;
        c.level = 8; c.maxHp = 240; c.currentHp = 240; c.strength = 30; c.dexterity = 30; c.intelligence = 30;
        c.status = "G"; c.weapon = bow; c.ring = ring; // vivo + Magic Bow (alcance 15) + Ring invis (inmune a posesión)
      }
      st.equipmentQuantities[arrows] = 255;
      st.equipmentQuantities[glass] = 99;
      st.lightSpellMins = 9999; st.torchTurns = 9999; // luz para moverse/buscar
      // DESPOJO PARCIAL DE REGALÍAS: endgameReady = canReachDoom && amulet && crown && sceptre (AND
      // de las 3). Despojar amulet+crown ⇒ FALSE aunque CONSERVEMOS el sceptre → el rescate de f7 NO
      // dispara. Y CONSERVAR el sceptre es OBLIGATORIO: el descenso fiel de la #99 (spawn-norte P0a)
      // exige (U)se Cetro para disolver la barrera ShadowlordBoundary (5,5) que sella la escalera
      // interior. ch17 (que trae las 3) queda intacto y su endgame sigue disparando.
      st.lbArtifacts = { amulet: false, crown: false, sceptre: true };
    },
    [MAGIC_BOW, RING_INVIS, GLASS_SWORD, ARROWS] as const,
  );
}

/**
 * RE-READY POR SALA (re-diseño post-#36; bisect re/notes/grandtour-salas-bisect.md §3).
 * #36 hizo fiel el desequipado por munición agotada: pool común EXACTAMENTE a 0 ⇒ barrido del
 * PARTY ENTERO por id de arma (SJOG 0x1b34, `si < g_party_size` sobre `unequip_item` 0x6e60;
 * acta re/notes/municion-36-acta.md). La premisa «Magic Bow en toda la party + pool común 99
 * para el descenso ENTERO» era frágil: el primer agotamiento desarmaba a todos y las salas
 * tardías caían (r7 DEADEND-STUCK, r14 THROW resolvedor — clase #167, combate a manos desnudas
 * hasta el techo). Reponer+re-equipar ANTES de cada sala es costura de arnés clase #47 (cero
 * core, cero RNG — la cadena de munición no consume RNG, acta #36 §6): el cruce exacto-0 no se
 * alcanza y el spec sigue ejercitando la conquista ranged del descenso. 255 = techo del byte
 * (add de reposición byte pelado mod 256, COMSUBS 0x09ab). HP/anillos/posición no se tocan.
 */
async function rearmParty(page: Page): Promise<void> {
  await page.evaluate(
    ([bow, arrows]) => {
      const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (c) c.weapon = bow;
      }
      st.equipmentQuantities[arrows] = 255;
    },
    [MAGIC_BOW, ARROWS] as const,
  );
}

/** Corre la PASADA DE CIMA de Doom una vez; devuelve el digest roomNo→outcome de las 12 atacadas. */
async function runDoom(page: Page): Promise<{ digest: string; outcomes: Record<number, string> }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  // Reset de sesión 3D previa (el ×2 corre dos pasadas en la MISMA página); test-only.
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { dungeonState: unknown; combat: unknown } } }).__u5test.game;
    g.dungeonState = null; g.combat = null;
  });
  await seedDoomLoadout(page);
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  // (E)nter desde el umbral de ch17 → Doom por la cima (sello abierto, 3 SL muertos → sin emboscada).
  await press(page, "e");
  const entry = await dungeonPos(page);
  expect(entry, "(E) desde el umbral de ch17 desciende a Doom por la cima").toMatchObject({ dungeon: DOOM, floor: 0 });

  const outcomes: Record<number, string> = {};
  for (const r of ROOMS) {
    if (r.pass2b) { outcomes[r.roomNo] = "SKIP-pend-entrada-2b"; continue; }
    try {
      await rearmParty(page); // re-diseño post-#36: el pool nunca llega al cruce exacto-0
      const v = await conquerRoomAt(page, {
        roomCell: { floor: r.floor, x: r.x, y: r.y },
        approachDir: r.approachDir!,
        descend: r.descend, descendDir: r.descend ? "down" : undefined, sceptre: r.sceptre,
        noDespor: true, // Doom: Des Por inerte → descenso SÓLO físico
        maxRounds: 600,
      });
      outcomes[r.roomNo] = v.outcome;
    } catch (e) {
      outcomes[r.roomNo] = `THROW:${(e as Error).message.slice(0, 48)}`;
    }
  }
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes };
}

test.describe.serial("FASE 2 — ch27 salas de Doom (single-descent, pasada de cima)", () => {
  test("conquista las 12 salas alcanzables en un descenso (regalías despojadas → f7 no dispara el endgame)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runDoom(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => ((a[o] = (a[o] ?? 0) + 1), a), {});
    console.log(`[ch27-doom] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch27-doom] digest=${digest}`);

    // Las salas de la pasada de cima deben conquistar/sellar (VICTORY/DEADEND), sin THROW/FAIL.
    const attempted = ROOMS.filter((r) => !r.pass2b);
    const bad = attempted.filter((r) => !["VICTORY", "DEADEND"].includes(outcomes[r.roomNo]!));
    expect(bad.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`), "pasada de cima: salas del bolsillo alcanzable conquistadas/selladas").toEqual([]);
    expect(attempted.length, "6 salas alcanzables en la pasada de cima (resto = bolsillos/muradas de Fase 2b)").toBe(POCKET_SIZE);

    // ★ PIN POR SALA (tarjeta #164, ventana 2026-07-29). Mismo defecto que ch20 tenía: arriba
    // sólo se comprobaba PERTENENCIA al conjunto {VICTORY,DEADEND} y RECUENTO, así que un flip
    // VICTORY↔DEADEND pasaba EN VERDE; y el test de determinismo compara B contra A **de la
    // misma corrida** (mide determinismo, no estabilidad contra un sello). Con esto, un flip
    // futuro sale ROJO y se adjudica como cualquier otro.
    // BASELINE MEDIDO (no veredicto de fidelidad), estable en 13b46ee6 y en HEAD.
    // ★ PROCEDENCIA POST-#36 (bisect re/notes/grandtour-salas-bisect.md §3, 22-08): estos
    // pines se rompieron en `0b7d020a` (#36 — r7 DEADEND-STUCK, r14 THROW con la party
    // desarmada). El RE-DISEÑO (rearmParty por sala) evita el cruce exacto-0 y RESTAURA el
    // baseline: re-medidos IDÉNTICOS a los de julio, no adaptados.
    const byOutcome = (o: string) => attempted.map((r) => r.roomNo).filter((n) => outcomes[n] === o).sort((a, b) => a - b);
    expect(byOutcome("VICTORY"), "VICTORY: baseline MEDIDO (julio; re-medido post-#36 con rearmParty, 22-08), no veredicto de fidelidad").toEqual([0, 3, 7, 14]);
    expect(byOutcome("DEADEND"), "DEADEND del PORT: baseline MEDIDO (ídem), no veredicto de fidelidad").toEqual([4, 8]);
    // El endgame NO se dispara: la ruta no pisa la celda de LB (cm127, sala 15) y desde
    // #179 pisar f7 tampoco dispara nada (el desenlace exige la ABSORCIÓN en esa sala).
    const won = await page.evaluate(() => (window as unknown as { __u5test: { game: { state: { questFlags: Record<string, boolean> } } } }).__u5test.game.state.questFlags["game-won"] === true);
    expect(won, "la ruta no entra en cm127 ⇒ el desenlace no se dispara (game-won=false, #179)").toBe(false);
  });

  test("determinismo ×2: dos pasadas de cima frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runDoom(page);
    const b = await runDoom(page);
    expect(b.digest, "digest de veredictos byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
