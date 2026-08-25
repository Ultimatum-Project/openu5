/**
 * VEREDICTO DE LOS CINCO SELLOS — la mitad «¿siguen intactos?» de la puerta de aterrizaje.
 *
 *   node re/tools/veredicto_sellos.mjs <dirDeReports> --desde=<ISO>
 *
 * Exit 0 = los CINCO intactos · 1 = hay algo que PARAR · 2 = error de uso ·
 *      5 = las únicas desviaciones son roturas REGISTRADAS y dentro de su caducidad (grita, no bloquea).
 *
 * ══ 🔴 QUÉ ACREDITA UN «INTACTO», Y QUÉ NO — LEER ANTES DE ESCRIBIR EL verdict.md ═════════
 * **Un sello intacto acredita AUSENCIA DE CAMBIO OBSERVABLE. NUNCA acredita que un camino se
 * haya EJECUTADO.** La fórmula «los cinco intactos ⇒ la hipótesis queda CONFIRMADA» está
 * RETIRADA DEL VOCABULARIO (#87): se publicó en `docs/verdicts/aitype-npc-78/verdict.md` y hubo
 * que retractarla en el artefacto ya archivado.
 *
 * Cómo se coló, que es lo que importa: la salvedad que acompañaba al verde enumeraba DOS
 * posibilidades —(a) el camino no se ejecuta · (b) se ejecuta y da igual— y faltaba la tercera:
 *
 *     (c) SE EJECUTÓ, cambió el comportamiento, y EL INSTRUMENTO NO PUEDE VERLO.
 *
 * Y no era hipotética: aquella misma ventana llevaba dentro su propio CONTROL —un aiType que
 * sí estaba expuesto— y el control TAMPOCO movió nada. Con el dato delante se sacó la
 * conclusión contraria.
 *
 * ⇒ Antes de escribir «confirmada», contesta: **¿por qué canal habría llegado el cambio hasta
 * el universo comparado?** Este espejo compara TEXTO (bloques OCR) y DELTAS DE ORO ANCLADOS.
 * NO compara posiciones — pero **tampoco es ciego a ellas por construcción**: el ANCLA DE
 * TRANSACCIÓN es una dependencia de PROXIMIDAD (si no engancha, el port no ve la tienda y el
 * delta sale 0), y ese canal ya movió un sello una vez (el −1 de `part05-g05`, ficha #15).
 * Si no sabes nombrar el canal, lo que tienes es un silencio, no una confirmación.
 * Derivación completa y el censo que la acota: `docs/verdicts/aitype-npc-78/verdict.md` §punto 2.
 *
 * 🔴 Este aviso va AQUÍ y NO en el banner de salida A PROPÓSITO: los cinco `.stdout.log` se
 * comparan por CONTEO DE LÍNEAS entre corridas (84·77·72·28·56 idénticos en dos ventanas
 * distintas), y ese control es lo que discrimina «los sellos no se movieron» de «el arnés no
 * corrió». Una línea más en stdout lo rompería en silencio.
 * ═════════════════════════════════════════════════════════════════════════════════════════
 *
 * ── POR QUÉ EXISTE, SI YA HAY UN AGREGADOR ───────────────────────────────────────────────
 * `re/tools/agrega_espejo_ventana.mjs` ya audita los deltas verdes contra su constante
 * publicada (su `auditaVerdes`), y esta sonda NO reimplementa esa idea: la hereda. Lo que le
 * faltaba para ser una PUERTA son tres cosas, y son las tres que se añaden aquí:
 *
 *  1. EXIT CODE. El agregador IMPRIME el rojo; un aterrizaje necesita que el shell se entere.
 *  2. LA AUSENCIA ES UN FALLO. `auditaVerdes` recorre los sellos que ENCUENTRA: si una parte
 *     no corrió, su sello no aparece y el silencio se lee como verde. Para un agregado eso es
 *     razonable; para una puerta es letal — es la guarda de existencia bendiciendo el vacío.
 *     Aquí los cinco están ENUMERADOS y la falta de uno es rojo, con su nombre.
 *  3. LOS CINCO, NO LOS TRES DE UN CORPUS. Los sellos viven en DOS corpus (ad06/ad09/ad21 en
 *     el AD; part04/part05 en el canónico) y ninguna herramienta existente corre los dos.
 *
 * ── LA COMPROBACIÓN ES DE TRES BANDAS, Y NO ES CELO ──────────────────────────────────────
 * `match` del report es `got === expected`, pero **`expected` lo pone el CORPUS**. Si una ruta
 * cambiara el esperado, `match:true` seguiría saliendo y el verde no significaría nada: habría
 * movido su propia portería ([[test-contra-constante-es-circular]]). Es la lección que
 * `d86bbffd` dejó aterrizada hoy. Por eso se comparan TRES valores:
 *
 *     PUBLICADO (de las actas que cerraron el delta)  ·  expected (del corpus)  ·  got (del port)
 *
 * y el sello sólo está intacto si los tres coinciden. Un `expected !== PUBLICADO` NO se
 * reporta como «sello roto» sino como «EL CORPUS MOVIÓ LA PORTERÍA», que es otra avería y
 * pide otra reparación.
 *
 * ── EL DIAGNÓSTICO NO ES MÍO ─────────────────────────────────────────────────────────────
 * Un `got` que no cuadra puede ser una DIVERGENCIA DEL PORT o una transacción que el port
 * NUNCA CONDUJO (el ancla no enganchó ⇒ cero VACÍO). Esa distinción ya la calcula el runner
 * (`ledgerTxnVerdict`, seis estados) y la escribe en su línea de `resyncs`. Aquí se COPIA esa
 * línea tal cual, sin reclasificar: dos clasificadores del mismo hecho acaban divergiendo, y
 * el que manda es el del arnés. Si la línea no está, se dice que no está.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

/**
 * LOS CINCO SELLOS. El valor viene de las actas que cerraron cada delta, NO del corpus.
 * ⚠ Esta tabla está DUPLICADA a propósito con la de `agrega_espejo_ventana.mjs` (aquella es
 * un script con `main()` al final: importarla lo EJECUTA). Para que no puedan divergir en
 * silencio, `game/tests/sellos-puerta.test.ts` parsea las DOS y exige que sean iguales.
 */
