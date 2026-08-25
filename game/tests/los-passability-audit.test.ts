/**
 * Auditoría LOS-opacidad vs PASABILIDAD (re/notes/los-passability-audit.md).
 *
 * Clava que el port NO conflaciona las tres tablas del binario y fija los sets
 * divergentes como fixtures (para los pasos B/C del carril). El predicado del
 * consumidor kernel `0x2bd4` es `bloquea ⟺ bit (0x80>>(tile&7)) del byte bm[tile>>3]`
 * (MSB, bit PUESTO = bloquea; ancla: hierba 0x05 pasa, agua 0x01 bloquea).
 *
 * FUENTE (corrección 2026-07-18): PASABILIDAD se toma de la tabla ESTÁTICA canónica
 * `DATA.OVL` fileoff `0x54e4` (la que el kernel usa en DS:0x54d4). El volcado EN VIVO del
 * lote-D estaba CORRUPTO en 0xa8-0xe7 (bytes 21-28) y fabricó falsos positivos (p.ej.
 * Fireplace 0xbc: 0xff corrupto → 0xf7 canónico = PISABLE). La tabla de LOS de hechizo
 * (0x6a24) se verificó IDÉNTICA al volcado; sólo pasabilidad cambió.
 *
 * POLARIDAD (corrección 2026-07-30): el predicado de arriba es el de la PASABILIDAD y NO se
 * extiende a 0x6a14, cuyo consumidor (kernel 0x3f6e) devuelve 1 con el bit PUESTO y cuyo
 * llamador para en el 0 ⇒ en 0x6a14 **bit PUESTO = TRANSPARENTE** (210) y bit CLARO = OPACO
 * (46). El set de abajo se llamaba `LOS_OPACITY`, nombre invertido que pasaba con las dos
 * lecturas; hoy es `LOS_TRANSPARENT`. Renombre puro — mismos bytes, mismo 210, mismos asertos.
 */
import { describe, expect, it } from "vitest";
import { ALWAYS_OPAQUE } from "../src/core/world/visibility.js";
import { blocksSpellLine } from "../src/core/magic/areaSpellTables.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isCannonSolid } from "../src/core/world/cannon.js";
import { TILE_INFO } from "../src/core/tiles.js";

const hex = (s: string): number[] => s.trim().split(/\s+/).map((h) => parseInt(h, 16));
const bitmapSet = (bytes: number[]): Set<number> => {
  const s = new Set<number>();
  for (let t = 0; t < 256; t++) if ((bytes[t >> 3]! & (0x80 >> (t & 7))) !== 0) s.add(t);
  return s;
};

// Bytes VERBATIM del binario. PASABILIDAD = DATA.OVL @0x54e4 (canónico ESTÁTICO); los
// bytes 21-28 (0xa8-0xe7) difieren del volcado-vivo corrupto anterior.
const PASSABILITY = bitmapSet(hex(
  "70 0c 00 28 01 f3 00 bd 72 3f ff ff ff cf ff ff fc f6 0f ff ff c7 ff f7 f0 3f ff f3 ff ff ff be",
)); // DATA.OVL fileoff 0x54e4 → DS:0x54d4, consumidor kernel 0x2bd4
const LOS_TRANSPARENT = bitmapSet(hex(
  "ff f3 c3 8f ff ff ff c0 dd f8 03 df ff ff 00 00 ff ff ff ff ff ff ff 3f ff ff ff fe ff ff ff ff",
)); // DATA.OVL 0x6a24 → DS:0x6a14, kernel 0x3f6e (LOS de hechizo de línea/área + proyectil de
// combate); verificado idéntico. Los bits PUESTOS son los TRANSPARENTES (210), no los opacos:
// 0x3f6e devuelve 1 con el bit puesto y el consumidor manda el 0 al brazo de PARADA. Ver
// re/notes/los-passability-audit.md y re/notes/proyectil-los-0x6a14-derivacion.md.
const LIGHT_OPACITY = new Set(hex("09 0a 0c 0d 4d 4e 4f 5a 97 b8 b9 bc d0 d1 d2 d3 f8 fe ff")); // DS:0x6a86, kernel 0x5dfe

