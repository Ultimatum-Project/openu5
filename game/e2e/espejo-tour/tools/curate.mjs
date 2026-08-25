#!/usr/bin/env node
/**
 * WALKTHROUGH-ESPEJO — curador de rutas (paso 2 del pipeline, tras segment.mjs).
 *
 * Transforma el BORRADOR `routes/partNN.route.json` en guion ejecutable:
 *
 *   1. Convierte los `todo` cuyo texto es un ECO DE COMANDO inequívoco del original
 *      (">Open-North", ">Talk-West", ">Klimb-Up!", ">Board Ship"…) en ops de teclado
 *      concretas ({key}, {face}). SOLO patrones inequívocos: lo demás queda como
 *      `todo` (el runner lo salta y lo cuenta — es la lista de calibración de Fase B).
 *   2. Convierte respuestas Y/N visibles en el eco del prompt ("watch? Yes",
 *      "Dost thou pay?N") en {key:"y"/"n"} pospuestas al prompt.
 *   3. Aplica el OVERLAY de curación manual `routes/overlays/partNN.json`
 *      (decisiones humanas: entry/checkpoint, fixes de ctx/enter, ops insertadas por
 *      ancla ocrLn — p.ej. las letras de menú de tienda, invisibles para el OCR —,
 *      flags calib y notas).
 *
 * Idempotente: re-correrlo sobre una ruta ya curada no duplica ops (los `todo`
 * convertidos desaparecen; las inserciones del overlay se marcan `src:"overlay"` y se
 * reponen desde cero en cada pasada).
 *
 * ## ★★ CINTURÓN DE ESCRITURA — curate ya NO puede des-skipear por efecto lateral
 *
 * «curate NUNCA borra; regenerar = INERTE» describía main `cc4a3b8a` y HOY ES FALSO: #43 ruling 2
 * le dio a `applyPatchKeys` el TOMBSTONE (`false` = «quita la clave»), que es exactamente la
 * capacidad de borrar. Medido sobre el corpus commiteado (ver `re/notes/curate-cablear-acta.md`):
 * una pasada de ESCRITURA sobre `routes-ad` borraba **63** `skip: "pendiente-runner"` en 19 rutas
 * —2142 B = 63 × 34 B, sin residuo— y salía con **exit 0**, sin nombrar ni uno.
 *
 * Desde aquí, TODA vía de escritura reconcilia antes de escribir: se compara la ruta EN DISCO con
 * la que esta pasada produciría (`camposPerdidos`, la MISMA función que arma el cinturón de
 * `apply-ledger-overlay.mjs` — no una réplica) y, si algún campo se iría, **aborta con exit 3
 * ANTES del writeFileSync**, nombrando cada pérdida. La medición corre SIEMPRE, fuera de todo
 * `if`: un cinturón metido en la rama del caso que preocupa es código muerto el día que el
 * defecto llega por otra.
 *
 * Lo que curate NO hace es adjudicar: los 63 pueden ser correctos (el clasificador tiene razón)
 * o no (la ruta la tiene). Con `--allow-desskip` se acepta la pérdida a sabiendas, y entonces la
 * salida enumera exactamente qué se pierde para que el mensaje del commit lo recoja.
 *
 * `--check` INFORMA y NO rompe (ruling #94: con divergencias preexistentes, un gate en rojo sólo
 * enseña a pasar la flag que lo apaga). La fatalidad vive donde está el daño: la escritura.
 *
 * Uso:  node e2e/espejo-tour/tools/curate.mjs [--routes <dir>] [--check] [--allow-stale]
 *                                             [--allow-desskip] <partNN> [...]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { segAnchor } from "./anchor.mjs";
import { applyPatchKeys, insertAt, camposPerdidos, clavesVigiladas } from "./overlay-merge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
/** --routes <dir>: directorio de rutas alternativo (corpus paralelo, p.ej. routes-ad). */
const argv = process.argv.slice(2);
const routesArg = argv.includes("--routes") ? argv.splice(argv.indexOf("--routes"), 2)[1] : "routes";
const ROUTES = routesArg.startsWith("/") ? routesArg : join(HERE, "..", routesArg);

