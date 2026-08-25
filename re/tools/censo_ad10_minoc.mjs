#!/usr/bin/env npx tsx
/**
 * CENSOS de la adjudicación de `ad10-g21` (acta: re/notes/ad10-minoc-acta.md).
 * Dos subcomandos, dos cifras cabecera, cada una reproducible sin correr el espejo.
 *
 *   npx tsx re/tools/censo_ad10_minoc.mjs plantas
 *       ¿A qué HORAS están los seis interlocutores del segmento en la planta del ancla
 *       (el Healer, slot 2)? Da la ventana buena y nombra la PEOR franja.
 *
 *   npx tsx re/tools/censo_ad10_minoc.mjs klimb [<dir-transcripts>]   (censo, por CONTEXTO)
 *   npx tsx re/tools/censo_ad10_minoc.mjs klimb-control                (el mecanismo sobre el MAPA REAL)
 *       Cuántas veces ESCALA EN EL SITIO el LP (corpus, tracked) frente al PORT
 *       (transcripts de una corrida; material derivado, ruta declarada por el que mide).
 *       Sin <dir> censa sólo el LP: la mitad del careo que vive en el repo.
 *
 * ★ NO RE-DERIVA la aritmética de horarios: reexporta `celdaA` de
 *   `censo_horario_npcs.mjs`, que a su vez importa `scheduleIndex` del PORT y lleva su
 *   propio control positivo contra el binario. Tres copias de esa aritmética serían tres
 *   sitios donde puede divergir.
 *
 * ★ CONTROL POSITIVO propio de `plantas`: los seis interlocutores NO se enumeran a mano —
 *   se derivan del corpus (`ad10.route.json` + `talk/towne.json`) con el identificador de
 *   `careo_dialogo_segmento.mjs`, y el censo ABORTA si el conjunto de slots no es el
 *   pre-registrado. Enumerarlos a mano sería meter la respuesta en la pregunta.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cargarLoc, celdaA, control } from "./censo_horario_npcs.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUTAS = join(RAIZ, "game", "e2e", "espejo-tour", "routes-ad");
const RUTAS_P = join(RAIZ, "game", "e2e", "espejo-tour", "routes");

const LOC = 5; // Minoc
const SLOT_ANCLA = 2; // shop:Healer — el ancla del guion (única del segmento)
/** Slots pre-registrados de los interlocutores de `ad10-g21` (control positivo). */
const SLOTS_ESPERADOS = [1, 2, 3, 6, 7, 8];
const NOMBRE = { 1: "Tactus", 2: "Regina/Healer", 3: "Fiona", 6: "Rew", 7: "Fenelon", 8: "Lady Sahra" };

// ── plantas ──────────────────────────────────────────────────────────────────
/** Slots de los interlocutores, DERIVADOS del corpus vía dialogNumber = npcIndex. */
async function slotsDelSegmento() {
  const { identificar, opsDeTalk } = await import("./careo_dialogo_segmento.mjs");
  const towne = JSON.parse(readFileSync(join(RAIZ, "game", "assets", "talk", "towne.json"), "utf8"));
  const ruta = JSON.parse(readFileSync(join(RUTAS, "ad10.route.json"), "utf8"));
  const seg = ruta.segments.find((s) => s.id === "ad10-g21");
  const porLn = new Map(seg.expect.map((e) => [e.ocrLn, e.text]));
  const npcs = cargarLoc(LOC);
  const slots = new Set([SLOT_ANCLA]); // el del ancla (tienda: no pasa por towne)
  for (const op of opsDeTalk(seg)) {
    const id = identificar(towne, porLn.get(op.ocrLn) || "");
    if (!id) continue;
    const npc = npcs.find((n) => n.dialogNumber === id.entrada.npcIndex);
    if (npc) slots.add(npc.slot);
  }
  return [...slots].sort((a, b) => a - b);
}