export const SELLOS = {
  /**
   * ✅ DEUDA MUERTA (2026-08-05, ficha #12) — la `roturaConocida` se RETIRA porque el sello
   * VOLVIÓ A PAGAR: puerta corrida sobre `deddd0f8`, `220 · ✓ INTACTO`, los cinco intactos,
   * EXIT 0. Caducaba el 16-08; cerró 11 días antes.
   *
   * El `0` NO era una divergencia del port: era un defecto del ARNÉS. La consola de tienda
   * RANCIA de OTRO mercader (el Curandero, abierta por el op del ancla anterior) seguía viva y
   * se tragaba el bloque de venta del herrero, y la verificación de enganche no lo veía porque
   * `engaged = shopOpen()` preguntaba «¿hay ALGUNA tienda abierta?» y no «¿la que pedí?».
   * Arreglado en `runner.ts` (comparar TIPO + cerrar la rancia); acta `ad06-teclas-acta.md`.
   *
   * 🔴 LO QUE NO HAY QUE HACER SI ESTE SELLO VUELVE A CAER: dar por hecho que es el port.
   * Se contó como deuda de FIDELIDAD siéndolo del ARNÉS, y con cuatro mecanismos propuestos y
   * refutados por el camino. Antes de acusar al port, mirar si el ancla ENGANCHÓ la tienda que
   * pidió (`CENSO-ANCLA … veredicto=`): un `VERDE-FALSO` ahí explica un delta 0 sin que el
   * port haya cambiado una línea.
   */
  "ad06-g34": { parte: "ad06", corpus: "ad", esperado: 220 },
  "ad09-g04": { parte: "ad09", corpus: "ad", esperado: -274 },
  "ad21-g26": { parte: "ad21", corpus: "ad", esperado: -1024 },
  "part04-g03": { parte: "part04", corpus: "lp1", esperado: 36 },
  "part05-g05": { parte: "part05", corpus: "lp1", esperado: -954 },
};

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ AQUÍ YA NO HAY RÉPLICAS — LA PREMISA QUE LAS SOSTENÍA ESTÁ REFUTADA
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * `91ec3505` cableó un modo `en-adjudicacion` con `MIN_REPLICAS = 4` para `ad06-g34`, sobre
 * este censo de siete corridas de `ad06` del 02-08 ordenadas por el `when` de su report:
 *
 *     08:42:00   0 · 08:42:28   0 · 08:49:23   0 · 08:55:33 220
 *     08:57:48 220 · 09:01:43 220 · 09:16:50   0
 *
 * y lo leyó como una serie BIESTABLE («una regresión de commit no puede ir rojo→verde→rojo»)
 * ⇒ sello ESTOCÁSTICO ⇒ hay que replicar. **Las siete corridas eran de SEIS CARRILES DISTINTOS,
 * o sea de SEIS ÁRBOLES DISTINTOS, y el `*.report.json` NO LLEVA SHA** (verificado sobre los
 * 348 reports del árbol: cero claves de sha/commit/rev/head). La hora de la corrida no ordena
 * nada: sólo dice quién llegó antes al playwright.
 *
 * Etiquetando cada corrida con el árbol que la produjo (por el reflog del worktree que contiene
 * el report, que es independiente del resultado), la separación es PERFECTA:
 *
 *     220 → fd6c7f7f · fd6c7f7f · (brazo con F-A3 revertido)   ← árboles ANTERIORES a F-A3
 *       0 → a467f122 · ea6aa039 · d5dac8c3 · c2a41e5d          ← árboles POSTERIORES
 *
 * Ordenado por FECHA DEL ÁRBOL en vez de por hora de corrida no es biestable: es un **ESCALÓN
 * MONÓTONO**, con la causa dentro de la ventana (`408ddbda`/`da30e436` = F-A3). El «verde en
 * medio de la serie» era un carril corriendo un árbol viejo tarde.
 *
 * ★ Y hay prueba directa con el signo CONTRARIO: `fd6c7f7f` corrió DOS VECES, desde dos
 * worktrees distintos y con 4 minutos de diferencia → 220 y 220. **Ninguna pareja de corridas
 * del mismo árbol discrepó jamás.** Eso es evidencia POSITIVA de determinismo, no ausencia de
 * evidencia. (`re/notes/ad06-reloj-acta.md` ya traía el A/B de tres brazos etiquetado por sha:
 * la biestabilidad se construyó ignorando una adjudicación que ya estaba en el árbol.)
 *
 * ⇒ **«BILLETE DE LOTERÍA» SIGNIFICA FRÁGIL AL DESPLAZAMIENTO DEL STREAM, NO ESTOCÁSTICO
 * CORRIDA A CORRIDA.** F-A3 planta a la party en otra celda, eso desplaza el stream vivo del
 * `rand(0,3)` del herrero, sale otra de sus cuatro variantes de apertura y las 151 teclas
 * cableadas no la contestan. Es DETERMINISTA dado el árbol.
 *
 * Y por eso las réplicas no sólo sobraban: **hacían daño**. En un árbol dado siempre pagan lo
 * mismo, así que cuatro réplicas rojas no miden nada nuevo — pero el código entraba por
 * `pagan === 0` y declaraba **«el mecanismo está MUERTO»**, que es una acusación FALSA con
 * etiqueta tranquilizadora. Un veredicto equivocado que suena a conclusión es peor que un
 * error ruidoso. Los cinco sellos son DETERMINISTAS: una corrida basta y TODAS las réplicas
 * que haya deben pagar. La rotura viva de `ad06-g34` se modela por lo que ES —una rotura
 * CONOCIDA y ya adjudicada—, no por un determinismo que nunca faltó.
 */

