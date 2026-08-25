/**
 * REFLEJO EN EL ESPEJO — el espejo de pueblo enseña una figura cuando hay un actor
 * PLANTADO JUSTO AL SUR. Capa de VISTA pura: `render/` puede leer `core/tiles` (Regla C
 * del guard de costuras); `skin/coreview` lo importa desde aquí, como `masonry-passage.ts`
 * y `floor-underlay.ts`. Reporte del usuario del 12-08-2026 (ficha #199): el port no
 * pintaba NADA — no había un solo consumidor de `MirrorAvatar` en todo `game/src`.
 *
 * ── DERIVACIÓN (ULTIMA.EXE, un único escritor en TODO el desensamblado) ────────────────
 * 🔴 El censo se enuncia con la unidad correcta: el TOKEN `0x9e` sale nueve veces en los 28
 * `.asm`, pero siete no son el tile (cinco `je 0x9e` de salto, dos `[bp - 0x9e]` de pila).
 * Como INMEDIATO DE TILE aparece dos veces, las dos en `ULTIMA.EXE`, y sólo una lo escribe:
 *
 *   531a: 3d9e00     cmp ax, 0x9e            ; despacho por el TERRENO bajo el actor
 *   531f: 3d9d00     cmp ax, 0x9d
 *   532c: ff7608     push word ptr [bp + 8]  ; X
 *   532f: 8b4606     mov ax, word ptr [bp + 6]
 *   5332: 48         dec ax                  ; ← Y − 1: la celda del NORTE
 *   5334: e8cbf0     call 0x4402             ; get_tile_ptr(y, x) sobre el mapa
 *   5339: 803f9d     cmp byte ptr [bx], 0x9d ; ¿el vecino del norte es Mirror (VACÍO)?
 *   533c: 7532       jne 0x5370              ;   no → salida normal
 *   533e: 837e0a00   cmp word ptr [bp + 0xa], 0
 *   5342: 742c       je 0x5370               ; fila 0 de la ventana → no hay dónde pintar
 *   534e: c680e2aa9e mov byte ptr [bx+si-0x551e], 0x9e   ; ← ESCRIBE MirrorAvatar
 *
 * La rutina es `ULTIMA.EXE:0x51b8`, el colocador de UN actor en la ventana; la llama el
 * bucle `0x5394` (`call 0x51b8` en `0x55fe`) recorriendo las ranuras de actor de arriba
 * abajo — el party es la ranura 0 y se pinta LA ÚLTIMA.
 *
 * 🔴 QUÉ COORDENADA ES CUÁL, porque leerlo al revés invierte el fix entero. `get_tile_ptr`
 * (`0x4402`) multiplica su PRIMER argumento por 32 (`4414: shl ax, 5` / `44a3: shl ax, 5`,
 * mapa de pueblo 32×32 en `DS:0x6608`) ⇒ ese argumento es la FILA. El llamador empuja
 * `[bp+8]` y luego `[bp+6]−1`, y el último empujado es el primer parámetro ⇒ `[bp+6]` = Y.
 * Y el destino de la escritura confirma lo mismo por el otro lado: `-0x551e` es
 * `-0x54fe − 0x20`, es decir el búfer de terreno visible `g_vis_buffer` (`DS:0xAB02`,
 * stride 32 — nombrado así en `re/notes/kernel-sweep-2.md:113`) UNA FILA MÁS ARRIBA con
 * el mismo `si = fila·32` y el mismo `bx = columna`. Las dos lecturas dan NORTE.
 *
 * ⇒ El reflejo se pinta en la CELDA DEL ESPEJO, no en la del actor, y el disparador es
 *   estar en la celda de DEBAJO. La ventana es 11×11 (`54a7: cmp [bp-6], 0xa` /
 *   `54b0: cmp [bp-8], 0xa`, el mismo `VIEW_WINDOW = 11` del port).
 *
 * ── QUÉ ACTORES REFLEJAN — la puerta de `0x51bf`, sobre el sprite ────────────────────
 * El argumento `[bp+4]` es el índice de sprite MENOS 0x100 (los sprites de actor viven en
 * `0x100-0x1ff`). La descodificación se comprueba sola en las otras ramas de la misma
 * rutina: terreno `0x84/0x85` → sprite `0x60+r`/`0x64+r` = `PersonStocks`/`WallPrisoner`,
 * y silla `0x92` con comida al norte → `0x34+r` = `SitChairDownEat`. Cuadran los tres.
 *
 *   51bf: cmp [bp+4], 0x1c ; je  → PASA          0x11c BasicAvatar
 *   51c5: cmp [bp+4], 0x12 ; jl  → 51d1
 *   51cb: cmp [bp+4], 0x16 ; jl  → PASA          0x112-0x115 caballo y alfombra CON jinete
 *   51d1: cmp [bp+4], 0x40 ; jge → PASA          0x140-0x1ff TODO NPC y criatura
 *   51d7: cmp [bp+4], 0x28 ; jge → 51e0
 *   51dd: jmp 0x5370       ; RECHAZA             < 0x28
 *   51e0: cmp [bp+4], 0x2c ; jl  → PASA          0x128-0x12b esquife
 *   51e6: jmp 0x5370       ; RECHAZA             0x12c-0x13f
 *
 * Lo que sale es una regla con sentido: refleja LA FIGURA ERGUIDA. Pasan el Avatar a pie,
 * montado, en alfombra y en esquife, y todos los NPC y criaturas. NO pasan los objetos
 * (`0x101-0x10f`), el caballo SIN jinete (`0x110/0x111`), los BARCOS (`0x120-0x127`), los
 * barcos pirata (`0x12c-0x12f`) ni las poses de estar SENTADO o TUMBADO (`0x130-0x13b`
 * SitChair*, `0x11a` SleepingInBed) — sentarse en la silla de delante del espejo apaga el
 * reflejo. Tampoco el propio `0x13c-0x13f LordBritishMirror`, así que un reflejo no
 * engendra otro.
 *
 * 🔴 NO HAY EXCEPCIÓN DE SHADOWLORD, y la ficha #199 la daba por hecha («es TRAMA: los
 * Shadowlords no se reflejan»). MEDIDO y NEGATIVO: los Shadowlords son `0x1fc-0x1ff`
 * ⇒ byte bajo `0xfc-0xff` ⇒ caen de lleno en el `jge 0x40` que PASA. Y no puede haber otra
 * vía con la excepción dentro, porque el censo de arriba (inmediato de tile, no token) da UN
 * escritor de `0x9e` y es este. Lo que SÍ hay en la banda rechazada es `0x11d Apparition`:
 * la aparición no se refleja. Se declara como pertenencia MEDIDA a la banda
 * `0x116-0x11b/0x11d-0x127`, no como intención acreditada del autor de 1988.
 *
 * ── ALCANCE ───────────────────────────────────────────────────────────────────────────
 * El reflejo va al búfer de TERRENO, no al de actores (`DS:0xAC64`, stride 16): es un
 * cambio de la celda del espejo POR FOTOGRAMA, no una escritura al mapa. El mapa NO se
 * toca — a diferencia de romper el espejo, que sí escribe el byte (`TOWN.OVL:0x0a5f
 * mov byte ptr [bx], 0x9f`, MirrorBroken, sobre el puntero de `get_tile_ptr`; eso es otra
 * ficha, el port tampoco lo tiene). Por eso aquí se pintan las DOS capas del port
 * (`window` y `terrainWindow`): las dos son terreno para sus consumidores.
 */
