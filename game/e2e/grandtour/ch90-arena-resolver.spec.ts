/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **CAPACIDAD-DE-ARNÉS** (tercera clase, propuesta al clasificar: ver la nota
 * `re/notes/censo-clases-specs-salas.md`). NO juzga la fidelidad del port: valida que
 * el ARNÉS (`nav.ts` / resolvedor) sabe ejecutar un mecanismo. Un rojo dice **«el arnés
 * se rompió»** — ni «el port cambió» ni «el port es infiel».
 * ──────────────────────────────────────────────────────────────────────────────────
 * VALIDACIÓN DEL RESOLVEDOR DE ARENA (brief-ch15 Entrega A · Opción P1).
 *
 * Prueba de CAPACIDAD (NO sella, NO encadena): valida `resolveArenaCombat` — el resolvedor
 * de arena CANÓNICO future-ready (nav.ts) — sobre un encuentro melé LIMPIO y determinista:
 * MELÉ + POSICIONAMIENTO (BFS de arena) + CIERRE. El código future-ready aterriza con esta
 * validación.
 *
 * POR QUÉ NO SOBRE UNA SALA DE DECEIT (re-decisión P1, sonda empírica citada): la sonda
 * destapó ANTES del spec que NINGUNA sala de Deceit (floors 0-2) es melé-ganable bajo la
 * semántica FIEL:
 *   · Room-2 (map 18, 4 Daemon): los daemons GATEAN (enemyFlags[38]=0x61/0x84, gatesInDaemon)
 *     → nº de enemigos crece SIN LÍMITE; el resolvedor future-ready (que NO controla a los
 *     poseídos, req (a)) no puede out-DPS → NUNCA converge. El artefacto archivado la ganaba
 *     SÓLO controlando a los poseídos para atacar — la infidelidad que el paquete de fidelidad
 *     (fiel/sword-chaos-2) elimina.
 *   · Room-1 (map 17): la party spawnea en un bolsillo sur SELLADO de los enemigos por un muro
 *     StoneBrickWall(79)+Portcullis(153, no transitable) en la fila y7 → melé IMPOSIBLE (jaula).
 *   · Room-0 (map 16): south starts todos en (0,0) = muro → degenerada.
 *
 * INSIGHT ESTRUCTURAL (el porqué de que req (a), posesión, sea de FASE 2): los ÚNICOS
 * poseedores (daemons) SIEMPRE gatean → cualquier sala que ejercite POSESIÓN es inherentemente
 * UNBOUNDED para un resolvedor melé. Por tanto el manejo de posesión NO es validable
 * deterministamente con melé; se valida en FASE 2 (targeting ranged/magic + aimGeometry
 * side-aware del paquete de fidelidad + over-by-bando). `resolveArenaCombat` YA lo tiene
 * ESTRUCTURALMENTE (arenaSnapshot clasifica a los poseídos como "other", no los controla) +
 * documentado; aquí se prueba la infra MELÉ, que es la reusable para travesías y #44.
 *
 * COSTURA DE ARNÉS (clase #47, declarada): (1) siembra ligera de la party (nivel/HP/stats lo
 * justo para victoria determinista sin bajas — no infla más de lo necesario); (2) arranque de
 * un combate CONTROLADO vía `game.startCombat(enemigo sintético, CampFire)` — MISMO camino que
 * la emboscada de camp (game.ts:4864 startCampAmbush), mueve QUIÉN/DÓNDE del combate sin
 * fabricar el contenido (arena, motor, RNG reales). Determinista bajo seed-0 → validación ×2.
 *
 * NOTA (encuentros en GRUPO, f19a2c0a): el resolvedor de encuentros FIEL spawnea el GRUPO
 * entero (rollEncounterGroup usa ENEMY_STATS.maxPerMap; p. ej. Bat=16) — comportamiento
 * correcto del juego. Eso rompió el supuesto «un solo enemigo» de este spec de capacidad
 * (16 bats out-actionan y ANIQUILAN a la party → sin VICTORY). El spec FUERZA maxPerMap=1
 * (count exacto=1, cero rand) para medir la capacidad MELÉ PURA del resolvedor, no la
 * supervivencia contra un enjambre — objetivo declarado del test desde su origen.
 */
import { test, expect, type Page } from "@playwright/test";
import { bootWorld, chapterTimeout, resolveArenaCombat } from "./nav";

/* eslint-disable @typescript-eslint/no-explicit-any */