async function plantas() {
  control(); // control positivo heredado: banda del Healer contra el binario
  const slots = await slotsDelSegmento();
  const esp = SLOTS_ESPERADOS.join(",");
  if (slots.join(",") !== esp) {
    throw new Error(
      `🔴 CONTROL POSITIVO ROTO — interlocutores de ad10-g21 derivados del corpus: ` +
        `[${slots.join(",")}]; pre-registrado [${esp}]. NO se imprime el censo.`,
    );
  }
  const npcs = cargarLoc(LOC);
  const de = (s) => npcs.find((n) => n.slot === s);

  console.log(`# ad10-g21 — PLANTA de los ${slots.length} interlocutores, hora a hora (loc ${LOC}, Minoc)`);
  console.log(`# el ancla del guion es el slot ${SLOT_ANCLA} (${NOMBRE[SLOT_ANCLA]}): la party queda en SU planta`);
  console.log("");
  console.log(`h    ${slots.map((s) => NOMBRE[s].padEnd(14)).join("")}fuera de la planta del ancla`);
  const buenas = [];
  for (let h = 0; h < 24; h++) {
    const zAncla = celdaA(de(SLOT_ANCLA), h).z;
    const fuera = slots.filter((s) => celdaA(de(s), h).z !== zAncla);
    if (fuera.length === 0) buenas.push(h);
    const fila = slots.map((s) => {
      const c = celdaA(de(s), h);
      return `(${c.x},${c.y},z${c.z})`.padEnd(14);
    });
    console.log(
      `${String(h).padStart(2, "0")}   ${fila.join("")}${fuera.length}` +
        (fuera.length ? `  [${fuera.map((s) => NOMBRE[s]).join(", ")}]` : "  ← TODOS alcanzables"),
    );
  }
  console.log("");
  console.log(`HORAS en que los ${slots.length} están en la planta del ancla: [${buenas.join(", ")}]  (${buenas.length}/24)`);
  const peor = [];
  for (let h = 0; h < 24; h++) {
    const zAncla = celdaA(de(SLOT_ANCLA), h).z;
    if (zAncla !== 0) continue; // sólo las horas en que el Healer YA bajó
    const fuera = slots.filter((s) => celdaA(de(s), h).z !== zAncla);
    if (fuera.length >= 2) peor.push(`${String(h).padStart(2, "0")}:00 (${fuera.length}: ${fuera.map((s) => NOMBRE[s]).join(", ")})`);
  }
  console.log(`PEORES horas CON el ancla ya en z0 (2+ interlocutores en la otra planta): ${peor.join(" · ") || "(ninguna)"}`);
}

// ── klimb ────────────────────────────────────────────────────────────────────
const EN_SITIO = /^Klimb-(Up|Vp|Down|D6wn)!/; // escalada resuelta SIN pedir dirección
const RECHAZO = /^Klimb-[Ww]hat\?/;

/**
 * 🔴 El HUD del port emite la escalada resuelta en DOS líneas —el eco del dispatcher
 * `"Klimb-"` y luego `"Up!"`/`"Down!"`—, así que contar `"Up!"` suelto NO mide
 * transiciones automáticas de escalera: mide **el segundo trozo de un Klimb**. La primera
 * versión de esta sonda publicó «41 cambios automáticos» y eran 41 escaladas de mazmorra y
 * post-combate. Se reúnen mirando la línea anterior.
 */
const esColaDeKlimb = (lineas, i) =>
  (lineas[i] === "Up!" || lineas[i] === "Down!") && i > 0 && lineas[i - 1].startsWith("Klimb");

/** `ctx` por segmento, de las rutas tracked: sin él, pueblo y mazmorra se mezclan. */
function ctxPorSegmento() {
  const ctx = new Map();
  for (const d of [RUTAS, RUTAS_P].filter((x) => existsSync(x))) {
    for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
      const ruta = JSON.parse(readFileSync(join(d, f), "utf8"));
      for (const s of ruta.segments || []) ctx.set(s.id, s.ctx || "?");
    }
  }
  return ctx;
}

