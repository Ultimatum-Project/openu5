/**
 * ★★ EL ANCLA DE TIENDA NO PUEDE ENGANCHAR CUANDO OTRO NPC DE SLOT MENOR COMPARTE LA CELDA
 * DE HORARIO DEL MERCADER — y el port no tiene la culpa: está CALCADO.
 *
 * `resyncToNpcAnchor` planta la party adyacente al mercader y le habla. Pero el (T)alk no
 * pregunta por el mercader: pregunta por LA CELDA. `NpcManager.npcAt` es un `list.find(...)`
 * sobre la lista que `enterMap` construye EN ORDEN DE SLOT ⇒ **gana el slot más bajo**. Con un
 * aldeano de slot menor encima, `SHOP_TYPES[dialogNumber]` sale `undefined`, la rama de tienda
 * de `main.ts` no corre, se abre una conversación normal y `shopOpen()` queda en false.
 * Ninguna posición de la party lo arregla: el mercader está DEBAJO.
 *
 * Y el original hace lo mismo: `find_npc_by_objIdx` (TOWN.OVL:0x011e, el kernel 0xBB9E [= CS 0x7b1e] de
 * `talk_command` TALK.OVL 0x041C) barre `si = 0..0x1F` ASCENDENTE (`0129 sub si,si` …
 * `015c cmp si,0x20`) y SALE DEL BUCLE en la primera coincidencia (`0149 mov cx,si` →
 * `0151 jmp 0x164`). Primer match en orden de slot, igual que el clon.
 *
 * ADJUDICADO EN CORRIDA (ventana `f4bc-residuales`, corpus AD): en `ad04-g08` el port imprime
 * «You see a strong youth.» / «"I am called Tactus"» —slot 1, dialogNumber 0x19— en vez del
 * saludo del herrero, y el Healer del MISMO segmento (slot 2) sí engancha.
 *
 * Lo que este fichero ata:
 *  (1) el CONTROL del mecanismo contra el PORT REAL — se conduce `NpcManager` con el
 *      `npcs.json` de verdad y se comprueba quién contesta en la celda del herrero;
 *  (2) que el `scheduleIndex` del censo (`re/tools/censo_sombra_mercader.mjs`, un .mjs suelto)
 *      no pueda divergir del del port sobre TODO el dominio real de horarios;
 *  (3) la POBLACIÓN que el censo declara, para que un cambio de `npcs.json` o de la tabla
 *      `SHOP_TYPES` no la mueva en silencio.
 */
import { expect, it } from "vitest";
import { NpcManager } from "../src/core/npc/manager";
import { scheduleIndex as scheduleIndexPort } from "../src/core/time";
import type { GameState } from "../src/core/state";
import { describeConAssets, hayAsset, leeAsset } from "./assets-opcionales.js";
import { censoSombra, scheduleIndex as scheduleIndexCenso, type FilaSombra } from "../../re/tools/censo_sombra_mercader.mjs";

const LOC_MINOC = 5;
const CELDA_HERRERO = { x: 27, y: 26 };
const DLG_BLACKSMITH = 0x81;
const DLG_TACTUS = 0x19; // slot 1 de Minoc, el aldeano que lo tapa

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Carga en EJECUCIÓN, no por import estático: `game/assets/` no viaja al repo
// público y un import estático rompía su `tsc`. Ver `assets-opcionales.ts`.
// El `{}` NUNCA se usa: si falta el asset, `describeConAssets` salta el bloque
// entero. Está aquí porque un `leeAsset` a nivel de MÓDULO lanzaría al importar,
// antes de que el skip pueda actuar — y el test moriría en vez de saltarse.
const NPCS: any = hayAsset("npcs.json") ? leeAsset<any>("npcs.json") : {};

/** Estado mínimo que `enterMap` mira: la hora (para `scheduleIndex`) y los muertos. */
function estado(hour: number): GameState {
  return { time: { hour, minute: 0, day: 1, month: 1, year: 139 }, npcDead: [] } as unknown as GameState;
}

