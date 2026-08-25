/**
 * COBERTURA de los hechizos de LÍNEA de COMBATE (In Zu / In Nox Hur / In Flam Hur /
 * In Vas Grav Corp) — CALCO de CAST.OVL `0x104e → 0x1f60(color,mode,actor) →
 * 0x1fd2 call 0x1c36` (trazador) + `0x1bb0` (por-píxel). Re-derivación 2026-07-22
 * (carril fiel/line-spell-mech): `re/notes/fx-lineaoe-negate-derivation.md` §3.
 *
 * ⚠ SUPERA (falsifica) el esqueleto anterior de este módulo y la lectura
 * «bolt rand0(15) + gate radial rand30>=peso[dist]» de witness-combat-radial.md:
 *  - `0x1d33 rand0(15)` NO es la longitud: es el nº de PASOS por (rayo, pasada)
 *    del dibujante — pacea la ANIMACIÓN; la forma final es DETERMINISTA (cada
 *    rayo corre hasta su corte por clip/LOS independientemente del troceo).
 *  - La curva 0x1cf0 NO es probabilidad: es el ACUMULADOR DE PENDIENTE por rayo
 *    (−10 por paso de eje; al agotarse, paso perpendicular y recarga curve[i]).
 *  - `0x20c1 call 0xbf46(0xfffe, si)` NO es «peso de la celda»: es el fetch del
 *    INT del OBJETIVO (COMBAT:0x13e2, mismo accessor que el terremoto,
 *    combat-spells.md §3 `095a`) — el contest del MODO 2 (veneno), no un gate
 *    universal. En el bucle de daño de 0x1f60 NO existe gate radial alguno.
 *
 * MECÁNICA REAL (citas instrucción a instrucción en la nota §3):
 *  1. 0x1c36 traza los 21 rayos del abanico píxel a píxel y REGISTRA de paso las
 *     celdas cubiertas: en filas de y IMPAR (0x1bb0 1c03 `test [bp+6],1`) computa
 *     píxel→celda (0x8034) y consulta la LOS de hechizo (0x7fee → kernel 0x3f6e,
 *     bitmap 0x6a14); opaca ⇒ el rayo TERMINA y la celda NO se registra (1dfb
 *     `je 0x1e68`). Celda nueva en [0,0xb)² (1e05-1e1f) se apunta en las listas
 *     x/y y se marca 0xff en el mapa 0xab02 (dedupe, 1e21-1e60); cap 63 (1dff).
 *  2. 0x1c36 devuelve el nº de celdas ([bp-0x8e] → 1f54); 0x1f60 itera las celdas
 *     REGISTRADAS (1fed-2148) y por celda busca el combatiente (slots 31→0,
 *     match x/y en [+6]/[+7]; salta vacío [+2]==0, ido [+2]&0x20 y YA-GOLPEADO
 *     [+5]&0x80; al golpear marca [+5]|=0x80 — máx 1 golpe por combatiente por
 *     casteo; flags limpiados al final 2148-215b) y aplica el efecto del MODO.
 *
 * Este módulo aporta el paso 1 (la COBERTURA, determinista y sin RNG); el paso 2
 * (búsqueda de ocupante + efectos por modo) vive en `combat.ts::castLineAoe`.
 *
 * DELTA DE PARIDAD documentado (decisión previa del lead, nota §Hallazgos):
 * el binario consume el stream de RNG DE JUEGO durante el DIBUJO (rand0(15) por
 * rayo-y-pasada en 0x1d33 + rand(100,10000) por píxel pintado en 0x1bf4) — no se
 * replica. Consecuencia menor: el ORDEN de registro de celdas del binario
 * (entrelazado de pasadas dependiente de esos rands) aquí se CANONICALIZA a
 * rayo-a-rayo-hasta-su-corte (misma cobertura FINAL, mismo nº de tiradas de
 * daño; solo puede variar qué rand concreto recibe cada objetivo cuando hay
 * varios — distribución idéntica).
 *
 * La geometría de rayos está DUPLICADA a conciencia en la piel
 * (`skin/fiel/combat.ts::traceSprayRays`, presentación) porque la piel no puede
 * importar valores del core (guarda skin-import-guard); cambios aquí ⇒ espejo allí.
 */
import { SPRAY_SLOPE_CURVE } from "./areaSpellTables.js";

/** Celda del tablero de combate 11×11. */
export interface SprayCell {
  x: number;
  y: number;
}

/** Lado del tablero en celdas (0x1e13/0x1e1a `cmp …,0xb`). */
const GRID = 11;
/** Lado del tablero en píxeles de arena (11×16; clip de 0x1bb0 = 8..0xb6 en
 *  pantalla ⇒ 0..174 en arena, y el plot cubre (x, x+1)). */
const MAX_PX = 176;
/** Cap de celdas registradas (0x1dff: listas de 63 words tras el slot 0 no usado
 *  — el trazador PRE-incrementa el puntero antes de escribir, 1e34-1e56). */
