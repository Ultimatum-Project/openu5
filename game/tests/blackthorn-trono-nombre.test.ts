/**
 * El TRONO de Blackthorn y el nombre del Avatar — bucle del 24-08 (capturas
 * bt-conv-1..3 del usuario: teclear «Avatar» y recibir «I think not, let's try
 * again!» PARA SIEMPRE).
 *
 * DERIVACIÓN (guion TLK real, game/assets/talk/castle.json, NPC 10 «Blackthorn»):
 *   description «the Dark Lord himself!» → IfElseKnowsName → label 0 (conocido)
 *   / label 4 (desconocido). Label 4: «Who dares approach the mighty Blackthorn?»
 *   + AskName; si el nombre CASA → label 0 («Greetings,  <nombre>…»); si no →
 *   «I think not, let's try again!» + goto label 4 — el BUCLE es de diseño: el
 *   original re-pregunta sin contador hasta que digas un nombre del grupo.
 * Comparador (TALK.OVL talk_ask_thy_name 0x0e78-0x0f31, leído en crudo):
 *   entrada vacía → «If you say so...» directo (0x0ea4); si no, recorre TODO el
 *   grupo (0x0eb0..0x0f20, stride 0x20), aguja = 4 PRIMEROS bytes del registro
 *   (0x0ec6 cx=2 palabras; terminador en la 5ª, 0x0edd), match = subcadena
 *   case-fold (stristr kernel 0x6f1e) con frontera de palabra (0x0ef7 exige 0x20
 *   antes). Con match: marca npcMet (0x0efe call 0xd42) + «A pleasure!» (0x94a0).
 *
 * LA RAÍZ del bucle era del PORT, no del guion: el estado «avatar sin bautizar»
 * (nombre "" — sólo-port: INIT.GAM trae el campo a ceros y `createNewGame(init)`
 * sin creación lo copia verbatim; en 1988 es INALCANZABLE: FONT.OVL 0x0bc4-0x0bd6
 * re-gatea el nombre vacío en la creación e INTRO.OVL 0x0ec9 usa ese byte como
 * predicado de «hay personaje») hacía que el panel mostrase «Avatar» (fallback de
 * display) mientras el comparador careaba contra "" — nada casaba jamás. El fix es
 * de ROBUSTEZ: fuente ÚNICA `effectiveName` (core/party) para display Y comparador.
 * Esperados EN CRUDO del guion TLK y del corpus de saves.
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
import { parseSaveWindow } from "../src/core/saveNative.js";
import { createNewGame, type ExtractedInitialState } from "../src/core/state.js";
import { effectiveName, avatarName, partyEffectiveNames } from "../src/core/party.js";

function readAsset(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

function findBlackthorn(): TalkScript {
  const scripts = JSON.parse(readAsset("../assets/talk/castle.json")) as TalkScript[];
  const bt = scripts.find((s) => {
    const first = s.name[0];
    return first?.kind === "text" && first.text.trim() === "Blackthorn";
  });
  if (!bt) throw new Error("Blackthorn no está en castle.json");
  return bt;
}

function lines(outputs: DialogueOutput[]): string {
  return outputs
    .filter((o): o is Extract<DialogueOutput, { kind: "line" }> => o.kind === "line")
    .map((o) => o.text)
    .join(" ");
}

function hasQuestionPrompt(outputs: DialogueOutput[]): boolean {
  return outputs.some((o) => o.kind === "prompt" && o.question);
}

function hasEffect(outputs: DialogueOutput[], kind: string): boolean {
  return outputs.some((o) => o.kind === "effect" && o.effect.kind === kind);
}

/** Estado de partida nueva SIN pasar por la gitana (la vía que deja el "" sólo-port). */
function unbaptizedState() {
  const init = JSON.parse(readAsset("../assets/initial-state.json")) as ExtractedInitialState;
  return createNewGame(init);
}

/** Contexto como lo construye talk-console (fuente única de nombres efectivos). */
function throneCtx(state = unbaptizedState()): ConversationContext {
  return {
    avatarName: avatarName(state),
    partyNames: partyEffectiveNames(state),
    npcKnowsAvatar: false,
  };
}

describe("vía (a) — el parser del save nativo NO lee vacío donde el save trae nombre", () => {
  // Corpus canónico (espejo AD): el Avatar de esas partidas se llama Barnabas.
  // Esperado EN CRUDO — si el layout (offset 0x02 + stride 0x20 + campo de 9 con
  // NUL, calco de DS 0x55a8) se corriese un byte, esto enrojece.
  it("ad01.gam: registro 0 = Barnabas, compañeros exactos", () => {
    const gam = new Uint8Array(
      readFileSync(fileURLToPath(new URL("../e2e/espejo-tour/saves/ad01.gam", import.meta.url))),
    );
    const parsed = parseSaveWindow(gam);
    expect(parsed.characters[0]!.name).toBe("Barnabas");
    expect(parsed.characters.slice(1, 4).map((c) => c.name)).toEqual(["Shamino", "Iolo", "Gwenno"]);
    const state = createNewGame(parsed);
    expect(avatarName(state)).toBe("Barnabas"); // con nombre real NO hay fallback
    expect(partyEffectiveNames(state)[0]).toBe("Barnabas");
  });
});

