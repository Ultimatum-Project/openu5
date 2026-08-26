/**
 * ADJUDICADOR DE LA FASE de una corrida del careo visual — re-deriva las tablas de
 * `re/notes/careo-ch02-fase-adjudicacion.md` §1-§3 a partir de los artefactos que deja
 * la tubería, SIN volver a decodificar el vídeo.
 *
 * Responde a la pregunta que §6-sexies de `careo-visual-ch02.md` dejó abierta: cuando el
 * port y el vídeo dejan de estar en el mismo sitio, ¿es el port el que bloquea mal, o es
 * el arnés el que rompió al sujeto?
 *
 * Uso (desde la raíz del repo):
 *   npx tsx game/tools/careo-visual/fase-adjudica.ts <port.json> <filas.json> <loc>
 *
 * `port.json` y `filas.json` viven FUERA del repo, junto al material de EA
 * (`~/PROYECTS/OpenU5-videos/careo-visual/<cap>/`). `filas.json` es opcional: sin él se
 * pierde la columna «en fase» pero el resto se mide igual.
 *
 * 🔴 LOS DOS CONTROLES NO SON DECORACIÓN. El resultado que importa —«ningún bloqueo del
 * port carece de justificación en el terreno»— es un CERO, y un cero no se firma sin un
 * predicado que pueda dar distinto de cero:
 *   · CONTROL + : el mismo predicado con la dirección OPUESTA debe dar bastantes casillas
 *     pisables. Si diera 0, el predicado está clavado y el veredicto no vale nada.
 *   · CONTROL − : la casilla realmente PISADA en los avances debe ser pisable. Lo que
 *     sobreviva ahí es la capa de composición (puertas abiertas), no una anomalía — y si
 *     aparece otra cosa, el plano base no basta para adjudicar y hay que decirlo.
 *
 * 🔴 En un compás que AVANZA, `pos` ya es el destino; en uno que bloquea, `pos` es el
 * origen y el destino es `pos + delta`. Usar la misma aritmética en los dos casos es el
 * error que hace leer el CONTROL − al revés (19 «avances sobre muro» que no existían).
 */
import { readFileSync } from "node:fs";
import { tileInfo } from "../../src/core/tiles.js";

interface FilaPort {
  id: string;
  keys: string[];
  pos: { location: number; floor: number; x: number; y: number } | null;
  consola: string[] | null;
  resync_mov: string | null;
  correccion?: [number, number];
}
interface FilaHoja {
  id: string;
  tiles: number;
  cons_orig: string[] | null;
}

const DELTA: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};
const OPUESTA: Record<string, string> = {
  ArrowUp: "ArrowDown",
  ArrowDown: "ArrowUp",
  ArrowLeft: "ArrowRight",
  ArrowRight: "ArrowLeft",
};
/** Los tres mensajes de fallo de paso del binario (DS 0x26d6 / 0x29cf / 0x29db). */
const FALLO = /Blocked!|Slow progress!|Very slow!/;
/** Eco de rumbo pelado: el paso SE COMPLETÓ (MAINOUT 0x0500 / TOWN 0x0665). */
const ECO = /^(North|South|East|West)$/;
const SMALL = 32;

function esMovimiento(f: FilaPort): boolean {
  return f.keys.length === 1 && f.keys[0] !== undefined && f.keys[0] in DELTA;
}
/** Lo que el arnés escribió en `state.position` DESPUÉS de volcar esta fila. */
function mutacion(f: FilaPort): readonly [number, number] {
  let dx = 0;
  let dy = 0;
  const k = f.keys[0];
  if (f.resync_mov && esMovimiento(f) && k !== undefined) {
    const s = f.resync_mov === "adelanta" ? 1 : -1;
    const d = DELTA[k]!;
    dx += d[0] * s;
    dy += d[1] * s;
  }
  if (f.correccion) {
    dx += f.correccion[0];
    dy += f.correccion[1];
  }
  return [dx, dy] as const;
}

