/**
 * GATE DE VÍDEOS — NÚCLEO PURO. Carril `gate-videos`.
 *
 * Aquí no hay `fs`, ni `ffmpeg`, ni red: sólo funciones de DATO A VEREDICTO. Es
 * deliberado y es lo que hace que el gate se pueda meter en la batería: `gate.mjs` (el
 * CLI) recoge la evidencia —sondas ffprobe/ffmpeg, sidecars, reportes del espejo, bytes
 * de los `.gam`— y este módulo la adjudica. Los testigos (`tests/videocap-gate.test.ts`)
 * ejercen ESTAS funciones contra fixtures que reproducen los defectos que los humanos ya
 * cazaron: cada comprobación nace con su CONTROL POSITIVO.
 *
 * ── LOS TRES PLANOS DE EVIDENCIA, Y POR QUÉ SON TRES ─────────────────────────────────
 *  · PLANO A — SIDECAR (`<video>.log.jsonl`): el transcript exacto del propio juego. Es
 *    el único que contesta «¿SALE en el vídeo el evento que el vídeo promete?», que es
 *    el fallo que se coló dos veces (resurrección: 16 s sin una línea `Resurrection!`;
 *    endgame: el vídeo se llama «absorción» y no imprime ni un `is absorbed!`).
 *  · PLANO B — VÍDEO (ffprobe/ffmpeg): funciona sobre CUALQUIER `.webm`, con sidecar o
 *    sin él. Contesta integridad y «¿se quedó la imagen parada?». Es el plano que audita
 *    el material heredado, que no tiene sidecar y no se va a regrabar para auditarlo.
 *    🔴 El plano B tiene DOS SUPERFICIES y durante mucho tiempo sólo se miró una: el
 *    PANEL de consola (`compruebaVisual`) y el VIEWPORT (`compruebaColaViewport`). Ver
 *    «LA SONDA QUE FALTABA» más abajo — medir la cola sobre el panel y no sobre la imagen
 *    es lo que obligó a parchear a mano dieciocho umbrales por caso.
 *  · PLANO C — ARTEFACTOS VECINOS: el `report.json` del espejo (comparable/conformity) y
 *    los bytes del `.gam` sembrado (party viva). Un replay puede estar perfecto de imagen
 *    y no haber MEDIDO NADA (part23/24: todos los segmentos SKIP) o arrancar con los seis
 *    miembros muertos — dos defectos que ni el vídeo ni el transcript ven.
 *
 * ── LA REGLA DE ORO DEL FICHERO ──────────────────────────────────────────────────────
 * Una comprobación que sólo puede salir VERDE no es una comprobación. Toda función de
 * aquí tiene, en el fichero de testigos, un fixture que la pone ROJA — derivado de un
 * defecto REAL de la colección, con su cita en `TABLA.md` / `VERIFICACION-EVENTOS.md` /
 * `TABLA-REPLAYS.md`.
 */

/**
 * ── LA SONDA QUE FALTABA: LA COLA SE MIDE SOBRE EL VIEWPORT ──────────────────────────
 * Carril `gate-viewport`. Hasta aquí las cuatro guardas de cola/parada (`COLA`, `PARADA`
 * sobre el sidecar; `COLA-VIS`, `PARADA-VIS` sobre el vídeo) miraban LA CONSOLA, y el
 * pago de la mayoría de los eventos está EN LA IMAGEN. Un clímax 100 % mudo —la inversión
 * del santuario, el bracket XOR del Códice, el sacrificio de Blackthorn, la aparición de
 * la acampada, los tres quakes + explosión del ritual del Shard— no escribe UNA SOLA FILA,
 * así que la sonda de consola lo lee como guion detenido. El fichero de expectativas lo
 * declaraba como caso único (`moongate-transit`: «el ÚNICO caso de la colección donde la
 * sonda de consola miente por diseño») y el carril `eventos-cine` midió que NO es único:
 * es la clase MAYORITARIA. La frase era datable — se escribió cuando todos los vídeos se
 * grababan con los seis pacers del port APAGADOS (`navigator.webdriver`), y entonces
 * ningún clímax duraba nada. Con los pacers vivos duran segundos.
 *
 * El parche era subir `colaMaxPct`/`paradaMaxS` A MANO, vídeo a vídeo: DIECIOCHO umbrales
 * por caso. El propio fichero lo declaraba interino («la comprobación que falta no es un
 * umbral, es una SONDA — una cola medida sobre el viewport»). Esto es esa sonda.
 *
 * QUÉ MIDE: la diferencia media entre fotogramas consecutivos del recorte del VIEWPORT
 * (`crop=760:800:0:0`), a RESOLUCIÓN COMPLETA. Un fotograma «tiene movimiento» si esa
 * media supera 0,35 — el mismo umbral que `sondaCambios` ya usa y que la auditoría del
 * Grand Tour validó en las dos direcciones.
 *
 * 🔴 A RESOLUCIÓN COMPLETA, Y ESO ES UNA CORRECCIÓN MEDIDA, NO UN GUSTO. La primera
 * versión llevaba `scale=160:100` copiado de `sondaCambios`; el remuestreo de 760×800 a
 * 160×100 (4,75× y 8×, sin prefiltrado) ALIASA el dither del códec y fabrica un valor
 * CONSTANTE de 6,2500 en tramos donde la diferencia real, leída con `bbox` a resolución
 * nativa, es de UN nivel de gris en una caja de 332×118 px — o sea, nada. Con ese
 * artefacto `blackthorn-captura-faithful` daba 0,04 s de cola donde la medida buena da
 * 2,84 s. Sin `scale`, la sonda reproduce EXACTO el instrumento del carril
 * `fx-ritual-shard`: máximo 38,2001 en `shadowlord-shard-faulinei-faithful` contra los
 * «máximo 38,2 (fiel)» que ese carril dejó escritos en `expectativas.json`.
 *
 * CONTROL DE PROCEDENCIA (que es lo que hace citable esta sonda): re-medidos con ella,
 * los cuatro `shadowlord-shard` dan 1,8 · 1,8 · 1,7 · 1,6 s de cola contra los
 * 1,66 · 1,86 · 1,70 · 1,62 s que `_shadowlordShard` declara — los cuatro dentro de ±0,15 s.
 * (La primera versión de esta sonda daba 1,68 · 1,84 · 1,72 · 1,64, o sea acuerdo a UN
 * fotograma; ese acuerdo era en parte FALSO — las dos medidas compartían el artefacto de
 * keyframe descrito abajo, que acorta la cola cuando un keyframe cae dentro de ella. Las
 * cifras de arriba son las corregidas, y la conclusión de aquel carril no se mueve.)
 * Y la cola de CONSOLA que este módulo calcula
 * reproduce clavados los porcentajes del fichero: shard 54/55/54/54, códice 38/37,
 * blackthorn-captura 34/34, shrine-donación 41, cámara 28/28, whirlpool 48.
 *
 * 🔴 Y LA SATURACIÓN POR ANIMACIÓN DE TERRENO, que es donde esta sonda MIENTE y por eso
 * se declara ella sola. Aviso del carril `grandtour-cine`: en `ch34-doom-r8-sceptre` hay
 * 40 s en los que el juego no hace NADA y la métrica de cambios/s marca 18,6 a pantalla
 * completa contra 0,6 en el panel — es la lava animándose sola. Medido con ESTA sonda,
 * ch34 tiene **74 % de fotogramas con movimiento** y el viewport no se queda quieto ni
 * 0,6 s en todo el clip; los cinco clímax mudos que piden el relevo están en **11-17 %**
 * y ch19-endgame (la pausa de lectura legítima) en 37 %. ⇒ cuando el fotograma MEDIANO ya
 * cuenta como movimiento (ocupación > 50 %), lo que la sonda llama «movimiento» es el
 * reloj de la animación y no la acción: la sonda se declara SATURADA, `COLA-VP` sale
 * SIN-DATO (que no es verde) y **el relevo NO se aplica** — los umbrales de consola
 * siguen mandando ahí. Nótese que no hace falta una constante nueva: «ocupación > 50 %»
 * es «la mediana supera el umbral de movimiento», el mismo 0,35.
 *
 * LO QUE ESTA SONDA NO PUEDE HACER, declarado: no distingue movimiento ÚTIL de movimiento
 * ambiental por debajo del umbral de saturación. El parpadeo de antorchas SÍ queda fuera
 * (medido: en la celda de `blackthorn-captura` el parpadeo va por debajo de 0,35 a
 * resolución completa), pero el agua animada de `naval-xit`/`cataratas` (27-29 % de
 * ocupación) cuenta como movimiento. Es el defecto simétrico del que tiene la sonda de
 * consola con el `>North` de paseo, y por el mismo motivo: distinguir ruido de contenido
 * es lo que un plano no puede hacer y el otro sí.
 */

