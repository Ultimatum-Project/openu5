#!/usr/bin/env node
/**
 * GATE DE VÍDEOS — CLI. Carril `gate-videos`.
 *
 * Contesta, por vídeo y sin que un humano mire 67 clips, la pregunta del usuario: «piensa
 * en algo para que los vídeos realmente estén bien». Recoge evidencia de tres planos
 * (sidecar de grabación · sondas ffprobe/ffmpeg · reportes y `.gam` del espejo), la
 * adjudica con `gate-core.mjs` (puro, con testigos), imprime tabla y sale con código ≠ 0
 * si algo falla.
 *
 * Cubre LAS TRES FAMILIAS de vídeo del proyecto: eventos (42), replays del espejo (25) y
 * Grand Tour (91). 158 vídeos en ~3,5 min (cinco pasadas de sonda por vídeo).
 *
 * USO
 *   node game/tools/videocap/gate.mjs           (o `npm run video:gate` desde game/)
 *   — rutas por defecto: $HOME/PROYECTS/OpenU5-videos/{eventos,espejo-replays,grandtour}
 *
 * BANDERAS
 *   --eventos= --replays= --tour=   rutas de cada familia
 *   --json=<f>            vuelca el veredicto crudo (para diffear entre tandas)
 *   --velocidad-tsv=<f>   TSV de legibilidad para el carril del MODO CINEMÁTICO
 *   --solo=<pat>          filtra por subcadena del id
 *   --parcial             no censa las expectativas (sobre un subconjunto no significan nada)
 *   --sin-video           salta las sondas ffmpeg (rápido: sólo planos A y C)
 *   --laxo                imprime la tabla pero sale 0 (inspeccionar sin romper un guion)
 *
 * EL CÓDIGO DE SALIDA lo deciden los FALLO, las expectativas sin declarar y los VERDES
 * VACUOS del tour. El ÁMBAR (velocidad · legibilidad · «no enseña nada») NO cuenta: es otra
 * clase — un vídeo demasiado rápido o vacío no está ROTO, su estado lo asserta el capítulo
 * o el reporte, y hacerlo bloquear convertiría una observación de producción en un rojo de
 * ingeniería. Se imprime en secciones propias para que no se pierda entre los fallos.
 *
 * 🔴 `freezedetect` EMITE A NIVEL INFO. Invocarlo con `-v error` da CERO detecciones
 * SIEMPRE y el gate firmaría «no hay ni una parada» sobre 491 s de paradas reales
 * (TABLA-REPLAYS.md §0, donde le pasó a un carril y lo destapó un control positivo). Por
 * eso aquí se invoca con `-v info` y `sondaFreeze` ABORTA si ffmpeg no escribió nada en
 * stderr: un instrumento mudo no es un instrumento limpio.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSidecar, adjudica, verificaExpectativas, resuelveExp, instantesDeMovimiento, OK, FALLO, SIN_DATO, AMBAR } from "./gate-core.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const EXPS = JSON.parse(readFileSync(resolve(AQUI, "expectativas.json"), "utf8"));

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const flag = (n) => process.argv.includes(`--${n}`);
const HOME = process.env.HOME ?? "";
const DIR_EVENTOS = arg("eventos", `${HOME}/PROYECTS/OpenU5-videos/eventos`);
const DIR_REPLAYS = arg("replays", `${HOME}/PROYECTS/OpenU5-videos/espejo-replays`);
const DIR_TOUR = arg("tour", `${HOME}/PROYECTS/OpenU5-videos/grandtour`);
const SOLO = arg("solo", "");
const SIN_VIDEO = flag("sin-video");

// ══════════════════════════════════════════════════════════════════════════════════════
// SONDAS (el único sitio del gate que toca el mundo exterior)
// ══════════════════════════════════════════════════════════════════════════════════════

/** ffprobe + una pasada de decodificación COMPLETA. La pasada importa: `part18.webm`
 *  tiene cabecera legible y se rompe a mitad — sin decodificar entero no se distingue de
 *  un vídeo sano. */
