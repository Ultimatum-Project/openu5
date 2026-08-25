/**
 * DECORACIÓN PROCEDURAL de pasillo 3D — GOTEO de estalactita + destello del
 * esqueleto (DUNGEON.OVL, careo decor-mazmorra wf_8648a9bf + re-disasm
 * 2026-07-25, instrucción a instrucción):
 *
 * ── Máquina de la GOTA `0x145c(prof, estado, y, x)` ──────────────────────────
 *   · estado==5 (0x145f-0x1486): SIN dibujo; SFX `call 0xc1de(0xc80, 0xdac, 1,
 *     0x14−8·prof)` y RESET a 0 (incondicional). [SFX = TICKET, ver abajo.]
 *   · estados 0-4 (0x14aa-0x14ce): CRUZ 3×3 en (x,y) — hline `0x8acc(x−1,y,x+1)`
 *     + vline `0x8b22(x,y−1,y+1)` — color `[0x13b2]` = 1 (DATA.OVL DS:0x13b2,
 *     azul EGA; medido en vídeo). Estado 4 (0x148a-0x14a4): color 3 ó 0xB según
 *     `g_unk_52c8` — bajo EGA `52c8∈{1,2}` (re/notes/intro.md, kernel-sweep-4
 *     0x0e94) → **0xB cian brillante** (el splash sobre el charco).
 *   · estados 0-3 (0x14d1-0x14e7): píxel central `0x8a94(x,y)` color
 *     `[0x13b2]+8` = 9 (azul brillante). El splash (4) NO lleva centro.
 *   · avance (0x14ea-0x14ff): estado 0 sólo con `rand(0,64)<4` (~6%/redibujo:
 *     la gota "cuelga"); estados 1-4 avanzan CADA redibujo (la caída es rápida).
 *     El original PERSISTE el estado en los 3 bits bajos del tile del mapa
 *     (write-back 0x15aa-0x15d4 / 0x1738-0x1762); aquí vive en la PIEL (Map por
 *     floor:x:y) y el RNG es de RENDER — divergencia sancionada clase
 *     monster-anim (re/notes/dungeon.md §12.11).
 *
 * ── Disparos en DUNGEON.OVL (sólo variante 1 = DNG1, tile&0xf0==0xC0) ────────
 *   · FRONTAL (fn_150a @0x155f-0x15d6): prof∈{1,2}; X=0x5f=95;
 *     Y=`[0x2e8b + prof·5 + estado]`+14 → prof1=[54,61,80,114,160],
 *     prof2=[60,64,76,96,123] (verificado byte-a-byte en DATA.OVL DS+0x10 y
 *     contra el LP: drip-montage-10fps.png mide y={54,62,80,114}+splash 156-164).
 *   · LATERAL (fn_1682 @0x16e0-0x1764): prof∈{0,1}; X= prof0→0x21=33,
 *     prof1→0x43=67; lado derecho espejado X=0xBE−X → 157/123;
 *     Y=`[0x2e9a + prof·5 + estado]`+14 → prof0=[28,37,64,112,173],
 *     prof1=[54,59,74,98,133].
 *
 * ── Destello del ESQUELETO (DNG3, fn_150a @0x15fa-0x165c) ────────────────────
 *   variante==3 ∧ 0xC0 frontal ∧ prof==1 ∧ rand(0,64)<4 → 4 hlines color
 *   `[0x13ae]+8` = 2+8 = **10 (verde brillante EGA)** en (92-93,87), (91-93,88),
 *   (97-98,87), (97-99,88) — transitorio (un redibujo), sin estado.
 *
 * TICKET SFX (no cableado): el cue de la gota `0xc1de(0xc80,0xdac,1,0x14−8·prof)`
 * exige derivar la primitiva destino del thunk 0xc1de y añadir un SfxId nuevo al
 * catálogo (core/sfx.ts) — fuera de este paquete; anotado en re/notes.
 */

// ── Tablas de posición (DATA.OVL, DS+0x10; +14 del binario YA aplicado) ───────
/** X de pantalla de la gota FRONTAL (0x5f @0x1584). */
export const DRIP_FRONT_X = 95;
/** Y frontal por [prof−1][estado 0..4] (0x2e8b, filas prof·5, +14). */
export const DRIP_FRONT_Y = [
  [54, 61, 80, 114, 160], // prof 1
  [60, 64, 76, 96, 123], // prof 2
] as const;
/** X lateral IZQUIERDA por prof 0/1 (0x16f9/0x16fe); derecha = 0xBE−X (0x170a). */
export const DRIP_SIDE_X = [33, 67] as const;
export const DRIP_SIDE_MIRROR = 0xbe; // 190
/** Y lateral por [prof][estado 0..4] (0x2e9a, +14). */
export const DRIP_SIDE_Y = [
  [28, 37, 64, 112, 173], // prof 0
  [54, 59, 74, 98, 133], // prof 1
] as const;