/** Partes que hay que correr para cubrir los cinco sellos, con su corpus. */
export function partesNecesarias() {
  const m = new Map();
  for (const { parte, corpus } of Object.values(SELLOS)) m.set(parte, corpus);
  return [...m].map(([parte, corpus]) => ({ parte, corpus }));
}

/**
 * VEREDICTO PURO — toda la lógica, sin disco. `reports` = Map<parte, reportJSON>.
 * Devuelve una fila por SELLO (los cinco siempre, presente o no) y el veredicto global.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * ★★ `ok` Y `bloquea` SON DOS PREGUNTAS DISTINTAS, Y CONFUNDIRLAS MATÓ LA PUERTA
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * Hasta hoy el código de salida era `ok ? 0 : 1`, y `ROTO-CONOCIDO` lleva `ok: false` (bien:
 * NUNCA es un verde). Consecuencia: mientras `ad06-g34` siga roto por la ficha #12, la puerta
 * está **permanentemente en rojo para todo el que toque `game/src/` o las rutas**. La tabla
 * distinguía `ROTO-CONOCIDO` (◑) de `ROTO-NUEVO` (🔴), pero **el exit los colapsaba**: un
 * humano lo veía y un llamador automático no aprendía nada.
 *
 * ★★ Y una puerta permanentemente roja es PEOR que no tener puerta: enseña a todo el mundo a
 * ignorarla. El primer carril que aterrice diciendo «es la conocida» la habrá matado — y
 * tendrá razón, que es lo grave. Un semáforo siempre en rojo no es precaución, es ruido.
 *
 *   · `ok`      — ¿están los cinco INTACTOS? Se mantiene EXACTAMENTE como estaba, y
 *                 `ROTO-CONOCIDO` sigue siendo `ok: false`. No es un verde y no lo será.
 *   · `bloquea` — ¿hay algo que este diff deba PARAR? Una rotura REGISTRADA y DENTRO DE SU
 *                 CADUCIDAD no bloquea: grita. Todo lo demás sí.
 *
 * 🔴 Y la caducidad es la bisagra: sin ella, «conocida» sería un permiso permanente para no
 * arreglar nada. Vencida ⇒ `ROTO-CONOCIDO-CADUCADO` ⇒ vuelve a bloquear.
 *
 * `hoy` se INYECTA (no `new Date()` dentro) para que los tests de caducidad no dependan del
 * reloj de pared: un test que caduca solo es un test que un día se pone rojo sin que nadie
 * toque el código. [[deltas-sellados-descansan-en-el-reloj]]
 *
 * ★★ `sellos` TAMBIÉN SE INYECTA, y por la misma razón de fondo. El 05-08 murió la última
 * `roturaConocida` viva (`ad06-g34`), y con ella la maquinaria del EXIT 5 se quedó SIN NINGÚN
 * caso real que la ejercitara: sus tests se apoyaban en la tabla de producción, así que
 * probarla habría exigido MANTENER UNA DEUDA VIVA — un incentivo perverso, y un test que se
 * cae solo el día que alguien hace bien su trabajo. Con la tabla inyectable, el mecanismo se
 * prueba con un sello SINTÉTICO y la tabla real queda libre de deudas.
 * [[el-instrumento-necesita-testigo-propio-no-el-caso-vivo]]
 * ⚠ Producción NO pasa este parámetro: el default es la tabla real, y así el CLI y la puerta
 * siguen midiendo lo que se publica.
 */
