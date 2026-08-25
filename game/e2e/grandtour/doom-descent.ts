/**
 * DESCENSO JUGABLE DE DOOM — módulo COMPARTIDO (extraído de ch18-doom-descent.spec.ts
 * para que ch19-endgame pueda REPRODUCIR el descenso sin importar un fichero .spec, lo
 * que registraría los tests de ch18 dentro del runner de ch19). Extracción PURA: la
 * ruta, el loadout y el driver son BYTE-IDÉNTICOS a los que sellaron ch18; ch18 los
 * re-importa de aquí y sus asserts/cobertura no se mueven.
 *
 * Derivación completa de la ruta y sus mecanismos: cabecera de ch18-doom-descent.spec.ts
 * (ruta física de 60 pasos de docs/guias/doom/gen-doom-ruta-v5.py; N1 spawn≠step-onto
 * MAINOUT 0x0790 + DUNGEON 0x0C76; sala #99 por Cetro+klimb-escape; sala #103 ranged;
 * corte en N7 floor6 (7,0)).
 */
import { expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { dungeonPos, dungeonKlimb, dungeonSearchAhead, resolveArenaCombat, resolveRoomSceptreDescend, type DPos } from "./nav";

export const DOOM_PREV_CHAPTER = "ch17";
export const DOOM = 40;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const GLASS_SWORD = 0x27;
const ARROWS = 0x1b;
const DN = 8;

type DFacing = "north" | "east" | "south" | "west";
const DCW: DFacing[] = ["north", "east", "south", "west"];

const press = (page: Page, k: string): Promise<void> => page.locator("body").press(k);
const inCombat = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat !== null);

/**
 * RUTA FÍSICA de 60 pasos (floor, x, y, how) — DERIVADA en docs/guias/doom/gen-doom-ruta-v5.py
 * (carril doom-walkthrough), NO re-derivada aquí. `how` codifica la acción para LLEGAR a esa
 * celda: walk/wrap = paso toroidal; search = revela la puerta secreta y cruza; ladder/ladder-up
 * = (K)limb; pitfall = pisa el foso (cae); enter-room = entra a la sala (combate); room-ladder =
 * resultado del klimb-escape de la sala previa; start/final = extremos.
 */
export const ROUTE: ReadonlyArray<readonly [number, number, number, string]> = [
  [0, 1, 1, "start"], [0, 1, 2, "walk"], [0, 1, 3, "walk"], [0, 2, 3, "walk"], [0, 3, 3, "walk"], [0, 3, 4, "walk"], [0, 3, 5, "walk"], [0, 2, 5, "walk"],
  [1, 2, 5, "ladder"], [1, 3, 5, "walk"], [1, 3, 4, "walk"], [1, 3, 3, "walk"], [1, 2, 3, "walk"], [1, 1, 3, "walk"],
  [2, 1, 3, "ladder"], [2, 2, 3, "walk"], [2, 3, 3, "walk"], [2, 3, 4, "search"], [2, 3, 5, "walk"], [2, 3, 6, "walk"], [2, 3, 7, "walk"], [2, 4, 7, "walk"], [2, 5, 7, "walk"], [2, 5, 0, "wrap"], [2, 5, 1, "enter-room"],
  [3, 5, 1, "room-ladder"],
  [4, 5, 1, "ladder"], [4, 4, 1, "walk"], [4, 3, 1, "walk"],
  [3, 3, 1, "ladder-up"], [3, 3, 0, "walk"], [3, 3, 7, "wrap"], [3, 2, 7, "walk"],
  [4, 1, 7, "pitfall"], [4, 0, 7, "walk"], [4, 7, 7, "wrap"], [4, 7, 0, "wrap"], [4, 7, 1, "walk"], [4, 7, 2, "walk"], [4, 7, 3, "walk"],
  [3, 7, 3, "ladder-up"], [3, 6, 3, "walk"], [3, 6, 4, "walk"], [3, 6, 5, "walk"],
  [4, 5, 5, "pitfall"],
  [5, 5, 5, "ladder"], [5, 5, 6, "walk"], [5, 4, 6, "walk"], [5, 3, 6, "walk"], [5, 2, 6, "walk"], [5, 1, 6, "walk"], [5, 1, 5, "walk"], [5, 1, 4, "walk"], [5, 1, 3, "walk"], [5, 0, 3, "walk"], [5, 7, 3, "enter-room"],
  [5, 7, 2, "walk"], [5, 7, 1, "walk"], [5, 7, 0, "walk"],
  [6, 7, 0, "ladder"],
  [7, 7, 0, "final"],
] as const;

