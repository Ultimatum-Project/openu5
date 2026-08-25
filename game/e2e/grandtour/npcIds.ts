/**
 * Grand Tour — resolución NPC vivo → id del manifiesto (F3, ch02+).
 *
 * El manifiesto ata cada NPC conversable por (categoría TLK, npcIndex, nombre):
 * `npc-<cat>-<npcIndex>-<slug(nombre)>` (ver manifest.gen.mjs §6). El NPC VIVO del port
 * lleva su `dialogNumber`, que es el índice de su registro en el .TLK de la localización
 * — y ese índice COINCIDE con el `npcIndex` del manifiesto. VERIFICADO en dos categorías:
 *   · "castle": loc 17 dialogs 1/2/3/9 → Alistair the Bard / Stephen / Treanna / Chuckles (ch02).
 *   · "towne":  loc 2 (Britain) dialogs 6..12 → Greyson/Justin/Eb/Terrance/Telila/Gwenno/Annon (ch03).
 * Cada capítulo lo re-comprueba de facto: si el id resuelto no existe en el manifiesto, la
 * guarda de `Coverage.mark` LANZA — así una categoría con índice divergente se caza al correr.
 * Este módulo hace el puente de DATOS para marcar cobertura de NPC sin cablear nada a mano.
 *
 * CATEGORÍA por localización: los small maps se sirven de uno de los 4 .TLK agrupados
 * por tipo (towne/castle/dwelling/keep). El capítulo declara la categoría de su
 * localización (LB Castle y el Palacio de Blackthorn = "castle").
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "..", "assets", "talk");

export type TlkCategory = "towne" | "castle" | "dwelling" | "keep";

interface TalkRecord {
  npcIndex: number;
  name?: Array<{ kind: string; text?: string }>;
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const cache = new Map<TlkCategory, TalkRecord[]>();
function records(cat: TlkCategory): TalkRecord[] {
  let recs = cache.get(cat);
  if (!recs) {
    recs = JSON.parse(readFileSync(join(ASSETS, `${cat}.json`), "utf8").replace(/^﻿/, "")) as TalkRecord[];
    cache.set(cat, recs);
  }
  return recs;
}

/** Nombre humano de un registro TLK (concatena los trozos de texto de `name`). */
function recordName(rec: TalkRecord): string {
  return (rec.name ?? [])
    .filter((s) => s.kind === "text")
    .map((s) => s.text ?? "")
    .join("")
    .trim();
}

/**
 * Id del manifiesto para el NPC `npcIndex` de la categoría `cat` (== `dialogNumber` del
 * NPC vivo en las localizaciones de tipo castillo). Lanza si el registro no existe o no
 * tiene nombre (no conversable) — así una cobertura de NPC mal resuelta falla en vez de
 * inventar un id.
 */
export function npcManifestId(cat: TlkCategory, npcIndex: number): string {
  const rec = records(cat).find((r) => r.npcIndex === npcIndex);
  if (!rec) throw new Error(`npcManifestId: sin registro npcIndex=${npcIndex} en ${cat}.json`);
  const name = recordName(rec);
  if (!name) throw new Error(`npcManifestId: registro npcIndex=${npcIndex} (${cat}) sin nombre`);
  return `npc-${cat}-${npcIndex}-${slug(name)}`;
}
