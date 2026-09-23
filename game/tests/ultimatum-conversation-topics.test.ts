/**
 * Temas descubiertos de conversación (contrato v5, aditivo).
 *
 * La ayuda de temas de la plataforma NUNCA enumera el .TLK: sólo consume las
 * keywords que el jugador YA ha probado. Este test asienta ese límite con un
 * guion SINTÉTICO (sin assets del juego) para que corra en la suite pura.
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
    { keywords: ["item"], answer: [[{ kind: "text", text: "Seek the dawn." }]] },
  ],
  labels: [],
};

const CTX = { avatarName: "Avatar", npcKnowsAvatar: false };

describe("Conversation asked topics", () => {
  it("records only keywords the player actually asked, in first-ask order", () => {
    const convo = new Conversation(SCRIPT, CTX);
    convo.start();
    convo.input("job");
    convo.input("dawn");
    convo.input("dawn"); // repeated: not recorded twice
    convo.input("xyzzy"); // unknown: never recorded
    expect(convo.askedKeywords).toEqual(["job", "dawn"]);
  });

  it("excludes bye and never reveals unasked script keywords", () => {
    const convo = new Conversation(SCRIPT, CTX);
    convo.start();
    convo.input("bye");
    expect(convo.askedKeywords).toEqual([]);
    expect(convo.askedKeywords).not.toContain("item");
  });

  it("offers implicit topics and only keywords the NPC has actually uttered", () => {
    const convo = new Conversation(SCRIPT, CTX);
    convo.start();
    // Implicit topics plus Goodbye are always offered; scripted keywords are not
    // heard yet, so they stay hidden (U4 TopicJournal behaviour).
    expect(convo.discoveredTopics).toEqual(["name", "job", "work", "bye"]);
    expect(convo.discoveredTopics).not.toContain("dawn");
    // The "item" answer says "Seek the dawn." -> dawn is now discovered.
    convo.input("item");
    expect(convo.discoveredTopics).toContain("dawn");
  });
});

// U4's `TopicJournal::matches`: a four-letter .TLK abbreviation (ABBE) is
// revealed by the full word the NPC says (ABBEY); longer keywords need the
// whole word (HUMILITY is not revealed by HUMID).
const ABBEY_SCRIPT: TalkScript = {
  npcIndex: 0,
  name: [{ kind: "text", text: "Tester" }],
  description: [{ kind: "text", text: "a synthetic subject" }],
  greeting: [{ kind: "text", text: "Welcome to Empath Abbey." }],
  job: [{ kind: "text", text: "I keep the abbey." }],
  bye: [{ kind: "text", text: "Farewell." }],
  qa: [
    { keywords: ["abbe"], answer: [[{ kind: "text", text: "Empath Abbey!" }]] },
    { keywords: ["humility"], answer: [[{ kind: "text", text: "The shrine of Humility." }]] },
  ],
  labels: [],
};

// A known NPC emits its greeting; an unknown one emits the self-introduction.
const KNOWN_CTX = { avatarName: "Avatar", npcKnowsAvatar: true };

describe("Conversation topic discovery and labels", () => {
  it("reveals a four-letter keyword from the full word the NPC said", () => {
    const convo = new Conversation(ABBEY_SCRIPT, KNOWN_CTX);
    convo.start();
    // The greeting says "Abbey" -> the ABBE keyword is now offered, labelled
    // with the whole word the NPC used.
    expect(convo.discoveredTopics).toContain("abbe");
    expect(convo.labelFor("abbe")).toBe("abbey");
    expect(convo.topicLabels).toEqual({ abbe: "abbey" });
  });

  it("requires the whole word for keywords that are not four letters", () => {
    const convo = new Conversation(ABBEY_SCRIPT, KNOWN_CTX);
    convo.start();
    // "Humility" was never said (only the greeting's "Abbey" was), so the
    // longer keyword stays hidden even though it appears in the script.
    expect(convo.discoveredTopics).not.toContain("humility");
    expect(convo.labelFor("humility")).toBe("");
  });

  it("labels the abbreviation with the heard word even after asking", () => {
    const convo = new Conversation(ABBEY_SCRIPT, KNOWN_CTX);
    convo.start();
    convo.input("abbe");
    expect(convo.askedKeywords).toEqual(["abbe"]);
    expect(convo.labelFor("abbe")).toBe("abbey");
  });
});
