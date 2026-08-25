#!/usr/bin/env node
/**
 * CENSO DE MERCADERES **TAPADOS** — la población en la que un ancla de tienda del espejo NO
 * PUEDE enganchar, se plante la party donde se plante (ventana `f4bc-residuales`, ficha F4-b).
 *
 * ★ EL MECANISMO. `resyncToNpcAnchor` planta la party ADYACENTE a la celda del mercader y le
 * habla. Pero el (T)alk no pregunta por el mercader: pregunta por LA CELDA. El port resuelve
 * con `NpcManager.npcAt` (`src/core/npc/manager.ts`), que es un `list.find(...)` sobre la lista
 * que `enterMap` construye EN ORDEN DE SLOT — o sea, **gana el slot MÁS BAJO de la celda**. Si
 * en la celda de horario del mercader hay OTRO NPC de slot menor, el que contesta es el otro:
 * `SHOP_TYPES[dialogNumber]` sale `undefined`, la rama de tienda de `main.ts` no corre, se abre
 * una conversación normal y `shopOpen()` se queda en false. Ninguna posición de la party
 * arregla eso: el mercader está debajo.
 *
 * ★ Y EL PORT ESTÁ CALCADO — no es un bug suyo. El original hace lo mismo en
 * `find_npc_by_objIdx` (TOWN.OVL:0x011e, el kernel 0xBB9E [= CS 0x7b1e] que llama `talk_command` TALK.OVL
 * 0x041C): barre si = 0..0x1F ASCENDENTE (`0129 sub si,si` … `015c cmp si,0x20`) y **sale del
 * bucle en la PRIMERA coincidencia** (`0149 mov cx,si` → `0151 jmp 0x164`). Primer match en
 * orden de slot, igual que el clon.
 *
 * ★ POR QUÉ APARECE EN EL ESPEJO Y NO EN LA PARTIDA REAL. Los dos NPC de la celda suelen tener
 * AI de WANDER: jugando, se separan. Pero `teleportSmallMap` pasa por `enterMap`, que devuelve
 * a TODOS a su celda de horario — así que el arnés RECONSTRUYE el apilamiento en cada resync,
 * de forma determinista. Es un artefacto del instrumento sobre una tabla que el juego dispersa.
 *
 * ADJUDICADO EN CORRIDA (corpus AD, dos réplicas por parte, idénticas en estos segmentos):
 *   · `ad04-g08` `shop:Blacksmith` (Minoc): el port imprime «You see a strong youth.» /
 *     «"I am called Tactus"» — slot 1, dialogNumber 0x19 — en vez del saludo del herrero.
 *     El Healer del MISMO segmento (slot 2) engancha: no es que el mundo no sepa abrir tiendas.
 *   · `ad06-g34`: el mismo Tactus tapa al herrero, y «"I am called Lady Sahra"» (slot 8) tapa
 *     al Healer. Un tercer intento del Healer, ya en otra franja horaria, SÍ engancha.
 *
 * Este censo enumera la población OFFLINE (assets/npcs.json + `scheduleIndex`), sin correr
 * nada: por cada (location, hora) dice qué mercader queda tapado y por quién.
 *
 *   node re/tools/censo_sombra_mercader.mjs [--json] [--loc N]
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * La familia de mercaderes se LEE de la tabla del port (`SHOP_TYPES` en `game/src/main.ts`) en
 * vez de copiarse aquí: si alguien añade o quita un tipo, este censo se entera. Un censo con la
 * tabla vacía daría CERO tapados — un verde sin dientes —, así que se aborta si no salen 8.
 */
function shopTypes() {
  const src = readFileSync(join(REPO, "game/src/main.ts"), "utf8");
  const i = src.indexOf("const SHOP_TYPES: Record<number, ShopType> = {");
  if (i < 0) throw new Error("🔴 PARO: no encuentro SHOP_TYPES en game/src/main.ts");
  const bloque = src.slice(i, src.indexOf("};", i));
  const out = new Map();
  for (const m of bloque.matchAll(/0x([0-9a-f]{2}):\s*"(\w+)"/g)) out.set(parseInt(m[1], 16), m[2]);
  if (out.size !== 8) {
    console.error(`🔴 PARO: leí ${out.size} tipos de tienda y esperaba 8 — la tabla ha cambiado de forma.`);
    process.exit(2);
  }
  return out;
}

