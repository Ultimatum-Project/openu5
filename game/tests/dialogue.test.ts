/**
 * Tests del intérprete de diálogo TLK contra los assets REALES extraídos de
 * Ultima V (game/assets/talk/*.json): description/greeting/prompt, navegación de
 * labels con preguntas del NPC, AskName y efectos.
 *
 * El matching de keywords es **stristr** (subcadena), DERIVADO de ULTIMA.EXE 0x6f1e
 * (`re/notes/kernel-sweep-3.md:315`) con el gate de frontera TALK.OVL 0b5b-0b64 —
 * ver `conversation.ts:189` (`stristrIndex`). NO es `startsWith`: los propios tests
 * de abajo lo refutan («'the dawn' casa — startsWith NO lo haría», #50).
 *
 * Esta cabecera decía «el flujo fiel a Ultima5Redux ... matching por prefijo
 * (input.startsWith(keyword))». Redux es una reimplementación de TERCEROS, no el
 * binario, y la descripción del matching estaba además OBSOLETA respecto a los tests
 * de este mismo fichero. Corregida a la derivación real (barrido prosa-autofiel t3).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  Conversation,
  PHRASES,
  type TalkScript,
  type ScriptLine,
  type DialogueOutput,
  type ConversationContext,
} from "../src/core/dialogue/conversation.js";

function loadTalk(file: string): TalkScript[] {
  const path = fileURLToPath(new URL(`../assets/talk/${file}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as TalkScript[];
}

function nameOf(s: TalkScript): string {
  const first = s.name[0];
  return first && first.kind === "text" ? first.text.trim() : "";
}

function findNpc(file: string, name: string): TalkScript {
  const script = loadTalk(file).find((s) => nameOf(s) === name);
  if (!script) throw new Error(`NPC ${name} no encontrado en ${file}.json`);
  return script;
}

/** Concatena el texto de todos los outputs `line`. */
function lines(outputs: DialogueOutput[]): string {
  return outputs
    .filter((o): o is Extract<DialogueOutput, { kind: "line" }> => o.kind === "line")
    .map((o) => o.text)
    .join(" ");
}

function effects(outputs: DialogueOutput[]): DialogueOutput[] {
  return outputs.filter((o) => o.kind === "effect");
}

function hasPrompt(outputs: DialogueOutput[], question: boolean): boolean {
  return outputs.some((o) => o.kind === "prompt" && o.question === question);
}

const CTX: ConversationContext = { avatarName: "Avatar", npcKnowsAvatar: false };

