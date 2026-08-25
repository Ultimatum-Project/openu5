/**
 * LOTE #133 — tres fixes calcados del capítulo de huérfanos, cada uno con su seña exacta.
 *
 * (1) ODD KEY — `apply_item_grant` SJOG.OVL 0x1568-0x15c5. El cmp tiene DOS lados y el
 *     port sólo portaba el bajo:
 *     ```
 *     1568  cmp [bp+6], 0x7f / jle 0x158e     ; ★ el lado que faltaba
 *     156e  and [bp+6], 0x7f                  ;   limpia el bit y sigue con la CUENTA
 *     1573  print_int([bp+6], 1, 0x20)
 *     1581  print DS 0x8caa                   ; ' odd key'
 *     158e  print_int(...) / print DS 0x8cb4  ; ' key'   ← el único lado portado
 *     15b1  cmp [bp+6],1 / jne → DS 0x8cbe    ; 's!\n'   ★ singular/plural DE VERDAD:
 *           si no → DS 0x8cba                 ; '!\n'      son dos cadenas distintas
 *     ```
 *     Alcanzabilidad: UN objeto del juego, {id:7, quality:0x85} en Trinsic ⇒ original
 *     «5 odd keys!», port «5 keys!».
 *     ⚠ Y el bit tenía que LLEGAR: `applySearchGrant` devuelve la cuenta YA enmascarada,
 *     así que el (G)et nombraba con 5 y nunca con 0x85. En el binario [bp+6] es UN SOLO
 *     valor que la rutina enmascara por dentro — por eso el call-site pasa `quality`.
 *
 * (2) BOARDED! — CAST.OVL 0x1862-0x1890. `useMagicCarpet` modelaba el flujo entero y
 *     ENMUDECÍA justo en la rama de éxito, que es el camino normal:
 *     ```
 *     1862  print DS 0x48bf ('Carpet\n\n')
 *     1869  cmp [g_location],0x21 / jae      ; mazmorra
 *     187f  cmp byte [bx], 0xc / je          ; tile bajo el party (ver acta §4)
 *     1884  cmp [g_transport_tile],0x1c / jne
 *     188b  print DS 0x48c8 ('Boarded!\n')   ; ★ el que faltaba
 *     ```
 *
 * (3) ★ PIT TRUNCADO — SJOG.OVL 0x077c. El original hace `mov ax,0x8786 / jmp` a la cola
 *     de impresión común, y DS 0x8786 es la cadena ENTERA `'Nothing hidden\nin the pit.\n'`.
 *     El port emitía sólo `'in the pit.'` — LA COLA tras el `\n`, perdiendo la cabeza — y
 *     el comentario del propio fichero CONSAGRABA el recorte como fiel. Sapo + prosa
 *     auto-fiel a la vez.
 *     HERMANO de la misma familia «mitad del par», mismo switch: el muro especial de
 *     variante 3 hace DOS prints seguidos —0x0868 DS 0x88c8 `'Nothing hidden on the
 *     skeleton.\n'` y 0x086f DS 0x88ea `'It crumbles away.\n'`— y el port emitía sólo el
 *     segundo.
 *
 * Convención del fichero de mazmorra: los mensajes van SIN el `\n` final del pool (lo
 * pone el impresor); el `\n` INTERIOR del pit sí es del texto y se conserva.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  DungeonState,
  wallVariant,
  CellType,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";
import { lootItemName } from "../src/core/world/commands.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
const initial = load<ExtractedInitialState>("../assets/initial-state.json");
function freshState(): GameState {
  return createNewGame(initial);
}

// ───────────────────────────── (1) odd key ─────────────────────────────

describe("(1) odd key — los DOS lados del cmp (SJOG 0x1568/0x158e)", () => {
  it("★ el lado ALTO (bit 0x80): «5 odd keys!» — el caso de Trinsic", () => {
    // El objeto real del juego: {id:7, quality:0x85} ⇒ 0x85 > 0x7f ⇒ ' odd key', y la
    // cuenta es 0x85 & 0x7f = 5 ⇒ plural.
    expect(lootItemName(7, 0x85), "0x1568 jle NO salta ⇒ DS 0x8caa + DS 0x8cbe").toBe("5 odd keys!");
  });

  it("★ el lado alto en SINGULAR: «1 odd key!»", () => {
    // Control del segundo cmp: 0x15b1 compara la cuenta YA enmascarada contra 1.
    expect(lootItemName(7, 0x81), "0x156e deja 1 ⇒ DS 0x8caa + DS 0x8cba").toBe("1 odd key!");
  });

  it("CONTROL POSITIVO: el lado bajo NO cambia", () => {
    // Sin esto, «poner siempre odd» pasaría los dos casos de arriba.
    expect(lootItemName(7, 5), "0x158e ⇒ DS 0x8cb4 + DS 0x8cbe").toBe("5 keys!");
    expect(lootItemName(7, 1), "0x158e ⇒ DS 0x8cb4 + DS 0x8cba").toBe("1 key!");
  });

  it("el umbral es 0x7f, no 0x80 ni «≥128»", () => {
    expect(lootItemName(7, 0x7f), "0x7f todavía es jle ⇒ lado bajo").toBe("127 keys!");
    expect(lootItemName(7, 0x80), "0x80 ya no ⇒ lado alto, cuenta 0").toBe("0 odd keys!");
  });
});

// ───────────────────────────── (2) Boarded! ─────────────────────────────

describe("(2) Boarded! — la rama de éxito era MUDA (CAST 0x188b)", () => {
  function world(): WorldData {
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 4));
    return { overworld, underworld: overworld, smallMaps: new Map<number, SmallMapLocation>() };
  }
  const gameData: GameData = {
    locationsX: Array.from({ length: 32 }, () => 250),
    locationsY: Array.from({ length: 32 }, () => 250),
    locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  };
  function gameConAlfombra(): { game: Game; state: GameState } {
    const state = freshState();
    state.position = { location: 0, floor: 0, x: 100, y: 100 };
    state.magicCarpets = 1;
    const game = new Game(initial, world(), gameData, state);
    game.reseed(7);
    return { game, state };
  }

  it("★ el éxito dice «Boarded!» tras «Carpet»", () => {
    const { game } = gameConAlfombra();
    const texts = game.useMagicCarpet().filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts[0], "DS 0x48bf va primero (0x1862)").toBe("Carpet");
    expect(texts, "DS 0x48c8 en 0x188b — el camino normal, que estaba mudo").toContain("Boarded!");
  });

  it("CONTROL POSITIVO: los caminos de RECHAZO no lo dicen", () => {
    // Sin esto, un «Boarded!» incondicional al final pasaría el test de arriba.
    const { game, state } = gameConAlfombra();
    state.position = { location: 0x21, floor: 0, x: 1, y: 1 }; // mazmorra: 0x1869
    const texts = game.useMagicCarpet().filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts, "0x1869 jae ⇒ Not here!").toContain("Not here!");
    expect(texts, "y NO aborda").not.toContain("Boarded!");
  });
});

// ───────────────────────────── (3) el pit y su hermano ─────────────────────────────

describe("(3) ★ la familia «mitad del par» del (S)earch de mazmorra", () => {
  /** Mazmorra sintética (loc 33) con UNA celda del tipo/sub pedido en (2,2). */
  function dungeonCon(cell: DungeonCell): DungeonData {
    const floors: DungeonCell[][][] = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () =>
        Array.from({ length: 8 }, () => ({ type: CellType.Nothing, sub: 0 })),
      ),
    );
    floors[0]![2]![2] = cell;
    return { location: 33, name: "TestLote133", floors };
  }
  function posEn(): DungeonPos {
    return { dungeon: 33, floor: 0, x: 2, y: 2, facing: "north" };
  }
  /** Estado CON luz: sin antorcha el search aborta en el gate de 0x065a. */
  function conLuz(): GameState {
    const s = freshState();
    s.torchTurns = 50;
    return s;
  }
  function buscar(cell: DungeonCell): string[] {
    const dg = new DungeonState([dungeonCon(cell)], posEn());
    return dg
      .search(conLuz(), { target: "here" })
      .filter((e) => e.kind === "message")
      .map((e) => e.text ?? "");
  }

  it("★ el FOSO dice la cadena entera, no sólo la cola tras el \\n", () => {
    // DS 0x8786 = 'Nothing hidden\nin the pit.\n' (SJOG 0x077c). El port emitía
    // 'in the pit.' — la mitad de después del \n.
    expect(buscar({ type: CellType.Trap, sub: 0 }), "DS 0x8786 ENTERA (tras el «You find:» del flujo)").toEqual([
      "You find:",
      "Nothing hidden\nin the pit.",
    ]);
  });

  it("★ el ESQUELETO son DOS prints, no uno (0x0868 + 0x086f)", () => {
    // wallVariant(33) = 3 ⇒ la rama que el binario resuelve con dos print_string
    // seguidos: DS 0x88c8 y DS 0x88ea. El port emitía sólo el segundo.
    expect(wallVariant(33), "idx 1 → variante 3 (la del esqueleto)").toBe(3);
    expect(buscar({ type: CellType.SpecialWall, sub: 0 }), "los dos, y en ese orden").toEqual([
      "You find:",
      "Nothing hidden on the skeleton.",
      "It crumbles away.",
    ]);
  });

  it("CONTROL POSITIVO: las otras dos variantes de muro son de UN print — verificado en el binario", () => {
    // Sin esto, «emitir siempre dos» pasaría el caso de arriba. Deceit(33)→3,
    // Despise(34)→1, Wrong(38)→2 según el mapeo idx∈{1,4,5}→3, {6,7}→2, else→1.
    // Este aserto ya NO es «el port hace esto», es «el binario hace esto»: las ramas
    //   SJOG 0x08b6  mov ax,0x888a / jmp 0x66b  ; 'Nothing in the caved in passage.\n'
    //   SJOG 0x08bc  mov ax,0x88ac / jmp 0x66b  ; 'Nothing on the stalactite.\n'
    // cargan UNA cadena y saltan directas a la cola común, sin el segundo print_string
    // que sí encadena el esqueleto (0x0868 + 0x086f). La conjetura «ídem
    // stalactite/caved-in» de la tarjeta #133 quedó REFUTADA por esta lectura.
    expect(wallVariant(34)).toBe(1);
    expect(wallVariant(38)).toBe(2);
    const conVariante = (dung: number, cell: DungeonCell): string[] => {
      const d = dungeonCon(cell);
      d.location = dung;
      const dg = new DungeonState([d], { ...posEn(), dungeon: dung });
      return dg.search(conLuz(), { target: "here" }).filter((e) => e.kind === "message").map((e) => e.text ?? "");
    };
    expect(conVariante(34, { type: CellType.SpecialWall, sub: 0 })).toEqual([
      "You find:",
      "Nothing on the stalactite.",
    ]);
    expect(conVariante(38, { type: CellType.SpecialWall, sub: 0 })).toEqual([
      "You find:",
      "Nothing in the caved in passage.",
    ]);
  });
});
