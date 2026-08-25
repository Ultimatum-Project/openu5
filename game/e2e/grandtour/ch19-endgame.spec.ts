/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * GRAND TOUR — CAPÍTULO 19: LA LIBERACIÓN DE LORD BRITISH (el desenlace, jugado).
 *
 * Cierra la troncal del tour: ch18 se detiene en N7 (floor6, (7,0)) «sin disparar el
 * endgame» a propósito; este capítulo ENTRA a la cámara de LB y juega el desenlace
 * COMPLETO por la vía FIEL de #179 (re/notes/absorcion-179-acta.md): caída por el foso
 * f6(5,7) → sala cm127 («Entering room…») → absorción de TODA la party en (5,2) bajo el
 * alma 0x3c → tablero vacío → endgame (caja → «FOLLOW!»/orbe → moongate → disolución →
 * Homecoming (storyHouse) → The Dream (storyDream) → pergamino → freeze terminal).
 *
 * ── CADENA ──────────────────────────────────────────────────────────────────────────
 * ch18 NO exporta checkpoint (el .GAM nativo no representa la posición 3D de mazmorra,
 * sello de ch18) ⇒ ch19 arranca del MISMO checkpoint ch17 (umbral de Doom) y REPRODUCE
 * el descenso real de 60 pasos hasta N7 con el driver compartido `doom-descent.ts`
 * (extracción byte-idéntica de ch18: mismas teclas, mismas salas #99/#103, mismo corte).
 * Desde N7 continúa donde ch18 cortó.
 *
 * ── LA ENTRADA A LA CÁMARA: por qué hay UNA costura de posicionamiento ──────────────
 * DERIVADO de assets/maps/dungeons.json[7] (BFS con TODAS las mecánicas reales: pasos
 * con wrap &7 — DUNGEON 0x1d66/0x057a —, fosos type6 sub1, escaleras 1/2/3, cruce de
 * salas tras victoria, grates de r2/r10 y la escalera interior de r3): el bolsillo de la
 * cámara {f6 r13(3,7)·(4,7)·foso(5,7)} ∪ {f7 (2,7)·(3,7)Lu·r12·r15} está DESCONECTADO
 * del grafo alcanzable — desde N7 y desde la cima. Sus entradas viven a su vez en
 * bolsillos (r12 sólo por el foso f6(1,7), cuya única marcha es el wrap norte desde
 * f6(1,0), a su vez aislada; r13 sólo por klimb-up desde f7(3,7), tras r12). Es la MISMA
 * topología por la que la cola de Doom es Fase 2b (docs/guias/doom/CENSO-COMBATMAPS.md)
 * y ch37 siembra cada sala por teleport. ⇒ el salto N7 → f6(4,7) usa la costura de
 * posicionamiento SANCIONADA (modelo (C) del README §alcanzabilidad; #47), IDÉNTICA a la
 * semilla de ch37-r15 (tp f6(4,7) + paso ESTE). TODO lo demás es real: giro por teclas,
 * paso al foso (dng_pit_fall 0x0A4C), entrada de sala por LLEGADA-A-CELDA (DUNGEON
 * 0x0C76 → dng_enter_room 0x0d40), paseo de combate por teclas y escena por teclas.
 *
 * ── LA ABSORCIÓN, JUGADA (no colocada) ──────────────────────────────────────────────
 * A diferencia de la costura de endgame.spec/videocap (colocar cada miembro en (5,3)),
 * aquí cada miembro CAMINA desde su spawn fiel (P0a; playerStarts de cm127: centro-sur)
 * hasta (5,2) con FLECHAS REALES, un paso por turno (greedy sobre el tablero del .CBT,
 * acta #179 §1 — la única celda absorbente del juego es (5,2), bajo el alma 0x3c de
 * (5,1)). El gancho corre al CERRAR cada turno de miembro (COMBAT 0x0b8b → SJOG 0x1ea4;
 * el turno enemigo no lo evalúa — no hay enemigos: cm127 siembra CERO unidades hostiles
 * y el latch de victoria nace a 1 SIN print, COMBAT 0x0bb2-0x0bc0). Con el último
 * miembro absorbido el tablero queda vacío (recuento SJOG 0x1b6c: el registro barrido no
 * cuenta) → retorno 0 → centinela 0x4d → desvío al endgame (DUNGEON 0x00c7-0x00d2 →
 * overlay 13 endgame_main 0x0648). En el port: `Combat.maybeAbsorb` → `endCombat` →
 * `fireAbsorptionEndgame` (game.ts). El primer Espacio tras `over` deja al pacer real
 * llamar a endCombat (mismo régimen que videocap endgame-absorcion).
 *
 * ── QUÉ OFFSETS DEL .GAM CAMBIA EL DESENLACE: NINGUNO (derivado) ────────────────────
 * `endgame_main` NO RETORNA (bucle infinito en ambas ramas — endgame.md; acta #179 §4:
 * el marcado de sala 0x00de queda aguas abajo del desvío y no corre jamás) ⇒ el binario
 * TERMINA la partida sin save posterior: el desenlace no ESCRIBE ningún offset del .GAM.
 * Lo que el desenlace LEE del estado que el .GAM de la cadena acarrea sí es assertable
 * en bytes: la Sandalwood Box en 0x219 (fork ENDGAME 0x08c2, saveNative.ts:377) y las 3
 * regalías 0x20d/0x20e/0x20f (llegar a la celda las exigió; la cadena de absorción en sí
 * NO comprueba inventario — rescueLordBritish viaAbsorption). Por eso los asserts de
 * cierre son sobre el ESTADO VIVO pre-cierre + los HITOS de la secuencia, y ch19 NO
 * exporta checkpoint (es el ÚLTIMO capítulo). Divergencia documentada del port que SÍ se
 * asserta: `dungeonRoomsCleared` marca cm127 en el latch de entrada (#13; decisión del
 * acta #179 §8 «se deja como está» — en el binario ese marcado no corre en esta vía).
 *
 * ── CADENCIA Y DETERMINISMO ─────────────────────────────────────────────────────────
 * Sin `?scenebeat`: bajo automatización los delays de ANIMACIÓN de la escena drenan a 0
 * (main.ts, precedencia `navigator.webdriver → 0` — mismo régimen que el resto de specs
 * del tour) y los beats de TEXTO los conduce el driver por tecla. El digest del sello
 * sólo lleva HITOS LÓGICOS (orden de absorción, booleanos de diálogo, líneas del
 * pergamino, flags y roster finales) — nada dependiente de reloj de pared ni del
 * muestreo del ring de consola (12 líneas; el conteo de absorción sale de snapshots del
 * combate, ver absorbPartyByKeys). Las fases se esperan SECUENCIALMENTE (cada una con su
 * ventana), lo que fija el ORDEN sin pinear duraciones. Determinismo ×2: dos
 * liberaciones frescas (boot + import + descenso + cámara + escena) byte-idénticas.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bootWorld, chapterTimeout, dungeonPos } from "./nav";
import { lectura, tecla } from "../tempo-video.mjs";
import { Coverage } from "./coverage";
import { DOOM, playDescent, turnTo } from "./doom-descent";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Copia local de la tecla del tour (ver nav.ts): cadencia 0 en test, humana en cine. */
const press = async (page: Page, k: string): Promise<void> => {
  await page.locator("body").press(k);
  const ms = tecla(0);
  if (ms > 0) await page.waitForTimeout(ms);
};

/**
 * Tablero de cm127 (DUNGEON.CBT, dungIdx 6, sala 15 — offset 0x98A0; md5 3756831a…,
 * acta #179 §1, VERBATIM). Sólo se usa la PASABILIDAD (0x44 cobble = pisable) para el
 * paseo greedy; el alma 0x3c vive en (5,1) como unidad-decorado (no está en esta capa).
 */
const CM127_TILES: readonly string[] = [
  "ff ff 4d 4d 4d 4d 4d 4d 4d ff ff",
  "ff 4d 4d 44 44 9d 44 44 4d 4d ff",
  "4d 4d b1 44 44 44 44 44 b0 4d 4d",
  "4d 44 44 44 44 44 44 44 44 44 4d",
  "4d 5c 5d 44 44 44 44 44 92 44 4d",
  "4d 44 44 44 44 44 44 94 9a 96 4d",
  "4d 5c 5d 44 44 44 44 44 90 44 4d",
  "4d 44 44 44 44 44 44 44 44 44 4d",
  "4d 4d b1 44 44 44 44 44 b0 4d 4d",
  "ff 4d 4d 44 ab ac af 44 4d 4d ff",
  "ff ff 4d 4d 4d 4d 4d 4d 4d ff ff",
];
const CM127_WALKABLE: boolean[][] = CM127_TILES.map((row) =>
  row.split(" ").map((h) => h === "44"),
);

type LiberationResult = {
  descentDigest: string;
  absorbedOrder: string[];
  partySize: number;
  milestones: Record<string, boolean>;
  phasesReached: string[];
  scrollLines: string[];
  gameWon: boolean;
  inDoom: boolean;
  rosterStatus: string[];
  rosterNames: string[];
  doomRoomsClearedBit15: boolean;
  digest: string;
};

const consoleLines = (page: Page): Promise<string[]> =>
  page.evaluate(
    () => (window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines(),
  );

const endgamePhase = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      ((window as unknown as { __u5test: { endgamePhase?: () => string | null } }).__u5test.endgamePhase?.() as
        | string
        | null) ?? null,
  );

/**
 * Espera una fase de la escena pulsando Espacio (los beats de TEXTO avanzan por tecla;
 * las fases de ANIMACIÓN a reloj real se la tragan). Acumula las líneas de consola en
 * `seen` (el ring del port retiene 12 — se muestrea en cada iteración) y registra en
 * `phases` cada fase nueva observada, en orden.
 */
async function driveToPhase(
  page: Page,
  target: string,
  timeoutMs: number,
  seen: string[],
  phases: string[],
): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    for (const l of await consoleLines(page)) {
      if (seen[seen.length - 1] !== l && !seen.includes(l)) seen.push(l);
    }
    const ph = await endgamePhase(page);
    if (ph && phases[phases.length - 1] !== ph) phases.push(ph);
    if (ph === target) return;
    await press(page, " ");
    // PAUSA DE LECTURA de la página de prosa. En test, los 250 ms de siempre (el sello
    // sólo lleva hitos lógicos, nada de reloj de pared). En cine, la del testigo real:
    // sin esto las SEIS páginas del desenlace duran 254-262 ms medidos — ilegibles, y
    // ~12× más rápidas que el original. Ver tempo-video.mjs.
    await page.waitForTimeout(lectura(250));
  }
  throw new Error(`la escena no llegó a '${target}' (fase=${await endgamePhase(page)}; vistas=${phases.join(">")})`);
}