function sondaProbe(f) {
  const bytes = statSync(f).size;
  let durS = null;
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f],
      { encoding: "utf8" },
    ).trim();
    const n = Number(out);
    durS = Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    durS = null;
  }
  const errores = [];
  try {
    execFileSync("ffmpeg", ["-v", "error", "-i", f, "-map", "0:v", "-f", "null", "-"], {
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (e) {
    for (const l of String(e.stderr ?? "").split("\n")) if (l.trim()) errores.push(l.trim().slice(0, 120));
  }
  return { bytes, durS, errores };
}

/**
 * Tramos de congelación del recorte declarado. Devuelve `null` (= SIN-DATO, nunca verde)
 * si ffmpeg no dijo nada — el modo de fallo silencioso de esta sonda.
 */
function sondaFreeze(f, crop) {
  // 🔴 `d=0.2` Y NO `d=1.5`, con una PROPIEDAD DE SUBCONJUNTO comprobada, no supuesta: los
  // tramos que reporta `d=1.5` son EXACTAMENTE los de `d=0.2` filtrados por duración ≥1,5 s
  // (careado sobre whirlpool → los mismos 3,28-5,12 y 5,12-EOF; sobre ad01 → los mismos
  // cuatro, 1,44 · 3,16 · 47,16 · 88,08). Así una sola pasada de decodificación sirve para
  // las DOS preguntas: las paradas largas (filtrando) y cuántos ESTADOS VISIBLES distintos
  // tuvo el panel (contando todos) — que es el recuento de la métrica de VELOCIDAD.
  // `spawnSync` y no `execFileSync`: éste sólo entrega el stderr por la EXCEPCIÓN, y aquí
  // el camino normal es rc=0 con TODO el dato en stderr (freezedetect emite a INFO).
  const r = spawnSync(
    "ffmpeg",
    ["-v", "info", "-i", f, "-vf", `crop=${crop},format=gray,scale=160:100,freezedetect=n=0.005:d=0.2`, "-map", "0:v", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const stderr = String(r.stderr ?? "");
  // Instrumento MUDO ⇒ `null` = SIN-DATO. Es la guarda de la trampa del `-v error`: si
  // alguien baja el nivel de log, esta sonda deja de hablar y el gate lo DICE en vez de
  // devolver «cero tramos» (que se lee como «limpio»).
  if (!stderr.includes("Stream mapping") && !stderr.includes("freeze")) return null;
  const tramos = [];
  for (const m of stderr.matchAll(/freeze_(start|end): ([0-9.]+)/g)) {
    if (m[1] === "start") tramos.push({ start: Number(m[2]), end: null });
    else if (tramos.length) tramos[tramos.length - 1].end = Number(m[2]);
  }
  return tramos;
}

/**
 * CAMBIOS DE PANTALLA por segundo + pausa más larga. Invocación TAL CUAL la de la auditoría
 * del Grand Tour (`auditoria-grandtour/dif.sh`), a propósito: reusar el filtro literal es lo
 * que hace que las cifras del gate sean CAREABLES con su tabla en vez de parecidas.
 * Umbral por fotograma `YAVG > 0,35`; el instrumento está validado en las dos direcciones
 * allí (5 s congelados inyectados = detectados exactos; los 3 s con movimiento = 0).
 */
function sondaCambios(f, durS) {
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", f, "-vf", "format=gray,scale=160:100,tblend=all_mode=difference,signalstats,metadata=print:file=-", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
  );
  const vals = [];
  for (const m of String(r.stdout ?? "").matchAll(/YAVG=([0-9.]+)/g)) vals.push(Number(m[1]));
  if (!vals.length) return null;
  const TH = 0.35;
  const cambios = vals.filter((v) => v > TH).length;
  const fps = durS && vals.length ? vals.length / durS : 25;
  let pausaMax = 0;
  let run = 0;
  for (const v of vals) {
    if (v <= TH) run++;
    else {
      pausaMax = Math.max(pausaMax, run);
      run = 0;
    }
  }
  pausaMax = Math.max(pausaMax, run);
  return { n: vals.length, cambios, cambiosS: durS ? cambios / durS : 0, pausaMaxS: pausaMax / fps };
}

/**
 * VIEWPORT — «¿sigue pasando algo EN LA IMAGEN?». La sonda que le faltaba al gate; la
 * derivación completa, el control de procedencia y la trampa del `scale` están en la
 * cabecera de `gate-core.mjs` («LA SONDA QUE FALTABA»).
 *
 * 🔴 SIN `scale`, a resolución COMPLETA. Copiar el `scale=160:100` de `sondaCambios`
 * parece lo natural y es un ERROR MEDIDO: el remuestreo alias a el dither del códec y
 * fabrica un 6,2500 constante donde `bbox` a resolución nativa dice que la diferencia
 * real es de UN nivel de gris. A resolución completa la sonda reproduce el instrumento
 * de `fx-ritual-shard` clavado (máximo 38,2001 en shard-faulinei-faithful).
 *
 * Devuelve `null` si ffmpeg no escribió NADA — misma guarda de instrumento mudo que
 * `sondaFreeze`: un censo-cero se lee como «limpio» y aquí significa «no medí».
 *
 * @returns {{n:number,ocupacion:number,tUltimoMov:number,quietos:{start:number,end:number}[],max:number,umbral:number}|null}
 */
function sondaViewport(f, crop, durS, umbral = 0.35) {
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", f, "-vf", `crop=${crop},format=gray,tblend=all_mode=difference,signalstats,metadata=print:file=-`, "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
  );
  const ts = [];
  const ys = [];
  let t = null;
  for (const l of String(r.stdout ?? "").split("\n")) {
    const mt = /pts_time:([0-9.]+)/.exec(l);
    if (mt) {
      t = Number(mt[1]);
      continue;
    }
    const my = /YAVG=([0-9.]+)/.exec(l);
    if (my && t != null) {
      ts.push(t);
      ys.push(Number(my[1]));
    }
  }
  if (!ts.length) return null;
  // Los KEYFRAMES se leen del contenedor y se le pasan al núcleo, que es quien decide qué
  // cuenta como movimiento (`instantesDeMovimiento`, con su derivación y su testigo). Aquí
  // sólo se recoge la evidencia: `-skip_frame nokey` no decodifica los inter-frames, así
  // que la pasada es barata. 🔴 `-show_entries frame=key_frame` NO sirve para esto: sobre
  // estos .webm devuelve un único fotograma y se lee como «sólo hay un keyframe», que es un
  // falso negativo (me pasó, y por él di el artefacto por descartado la primera vez).
  const kfs = (() => {
    const p = spawnSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v", "-skip_frame", "nokey", "-show_entries", "frame=pts_time", "-of", "csv=p=0", f],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    return String(p.stdout ?? "")
      .split("\n")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x));
  })();
  const movs = instantesDeMovimiento(ts, ys, kfs, { umbral });
  // Tramos QUIETOS = los huecos entre instantes de movimiento (más la cabeza y la cola).
  // Es lo que `huecoMuerto` interseca con los huecos de consola.
  const quietos = [];
  let prev = 0;
  for (const m of movs) {
    if (m - prev > 0) quietos.push({ start: prev, end: m });
    prev = m;
  }
  quietos.push({ start: prev, end: durS ?? ts[ts.length - 1] });
  return {
    n: ts.length,
    ocupacion: movs.length / ts.length,
    tUltimoMov: movs.length ? movs[movs.length - 1] : 0,
    quietos,
    max: Math.max(...ys),
    umbral,
  };
}