describe("Conversation — Thrud (keep.json, mercenario de la Resistencia)", () => {
  it("start() emite description + prompt 'Your interest?'", () => {
    const thrud = findNpc("keep", "Thrud");
    const convo = new Conversation(thrud, CTX);
    const out = convo.start();
    // description real: "a dark, heavyset man." -> "You see a dark, heavyset man."
    expect(lines(out)).toContain("You see a dark, heavyset man.");
    expect(hasPrompt(out, false)).toBe(true);
    expect(convo.ended).toBe(false);
  });

  it("input('job') responde texto no vacío", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    const out = convo.input("job");
    // job real: "An infamous mercenary!"
    expect(lines(out)).toContain("An infamous mercenary!");
    expect(lines(out).trim().length).toBeGreaterThan(0);
  });

  it("flujo Resistencia: item -> y -> dawn entrega la espada y el escudo enjoyados", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();

    // "item" salta al label 1: ofrece las armas y hace una pregunta del NPC.
    const o1 = convo.input("item");
    expect(lines(o1)).toContain("Jeweled Sword and Shield");
    expect(hasPrompt(o1, true)).toBe(true);

    // "y" salta al label 2: pide la contraseña de la Resistencia.
    const o2 = convo.input("y");
    expect(lines(o2)).toContain("Resistance's password");
    expect(hasPrompt(o2, true)).toBe(true);

    // "dawn" es la contraseña real -> respuesta de la Resistencia + entrega ítems.
    const o3 = convo.input("dawn");
    expect(lines(o3)).toContain("May they serve thee well!");
    const items = effects(o3)
      .map((e) => (e.kind === "effect" ? e.effect : null))
      .filter((e) => e && e.kind === "giveItem")
      .map((e) => (e as { item: number }).item);
    // Change:8 = espada enjoyada, Change:28 = escudo enjoyado.
    expect(items).toEqual([8, 28]);
    expect(effects(o3).some((e) => e.kind === "effect" && e.effect.kind === "end")).toBe(true);
    expect(convo.ended).toBe(true);
  });

  it("matching fiel: 'dawning' (input más largo) casa con la keyword 'dawn' en idx 0", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    convo.input("item");
    convo.input("y");
    // keywordMatches: "dawn" es subcadena de "dawning" en idx 0 -> frontera OK.
    const out = convo.input("dawning");
    expect(lines(out)).toContain("May they serve thee well!");
    expect(convo.ended).toBe(true);
  });

  it("matching fiel: 'the dawn' (keyword en 2ª palabra) casa — startsWith NO lo haría", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    convo.input("item");
    convo.input("y");
    // "dawn" aparece tras un espacio -> frontera de palabra OK (gate 0b5b-0b64).
    const out = convo.input("the dawn");
    expect(lines(out)).toContain("May they serve thee well!");
    expect(convo.ended).toBe(true);
  });

  it("keyword desconocida -> fallback y la conversación continúa", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    const out = convo.input("xyzzy");
    expect(lines(out)).toContain('"I cannot help thee with that.');
    expect(convo.ended).toBe(false);
    // Tras el fallback sigue habiendo prompt para continuar.
    expect(hasPrompt(out, false)).toBe(true);
  });

  it("input('bye') termina la conversación", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    const out = convo.input("bye");
    expect(lines(out)).toContain("Uhmph!"); // bye real de Thrud
    expect(effects(out).some((e) => e.kind === "effect" && e.effect.kind === "end")).toBe(true);
    expect(convo.ended).toBe(true);
  });
});

// ─── Matching de keywords fiel al binario (stristr, tarea #50) ────────────────
// Motor DOS: ULTIMA.EXE 0x6f1e stristr(input, keyword) + gate de frontera de
// palabra TALK.OVL 0b5b-0b64. NPC sintético para controlar la tabla exacta.
function txt(s: string): ScriptLine {
  return [{ kind: "text", text: s }];
}

function syntheticNpc(): TalkScript {
  return {
    npcIndex: 0,
    name: txt("Tester"),
    description: txt("a test dummy."),
    greeting: txt("Hail."),
    job: txt("JOB-ANSWER"),
    bye: txt("Farewell."),
    // Orden de inserción en la tabla tras name/job/work/bye: heal, health.
    qa: [
      { keywords: ["heal"], answer: [txt("HEAL-ANSWER")] },
      { keywords: ["health"], answer: [txt("HEALTH-ANSWER")] },
    ],
    labels: [],
  };
}

describe("Conversation — matching fiel de keywords (stristr, #50)", () => {
  function ask(input: string): string {
    const convo = new Conversation(syntheticNpc(), CTX);
    convo.start();
    return lines(convo.input(input));
  }

  it("keyword exacta casa ('job' -> JOB-ANSWER)", () => {
    expect(ask("job")).toContain("JOB-ANSWER");
  });

  it("sin frontera final: 'jobs' casa 'job' (subcadena en idx 0)", () => {
    expect(ask("jobs")).toContain("JOB-ANSWER");
  });

  it("case-insensitive: 'JOB' y 'JoB' casan 'job'", () => {
    expect(ask("JOB")).toContain("JOB-ANSWER");
    expect(ask("JoB")).toContain("JOB-ANSWER");
  });

  it("frontera de palabra: 'my job' casa (keyword tras espacio) — startsWith NO", () => {
    expect(ask("my job")).toContain("JOB-ANSWER");
  });

  it("SIN match a mitad de palabra: 'myjob' NO casa 'job' -> fallback", () => {
    const out = ask("myjob");
    expect(out).not.toContain("JOB-ANSWER");
    expect(out).toContain('"I cannot help thee with that.');
  });

  it("keyword en 2ª palabra de una frase: 'i need a job' casa 'job'", () => {
    expect(ask("i need a job")).toContain("JOB-ANSWER");
  });

  it("gana la primera de la tabla: 'health' casa 'heal' (insertada antes)", () => {
    // "heal" es subcadena de "health" en idx 0 y precede a "health" en la tabla.
    expect(ask("health")).toContain("HEAL-ANSWER");
    expect(ask("health")).not.toContain("HEALTH-ANSWER");
  });

  it("keyword más larga que el input no casa ('he' no dispara 'heal')", () => {
    // "heal"/"health" > "he"; ninguna keyword casa -> fallback.
    expect(ask("he")).toContain('"I cannot help thee with that.');
  });
});

