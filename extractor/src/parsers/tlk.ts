/**
 * Parser de diálogos .TLK de Ultima V (TOWNE/CASTLE/KEEP/DWELLING.TLK).
 *
 * Portado del parser real de Ultima5Redux:
 *   References/Dialogue/TalkScripts.cs  (InitializeTalkScriptFromRaw L109-244)
 *   References/Dialogue/TalkScript.cs   (InitScript L252-449)
 *   References/Dialogue/CompressedWordReference.cs (mapa de huecos L24-124)
 *
 * Desviaciones conscientes respecto a docs/formats/tlk-npc-dataovl-gam.md §1
 * (documentadas al final de este comentario):
 *  - El índice de palabra comprimida es el BYTE CRUDO (bytes bajos 1..128), NO
 *    `byte - 0x80`. El ejemplo de TalkScripts.cs "Alistair\x01Bard" lo confirma:
 *    0x01 -> compressWordLookupMap[1] = StringList[0]. El paréntesis "(byte-0x80)"
 *    del doc es incorrecto; el mapa de rangos del doc sí es correcto.
 *  - Gold: los 3 chars siguientes se capturan como `data` numérico del propio op
 *    (el doc/Redux los dejaban como texto suelto tras el op).
 *  - Change: el byte siguiente se consume como `data` (item) y no se procesa como
 *    texto/op independiente.
 *  - No se añade "\n" al final de cada línea (Redux lo hacía para su render; aquí
 *    cada línea es un ScriptLine separado, así que el texto queda limpio).
 */

import { u16le, stringList } from "./binary.js";

export type ScriptItem =
  | { kind: "text"; text: string }
  | { kind: "op"; op: string; data?: number };

export type ScriptLine = ScriptItem[];

export interface QA {
  keywords: string[];
  answer: ScriptLine[];
}

export interface TalkLabel {
  label: number;
  initialLine: ScriptLine;
  defaultAnswers: ScriptLine[];
  qa: QA[];
}

export interface TalkScript {
  npcIndex: number;
  name: ScriptLine;
  description: ScriptLine;
  greeting: ScriptLine;
  job: ScriptLine;
  bye: ScriptLine;
  qa: QA[];
  labels: TalkLabel[];
}

const TALK_OFFSET_ADJUST = 0x80;
const MIN_LABEL = 0x91;
const MAX_LABEL = 0x91 + 0x0a; // 0x9B

/** Opcodes conocidos: byte crudo -> nombre. */
const OPCODES: Record<number, string> = {
  0x81: "AvatarsName",
  0x82: "EndConversation",
  0x83: "Pause",
  0x84: "JoinParty",
  0x85: "Gold",
  0x86: "Change",
  0x87: "Or",
  0x88: "AskName",
  0x89: "KarmaPlusOne",
  0x8a: "KarmaMinusOne",
  0x8b: "CallGuards",
  0x8c: "IfElseKnowsName",
  0x8d: "NewLine",
  0x8e: "Rune",
  0x8f: "KeyWait",
  0x90: "StartLabelDefinition",
  0x9f: "EndScript",
  0xa2: "StartNewSection",
  0xfd: "GotoLabel",
  0xfe: "DefineLabel",
  0xff: "DoNothingSection",
};

/**
 * Palabras comprimidas del TLK. StringList en DATA.OVL 0x104C, longitud 0x24E.
 * En la base MS-DOS de Ultima V son 118 palabras; las 5 primeras son:
 *   ["the", "thou", "of", "to", "and"]
 * El byte crudo 1 referencia StringList[0] ("the") vía el mapa de huecos.
 */
export function extractCompressedWords(dataOvl: Uint8Array): string[] {
  return stringList(dataOvl, 0x104c, 0x24e);
}

/**
 * Construye el mapa índice-crudo -> índice-en-StringList replicando exactamente
 * CompressedWordReference (los huecos son intencionados en los datos originales).
 */
function buildWordLookup(): Map<number, number> {
  const map = new Map<number, number>();
  let off = 0;
  const add = (start: number, stop: number, offset: number): void => {
    for (let k = start; k <= stop; k++) map.set(k, k + offset);
  };
  add(1, 7, --off); // -1
  add(9, 27, --off); // -2
  add(29, 49, --off); // -3
  add(51, 64, --off); // -4
  add(66, 66, --off); // -5
  add(68, 69, --off); // -6
  add(71, 71, --off); // -7
  off -= 4; // -11
  add(76, 129, off);
  return map;
}

const WORD_LOOKUP = buildWordLookup();
// IsTalkingWord: el índice debe estar en el rango (max-min) y existir en el mapa.
const WORD_LOOKUP_SPAN = 128; // max(129) - min(1)

export function isTalkingWord(index: number): boolean {
  if (index > WORD_LOOKUP_SPAN) return false;
  return WORD_LOOKUP.has(index);
}

