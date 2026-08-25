/**
 * ENDGAME-FRAME (#34) — los RENDERERS de la ventana-frame del cierre en la piel fiel:
 * re-tinte VERDE de la sala, moongate rojo parcial + orb, disolución de píxeles a
 * pantalla completa, pantallas de historia (END1/END2.16) y pergamino (ENDSC.16).
 *
 * Fuentes de verdad por pieza (re/notes/endgame-derivation.md §ADENDA endgame-polish
 * + testigo 2:34):
 *  - Sala + sprites: HORNEADOS en `snap.window` por coreview (MISCMAPS.DAT[528:704]);
 *    aquí los datos del RECOLOR del tileset y los overlays (gate/orb).
 *  - ESCENA VERDE (GAP 2) — CALCO: el original NO re-tiñe el frame ni cambia la paleta;
 *    RECOLOREA EL TILESET EN RAM. endgame_main 0x0658 `push 1; call 0xffffcd0e` →
 *    residente 0x6f9e(1) → EGA.DRV fn36 (SEL 0x6c) con ax=4 (entry 0x2c4e): convierte el
 *    buffer de tiles a 4bpp empaquetado y pasa una LUT de 16 colores (tabla 0x2d4d, y su
 *    gemela <<4 en 0x2d3d) por los 22 tiles de una LISTA HARDCODED (0x2cb0-0x2d33,
 *    offset/0x80 = tile). Todo lo que se dibuje después (sala, moongate 0xdc, orb 0x108,
 *    fuego fn32) usa el tileset recoloreado. Aquí: `ENDGAME_RECOLOR_LUT` +
 *    `ENDGAME_RECOLOR_TILES` + `buildEndgameAtlas` (copia recoloreada del atlas, espejo
 *    de la mutación in-place del original). Explica el careo completo: cama azul→
 *    magenta/rojo-claro (LUT 1→5, 9→12), ladrillo/antorcha/mesa rojo-marrón→verde
 *    (4→2, 6→2), sillas amarillas SIN virar (14→14), espejo-arco 0x9d y muros 0x4d
 *    intactos (NO están en la lista), LB 0x17c magenta nativo (tampoco está).
 *  - Moongate ROJO (GAP 4): tile 0xdc del atlas RECOLOREADO (0xdc ∈ lista fn36: cuerpo
 *    azul-claro→rojo-claro = el «rectángulo rojo macizo» del testigo) con el blit
 *    PARCIAL anclado abajo de `moongateRevealRect` (misma primitiva 0x1112 de la fiel).
 *  - ORB (GAP 4 paso 2) — CALCO: el registro #6 se activa con tile 8 (ENDGAME 0x0968
 *    `mov al,8`); los actores de la cutscene dibujan `tile | 0x100` → sprite = tile
 *    0x108 del atlas (estallido AZUL de 16×16) que la lista fn36 recolorea a ROJO.
 *    Careo testigo 84-88 s: estallido rojo en la celda del gate ✓.
 *  - Disolución (GAP 5): el ORDEN viene ya computado (`dissolveOrder`, generador fn32
 *    derivado). MECANISMO (adenda): fn32 (SEL 0x60) con carry LIMPIO = PRESENT del
 *    backbuffer a pantalla con modo [0x539c] (la disolución es el present del
 *    backbuffer NEGRO en orden LFSR); el sitio exacto que arma el modo sigue abierto.
 *    Aquí se ENNEGRECEN los primeros K píxeles del orden sobre el frame pintado —
 *    consistente con el mecanismo derivado.
 *  - Historia (GAP 6) — CALCO del layout: láminas EXTRAÍDAS end1:0-2/end2:0-2 (una por
 *    página de END.DAT) + LAYOUT BYTE-DERIVADO de las tablas DATA.OVL DS 0x3da6-0x3e0b
 *    que la rutina de historia (ENDGAME.OVL 0x0000 — su bucle de 6 «filas» = las 6
 *    PANTALLAS) carga por página: posición del arte (0x3dfa=x/0x3e00=y, fichero
 *    0x3df4→END1/END2, sub-lámina 0x3dee), titulares de TEXT.16 (draws 0x00d6-0x0110 y
 *    0x01c4-0x01e2: The/Homecoming/Dream con x,y inmediatos) y las DOS BANDAS de texto
 *    justificado (globals 0x5146-0x5158 ← tablas 0x3da6/0x3da7/0x3db2/0x3db4; offsets
 *    de página en END.DAT = tabla 0x3dca, verificada contra los '{' del fichero).
 *  - Pergamino (GAP 7): fondo endsc:0 + líneas de questScroll; las 2 líneas RÚNICAS
 *    (`[E@QUE_@OF@[E@AVATAR` / `IS@FOREVER`, bytes de la fuente cinemática citados en
 *    re/notes/endgame.md §Pergamino) van con RUNES.CH.
 */
