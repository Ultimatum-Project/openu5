/**
 * #142 — LINT DEL GÉNERO «COMILLA LITERAL».
 *
 * EL GÉNERO. El binario lleva la puntuación de la frase —comillas de apertura/cierre,
 * saltos de borde, la atribución de quién habla— y el port la poda al escribir el
 * literal. El ejemplar de referencia es el «Nay!» de #130.
 *
 * QUÉ CRUZA, y por qué no hay escáner nuevo (regla de la casa: parametrizar el
 * extractor compartido). Los dos lados salen de los DOS extractores que ya existen:
 *
 *   · PORT   → `tools/extract-user-strings.mjs` `extractUserStrings()`, el mismo que
 *              alimentan `string-manifest`, `gen-string-manifest` e `i18n-corpus`.
 *              Si alguien añade un sink, este lint lo hereda el mismo día.
 *   · BINARIO→ `tools/i18n-corpus.mjs` `buildCorpusBySurface()`, el corpus de datos
 *              extraído de DATA.OVL / SHOPPE.DAT / TALK.
 *
 * CRITERIO. Un literal del port es CANDIDATO si, recortando comillas y saltos de los
 * DOS BORDES, coincide con una cadena del binario que NO es igual a él, **y la
 * diferencia incluye al menos una comilla**. Lo último no es cosmético: sin ello el
 * censo sube de 10 a 265 porque el `\n` FINAL lo pone el impresor de consola y el
 * port lo omite a propósito (#108) — eso es política del impresor, no este género.
 *
 * ★★ LÍMITE ESTRUCTURAL, y es el que más caro sale: EL LADO BINARIO ES UN CORPUS DE
 * CADENAS, y en este binario **buena parte de la puntuación no vive en las cadenas
 * sino en `putchar`**. Los emisores de TALK.OVL abren y cierran comillas con
 * `mov ax,0x22 / call 0x573a` (putchar, kernel 0x16ba) ALREDEDOR del `print_string`:
 *
 *   | offset            | instrucción                          | efecto            |
 *   |-------------------|--------------------------------------|-------------------|
 *   | `TALK.OVL:0x02f9` | `mov ax,0x22` / `call 0x573a`        | putchar('"')      |
 *   | `TALK.OVL:0x0300` | `mov ax,0x913a` / `call 0x58d0`      | print «Pass, friend!» |
 *   | `TALK.OVL:0x0307` | `mov ax,0x22` / `call 0x573a`        | putchar('"')      |
 *
 * Por eso un candidato «el port pone comillas que el binario no tiene» NO es un
 * veredicto: puede ser el port siendo FIEL y el corpus siendo ciego. Tres de los diez
 * de abajo son exactamente eso. Mismo agujero para la puntuación COMPUESTA de varios
 * fragmentos (santuario: `\n"` es una cadena propia, DS 0x2b6b).
 *
 * ★ LO QUE ADEMÁS NO VE, medido contra los sapos nombrados en #142:
 *
 *   1. LA SUB-FAMILIA DE ATRIBUCIÓN. Cuando el port no poda un borde sino que se come
 *      un TROZO («\nsays $.», «\nyells ») el recorte de bordes ya no empareja. Se
 *      pierden así `No one here is from thy party!` (DS 0x4f7a) y `CAN'T PAY? Beat it!`
 *      (DS 0x9af6 / 0x9c20), que además APLANA a espacio un `\n` INTERNO.
 *   2. EL HOMÓNIMO EN OTRA SUPERFICIE. El lado binario es un CONJUNTO plano, así que si
 *      la forma podada existe por su cuenta en cualquier superficie, el port queda
 *      absuelto. Medido: `What didst thou say?` (sapo vivo, DS 0x9450 =
 *      `\n\n"What didst thou say?`) NO sale, porque `talk/castle.json#text` lleva la
 *      misma frase suelta como línea de un NPC.
 *   3. SI EL LITERAL SE EMITE O NO. `extractUserStrings` recoge literales con FORMA de
 *      mensaje, no emisiones. Dos de los diez cuelgan de un `message:` que ningún
 *      consumidor lee (§B), y su hermano FIEL ya está cableado.
 *
 * O sea: caza la PUNTUACIÓN DE BORDE que vive DENTRO de una cadena, y de los sapos
 * nombrados ve uno. Su valor no es el recall — es el TRINQUETE: congela la población y
 * ningún alta puede colarse callando.
 *
 * Adjudicación completa de los diez: `re/notes/generos-b-194-t2-acta.md §3`.
 */
import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { extractUserStrings, shellFiles, isTechnical } from "../tools/extract-user-strings.mjs";
import { buildCorpusBySurface } from "../tools/i18n-corpus.mjs";

const SRC = join(__dirname, "..", "src");
const CORE = join(SRC, "core");

