/**
 * #103 — el módulo del pool unificado: calcos de los allocators del binario.
 *
 *  - escáner de reciclado ULTIMA.EXE:0x3868 (slots 1..23 `cmp cx,0x18` · rango
 *    [lo,hi] · Corona 0xB5 excluida SIEMPRE · ventana 11×11 en byte sin signo);
 *  - cascada `acquire_actor_slot` ULTIMA.EXE:0x38E4 (10 llamadas, orden fijo);
 *  - `find_free_actor_slot` SJOG.OVL:0x0000 (31→1);
 *  - vista compuesta y barrido de An Sanct (CAST 0x03de-0x0432).
 *
 * Esperados EN CRUDO (índices de ranura literales), nunca calculados del sujeto.
 */
import { describe, expect, it } from "vitest";
import {
  POOL_SLOT_COUNT,
  findFreeActorSlot,
  firstFreeRecycleSlot,
  scanRecyclableSlot,
  acquireActorSlot,
  composeWorldPool,
  anSanctObjectSweep,
  type PoolSlotView,
} from "../src/core/world/actorPool.js";

/** Vista de 32 ranuras toda LIBRE (tile0 0). */
function emptyView(): PoolSlotView[] {
  return Array.from({ length: POOL_SLOT_COUNT }, () => ({
    tile0: 0, x: 0, y: 0, floor: 0, owner: null,
  }));
}
/** Vista con TODAS las ranuras 1..31 ocupadas por `tile0` (party lejos de todas). */
function filledView(tile0: number): PoolSlotView[] {
  const v = emptyView();
  for (let s = 1; s < POOL_SLOT_COUNT; s++) v[s] = { tile0, x: 200, y: 200, floor: 0, owner: null };
  return v;
}
const PX = 100;
const PY = 100;

describe("escáner 0x3868", () => {
  it("sólo barre 1..23: un candidato en la 24 (o más arriba) NO se devuelve", () => {
    const v = emptyView();
    v[24] = { tile0: 0x94, x: 200, y: 200, floor: 0, owner: null };
    // banda de monstruos, sin restricción de ventana
    expect(scanRecyclableSlot(v, 0x80, 0xff, false, PX, PY)).toBe(0);
    v[23] = { tile0: 0x94, x: 200, y: 200, floor: 0, owner: null };
    expect(scanRecyclableSlot(v, 0x80, 0xff, false, PX, PY)).toBe(23); // cmp cx,0x18: la 23 SÍ
  });

  it("la Corona (0xB5) queda excluida SIEMPRE, también en la banda que la contiene", () => {
    const v = emptyView();
    v[4] = { tile0: 0xb5, x: 200, y: 200, floor: 0, owner: null }; // Corona
    v[9] = { tile0: 0xb4, x: 200, y: 200, floor: 0, owner: null }; // Shard: sí reciclable
    expect(scanRecyclableSlot(v, 0x80, 0xff, false, PX, PY)).toBe(9); // salta la 4
    // y en el barrido "cualquiera" (llamada 10) tampoco:
    expect(scanRecyclableSlot(v, 0x00, 0xff, false, PX, PY)).toBe(1); // 1 está libre (tile 0 ∈ [0,ff])
    const soloCorona = emptyView();
    soloCorona[4] = { tile0: 0xb5, x: 200, y: 200, floor: 0, owner: null };
    // todas las demás fuera de banda: [0xb5,0xb5] sólo casaría la Corona ⇒ nada
    expect(scanRecyclableSlot(soloCorona, 0xb5, 0xb5, false, PX, PY)).toBe(0);
  });

  it("ventana 11×11 en BYTE sin signo: dx +5 dentro, +6 fuera, −6 fuera (wrap 0xFF)", () => {
    const mk = (x: number, y: number) => {
      const v = emptyView();
      v[7] = { tile0: 0x94, x, y, floor: 0, owner: null };
      return v;
    };
    // (x−px+5)&0xff: 105−100+5=10 ≤ 10 → DENTRO ⇒ con `cerca` NO se devuelve
    expect(scanRecyclableSlot(mk(105, 100), 0x80, 0xff, true, PX, PY)).toBe(0);
    // 106−100+5=11 > 10 → FUERA ⇒ se devuelve
    expect(scanRecyclableSlot(mk(106, 100), 0x80, 0xff, true, PX, PY)).toBe(7);
    // 94−100+5=−1 → 0xFF sin signo > 10 → FUERA (la asimetría del byte)
    expect(scanRecyclableSlot(mk(94, 100), 0x80, 0xff, true, PX, PY)).toBe(7);
    // 95−100+5=0 ≤ 10 → DENTRO
    expect(scanRecyclableSlot(mk(95, 100), 0x80, 0xff, true, PX, PY)).toBe(0);
    // basta UN eje fuera: x dentro, y fuera ⇒ se devuelve
    expect(scanRecyclableSlot(mk(100, 111), 0x80, 0xff, true, PX, PY)).toBe(7);
  });
});