import type { EndgameSceneView } from "../api.js";
import type { FaithfulFont } from "./font.js";
import { FaithfulProportFont } from "./proport.js";
import { VIEWPORT, SCREEN_W, SCREEN_H } from "./frame.js";
import { moongateRevealRect } from "./moongate.js";
import { MOONGATE_TILE } from "./demo-scene.js";
import { indicesToRgba, rgbaToIndices } from "../../render/firenoise.js";

/** Lado de tile del atlas EGA (px de referencia). */
const TILE = 16;
/** Columnas del atlas tiles-ega.png (misma constante que skin.ts). */
const ATLAS_COLS = 32;
/** Lado de glifo de IBM.CH/RUNES.CH. */
const GLYPH = 8;

/** Rect de una sub-imagen dentro de un atlas del extractor. */
interface AtlasEntry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Recursos de la ventana-frame del cierre:
 *  - `img`/`entries`: atlas endgame-scenes.png (láminas END1/END2/ENDSC.16 extraídas).
 *  - `titles`: atlas intro-pics.png (los TITULARES góticos del cierre viven en TEXT.16:
 *    text16:0 «The», text16:4 «Homecoming», text16:5 «Dream» — mismos cartones que la
 *    intro; careo del strip contra el testigo 105-128 s).
 *  - `proport`: la fuente PROPORCIONAL (PROPORT.PCS) del render_justified_text — el
 *    texto de las pantallas de historia va JUSTIFICADO envolviendo la lámina (mismo
 *    motor que The Summoning; testigo w103/w122).
 */
export interface EndgameScenesPack {
  img: CanvasImageSource;
  entries: Record<string, AtlasEntry>;
  titles: { img: CanvasImageSource; entries: Record<string, AtlasEntry> } | null;
  proport: FaithfulProportFont | null;
}

/**
 * Lámina por PÁGINA de END.DAT (0-5): una sub-imagen por página EN ORDEN DE FICHERO
 * (careo del atlas contra el corpus: end1:0 sendero/círculo, end1:1 interior de casa,
 * end1:2 noche/sueño, end2:0 cámara del trono, end2:1 Blackthorn, end2:2 puerta roja).
 */
const ART_BY_PAGE = ["end1:0", "end1:1", "end1:2", "end2:0", "end2:1", "end2:2"] as const;

async function loadAtlas(
  jsonUrl: string,
  pngUrl: string,
): Promise<{ img: CanvasImageSource; entries: Record<string, AtlasEntry> } | null> {
  try {
    const res = await fetch(jsonUrl);
    if (!res.ok) return null;
    const json = (await res.json()) as { entries: ({ name: string } & AtlasEntry)[] };
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = pngUrl;
    });
    const entries: Record<string, AtlasEntry> = {};
    for (const e of json.entries) entries[e.name] = e;
    return { img, entries };
  } catch {
    return null;
  }
}