function censoLP(soloAD) {
  const enSitio = new Map();
  const conducidas = new Map();
  let ficheros = 0;
  for (const d of [RUTAS, RUTAS_P].filter((x) => existsSync(x))) {
    for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
      if (soloAD && !/^ad\d+\.route\.json$/.test(f)) continue;
      const ruta = JSON.parse(readFileSync(join(d, f), "utf8"));
      if (!Array.isArray(ruta.segments)) continue;
      ficheros++;
      for (const s of ruta.segments) {
        const c = s.ctx || "?";
        const k = (s.script || []).filter((x) => x.key === "k").length;
        conducidas.set(c, (conducidas.get(c) || 0) + k);
        for (const e of s.expect || []) {
          for (const tok of String(e.text).split(/\s+/)) {
            if (EN_SITIO.test(tok)) enSitio.set(c, (enSitio.get(c) || 0) + 1);
          }
        }
      }
    }
  }
  return { enSitio, conducidas, ficheros };
}

function censoPort(dir, ctx) {
  const enSitio = new Map();
  const rechazo = new Map();
  const prompt = new Map();
  let ficheros = 0;
  const inc = (m, c) => m.set(c, (m.get(c) || 0) + 1);
  const pila = [dir];
  while (pila.length) {
    const d = pila.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) pila.push(p);
      else if (e.name.endsWith(".transcript.json")) {
        ficheros++;
        const t = JSON.parse(readFileSync(p, "utf8"));
        for (const [seg, lineas] of Object.entries(t)) {
          const c = ctx.get(seg) || "?";
          for (let i = 0; i < lineas.length; i++) {
            const x = lineas[i];
            if (x === "Klimb-") inc(prompt, c);
            if (EN_SITIO.test(x) || esColaDeKlimb(lineas, i)) inc(enSitio, c);
            else if (RECHAZO.test(x)) inc(rechazo, c);
          }
        }
      }
    }
  }
  return { enSitio, rechazo, prompt, ficheros };
}

function klimb(dir) {
  const ctx = ctxPorSegmento();
  const lp = censoLP(!!dir); // con material de port se restringe a AD, que es lo que cubre
  console.log("# ESCALADA EN EL SITIO (K sobre escala 0xC8/0xC9 → resuelve SIN pedir dirección)");
  console.log(`# ${dir ? "restringido a las 25 rutas AD (la población que cubre el material de port)" : "corpus entero"}`);
  console.log("");
  const ctxs = new Set([...lp.enSitio.keys(), ...lp.conducidas.keys()]);
  const p = dir ? censoPort(dir, ctx) : null;
  if (p) for (const k of [...p.enSitio.keys(), ...p.rechazo.keys(), ...p.prompt.keys()]) ctxs.add(k);
  const orden = [...ctxs].sort();
  console.log(
    `${"ctx".padEnd(14)}${"K del guion".padStart(12)}${"LP en sitio".padStart(13)}` +
      (p ? `${"PORT en sitio".padStart(15)}${"PORT What?".padStart(12)}${"PORT prompt".padStart(13)}` : ""),
  );
  for (const c of orden) {
    let l = c.padEnd(14) + String(lp.conducidas.get(c) || 0).padStart(12) + String(lp.enSitio.get(c) || 0).padStart(13);
    if (p) {
      l +=
        String(p.enSitio.get(c) || 0).padStart(15) +
        String(p.rechazo.get(c) || 0).padStart(12) +
        String(p.prompt.get(c) || 0).padStart(13);
    }
    console.log(l);
  }
  if (!dir) {
    console.log("");
    console.log("(sin <dir-transcripts>: el lado PORT necesita material de corrida, que no vive en el repo)");
    return;
  }
  console.log("");
  console.log(`# ${p.ficheros} transcripts en ${dir}`);
  console.log("");
  console.log(
    `⇒ EL PREDICADO: en **smallmap** el port resuelve escala ${p.enSitio.get("smallmap") || 0} veces. Y tanto el\n` +
      `  prompt de dirección (${p.prompt.get("smallmap") || 0}) como el "Klimb-What?" (${p.rechazo.get("smallmap") || 0}) son, por la ESTRUCTURA DE RAMAS\n` +
      `  del port (game.ts:3351-3356 · main.ts:1736), alcanzables SÓLO con un tile bajo la party que\n` +
      `  NO es escala ⇒ el arnés dejó a la party sobre una escala CERO veces. No tuvo ocasión.\n` +
      `  Y el port SÍ escala en el sitio donde sí la tiene: ${p.enSitio.get("post-combat") || 0} post-combate + ${p.enSitio.get("dungeon") || 0} mazmorra.`,
  );
}

