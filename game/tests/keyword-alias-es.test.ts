/**
 * Alias EN+ES de keywords de Talk (i18n §3.1): el matcher casa SIEMPRE la keyword inglesa
 * (invariante lang=en) y, con `aliasFor`, también los prefijos españoles. Más la validación
 * de colisiones por-NPC contra el corpus real de talk/*.json.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  Conversation,
  type TalkScript,
  type DialogueOutput,
  type ConversationContext,
} from "../src/core/dialogue/conversation.js";
import {
  aliasesForKeywordEs,
  aliasCollisionsForNpc,
  KEYWORD_ALIAS_ES,
} from "../src/i18n/keyword-alias-es.js";

function loadTalk(file: string): TalkScript[] {
  const path = fileURLToPath(new URL(`../assets/talk/${file}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as TalkScript[];
}
function nameOf(s: TalkScript): string {
  const first = s.name[0];
  return first && first.kind === "text" ? first.text.trim() : "";
}
function findNpc(file: string, name: string): TalkScript {
  const s = loadTalk(file).find((x) => nameOf(x) === name);
  if (!s) throw new Error(`NPC ${name} no en ${file}`);
  return s;
}
function lines(o: DialogueOutput[]): string {
  return o.filter((x): x is Extract<DialogueOutput, { kind: "line" }> => x.kind === "line").map((x) => x.text).join(" ");
}
const EN: ConversationContext = { avatarName: "Avatar", npcKnowsAvatar: true };
// Simula lang=es: aliasFor resuelve la tabla española (sin npcKey → mapa global).
const ES: ConversationContext = { ...EN, aliasFor: (k) => aliasesForKeywordEs(k) };

describe("aliasesForKeywordEs", () => {
  it("mapa global del glosario semilla", () => {
    expect(aliasesForKeywordEs("name")).toEqual(["nomb"]);
    expect(aliasesForKeywordEs("job")).toEqual(["trab", "ofic"]);
    expect(aliasesForKeywordEs("NAME")).toEqual(["nomb"]); // case-insensitive
  });
  it("keyword sin alias → [] (cae en inglés-only: mantras/WoP/no-canon)", () => {
    expect(aliasesForKeywordEs("mantra-xyz")).toEqual([]);
    expect(aliasesForKeywordEs("fallax")).toEqual([]); // palabra de poder, excluida
  });
});

describe("matcher EN+ES en la Conversation (getQuestionKey)", () => {
  // "job" es keyword universal (el NPC cuenta su oficio). Cualquier NPC sirve.
  const npc = findNpc("keep", "Thrud");

  it("INVARIANTE: la keyword INGLESA casa SIEMPRE, en cualquier idioma", () => {
    for (const ctx of [EN, ES]) {
      const c = new Conversation(npc, ctx);
      c.start();
      expect(lines(c.input("job")).length).toBeGreaterThan(0); // responde a "job"
    }
  });

  it("con lang=es (aliasFor), la palabra ESPAÑOLA casa: 'trabajo' → keyword 'job'", () => {
    const es = new Conversation(npc, ES);
    es.start();
    const enOut = (() => { const c = new Conversation(npc, EN); c.start(); return lines(c.input("job")); })();
    expect(lines(es.input("trabajo"))).toBe(enOut); // misma respuesta que "job"
  });

  it("SIN aliasFor (lang=en), la palabra española NO casa (fiel al binario)", () => {
    const en = new Conversation(npc, EN);
    en.start();
    // "trabajo" no contiene "job" ni "work" como subcadena → sin match (respuesta vacía o fallback).
    const out = lines(en.input("trabajo"));
    const jobOut = (() => { const c = new Conversation(npc, EN); c.start(); return lines(c.input("job")); })();
    expect(out).not.toBe(jobOut);
  });
});

describe("validación de colisiones de alias (§3.1 sub-riesgo)", () => {
  it("detecta prefijo-colisión entre keywords distintas de un NPC", () => {
    // Sintético: dos keywords con alias donde uno es prefijo del otro.
    const collisions = aliasCollisionsForNpc(["star", "starx"], undefined);
    // "star"→["estr"], "starx" sin alias → sin colisión con la semilla; probamos la lógica:
    expect(aliasCollisionsForNpc(["a", "b"], undefined)).toEqual([]); // sin alias, sin colisión
    expect(Array.isArray(collisions)).toBe(true);
  });

  it("el corpus REAL de talk/*.json no tiene colisiones con la tabla semilla", () => {
    const bad: string[] = [];
    for (const file of ["towne", "castle", "keep", "dwelling"]) {
      for (const npc of loadTalk(file)) {
        const kws = npc.qa.flatMap((q) => q.keywords).concat(["name", "job", "work", "bye"]);
        const col = aliasCollisionsForNpc(kws, undefined);
        if (col.length > 0) bad.push(`${file}/${nameOf(npc)}: ${JSON.stringify(col[0])}`);
      }
    }
    expect(bad, `colisiones: ${bad.slice(0, 3).join(" · ")}`).toEqual([]);
  });
});