/** Carga los recursos del cierre (best-effort: null si el extractor no ha corrido). */
export async function loadEndgameScenesPack(): Promise<EndgameScenesPack | null> {
  const scenes = await loadAtlas("/assets/endgame-scenes.json", "/assets/endgame-scenes.png");
  if (!scenes) return null;
  const titles = await loadAtlas("/assets/intro-pics.json", "/assets/intro-pics.png");
  const proport = await FaithfulProportFont.load().catch(() => null);
  return { img: scenes.img, entries: scenes.entries, titles, proport };
}

/**
 * LUT de 16 colores del RECOLOR del endgame — EGA.DRV fn36 (SEL 0x6c) ax=4, tabla de
 * nibble bajo en EGA.DRV 0x2d4d (bytes `00 05 04 04 02 01 02 07 08 0c 0c 0c 0a 09 0e
 * 0f`; su gemela pre-shifteada <<4 para el nibble alto vive en 0x2d3d; T1K.DRV 0x1dfc
 * = la misma). LUT[colorEGA] = color recoloreado: azul→magenta, verde↔rojo, marrón→
 * verde, azul-claro/verde-claro/cyan-claro→rojo-claro, rojo-claro→verde-claro,
 * magenta-claro→azul-claro; negro/grises/amarillo/blanco quedan.
 */
export const ENDGAME_RECOLOR_LUT: readonly number[] = [
  0x0, 0x5, 0x4, 0x4, 0x2, 0x1, 0x2, 0x7, 0x8, 0xc, 0xc, 0xc, 0xa, 0x9, 0xe, 0xf,
];

/**
 * Los 22 tiles que fn36(ax=4) recolorea IN-PLACE en el buffer de tiles (lista HARDCODED
 * EGA.DRV 0x2cb0-0x2d33: cada `mov si, OFF; call 0x2d5d` con tile = OFF/0x80, 128 B =
 * un tile 16×16 4bpp). Orden del binario. Incluye el moongate 0xdc (→ ROJO) y el orb
 * 0x108 (→ estallido ROJO); NO incluye el espejo-arco 0x9d, los muros 0x4d ni el LB de
 * pie 0x17c (por eso el testigo los muestra sin virar).
 */
export const ENDGAME_RECOLOR_TILES: readonly number[] = [
  0x44, 0x5c, 0x5d, 0x90, 0x92, 0x94, 0x96, 0x9b, 0xab, 0xac, 0xaf, 0xb0, 0xb1, 0xbf,
  0xdc, 0x108, 0x10e, 0x11a, 0x138, 0x139, 0x13a, 0x13b,
];

/**
 * Sprite del ORB: el registro #6 de la cutscene se activa con tile 8 (ENDGAME 0x0968
 * `mov al,8; [0x5c8a]=[0x5c8b]=8`) y los actores dibujan `tile | 0x100` → tile 0x108
 * del atlas (estallido azul de 16×16, recoloreado a ROJO por la lista fn36).
 */
export const ORB_TILE = 0x108;

/**
 * Aplica la LUT del recolor a los índices EGA de un tile (in place) — equivalente
 * por-píxel del bucle `lodsb; xlat-por-nibbles; stosb` de EGA.DRV 0x2d5d-0x2d85
 * (cx=0x80 bytes = 256 píxeles 4bpp, di=si = in place).
 */
export function recolorEndgameIndices(indices: Uint8Array): void {
  for (let i = 0; i < indices.length; i++) {
    indices[i] = ENDGAME_RECOLOR_LUT[indices[i]! & 0xf]!;
  }
}

/**
 * Copia del atlas con los 22 tiles de `ENDGAME_RECOLOR_TILES` recoloreados por la LUT
 * — espejo de la mutación in-place del tileset del original (fn36 ax=4), mismo patrón
 * que `buildSwappedAtlas` (banderas frame-B). El render del endgame blitea TODO
 * (sala + actores + gate + orb + fuego) de este atlas, como el original tras 0x0658.
 * Devuelve null sin DOM (tests) → la piel cae al atlas normal (sala sin recolor).
 */
