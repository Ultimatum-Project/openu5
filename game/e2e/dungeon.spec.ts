/**
 * Journey E2E — mazmorra 3D (Task E2E-9).
 *
 * Ejercita el modo mazmorra de primera persona de Ultima V leyendo el layout
 * REAL de Deceit (assets/maps/dungeons.json) y las mecánicas exactas del núcleo
 * (core/dungeon/dungeon.ts, derivadas de DUNGEON.OVL/DNGLOOK.OVL en la Task 3.4).
 *
 * DISCRIMINADOR DE MODO — el "modo" NO vive en `GameState`. Igual que el combate
 * (`game.combat`, Task 8), la mazmorra vive en la instancia `Game`:
 * `game.dungeonState` es `null` en mundo/combate y un `DungeonState` dentro de la
 * mazmorra (game.ts:212). Además, al entrar por el overworld la posición del
 * mundo NO cambia (`enterDungeon` sólo crea `dungeonState`); `position.location`
 * sigue siendo 0 y la posición 3D vive en `game.dungeonState.pos`. Por eso las
 * asserts de mazmorra se leen por `window.__u5test.game.dungeonState`, no por el
 * helper `readState` (que sólo ve `GameState`).
 *
 * ENTRADA DETERMINISTA (por qué NO es flaky):
 *   - Deceit está en el overworld en (240,73), tile 0x18 "DoomEntrance"
 *     (walkable). Se llega por el sur desde (240,74) = 0x0E LeftHills2 (walkable).
 *   - El sello de Deceit exige la Word of Power FALLAX; en vez de conducir el
 *     panel de texto (frágil) se marca el flag `word-spoken:33` vía el hook — es
 *     el estado "palabra ya pronunciada", que `tryEnterDungeon` acepta directo.
 *   - Riesgo de encuentro al pisar la entrada: NULO de día. El gate de spawn
 *     (spawn.ts) rueda con la party sobre el tile DESTINO (0x18): threshold = 1
 *     (no es agua/pantano/montaña ni hay bonus nocturno con hour=10), y
 *     `spawn = threshold > rand(1,30)` es imposible con roll≥1. Igual dentro de
 *     `ignite()` (que tiquea el world-turn en loc 0 sobre ese mismo tile).
 *
 * LAYOUT de Deceit planta 0 (dungeons.json, celda = "tipo|sub" en nibbles):
 *        x0   x1   x2   x3   x4   x5   x6   x7
 *   y0:  B0   D0   B0   61   B0   00   B0   61
 *   y1:  B0  [10]  B0   B0   B0   61   B0   B0
 *   y2:  B0   00   B0   61   B0   B0   B0   61
 *   y3:  00   60   00   00   B0   20   B0   00
 *   y4:  B0   B1   B0   61   B0   D0   B0   61
 *   ...
 *   Tipos: B=muro, D=puerta secreta, 0=nada, 6=trampa, 1=escalera-arriba,
 *   2=escalera-abajo. La entrada es la escalera-arriba (10) en (1,1) — la busca
 *   `enterDungeon` escaneando la planta 0 — con facing inicial "south".
 *
 * RUTA ELEGIDA (columna x=1, la única transitable desde la entrada; sus vecinos
 * E/O son muro y el N es puerta secreta sin revelar):
 *   1. forward (sur): (1,1)→(1,2) "00" nada  → cambia posición (y 1→2).
 *   2. forward (sur): (1,2)→(1,3) "60" trampa sub0 = hoyo simple → mensaje
 *      "A pit." (decorativo, sin daño ni RNG — celda especial determinista).
 *   3. left: gira sur→este SIN mover (la posición queda en (1,3)).
 *   4. right + back + back: vuelve encarando sur a (1,2) y (1,1) por el pasillo.
 *   5. klimb sobre la escalera-arriba (1,1) en planta 0 → SALIR a Britannia
 *      (`exit-overworld`): `dungeonState` vuelve a null y `position.location` a 0.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, hudLog, readState } from "./helpers";

/** Snapshot de la posición 3D (o null si no estamos en mazmorra). */
async function dungeonPos(
  page: import("@playwright/test").Page,
): Promise<{ dungeon: number; floor: number; x: number; y: number; facing: string } | null> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ds = (window as any).__u5test.game.dungeonState;
    return ds ? { ...ds.pos } : null;
  });
}

const DECEIT = { loc: 0, x: 240, y: 74, hour: 10 }; // 1 al sur de la entrada (240,73)