// ── klimb-control: el mecanismo sobre el MAPA REAL de Minoc ───────────────────
/**
 * CONTROL POSITIVO del Klimb **sobre datos reales**. `game/tests/town-stairs.test.ts` prueba
 * la rama con un fixture SINTÉTICO (`{"5,5": 0xc8}`), lo cual no dice que dispare sobre el
 * mapa de Minoc. Aquí se instancia el `Game` del port con el `smallmaps.json` real y se pulsa
 * K en las tres escalas de Minoc. Si alguna no sube, el cero del censo SÍ sería del port.
 */
async function klimbControl() {
  const { Game } = await import("../../game/src/core/game.ts");
  const mapas = JSON.parse(readFileSync(join(RAIZ, "game", "assets", "maps", "smallmaps.json"), "utf8"));
  const minoc = mapas.find((m) => m.id === LOC);
  const escalas = [];
  minoc.floors[0].tiles.forEach((fila, y) =>
    fila.forEach((t, x) => {
      if (t === 0xc8) escalas.push([x, y]);
    }),
  );
  const world = {
    overworld: Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5)),
    underworld: Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5)),
    smallMaps: new Map([[LOC, minoc]]),
  };
  const data = {
    locationsX: Array.from({ length: 32 }, () => 100),
    locationsY: Array.from({ length: 32 }, () => 100),
    locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  };
  const personaje = {
    name: "T", gender: 0x0b, class: "A", status: "G", strength: 20, dexterity: 20,
    intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: 0,
  };
  console.log(`# CONTROL POSITIVO del (K)limb sobre el MAPA REAL de Minoc (loc ${LOC})`);
  console.log(`# escalas 0xC8 en z0: ${escalas.map(([x, y]) => `(${x},${y})`).join(" ")}`);
  console.log("");
  let ok = 0;
  for (const [x, y] of escalas) {
    const estado = {
      characters: [personaje, { ...personaje, name: "Iolo" }], partySize: 2, activeCharacter: 0,
      food: 100, time: { year: 139, month: 4, day: 7, hour: 10, minute: 0 }, turnsSinceStart: 0,
      position: { location: LOC, floor: 0, x, y }, transport: "foot", torchTurns: 0, torches: 2,
      prevHour: 10,
    };
    const game = new Game({}, world, data, estado);
    const ev = game.klimb();
    const msg = ev.filter((e) => e.kind === "message").map((e) => e.text).join(" ");
    const subio = estado.position.floor === 1 && /Klimb-Up!/.test(msg);
    if (subio) ok++;
    console.log(`  (${x},${y}) z0 + K → planta ${estado.position.floor} · ${msg || "(sin mensaje)"} ${subio ? "✓" : "🔴"}`);
  }
  console.log("");
  if (ok !== escalas.length) {
    throw new Error(
      `🔴 CONTROL POSITIVO ROTO — ${ok}/${escalas.length} escalas de Minoc suben con K sobre el mapa REAL. ` +
        `El cero de escaladas en smallmap NO se puede atribuir a falta de ocasión.`,
    );
  }
  console.log(`⇒ ${ok}/${escalas.length}: el mecanismo dispara sobre el mapa REAL. El cero del censo es POSICIÓN.`);
}