/** Luminancia media/sd por fotograma — la sonda de «¿este vídeo enseña algo?».
 *  Invocación literal de `auditoria-grandtour/yv.sh` (sin `format=gray`: el filtro de allí
 *  escala y deja que signalstats mida el plano Y). */
function sondaLuminancia(f) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", f, "-vf", "scale=160:100,signalstats,metadata=print:file=-", "-f", "null", "-"], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
  const vals = [];
  for (const m of String(r.stdout ?? "").matchAll(/YAVG=([0-9.]+)/g)) vals.push(Number(m[1]));
  if (!vals.length) return null;
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - media) ** 2, 0) / vals.length);
  return { n: vals.length, media, sd, max: Math.max(...vals) };
}

/** Party al ARRANCAR, leída de los bytes del `.gam` sembrado.
 *  Registro de 0x20 B con base `2 + i*0x20` (el fichero lleva dos bytes de cabecera);
 *  dentro del registro, `name` en +0x00 (9 B), `status` en +0x0b, `currentHp` en +0x10
 *  (u16le) y `partyStatus` en +0x1f — los offsets del parser del port
 *  (`core/saveNative.ts:232-254`), y la party son los `partyStatus === 0`
 *  (`core/party.ts:172`). Careado contra la auditoría: part23 = 6 miembros a D:0,
 *  part01 = 3/3 vivos, part13 = 4 vivos de 6. */