/**
 * `scheduleIndex` — port EXACTO de `schedule_index` (NPC.OVL:0x12E0), incluido el quirk 3→1.
 * Se reimplementa aquí porque el original vive en TypeScript (`game/src/core/time.ts`) y este
 * censo es un .mjs suelto; `game/tests/censo-sombra-mercader.test.ts` compara las DOS
 * implementaciones sobre todo el dominio real de horarios × 24 h para que no puedan divergir
 * en silencio.
 */
export function scheduleIndex(times, hour) {
  const diff = (k) => (hour - times[k]) & 0xff;
  let best = diff(0);
  let dx = 0;
  const d1 = diff(1);
  if (best > d1) {
    best = d1;
    dx = 1;
  }
  const d2 = diff(2);
  if (best > d2) {
    best = d2;
    dx = 2;
  }
  if (best > diff(3)) dx = 1; // quirk 3→1 (0x131e `mov dx,1`)
  return dx;
}

/** ¿Ocupa el slot una PERSONA? `enterMap` salta el slot 0, los vacíos y los slots-OBJETO. Aquí
 *  basta con slot 0 y vacío: los slots-objeto no tienen dialogNumber de mercader ni compiten
 *  por el `find` de personas (viven en worldObjects), y se marcan aparte si aparecieran. */
function esActor(s) {
  if (s.slot === 0) return false;
  return !(s.type === 0 && s.x.every((v) => v === 0) && s.y.every((v) => v === 0));
}

export function censoSombra(npcs, SHOP) {
  const filas = [];
  for (const loc of Object.keys(npcs).map(Number).sort((a, b) => a - b)) {
    const slots = npcs[String(loc)].filter(esActor);
    for (let hour = 0; hour < 24; hour++) {
      const celda = new Map(); // "x,y,z" → [slots en ORDEN ASCENDENTE]
      for (const s of slots) {
        const i = scheduleIndex(s.times, hour);
        const k = `${s.x[i]},${s.y[i]},${s.z[i]}`;
        (celda.get(k) ?? celda.set(k, []).get(k)).push({ slot: s.slot, dlg: s.dialogNumber, ai: s.aiTypes[i] });
      }
      for (const [k, ocupantes] of celda) {
        if (ocupantes.length < 2) continue;
        ocupantes.sort((a, b) => a.slot - b.slot);
        const primero = ocupantes[0];
        for (const o of ocupantes.slice(1)) {
          if (!SHOP.has(o.dlg)) continue; // sólo importa si el TAPADO es un mercader
          const [x, y, z] = k.split(",").map(Number);
          filas.push({
            loc,
            hour,
            cell: { x, y, z },
            tapado: { slot: o.slot, tipo: SHOP.get(o.dlg), dlg: o.dlg, ai: o.ai },
            tapador: { slot: primero.slot, dlg: primero.dlg, tipo: SHOP.get(primero.dlg) ?? "(aldeano)", ai: primero.ai },
          });
        }
      }
    }
  }
  return filas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const SHOP = shopTypes();
  const npcs = JSON.parse(readFileSync(join(REPO, "game/assets/npcs.json"), "utf8"));
  const soloLoc = process.argv.includes("--loc") ? Number(process.argv[process.argv.indexOf("--loc") + 1]) : null;
  const filas = censoSombra(npcs, SHOP).filter((f) => soloLoc == null || f.loc === soloLoc);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(filas, null, 2));
  } else {
    console.log(`MERCADERES TAPADOS — ${filas.length} pares (location, hora) en los que el (T)alk NO puede llegar al mercader`);
    console.log("loc  h   celda      mercader TAPADO            lo tapa");
    for (const f of filas) {
      console.log(
        `${String(f.loc).padStart(3)} ${String(f.hour).padStart(2)}  ${`${f.cell.x},${f.cell.y},z${f.cell.z}`.padEnd(10)} slot ${String(f.tapado.slot).padStart(2)} ${f.tapado.tipo.padEnd(12)} (0x${f.tapado.dlg.toString(16)})  slot ${String(f.tapador.slot).padStart(2)} ${f.tapador.tipo} (0x${f.tapador.dlg.toString(16)})`,
      );
    }
    const porLoc = new Map();
    for (const f of filas) porLoc.set(f.loc, (porLoc.get(f.loc) ?? 0) + 1);
    console.log(`\nlocations afectadas: ${[...porLoc.keys()].join(", ") || "(ninguna)"}`);
  }
}
