/**
 * Tests de (L)ook — dispatch de casos especiales EXACTO de LOOKOBJ look_dispatch
 * @0x0502. La estructura del asm es la clave: SÓLO cielo(0x59)/pozo(0xA1)/
 * fuente((tile&0xFC)==0xD8) **saltan** look_generic; reloj(0xFA/FB)/Flame(0xDE)/
 * mazmorra(0xDF) llaman a look_generic (la frase base de LOOK2.DAT) INCONDICIONALMENTE
 * y **concatenan** después el texto especial (hora/virtud/rama). Por eso el dispatch
 * puro devuelve `{mode:"replace"}` para el cielo (texto propio, sin genérico) y
 * `{mode:"concat", suffix}` para los concatenantes (el sufijo dinámico; el genérico lo
 * pone `look()` desde LOOK2). Hallazgo: `.superpowers/sdd/port-f4-review.md`.
 */
import { describe, it, expect } from "vitest";
import { lookSpecialDescription } from "../src/core/game.js";

const noonSky = { hour: 12, minute: 0 };
const nightSky = { hour: 23, minute: 30 };

describe("cielo (0x59) — REEMPLAZA look_generic (no concatena)", () => {
  it("día (6<=h<18) → el sol", () => {
    expect(lookSpecialDescription(0x59, 0, noonSky, 0)).toEqual({ mode: "replace", text: "the sun!" });
    expect(lookSpecialDescription(0x59, 0, { hour: 6, minute: 0 }, 0)).toEqual({
      mode: "replace",
      text: "the sun!",
    });
  });
  it("noche → el cielo nocturno (LOOKOBJ 0x04ea → DS 0x72fa 'the night sky!')", () => {
    expect(lookSpecialDescription(0x59, 0, nightSky, 0)).toEqual({ mode: "replace", text: "the night sky!" });
    expect(lookSpecialDescription(0x59, 0, { hour: 18, minute: 0 }, 0)).toEqual({
      mode: "replace",
      text: "the night sky!",
    });
  });
});

describe("reloj de pie (0xFA/0xFB) — CONCATENA sólo la hora tras el genérico", () => {
  it("14:30 → sufijo '2:30 PM.'", () => {
    expect(lookSpecialDescription(0xfa, 0, { hour: 14, minute: 30 }, 0)).toEqual({
      mode: "concat",
      suffix: "2:30 PM.",
    });
  });
  it("medianoche 0:05 → sufijo '12:05 AM.'", () => {
    expect(lookSpecialDescription(0xfb, 0, { hour: 0, minute: 5 }, 0)).toEqual({
      mode: "concat",
      suffix: "12:05 AM.",
    });
  });
  it("11:00 es AM, 12:00 es PM (h<=0x0b)", () => {
    expect(lookSpecialDescription(0xfa, 0, { hour: 11, minute: 0 }, 0)).toEqual({
      mode: "concat",
      suffix: "11:00 AM.",
    });
    expect(lookSpecialDescription(0xfa, 0, { hour: 12, minute: 0 }, 0)).toEqual({
      mode: "concat",
      suffix: "12:00 PM.",
    });
  });
  it("el sufijo NO reproduce la frase LOOK2 (la pone look_generic)", () => {
    const r = lookSpecialDescription(0xfa, 0, { hour: 14, minute: 30 }, 0);
    expect(r).not.toBeNull();
    if (r && r.mode === "concat") expect(r.suffix).not.toContain("grandfather clock");
  });
});

describe("Flame por location (0xDE) — CONCATENA la virtud tras el genérico", () => {
  it("0x1e/0x1f/0x20 → Truth/Love/Courage", () => {
    expect(lookSpecialDescription(0xde, 0, noonSky, 0x1e)).toEqual({ mode: "concat", suffix: "Truth" });
    expect(lookSpecialDescription(0xde, 0, noonSky, 0x1f)).toEqual({ mode: "concat", suffix: "Love" });
    expect(lookSpecialDescription(0xde, 0, noonSky, 0x20)).toEqual({ mode: "concat", suffix: "Courage" });
  });
  it("otra location → concatena con sufijo vacío (el original imprime sólo 'the Flame of ')", () => {
    // El asm llama a look_generic incondicionalmente y luego jmp a fin sin sufijo.
    expect(lookSpecialDescription(0xde, 0, noonSky, 1)).toEqual({ mode: "concat", suffix: "" });
  });
});

describe("entrada de mazmorra por banda X (0xDF) — CONCATENA el nombre", () => {
  it("mapea cada X a su mazmorra", () => {
    const cases: [number, string][] = [
      [0x3a, "Shame"], [0x48, "Destard"], [0x5b, "Despise"], [0x7e, "Wrong"],
      [0x80, "Doom"], [0x9c, "Covetous"], [0xef, "Hythloth"], [0xf0, "Deceit"],
    ];
    for (const [x, name] of cases) {
      expect(lookSpecialDescription(0xdf, x, noonSky, 0)).toEqual({ mode: "concat", suffix: name });
    }
  });
  it("X fuera de banda → concatena con sufijo vacío", () => {
    expect(lookSpecialDescription(0xdf, 0x10, noonSky, 0)).toEqual({ mode: "concat", suffix: "" });
  });
});

describe("tile no especial → null", () => {
  it("un tile normal cae al look genérico", () => {
    expect(lookSpecialDescription(0x01, 0, noonSky, 0)).toBeNull();
  });
});