function leeParty(f) {
  if (!existsSync(f)) return null;
  const b = readFileSync(f);
  const out = [];
  for (let i = 0; i < 16; i++) {
    const base = 2 + i * 0x20;
    if (base + 0x20 > b.length) break;
    if (b[base + 0x1f] !== 0) continue;
    const nul = b.indexOf(0, base);
    const nombre = b.toString("latin1", base, nul >= base && nul < base + 9 ? nul : base + 9).trim();
    out.push({ nombre, estado: String.fromCharCode(b[base + 0x0b]), hp: b.readUInt16LE(base + 0x10) });
  }
  return out.length ? out : null;
}

/** `existsSync` NO basta: `--eventos=/dev/null` existe y no es directorio, y `readdirSync`
 *  revienta con ENOTDIR sin que nada lo capture. Predicado explícito para las tres familias. */
const esDir = (d) => { try { return statSync(d).isDirectory(); } catch { return false; } };

const leeJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
const leeSidecar = (f) => (existsSync(f) ? parseSidecar(readFileSync(f, "utf8")) : null);

// ══════════════════════════════════════════════════════════════════════════════════════
// Recolección
// ══════════════════════════════════════════════════════════════════════════════════════

function censaEventos(dir) {
  if (!esDir(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".webm"))
    .sort()
    .map((f) => ({
      id: basename(f, ".webm"),
      coleccion: "eventos",
      video: join(dir, f),
      sidecarPath: join(dir, `${f}.log.jsonl`),
    }));
}

function censaReplays(dir) {
  if (!esDir(dir)) return [];
  const out = [];
  for (const sub of ["lp1", "ad", "e3"]) {
    const d = join(dir, sub);
    if (!esDir(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith(".webm")).sort()) {
      const id = basename(f, ".webm");
      out.push({
        id,
        coleccion: "replays",
        video: join(d, f),
        sidecarPath: join(d, `${f}.log.jsonl`),
        report: join(dir, "reports", `${id}.report.json`),
        gam: resolve(RAIZ, "game/e2e/espejo-tour/saves", `${id}.gam`),
      });
    }
  }
  return out;
}

