/**
 * Tests del endgame (ENDGAME.OVL, Task 3.12): fórmula de playtime EXACTA
 * (year−139/month−4/day−5 con préstamo 28/13) y el informe "N year[s], M
 * month[s], D day[s]" con la lógica exacta de plural/separador.
 *
 * + DELETREO de la fecha del pergamino (`spell_cardinal` 0x028c / `spell_ordinal`
 * 0x02d6 con las tablas DATA.OVL 0x3e0a/0x3e2e/0x3e40), que sustituye a la
 * numerización «5th / 140,» del clon.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  endgamePlaytime,
  formatQuestReport,
  questScroll,
  spellCardinal,
  spellOrdinal,
} from "../src/core/quest/endgame.js";
import { rescueLordBritish } from "../src/core/quest/lordbritish.js";

function readJson<T>(url: string): T {
  const path = fileURLToPath(new URL(url, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
const init = readJson<ExtractedInitialState>("../assets/initial-state.json");

function gameAt(year: number, month: number, day: number): GameState {
  const g = createNewGame(init);
  g.time.year = year;
  g.time.month = month;
  g.time.day = day;
  return g;
}

describe("endgamePlaytime (year−139/month−4/day−5, préstamo 28/13)", () => {
  it("mismo instante de inicio → 0/0/0", () => {
    expect(endgamePlaytime(gameAt(139, 4, 5))).toEqual({ years: 0, months: 0, days: 0 });
  });

  it("unos días después, sin préstamo", () => {
    expect(endgamePlaytime(gameAt(139, 4, 20))).toEqual({ years: 0, months: 0, days: 15 });
  });

  it("préstamo de día: mes 28 días", () => {
    // day 3 < 5 → +28, months--. month 5-4=1, then 1-1=0. days=3-5+28=26.
    expect(endgamePlaytime(gameAt(139, 5, 3))).toEqual({ years: 0, months: 0, days: 26 });
  });

  it("préstamo de mes: año 13 meses", () => {
    // month 3 < 4 → +13, years--. year 140-139=1, 1-1=0. months=3-4+13=12.
    expect(endgamePlaytime(gameAt(140, 3, 10))).toEqual({ years: 0, months: 12, days: 5 });
  });

  it("doble préstamo (día y mes)", () => {
    // day 1-5=-4 → +28=24, months--. month 4-4=0, 0-1=-1 → +13=12, years--.
    // year 141-139=2, 2-1=1.
    expect(endgamePlaytime(gameAt(141, 4, 1))).toEqual({ years: 1, months: 12, days: 24 });
  });
});

describe("formatQuestReport (plural + separador exactos)", () => {
  it("singular/plural y ', ' entre unidades no nulas", () => {
    // 1 year, 12 months, 24 days
    expect(formatQuestReport(gameAt(141, 4, 1))).toBe(
      "Report now, thy Quest compleat in\n1 year, 12 months, 24 days\nto Lord British at Origin Systems!",
    );
  });

  it("omite las unidades nulas", () => {
    // 0/0/15 → sólo días
    expect(formatQuestReport(gameAt(139, 4, 20))).toBe(
      "Report now, thy Quest compleat in\n15 days\nto Lord British at Origin Systems!",
    );
  });

  it("plural 's' sólo cuando >1", () => {
    // 0/0/1 → "1 day" (sin s)
    expect(formatQuestReport(gameAt(139, 4, 6))).toBe(
      "Report now, thy Quest compleat in\n1 day\nto Lord British at Origin Systems!",
    );
  });

  it("todo cero → sólo cabecera y pie", () => {
    expect(formatQuestReport(gameAt(139, 4, 5))).toBe(
      "Report now, thy Quest compleat in\n\nto Lord British at Origin Systems!",
    );
  });
});

describe("spellCardinal (ENDGAME 0x028c, tablas DS 0x3e0a/0x3e2e)", () => {
  it("n<21 sale de la tabla de unidades tal cual (0x0290 cmp 0x15; jge)", () => {
    // Volcado byte a byte de DATA.OVL 0x3e0a: el índice 0 es puntero NULO ⇒ nada.
    expect(spellCardinal(0)).toBe("");
    expect([1, 5, 12, 13, 19, 20].map(spellCardinal)).toEqual([
      "One", "Five", "Twelve", "Thirteen", "Nineteen", "Twenty",
    ]);
  });

  it("n>=21 = decenas + '-' + unidad, y SIN guion cuando el resto es 0 (0x02bd or si,si; je)", () => {
    expect(spellCardinal(21)).toBe("Twenty-One");
    expect(spellCardinal(39)).toBe("Thirty-Nine");
    expect(spellCardinal(99)).toBe("Ninety-Nine");
    // resto 0 ⇒ el binario SALTA el '-' y la unidad: sólo la decena.
    expect([30, 40, 90].map(spellCardinal)).toEqual(["Thirty", "Forty", "Ninety"]);
  });
});

describe("spellOrdinal (ENDGAME 0x02d6) — las CUATRO ramas del binario", () => {
  it("n<13 → tabla de ordinales 0x3e40 (First..Twelfth)", () => {
    expect([1, 2, 3, 4, 5, 12].map(spellOrdinal)).toEqual([
      "First", "Second", "Third", "Fourth", "Fifth", "Twelfth",
    ]);
  });

  it("13<=n<20 → cardinal + 'th' (0x02ea; DS 0x831e)", () => {
    expect([13, 14, 19].map(spellOrdinal)).toEqual(["Thirteenth", "Fourteenth", "Nineteenth"]);
  });

  it("n==20 → 'Twent'+'ieth' (rama propia 0x0303; NO cardinal+th)", () => {
    expect(spellOrdinal(20)).toBe("Twentieth");
  });

  it("n>=21 → 'Twenty-' + ordinal[n−20] (tabla 0x3e18 = 0x3e40 desplazada 20)", () => {
    expect([21, 25, 28].map(spellOrdinal)).toEqual([
      "Twenty-First", "Twenty-Fifth", "Twenty-Eighth",
    ]);
  });

  it("cubre el DOMINIO real sin huecos: día 1..28 y mes 1..13 (calendario 13×28)", () => {
    for (const n of Array.from({ length: 28 }, (_, i) => i + 1)) {
      expect(spellOrdinal(n), `ordinal(${n}) vacío`).not.toBe("");
      // Ningún ordinal deletreado puede contener una CIFRA: eso sería la numerización vieja.
      expect(spellOrdinal(n), `ordinal(${n}) numerizado`).not.toMatch(/\d/);
    }
  });
});

describe("questScroll — careo con el TESTIGO de vídeo (endgame-witness-20260721 §129-153 s)", () => {
  // El testigo transcribe: «Be it known that on the Tenth Day of the Fourth Month of
  // the Year One Hundred Thirty-Nine, NOMBRE the Avatar saved the life…» + «Report now,
  // thy Quest compleat in 5 days». Fecha del vídeo = 139/4/10; inicio fijo 139/4/5 ⇒ 5 días.
  const lines = questScroll(gameAt(139, 4, 10));

  it("la fecha sale DELETREADA, como en el frame del testigo", () => {
    expect(lines[0]).toBe("Be it known that on the Tenth Day of the Fourth Month");
    expect(lines[1]).toBe("of the Year One Hundred Thirty-Nine");
  });

  it("el informe da los 5 días del testigo (cierra el careo de la fecha con el playtime)", () => {
    expect(lines[lines.length - 1]).toContain("5 days");
  });

  it("NADA del pergamino queda numerizado (guarda de la regresión que este cambio retira)", () => {
    // Antes: «the 10th Day of the 4th Month» / «of the Year 139,». La cifra del AÑO ya
    // no aparece, ni los sufijos ordinales, ni la coma fabricada tras el año.
    expect(lines[0]).not.toMatch(/\d/);
    expect(lines[1]).not.toMatch(/\d/);
    expect(lines[1]).not.toMatch(/,$/);
  });
});

describe("rescueLordBritish — fork de la caja (ENDGAME_main 0x08c2)", () => {
  const readyGame = (year: number) => {
    const g = gameAt(year, 4, 5);
    g.questFlags["in-doom"] = true;
    g.questFlags["shadowlord-dead:falsehood"] = true;
    g.questFlags["shadowlord-dead:hatred"] = true;
    g.questFlags["shadowlord-dead:cowardice"] = true;
    g.lbArtifacts = { amulet: true, crown: true, sceptre: true };
    return g;
  };

  it("rama VICTORIA (con la Sandalwood Box): Orb + pergamino con playtime", () => {
    const g = readyGame(140);
    g.specialItems.woodenBox = true;
    const r = rescueLordBritish(g);
    expect(r.ok).toBe(true);
    expect(r.ending).toBe("victory");
    expect(g.questFlags["game-won"]).toBe(true);
    // diálogo fiel de ENDMSG.DAT (records 3 y 9).
    expect(r.messages.some((m) => m.includes("Lord British carefully opens the box"))).toBe(true);
    expect(r.messages.some((m) => m.includes("Our worlds await!"))).toBe(true);
    // pergamino/playtime.
    expect(r.messages.some((m) => m.includes("thy Quest compleat in"))).toBe(true);
    expect(r.messages.some((m) => m.includes("1 year"))).toBe(true);
  });

  it("rama VARADO (sin la caja): 'pull up a chair', SIN Orb ni pergamino", () => {
    const g = readyGame(140);
    g.specialItems.woodenBox = false;
    const r = rescueLordBritish(g);
    expect(r.ok).toBe(true);
    expect(r.ending).toBe("stranded");
    expect(g.questFlags["game-won"]).toBe(true); // el finale se dispara una vez igual
    expect(r.messages.some((m) => m.includes("pull up a chair"))).toBe(true);
    expect(r.messages.some((m) => m.includes("We shall be here a while"))).toBe(true);
    // sin la caja NO hay Orb ni pergamino de victoria.
    expect(r.messages.some((m) => m.includes("Our worlds await!"))).toBe(false);
    expect(r.messages.some((m) => m.includes("thy Quest compleat in"))).toBe(false);
  });

  it("condiciones incompletas → ending 'incomplete', sin marcar game-won", () => {
    const g = gameAt(140, 4, 5);
    g.questFlags["in-doom"] = true; // pero faltan regalías/shadowlords
    const r = rescueLordBritish(g);
    expect(r.ok).toBe(false);
    expect(r.ending).toBe("incomplete");
    expect(g.questFlags["game-won"]).toBeFalsy();
  });
});