export function buildEndgameAtlas(atlas: HTMLImageElement): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const w = atlas.naturalWidth || atlas.width;
  const h = atlas.naturalHeight || atlas.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const cx = canvas.getContext("2d");
  if (!cx) return null;
  cx.drawImage(atlas, 0, 0);
  const idx = new Uint8Array(TILE * TILE);
  for (const tile of ENDGAME_RECOLOR_TILES) {
    const sx = (tile % ATLAS_COLS) * TILE;
    const sy = Math.floor(tile / ATLAS_COLS) * TILE;
    const img = cx.getImageData(sx, sy, TILE, TILE);
    rgbaToIndices(img.data, idx);
    recolorEndgameIndices(idx);
    indicesToRgba(idx, img.data);
    cx.putImageData(img, sx, sy);
  }
  return canvas;
}

/**
 * Overlays de la fase `orbMoongate` sobre el viewport, bliteados del atlas RECOLOREADO
 * (`buildEndgameAtlas`): el moongate en (5,4) — tile 0xdc, ROJO por la LUT fn36 — con
 * el blit PARCIAL anclado abajo (primitiva 0x1112, `moongateRevealRect`), y el ORB
 * (tile 0x108, estallido ROJO por la LUT) en su celda.
 */
export function paintEndgameOverlays(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  scene: EndgameSceneView,
): void {
  if (scene.moongate != null && scene.moongate > 0) {
    const { h } = moongateRevealRect(Math.min(scene.moongate, 16), TILE);
    if (h > 0) {
      const px = VIEWPORT.x + 5 * TILE;
      const py = VIEWPORT.y + 4 * TILE;
      const sx = (MOONGATE_TILE % ATLAS_COLS) * TILE;
      const sy = Math.floor(MOONGATE_TILE / ATLAS_COLS) * TILE;
      // Filas SUPERIORES h px del tile en la franja INFERIOR de la celda (la puerta
      // brota del suelo enseñando su borde alto — testigo del cruce f069-f078, misma
      // primitiva 0x1112). El rojo macizo del testigo 88-100 s sale del RECOLOR del
      // tile 0xdc (∈ lista fn36: cuerpo 9→12, azul 1→5, cyan-claro 11→12), no de un
      // tinte por luminancia.
      ctx.drawImage(atlas, sx, sy, TILE, h, px, py + (TILE - h), TILE, h);
    }
  }
  if (scene.orb) {
    const sx = (ORB_TILE % ATLAS_COLS) * TILE;
    const sy = Math.floor(ORB_TILE / ATLAS_COLS) * TILE;
    ctx.drawImage(
      atlas,
      sx,
      sy,
      TILE,
      TILE,
      VIEWPORT.x + scene.orb.col * TILE,
      VIEWPORT.y + scene.orb.row * TILE,
      TILE,
      TILE,
    );
  }
}

