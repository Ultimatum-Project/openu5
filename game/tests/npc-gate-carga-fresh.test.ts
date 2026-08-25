/**
 * PUERTA #D1 — el gate `fresh` de `town_load_map` (TOWN.OVL:0x11F0) en la carga de partida.
 * Sujeto: `src/core/npc/carga-fiel.ts` + las dos piezas que gobierna (`saveNative.ts`
 * extractSidecar/importNativeSave y `npc/manager.ts` enterMap).
 * Acta: `re/notes/npc-carga-partida-fresh-gate.md` (§1 el crudo del gate, §2 el censo de
 * llamadores, §4 el par causal A⇄E3 en DOSBox, §8 las siete semillas).
 *
 * QUÉ ATA ESTE FICHERO — el CICLO COMPLETO, en tres brazos sobre las MISMAS semillas reales:
 *   A (puerta cerrada, semilla original)  → re-deriva por horario  = la conducta de HOY
 *   B (puerta abierta, semilla original)  → CERO NPC               = el binario con la
 *                                                                     ventana vacía
 *   C (puerta abierta, semilla MIGRADA)   → la lista de A, campo a campo
 *
 * ★ El brazo B NO es decorado: es el CONTROL POSITIVO de C. Sin él, «C == A» se sostendría
 * igual con la puerta desconectada, y el aserto pasaría con el código roto — la clase
 * [[el-testigo-elegido-hace-pasar-al-aserto-con-el-codigo-roto]]. B instancia la diferencia
 * DONDE EXISTE, y por eso el fichero exige que B ≠ A con cifras.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  exportNativeSave,
  importNativeSave,
  type SaveSidecar,
} from "../src/core/saveNative.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { cargaFielActiva, setCargaFiel } from "../src/core/npc/carga-fiel.js";
import type { GameState } from "../src/core/state.js";
import { describeSiViaja } from "./assets-opcionales.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(HERE, "../assets");
const SAVES = resolve(HERE, "../e2e/espejo-tour/saves");
/** Material que NO viaja al repositorio público: los assets extraídos y el corpus de
 *  semillas del espejo. Rutas relativas a la RAÍZ, como la whitelist del génesis. */
const NO_VIAJA = ["game/assets/npcs.json", "game/e2e/espejo-tour/saves"] as const;

// PEREZOSO por la misma razón que en `npc-gate-carga-medida`: en el árbol público este
// fichero se IMPORTA y sólo después se salta.
let _npcData: Record<number, NpcSlot[]> | null = null;
const npcData = (): Record<number, NpcSlot[]> =>
  (_npcData ??= JSON.parse(readFileSync(`${ASSETS}/npcs.json`, "utf-8")) as Record<number, NpcSlot[]>);

/** Las siete y su cardinal MEDIDO (npc-gate-carga-medida.test.ts). En crudo: son el esperado. */
const SIETE: Array<[part: string, loc: number, npcs: number]> = [
  ["ad12", 18, 30],
  ["part03", 17, 25],
  ["part05", 17, 25],
  ["part06", 10, 2],
  ["part07", 5, 14],
  ["part09", 5, 14],
  ["part10", 17, 25],
];

function leer(part: string): { gam: Uint8Array; sidecar: SaveSidecar } {
  return {
    gam: new Uint8Array(readFileSync(join(SAVES, `${part}.gam`))),
    sidecar: JSON.parse(readFileSync(join(SAVES, `${part}.sidecar.json`), "utf-8")) as SaveSidecar,
  };
}

/** Carga una semilla como lo hace `__u5test.loadNativeSave` → `applyLoadedState` (main.ts). */
function cargar(part: string, sidecarOverride?: SaveSidecar): GameState {
  const { gam, sidecar } = leer(part);
  const state = importNativeSave(gam, sidecarOverride ?? sidecar);
  const loc = state.position.location;
  if (loc !== 0) new NpcManager(npcData()).enterMap(loc, state, true);
  return state;
}

/** La lista viva, normalizada y ordenada por slot — la unidad de comparación de A vs C. */
function banda(state: GameState): string {
  const w = state.npcWalk;
  if (!w) return "SIN-npcWalk";
  return JSON.stringify(
    [...w.slots].sort((a, b) => a.slot - b.slot).map((s) => ({ ...s, pathBuf: s.pathBuf.join(",") })),
  );
}

/** Migra en MEMORIA (no toca disco): lo mismo que `tools/migra-npcwalk.ts` escribe. */
function sidecarMigrado(part: string): SaveSidecar {
  const prev = setCargaFiel(false);
  try {
    const state = cargar(part);
    const { sidecar } = leer(part);
    (sidecar.gameState as unknown as Record<string, unknown>).npcWalk = state.npcWalk;
    return sidecar;
  } finally {
    setCargaFiel(prev);
  }
}

afterEach(() => setCargaFiel(false));