test.describe.serial("arena-resolver — validación melé P1 (capacidad, no sella)", () => {
  test("resolveArenaCombat gana un encuentro melé limpio (VICTORY, cero bajas)", async ({ page }) => {
    test.setTimeout(chapterTimeout(180_000));
    await bootWorld(page); // arranque FRESCO: party inicial (Avatar/Shamino/Iolo, todos vivos).
    await page.evaluate(() => (window as any).__u5test.reseed(0));

    // Siembra + arranque del combate controlado (costura de arnés declarada arriba).
    const setup = await page.evaluate(() => {
      const w = window as any;
      const g = w.__u5test.game;
      const st = g.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (!c) continue;
        c.level = 12;
        c.currentHp = c.maxHp; // cura de entrada (no infla maxHp)
        c.strength = 40;
        c.dexterity = 40;
      }
      // Coloca la party sobre HIERBA (claro abierto, como combat.spec 102,43) → la arena
      // derivada del terreno (combatMapForTile) es un CAMPO ABIERTO donde el melé alcanza.
      w.__u5debug.teleportOverworld(102, 43);
      // Enemigo de estreno: Bat — melé (range 1), HP bajo, SIN gate/possess → fight bounded,
      // melé-alcanzable, ganable determinista. Elegido por NOMBRE (estable ante cambios de datos).
      const defs = g.combatResources.enemyDefs;
      const batIdx = defs.findIndex((d: any) => d.name === "Bat");
      const def = defs[batIdx];
      // FUERZA 1 enemigo (melé de CAPACIDAD, no supervivencia): los encuentros en GRUPO
      // (f19a2c0a, FIEL — rollEncounterGroup usa ENEMY_STATS.maxPerMap; Bat=16) rompieron el
      // supuesto «un solo enemigo» de este spec. maxPerMap=1 → count EXACTO=1
      // (encounters.ts:308, CERO rand tirado) → arena melé LIMPIA y determinista para medir
      // la capacidad del resolvedor, no la party vs 16 bats. Muta el def del boot (fresco/test).
      if (def) def.maxPerMap = 1;
      const enemy = { slot: 0, defIndex: batIdx, tile: def?.tile ?? 0, water: false, x: st.position.x, y: st.position.y };
      // Arena DERIVADA DEL TERRENO (hierba = campo abierto), no CampFire. Mismo `startCombat`
      // que la emboscada de camp (game.ts:4864); sin forzar combatMapIndex.
      g.startCombat(enemy, "east", { intro: "none", removeFromMap: false });
      return {
        batIdx,
        batName: def?.name,
        batHp: def?.hp,
        batRange: def?.attackRange,
        started: g.combat !== null,
        nEnemies: g.combat ? g.combat.combatants.filter((u: any) => u.kind === "enemy").length : 0,
      };
    });
    expect(setup.batName, "enemigo de estreno = Bat").toBe("Bat");
    expect(setup.started, "el combate controlado arrancó").toBe(true);
    expect(setup.nEnemies).toBeGreaterThan(0);

    // RESOLUCIÓN por el resolvedor canónico (teclas reales del handler de combate).
    const ended = await resolveArenaCombat(page, { maxRounds: 400 });
    expect(ended, "el combate terminó (no atasco)").toBe(true);

    // ÉXITO POR BANDO: VICTORY (bando monstruo vacío) + CERO bajas del bando PARTY.
    // NOTA (fidelidad): "VICTORY!" se anuncia al limpiar el bando enemigo (COMBAT:0x0cf6)
    // y el combate SIGUE — la party sale andando por el borde. El scrollback (12 líneas)
    // borra "VICTORY!" durante la salida (igual que el original), así que se comprueba
    // sobre el SNAPSHOT capturado por el resolvedor en el instante de la victoria.
    const result = await page.evaluate(() => {
      const g = (window as any).__u5test.game;
      const victoryLog = (window as any).__arenaVictoryLog ?? "";
      const tail = (window as any).__u5test.consoleLines().join("\n");
      // Tras endCombat, game.combat vuelve a null: la party salió del tablero.
      return { stillCombat: g.combat !== null, victoryLog, tail };
    });
    expect(result.stillCombat, "el combate cerró (game.combat = null)").toBe(false);
    expect(result.victoryLog, "VICTORY! anunciada al limpiar el bando enemigo").toMatch(/VICTORY!/i);
    expect(result.tail, "'Leave!' al salir de la arena").toMatch(/Leave!/i);

    // CERO bajas del bando party (invariante de la validación): ningún miembro murió.
    const partyDeaths = await page.evaluate(() => {
      const g = (window as any).__u5test.game;
      return g.state.characters.slice(0, g.state.partySize).filter((c: any) => c.status === "D").length;
    });
    expect(partyDeaths, "cero bajas del bando party").toBe(0);
  });
});