/**
 * Resuelve un índice crudo de palabra comprimida a su cadena, o `null` si el
 * índice no cae en el mapa de huecos. Compartido con el parser de SHOPPE.DAT,
 * que usa el MISMO diccionario y mapa que los .TLK (ver CompressedWordReference).
 */
export function resolveCompressedWord(
  index: number,
  compressedWords: string[],
): string | null {
  if (!isTalkingWord(index)) return null;
  return compressedWords[WORD_LOOKUP.get(index)!] ?? null;
}

interface ParseCounters {
  unknown: number;
  items: number;
}

/**
 * Convierte los bytes crudos de un NPC en una lista de ScriptLine (una por cada
 * byte 0x00). Sigue InitializeTalkScriptFromRaw.
 */
function bytesToScriptLines(
  bytes: Uint8Array,
  compressedWords: string[],
  counters: ParseCounters,
): ScriptLine[] {
  const lines: ScriptLine[] = [];
  let current: ScriptLine = [];
  let pending = ""; // buildAWord
  let writingSingleChars = false;

  // Estado de captura de la cantidad de oro (op Gold).
  let goldItem: { kind: "op"; op: string; data?: number } | null = null;
  let goldCharsLeft = 0;
  let goldBuf = "";

  const flushPending = (): void => {
    if (pending.length > 0) {
      current.push({ kind: "text", text: pending });
      counters.items++;
      pending = "";
    }
  };

  const pushOp = (op: string, data?: number): { kind: "op"; op: string; data?: number } => {
    const item: { kind: "op"; op: string; data?: number } =
      data === undefined ? { kind: "op", op } : { kind: "op", op, data };
    current.push(item);
    counters.items++;
    return item;
  };

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;

    if (b === 0x00) {
      // Hack Redux: hay un fin de línea espurio en mitad de una respuesta.
      if (pending.endsWith("to give unto charity!")) continue;
      flushPending();
      lines.push(current);
      current = [];
      writingSingleChars = false;
      continue;
    }

    let temp = b;
    let usePhraseLookup = false;
    if ((b >= 0xa0 && b <= 0xa1) || (b >= 0xa5 && b <= 0xda) || (b >= 0xe1 && b <= 0xfa)) {
      temp -= TALK_OFFSET_ADJUST;
    } else {
      usePhraseLookup = true;
    }

    if (!usePhraseLookup) {
      writingSingleChars = true;
      const ch = String.fromCharCode(temp);
      if (ch === "@") continue; // marca de control, se ignora
      if (goldCharsLeft > 0 && goldItem) {
        goldBuf += ch;
        if (--goldCharsLeft === 0) {
          const n = parseInt(goldBuf, 10);
          if (!Number.isNaN(n)) goldItem.data = n;
          goldItem = null;
          goldBuf = "";
        }
        continue; // los dígitos de oro van al op, no al texto
      }
      pending += ch;
      continue;
    }

    // usePhraseLookup: transición de chars sueltos a lookup -> insertar espacio.
    if (writingSingleChars) {
      pending += " ";
      writingSingleChars = false;
    }

    if (isTalkingWord(temp)) {
      const idx = WORD_LOOKUP.get(temp)!;
      pending += (compressedWords[idx] ?? "") + " ";
      counters.items++;
      continue;
    }

    // Op o label: primero se vuelca el texto pendiente.
    flushPending();

    if (temp >= MIN_LABEL && temp <= MAX_LABEL) {
      pushOp("Label", temp - MIN_LABEL);
      continue;
    }

    const opName = OPCODES[temp];
    if (opName === undefined) {
      pushOp("Unknown", temp);
      counters.unknown++;
      continue;
    }

    if (opName === "Gold") {
      goldItem = pushOp("Gold");
      goldCharsLeft = 3;
      goldBuf = "";
    } else if (opName === "Change") {
      // El siguiente byte crudo es el item otorgado; se consume sin procesar.
      const next = i + 1 < bytes.length ? bytes[i + 1]! : 0;
      i++;
      pushOp("Change", next);
    } else {
      pushOp(opName);
    }
  }

  // Volcar cualquier resto (algunos chunks no terminan en 0x00).
  flushPending();
  if (current.length > 0) lines.push(current);

  return lines;
}

/** Texto plano (trim) de la primera parte de una línea: usado como keyword. */
function keywordOf(line: ScriptLine | undefined): string {
  if (!line || line.length === 0) return "";
  const first = line[0];
  if (first && first.kind === "text") return first.text.trim();
  return "";
}

/** IsQuestion de Redux: 1..6 chars tras trim y sin espacios. */
function isQuestionText(s: string): boolean {
  const t = s.trim();
  return t.length >= 1 && t.length <= 6 && !t.includes(" ");
}

function lineIsQuestion(line: ScriptLine | undefined): boolean {
  return isQuestionText(keywordOf(line));
}

function lineContainsOr(line: ScriptLine | undefined): boolean {
  return !!line && line.some((it) => it.kind === "op" && it.op === "Or");
}

