/**
 * MEDIDA (no aserto de conducta todavía): estado del corpus del espejo frente al gate
 * `fresh` de `town_load_map` (TOWN.OVL:0x11F0). Acta: re/notes/npc-carga-partida-fresh-gate.md.
 *
 * Lo que mide: para cada semilla de `game/e2e/espejo-tour/saves/`, cuántos NPC pinta el
 * port HOY al cargarla por la vía nativa (`importNativeSave` + `enterMap(loc,state,true)`,
 * que es exactamente la cadena de `__u5test.loadNativeSave` → `applyLoadedState`,
 * main.ts:3580/3516).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { importNativeSave, type SaveSidecar } from "../src/core/saveNative.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { describeSiViaja } from "./assets-opcionales.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(HERE, "../assets");
const SAVES = resolve(HERE, "../e2e/espejo-tour/saves");
/** Material que NO viaja al repositorio público: los assets extraídos y el corpus de
 *  semillas del espejo. Rutas relativas a la RAÍZ, como la whitelist del génesis. */
const NO_VIAJA = ["game/assets/npcs.json", "game/e2e/espejo-tour/saves"] as const;

// 🔴 PEREZOSO, no de módulo: `test:pure` corre este fichero en el árbol PÚBLICO, donde
// `assets/` y `saves/` no existen. Un `readFileSync` en carga de módulo tira el fichero
// ENTERO al importarlo y `describeSiViaja` ya no llega a saltarlo.
let _npcData: Record<number, NpcSlot[]> | null = null;
const npcs = (): Record<number, NpcSlot[]> =>
  (_npcData ??= JSON.parse(readFileSync(`${ASSETS}/npcs.json`, "utf-8")) as Record<number, NpcSlot[]>);

/** Offsets de la banda de NPC dentro de la ventana de 4192 B (acta §3.3). */
const BANDA = {
  objeto: 0x6b4, // 32 × 8   — registro-objeto DS:0x5C5A (slot 0 = transporte, se excluye)
  horario: 0x7b8, // 32 × 16 — DS:0x5D5E
  viva: 0x9b8, // 32 × 16   — DS:0x5F5E
  tipos: 0xff8, // 32 × 1   — DS:0x659E
} as const;

function bandaACero(gam: Uint8Array): boolean {
  const cero = (off: number, len: number): boolean => {
    for (let i = 0; i < len; i++) if (gam[off + i] !== 0) return false;
    return true;
  };
  return (
    cero(BANDA.objeto + 8, 31 * 8) && // slots 1..31: el 0 es el transporte y nunca es cero
    cero(BANDA.horario, 32 * 16) &&
    cero(BANDA.viva, 32 * 16) &&
    cero(BANDA.tipos, 32)
  );
}

interface Medida {
  part: string;
  loc: number;
  hour: number;
  bandaCero: boolean;
  npcWalkEnSidecar: boolean;
  /** NPC vivos en TODO el mapa tras la carga (todas las plantas). */
  pintaHoy: number;
  /** …y los de la planta del jugador, que son los que se VEN. */
  pintaPlanta: number;
}

function medir(part: string): Medida {
  const gam = new Uint8Array(readFileSync(`${SAVES}/${part}.gam`));
  const sidecar = JSON.parse(readFileSync(`${SAVES}/${part}.sidecar.json`, "utf-8")) as SaveSidecar;
  const state = importNativeSave(gam, sidecar);
  const mgr = new NpcManager(npcs());
  const loc = state.position.location;
  if (loc !== 0) mgr.enterMap(loc, state, true);
  return {
    part,
    loc,
    hour: state.time.hour,
    bandaCero: bandaACero(gam),
    npcWalkEnSidecar:
      (sidecar.gameState as unknown as Record<string, unknown>).npcWalk !== undefined,
    pintaHoy: loc === 0 ? 0 : (state.npcWalk?.slots.length ?? 0),
    pintaPlanta: loc === 0 ? 0 : mgr.npcsAt(loc, state.position.floor).length,
  };
}