/** Veredictos posibles de una comprobación. `SIN-DATO` NUNCA es verde: es «no se midió».
 *  `AMBAR` tampoco es verde ni rojo: es una clase APARTE, pedida por el usuario para la
 *  VELOCIDAD. Un vídeo demasiado rápido no está roto —el estado que asserta es correcto—
 *  pero es ilegible para un humano, así que no puede tumbar un aterrizaje y tampoco puede
 *  desaparecer de la tabla. El ámbar NO cuenta para el código de salida. */
export const OK = "OK";
export const FALLO = "FALLO";
export const SIN_DATO = "SIN-DATO";
export const AMBAR = "AMBAR";

/** @typedef {{ id: string, estado: OK|FALLO|SIN_DATO, detalle: string }} Check */

const check = (id, estado, detalle) => ({ id, estado, detalle });

// ══════════════════════════════════════════════════════════════════════════════════════
// Sidecar: parseo y derivados
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * Parsea el JSONL a `{ meta, eventos[], lines[], keys[], states[], fin }`.
 * Tolera líneas vacías; NO tolera JSON inválido (un sidecar corrupto es un fallo del
 * instrumento y debe verse, no tragarse).
 */
export function parseSidecar(texto) {
  const regs = texto
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => JSON.parse(s));
  const meta = regs.find((r) => r.kind === "meta") ?? {};
  const fin = regs.find((r) => r.kind === "end") ?? null;
  return {
    meta,
    fin,
    lines: regs.filter((r) => r.kind === "line"),
    keys: regs.filter((r) => r.kind === "key"),
    states: regs.filter((r) => r.kind === "state"),
    eventos: regs.filter((r) => r.kind !== "meta"),
  };
}

/** Texto plano del transcript, una fila por línea (para los predicados de contenido). */
export const transcript = (sc) => sc.lines.map((l) => l.text).join("\n");

/** ¿Es esta fila RUIDO DE NAVEGACIÓN? (eco de paso, bloqueo, pase de turno).
 *  Se usa para la COLA: el criterio humano fue «el último evento SIGNIFICATIVO», y
 *  `>North / Blocked! / >Pass` no es un evento — es el guion paseando. Es exactamente
 *  la razón por la que la sonda de estático NO delataba a los cuatro `shadowlord-shard`
 *  (25 s de paseo con la consola cambiando en cada paso, `VERIFICACION-EVENTOS.md` §6). */
export function esRuido(text, patronesRuido) {
  return patronesRuido.some((p) => new RegExp(p).test(text));
}

// ══════════════════════════════════════════════════════════════════════════════════════
// PLANO B-bis — el VIEWPORT (ver «LA SONDA QUE FALTABA» en la cabecera)
// ══════════════════════════════════════════════════════════════════════════════════════

/** Ocupación por encima de la cual la sonda de viewport se declara SATURADA: el
 *  fotograma mediano ya cuenta como movimiento, así que «se mueve» deja de informar.
 *  Derivada, no elegida: ch34-doom (40 s sin acción, lava animada) 74 % · los cinco
 *  clímax mudos 11-17 % · ch19-endgame 37 % · agua de naval/cataratas 43 %. */
export const OCUPACION_SATURA = 0.5;

/**
 * INSTANTES DE MOVIMIENTO REAL — de las muestras crudas de la sonda a la lista de instantes,
 * descontando el artefacto de KEYFRAME. Vive AQUÍ y no en el CLI a propósito: es la pieza
 * que decide qué cuenta como movimiento, o sea dato-a-veredicto, y necesita testigo.
 *
 * 🔴 POR QUÉ SE DESCUENTAN LOS KEYFRAMES. La primera versión de esta sonda medía, en SEIS
 * vídeos sin ninguna relación, un hueco muerto máximo de EXACTAMENTE 5,1 s. No es una
 * propiedad del material: es el intervalo de keyframe de la VP8 que graba Playwright (128
 * fotogramas = 5,12 s a 25 fps). Un keyframe re-codifica el cuadro entero y produce una
 * diferencia media de ~1,6-1,9 SOBRE CONTENIDO IDÉNTICO, muy por encima del umbral 0,35.
 * El daño era doble: `COLA-VP` no podía informar jamás una cola mayor que 5,12 s y, con el
 * suelo `colaMinS` en 5 s, sólo podía salir VERDE — la regla de oro de este fichero
 * prohíbe exactamente eso; y el relevo excusaba cualquier congelación del panel por larga
 * que fuese, porque el hueco «realmente muerto» salía siempre ≤ 5,1 s.
 *
 * CONTROL, sobre material real y con la cifra ya publicada por otro instrumento:
 * `ch15-underworld` está fichado en `compruebaInformacion` como «se queda 9,6 s de 11,3 en
 * un fotograma». Con el artefacto esta sonda medía 5,12 s; descontándolo mide 9,76 s.
 * Y `ch03-britain` (capítulo colgado, 180 s) pasa de 5,1 s a 25,8 s de quietud máxima.
 *
 * La ventana son DOS muestras —el keyframe y el fotograma siguiente—, medida a mano sobre
 * ch03: en los tramos quietos todo va ≤ 0,23 salvo ese par, que va a 1,63-1,91. Se descuenta
 * por TIEMPO (el contenedor dice dónde están los keyframes) y no por amplitud, para no tener
 * que suponer cuánto vale el artefacto.
 *
 * @param {number[]} ts instantes de cada muestra
 * @param {number[]} ys diferencia media de cada muestra
 * @param {number[]} kfs instantes de keyframe (del contenedor)
 * @param {{umbral?:number, paso?:number}} opts
 * @returns {number[]} instantes CON movimiento real
 */
export function instantesDeMovimiento(ts, ys, kfs = [], { umbral = 0.35, paso } = {}) {
  const dt = paso ?? (ts.length > 2 ? ts[1] - ts[0] : 0.04);
  const esKf = (x) => kfs.some((k) => x - k >= -dt / 8 && x - k <= dt * 1.25);
  const out = [];
  for (let i = 0; i < ts.length; i++) if (ys[i] > umbral && !esKf(ts[i])) out.push(ts[i]);
  return out;
}

/** ¿Puede este vídeo APOYARSE en la sonda de viewport para relevar a la de consola?
 *  Devuelve `null` cuando NO (sin sonda, o saturada) — y ese `null` es el que hace que
 *  el relevo no se aplique en vez de aplicarse a ciegas. Un solo sitio de decisión: si
 *  esta función miente, mienten las cuatro guardas a la vez y los testigos lo ven.
 *  @param {{n:number,ocupacion:number,tUltimoMov:number,quietos:{start:number,end:number}[]}|null} vp */
export function relevoViewport(vp) {
  if (!vp || !vp.n) return null;
  if (vp.ocupacion > OCUPACION_SATURA) return null;
  return { tMov: vp.tUltimoMov, quietos: vp.quietos ?? [] };
}