describe("Conversation — Goeth (towne.json, mago que habla al revés)", () => {
  it("input('drow') produce la respuesta invertida característica", () => {
    const convo = new Conversation(findNpc("towne", "Goeth"), CTX);
    convo.start();
    const out = convo.input("drow");
    // Respuesta real: "Ah, sey, coming kcab to me it is." ("...coming back to me...")
    expect(lines(out)).toContain("coming kcab to me it is");
    // El answer termina en <Label:0> -> el NPC hace una pregunta ("Drow which, that was?").
    expect(lines(out)).toContain("Drow which, that was?");
    expect(hasPrompt(out, true)).toBe(true);
  });
});

/**
 * D6 — la APERTURA HABLADA (TALK.OVL 0x113a-0x117a). El binario reparte en TRES ramas y
 * cada una emite una SECCIÓN distinta del .TLK:
 *   0x113e call 0xd7a (bit npcMet) / 0x1143 `jne 0x1166`
 *     · bit PUESTO   → 0x1166 `call 0x4da` + `push 2`  = sección 2 (greeting)
 *     · bit LIMPIO   → 0x1145 srand(reloj DOS) + 0x1153 rand(0,1) / 0x1158 `je 0x117d`
 *          r==0 → NADA hablado (ret directo)
 *          r!=0 → 0x115a DS 0x94ce `"I am called ` + `push 0` = sección 0 (name)
 * El port emitía SIEMPRE la sección 2. Las TRES ramas están en el testigo del espejo
 * (conteo sobre routes-ad, 186 aperturas con "You see": 63 con «I am called», 51 MUDAS
 * — descripción y directo a "Your interest?" — y 72 con otro hablado), y CINCO
 * descripciones de NPC aparecen en las DOS ramas de desconocido (p.ej. «a grave old
 * wizard» las dos dentro de ad06) ⇒ es una moneda POR CONVERSACIÓN, no un rasgo del NPC.
 */