/**
 * GRAND TOUR. La tabla de verdad del tour es su `results.tsv`
 * (`<capítulo>\t<VERDE|ROJO>\t<duración>\t<lista de .webm o SIN-VIDEO>`), escrita por la
 * propia corrida. De ahí salen tres cosas que el gate necesita y no puede deducir del
 * disco: a qué capítulo pertenece cada `.webm` (los sufijos `-2`, `-3`… son tests
 * distintos del MISMO capítulo), el estado del capítulo, y qué capítulo declara
 * legítimamente `SIN-VIDEO` (ch37-wrong-campos: su test no abre página).
 *
 * 🔴 El censo se hace por el TSV y NO por el listado de `.webm`: un vídeo que el TSV no
 * nombra es un huérfano —restos de otra corrida— y el gate lo dice en vez de auditarlo
 * como si fuese de esta tanda.
 */
function censaTour(dir) {
  const tsv = join(dir, "results.tsv");
  if (!existsSync(tsv)) return { items: [], capitulos: new Map(), sinVideo: [], huerfanos: [], vacuos: [] };
  const capitulos = new Map();
  const items = [];
  const sinVideo = [];
  const nombrados = new Set();
  for (const linea of readFileSync(tsv, "utf8").split("\n")) {
    if (!linea.trim()) continue;
    const [cap, estado, , videos = ""] = linea.split("\t");
    capitulos.set(cap, estado);
    const lista = videos.trim().split(/\s+/).filter(Boolean);
    if (!lista.length || lista[0] === "SIN-VIDEO") {
      sinVideo.push(cap);
      continue;
    }
    for (const v of lista) {
      nombrados.add(v);
      const f = join(dir, v);
      if (!existsSync(f)) continue;
      items.push({ id: basename(v, ".webm"), coleccion: "tour", capitulo: cap, estadoCap: estado, video: f, sidecarPath: `${f}.log.jsonl` });
    }
  }
  const huerfanos = esDir(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".webm") && !nombrados.has(f))
    : [];
  // ── VERDE VACUO POR SPEC SALTADA. Misma regla que `comprobar VACUO` en los replays y por
  // la misma razón: NO MEDIR no es PASAR. `ch37-wrong-campos` cuenta como VERDE en el 34/47
  // del tour y sus DOS tests están `describe.skip` («SUPERSEDED 2026-07-23 por ch37b-v2»);
  // su log cierra con `2 skipped` y no midió nada. El censo del lead confirma que hoy es el
  // ÚNICO spec entero saltado —la inflación es exactamente de uno—, pero la regla existe
  // para que el siguiente no pase inadvertido. El dato sale del log de playwright, que es
  // donde vive: `results.tsv` sólo dice VERDE/ROJO.
  const vacuos = [];
  for (const [cap, estado] of capitulos) {
    if (estado !== "VERDE") continue;
    const log = join(dir, "logs", `${cap}.log`);
    if (!existsSync(log)) continue;
    const t = readFileSync(log, "utf8");
    const pasados = Number(/(\d+)\s+passed/.exec(t)?.[1] ?? 0);
    const saltados = Number(/(\d+)\s+skipped/.exec(t)?.[1] ?? 0);
    if (pasados === 0) vacuos.push({ cap, pasados, saltados });
  }
  return { items, capitulos, sinVideo, huerfanos, vacuos };
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Ejecución
// ══════════════════════════════════════════════════════════════════════════════════════

const tour = censaTour(DIR_TOUR);
const items = [...censaEventos(DIR_EVENTOS), ...censaReplays(DIR_REPLAYS), ...tour.items].filter(
  (i) => !SOLO || i.id.includes(SOLO),
);
if (!items.length) {
  console.error(`gate: 0 vídeos en ${DIR_EVENTOS} / ${DIR_REPLAYS} — ¿rutas correctas?`);
  process.exit(2);
}

// Guarda default-DENY del propio fichero de expectativas (ver `verificaExpectativas`).
// Se ejecuta ANTES de medir: un gate cuyo criterio no está declarado no mide nada.
// `--parcial` (o `--solo`) apaga el censo: sobre un subconjunto, «declarado y ausente» no
// significa nada. Sobre la colección ENTERA sí, y por eso es el modo por defecto.
const problemasExp = SOLO || flag("parcial") ? [] : verificaExpectativas(EXPS, items.map((i) => i.id));

