/**
 * Tests de las reglas EXACTAS de los comandos sueltos (Task 3.9 —
 * CMDS.OVL + SJOG.OVL). Derivación: re/notes/cmds.md (asm) + escenarios de
 * paridad re/parity/cmds/ (cruce modelo↔clon con el RNG exacto).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CharacterState } from "../src/core/state.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import type { RandFn } from "../src/core/world/survival.js";
import { OriginalRng } from "../src/core/rng-original.js";
import {
  klimbGrapple,
  newOrder,
  isPushableTile,
  pushFillTile,
  jimmyLock,
  chestTrap,
  chestLoot,
  dungeonChestLoot,
  revealSecretDoor,
  campHoleUp,
  applyLootGrant,
  lootItemName,
  TRAP_TYPE_TABLE,
} from "../src/core/world/commands.js";

function freshState(): GameState {
  const path = fileURLToPath(new URL("../assets/initial-state.json", import.meta.url));
  const init = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as ExtractedInitialState;
  return createNewGame(init);
}

function member(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "M",
    gender: 0x0b,
    class: "F",
    status: "G",
    strength: 15,
    dexterity: 15,
    intelligence: 15,
    currentMp: 0,
    currentHp: 30,
    maxHp: 30,
    exp: 0,
    level: 1,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

/** RNG con cola scriptada: cada llamada devuelve el próximo valor programado. */
function scripted(values: number[]): RandFn {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("rand agotado");
    return values[i++]!;
  };
}

describe("Klimb con garfio (CMDS 0x1C20)", () => {
  it("no tira por los muertos y aplica daño a los que fallan", () => {
    const members = [
      member({ name: "A", dexterity: 25, currentHp: 30 }), // DEX 25 >= roll 10 → sube
      member({ name: "Dead", status: "D", currentHp: 0 }), // muerto → NO tira
      member({ name: "C", dexterity: 3, currentHp: 15 }), // DEX 3 < roll 20 → cae
    ];
    // Stream: roll(A)=10 [sube]; roll(C)=20 [falla] → dmg(C)=5.
    const rand = scripted([10, 20, 5]);
    const res = klimbGrapple(members, rand);
    expect(res.falls).toEqual([{ member: 2, damage: 5 }]);
    expect(members[2]!.currentHp).toBe(10);
    expect(members[1]!.currentHp).toBe(0); // el muerto intacto
    expect(res.messages).toContain("Fell!"); // 0x904a: sin nombre
  });

  it("DEX igual al roll escala sin daño (jae)", () => {
    const members = [member({ dexterity: 12 })];
    const res = klimbGrapple(members, scripted([12])); // DEX 12 >= 12 → sube
    expect(res.falls).toEqual([]);
  });
});

describe("New Order (CMDS 0x0DDC)", () => {
  it("intercambia dos miembros no-Avatar", () => {
    const chars = [member({ name: "Avatar" }), member({ name: "B" }), member({ name: "C" })];
    const res = newOrder(chars, 1, 2);
    expect(res.ok).toBe(true);
    expect(chars.map((c) => c.name)).toEqual(["Avatar", "C", "B"]);
  });

  it("el Avatar (idx 0) no se puede mover", () => {
    const chars = [member({ name: "Avatar" }), member({ name: "B" })];
    const res = newOrder(chars, 0, 1);
    expect(res.ok).toBe(false);
    expect(res.message).toContain("must lead!");
    expect(chars.map((c) => c.name)).toEqual(["Avatar", "B"]);
  });
});

describe("Push (CMDS 0x161A)", () => {
  it("reconoce el set de tiles empujables EXACTO del asm 14bd-14fc", () => {
    for (const t of [0x5b, 0x90, 0x91, 0x92, 0x93, 0xa5, 0xa6, 0xa8, 0xa9,
                     0xad, 0xae, 0xaf, 0xb4, 0xb5, 0xb6, 0xb7]) {
      expect(isPushableTile(t)).toBe(true);
    }
    // 0xa7 y 0xac quedan FUERA (huecos del predicado), y 0xb8 pasa de rango.
    for (const t of [0x00, 0x44, 0x0c, 0x94, 0xa7, 0xac, 0xb8]) {
      expect(isPushableTile(t)).toBe(false);
    }
  });

  it("rellena con 0x45 tras cañón, 0x44 en el resto", () => {
    expect(pushFillTile(0xb4)).toBe(0x45);
    expect(pushFillTile(0x5b)).toBe(0x44);
  });
});