/** Recorta comillas y saltos de los DOS bordes. */
const trimQuoteNL = (s: string) => s.replace(/^["\n]+/, "").replace(/["\n]+$/, "");
/** Recorta SÓLO saltos: separa «política del impresor» (#108) de «comilla podada». */
const trimNL = (s: string) => s.replace(/^\n+/, "").replace(/\n+$/, "");

function binaryStrings(): Set<string> {
  const out = new Set<string>();
  for (const s of buildCorpusBySurface() as { strings: string[] }[]) {
    for (const t of s.strings) if (typeof t === "string") out.add(t);
  }
  return out;
}

/** El emparejador, aislado para poder dispararlo contra un caso sintético. */
export function quoteCandidates(
  live: Map<string, string>,
  bin: Set<string>,
): { text: string; loc: string; cands: string[] }[] {
  const byTrim = new Map<string, string[]>();
  for (const b of bin) {
    const k = trimQuoteNL(b);
    if (!byTrim.has(k)) byTrim.set(k, []);
    byTrim.get(k)!.push(b);
  }
  const out: { text: string; loc: string; cands: string[] }[] = [];
  for (const [text, loc] of live) {
    if (isTechnical(text) || bin.has(text)) continue;
    const cands = (byTrim.get(trimQuoteNL(text)) ?? []).filter((b) => b !== text);
    if (!cands.length) continue;
    if (cands.some((b) => trimNL(b) === trimNL(text))) continue; // sólo salto → #108
    out.push({ text, loc, cands });
  }
  return out.sort((a, b) => a.text.localeCompare(b.text));
}

/**
 * POBLACIÓN CONGELADA — los 10 candidatos vivos en `main@f557864a`, los diez
 * adjudicados uno a uno contra los bytes de DATA.OVL/SHOPPE.DAT y contra el ASM de su
 * emisor en `re/notes/generos-b-194-t2-acta.md §3`. Se congela por TEXTO del port, no
 * por `fichero:línea`: la línea se mueve con cualquier edición de arriba y pondría el
 * trinquete rojo sin que el género se haya movido. (Y el `loc` que reporta el extractor
 * para una propiedad de objeto es la línea de la DECLARACIÓN, no la del literal.)
 *
 * La convención de cita: DS = fileoff de DATA.OVL − 0x10, derivada aquí contra seis
 * citas previas del repo que no la habían escrito junta (acta §2).
 *
 * Cómo se retira una entrada: arreglando el literal (entonces el par deja de casar) y
 * borrando su línea de aquí, en el MISMO commit. Un alta nueva rompe el test; una baja
 * no anotada también.
 */
