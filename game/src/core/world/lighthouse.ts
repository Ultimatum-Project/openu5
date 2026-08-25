/**
 * HAZ DEL FARO — `lighthouse_beam_rotate_anim` (ULTIMA.EXE 0x70a6) + su estampador
 * de rayos (0x7040). Ficha #326 (derivación en re/notes/efectos-visuales-326.md §1,
 * re-verificada sobre este árbol; bloqueo #256 caído en b5f98734).
 *
 * MECÁNICA (0x70a6, cuerpo leído entero 0x70a6-0x71a8; llamador único 0x5951
 * dentro de viewport_redraw 0x5910, resuelto por banda con control positivo):
 *   · El haz NO pulsa: GIRA. 16 rayos de brújula (tabla DS 0x1f7e, abajo) y una
 *     CUÑA de 3 encendida; por cada redibujo se apaga el rayo de la fase `p`
 *     (0x7132-0x715e, valor 0) y se enciende el `p+3` (0x7161-0x7199, valor 0xff;
 *     el `+3` = `inc [0x2186]` en 0x7161 + `add ax,2` en 0x716a) ⇒ tras el paso
 *     el conjunto encendido es {p', p'+1, p'+2} con p' = fase nueva.
 *   · ACTIVACIÓN (0x70c1-0x70fe): con fase inactiva (0xff) el primer redibujo
 *     nocturno la pone a 0 y enciende los rayos 0,1,2 de golpe.
 *   · PUERTA DE SALIDA (0x70a6-0x70b9): `g_light_level >= 0x32` (día) o sin
 *     emisor ([0x217e] == -1) ⇒ fase = 0xff y no se estampa nada.
 *   · WRAP (0x719c-0x71a3): fase > 0xf → 0. El índice de rayo que recibe 0x7040
 *     se reduce mod 16 (idiv 0x10 en 0x705c) ⇒ el `p+3` envuelve solo.
 *   · DESTINO (0x7091): `[((dy+emisor_y)<<5) + dx + emisor_x + 0xAD14]` — el haz
 *     estampa en el MISMO buffer de celdas iluminadas que consultan las tres
 *     ramas del pase de la party (5c29/5c40/5c8c). El faro no es un sprite: es
 *     una FUENTE DE LUZ que barre. 0xAD14 se reconstruye solo al cargar mapa o
 *     al cambiar emisores (0x5e4a; censo de llamadores por banda, control verde),
 *     NO en cada redibujo ⇒ la cuña ACUMULA entre redibujos, y el modelo
 *     unión-de-3-rayos es EXACTO (simulado 40 pasos contra el sellado
 *     incremental off/on del asm: idéntico; ningún rayo comparte celda con sus
 *     3 sucesores). El test de esta equivalencia vive en
 *     tests/lighthouse-beam.test.ts.
 *   · Cada llamada activa fuerza el RECÁLCULO del viewport (0x70bc escribe
 *     g_unk_24e6 = 1) — en el port: invalidar el visCache y repintar.
 *   · CERO RNG: 9 llamadas, las 9 a 0x7040; ninguna a rand_range.
 *   · CONGELADO por An Tym: la llamada 0x5951 vive dentro del bloque que el
 *     latch [0x5891] se salta con `g_time_spell == 'T'` (0x591d/5938) — la fase
 *     no avanza y la cuña queda quieta (el buffer persiste).
 *   · Sale de COMBATE con fase 0xff (COMBAT.OVL 0x0d22) ⇒ re-activación.
 *
 * EMISORES:
 *   · Mapas pequeños: TOWN.OVL 0x0477-0x04e8 barre el 32×32 (x fuera, y dentro)
 *     buscando el tile 0x2a (LighthouseLight) y apunta los DOS primeros en
 *     [0x217e]/[0x2180] y [0x2182]/[0x2184] (-1 = vacío).
 *   · Overworld: OUTSUBS.OVL 0x0267-0x02c2 busca el tile 0x1b (Lighthouse) en el
 *     chunk activo (memchr sobre 0x6608; x = (idx&0xf) + 16·bit8,
 *     y = ((idx&0xf0)>>4) + 16·bit9) — UN emisor.
 *   El port no mantiene chunk: barre la envolvente ventana±BEAM_REACH (mismo
 *   argumento de equivalencia que EMITTER_REACH, #252) y respeta el tope de 2.
 *
 * CADENCIA: 0x70a6 corre UNA vez por pasada de viewport_redraw (0x5951), la
 * misma pasada que llama al intérprete de animación de terreno 0x4552 (0x5941).
 * El port ya calibra esa pasada en la piel fiel (ANIM_TICK_MS·2 = 110 ms,
 * fiel/skin.ts «el intérprete corre a la mitad del tick base»): BEAM_STEP_MS
 * comparte esa calibración, no estrena constante.
 */