// Colores EGA (índices; el render los resuelve con la paleta compartida ega.ts).
/** Cruz de la gota, estados 0-3: `[0x13b2]` = 1 (azul). */
export const DRIP_COLOR = 1;
/** Píxel central, estados 0-3: `[0x13b2]+8` = 9 (azul brillante). */
export const DRIP_CENTER_COLOR = 9;
/** Splash (estado 4) bajo EGA (`g_unk_52c8`∈{1,2}): 0xB cian brillante. */
export const DRIP_SPLASH_COLOR = 0xb;
/** Destello del esqueleto: `[0x13ae]+8` = 10 (verde brillante). */
export const GLINT_COLOR = 10;

/** Rectángulo de píxeles a pintar con un índice de color EGA. */
export interface DecorRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

/**
 * Píxeles de la gota en `(x,y)` para `estado` 0..4 (máquina 0x145c): cruz 3×3
 * (hline+vline) + centro en 0-3. PURO (testeable sin canvas).
 */
export function dripRects(x: number, y: number, estado: number): DecorRect[] {
  const cross = estado === 4 ? DRIP_SPLASH_COLOR : DRIP_COLOR;
  const rects: DecorRect[] = [
    { x: x - 1, y, w: 3, h: 1, color: cross }, // hline 0x8acc(x−1, y, x+1)
    { x, y: y - 1, w: 1, h: 3, color: cross }, // vline 0x8b22(x, y−1, y+1)
  ];
  if (estado < 4) rects.push({ x, y, w: 1, h: 1, color: DRIP_CENTER_COLOR }); // 0x8a94
  return rects;
}

/** Posición de la gota FRONTAL (prof 1..2). */
export function dripFrontPos(prof: number, estado: number): { x: number; y: number } {
  return { x: DRIP_FRONT_X, y: DRIP_FRONT_Y[prof - 1]![estado]! };
}

/** Posición de la gota LATERAL (prof 0..1; lado derecho espejado 0xBE−X). */
export function dripSidePos(
  prof: number,
  side: "left" | "right",
  estado: number,
): { x: number; y: number } {
  const xl = DRIP_SIDE_X[prof]!;
  return { x: side === "right" ? DRIP_SIDE_MIRROR - xl : xl, y: DRIP_SIDE_Y[prof]![estado]! };
}

/**
 * Los 4 hlines del destello del esqueleto (0x1623-0x165c, coords LITERALES del
 * binario): (92-93,87), (91-93,88), (97-98,87), (97-99,88), color 10.
 */
export function glintRects(): DecorRect[] {
  return [
    { x: 0x5c, y: 0x57, w: 2, h: 1, color: GLINT_COLOR }, // 0x8acc(0x5c,0x57,0x5d)
    { x: 0x5b, y: 0x58, w: 3, h: 1, color: GLINT_COLOR }, // 0x8acc(0x5b,0x58,0x5d)
    { x: 0x61, y: 0x57, w: 2, h: 1, color: GLINT_COLOR }, // 0x8acc(0x61,0x57,0x62)
    { x: 0x61, y: 0x58, w: 3, h: 1, color: GLINT_COLOR }, // 0x8acc(0x61,0x58,0x63)
  ];
}

// ── CHISPAS del campo mágico (DUNGEON.OVL `magic_field_sparkle_drawer` @0x127e) ──
//
// Cuerpo leído entero 0x127e-0x1346 (204 B, `ret 4`; corte validado: `ret` en
// 0x1346, relleno `nop`, prólogo nuevo en 0x134a). Lo llama
// `feature_overlay_drawer_by_nibble` (@0x19f6-0x1a00) cuando el nibble alto del
// tile es 8.
//
// 🔴 LOS DOS ARGUMENTOS VAN AL REVÉS DE COMO LOS CITA EL CORPUS. El ledger y
// `asm100-censo-acta.md` §46.2/§46.3 dicen «color por PROFUNDIDAD, cuenta por
// tile&7». Es al revés, y los dos ejes son 0..3, así que la firma no lo
// desambigua sola. Lo decide el LLAMADOR: en 0x19f6 empuja PRIMERO su `[bp+4]`
// (= la profundidad, según su propia firma ya sellada) y DESPUÉS `tile & 7`, y
// en el callee el ÚLTIMO empujado es `[bp+4]` ⇒ el `switch` de 0x1292 (0,1,2,3)
// conmuta sobre el TIPO DE CAMPO, y las tablas se indexan por PROFUNDIDAD.
// Discriminante independiente que lo cierra: las cuatro tablas viven
// CONTIGUAS con paso de 8 B = CUATRO words cada una (no 8, que es lo que
// pediría `tile & 7`), y sus valores son MONÓTONOS en la distancia — que es
// justo lo que exige la perspectiva. El port ya coloreaba por tipo: acertaba en
// el eje y fallaba en los colores.
//
// Por chispa el binario gasta DOS tiradas de `rand_range`, y el dibujo entero se
// repite en CADA redibujo del pasillo — que en el original es una vuelta del
// sondeo de tecla (`dng_getkey`, asm100 §48.1). El consumo por partida es
// NO ACOTADO y depende del reloj de pared, igual que la NOTA-frontera de
// `core/game.ts`: aquí el azar es de RENDER, misma divergencia sancionada
// §12.11 que el goteo de arriba, y NO toca el stream del juego.