function main(): void {
  const [, , portPath, hojaPath, locArg] = process.argv;
  if (!portPath) throw new Error("uso: fase-adjudica.ts <port.json> [filas.json] [location]");
  const port = (JSON.parse(readFileSync(portPath, "utf-8")) as { filas: FilaPort[] }).filas;
  const hoja: FilaHoja[] = hojaPath
    ? (JSON.parse(readFileSync(hojaPath, "utf-8")) as { filas: FilaHoja[] }).filas
    : [];
  const loc = Number(locArg ?? port[0]?.pos?.location ?? 0);

  const mapas = JSON.parse(readFileSync("game/assets/maps/smallmaps.json", "utf-8")) as {
    id: number;
    floors: { z: number; tiles: number[][] }[];
  }[];
  const mapa = mapas.find((m) => m.id === loc);
  if (!mapa) throw new Error(`sin plano para la location ${loc}`);
  const plano = new Map<number, number[][]>(mapa.floors.map((f) => [f.z, f.tiles]));
  const pisable = (z: number, x: number, y: number): boolean | null => {
    if (x < 0 || y < 0 || x >= SMALL || y >= SMALL) return null;
    const t = plano.get(z)?.[y]?.[x];
    return t === undefined ? null : tileInfo(t).walkable;
  };

  // ── §1 — ¿puede bloquear el lado de REFERENCIA? ────────────────────────────────
  let movs = 0;
  let vidFallo = 0;
  // ── §2 — sujeto y sus dos controles ───────────────────────────────────────────
  let bloq = 0;
  let bloqPisable = 0;
  let mut = 0;
  let mutPisable = 0;
  let av = 0;
  let avNoPisable = 0;
  const avAnomalos = new Map<number, number>();
  // ── §3 — clasificación de los compases de movimiento ──────────────────────────
  const clase = new Map<string, number>();
  let fueraDeRango = 0;
  const anota = (k: string): void => {
    clase.set(k, (clase.get(k) ?? 0) + 1);
  };

  for (let i = 0; i < port.length; i++) {
    const f = port[i]!;
    const p = f.pos;
    if (p && (p.x < 0 || p.y < 0 || p.x >= SMALL || p.y >= SMALL)) fueraDeRango++;
    if (!esMovimiento(f) || !p) continue;
    movs++;
    const k = f.keys[0]!;
    const [dx, dy] = DELTA[k]!;
    const ult = f.consola?.at(-1) ?? "";
    if (FALLO.test(hoja[i]?.cons_orig?.join(" ") ?? "")) vidFallo++;

    if (FALLO.test(ult)) {
      const w = pisable(p.floor, p.x + dx, p.y + dy);
      if (w !== null) {
        bloq++;
        if (w) bloqPisable++;
      }
      const [ox, oy] = DELTA[OPUESTA[k]!]!;
      const m = pisable(p.floor, p.x + ox, p.y + oy);
      if (m !== null) {
        mut++;
        if (m) mutPisable++;
      }
    } else if (ECO.test(ult.trim())) {
      const w = pisable(p.floor, p.x, p.y); // AVANCE: `pos` YA es el destino
      if (w !== null) {
        av++;
        if (!w) {
          avNoPisable++;
          const t = plano.get(p.floor)?.[p.y]?.[p.x];
          if (t !== undefined) avAnomalos.set(t, (avAnomalos.get(t) ?? 0) + 1);
        }
      }
    }

    // clasificación (necesita la fila anterior para saber de dónde salía)
    const prev = port[i - 1];
    if (!prev?.pos) continue;
    const [mx, my] = mutacion(prev);
    const bx = prev.pos.x + mx;
    const by = prev.pos.y + my;
    if (p.x === bx + dx && p.y === by + dy) anota("AVANZA");
    else if (p.x !== bx || p.y !== by) anota("ni avanza ni queda (arnes/otro)");
    else if (FALLO.test(ult)) anota("BLOQUEA y lo DICE");
    else if (ECO.test(ult.trim())) anota("BLOQUEA EN SILENCIO (sin Blocked!)");
    else anota("quieto, consola de modal/otro");
  }

  console.log(`location ${loc} · filas ${port.length} · compases de movimiento simple ${movs}`);
  console.log(`\n§1  compases donde el VIDEO trae Blocked!/Slow/Very slow: ${vidFallo}`);
  console.log(
    "    (si es 0, la direccion «el original bloquea y el port no» es INOBSERVABLE: no hay asimetria que interpretar)",
  );
  console.log(`\n§2  SUJETO   bloqueos anunciados por el port: ${bloq} — con destino PISABLE: ${bloqPisable}`);
  console.log(`    CONTROL+ mismo predicado, direccion OPUESTA: ${mut} — pisables: ${mutPisable}  (debe ser >>0)`);
  console.log(`    CONTROL- casilla PISADA en los avances:      ${av} — no pisables: ${avNoPisable}`);
  for (const [t, n] of [...avAnomalos].sort((a, b) => b[1] - a[1]))
    console.log(`             tile ${t} 0x${t.toString(16)} n=${n} ${tileInfo(t).name}`);
  console.log("\n§3  clasificacion de los compases de movimiento:");
  for (const [k, n] of [...clase].sort((a, b) => b[1] - a[1]))
    console.log(`    ${k.padEnd(38)} ${String(n).padStart(4)}  ${((100 * n) / movs).toFixed(1)}%`);
  console.log(`\n    filas con POSICION FUERA de [0,${SMALL - 1}] (imposible: la escribio el arnes): ${fueraDeRango}`);

  if (hoja.length === port.length) {
    const enFase = (i: number): boolean => (hoja[i]?.tiles ?? 1e9) <= 25;
    const primeraOob = port.findIndex(
      (f) => f.pos && (f.pos.x < 0 || f.pos.y < 0 || f.pos.x >= SMALL || f.pos.y >= SMALL),
    );
    if (primeraOob >= 0) {
      const antes = port.slice(0, primeraOob).filter((_, i) => enFase(i)).length;
      const despues = port.slice(primeraOob).filter((_, i) => enFase(primeraOob + i)).length;
      console.log(
        `\n    EN FASE antes de la 1a posicion imposible (${port[primeraOob]!.id}): ${antes}/${primeraOob}` +
          ` = ${((100 * antes) / primeraOob).toFixed(1)}%`,
      );
      const n = port.length - primeraOob;
      console.log(`    EN FASE despues: ${despues}/${n} = ${((100 * despues) / n).toFixed(1)}%`);
    }
  }
}

main();