describe("Jimmy (SJOG 0x0D4A)", () => {
  it("puerta: DEX > rand(0,29) abre sin gastar llave", () => {
    const res = jimmyLock({ kind: "door", tile: 0xb9, dex: 20 }, scripted([10]));
    expect(res).toMatchObject({ success: true, keyBroke: false, newTile: 0xb8 });
  });

  it("puerta: DEX <= rand rompe la llave", () => {
    const res = jimmyLock({ kind: "door", tile: 0xbb, dex: 5 }, scripted([25]));
    expect(res).toMatchObject({ success: false, keyBroke: true, newTile: 0xbb });
  });

  it("cerradura mágica siempre rompe la llave sin tirar", () => {
    const rand = scripted([]); // no debe consumir rand
    const res = jimmyLock({ kind: "magic", tile: 0x97, dex: 30 }, rand);
    expect(res).toMatchObject({ success: false, keyBroke: true });
  });

  it("cofre-objeto: rand > threshold = éxito, limpia bit 0x80", () => {
    // tile 0x90 (bit 0x80 puesto, valor 0x10), DEX 18 → threshold = (0x10-18+30)>>1 = 14.
    const th = ((0x90 & 0x7f) - 18 + 0x1e) >> 1;
    expect(th).toBe(14);
    const ok = jimmyLock({ kind: "chestObject", tile: 0x90, dex: 18 }, scripted([15]));
    expect(ok).toMatchObject({ success: true, keyBroke: false, newTile: 0x10 });
    const fail = jimmyLock({ kind: "chestObject", tile: 0x90, dex: 18 }, scripted([14]));
    expect(fail).toMatchObject({ success: false, keyBroke: true });
  });

  it("cepo/prisionero en pueblo: DEX > rand(0,29) libera + karma+2", () => {
    const ok = jimmyLock({ kind: "prisoner", tile: 0x84, dex: 20, location: 8 }, scripted([10]));
    expect(ok).toMatchObject({ success: true, keyBroke: false, freed: true, karmaDelta: 2 });
    const fail = jimmyLock({ kind: "prisoner", tile: 0x84, dex: 5, location: 8 }, scripted([25]));
    expect(fail).toMatchObject({ success: false, keyBroke: true });
    expect(fail.freed).toBeUndefined();
  });

  it("cepo en mazmorra: SÍ tira rand(0,29); éxito → tile 0x44 sin karma; fallo rompe llave", () => {
    // La mazmorra también tira (0e54); el split por loc es sólo el efecto del éxito.
    const ok = jimmyLock({ kind: "prisoner", tile: 0x85, dex: 20, location: 0x81 }, scripted([10]));
    expect(ok).toMatchObject({ success: true, keyBroke: false, newTile: 0x44, message: "Unlocked\n" });
    expect(ok.karmaDelta).toBeUndefined();
    const fail = jimmyLock({ kind: "prisoner", tile: 0x85, dex: 5, location: 0x81 }, scripted([25]));
    expect(fail).toMatchObject({ success: false, keyBroke: true });
  });
});

