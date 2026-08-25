/**
 * Pose del avatar según el tile pisado (H1 sentado en silla / H2 tumbado en cama) —
 * presentación pura: `poseSpriteForTile` mapea el tile bajo el líder al sprite de
 * pose, o null (de pie). Derivación: TileData sillas 0x90-0x93 → sentados 0x130-0x133
 * index-paralelo; cabecera de cama 0xab → postrado 0x11a. Ver skin/partyPose.ts.
 */
import { describe, expect, it } from "vitest";
import { poseSpriteForTile } from "../src/skin/partyPose.js";

describe("partyPose — sentarse en silla (H1)", () => {
  // Cada orientación de silla (respaldo Forward/Left/Back/Right) → su sentado
  // (Up/Right/Down/Left), mapeo index-paralelo sit = 0x130 + (silla - 0x90).
  const cases: [number, number, string][] = [
    [0x90, 0x130, "ChairBackForward → SitChairUp"],
    [0x91, 0x131, "ChairBackLeft → SitChairRight"],
    [0x92, 0x132, "ChairBackBack → SitChairDown"],
    [0x93, 0x133, "ChairBackRight → SitChairLeft"],
  ];
  for (const [chair, sit, label] of cases) {
    it(label, () => {
      expect(poseSpriteForTile(chair)).toBe(sit);
    });
  }

  it("respeta la relación lineal en las 4 sillas", () => {
    for (let i = 0; i < 4; i++) {
      expect(poseSpriteForTile(0x90 + i)).toBe(0x130 + i);
    }
  });
});

describe("partyPose — tumbarse en cama (H2)", () => {
  it("cabecera (LeftBed 0xab) → postrado (SleepingInBed 0x11a)", () => {
    expect(poseSpriteForTile(0xab)).toBe(0x11a);
  });

  it("los pies (RightBed 0xac) NO imponen pose (null) — sólo la cabecera", () => {
    expect(poseSpriteForTile(0xac)).toBeNull();
  });
});

describe("partyPose — de pie en cualquier otro tile", () => {
  // Tiles vecinos/comunes que NO deben disparar pose (evita falsos positivos).
  for (const t of [0x00, 0x03, 0x08, 0x8b /*TortureChair*/, 0x8f, 0x94, 0xaa, 0xad, 0x11c /*BasicAvatar*/, 0x12f, 0x134]) {
    it(`tile 0x${t.toString(16)} → null (andar)`, () => {
      expect(poseSpriteForTile(t)).toBeNull();
    });
  }
});