describe("las tres tablas del binario son DISTINTAS (no conflación)", () => {
  it("cardinalidades: 182 bloquean el paso · 210 TRANSPARENTES a la LOS de hechizo · 19 opacas a la luz", () => {
    expect(PASSABILITY.size).toBe(182);
    expect(LOS_TRANSPARENT.size).toBe(210);
    expect(LIGHT_OPACITY.size).toBe(19);
  });

  it("divergen entre sí en ambos sentidos (no son la misma tabla)", () => {
    const passNotLos = [...PASSABILITY].filter((t) => !LOS_TRANSPARENT.has(t)); // bloquea paso Y opaco
    const losNotPass = [...LOS_TRANSPARENT].filter((t) => !PASSABILITY.has(t)); // pisable Y transparente
    expect(passNotLos).toHaveLength(39);
    expect(losNotPass).toHaveLength(67);
    // fixtures verbatim (para B/C). Los DOS conjuntos van clavados tile a tile, no por
    // cardinal: durante doce días el acta llevó este segundo conjunto recomputado contra el
    // volcado EN VIVO (corrupto en 0xa8-0xe7) en vez de contra DATA.OVL @0x54e4, con diez
    // tiles mal, y nadie lo pinchó porque el cardinal cuadra en las DOS lecturas (67 y 67).
    // Una cota no prueba pertenencia. Ver re/notes/los-passability-audit.md (banner 2026-07-30).
    expect(passNotLos.sort((a, b) => a - b)).toEqual(hex(
      "0c 0d 1a 3a 3b 3c 3d 3f 42 46 4d 4e 4f 50 51 52 53 54 55 5a 70 71 72 73 74 75 76 77 78 79 7a 7b 7c 7d 7e 7f b8 b9 df",
    ));
    // pisables Y transparentes, derivado de PASSABILITY (DATA.OVL fileoff 0x54e4, canónico) y
    // del bitmap 0x6a24 → DS:0x6a14. Coincide tile a tile con la lista de lote-D (67/67).
    expect(losNotPass.sort((a, b) => a - b)).toEqual(hex(
      "00 04 05 06 07 08 09 0a 0b 0e 0f 10 11 16 17 18 1d 1e 1f 20 21 22 23 24 25 26 2c 2d 30 31 32 33 34 35 36 37 39 40 44 45 47 48 49 6a 6b 86 87 8c 8f 90 91 92 93 aa ab ac bc c4 c5 c6 c7 c8 c9 dc dd f9 ff",
    ));
  });
});

describe("Fog/LOS del viewport — FIEL (usa la tabla de LUZ 0x6a86, no pasabilidad)", () => {
  it("ALWAYS_OPAQUE == los 19 bytes de DS:0x6a86 VERBATIM", () => {
    expect(new Set(ALWAYS_OPAQUE)).toEqual(LIGHT_OPACITY);
  });
  it("NO es la tabla de pasabilidad ni la de LOS (divergen)", () => {
    expect(ALWAYS_OPAQUE.size).not.toBe(PASSABILITY.size);
    expect(ALWAYS_OPAQUE.size).not.toBe(LOS_TRANSPARENT.size);
  });
});

describe("Cañón naval — FIEL (lista literal 0x97-0x99/0xB8-0xBB, no rangeWeaponPassable)", () => {
  it("bloquea exactamente 0x97..0x99 y 0xB8..0xBB", () => {
    const solid = [];
    for (let t = 0; t < 256; t++) if (isCannonSolid(t)) solid.push(t);
    expect(solid).toEqual([0x97, 0x98, 0x99, 0xb8, 0xb9, 0xba, 0xbb]);
  });
});

