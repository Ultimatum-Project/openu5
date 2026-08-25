/**
 * Ficha #294 · las ESPERAS DE TECLA del rito de santuario y del Códice (CAST2.OVL).
 *
 * Lo que fija esta guarda es el enunciado del reporte del usuario: **al acabar los mantras
 * el port vuelca TODO el texto de una, y el original PARA** — refinado por él mismo a
 * «¿no hay que darle al Enter tanto en shrines como en Codex?».
 *
 * La primitiva es `getkey_with_redraw` (`call 0x448c` de CAST2 → kernel 0x266c): bucle
 * bloqueante que redibuja el viewport y devuelve una tecla ARBITRARIA. No tiene constante
 * de reloj ⇒ NADA de esto se calibra contra vídeo: se cuentan SITIOS, no milisegundos.
 *
 * CENSO DEL OVERLAY, re-medido para esta guarda (`grep -c "call .*0x448c"` sobre
 * `re/disasm/CAST2.OVL.asm` = 15 llamadas) y repartido:
 *   · 2 en `shrine_visit` 0x0966, rama ORDAINED: 0x0a9b y 0x0abc (imprime-luego-espera)
 *   · 9 en el handler del Códice 0x0d24: 0x0d2b·0x0d35·0x0d3f·0x0d9f·0x0df8·0x0e16·
 *     0x0e2d·0x0e44·0x0e5b (espera-luego-imprime)
 *   · 4 AJENAS al rito: 0x00f0, 0x0347, 0x0b6a (bucle de dígito de la donación) y
 *     0x110b.
 * 🔴 CORRECCIÓN AL INVENTARIO DE LA FICHA: el 0x110b **no es del envoltorio 0x0e76**. El
 * envoltorio abarca [0x0e76, 0x10fe) y su `ret` está en 0x10fc; 0x10fe abre OTRA rutina —
 * el **Quit & Save** (imprime DS 0x9658 y filtra `cmp al,0x59`/`cmp al,0x4e` en bucle, ver
 * `re/notes/save-window-writer.md:24-27`). O sea que el rito son ONCE esperas, no doce, y
 * ese 0x110b es justo el control que prueba que el filtro Y/N lo pone el LLAMADOR.
 *
 * ⚠ La rama de QUEST COMPLETA («WELL DONE!», 0x0c18-0x0d1a) no lleva NINGUNA: es un
 * negativo derivado del censo y por eso tiene aserto propio abajo.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { SHRINE_TILE, CODEX_TILE, type ShrineData } from "../src/core/world/shrines.js";
import type { ShrineSceneTiles } from "../src/core/world/shrine-scene.js";
import { ShrineKeyPacer } from "../src/ui/shrine-key-pacer.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const SCENES = JSON.parse(readFileSync(`${ASSETS}/shrine-scene.json`, "utf-8")) as {
  shrine: { tiles: number[][] };
  codex: { tiles: number[][] };
};
const scenes: Record<"shrine" | "codex", ShrineSceneTiles> = {
  shrine: SCENES.shrine.tiles,
  codex: SCENES.codex.tiles,
};

const SHRINES: ShrineData = {
  virtues: ["Honesty", "Compassion", "Valour", "Justice", "Sacrifice", "Honor", "Spirituality", "Humility"],
  mantras: ["Ahm", "Mu", "Ra", "Beh", "Cah", "Summ", "Om", "Lum"],
  shrineX: [101, 0, 0, 0, 0, 0, 0, 0],
  shrineY: [100, 0, 0, 0, 0, 0, 0, 0],
};

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
}

/** Estado sobre la casilla `tile` (santuario de Honesty en (101,100), o el Codex). */
function makeState(): GameState {
  return {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 101, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  } as GameState;
}

function makeWorld(tile: number): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  overworld[100]![101] = tile;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData = (withScenes: boolean): GameData => ({
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  shrines: SHRINES,
  ...(withScenes ? { shrineScenes: scenes as Record<"shrine" | "codex", ShrineSceneTiles> } : {}),
});

const makeGame = (tile: number, withScenes = false): Game =>
  new Game({} as ExtractedInitialState, makeWorld(tile), gameData(withScenes), makeState());