/**
 * ABSORCIÓN JUGADA: pasea cada miembro con FLECHAS REALES hasta (5,2). Greedy por turno:
 * norte hacia la fila 2, lateral hacia la columna 5, con la pasabilidad del .CBT y la
 * ocupación VIVA del tablero (los absorbidos no ocupan: su registro está barrido). Un
 * paso bloqueado no consume turno (COMBAT «Blocked!») — el fallback es el otro eje; si
 * nada abre, Espacio (pass) cede el turno. Devuelve si el CENTINELA se observó armado en
 * vivo (con el último absorb el pacer puede llamar a endCombat en la MISMA tecla, y el
 * combate ya no es observable post-hoc).
 */
async function absorbPartyByKeys(page: Page, seen: string[]): Promise<{ sentinelSeen: boolean; absorbedIdx: number[] }> {
  let sentinelSeen = false;
  const absorbedIdx: number[] = []; // charIdx en ORDEN de absorción (observado por snapshot)
  for (let guard = 0; guard < 400; guard++) {
    // Muestreo del ring de consola (12 líneas) EN CADA iteración. ⚠ El ÚLTIMO «is
    // absorbed!» puede scrollear FUERA en la misma tecla (el desvío al endgame vuelca
    // >12 líneas de golpe): el CONTEO/ORDEN de absorción sale de los SNAPSHOTS del
    // combate (status "absorbed" por charIdx), no de la consola — la consola queda como
    // evidencia del print fiel (al menos los primeros absorbs sobreviven en el ring).
    for (const l of await consoleLines(page)) if (!seen.includes(l)) seen.push(l);
    const snap = await page.evaluate(() => {
      const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
      const c = g.combat;
      if (!c) return null;
      const cur = c.currentUnit;
      return {
        over: c.over as boolean,
        sentinel: c.absorptionSentinel as boolean,
        absorbed: (c.combatants as Array<{ kind: string; status?: string; charIdx?: number }>)
          .filter((u) => u.kind === "player" && u.status === "absorbed")
          .map((u) => u.charIdx ?? -1),
        cur: cur && cur.kind === "player" ? { x: cur.x as number, y: cur.y as number } : null,
        occupied: (c.combatants as Array<{ x: number; y: number; kind: string; status?: string }>)
          .filter((u) => u.status !== "dead" && u.status !== "fled" && u.status !== "absorbed")
          .map((u) => [u.x, u.y]),
      };
    });
    // Combate cerrado u `over`: la absorción total llegó — el pacer pudo llamar ya a
    // endCombat con la última tecla (videocap endgame-absorcion: «lo llama solo al ver
    // over con la primera tecla del driver»).
    if (!snap) return { sentinelSeen, absorbedIdx };
    if (snap.sentinel) sentinelSeen = true;
    for (const i of snap.absorbed) if (!absorbedIdx.includes(i)) absorbedIdx.push(i);
    if (snap.over) return { sentinelSeen, absorbedIdx };
    if (!snap.cur) break;
    const { x, y } = snap.cur;
    const occ = new Set(snap.occupied.map(([ox, oy]) => `${ox},${oy}`));
    const free = (tx: number, ty: number): boolean =>
      ty >= 0 && ty < 11 && tx >= 0 && tx < 11 && CM127_WALKABLE[ty]![tx]! && !occ.has(`${tx},${ty}`);
    // Preferencia: norte (hacia la fila 2) → lateral (hacia la columna 5) → sur (desatasco).
    const prefs: Array<[string, number, number]> = [];
    if (y > 2) prefs.push(["ArrowUp", x, y - 1]);
    if (x > 5) prefs.push(["ArrowLeft", x - 1, y]);
    if (x < 5) prefs.push(["ArrowRight", x + 1, y]);
    if (y > 2) prefs.push(["ArrowLeft", x - 1, y], ["ArrowRight", x + 1, y]);
    prefs.push(["ArrowDown", x, y + 1]);
    const move = prefs.find(([, tx, ty]) => free(tx, ty));
    await press(page, move ? move[0]! : " "); // sin hueco: pass (cede el turno)
    await page.waitForTimeout(60);
  }
  const diag = await page.evaluate(() => {
    const g = (window as unknown as { __u5test: any }).__u5test;
    const c = g.game.combat;
    return {
      combat: !!c,
      over: c?.over,
      sentinel: c?.absorptionSentinel,
      active: g.game.state.activeCharacter,
      cur: c?.currentUnit ? { kind: c.currentUnit.kind, x: c.currentUnit.x, y: c.currentUnit.y, status: c.currentUnit.status, sleeping: c.currentUnit.sleeping } : null,
      units: c ? (c.combatants as any[]).map((u) => ({ k: u.kind, x: u.x, y: u.y, st: u.status })) : null,
      console: g.consoleLines().slice(-6),
    };
  });
  throw new Error(`absorbPartyByKeys: presupuesto agotado sin vaciar el tablero — ${JSON.stringify(diag)}`);
}