// ── reloj: ¿coinciden el reloj del LP y el del arnés dentro de ad10? ──────────
/**
 * Testigos horarios del LP en `ad10`, y careo contra el reloj del arnés.
 *
 * DOS familias, y son PARTICIONES DISTINTAS del día:
 *  - parte del día (`Good/Fair <parte>`, `partOfDayWord` shoppe-greetings.ts:438):
 *    morning 00-11 · afternoon 12-17 · evening 18-23.
 *  - sol/cielo nocturno (`lookSpecialDescription`, game.ts:529 —
 *    `hour >= 6 && hour < 18`): sol 06-17 · cielo nocturno 18-05.
 *
 * ★ Cruzarlas cortaría a 6 h, pero ese cruce tiene **POBLACIÓN CERO** en el corpus (ver
 *   `--corpus`): los 5 segmentos con testigo de sol/noche no llevan ninguno saludo horario.
 *   Se deja escrito para que nadie vuelva a proponerlo como vía ([[poblacion-vacia]]).
 *
 * El reloj del ARNÉS no se re-deriva aquí: son las cifras por segmento MEDIDAS en
 * `re/notes/reloj-27-acta.md` §2 (brazo H), que esta tabla sólo acumula desde el
 * `entryClock` de la propia ruta.
 */
const COSTE_H = { // minutos por segmento, brazo H — reloj-27-acta.md §2
  1: 43, 2: 2, 3: 10, 4: 122, 5: 196, 6: 64, 7: 16, 8: 22, 9: 256, 10: 0, 11: 1, 12: 64,
  13: 152, 14: 39, 15: 24, 16: 5, 17: 17, 18: 11, 19: 8, 20: 98,
  21: 107, 22: 152, 23: 33, 24: 120, 25: 32, 26: 0,
};
const POD = { morning: [0, 11], afternoon: [12, 17], evening: [18, 23] };