import { WINDOW } from "./visibility.js";

/** Tile emisor en mapas PEQUEÑOS (TOWN.OVL 0x04ca `cmp byte [bx], 0x2a`). */
export const LIGHTHOUSE_LIGHT_TILE = 0x2a;
/** Tile emisor en el OVERWORLD (OUTSUBS.OVL 0x026b: memchr de 0x1b en el chunk). */
export const LIGHTHOUSE_TILE = 0x1b;
/** Puerta de día: haz apagado con `g_light_level >= 0x32` (0x70a6 `jae`). */
export const BEAM_DAY_GATE = 0x32;
/** Fase inactiva (0x70b4 `mov byte [0x2186], 0xff`). */
export const BEAM_INACTIVE = 0xff;
/** Nº de rayos de la rosa (0x7056 `mov cx,0x10` + idiv). */
export const BEAM_RAY_COUNT = 16;
/** ms por paso del haz = una pasada de viewport_redraw (ver CADENCIA arriba). */
export const BEAM_STEP_MS = 110;

/**
 * Tabla de rayos DS 0x1f7e (DATA.OVL file 0x1f8e, delta +0x10; 16 rayos × 32 B =
 * 16 pares (dx,dy) en bytes CON SIGNO, relleno (0,0)). Paso entre rayos = `shl 5`
 * (0x7064-0x7068); 16 entradas por rayo = `mov [bp-8], 0x10` (0x7071). El relleno
 * (0,0) estampa la celda del PROPIO emisor — con el haz activo, la torre siempre
 * está en el buffer. Byte a byte contra DATA.OVL en tests/lighthouse-beam.test.ts.
 */