describe("cascada 0x38E4", () => {
  it("con ranura LIBRE, la llamada 1 gana a todas (aunque haya desalojables)", () => {
    const v = emptyView();
    v[5] = { tile0: 0x0a, x: 200, y: 200, floor: 0, owner: null }; // objeto suelto, fuera
    v[3] = { tile0: 0x94, x: 200, y: 200, floor: 0, owner: null }; // monstruo, fuera
    // 1..23 con huecos: el primero libre ascendente es el 1
    expect(acquireActorSlot(v, PX, PY)).toBe(1);
  });

  it("pool lleno: banda ANTES que índice — el objeto suelto (llamada 2) gana al monstruo del slot inferior", () => {
    const v = filledView(0x94); // 1..31 monstruos fuera de pantalla
    v[5] = { tile0: 0x0a, x: 200, y: 200, floor: 0, owner: null }; // objeto suelto en la 5
    expect(acquireActorSlot(v, PX, PY)).toBe(5); // no la 1 (monstruo): la banda manda
  });

  it("fuera-de-pantalla ANTES que en-pantalla dentro de la misma banda", () => {
    const v = filledView(0x94);
    for (let s = 1; s < POOL_SLOT_COUNT; s++) {
      v[s]!.x = 101; // EN pantalla en los DOS ejes (basta UNO fuera para ser lejano)
      v[s]!.y = 100;
    }
    v[9]!.x = 200; // sólo la 9 fuera
    expect(acquireActorSlot(v, PX, PY)).toBe(9); // llamada 3 (fuera) antes que la 7 (cualquiera)
  });

  it("la fragata aparcada (0x24, banda 0x12-0x2F) sólo cae en la llamada 10", () => {
    const v = filledView(0xb5); // 1..31 Coronas: nada reciclable
    v[9] = { tile0: 0x24, x: 101, y: 100, floor: 0, owner: null }; // fragata EN pantalla
    expect(acquireActorSlot(v, PX, PY)).toBe(9); // sólo la 10ª (0..0xFF) la ve
  });

  it("todo Coronas: ni la décima encuentra ⇒ 0 (sin spawn)", () => {
    expect(acquireActorSlot(filledView(0xb5), PX, PY)).toBe(0);
  });
});

describe("find_free_actor_slot (SJOG 0x0000) y primer-hueco 1..23", () => {
  it("31→1: vacío ⇒ 31; 31..24 ocupadas ⇒ 23; todo ocupado ⇒ 0", () => {
    expect(findFreeActorSlot(new Set())).toBe(31);
    const altos = new Set([31, 30, 29, 28, 27, 26, 25, 24]);
    expect(findFreeActorSlot(altos)).toBe(23);
    const todos = new Set(Array.from({ length: 31 }, (_, i) => i + 1));
    expect(findFreeActorSlot(todos)).toBe(0);
  });
  it("ascendente 1..23: vacío ⇒ 1; 1,2 ocupadas ⇒ 3; 1..23 ocupadas ⇒ 0", () => {
    expect(firstFreeRecycleSlot(new Set())).toBe(1);
    expect(firstFreeRecycleSlot(new Set([1, 2]))).toBe(3);
    const todos = new Set(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(firstFreeRecycleSlot(todos)).toBe(0);
  });
});

describe("vista compuesta", () => {
  it("asigna y PERSISTE: errante sin slot → 2 (el 1 es del objeto); objeto sin slot → 31", () => {
    const enemy = { tile: 0x194, x: 10, y: 10 } as { slot?: number; tile: number; x: number; y: number };
    const ship = { slot: 1, tile: 0x124, x: 20, y: 130, floor: 0, location: 0 };
    const loot = { tile: 2, x: 30, y: 30, floor: 0, location: 0 } as {
      slot?: number; tile: number; x: number; y: number; floor: number; location: number;
    };
    const view = composeWorldPool({ location: 0, floor: 0, enemies: [enemy], objects: [ship, loot] });
    expect(enemy.slot).toBe(2); // ascendente 1..23 saltando la 1 (fragata)
    expect(loot.slot).toBe(31); // find_free_actor_slot 31→1
    expect(view[1]!.tile0).toBe(0x24); // byte +0 = tile − 0x100
    expect(view[2]!.tile0).toBe(0x94);
    expect(view[31]!.tile0).toBe(2); // el botín guarda el tile en crudo y el byte es el mismo
  });

  it("acota el ENTORNO: objetos de otra location fuera; errantes sólo en location 0", () => {
    const ship = { slot: 1, tile: 0x124, x: 20, y: 130, floor: 0, location: 0 };
    const cofrePueblo = { slot: 23, tile: 0x101, x: 5, y: 5, floor: 0, location: 17 };
    const enemy = { slot: 3, tile: 0x194, x: 10, y: 10 };
    const town = composeWorldPool({ location: 17, floor: 0, enemies: [enemy], objects: [ship, cofrePueblo] });
    expect(town[23]!.tile0).toBe(1); // el cofre del pueblo está
    expect(town[1]!.tile0).toBe(0); // la fragata del sobremundo no
    expect(town[3]!.tile0).toBe(0); // los errantes no existen en pueblo
  });
});

describe("barrido de An Sanct (CAST 0x03de-0x0432)", () => {
  const chestView = (floor: number) => {
    const v = emptyView();
    v[12] = { tile0: 1, x: 40, y: 41, floor, owner: null };
    return v;
  };
  it("cofre (+0==1) en la celda con la planta buena ⇒ su ranura; planta mala ⇒ −1", () => {
    expect(anSanctObjectSweep(chestView(0), 40, 41, true, 0)).toBe(12);
    expect(anSanctObjectSweep(chestView(2), 40, 41, true, 0)).toBe(-1); // 0x40b
  });
  it("en COMBATE el check de planta se SALTA (0x401 ja 0x410)", () => {
    expect(anSanctObjectSweep(chestView(2), 40, 41, false, 0)).toBe(12);
  });
  it("un no-cofre en la celda no casa (0x3e8 sólo acepta 1)", () => {
    const v = emptyView();
    v[12] = { tile0: 0x10, x: 40, y: 41, floor: 0, owner: null }; // caballo
    expect(anSanctObjectSweep(v, 40, 41, true, 0)).toBe(-1);
  });
});