test("entrar en Deceit, ignite, moverse en 3D y klimb de vuelta al overworld", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await gotoGame(page, DECEIT);

  // La palabra FALLAX ya pronunciada: el sello se abre al pisar la entrada sin
  // el panel de texto. (Estado legítimo: la mazmorra ya visitada.)
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.questFlags["word-spoken:33"] = true;
  });

  // ── 1. ENTRADA ────────────────────────────────────────────────────────────
  // Un paso al norte PISA (240,73) — el original NO auto-entra al pisar. Ya sobre
  // la entrada, (E)nter dispara enterDungeon(33) (game.enter → MAINOUT cmd_enter).
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("e");

  const entry = await dungeonPos(page);
  expect(entry).not.toBeNull();
  expect(entry!.dungeon).toBe(33); // Deceit
  expect(entry!.floor).toBe(0);
  expect(entry).toMatchObject({ x: 1, y: 1, facing: "south" });
  // La posición del MUNDO no cambia de modo (sigue en loc 0); el discriminador
  // es dungeonState, no GameState.
  expect(await readState<number>(page, "position.location")).toBe(0);

  // ── 2. IGNITE TORCH ───────────────────────────────────────────────────────
  // Asegura una antorcha y enciéndela. El "Torch ignited!" del port era FABRICADO
  // (purgado por la 8ª caza anti-fab; igniteTorch = éxito silencioso), así que se asevera
  // el EFECTO —el temporizador de luz arranca— en vez del string.
  await page.evaluate(() => {
    (window as unknown as { __u5test: { game: { state: { torches: number } } } }).__u5test.game.state.torches = 2;
  });
  await page.keyboard.press("i");
  expect(await readState<number>(page, "torchTurns")).toBeGreaterThan(0);

  // ── 3. MOVIMIENTO first-person: avanzar cambia posición ───────────────────
  await page.keyboard.press("ArrowUp"); // forward sur: (1,1)→(1,2)
  const step1 = await dungeonPos(page);
  expect(step1).toMatchObject({ x: 1, y: 2, facing: "south" });

  // ── 4. Celda especial determinista: hoyo simple en (1,3) ──────────────────
  await page.keyboard.press("ArrowUp"); // forward sur: (1,2)→(1,3) trampa 0x60
  const step2 = await dungeonPos(page);
  expect(step2).toMatchObject({ x: 1, y: 3, facing: "south" });
  expect((await hudLog(page, 8)).join("\n")).toMatch(/pit/i);

  // ── 5. Girar NO cambia posición, sólo el heading ──────────────────────────
  await page.keyboard.press("ArrowLeft"); // sur→este
  const turned = await dungeonPos(page);
  expect(turned).toMatchObject({ x: 1, y: 3, facing: "east" }); // misma celda
  expect(turned!.facing).not.toBe(step2!.facing);

  // ── 6. Volver por el pasillo y KLIMB de vuelta al overworld ───────────────
  await page.keyboard.press("ArrowRight"); // este→sur (reencarar el pasillo)
  await page.keyboard.press("ArrowDown"); // back (norte): (1,3)→(1,2)
  await page.keyboard.press("ArrowDown"); // back (norte): (1,2)→(1,1) escalera
  const atLadder = await dungeonPos(page);
  expect(atLadder).toMatchObject({ x: 1, y: 1, facing: "south" });

  await page.keyboard.press("k"); // klimb up en planta 0 → salir a Britannia
  expect(await dungeonPos(page)).toBeNull(); // ya no en mazmorra
  expect(await readState<number>(page, "position.location")).toBe(0); // overworld
  // Coordenadas de retorno EXACTAS (exitDungeonTo, dungeon-cmds.ts): al salir a
  // Britannia devuelve a (locationsX[32], locationsY[32]) = (240,73) EN CRUDO — la
  // entrada MISMA de Deceit, no la casilla de al lado. DUNGEON 0x1d10-0x1d1b escribe
  // las dos coordenadas de tabla ANTES del test de capa (0x1d25), y la ENTRADA exige
  // estar sobre esa misma celda (MAINOUT 0x07a8/0x07ae), así que salir devuelve a la
  // celda desde la que se entró. Este aserto fijaba un `+1` que el port se inventó;
  // adjudicado contra ASM en re/notes/britannia-y1-acta.md.
  expect(await readState<number>(page, "position.x")).toBe(240);
  expect(await readState<number>(page, "position.y")).toBe(73);
});