describe("Pasabilidad del port vs binario canónico 0x54e4 — 7 swaps, 2 divergencias residuales", () => {
  // `walkable` lleva el walkableOverride (7 swaps confirmados contra DATA.OVL @0x54e4).
  // La divergencia residual (2) es DELIBERADA y bendecida (adjudicación 2026-07-19):
  // 0x1a walk-to-restore + 0xff void bloqueado por defensa (el «pasa» del binario es
  // don't-care de tile de niebla/borde). 0xf9 cerrado casando el binario (pisable).
  const portBlocks = new Set<number>();
  for (let t = 0; t < 256; t++) if (TILE_INFO[t] && !TILE_INFO[t]!.walkable) portBlocks.add(t);

  it("el binario canónico bloquea 182 EXACTOS", () => {
    expect(PASSABILITY.size).toBe(182);
  });
  it("el port bloquea 182 (177 dataset − 1 override pisable + 6 override bloqueantes)", () => {
    expect(portBlocks.size).toBe(182);
  });
  it("divergencia residual = 1 infra-bloqueo + 1 sobre-bloqueo, ambas DELIBERADAS", () => {
    const binNotPort = [...PASSABILITY].filter((t) => !portBlocks.has(t)).sort((a, b) => a - b);
    const portNotBin = [...portBlocks].filter((t) => !PASSABILITY.has(t)).sort((a, b) => a - b);
    // binario bloquea / port pisa: sólo 0x1a BrokenShrine (divergencia DELIBERADA walk-to-restore).
    expect(binNotPort).toEqual(hex("1a"));
    // port bloquea / binario pisa: 0xff black-square (void, bloqueo defensivo BENDECIDO).
    expect(portNotBin).toEqual(hex("ff"));
  });
});

describe("walkableOverride — swaps citados a DATA.OVL @0x54e4 (kernel 0x2bd4, MSB)", () => {
  it("SignShipwright 0xf9 transitable (cierre pasabilidad-29: el canónico lo deja PISABLE)", () => {
    expect(PASSABILITY.has(0xf9)).toBe(false); // canónico: pasable (byte31, bit CLEAR)
    expect(TILE_INFO[0xf9]!.walkable).toBe(true); // override cierra el sobre-bloqueo del dataset
  });
  it("los 6 tiles (WaterStream 0x6c-6f + Oasis 0x1c + campo-muerto 0xc3) NO transitables a pie", () => {
    for (const t of [0x6c, 0x6d, 0x6e, 0x6f, 0x1c, 0xc3]) {
      expect(TILE_INFO[t]!.walkable).toBe(false);
      expect(PASSABILITY.has(t)).toBe(true); // coincide con el binario (bloquea)
    }
  });
  it("Fireplace 0xbc NO se overridea: el canónico lo deja PISABLE (falso positivo del volcado corrupto)", () => {
    expect(PASSABILITY.has(0xbc)).toBe(false); // canónico: pasable
    expect(TILE_INFO[0xbc]!.walkable).toBe(true); // port pisa, coincide → sin override
  });
  it("no toca las divergencias deliberadas (moongate 0xdc + BrokenShrine 0x1a siguen transitables)", () => {
    expect(TILE_INFO[0xdc]!.walkable).toBe(true); // walk-to-teleport, deliberada
    expect(TILE_INFO[0x1a]!.walkable).toBe(true); // walk-to-restore (checkShrineEntry), deliberada
  });
});

/**
 * GUARDA DEL LOS DE PROYECTIL DE COMBATE (añadida 2026-07-25, carril bancos-residuales).
 *
 * Esta es la guarda que HABRÍA CAZADO el ticket #44. Durante tres días el port trazó los
 * proyectiles de combate con la tabla de LUZ (0x6a86) citando un camino de llamadas que no
 * existe, y nada lo pinchaba porque ningún test fijaba QUÉ tabla debe usar el proyectil.
 *
 * Cadena derivada (re/notes/proyectil-los-0x6a14-derivacion.md):
 *   COMSUBS 0x0a68 @0x0b7e → 0x0822 @0x08b5 → 0x12DE (que DEVUELVE 0/1)
 *   0x12DE @0x142a  call 0x5d8e  → (0xe1e0 + 0x5d8e) & 0xFFFF = kernel 0x3F6E
 *   0x3F6E @0x3f9d  mov cl,[bx+0x6a14]   ⇒ bit PUESTO = atraviesa
 */