/** Nº de chispas por PROFUNDIDAD 0..3 (DS 0x2e52). Ojo: 300 en la celda de al lado. */
export const FIELD_SPARK_COUNT = [300, 100, 50, 15] as const;
/** Borde MENOR de la caja por profundidad (DS 0x2e42). */
export const FIELD_SPARK_LO = [16, 56, 80, 92] as const;
/** Borde MAYOR de la caja por profundidad (DS 0x2e4a). */
export const FIELD_SPARK_HI = [167, 135, 111, 99] as const;
/** Longitud del trazo por profundidad (DS 0x2e5a); el hline es INCLUSIVO ⇒ ancho = len+1. */
export const FIELD_SPARK_LEN = [7, 7, 5, 2] as const;
/**
 * Color por TIPO de campo (`tile & 7`), = global+8 del `add ax, 8` de 0x12b7:
 * [0x13b6]=2, [0x13b4]=1, [0x13ae]=2, [0x13b2]=1 leídos de DATA.OVL (DS+0x10).
 * Los dos primeros son lectura ESTÁTICA; 0x13ae y 0x13b2 los corroboró contra
 * vídeo el careo del goteo de este mismo fichero (GLINT_COLOR / DRIP_COLOR).
 * Sólo salen dos colores distintos: en 1988 las cuatro ranuras llevan 2,1,2,1.
 */
export const FIELD_SPARK_COLOR = [10, 9, 10, 9] as const;

/**
 * Las chispas de UN campo a `depth` (0..3) y `type` (`tile & 7`). PURO: `rand`
 * es `(lo, hi) => entero en [lo, hi]`, para poder sembrarlo en test.
 *
 * Calca el bucle de 0x12fb-0x1323: por chispa, x = rand(lo, hi−len) e
 * y = rand(lo, hi) — DOS tiradas, en ese orden — y un hline de (x, y) a (x+len, y).
 * La guarda de 0x12c8 (`cuenta <= 0` ⇒ no dibuja) se conserva aunque hoy
 * ninguna entrada de la tabla la active.
 */
export function fieldSparkRects(
  depth: number,
  type: number,
  rand: (lo: number, hi: number) => number,
): DecorRect[] {
  const n = FIELD_SPARK_COUNT[depth];
  const lo = FIELD_SPARK_LO[depth];
  const hi = FIELD_SPARK_HI[depth];
  const len = FIELD_SPARK_LEN[depth];
  if (n == null || lo == null || hi == null || len == null || n <= 0) return [];
  // El binario con un tipo fuera de 0..3 NO fija color y pinta con el que hubiera
  // en el pincel; el port no tiene pincel heredado, así que cae al del tipo 0.
  const color = FIELD_SPARK_COLOR[type] ?? FIELD_SPARK_COLOR[0]!;
  const rects: DecorRect[] = [];
  for (let i = 0; i < n; i++) {
    const x = rand(lo, hi - len);
    const y = rand(lo, hi);
    rects.push({ x, y, w: len + 1, h: 1, color });
  }
  return rects;
}

/**
 * Estado VIVO del decorado (propiedad de la piel, un Map por celda visible).
 * `rng` inyectable para test (default Math.random — RNG de render, divergencia
 * sancionada §12.11).
 */
export class DungeonDecorState {
  private states = new Map<string, number>();

  constructor(private rng: () => number = Math.random) {}

  /** `rand(0,64) < 4` del binario (0x9ec2 @0x14f0/0x1611). */
  private roll(): boolean {
    return Math.floor(this.rng() * 64) < 4;
  }

  /** Chispas del campo mágico de esta celda, con el azar de RENDER de la piel. */
  fieldSparks(depth: number, type: number): DecorRect[] {
    return fieldSparkRects(depth, type, (lo, hi) =>
      lo + Math.floor(this.rng() * (hi - lo + 1)),
    );
  }

  /**
   * Un paso de la máquina 0x145c para la celda `key`: devuelve el estado a
   * DIBUJAR este redibujo (null = frame de estado 5, sin dibujo) y avanza:
   * estado 0 sólo con rand(0,64)<4; 1-4 siempre; 5 → reset incondicional.
   */
  stepDrip(key: string): number | null {
    const st = this.states.get(key) ?? 0;
    if (st === 5) {
      // SFX del goteo aquí (cue 0xc1de) — TICKET, ver cabecera.
      this.states.set(key, 0);
      return null;
    }
    if (st !== 0 || this.roll()) this.states.set(key, st + 1);
    return st;
  }

  /** Destello del esqueleto: transitorio, sin estado — sólo la tirada. */
  rollGlint(): boolean {
    return this.roll();
  }
}