// ★ FLAGS DESCONOCIDAS = ERROR, Y ANTES DE ESCRIBIR NADA. El filtro de part-ids de abajo es
// `argv.filter((a) => !a.startsWith("--"))`, que se traga en SILENCIO cualquier `--loquesea` y
// sigue adelante ESCRIBIENDO las rutas igual. Con la hermana `apply-ledger-overlay.mjs` estrenando
// `--verify`, la vía natural para perder los 63 es teclearlo AQUÍ: hoy eso no verifica nada, hace
// la pasada de escritura completa y dice que todo bien. Es la misma puerta que aquel fichero cerró
// en su auditoría del 01-08, en el script de al lado.
const FLAGS = ["--routes", "--check", "--allow-stale", "--allow-desskip"];
const desconocidas = argv.filter((a) => a.startsWith("--") && !FLAGS.includes(a));
if (desconocidas.length) {
  console.error(`flag no reconocida: ${desconocidas.join(", ")}`);
  console.error(`uso: curate.mjs [${FLAGS.join("] [")}] <partNN>...`);
  console.error("(no se ha tocado ninguna ruta.)");
  process.exit(1);
}

const ARROW = { North: "ArrowUp", South: "ArrowDown", East: "ArrowRight", West: "ArrowLeft" };
/** letra de comando por eco (0↔O del OCR ya tolerado por la regex del caller) */
const CMD_KEY = {
  open: "o", search: "s", look: "l", get: "g", push: "p", jimmy: "j",
  talk: "t", attack: "a", fire: "f", klimb: "k", view: "v",
};

/** Convierte el texto de un `todo` en ops concretas, o null si no es inequívoco. */
function todoToOps(text) {
  const t = text.replace(/0/g, "O").replace(/\]/g, "l");
  const ops = [];
  // eco direccional completo: "Open-North …", "Talk-West …", "Search-East …"
  const m = /^>?\s*(Open|Search|Look|Get|Push|Jimmy|Talk|Attack|Fire|View)-(North|South|East|West)\b/i.exec(t);
  if (m) {
    ops.push({ key: CMD_KEY[m[1].toLowerCase()] }, { key: ARROW[m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()] });
  } else if (/^>?\s*Klimb-/i.test(t)) {
    ops.push({ key: "k" });
    if (/Klimb-(Up|Down)/i.test(t)) {
      // single-vía: la dirección la resuelve el juego; el eco confirma cuál fue
    } else {
      const d = /Klimb-(North|South|East|West)/i.exec(t);
      if (d) ops.push({ key: ARROW[d[1]] });
    }
  } else if (/^>?\s*Board /i.test(t)) ops.push({ key: "b" });
  else if (/^>?\s*X-it /i.test(t)) ops.push({ key: "x" });
  else if (/^>?\s*Ignite torch/i.test(t)) ops.push({ key: "i" });
  else if (/^>?\s*Z-stats/i.test(t)) ops.push({ key: "z" }, { key: "Escape" });
  else if (/^>?\s*Pass\b/i.test(t)) ops.push({ key: " " });
  else if (/^>?\s*Escape!/i.test(t)) ops.push({ key: "Escape" });
  else if (/^>?\s*Cast\.\.\./i.test(t)) ops.push({ key: "c" });
  else if (/^>?\s*Yell what/i.test(t)) ops.push({ key: "y" });
  else if (/^>?\s*Set active plr/i.test(t)) ops.push({ todoKeep: t.slice(0, 40) }); // política de combate del runner
  else return null;
  // respuesta Y/N visible en el MISMO bloque ("… watch? Yes", "Dost thou pay?N")
  const yn = /\?\s*"?\s*(Yes|No|Y|N)\s*[.!]?\s*$/.exec(t);
  if (yn) ops.push({ key: yn[1][0].toLowerCase() === "y" ? "y" : "n" });
  return ops;
}

