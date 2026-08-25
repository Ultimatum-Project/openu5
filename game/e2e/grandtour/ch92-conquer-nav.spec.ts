/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **CAPACIDAD-DE-ARNÉS** (tercera clase, propuesta al clasificar: ver la nota
 * `re/notes/censo-clases-specs-salas.md`). NO juzga la fidelidad del port: valida que
 * el ARNÉS (`nav.ts` / resolvedor) sabe ejecutar un mecanismo. Un rojo dice **«el arnés
 * se rompió»** — ni «el port cambió» ni «el port es infiel».
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 1 (conquerRoom) — capa de NAVEGACIÓN: `conquerRoomAt` deep-linkea a una sala y la
 * conquista. Prueba: entra a Deceit por el fondo (ch15→(E)) y conquista la sala (7,5)
 * (combatmap 29, 2 Dragon + 9 Headless) navegando a la celda de aproximación (7,6) y
 * pisando la sala hacia el norte → conquerRoom(plates) → VICTORY. Es el ladrillo mecánico
 * que un capítulo por-mazmorra de la Fase 2 monta con una LISTA de {roomCell, approachDir}.
 *
 * NO toca ch16b (que sigue asertando el dead-end SIN placa hasta su reescritura, gated P0a).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, getPos, dungeonPos, conquerRoomAt } from "./nav";

const DECEIT = 33;
const DOOR = { x: 240, y: 73 } as const;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;
const press = (page: Page, k: string): Promise<void> => page.locator("body").press(k);

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

test.describe.serial("FASE 1 conquerRoom — capa de navegación (conquerRoomAt)", () => {
  test("conquerRoomAt navega a Deceit (7,5) y la GANA con placa (deep-link mecánico)", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page);
    await importCheckpoint(page, "ch15", { entryClock: { hour: 10, minute: 0 } });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    for (let i = 0; i < 4; i++) {
      const p = await getPos(page);
      if (p.x === DOOR.x && p.y === DOOR.y) break;
      await press(page, "ArrowUp");
    }
    await press(page, "e"); // (E)nter Deceit por el fondo → floor 7, (7,7), oeste
    const ds = await dungeonPos(page);
    expect(ds, "en el fondo de Deceit (7,7)").toMatchObject({ dungeon: DECEIT, floor: 7, x: 7, y: 7 });
    await seedLoadout(page);

    const verdict = await conquerRoomAt(page, {
      roomCell: { floor: 7, x: 7, y: 5 },
      approachDir: "north", // desde (7,6) hacia el norte a la sala
      maxRounds: 600,
    });
    expect(verdict.outcome, `veredicto jugado: ${verdict.digest}`).toBe("VICTORY");
    expect(verdict.enemiesAlive, "0 enemigos vivos").toBe(0);
  });
});