describe("D6 — apertura hablada gateada por npcMet + moneda (TALK 0x113a-0x1179)", () => {
  it("DESCONOCIDO + r=1: `\"I am called <nombre>` (sección 0), NO el saludo", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), {
      avatarName: "Avatar",
      npcKnowsAvatar: false,
      selfIntroRoll: () => 1,
    });
    const out = lines(convo.start());
    expect(out).toContain("I am called");
    expect(out).toContain("Thrud");
  });

  it("★ DESCONOCIDO + r=0: descripción y NADA hablado (0x1158 `je 0x117d`)", () => {
    // Toshi, NO Thrud: la sección 2 de Thrud está VACÍA, así que con él «no sale el
    // saludo» es cierto también SIN el fix — control degenerado que se ve verde por el
    // motivo equivocado. La de Toshi es 'Hail friend!' y sin ops, así que este caso
    // sólo puede pasar si la rama r=0 existe de verdad.
    const npc = findNpc("keep", "Toshi");
    const convo = new Conversation(npc, {
      avatarName: "Avatar",
      npcKnowsAvatar: false,
      selfIntroRoll: () => 0,
    });
    const out = convo.start();
    const txt = lines(out);
    expect(txt).toContain("You see"); // la descripción SÍ sale (0x111c, fuera del gate)
    expect(txt).not.toContain("I am called");
    expect(txt).not.toContain('"'); // ni una comilla: no hay tramo hablado
    expect(hasPrompt(out, false)).toBe(true); // directo a "Your interest?"
  });

  it("CONOCIDO: sección 2 (greeting) y la moneda NI SE CONSULTA (0x1143 `jne` no llega al call)", () => {
    // CONTROL POR CONDICIÓN SEPARADA: la guarda es compuesta (bit npcMet × moneda) y
    // esta rama aísla que con el bit puesto el `rand` no se ejecuta — por eso el roll
    // lanza si alguien lo llama.
    let tiradas = 0;
    // Zachariah (towne) tiene sección 2 NO vacía — Thrud la tiene vacía, y con él la
    // rama "conocido" sería indistinguible de la muda (control degenerado).
    const convo = new Conversation(findNpc("towne", "Zachariah"), {
      avatarName: "Avatar",
      npcKnowsAvatar: true,
      selfIntroRoll: () => {
        tiradas++;
        return 0;
      },
    });
    const txt = lines(convo.start());
    expect(tiradas).toBe(0);
    expect(txt).not.toContain("I am called");
    expect(txt).toContain("Welcome"); // el saludo de la sección 2, emitido
  });

  it("sin `selfIntroRoll` (arneses puros) el desconocido se presenta: rama r=1, determinista", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), {
      avatarName: "Avatar",
      npcKnowsAvatar: false,
    });
    expect(lines(convo.start())).toContain("I am called");
  });
});