/** Respuesta Y/N suelta en un todo no convertible (prompt + answer sin eco de comando). */
function ynOnly(text) {
  const yn = /\?\s*"?\s*(Yes|No)\s*[.!]?\s*$/.exec(text);
  return yn ? [{ key: yn[1][0].toLowerCase() === "y" ? "y" : "n" }] : null;
}

function curate(partId, { check = false, allowStale = false, allowDesskip = false } = {}) {
  const routePath = join(ROUTES, `${partId}.route.json`);
  // Se lee UNA vez y se reusa para las tres cosas (ruta a mutar, foto «antes» del cinturón y
  // testigo de DERIVA). Antes se leía dos veces —aquí y otra vez al calcular la deriva—, y dos
  // lecturas del mismo fichero en momentos distintos pueden discrepar: el cinturón mediría contra
  // un estado y el aviso contra otro.
  const enDisco = readFileSync(routePath, "utf8");
  const route = JSON.parse(enDisco);
  /** Foto ANTES de tocar nada. El cinturón se mide contra ESTO, no contra una predicción. */
  const antes = JSON.parse(enDisco);
  const ovPath = join(ROUTES, "overlays", `${partId}.json`);
  const overlay = existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, "utf8")) : {};

  if (overlay.entry) route.entry = overlay.entry;
  if (overlay.ledger) route.ledger = overlay.ledger;

  // --- GUARDA DE HUELLA: censo ANTES de aplicar nada ---
  const seen = new Set();
  const stale = [];
  let anchored = 0;
  let unanchored = 0;
  for (const seg of route.segments) {
    const p = overlay.segments?.[seg.id];
    if (!p) continue;
    seen.add(seg.id);
    if (p.anchor === undefined) {
      unanchored++;
      continue;
    }
    anchored++;
    if (p.anchor !== segAnchor(seg)) stale.push(seg.id);
  }
  // claves del overlay que ya no corresponden a NINGÚN segmento (huérfanas)
  const orphans = Object.keys(overlay.segments ?? {}).filter((k) => !seen.has(k));

  let converted = 0;
  let residual = 0;
  let dropped = 0;
  for (const seg of route.segments) {
    const raw = overlay.segments?.[seg.id] ?? {};
    // Un patch RANCIO no se aplica: sus decisiones describen otro segmento.
    const patch = stale.includes(seg.id) ? {} : raw;
    // "skip":"pendiente-runner" marca segmentos con contexto que el runner AÚN no
    // reproduce (salas de mazmorra, klimb entre plantas, gemas de mazmorra). Lo lleva
    // el route.json como dato; el guard del runner que lo honra es trabajo de Fase B.
    // #43 ruling 2 — LAS DOS POLARIDADES. Antes esto sólo sabía ASIGNAR, así que un overlay que
    // dejaba de traer `skip` no lo quitaba de la ruta: las bajas del fix de #32 no se propagaban
    // POR CONSTRUCCIÓN, y regenerar overlays era demostrablemente inerte (A/B/C de la fase 1:
    // curate con overlays viejos y con overlays regenerados daba el MISMO censo, 97/289).
    // El contrato (ausente / tombstone / valor) vive en overlay-merge.mjs.
    applyPatchKeys(seg, patch);

    const out = [];
    for (const op of seg.script) {
      // Toda la FAMILIA `overlay*` se retira y se repone abajo desde el overlay (idempotencia).
      // Antes sólo se retiraba `"overlay"` exacto, y eso dejaba viva una etiqueta huérfana:
      // `part05-g05` llevaba 7 ops con `src: "overlay-timing"` que NINGUNA herramienta del repo
      // emite (#43: artefacto sin productor, interleadas a mano entre las del overlay). Al
      // plegarlas dentro del `insertOps` del overlay, si no se retiraran aquí saldrían por
      // duplicado. `op.src` no tiene ni un lector fuera de este fichero — es metadato de
      // idempotencia, así que renombrarlas a `overlay` no cambia conducta.
      if (String(op.src ?? "").startsWith("overlay")) continue;
      // keywords tecleadas: corrige confusiones OCR 0↔O/1↔I cuando hay letras mezcladas
      // (":C0RVETTE"→CORVETTE, ":AN N0X"→AN NOX); las cifras puras (cantidades) se quedan
      for (const f of ["typed", "typedMantra"]) {
        if (op[f] && /[A-Z]/.test(op[f]) && /[01]/.test(op[f]))
          op[f] = op[f].replace(/0/g, "O").replace(/1/g, "I");
      }
      if (op.todo === undefined) {
        out.push(op);
        continue;
      }
      const ops = todoToOps(op.todo) ?? ynOnly(op.todo)?.map((o) => ({ ...o, ynFrom: op.todo.slice(0, 30) }));
      if (ops) {
        converted++;
        for (const o of ops) out.push({ ...o, ocrLn: op.ocrLn });
      } else {
        residual++;
        out.push(op);
      }
    }
    // ── `dropOps`: LA POLARIDAD QUE LE FALTABA A `insertOps` (carril `fenton-curacion`).
    //
    // POR QUÉ EXISTE. El colapso de rachas de tecleo de `segment.mjs` exigía DOS cosas a la
    // vez: que los dos eventos `typed` fueran ADYACENTES en `deduped` y que uno fuera PREFIJO
    // del otro. Las dos se rompen con un OCR que pierde fotogramas intermedios, y entonces UNA
    // sola pulsación de getstring del LP salía de la ruta como VARIOS `typed` — o sea varios
    // Yell/Cast REALES en el port donde el LP hizo uno. Medido en `lf30` (Lord Fenton): 11
    // `typed` para 4 getstring del LP.
    // El arreglo GENERAL —racha tolerante a huecos acotada por PROMPT/eco— YA VIVE en
    // `segment.mjs` (`computeRachaGroups`, carril fix-tecleos-parciales; medido: −853 `typed`
    // re-segmentando los dos corpus). `dropOps` sigue siendo el canal para retirar por
    // DECLARACIÓN DE EPISODIO lo que ninguna regla general debe decidir.
    //
    // CONTRATO. `dropOps: [{ ocrLn, has, why }]` retira las ops cuyo `ocrLn` coincide Y que
    // llevan la clave `has` (p.ej. `"typed"`). `why` es obligatorio y sólo documenta. Es
    // ADITIVO y por tanto INERTE para todo overlay que no lo traiga: el censo sobre los 49
    // overlays de `routes/` y `routes-ad/` da CERO ocurrencias de la clave (control positivo:
    // 15 los traen de `insertOps`).
    //
    // 🔴 Va DESPUÉS de la conversión de `todo`→ops y ANTES de `insertOps`, a propósito: sobre
    // las ops ya convertidas (para poder retirar también lo que salió de un `todo`) y antes de
    // insertar (para que una inserción anclada en la misma `ocrLn` no se retire a sí misma).
    for (const d of patch.dropOps ?? []) {
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].ocrLn === d.ocrLn && out[i][d.has] !== undefined) {
          out.splice(i, 1);
          dropped++;
        }
      }
    }
    // inserciones del overlay, ancladas por ocrLn (después de la última op ≤ ancla)
    // #43 ruling 3: la regla de colocación vive en overlay-merge.mjs (con su derivación y el
    // porqué de que el defecto histórico NO se toque). `ins.at: "first"` es el opt-in explícito.
    for (const ins of patch.insertOps ?? []) {
      const at = insertAt(out, ins.afterOcrLn, ins.at);
      out.splice(at, 0, ...ins.ops.map((o) => ({ ...o, src: "overlay", ocrLn: ins.afterOcrLn })));
    }
    seg.script = out;

    // clases de expect por overlay (por ocrLn exacta)
    for (const [lnStr, cls] of Object.entries(patch.expectClass ?? {})) {
      const b = seg.expect.find((e) => e.ocrLn === Number(lnStr));
      if (b) b.class = cls;
    }
  }
  const produced = JSON.stringify(route, null, 2) + "\n";
  // ★ #94 — DERIVA: ¿la ruta COMMITEADA es la salida de este pipeline HOY? Hasta ahora
  // `--check` calculaba la ruta y la TIRABA (sólo censaba rancias/huérfanas), así que era
  // ciego justo al defecto que motiva esta comprobación: un artefacto versionado cuyo
  // productor existe pero cuya salida ya no coincide (la deriva se descubrió por accidente,
  // al correr sin --check y ver el diff).
  //
  // #43 ruling 3 — se compara la SECUENCIA DE OPS, no los bytes. El byte-diff no discriminaba:
  // `part04` y `part05` salían marcadas con «173449 B en disco vs 173449 B producidos», el MISMO
  // tamaño, porque lo que cambiaba era el ORDEN de las ops (mismo multiset: 904 y 803, `Counter`
  // idéntico). Una cifra que sale igual en los dos lados de un aviso de deriva no informa de
  // nada. Ahora el aviso dice CUÁNTOS segmentos y CUÁNTAS ops difieren, y el byte-diff se
  // conserva sólo como dato secundario (cambia con el formato, no sólo con el guion).
  const onDisk = enDisco;
  // `src` se excluye a propósito: es metadato de idempotencia (nadie lo lee fuera de aquí), no
  // guion. Incluirlo haría que renombrar `overlay-timing` a `overlay` se leyera como 7 ops de
  // deriva cuando no cambia ni una tecla.
  const opSeq = (r) => r.segments.map((s) => (s.script ?? []).map((o) => JSON.stringify({ ...o, src: undefined })));
  let opDrift = null;
  {
    const before = opSeq(antes);
    const after = opSeq(route);
    let segs = 0;
    let ops = 0;
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      const a = before[i] ?? [];
      const b = after[i] ?? [];
      if (a.length === b.length && a.every((x, j) => x === b[j])) continue;
      segs++;
      ops += Math.abs(a.length - b.length) || a.filter((x, j) => x !== b[j]).length;
    }
    if (segs) opDrift = { segs, ops };
  }
  const drifted = onDisk !== produced;

  // ★★ CINTURÓN — «esta pasada NO borra campos de la ruta», ATADO en vez de supuesto.
  //
  // Se mide SIEMPRE, fuera de todo `if`: un cinturón dentro de la rama del caso que preocupa
  // (`if (patch.skip === false)`) es código muerto el día que la pérdida llegue por otra clave o
  // por otro mecanismo. Lo que se condiciona es la FATALIDAD, no la medición.
  //
  // Es `camposPerdidos` —la MISMA función que arma el cinturón de `apply-ledger-overlay.mjs`—
  // sobre la ruta EN DISCO contra la que esta pasada acaba de construir. No predice: compara el
  // resultado real. Y las claves vigiladas se DERIVAN del corpus (`clavesVigiladas`), no de
  // `PATCHABLE`: hoy dan lo mismo (63 = 63, medido sobre las 49 rutas), así que el ensanche es un
  // SEGURO contra la clave de mañana con coste medido de 0 falsos positivos, no un hallazgo.
  const perdidos = camposPerdidos(antes, route, clavesVigiladas(antes));

  if (perdidos.length && !check && !allowDesskip) {
    console.error(`\n★ ABORTADO SIN ESCRIBIR — ${partId}: esta pasada borraría ${perdidos.length} campo(s) de la ruta:`);
    for (const c of perdidos)
      console.error(
        `   ${c.motivo}  ${c.segId} · ${c.clave} = ${JSON.stringify(c.enRuta)}` +
          (c.motivo === "PISADO" ? ` → ${JSON.stringify(c.enOverlay)}` : "  (el overlay lo TOMBSTONEA)"),
      );
    console.error(
      `  El runner lee la RUTA, no el overlay: cada uno de éstos cambia lo que se EJECUTA.` +
        `\n  curate NO adjudica bajas. O se corrige el overlay (que es quien tombstonea), o se acepta` +
        `\n  la pérdida a sabiendas con --allow-desskip, ENUMERÁNDOLA en el mensaje del commit.` +
        `\n  (${partId} y las partes posteriores quedan SIN TOCAR.)`,
    );
    process.exit(3);
  }

  if (!check) writeFileSync(routePath, produced);
  const flag = stale.length || orphans.length || drifted || perdidos.length ? "  ★" : "";
  console.log(
    `${partId}: ${converted} todos→ops, ${residual} todos residuales (calibración Fase B)` +
      `${dropped ? `, ${dropped} ops RETIRADAS (dropOps)` : ""}` +
      ` · huella: ${anchored} con, ${unanchored} sin, ${stale.length} RANCIAS, ${orphans.length} huérfanas` +
      `${drifted ? ", DERIVA" : ""}${perdidos.length ? `, ${perdidos.length} CAMPOS PERDIDOS` : ""}${flag}`,
  );
  if (stale.length) console.log(`   RANCIAS (no aplicadas): ${stale.join(" ")}`);
  if (orphans.length) console.log(`   HUÉRFANAS (id inexistente): ${orphans.join(" ")}`);
  // Se nombran también en `--check` y bajo `--allow-desskip`: en el primero porque el ruling #94
  // manda INFORMAR sin romper, y en el segundo porque una pérdida aceptada a sabiendas hay que
  // poder copiarla al commit. Callarla en esos dos modos dejaría el des-skip esperando su turno.
  for (const c of perdidos)
    console.log(`   CAMPO PERDIDO: ${c.motivo}  ${c.segId} · ${c.clave} = ${JSON.stringify(c.enRuta)}`);
  if (drifted)
    console.log(
      `   DERIVA: la ruta commiteada NO es la salida de curate hoy — ` +
        (opDrift
          ? `${opDrift.segs} segmento(s) con GUION distinto, ${opDrift.ops} op(s)`
          : `el GUION es idéntico (sólo cambia formato/metadatos)`) +
        ` · ${onDisk.length} B en disco vs ${produced.length} B producidos.`,
    );
  return { stale: stale.length, orphans: orphans.length, anchored, unanchored, drifted };
}

