#!/usr/bin/env node
/**
 * CENSO HORARIO DE NPCs de una localización: dónde está CADA NPC —y en qué PLANTA— a una
 * hora dada, y en qué hora exacta cambia de planta.
 *
 * Sonda del carril `reloj-27` (acta: re/notes/reloj-27-acta.md). Es el instrumento con el
 * que se adjudicó el `−27` de `ad10-g21`: el ancla de NPC del espejo fija la party a la
 * planta de UN mercader, y el resto del material del segmento puede estar en la OTRA.
 * Commiteada para que la cifra no sea una foto ([[cifra-sin-sonda-commiteada]]).
 *
 *   node re/tools/censo_horario_npcs.mjs <loc> [hora...]
 *   node re/tools/censo_horario_npcs.mjs 5 3 5        # Minoc a las 03 y a las 05
 *   node re/tools/censo_horario_npcs.mjs 5            # las 24 horas, tabla de plantas
 *
 * ★ NO RE-DERIVA EL CRITERIO. Importa `scheduleIndex` del PORT (`src/core/time.ts`, port
 * exacto de `schedule_index` NPC.OVL:0x12E0). Una segunda copia de esa aritmética de byte
 * es una regla en dos sitios, que es una regla que puede divergir.
 *
 * ★ CONTROL POSITIVO INCORPORADO. Antes de imprimir nada, re-deriva la tabla del Healer de
 * Minoc (loc 5 slot 2) y la compara con la banda PUBLICADA en `re/notes/fa3-ancla-celda-acta.md`
 * §5, que sale del binario y NO de este fichero de assets. Si no cuadra, ABORTA: sin eso el
 * censo podría estar leyendo mal la forma del JSON y nadie se enteraría.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scheduleIndex } from "../../game/src/core/time.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NPCS = join(RAIZ, "game", "assets", "npcs.json");

/** Los NPCs "de relleno" (dialogNumber 0 y type 0) no hablan: fuera del censo. */
const hablante = (n) => !(n.dialogNumber === 0 && n.type === 0);

export function cargarLoc(loc) {
  const d = JSON.parse(readFileSync(NPCS, "utf8"));
  const l = d[String(loc)];
  if (!Array.isArray(l)) throw new Error(`npcs.json no trae la loc ${loc} como array`);
  return l;
}

/** Celda (x,y,z) de un NPC a una hora, con el MISMO criterio que el port. */
export function celdaA(npc, hora) {
  const i = scheduleIndex(npc.times, hora);
  return { x: npc.x[i], y: npc.y[i], z: npc.z[i], idx: i };
}

/** Horas (0-23) en las que el NPC está en cada planta. */
export function plantasPorHora(npc) {
  const out = new Map();
  for (let h = 0; h < 24; h++) {
    const z = celdaA(npc, h).z;
    if (!out.has(z)) out.set(z, []);
    out.get(z).push(h);
  }
  return out;
}

// ── CONTROL POSITIVO: la banda del Healer de Minoc, contra la tabla PUBLICADA ────────────
// fa3-ancla-celda-acta.md §5 (fuente: schedule_index NPC.OVL:0x12E0 + npcs.json):
//   idx 0 → (7,25,z1) 21–04 · idx 1 → (6,26,z0) 05–10 y 13–20 · idx 2 → (25,8,z0) 11–12
const CONTROL = {
  loc: 5,
  slot: 2,
  esperado: {
    0: [21, 22, 23, 0, 1, 2, 3, 4],
    1: [5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19, 20],
    2: [11, 12],
  },
};

export function control() {
  const npc = cargarLoc(CONTROL.loc).find((n) => n.slot === CONTROL.slot);
  if (!npc) throw new Error(`control: no existe loc ${CONTROL.loc} slot ${CONTROL.slot}`);
  const vivo = { 0: [], 1: [], 2: [] };
  for (let h = 0; h < 24; h++) vivo[celdaA(npc, h).idx].push(h);
  for (const k of [0, 1, 2]) {
    const a = [...vivo[k]].sort((p, q) => p - q).join(",");
    const b = [...CONTROL.esperado[k]].sort((p, q) => p - q).join(",");
    if (a !== b) {
      throw new Error(
        `🔴 CONTROL POSITIVO ROTO — Healer de Minoc idx ${k}: el censo da [${a}] y la tabla ` +
          `publicada (fa3-ancla-celda-acta.md §5, derivada del BINARIO) dice [${b}]. El censo ` +
          `NO se imprime: o npcs.json cambió de forma o este lector la interpreta mal.`,
      );
    }
  }
  return true;
}

function main(argv) {
  control();
  const loc = Number(argv[0]);
  if (!Number.isInteger(loc)) {
    console.error("uso: node re/tools/censo_horario_npcs.mjs <loc> [hora...]");
    process.exit(2);
  }
  const npcs = cargarLoc(loc).filter(hablante);
  const horas = argv.slice(1).map(Number).filter((h) => Number.isInteger(h) && h >= 0 && h < 24);

  if (horas.length === 0) {
    console.log(`# loc ${loc} — PLANTA de cada NPC hablante, hora a hora (0..23)`);
    console.log(`slot  dlg   ${[...Array(24).keys()].map((h) => String(h).padStart(2, "0")).join(" ")}`);
    for (const n of npcs) {
      const fila = [...Array(24).keys()].map((h) => ` z${celdaA(n, h).z}`).join("");
      console.log(`${String(n.slot).padStart(4)}  0x${n.dialogNumber.toString(16).padStart(2, "0")} ${fila}`);
    }
    return;
  }

  console.log(`# loc ${loc} — celda (x,y,z) por NPC en las horas ${horas.join(", ")}`);
  const cab = horas.map((h) => `@${String(h).padStart(2, "0")}:00`.padEnd(18)).join("");
  console.log(`slot  dlg   ${cab}`);
  for (const n of npcs) {
    const cel = horas
      .map((h) => {
        const c = celdaA(n, h);
        return `(${c.x},${c.y},z${c.z})`.padEnd(18);
      })
      .join("");
    const plantas = new Set(horas.map((h) => celdaA(n, h).z));
    console.log(
      `${String(n.slot).padStart(4)}  0x${n.dialogNumber.toString(16).padStart(2, "0")} ${cel}` +
        (plantas.size > 1 ? "  ←── CAMBIA DE PLANTA entre esas horas" : ""),
    );
  }
  for (const h of horas) {
    const z1 = npcs.filter((n) => celdaA(n, h).z === 1).map((n) => n.slot);
    console.log(`# a las ${String(h).padStart(2, "0")}:00 están en z1 los slots [${z1.join(", ")}]`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("censo_horario_npcs.mjs")) main(process.argv.slice(2));
