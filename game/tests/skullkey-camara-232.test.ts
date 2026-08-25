/**
 * #232 — LA SKULL KEY CONTRA LA PUERTA DE LA CÁMARA DE BLACKTHORN.
 *
 * ── EL REPORTE, Y POR QUÉ ESTE FICHERO NO ES UN DUPLICADO ───────────────────────────────
 * `momentos-escapables.test.ts` ya comprueba que la cámara SE ABRE: (U)se → (O)pen → cruza.
 * Lo que #232 trajo es el reporte CONTRARIO, medido por dos vías sobre el vídeo del 13-08:
 * «la llave se gasta (3→2), el mapa no cambia y la party queda clavada — Blocked! ×3».
 *
 * La mitad que faltaba por medir era **la identidad del tile de (15,16)** (la sonda del
 * carril anterior usó un accesor inexistente y devolvió «?» ×4). Medida aquí: es `0x97`.
 * Con eso la adjudicación se cierra, y el veredicto es que **el port no tiene el defecto**:
 *
 *   · `useSkullKey` SÍ cambia el mapa — escribe 0xB8, y eso es lo que manda el binario.
 *   · 0xB8 es la puerta **CERRADA**, no el suelo: andar contra ella da «Blocked!» — en el
 *     clon Y en el original. Lo que faltaba era el (O)pen, y el guión del vídeo no lo tenía.
 *   · el gasto 3→2 es FIEL (`dec g_skull_keys` en CAST.OVL 0x18c4, ANTES del getdir), y aquí
 *     ni siquiera es el defecto conocido del original: la celda SÍ era una puerta mágica.
 *
 * Así que este fichero guarda la RECÍPROCA de la escapabilidad: que el estado intermedio
 * —llave gastada, puerta desmagificada, party todavía dentro— es el correcto, y que la
 * lectura «esto es un bug del port» no vuelva a comprarse. Sin él, alguien que mire sólo el
 * síntoma tiene un incentivo directo a «arreglarlo» haciendo que la llave abra la puerta del
 * todo (0x97 → 0x44), que es una divergencia con el binario disfrazada de corrección.
 *
 * ⚠ SALTA SIN ASSETS, como sus vecinos: `game/assets/` es la extracción de la copia de EA.
 */
import { expect, it, describe } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describeConAssets, leeAsset } from "./assets-opcionales.js";
import { componeMomento } from "../src/momentos/compone.js";
import { momentoPorId } from "../src/momentos/defs.js";
import type { ExtractedInitialState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { DoorManager, unmagicDoorTile } from "../src/core/world/doors.js";

const ASSETS = ["initial-state.json", "maps/smallmaps.json"] as const;
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
};

/**
 * Bitmap de PASABILIDAD del binario, VERBATIM: `DATA.OVL` fileoff 0x54e4, 32 B, consumidor
 * kernel 0x2bd4, bit PUESTO = BLOQUEA. Los mismos bytes que `los-passability-audit.test.ts`
 * — se copian aquí para que el aserto de abajo lea el BINARIO y no una tabla del port
 * derivada de él (que es el lado que se está juzgando).
 */
const PASSABILITY_BYTES =
  "70 0c 00 28 01 f3 00 bd 72 3f ff ff ff cf ff ff fc f6 0f ff ff c7 ff f7 f0 3f ff f3 ff ff ff be";
const bloqueaEnElBinario = (tile: number): boolean => {
  const bytes = PASSABILITY_BYTES.trim().split(/\s+/).map((h) => parseInt(h, 16));
  return (bytes[tile >> 3]! & (0x80 >> (tile & 7))) !== 0;
};

describe("#232 · el binario dice que la puerta desmagificada SIGUE bloqueando", () => {
  /**
   * ★ EL ASERTO QUE CONVIERTE EL SÍNTOMA EN FIDELIDAD, y el único que no depende del port.
   * Si 0xB8 fuese pisable, los tres «Blocked!» del reporte SÍ serían un defecto. El esperado
   * va EN CRUDO (true/false literales), no calculado desde el mismo bitmap que se lee.
   */
  it("0x97 (mágica) y 0xB8 (la que deja la llave) BLOQUEAN; 0x44 (tras el Open) NO", () => {
    expect(bloqueaEnElBinario(0x97)).toBe(true);
    expect(bloqueaEnElBinario(0xb8)).toBe(true);
    expect(bloqueaEnElBinario(0x44)).toBe(false);
  });

  /** El mapeo de CAST2.OVL 0x0768, con su esperado en crudo. */
  it("unmagicDoorTile: 0x97→0xB8 · 0x98→0xBA · cualquier otro → null", () => {
    expect(unmagicDoorTile(0x97)).toBe(0xb8);
    expect(unmagicDoorTile(0x98)).toBe(0xba);
    expect(unmagicDoorTile(0x44)).toBe(null);
    expect(unmagicDoorTile(0xb8)).toBe(null); // no re-entra: ya está desmagificada
  });
});

