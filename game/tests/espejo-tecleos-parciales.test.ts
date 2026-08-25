/**
 * COLAPSO DE RACHAS DE TECLEO TOLERANTE A HUECOS — guarda del fix del cabo §7.2 de
 * `espejo-ad-salud` (carril fix-tecleos-parciales).
 *
 * ## El defecto que fija
 *
 * El OCR del LP fotografía la línea de entrada A MITAD de tecleo: una sola getstring del
 * jugador sale del log como varias lecturas parciales («VA · VAR · BARN · BARNABAS»). El
 * colapso viejo de `segment.mjs` exigía ADYACENCIA en `deduped` Y PREFIJO, y ambas se rompen
 * cuando el OCR pierde fotogramas (medido en `fenton-curacion` §3.1: 11 `typed` para 4
 * getstring). Cada parcial no plegado es una respuesta REAL de más en el port: en ad12-g34 un
 * parcial respondiendo al interrogatorio de Blackthorn le cuesta a Shamino la guillotina y
 * rompe la cadena AD entera (`espejo-ad-regeneracion` §5).
 *
 * ## Qué asertos lleva
 *
 * A. SINTÉTICOS con esperado EN CRUDO (palabras inventadas o citadas de re/notes tracked;
 *    cero prosa TLK de EA en este fichero — la guarda de `test_rutas_espejo_sin_prosa_tlk_ea`
 *    manda también aquí).
 * B. REALES contra el ocrlog de ad12 EN DISCO (`original/` es symlink obligatorio de la
 *    receta de worktree): los esperados son NÚMEROS DE LÍNEA y relaciones adjudicadas A MANO
 *    contra el log crudo en el careo del carril — en crudo, no derivados del sujeto.
 *
 * Mutantes ejercidos (rojo comprobado, fuente restaurada byte-idéntica; acta en
 * `re/notes/tecleos-parciales-fix.md`): relación limitada a prefijo-crudo · frontera de
 * prompt anulada · ganador = primera lectura · ventana W_PROG a 1.
 */
import { describe, it, expect } from "vitest";
import { describeSiViaja } from "./assets-opcionales.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEvents,
  computeRachaGroups,
  betterReading,
  isPrompt,
  typedFold,
} from "../e2e/espejo-tour/tools/segment.mjs";

const groupsOf = (lines: string[]) => computeRachaGroups(buildEvents(lines, 1));
/** sólo los grupos con algún miembro typed (proyección compacta para asertos). */
const shape = (lines: string[]) =>
  groupsOf(lines).map((g) => ({ members: g.members.map((m) => m.s), winner: g.winner.s }));

describe("colapso de rachas — sintéticos (esperado en crudo)", () => {
  it("progresión con texto no-eco entre medias (la adyacencia rota del defecto)", () => {
    // el panel redibuja prosa vieja entre dos fotogramas del MISMO tecleo
    expect(
      shape([":GRI", "some panel prose redrawn", ":GRIMBLE"]),
    ).toEqual([{ members: ["GRI", "GRIMBLE"], winner: "GRIMBLE" }]);
  });

  it("izquierda perdida por el OCR: substring, no prefijo (clase :REL → :VAS REL P0R)", () => {
    expect(shape([":IMBLE", ":GRIMBLE"])).toEqual([
      { members: ["IMBLE", "GRIMBLE"], winner: "GRIMBLE" },
    ]);
  });

  it("racha no monótona: la lectura corta posterior no abre grupo (yell fantasma de lf30)", () => {
    // citada en fenton-curacion §3.1 (tracked): :N0FENT0d seguida de :N0FEs, más corta
    expect(shape([":N0FENT0d", ":N0FEs"])).toEqual([
      { members: ["N0FENT0", "N0FE"], winner: "N0FENT0" },
    ]);
  });

  it("un prompt legible entre lecturas = OTRA respuesta (aunque el texto sea compatible)", () => {
    expect(shape([":GRIMBLE", "Your interest?", ":GRIMBLE"])).toEqual([
      { members: ["GRIMBLE"], winner: "GRIMBLE" },
      { members: ["GRIMBLE"], winner: "GRIMBLE" },
    ]);
  });

  it("dos respuestas reales distintas consecutivas NO se funden (fold incompatible)", () => {
    expect(shape([":NAME", ":JOB"])).toEqual([
      { members: ["NAME"], winner: "NAME" },
      { members: ["JOB"], winner: "JOB" },
    ]);
  });

  it("el eco de comando parte la racha: el tecleo quedó confirmado antes de moverse", () => {
    expect(shape([":GRIM", ">Open-North", ":GRIMBLE"])).toEqual([
      { members: ["GRIM"], winner: "GRIM" },
      { members: ["GRIMBLE"], winner: "GRIMBLE" },
    ]);
  });

  it("basura ultracorta pegada al arranque de la racha siguiente se absorbe (clase :UN0)", () => {
    expect(shape([":UN0", ":GRIM", ":GRIMBLE"])).toEqual([
      { members: ["UN0", "GRIM", "GRIMBLE"], winner: "GRIMBLE" },
    ]);
  });

  it("fantasma de cursor: la lectura limpia posterior (prefijo-menos-1) gana a la larga", () => {
    expect(shape([":GRIMBLEN", ":GRIMBLE"])).toEqual([
      { members: ["GRIMBLEN", "GRIMBLE"], winner: "GRIMBLE" },
    ]);
    expect(betterReading("GRIMBLE", "GRIMBLEN")).toBe(true);
    expect(betterReading("GRIM", "GRIMBLEN")).toBe(false); // recorte de 2+ no es cursor
  });

  it("typed y mantra no comparten racha; crudo idéntico sólo funde adyacente", () => {
    expect(shape(["Mantra:LUM", ":LUM"]).length).toBe(2);
    // re-respuesta real: idéntica a distancia >1 (los tres :YES del interrogatorio)
    expect(shape([":YES", "garbage±—™", ":YES"]).length).toBe(2);
    expect(shape([":YES", ":YES"]).length).toBe(1); // frame duplicado adyacente
  });

  it("fold e isPrompt: las clases medidas", () => {
    expect(typedFold("JVB")).toBe(typedFold("JOB"));
    expect(typedFold("DANGFR")).toBe(typedFold("DANGER"));
    expect(typedFold("VTSTTORS")).toBe(typedFold("VISITORS"));
    expect(typedFold("UES")).toBe(typedFold("YES"));
    expect(isPrompt("You respond-")).toBe(true);
    expect(isPrompt("Spell name:")).toBe(true);
    expect(isPrompt("0n who: Johne")).toBe(true); // O→0 del OCR
    expect(isPrompt("random prose line")).toBe(false);
  });
});

