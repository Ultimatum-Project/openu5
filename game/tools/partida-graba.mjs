/**
 * GRABA una PARTIDA PREDEFINIDA de las que reproduce el botón «Ver una partida» (#158).
 *
 * ── QUÉ PRODUCE ──────────────────────────────────────────────────────────────────────
 * Un `game/partidas/<id>.json` con lo que hace REPRODUCIBLE la partida y nada más:
 * de qué momento legendario arranca, la semilla viva, y las teclas. **El estado inicial
 * NO se escribe**, y por eso el fichero puede ir trackeado: lo recompone el navegador de
 * quien la vea, desde SU copia extraída. El formato calca el de alambre de un récord
 * (`demo-byo/src/records-formato.ts:84-107`) por la misma razón por la que aquél existe —
 * `GameState.characters` son los 16 registros del roster de `INIT.GAM` y `state.journal`
 * es prosa de EA verbatim. La guarda que lo impone es `re/tools/test_partidas_sin_ea.py`.
 *
 * ── LA COREOGRAFÍA ES DATO, NO CÓDIGO ────────────────────────────────────────────────
 * Las teclas se leen de `game/partidas/guiones/<id>.txt` (una tecla por línea, `#` =
 * comentario). Así se ajusta lo que se ve en el vídeo sin tocar la herramienta, y el
 * guión queda junto a la partida que produce.
 *
 * ── POR QUÉ GRABAR VA BAJO EL RELOJ NORMAL ───────────────────────────────────────────
 * Grabar es AUTORÍA. El determinismo es una propiedad de REPRODUCIR lo grabado, no de
 * grabarlo, y quien lo comprueba es `partida-render.mjs` (que sí usa reloj virtual).
 *
 * 🔴 Depende de material de EA (`game/assets`, gitignored) ⇒ NO va en la batería.
 *
 * Uso (desde la raíz del worktree, con un vite propio en un puerto 52xx):
 *   npx vite game --config game/vite.config.ts --port 5250 &
 *   U5_PORT=5250 node game/tools/partida-graba.mjs <id-partida> <id-momento>
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(RAIZ, "package.json"))("playwright");
const BASE = `http://localhost:${process.env.U5_PORT || 5250}`;

const ID = process.argv[2];
const MOMENTO = process.argv[3];
if (!ID || !MOMENTO) {
  console.error("uso: node game/tools/partida-graba.mjs <id-partida> <id-momento>");
  process.exit(2);
}
const DIR = resolve(RAIZ, "game/partidas");
const GUION = resolve(DIR, "guiones", `${ID}.txt`);
if (!existsSync(GUION)) {
  console.error(`falta el guión de teclas: ${GUION}`);
  process.exit(2);
}
const teclas = readFileSync(GUION, "utf8")
  .split("\n")
  .map((l) => l.replace(/#.*$/, "").trim())
  .filter(Boolean);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e.message).slice(0, 200)));

/** Compone el momento desde la extracción local y lo siembra como partida guardada. */
async function siembra(momId) {
  await page.goto(`${BASE}/?fresh&nointro`);
  await page.waitForFunction(() => !!(window.__u5test?.state?.()), null, { timeout: 120000 });
  return page.evaluate(async (id) => {
    // 🔴 EL MISMO CAMINO QUE `estadoDeMomento` (records-ancla.ts:112-117), round-trip por
    // los bytes nativos incluido: el ancla tiene que ser el estado que el juego REALMENTE
    // carga. Componer un equivalente "más directo" haría que la huella del visitante no
    // casara con la de aquí, y su reproducción se leería como divergencia del motor.
    const [compone, defs] = await Promise.all([
      import("/src/momentos/compone.js"),
      import("/src/momentos/defs.js"),
    ]);
    const def = defs.momentoPorId(id);
    if (!def) throw new Error(`momento desconocido: ${id}`);
    const [rInit, rGam] = await Promise.all([
      fetch("/assets/initial-state.json"),
      fetch("/assets/init.gam"),
    ]);
    if (!rInit.ok || !rGam.ok) throw new Error("sin extracción local (game/assets)");
    const estado = compone.importaMomento(
      compone.horneaMomento(def, await rInit.json(), new Uint8Array(await rGam.arrayBuffer())),
    );
    localStorage.setItem("u5clone:save:partida-grabando", JSON.stringify(estado));
    localStorage.setItem(
      "u5clone:saves",
      JSON.stringify([{ id: "partida-grabando", name: "grabando", timestamp: Date.now(), turns: 0, locationName: "" }]),
    );
    return { titulo: def.titulo, pos: estado.position };
  }, momId);
}

const info = await siembra(MOMENTO);
console.log(`momento ${MOMENTO} — ${info.titulo.es} · ${JSON.stringify(info.pos)}`);

await page.goto(`${BASE}/?nointro&save=partida-grabando`);
await page.waitForFunction(() => !!(window.__u5test?.state?.()), null, { timeout: 120000 });
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
await page.waitForTimeout(2000);

await page.evaluate(() => window.__u5test.replay.startRec());
for (const k of teclas) {
  await page.locator("body").press(k);
  await page.waitForTimeout(60);
}
const log = await page.evaluate(() => window.__u5test.replay.stopRec("partida"));
const motor = await page.evaluate(() => (window.__u5test.game?.version ?? "openu5-dev"));

if (errores.length) console.error("⚠️  errores de página:", errores.join(" | "));

// 🔴 SE ESCRIBE CAMPO A CAMPO, NO `{...log}`. Un spread copiaría `anchor` —que es justo lo
// que no puede viajar— y el fichero saldría rechazado por la guarda... si alguien la corre.
// Enumerar los campos hace que el estado no pueda colarse ni por descuido ni por un campo
// nuevo que aparezca mañana en `ReplayLog`.
const partida = {
  v: 1,
  id: ID,
  titulo: info.titulo,
  base: { tipo: "momento", id: MOMENTO },
  semilla: log.anchor.seed,
  keys: log.keys,
  turns: log.turns,
  mods: log.mods,
  count: log.count,
  lastTurn: log.lastTurn,
  motor: String(motor),
};
mkdirSync(DIR, { recursive: true });
const salida = resolve(DIR, `${ID}.json`);
writeFileSync(salida, `${JSON.stringify(partida, null, 2)}\n`);

const bytes = Buffer.byteLength(JSON.stringify(partida));
console.log(`GRABADA -> game/partidas/${ID}.json`);
console.log(`  ${log.count} teclas · último turno ${log.lastTurn} · ${bytes} B en disco`);
console.log(`  streams: keys=${log.keys.length} turns=${log.turns.length} mods=${log.mods.length}`);
console.log(`  el ancla (${log.anchor.state.length} B de estado) NO se ha escrito: se recompone al reproducir`);

await browser.close();
