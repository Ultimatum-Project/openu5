/**
 * ★★ LA VENTANA EN LA QUE EL HERRERO DE MINOC **SÍ** ES ALCANZABLE — lo que le falta al censo
 * de mercaderes tapados para contestar «¿puede el espejo sortearlo?».
 *
 * `censo-sombra-mercader.test.ts` ata la POBLACIÓN DEL DAÑO: las 5 horas (9, 10, 13, 14, 17) en
 * las que el aldeano de slot 1 tapa al herrero de slot 5 en 27,26. De ahí se lee con facilidad
 * —y es FALSO— que esa celda sea inalcanzable: el herrero está en 27,26 **diez** horas al día, y
 * en **cinco de ellas está SOLO**. La diferencia no es teórica, es la única palanca que el arnés
 * tendría para hacer enganchar el ancla sin divergir del binario (el (T)alk pregunta por la
 * celda y `npcAt` es un `find` en orden de slot, calcado de `find_npc_by_objIdx`
 * TOWN.OVL:0x011e — el arnés no tiene ningún control sobre a QUIÉN resuelve la celda; sólo
 * sobre el RELOJ, que es lo que decide quién está en ella).
 *
 * MEDIDO EN CORRIDA (ventana `ancla-herrero`, `re/notes/ancla-herrero-acta.md`): el ancla
 * `shop:Blacksmith` de `ad04-g08` cae a las **14:38** — dentro de la banda tapada— y la sonda
 * `U5_ESPEJO_SONDA_ANCLA=1` declara `npcAt→ slot 1 dlg 0x19 · ocupantes: slot 1 dlg 0x19 |
 * slot 5 dlg 0x81`. A las 15:00 la MISMA celda resuelve al herrero.
 *
 * Este fichero conduce el `NpcManager` REAL con el `npcs.json` REAL —no el `.mjs` del censo— y
 * fija la partición COMPLETA de las 24 horas, para que un cambio de horarios no mueva en
 * silencio ni el daño ni la salida.
 */
import { expect, it } from "vitest";
import { NpcManager } from "../src/core/npc/manager";
import type { GameState } from "../src/core/state";
import { describeConAssets, hayAsset, leeAsset } from "./assets-opcionales.js";

const LOC_MINOC = 5;
const CELDA_DIURNA = { x: 27, y: 26 }; // la celda de horario de la franja media del herrero
const DLG_BLACKSMITH = 0x81;
const DLG_TACTUS = 0x19;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Carga en EJECUCIÓN, no por import estático: `game/assets/` no viaja al repo
// público y un import estático rompía su `tsc`. Ver `assets-opcionales.ts`.
// El `{}` NUNCA se usa: si falta el asset, `describeConAssets` salta el bloque
// entero. Está aquí porque un `leeAsset` a nivel de MÓDULO lanzaría al importar,
// antes de que el skip pueda actuar — y el test moriría en vez de saltarse.
const NPCS: any = hayAsset("npcs.json") ? leeAsset<any>("npcs.json") : {};

function estado(hour: number): GameState {
  return { time: { hour, minute: 0, day: 1, month: 1, year: 139 }, npcDead: [] } as unknown as GameState;
}

/** Lo que vería `startTalk` (`src/main.ts:2406`) si la party estuviera adyacente a `celda`. */
function contestaEn(hour: number, celda: { x: number; y: number }): number | null {
  const mgr = new NpcManager(NPCS);
  mgr.enterMap(LOC_MINOC, estado(hour));
  return mgr.npcAt(LOC_MINOC, 0, celda.x, celda.y)?.dialogNumber ?? null;
}

/** ¿Dónde planta `enterMap` al herrero (slot 5) a esta hora? */
function celdaDelHerrero(hour: number): { x: number; y: number; z: number } {
  const mgr = new NpcManager(NPCS);
  mgr.enterMap(LOC_MINOC, estado(hour));
  const h = mgr.npcsAt(LOC_MINOC, 0).concat(mgr.npcsAt(LOC_MINOC, 1)).find((n) => n.slot === 5)!;
  return { x: h.x, y: h.y, z: h.z };
}

describeConAssets(["npcs.json"], "herrero de Minoc — la partición de las 24 horas: dónde está, y cuándo se le puede hablar", () => {
  it("★★ VENTANA DE ESCAPE: en 27,26 el herrero está SOLO a las 6, 7, 8, 15 y 16 — ahí `npcAt` SÍ lo devuelve", () => {
    const solo: number[] = [];
    for (let h = 0; h < 24; h++) {
      const c = celdaDelHerrero(h);
      if (c.x !== CELDA_DIURNA.x || c.y !== CELDA_DIURNA.y || c.z !== 0) continue;
      if (contestaEn(h, CELDA_DIURNA) === DLG_BLACKSMITH) solo.push(h);
    }
    expect(solo, "sin estas cinco horas el arnés no tendría NINGUNA salida y la limitación sería absoluta").toEqual([6, 7, 8, 15, 16]);
  });

  it("★ y en las OTRAS cinco (9, 10, 13, 14, 17) está en la misma celda pero contesta el aldeano", () => {
    const tapado: number[] = [];
    for (let h = 0; h < 24; h++) {
      const c = celdaDelHerrero(h);
      if (c.x !== CELDA_DIURNA.x || c.y !== CELDA_DIURNA.y || c.z !== 0) continue;
      if (contestaEn(h, CELDA_DIURNA) === DLG_TACTUS) tapado.push(h);
    }
    expect(tapado, "es la población que ya declara censo-sombra-mercader.test.ts, medida por el OTRO lado").toEqual([9, 10, 13, 14, 17]);
  });

  it("★ la partición SUMA: 10 horas en 27,26 (5 solo + 5 tapado) y 14 en otra celda — ninguna hora se queda sin clasificar", () => {
    let enLaCelda = 0;
    let fuera = 0;
    for (let h = 0; h < 24; h++) {
      const c = celdaDelHerrero(h);
      if (c.x === CELDA_DIURNA.x && c.y === CELDA_DIURNA.y && c.z === 0) enLaCelda++;
      else fuera++;
    }
    expect(enLaCelda).toBe(10);
    expect(fuera).toBe(14);
    expect(enLaCelda + fuera).toBe(24);
  });

  it("★★ 14:00 (la hora MEDIDA en `ad04-g08`) contesta el aldeano, y 15:00 el herrero — la hora es lo ÚNICO que cambia", () => {
    expect(contestaEn(14, CELDA_DIURNA), "14:38 en la corrida ⇒ tapado").toBe(DLG_TACTUS);
    expect(contestaEn(15, CELDA_DIURNA), "22 minutos después la MISMA celda resuelve al herrero").toBe(DLG_BLACKSMITH);
    expect(celdaDelHerrero(14)).toEqual(celdaDelHerrero(15)); // no se ha movido: se ha ido el que lo tapaba
  });

  it("★ CONTROL: a las 19:00 el herrero NO está en 27,26 sino en su celda de noche (24,23 z1), y ahí contesta él", () => {
    // Es la hora a la que `ad06-g34` engancha hoy (19:17, planta 1): el mismo ancla, otra celda.
    const c = celdaDelHerrero(19);
    expect(c).toEqual({ x: 24, y: 23, z: 1 });
    const mgr = new NpcManager(NPCS);
    mgr.enterMap(LOC_MINOC, estado(19));
    expect(mgr.npcAt(LOC_MINOC, 1, 24, 23)?.dialogNumber).toBe(DLG_BLACKSMITH);
  });
});