describe("Camp / Hole-up (CMDS 0x0400)", () => {
  it("cura HP (clamp) y restaura MP por clase (Avatar/Mage=INT, Bard=INT/2)", () => {
    const members = [
      member({ class: "A", currentHp: 10, maxHp: 40, intelligence: 30, currentMp: 0 }),
      member({ class: "B", currentHp: 40, maxHp: 40, intelligence: 20, currentMp: 0 }),
      member({ class: "F", currentHp: 5, maxHp: 40, intelligence: 25, currentMp: 0 }),
    ];
    // UNA pasada: heal(A)=20, heal(B)=30→clamp40, heal(F)=15; luego 1 rand del gate.
    campHoleUp(members, scripted([20, 30, 15, 50]));
    expect(members[0]!.currentHp).toBe(30);
    expect(members[0]!.currentMp).toBe(30); // A: MP=INT
    expect(members[1]!.currentHp).toBe(40); // clamp
    expect(members[1]!.currentMp).toBe(10); // B: MP=INT/2
    expect(members[2]!.currentMp).toBe(0); // F: sin MP
  });

  it("el de guardia NO se cura ni recupera MP (0x0461 `si≠[bp+6]`)", () => {
    const members = [
      member({ class: "A", currentHp: 10, maxHp: 40, intelligence: 30, currentMp: 0 }),
      member({ class: "M", currentHp: 10, maxHp: 40, intelligence: 22, currentMp: 0 }),
    ];
    // guardIdx=1: sólo el miembro 0 tira heal (rand=20); el 1 queda intacto (sin
    // tirada). rand(0,99)=50 → sin aparición.
    campHoleUp(members, scripted([20, 50]), 1);
    expect(members[0]!.currentHp).toBe(30);
    expect(members[0]!.currentMp).toBe(30);
    expect(members[1]!.currentHp).toBe(10); // guardia: sin curación
    expect(members[1]!.currentMp).toBe(0); // guardia: sin MP
  });

  it("consume EXACTAMENTE (#elegibles heal + 1 gate) rands — UNA vez por acampada", () => {
    // El helper 0x0400 corre una sola vez (cooldown g_unk_588c bloquea el resto),
    // NO por hora: 2 miembros vivos → 2 heal + 1 gate = 3 rands, sin importar horas.
    const members = [
      member({ class: "F", currentHp: 10, maxHp: 99 }),
      member({ class: "F", currentHp: 10, maxHp: 99 }),
    ];
    let calls = 0;
    const counting = (lo: number, hi: number): number => {
      calls++;
      return lo === 0 && hi === 99 ? 10 : 20; // rand(0,99)=10 (<25 → aparición)
    };
    const res = campHoleUp(members, counting);
    expect(calls).toBe(3); // 2 heal + 1 gate (NO ×horas)
    expect(res.apparition).toBe(true); // 10 < 25 → gate cruza (call 0xbfd6 = aparición)
  });

  it("gate rand(0,99)>=25 → sin aparición (75%)", () => {
    const members = [member({ class: "F", currentHp: 10, maxHp: 99 })];
    // 1 heal + 1 gate; gate=25 → NO cruza (jge 0x505).
    const res = campHoleUp(members, scripted([20, 25]));
    expect(res.apparition).toBe(false); // 25 no es < 25
  });
});

describe("Trampa de cofre (kernel 0x2FD0)", () => {
  it("tabla de tipos pueblo = ACID3/POISON2/BOMB2/GAS1", () => {
    expect([...TRAP_TYPE_TABLE]).toEqual([0, 0, 0, 1, 1, 2, 2, 3]);
  });

  it("ACID: daño rand(0,60)>>1 (mín 1) al que abre", () => {
    const members = [member({ currentHp: 30 }), member({ currentHp: 30 })];
    // pueblo: type-select rand(0,7)=0 → ACID; daño rand(0,60)=40 → 20.
    const res = chestTrap(8, 0, members, scripted([0, 40]), members.length);
    expect(res.type).toBe("ACID");
    expect(members[0]!.currentHp).toBe(10);
    expect(members[1]!.currentHp).toBe(30);
  });

  it("GAS: envenena a toda la party (type idx 7)", () => {
    const members = [member(), member(), member()];
    const res = chestTrap(8, 0, members, scripted([7]), members.length);
    expect(res.type).toBe("GAS");
    expect(members.every((m) => m.status === "P")).toBe(true);
  });

  it("mazmorra: sólo ACID/POISON (rand(0,1))", () => {
    const members = [member()];
    const res = chestTrap(0x81, 0, members, scripted([1]), members.length); // POISON
    expect(res.type).toBe("POISON");
    expect(members[0]!.status).toBe("P");
  });
});

