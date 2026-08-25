/**
 * In Por (índice 17, «blink») — la rama de EXTERIOR. #182 D2
 *
 * El handler `CAST.OVL:0x05DC` se parte en dos por la ubicación, y la rama que el clon
 * NO tenía es la de fuera de combate:
 *
 * ```
 * 05e9: cmp byte ptr [g_location], 0x7f
 * 05ee: ja 0x5f3          ← > 0x7f = COMBATE  (la única que el port modelaba)
 * 05f0: jmp 0x680         ← <= 0x7f = EXTERIOR
 * ```
 *
 * La ventana temporal acota más: `TIME_PERMITTED_BITS[17] = 0x09` = combate | EXTERIOR
 * (`tables.ts`), o sea que la rama de 0x0680 sólo corre con `g_location == 0` — el
 * overworld. En pueblo y mazmorra el dispatcher ya corta con «Not here!» antes de llegar.
 *
 * LA RAMA ENTERA (0x0680-0x0746), leída del cmp citado a su punto de reunión:
 *
 * ```
 * 0680: call 0xffffc162  → CS 0x80e2 = stub CAST2.OVL:0x0306 = el GETDIR («Direction-»
 *                          DS 0x9504; N/E/S/O escriben g_cmb_scratch_x/y en 0x036c-0x03a5)
 * 0683: or ax,ax / 0685: jne 0x68e
 * 0687: mov ax,0xffff / 068a: jmp 0x746     ← ★ CANCELAR (Space, DS 0x952c «Pass») → −1
 * 068e: mov ax,3 / 0692: call 0xffffc186    → CS 0x8106 = stub CAST2.OVL:0x0000 (animación)
 * 0695-06ac: PASO = g_cmb_scratch − g_party   (el getdir dejó party ± 1 en un eje)
 * 06af-06d2: xMax = min(g_chunk_origin_x + 0x20, 0x100) · yMax = min(g_chunk_origin_y + 0x20, 0x100)
 * 06de-06e8: si/di ARRANCAN en g_cmb_scratch (la celda de al lado, NO la del party)
 * 06ea: jmp 0x728  ← se entra POR EL TEST, no por el cuerpo
 *   0728: cmp si, g_chunk_origin_x / 0732: jae 0x6ec   (si < origen ⇒ FIN)
 *   06ec: cmp si,[bp-0xc]  / jge 0x734                 (si >= xMax  ⇒ FIN)
 *   06f1: cmp di, g_chunk_origin_y / jb 0x734          (di < origen ⇒ FIN)
 *   06fd: cmp di,[bp-0xe]  / jge 0x734                 (di >= yMax  ⇒ FIN)
 *   0702: push si / push di / 0704: call 0x8482        (tile_addr: puntero al terreno)
 *   0709: cmp byte ptr [bx], 5 / 070c: jne 0x722       ← ★ tile 5 = GRASS
 *   070e: [bp-0xa] = 0xffff
 *   0713: mov byte [g_party_x], al · 071a: mov byte [g_party_y], al
 *   071d: mov byte [g_unk_24e6], 1                     ← turno consumido
 *   0722: si += paso.x · 0725: di += paso.y            ← ★ NO hay `break`
 * 0734: [bp-8]=di / [bp-6]=si
 * 073a: cmp [bp-0xa],0 / je 0x743
 * 0740: call 0xffffbbfe → CS 0x7b7e = stub MAINOUT.OVL:0x0000 (recarga del exterior)
 * 0743: ax = [bp-0xa]   (0 = no se movió · 0xffff = teleportó)
 * ```
 *
 * ★★ EL RAYO NO SE PARA EN LA PRIMERA HIERBA. Tras escribir la posición en 0x0713/0x071a
 * el flujo cae a 0x0722 y SIGUE avanzando: cada casilla de hierba posterior SOBRESCRIBE
 * la anterior. El destino es por tanto **la ÚLTIMA casilla de hierba del rayo dentro de la
 * ventana de chunks**, no la primera. Es el discriminador de esta derivación: un port
 * «razonable» pararía en la primera.
 *
 * ★ LOS LÍMITES SON LA VENTANA DE CHUNKS, NO EL MAPA. `g_chunk_origin_x/y` es el rincón
 * de la caché 32×32 (`chunk-origin.ts`, ya portado y MANTENIDO por paso en
 * `movement.ts:207`), así que el alcance del blink depende de dónde esté la ventana —
 * y por eso el binario, al acertar, llama a MAINOUT:0x0000, cuyo tramo 0x0019-0x004c es
 * exactamente `initChunkOrigin`: RE-DERIVA la ventana alrededor del nuevo sitio.
 *
 * ⚠ RESIDUO DECLARADO: MAINOUT:0x0000 es la recarga ENTERA del exterior y hace más cosas
 * (`[0x5956]=1`, `g_unk_58a4=1`, `g_sail_dir=0` en 0x000e-0x0014, más los repintados). De
 * ese bloque aquí sólo se porta la re-derivación del origen, que es la única pieza que el
 * clon ya modela; el resto es la misma recarga que el port no ejecuta en sus otras vías de
 * entrada al exterior, y no se inventa aquí.
 */

/**
 * Tile de HIERBA — el único destino válido del blink (0x0709 `cmp byte ptr [bx], 5`).
 * NO se exporta a propósito: si el test lo importara, su rojo pre-fix sería un error de
 * módulo y no una aserción (`failing-first-import-trap`). El test usa el literal con esta
 * misma cita.
 */
const BLINK_TARGET_TILE = 5;

/** Lado de la ventana de chunks (0x06b4 / 0x06c9 `add ax, 0x20`). */
const CHUNK_WINDOW = 0x20;

/** Techo de coordenada del overworld (0x06ba / 0x06cf `cmp ax, 0x100`). */
const COORD_MAX = 0x100;

/**
 * Destino del blink de exterior, o `null` si el rayo no cruza ninguna hierba.
 *
 * `px,py` = party · `dx,dy` = el paso del getdir (±1 en un eje) · `origin` =
 * `g_chunk_origin_x/y` · `tileAt` = lectura de terreno (el `tile_addr` de 0x0704).
 * El barrido arranca en `(px+dx, py+dy)` porque el getdir ya dejó ahí `g_cmb_scratch`.
 */
export function blinkDestination(
  px: number,
  py: number,
  dx: number,
  dy: number,
  origin: { x: number; y: number },
  tileAt: (x: number, y: number) => number,
): { x: number; y: number } | null {
  const xMax = Math.min(origin.x + CHUNK_WINDOW, COORD_MAX); // 0x06af-0x06c2
  const yMax = Math.min(origin.y + CHUNK_WINDOW, COORD_MAX); // 0x06c4-0x06d7
  let sx = px + dx; // 0x06de: si = g_cmb_scratch_x
  let sy = py + dy; // 0x06e5: di = g_cmb_scratch_y
  let found: { x: number; y: number } | null = null;
  // 0x06ea entra por el test de 0x0728; el resto de cotas van en la cabeza del cuerpo.
  while (sx >= origin.x && sx < xMax && sy >= origin.y && sy < yMax) {
    // 0x0709 `cmp byte ptr [bx], 5` / `jne 0x722`: SIN break — la última hierba gana.
    if (tileAt(sx, sy) === BLINK_TARGET_TILE) found = { x: sx, y: sy };
    sx += dx; // 0x0722
    sy += dy; // 0x0725
  }
  return found;
}