import { TILE_INFO } from "../core/tiles.js";

/** Los dos tiles del par, por NOMBRE — un re-vendorizado que mueva índices no deja esto
 *  apuntando a otro sitio en silencio (mismo criterio que `masonry-passage.ts`). */
function tileByName(name: string): number {
  const id = TILE_INFO.findIndex((t) => t && t.name === name);
  if (id < 0) throw new Error(`mirror-reflection: TileData sin tile «${name}»`);
  return id;
}

/** `0x9d Mirror` — el espejo VACÍO, el que dispara la sustitución. */
export const MIRROR_TILE: number = tileByName("Mirror");
/** `0x9e MirrorAvatar` — el espejo CON la figura dentro. */
export const MIRROR_AVATAR_TILE: number = tileByName("MirrorAvatar");

/**
 * Bandas del byte bajo del sprite que PASAN la puerta de `ULTIMA.EXE:0x51bf`, transcritas
 * una a una desde los `cmp` (inclusivas por los dos extremos).
 */
export const REFLECTING_SPRITE_BANDS: readonly (readonly [number, number])[] = [
  [0x12, 0x15], // caballo / alfombra CON jinete
  [0x1c, 0x1c], // BasicAvatar (excepción explícita dentro de una banda rechazada)
  [0x28, 0x2b], // esquife
  [0x40, 0xff], // todo NPC y criatura
];

/**
 * ¿El sprite de este actor produce reflejo? `sprite` es el índice COMPLETO del port
 * (`0x100-0x1ff` para actores); la puerta del binario mira el byte bajo.
 */
export function reflectsInMirror(sprite: number): boolean {
  if (sprite < 0x100 || sprite > 0x1ff) return false;
  const low = sprite & 0xff;
  return REFLECTING_SPRITE_BANDS.some(([lo, hi]) => low >= lo && low <= hi);
}

/**
 * Predicado COMPLETO del reflejo, con las tres condiciones del binario en el mismo orden
 * en que las comprueba: la celda del norte es un espejo vacío, hay fila donde pintar, y el
 * sprite pasa la puerta. `row` es la fila del actor DENTRO de la ventana 11×11.
 *
 * El caller pinta `MIRROR_AVATAR_TILE` en `(col, row − 1)`.
 */
export function paintsMirrorAvatar(
  sprite: number,
  row: number,
  northMapTile: number,
): boolean {
  if (northMapTile !== MIRROR_TILE) return false; // 0x5339
  if (row <= 0) return false; // 0x533e — sin fila al norte no hay dónde escribir
  return reflectsInMirror(sprite); // 0x51bf
}