// ── Acotación por g_party_size (ficha #41) ──────────────────────────────────
// El roster son SEIS ranuras de 0x20 bytes en DS:0x55b3 (`add di,0x20` @0x2ad6);
// `members` en el port es el ROSTER, que puede llevar más de los que van EN EL
// GRUPO. El binario acota por g_party_size (DS:0x585b) en los tres efectos que
// barren gente:
//   BOMB 0x2aa8 — bucle si=0..5 (`cmp si,6; jl` @0x2ada) con guarda
//     `mov cl,[g_party_size]; cmp ax,cx; jae 0x2ad6` @0x2ab7-0x2abf ANTES del
//     check 'D' @0x2ac1 ⇒ ni siquiera tira el rand(1,8) para los de fuera.
//   GAS 0x3054 — bucle si=0..5 (`cmp si,6; jl` @0x3062) que llama a 0x2fa6.
//   POISON/GAS 0x2fa6 — `mov al,[g_party_size]; cmp [bp+4],ax; jae 0x2fca`
//     @0x2faa-0x2fb2: el índice fuera del GRUPO sale sin tocar nada.
// ACID (0x302b→0x3abe→0x2a52) NO se acota: golpea a [bp+4] directo.
// Cota efectiva de los barridos = min(g_party_size, 6) — la misma convención que
// loops/hazards.ts (`i < state.partySize && i < 6`).
describe("Trampa de cofre: acotación por g_party_size (0x2ab7 / 0x2faa)", () => {
  // NO se agota: si el port pide de más devuelve el último valor, para que el rojo
  // lo dé el ASERTO sobre el nº de tiradas (la cifra medida) y no una excepción.
  const counting = (values: number[]): { rand: RandFn; calls: () => number } => {
    let i = 0;
    return {
      rand: () => values[Math.min(i++, values.length - 1)]!,
      calls: () => i,
    };
  };
  // Roster de 16 con sólo 3 EN EL GRUPO — el caso medido de la ficha #41.
  const roster16 = (): CharacterState[] =>
    Array.from({ length: 16 }, () => member({ currentHp: 30 }));

  it("BOMB: 4 tiradas (1 tipo + 3 del grupo), no 17 — y 3 blips, no 16", () => {
    const members = roster16();
    // rand(0,7)=5 → TRAP_TYPE_TABLE[5]=2=BOMB; luego un rand(1,8) por miembro
    // VIVO del GRUPO (3), no por miembro del roster (16).
    const c = counting([5, 4, 4, 4]);
    const res = chestTrap(8, 0, members, c.rand, 3);
    expect(res.type).toBe("BOMB");
    expect(c.calls()).toBe(4); // medido con el bug: 17
    expect(res.damageSlots).toEqual([0, 1, 2]); // ★ #328: slots en crudo (con el bug: 16 blips)
    expect(members.slice(0, 3).map((m) => m.currentHp)).toEqual([26, 26, 26]);
    expect(members.slice(3).every((m) => m.currentHp === 30)).toBe(true);
  });

  it("GAS: envenena 3/3 del grupo, no 16/16 del roster", () => {
    const members = roster16();
    const res = chestTrap(8, 0, members, scripted([7]), 3); // idx 7 → GAS
    expect(res.type).toBe("GAS");
    expect(members.filter((m) => m.status === "P").length).toBe(3); // con el bug: 16
    expect(members.slice(3).every((m) => m.status === "G")).toBe(true);
  });

  it("POISON: el que abre FUERA del grupo no se envenena (jae 0x2fca)", () => {
    const members = roster16();
    // rand(0,7)=3 → TRAP_TYPE_TABLE[3]=1=POISON sobre opener=5, con partySize=3.
    const res = chestTrap(8, 5, members, scripted([3]), 3);
    expect(res.type).toBe("POISON");
    expect(members.every((m) => m.status === "G")).toBe(true);
  });

  it("el barrido se corta en 6 aunque partySize sea mayor (cmp si,6 @0x2ada)", () => {
    const members = roster16();
    const c = counting([5, 4, 4, 4, 4, 4, 4]); // 1 tipo + 6 golpes como mucho
    const res = chestTrap(8, 0, members, c.rand, 8);
    expect(c.calls()).toBe(7);
    expect(res.damageSlots).toEqual([0, 1, 2, 3, 4, 5]); // ★ #328: los 6 del corte
    expect(members.slice(6).every((m) => m.currentHp === 30)).toBe(true);
  });

  it("BOMB: los muertos DENTRO del grupo no cuentan (check 'D' @0x2ac1)", () => {
    const members = roster16();
    members[1]!.status = "D";
    const c = counting([5, 4, 4]); // tipo + 2 vivos de los 3 del grupo
    const res = chestTrap(8, 0, members, c.rand, 3);
    expect(c.calls()).toBe(3);
    expect(res.damageSlots).toEqual([0, 2]); // ★ #328: el muerto (slot 1) NO flashea
  });

  it("ACID NO se acota: 0x302b golpea al que abre esté donde esté", () => {
    const members = roster16();
    // rand(0,7)=0 → ACID; rand(0,60)=40 → 20 de daño al opener=5 (fuera del grupo).
    const res = chestTrap(8, 5, members, scripted([0, 40]), 3);
    expect(res.type).toBe("ACID");
    expect(members[5]!.currentHp).toBe(10);
    expect(res.damageSlots).toEqual([5]); // ★ #328: flashea la fila del QUE ABRE (0x302b push [bp+6])
  });
});

