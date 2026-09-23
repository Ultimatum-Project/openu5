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
