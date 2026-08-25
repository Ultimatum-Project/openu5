/**
 * GUARDA POR AUSENCIA — en ESTA entrega el registro de teclas NO SALE DEL DISPOSITIVO.
 *
 * La subida es otra entrega, con su propio consentimiento (carril 1 del diseño). El
 * riesgo real no es que alguien decida enviarlo: es que la subida se cuele AQUÍ, en la
 * capa que ya tiene el dato en la mano, y se despliegue sin pasar por el consentimiento.
 * Por eso la guarda no mira la intención sino el CÓDIGO: si en `src/replay/` o en la UI
 * de repeticiones aparece cualquier verbo de red, este test se pone rojo NOMBRANDO el
 * fichero y la línea.
 *
 * 🔴 La guarda es válida sólo mientras cubra los ficheros que existen: la lista se
 * DERIVA del directorio (no está escrita a mano), así que un fichero nuevo entra solo.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPLAY_DIR = join(__dirname, "..", "src", "replay");
const UI_FILE = join(__dirname, "..", "src", "ui", "replay-ui.ts");

/** Verbos con los que un dato sale del navegador. */
const NETWORK = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bnavigator\s*\.\s*sendBeacon\b/,
  /\bnew\s+WebSocket\b/,
  /\bnew\s+EventSource\b/,
  /\bimport\s*\(\s*["'`]https?:/,
  /\bhttps?:\/\//,
];

function sources(): { path: string; text: string }[] {
  const files = readdirSync(REPLAY_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(REPLAY_DIR, f));
  files.push(UI_FILE);
  return files.map((path) => ({ path, text: readFileSync(path, "utf8") }));
}

describe("registro de teclas — NADA sale del dispositivo en esta entrega", () => {
  it("el directorio existe y tiene ficheros (la guarda no se absuelve por vacío)", () => {
    const s = sources();
    expect(s.length).toBeGreaterThanOrEqual(5);
    expect(s.map((f) => f.path.split("/").pop())).toContain("store.ts");
  });

  it("ningún fichero de la capa de repeticiones contiene un verbo de red", () => {
    const offending: string[] = [];
    for (const { path, text } of sources()) {
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        for (const re of NETWORK) {
          if (re.test(line)) offending.push(`${path}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offending).toEqual([]);
  });

  it("CONTROL POSITIVO: el detector SÍ ve un verbo de red (no es verde por inerte)", () => {
    const bait = [
      'await fetch("/api/partida", { method: "POST" });',
      "navigator.sendBeacon(url, blob);",
      'const ws = new WebSocket("wss://example.org");',
      "const xhr = new XMLHttpRequest();",
    ];
    for (const line of bait) {
      expect(NETWORK.some((re) => re.test(line))).toBe(true);
    }
  });

  it("el almacén guarda en IndexedDB — la única salida del dato es local", () => {
    const store = readFileSync(join(REPLAY_DIR, "store.ts"), "utf8");
    expect(store).toContain("indexedDB.open");
  });
});