/**
 * El tramo MÁS LARGO de [a,b] en el que el VIEWPORT también estaba quieto.
 * Es la pieza que convierte «la consola lleva N s callada» en «no pasa nada hace N s»:
 * sin ella, los 14,4 s de panel congelado de `camp-aparicion` son un rojo, y son la
 * escena entera (la hoguera pintando). Sin relevo (`rel` nulo) devuelve el hueco ENTERO,
 * que es la conducta de antes de este carril — el fallo seguro es no relevar.
 */
export function huecoMuerto(a, b, rel) {
  if (!rel) return { largo: b - a, desde: a };
  let largo = 0;
  let desde = a;
  for (const q of rel.quietos) {
    const s = Math.max(a, q.start);
    const e = Math.min(b, q.end);
    if (e - s > largo) {
      largo = e - s;
      desde = s;
    }
  }
  return { largo, desde };
}

/**
 * COLA DEL VIEWPORT — «¿se quedó la IMAGEN quieta hasta el final?».
 * La comprobación que faltaba, y la única de la familia que funciona SIN sidecar (23 de
 * los 42 eventos no lo tienen). Los `_climaxMudo` la pasan por goleada: sus colas
 * realmente muertas son de 0,3 a 3,2 s (1-11 %) contra el 30 % / 5 s por defecto.
 *
 * 🔴 SIN-DATO, no OK, cuando la sonda está SATURADA: en un mapa con lava o agua animada
 * el viewport no se para nunca, la cola sale 0 por construcción y un verde ahí sería el
 * verde trivial que este fichero prohíbe en su regla de oro.
 */
export function compruebaColaViewport(vp, durS, { colaMaxPct = 30, colaMinS = 5 } = {}) {
  if (durS == null) return check("COLA-VP", SIN_DATO, "sin duración");
  if (!vp || !vp.n) return check("COLA-VP", SIN_DATO, "sin sonda de viewport");
  const pctOcup = (vp.ocupacion * 100).toFixed(0);
  if (vp.ocupacion > OCUPACION_SATURA)
    return check(
      "COLA-VP",
      SIN_DATO,
      `sonda SATURADA: el viewport cambia en el ${pctOcup} % de los fotogramas (animación de terreno) — la cola no es discriminante`,
    );
  const cola = durS - vp.tUltimoMov;
  const pct = (cola / durS) * 100;
  const d = `${cola.toFixed(1)} s / ${durS.toFixed(1)} s = ${pct.toFixed(0)} % quieto tras t=${vp.tUltimoMov.toFixed(1)} (ocupación ${pctOcup} %)`;
  return pct > colaMaxPct && cola > colaMinS
    ? check("COLA-VP", FALLO, `${d} (máx ${colaMaxPct} % / ${colaMinS} s)`)
    : check("COLA-VP", OK, d);
}

// ══════════════════════════════════════════════════════════════════════════════════════
// PLANO A — comprobaciones sobre el sidecar
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * DEBE CONTENER — las líneas firma del evento.
 * Sin esto, un vídeo puede estar libre de bloqueos y NO MOSTRAR LO QUE PROMETE. Es el
 * fallo del vídeo de resurrección (TABLA.md fila 1: «Shamino 0D TODO el vídeo — LA
 * RESURRECCIÓN NO OCURRE») y el de la absorción del endgame (VERIFICACION-EVENTOS.md
 * §4.3.b: «en el port no aparece ninguna línea `absorbed`»).
 */
export function compruebaDebe(sc, debe) {
  if (!debe?.length) return check("DEBE", SIN_DATO, "sin firmas declaradas");
  const txt = transcript(sc);
  const faltan = debe.filter((p) => !new RegExp(p).test(txt));
  return faltan.length
    ? check("DEBE", FALLO, `firma(s) AUSENTE(s): ${faltan.join(" · ")}`)
    : check("DEBE", OK, `${debe.length}/${debe.length} firmas presentes`);
}

/**
 * NO DEBE CONTENER — el vocabulario de toma fallida.
 * `permitido` declara excepciones POR VÍDEO con cupo: `{"Blocked!": 4}` = hasta cuatro
 * apariciones toleradas (p.ej. el pathing normal de un combate — la propia auditoría
 * distinguió «46 s de martilleo» de «4-5 apariciones sueltas normales»). Una excepción
 * sin justificar es una excepción que nadie revisa: el fichero de expectativas obliga a
 * escribir el porqué en `permitidoPorque`, y `verificaExpectativas` lo carea.
 */
export function compruebaProhibido(sc, prohibido, permitido = {}) {
  if (!prohibido?.length) return check("PROHIBIDO", SIN_DATO, "sin vocabulario declarado");
  const lineas = sc.lines.map((l) => l.text);
  const excesos = [];
  for (const tok of prohibido) {
    const n = lineas.filter((t) => t.includes(tok)).length;
    const cupo = permitido[tok] ?? 0;
    if (n > cupo) excesos.push(`«${tok}» ×${n}${cupo ? ` (cupo ${cupo})` : ""}`);
  }
  return excesos.length
    ? check("PROHIBIDO", FALLO, excesos.join(" · "))
    : check("PROHIBIDO", OK, `0 sobre ${prohibido.length} tokens`);
}

/**
 * PARADA — ningún hueco > N s sin fila nueva NI cambio de estado.
 * El «ni cambio de estado» es la mitad que evita el falso rojo: caminar en silencio o
 * esperar a que un pacer termine mueve el mundo aunque no escriba. Y es la mitad que
 * evita el falso VERDE del caso part04, donde el realce del roster ciclaba 63 s con la
 * consola idéntica: ahí tampoco cambia el estado (reloj congelado en `4-5-139`,
 * TABLA-REPLAYS.md §4.4), así que el hueco se cuenta entero.
 */
export function compruebaParada(sc, maxS, durS, hasta = Infinity, rel = null) {
  const marcas = [...sc.lines.map((l) => l.t), ...sc.states.map((s) => s.t)]
    .filter((t) => t <= hasta)
    .sort((a, b) => a - b);
  const fin = Math.min(sc.fin?.t ?? durS ?? 0, hasta);
  if (!marcas.length) return check("PARADA", SIN_DATO, "sidecar sin marcas");
  // 🔴 De cada hueco de consola sólo cuenta el tramo en que el VIEWPORT también estaba
  // quieto (ver «LA SONDA QUE FALTABA»). Sin esto, las escenas paceadas por el port —que
  // no escriben una fila mientras pintan— son un rojo, y ése era el origen de los cinco
  // `paradaMaxS` a mano. Con `rel` nulo (sin sonda o saturada) se cuenta el hueco entero,
  // que es exactamente la conducta anterior a este carril.
  let peor = 0;
  let desde = 0;
  const bordes = [0, ...marcas];
  for (let i = 1; i < bordes.length; i++) {
    const m = huecoMuerto(bordes[i - 1], bordes[i], rel);
    if (m.largo > peor) {
      peor = m.largo;
      desde = m.desde;
    }
  }
  const colaFinal = fin - marcas[marcas.length - 1];
  // La cola final NO entra aquí: la mide `compruebaCola`, que es la regla que le
  // corresponde. Contarla dos veces haría que un mismo defecto encendiese dos rojos y
  // el reporte sobre-declararía el nº de defectos.
  void colaFinal;
  const d = `mayor hueco ${peor.toFixed(1)} s @ t=${desde.toFixed(1)}`;
  return peor > maxS ? check("PARADA", FALLO, `${d} (máx ${maxS} s)`) : check("PARADA", OK, d);
}