// --check: no escribe, sólo censa la huella. --allow-stale: no rompe el gate.
// --allow-desskip: escribe A SABIENDAS aunque la pasada pierda campos de la ruta (los enumera).
const CHECK = argv.includes("--check");
const ALLOW_STALE = argv.includes("--allow-stale");
const ALLOW_DESSKIP = argv.includes("--allow-desskip");
const partIds = argv.filter((a) => !a.startsWith("--"));
let staleTotal = 0;
let orphanTotal = 0;
const drifted = [];
for (const p of partIds) {
  const r = curate(p, { check: CHECK, allowStale: ALLOW_STALE, allowDesskip: ALLOW_DESSKIP });
  staleTotal += r.stale;
  orphanTotal += r.orphans;
  if (r.drifted) drifted.push(p);
}
if (drifted.length && CHECK) {
  console.error(
    `\n★ DERIVA RUTA/PRODUCTOR (#94): ${drifted.length} ruta(s) commiteadas que NO son la` +
      ` salida de curate hoy: ${drifted.join(" ")}` +
      `\n  NO se re-genera automáticamente: una ruta puede llevar decisiones humanas que el` +
      `\n  productor de hoy no reproduce (ver #85). Se ADJUDICA una a una.`,
  );
}
if (staleTotal || orphanTotal) {
  console.error(
    `\n★ OVERLAY DESALINEADO: ${staleTotal} claves RANCIAS + ${orphanTotal} huérfanas.` +
      `\n  Las rancias NO se han aplicado (su huella describe otro segmento).` +
      `\n  Arreglo correcto: REGENERAR el overlay con su productor (mkoverlay-lp1.mjs),` +
      `\n  no re-atar claves a mano. Con --allow-stale se sigue adelante a sabiendas.`,
  );
  if (!ALLOW_STALE) process.exit(1);
}
