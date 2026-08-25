import { describe, expect, it } from "vitest";
import type { GameState } from "../src/core/state.js";
import {
  computeShadowlordHere,
  shadowlordHereIndex,
  shadowlordPresentIndex,
  postPurchaseGoldDrain,
  guardArrestJail,
} from "../src/core/world/blackthorn.js";
import { SMALL_MAP_ENTRY } from "../src/core/game.js";

/**
 * #52 propuesta A — el flag FÍSICO del Shadowlord (`g_unk_5958`) frente a la consulta
 * LÓGICA de la tabla (`shadowlordLocs`).
 *
 * `town_place_shadowlord` TOWN.OVL 0x02AE: inicializa el flag a 0xFF, y **si
 * `g_party_y == 4` se salta la búsqueda entera** (`02bb cmp [g_party_y],4 / 02c0 je 0x2dd`)
 * ⇒ el flag queda en el sentinel. De ese byte cuelgan TRES cosas: la merma de oro
 * (SHOPPES 0x019a), la rama de TALK (0x1187) y la posesión de NPCs (TOWN 0x1156).
 *
 * ★ QUÉ ES LA FILA 4, que la nota heredada tenía mal. NO es «la fila de entrada estándar»
 * —esa es la 30, `SMALL_MAP_ENTRY.y`, y hay un test abajo que lo fija—: es la fila de la
 * CELDA DE YEW. El binario mete al arrestado en (25,4) (`0x1313`/`0x1318`) y acto seguido
 * RECARGA el pueblo (`0x12cd push 1 / call 0x11f0`, la misma rutina que coloca en 0x1239),
 * así que la guarda existe para que despertar preso no coloque, ni anuncie, ni posea.
 */
function stateAt(y: number, over: Partial<GameState> = {}): GameState {
  return {
    position: { location: 4, floor: 0, x: 15, y },
    shadowlordLocs: [4, 99, 99], // Faulinei/Falsedad en Yew (loc 4)
    gold: 500,
    ...over,
  } as GameState;
}

describe("flag físico del Shadowlord (TOWN 0x02AE)", () => {
  it("la consulta LÓGICA ignora la fila — es el control del que hay que distinguirse", () => {
    // `shadowlordPresentIndex` sólo compara la tabla con la location: da 0 en las dos filas.
    expect(shadowlordPresentIndex(stateAt(30))).toBe(0);
    expect(shadowlordPresentIndex(stateAt(4))).toBe(0);
  });

  it("★ la COLOCACIÓN sí mira la fila: y==4 deja el sentinel (−1), cualquier otra coloca", () => {
    expect(computeShadowlordHere(stateAt(4)), "fila 4 ⇒ suprimida (0x02bb/0x02c0)").toBe(-1);
    expect(computeShadowlordHere(stateAt(30)), "fila 30 ⇒ coloca el índice 0").toBe(0);
    expect(computeShadowlordHere(stateAt(3))).toBe(0);
    expect(computeShadowlordHere(stateAt(5))).toBe(0);
  });

  it("★ la fila de ENTRADA ESTÁNDAR no es la 4 — la guarda NO se dispara al entrar a pueblo", () => {
    // Esto es lo que refuta la nota heredada («la fila 4 es la de entrada estándar, en la
    // práctica cubre la entrada normal a pueblo»). Si algún día `SMALL_MAP_ENTRY.y` pasara
    // a 4, este aserto avisa antes de que la merma desaparezca en silencio de todo el juego.
    expect(SMALL_MAP_ENTRY.y).not.toBe(4);
    expect(computeShadowlordHere(stateAt(SMALL_MAP_ENTRY.y))).toBe(0);
  });

  it("sin flag (estado que nunca cargó mapa) el lector cae a la consulta lógica", () => {
    const s = stateAt(30);
    expect(s.shadowlordHere).toBeUndefined();
    expect(shadowlordHereIndex(s)).toBe(0);
  });

  it("con flag puesto MANDA el flag, no la tabla", () => {
    const s = stateAt(30, { shadowlordHere: -1 });
    expect(shadowlordPresentIndex(s), "la tabla sigue diciendo que está aquí").toBe(0);
    expect(shadowlordHereIndex(s), "…pero no está COLOCADO").toBe(-1);
  });

  it("★ la MERMA de oro cuelga del flag: suprimida la colocación, no merma", () => {
    // SHOPPES 0x019a `cmp [g_unk_5958],0 / jne ret` — el gate va ANTES del rand, así que
    // no mermar tampoco consume la tirada rand(1,64).
    const colocado = stateAt(30, { shadowlordHere: 0 });
    expect(postPurchaseGoldDrain(colocado, 40), "con la Falsedad colocada sí merma").toBe(40);
    expect(colocado.gold).toBe(460);

    const suprimido = stateAt(30, { shadowlordHere: -1 });
    expect(postPurchaseGoldDrain(suprimido, 40), "sin colocar NO merma").toBe(0);
    expect(suprimido.gold).toBe(500);
  });

  it("★ despertar ARRESTADO en la celda de Yew deja el flag suprimido", () => {
    // El camino real —y, hasta donde alcanza el censo, el ÚNICO— que dispara la guarda.
    const s = stateAt(30, { keys: 3, time: { year: 139, month: 4, day: 7, hour: 21, minute: 0 } });
    guardArrestJail(s);
    expect(s.position.y, "la celda está en la fila 4 (TOWN 0x1318)").toBe(4);
    expect(s.shadowlordHere, "⇒ la recarga del pueblo no coloca").toBe(-1);
    // Y por tanto comprar en Yew estando preso no merma, aunque Faulinei siga en Yew.
    expect(postPurchaseGoldDrain(s, 40)).toBe(0);
  });
});