/**
 * COLA MUERTA — el último evento SIGNIFICATIVO debe caer dentro del X % final.
 * Medidas que fijan el criterio (VERIFICACION-EVENTOS.md §6): whirlpool 72 %, cataratas
 * 70 %, shadowlord-shard 69 %, moongate-piedra 42 %. La cola de un vídeo bien cortado en
 * esa misma tabla anda por el 10-25 % (`dungeon-tesoro 12`, `blackthorn-camara 10`,
 * `combate 17-19`, `healer 23-24`) — de ahí el 30 % por defecto: deja pasar el hold
 * legítimo del final y no deja pasar «la mitad del clip es cola».
 */
export function compruebaCola(sc, maxPct, durS, patronesRuido, minS = 5, hasta = Infinity, rel = null) {
  const fin = Math.min(durS ?? sc.fin?.t ?? 0, hasta);
  if (!fin) return check("COLA", SIN_DATO, "sin duración");
  const sig = sc.lines.filter((l) => l.t <= hasta && !esRuido(l.text, patronesRuido));
  if (!sig.length) return check("COLA", FALLO, "NI UNA fila significativa en todo el clip");
  const ultima = sig[sig.length - 1];
  // La cola MUERTA es la que no paga en NINGUNO de los dos planos: se mide desde el
  // último de los dos relojes —la última fila significativa y el último movimiento de
  // imagen—, no desde el de consola a secas. Los dos se IMPRIMEN, para que la diferencia
  // (que es justo lo que un clímax mudo vale) quede a la vista en vez de desaparecer
  // dentro de un umbral levantado a mano.
  const consola = fin - ultima.t;
  const tPago = rel ? Math.max(ultima.t, Math.min(rel.tMov, fin)) : ultima.t;
  const cola = fin - tPago;
  const pct = (cola / fin) * 100;
  const relevo = rel && rel.tMov > ultima.t
    ? ` · consola callada desde t=${ultima.t.toFixed(1)} (${((consola / fin) * 100).toFixed(0)} %) pero el VIEWPORT pinta hasta t=${Math.min(rel.tMov, fin).toFixed(1)}`
    : "";
  const d = `${cola.toFixed(1)} s / ${fin.toFixed(1)} s = ${pct.toFixed(0)} % tras «${ultima.text.slice(0, 40)}»${relevo}`;
  // SUELO ABSOLUTO además del porcentaje. En un clip de 6 s (torch-borrowed) tres segundos
  // de despedida son el 60 % y NO son un defecto — el porcentaje es inestable abajo. El
  // suelo sale de la tabla medida: la cola más corta que la auditoría llegó a reprochar
  // fue whirlpool con 8,2 s, y todas las que rotuló «No» están en 2,6-5,4 s
  // (torch 2,6 · espejo-roto 2,7 · gema 3,0 · humo 3,2 · bad-taste 5,4). 5 s parte el hueco
  // y ahorra cuatro excepciones por-vídeo escritas a mano, que es lo que había antes aquí.
  return pct > maxPct && cola > minS ? check("COLA", FALLO, `${d} (máx ${maxPct} % / ${minS} s)`) : check("COLA", OK, d);
}

/**
 * RITMO LEGIBLE — para escenas de PROSA: cada página tiene que durar lo que se tarda en
 * leerla. Se mide sobre las TECLAS, no sobre la consola, y eso no es un atajo: las
 * páginas del desenlace son overlays a pantalla completa que NO escriben en consola, así
 * que el único rastro que dejan en la fuente es el avance del guion. Es además donde vive
 * la causa: `waitForTimeout(700)` fijo en la receta `endgame-absorcion`
 * (VERIFICACION-EVENTOS.md §4.3.a).
 *
 * El mínimo NO se inventa: sale del TESTIGO EA medido (2,60 / 3,10 / 3,80 s por página);
 * se declara 2,6 s = el más rápido que el original se permitió.
 */
export function compruebaRitmo(sc, ritmo) {
  if (!ritmo) return check("RITMO", SIN_DATO, "escena sin prosa declarada");
  const { tecla, minIntervaloS, minPulsaciones = 2, trasLinea } = ritmo;
  let desde = 0;
  if (trasLinea) {
    const m = sc.lines.filter((l) => new RegExp(trasLinea).test(l.text));
    if (!m.length) return check("RITMO", SIN_DATO, `no se alcanzó el marcador «${trasLinea}»`);
    desde = m[m.length - 1].t;
  }
  const ks = sc.keys.filter((k) => k.key === tecla && k.t >= desde).map((k) => k.t);
  if (ks.length < minPulsaciones)
    return check("RITMO", SIN_DATO, `sólo ${ks.length} pulsaciones de «${tecla}» tras t=${desde.toFixed(1)}`);
  const huecos = [];
  for (let i = 1; i < ks.length; i++) huecos.push(ks[i] - ks[i - 1]);
  const min = Math.min(...huecos);
  const media = huecos.reduce((a, b) => a + b, 0) / huecos.length;
  const d = `${huecos.length} páginas · min ${min.toFixed(2)} s · media ${media.toFixed(2)} s`;
  return min < minIntervaloS
    ? check("RITMO", FALLO, `${d} — ILEGIBLE (mín exigido ${minIntervaloS} s, del testigo EA)`)
    : check("RITMO", OK, d);
}

/**
 * CIERRE — el vídeo no puede acabar con un prompt/modal ABIERTO.
 * Tres de los once defectos de la tanda 22-08 eran justo esto y NINGÚN vocabulario de
 * error los delata (un prompt abierto no imprime nada): healer-flash ×2 «~5 s clavado en
 * `What is the nature of thy need?` ABIERTO» y tienda «~9 s clavado en `Which would ye
 * see?` sin contestar» (TABLA.md, clase `c`). La foto la da `__u5test.inputSinks()` en el
 * instante del corte — el MISMO hook que el arnés usa para no teclear a ciegas.
 * Los sumideros a RELOJ DE PARED (camping, moongate, endgame…) NO cuentan: son escenas
 * legítimas en curso, no un guion colgado.
 */
export const SUMIDEROS_DE_CORTE = ["prompt", "selector", "save", "gemView", "zodiac", "dungeonKlimbPrompt", "dungeonDirPrompt"];

export function compruebaCierre(sc, permitidos = []) {
  const s = sc.fin?.sinks;
  if (!s) return check("CIERRE", SIN_DATO, "sidecar sin foto de sumideros");
  const abiertos = SUMIDEROS_DE_CORTE.filter((k) => {
    const v = s[k];
    return v != null && v !== false && !permitidos.includes(k);
  }).map((k) => `${k}=${s[k]}`);
  return abiertos.length
    ? check("CIERRE", FALLO, `el vídeo corta con ${abiertos.join(", ")} ABIERTO`)
    : check("CIERRE", OK, "sin prompt ni modal abierto al corte");
}

/** El sidecar y el metraje tienen que hablar del MISMO vídeo. Un desfase grande delata
 *  o un truncamiento (el .webm se cortó) o un sidecar de otra toma. */
export function compruebaCoherencia(sc, durVideoS, tolS = 3) {
  if (durVideoS == null) return check("COHERENCIA", SIN_DATO, "sin duración de vídeo");
  const t = sc.fin?.t;
  if (t == null) return check("COHERENCIA", SIN_DATO, "sidecar sin registro `end`");
  const d = Math.abs(t - durVideoS);
  const txt = `sidecar ${t.toFixed(1)} s vs vídeo ${durVideoS.toFixed(1)} s (Δ${d.toFixed(1)})`;
  return d > tolS ? check("COHERENCIA", FALLO, txt) : check("COHERENCIA", OK, txt);
}

// ══════════════════════════════════════════════════════════════════════════════════════
// PLANO B — comprobaciones sobre el vídeo
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * INTEGRIDAD — el `.webm` se lee entero.
 * `part18.webm` es el caso: 3 670 016 B = 3,5 MiB EXACTOS (frontera de búfer, firma de
 * escritura interrumpida) y ffprobe no puede ni dar la duración
 * (`duration=N/A` + `File ended prematurely`). 0 bytes también es fallo.
 * @param {{ bytes:number, durS:number|null, errores:string[] }} probe
 */
