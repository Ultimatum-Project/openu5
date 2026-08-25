/**
 * ★ EL CONTROL NEGATIVO DE LA VENTANA DE LAS TRES PUERTAS — y la SONDA que hace
 * reproducible su censo.
 *
 * QUÉ CONTROLA. El fix de #11 enseña al conductor de salas a usar las puertas que el
 * original tiene y el arnés no usaba. Un fix así se valida por los dos lados: que ABRA
 * donde hay puerta (eso lo miden ch27/ch29/ch25/ch46) y que **NO fabrique salida donde no
 * la hay**. Los únicos sitios donde «no la hay» son **Doom r6 (cm118)** y **Doom r15
 * (cm127)** — y que sean EXACTAMENTE dos, y EXACTAMENTE ésos, es lo que este fichero fija.
 *
 * POR QUÉ EXISTE, y no es celo. El censo anterior de esta misma ventana declaró **SIETE**
 * bolsillos fieles (`salidas-11-prerregistro.md` §4) y estaba mal: buscó anillo pasable,
 * escaleras y barrera, y **no buscó el Grate**. Cinco de los siete tenían uno. Lo corrigió
 * `salidas-11-errata-grate.md` §4.a, y la lección quedó escrita: *un control negativo
 * enumera lo que se le ocurrió al autor y se reporta como si enumerara el espacio*. La
 * defensa contra que vuelva a pasar no es prosa más cuidadosa — es que el censo sea una
 * SONDA que corre, no una cifra en un `.md` que envejece sin avisar.
 *
 * EL REPERTORIO COMPLETO del original (`cmd_klimb_combat` SJOG 0x1dd5-0x1e19 + el Cetro de
 * CAST 0x1966/0x19a5), que es el espacio que hay que enumerar:
 *
 *   · BORDE   — andar hasta el anillo (la vía de siempre).
 *   · KLIMB   — 0xC8 (sube) · 0xC9 (baja) · 0x86 Grate (baja, SÓLO en combate de sala).
 *   · CETRO   — disuelve `(tile & 0xf0) === 0x70` del anillo y abre la salida por borde.
 *
 * ⚠ ALCANCE — «anillo entero impasable» es condición SUFICIENTE de «no se sale por el
 * borde», no NECESARIA: una sala CON borde pasable puede varar igual si la party queda en
 * un bolsillo interior sin ruta hasta él, y eso depende de la POSICIÓN y no se censa sobre
 * los tiles. Este fichero acota el espacio ESTRUCTURAL; la parte posicional la miden los
 * capítulos.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import type { CombatMapData } from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const tileData = load<Record<string, { IsWalking_Passable?: boolean }>>("../src/core/data/TileData.json");

/**
 * ⚠ `combatmap N` = **POSICIÓN de array N**, NO el campo `index` (que el extractor duplica
 * entre BRIT y DUNGEON). Las 112 de mazmorra son las posiciones 16..127.
 */
const DUNGEON_FIRST = 16;
const DUNGEON_LAST = 127;

const LADDER_UP = 0xc8; // 200
const LADDER_DOWN = 0xc9; // 201
const GRATE = 0x86; // 134

/** MISMA semántica que `traversable` de nav.ts — el censo debe usar el criterio del arnés. */
const REGULAR_DOORS = new Set([184, 186]);
const walkable = (t: number): boolean =>
  Boolean(tileData[String(t)]?.IsWalking_Passable) || REGULAR_DOORS.has(t);
/** Barrera de campo de fuerza: el nibble alto 0x7 — lo que el Cetro disuelve a Grass. */
const isBarrier = (t: number): boolean => (t & 0xf0) === 0x70;

type Census = {
  cm: number;
  ringPassable: number;
  ringBarrier: number;
  klimb: Array<{ tile: number; x: number; y: number }>;
};

function censusOf(cm: number): Census {
  const tiles = combatMaps[cm]!.tiles as unknown as number[][];
  const G = tiles.length;
  const onRing = (x: number, y: number) => x === 0 || y === 0 || x === G - 1 || y === G - 1;
  let ringPassable = 0;
  let ringBarrier = 0;
  const klimb: Census["klimb"] = [];
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const t = tiles[y]![x]!;
      if (onRing(x, y)) {
        if (walkable(t)) ringPassable++;
        if (isBarrier(t)) ringBarrier++;
      }
      if (t === LADDER_UP || t === LADDER_DOWN || t === GRATE) klimb.push({ tile: t, x, y });
    }
  }
  return { cm, ringPassable, ringBarrier, klimb };
}

