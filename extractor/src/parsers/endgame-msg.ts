/**
 * Parser del TEXTO de la secuencia final de Ultima V (task #20, Lote 1).
 *
 * El endgame tiene DOS ficheros de texto, con formatos distintos, ambos cargados por
 * `endgame_main`/`endgame_throne_scene` (ENDGAME.OVL) con el loader open+lseek+read:
 *
 *   1. END.DAT   — la NARRACIÓN de cierre (epílogo), 6 páginas. `endgame_throne_scene`
 *      (ENDGAME 0x015a) la lee en bucle de 6 (seeks = tabla DGROUP 0x3dca):
 *      fname 0x81fe→"END.DAT", dest 0xb21e, len 2000, seek ∈ {0,424,956,1530,2280,2932}.
 *      Esas 6 seeks son EXACTAMENTE el byte-tras-NUL de cada registro ⇒ END.DAT es un
 *      texto NUL-delimitado (6 registros), y la tabla de seeks del asm lo confirma.
 *   2. ENDMSG.DAT — el DIÁLOGO del trono (Lord British + la caja + los dos finales).
 *      `endgame_main` (ENDGAME 0x0681) lo lee: fname 0x848e→"ENDMSG.DAT", seek 0, len 1000.
 *
 * ⚠ CORRECCIÓN del brief (2c86876): END.DAT NO son tile-maps — es la narración de
 * cierre en TEXTO (el famoso epílogo "your TV, stereo and living-room furniture are
 * gone" + el destierro de Blackthorn por el gate rojo). El único tile-map del endgame
 * es `MISCMAPS.DAT[528:704]` (ver `endgame-scene.ts`).
 *
 * FORMATOS:
 *   - END.DAT = formato STORY.DAT (misma convención que `story.ts`): registros
 *     NUL-delimitados; dentro, '{' (0x7b) = control de sangría/arranque de párrafo,
 *     '_' (0x5f) = guion discrecional del justificador proporcional (se elimina,
 *     uniendo sílabas). Se limpia igual que la narración de intro.
 *   - ENDMSG.DAT = fragmentos de diálogo NUL-separados, ensamblados en runtime
 *     (p.ej. el registro "...You reply: " concatena con el siguiente). Se conserva el
 *     '\n' (el formato de línea del diálogo es significativo); NO lleva '{'/'_'.
 *
 * El FORK de los dos finales (caja de sándalo presente ⇒ Orb of the Moons "Our worlds
 * await!" vs ausente ⇒ "pull up a chair") lo gatea `g_wooden_box` en `endgame_main`
 * (0x0648). Aquí se extraen los registros EN ORDEN DE FICHERO (extracción fiel); el
 * cableado del fork es del core (Lote 3).
 */

const RECORD_SEP = 0x00; // NUL: separador de registro (END.DAT y ENDMSG.DAT)
const INDENT_MARK = 0x7b; // '{': arranque de párrafo indentado (END.DAT/STORY.DAT)
const SOFT_HYPHEN = 0x5f; // '_': guion discrecional del justificador (END.DAT/STORY.DAT)

/** Seeks de los 6 registros de END.DAT (tabla DGROUP 0x3dca; = byte-tras-NUL). */
export const NARRATION_SEEKS = [0, 424, 956, 1530, 2280, 2932] as const;

/** Narración de cierre (END.DAT) — 6 páginas de epílogo. */
export interface EndgameNarration {
  source: "END.DAT";
  /** Offsets de arranque de cada registro (asm-derivados, validados vs NUL). */
  seeks: number[];
  /** Texto limpio de cada página (párrafos separados por '\n'). */
  pages: string[];
}

/** Diálogo del trono (ENDMSG.DAT) — fragmentos en orden de fichero. */
export interface EndgameDialogue {
  source: "ENDMSG.DAT";
  /**
   * Registros NUL-delimitados, en orden de fichero, con '\n' conservado. El fork del
   * final (caja sí/no) los selecciona en el core (Lote 3): los primeros son la
   * pregunta compartida, el bloque de la caja abre con "Lord British carefully opens
   * the box..." y el final alterno es "...pull up a chair. ...We shall be here a while."
   */
  records: string[];
}

/**
 * Limpia un registro de END.DAT (misma lógica que `story.ts::cleanRecord`): elimina
 * guiones discrecionales, traduce '{' a salto de párrafo y colapsa espacios. Devuelve
 * el texto con los párrafos separados por '\n'.
 */
function cleanNarration(raw: number[]): string {
  const paragraphs: string[] = [];
  let s = "";
  const flush = (): void => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t.length > 0) paragraphs.push(t);
    s = "";
  };
  for (const c of raw) {
    if (c === SOFT_HYPHEN) continue; // une sílabas
    if (c === INDENT_MARK) {
      flush(); // nuevo párrafo
      continue;
    }
    if (c === 0x0a || c === 0x0d || c === 0x09) {
      s += " ";
      continue;
    }
    if (c >= 0x20 && c < 0x7f) s += String.fromCharCode(c);
  }
  flush();
  return paragraphs.join("\n");
}

/**
 * Trocea END.DAT en sus registros NUL-delimitados y los limpia. Valida que los
 * arranques de registro coinciden con la tabla de seeks del asm (`NARRATION_SEEKS`);
 * si no, lanza (el formato habría cambiado).
 */
export function parseEndgameNarration(endDat: Uint8Array): EndgameNarration {
  const starts: number[] = [0];
  const pages: string[] = [];
  let cur: number[] = [];
  for (let i = 0; i < endDat.length; i++) {
    const c = endDat[i]!;
    if (c === RECORD_SEP) {
      const text = cleanNarration(cur);
      if (text.length > 0) pages.push(text);
      cur = [];
      if (i + 1 < endDat.length) starts.push(i + 1);
      continue;
    }
    cur.push(c);
  }
  const tail = cleanNarration(cur);
  if (tail.length > 0) pages.push(tail);

  // Los arranques de los registros NO vacíos deben ser los seeks del asm.
  const nonEmptyStarts = starts.slice(0, NARRATION_SEEKS.length);
  for (let k = 0; k < NARRATION_SEEKS.length; k++) {
    if (nonEmptyStarts[k] !== NARRATION_SEEKS[k]) {
      throw new Error(
        `END.DAT: arranque de registro ${k} = ${nonEmptyStarts[k]} != seek asm ${NARRATION_SEEKS[k]}`,
      );
    }
  }
  return { source: "END.DAT", seeks: [...NARRATION_SEEKS], pages };
}

/**
 * Trocea ENDMSG.DAT en sus registros NUL-delimitados (orden de fichero), conservando
 * el '\n'. Omite el registro final vacío (la cola NUL). Extracción fiel; el fork del
 * final va en el core.
 */
export function parseEndgameDialogue(endmsg: Uint8Array): EndgameDialogue {
  const records: string[] = [];
  let cur: number[] = [];
  const push = (): void => {
    const raw = new TextDecoder("latin1").decode(new Uint8Array(cur));
    if (raw.length > 0) records.push(raw);
    cur = [];
  };
  for (let i = 0; i < endmsg.length; i++) {
    const c = endmsg[i]!;
    if (c === RECORD_SEP) {
      push();
      continue;
    }
    cur.push(c);
  }
  push(); // cola sin NUL final (si la hubiera)
  return { source: "ENDMSG.DAT", records };
}