export function compruebaIntegridad(probe) {
  if (!probe) return check("INTEGRIDAD", SIN_DATO, "sin sonda");
  if (probe.bytes === 0) return check("INTEGRIDAD", FALLO, "0 bytes");
  if (probe.durS == null || !Number.isFinite(probe.durS))
    return check("INTEGRIDAD", FALLO, `ffprobe no da duración (${probe.bytes} B) — TRUNCADO`);
  if (probe.errores?.length)
    return check("INTEGRIDAD", FALLO, `decodificación con errores: ${probe.errores.slice(0, 2).join(" | ")}`);
  return check("INTEGRIDAD", OK, `${probe.durS.toFixed(1)} s · ${(probe.bytes / 1024).toFixed(0)} KB`);
}

/**
 * COLA / PARADA VISUALES — sobre los tramos de congelación del PANEL DE CONSOLA.
 *
 * 🔴 CALIBRACIÓN, no invención: el filtro es
 * `crop=<panel>,format=gray,scale=160:100,freezedetect=n=0.005:d=1.5`. El submuestreo a
 * 160×100 promedia el grano CRT de la piel shader, que es lo que impide cerrar a un
 * umbral bajo — sin él, whirlpool da CERO tramos y se lee como limpio
 * (VERIFICACION-EVENTOS.md §0). Reproduce los testigos documentados: whirlpool
 * `3,28→EOF`, part01 `2,04→10,7` (E3: «2→10,5»), ad01 `7,24→20,9` (E3: «7→21») y
 * `47,2→58,6` (E3: «47–59»).
 *
 * 🔴 Y `freezedetect` emite a nivel INFO: invocado con `-v error` da CERO detecciones
 * SIEMPRE. Un censo-cero así se lee como «todo limpio» sobre 491 s de paradas reales
 * (TABLA-REPLAYS.md §0). El CLI lo invoca con `-v info` y el testigo del control
 * positivo lo acredita.
 *
 * @param {{start:number,end:number|null}[]} tramos
 */
export function compruebaVisual(tramosTodos, durS, { paradaMaxS, colaMaxPct, colaMinS = 5, dMinS = 1.5 }, rel = null) {
  if (durS == null) return [check("PARADA-VIS", SIN_DATO, "sin duración"), check("COLA-VIS", SIN_DATO, "sin duración")];
  if (!tramosTodos) return [check("PARADA-VIS", SIN_DATO, "sin sonda"), check("COLA-VIS", SIN_DATO, "sin sonda")];
  // La sonda corre a `d=0.2` (una pasada para dos preguntas); aquí se recupera el conjunto
  // de `d=1.5` filtrando por duración, que es la equivalencia comprobada en `gate.mjs`.
  const tramos = tramosTodos.filter((t) => (t.end ?? durS) - t.start >= dMinS);
  if (!tramos.length) return [check("PARADA-VIS", OK, "sin congelaciones ≥1,5 s"), check("COLA-VIS", OK, "0,0 s = 0 %")];
  // 🔴 LOS TRAMOS ADYACENTES NO SE FUNDEN, y esto es una corrección MEDIDA (no una
  // preferencia). La primera versión los fundía «porque freezedetect reajusta su
  // referencia», y el careo contra la tabla de colas de VERIFICACION-EVENTOS.md §6 la
  // refutó de plano: healer-flash-faithful salía 12,8 s / 61 % contra los 5,0 s / 24 %
  // medidos, y tienda 73 % contra 29 %. Que un tramo acabe en 15,92 y otro empiece en
  // 15,92 SIGNIFICA que un fotograma difirió ahí — es decir, que el panel escribió algo.
  // Fundirlos borra justamente el progreso que la comprobación busca.
  // Sin fundir, la sonda reproduce la tabla clavada: healer-f 4,98/24 %, moongate-piedra
  // 8,96/42 % (tabla: 9,0/42), whirlpool 6,3/55 % (la tabla dice 8,2/72 porque allí el
  // fotograma que separa los dos tramos es un `>Pass`, o sea RUIDO — y distinguir ruido
  // de contenido es precisamente lo que el plano visual NO puede hacer y el sidecar sí).
  const orden = [...tramos].sort((a, b) => a.start - b.start).map((t) => ({ start: t.start, end: t.end ?? durS }));
  // Igual que en `compruebaParada`: de cada tramo de PANEL congelado sólo cuenta el trozo
  // en que la IMAGEN tampoco se movía. Un panel quieto mientras el viewport pinta la
  // aparición, el bracket XOR o los quakes del ritual no es una parada: es la escena.
  let peor = 0;
  let peorCrudo = 0;
  for (const t of orden) {
    peorCrudo = Math.max(peorCrudo, t.end - t.start);
    peor = Math.max(peor, huecoMuerto(t.start, t.end, rel).largo);
  }
  const alFinal = orden.filter((t) => t.end >= durS - 0.2);
  const inicioCola = alFinal.length ? alFinal[alFinal.length - 1].start : durS;
  const colaCruda = durS - inicioCola;
  const cola = rel ? durS - Math.max(inicioCola, Math.min(rel.tMov, durS)) : colaCruda;
  const pct = (cola / durS) * 100;
  const nota = rel && colaCruda - cola > 0.05 ? ` (panel congelado ${colaCruda.toFixed(1)} s, el viewport pinta hasta t=${Math.min(rel.tMov, durS).toFixed(1)})` : "";
  const notaP = rel && peorCrudo - peor > 0.05 ? ` (panel congelado ${peorCrudo.toFixed(1)} s con la imagen viva)` : "";
  return [
    peor > paradaMaxS
      ? check("PARADA-VIS", FALLO, `consola congelada Y viewport quieto ${peor.toFixed(1)} s (máx ${paradaMaxS})`)
      : check("PARADA-VIS", OK, `mayor congelación con la imagen quieta ${peor.toFixed(1)} s${notaP}`),
    pct > colaMaxPct && cola > colaMinS
      ? check("COLA-VIS", FALLO, `${cola.toFixed(1)} s / ${durS.toFixed(1)} s = ${pct.toFixed(0)} % (máx ${colaMaxPct} % / ${colaMinS} s)`)
      : check("COLA-VIS", OK, `${cola.toFixed(1)} s = ${pct.toFixed(0)} %${nota}`),
  ];
}

