/**
 * AUDITORÍA G4 + G5 — guardas del soak español (soak-es.mjs), testeadas por
 * unidad vía los helpers puros de e2e/soak/soak-lib.mjs (sin Playwright).
 *
 * G4 (el exit ignoraba el inglés): el exit previo era `anomalies>0 ? 2 : 0` —
 *    50 fugas HARD bajo lang=es → exit 0, verde con el pilar español roto.
 * G5 (detector mortal en silencio): scanSpanish degradaba a no-op si solo
 *    consoleLines se rompía (catch→return) — enTexts=0 indistinguible de sano.
 *
 * DEMOSTRACIÓN (casos que ANTES pasaban y AHORA fallan):
 *  - finalExitCode({anomalies:0, enTextsHard:50}) === 2 (antes el exit era 0).
 *  - scanHeartbeatProblem({actions:500, scannedLines:0}) ≠ null (antes no
 *    existía guarda alguna: el run moría verde).
 * Además, tests de CABLEADO por fuente: soak-es.mjs debe usar estos helpers y
 * contar scannedLines/scanErrors/enTextsHard — si alguien los descablea, rojo.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
// @ts-expect-error módulo .mjs del arnés de soak, sin tipos
import { finalExitCode, scanHeartbeatProblem } from "../e2e/soak/soak-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOAK_ES = readFileSync(join(HERE, "..", "e2e", "soak", "soak-es.mjs"), "utf8");

describe("G4 — el exit del soak cuenta el pilar español", () => {
  it("fugas HARD sin anomalías → exit 2 (ANTES: exit 0, verde en falso)", () => {
    expect(finalExitCode({ anomalies: 0, enTextsHard: 50 })).toBe(2);
    expect(finalExitCode({ anomalies: 0, enTextsHard: 1 })).toBe(2);
  });
  it("anomalías siguen siendo exit 2; run limpio = 0; SOFT no es fallo duro", () => {
    expect(finalExitCode({ anomalies: 3, enTextsHard: 0 })).toBe(2);
    expect(finalExitCode({ anomalies: 0, enTextsHard: 0 })).toBe(0);
    // enTexts (total, incl. SOFT) no decide por sí solo: solo las HARD.
    expect(finalExitCode({ anomalies: 0, enTexts: 7, enTextsHard: 0 })).toBe(0);
  });
});

describe("G5 — heartbeat del detector español", () => {
  it("run con acciones y CERO líneas escaneadas = scan-dead (ANTES: sin guarda)", () => {
    const p = scanHeartbeatProblem({ actions: 500, scannedLines: 0, scanErrors: 12 });
    expect(p).toMatch(/scan-dead/);
    expect(p).toContain("scanErrors=12");
  });
  it("no dispara en runs cortos ni con líneas fluyendo", () => {
    expect(scanHeartbeatProblem({ actions: 10, scannedLines: 0 })).toBeNull();
    expect(scanHeartbeatProblem({ actions: 500, scannedLines: 4321 })).toBeNull();
  });
  it("minActions es configurable", () => {
    expect(scanHeartbeatProblem({ actions: 50, scannedLines: 0 }, { minActions: 40 })).toMatch(/scan-dead/);
  });
});

describe("cableado real de soak-es.mjs (anti-descableado)", () => {
  it("importa y usa los helpers de soak-lib", () => {
    expect(SOAK_ES).toContain('from "./soak-lib.mjs"');
    expect(SOAK_ES).toContain("process.exit(finalExitCode(stats))");
    expect(SOAK_ES).toContain("scanHeartbeatProblem(stats)");
  });
  it("el exit viejo (solo-anomalías) ya no existe", () => {
    expect(SOAK_ES).not.toContain("stats.anomalies > 0 ? 2 : 0");
  });
  it("scanSpanish cuenta líneas, errores y HARD por separado", () => {
    expect(SOAK_ES).toContain("stats.scannedLines += lines.length");
    expect(SOAK_ES).toContain("stats.scanErrors += 1");
    expect(SOAK_ES).toContain("stats.enTextsHard += 1");
  });
});