export const BEAM_RAYS: readonly (readonly (readonly [number, number])[])[] = [
  [[-1, -2], [-1, -3], [-2, -3], [-2, -4], [-2, -5], [-2, -6], [-2, -7], [-3, -5], [-3, -6], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 0 (NNO)
  [[0, -1], [0, -2], [0, -3], [0, -4], [0, -5], [0, -6], [0, -7], [-1, -4], [-1, -5], [-1, -6], [-1, -7], [1, -4], [1, -5], [1, -6], [1, -7], [0, 0]], // rayo 1 (N)
  [[1, -2], [1, -3], [2, -3], [2, -4], [2, -5], [2, -6], [2, -7], [3, -5], [3, -6], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 2 (NNE)
  [[1, -1], [2, -2], [3, -3], [3, -4], [4, -3], [4, -4], [4, -5], [4, -6], [5, -4], [5, -5], [6, -4], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 3 (NE)
  [[2, -1], [3, -1], [3, -2], [4, -2], [5, -2], [5, -3], [6, -2], [6, -3], [7, -2], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 4 (ENE)
  [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [4, -1], [5, -1], [6, -1], [7, -1], [4, 1], [5, 1], [6, 1], [7, 1], [0, 0]], // rayo 5 (E)
  [[2, 1], [3, 1], [3, 2], [4, 2], [5, 2], [5, 3], [6, 2], [6, 3], [7, 2], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 6 (ESE)
  [[1, 1], [2, 2], [3, 3], [4, 3], [4, 4], [4, 5], [5, 4], [5, 5], [6, 4], [3, 4], [4, 6], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 7 (SE)
  [[1, 2], [1, 3], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [3, 5], [3, 6], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 8 (SSE)
  [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 4], [1, 5], [1, 6], [1, 7], [-1, 4], [-1, 5], [-1, 6], [-1, 7], [0, 0]], // rayo 9 (S)
  [[-1, 2], [-1, 3], [-2, 3], [-2, 4], [-2, 5], [-2, 6], [-2, 7], [-3, 5], [-3, 6], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 10 (SSO)
  [[-1, 1], [-2, 2], [-3, 3], [-3, 4], [-4, 3], [-4, 4], [-4, 5], [-4, 6], [-5, 4], [-5, 5], [-6, 4], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 11 (SO)
  [[-2, 1], [-3, 1], [-3, 2], [-4, 2], [-5, 2], [-6, 2], [-7, 2], [-5, 3], [-6, 3], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 12 (OSO)
  [[-1, 0], [-2, 0], [-3, 0], [-4, 0], [-5, 0], [-6, 0], [-7, 0], [-4, 1], [-5, 1], [-6, 1], [-7, 1], [-4, -1], [-5, -1], [-6, -1], [-7, -1], [0, 0]], // rayo 13 (O)
  [[-2, -1], [-3, -1], [-3, -2], [-4, -2], [-5, -2], [-6, -2], [-7, -2], [-5, -3], [-6, -3], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 14 (ONO)
  [[-1, -1], [-2, -2], [-3, -3], [-3, -4], [-4, -3], [-4, -4], [-4, -5], [-4, -6], [-5, -4], [-5, -5], [-6, -4], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // rayo 15 (NO)
];

/**
 * Alcance máximo de un rayo en casillas cardinales (máx |dx|,|dy| de la tabla).
 * DERIVADO de BEAM_RAYS, no literal — la envolvente de barrido de emisores
 * (ventana±BEAM_REACH) le sigue si la tabla cambiase. Vale 7.
 */
export const BEAM_REACH: number = BEAM_RAYS.reduce(
  (m, ray) => ray.reduce((n, [dx, dy]) => Math.max(n, Math.abs(dx), Math.abs(dy)), m),
  0,
);

/**
 * Un paso de fase = una pasada de viewport_redraw con el haz activo:
 * activación 0xff→0 (0x70c8) o avance p→p+1 con wrap 15→0 (0x7161 + 0x719c).
 */
export function advanceBeamPhase(phase: number): number {
  if (phase === BEAM_INACTIVE) return 0;
  const next = phase + 1;
  return next > 0xf ? 0 : next;
}

/**
 * Celdas de VENTANA iluminadas por el haz: unión de los rayos {p, p+1, p+2}
 * (mod 16) de cada emisor — equivalente EXACTO al buffer acumulado del asm (ver
 * cabecera). `emitters` en coordenadas de ventana (pueden caer fuera de 0..10);
 * sólo se devuelven índices dentro de la ventana. Fase inactiva o sin emisores
 * → undefined (nada que fusionar con el buffer de luces).
 */
export function beamLitWindowCells(
  emitters: readonly (readonly [number, number])[],
  phase: number,
): ReadonlySet<number> | undefined {
  if (phase === BEAM_INACTIVE || emitters.length === 0) return undefined;
  const lit = new Set<number>();
  for (const [ex, ey] of emitters) {
    for (let i = 0; i < 3; i++) {
      for (const [dx, dy] of BEAM_RAYS[(phase + i) % BEAM_RAY_COUNT]!) {
        const col = ex + dx;
        const row = ey + dy;
        if (col >= 0 && row >= 0 && col < WINDOW && row < WINDOW) {
          lit.add(row * WINDOW + col);
        }
      }
    }
  }
  return lit;
}