describe("Conversation — Treanna (castle.json, AskName)", () => {
  // ★ REBASELINADO por D6 (TALK 0x113a-0x117a): con el NPC DESCONOCIDO la apertura ya
  // no es el saludo (sección 2) sino `"I am called ` + la SECCIÓN 0. La sección 0 de
  // Treanna no es un nombre pelado: trae `IfElseKnowsName` + `AskName` (12 de los 135
  // scripts tienen ops ahí), así que el AskName cae EN LA APERTURA, no en input('name').
  // No es una conjetura: el testigo del espejo lo tiene literal —
  // routes-ad/ad06: «Talk-West You see a young girl. ` "I am called Treanna" "What is thy».
  it("apertura con NPC desconocido: dice su nombre y PREGUNTA ya en start() (ad06)", () => {
    const treanna = findNpc("castle", "Treanna");
    const convo = new Conversation(treanna, CTX);
    const o0 = convo.start();
    expect(lines(o0)).toContain("I am called");
    expect(lines(o0)).toContain("Treanna");
    expect(hasPrompt(o0, true)).toBe(true); // AskName ya suspendido en la apertura
    expect(convo.metAvatar).toBe(false);

    // Respondemos con el nombre del Avatar -> reconocimiento.
    const o2 = convo.input("Avatar");
    expect(lines(o2)).toContain("A pleasure!");
    expect(convo.metAvatar).toBe(true);
  });

  it("nombre incorrecto -> 'If you say so...' y metAvatar sigue false", () => {
    const convo = new Conversation(findNpc("castle", "Treanna"), CTX);
    convo.start(); // el AskName de la sección 0 ya dejó la pregunta armada
    const out = convo.input("Nystul");
    expect(lines(out)).toContain("If you say so...");
    expect(convo.metAvatar).toBe(false);
  });

  // ── El comparador de AskName, CALCADO de TALK.OVL:0x0e78 ────────────────────
  // Tres cosas que se suman, y el clon sólo hacía una (igualdad exacta contra el
  // Avatar) — las tres iban en la dirección de RECHAZAR lo que el original acepta.
  // 🔴 MUTANTES, cada uno con el aserto que mata:
  //   · volver a igualdad exacta            → muere «MARI» y muere «SOY MARIAH»
  //   · comparar el nombre entero (sin 4)   → muere «MARI»
  //   · mirar sólo al Avatar                → mueren los tres de compañero
  //   · quitar la frontera de palabra       → muere el control negativo «ARIAH»
  const CTX_PARTY = { ...CTX, partyNames: ["Avatar", "Mariah", "Iolo"] };

  it("★ 4 caracteres: 'MARI' basta (repne movsw cx=2 + terminador en la 5ª posición)", () => {
    const convo = new Conversation(findNpc("castle", "Treanna"), CTX_PARTY);
    convo.start();
    expect(lines(convo.input("MARI"))).toContain("A pleasure!");
    expect(convo.metAvatar).toBe(true);
  });

  it("★ TODO el grupo, no sólo el Avatar: el nombre de un compañero vale", () => {
    const convo = new Conversation(findNpc("castle", "Treanna"), CTX_PARTY);
    convo.start();
    expect(lines(convo.input("Mariah"))).toContain("A pleasure!");
  });

  it("★ SUBCADENA con frontera: 'SOY MARIAH' casa (tras espacio)", () => {
    const convo = new Conversation(findNpc("castle", "Treanna"), CTX_PARTY);
    convo.start();
    expect(lines(convo.input("SOY MARIAH"))).toContain("A pleasure!");
  });

  it("★ CONTROL NEGATIVO: sin frontera de palabra NO casa ('ARIAH' contiene 'ARIA')", () => {
    // Si el fix hubiera quitado el gate del carácter anterior (0x0ef7), esto casaría
    // por subcadena y el aserto de arriba no probaría nada sobre la frontera.
    const convo = new Conversation(findNpc("castle", "Treanna"), CTX_PARTY);
    convo.start();
    const out = convo.input("xMARIAH");
    expect(lines(out)).toContain("If you say so...");
    expect(convo.metAvatar).toBe(false);
  });

  it("★ CONTROL NEGATIVO: tres caracteres NO bastan ('MAR' es más corto que la aguja)", () => {
    // La aguja es el nombre truncado a 4 ("Mari"); "MAR" no la contiene.
    const convo = new Conversation(findNpc("castle", "Treanna"), CTX_PARTY);
    convo.start();
    expect(lines(convo.input("MAR"))).toContain("If you say so...");
  });

  it("si el NPC ya conoce al Avatar (ctx.npcKnowsAvatar), 'name' no vuelve a preguntar", () => {
    const convo = new Conversation(findNpc("castle", "Treanna"), { avatarName: "Avatar", npcKnowsAvatar: true });
    convo.start();
    const out = convo.input("name");
    // AskName no dispara: no hay prompt de pregunta tras dar el nombre.
    expect(hasPrompt(out, true)).toBe(false);
  });
});

