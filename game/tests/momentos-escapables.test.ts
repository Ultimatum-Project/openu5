/**
 * MOMENTOS LEGENDARIOS — QUE SE PUEDA SALIR DE AHÍ, DISPARANDO EL MECANISMO DE VERDAD.
 *
 * 🔴 ORIGEN: reporte de jugabilidad del usuario (08-08) — «en Blackthorn estamos en habitación
 * sellada sin skull key». Era cierto. Al medirlo apareció además un SEGUNDO momento encerrado
 * (el 7, en un cuartito de dos casillas sin ninguna puerta), y los dos defectos convivían con
 * una suite entera en verde: ningún aserto de los que había miraba si desde la casilla del
 * save se podía dar un paso hacia fuera.
 *
 * ── POR QUÉ ESTE FICHERO EXISTE SI YA HAY UN ASERTO EN EL PYTEST ────────────────────────────
 * `re/tools/test_byo_momentos.py` comprueba la ESCAPABILIDAD sobre el grafo: flood-fill con
 * `isPassable` y clasificación de la frontera por tile. Eso es una afirmación sobre los DATOS
 * («hay un 0x97 y llevamos skull keys»), y es la que generaliza a los diez.
 *
 * Lo de aquí es lo otro, y hace falta: **ejecutar los comandos**. Que el tile sea 0x97 y que
 * el save traiga skull keys no demuestra que `(U)se → Skull Key` seguido de `(O)pen` abra ESA
 * puerta — demuestra que yo creo que la abre. Es la misma decisión que tomó el arnés de los
 * momentos de la Llama al llamar a `useShard` en vez de comprobar sus cinco precondiciones a
 * mano: si mañana el port pide algo más para desmagificar, el predicado de datos sigue verde y
 * éste se pone rojo. Se ejecuta la secuencia entera contra el mapa REAL del visitante.
 *
 * ⚠ SALTA SIN ASSETS. `game/assets/` es la extracción de la copia de EA del usuario y no viaja
 * al repositorio público (ver `assets-opcionales.ts`); aquí se necesitan `initial-state.json`
 * (para componer el momento) y `maps/smallmaps.json` (para el mapa donde ocurre).
 */
import { expect, it } from "vitest";
import { describeConAssets, leeAsset } from "./assets-opcionales.js";
import { componeMomento } from "../src/momentos/compone.js";
import { momentoPorId } from "../src/momentos/defs.js";
import type { ExtractedInitialState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { DoorManager, DOOR_TILES, OPEN_DOOR_SUBSTITUTE } from "../src/core/world/doors.js";
import { buildUseRows } from "../src/core/usePicker.js";
import { isPassable } from "../src/core/world/movement.js";

const ASSETS = ["initial-state.json", "maps/smallmaps.json"] as const;

/** Los tres campos que `Game` pide y que estos comandos no tocan. */
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
};