/**
 * VELOCIDAD — «¿se puede VER esto?». Criterio del usuario (22-08), y clase ÁMBAR aparte:
 * los vídeos del Grand Tour van a toda pastilla (el arnés teclea tan rápido como puede) y
 * son ilegibles, pero su estado está asertado contra los bytes del `.GAM` — no están rotos.
 *
 * ── EL UMBRAL ESTÁ DERIVADO, Y ESTA ES LA DERIVACIÓN ─────────────────────────────────
 * Del CORPUS ORIGINAL, que es metraje de un humano jugando de verdad. Para las 22 partes
 * del LP1 (aulddragon) hay dos magnitudes medibles sobre el MISMO material:
 *   · duración: `original/av-referencia/yt/clips/full-part-logs/sweep-auld.log` anota
 *     `# <N> frames @ 2.0fps` por parte ⇒ segundos = N/2. Total 69 889 frames = 9,71 h.
 *   · operaciones: `game/e2e/espejo-tour/routes/partNN.route.json`, longitud de los
 *     `script[]` (las ops que el corpus curó de esa parte).
 * El cociente por parte da:
 *   part21 1,83 · part13 1,93 · part06 1,99 · part14 2,06 · part15 2,09 · part20 2,18 ·
 *   part04/18 2,19 · part16 2,24 · part12 2,33 · part05/22 2,38 · part02 2,43 ·
 *   part07/09 2,45 · part23 2,56 · part24 2,58 · part10 2,69 · part03 2,93 · part17 2,98 ·
 *   part19 3,74   s/operación.
 * (part01 sale 27,8 y se EXCLUYE con motivo: su route sólo cura 68 ops de una parte de
 * 31 min — el denominador está vacío, no es que el jugador fuese lento. Excluir sin decirlo
 * sería elegir el testigo.)
 * ⇒ **1,83 s/op es lo más rápido que fue el humano MÁS rápido del corpus de referencia.**
 * Ese es el suelo: por debajo, el vídeo va más deprisa que cualquier jugada real que
 * tengamos documentada.
 *
 * ── CÓMO SE CUENTAN LAS «OPERACIONES» DE NUESTRO VÍDEO ───────────────────────────────
 *  · CON sidecar: las TECLAS. Es la magnitud HOMÓLOGA — una op del LP es, en el corpus,
 *    una pulsación. Aquí el umbral de 1,83 s/op se aplica tal cual.
 *  · SIN sidecar: **esta comprobación NO se pronuncia** (SIN-DATO). Y es una retirada
 *    MEDIDA, no una omisión: la primera versión sustituía las teclas por los estados
 *    visibles del panel, y el careo la refutó — sobre los 12 vídeos que tienen sidecar Y
 *    sonda, la razón estados/tecla va de **0,45** (shrine-donacion: teclear un número son
 *    muchas teclas y un solo estado) a **2,33** (whirlpool: tres teclas y siete estados,
 *    porque el reloj y el roster laten solos). Factor 5 de dispersión ⇒ no hay conversión
 *    posible, y aplicar la mediana habría sido inventar una constante que sus propios datos
 *    refutan. Lo que mide la velocidad del material SIN sidecar es `compruebaLegibilidad`,
 *    que tiene su propia unidad (cambios de pantalla/s) y su propio umbral calibrado.
 *  · Y un disparador independiente del recuento y de la unidad: la DURACIÓN. Con el
 *    original entre 1,83 y 3,74 s por operación, en un clip de menos de 5 s no caben ni dos
 *    operaciones a ritmo humano — da igual lo que haya dentro.
 */
/**
 * INFORMACIÓN — «¿este vídeo enseña ALGO?». Regla del usuario vía lead (22-08), traída de
 * la auditoría del Grand Tour: quince de los 91 no muestran nada, y sus tests son VERDES.
 *
 * ── LAS DOS FIRMAS, DERIVADAS DE LOS DATOS Y NO ELEGIDAS A OJO ───────────────────────
 * Sobre la luminancia media por fotograma (`scale=160:100,signalstats` → YAVG):
 *  · **LIENZO EN BLANCO** — `media < 20` con `sd < 1`. Los OCHO vídeos que la auditoría
 *    clasificó (a) VACÍO comparten firma exacta: media 15,82-15,83 · sd 0,411-0,414 ·
 *    max 16,04-16,05. Sólo está la piel de la app (los botones EN/⚙) sobre un lienzo que
 *    nunca se pintó. **Barrido el umbral contra las 91 clases de la auditoría: a 17 y a 20
 *    marca los 8 y NI UNO más — separación perfecta, cero falsos positivos.**
 *  · **MODAL ATENUADO** — `media < 27`. Marca 21 de los 23 vídeos de clase (a)+(b). Los
 *    tres «extra» que aparecen (`ch17-doom`, `-3`, `-8`) NO son falsos positivos: la propia
 *    tabla los describe como «detrás del modal de export atenuado» / «mapa atenuado + modal
 *    SYSTEM» — mismo fenómeno, clasificado (e) por criterio del auditor.
 *
 * ── LOS DOS QUE ESTA REGLA NO CAZA, Y POR QUÉ NO SE FUERZA EL UMBRAL ─────────────────
 * `ch15-underworld` (media 33,6) también «no muestra», pero por otro MECANISMO: el
 * repintado se difiere y el fichero se queda 9,6 s de 11,3 en un fotograma. Ése lo caza
 * PARADA-VIS, que es la comprobación que le toca. Subir el umbral hasta atraparlo (34)
 * arrastraría seis vídeos con contenido real. Un detector por vídeo, un mecanismo.
 *
 * 🔴 NUNCA ES FALLO. Los ocho lienzos en blanco son tests de RE-IMPORT: no tienen nada
 * visual que dar y el capítulo asserta lo suyo contra los bytes del `.GAM`. Lo que procede
 * es dejar de grabarlos, que es una decisión de producción — no un rojo de ingeniería.
 */
export function compruebaInformacion(lum, { blancoMax = 20, blancoSdMax = 1, atenuadoMax = 27 } = {}) {
  if (!lum || lum.n === 0) return check("INFO", SIN_DATO, "sin sonda de luminancia");
  const { media, sd } = lum;
  const d = `YAVG medio ${media.toFixed(2)} · sd ${sd.toFixed(2)}`;
  if (media < blancoMax && sd < blancoSdMax)
    return { id: "INFO", estado: AMBAR, clase: "LIENZO-EN-BLANCO", detalle: `${d} — el lienzo del juego NUNCA se pintó (sólo la piel de la app)` };
  if (media < atenuadoMax)
    return { id: "INFO", estado: AMBAR, clase: "MODAL-ATENUADO", detalle: `${d} — pantalla atenuada bajo un modal: el capítulo juega y no se ve` };
  return { ...check("INFO", OK, d), clase: null };
}

