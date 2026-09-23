/**
 * Diario de conversación (contrato v5, aditivo).
 *
 * El NPC deja constancia de las líneas que ha pronunciado, en orden y con la
 * keyword que las provocó, para que la plataforma las persista como diario
 * (hablante / lugar / tema). La descripción ("You see …") es narración y queda
 * fuera. Guion SINTÉTICO, sin assets del juego, para la suite pura.
 */
import { describe, expect, it } from "vitest";
import { Conversation, type TalkScript } from "../src/core/dialogue/conversation.js";

const SCRIPT: TalkScript = {
  npcIndex: 0,
  name: [{ kind: "text", text: "Tester" }],
  description: [{ kind: "text", text: "a synthetic subject" }],
  greeting: [{ kind: "text", text: "Hail!" }],
  job: [{ kind: "text", text: "I test the bridge." }],
  bye: [{ kind: "text", text: "Farewell." }],
  qa: [
    { keywords: ["dawn"], answer: [[{ kind: "text", text: "The password." }]] },
    {
      keywords: ["riddle"],
      answer: [
        [{ kind: "text", text: "Here it is:" }, { kind: "op", op: "Label", data: 1 }],
      ],
    },
  ],
  labels: [
    {
      label: 1,
      initialLine: [{ kind: "text", text: "A label intro." }],
      defaultAnswers: [[{ kind: "text", text: "Agree?" }]],
      qa: [{ keywords: ["yes"], answer: [[{ kind: "text", text: "Label answer." }]] }],
    },
  ],
};

// `npcKnowsAvatar: true` -> se emite el saludo (topic null), no la autopresentación.
const CTX = { avatarName: "Avatar", npcKnowsAvatar: true };

describe("Conversation passages", () => {
  it("records the greeting without a topic and leaves the description out", () => {
    const convo = new Conversation(SCRIPT, CTX);
    convo.start();
    expect(convo.passages).toEqual([{ text: "Hail!", topic: null }]);
    expect(convo.passages.some((passage) => passage.text.includes("synthetic subject"))).toBe(false);
  });

  it("tags each answer with the keyword that provoked it", () => {
    const convo = new Conversation(SCRIPT, CTX);
    convo.start();
    convo.input("job");
    convo.input("work"); // mapped to the same job line, but the asked keyword differs
    convo.input("dawn");
    expect(convo.passages).toEqual([
      { text: "Hail!", topic: null },
      { text: "I test the bridge.", topic: "job" },
      { text: "I test the bridge.", topic: "work" },
      { text: "The password.", topic: "dawn" },
    ]);
  });

  it("attributes label follow-ups to the label answer keyword", () => {
    const convo = new Conversation(SCRIPT, CTX);
    convo.start();
    convo.input("riddle");
    convo.input("yes");
    const passages = convo.passages.filter((passage) => passage.topic === "riddle");
    expect(passages.map((passage) => passage.text)).toContain("Here it is:");
    expect(passages.map((passage) => passage.text)).toContain("A label intro.");
    expect(convo.passages).toContainEqual({ text: "Label answer.", topic: "yes" });
  });

  it("records the no-match reply without inventing a topic", () => {
    const convo = new Conversation(SCRIPT, CTX);
    convo.start();
    convo.input("xyzzy");
    const noMatch = convo.passages.at(-1);
    expect(noMatch?.topic).toBeNull();
    expect(noMatch?.text).toContain("I cannot help thee with that.");
  });
});
