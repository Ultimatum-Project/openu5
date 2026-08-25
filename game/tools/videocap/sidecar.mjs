/**
 * SIDECAR DE GRABACIÓN — el transcript EXACTO de lo que el juego escribió mientras se
 * grababa el vídeo, alineado con el metraje. Carril `gate-videos`.
 *
 * ── POR QUÉ NO OCR ───────────────────────────────────────────────────────────────────
 * La pregunta del encargo era «¿cómo garantizo que los vídeos están bien?». La respuesta
 * barata sería OCR sobre el .webm; la respuesta CORRECTA es que el dato ya existe SIN
 * ruido en la fuente: el port emite cada fila de consola por un embudo único
 * (`CoreViewImpl.pushConsole`, `main.ts:810` — los ~60 call sites de `hud.message` pasan
 * por ahí) y ya está expuesto al arnés como `__u5test.consoleLines()` (`main.ts:3493`).
 * Un OCR mediría lo mismo peor: introduce una tasa de error propia (el corpus del espejo
 * lleva `ocrGarbage`/`ocrPartial` como categorías de primera clase por eso mismo) sobre
 * un canal que aquí es exacto.
 *
 * ── QUÉ PRODUCE ──────────────────────────────────────────────────────────────────────
 * `<video>.log.jsonl` — una línea JSON por registro:
 *   {"kind":"meta", video, evento, piel, arnes, sha, t0Wall, iso, viewport}
 *   {"kind":"line",  t, text}    ← fila de consola NUEVA (t = s desde el inicio del vídeo)
 *   {"kind":"key",   t, key}     ← tecla que el arnés pulsó (keydown en captura sobre window)
 *   {"kind":"state", t, s}       ← huella de estado (loc,floor,x,y,hora,oro,vivos) al CAMBIAR
 *   {"kind":"end",   t, razon}
 *
 * ── EL ANCLA DE TIEMPO ES NODE-SIDE, Y ES DELIBERADO ─────────────────────────────────
 * `addInitScript` se re-ejecuta EN CADA NAVEGACIÓN y el `window` se reconstruye: un
 * contador page-side se pondría a cero al navegar y los tiempos dejarían de ser los del
 * vídeo. Por eso el instante 0 se toma en NODE, justo tras `newContext/newPage` (que es
 * cuando Playwright abre el `.webm`), y la página sella cada registro con `Date.now()`
 * ABSOLUTO; el volcado resta. Consecuencia declarada: las filas emitidas ANTES de la
 * última navegación se pierden — en los dos arneses eso es el arranque del juego, antes
 * de que el guion empiece, y el alineamiento con el metraje se conserva igual.
 *
 * ── SIN ALTERAR LA CONDUCTA GRABADA ──────────────────────────────────────────────────
 * Sólo `addInitScript` (un `setInterval` de 35 ms que LEE y un `keydown` pasivo en fase
 * de captura que no llama a `preventDefault`). Cero teclas, cero esperas, cero cambios de
 * estado. El dedupe por solape máximo es EL MISMO algoritmo que `armAccumulator`
 * (`e2e/espejo-tour/runner.ts:1295`), que lleva la cadena entera del espejo detrás: la
 * consola es una VENTANA de N filas, así que hay que reconstruir el flujo por solape y
 * tratar el crecimiento de la última fila (`messageAppend`) como reescritura, no como
 * fila nueva.
 */
import { writeFileSync } from "node:fs";

/** Poll del acumulador, en ms. Igual que `armAccumulator` (runner.ts:1327) — el valor ya
 *  está validado por la cadena del espejo contra los eco/prompt más rápidos del port. */
export const POLL_MS = 35;

/**
 * Instala el acumulador page-side. Llamar ANTES de la primera navegación.
 * Idempotente por página (el guard `__u5cap` evita duplicar el intervalo si alguien lo
 * llama dos veces).
 */