describeConAssets(ASSETS, "#232 · la cámara de Blackthorn, paso a paso del reporte", () => {
  const init = leeAsset<ExtractedInitialState>("initial-state.json");
  const smallMapsRaw = leeAsset<SmallMapLocation[]>("maps/smallmaps.json");
  const world: WorldData = {
    overworld: [],
    underworld: [],
    smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
  };

  function juego(): Game {
    const def = momentoPorId("momento-06")!;
    return new Game(init, world, gameData, componeMomento(def, init), {
      combatResources,
      doors: new DoorManager(),
    });
  }
  const mensajes = (evs: { kind: string; text?: string }[]): string[] =>
    evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");

  /**
   * ★ EL DATO QUE #232 DEJÓ SIN MEDIR. La ficha se quedó exactamente aquí: «falta la
   * IDENTIDAD del tile de (15,16)». Es 0x97 — puerta con cerrojo MÁGICO — así que la rama
   * que el reporte recorrió NO es la de «frente a no-puerta».
   */
  it("el tile de (15,16) en loc 18 planta 3 es 0x97, la puerta MÁGICA", () => {
    const g = juego();
    expect([g.state.position.location, g.state.position.floor]).toEqual([18, 3]);
    expect(g.activeMap.tileAt(15, 16)).toBe(0x97);
  });

  /**
   * ★ EL REPORTE, REPRODUCIDO ENTERO — y con la comprobación que le faltaba EN MEDIO.
   * «llave 3→2 · Blocked! ×3» sale igual que en el vídeo; lo que NO se cumple es la tercera
   * afirmación de la ficha («el mapa no cambia»): cambia, y a 0xB8.
   */
  it("(U)se+Sur gasta 3→2, ESCRIBE 0xB8 al mapa, y los tres pasos siguientes dan «Blocked!»", () => {
    const g = juego();
    g.move("south"); // (15,14) → (15,15), pegados a la puerta
    expect([g.state.position.x, g.state.position.y]).toEqual([15, 15]);

    expect(g.state.skullKeys).toBe(3);
    const eventos = mensajes(g.useSkullKey("south"));
    expect(eventos).toContain("Skull Key");
    expect(eventos).not.toContain("Not here!");
    expect(g.state.skullKeys).toBe(2); // el 3→2 del reporte
    expect(g.activeMap.tileAt(15, 16)).toBe(0xb8); // ← la mitad que el reporte daba por falsa

    // Los tres «Blocked!» del vídeo, uno por uno, con la party quieta.
    for (let i = 0; i < 3; i++) {
      expect(mensajes(g.move("south")), `paso ${i + 1}`).toContain("Blocked!");
      expect([g.state.position.x, g.state.position.y]).toEqual([15, 15]);
    }
    // Y la puerta sigue ahí: los pasos no la abren (no hay auto-open en U5).
    expect(g.activeMap.tileAt(15, 16)).toBe(0xb8);
  });

  /** El paso que faltaba en el guión: con el (O)pen la party cruza a la primera. */
  it("con el (O)pen detrás, la puerta pasa a 0x44 y la party cruza", () => {
    const g = juego();
    g.move("south");
    g.useSkullKey("south");
    expect(mensajes(g.open("south"))).toContain("Opened!");
    expect(g.activeMap.tileAt(15, 16)).toBe(0x44);
    expect(mensajes(g.move("south"))).not.toContain("Blocked!");
    expect([g.state.position.x, g.state.position.y]).toEqual([15, 16]);
  });
});

/**
 * ★ LA GUARDA SOBRE EL ARTEFACTO QUE PRODUJO EL FALSO POSITIVO. Los tests de arriba dicen
 * que el motor está bien; ninguno impide volver a grabar el vídeo sin el (O)pen, que es lo
 * que pasó. Este lee el guión REAL y exige que entre el getdir de la llave y los pasos haya
 * una (o) con su dirección. No depende de assets: el guión es un fichero tracked.
 */
describe("#232 · el guión del vídeo lleva el (O)pen entre la llave y los pasos", () => {
  it("blackthorn.txt: tras `u`+Enter+flecha viene `o`+flecha antes de andar", () => {
    const ruta = resolve(import.meta.dirname, "../partidas/guiones/blackthorn.txt");
    const teclas = readFileSync(ruta, "utf8")
      .split("\n")
      .map((l) => l.replace(/#.*$/, "").trim())
      .filter(Boolean);

    const enter = teclas.indexOf("Enter");
    expect(enter, "el guión ya no elige ítem con Enter: revisa esta guarda").toBeGreaterThan(0);
    // enter+1 = getdir de la Skull Key · enter+2 = (o) · enter+3 = su dirección.
    expect(teclas[enter + 1]).toBe("ArrowDown"); // dirección de la llave
    expect(teclas[enter + 2], "falta el (O)pen: el vídeo vuelve a «Blocked!» ×3").toBe("o");
    expect(teclas[enter + 3]).toBe("ArrowDown"); // dirección del Open
  });
});
