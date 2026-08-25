/**
 * F1.12 — LINTER DE INVARIANTES DE ASSETS (gate de cierre de Fase 1).
 *
 * QUÉ. Valida `game/assets/` y `game/src/core/data/` contra las reglas que el
 * corpus RE ya justifica. Cada invariante caza —a nivel de DATO— una de las dos
 * clases de bug que el barrido inverso destapó (scout-inverse-audit):
 *   (bug TREASURY_CHESTS) una coord de spawn/override sobre un tile de rol
 *     incoherente (cofre dentro de un muro);
 *   (bug #F13-2)          un slot-objeto del .NPC que el Look trata como
 *     "citizen" en vez de describir el tile-objeto.
 *
 * POR QUÉ a nivel de asset y no de código: ambos bugs vivían en los DATOS/su
 * interpretación, no en una fórmula; un test de mecánica no los veía. Este linter
 * fija las invariantes derivadas para que un dato nuevo incoherente falle en ROJO.
 *
 * Cada `it` lleva su cita al corpus. Importa el clasificador REAL
 * (`npcSlotObjectKind`) para validar EXACTAMENTE el set que usa el juego, cotejado
 * contra fuentes independientes (TileData `IsWalking_Passable`/`IsNPC`, look2.json).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { npcSlotObjectKind } from "../src/core/npc/manager.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const G = (...p: string[]) => join(HERE, "..", ...p);
const readJson = (rel: string) => JSON.parse(readFileSync(G(rel), "utf8").replace(/^﻿/, ""));

const npcs = readJson("assets/npcs.json") as Record<string, NpcSlotRaw[]>;
const tileData = readJson("src/core/data/TileData.json") as Record<string, TileRow>;
const look2 = readJson("assets/look2.json") as string[];
const smallmaps = readJson("assets/maps/smallmaps.json") as SmallMapRaw[];
const overrides = readJson("src/core/data/TileOverrides.json") as Record<string, OverrideRow[]>;
const data = readJson("assets/data.json") as Record<string, unknown[]>;

interface NpcSlotRaw {
  slot: number;
  type: number;
  x: number[];
  y: number[];
  z: number[];
}
interface TileRow {
  Name: string;
  IsWalking_Passable: boolean;
  IsNPC: boolean;
  IsEnemy: boolean;
  IsOpenable: boolean;
}
interface SmallMapRaw {
  id: number;
  name: string;
  floors: { z: number; tiles: number[][] }[];
}
interface OverrideRow {
  MapNumber: number;
  X: number;
  Y: number;
  Z: number;
  SpriteNum: number;
}

const smallById = new Map(smallmaps.map((m) => [m.id, m]));
/** Tile base del small map en (x,y,z). z del .NPC usa 0xFF para el sótano (→ -1). */
function baseTile(loc: number, z: number, x: number, y: number): number | null {
  const m = smallById.get(loc);
  if (!m) return null;
  const fz = z === 0xff ? -1 : z;
  const f = m.floors.find((fl) => fl.z === fz);
  if (!f) return null;
  return f.tiles[y]?.[x] ?? null;
}

/** Tile del atlas para un slot-objeto: chest/prop = type+0x100; el clasificador
 *  cubre 1 (chest 257), 14/27/30 (props) y 0xB5/0xB6 (plot: corona 437/cetro 438
 *  = type+0x100). Todos resuelven por type+0x100 en el atlas de sprites. */
const atlasTile = (type: number) => type + 0x100;