export async function armSidecar(page) {
  await page.addInitScript(
    ({ poll }) => {
      const w = /** @type {any} */ (window);
      if (w.__u5cap) return;
      const cap = { lines: [], keys: [], states: [] };
      w.__u5cap = cap;
      // Teclas: fase de CAPTURA sobre window, pasivo. Es la misma capa que el registro de
      // teclas del carril ad06 (`armKeyLog`): el DOM es el único sitio donde el dato
      // existe sin preguntarle al propio guion qué cree que pulsó.
      window.addEventListener(
        "keydown",
        (e) => {
          if (cap.keys.length < 20000) cap.keys.push({ at: Date.now(), key: e.key });
        },
        true,
      );
      let prev = [];
      let prevState = "";
      setInterval(() => {
        const t = w.__u5test;
        if (!t) return;
        // ── huella de ESTADO (para la regla de PARADA: un hueco sin fila nueva NO es una
        //    parada si el mundo se movió — caminar en silencio es progreso).
        try {
          const g = t.game;
          const s = g?.state;
          if (s) {
            const p = s.position ?? {};
            const chars = s.characters ?? [];
            const vivos = chars.filter((c) => c && c.status !== "D").length;
            const huella = `${p.location ?? "?"}/${p.floor ?? "?"}/${p.x ?? "?"},${p.y ?? "?"}|${s.time?.hour ?? "?"}:${s.time?.minute ?? "?"}|g${s.gold ?? "?"}|v${vivos}/${chars.length}`;
            if (huella !== prevState) {
              prevState = huella;
              if (cap.states.length < 20000) cap.states.push({ at: Date.now(), s: huella });
            }
          }
        } catch {
          /* el estado aún no existe (boot): no es un fallo del instrumento */
        }
        // ── filas de CONSOLA (dedupe por solape máximo — calco de armAccumulator)
        if (!t.consoleLines) return;
        const cur = t.consoleLines();
        if (cur.length === 0) return;
        let best = 0;
        const max = Math.min(prev.length, cur.length);
        for (let k = max; k > 0; k--) {
          let ok = true;
          for (let i = 0; i < k; i++) {
            const a = prev[prev.length - k + i];
            const b = cur[i];
            if (a === b) continue;
            if (i === k - 1 && b.startsWith(a)) continue;
            ok = false;
            break;
          }
          if (ok) {
            best = k;
            break;
          }
        }
        const now = Date.now();
        if (best > 0) {
          const grown = cur[best - 1];
          const last = cap.lines[cap.lines.length - 1];
          if (last && grown.startsWith(last.text) && grown !== last.text) {
            // `messageAppend`/`echoAppend`: la fila VIVA creció (p.ej. "Player: " + nombre).
            // Se reescribe en su sitio y se re-sella el tiempo: lo que importa para el gate
            // es CUÁNDO quedó completa la frase.
            last.text = grown;
            last.at = now;
          }
        }
        for (let i = best; i < cur.length; i++) {
          if (cap.lines.length < 50000) cap.lines.push({ at: now, text: cur[i] });
        }
        prev = cur;
      }, poll);
    },
    { poll: POLL_MS },
  );
}

/**
 * Lee el acumulador de la página (tolerante a que no exista: devuelve vacío).
 * Se lleva además la foto de los SUMIDEROS DE ENTRADA en el instante del corte
 * (`__u5test.inputSinks()`, main.ts:6261). Es lo que contesta «¿el vídeo termina con un
 * prompt abierto?» — tres de los once defectos de la tanda 22-08 eran exactamente eso
 * (healer×2 clavado en «What is the nature of thy need?», tienda en «Which would ye
 * see?»), y NINGÚN vocabulario de error los delata: un prompt abierto no imprime nada.
 */
export async function readSidecar(page) {
  return page.evaluate(() => {
    const w = /** @type {any} */ (window);
    const c = w.__u5cap;
    let sinks = null;
    try {
      sinks = w.__u5test?.inputSinks?.() ?? null;
    } catch {
      sinks = null;
    }
    return c ? { lines: c.lines, keys: c.keys, states: c.states, sinks } : { lines: [], keys: [], states: [], sinks };
  });
}

/**
 * Vuelca el sidecar a `destino` (.log.jsonl).
 * `t0Wall` = `Date.now()` tomado en NODE justo tras crear la página (= inicio del .webm).
 * Devuelve el nº de registros escritos.
 */
export function escribeSidecar(destino, { t0Wall, meta, datos, razonFin = "fin-guion" }) {
  const rel = (at) => Math.round(((at - t0Wall) / 1000) * 1000) / 1000;
  const out = [];
  out.push(JSON.stringify({ kind: "meta", t0Wall, iso: new Date(t0Wall).toISOString(), ...meta }));
  const evs = [
    ...datos.lines.map((l) => ({ kind: "line", t: rel(l.at), text: l.text })),
    ...datos.keys.map((k) => ({ kind: "key", t: rel(k.at), key: k.key })),
    ...datos.states.map((s) => ({ kind: "state", t: rel(s.at), s: s.s })),
  ];
  evs.sort((a, b) => a.t - b.t);
  for (const e of evs) out.push(JSON.stringify(e));
  out.push(JSON.stringify({ kind: "end", t: rel(Date.now()), razon: razonFin, sinks: datos.sinks ?? null }));
  writeFileSync(destino, out.join("\n") + "\n");
  return out.length;
}