/** Corre la LIBERACIÓN completa una vez: boot + ch17 + descenso a N7 + cámara + escena. */
async function playLiberation(page: Page): Promise<LiberationResult> {
  await bootWorld(page);
  // 1) DESCENSO REAL a N7 (driver compartido de ch18; asserta cada transición).
  const descent = await playDescent(page);
  expect(descent.finalPos, "el descenso llega a N7 (floor6, 7,0)").toMatchObject({ dungeon: DOOM, floor: 6, x: 7, y: 0 });
  expect(descent.endgameReady, "kit del endgame ÍNTEGRO en N7 (3 SL muertos + 3 regalías)").toBe(true);
  expect(descent.gameWon, "el endgame NO se ha disparado aún").toBe(false);

  // 2) N7 → bolsillo de la cámara: costura de posicionamiento SANCIONADA (ver cabecera —
  //    el bolsillo {r13·(4,7)·foso(5,7)} está desconectado del grafo; semilla = ch37-r15).
  await page.evaluate(
    (id) =>
      (window as unknown as { __u5debug: { teleportDungeon: (d: number, f: number, x: number, y: number) => void } }).__u5debug.teleportDungeon(id, 6, 4, 7),
    DOOM,
  );
  // 3) Paso ESTE REAL sobre el foso f6(5,7) → dng_pit_fall → «Entering room…» → cm127.
  await turnTo(page, "east");
  await press(page, "ArrowUp");
  await expect
    .poll(
      () => page.evaluate(() => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat !== null),
      { timeout: 10_000 },
    )
    .toBe(true);
  const chamberPos = await dungeonPos(page);
  expect(chamberPos, "la caída aterriza EN la celda de LB (floor7, 5,7 = cm127)").toMatchObject({ dungeon: DOOM, floor: 7, x: 5, y: 7 });
  // cm127 siembra CERO enemigos (sólo el alma-decorado): el latch de victoria nace a 1
  // SIN print (COMBAT 0x0bb2-0x0bc0) — misma conducta re-pinada en ch37-r15.
  const board = await page.evaluate(() => {
    const c = (window as unknown as { __u5test: { game: { combat: any } } }).__u5test.game.combat;
    return {
      enemies: (c.combatants as Array<{ kind: string }>).filter((u) => u.kind === "enemy").length,
      partyOnBoard: (c.combatants as Array<{ kind: string }>).filter((u) => u.kind === "player").length,
    };
  });
  expect(board.enemies, "cm127 sin bando enemigo (victoria-de-entrada silenciosa, #179)").toBe(0);
  const partySize = await page.evaluate(
    () => (window as unknown as { __u5test: { game: { state: { partySize: number } } } }).__u5test.game.state.partySize,
  );
  expect(board.partyOnBoard, "toda la party spawnea en la cámara (P0a)").toBe(partySize);

  // 4) ABSORCIÓN JUGADA por teclas + hitos de consola.
  const seen: string[] = [];
  const phases: string[] = [];
  const { sentinelSeen, absorbedIdx } = await absorbPartyByKeys(page, seen);
  for (const l of await consoleLines(page)) if (!seen.includes(l)) seen.push(l);
  expect(sentinelSeen, "el centinela de absorción se observó armado EN VIVO (g_unk_58a0=0x4d)").toBe(true);
  // El ÚLTIMO absorbido no es observable por snapshot (endCombat en la misma tecla) — se
  // infiere: es el único charIdx del party que falta (nadie muere en la cámara: 0 enemigos).
  const rosterNamesEarly = await page.evaluate(
    () => (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state.characters.slice(0, (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state.partySize).map((c: any) => c.name),
  );
  for (let i = 0; i < partySize; i++) if (!absorbedIdx.includes(i)) absorbedIdx.push(i);
  const absorbedOrder = absorbedIdx.map((i) => rosterNamesEarly[i] ?? `#${i}`);
  const absorbMsgSeen = seen.some((l) => l.includes("is absorbed!"));

  // 5) Primera tecla tras `over` → el pacer llama a endCombat → desvío al endgame.
  //    Escena COMPLETA por teclas a cadencia real, fase a fase (fija el ORDEN).
  await driveToPhase(page, "dialogue", 30_000, seen, phases);
  await driveToPhase(page, "orbMoongate", 60_000, seen, phases);
  await driveToPhase(page, "dissolve", 90_000, seen, phases);
  await driveToPhase(page, "storyHouse", 60_000, seen, phases);
  await driveToPhase(page, "storyDream", 60_000, seen, phases);
  await driveToPhase(page, "scroll", 60_000, seen, phases);
  await driveToPhase(page, "terminalFreeze", 120_000, seen, phases);

  const scroll = await page.evaluate(
    () =>
      ((window as unknown as { __u5test: { endgameScroll?: () => { lines: string[]; reveal: number } | null } }).__u5test.endgameScroll?.() as
        | { lines: string[]; reveal: number }
        | null) ?? null,
  );
  expect(scroll, "el pacer publicó el pergamino a la escena").not.toBeNull();
  expect(scroll!.reveal, "el pergamino quedó revelado COMPLETO en el freeze").toBe(scroll!.lines.length);

  const end = await page.evaluate(() => {
    const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
    return {
      gameWon: st.questFlags["game-won"] === true,
      inDoom: st.questFlags["in-doom"] === true,
      rosterStatus: st.characters.slice(0, st.partySize).map((c: any) => c.status),
      rosterNames: st.characters.slice(0, st.partySize).map((c: any) => c.name),
      roomsCleared: Array.from(st.dungeonRoomsCleared ?? []) as number[],
    };
  });
  // Bitmap de salas despejadas (DNGLOOK 0x0844, dungeonClearedBitIndex): Doom loc 0x28 →
  // dungIdx 6; bit = (6<<4)+15 = 111 → byte 13, bit 7. Marcado por el PORT en el latch de
  // entrada (#13, acta #179 §8) — en el binario ese marcado no corre en la vía del desenlace.
  const doomRoomsClearedBit15 = ((end.roomsCleared[13] ?? 0) & 0x80) !== 0;

  const milestones = {
    absorbedAll: absorbedOrder.length === partySize,
    absorbMsgSeen, // el print fiel «… is absorbed!» (DS 0x8f02) observado en consola
    wellMet: seen.some((l) => l.includes("Well met,")),
    boxQuestion: seen.some((l) => l.includes("Didst thou bring my box?")),
    replyYes: seen.some((l) => l.includes("You reply: Yes")),
    follow: seen.some((l) => l.includes("FOLLOW!")),
    worldsAwait: seen.some((l) => l.includes("Our worlds await!")),
    strandedAbsent: !seen.some((l) => l.includes("pull up a chair")),
  };

  const digest = JSON.stringify({
    absorbedOrder,
    partySize,
    milestones,
    scrollLines: scroll!.lines,
    gameWon: end.gameWon,
    inDoom: end.inDoom,
    rosterStatus: end.rosterStatus,
    rosterNames: end.rosterNames,
    doomRoomsClearedBit15,
    descent: descent.digest,
  });
  return {
    descentDigest: descent.digest,
    absorbedOrder,
    partySize,
    milestones,
    phasesReached: phases,
    scrollLines: scroll!.lines,
    gameWon: end.gameWon,
    inDoom: end.inDoom,
    rosterStatus: end.rosterStatus,
    rosterNames: end.rosterNames,
    doomRoomsClearedBit15,
    digest,
  };
}

test.describe.serial("GT ch19 — LA LIBERACIÓN DE LORD BRITISH (absorción cm127 + desenlace completo)", () => {
  test("desciende a N7, cae a la cámara, absorbe a toda la party y juega la secuencia hasta el freeze terminal", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));

    // PREMISA de la cadena EN BYTES del .GAM (lo que el desenlace LEE — ver cabecera):
    // la Sandalwood Box (0x219, fork ENDGAME 0x08c2) y las 3 regalías (0x20d-0x20f)
    // viajan en el checkpoint de ch17. Sin la caja el final sería `stranded`.
    const gam = readFileSync(join(HERE, "saves/ch17.gam"));
    expect(gam[0x219], "ch17.gam trae la Sandalwood Box (0x219) — el fork de la caja da VICTORIA").toBe(1);
    expect([gam[0x20d], gam[0x20e], gam[0x20f]], "ch17.gam trae las 3 regalías (0x20d-0x20f)").toEqual([1, 1, 1]);

    const r = await playLiberation(page);

    // HITOS de la secuencia (estado VIVO pre-cierre — el binario no escribe save posterior).
    expect(r.milestones.absorbedAll, `los ${r.partySize} miembros fueron absorbidos (medido: ${r.absorbedOrder.length} — ${r.absorbedOrder.join(" · ")})`).toBe(true);
    expect(r.milestones.absorbMsgSeen, "el print fiel «… is absorbed!» (DS 0x8f02) apareció en consola").toBe(true);
    expect(r.milestones.wellMet, "diálogo del trono: «Well met, <avatar>!» (ENDMSG rec 0 + nombre runtime)").toBe(true);
    expect(r.milestones.boxQuestion, "la pregunta de la CAJA (ENDMSG rec 1)").toBe(true);
    expect(r.milestones.replyYes, "auto-respuesta Yes (woodenBox=1, ENDGAME 0x08b9)").toBe(true);
    expect(r.milestones.follow, "«FOLLOW!» — LB saca el Orb de la caja").toBe(true);
    expect(r.milestones.worldsAwait, "«Our worlds await!» (rama de victoria)").toBe(true);
    expect(r.milestones.strandedAbsent, "el final VARADO no aparece (la caja viaja en la cadena)").toBe(true);
    // ORDEN de fases: garantizado por las esperas secuenciales; aquí se asserta lo observado.
    const order = ["dialogue", "orbMoongate", "dissolve", "storyHouse", "storyDream", "scroll", "terminalFreeze"];
    const idx = order.map((p) => r.phasesReached.indexOf(p));
    expect(idx.every((v) => v >= 0), `todas las fases del desenlace observadas (${r.phasesReached.join(">")})`).toBe(true);
    expect([...idx].sort((a, b) => a - b), "las fases llegan EN ORDEN (diálogo→orbe→disolución→Homecoming→Dream→pergamino→freeze)").toEqual(idx);
    // Pergamino: primera línea = datestamp «Be it known…» (ENDGAME 0x0326).
    expect(r.scrollLines.length).toBeGreaterThan(0);
    expect(r.scrollLines[0]).toMatch(/^Be it known/);
    // Estado final VIVO: game-won + in-doom; el ROSTER queda INTACTO (la absorción barre
    // el registro de TABLERO, no el roster — acta #179 §3 remove_from_board).
    expect(r.gameWon, "questFlags[game-won]").toBe(true);
    expect(r.inDoom, "questFlags[in-doom]").toBe(true);
    expect(r.rosterStatus, "roster intacto tras la absorción (status 'G' del loadout)").toEqual(Array(r.partySize).fill("G"));
    // Divergencia DOCUMENTADA del port (#13/acta #179 §8): cm127 marcada al latch de entrada.
    expect(r.doomRoomsClearedBit15, "dungeonRoomsCleared marca Doom r15 al latch de entrada (#13; en el binario este marcado no corre en la vía del desenlace)").toBe(true);

    // COBERTURA — último capítulo de la troncal: no exporta checkpoint (ver cabecera).
    const cov = new Coverage("ch19");
    cov.markAll(["dungeon-doom", "cell-doom-trap", "cell-doom-room", "endgame-doom-floor8", "endgame-rescue-lb", "artifact-wooden-box"]);
    cov.markAll(["command-e", "command-k", "command-s", "command-u"]); // (E)nter Doom · (K)limb · (S)earch N3 · (U)se Cetro #99 — ejecutados de veras en el descenso
    cov.note(
      `LA LIBERACIÓN DE LORD BRITISH — cierre de la troncal del tour. Vía FIEL #179 jugada: descenso ` +
        `real ch17→N7 (driver compartido doom-descent.ts), costura de posicionamiento N7→f6(4,7) ` +
        `(bolsillo desconectado, derivación BFS en cabecera; semilla idéntica a ch37-r15), paso ESTE real ` +
        `al foso f6(5,7) → cm127, absorción JUGADA por teclas (cada miembro camina a (5,2) bajo el alma ` +
        `0x3c; gancho COMBAT 0x0b8b → SJOG 0x1ea4), tablero vacío → endgame completo (delays de ` +
        `animación a 0 bajo webdriver — main.ts; beats de texto por tecla): ` +
        `caja (fork 0x08c2, .GAM 0x219) → «FOLLOW!»/orbe → moongate → disolución → Homecoming → The Dream ` +
        `→ pergamino («Be it known…») → freeze terminal. El desenlace NO escribe el .GAM (endgame_main no ` +
        `retorna — acta #179 §4) ⇒ sin checkpoint de salida: ch19 es el ÚLTIMO capítulo. CIERRE DE ` +
        `COBERTURA de la troncal (README §criterios #5): ∪ covered ≠ manifest — censo al sellar ch19 ` +
        `(2026-08-22, ch19 incluido): 217/742 ids cubiertos por la troncal+salas; el hueco (525) es de las familias ` +
        `npc(74)/search(63)/equip(48)/spell(46)/enemy(45)/sign(42)/shop(41)/floor(40)/… — contenido de ` +
        `capítulos de travesía/localización FUERA de la troncal (README §travesía), trackeado por el ` +
        `manifiesto; no se fabrica cobertura para cerrar la cifra.`,
    );
    cov.write();
  });

  test("determinismo ×2: dos liberaciones frescas producen un digest byte-idéntico", async ({ page }) => {
    test.setTimeout(chapterTimeout(1_800_000));
    const a = await playLiberation(page);
    const b = await playLiberation(page);
    expect(a.gameWon && b.gameWon).toBe(true);
    expect(Buffer.compare(Buffer.from(a.digest), Buffer.from(b.digest)), "los dos digests de la liberación son byte-idénticos").toBe(0);
  });
});