// Ídem que su hermano `espejo-dedupe-desmonte`: el bloque «real» lee el ocrlog de
// `original/av-referencia/`, que no viaja. Los 10 sintéticos de arriba se quedan.
describeSiViaja(
  ["original/av-referencia/yt/clips/full-part-logs-ad/ad_ep12.ocrlog.txt"],
  "colapso de rachas — ad12 real (líneas adjudicadas a mano contra el log)",
  () => {
  const LOG = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "original",
    "av-referencia",
    "yt",
    "clips",
    "full-part-logs-ad",
    "ad_ep12.ocrlog.txt",
  );
  // original/ es uno de los CUATRO symlinks OBLIGATORIOS de la receta de worktree
  // (CLAUDE.md REGLA 2): si falta, este test debe ponerse ROJO nombrándolo, no saltarse.
  it("el ocrlog fuente existe (receta de symlinks completa)", () => {
    expect(existsSync(LOG), `falta ${LOG} — symlink original/ de la receta REGLA 2`).toBe(true);
  });

  const groups = existsSync(LOG)
    ? computeRachaGroups(buildEvents(readFileSync(LOG, "utf8").split("\n"), 1))
    : [];
  const groupAt = (ln: number) => groups.find((g) => g.members.some((m) => m.ln === ln));

  it("la racha de la guillotina: 5177+5179+5180+5182 es UN grupo y gana la lectura de 5182", () => {
    const g = groupAt(5177)!;
    expect(g.members.map((m) => m.ln)).toEqual([5177, 5179, 5180, 5182]);
    expect(g.winner.ln).toBe(5182);
  });

  it("las tres respuestas :YES reales del interrogatorio (5226/5231/5241) NO se funden", () => {
    const lns = [5226, 5231, 5241].map((ln) => groupAt(ln)!);
    expect(new Set(lns).size).toBe(3);
    for (const g of lns) expect(g.members.length).toBe(1);
  });

  it("4188+4190+4196 es un grupo (misma respuesta) y 4199 es OTRA respuesta real", () => {
    const g = groupAt(4188)!;
    expect(g.members.map((m) => m.ln)).toEqual([4188, 4190, 4196]);
    expect(groupAt(4199)).not.toBe(g);
  });

  it("fantasma de cursor en 6789/6791: un grupo y gana la lectura limpia de 6791", () => {
    const g = groupAt(6789)!;
    expect(g.members.map((m) => m.ln)).toEqual([6789, 6791]);
    expect(g.winner.ln).toBe(6791);
  });

  it("absorción: 5248 (basura corta) + 5249 + 5253 es un grupo y gana 5253", () => {
    const g = groupAt(5248)!;
    expect(g.members.map((m) => m.ln)).toEqual([5248, 5249, 5253]);
    expect(g.winner.ln).toBe(5253);
  });

  it("re-pregunta real con prompt entre medias: 3399 y 3404 quedan en grupos distintos", () => {
    expect(groupAt(3399)).not.toBe(groupAt(3404));
  });
  },
);