describeSiViaja(NO_VIAJA, "PUERTA #D1 — el gate `fresh` de la carga de partida", () => {
  it("la puerta nace CERRADA (lo que hay en main)", () => {
    expect(cargaFielActiva()).toBe(false);
  });

  it("BRAZO A — puerta cerrada: las siete semillas re-derivan, con su cardinal en crudo", () => {
    setCargaFiel(false);
    const medido = SIETE.map(([p]) => {
      const s = cargar(p);
      return [p, s.position.location, s.npcWalk?.slots.length ?? 0] as [string, number, number];
    });
    expect(medido).toEqual(SIETE);
  });

  it("BRAZO B (CONTROL POSITIVO) — puerta abierta y semilla SIN migrar: cero NPC en las siete", () => {
    setCargaFiel(true);
    const medido = SIETE.map(([p]) => [p, cargar(p).npcWalk?.slots.length ?? 0] as [string, number]);
    expect(medido).toEqual(SIETE.map(([p]) => [p, 0]));
    // …y la diferencia contra A es REAL en las siete (ninguna tenía 0 NPC de partida: si
    // alguna los tuviera, este fichero estaría midiendo un sujeto que no puede cambiar).
    expect(SIETE.every(([, , n]) => n > 0)).toBe(true);
  });

  it("BRAZO C — puerta abierta y semilla MIGRADA: la lista de A, campo a campo", () => {
    for (const [part] of SIETE) {
      setCargaFiel(false);
      const esperado = banda(cargar(part));
      const migrado = sidecarMigrado(part);
      setCargaFiel(true);
      expect(banda(cargar(part, migrado)), `${part}: la migración NO preserva la conducta`).toBe(
        esperado,
      );
    }
  });

  it("BRAZO D — la restauración LEE el fichero: una banda perturbada gana a la derivación", () => {
    // 🔴 POR QUÉ HACE FALTA ESTE BRAZO. En C los valores migrados son IGUALES a los
    // derivados por construcción, así que C pasaría igual con la restauración de posición
    // ROTA (quitar `rt.x = w.x` no movería una cifra). C acredita «la migración no cambia la
    // conducta», que es lo que se quiere probar, pero NO acredita «la carga lee el fichero».
    // Aquí se instancia la diferencia donde existe: se mueve un NPC en el sidecar y se exige
    // que la carga lo devuelva MOVIDO. Sin esto, la mitad de lectura del ciclo no está atada.
    const migrado = sidecarMigrado("part07");
    const walk = (migrado.gameState as unknown as Record<string, unknown>).npcWalk as {
      location: number;
      slots: Array<{ slot: number; x: number; y: number; state: number; stuck: number }>;
    };
    const victima = walk.slots[0]!;
    const original = { x: victima.x, y: victima.y, state: victima.state, stuck: victima.stuck };
    victima.x = (original.x + 3) & 0x1f;
    victima.y = (original.y + 5) & 0x1f;
    victima.state = 2;
    victima.stuck = 7;
    walk.slots.splice(1, 1); // …y un slot VACIADO (npc_clear_slot) no revive con la carga

    setCargaFiel(true);
    const state = cargar("part07", migrado);
    expect(state.npcWalk?.slots.length, "el slot descartado revivió").toBe(13);
    const vuelto = state.npcWalk!.slots.find((s) => s.slot === victima.slot)!;
    expect([vuelto.x, vuelto.y, vuelto.state, vuelto.stuck]).toEqual([
      victima.x,
      victima.y,
      2,
      7,
    ]);
    // …y la perturbación era REAL (si el derivado ya valiera eso, el aserto sería vacuo).
    expect([vuelto.x, vuelto.y]).not.toEqual([original.x, original.y]);
  });

  it("el transporte está GOBERNADO por la puerta en las dos direcciones (escritura y lectura)", () => {
    const part = "part07";
    setCargaFiel(false);
    const state = cargar(part);
    expect(state.npcWalk?.slots.length).toBe(14);
    const { gam } = leer(part);

    // ESCRITURA: cerrada no escribe el campo; abierta sí.
    setCargaFiel(false);
    expect(
      (exportNativeSave(state, gam).sidecar.gameState as unknown as Record<string, unknown>).npcWalk,
    ).toBeUndefined();
    setCargaFiel(true);
    const conCampo = exportNativeSave(state, gam).sidecar;
    expect((conCampo.gameState as unknown as Record<string, unknown>).npcWalk).toBeDefined();

    // LECTURA: con la puerta CERRADA una semilla migrada es INERTE — nadie la lee, y el port
    // re-deriva como hoy. Ésta es la propiedad que permite migrar el corpus sin mover `main`.
    setCargaFiel(false);
    expect((importNativeSave(gam, conCampo) as unknown as Record<string, unknown>).npcWalk).toBeUndefined();
    setCargaFiel(true);
    expect((importNativeSave(gam, conCampo) as unknown as Record<string, unknown>).npcWalk).toBeDefined();
  });

  it("la AUSENCIA se escribe EXPLÍCITA (`null`), o el `Object.assign` del load la pierde", () => {
    // Los dos cargadores hacen `Object.assign(game.state, loaded)` (main.ts:3516 y :582), que
    // copia propiedades PROPIAS. Si `importNativeSave` deja `npcWalk` simplemente ausente, el
    // de la partida VIVA sobrevive al assign y `enterMap(…, restore=true)` lo restaura
    // creyéndolo del save: cargar un save sin banda estando en el mismo pueblo resucitaría los
    // NPC de la sesión anterior — lo contrario del gate.
    const { gam, sidecar } = leer("part07"); // sidecar SIN npcWalk
    setCargaFiel(true);
    const cargado = importNativeSave(gam, sidecar);
    expect(Object.prototype.hasOwnProperty.call(cargado, "npcWalk")).toBe(true);
    expect(cargado.npcWalk).toBeNull();

    // …y el efecto que motiva el aserto, instanciado: una partida VIVA con banda propia,
    // sobre la que se carga esa semilla, se queda vacía en vez de heredar la vieja.
    setCargaFiel(false);
    const viva = cargar("part07"); // 14 NPC en loc 5, la sesión "anterior"
    expect(viva.npcWalk?.slots.length).toBe(14);
    setCargaFiel(true);
    Object.assign(viva, importNativeSave(gam, sidecar));
    new NpcManager(npcData()).enterMap(viva.position.location, viva, true);
    expect(viva.npcWalk?.slots.length ?? 0, "la banda de la sesión anterior sobrevivió").toBe(0);
  });

  it("ida y vuelta con la puerta abierta: exportar y re-importar conserva la banda", () => {
    setCargaFiel(false);
    const vivo = cargar("part07");
    const esperado = banda(vivo);
    setCargaFiel(true);
    const { gam, sidecar } = exportNativeSave(vivo, leer("part07").gam);
    const vuelto = importNativeSave(gam, sidecar);
    new NpcManager(npcData()).enterMap(vuelto.position.location, vuelto, true);
    expect(banda(vuelto)).toBe(esperado);
  });

  it("la puerta NO toca la ENTRADA a mapa (`restore=false`), que en el binario es `fresh=1`", () => {
    // Los tres llamadores constantes de `town_load_map` pasan 1 (acta §2): entrar a un mapa
    // SIEMPRE lee el .NPC y activa. Si la puerta tocara esta vía, entrar a un pueblo dejaría
    // de poblarlo — que es el bug que la ficha #D1 NO describe.
    const { gam, sidecar } = leer("part07");
    for (const abierta of [false, true]) {
      setCargaFiel(abierta);
      const state = importNativeSave(gam, sidecar);
      const mgr = new NpcManager(npcData());
      mgr.enterMap(state.position.location, state, false); // fresh = 1
      expect(state.npcWalk?.slots.length, `entrada al mapa con puerta=${abierta}`).toBe(14);
    }
  });

  it("SELLO DEL HUECO: el CONSTRUCTOR de Game también pasa `restore=true` — la puerta lo vacía", () => {
    // 🔴 HUECO CONOCIDO, sellado aquí para que quien active la puerta TENGA que responderlo.
    // `Game`'s constructor (game.ts:1031) puebla la location con `restore=true` «si ya estamos
    // en un small map al construir». Ese sitio atiende DOS casos que no puede distinguir:
    //   · estado venido de un SAVE  → `fresh=0`: vaciar es lo FIEL.
    //   · estado FRESCO o sintético (arneses, deep-link `?loc=5&x=…`) → eso es una ENTRADA a
    //     mapa, o sea `fresh=1`: vaciar sería un BUG, y el pueblo saldría desierto.
    // Con la puerta cerrada da igual (re-deriva en los dos). Abierta, no: el deep-link a un
    // pueblo se queda sin NPC. No lo arreglo a ciegas —«de un save» no es una propiedad que el
    // constructor pueda leer, y elegir por él sería inventar el criterio— y no lo dejo mudo:
    // este aserto FIJA la conducta de hoy y enrojece el día que alguien la cambie sin decirlo.
    // Va en el §6 del acta como paso obligatorio del plan de activación.
    const { gam, sidecar } = leer("part07");
    setCargaFiel(true);
    const state = importNativeSave(gam, sidecar);
    const mgr = new NpcManager(npcData());
    mgr.enterMap(state.position.location, state, true); // lo que hace el constructor
    expect(state.npcWalk?.slots.length ?? 0).toBe(0);
    // El mismo estado por la vía de ENTRADA sí puebla: el hueco es del ARGUMENTO, no del gate.
    mgr.enterMap(state.position.location, state, false);
    expect(state.npcWalk?.slots.length ?? 0).toBe(14);
  });

  it("`setCargaFiel` devuelve el valor ANTERIOR (contrato del arnés)", () => {
    setCargaFiel(false);
    expect(setCargaFiel(true)).toBe(false);
    expect(setCargaFiel(false)).toBe(true);
  });
});
