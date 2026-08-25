/**
 * (B)oard sobre CABALLO CON DUEÑO — «"Nay!"» — CMDS.OVL 0x07F6 (#130, sapo nº1 de #120).
 *
 * EL ORIGINAL (CMDS 0x0818-0x0861):
 * ```
 * 0818  al = find_object_at_xy(g_party_x, g_party_y, g_floor)   ; TILE DEL OBJETO bajo el party
 * 082c  [bp-4] = g_cmb_scratch_x                                ; ...y su índice de objeto
 * 0832  and al,0xfe / cmp al,0x10 / jne                         ; ¿es caballo? (0x10/0x11)
 * 083b  cmp [g_location],0 / je 0x862                           ; sólo en PUEBLO
 * 0842  push [bp-4] / call find_npc_by_objIdx / cmp ax,0xffff / je 0x862
 * 0850  bx = idx << 4                                           ; g_npc_rt, stride 0x10
 * 0856  cmp word ptr [bx + 0x5f68], 0 / je 0x862                ; ★ el campo +0x0A
 * 085d  ax = 0x425e ; jmp 0x80d                                 ; print + return 1 = DENEGADO
 * ```
 * `DATA.OVL` fileoff 0x426e = `b'"Nay!"\n'` — CON las comillas literales y el `\n`.
 *
 * ★ QUÉ ES EL CAMPO, derivado y no supuesto: `g_npc_rt` vive en DS 0x5F5E, 32 registros de
 * 16 B, y +0x0A es el **dialogNumber** (re/notes/npc.md §0.4; re/notes/shadowlord-urban.md
 * lo nombra explícitamente). NO es un «índice de dueño»: se carga por NPC del tercer bloque
 * del .NPC (32 B en +0x220, NPC.OVL 0x0090-0x00ad), lo pone a 0 el despawn (TOWN 0x00d3) y
 * lo pisan con centinelas 0xFE/0xFD la posesión del Shadowlord y la alarma de arresto. O
 * sea: la guarda del (B)oard es «este caballo TIENE NÚMERO DE DIÁLOGO», es decir es de
 * alguien, no un caballo suelto. El port ya modela ese campo como `NpcRuntime.dialogNumber`
 * y ya escribe los mismos 0xFE/0xFD en los mismos dos sitios.
 *
 * ★ CONTROL POSITIVO EN LOS PROPIOS DATOS DEL PORT: de los 20 caballos de pueblo de
 * `assets/npcs.json` (type & 0xFE == 0x10), DIECINUEVE tienen dialogNumber 0 y EXACTAMENTE
 * UNO no —location 13, slot 4, dialogNumber 13—. La rama existe para un solo caballo del
 * juego entero, que es justo lo que la hacía fácil de dejar muerta.
 *
 * ⚠ LO QUE ESTOS TESTS **NO** AFIRMAN: que la rama sea alcanzable JUGANDO. No lo es todavía
 * — ver §7 del acta: (A) los caballos-NPC del port se dibujan como ENTIDADES y no están en
 * ninguna de las dos capas de mundo que `Game.board()` consulta (#137 arregló la capa que se
 * lee —banco alto en vez de terreno— pero no metió a los NPC en ella), y (B) `game.ts:1045`
 * impide al party pisar la casilla de un NPC.
 * Estos tests colocan el estado a mano y sellan EL CABLEADO (que el flag sale del NPC real y
 * no de un default), no el camino de teclado.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ACTOR_TILE_BANK, Game, type GameData } from "../src/core/game.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { board, TILE_FOOT } from "../src/core/world/transport.js";
import type { SmallMapFloor, SmallMapLocation, WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const initial = load<ExtractedInitialState>("../assets/initial-state.json");

/** El texto VERBATIM de DATA.OVL fileoff 0x426e. */
const NAY = '"Nay!"\n';

const LOC = 13; // el pueblo del único caballo con dueño del juego
const HX = 5, HY = 5; // casilla del caballo en este mapa sintético

