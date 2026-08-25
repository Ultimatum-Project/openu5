/**
 * Vista de GEMA de mazmorra para la PIEL FIEL (E1-S9, bloque 2b).
 *
 * (V)iew-a-gem DENTRO de mazmorra (DNGLOOK 0x06a8 driver + `draw_gem_map_tile`
 * 0x0340): el core (`buildGemView`) entrega la rejilla 22×22 del FLOOD-FILL conectado
 * con la party (celdas no alcanzadas = -1, negras). Aquí se pinta cada celda por su
 * nibble ALTO con el GLIFO y el COLOR que el binario asigna en la jump-table de 16
 * (0x0670), más el marcador de la party. Distinta de la gema de overworld/pueblo
 * (gemmap-overworld.ts, task #76), que aquí NO se toca.
 *
 * CHARSET — la clave del calco al píxel (carril gem-glyphs): los ICONOS del gem de
 * mazmorra salen de **RUNES.CH** (font-runes.png), NO de IBM.CH — igual que el picker
 * Ready. PERO el MURO común (byte crudo 0xb0) sale de **IBM.CH** (glifo 0x7f = bloque
 * LLENO = el «blob» blanco), porque su rama es la ÚNICA que no conmuta de fuente.
 * Derivación de dos patas que coinciden:
 *  1. ASM: cada rama de `draw_gem_map_tile` dibuja con `call 0x742a` = kernel 0x16BA
 *     (base overlay 0xA290; 0x742a→0x16BA), el impresor que blitea 8 bytes del font
 *     ACTIVO por `code<<3` (0x16df, blit en 0x17f4). La SELECCIÓN de fuente la hace
 *     `0x7a0e(N)` = kernel 0x1C9E (`[0x5398] = tabla_fuentes[N]`): cada icono llama
 *     `0x7a0e(1)` → fuente 1 = RUNES antes de pintar. La rama de muro ==0xb0 (0x05f5)
 *     es la ÚNICA que NO llama a 0x7a0e → pinta 0x7f con la fuente por DEFECTO (0 = IBM),
 *     donde 0x7f es un bloque sólido. Verificado contra la referencia DOSBox (Doom f6):
 *     muros = bloques blancos LLENOS; iconos = dingbats RUNES.
 *  2. Volcado byte a byte de RUNES.CH vs IBM.CH: en RUNES los códigos de ICONO casan
 *     EXACTO — 0x73 = CAJA HUECA (sala), 0x60 = ROMBO/destello 4 lóbulos (party, medido
 *     en la referencia: rombo, no cruz), 0x2e/0x2d/0x2f = ESCALERA «H con peldaños» en
 *     TRES variantes, 0x74 = caja DENSA (muro decorado raro, sub!=0), 0x77 = puerta,
 *     0x75/0x76 = muros/secretas texturados. En IBM 0x7f = bloque sólido = el muro común.
 *
 * REGLA (3ª vez que RUNES-no-IBM muerde: Ready ×2, ahora gem): **todo glifo de UI del
 * juego, comprobar RUNES.CH ANTES que IBM.CH** — y OJO con `0x7a0e(N)`, que conmuta la
 * fuente activa por-glifo (una rama sin ese call usa la fuente 0 = IBM).
 *
 * TABLA DE PINTADO derivada del ASM (jump-table 0x0670, base 0xA290 → las 16 ramas
 * resuelven limpio; colores = índices de la paleta EGA fijados en INTRO.OVL 0x09ee:
 * 13ae=4 rojo, 13b0=0xf blanco, 13b2=1 azul, 13b4=2 verde, 13b8=0xe amarillo, 13ba=7
 * gris; el binario suma +8 para la variante brillante):
 *  - MURO (0xB): DOS casos (DNGLOOK 0x05ee `cmp raw,0xb0`). Byte crudo **0xb0** (sub 0,
 *    el 99% en los datos: 1926/1944 celdas) → **bloque blanco LLENO** (IBM 0x7f, la rama
 *    no conmuta a RUNES). Byte crudo **0xbX** (sub!=0, raro: 18 celdas en 8 mazmorras) →
 *    glifo **0x74** de RUNES (caja densa), blanco. Ambos en BLANCO (13b0). El core pasa
 *    el subtipo en `gv.sub` para distinguirlos; sin `sub` → bloque lleno (el caso común).
 *  - PASILLO (0x0), cofre-abierto (0x7), marcador (0x9): NO se pintan (fondo NEGRO).
 *  - escaleras (0x1/0x2/0x3): glifo 0x2e/0x2d/0x2f en GRIS (13ba). Las tres variantes
 *    (↑/↓/↕) son glifos RUNES distintos: postes verticales con travesaños («H»), con la
 *    barra base según sea subida/bajada/doble.
 *  - cofre (0x4): 0x70 AMARILLO (13b8); puerta (0xE): 0x77 AMARILLO.
 *  - SALA (0xA RoomsBroke / 0xF Room): glifo **0x73** (RUNES = CAJA HUECA) AMARILLO
 *    (13b8). El usuario lo identificó: «el cuadro amarillo con marco es una sala». Es el
 *    glifo real (no un strokeRect): el binario hace `mov ax,0x73; draw` (0x05c6). Celda
 *    FIJA del mundo → «ronda» a la party porque el display va centrado en el jugador.
 *  - fuente (0x5): AZUL brillante (13b2+8=9) — VECTOR (líneas, 0x048e), no un glifo del
 *    font; aquí se aproxima con primitiva (Clase C: el trazo exacto es vector).
 *  - trampa (0x6): glifo 0x72 (default de la rama 0x0554) ROJO brillante (13ae+8). Los
 *    subtipos (0x19/0x71/0x12 por byte crudo) colapsan al no tener el core más que el
 *    nibble alto → glifo representativo (Clase C).
 *  - muro especial (0xC): 0x75 AZUL (13b2). Secreta (0xD): glifo **0x76** AZUL — el
 *    binario SÍ la dibuja distinta (0x062e `mov ax,0x76; draw`), NO como muro; la revela
 *    en el gem (el gem de U5 destapa el trazado, secretas incluidas).
 *  - campo mágico (0x8): FRANJAS multicolor (0x0284, interno de DNGLOOK). **DERIVADO al
 *    píxel** (#88/T12): 8 `line` en cuatro pares de color (13b6/13ae/13b2/13b4, todos +8)
 *    con x de X+1 a X+6 ⇒ bandas de 2 filas y 1 px de sangrado a cada lado. Ver paintField.
 *  - party: glifo **0x60** (RUNES = rombo/destello de 4 lóbulos) VERDE brillante
 *    (13b4+8=0xa) SIEMPRE en el CENTRO del display (DNGLOOK 0x073e; el centro se
 *    pre-marca visitado en 0x0705 para que el flood no lo repise). Confirmado por el
 *    usuario: «la cruz verde es el jugador y va centrada».
 */