/** Word-wrap simple a `cols` columnas (el texto de END.DAT viene en párrafos por `\n`). */
function wrapStoryText(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      if (line.length === 0) line = word;
      else if (line.length + 1 + word.length <= cols) line += " " + word;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * LAYOUT por PÁGINA de las pantallas de historia — BYTE-DERIVADO de la rutina de
 * historia (ENDGAME.OVL 0x0000; su bucle de 6 «filas» 0x0077-0x01aa = las 6 PANTALLAS)
 * y de sus tablas por página en DATA.OVL (DS off; fileoff = DS+0x10):
 *  - `art`: destino del blit de la lámina — `call 0x6abc(handle, sub, x, y, 0)` con
 *    x = tabla 0x3dfa `[0,64,0,0,0,160]`, y = tabla 0x3e00 `[0,0,52,0,92,0]`
 *    (fichero END1/END2 = tabla 0x3df4 `[0,0,0,1,1,1]`, sub-lámina = 0x3dee
 *    `[0,1,2,0,1,2]` — ya codificados en `ART_BY_PAGE`).
 *  - `titles`: draws de cartones de TEXT.16 gateados por la tabla 0x3e06 `[1,0,0,1,0,0]`
 *    con sub-imagen y x,y INMEDIATOS en el código: página 0 (0x00d6-0x0110) = The(0) en
 *    (216,0) + Homecoming(4) en (152,28); página 3 (0x01c4-0x01e2) = Dream(5) en (224,0)
 *    + The(0) en (176,0). Mismos índices 0/4/5 que text16:* del atlas de la intro.
 *  - `bandA`/`bandB`: las DOS bandas del texto justificado — el bucle carga por página
 *    los globals del kernel de texto (0x0117-0x015a): bandA = x[0x3da6ᵢ, 0x3db2ᵢ) ×
 *    y[0x3de8ᵢ, 0x3dd6ᵢ) y bandB = x[0x3da7ᵢ, 0x3db4ᵢ) × y[0x3dd6ᵢ, 0x3ddcᵢ) (globals
 *    0x5146/0x514c/0x5158/0x5150 y 0x5148/0x514e/0x5150/0x5152). Valores volcados del
 *    binario; la SEMÁNTICA de los 8 globals (dos rects encadenados) está inferida por
 *    consistencia con las 6 páginas + careo del testigo (w103-w128: p0 texto junto al
 *    arte desde y66 bajo los titulares; p2/p4 texto arriba y banda estrecha junto al
 *    arte; p5 banda izquierda 0..154 con el arte a la derecha).
 * El texto de la página (END.DAT, offsets por página = tabla 0x3dca) fluye por
 * bandA→bandB con `drawWrappedBands` (kernel justificado 0xffffda56).
 */
export interface StoryBand {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export const STORY_LAYOUT: ReadonlyArray<{
  art: { x: number; y: number };
  titles: ReadonlyArray<{ word: 0 | 4 | 5; x: number; y: number }>;
  bandA: StoryBand;
  bandB: StoryBand;
}> = [
  {
    art: { x: 0, y: 0 },
    titles: [
      { word: 0, x: 216, y: 0 },
      { word: 4, x: 152, y: 28 },
    ],
    bandA: { x0: 172, y0: 66, x1: 320, y1: 126 },
    bandB: { x0: 0, y0: 126, x1: 320, y1: 200 },
  },
  {
    art: { x: 64, y: 0 },
    titles: [],
    bandA: { x0: 0, y0: 92, x1: 320, y1: 126 },
    bandB: { x0: 0, y0: 126, x1: 320, y1: 200 },
  },
  {
    art: { x: 0, y: 52 },
    titles: [],
    bandA: { x0: 0, y0: 9, x1: 320, y1: 42 },
    bandB: { x0: 196, y0: 42, x1: 320, y1: 148 },
  },
  {
    art: { x: 0, y: 0 },
    titles: [
      { word: 5, x: 224, y: 0 },
      { word: 0, x: 176, y: 0 },
    ],
    bandA: { x0: 179, y0: 38, x1: 320, y1: 100 },
    bandB: { x0: 0, y0: 100, x1: 320, y1: 200 },
  },
  {
    art: { x: 0, y: 92 },
    titles: [],
    bandA: { x0: 0, y0: 9, x1: 320, y1: 82 },
    bandB: { x0: 161, y0: 82, x1: 320, y1: 200 },
  },
  {
    art: { x: 160, y: 0 },
    titles: [],
    bandA: { x0: 0, y0: 0, x1: 154, y1: 112 },
    bandB: { x0: 0, y0: 112, x1: 320, y1: 200 },
  },
];

/**
 * Pantalla de HISTORIA (fases storyHouse/storyDream): frame NEGRO completo, los
 * cartones de titular (TEXT.16) y la lámina extraída (END1/END2.16) en sus posiciones
 * BYTE-DERIVADAS, y el texto de END.DAT en PROPORCIONAL JUSTIFICADO fluyendo por las
 * dos bandas de la página (mismo motor render_justified_text que The Summoning;
 * `drawWrappedBands`). Sin proport/atlas: fallback monoespaciado.
 */
export function paintEndgameStory(
  ctx: CanvasRenderingContext2D,
  font: FaithfulFont,
  pack: EndgameScenesPack | null,
  scene: EndgameSceneView,
): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const page = scene.storyPage ?? 0;
  const layout = STORY_LAYOUT[page] ?? STORY_LAYOUT[0]!;
  const entry = pack?.entries[ART_BY_PAGE[page] ?? ""];
  // Titulares primero (orden del binario: los draws de TEXT.16 preceden al de la
  // lámina en el bucle) — no se solapan, el orden es inerte.
  if (pack?.titles) {
    for (const t of layout.titles) {
      const e = pack.titles.entries[`text16:${t.word}`];
      if (e) ctx.drawImage(pack.titles.img, e.x, e.y, e.width, e.height, t.x, t.y, e.width, e.height);
    }
  }
  if (pack && entry) {
    ctx.drawImage(
      pack.img,
      entry.x,
      entry.y,
      entry.width,
      entry.height,
      layout.art.x,
      layout.art.y,
      entry.width,
      entry.height,
    );
  }
  const text = scene.storyText ?? "";
  if (pack?.proport) {
    pack.proport.drawWrappedBands(ctx, text, [layout.bandA, layout.bandB]);
    return;
  }
  // Fallback monoespaciado (sin fuente proporcional/atlas): fluye por las mismas bandas.
  let band = layout.bandA;
  let y = band.y0;
  for (const line of wrapStoryText(text, Math.floor((band.x1 - band.x0) / GLYPH))) {
    if (y + GLYPH > band.y1 && band === layout.bandA) {
      band = layout.bandB;
      y = band.y0;
    }
    if (y + GLYPH > band.y1) break;
    for (let i = 0; i < line.length; i++) {
      font.drawGlyph(ctx, line.charCodeAt(i), band.x0 + i * GLYPH, y);
    }
    y += GLYPH + 1;
  }
}

/**
 * PERGAMINO final (fase scroll) — layout del TESTIGO (w140): el arte endsc:0 (260×168)
 * arriba-centrado sobre negro; las líneas de questScroll estampadas UNA A UNA (reveal)
 * en tinta NEGRA; las 2 líneas RÚNICAS con RUNES.CH; y el informe «Report now…»
 * (`below`) en BLANCO, BAJO el pergamino.
 *
 * GEOMETRÍA MEDIDA sobre el testigo, t=140 s del .mov endgame-victoria-box-20260721
 * (`egcalib.normalize_fixed` con el recorte CALIBRADO del manifiesto pixeldiff
 * `endgame-cases.json` → EGA indexado 320×200; misma tubería que el arnés del
 * desenlace, no un recorte a ojo). Registro del recorte comprobado con un CONTROL
 * antes de medir nada: la línea `below` «Report now, thy Quest compleat in» (que el
 * port ya estampa con x0 conocido = 24) tiene su primer píxel encendido en x=25 EN
 * LOS DOS lados ⇒ desfase horizontal 0. Las cuatro cotas:
 *
 *  - CENTRADO por CELDA de carácter en el eje de las 40 columnas de la PANTALLA (no
 *    del pergamino): `col0 = floor((40 − len)/2)`, x0 = col0·8. Las 13 líneas del
 *    testigo casan todas, y casan por los DOS bordes (el sesgo +2/−1 es el hueco del
 *    glifo dentro de su celda, no un desfase): «Be it known that on» len 19 → x
 *    80..231, medido 82..230 · «Lord British, thereby» len 21 → x 72..239, medido
 *    74..238 · «of the Year» len 11 → x 112..199, medido 114..198. El centrado por
 *    PÍXEL de antes desplazaba ±4 px las líneas de longitud impar.
 *  - ANCHO útil de tinta: la línea MÁS ANCHA del binario dentro del pergamino son
 *    21 columnas («Lord British, thereby», x 72..240 medido) — el binario trae los
 *    cortes de línea EN LAS STRINGS (DS 0x8332…, `\n` literales) y nunca pasa de ahí.
 *    El wrap del port (las líneas del clon van agrupadas — divergencia [C] documentada
 *    en quest/endgame.ts) usa ese mismo máximo: `SCROLL_COLS = 21`. El valor viejo
 *    (25 cols del cálculo `(w−56)/8`) sacaba la tinta al arte del borde derecho
 *    («…and our» sobre el rollo — defecto reportado con captura, 2026-08-22).
 *  - POSICIÓN DEL ARTE: (41, 0), NO centrada. El pergamino del testigo no está
 *    centrado en pantalla y ésa es la causa RAÍZ del desbordamiento por la derecha:
 *    con el arte 11 px a la izquierda de su sitio, un texto centrado EN PANTALLA
 *    queda descentrado DENTRO del papel y la tinta se acerca al rollo derecho.
 *    Medido por correlación de la silueta del borde (IoU sobre la máscara no-negra
 *    no-blanca del arte, rejilla dx∈[−24,24] × dy∈[−8,8]): pico ÚNICO y limpio en
 *    dx=+11, dy=−2 (0,2954; el segundo, dx=+10, 0,2808). Control independiente del
 *    ancho: la fila 157 mide 251 px de arte en los DOS lados (42..292 testigo,
 *    31..281 port) ⇒ es una TRASLACIÓN pura, el asset no difiere del original.
 *  - REJILLA VERTICAL de 8 px, con el arte en y=0: primera fila de tinta y=8
 *    (`oy+8`) e informe `below` en y=168 (`oy+h`). Las 17 filas de texto del testigo
 *    caen TODAS en múltiplos de 8 (8,16,24,32,40,48 · 64 · 80,88,96,104,112 · 128,136
 *    dentro del papel; 168,176,184 debajo) — que es lo que dice que la rejilla está
 *    registrada y que el arte empieza en 0. Con `oy=2` el port pintaba 2 px bajo el
 *    testigo dentro del papel y UNA FILA ENTERA por debajo fuera (informe en 176 y
 *    última línea comida por el borde inferior de la pantalla, y 192..199).
 *    Línea en blanco = UNA fila de 8 px (el testigo separa bloques a 1 fila, no 2:
 *    el `+8` extra de las líneas vacías era doble espacio).
 */
/** Columnas de la pantalla (40×25 en texto; SCREEN_W/GLYPH). */
const SCREEN_COLS = SCREEN_W / GLYPH;
/**
 * Ancho máximo de tinta DENTRO del pergamino, en columnas — la línea más ancha que el
 * binario estampa en el arte (w140: «Lord British, thereby», 21 cols, x 72..240).
 */
const SCROLL_COLS = 21;
/**
 * Esquina del blit del arte `endsc:0` en la pantalla lógica — MEDIDA (cabecera), no
 * derivada de `(320−w)/2`: el pergamino del original NO está centrado.
 */
const SCROLL_ART_X = 41;
const SCROLL_ART_Y = 0;
export function paintEndgameScroll(
  ctx: CanvasRenderingContext2D,
  font: FaithfulFont,
  runes: FaithfulFont,
  pack: EndgameScenesPack | null,
  scene: EndgameSceneView,
): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const entry = pack?.entries["endsc:0"];
  const w = entry?.width ?? 260;
  const h = entry?.height ?? 168;
  const ox = SCROLL_ART_X;
  const oy = SCROLL_ART_Y;
  const artDrawn = Boolean(pack && entry);
  if (pack && entry) {
    ctx.drawImage(pack.img, entry.x, entry.y, entry.width, entry.height, ox, oy, w, h);
  }
  // AUSENCIA CON GRACIA (bug scroll-vacío 2026-07-23): la tinta interior sólo va NEGRA
  // cuando el pergamino (endsc:0) está pintado debajo. Sin pack/entry (extractor sin
  // correr, o sesión booteada ANTES de generar los assets: el fetch de mount() memoriza
  // el 404), el fondo es NEGRO y la tinta negra dejaba el texto INVISIBLE-POR-
  // CONSTRUCCIÓN — el «pergamino vacío» reportado en vivo. Degradación coherente con
  // paintEndgameStory: texto BLANCO sobre negro.
  const inkColor = artDrawn ? "#000000" : undefined;
  const lines = scene.scrollLines ?? [];
  const reveal = Math.min(scene.scrollReveal ?? lines.length, lines.length);
  // CENTRADO por CELDA en el eje de las 40 columnas — regla del kernel medida en el
  // testigo w140 (cabecera): col0 = floor((40 − len)/2). Vale para la tinta interior
  // Y para el informe de abajo (medido: «to Lord British at Origin Systems!» len 34
  // → col0 3 → x 24..296, centro 160.0 exacto en el frame).
  const drawCentered = (
    f: FaithfulFont,
    text: string,
    y: number,
    color: string | undefined,
  ): void => {
    const x0 = Math.floor((SCREEN_COLS - text.length) / 2) * GLYPH;
    for (let i = 0; i < text.length; i++) {
      f.drawGlyph(ctx, text.charCodeAt(i), x0 + i * GLYPH, y, 1, color);
    }
  };
  let yIn = oy + 8; // primera fila de tinta (testigo w140: y=8, rejilla de 8 px)
  let yBelow = oy + h; // informe bajo el pergamino, en blanco (testigo: y=168 = 0+168)
  for (let li = 0; li < reveal; li++) {
    const { text, rune, below } = lines[li]!;
    if (below) {
      for (const seg of wrapStoryText(text, SCREEN_COLS)) {
        if (yBelow > SCREEN_H - GLYPH) break;
        drawCentered(font, seg, yBelow, undefined);
        yBelow += GLYPH;
      }
      continue;
    }
    const f = rune ? runes : font;
    // Wrap al ancho útil del pergamino (SCROLL_COLS=21, cabecera): la línea más ancha
    // del binario dentro del arte. Con 25 cols la tinta pisaba el borde derecho.
    for (const seg of text.length > SCROLL_COLS ? wrapStoryText(text, SCROLL_COLS) : [text]) {
      if (yIn > oy + h - GLYPH - 6) break;
      drawCentered(f, seg, yIn, inkColor);
      yIn += GLYPH;
    }
    // Línea en blanco = UNA fila de 8 px (w140 re-medido: un solo hueco entre bloques;
    // el `+8` extra que había aquí doblaba el espacio).
  }
}

/**
 * DISOLUCIÓN de píxeles (fase dissolve): ennegrece los primeros `K = progress·N`
 * píxeles del ORDEN derivado sobre el frame YA pintado (el fondo sigue siendo la sala
 * verde — el testigo disuelve el frame completo, chrome incluido). O(N) por pintado.
 */
export function applyEndgameDissolve(
  ctx: CanvasRenderingContext2D,
  order: Uint32Array,
  progress: number,
): void {
  const img = ctx.getImageData(0, 0, SCREEN_W, SCREEN_H);
  const data = img.data;
  const k = Math.max(0, Math.min(order.length, Math.floor(progress * order.length)));
  for (let i = 0; i < k; i++) {
    const p = order[i]! * 4;
    data[p] = 0;
    data[p + 1] = 0;
    data[p + 2] = 0;
  }
  ctx.putImageData(img, 0, 0);
}