const MAX_CELLS = 63;

/**
 * Celdas cubiertas por el ABANICO de un hechizo de línea, EN ORDEN DE REGISTRO
 * (canonicalizado rayo 0→20, cada rayo hasta su corte). Espacio de ARENA
 * (píxel de pantalla − 8; la paridad de y se conserva porque 8 es par).
 *
 * Por rayo i (curva 21 words DATA.OVL 0x1d00): origen = punto MEDIO del borde
 * del tile del caster que mira a la dirección (0x1c6a-0x1cec); avance de 1 px
 * por paso en el eje con acumulador `weight` (−10 por paso, 0x1e7d; al agotarse
 * paso PERPENDICULAR ±1 — rayos 0-9 a un lado, 10-20 al otro (0x1ea9-0x1ecb),
 * signo por dirección 0x1ecb-0x1f14 — y recarga curve[i], 0x1eea-0x1ef4). El
 * rayo termina al salir del clip (0x1bb0 1bb3-1bcb, ANTES de pintar) o, en
 * filas de y IMPAR, si la celda es OPACA a hechizos (0x6a14; DESPUÉS de pintar:
 * el muro recibe su último píxel pero NO se registra). Registro solo en filas
 * IMPARES ⇒ los rayos casi-rectos de un casteo HORIZONTAL cruzan la columna
 * adyacente en fila PAR sin consultar la LOS (el muro pegado al caster «gotea»
 * — comportamiento del binario, no un bug del port). La celda del propio caster
 * nunca se registra (el origen en su borde solo pisa filas pares dentro del
 * tile propio, para las 4 direcciones).
 *
 * `dir` diagonal: el original solo apunta a 4 direcciones (getdir); gana el eje
 * vertical (Clase-C, mismo criterio que la piel).
 */
export function spraySpellCells(
  caster: SprayCell,
  dir: SprayCell,
  opaque: (cx: number, cy: number) => boolean,
): SprayCell[] {
  const N = SPRAY_SLOPE_CURVE.length; // 21 rayos
  const bx = caster.x * 16;
  const by = caster.y * 16;
  const vert = dir.y !== 0;
  const ax = vert ? 0 : Math.sign(dir.x);
  const ay = vert ? Math.sign(dir.y) : 0;
  let ox: number;
  let oy: number;
  let plx: number; // paso perpendicular de los rayos 0-9 (10-20 = el opuesto)
  let ply: number;
  if (vert && ay < 0) {
    ox = bx + 8; oy = by; plx = -1; ply = 0; // norte (dir 3): 0x1ee4 add x,si (si=−1)
  } else if (vert) {
    ox = bx + 8; oy = by + 16; plx = 1; ply = 0; // sur (dir 4): 0x1f06 sub x,si
  } else if (ax < 0) {
    ox = bx; oy = by + 8; plx = 0; ply = 1; // oeste (dir 1): 0x1f10→1f06 sub y,si
  } else {
    ox = bx + 16; oy = by + 8; plx = 0; ply = -1; // este (dir 2): 0x1f0a→1ee8 add y,si
  }
  const seen = new Set<number>();
  const cells: SprayCell[] = [];
  for (let i = 0; i < N; i++) {
    let x = ox;
    let y = oy;
    let weight = SPRAY_SLOPE_CURVE[i]!;
    const pdx = i < 10 ? plx : -plx;
    const pdy = i < 10 ? ply : -ply;
    for (let step = 0; step < 2 * MAX_PX; step++) {
      if (x < 0 || x > MAX_PX - 2 || y < 0 || y > MAX_PX - 2) break; // clip (fin del rayo)
      if ((y & 1) === 1) {
        // Fila impar (0x1bb0 1c03): píxel→celda + LOS + registro con dedupe.
        const cx = x >> 4;
        const cy = y >> 4;
        if (opaque(cx, cy)) break; // 1dfb je 0x1e68: corta SIN registrar la celda opaca
        const key = cy * 32 + cx; // mapa 0xab02: bx = y*32 + x (1e21-1e2d)
        if (
          cells.length < MAX_CELLS && // cap 63 (1dff): sin hueco se sigue trazando sin registrar
          cx >= 0 && cx < GRID && cy >= 0 && cy < GRID && // bounds (1e05-1e1f)
          !seen.has(key)
        ) {
          seen.add(key);
          cells.push({ x: cx, y: cy }); // registro + marca 0xff (1e34-1e60)
        }
      }
      weight -= 10; // 0x1e7d
      x += ax;
      y += ay;
      if (weight < 1) {
        x += pdx; // paso perpendicular (0x1ea0-0x1f14)
        y += pdy;
        weight += SPRAY_SLOPE_CURVE[i]!; // recarga (0x1eea-0x1ef4)
      }
    }
  }
  return cells;
}
