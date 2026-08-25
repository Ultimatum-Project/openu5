/**
 * ★ M1 — SELLO de la clasificación de los opcionales del save.
 *
 * Ficha M1 (`re/notes/auditoria-workflow-2026-07-28.md`): cargar partida a mitad de sesión
 * es un `Object.assign(game.state, loaded)`, así que cada opcional que el save NO traiga se
 * queda con el valor de la partida VIVA. La ficha pedía «defaultear TODOS los opcionales» y
 * el acta `auditoria-port-a4-m1-m2-acta.md` §5 lo refutó: para una parte de ellos la AUSENCIA
 * SIGNIFICA algo. `state.ts` parte la población en dos tablas; esto las sella.
 *
 * Lo que este fichero cierra, y por qué cada pieza:
 *
 *  (1) COBERTURA POR IDENTIDAD, no por conteo. Un `expect(lista.length).toBe(32)` pasa con
 *      un campo cambiado por otro. Aquí se compara el CONJUNTO de opcionales que declara
 *      `interface GameState` —parseado del propio `state.ts`— contra la unión de las dos
 *      tablas. El conteo no aparece en ninguna aserción a propósito
 *      ([[cifra-censo-sin-sha-es-foto]]: la población ya bajó de 35 a 32 sin que nadie lo
 *      notara — `blackthornPassGranted` por T-B y `wornAmulet`/`wornBadge` por ea51efc8).
 *
 *  (2) DEFAULT-DENY. Un opcional nuevo que no esté en NINGUNA de las dos tablas muerde:
 *      quien añada un campo a `GameState` tiene que ADJUDICARLO. Es la misma forma que la
 *      guarda del acumulador: no hay clase «por defecto».
 *
 *  (3) El COMPORTAMIENTO, no sólo las listas. Que un campo esté en la tabla de acumuladores
 *      no prueba que `deserialize` lo defaultee: se carga un save SIN un solo opcional y se
 *      exige `!== undefined` para los de la lista A y `undefined` para los de la lista B.
 *      Sin esto la tabla sería decorativa.
 *
 *  (4) FÁBRICAS, no valores. Dos cargas no pueden compartir el mismo array/objeto: un
 *      `mapOverrides` compartido haría que escribir en una partida se viera en la otra.
 *
 * SENSIBILIDAD (medida, no supuesta) — ver el acta de este carril: mover un campo de lista,
 * borrarlo de las dos, o volver `deserialize` a no defaultear, ponen en rojo (1), (2) y (3)
 * respectivamente.
 *
 * NO lee assets: construye el save mínimo a mano ⇒ va al tier PURO sin tocar
 * `vitest.pure.config.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deserialize,
  SAVE_OPTIONAL_DEFAULTS,
  SAVE_OPTIONALS_ABSENCE_MEANS,
  type GameState,
} from "../src/core/state.js";

const STATE_TS = resolve(dirname(fileURLToPath(import.meta.url)), "../src/core/state.ts");

/**
 * Censo de los campos OPCIONALES de nivel 1 de `interface GameState`, leído del source.
 * Se parsea el fichero porque los tipos de TypeScript no existen en runtime y el objetivo
 * es justamente cazar un campo añadido al interface sin adjudicar.
 */
function optionalsDeclaradosEnSource(): string[] {
  const src = readFileSync(STATE_TS, "utf8");
  const start = src.indexOf("export interface GameState {");
  if (start < 0) throw new Error("no se encuentra `interface GameState` en state.ts");
  let i = src.indexOf("{", start);
  let depth = 0;
  const open = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  const cuerpo = src
    .slice(open + 1, i)
    .replace(/\/\*[\s\S]*?\*\//g, "") // comentarios de bloque (llevan `{`/`}` en las citas)
    .replace(/\/\/.*/g, "");
  const out: string[] = [];
  let d = 0;
  for (const linea of cuerpo.split("\n")) {
    if (d === 0) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\?\s*:/.exec(linea);
      if (m) out.push(m[1]!);
    }
    d += (linea.match(/\{/g) ?? []).length - (linea.match(/\}/g) ?? []).length;
  }
  return out;
}

// `string[]` a propósito: el censo del source devuelve strings y las comparaciones de
// conjuntos van en ese dominio (el tipado fuerte ya lo impone `state.ts` al construirlas).
const ACUMULADORES: string[] = Object.keys(SAVE_OPTIONAL_DEFAULTS).sort();
const AUSENCIA_SIGNIFICA: string[] = [...SAVE_OPTIONALS_ABSENCE_MEANS].sort();