describeConAssets(ASSETS, "momentos legendarios: la salida se abre de verdad", () => {
  const init = leeAsset<ExtractedInitialState>("initial-state.json");
  const smallMapsRaw = leeAsset<SmallMapLocation[]>("maps/smallmaps.json");
  const world: WorldData = {
    // El overworld no se usa aquí (los dos momentos son de interior) pero `WorldData` lo pide.
    overworld: [],
    underworld: [],
    smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
  };

  /** Un `Game` sobre el estado COMPUESTO del momento y el mapa real de su localización. */
  function juegoDe(id: string): { g: Game; doors: DoorManager } {
    const def = momentoPorId(id);
    expect(def, `no existe el momento ${id}`).toBeDefined();
    const state = componeMomento(def!, init);
    const doors = new DoorManager();
    const g = new Game(init, world, gameData, state, { combatResources, doors });
    return { g, doors };
  }

  const mensajes = (evs: { kind: string; text?: string }[]): string[] =>
    evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");

  it("momento 6: la cámara de Blackthorn se abre con la skull key que el save trae", () => {
    const { g } = juegoDe("momento-06");
    const st = g.state;
    // La party está donde el def dice, y la puerta está al SUR a dos pasos.
    expect([st.position.location, st.position.floor, st.position.x, st.position.y])
      .toEqual([18, 3, 15, 14]);
    expect(g.activeMap.tileAt(15, 16)).toBe(DOOR_TILES.magicLock);

    // ── (1) EL PICKER: la Skull Key tiene que APARECER. Es el gate real — `usePicker` sólo
    // ofrece la fila con `skullKeys > 0`, así que con la mochila de antes (0) el jugador
    // ni siquiera veía la opción. Un aserto sobre `state.skullKeys` no mide esto.
    const ofrecidas = buildUseRows(st).map((r) => r.action.kind);
    expect(ofrecidas, "el (U)se no ofrece la Skull Key").toContain("skullKey");

    // ── (2) BAJAR HASTA LA PUERTA. Se anda de verdad: si (15,15) no fuera pasable esto
    // fallaría aquí y no en el paso siguiente, que es lo que se quiere saber.
    expect(mensajes(g.move("south"))).not.toContain("Blocked!");
    expect([g.state.position.x, g.state.position.y]).toEqual([15, 15]);

    // ── (3) EL (U)SE. Desmagifica 0x97 → 0xB8 (`useSkullKey`, CAST.OVL 0x18c4).
    const antes = g.state.skullKeys;
    const use = mensajes(g.useSkullKey("south"));
    expect(use).toContain("Skull Key");
    expect(use, "salió «Not here!»: el gate de localización rechazó la casilla").not.toContain("Not here!");
    expect(g.state.skullKeys, "el (U)se no gastó la llave").toBe(antes - 1);
    expect(g.activeMap.tileAt(15, 16)).toBe(DOOR_TILES.regular);

    // ── (4) EL (O)PEN, que es lo que convierte la puerta en suelo pisable.
    expect(mensajes(g.open("south"))).toContain("Opened!");
    expect(g.activeMap.tileAt(15, 16)).toBe(OPEN_DOOR_SUBSTITUTE);
    expect(isPassable(g.activeMap.tileAt(15, 16), "foot")).toBe(true);

    // ── (5) Y SE SALE. El aserto que cierra: la party CRUZA.
    expect(mensajes(g.move("south"))).not.toContain("Blocked!");
    expect([g.state.position.x, g.state.position.y]).toEqual([15, 16]);
  });

  it("momento 6: el (J)immy NO es una alternativa — rompe la llave y la puerta sigue puesta", () => {
    /**
     * ★ LA RECÍPROCA, y no es ceremonia: sostiene la frase «la ÚNICA vía es la skull key» que
     * el def escribe. Sin esto, alguien podría concluir que con llaves normales bastaba y
     * retirar las skull keys — volviendo a encerrar a la party. `jimmyLock` rama `magic`
     * devuelve siempre `Key broke!` (`world/commands.ts:183-186`), y aquí se comprueba
     * EJECUTÁNDOLO, con las 8 llaves que el momento lleva.
     */
    const { g } = juegoDe("momento-06");
    g.move("south");
    expect(g.state.keys).toBeGreaterThan(0);
    for (let intento = 0; intento < 3; intento++) {
      const r = mensajes(g.jimmy("south"));
      expect(r.join(""), `intento ${intento}`).toContain("Key broke!");
      expect(g.activeMap.tileAt(15, 16), "el jimmy abrió una puerta MÁGICA").toBe(
        DOOR_TILES.magicLock,
      );
    }
  });

  it("momento 7: el grupo está FUERA del cuartito, con el clavicémbalo al alcance", () => {
    /**
     * El momento 7 no se arregló con inventario sino moviendo la casilla: (17,12) era una
     * bolsa de dos celdas con seis muros. Lo que se comprueba aquí es lo que hace jugable la
     * casilla nueva — que desde ella se llega ANDANDO a la silla del clavicémbalo (17,17),
     * que es de donde se toca la melodía que abre el pasadizo hacia la Caja.
     */
    const { g } = juegoDe("momento-07");
    expect([g.state.position.x, g.state.position.y]).toEqual([17, 14]);
    for (let i = 0; i < 3; i++) {
      expect(mensajes(g.move("south")), `paso ${i}`).not.toContain("Blocked!");
    }
    expect([g.state.position.x, g.state.position.y]).toEqual([17, 17]);
  });
});