function world(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 4));
  // #137 · el byte del registro de objeto es 0x10; el canal de mundo del port guarda el
  // tile COMPLETO del banco alto, 0x110 `HorseRight` (el 0x10 pelado es el TERRENO `Hut`,
  // y el arnés viejo se apoyaba justamente en esa colisión para que el (B)oard picara).
  tiles[HY]![HX] = 0x10 + ACTOR_TILE_BANK; // caballo mirando a un lado
  const floor: SmallMapFloor = { z: 0, tiles };
  const smallMaps = new Map<number, SmallMapLocation>();
  smallMaps.set(LOC, { id: LOC, name: "Test", floors: [floor] });
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 4));
  return { overworld, underworld: overworld, smallMaps };
}
const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

/** Un caballo (type 0x10) en (HX,HY) con el dialogNumber pedido. */
function horseSlot(dialogNumber: number): NpcSlot {
  return {
    slot: 4,
    aiTypes: [1, 1, 1],
    x: [HX, HX, HX],
    y: [HY, HY, HY],
    z: [0, 0, 0],
    times: [0, 0, 0, 0],
    type: 0x10,
    dialogNumber,
  };
}

/** Party EN LA CASILLA del caballo, a pie, dentro del pueblo. */
function gameConCaballo(dialogNumber: number, npcX = HX, npcY = HY): { game: Game; state: GameState } {
  const slot = { ...horseSlot(dialogNumber), x: [npcX, npcX, npcX] as [number, number, number], y: [npcY, npcY, npcY] as [number, number, number] };
  const state = createNewGame(initial);
  state.position = { location: LOC, floor: 0, x: HX, y: HY };
  state.transportTile = TILE_FOOT;
  const npcManager = new NpcManager({ [LOC]: [slot] });
  const game = new Game(initial, world(), gameData, state, { npcManager });
  return { game, state };
}

describe("capa 1+2 — el TEXTO (DATA.OVL fileoff 0x426e)", () => {
  it("★ «\"Nay!\"» sale CON comillas y con \\n", () => {
    const st = createNewGame(initial);
    expect(board(st, 0x10, TILE_FOOT, true), "0x085d ax=0x425e → DS 0x425e = fileoff 0x426e = b'\"Nay!\"\\n'").toEqual({
      ok: false,
      message: NAY,
    });
  });

  it("el rechazo va ANTES del gate a pie (0x0856 precede a 0x0862)", () => {
    // Control de ORDEN: montado + caballo con dueño ⇒ manda «Nay!», no «On foot».
    const st = createNewGame(initial);
    expect(board(st, 0x10, 0x12, true).message, "0x0856 está antes de la llamada a 0x6EE").toBe(NAY);
    expect(board(st, 0x10, 0x12, false).message, "sin dueño sí llega al gate a pie").toBe("On foot");
  });
});

describe("capa 3 — el CABLEADO (Game.board, no la función pura)", () => {
  it("★ caballo CON dialogNumber ≠ 0 bajo el party ⇒ «\"Nay!\"» y NO se monta", () => {
    const { game, state } = gameConCaballo(13); // el caso real: loc 13 slot 4
    const texts = game.board().filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts, "0x0856 cmp [bx+0x5f68],0 ⇒ jne ⇒ denegado").toContain(NAY);
    expect(state.transportTile, "sigue a pie: el (B)oard devolvió 1 sin tocar g_transport_tile").toBe(TILE_FOOT);
  });

  it("★ CONTROL POSITIVO: el MISMO caballo con dialogNumber 0 SÍ se monta", () => {
    // Sin este caso, un `horseOwned` cableado a `true` fijo pasaría el test de arriba.
    const { game, state } = gameConCaballo(0);
    const texts = game.board().filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts, "0x085b je 0x862 ⇒ abordaje normal").toContain("horse");
    expect(texts, "y no dice Nay").not.toContain(NAY);
    expect(state.transportTile, "0x0870-0x0875: g_transport_tile = tile + 2").toBe(0x12);
  });

  it("★ el flag sale del NPC de ESTA casilla, no de «hay algún caballo con dueño»", () => {
    // El caballo con dueño está en OTRA casilla; bajo el party no hay NPC.
    // Sin este caso, un cableado que barriera la location entera pasaría igual.
    const { game, state } = gameConCaballo(13, HX + 3, HY + 3);
    const texts = game.board().filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts, "find_npc_by_objIdx es del objeto BAJO el party (0x0842)").toContain("horse");
    expect(state.transportTile).toBe(0x12);
  });
});