import type { FaithfulFont } from "./font.js";
import type { GemView } from "../api.js";
import { VIEWPORT } from "./frame.js";

// Paleta EGA 16: fuente única compartida (ega.ts, auditoría D2).
import { EGA_PALETTE as EGA } from "./ega.js";

/**
 * Nibble ALTO del tile → { glifo RUNES.CH, color EGA } (jump-table `draw_gem_map_tile`
 * DNGLOOK.OVL 0x0670). Sin entrada = celda que el original NO pinta (pasillo 0x0, cofre-abierto 0x7,
 * marcador 0x9) → fondo negro. Fuente 0x5 y campo 0x8 son VECTOR (no glifos) → se
 * pintan aparte con primitivas.
 */
const GLYPH: Record<number, { code: number; color: number }> = {
  0x1: { code: 0x2e, color: 0x7 }, // escalera ↑ — gris (13ba); RUNES 0x2e = «H» con travesaños
  0x2: { code: 0x2d, color: 0x7 }, // escalera ↓ — gris; RUNES 0x2d = «H» con base
  0x3: { code: 0x2f, color: 0x7 }, // escalera ↕ (doble) — gris; RUNES 0x2f = «H» barra arriba+abajo
  0x4: { code: 0x70, color: 0xe }, // cofre — amarillo (13b8)
  0x6: { code: 0x72, color: 0xc }, // trampa/foso — rojo brillante (13ae+8); default de la rama
  0xa: { code: 0x73, color: 0xe }, // sala (RoomsBroke) — amarillo; RUNES 0x73 = caja hueca
  // muro (0xB): NO va aquí — dos casos por subtipo (bloque lleno IBM 0x7f / RUNES 0x74),
  // ver WALL_DENSE + el bucle de pintado abajo.
  0xc: { code: 0x75, color: 0x1 }, // muro especial — azul (13b2)
  0xd: { code: 0x76, color: 0x1 }, // secreta — azul; el binario la dibuja distinta (0x76), no como muro
  0xe: { code: 0x77, color: 0xe }, // puerta — amarillo (13b8)
  0xf: { code: 0x73, color: 0xe }, // sala (Room) — amarillo; RUNES 0x73 = caja hueca
};