function reloj(corpus) {
  const ruta = JSON.parse(readFileSync(join(RUTAS, "ad10.route.json"), "utf8"));
  const e0 = ruta.entry?.entryClock || { hour: 10, minute: 0 };
  console.log(`# ad10 — RELOJ DEL LP (testigos del corpus) vs RELOJ DEL ARNÉS`);
  console.log(`# entryClock de la ruta: ${String(e0.hour).padStart(2, "0")}:${String(e0.minute).padStart(2, "0")} · costes por segmento: reloj-27-acta.md §2 (brazo H)`);
  console.log("");
  const rePod = /\b(?:Good|Fair) (morning|afternoon|evening)\b/;
  const reSun = /dost see the sun/i;
  const reNight = /dost see the night sky/i;
  let acum = 0;
  console.log(`${"segmento".padEnd(11)}${"arnés@entrada".padStart(14)}  testigo del LP`);
  for (const s of ruta.segments) {
    const n = Number(s.id.split("-g")[1]);
    const h = (e0.hour * 60 + e0.minute + acum) / 60;
    const hh = Math.floor(h % 24);
    const mm = Math.round((h % 1) * 60);
    const dia = Math.floor(h / 24);
    acum += COSTE_H[n] ?? 0;
    const txt = (s.expect || []).map((x) => x.text).join(" ");
    const mPod = rePod.exec(txt);
    const noche = reNight.test(txt);
    const sol = reSun.test(txt);
    if (!mPod && !noche && !sol) continue;
    const bandas = [];
    if (mPod) bandas.push(`«${mPod[1]}» ⇒ ${String(POD[mPod[1]][0]).padStart(2, "0")}:00-${POD[mPod[1]][1]}:59`);
    if (noche) bandas.push("«the night sky!» ⇒ 18:00-05:59");
    if (sol) bandas.push("«the sun!» ⇒ 06:00-17:59");
    const reloj = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${dia ? `+${dia}d` : ""}`;
    // ¿cae el reloj del arnés DENTRO de todas las bandas del LP?
    const dentro = bandas.every((b) => {
      const m = /(\d\d):00-(\d\d):59/.exec(b);
      const [a, z] = [Number(m[1]), Number(m[2])];
      return a <= z ? hh >= a && hh <= z : hh >= a || hh <= z;
    });
    console.log(`${s.id.padEnd(11)}${reloj.padStart(14)}  ${bandas.join(" · ")}  ${dentro ? "compatible" : "🔴 DISJUNTO"}`);
  }
  if (!corpus) return;
  console.log("");
  console.log("# POBLACIÓN de los testigos en TODO el corpus");
  let sun = 0;
  let night = 0;
  let pod = 0;
  let ambos = 0;
  for (const d of [RUTAS, RUTAS_P].filter((x) => existsSync(x))) {
    for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
      const r = JSON.parse(readFileSync(join(d, f), "utf8"));
      for (const s of r.segments || []) {
        const t = (s.expect || []).map((x) => x.text).join(" ");
        const hs = reSun.test(t);
        const hn = reNight.test(t);
        const hp = rePod.test(t);
        if (hs) sun++;
        if (hn) night++;
        if (hp) pod++;
        if ((hs || hn) && hp) ambos++;
      }
    }
  }
  console.log(`  segmentos con «the sun!»        : ${sun}`);
  console.log(`  segmentos con «the night sky!»  : ${night}`);
  console.log(`  segmentos con parte del día     : ${pod}`);
  console.log(`  🔴 con LAS DOS (cortaría a 6 h) : ${ambos}  ← cruzar las particiones NO tiene población`);
}

// ── anclas ───────────────────────────────────────────────────────────────────
/**
 * ¿Cuántas ops de Talk del corpus llevan ANCLA de NPC? Todo lo que no la lleva depende
 * de que la party haya dead-reckoned hasta la casilla adyacente al interlocutor.
 */
function anclas() {
  let talks = 0;
  let ancladas = 0;
  let segsConTalk = 0;
  let segsConAncla = 0;
  const dirs = [RUTAS, RUTAS_P].filter((d) => existsSync(d));
  let g21 = null;
  for (const d of dirs) {
    for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
      const ruta = JSON.parse(readFileSync(join(d, f), "utf8"));
      for (const s of ruta.segments || []) {
        const t = (s.script || []).filter((x) => x.key === "t").length;
        const a = (s.script || []).filter((x) => x.anchor && x.anchor.cmd === "talk").length;
        talks += t;
        ancladas += a;
        if (t) segsConTalk++;
        if (t && a) segsConAncla++;
        if (s.id === "ad10-g21") g21 = { t, a };
      }
    }
  }
  console.log("# ANCLAS DE NPC por op de Talk (corpus entero)");
  console.log(`ops de Talk           : ${talks}`);
  console.log(`  con ancla           : ${ancladas}  (${((100 * ancladas) / talks).toFixed(1)}%)`);
  console.log(`segmentos con Talk    : ${segsConTalk}`);
  console.log(`  con alguna ancla    : ${segsConAncla}`);
  if (g21) console.log(`\nad10-g21              : ${g21.t} ops de Talk · ${g21.a} ancla(s)`);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main(argv) {
  const cmd = argv[0];
  if (cmd === "plantas") return plantas();
  if (cmd === "klimb") return klimb(argv[1] || null);
  if (cmd === "klimb-control") return klimbControl();
  if (cmd === "anclas") return anclas();
  if (cmd === "reloj") return reloj(argv.includes("--corpus"));
  console.error("uso: npx tsx re/tools/censo_ad10_minoc.mjs plantas | klimb [<dir-transcripts>] | klimb-control | anclas | reloj [--corpus]");
  process.exit(2);
}

if (process.argv[1] && process.argv[1].endsWith("censo_ad10_minoc.mjs")) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(String(e.message || e));
    process.exit(1);
  });
}

export { slotsDelSegmento, censoLP, censoPort };