describe("Conversation — tabla especial DS 0x4aa8: palabrotas + THANK (str-talk-profanity)", () => {
  const RESP = '"With language like that, how did you become an Avatar?"';

  it("palabrota → respuesta enlatada 0x93d0 con cierre de comilla; la conversación sigue", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    const out = convo.input("fuck");
    expect(lines(out)).toContain(RESP); // apertura en el literal + cierre del intérprete (0x4da)
    expect(convo.ended).toBe(false); // 0xb0f re-pregunta "Your interest?"
    expect(hasPrompt(out, false)).toBe(true);
    // Y sigue respondiendo con normalidad después.
    expect(lines(convo.input("job"))).toContain("An infamous mercenary!");
  });

  it("casa por frontera de palabra en cualquier posición (gate 0x0b5b-0x0b64), case-insensitive", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    expect(lines(convo.input("oh Bullshit"))).toContain(RESP); // tras espacio
    expect(lines(convo.input("MOTHERFUCKER"))).toContain(RESP); // índice 33, el ÚLTIMO probado
  });

  // ── docs/bugs-del-original.md §2.7 ────────────────────────────────────────
  // La tabla DS 0x4aa8 tiene 35 entradas y la 34 es `ELECTRONIC ARTS`, pero sus
  // DOS únicos consumidores (TALK 0x0b43 y 0x0cb4) llevan el mismo tope
  // `cmp byte ptr [bp-2],0x22` (=34) COMPARADO TRAS INCREMENTAR (0x0bab, 0x0d15):
  // recorren 0..33 y la 34 NO SE PRUEBA NUNCA. La cadena DS 0x9318 no tiene otra
  // referencia en los 28 .asm. Responderla es AÑADIR contenido que EA nunca
  // publicó — la trampa inversa: un clon fiel no puede añadir.
  //
  // ★ ESTE ASERTO ESTABA AL REVÉS y fijaba el defecto: decía
  //   `expect(lines(convo.input("electronic arts"))).toContain(RESP)`
  // con el comentario «índice 33 (EA)», que es la MISMA cuenta desplazada que
  // metió la entrada en el port. Era el cuarto sitio que la repetía.
  //
  // 🔴 MUTANTE: reponer "ELECTRONIC ARTS" en PROFANITY_KEYWORDS pone este test
  // ROJO. Comprobado invirtiendo el fix (2026-08-06).
  it("★ EA §2.7: 'electronic arts' NO es palabrota — el binario nunca prueba esa entrada", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    const out = convo.input("electronic arts");
    expect(lines(out)).not.toContain(RESP);
    // Cae en el no-match normal (TALK 0x0b83, DS 0x9420), como cualquier palabra
    // que el guion del NPC no conozca.
    expect(lines(out)).toContain("I cannot help thee with that.");
    expect(convo.ended).toBe(false);
  });

  it("sin frontera de palabra NO casa (p.ej. 'class' contiene 'ass' pero no anclada)", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    const out = convo.input("class");
    expect(lines(out)).not.toContain(RESP);
    expect(lines(out)).toContain("I cannot help thee with that."); // no-match normal
  });

  it("las 4 estándar ganan por índice menor: 'bye fuck' despacha BYE (índice 3 < 5)", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    const out = convo.input("bye fuck");
    expect(lines(out)).not.toContain(RESP);
    expect(convo.ended).toBe(true); // handler BYE
  });

  it("THANK (índice 4) despacha al handler de BYE (0xae0): despedida + fin", () => {
    const convo = new Conversation(findNpc("keep", "Thrud"), CTX);
    convo.start();
    const out = convo.input("thank");
    expect(convo.ended).toBe(true);
    expect(lines(out).length).toBeGreaterThan(0); // la despedida del .TLK
  });
});

describe("#142 — PHRASES: puntuación VERBATIM de DATA.OVL (género comilla literal)", () => {
  // Los cinco de la familia van con la comilla de APERTURA dentro del literal y SIN
  // cierre: en este flujo el cierre lo pone el intérprete (TALK 0x4da), no la cadena.
  // Todas leídas de los bytes de original/u5/ultima5/DATA.OVL, no del corpus extraído.
  it("WHAT_YOU_SAY lleva el `\\n\\n\"` de DS 0x9450, como sus hermanas", () => {
    // DS 0x9450 = fileoff 0x9460 = b'\n\n"What didst thou say?'. Emisor TALK.OVL
    // 0x0c99 `mov ax,0x9450` / `call 0x58d0` (print_string LLANO, sin expansor),
    // dentro del bucle de re-pregunta 0x0c7d-0x0ca5: se imprime SÓLO cuando la
    // respuesta viene vacía (`cmp byte [0xbcf8],0` en 0x0c92 y 0x0ca0).
    expect(PHRASES.WHAT_YOU_SAY).toBe('\n\n"What didst thou say?');
  });

  it("★ CONTROL POSITIVO: las hermanas del mismo objeto YA estaban verbatim", () => {
    // Si estas tres se rompieran, el aserto de arriba no probaría nada sobre la
    // convención — probaría que yo la inventé. Están en main desde antes de #142.
    expect(PHRASES.IF_SAY_SO).toBe('\n\n"If you say so...');
    expect(PHRASES.PLEASURE).toBe('\n\n"A pleasure!');
    expect(PHRASES.PROFANITY).toBe(
      '"With language like that, how did you become an Avatar?',
    );
  });
});