const partes = (): string[] =>
  readdirSync(SAVES)
    .filter((f) => f.endsWith(".gam"))
    .map((f) => f.slice(0, -4))
    .sort();

describeSiViaja(NO_VIAJA, "gate `fresh` — medida del corpus del espejo", () => {
  it("MEDIDA: censo completo de las 49 semillas", () => {
    const PARTES = partes();
    expect(PARTES.length).toBe(49);
    const m = PARTES.map(medir);
    const enPueblo = m.filter((x) => x.loc !== 0);
    const sostenidas = enPueblo.filter((x) => x.bandaCero && x.pintaHoy > 0);
    // La TABLA sólo bajo env: este fichero corre dentro de la batería de aterrizaje, que es
    // salida COMPARTIDA — un censo de 7 líneas en cada corrida ajena es ruido. El ASERTO
    // (abajo, y el de las siete en `npc-gate-carga-fresh.test.ts`) es lo que vigila; esto es
    // para leerlo a mano:  U5_CENSO_NPC=1 npx vitest run tests/npc-gate-carga-medida.test.ts
    // eslint-disable-next-line no-console
    if (process.env.U5_CENSO_NPC === "1") console.log(
      "\nSEMILLAS EN MAPA POBLADO (loc≠0):\n" +
        enPueblo
          .map(
            (x) =>
              `  ${x.part.padEnd(8)} loc=${String(x.loc).padStart(2)} h=${String(x.hour).padStart(2)} ` +
              `bandaCero=${x.bandaCero ? "SI" : "no"} npcWalk=${x.npcWalkEnSidecar ? "SI" : "no"} ` +
              `pintaHOY=${String(x.pintaHoy).padStart(2)} de los que ${String(x.pintaPlanta).padStart(2)} en la planta del jugador`,
          )
          .join("\n") +
        `\n  TOTAL en pueblo: ${enPueblo.length} · sostenidas por la divergencia: ${sostenidas.length}` +
        ` [${sostenidas.map((x) => x.part).join(", ")}]\n`,
    );
    expect(sostenidas.length).toBeGreaterThan(0);
  });

  it("CONTROL: ninguna semilla del corpus lleva `npcWalk` en su sidecar", () => {
    // No es un accidente del corpus: `extractSidecar` (saveNative.ts:1010) NO lo extrae y
    // `SaveSidecar` (saveNative.ts:224) no tiene el campo ⇒ la vía .GAM+sidecar NO PUEDE
    // transportarlo. Control positivo abajo, para que este cero no sea vacuo.
    const con = partes().map(medir).filter((x) => x.npcWalkEnSidecar);
    expect(con.map((x) => x.part)).toEqual([]);
  });

  it("CONTROL POSITIVO del predicado de arriba: un sidecar CON npcWalk se detecta", () => {
    const gam = new Uint8Array(readFileSync(`${SAVES}/part07.gam`));
    const sidecar = JSON.parse(readFileSync(`${SAVES}/part07.sidecar.json`, "utf-8")) as SaveSidecar;
    (sidecar.gameState as unknown as Record<string, unknown>).npcWalk = { location: 5, slots: [] };
    expect((sidecar.gameState as unknown as Record<string, unknown>).npcWalk).toBeDefined();
    const state = importNativeSave(gam, sidecar);
    // Y además: `importNativeSave` lo IGNORA (no está en la lista de `copy`) ⇒ el estado
    // resultante no lo lleva. Ésa es la razón estructural del cero de arriba.
    expect((state as unknown as Record<string, unknown>).npcWalk).toBeUndefined();
  });

  it("el fichero de semillas está presente (guarda de la REGLA 2)", () => {
    expect(existsSync(`${SAVES}/part07.gam`)).toBe(true);
  });
});