const ADJUDICADOS: Record<string, string> = {
  // (A) SAPO VIVO Y EMITIDO — VACÍO. Los dos que había (`Thy friend has died, by the way.`
  //     en shops.ts:538 y `I thank thee!` en commands.ts:249) se ARREGLARON en #142: el
  //     port emite hoy la forma VERBATIM del binario (DS 0x5005 y DS 0x8b36), así que el
  //     emparejador ya no los ve y sus líneas se retiran de aquí en el MISMO commit, como
  //     manda el protocolo de arriba. El CONTROL POSITIVO de este fichero NO depende de
  //     ellos: dispara sobre la forma podada SINTÉTICA, no sobre el literal del port.

  // (B) SOMBRA — literal con forma de mensaje que NINGÚN consumidor lee, y cuyo hermano
  //     FIEL ya está cableado. No es divergencia de fidelidad hoy; lo sería el día que
  //     alguien enchufe el campo.
  "Anything else?":
    "shops.ts buyRations (la UI no lee r.message). Su OTRO productor, buyProvisions, " +
    "quedó PODADO por la tarjeta #40: no había mercader de provisiones en el binario. " +
    "FIEL YA CABLEADO: SHOP_UI.reagentAnythingElse = DS 0x79a2 " +
    "`\"Anything else?\\n\\n` (SHOPPES 0x0644) en shop-console.ts:1751",
  "Hrumph.":
    "shops.ts:940 buyRations (la UI no lee r.message). FIEL YA CABLEADO: " +
    "SHOP_UI.tavernHrumph = DS 0x9c6a `\\n\\n\"Hrumph.\"` (SHOPPES2 0x0422) en " +
    "shop-console.ts:2305",

  // (C) ABSUELTO — el port es FIEL y el corpus es CIEGO: las comillas son putchar(0x22)
  //     vía kernel 0x16ba (call 0x573a), no bytes de la cadena. Ver el docblock.
  '"Pass, friend!"':
    "guard-encounters.ts — FIEL: TALK 0x02f9 putchar('\"') · 0x0300 print DS 0x913a · " +
    "0x0307 putchar('\"') · 0x030e putchar('\\n')",
  '"Don\'t hurt me!\nPlease go away!"\n':
    "game.ts tryTalkPossessed — FIEL: TALK 0x03ad putchar('\"') · 0x03b4 print DS 0x9176 · " +
    "0x03bb putchar('\"') · 0x03c2 putchar('\\n') — el \\n final TAMBIÉN es del putchar " +
    "(gargolas-hostiles-palacio.md §8.2; antes el port lo recortaba)",
  '"Thou hast not enough gold!"':
    "effects.ts:105 — FIEL: TALK 0x0657 putchar('\"') · 0x065e print DS 0x9328 · " +
    "0x0665 putchar('\"'). El call-site YA lo documenta (effects.ts:102-104)",

  // (D) ABSUELTO — puntuación COMPUESTA de varios fragmentos: MAINOUT 0x0ca6 imprime
  //     DS 0x2b6b (`\n"`) SIEMPRE, antes de las dos ramas del guardián.
  '\n"Pass, Seeker!"\n':
    "shrine-ceremonies.ts:164 — FIEL: MAINOUT 0x0ca6 print DS 0x2b6b `\\n\"` + 0x0cb4 print " +
    "DS 0x2b6e `Pass, Seeker!\"\\n`",
  '\n"Thou art not upon a Sacred Quest!\n':
    "shrine-ceremonies.ts:166 — FIEL: MAINOUT 0x0ca6 DS 0x2b6b + 0x0cbe DS 0x2b7e; el cierre " +
    "va en DS 0x2ba1 `Passage denied!\"\\n` (0x0cc5), que el port SÍ emite como mensaje " +
    "aparte en shrine-ceremonies.ts:167",

  // (E) DEGRADACIÓN SOLO-PORT — no hay conducta del binario que calcar.
  "Come again!":
    "cmd-strings.ts SHOP_UI.farewell — fallback sin pool de assets (shop-console.ts:2404/2409). " +
    "La vía FIEL compone farewellQuoteOpen (`\\n\\n\"`, DS 0x7854/0x7858) + shoppe.json[idx], " +
    "y el registro 6 de SHOPPE.DAT (fileoff 0x0076, bytes ASCII sin comprimir) ya trae su " +
    "comilla de cierre: `Come again!\"`",
};

describe("#142 — género COMILLA LITERAL (lint sobre los extractores compartidos)", () => {
  const live = extractUserStrings(CORE, shellFiles(SRC)) as Map<string, string>;
  const bin = binaryStrings();

  it("★ CONTROL POSITIVO: el emparejador DISPARA sobre un sapo conocido", () => {
    // `Thy friend has died, by the way."` con su comilla de cierre está en el corpus
    // del binario; el port la emite sin ella. Si esto no dispara, el lint no mide nada.
    const sapo = "Thy friend has died, by the way.";
    expect(bin.has(`${sapo}"\n`), "el corpus del binario ya no trae la cadena con comilla").toBe(true);
    const solo = quoteCandidates(new Map([[sapo, "control/positivo.ts:1"]]), bin);
    expect(solo.map((h) => h.text)).toEqual([sapo]);
  });

  it("★ CONTROL NEGATIVO: una diferencia de SÓLO salto no dispara (#108)", () => {
    // «Blocked!» vive en el binario como `Blocked!\n`; el `\n` lo pone el impresor.
    expect(bin.has("Blocked!\n"), "control degenerado: la cadena de control no está").toBe(true);
    expect(quoteCandidates(new Map([["Blocked!", "control/negativo.ts:1"]]), bin)).toEqual([]);
  });

  it("el corpus del binario no está vacío (guarda contra el cero silencioso)", () => {
    expect(bin.size).toBeGreaterThan(4000);
    expect(live.size).toBeGreaterThan(500);
  });

  it("la población del género es EXACTAMENTE la adjudicada (trinquete)", () => {
    const hits = quoteCandidates(live, bin);
    const vistos = hits.map((h) => h.text).sort();
    const esperados = Object.keys(ADJUDICADOS).sort();
    const altas = hits.filter((h) => !(h.text in ADJUDICADOS));
    const bajas = esperados.filter((t) => !vistos.includes(t));
    expect(
      altas.map((h) => `${h.loc}  port=${JSON.stringify(h.text)}  bin=${h.cands.map((c) => JSON.stringify(c)).join(" | ")}`),
      "ALTAS sin adjudicar del género comilla-literal (#142): adjudícalas en re/notes/generos-b-194-t2-acta.md y anótalas en ADJUDICADOS",
    ).toEqual([]);
    expect(bajas, "BAJAS no anotadas: si el fix es legítimo, borra la entrada de ADJUDICADOS en el mismo commit").toEqual([]);
  });
});