export function veredicto(reports, hoy = new Date(), sellos = SELLOS) {
  const filas = [];
  for (const [seg, s] of Object.entries(sellos)) {
    // Una parte puede traer VARIAS réplicas (un report por corrida). Se acepta también un
    // report suelto, que es el caso de una sola corrida.
    const bruto = reports.get(s.parte);
    const reps = bruto == null ? [] : Array.isArray(bruto) ? bruto : [bruto];
    if (!reps.length) {
      filas.push({ seg, ...s, estado: "SIN-CORRER", got: null, expected: null, ok: false, replicas: 0,
        detalle: `la parte ${s.parte} no está en los reports — el sello NO se ha medido` });
      continue;
    }
    const deltas = reps.map((r) => (r.ledger?.ledgerDeltas ?? []).find((x) => x.seg === seg)).filter(Boolean);
    if (!deltas.length) {
      filas.push({ seg, ...s, estado: "AUSENTE", got: null, expected: null, ok: false, replicas: reps.length,
        detalle: `${s.parte} corrió pero no emitió delta para ${seg} — el segmento no armó la transacción` });
      continue;
    }
    const linea = lineaDelRunner(reps[reps.length - 1], seg);
    const gots = deltas.map((d) => d.got);
    // La PORTERÍA la mira siempre: si el corpus movió el esperado, ninguna réplica vale.
    const movida = deltas.find((d) => d.expected !== s.esperado);
    if (movida) {
      filas.push({ seg, ...s, estado: "PORTERIA-MOVIDA", got: movida.got, expected: movida.expected, ok: false,
        replicas: deltas.length,
        detalle: `el CORPUS espera ${movida.expected} y el acta publicó ${s.esperado}: el verde no sería comparable`, linea });
      continue;
    }
    const pagan = gots.filter((g) => g === s.esperado).length;

    // ── ROTURA CONOCIDA ────────────────────────────────────────────────────────────────────
    // Un sello con `roturaConocida` está roto HOY por una causa YA ADJUDICADA. Sigue
    // BLOQUEANDO (nunca es un verde), pero la puerta tiene que poder distinguir «sigue siendo
    // la rotura conocida» de «hay una rotura NUEVA encima» — si no, el segundo defecto se
    // esconde detrás del primero y el rojo permanente deja de medir nada.
    if (s.roturaConocida) {
      const rc = s.roturaConocida;
      if (pagan === deltas.length) {
        // ★ Pagó el publicado: la rotura conocida YA NO OCURRE. Es un verde de verdad, pero la
        // anotación se ha quedado RANCIA y hay que retirarla, o la próxima rotura real se
        // leerá como «la conocida» y pasará desapercibida.
        filas.push({ seg, ...s, estado: "INTACTO", got: gots[0], expected: s.esperado, ok: true,
          replicas: deltas.length,
          detalle: `★ la rotura conocida (${rc.got}, ${rc.causa}) YA NO OCURRE: el sello volvió a ` +
                   `pagar ${s.esperado}. RETIRA \`roturaConocida\` de SELLOS — si se queda, la ` +
                   `próxima rotura de verdad se leerá como la conocida.`, linea });
        continue;
      }
      const distintos = [...new Set(gots.filter((g) => g !== rc.got))];
      if (!distintos.length) {
        // La rotura sigue siendo la conocida. ¿Dentro de su caducidad o ya vencida?
        const dias = rc.caduca
          ? Math.ceil((new Date(`${rc.caduca}T23:59:59Z`) - hoy) / 86400000)
          : null;
        if (rc.caduca && dias < 0) {
          filas.push({ seg, ...s, estado: "ROTO-CONOCIDO-CADUCADO", got: rc.got, expected: s.esperado,
            ok: false, bloquea: true, replicas: deltas.length, diasCaducidad: dias,
            detalle: `🔴 rotura conocida con la CADUCIDAD VENCIDA el ${rc.caduca} ` +
                     `(hace ${-dias} día(s)): publicado ${s.esperado}, actual ${rc.got}. ` +
                     `Causa: ${rc.causa} (ficha ${rc.ficha}). VUELVE A BLOQUEAR: una rotura que ` +
                     `nadie arregla deja de ser tolerada y pasa a ser DEUDA VENCIDA. ` +
                     `Cierra ${rc.ficha} o mueve la caducidad EXPLÍCITAMENTE (se verá en el diff).`, linea });
          continue;
        }
        filas.push({ seg, ...s, estado: "ROTO-CONOCIDO", got: rc.got, expected: s.esperado, ok: false,
          bloquea: false, replicas: deltas.length, diasCaducidad: dias,
          detalle: `rotura CONOCIDA y ya adjudicada: publicado ${s.esperado}, actual ${rc.got}. ` +
                   `Causa: ${rc.causa} (ficha ${rc.ficha}). NO bloquea este diff` +
                   (dias === null ? " (sin caducidad declarada)" : `, quedan ${dias} día(s) de caducidad (${rc.caduca})`) +
                   ` — pero NO es un verde: el sello sigue sin pagar.`, linea });
        continue;
      }
      // 🔴 El valor observado NO es ni el publicado ni el conocido: algo se movió ENCIMA.
      filas.push({ seg, ...s, estado: "ROTO-NUEVO", got: distintos[0], expected: s.esperado, ok: false,
        replicas: deltas.length,
        detalle: `🔴 ROTURA NUEVA ENCIMA DE LA CONOCIDA. Publicado ${s.esperado}; la rotura conocida ` +
                 `(${rc.causa}) daba ${rc.got}; el port ha dado ${distintos.join(", ")}. ` +
                 `Esto NO lo explica ${rc.ficha}: es información nueva.`, linea });
      continue;
    }

    // Los cinco son DETERMINISTAS: TODAS las réplicas tienen que pagar.
    if (pagan !== deltas.length) {
      const d = deltas.find((x) => x.got !== s.esperado);
      filas.push({ seg, ...s, estado: "ROTO", got: d.got, expected: d.expected, ok: false, replicas: deltas.length,
        detalle: d.unreadable ? "el contador NO es legible (no medido)" : `el port dio ${d.got}`, linea });
      continue;
    }
    filas.push({ seg, ...s, estado: "INTACTO", got: gots[0], expected: s.esperado, ok: true, replicas: deltas.length, linea });
  }
  // `bloquea` por fila: si no se declaró, TODO lo que no está `ok` bloquea. El default es
  // DENY — una fila nueva que alguien añada mañana bloquea salvo que diga lo contrario a
  // propósito. [[guarda-de-existencia-bendice-el-vacio]]
  for (const f of filas) if (f.bloquea === undefined) f.bloquea = !f.ok;
  return { filas, ok: filas.every((f) => f.ok), bloquea: filas.some((f) => f.bloquea) };
}