describe("LOS de PROYECTIL de combate — usa 0x6a14 (kernel 0x3F6E), NO la tabla de luz", () => {
  const pasa = (t: number) => LOS_TRANSPARENT.has(t);

  it("es la MISMA tabla que la LOS de hechizo: 0x3F6E tiene dos call-sites (CAST 0x1c28 + COMSUBS 0x142a)", () => {
    for (let t = 0; t < 256; t++) expect(blocksSpellLine(t)).toBe(!LOS_TRANSPARENT.has(t));
  });

  it("NO es la tabla de luz: difieren en 49 tiles", () => {
    const diff = [];
    for (let t = 0; t < 256; t++) if (!pasa(t) !== LIGHT_OPACITY.has(t)) diff.push(t);
    expect(diff).toHaveLength(49);
  });

  it("★ las 16 barreras ShadowlordBoundary (0x70-0x7f) PARAN la flecha", () => {
    // Si esto se rompe, una sala sellada por barrera se puede ganar a distancia => VICTORIA
    // FABRICADA. Es el caso que destapó la re-auditoría del censo (#103, #125).
    for (let t = 0x70; t <= 0x7f; t++) expect(pasa(t), `0x${t.toString(16)}`).toBe(false);
  });

  it("las tres «correcciones» del #44 estaban INVERTIDAS: 0x42 y 0x46 bloquean, 0xff pasa", () => {
    expect(pasa(0x42)).toBe(false); // WoodFloorShipTie — las «cajas de lava» SÍ sellan
    expect(pasa(0x46)).toBe(false); // DryStone
    expect(pasa(0xff)).toBe(true); // BlackSquare
  });

  it("divisor de Wrong r1: ventanas y puertas-con-visor dejan pasar, el muro macizo no", () => {
    expect(pasa(0x4b)).toBe(true); // StoneGlassWindow
    expect(pasa(0x98)).toBe(true); // MagicLockDoorWithView
    expect(pasa(0xbb)).toBe(true); // LockedDoorView
    // StoneBrickWall: OPACO en la tabla fiel 0x6a14. OJO — este hecho ya NO «sostiene el
    // dead-end de ch16b»: ese sello se RETIRÓ el 2026-07-26 (era fabricado). La sala se gana
    // pisando la placa de (5,5), que ABRE el muro (COMBAT 0x111A) — no disparando a través.
    // Ver re/notes/ch16b-dead-end-fabricado.md y tests/conquer-room-plates.test.ts.
    expect(pasa(0x4f)).toBe(false);
  });
});

/**
 * Las guardas de arriba fijan la TABLA. Ésta fija el CONSUMIDOR: que el trazado de
 * proyectil de `combat.ts` use esa tabla y no la de luz. Sin ella, un revert de una línea
 * volvería a dejar el port midiendo con 0x6a86 y todos los tests seguirían verdes — que es
 * exactamente lo que pasó durante el #44.
 */
describe("el CONSUMIDOR: combat.ts traza el proyectil con 0x6a14, no con la tabla de luz", () => {
  const src = readFileSync(fileURLToPath(new URL("../src/core/combat/combat.ts", import.meta.url)), "utf8");
  const cuerpo = src.slice(src.indexOf("private isRangedPathClear"), src.indexOf("private canReach"));

  it("isRangedPathClear consulta blocksSpellLine (kernel 0x3F6E / 0x6a14)", () => {
    expect(cuerpo).toContain("blocksSpellLine(t)");
  });

  it("isRangedPathClear NO consulta ALWAYS_OPAQUE (0x6a86 = tabla de LUZ, otro consumidor)", () => {
    expect(cuerpo).not.toContain("ALWAYS_OPAQUE");
  });
});
