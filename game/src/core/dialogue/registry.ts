/**
 * Registro de scripts TLK por location: resuelve el fichero master
 * (TOWNE/DWELLING/CASTLE/KEEP) y el npcIndex (== dialogNumber del .NPC).
 */
import type { TalkScript } from "./conversation.js";

export type MasterFile = "towne" | "dwelling" | "castle" | "keep";

/** Locations 1-8=TOWNE, 9-16=DWELLING, 17-24=CASTLE, 25-32=KEEP (docs/formats/maps.md). */
export function masterForLocation(location: number): MasterFile | null {
  if (location >= 1 && location <= 8) return "towne";
  if (location >= 9 && location <= 16) return "dwelling";
  if (location >= 17 && location <= 24) return "castle";
  if (location >= 25 && location <= 32) return "keep";
  return null;
}

export class TalkScriptRegistry {
  private byMaster: Record<MasterFile, Map<number, TalkScript>>;

  constructor(files: Record<MasterFile, TalkScript[]>) {
    this.byMaster = {
      towne: new Map(files.towne.map((s) => [s.npcIndex, s])),
      dwelling: new Map(files.dwelling.map((s) => [s.npcIndex, s])),
      castle: new Map(files.castle.map((s) => [s.npcIndex, s])),
      keep: new Map(files.keep.map((s) => [s.npcIndex, s])),
    };
  }

  get(location: number, dialogNumber: number): TalkScript | null {
    const master = masterForLocation(location);
    if (!master) return null;
    return this.byMaster[master].get(dialogNumber) ?? null;
  }
}