/** Costura #47: LOADOUT del descenso (3 miembros vivos L8 + Magic Bow/Ring/flechas + luz). */
export async function seedDescentLoadout(page: Page): Promise<void> {
  await page.evaluate(
    ([bow, ring, glass, arrows]) => {
      const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (!c) continue;
        c.level = 8;
        c.maxHp = 240;
        c.currentHp = 240;
        c.strength = 30;
        c.dexterity = 30;
        c.intelligence = 30;
        c.status = "G"; // vivo (ch17.gam trae a Shamino MUERTO)
        c.weapon = bow; // Magic Bow readied (alcance 15)
        c.ring = ring; // Ring of Invisibility (inmune a posesión)
      }
      st.equipmentQuantities[arrows] = 99;
      st.equipmentQuantities[glass] = 99;
      // Luz para el (S)earch de la puerta secreta de N3 (In Lor/antorchas — costura declarada).
      st.lightSpellMins = 9999;
      st.torchTurns = 9999;
    },
    [MAGIC_BOW, RING_INVIS, GLASS_SWORD, ARROWS] as const,
  );
}

// ── Primitivas de la vista 3D (locales — el driver de la ruta es Doom-específico) ────────────
export function facingToward(x: number, y: number, nx: number, ny: number): DFacing {
  let dx = nx - x, dy = ny - y;
  if (dx > 1) dx -= DN;
  if (dx < -1) dx += DN;
  if (dy > 1) dy -= DN;
  if (dy < -1) dy += DN;
  if (dy === -1) return "north";
  if (dy === 1) return "south";
  if (dx === -1) return "west";
  return "east";
}
export async function turnTo(page: Page, target: DFacing): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const p = await dungeonPos(page);
    if (!p || p.facing === target) return;
    const right = (DCW.indexOf(target) - DCW.indexOf(p.facing as DFacing) + 4) % 4;
    await press(page, right <= 2 ? "ArrowRight" : "ArrowLeft");
  }
}
/** Encara (nx,ny) adyacente (wrap toroidal) y avanza un paso. */
export async function stepTo(page: Page, nx: number, ny: number): Promise<void> {
  const cur = await dungeonPos(page);
  if (!cur) throw new Error("stepTo: fuera de mazmorra");
  await turnTo(page, facingToward(cur.x, cur.y, nx, ny));
  await press(page, "ArrowUp");
}

export interface DescentResult {
  finalPos: DPos | null;
  room99Descend: boolean;
  room103Won: boolean;
  pitfalls: number;
  partyHp: number[];
  gameWon: boolean;
  /** endgameReady (3 SL muertos + 3 regalías) EN el punto de corte: prueba que el corte es
   *  POSICIONAL — el kit está intacto. (#179: pisar floor7 ya NO dispara nada — el desenlace
   *  exige caer a la celda (5,7) y ser absorbido — el corte en N7 sigue valiendo.) */
  endgameReady: boolean;
  /** Tipo de celda de mazmorra bajo la party en N7 (3 = escalera doble abajo/arriba). */
  finalCellType: number;
  digest: string;
}

