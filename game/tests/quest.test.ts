/**
 * Tests del core de trama/endgame (Fase 7): Words of Power, Shadowlords,
 * subida de nivel con Lord British y rescate final. Se apoya en los datos
 * REALES: wordsOfPower de data.json y el estado inicial de initial-state.json.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  wordForDungeon,
  wordSpokenFlag,
  yellWordOfPower,
  WORD_UTTERED,
  YELL_NO_EFFECT,
} from "../src/core/quest/words.js";
import {
  shadowlordsAlive,
  destroyShadowlord,
  canReachDoom,
  shadowlordDeadFlag,
} from "../src/core/quest/shadowlords.js";
import {
  levelForExp,
  campApparition,
  endgameReady,
  rescueLordBritish,
} from "../src/core/quest/lordbritish.js";

function loadWordsOfPower(): string[] {
  const path = fileURLToPath(new URL("../assets/data.json", import.meta.url));
  const data = JSON.parse(readFileSync(path, "utf8")) as { wordsOfPower: string[] };
  return data.wordsOfPower;
}

function freshState(): GameState {
  const path = fileURLToPath(new URL("../assets/initial-state.json", import.meta.url));
  const init = JSON.parse(readFileSync(path, "utf8")) as ExtractedInitialState;
  return createNewGame(init);
}

const WORDS = loadWordsOfPower();

describe("wordForDungeon", () => {
  it("mapea Deceit (33) → FALLAX y Doom (40) → VERAMOCOR", () => {
    expect(wordForDungeon(33, WORDS)).toBe("FALLAX");
    expect(wordForDungeon(40, WORDS)).toBe("VERAMOCOR");
  });

  it("mapea toda la secuencia de mazmorras 33..40 en orden", () => {
    expect([33, 34, 35, 36, 37, 38, 39, 40].map((l) => wordForDungeon(l, WORDS))).toEqual([
      "FALLAX",
      "VILIS",
      "INOPIA",
      "MALUM",
      "AVIDUS",
      "INFAMA",
      "IGNAVUS",
      "VERAMOCOR",
    ]);
  });

  it("devuelve null fuera del rango de mazmorras", () => {
    expect(wordForDungeon(32, WORDS)).toBeNull();
    expect(wordForDungeon(41, WORDS)).toBeNull();
    expect(wordForDungeon(0, WORDS)).toBeNull();
  });
});

describe("yellWordOfPower — yell direccional del overworld (CMDS 0x12c8)", () => {
  it("palabra correcta + mazmorra adyacente → abre el sello + 'A word of power is uttered'", () => {
    const res = yellWordOfPower(WORDS, "FALLAX", [33]); // Deceit adyacente
    expect(res.opened).toBe(true);
    expect(res.openedLocation).toBe(33);
    expect(res.messages).toEqual([WORD_UTTERED]);
  });

  it("palabra válida pero SIN entrada adyacente → 'uttered' + 'No effect!' (no abre)", () => {
    const res = yellWordOfPower(WORDS, "FALLAX", []); // ninguna entrada adyacente
    expect(res.opened).toBe(false);
    expect(res.openedLocation).toBeNull();
    expect(res.messages).toEqual([WORD_UTTERED, YELL_NO_EFFECT]);
  });

  it("palabra válida pero adyacente a OTRA mazmorra → 'uttered' + 'No effect!'", () => {
    const res = yellWordOfPower(WORDS, "FALLAX", [34]); // Despise adyacente, no Deceit
    expect(res.opened).toBe(false);
    expect(res.messages).toEqual([WORD_UTTERED, YELL_NO_EFFECT]);
  });

  it("palabra inválida → sólo 'No effect!'", () => {
    const res = yellWordOfPower(WORDS, "BANANA", [33]);
    expect(res.opened).toBe(false);
    expect(res.messages).toEqual([YELL_NO_EFFECT]);
  });

  it("palabra vacía → sólo 'No effect!'", () => {
    expect(yellWordOfPower(WORDS, "", [33]).messages).toEqual([YELL_NO_EFFECT]);
    expect(yellWordOfPower(WORDS, "   ", [33]).messages).toEqual([YELL_NO_EFFECT]);
  });

  it("substring-toupper: 'the veramocor' abre Doom (40) si adyacente", () => {
    const res = yellWordOfPower(WORDS, "the veramocor", [40]);
    expect(res.opened).toBe(true);
    expect(res.openedLocation).toBe(40);
  });
});

describe("Shadowlords", () => {
  it("arrancan los tres vivos", () => {
    const state = freshState();
    expect(shadowlordsAlive(state).sort()).toEqual(["cowardice", "falsehood", "hatred"]);
    expect(canReachDoom(state)).toBe(false);
  });

  it("destroy sin el Shard falla y no marca el flag", () => {
    const state = freshState();
    state.shards.falsehood = false;
    const res = destroyShadowlord(state, "falsehood");
    expect(res.ok).toBe(false);
    expect(state.questFlags[shadowlordDeadFlag("falsehood")]).toBeUndefined();
    expect(shadowlordsAlive(state)).toContain("falsehood");
  });

  it("destroy con el Shard marca al Shadowlord como destruido", () => {
    const state = freshState();
    state.shards.hatred = true;
    const res = destroyShadowlord(state, "hatred");
    expect(res.ok).toBe(true);
    expect(state.questFlags[shadowlordDeadFlag("hatred")]).toBe(true);
    expect(shadowlordsAlive(state)).not.toContain("hatred");
  });

  it("canReachDoom sólo con los tres destruidos", () => {
    const state = freshState();
    state.shards.falsehood = true;
    state.shards.hatred = true;
    state.shards.cowardice = true;
    expect(destroyShadowlord(state, "falsehood").ok).toBe(true);
    expect(canReachDoom(state)).toBe(false);
    expect(destroyShadowlord(state, "hatred").ok).toBe(true);
    expect(canReachDoom(state)).toBe(false);
    expect(destroyShadowlord(state, "cowardice").ok).toBe(true);
    expect(canReachDoom(state)).toBe(true);
  });
});

describe("levelForExp / campApparition (OUTSUBS 0x0658)", () => {
  /** rand espía con valor fijo para el `rand(1,3)` del boost de atributo. */
  function fixedRand(value: number): { fn: (lo: number, hi: number) => number; calls: number } {
    const spy = { fn: (_lo: number, _hi: number) => value, calls: 0 };
    const orig = spy.fn;
    spy.fn = (lo, hi) => {
      spy.calls++;
      return orig(lo, hi);
    };
    return spy;
  }

  it("levelForExp = bit_length(floor(exp/100))+1 — umbrales potencias de 2", () => {
    // L2≥100 · L3≥200 · L4≥400 · L5≥800 · L6≥1600 · L7≥3200 · L8≥6400 (no 100·nivel).
    expect(levelForExp(0)).toBe(1);
    expect(levelForExp(99)).toBe(1);
    expect(levelForExp(100)).toBe(2);
    expect(levelForExp(199)).toBe(2);
    expect(levelForExp(200)).toBe(3);
    expect(levelForExp(399)).toBe(3);
    expect(levelForExp(400)).toBe(4);
    expect(levelForExp(800)).toBe(5);
    expect(levelForExp(1600)).toBe(6);
    expect(levelForExp(3200)).toBe(7);
    expect(levelForExp(6400)).toBe(8);
    expect(levelForExp(9999)).toBe(8);
  });

  it("sube al acampar de nivel 2 (250 exp) a 3, FIJA maxHP=30·nivel y cura a tope", () => {
    const state = freshState();
    const c = state.characters[0]!;
    state.partySize = 1;
    c.partyStatus = 0;
    c.status = "G";
    c.level = 2;
    c.exp = 250; // floor(250/100)=2 → bit_length 2 → nivel 3
    c.maxHp = 100;
    c.currentHp = 40;
    const rand = fixedRand(1); // STR
    const res = campApparition(state, rand.fn);
    expect(c.level).toBe(3);
    expect(c.maxHp).toBe(90); // 30·3 SET (no 100+30)
    expect(c.currentHp).toBe(90); // 0x071b cura a tope
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0]).toBe(
      `\n"Hail, ${c.name}!\nFor thy valiant deeds, I shall reward thee!\n` +
        `Thou art now level 3, and\nstronger!" \n`,
    );
  });

  it("boost de atributo por rand(1,3): 1→STR, 2→DEX, 3→INT (+1, tope 30)", () => {
    for (const [roll, field, word] of [
      [1, "strength", "stronger!"],
      [2, "dexterity", "quicker!"],
      [3, "intelligence", "wiser!"],
    ] as const) {
      const state = freshState();
      const c = state.characters[0]!;
      state.partySize = 1;
      c.partyStatus = 0;
      c.status = "G";
      c.level = 1;
      c.exp = 100; // → nivel 2
      c.strength = 10;
      c.dexterity = 10;
      c.intelligence = 10;
      const rand = fixedRand(roll);
      const res = campApparition(state, rand.fn);
      expect(rand.calls).toBe(1); // 1 rand por miembro que sube
      expect(c[field]).toBe(11); // +1
      expect(res.messages[0]).toContain(`${word}" \n`);
    }
  });

  it("el boost de atributo topa en 30 (add_capped 0x0784)", () => {
    const state = freshState();
    const c = state.characters[0]!;
    state.partySize = 1;
    c.partyStatus = 0;
    c.status = "G";
    c.level = 1;
    c.exp = 100;
    c.strength = 30;
    campApparition(state, fixedRand(1).fn); // roll=1 → STR
    expect(c.strength).toBe(30); // ya en 30, no sube
  });

  it("no pasa del nivel 8 aunque sobre experiencia", () => {
    const state = freshState();
    const c = state.characters[0]!;
    state.partySize = 1;
    c.partyStatus = 0;
    c.status = "G";
    c.level = 7;
    c.exp = 99999;
    campApparition(state, fixedRand(2).fn);
    expect(c.level).toBe(8);
  });

  it("sin level-up: cura a tope + status='G' PERO sin mensaje ni rand (nivel 2, exp 150)", () => {
    const state = freshState();
    const c = state.characters[0]!;
    state.partySize = 1;
    c.partyStatus = 0;
    c.status = "P"; // envenenado → la aparición lo cura a 'G'
    c.level = 2;
    c.exp = 150; // floor(150/100)=1 → nivel 2 (sin cambio)
    c.maxHp = 60;
    c.currentHp = 25;
    const rand = fixedRand(1);
    const res = campApparition(state, rand.fn);
    expect(c.level).toBe(2);
    expect(c.currentHp).toBe(60); // 0x0820: cura total aunque no suba
    expect(c.status).toBe("G"); // 0x0828: cura veneno/dormido
    expect(res.messages).toHaveLength(0);
    expect(rand.calls).toBe(0); // sin level-up → sin rand
  });

  it("SALTA a los muertos (status 'D', 0x080f): ni cura ni suben aunque tengan exp", () => {
    const state = freshState();
    const c = state.characters[0]!;
    state.partySize = 1;
    c.partyStatus = 0;
    c.status = "D";
    c.level = 1;
    c.exp = 6400; // sobra para nivel 8
    c.maxHp = 60;
    c.currentHp = 0;
    const rand = fixedRand(1);
    const res = campApparition(state, rand.fn);
    expect(c.level).toBe(1); // muerto → sin cambio
    expect(c.status).toBe("D"); // sigue muerto (no se cura a 'G')
    expect(c.currentHp).toBe(0); // muerto → no revive
    expect(res.messages).toHaveLength(0);
    expect(rand.calls).toBe(0);
  });

  it("steps: un paso por miembro VIVO en orden de roster, muertos fuera (bucle 0x07fb)", () => {
    const state = freshState();
    state.partySize = 3;
    for (const [i, st] of (["G", "D", "P"] as const).entries()) {
      const c = state.characters[i]!;
      c.partyStatus = 0;
      c.status = st;
      c.level = levelForExp(c.exp); // sin level-up → sin mensaje
    }
    const res = campApparition(state, fixedRand(1).fn);
    expect(res.steps.map((s) => s.charIdx)).toEqual([0, 2]); // el muerto (idx 1) sin paso
    expect(res.steps.every((s) => s.message === undefined)).toBe(true);
  });

  it("recalcula MP por clase en el epílogo por-miembro (0x079c): A/M→INT, B→INT>>1, resto intacto, muertos incluidos", () => {
    const state = freshState();
    state.partySize = 4;
    const setups = [
      { cls: "A", status: "G", int: 21 }, // 0x07e6: MP := INT
      { cls: "B", status: "G", int: 21 }, // 0x08fc: MP := INT>>1
      { cls: "F", status: "G", int: 21 }, // 0x07bb: intacto
      { cls: "M", status: "D", int: 17 }, // muerto: 0x0814 je 0x79c → TAMBIÉN recalcula
    ] as const;
    for (const [i, s] of setups.entries()) {
      const c = state.characters[i]!;
      c.partyStatus = 0;
      c.class = s.cls;
      c.status = s.status;
      c.intelligence = s.int;
      c.currentMp = 3;
      c.level = levelForExp(c.exp); // sin level-up (aísla el MP)
    }
    campApparition(state, fixedRand(1).fn);
    expect(state.characters[0]!.currentMp).toBe(21); // A → INT
    expect(state.characters[1]!.currentMp).toBe(10); // B → INT>>1
    expect(state.characters[2]!.currentMp).toBe(3); // F → intacto
    expect(state.characters[3]!.currentMp).toBe(17); // M muerto → INT igualmente
  });
});