/** La línea de veredicto del PROPIO runner (sus palabras, no las mías). */
function lineaDelRunner(rep, seg) {
  const s = (rep.segments ?? []).find((x) => x.id === seg);
  return (s?.resyncs ?? []).find((l) => l.startsWith("LEDGER-DELTA txn:")) ?? null;
}

/**
 * 🔴 GUARDA DE PROCEDENCIA, calcada de `agrega_espejo_ventana.mjs` y por su misma razón: los
 * dirs de salida viven en un scratchpad COMPARTIDO por la flota, y un report rancio de otro
 * carril tiene el mismo nombre que el tuyo. Presencia no es procedencia. `--desde` es
 * OBLIGATORIO y un report anterior a la ventana se EXCLUYE (con lo que su sello sale
 * SIN-CORRER, que es rojo) en vez de colarse como medición de esta corrida.
 */
export function cargar(dirs, desde) {
  const lista = Array.isArray(dirs) ? dirs : [dirs];
  const out = new Map();
  const rancios = [];
  for (const dir of lista) {
  if (!existsSync(dir)) throw new Error(`no existe el dir de reports: ${dir}`);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".report.json")).sort()) {
    const rep = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const parte = basename(f).replace(".report.json", "");
    if (!rep.when || new Date(rep.when) < desde) { rancios.push(`${parte}@${rep.when ?? "sin-when"}`); continue; }
    // Acumula RÉPLICAS: varios dirs (o varios ficheros) de la misma parte se apilan en vez
    // de pisarse — un sello estocástico se adjudica por el conjunto, no por la última.
    out.set(parte, [...(out.get(parte) ?? []), rep]);
  }
  }
  return { reports: out, rancios };
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.filter((a) => !a.startsWith("--"));
  const desdeArg = args.find((a) => a.startsWith("--desde="))?.split("=")[1];
  if (!dir.length || !desdeArg) {
    console.error("uso: node re/tools/veredicto_sellos.mjs <dirDeReports> [<dir2> …] --desde=<ISO>");
    console.error("  --desde es OBLIGATORIO: sin ventana temporal no se distingue un report de");
    console.error("  esta corrida de uno rancio de otro carril en el scratchpad COMPARTIDO.");
    process.exit(2);
  }
  const desde = new Date(desdeArg);
  if (Number.isNaN(+desde)) { console.error(`✗ --desde no es una fecha: ${desdeArg}`); process.exit(2); }

  const { reports, rancios } = cargar(dir, desde);
  if (rancios.length) console.log(`⚠ ${rancios.length} report(s) FUERA DE VENTANA, excluidos: ${rancios.join(" ")}`);

  const { filas, ok, bloquea } = veredicto(reports);
  const ic = { INTACTO: "✓", ROTO: "✗", "PORTERIA-MOVIDA": "🔴", AUSENTE: "✗", "SIN-CORRER": "·",
    "ROTO-CONOCIDO": "◑", "ROTO-CONOCIDO-CADUCADO": "🔴", "ROTO-NUEVO": "🔴" };
  console.log("\nSELLO         PARTE   CORPUS  PUBLICADO   CORPUS      PORT   ");
  console.log("──────────────────────────────────────────────────────────────");
  for (const f of filas) {
    const n = (v) => (v === null || v === undefined ? "—" : String(v));
    console.log(
      `${f.seg.padEnd(13)} ${f.parte.padEnd(7)} ${f.corpus.padEnd(6)} ` +
      `${String(f.esperado).padStart(9)} ${n(f.expected).padStart(8)} ${n(f.got).padStart(8)}   ` +
      `${ic[f.estado] ?? "?"} ${f.estado}`,
    );
    if (!f.ok) console.log(`              └─ ${f.detalle}`);
    if (!f.ok && f.linea) console.log(`                 runner: ${f.linea}`);
  }
  const rotos = filas.filter((f) => !f.ok);
  console.log("──────────────────────────────────────────────────────────────");
  console.log(ok ? "LOS CINCO SELLOS INTACTOS" : `SELLOS NO INTACTOS: ${rotos.length}/5 → ${rotos.map((f) => `${f.seg}(${f.estado})`).join(" ")}`);

  // ── EL CÓDIGO DE SALIDA, en TRES estados (antes eran dos y colapsaban) ──────────────────
  //   0 = los cinco intactos
  //   1 = hay algo que PARAR (rotura nueva, ausencia, sin correr, portería movida, o una
  //       rotura conocida con la CADUCIDAD VENCIDA)
  //   5 = las únicas desviaciones son roturas REGISTRADAS y dentro de su caducidad: NO
  //       bloquea, pero GRITA — con sello, ficha y cuánto le queda.
  //
  // 🔴 POR QUÉ 5 Y NO 3, que era el número obvio: `corre_sellos.sh` YA usa el 3 para «corrida
  // INVALIDADA (movió checkpoints tracked)». Reusarlo habría metido DOS significados en un
  // número — que es exactamente el colapso que este cambio viene a deshacer, sólo que un
  // escalón más abajo. El shell propaga este mismo 5 sin re-mapear: el número significa lo
  // mismo en los dos sitios.
  if (ok) { process.exit(0); }
  if (bloquea) {
    const b = filas.filter((f) => f.bloquea);
    console.log(`\n🔴 EXIT 1 — BLOQUEA: ${b.map((f) => `${f.seg}(${f.estado})`).join(" ")}`);
    process.exit(1);
  }
  const tolerados = filas.filter((f) => !f.ok && !f.bloquea);
  console.log(`\n${"═".repeat(62)}`);
  console.log("◑ EXIT 5 — NO BLOQUEA, PERO NO ES VERDE. Deuda registrada y VIVA:");
  for (const f of tolerados) {
    const rc = f.roturaConocida ?? {};
    console.log(`   · ${f.seg}: publicado ${f.esperado}, da ${f.got} — ficha ${rc.ficha ?? "?"}` +
      (f.diasCaducidad === null || f.diasCaducidad === undefined
        ? " (SIN caducidad declarada)"
        : ` · quedan ${f.diasCaducidad} día(s) (caduca ${rc.caduca})`));
  }
  console.log("   Este diff NO la causó, pero tampoco la arregla. Cuando venza, BLOQUEARÁ.");
  console.log("═".repeat(62));
  process.exit(5);
}

// Sólo como CLI: importarlo desde un test NO debe ejecutar nada.
if (process.argv[1] && process.argv[1].endsWith("veredicto_sellos.mjs")) main();