/** Enumera cada slot-objeto (clasificado) con TODAS sus posiciones de horario. */
function objectSlotPlacements(): {
  loc: number;
  slot: number;
  type: number;
  kind: string;
  x: number;
  y: number;
  z: number;
}[] {
  const out = [];
  for (const [locStr, slots] of Object.entries(npcs)) {
    const loc = Number(locStr);
    for (const s of slots) {
      if (s.slot === 0) continue;
      const kind = npcSlotObjectKind(s.type);
      if (!kind) continue;
      const seen = new Set<string>();
      for (let i = 0; i < s.x.length; i++) {
        const key = `${s.x[i]},${s.y[i]},${s.z[i]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ loc, slot: s.slot, type: s.type, kind, x: s.x[i]!, y: s.y[i]!, z: s.z[i]! });
      }
    }
  }
  return out;
}

describe("F1.12 linter de invariantes de assets", () => {
  it("INV-1 · todo slot-objeto del .NPC cae sobre un tile base transitable (anti-TREASURY_CHESTS)", () => {
    // Raíz del bug: TREASURY_CHESTS hardcodeaba coords y 3/8 caían en StoneBrickWall
    // → muro roto (scout-inverse-audit §Top-10 #2). Sustituido por slots-objeto del
    // .NPC (task #3); esta invariante impide que un slot-objeto nazca dentro de un muro.
    const offenders: string[] = [];
    for (const p of objectSlotPlacements()) {
      const t = baseTile(p.loc, p.z, p.x, p.y);
      if (t === null) continue; // planta/coord fuera de rango: otra invariante lo cubriría
      if (!tileData[String(t)]?.IsWalking_Passable) {
        offenders.push(
          `loc${p.loc} slot${p.slot} ${p.kind}(type ${p.type}) @(${p.x},${p.y},z${p.z}) → base tile ${t} ${tileData[String(t)]?.Name}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("INV-2 · todo tipo-objeto reconocido es Look-describible y NO es tile de persona/enemigo (raíz #F13-2)", () => {
    // #F13-2: el atajo look()→"citizen" describía un cofre-NPC como persona. El fix
    // (task #4) describe el TILE por LOOK2.DAT. A nivel de dato: cada tipo-objeto debe
    // resolver a un tile con descripción look2 y sin flag IsNPC/IsEnemy (es un objeto).
    const OBJECT_TYPES = [1, 14, 27, 30, 0xb5, 0xb6]; // set del clasificador npcSlotObjectKind
    const bad: string[] = [];
    for (const type of OBJECT_TYPES) {
      expect(npcSlotObjectKind(type)).not.toBeNull(); // el set del test == el del código
      const tile = atlasTile(type);
      const row = tileData[String(tile)];
      const desc = look2[tile];
      if (!desc || desc.trim() === "" || desc === "*") bad.push(`type ${type} tile ${tile}: look2 vacío (${JSON.stringify(desc)})`);
      if (row?.IsNPC || row?.IsEnemy) bad.push(`type ${type} tile ${tile}: flag IsNPC/IsEnemy (no es objeto)`);
    }
    expect(bad).toEqual([]);
  });

  it("INV-3 · ningún cofre (tile IsOpenable) queda sin clasificar como objeto (huérfano → 'citizen')", () => {
    // Guarda del PATRÓN #F13-2 hacia el futuro: si un .NPC nuevo trae un slot cuyo tile
    // es abrible (cofre) pero el clasificador NO lo reconoce, caería en la rama NPC.
    const orphans: string[] = [];
    for (const [locStr, slots] of Object.entries(npcs)) {
      for (const s of slots) {
        if (s.slot === 0 || s.type === 0) continue;
        const row = tileData[String(atlasTile(s.type))];
        if (row?.IsOpenable && !npcSlotObjectKind(s.type)) {
          orphans.push(`loc${locStr} slot${s.slot} type ${s.type} (tile ${atlasTile(s.type)} ${row.Name}) abrible pero sin clasificar`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it("INV-4 · el censo derivado de slots-objeto (npc-object-actors.md) sigue presente", () => {
    // El censo byte-a-byte de CASTLE/TOWNE/DWELLING/KEEP.NPC (re/notes/npc-object-actors.md):
    // los 3 cofres del sótano de LB + caja de sándalo + corona (Blackthorn) + cetro (Stonegate).
    // Regresión: si una edición del .NPC borra o mueve estos slots, salta.
    const CENSUS = [
      { loc: 17, slot: 23, type: 1 }, // cofre sótano LB
      { loc: 17, slot: 24, type: 1 },
      { loc: 17, slot: 25, type: 1 },
      { loc: 17, slot: 31, type: 14 }, // caja de sándalo
      { loc: 18, slot: 1, type: 0xb5 }, // corona
      { loc: 29, slot: 9, type: 0xb6 }, // cetro
    ];
    for (const c of CENSUS) {
      const slot = npcs[String(c.loc)]?.find((s) => s.slot === c.slot);
      expect(slot, `loc${c.loc} slot${c.slot} debe existir`).toBeDefined();
      expect(slot!.type, `loc${c.loc} slot${c.slot} type`).toBe(c.type);
      expect(npcSlotObjectKind(slot!.type)).not.toBeNull();
    }
  });

  it("INV-5 · todo TileOverride referencia un SpriteNum real y coords no-negativas", () => {
    // Guarda contra un override fabricado/typo (SpriteNum inexistente o coord basura).
    const bad: string[] = [];
    for (const [region, rows] of Object.entries(overrides)) {
      for (const r of rows) {
        if (!tileData[String(r.SpriteNum)]) bad.push(`${region} (${r.X},${r.Y}) SpriteNum ${r.SpriteNum} inexistente`);
        if (!Number.isInteger(r.X) || !Number.isInteger(r.Y) || r.X < 0 || r.Y < 0) bad.push(`${region} coord inválida (${r.X},${r.Y})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("INV-6 · las tablas de DATA.OVL conservan sus particiones derivadas", () => {
    // Longitudes fijas del binario (shrines.md, gypsy.md, F1.10-T1 tabla de shards 0x3a06).
    expect((data.shards as unknown[]).length).toBe(3); // Falsehood/Hatred/Cowardice
    expect((data.virtues as unknown[]).length).toBe(8);
    expect((data.mantras as unknown[]).length).toBe(8);
    expect((data.shrineX as unknown[]).length).toBe(8);
    expect((data.shrineY as unknown[]).length).toBe((data.shrineX as unknown[]).length);
    expect((data.reagents as unknown[]).length).toBe(8);
    expect((data.virtueMantraIndex as unknown[]).length).toBe(32);
  });
});
