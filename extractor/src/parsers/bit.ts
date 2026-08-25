/**
 * Decoder de los .BIT de la intro = los LOGOS DE ARRANQUE (video-diff E1,
 * adjudicado por render + review): **TITLE.BIT = "ORIGIN SYSTEMS INC."** (con la
 * rejilla/globo, a tamaños crecientes = zoom del arranque) y **BRITISH.BIT = la
 * firma cursiva "Lord British"** — NO el logo gótico "Ultima V" (ese es ULTIMA.16,
 * ver `pic16.ts`). Máscaras 1bpp que INTRO.OVL blitea sobre la portada (E1-S13c).
 *
 * DERIVACIÓN (asm de INTRO.OVL, sección de título 0x0b0b-0x0c97):
 *   - `[0x25ee]`=TITLE.BIT / `[0x25ec]`=BRITISH.BIT se cargan+descomprimen (LZW)
 *     con `call 0xffff8dee` → puntero al buffer descomprimido ([bp-0x10]/[bp-0x12]).
 *   - `call 0xffff8e84` los BLITEA por SUB-IMAGEN: `blit(x, y, subIndex, buffer)`
 *     — p.ej. 0x0b7e blitea sub-imagen 7 en (0x8c,0x6c); 0x0bd4, sub-imagen 8 en
 *     (0,0x98). El arg `subIndex` confirma que .BIT es un ARCHIVO indexado.
 *
 * FORMATO (verificado byte a byte: blk == ceil(w/8)·h + 4 EXACTO para TODAS las
 * sub-imágenes — a diferencia de .16, que usa offsets u32 y 4bpp):
 *   [u16 count][count × u16 offset]  (tabla de offsets, u16)
 *   cada sub-imagen: [u16 width][u16 height][máscara 1bpp, ceil(w/8) B/fila,
 *                    MSB = píxel izquierdo]
 * TITLE.BIT = 10 sub-imágenes: [0..6] = el logo ORIGIN SYSTEMS a tamaños crecientes
 * (24×3 … 280×61, la animación de zoom), y **[7]=«Presents» (104×33), [8]=«a» (16×15),
 * [9]=«Production» (112×33)** — los TEXTOS GÓTICOS blackletter de los cartones (task #67;
 * NO son PROPORT.PCS). BRITISH.BIT = 1 (272×62 = la firma "Lord British"). Máscara 1bpp.
 *
 * DERIVADO Y CITADO del asm (`re/notes/intro-blit-formats.md §1/§3.2`): el blit es
 * `gfx_blit_sel4e` (INTRO `call 0xffff8e84` → kernel 0x1044, SEL 0x4e → EGA.DRV
 * 0x190e), firma `blit(x, y, subIndex, buffer)` (`ret 8`, sin color) — el arg
 * `subIndex` confirma el archivo indexado (INTRO 0x0b7e/0x0bd4). Layout verificado
 * byte a byte: `span == ceil(w/8)·h + 4` en TODAS las sub-imágenes.
 *
 * COLOR (task #74, CORRIGE §3.2b del scout; redacción ajustada tras review): el
 * blit EGA.DRV 0x190e-0x19d0 pone el bit en los 4 planos, SIN argumento de color —
 * eso es correcto y fijo. El COLOR MOSTRADO en el original, medido del testigo de
 * runtime (vídeo P del usuario; re-medido por el reviewer con mediana por cluster):
 *   - ORIGIN SYSTEMS (TITLE.BIT): trazos AZUL BRILLANTE ≈(73,73,253) ≈ idx 9
 *     (0x5555FF) sobre negro puro — NO hay rejilla azul de fondo detrás; el
 *     "azul-cuadriculado" ES el logo (frames f005/f008/f009; f012 testigo débil).
 *   - "Lord British" (BRITISH.BIT): firma BLANCA (idx 15; frame f022).
 * MECANISMO INDETERMINADO (A/B, pregunta de oráculo F2): (A) ambas .BIT van a
 * idx 15 y la escena ORIGIN reprograma el registro de paleta de idx 15 a azul
 * (intro.md §226-227 documenta setup de registros 0x13ae-0x13ba UNA vez, no
 * por-escena — el "por escena" sería inferencia); o (B) el blit cae en índices
 * distintos según la escena. El "Presents" blanco coexistiendo en f008 NO
 * desambigua: es la sub-imagen [7] de TITLE.BIT (task #67), blanca (idx 15) por el
 * MISMO blitter SEL 0x4e — no la fuente proporcional. Desambiguar leyendo los registros
 * de paleta en DOSBox durante la escena ORIGIN vs la de LB (oráculo F2).
 * ⇒ El fix NO depende del mecanismo: `bitToPixels(onIndex)` hornea el color POR
 * TESTIGO por logo: ORIGIN=9, LB=15 (ver cli.ts). Válido bajo A y bajo B.
 * El default 15 se conserva para máscaras genéricas.
 */

import { u16le } from "./binary.js";

/** Una sub-imagen 1bpp: dimensiones + máscara (1 = píxel encendido), row-major. */
export interface BitImage {
  width: number;
  height: number;
  /** width*height bytes, 0/1 (1 = píxel de la forma). */
  mask: Uint8Array;
}

/**
 * Convierte una máscara 1bpp a una imagen de índices EGA (on → `onIndex`, off →
 * 0=negro) para empaquetarla en el atlas junto a las láminas .16. El color exacto
 * (marmolado del original) lo aplica el blitter del kernel → Clase C; por defecto
 * blanco (15).
 */
export function bitToPixels(img: BitImage, onIndex = 15): { width: number; height: number; pixels: Uint8Array } {
  const pixels = new Uint8Array(img.width * img.height);
  for (let i = 0; i < img.mask.length; i++) pixels[i] = img.mask[i] ? onIndex : 0;
  return { width: img.width, height: img.height, pixels };
}

/** Desempaqueta una máscara 1bpp (ceil(w/8) B/fila, MSB=izquierda). */
function unpackMask(d: Uint8Array, off: number): BitImage {
  const width = u16le(d, off);
  const height = u16le(d, off + 2);
  const rowBytes = Math.ceil(width / 8);
  const mask = new Uint8Array(width * height);
  let src = off + 4;
  for (let y = 0; y < height; y++) {
    for (let b = 0; b < rowBytes; b++) {
      const byte = d[src + b] ?? 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit;
        if (x >= width) break;
        mask[y * width + x] = (byte >> (7 - bit)) & 1; // MSB = píxel izquierdo
      }
    }
    src += rowBytes;
  }
  return { width, height, mask };
}

/**
 * Decodifica un .BIT (YA descomprimido de LZW) en sus sub-imágenes 1bpp. La tabla
 * de offsets u16 al inicio delimita cada una; cada sub-imagen lleva su w/h.
 */
export function parseBit(decompressed: Uint8Array): BitImage[] {
  const count = u16le(decompressed, 0);
  const images: BitImage[] = [];
  for (let i = 0; i < count; i++) {
    const off = u16le(decompressed, 2 + i * 2);
    if (off + 4 > decompressed.length) break;
    images.push(unpackMask(decompressed, off));
  }
  return images;
}