export function compruebaVelocidad(durS, { ops, fuente, homologa }, { sPorOpMin = 1.83, duracionMinS = 5 } = {}) {
  if (durS == null) return check("VELOCIDAD", SIN_DATO, "sin duración");
  if (durS < duracionMinS)
    return {
      id: "VELOCIDAD",
      estado: AMBAR,
      homologa: true,
      sPorOp: null,
      detalle: `clip de ${durS.toFixed(1)} s (< ${duracionMinS} s: no caben 2 ops a ritmo humano ni en el mejor caso)`,
    };
  if (!homologa) return check("VELOCIDAD", SIN_DATO, "sin sidecar: la unidad del corpus son TECLAS y aquí no las hay (lo mide LEGIBLE)");
  if (!ops) return check("VELOCIDAD", SIN_DATO, "sin recuento de teclas");
  const sPorOp = durS / ops;
  const d = `${sPorOp.toFixed(2)} s/tecla (${ops} ${fuente} en ${durS.toFixed(1)} s)`;
  if (sPorOp >= sPorOpMin) return { ...check("VELOCIDAD", OK, d), homologa, sPorOp };
  return {
    id: "VELOCIDAD",
    estado: AMBAR,
    homologa,
    sPorOp,
    detalle: `${d} — ${(sPorOpMin / sPorOp).toFixed(1)}× más rápido que el humano más rápido del corpus (${sPorOpMin} s/op)`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════
// PLANO C — replays del espejo · Grand Tour
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * LEGIBILIDAD — cambios de pantalla por segundo. Es la métrica del criterio de VELOCIDAD
 * del usuario, y viene CALIBRADA de la auditoría del Grand Tour, con su instrumento
 * validado en las dos direcciones (control positivo: 5 s de fotograma congelado inyectados
 * en vídeo real, detectados exactos; control negativo: `ch03`/`ch06` son pantallas de juego
 * con NPC animado y puntúan 2,0 % y 1,7 % — la animación de tiles NO infla la métrica).
 *
 * Umbral: **≥ 10 cambios/s es ilegible** — un estado nuevo cada ≤ 100 ms cuando leer una
 * línea de consola pide ≥ 0,5 s. 50 de los 91 lo superan; 24 pasan de 21 (casi un estado
 * por fotograma). El ancla por el otro lado también está medida: `ch17-doom-5` es el ÚNICO
 * vídeo del tour que se puede seguir, con **3,1 cambios/s** y pausas de 3,92/3,20/2,60 s.
 *
 * `pausaMaxS` acompaña porque es la cifra que mejor cierra la queja: la pausa más larga
 * dentro de los 73,8 s de juego de `ch20-salas-deceit` es de **0,08 s — DOS fotogramas**.
 */
export function compruebaLegibilidad(cam, { cambiosMaxS = 10, pausaMinS = 0.4 } = {}) {
  if (!cam) return check("LEGIBLE", SIN_DATO, "sin sonda de cambios");
  const d = `${cam.cambiosS.toFixed(1)} cambios/s · pausa máx ${cam.pausaMaxS.toFixed(2)} s`;
  if (cam.cambiosS >= cambiosMaxS)
    return {
      id: "LEGIBLE",
      estado: AMBAR,
      cambiosS: cam.cambiosS,
      detalle: `${d} — ILEGIBLE (≥ ${cambiosMaxS} cambios/s; el único vídeo seguible del tour va a 3,1)`,
    };
  if (cam.pausaMaxS < pausaMinS)
    return {
      id: "LEGIBLE",
      estado: AMBAR,
      cambiosS: cam.cambiosS,
      detalle: `${d} — ninguna pantalla se sostiene ${pausaMinS} s: nada da tiempo a leerse`,
    };
  return { ...check("LEGIBLE", OK, d), cambiosS: cam.cambiosS };
}

/**
 * CAPÍTULO DEL TOUR — contexto, NO re-adjudicación.
 * Cada capítulo del Grand Tour ASSERTA bytes del `.GAM` contra el binario: un capítulo
 * VERDE ya garantiza el estado, y lo que el gate añade sobre su vídeo es si está completo
 * y si se puede ver. Los 13 rojos del tour están ADJUDICADOS en su `index.md` (6 de acta,
 * 3 sellos rancios re-pineados por otro carril, 4 del clúster de salas ya cerrado): el
 * gate los NOMBRA y no los vuelve a fichar — por eso esto no es nunca FALLO.
 */
export function compruebaCapitulo(estado) {
  if (!estado) return check("CAP", SIN_DATO, "capítulo no encontrado en results.tsv");
  return estado === "VERDE"
    ? check("CAP", OK, "capítulo VERDE (estado asertado contra el .GAM)")
    : check("CAP", SIN_DATO, `capítulo ${estado} — ya adjudicado en grandtour/index.md, NO se re-ficha aquí`);
}

/**
 * VERDE VACUO — un replay que no midió NI UNA operación no es un replay verde: es un
 * replay que no dice nada. `part23` (8/8 segmentos `[SKIP:pendiente-runner]`) y `part24`
 * (5/5) tienen `comparable = 0` y `conformity = null`, y el `index.md` los daba por
 * «pasaron» (TABLA-REPLAYS.md §4.2). `minComparable` es declarativo por si alguna parte
 * corta legítimamente pide otro suelo.
 */
export function compruebaVacuo(report, minComparable = 1) {
  if (!report) return check("VACUO", SIN_DATO, "sin report.json");
  const c = report.comparable ?? 0;
  if (c < minComparable)
    return check("VACUO", FALLO, `comparable=${c} (<${minComparable}) — el vídeo no midió NADA`);
  if (report.conformity == null) return check("VACUO", FALLO, `conformity=null con comparable=${c}`);
  return check("VACUO", OK, `comparable=${c} · conf=${report.conformity}`);
}

/**
 * PARTY VIVA AL ARRANCAR — leída de los BYTES del `.gam` sembrado (registro de 0x20 B,
 * estado en 0x0D `G`/`D`/`P`, HP en 0x12; TABLA-REPLAYS.md §4.1). Nueve de las 24 semillas
 * están commiteadas con los seis miembros a `D:0`, y el contraste que lo convierte en
 * defecto es del corpus: la cadena `darkness engulfs` aparece 0 veces en los 24 ficheros
 * del LP — el original NUNCA sufrió un wipe.
 *
 * @param {{nombre:string,estado:string,hp:number}[]} miembros
 */
export function compruebaPartyViva(miembros, { minVivos = 1 } = {}) {
  if (!miembros) return check("PARTY", SIN_DATO, "sin .gam");
  const vivos = miembros.filter((m) => m.estado !== "D" && m.hp > 0).length;
  const d = `${vivos}/${miembros.length} vivos al arrancar`;
  return vivos < minVivos ? check("PARTY", FALLO, `${d} — SEMILLA MUERTA`) : check("PARTY", OK, d);
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Composición
// ══════════════════════════════════════════════════════════════════════════════════════

/** Une los umbrales por defecto con los del vídeo (el vídeo gana campo a campo). */
export function resuelveExp(exps, id) {
  // Fila explícita, o el PATRÓN de familia que case. Los patrones existen para el Grand
  // Tour: sus 91 vídeos no declaran firma porque su promesa NO vive en la consola sino en
  // los asertos del capítulo contra los bytes del `.GAM`; escribir 91 filas idénticas
  // sería ruido que nadie relee. Default-deny se conserva: un id sin fila Y sin patrón
  // sigue poniendo el gate rojo.
  const patron = (exps.patrones ?? []).find((p) => new RegExp(p.re).test(id));
  const propio = exps.videos?.[id] ?? (patron ? { ...patron.exp, _patron: patron.re } : {});
  // Los REPLAYS tienen su propia capa de defaults, y no es comodidad: son otro régimen.
  // Un vídeo de EVENTO lleva escenas PACEADAS por el port (el interrogatorio de
  // Blackthorn, el discurso de LB en la acampada, la inversión de 6 277 ms del santuario,
  // el hold del pergamino) donde la consola calla varios segundos POR DISEÑO. Un replay
  // del espejo no tiene ninguna: reproduce un walkthrough tecla a tecla, así que cualquier
  // silencio largo de consola es el guion detenido — la familia (b) de TABLA-REPLAYS.md.
  const def = { ...(exps.defaults ?? {}), ...(propio.esReplay ? (exps.defaultsReplay ?? {}) : {}) };
  return {
    ...def,
    ...propio,
    prohibido: propio.prohibido ?? def.prohibido ?? [],
    ruido: propio.ruido ?? def.ruido ?? [],
    permitido: { ...(def.permitido ?? {}), ...(propio.permitido ?? {}) },
    permitidoPorque: { ...(def.permitidoPorque ?? {}), ...(propio.permitidoPorque ?? {}) },
    declarado: Boolean(exps.videos?.[id] || patron),
  };
}

/**
 * Adjudica UN vídeo. `ev` es la evidencia recogida por el CLI; los planos que falten
 * salen como `SIN-DATO` (que NO es verde) en vez de desaparecer.
 * @param {{id:string, exp:object, sidecar:object|null, probe:object|null, tramos:object[]|null, report:object|null, party:object[]|null}} ev
 */
export function adjudica(ev) {
  const { exp, sidecar: sc, probe, tramos, report, party } = ev;
  const dur = probe?.durS ?? sc?.fin?.t ?? null;
  // EL RELEVO SE RESUELVE UNA VEZ y lo comparten las cuatro guardas de cola/parada. Es
  // `null` cuando no hay sonda de viewport o cuando está saturada, y entonces las cuatro
  // se comportan EXACTAMENTE como antes de este carril (ver `relevoViewport`).
  const rel = relevoViewport(ev.viewport);
  const checks = [compruebaIntegridad(probe)];

  if (sc) {
    // ── VENTANA DE PROSA: donde hay `ritmo` declarado, la escena es un overlay a canvas
    // que NO escribe en consola (las siete páginas del desenlace). PARADA y COLA leerían
    // ese tramo como 31 s de guion detenido y sería un rojo falso: lo que gobierna ahí es
    // RITMO, que mide el avance por las TECLAS. La guarda no se retira — se RELEVA, y por
    // eso el corte se calcula del propio marcador (`trasLinea`) y no de un número a mano.
    let corte = Infinity;
    if (exp.ritmo?.trasLinea) {
      const m = sc.lines.filter((l) => new RegExp(exp.ritmo.trasLinea).test(l.text));
      if (m.length) corte = m[m.length - 1].t;
    }
    checks.push(
      compruebaCoherencia(sc, probe?.durS ?? null, exp.coherenciaTolS ?? 3),
      compruebaDebe(sc, exp.debe),
      compruebaProhibido(sc, exp.prohibido, exp.permitido),
      compruebaParada(sc, exp.paradaMaxS ?? 8, dur, corte, rel),
      compruebaCola(sc, exp.colaMaxPct ?? 30, dur, exp.ruido, exp.colaMinS ?? 5, corte, rel),
      compruebaRitmo(sc, exp.ritmo),
      compruebaCierre(sc, exp.cierreAbierto ?? []),
    );
  } else {
    // Sin sidecar el plano A no se puede medir. Se DECLARA, no se omite: un hueco que no
    // se ve en la tabla es un hueco que nadie tapa.
    checks.push(
      check("DEBE", SIN_DATO, "sin sidecar (material anterior a la instrumentación)"),
      check("PROHIBIDO", SIN_DATO, "sin sidecar"),
      check("RITMO", SIN_DATO, "sin sidecar"),
      check("CIERRE", SIN_DATO, "sin sidecar"),
    );
  }
  // El plano B corre SIEMPRE que haya sonda: con sidecar es redundante y barato, y su
  // acuerdo/desacuerdo con el plano A es información (una consola congelada con filas
  // llegando = la piel no repinta).
  checks.push(
    ...compruebaVisual(
      tramos,
      dur,
      {
        paradaMaxS: exp.paradaMaxS ?? 8,
        colaMaxPct: exp.colaMaxPct ?? 30,
        colaMinS: exp.colaMinS ?? 5,
      },
      rel,
    ),
    // La ÚNICA de la familia que no necesita sidecar: 23 de los 42 eventos no lo tienen.
    compruebaColaViewport(ev.viewport, dur, { colaMaxPct: exp.colaMaxPct ?? 30, colaMinS: exp.colaMinS ?? 5 }),
  );
  if (exp.esReplay) {
    checks.push(compruebaVacuo(report, exp.minComparable ?? 1), compruebaPartyViva(party, exp));
  }
  if (exp.esTour) checks.push(compruebaCapitulo(ev.capitulo));
  // VELOCIDAD: las teclas del sidecar si las hay (magnitud homóloga a la op del LP);
  // si no, los estados visibles del panel. La fuente se IMPRIME para que no se compare
  // una cifra de teclas con una de estados sin darse cuenta.
  const ops = { ops: sc?.keys?.length ?? 0, fuente: "teclas del sidecar", homologa: Boolean(sc?.keys?.length) };
  checks.push(compruebaVelocidad(dur, ops, { sPorOpMin: exp.sPorOpMin ?? 1.83, duracionMinS: exp.duracionMinS ?? 5 }));
  checks.push(
    compruebaLegibilidad(ev.cambios, { cambiosMaxS: exp.cambiosMaxS ?? 10, pausaMinS: exp.pausaMinS ?? 0.4 }),
    compruebaInformacion(ev.lum, exp),
  );

  // 🔴 UN CAPÍTULO DEL TOUR QUE FALLÓ NO SE RE-FICHA POR SU VÍDEO. Medido: `ch03-britain`
  // (capítulo ROJO, 183 s) da 179,9 s de consola congelada y `ch06-moonglow` (ROJO, 303 s)
  // da 296,6 s. Esos dos rojos son CIERTOS y son *el mismo hecho* que el capítulo ya
  // adjudicado en `grandtour/index.md`: el test se colgó y el vídeo grabó el cuelgue.
  // Contarlos como fallo propio del vídeo duplicaría la ficha y le pondría al gate un rojo
  // permanente que no puede arreglar nadie desde aquí. Se DEGRADAN a SIN-DATO —no se
  // borran— con la causa escrita, que es la diferencia entre no adjudicar y ocultar.
  // (ojo: `map` SIEMPRE, también cuando no se degrada — la primera versión reutilizaba el
  //  array original en la rama «no degradar» y luego lo vaciaba para reescribirlo, con lo
  //  que vaciaba las dos referencias a la vez y todo salía verde. Lo cazaron dos testigos.)
  const degrada = exp.esTour && ev.capitulo && ev.capitulo !== "VERDE";
  const finales = checks.map((c) =>
    degrada && c.estado === FALLO
      ? { ...c, estado: SIN_DATO, detalle: `${c.detalle} — NO adjudicable: el capítulo está ${ev.capitulo} y su fallo ya está fichado en grandtour/index.md` }
      : c,
  );

  const fallos = finales.filter((c) => c.estado === FALLO);
  const sinDato = finales.filter((c) => c.estado === SIN_DATO);
  const ambar = finales.filter((c) => c.estado === AMBAR);
  return {
    id: ev.id,
    veredicto: fallos.length ? FALLO : ambar.length ? AMBAR : OK,
    declarado: exp.declarado,
    checks: finales,
    fallos,
    sinDato,
    ambar,
  };
}

/**
 * GUARDA DEL PROPIO FICHERO DE EXPECTATIVAS. Sin esto el gate tiene un verde trivial:
 * un vídeo sin fila en `videos` cae a los defaults, que NO llevan `debe` — es decir,
 * pasaría el gate sin que nadie haya declarado nunca qué promete. Default-DENY.
 * Además exige justificación escrita a toda excepción de vocabulario.
 */
export function verificaExpectativas(exps, idsPresentes, { censoCompleto = true } = {}) {
  const problemas = [];
  for (const id of idsPresentes) {
    const e = exps.videos?.[id] ?? (exps.patrones ?? []).find((p) => new RegExp(p.re).test(id))?.exp;
    if (!e) {
      problemas.push(`${id}: SIN FILA ni PATRÓN en expectativas.json (default-deny: declara qué promete el vídeo)`);
      continue;
    }
    if (!e.debe?.length && !e.debeVacioPorque)
      problemas.push(`${id}: sin \`debe\` y sin \`debeVacioPorque\` — un vídeo que no promete nada no se puede auditar`);
    for (const tok of Object.keys(e.permitido ?? {})) {
      if (!e.permitidoPorque?.[tok])
        problemas.push(`${id}: excepción «${tok}» sin \`permitidoPorque\` — una excepción sin motivo es una excepción que nadie revisa`);
    }
    // MISMA regla para los UMBRALES por caso, y se añade con la cicatriz delante: llegó a
    // haber VEINTIDÓS `colaMaxPct`/`paradaMaxS` a mano tapando el punto ciego de la sonda
    // de consola. Se han retirado (la cola se mide ahora sobre el viewport), y esta guarda
    // existe para que el siguiente que suba un umbral tenga que escribir la CIFRA que lo
    // justifica — que es lo que permitió auditarlos y quitarlos.
    for (const campo of ["colaMaxPct", "paradaMaxS", "colaMinS"]) {
      if (e[campo] != null && !e[`${campo}Porque`])
        problemas.push(`${id}: \`${campo}\` por caso sin \`${campo}Porque\` — un umbral levantado sin la cifra delante no se puede volver a bajar`);
    }
  }
  // La otra mitad del censo — «declarado y ausente» — SÓLO tiene sentido cuando se está
  // mirando la colección ENTERA. Sobre un subconjunto todas las demás filas «faltan» y el
  // predicado se vuelve ruido; por eso es un parámetro y no una constante.
  if (censoCompleto) {
    for (const id of Object.keys(exps.videos ?? {})) {
      if (!idsPresentes.includes(id)) problemas.push(`${id}: declarado en expectativas y AUSENTE de la colección`);
    }
  }
  return problemas;
}