describe("endgame / rescueLordBritish", () => {
  function primed(): GameState {
    const state = freshState();
    // Shards + destrucción de los tres Shadowlords.
    state.shards.falsehood = true;
    state.shards.hatred = true;
    state.shards.cowardice = true;
    destroyShadowlord(state, "falsehood");
    destroyShadowlord(state, "hatred");
    destroyShadowlord(state, "cowardice");
    // Las tres regalías de Lord British.
    state.lbArtifacts.amulet = true;
    state.lbArtifacts.crown = true;
    state.lbArtifacts.sceptre = true;
    return state;
  }

  it("endgameReady exige Shadowlords muertos Y las tres regalías", () => {
    const state = primed();
    expect(endgameReady(state)).toBe(true);
    state.lbArtifacts.crown = false;
    expect(endgameReady(state)).toBe(false);
  });

  it("no rescata si no se está dentro de Doom", () => {
    const state = primed();
    const res = rescueLordBritish(state);
    expect(res.ok).toBe(false);
    expect(state.questFlags["game-won"]).toBeUndefined();
  });

  it("no rescata si el endgame no está listo aunque se esté en Doom", () => {
    const state = freshState();
    state.questFlags["in-doom"] = true;
    const res = rescueLordBritish(state);
    expect(res.ok).toBe(false);
    expect(state.questFlags["game-won"]).toBeUndefined();
  });

  it("flujo completo: preparado + dentro de Doom + caja → victoria con pergamino", () => {
    const state = primed();
    state.questFlags["in-doom"] = true;
    state.specialItems.woodenBox = true; // la victoria (pergamino) EXIGE la Sandalwood Box
    const res = rescueLordBritish(state);
    expect(res.ok).toBe(true);
    expect(res.ending).toBe("victory");
    expect(state.questFlags["game-won"]).toBe(true);
    expect(res.messages.length).toBeGreaterThanOrEqual(3);
    expect(res.messages.join(" ")).toContain("Lord British");
    // El final EXACTO de ENDGAME emite el pergamino con el informe de playtime.
    expect(res.messages.join(" ")).toContain("thy Quest compleat in");
  });
});