/** Save v1 MÍNIMO: pasa `assertValidState` y no trae UN SOLO opcional. */
function saveSinOpcionales(): string {
  const personaje = {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 100, maxHp: 100, exp: 0, level: 3, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
  return JSON.stringify({
    version: 1,
    characters: [personaje],
    partySize: 1,
    activeCharacter: 0,
    food: 200, gold: 100, keys: 0, gems: 0, torches: 0, skullKeys: 0,
    grapple: false, magicCarpets: 0,
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
    specialItems: {
      spyglass: false, hmsCape: false, sextant: false,
      pocketWatch: true, blackBadge: false, woodenBox: false,
    },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    moonstones: [],
    karma: 75,
    time: { year: 139, month: 3, day: 5, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 13, floor: 0, x: 15, y: 15 },
    transport: "foot",
    torchTurns: 0,
    npcDead: [], npcMet: [],
    questFlags: {},
    journal: [],
  });
}

describe("M1 — los opcionales del save están CLASIFICADOS (dos listas, por identidad)", () => {
  it("cada opcional de GameState cae en EXACTAMENTE una de las dos listas (default-DENY)", () => {
    const declarados = optionalsDeclaradosEnSource().sort();
    expect(declarados.length, "el parser del interface encuentra opcionales").toBeGreaterThan(0);

    const clasificados = [...ACUMULADORES, ...AUSENCIA_SIGNIFICA].sort();

    // Un campo NUEVO sin adjudicar cae aquí: es el mordisco que pide la tarjeta.
    expect(
      declarados.filter((k) => !clasificados.includes(k)),
      "opcionales de GameState SIN clasificar — añádelos a SAVE_OPTIONAL_DEFAULTS (acumulador) "
        + "o a SAVE_OPTIONALS_ABSENCE_MEANS (la ausencia significa algo), con su porqué",
    ).toEqual([]);

    // Y el sentido contrario: una lista que nombre un campo que ya no existe (el caso de
    // `blackthornPassGranted`, `wornAmulet` y `wornBadge`, retirados sin que nadie tachara).
    expect(
      clasificados.filter((k) => !declarados.includes(k)),
      "campos clasificados que YA NO existen en GameState — táchalos de su lista",
    ).toEqual([]);

    // Disjuntas: nada puede ser acumulador Y ausencia-significa.
    expect(
      ACUMULADORES.filter((k) => AUSENCIA_SIGNIFICA.includes(k)),
      "campos en las DOS listas",
    ).toEqual([]);
  });

  it("un save sin opcionales: los ACUMULADORES salen con default y ninguno queda undefined", () => {
    const cargado = deserialize(saveSinOpcionales()) as unknown as Record<string, unknown>;
    const sinDefault = ACUMULADORES.filter((k) => cargado[k] === undefined);
    expect(
      sinDefault,
      "acumuladores que deserialize NO defaultea — el Object.assign del load mid-sesión "
        + "arrastraría el valor de la partida VIVA para estos campos (ficha M1)",
    ).toEqual([]);
  });

  it("un save sin opcionales: los AUSENCIA-SIGNIFICA siguen undefined (no se resucitan)", () => {
    const cargado = deserialize(saveSinOpcionales()) as unknown as Record<string, unknown>;
    const resucitados = AUSENCIA_SIGNIFICA.filter((k) => cargado[k] !== undefined);
    expect(
      resucitados,
      "campos cuya AUSENCIA significa algo y que han recibido un valor: eso borra el estado "
        + "que su consumidor lee (ver el porqué de cada uno en state.ts)",
    ).toEqual([]);
  });

  it("el default RELLENA la ausencia, no PISA lo que el save trae", () => {
    const base = JSON.parse(saveSinOpcionales()) as Record<string, unknown>;
    base.shrineQuestBitmap = 0x42;
    base.mapOverrides = { "0:0:1:1": 5 };
    base.skullTreeFoundDay = 17;
    base.dungeonRoomsCleared = new Array(14).fill(0xaa);
    const cargado = deserialize(JSON.stringify(base)) as GameState;
    expect(cargado.shrineQuestBitmap).toBe(0x42);
    expect(cargado.mapOverrides).toEqual({ "0:0:1:1": 5 });
    expect(cargado.skullTreeFoundDay).toBe(17);
    expect(cargado.dungeonRoomsCleared).toEqual(new Array(14).fill(0xaa));
  });

  it("los defaults son FÁBRICAS: dos cargas no comparten referencia", () => {
    const json = saveSinOpcionales();
    const a = deserialize(json);
    const b = deserialize(json);
    a.mapOverrides!["0:0:9:9"] = 1;
    a.openDoors!.push({ location: 1, floor: 0, x: 2, y: 3, turnsLeft: 4 });
    (a.shrineDestroyed as number[]).push(0x80);
    expect(b.mapOverrides, "mapOverrides compartido entre dos loads").toEqual({});
    expect(b.openDoors, "openDoors compartido entre dos loads").toEqual([]);
    expect(b.shrineDestroyed, "shrineDestroyed compartido entre dos loads").toEqual([]);
  });

  it("los defaults valen lo que el binario tiene EN REPOSO (los que la derivación fija)", () => {
    const s = deserialize(saveSinOpcionales());
    // init.gam +0x2D6 = 0x1C (a pie) — ancla TRANSPORT_TILE_OFFSET de saveNative.ts.
    expect(s.transportTile, "transportTile: init.gam +0x2D6").toBe(0x1c);
    // `time.day` es 1-28 ⇒ 0 no es un día: el árbol sigue hallable, como con undefined.
    expect(s.skullTreeFoundDay, "skullTreeFoundDay: [0x57b2] ⇒ +0x20C, init.gam 0x00").toBe(0);
    expect(s.reagentPatchFoundDay, "3 parcelas, [0x5858-0x585A] ⇒ +0x2B2..0x2B4").toEqual([0, 0, 0]);
    expect(s.dungeonRoomsCleared, "14 bytes ⇒ +0x33A, init.gam a ceros").toEqual(new Array(14).fill(0));
    // ⚠ `[]`, NO `[0,0,0]`: con tres ceros, relocateShadowlordsAtMidnight los metería a los
    // TRES en el sorteo de medianoche (`cur >= 0x80` no los salta) y además consumiría RNG
    // del stream compartido. Ver el comentario del campo en state.ts.
    expect(s.shadowlordLocs, "shadowlordLocs vacío, no [0,0,0]").toEqual([]);
  });

  it("el árbol de skull keys sigue HALLABLE con el default (el gate diario es !==)", () => {
    const s = deserialize(saveSinOpcionales());
    // Es la aserción que refuta el contraejemplo con el que el acta cerró M1.
    expect(s.time.day, "el save de prueba está en un día real (1-28)").toBeGreaterThan(0);
    expect(s.time.day !== s.skullTreeFoundDay, "day !== 0 ⇒ hallable, igual que undefined").toBe(true);
  });
});