/** Los 8 tipos de mercader, leídos de la MISMA tabla que usa el censo. */
const SHOP = new Map<number, string>([
  [0x81, "Blacksmith"],
  [0x82, "Barkeeper"],
  [0x83, "HorseSeller"],
  [0x84, "Shipwright"],
  [0x85, "MagicSeller"],
  [0x86, "GuildMaster"],
  [0x87, "Healer"],
  [0x88, "InnKeeper"],
]);

describeConAssets(["npcs.json"], "mercader TAPADO — el (T)alk pregunta por la CELDA, y gana el slot más bajo", () => {
  it("★★ CONTROL contra el PORT: a las 10:00 quien contesta en la celda del herrero de Minoc es el ALDEANO", () => {
    const mgr = new NpcManager(NPCS);
    mgr.enterMap(LOC_MINOC, estado(10));

    const enLaCelda = mgr.npcsAt(LOC_MINOC, 0).filter((n) => n.x === CELDA_HERRERO.x && n.y === CELDA_HERRERO.y);
    expect(enLaCelda.map((n) => n.slot).sort((a, b) => a - b), "la celda tiene que estar COMPARTIDA (si no, el test no mide nada)").toEqual([1, 5]);
    expect(enLaCelda.some((n) => n.dialogNumber === DLG_BLACKSMITH), "el herrero SÍ está ahí").toBe(true);

    const contesta = mgr.npcAt(LOC_MINOC, 0, CELDA_HERRERO.x, CELDA_HERRERO.y);
    expect(contesta?.dialogNumber, "contesta el slot MÁS BAJO, no el mercader").toBe(DLG_TACTUS);
    expect(SHOP.has(contesta!.dialogNumber), "y su dialogNumber NO es de tienda ⇒ shopOpen() se queda en false").toBe(false);
  });

  it("CONTROL POSITIVO — en la celda del Healer (slot 2) sí contesta el mercader: el mecanismo es el ORDEN, no «las tiendas no abren»", () => {
    const mgr = new NpcManager(NPCS);
    mgr.enterMap(LOC_MINOC, estado(10));
    const healer = mgr.npcsAt(LOC_MINOC, 0).find((n) => n.dialogNumber === 0x87)!;
    const contesta = mgr.npcAt(LOC_MINOC, 0, healer.x, healer.y);
    expect(contesta?.dialogNumber, "el Healer es slot 2 y su compañero de celda slot 8 ⇒ gana el Healer").toBe(0x87);
  });

  it("★ el `scheduleIndex` del censo NO puede divergir del del port (todo el dominio real × 24 h)", () => {
    const horarios = new Set<string>();
    for (const slots of Object.values(NPCS) as Array<Array<{ times: number[] }>>) {
      for (const s of slots) horarios.add(JSON.stringify(s.times));
    }
    expect(horarios.size, "dominio no vacío").toBeGreaterThan(50);
    for (const t of horarios) {
      const times = JSON.parse(t) as number[];
      for (let h = 0; h < 24; h++) {
        expect(scheduleIndexCenso(times, h), `times=${t} h=${h}`).toBe(scheduleIndexPort(times, h));
      }
    }
  });

  it("★ POBLACIÓN declarada: 5 pares (location, hora), TODOS el herrero de Minoc en 27,26", () => {
    const filas: FilaSombra[] = censoSombra(NPCS, SHOP);
    expect(filas.map((f) => f.hour).sort((a, b) => a - b)).toEqual([9, 10, 13, 14, 17]);
    for (const f of filas) {
      expect(f.loc).toBe(LOC_MINOC);
      expect(f.cell).toEqual({ x: 27, y: 26, z: 0 });
      expect(f.tapado.tipo).toBe("Blacksmith");
      expect(f.tapado.slot).toBe(5);
      expect(f.tapador.slot).toBe(1);
      expect(f.tapador.dlg).toBe(DLG_TACTUS);
    }
  });
});