const filas = [];
for (const it of items) {
  const exp = resuelveExp(EXPS, it.id);
  exp.esReplay = it.coleccion === "replays";
  exp.esTour = it.coleccion === "tour";
  const crop = exp.crop ?? (exp.esReplay ? EXPS.crops.consola : EXPS.crops.panel);
  const probe = sondaProbe(it.video);
  const tramos = SIN_VIDEO || probe.durS == null ? null : sondaFreeze(it.video, crop);
  const cambios = SIN_VIDEO || probe.durS == null ? null : sondaCambios(it.video, probe.durS);
  const lum = SIN_VIDEO || probe.durS == null ? null : sondaLuminancia(it.video);
  const viewport =
    SIN_VIDEO || probe.durS == null ? null : sondaViewport(it.video, exp.cropViewport ?? EXPS.crops.viewport, probe.durS);
  const r = adjudica({
    id: it.id,
    exp,
    sidecar: leeSidecar(it.sidecarPath),
    probe,
    tramos,
    report: it.report ? leeJson(it.report) : null,
    party: it.gam ? leeParty(it.gam) : null,
    capitulo: it.estadoCap ?? null,
    cambios,
    lum,
    viewport,
  });
  r.capitulo = it.capitulo ?? null;
  r.coleccion = it.coleccion;
  r.conSidecar = existsSync(it.sidecarPath);
  filas.push(r);
  process.stderr.write(".");
}
process.stderr.write("\n");

// ── tabla
const ORDEN = ["INTEGRIDAD", "COHERENCIA", "DEBE", "PROHIBIDO", "CIERRE", "PARADA", "COLA", "RITMO", "PARADA-VIS", "COLA-VIS", "COLA-VP", "VACUO", "PARTY", "CAP", "VELOCIDAD", "LEGIBLE", "INFO"];
const glifo = (e) => (e === OK ? "·" : e === FALLO ? "X" : e === AMBAR ? "~" : "?");
const w = Math.max(...filas.map((f) => f.id.length), 10);
const porCol = (c) => filas.filter((f) => f.coleccion === c).length;
console.log(
  `\nGATE DE VÍDEOS — ${filas.length} vídeos: ${porCol("eventos")} eventos · ${porCol("replays")} replays · ${porCol("tour")} grand tour`,
);
console.log(`leyenda: · OK   X FALLO   ~ ÁMBAR (legibilidad: no tumba nada)   ? SIN-DATO (no medido: NO es verde)   S=sidecar\n`);
console.log(`${"vídeo".padEnd(w)} S ${ORDEN.map((c) => c.slice(0, 4).padEnd(4)).join(" ")}  veredicto`);
console.log("-".repeat(w + 2 + ORDEN.length * 5 + 12));
for (const f of filas) {
  const by = Object.fromEntries(f.checks.map((c) => [c.id, c.estado]));
  const cols = ORDEN.map((c) => glifo(by[c] ?? SIN_DATO).padEnd(4)).join(" ");
  console.log(`${f.id.padEnd(w)} ${f.conSidecar ? "S" : " "} ${cols}  ${f.veredicto}`);
}

console.log("\n── DETALLE DE FALLOS ──");
let nFallos = 0;
for (const f of filas) {
  if (!f.fallos.length) continue;
  nFallos++;
  console.log(`\n${f.id}:`);
  for (const c of f.fallos) console.log(`   X ${c.id.padEnd(11)} ${c.detalle}`);
}
if (!nFallos) console.log("(ninguno)");

