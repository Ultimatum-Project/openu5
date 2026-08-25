/**
 * Journey E2E — creación de personaje (el cuestionario de la gitana).
 *
 * Valores EXACTOS verificados contra el binario original (re/verified/gypsy.md,
 * brute-force del bracket seed-0) y confirmados en vivo en la Fase 0
 * (docs/superpowers/specs/2026-07-11-e2e-fase0-findings.md):
 *   - all-A → STR 20 / DEX 18 / INT 22 / MP 22
 *   - all-B → STR 20 / DEX 17 / INT 18 / MP 18
 *   - pregunta 1/7 = par Valor–Sacrificio ("A mighty knight accosts thee…").
 *
 * Rutas de estado REALES (GameState, game/src/core/state.ts, confirmadas en el
 * reporte de Task E2E-2): los personajes cuelgan de `characters[0]` (NO
 * `party.characters[0]`); MP = `currentMp`, HP = `currentHp` (no `mp`/`hp`).
 */
import { test, expect } from "@playwright/test";
import { createCharacter, readState } from "./helpers";

const ALL_A: Array<"A" | "B"> = ["A", "A", "A", "A", "A", "A", "A"];
const ALL_B: Array<"A" | "B"> = ["B", "B", "B", "B", "B", "B", "B"];

test("all-A produce los stats exactos del bracket seed-0 (STR 20/DEX 18/INT 22/MP 22)", async ({
  page,
}) => {
  await createCharacter(page, "Tester", "M", ALL_A);

  const avatar = await readState<Record<string, number>>(page, "characters[0]");
  expect(avatar.strength).toBe(20);
  expect(avatar.dexterity).toBe(18);
  expect(avatar.intelligence).toBe(22);
  expect(avatar.currentMp).toBe(22); // MP = INT (FONT 0x0dce)
  // Intactos de INIT.GAM (la gitana no toca HP/maxHP/nivel):
  expect(avatar.currentHp).toBe(60);
  expect(avatar.maxHp).toBe(60);
  expect(avatar.level).toBe(2);
  // (El nombre y los stats visibles: la ficha Ztats la pinta la piel fiel en su overlay
  // de canvas — el panel DOM `.ztats-member` era sólo-dev, jubilado. Los valores quedan
  // aseverados arriba por estado; el render de la ficha es del eje píxel-diff.)
  expect(await readState<string>(page, "characters[0].name")).toBe("Tester");
});

test("all-B produce el otro extremo exacto (STR 20/DEX 17/INT 18/MP 18)", async ({ page }) => {
  await createCharacter(page, "TesterB", "F", ALL_B);

  const avatar = await readState<Record<string, number>>(page, "characters[0]");
  expect(avatar.strength).toBe(20); // suelo 20 (FONT 0x0dda)
  expect(avatar.dexterity).toBe(17);
  expect(avatar.intelligence).toBe(18);
  expect(avatar.currentMp).toBe(18);

  // El género femenino queda escrito en el registro (0x0C = F, FONT 0x0c16).
  expect(await readState<number>(page, "characters[0].gender")).toBe(0x0c);
});

// Los dos casos que conducían el FORMULARIO DOM de creación de la piel dev — "la
// pregunta 1/7 es Valor–Sacrificio" (leía `.save-panel` de la gitana DOM) y "nombre
// vacío aborta al título" (`.title-create`/`.title-screen`) — se retiraron al jubilar la
// piel dev (fase 2): ese formulario ya no existe (la creación fiel es canvas). El orden
// DETERMINISTA del cuestionario queda ejercitado por los brackets all-A/all-B de arriba
// (que conducen el quiz fiel real vía `createCharacter`); el truncado a 8, abajo.

test("el nombre se trunca a 8 caracteres (maxLength FONT 0x0bc8)", async ({ page }) => {
  await createCharacter(page, "ABCDEFGHIJK", "M", ALL_A);

  const name = await readState<string>(page, "characters[0].name");
  expect(name.length).toBeLessThanOrEqual(8);
  expect(name).toBe("ABCDEFGH");
});
