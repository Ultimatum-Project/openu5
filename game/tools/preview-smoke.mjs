/**
 * Smoke-test del BUILD DE PRODUCCIÓN — guarda de regresión para el arranque bajo
 * `vite preview` / deploy estático (staging AWS). Lo hereda el pipeline: si algún
 * asset de datos (game/assets/**) deja de copiarse a dist/, un fetch de ese .json
 * devuelve el index.html (SPA fallback) y el juego revienta al boot con
 * «Unexpected token '<', "<!doctype "... is not valid JSON». Este script lo detecta
 * SIN navegador (sólo HTTP): comprueba que las rutas críticas devuelven el
 * Content-Type correcto y no el HTML del fallback.
 *
 * Uso:
 *   npm run build                      # genera dist/ (con el plugin gameDataAssets)
 *   node tools/preview-smoke.mjs       # levanta preview efímero y verifica
 * Sale 0 si el build arranca servible; 1 (con detalle) si alguna ruta cae al SPA.
 *
 * Causa raíz del hueco que vigila: game/assets/ es gitignored y NO es publicDir ni
 * módulo importado, así que `vite build` no lo copiaba a dist/. Lo cierra el plugin
 * `gameDataAssets()` de vite.config.ts (cpSync game/assets → dist/assets en closeBundle).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, "..");
const PORT = Number(process.env.SMOKE_PORT || 5210);
const DIST = path.resolve(GAME, "dist");

// Rutas que el juego pide por fetch al arrancar (todas bajo /assets, servidas en dev
// por el dev-server y en prod SÓLO si el plugin las copió a dist/assets).
const CRITICAL = [
  { url: "/", type: "text/html" },
  { url: "/assets/maps/overworld.json", type: "application/json" },
  { url: "/assets/data.json", type: "application/json" },
  { url: "/assets/initial-state.json", type: "application/json" },
  { url: "/assets/intro-pics.json", type: "application/json" },
];

if (!existsSync(DIST)) {
  console.error(`[smoke] no existe ${DIST} — corre \`npm run build\` primero.`);
  process.exit(1);
}

function waitFor(url, tries = 40) {
  return new Promise((resolve, reject) => {
    const tick = async (n) => {
      try {
        await fetch(url);
        resolve();
      } catch {
        if (n <= 0) reject(new Error("preview no respondió"));
        else setTimeout(() => tick(n - 1), 250);
      }
    };
    tick(tries);
  });
}

const preview = spawn(
  "npx",
  ["vite", "preview", "--port", String(PORT), "--strictPort"],
  { cwd: GAME, stdio: "ignore", env: { ...process.env } },
);

let failed = [];
try {
  await waitFor(`http://localhost:${PORT}/`);
  for (const { url, type } of CRITICAL) {
    const res = await fetch(`http://localhost:${PORT}${url}`);
    const ct = res.headers.get("content-type") || "";
    const ok = res.status === 200 && ct.includes(type);
    console.log(`[smoke] ${ok ? "OK " : "FAIL"} ${url} → HTTP ${res.status} ${ct}`);
    if (!ok) failed.push(`${url}: esperaba ${type}, recibí HTTP ${res.status} ${ct}`);
  }
} finally {
  preview.kill();
}

if (failed.length) {
  console.error("\n[smoke] BUILD ROTO — assets que caen al SPA fallback:");
  for (const f of failed) console.error("  · " + f);
  console.error("Revisa el plugin gameDataAssets() en game/vite.config.ts.");
  process.exit(1);
}
console.log("\n[smoke] BUILD OK — todos los assets críticos se sirven desde dist/.");
process.exit(0);