const all: Census[] = [];
for (let cm = DUNGEON_FIRST; cm <= DUNGEON_LAST; cm++) all.push(censusOf(cm));
/** Las salas donde la salida por BORDE es imposible POR CONSTRUCCIÓN. */
const walled = all.filter((c) => c.ringPassable === 0);
const key = (c: Census) => `cm${c.cm}`;

describe("censo de las TRES PUERTAS sobre los 112 mapas de mazmorra", () => {
  it("CONTROL DEL INSTRUMENTO — `walkable` discrimina: la mayoría de salas SÍ tiene borde", () => {
    // Si `walkable` se rompiera (p.ej. TileData renombrado y todo cayendo a `false`), las
    // 112 saldrían «muradas» y el censo diría «112 bolsillos fieles» con cara de rigor.
    // Este aserto es lo que separa un censo de un cero en falso.
    expect(all).toHaveLength(112);
    expect(walled.length).toBeLessThan(all.length / 2);
    expect(all.filter((c) => c.ringPassable > 0).length).toBe(112 - walled.length);
  });

  it("16 de 112 tienen el ANILLO ENTERO impasable", () => {
    expect(walled.map(key)).toEqual([
      "cm16", "cm18", "cm32", "cm33", "cm78", "cm80", "cm84", "cm85",
      "cm95", "cm102", "cm108", "cm112", "cm114", "cm118", "cm122", "cm127",
    ]);
  });

  it("la PARTICIÓN de las 16 suma su total: 8 escalera + 5 Grate + 1 barrera + 2 nada", () => {
    const hasTile = (c: Census, t: number) => c.klimb.some((k) => k.tile === t);
    const ladder = walled.filter((c) => hasTile(c, LADDER_UP) || hasTile(c, LADDER_DOWN));
    const grate = walled.filter((c) => hasTile(c, GRATE));
    const sceptre = walled.filter((c) => c.klimb.length === 0 && c.ringBarrier > 0);
    const nothing = walled.filter((c) => c.klimb.length === 0 && c.ringBarrier === 0);

    expect(ladder.map(key)).toEqual(["cm16", "cm18", "cm78", "cm80", "cm84", "cm85", "cm95", "cm108"]);
    expect(grate.map(key)).toEqual(["cm32", "cm33", "cm102", "cm114", "cm122"]);
    expect(sceptre.map(key)).toEqual(["cm112"]); // Doom r0 — 28 celdas de barrera en el anillo
    expect(nothing.map(key)).toEqual(["cm118", "cm127"]);
    // Ninguna sala tiene DOS puertas distintas: por eso el orden KLIMB-antes-que-CETRO es
    // hoy INOBSERVABLE, y se declara en la adenda para que conste que no se decidió después.
    expect(grate.filter((c) => ladder.includes(c))).toEqual([]);
    expect(walled.filter((c) => c.klimb.length > 0 && c.ringBarrier > 0)).toEqual([]);
    // La partición no deja resto.
    expect(ladder.length + grate.length + sceptre.length + nothing.length).toBe(walled.length);
  });

  it("★★ CONTROL NEGATIVO — Doom r6 (cm118) y Doom r15 (cm127) no tienen NINGUNA de las tres", () => {
    for (const cm of [118, 127]) {
      const c = censusOf(cm);
      expect(c.ringPassable, `cm${cm}: sin borde pasable`).toBe(0);
      expect(c.klimb, `cm${cm}: sin 0xC8/0xC9/0x86`).toEqual([]);
      expect(c.ringBarrier, `cm${cm}: sin barrera que disolver`).toBe(0);
    }
  });

  it("las 5 salas del GRATE están donde la errata dijo, tile a tile", () => {
    // La cifra que ESTA sonda existe para impedir que vuelva a envejecer en un .md:
    // `salidas-11-prerregistro.md` §4 las contó como «bolsillos fieles» por no buscar 0x86.
    const at = (cm: number) => censusOf(cm).klimb.filter((k) => k.tile === GRATE).map((k) => `${k.x},${k.y}`);
    expect(at(32)).toEqual(["9,9"]); // Destard r0
    expect(at(33)).toEqual(["2,6"]); // Destard r1
    expect(at(102)).toEqual(["5,3"]); // Hythloth r6 — el que dejó de ser «bolsillo fiel»
    expect(at(114)).toEqual(["3,3"]); // Doom r2  (pass2b)
    expect(at(122)).toEqual(["5,7"]); // Doom r10 (pass2b)
  });
});