describe("Botín de cofre (SJOG 0x1040/0x10B8)", () => {
  const seeded = (seed: number): RandFn => {
    const r = new OriginalRng(seed);
    return (lo, hi) => r.next(lo, hi);
  };

  it("es determinista dado contents + stream (mismo seed → mismo botín)", () => {
    expect(chestLoot(40, seeded(0x1234))).toEqual(chestLoot(40, seeded(0x1234)));
  });

  /**
   * El aserto de este test evalúa DOS plantas a propósito. La guarda de las filas
   * si=5/6 (poción/scroll) es 25 y el roll es `rand(1, floor*4+4)`, así que esas filas
   * son INALCANZABLES mientras floor*4+4 < 25 — o sea hasta la planta 5 incluida — y
   * sólo se abren desde la 6. Medido: 0 pociones y 0 scrolls en 20.000 semillas a
   * floor 5, frente a 2938/2928 a floor 6. La versión anterior tiraba una sola vez a
   * floor 5, es decir exactamente en la planta donde el 0xFF de `DUNGEON_ITEM[5..6]`
   * no puede fugarse: el mutante que hace caer esas dos filas por la rama genérica
   * sobrevivía VERDE. Verificado que este aserto lo mata (rojo a floor 6).
   */
  it("botín de sala de mazmorra escala con la planta (filas poción/scroll cerradas hasta la 5, abiertas desde la 6)", () => {
    const seen: Record<number, Set<string>> = { 5: new Set(), 6: new Set() };

    for (const floor of [5, 6] as const) {
      for (let s = 0; s < 400; s++) {
        for (const g of dungeonChestLoot(floor, seeded(s))) {
          // mata la fuga del 0xFF de DUNGEON_ITEM por la rama genérica
          expect(g.category).not.toBe("unknown");
          seen[floor]!.add(g.category);
          if (g.category === "gold") {
            expect(g.qty).toBeGreaterThanOrEqual(1);
            expect(g.qty).toBeLessThanOrEqual(floor * 8);
          }
        }
      }
    }

    // La guarda 25 contra rand(1,24): a floor 5 esas dos filas NO pueden salir.
    expect(seen[5]!.has("potion")).toBe(false);
    expect(seen[5]!.has("scroll")).toBe(false);
    // A floor 6 el roll llega a 28 y sí salen.
    expect(seen[6]!.has("potion")).toBe(true);
    expect(seen[6]!.has("scroll")).toBe(true);

    // El escalado propiamente dicho, DETERMINISTA: se anotan los rangos (lo,hi) que la
    // rutina le pide al rand, que es donde vive `floor`. Guion 5 → disparan las filas
    // si=0/1/2 (guardas 2/4/5) y no las demás: 7 rolls de guarda + 3 de cantidad.
    for (const floor of [5, 6] as const) {
      const ranges: [number, number][] = [];
      const script = [5, 1, 5, 1, 5, 1, 5, 5, 5, 5];
      let i = 0;
      const rand: RandFn = (lo, hi) => {
        ranges.push([lo, hi]);
        if (i >= script.length) throw new Error("rand agotado");
        return script[i++]!;
      };
      dungeonChestLoot(floor, rand);
      expect(ranges).toHaveLength(10);
      expect(ranges[0]).toEqual([1, floor * 4 + 4]); // roll de guarda (0x182b)
      expect(ranges[3]).toEqual([1, floor * 8]); // cantidad del ORO (0x187d..0x1896)
      expect(ranges[1]).toEqual([1, 31]); // comida: MAXAMT[0], NO escala
    }
  });
});