/** Nibble alto = muro (DNGLOOK 0x05da). El caso denso (sub!=0) usa el glifo 0x74 de RUNES. */
const WALL_TYPE = 0xb;
const WALL_DENSE = { code: 0x74, color: 0xf }; // RUNES caja densa, blanco (muro raro 0xbX)

/** Nibble alto de la party (marcador central, DNGLOOK 0x073e): glifo 0x60 verde. */
const PARTY_GLYPH = 0x60;
const PARTY_COLOR = 0xa; // verde brillante (13b4+8)

/** Fuente mágica (0x5): color azul brillante (13b2+8). Vector real → aproximación. */
const FOUNTAIN_COLOR = 0x9;
/** Campo mágico (0x8): los CUATRO colores del binario (0x0284), en su orden (#88/T12). */
const FIELD_STRIPES = [0xd, 0xc, 0x9, 0xa]; // magenta / rojo / azul / verde brillantes

/**
 * FUENTE DE VERDAD del COLOR de relleno por tipo de celda del gem de mazmorra (índice
 * EGA), derivada de `GLYPH`/`WALL`/`FOUNTAIN`/`FIELD` de arriba. `null` = celda que el
 * original NO pinta (pasillo 0x0, cofre-abierto 0x7, marcador 0x9) → NEGRO. La consume el
 * selector de mapa de debug (teleportPicker) para NO divergir de la gema; `picker-gemmap-
 * parity.test.ts` asevera que la tabla del picker coincide con ésta.
 */
export const DUNGEON_GEM_FILL: Readonly<Record<number, number | null>> = {
  0x0: null, // pasillo → negro
  0x1: GLYPH[0x1]!.color, // escalera ↑ gris
  0x2: GLYPH[0x2]!.color, // escalera ↓ gris
  0x3: GLYPH[0x3]!.color, // escalera ↕ gris
  0x4: GLYPH[0x4]!.color, // cofre amarillo
  0x5: FOUNTAIN_COLOR, // fuente azul brillante
  0x6: GLYPH[0x6]!.color, // trampa rojo brillante
  0x7: null, // cofre abierto → negro (el original no lo pinta)
  0x8: FIELD_STRIPES[0]!, // campo mágico (multicolor; primer color representativo)
  0x9: null, // marcador → negro (el original no lo pinta)
  0xa: GLYPH[0xa]!.color, // sala (RoomsBroke) amarillo
  [WALL_TYPE]: WALL_DENSE.color, // muro blanco macizo (0xf)
  0xc: GLYPH[0xc]!.color, // muro especial azul
  0xd: GLYPH[0xd]!.color, // secreta azul
  0xe: GLYPH[0xe]!.color, // puerta amarillo
  0xf: GLYPH[0xf]!.color, // sala amarillo
};

/**
 * Pinta el mapa de la gema de mazmorra en el viewport (176×176), centrado. Sólo aplica
 * a la variante de MAZMORRA (el llamador comprueba `gv.environment === "dungeon"` y le
 * pasa la fuente RÚNICA `runes`, no IBM). La geometría (ventana 22×22 del flood, celda
 * de 8 px, marcador) la fija el core (`buildGemView`, DNGLOOK 0x0340-0x03ef).
 */