// ── ÁMBAR: LEGIBILIDAD. Clase APARTE por decisión del usuario y por eso va en su propia
// sección y NO cuenta para el código de salida: un vídeo demasiado rápido no está roto
// (su estado lo asserta el capítulo/el reporte), es que no se puede ver. La tabla la
// consume el carril del MODO CINEMÁTICO, así que se imprime ordenada por lo más rápido
// primero y con la cifra cruda de s/op delante.
const ambares = filas.filter((f) => f.ambar.length);
const vel = (f) => f.checks.find((c) => c.id === "VELOCIDAD");
console.log(`\n── ÁMBAR · VELOCIDAD (${ambares.length}/${filas.length}) ──`);
console.log(`   suelo: 1,83 s/op = lo más rápido que fue el humano MÁS rápido del corpus LP1 (derivación en gate-core.mjs)`);
console.log(`   ordenado de más rápido a menos. Las dos listas van SEPARADAS porque la unidad no es la misma.`);
const leg = (f) => f.checks.find((c) => c.id === "LEGIBLE");
const conTeclas = ambares.filter((f) => vel(f)?.sPorOp != null);
console.log(`\n   A · s/TECLA — unidad del corpus, sólo donde hay sidecar (el múltiplo es afirmable) — ${conTeclas.length}`);
for (const f of conTeclas.sort((x, y) => vel(x).sPorOp - vel(y).sPorOp))
  console.log(`     ~ ${f.id.padEnd(w)} ${vel(f).detalle}`);
if (!conTeclas.length) console.log("     (ninguno)");
const ilegibles = ambares.filter((f) => leg(f)?.estado === AMBAR && leg(f)?.cambiosS != null);
console.log(`\n   B · CAMBIOS DE PANTALLA/s — funciona sin sidecar; ilegible ≥ 10 (ancla: ch17-doom-5 va a 3,1) — ${ilegibles.length}`);
for (const f of ilegibles.sort((x, y) => (leg(y).cambiosS ?? 0) - (leg(x).cambiosS ?? 0)))
  console.log(`     ~ ${f.id.padEnd(w)} ${leg(f).detalle}`);
if (!ilegibles.length) console.log("     (ninguno)");
const cortos = ambares.filter((f) => vel(f)?.estado === AMBAR && vel(f)?.sPorOp == null);
console.log(`\n   C · CLIPS DEMASIADO CORTOS (< 5 s: no caben 2 ops a ritmo humano) — ${cortos.length}`);
if (cortos.length) console.log(`     ${cortos.map((f) => f.id).join(" ")}`);

// ── SIN INFORMACIÓN. Sección propia (no enterrada entre los ámbares de velocidad) porque
// es OTRA pregunta: aquellos van demasiado rápido para verse, éstos no enseñan nada en
// absoluto. Se marcan aunque su test sea VERDE, que es justo lo que el encargo pedía.
const sinInfo = filas
  .map((f) => ({ f, c: f.checks.find((x) => x.id === "INFO") }))
  .filter((x) => x.c?.estado === AMBAR);
console.log(`\n── SIN INFORMACIÓN (${sinInfo.length}/${filas.length} vídeos que no enseñan lo que su test hace) ──`);
for (const clase of ["LIENZO-EN-BLANCO", "MODAL-ATENUADO"]) {
  const g = sinInfo.filter((x) => x.c.clase === clase);
  console.log(`   ${clase} — ${g.length}${g.length ? `: ${g.map((x) => x.f.id).join(" ")}` : ""}`);
}
if (!sinInfo.length) console.log("   (ninguno)");

// SIN-DATO agregado: es el mapa de lo que el gate NO está midiendo hoy. Se imprime
// SIEMPRE y agregado por comprobación, porque un hueco disperso por 67 filas no se ve.
const huecos = new Map();
for (const f of filas) for (const c of f.sinDato) huecos.set(c.id, (huecos.get(c.id) ?? 0) + 1);
console.log("\n── SIN-DATO (lo que el gate NO midió) ──");
for (const [k, n] of [...huecos].sort((a, b) => b[1] - a[1])) console.log(`   ? ${k.padEnd(11)} ${n}/${filas.length}`);