/**
 * #150 — el discriminador de la puerta secreta es `g_floor >= 0x80`, NO «es mazmorra».
 *
 *   0b40: 803e955880  cmp byte ptr [g_floor], 0x80
 *   0b45: 7311        jae 0xb58
 *   0b52: c607b9      mov byte ptr [bx], 0xb9      ; floor <  0x80
 *   0b63: c607b8      mov byte ptr [bx], 0xb8      ; floor >= 0x80
 *
 * ⚠ Este bloque SELLABA lo contrario («0xB8 en mazmorra», con `true` como argumento):
 * era prosa sin derivación, y encima describía un caso INALCANZABLE — la cabecera de la
 * rutina (CS:0x0969 `cmp [g_location],0x20 / jbe` + CS:0x0970 `cmp 0x29 / jae`) desvía
 * el rango de mazmorra 0x21-0x28 a `call 0x646` mucho antes del 0x0b33.
 *
 * ⚠ Y el `>= 0x80` NO se puede escribir literal sobre el `floor` del port, que es un
 * número CON SIGNO: los sótanos son z = −1 (smallmaps.json), no 0xFF. Hay que enmascarar
 * a byte, como ya hacía `survival.ts lightLevel`.
 */
describe("Search puerta secreta (SJOG 0x095C) — gate por g_floor (0x0b40)", () => {
  it("tile que no es 0x4E → null, sea cual sea el piso", () => {
    expect(revealSecretDoor(0x00, 0)).toBeNull();
    expect(revealSecretDoor(0x00, -1)).toBeNull();
    expect(revealSecretDoor(0xb9, 0)).toBeNull();
  });

  it("SUPERFICIE y plantas ALTAS (floor 0..3 < 0x80) → 0xB9", () => {
    for (const z of [0, 1, 2, 3]) expect(revealSecretDoor(0x4e, z)).toBe(0xb9);
  });

  it("★ SÓTANO (z = −1, byte 0xFF ⇒ >= 0x80) → 0xB8", () => {
    // El caso que el port fallaba: hay 8 puertas secretas en plantas z=−1 de
    // smallmaps.json (Yew 2, Lord British's Castle 1, Palace of Blackthorn 3,
    // Serpent's Hold 2) y todas se revelaban como 0xB9.
    expect(revealSecretDoor(0x4e, -1)).toBe(0xb8);
  });

  it("UNDERWORLD (floor 0xFF) → 0xB8", () => {
    expect(revealSecretDoor(0x4e, 0xff)).toBe(0xb8);
  });

  it("la frontera del `jae` está en 0x80 exacto (0x7f arriba, 0x80 abajo)", () => {
    expect(revealSecretDoor(0x4e, 0x7f)).toBe(0xb9);
    expect(revealSecretDoor(0x4e, 0x80)).toBe(0xb8);
  });
});