/**
 * Proyección del turno a TOKENS, para poder escribir el esperado EN CRUDO. Un mensaje se
 * proyecta con su texto literal (`M:`), la espera de tecla como `WAIT` y el resto por su
 * `kind`. Comparar la LISTA ENTERA es lo que da sensibilidad POR ESPERA: quitar cualquiera
 * de las once desplaza el array y el aserto la echa de menos por su sitio, no por el total.
 */
const tokens = (evs: GameEvent[]): string[] =>
  evs.map((e) =>
    e.kind === "shrine-key-wait" ? "WAIT" : e.kind === "message" ? `M:${e.text ?? ""}` : `K:${e.kind}`,
  );

const countWaits = (evs: GameEvent[]): number => evs.filter((e) => e.kind === "shrine-key-wait").length;

describe("#294 · rama ORDAINED de shrine_visit: DOS esperas (0x0a9b · 0x0abc)", () => {
  it("las dos teclas parten el texto del altar en TRES bloques, en el orden del binario", () => {
    const game = makeGame(SHRINE_TILE);
    game.enter(); // arma el interrogatorio (pending.visit)
    const out = game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]);
    // Esperado EN CRUDO: los tres bloques del binario con sus dos esperas EN MEDIO.
    // 0x0a8c print 0xb5ff · 0x0a9b TECLA · 0x0a9e-0x0ab9 los tres prints de la quest ·
    // 0x0abc TECLA · 0x0abf print 0xb669 · 0x0adb-0x0b02 la MELODÍA (#364-b, sin espera).
    expect(tokens(out)).toEqual([
      "M:\n\nThe Altar speaks and a Quest is ordained! ",
      "WAIT",
      "M:\n\n\"'Tis now thy sacred Quest to go unto the Codex and learn the failing of Dishonesty!\"\n",
      "WAIT",
      "M:\n\"Return again when thy Quest is done!\"\n",
      "K:sfx", // #364-b: las 7 notas van pegadas al print, sin tecla detrás
    ]);
  });

  it("son DOS, no una ni tres — el cardinal del tramo 0x0966-0x0d23", () => {
    const game = makeGame(SHRINE_TILE);
    game.enter();
    expect(countWaits(game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]))).toBe(2);
  });
});

describe("#294 · las ramas del santuario que NO esperan (negativos derivados)", () => {
  it("WELL DONE (quest completa) no lleva NI UNA: 0x0c18-0x0d1a está limpio de 0x448c", () => {
    const game = makeGame(SHRINE_TILE);
    // Lección del Codex aprendida + quest activa → shrineMode = "quest-complete".
    game.state.shrineVisitedBitmap = 0x01;
    game.state.shrineQuestBitmap = 0x01;
    game.enter();
    const out = game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]);
    // CONTROL POSITIVO del negativo: la rama SÍ se ha recorrido (si no, el 0 sería vacuo).
    expect(out.some((e) => e.kind === "message" && e.text?.includes("WELL DONE"))).toBe(true);
    expect(countWaits(out)).toBe(0);
  });

  it("mantra equivocado («unfocused», 0x0a62) sale por 0x0d1d sin esperar", () => {
    const game = makeGame(SHRINE_TILE);
    game.enter();
    const out = game.submitShrineVisit("Honesty", ["Ahm", "nope", "Ahm"]);
    expect(out.some((e) => e.kind === "message" && e.text?.includes("unfocused"))).toBe(true);
    expect(countWaits(out)).toBe(0);
  });

  it("entrada VACÍA (#275): sigue saliendo en silencio, y sin esperas", () => {
    const game = makeGame(SHRINE_TILE);
    game.enter();
    const out = game.submitShrineVisit("", ["Ahm", "Ahm", "Ahm"]);
    expect(tokens(out)).toEqual([]);
  });

  it("la DONACIÓN no espera: su 0x448c (0x0b6a) es el bucle de dígito, ya consumido por la UI", () => {
    const game = makeGame(SHRINE_TILE);
    game.state.shrineVisitedBitmap = 0x01; // lección aprendida, sin quest → donación
    game.enter();
    const abre = game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]);
    expect(abre.some((e) => e.kind === "shrine-donate-prompt")).toBe(true);
    expect(countWaits(abre)).toBe(0);
    expect(countWaits(game.submitDonation(3))).toBe(0);
  });
});