/**
 * Conduce la RUTA de 60 pasos hasta N7 (floor6, celda (7,0)) — el umbral del fondo, JUSTO antes
 * del disparo del endgame. Juega la sala #99 por klimb-descend y la #103 por el resolvedor ranged.
 * Asevera la planta esperada en cada transición (escalera/foso/sala) → un descenso roto falla ruidoso.
 */
export async function descendDoom(page: Page): Promise<DescentResult> {
  let room99Descend = false;
  let room103Won = false;
  let pitfalls = 0;
  const trail: string[] = [];

  for (let i = 0; i < ROUTE.length; i++) {
    const [f, x, y, how] = ROUTE[i]!;
    if (how === "start") {
      // La party APARECE en (1,1) sin combate (spawn ≠ step-onto). No se fuerza la sala #96.
      const p = await dungeonPos(page);
      expect(p, "N1: la party aparece en la cima de Doom (floor0, 1,1)").toMatchObject({ floor: 0, x: 1, y: 1 });
      expect(
        await inCombat(page),
        "spawn en Doom NO dispara combate — FIEL por MAINOUT `enter_dungeon` 0x0790 (COLOCA la party " +
          "en (1,1) sin llamar a on_enter) + DUNGEON `dng_on_enter_cell` 0x0C76 → dng_enter_room @0x0d40 " +
          "(la sala entra por LLEGADA-A-CELDA del bucle de turno, no por colocación)",
      ).toBe(false);
    } else if (how === "walk" || how === "wrap") {
      await stepTo(page, x, y);
      const p = await dungeonPos(page);
      expect(p, `paso ${i} → (${f},${x},${y})`).toMatchObject({ floor: f, x, y });
    } else if (how === "search") {
      const cur = await dungeonPos(page);
      if (cur) {
        await turnTo(page, facingToward(cur.x, cur.y, x, y));
        // (S)earch AHEAD contestando la cadena interactiva (Player:→Enter + Dir-Ahead↑, 715f3694):
        // el `press('s')` suelto dejaba la cadena ABIERTA → la puerta secreta quedaba irrevelable
        // → el cruce a la celda fallaba (party atascada en la celda previa).
        await dungeonSearchAhead(page); // revela la puerta secreta (requiere luz)
      }
      await stepTo(page, x, y);
      expect(await dungeonPos(page), `search+cruce → (${f},${x},${y})`).toMatchObject({ floor: f, x, y });
    } else if (how === "ladder") {
      await dungeonKlimb(page, "down");
      expect(await dungeonPos(page), `escalera-abajo → floor ${f}`).toMatchObject({ floor: f });
    } else if (how === "ladder-up") {
      await dungeonKlimb(page, "up");
      expect(await dungeonPos(page), `escalera-arriba → floor ${f}`).toMatchObject({ floor: f });
    } else if (how === "pitfall") {
      const cur = await dungeonPos(page);
      if (cur) {
        await turnTo(page, facingToward(cur.x, cur.y, x, y));
        await press(page, "ArrowUp"); // pisa el foso → cae
      }
      pitfalls++;
      expect(await dungeonPos(page), `foso → floor ${f}`).toMatchObject({ floor: f });
    } else if (how === "enter-room") {
      const next = ROUTE[i + 1];
      const cur = await dungeonPos(page);
      if (cur) {
        await turnTo(page, facingToward(cur.x, cur.y, x, y));
        await press(page, "ArrowUp"); // entra a la sala → combate
      }
      if (next && next[3] === "room-ladder") {
        // Sala #99 (N3): bajo el spawn FIEL (P0a opposite-of-facing) la party entra hacia el sur →
        // spawn NORTE, y la fila y5 de cm115 es muro salvo la barrera ShadowlordBoundary 0x71 en
        // (5,5) que SELLA el bolsillo de la escalera interior (5,7). Descenso FIEL = (U)se Cetro
        // disuelve la barrera → klimb-escape (dato humano confirmado). El Cetro viene de ch17 (las
        // 3 regalías del umbral). El viejo klimb-descend directo era ARTEFACTO del hardcode "south".
        const ok = await resolveRoomSceptreDescend(page, { dir: "down", maxRounds: 600 });
        expect(ok, "sala #99: (U)se Cetro + klimb-descend cerró el combate").toBe(true);
        expect(await dungeonPos(page), "sala #99 → desciende a N4 (floor3)").toMatchObject({ floor: next[0] });
        room99Descend = true;
        i++; // consume la entrada "room-ladder" (es el RESULTADO del klimb-escape)
      } else {
        // Sala #103 (N6): ganable con el resolvedor ranged; se limpia y se sigue por la escalera de piso.
        expect(await inCombat(page), `sala @(${x},${y}) disparó combate`).toBe(true);
        const won = await resolveArenaCombat(page, { maxRounds: 400 });
        expect(won, `sala @(${x},${y}): el resolvedor ranged la GANÓ`).toBe(true);
        room103Won = true;
      }
    } else if (how === "final") {
      // CORTE LIMPIO: el siguiente (K)limb bajaría a floor7 (#179: ya sin auto-trigger —
      // el endgame exige la celda cm127; ch17 lo cubre por su costura). Se sella en N7
      // (floor6, 7,0), a un paso del fondo.
      break;
    }
    trail.push(`${how}:${JSON.stringify(await dungeonPos(page))}`);
  }

  const end = await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    const st = g.state;
    const p = g.dungeonState?.pos;
    // endgameReady (lordbritish.ts:139): 3 Shadowlords muertos + 3 regalías. Se comprueba por
    // su DEFINICIÓN (no se toca el save) para probar que el corte es sólo posicional.
    const slDead = ["falsehood", "hatred", "cowardice"].every((s) => st.questFlags[`shadowlord-dead:${s}`] === true);
    const regalia = !!st.lbArtifacts?.amulet && !!st.lbArtifacts?.crown && !!st.lbArtifacts?.sceptre;
    return {
      partyHp: st.characters.slice(0, st.partySize).map((c: any) => c.currentHp),
      partyStatus: st.characters.slice(0, st.partySize).map((c: any) => c.status),
      gameWon: st.questFlags["game-won"] === true,
      roomsCleared: (st.dungeonRoomsCleared ?? []).slice(),
      endgameReady: slDead && regalia,
      finalCellType: p ? g.dungeonState.cellAt(p.floor, p.x, p.y).type : -1,
    };
  });
  const finalPos = await dungeonPos(page);
  const digest = JSON.stringify({ finalPos, room99Descend, room103Won, pitfalls, ...end, trail });
  return { finalPos, room99Descend, room103Won, pitfalls, partyHp: end.partyHp, gameWon: end.gameWon, endgameReady: end.endgameReady, finalCellType: end.finalCellType, digest };
}

/** Secuencia canónica: import ch17 + loadout + reseed(0) + (E) a Doom + descenso hasta N7. */
export async function playDescent(page: Page): Promise<DescentResult> {
  await importCheckpoint(page, DOOM_PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  // Reset de arnés: loadNativeSave restaura state.position pero NO cierra una sesión de mazmorra/
  // combate previa (el ×2 corre dos descensos en la MISMA página) → limpia la sesión 3D anterior
  // para que (E) arranque un Doom fresco. Test-only, cero efecto en un descenso único.
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { dungeonState: unknown; combat: unknown } } }).__u5test.game;
    g.dungeonState = null;
    g.combat = null;
  });
  await seedDescentLoadout(page);
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  // (E)nter REAL sobre Doom (sello ya abierto por VERAMOCOR en ch17; 3 SL muertos → sin emboscada).
  await press(page, "e");
  const ds = await dungeonPos(page);
  expect(ds, "(E) desde el umbral de ch17 desciende a Doom por la cima").toMatchObject({ dungeon: DOOM, floor: 0 });
  return descendDoom(page);
}