function lineStartsLabelDef(line: ScriptLine | undefined): boolean {
  return !!line && line.length > 0 && line[0]!.kind === "op" && (line[0] as { op: string }).op === "StartLabelDefinition";
}

function lineIsEndOfLabelSection(line: ScriptLine | undefined): boolean {
  if (!lineStartsLabelDef(line)) return false;
  const second = line![1];
  return !!second && second.kind === "op" && second.op === "EndScript";
}

function labelNumberOf(line: ScriptLine): number {
  const second = line[1];
  if (second && second.kind === "op" && second.op === "Label" && second.data !== undefined) {
    return second.data;
  }
  return 0;
}

/**
 * Estructura las ScriptLines crudas en name/description/greeting/job/bye + Q&A +
 * labels. Portado (de forma tolerante) de InitScript. Nunca lanza.
 */
function structureScript(npcIndex: number, lines: ScriptLine[]): TalkScript {
  const at = (i: number): ScriptLine => lines[i] ?? [];

  const script: TalkScript = {
    npcIndex,
    name: at(0),
    description: at(1),
    greeting: at(2),
    job: at(3),
    bye: at(4),
    qa: [],
    labels: [],
  };

  let idx = 5;

  // Sección Q&A superior: pares keyword(s)/respuesta hasta la 1ª def. de label.
  while (idx < lines.length && !lineStartsLabelDef(lines[idx])) {
    const keywords = [keywordOf(lines[idx])];
    while (idx + 1 < lines.length && lineContainsOr(lines[idx + 1])) {
      idx += 2;
      keywords.push(keywordOf(lines[idx]));
    }
    const answer = idx + 1 < lines.length ? at(idx + 1) : [];
    script.qa.push({ keywords: keywords.filter((k) => k.length > 0), answer: [answer] });
    idx += 2;
  }

  // Sección de labels.
  while (idx < lines.length) {
    const marker = lines[idx];
    if (!lineStartsLabelDef(marker)) {
      idx++;
      continue;
    }
    if (lineIsEndOfLabelSection(marker)) break;

    const label: TalkLabel = {
      label: labelNumberOf(marker!),
      initialLine: marker!,
      defaultAnswers: [],
      qa: [],
    };
    idx++;

    // Primera línea tras el marcador = respuesta por defecto (si existe).
    if (idx < lines.length && !lineStartsLabelDef(lines[idx])) {
      label.defaultAnswers.push(at(idx));
      idx++;
    }

    // Resto del bloque: Q&A o líneas por defecto adicionales.
    while (idx < lines.length && !lineStartsLabelDef(lines[idx])) {
      const line = lines[idx];
      if (lineIsQuestion(line) && idx + 1 < lines.length && !lineStartsLabelDef(lines[idx + 1])) {
        const keywords = [keywordOf(line)];
        while (idx + 1 < lines.length && lineContainsOr(lines[idx + 1])) {
          idx += 2;
          keywords.push(keywordOf(lines[idx]));
        }
        const answer = idx + 1 < lines.length ? at(idx + 1) : [];
        label.qa.push({ keywords: keywords.filter((k) => k.length > 0), answer: [answer] });
        idx += 2;
      } else {
        label.defaultAnswers.push(at(idx));
        idx++;
      }
    }

    script.labels.push(label);
  }

  return script;
}

export interface ParseTlkResult {
  scripts: TalkScript[];
  unknownOps: number;
  totalItems: number;
}

/**
 * Parsea un fichero .TLK completo. Devuelve `scripts`; los contadores de
 * `Unknown` y de items totales se exponen en el objeto de resultado.
 */
export function parseTlkFileWithStats(
  bytes: Uint8Array,
  compressedWords: string[],
): ParseTlkResult {
  const counters: ParseCounters = { unknown: 0, items: 0 };
  const nEntries = u16le(bytes, 0);

  const offsets: { npcIndex: number; fileOffset: number }[] = [];
  for (let i = 0; i < nEntries; i++) {
    const base = 2 + i * 4;
    offsets.push({
      npcIndex: u16le(bytes, base),
      fileOffset: u16le(bytes, base + 2),
    });
  }

  const scripts: TalkScript[] = [];
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i]!.fileOffset;
    const end = i + 1 < offsets.length ? offsets[i + 1]!.fileOffset : bytes.length;
    if (start >= bytes.length || end <= start) continue;
    const chunk = bytes.subarray(start, end);
    const rawLines = bytesToScriptLines(chunk, compressedWords, counters);
    scripts.push(structureScript(offsets[i]!.npcIndex, rawLines));
  }

  return { scripts, unknownOps: counters.unknown, totalItems: counters.items };
}

/** Igual que parseTlkFileWithStats pero devolviendo sólo los scripts. */
export function parseTlkFile(bytes: Uint8Array, compressedWords: string[]): TalkScript[] {
  return parseTlkFileWithStats(bytes, compressedWords).scripts;
}