export function paintGemMap(
  ctx: CanvasRenderingContext2D,
  runes: FaithfulFont,
  gv: GemView,
): void {
  const size = VIEWPORT.tile * VIEWPORT.tiles;
  ctx.fillStyle = "#000000";
  ctx.fillRect(VIEWPORT.x, VIEWPORT.y, size, size);

  const cols = gv.width;
  const rows = gv.height;
  // Celda que hace llenar la ventana el viewport, en múltiplos de 8 px del glifo RUNES.CH.
  const scale = Math.max(1, Math.floor(size / (Math.max(cols, rows) * 8)));
  const cell = scale * 8;
  const ox = VIEWPORT.x + Math.floor((size - cols * cell) / 2);
  const oy = VIEWPORT.y + Math.floor((size - rows * cell) / 2);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const type = gv.tiles[row]?.[col] ?? -1; // -1 (no alcanzada) y pasillo 0x0 = sin dibujo
      const px = ox + col * cell;
      const py = oy + row * cell;
      if (type === WALL_TYPE) {
        // Muro: byte crudo 0xb0 (sub 0) = bloque blanco LLENO (IBM 0x7f, la rama no conmuta
        // a RUNES); 0xbX (sub!=0) = caja densa RUNES 0x74. Sin `gv.sub` → bloque lleno.
        const wsub = gv.sub?.[row]?.[col] ?? 0;
        if (wsub === 0) {
          ctx.fillStyle = EGA[0xf]; // blanco (13b0) — equivale a IBM 0x7f (8×8 sólido)
          ctx.fillRect(px, py, cell, cell);
        } else {
          runes.drawGlyph(ctx, WALL_DENSE.code, px, py, scale, EGA[WALL_DENSE.color]);
        }
        continue;
      }
      if (type === 0x5) {
        paintFountain(ctx, px, py, cell); // vector (Clase C)
        continue;
      }
      if (type === 0x8) {
        paintField(ctx, px, py, cell); // franjas multicolor DERIVADAS (DNGLOOK 0x0284)
        continue;
      }
      const spec = GLYPH[type];
      if (spec) runes.drawGlyph(ctx, spec.code, px, py, scale, EGA[spec.color]);
    }
  }

  // Marcador de la party = glifo RUNES 0x60 (rombo/destello) VERDE en el centro del
  // display (DNGLOOK 0x073e, color 13b4+8=0xa; el centro se pre-marca visitado en 0x0705
  // para que el flood no lo repise). Se pinta ENCIMA de todo.
  const mx = ox + gv.marker.x * cell;
  const my = oy + gv.marker.y * cell;
  runes.drawGlyph(ctx, PARTY_GLYPH, mx, my, scale, EGA[PARTY_COLOR]);
}

/**
 * Fuente mágica (nibble 0x5): el binario la traza con líneas (0x048e, azul brillante).
 * Aproximación fiel-en-color (Clase C): un rombo hueco azul brillante centrado.
 */
function paintFountain(ctx: CanvasRenderingContext2D, px: number, py: number, cell: number): void {
  const c = cell / 2;
  ctx.strokeStyle = EGA[FOUNTAIN_COLOR];
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + c, py + 1.5);
  ctx.lineTo(px + cell - 1.5, py + c);
  ctx.lineTo(px + c, py + cell - 1.5);
  ctx.lineTo(px + 1.5, py + c);
  ctx.closePath();
  ctx.stroke();
}

/**
 * Campo mágico (nibble 0x8): franjas multicolor. **DERIVADO, no aproximado** (#88/T12) —
 * `DNGLOOK 0x0284` es un cuerpo lineal de ocho `line` horizontales, sin bucle, con la
 * ESCALA del binario (celda de 8×8):
 *
 *   filas +0,+1  color `[g_unk_13b6] + 8`  = EGA 13 (magenta claro)
 *   filas +2,+3  color `[g_unk_13ae] + 8`  = EGA 12 (rojo claro)
 *   filas +4,+5  color `[g_unk_13b2] + 8`  = EGA  9 (azul claro)
 *   filas +6,+7  color `[g_unk_13b4] + 8`  = EGA 10 (verde claro)
 *
 * ⇒ `FIELD_STRIPES` lleva los cuatro colores exactos en el mismo orden de arriba abajo, y
 * las bandas de `cell/4` reproducen los pares de 2 filas. Lo único que faltaba era el
 * SANGRADO LATERAL: el binario carga `si = [bp+6] + 6` y `di = [bp+6] + 1` y pinta cada
 * línea de `di` a `si`, o sea `x ∈ [X+1, X+6]` — **6 px de los 8 de la celda**, 1 px sin
 * pintar a cada lado. (Extremos INCLUSIVOS: 6 px, no 5; la convención está derivada en
 * `re/notes/caja-espejo-93.md`.)
 *
 * El gem se dibuja a `cell = scale·8`, así que ese 1 px del binario escala a `cell/8`.
 */
function paintField(ctx: CanvasRenderingContext2D, px: number, py: number, cell: number): void {
  const band = cell / FIELD_STRIPES.length;
  const inset = cell / 8; // 1 px por cada 8 de celda = el X+1 / X+6 de 0x0284
  for (let i = 0; i < FIELD_STRIPES.length; i++) {
    ctx.fillStyle = EGA[FIELD_STRIPES[i]!]!;
    ctx.fillRect(px + inset, py + Math.floor(i * band), cell - 2 * inset, Math.ceil(band));
  }
}