describe("vía (d) — el estado sin bautizar existe en el port y el panel muestra el fallback", () => {
  it("initial-state: campo crudo VACÍO, nombre efectivo «Avatar» en las dos caras", () => {
    const state = unbaptizedState();
    expect(state.characters[0]!.name).toBe(""); // el dato crudo del template (INIT.GAM 0x02-0x0a = 00×9)
    expect(state.characters[0]!.class).toBe("A");
    expect(avatarName(state)).toBe("Avatar"); // cara display
    expect(partyEffectiveNames(state)[0]).toBe("Avatar"); // cara comparador — LA MISMA
    expect(effectiveName("")).toBe("Avatar");
    expect(effectiveName("   ")).toBe("Avatar"); // sólo-espacios = sin bautizar
    expect(effectiveName("Barnabas")).toBe("Barnabas"); // con nombre real, identidad
  });
});

describe("el trono (castle.json label 4) — conversación completa", () => {
  it("apertura de DESCONOCIDO: Dark Lord + «Who dares…» + AskName suspendido", () => {
    const convo = new Conversation(findBlackthorn(), throneCtx());
    const o = convo.start();
    const txt = lines(o);
    expect(txt).toContain("the Dark Lord himself!");
    expect(txt).toContain("Who dares approach the mighty Blackthorn?");
    expect(txt).toContain('What is thy name?"');
    expect(hasQuestionPrompt(o)).toBe(true);
  });

  it("FIX del bucle: con avatar sin bautizar, teclear «Avatar» CASA y entra al label 0", () => {
    const convo = new Conversation(findBlackthorn(), throneCtx());
    convo.start();
    const o = convo.input("Avatar");
    const txt = lines(o);
    expect(txt).toContain('"A pleasure!'); // DS 0x94a0
    // Label 0 con <AvatarsName> — doble espacio del literal TLK «Greetings,  ».
    expect(txt).toContain("Greetings,  Avatar, what an unexpected pleasure!");
    expect(txt).toContain("Wilt thou be staying with us long?");
    expect(txt).not.toContain("I think not");
  });

  it("calco 0x0e78: casan el prefijo de 4 («Avat») y el case-fold («aVaTaR»)", () => {
    for (const answer of ["Avat", "aVaTaR"]) {
      const convo = new Conversation(findBlackthorn(), throneCtx());
      convo.start();
      expect(lines(convo.input(answer))).toContain('"A pleasure!');
    }
  });

  it("nombre desconocido: «If you say so…» + «I think not» y RE-pregunta (bucle FIEL, sin contador)", () => {
    const convo = new Conversation(findBlackthorn(), throneCtx());
    convo.start();
    const o1 = convo.input("Fulano");
    const t1 = lines(o1);
    expect(t1).toContain('"If you say so...'); // DS 0x948c/0x94b0
    expect(t1).toContain("I think not, let's try again!");
    expect(t1).toContain("Who dares approach the mighty Blackthorn?");
    expect(hasQuestionPrompt(o1)).toBe(true); // vuelve a preguntar el nombre
    // Segunda vuelta idéntica — el original NO lleva contador de intentos.
    const o2 = convo.input("Mengano");
    expect(lines(o2)).toContain("I think not, let's try again!");
    expect(hasQuestionPrompt(o2)).toBe(true);
  });

  it("respuesta VACÍA al nombre: «If you say so…» directo (0x0ea4) — y el bucle sigue", () => {
    const convo = new Conversation(findBlackthorn(), throneCtx());
    convo.start();
    const o = convo.input("");
    expect(lines(o)).toContain('"If you say so...');
    expect(hasQuestionPrompt(o)).toBe(true);
  });

  it("flujo 1988 completo: nombre → y → y → password IMPERA → invitado del castillo", () => {
    const convo = new Conversation(findBlackthorn(), throneCtx());
    convo.start();
    convo.input("Avatar");
    const o1 = convo.input("y");
    expect(lines(o1)).toContain("Hast thou joined us in the Oppression?");
    const o2 = convo.input("y");
    expect(lines(o2)).toContain("Then, surely, thou dost know our password....");
    const o3 = convo.input("impera");
    const t3 = lines(o3);
    expect(t3).toContain("Fine! With thee on our side, we shall be invincible!");
    expect(t3).toContain("Please, feel free to roam my castle and grounds!");
    expect(hasEffect(o3, "end")).toBe(true);
  });

  it("las tres salidas en falso llaman a la GUARDIA (CallGuards)", () => {
    // «no» al quedarse / «no» a la Opresión / password errónea — cada rama termina
    // en «Guards! Seize this infidel!» (o «Prepare now to meet thy fate!») + captura.
    const escenarios: Array<{ pasos: string[]; texto: string }> = [
      { pasos: ["n"], texto: "Prepare now to meet thy fate!" },
      { pasos: ["y", "n"], texto: "Guards! Seize this infidel!" },
      { pasos: ["y", "y", "opera"], texto: "Guards! Seize this infidel!" },
    ];
    for (const { pasos, texto } of escenarios) {
      const convo = new Conversation(findBlackthorn(), throneCtx());
      convo.start();
      convo.input("Avatar");
      let last: DialogueOutput[] = [];
      for (const p of pasos) last = convo.input(p);
      expect(lines(last)).toContain(texto);
      expect(hasEffect(last, "callGuards")).toBe(true);
    }
  });

  it("con nombre REAL (save nativo Barnabas), el trono reconoce «Barnabas»", () => {
    const gam = new Uint8Array(
      readFileSync(fileURLToPath(new URL("../e2e/espejo-tour/saves/ad01.gam", import.meta.url))),
    );
    const state = createNewGame(parseSaveWindow(gam));
    const convo = new Conversation(findBlackthorn(), throneCtx(state));
    convo.start();
    const txt = lines(convo.input("Barnabas"));
    expect(txt).toContain('"A pleasure!');
    expect(txt).toContain("Greetings,  Barnabas, what an unexpected pleasure!");
  });
});
