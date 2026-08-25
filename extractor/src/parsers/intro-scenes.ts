/**
 * Parser de las TABLAS DE ESCENA de "The Summoning" (`play_introduction`,
 * INTRO.OVL 0x14e) — 21 escenas que el compositor de la cinemática recorre.
 * DERIVADO Y CITADO en `re/notes/intro-scene-tables.md` (scout #35); valores
 * leídos de DATA.OVL (`fo = DS + 0x10`), texto de STORY.DAT.
 *
 * Por escena (12 tablas paralelas):
 *   - subimg  (0x3098 / fo 0x30a8, byte)  = índice de sub-imagen del cartón
 *   - x       (0x30c4 / fo 0x30d4, byte)  = X del cartón (columna) — driver EGA.DRV
 *   - y       (0x30da / fo 0x30ea, byte)  = Y del cartón (scanline) — driver EGA.DRV
 *   - type    (0x30f0 / fo 0x3100, byte)  = TIPO de escena (0-6, selector, §3)
 *   - storyFile(0x30ae / fo 0x30be, byte) = índice de STORYn.16 (0→STORY1 … 5→STORY6)
 *   - storyOffset(0x3016 / fo 0x3026, word)= offset de byte del texto en STORY.DAT
 *   - textTop/Bot (0x3040/0x3056), penX/Y (0x306c/0x3082), marginL (0x2f98, word),
 *     marginR (0x2fc2, 2 words) = layout del texto proporcional (font.md §Justif)
 *
 * Firma del blit (EGA.DRV 0x12b4, `intro-blit-formats.md §4`): (flags=0, Y, X,
 * subimg, buffer). El texto de la escena 6 (TYPE 3, "puerta azul") NO viene de
 * STORY.DAT — son dos strings fijos de DATA.OVL (0x2f31/0x2f5f); §3.
 */

import { u16le } from "./binary.js";

/** Una escena de The Summoning: fondo (STORYn.16 subimg @ x,y) + texto + layout. */
export interface IntroScene {
  index: number;
  subimg: number;
  x: number;
  y: number;
  type: number;
  /** Índice de STORYn.16 (0-based: 0=STORY1.16 … 5=STORY6.16). */
  storyFile: number;
  /** Texto de la escena (registro de STORY.DAT en `storyOffset`, ya limpio). */
  text: string;
  textTop: number;
  textBot: number;
  penX: number;
  penY: number;
  marginL: number;
  marginR: number;
}

const SCENE_COUNT = 21;
// Offsets de fichero (DS + 0x10) de cada tabla (intro-scene-tables.md §1).
const FO_SUBIMG = 0x30a8;
const FO_X = 0x30d4;
const FO_Y = 0x30ea;
const FO_TYPE = 0x3100;
const FO_FILE = 0x30be;
const FO_TOP = 0x3050;
const FO_BOT = 0x3066;
const FO_PENX = 0x307c;
const FO_PENY = 0x3092;
const FO_MARGINL = 0x2fa8; // word, stride 2
const FO_MARGINR = 0x2fd2; // 2 words/escena, stride 4 → tomamos la 1ª
const FO_STORYOFF = 0x3026; // word, stride 2
// Strings fijos de DATA.OVL para la escena 6 (TYPE 3, "puerta azul"); DS→fo +0x10.
const FO_DOOR_STR1 = 0x2f41; // 0x2f31 = "Instantly, a shimmering blue door springs up!"
const FO_DOOR_STR2 = 0x2f6f; // 0x2f5f = "With heart beating rapidly, you step into it."

/** Limpia un registro de texto de STORY.DAT: quita '_', '{'→párrafo, colapsa. */
function cleanText(bytes: Uint8Array, start: number): string {
  const paras: string[] = [];
  let s = "";
  const flush = (): void => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t) paras.push(t);
    s = "";
  };
  for (let i = start; i < bytes.length; i++) {
    const c = bytes[i]!;
    if (c === 0x00) break; // NUL = fin de registro
    if (c === 0x5f) continue; // '_' guion discrecional
    if (c === 0x7b) {
      flush();
      continue;
    } // '{' sangría → párrafo
    if (c === 0x0a || c === 0x0d || c === 0x09) {
      s += " ";
      continue;
    }
    if (c >= 0x20 && c < 0x7f) s += String.fromCharCode(c);
  }
  flush();
  return paras.join("\n");
}

/**
 * Margen IZQ (0x2f98) en píxeles. La word por escena reparte el valor real entre
 * el byte BAJO en unas escenas y el ALTO en otras (filas "izq (lo)"/"izq (hi)" de
 * intro-scene-tables.md §1.1): p.ej. esc.1 = 0xAC00 = 172<<8. Esto refleja los DOS
 * regímenes del justificador que consumen esta tabla — el de la intro
 * (`render_justified_text` invocado desde INTRO 0x0243-0x0250) y el de FONT
 * (0x002f-0x0033) — que leen lo/hi de forma distinta según la ruta. Tomar el byte
 * no nulo COLAPSA ambos regímenes en un solo margen: es una simplificación
 * (Clase C, a adjudicar en el píxel-diff #26), no una derivación de los dos por
 * separado. En la práctica los dos bytes nunca son != 0 a la vez, así que el
 * colapso reproduce la columna correcta en las 21 escenas.
 */
function saneMargin(word: number): number {
  const lo = word & 0xff;
  return lo !== 0 ? lo : (word >> 8) & 0xff;
}

/** Lee un string ASCII \0-terminado desde `off`. */
function cString(bytes: Uint8Array, off: number): string {
  let s = "";
  for (let i = off; i < bytes.length && bytes[i] !== 0; i++) {
    const c = bytes[i]!;
    if (c >= 0x20 && c < 0x7f) s += String.fromCharCode(c);
  }
  return s.trim();
}

/**
 * Parsea las 21 escenas de The Summoning de DATA.OVL + STORY.DAT. La escena 6
 * (TYPE 3) toma su texto de los dos strings fijos de DATA.OVL, no de STORY.DAT.
 */
export function parseIntroScenes(dataOvl: Uint8Array, storyDat: Uint8Array): IntroScene[] {
  const scenes: IntroScene[] = [];
  const door6 = `${cString(dataOvl, FO_DOOR_STR1)}\n${cString(dataOvl, FO_DOOR_STR2)}`;
  for (let i = 0; i < SCENE_COUNT; i++) {
    const type = dataOvl[FO_TYPE + i]!;
    const storyOffset = u16le(dataOvl, FO_STORYOFF + i * 2);
    const text = type === 3 ? door6 : cleanText(storyDat, storyOffset);
    scenes.push({
      index: i,
      subimg: dataOvl[FO_SUBIMG + i]!,
      x: dataOvl[FO_X + i]!,
      y: dataOvl[FO_Y + i]!,
      type,
      storyFile: dataOvl[FO_FILE + i]!,
      text,
      textTop: dataOvl[FO_TOP + i]!,
      textBot: dataOvl[FO_BOT + i]!,
      penX: dataOvl[FO_PENX + i]!,
      penY: dataOvl[FO_PENY + i]!,
      marginL: saneMargin(u16le(dataOvl, FO_MARGINL + i * 2)),
      marginR: u16le(dataOvl, FO_MARGINR + i * 4),
    });
  }
  return scenes;
}