describe("#294 · handler del Códice 0x0d24: espera-luego-imprime", () => {
  it("con quest y sin ceremonia final: CUATRO esperas en el orden exacto del binario", () => {
    const game = makeGame(CODEX_TILE);
    game.state.shrineQuestBitmap = 0x01; // quest de Honesty → r.virtue = 0
    const out = game.enter();
    expect(tokens(out)).toEqual([
      "M:Enter the Shrine of the Codex!", // MAINOUT cmd_enter (DS 0x2a6f+0x2a89)
      "M:\nThe Codex of Ultimate Wisdom lies before thee...", // envoltorio 0x0f69
      "WAIT", // 0x0d2b — ABRE el handler, antes de imprimir nada suyo
      "M:\nThe book is open to the page thou dost seek!\n\n", // 0x0d2e
      "WAIT", // 0x0d35
      "M:Upon the hallowed page thou dost read:\n\n", // 0x0d38
      "WAIT", // 0x0d3f
      'M:"A dishonest life brings\nunto thee temporary gain, but forsakes\nthe permanent."\n\n', // 0x0d81-0x0d9c
      "K:party-changed",
      "WAIT", // 0x0d9f — la última sin las ocho virtudes (el gate 0x0da2 corta)
    ]);
  });

  it("la trampa de dev SIN quest (0x0d64) lleva las TRES primeras y NINGUNA detrás", () => {
    // 🔴 Este es el aserto del cambio de ORDEN: el barrido del quest-bitmap empieza en
    // 0x0d42, o sea DESPUÉS de los tres `call 0x448c` y de sus dos líneas. El port las
    // tenía tras el `return` de esta rama y la trampa salía a pelo. Y la rama salta a
    // 0x0e5e (el RET): detrás no hay espera ninguna.
    const game = makeGame(CODEX_TILE);
    game.state.shrineQuestBitmap = 0; // sin quest activa
    expect(tokens(game.enter())).toEqual([
      "M:Enter the Shrine of the Codex!",
      "M:\nThe Codex of Ultimate Wisdom lies before thee...",
      "WAIT", // 0x0d2b
      "M:\nThe book is open to the page thou dost seek!\n\n",
      "WAIT", // 0x0d35
      "M:Upon the hallowed page thou dost read:\n\n",
      "WAIT", // 0x0d3f
      "M:HOW DID YOU GET HERE?\n",
    ]);
  });

  it("ceremonia final (8/8): NUEVE esperas, y cada página rúnica arrastra la suya", () => {
    const game = makeGame(CODEX_TILE);
    game.state.shrineQuestBitmap = 0x01;
    game.state.shrineVisitedBitmap = 0xfe; // al marcar la virtud 0 queda 0xff → gate 0x0da2
    const out = game.enter();
    expect(countWaits(out)).toBe(9);
    // El «viento» (0x0df1) y la línea de apertura (0x0dfb) están separados por 0x0df8…
    const tk = tokens(out);
    const iWind = tk.findIndex((t) => t.includes("A STRANGE WIND"));
    expect(iWind).toBeGreaterThan(-1);
    expect(tk[iWind + 1]).toBe("WAIT"); // 0x0df8
    expect(tk[iWind + 2]).toContain("Thou dost read:"); // 0x0dfb, SIN espera entre medias
    // …y cada una de las CUATRO páginas rúnicas va seguida de SU tecla (0x0e16/0x0e2d/
    // 0x0e44/0x0e5b). Recorrer las cuatro es lo que da un aserto POR espera.
    const runes = out
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.kind === "message" && e.rune === true);
    expect(runes.length).toBe(4);
    for (const { i } of runes) expect(out[i + 1]!.kind).toBe("shrine-key-wait");
    // Y la ceremonia NO se cuela cuando faltan virtudes: control del gate.
    const sinGate = makeGame(CODEX_TILE);
    sinGate.state.shrineQuestBitmap = 0x01;
    sinGate.state.shrineVisitedBitmap = 0x00;
    expect(countWaits(sinGate.enter())).toBe(4);
  });

  it("con la ESCENA montada (#277) las esperas van DETRÁS del guion de entrada", () => {
    const game = makeGame(CODEX_TILE, true);
    game.state.shrineQuestBitmap = 0x01;
    const out = game.enter();
    const iScene = out.findIndex((e) => e.kind === "shrine-scene");
    const iWait = out.findIndex((e) => e.kind === "shrine-key-wait");
    expect(iScene).toBeGreaterThan(-1);
    expect(iWait).toBeGreaterThan(iScene); // el handler 0x0d24 corre tras la caminata 0x1053
    expect(countWaits(out)).toBe(4);
  });
});