// ── GRAND TOUR: lo que sólo su `results.tsv` sabe.
if (tour.capitulos.size) {
  const rojos = [...tour.capitulos].filter(([, e]) => e !== "VERDE").map(([c]) => c);
  console.log(`\n── GRAND TOUR (${tour.capitulos.size} capítulos) ──`);
  console.log(`   capítulos ROJOS (adjudicados en grandtour/index.md — NO se re-fichan): ${rojos.length}${rojos.length ? ` · ${rojos.join(" ")}` : ""}`);
  console.log(`   capítulos declarados SIN-VIDEO: ${tour.sinVideo.length ? tour.sinVideo.join(" ") : "ninguno"}`);
  console.log(
    `   VERDES VACUOS (cuentan como VERDE y NO EJECUTARON ni un test — no medir no es pasar): ${
      tour.vacuos.length ? tour.vacuos.map((v) => `${v.cap} (${v.saltados} skipped, 0 passed)`).join(" · ") : "ninguno"
    }`,
  );
  if (tour.huerfanos.length)
    console.log(`   ⚠ .webm en disco que el results.tsv NO nombra (restos de otra corrida): ${tour.huerfanos.join(" ")}`);
}

if (problemasExp.length) {
  console.log("\n── EXPECTATIVAS SIN DECLARAR (default-deny) ──");
  for (const p of problemasExp) console.log(`   ! ${p}`);
}

// ── SALIDA PARA EL CARRIL DEL MODO CINEMÁTICO. TSV plano y ordenado de más rápido a menos:
// `id · colección · duración · ops · unidad · s_por_op · homologa · veredicto`. Va aparte del
// `--json` a propósito — quien sólo quiere saber qué vídeos hay que ralentizar no debería
// tener que atravesar el veredicto completo, y `homologa` viaja en su propia columna para
// que nadie mezcle un s/tecla con un s/estado en la misma ordenación.
const VELOUT = arg("velocidad-tsv", "");
if (VELOUT) {
  const filasVel = filas
    .map((f) => ({ f, v: f.checks.find((c) => c.id === "VELOCIDAD") }))
    .filter((x) => x.v)
    .sort((a, b) => (a.v.sPorOp ?? -1) - (b.v.sPorOp ?? -1));
  const cab = "id\tcoleccion\tdur_s\tops\tunidad\ts_por_op\thomologa\tveredicto_velocidad\n";
  const cuerpo = filasVel
    .map(({ f, v }) => {
      const m = /\((\d+) ([^)]+) en ([0-9.]+) s\)/.exec(v.detalle);
      return [
        f.id,
        f.coleccion,
        m ? m[3] : "",
        m ? m[1] : "",
        v.homologa === false ? "estado" : "tecla",
        v.sPorOp == null ? "" : v.sPorOp.toFixed(3),
        v.homologa === false ? "no" : "si",
        v.estado,
      ].join("\t");
    })
    .join("\n");
  writeFileSync(VELOUT, cab + cuerpo + "\n");
  console.log(`\nvelocidad (para el carril cinemático): ${VELOUT} — ${filasVel.length} filas, suelo 1.83 s/op`);
}

const JSONOUT = arg("json", "");
if (JSONOUT) {
  writeFileSync(JSONOUT, JSON.stringify({ generado: new Date().toISOString(), filas, problemasExp }, null, 2));
  console.log(`\njson: ${JSONOUT}`);
}

const conFallo = filas.filter((f) => f.veredicto === FALLO).length;
console.log(
  `\nRESUMEN: ${filas.length - conFallo}/${filas.length} sin FALLO · ${conFallo} con FALLO · ` +
    `${ambares.length} en ÁMBAR (legibilidad, no cuentan para el exit) · ` +
    `${filas.filter((f) => f.conSidecar).length} con sidecar · ${problemasExp.length} expectativas sin declarar`,
);
process.exit(flag("laxo") ? 0 : conFallo || problemasExp.length || tour.vacuos.length ? 1 : 0);
