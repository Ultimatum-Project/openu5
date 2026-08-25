/**
 * GRAND TOUR — CAPÍTULO 1: creación por la gitana (spec §2, checkpoint del §2 tabla).
 *
 * Recorre la CREACIÓN COMPLETA de forma determinista y cierra el PRIMER checkpoint del
 * tour: el `SAVED.GAM` nativo del que arranca ch02. Es el PATRÓN de los 18 capítulos
 * siguientes (creación → juego determinista → asserts contra el binario → export del
 * checkpoint → cobertura declarada).
 *
 * DETERMINISMO Y AUTORIDAD DE VALORES. Respuestas fijas all-A; los stats resultantes
 * son el bracket determinista seed-0 re-derivado del binario en `re/verified/gypsy.md`
 * (all-A → STR 20 / DEX 18 / INT 22 / MP 22; HP/level intactos de INIT.GAM; suelo STR
 * 20 en FONT 0x0dda). El checkpoint del §2 (roster[0] STR=20, karma inicial, pos
 * Iolo's Hut 13/15/15) se asserta tanto en el estado vivo como en los BYTES del .GAM
 * exportado (offsets de `saveNative.serializeCharacter`).
 *
 * PIEL. La creación se juega por el carril DOM (piel dev), que es el camino
 * determinista y driveable del cuestionario; el resultado —el ESTADO del personaje y
 * su checkpoint nativo— es INDEPENDIENTE de la piel (los stats salen del core
 * `applyGypsyCreation`, no del render). La fidelidad VISUAL de la cinemática fiel 1988
 * de creación es un eje aparte (píxel-diff, task #26), ortogonal a este checkpoint de
 * estado.
 *
 * SEED. Tras crear, se normaliza el RNG del mundo a seed 0 (`__u5test.reseed(0)`, el
 * stream unificado F1.1) para que el encadenado ch02+ sea determinista. El propio
 * `g_rng_seed` NO viaja en el .GAM (excluido del espejo por #17); reseed sólo fija el
 * punto de partida del siguiente capítulo.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCharacter, gotoGame, readState } from "../helpers";
import { exportCheckpoint, SAVES_DIR } from "./fixture";
import { charFieldOff, PARTY, SAVED_GAM_SIZE } from "./offsets";
import { Coverage } from "./coverage";

const ALL_A: Array<"A" | "B"> = ["A", "A", "A", "A", "A", "A", "A"];

interface Pos {
  location: number;
  floor: number;
  x: number;
  y: number;
}

// Bytes clave del checkpoint dentro del SAVED.GAM. Los offsets salen del módulo
// compartido `offsets.ts` (fuente única alineada con saveNative.ts) — el Avatar es
// roster[0]. El round-trip byte-exacto de abajo es la guarda de que siguen casando.
const OFF = {
  gender: charFieldOff(0, "gender"),
  strength: charFieldOff(0, "strength"),
  dexterity: charFieldOff(0, "dexterity"),
  intelligence: charFieldOff(0, "intelligence"),
  mp: charFieldOff(0, "mp"),
  karma: PARTY.karma,
  location: PARTY.location,
  floor: PARTY.floor,
  x: PARTY.x,
  y: PARTY.y,
} as const;

test.describe.serial("GT ch01 — creación por la gitana (all-A, seed-0)", () => {
  test("crea el Avatar con los stats exactos del bracket y exporta el checkpoint de Iolo's Hut", async ({
    page,
  }) => {
    await createCharacter(page, "Avatar", "M", ALL_A);
    await page.evaluate(() => {
      (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0);
    });

    // --- Bracket determinista seed-0 (re/verified/gypsy.md) en el ESTADO vivo ---
    const a = await readState<Record<string, number>>(page, "characters[0]");
    expect(a.strength).toBe(20);
    expect(a.dexterity).toBe(18);
    expect(a.intelligence).toBe(22);
    expect(a.currentMp).toBe(22); // MP = INT (FONT 0x0dce)
    expect(a.currentHp).toBe(60); // intacto de INIT.GAM (la gitana no toca HP)
    expect(a.maxHp).toBe(60);
    expect(a.level).toBe(2);
    expect(await readState<string>(page, "characters[0].name")).toBe("Avatar");
    expect(await readState<number>(page, "characters[0].gender")).toBe(0x0b); // 'M' (FONT 0x0be8)

    // --- Checkpoint del §2: karma inicial + posición Iolo's Hut (13, 15, 15) ---
    expect(await readState<number>(page, "karma")).toBe(75); // INIT.GAM 0x2e2
    const pos = await readState<Pos>(page, "position");
    expect(pos).toMatchObject({ location: 13, floor: 0, x: 15, y: 15 });

    // --- Export del checkpoint nativo (camino real: botón "Export .GAM") ---
    const { gam } = await exportCheckpoint(page, "ch01");
    expect(gam.length).toBe(SAVED_GAM_SIZE);

    // El .GAM exportado REFLEJA el checkpoint byte a byte (no sólo el estado vivo):
    expect(gam[OFF.strength]).toBe(20);
    expect(gam[OFF.dexterity]).toBe(18);
    expect(gam[OFF.intelligence]).toBe(22);
    expect(gam[OFF.mp]).toBe(22);
    expect(gam[OFF.gender]).toBe(0x0b);
    expect(gam[OFF.karma]).toBe(75);
    expect(gam[OFF.location]).toBe(13);
    expect(gam[OFF.floor]).toBe(0);
    expect(gam[OFF.x]).toBe(15);
    expect(gam[OFF.y]).toBe(15);
  });

  test("el ch01.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({
    page,
  }) => {
    // Round-trip de fidelidad: cargar el checkpoint por el hook nativo
    // (`loadNativeSave`, el mismo codec #27 que leerá el oráculo) debe reconstruir el
    // Avatar exacto. Prueba que el .GAM es un save de 1988 válido, no un blob del clon.
    await gotoGame(page); // arranca una partida cualquiera para montar el hook DEV
    const gam = readFileSync(join(SAVES_DIR, "ch01.gam"));
    await page.evaluate((bytes) => {
      (window as unknown as { __u5test: { loadNativeSave: (b: number[]) => void } }).__u5test.loadNativeSave(
        bytes,
      );
    }, Array.from(gam));

    const a = await readState<Record<string, number>>(page, "characters[0]");
    expect(a.strength).toBe(20);
    expect(a.dexterity).toBe(18);
    expect(a.intelligence).toBe(22);
    expect(a.currentMp).toBe(22);
    expect(await readState<string>(page, "characters[0].name")).toBe("Avatar");
    expect(await readState<number>(page, "karma")).toBe(75);
    expect(await readState<Pos>(page, "position")).toMatchObject({
      location: 13,
      floor: 0,
      x: 15,
      y: 15,
    });
  });

  test("declara la cobertura del manifiesto (creación: 0 ítems de contenido, documentado)", async () => {
    // La creación por la gitana NO toca contenido enumerable del manifiesto (742 ítems
    // en 25 categorías: localizaciones, NPCs, hechizos, tiendas…). Las 8 virtud-preguntas
    // del torneo están FUERA del manifiesto por diseño (spec §1.1). El valor de ch01 es el
    // CHECKPOINT que siembra ch02 y la corrección del bracket, no cobertura de contenido:
    // se declara explícitamente con 0 ids para que el cierre de ch19 lo contabilice sin
    // ambigüedad.
    const cov = new Coverage("ch01");
    cov.note(
      "Creación por la gitana: no cubre ítems de contenido del manifiesto (742, 25 " +
        "categorías). Las 8 virtud-preguntas del torneo están fuera del manifiesto por " +
        "diseño (spec §1.1). El entregable de ch01 es el checkpoint nativo saves/ch01.gam " +
        "(entrada de ch02) y la corrección del bracket seed-0, no cobertura de contenido.",
    );
    const path = cov.write();
    const written = JSON.parse(readFileSync(path, "utf8")) as {
      chapter: string;
      coveredIds: string[];
      notes: string[];
    };
    expect(written.chapter).toBe("ch01");
    expect(written.coveredIds).toEqual([]);
    expect(written.notes.length).toBeGreaterThan(0);
  });

  test("el guard anti-fabricación de Coverage.mark valida contra el manifiesto real (742) y rechaza ids falsos", () => {
    // Prueba que el mecanismo del PATRÓN (heredado por ch02–ch19) casa con el esquema
    // ACTUAL del manifiesto (array raíz de 742 ítems, fusión daf75d1). Se lee un id REAL
    // del propio fichero (robusto a cambios de esquema/regeneración) y se exige que
    // mark() lo acepte; un id inventado DEBE lanzar. No escribe covered.*.json.
    const manifestPath = join(dirname(fileURLToPath(import.meta.url)), "manifest.json");
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as
      | Array<{ id: string }>
      | { items: Array<{ id: string }> };
    const items = Array.isArray(raw) ? raw : raw.items;
    expect(items.length).toBe(742);
    const realId = items[0]!.id;

    const probe = new Coverage("ch01-guardtest"); // efímero: no se escribe
    expect(() => probe.mark(realId)).not.toThrow();
    expect(() => probe.mark("id-inexistente-fabricado-999")).toThrow(/no existe/i);
  });
});
