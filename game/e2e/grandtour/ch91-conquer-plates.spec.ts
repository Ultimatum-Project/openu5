/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **CAPACIDAD-DE-ARNÉS** (tercera clase, propuesta al clasificar: ver la nota
 * `re/notes/censo-clases-specs-salas.md`). NO juzga la fidelidad del port: valida que
 * el ARNÉS (`nav.ts` / resolvedor) sabe ejecutar un mecanismo. Un rojo dice **«el arnés
 * se rompió»** — ni «el port cambió» ni «el port es infiel».
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 1 (conquerRoom) — PRUEBA E2E de la capacidad de PLACA en el arnés (nav.ts).
 *
 * La MISMA sala que ch16b declaraba INGANABLE (sello RETIRADO el 2026-07-26: era FABRICADO —
 * ch16b la juega ahora con `plates:true` y la GANA; ver re/notes/ch16b-dead-end-fabricado.md) (Deceit fondo, floor 7, (7,5) = combatmap 29,
 * 2 Dragon + 9 Headless sellados tras muro 0x4F) se GANA cuando el resolver usa
 * `resolveArenaCombat(page, { plates: true })`: al atascarse (Headless sin LOS ni ruta),
 * va a PISAR la placa (5,5), el muro 0x4F→0x44 desella el bolsillo (COMBAT 0x111A) y la
 * party remata. Demuestra e2e que el "dead-end" de ch16b es artefacto del RESOLVER (no del
 * binario) — NO toca ch16b, que sigue asertando el dead-end SIN placa hasta su reescritura
 * (gated en P0a). Este es el ladrillo que consumen los capítulos de la Fase 2.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, getPos, dungeonPos, conquerRoom, type DPos } from "./nav";

const PREV_CHAPTER = "ch15";
const DECEIT = 33;
const DOOR = { x: 240, y: 73 } as const;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;
const DN = 8;

type DFacing = "north" | "east" | "south" | "west";
const DCW: DFacing[] = ["north", "east", "south", "west"];
const press = (page: Page, k: string): Promise<void> => page.locator("body").press(k);
const inCombat = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat !== null);

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
async function enterDeceitBottom(page: Page): Promise<DPos> {
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  for (let i = 0; i < 4; i++) {
    const p = await getPos(page);
    if (p.x === DOOR.x && p.y === DOOR.y) break;
    await press(page, "ArrowUp");
  }
  await press(page, "e");
  return (await dungeonPos(page))!;
}

test.describe.serial("FASE 1 conquerRoom — la placa desella #29 (Deceit) e2e", () => {
  test("combatmap 29 se GANA con resolveArenaCombat({plates:true}) — el dead-end de ch16b era del resolver", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page);
    const ds = await enterDeceitBottom(page);
    expect(ds, "en el fondo de Deceit (7,7)").toMatchObject({ dungeon: DECEIT, floor: 7, x: 7, y: 7 });
    await seedLoadout(page);

    await dungeonStep(page, 7, 6);
    await dungeonStep(page, 7, 5); // pisa (7,5) → combate de sala (combatmap 29)
    expect(await inCombat(page), "combate de sala disparado").toBe(true);

    const before = await page.evaluate(() => {
      const c = (window as unknown as { __u5test: { game: { combat: any } } }).__u5test.game.combat;
      const es = c.combatants.filter((u: any) => u.kind === "enemy");
      const byName: Record<string, number> = {};
      for (const e of es) byName[e.enemyDef?.name ?? "?"] = (byName[e.enemyDef?.name ?? "?"] ?? 0) + 1;
      return { total: es.length, byName };
    });
    expect(before.byName["Dragon"], "2 Dragon").toBe(2);
    expect(before.byName["Headless"], "9 Headless (sellados)").toBe(9);

    // El arnés conquerRoom (plates ON) pisa (5,5), abre el muro y remata → VICTORY.
    const verdict = await conquerRoom(page, { maxRounds: 600 });
    expect(verdict.outcome, `veredicto jugado: ${verdict.digest}`).toBe("VICTORY");
    expect(verdict.enemiesAlive, "0 enemigos vivos (los 9 Headless desellados y rematados)").toBe(0);
  });
});