describe("applyLootGrant — caps del original (0x9C60 / 0x9C84)", () => {
  it("gold satura a 9999 (add_word_capped)", () => {
    const s = freshState();
    s.gold = 9990;
    applyLootGrant(s, { id: 2, category: "gold", qty: 50 });
    expect(s.gold).toBe(9999);
  });

  it("food satura a 9999 (add_word_capped)", () => {
    const s = freshState();
    s.food = 9990;
    applyLootGrant(s, { id: 0, category: "food", qty: 50 });
    expect(s.food).toBe(9999);
  });

  it("keys/gems/torches saturan a 99 (add_byte_capped)", () => {
    const s = freshState();
    s.keys = 90;
    s.gems = 90;
    s.torches = 90;
    applyLootGrant(s, { id: 0, category: "keys", qty: 50 });
    applyLootGrant(s, { id: 0, category: "gems", qty: 50 });
    applyLootGrant(s, { id: 0, category: "torches", qty: 50 });
    expect(s.keys).toBe(99);
    expect(s.gems).toBe(99);
    expect(s.torches).toBe(99);
  });
});

describe("applyLootGrant — ítem-arrays (O-loot CERRADA: apply_item_grant SJOG)", () => {
  it("potion (id3): qty = color 0..7 → potionQuantities[color]+1, cap 0x63 (0x1656)", () => {
    const s = freshState();
    const before = s.potionQuantities[5]!;
    applyLootGrant(s, { id: 3, category: "potion", qty: 5 }); // purple
    expect(s.potionQuantities[5]).toBe(before + 1);
    s.potionQuantities[2] = 99;
    applyLootGrant(s, { id: 3, category: "potion", qty: 2 });
    expect(s.potionQuantities[2]).toBe(99); // clamp 0x63
  });

  it("scroll (id4): índice = qty&7 (0x15ed) → scrollQuantities+1", () => {
    const s = freshState();
    const before = s.scrollQuantities[3]!;
    applyLootGrant(s, { id: 4, category: "scroll", qty: 3 }); // IA (In An)
    expect(s.scrollQuantities[3]).toBe(before + 1);
  });

  it("equipment (id5/6/9-12): qty = código 0..47 → equipmentQuantities[code]+1 (0x1690)", () => {
    const s = freshState();
    const before = s.equipmentQuantities[0x17]!; // Short Sword
    applyLootGrant(s, { id: 5, category: "equipment", qty: 0x17 });
    expect(s.equipmentQuantities[0x17]).toBe(before + 1);
  });

  it("munición (0x1B Arrows / 0x1D Quarrels) acredita EN LOTES DE 5 (0x167c call 0x7f70)", () => {
    const s = freshState();
    const arrows = s.equipmentQuantities[0x1b]!;
    const quarrels = s.equipmentQuantities[0x1d]!;
    applyLootGrant(s, { id: 5, category: "equipment", qty: 0x1b });
    applyLootGrant(s, { id: 5, category: "equipment", qty: 0x1d });
    expect(s.equipmentQuantities[0x1b]).toBe(Math.min(99, arrows + 5));
    expect(s.equipmentQuantities[0x1d]).toBe(Math.min(99, quarrels + 5));
  });

  it("sandalwood (id14): g_wooden_box=0xFF → specialItems.woodenBox (0x14F0)", () => {
    const s = freshState();
    expect(s.specialItems.woodenBox).toBe(false);
    applyLootGrant(s, { id: 14, category: "sandalwood", qty: 1 });
    expect(s.specialItems.woodenBox).toBe(true);
  });

  it("lootItemName exactos: scroll rúnico y nombre de equipo pelado (0x15dc/0x16a3)", () => {
    expect(lootItemName(4, 0)).toBe("A scroll: VL!");
    expect(lootItemName(4, 7)).toBe("A scroll: AT!");
    expect(lootItemName(5, 0x1c)).toBe("Crossbow!");
    expect(lootItemName(9, 0x02)).toBe("Iron Helm!");
    expect(lootItemName(12, 0x2f)).toBe("Ankh!");
  });
});