describe("#294 · cada marcador es un OBJETO distinto (el corte por referencia de main.ts)", () => {
  it("las cuatro esperas del Códice no comparten instancia", () => {
    // `applyEvents` corta con `events.slice(events.indexOf(e) + 1)`, que es identidad por
    // REFERENCIA: con un marcador compartido las nueve esperas del Códice cortarían todas
    // por la primera y el rito se quedaría en bucle sobre el mismo tramo.
    const game = makeGame(CODEX_TILE);
    game.state.shrineQuestBitmap = 0x01;
    const waits = game.enter().filter((e) => e.kind === "shrine-key-wait");
    expect(waits.length).toBe(4);
    expect(new Set(waits).size).toBe(4);
  });
});

describe("#294 · ShrineKeyPacer: aparcar el turno y reanudarlo con la tecla", () => {
  const rest = (): GameEvent[] => [{ kind: "message", text: "resto" }];

  it("aparca, queda ACTIVO y no reanuda hasta la tecla", () => {
    const aplicados: GameEvent[][] = [];
    let refrescos = 0;
    const pacer = new ShrineKeyPacer({
      instant: false,
      applyEvents: (e) => aplicados.push(e),
      refreshAwaiting: () => refrescos++,
    });
    expect(pacer.active).toBe(false);
    expect(pacer.wait(rest())).toBe(true); // el llamador debe cortar su bucle
    expect(pacer.active).toBe(true);
    expect(aplicados).toEqual([]); // NADA se ha reanudado todavía
    pacer.consumeKey();
    expect(aplicados).toEqual([[{ kind: "message", text: "resto" }]]);
    expect(pacer.active).toBe(false);
    expect(refrescos).toBe(2); // el gate del cursor se refresca al aparcar y al soltar
  });

  it("una tecla de más no reanuda dos veces", () => {
    const aplicados: GameEvent[][] = [];
    const pacer = new ShrineKeyPacer({
      instant: false,
      applyEvents: (e) => aplicados.push(e),
      refreshAwaiting: () => {},
    });
    pacer.wait(rest());
    pacer.consumeKey();
    pacer.consumeKey();
    expect(aplicados.length).toBe(1);
  });

  it("ENCADENAR: si el resto vuelve a aparcar, la segunda espera sobrevive al retorno", () => {
    // El Códice encadena hasta nueve. Si `consumeKey` limpiara `parked` DESPUÉS de
    // reanudar, borraría el aparcado que la reanudación acaba de crear y el rito se
    // quedaría mudo a partir de la primera tecla.
    const pacer: ShrineKeyPacer = new ShrineKeyPacer({
      instant: false,
      applyEvents: () => {
        pacer.wait([{ kind: "message", text: "segundo tramo" }]);
      },
      refreshAwaiting: () => {},
    });
    pacer.wait(rest());
    pacer.consumeKey();
    expect(pacer.active).toBe(true); // sigue esperando la SEGUNDA tecla
  });

  it("bajo automatización NO aparca: el turno drena de una (e2e y digests sin drift)", () => {
    const aplicados: GameEvent[][] = [];
    const pacer = new ShrineKeyPacer({
      instant: true,
      applyEvents: (e) => aplicados.push(e),
      refreshAwaiting: () => {},
    });
    expect(pacer.wait(rest())).toBe(false); // el llamador SIGUE su bucle
    expect(pacer.active).toBe(false);
    expect(aplicados).toEqual([]); // y no reentra: el bucle del llamador ya lleva el resto
  });

  it("cancel() olvida el turno aparcado (cargar partida a mitad de rito)", () => {
    const aplicados: GameEvent[][] = [];
    const pacer = new ShrineKeyPacer({
      instant: false,
      applyEvents: (e) => aplicados.push(e),
      refreshAwaiting: () => {},
    });
    pacer.wait(rest());
    pacer.cancel();
    expect(pacer.active).toBe(false);
    pacer.consumeKey();
    expect(aplicados).toEqual([]);
  });
});
