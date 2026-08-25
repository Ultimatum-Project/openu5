/**
 * #43 — FUSIÓN de un patch de overlay REGENERADO sobre el CURADO A MANO.
 *
 * ## Por qué existe
 *
 * Los dos generadores (`mkoverlay-lp1.mjs`, `mkoverlay-ad.mjs`) reconstruían `segments` entero,
 * así que `--write`/`--force` **borraba toda la curación manual que el generador no re-emite**.
 * Medido en #43 sobre main `cc4a3b8a`: a nivel de RUTA se perdían los DOS ÚNICOS
 * `anchor.expectDelta` del proyecto (part04-g03 +36, part05-g05 −954), los 3 `recruit` de LP1 y
 * los 3 `dismiss` de AD — y en AD el resultado era AUTO-REFUTANTE, porque la misma pasada
 * reescribía los 25 `ledger.note` para decir «el op `dismiss` EXISTE y está cableado en
 * ad05/ad13/ad21» mientras lo borraba de ad05/ad13/ad21.
 *
 * ## ★★ Por qué la fusión POR CLAVE no basta
 *
 * `{ ...viejo, ...nuevo }` parece suficiente y **pierde uno de los tres `dismiss`**: `ad13-g21`
 * lleva el `recruit` (que el generador SÍ re-emite, de su tabla RECRUITS) y el `dismiss` (que
 * no) en el **MISMO array `insertOps`**, así que la clave nueva reemplaza el array entero.
 * Medido: 3 → 2 con fusión por clave, 3 → 3 fusionando ENTRADA A ENTRADA.
 *
 * Es la trampa del arreglo que parece correcto: mata dos tercios del defecto y el tercio que
 * queda se va sin ruido. Por eso la unidad de fusión es la ENTRADA (`{afterOcrLn, ops}`) y,
 * dentro de ella, la OP; nunca la clave del patch.
 */

/** Serialización estable (claves ordenadas en profundidad) para comparar ops por IDENTIDAD. */
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

/**
 * Fusiona dos listas de `insertOps` agrupando por `afterOcrLn` y deduplicando por identidad
 * de op. El orden de las anclas del overlay VIEJO se conserva (las anclas nuevas se añaden
 * detrás), que es lo que hace que un overlay ya curado salga byte-idéntico cuando el generador
 * no aporta nada nuevo.
 */
export function mergeInsertOps(prev = [], next = []) {
  // ★ La unidad de idempotencia es el BLOQUE, NUNCA la op. Deduplicar por op parece más fino y
  // es un SAPO: una secuencia de teclado repite ops legítimamente
  // (`Enter`,`y`,`Enter`,`y`,`Enter`,`y`,`Escape`), así que colapsar iguales destruye el guion.
  // Medido cuando lo tuve puesto: part06-g05 pasaba de 32 ops a 6, part04-g03 de 13 a 9 — y la
  // comprobación «¿falta alguna CLAVE?» seguía diciendo que no se perdía nada, porque la clave
  // `insertOps` seguía ahí. El instrumento tiene que contar OPS, no claves.
  // Se copia el bloque ENTERO, no sólo {afterOcrLn, ops}: un bloque puede llevar `at:"first"` u
  // otros campos de colocación, y reconstruirlo campo a campo los tira. Me pasó: el `at` de
  // `part04-g03` desaparecía en la primera regeneración y el bloque del ledger volvía al índice
  // 335. Es el mismo error que esta ventana persigue —reconstruir en vez de preservar—, una capa
  // más adentro.
  const out = prev.map((blk) => ({ ...blk, ops: [...(blk.ops ?? [])] }));
  for (const blk of next) {
    const ops = blk.ops ?? [];
    // Un bloque del generador se descarta si el overlay curado YA tiene, en ESA ancla, todas sus
    // ops. Es lo que hace que re-correr salga byte-idéntico y que `ad13-g21` conserve el
    // `dismiss`: el generador re-emite {2690:[recruit]}, que ya está, y el {2680:[dismiss]} —que
    // el generador no conoce— no lo toca nadie.
    const covered = out.some((p) => {
      if (p.afterOcrLn !== blk.afterOcrLn) return false;
      const have = new Set(p.ops.map(stable));
      return ops.every((o) => have.has(stable(o)));
    });
    if (!covered) out.push({ afterOcrLn: blk.afterOcrLn, ops: [...ops] });
  }
  return out;
}

/**
 * Patch regenerado SOBRE el curado a mano: el generador manda en las claves que emite, la
 * curación sobrevive en las que no, y `insertOps` se fusiona entrada a entrada.
 *
 * `gen` puede traer un TOMBSTONE `skip: false` (#43, ruling 2): eso NO es «no opino», es «quita
 * el skip», y tiene que llegar hasta `curate.mjs` para que lo aplique. Por eso se conserva tal
 * cual en vez de podarse aquí.
 */
/**
 * ¿En qué índice de `out` aterriza un bloque `insertOps` anclado en `afterOcrLn`? (#43 ruling 3)
 *
 * Por DEFECTO: la conducta HISTÓRICA, sin tocar — barrido hacia atrás tratando una op sin
 * `ocrLn` como línea 0 (`?? 0`). Conceptualmente es un defecto: un `nav` o un `wait` no llevan
 * información posicional y aun así cortan el barrido, y como suelen estar al final del segmento
 * el bloque acaba aterrizando ahí. Pero **es la conducta que los artefactos encodan**: reproduce
 * 13 de los 14 bloques `insertOps` commiteados de LP1, y «arreglarla» los bajaría a 5 — movería
 * 8 colocaciones que hoy son correctas por construcción y que llevan corridas medidas encima.
 * Cambiarlas mueve medidas y necesita su propia ventana; aquí no se toca.
 *
 * `at: "first"` ancla detrás de la PRIMERA racha que cumple, en vez de la última. Existe por el
 * bloque 14º: `part04-g03` ancla 1070 —el que arma el ledger (`seedInt`+`seedEquip`+`anchor` de
 * la venta a Gwenneth, `expectDelta` +36)— va en el índice 10, ANTES de la tienda, y eso era una
 * EDICIÓN A MANO de la ruta declarada en su propia nota: «el 'y' suelto de ocrLn 1076 lo consume
 * el arnés (quitar si se regenera con curate)». Con `at:"first"` la intención vive en el OVERLAY
 * y el pipeline la reproduce, en vez de vivir sólo en la ruta, donde el siguiente `curate` la
 * deshace — la misma lección que los des-skips de #23.
 */
export function insertAt(out, afterOcrLn, at) {
  if (at === "first") {
    const i = out.findIndex((o) => o.ocrLn != null && o.ocrLn > afterOcrLn);
    return i === -1 ? out.length : i;
  }
  for (let i = out.length - 1; i >= 0; i--) if ((out[i].ocrLn ?? 0) <= afterOcrLn) return i + 1;
  return out.length;
}

/**
 * Claves del segmento que el overlay puede fijar. `curate.mjs` las aplica en este orden.
 * Vive aquí, y no en curate, para que el test de polaridad no tenga que duplicar la lista:
 * una lista copiada es una lista que se queda atrás.
 */
export const PATCHABLE = ["ctx", "enter", "seam", "calib", "note", "policy", "resync", "skip"];

/**
 * Aplica un patch de overlay sobre un segmento de ruta con LAS DOS POLARIDADES (#43 ruling 2).
 *
 * · clave AUSENTE  → «no opino»: se conserva lo que la ruta ya tuviera.
 * · valor `false`  → TOMBSTONE: se QUITA la clave del segmento.
 * · cualquier otro → se asigna.
 *
 * La baja no puede inferirse de la ausencia: eso mataría, en el siguiente `curate`, cualquier
 * curación hecha a mano en la ruta que el overlay no conociera — el mismo veneno que #43
 * midió una capa más abajo. Censado antes de elegir el centinela: hoy no hay ni un `false`
 * literal en ninguna de estas claves, ni en los 49 overlays ni en las 49 rutas, así que `false`
 * es un valor libre. Ojo: `seam: null` SÍ existe y es un valor legítimo, no un tombstone.
 *
 * Muta `seg` (es el objeto de la ruta que `curate` está construyendo) y lo devuelve.
 */
export function applyPatchKeys(seg, patch = {}, keys = PATCHABLE) {
  for (const k of keys) {
    if (patch[k] === undefined) continue;
    if (patch[k] === false) delete seg[k];
    else seg[k] = patch[k];
  }
  return seg;
}

export function mergePatch(prev = {}, gen = {}) {
  const out = { ...prev, ...gen };
  const insertOps = mergeInsertOps(prev.insertOps ?? [], gen.insertOps ?? []);
  if (insertOps.length) out.insertOps = insertOps;
  else delete out.insertOps;
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────────────────────
 * RECONCILIACIÓN OVERLAY↔RUTA — «¿qué perdería una regeneración?»
 *
 * El `skip` (y toda la familia PATCHABLE) vive en DOS capas: el overlay y la ruta. **El runner
 * sólo lee la RUTA.** Así que una regeneración que borre una clave de la ruta cambia lo que se
 * ejecuta, mientras el overlay —que nadie ejecuta— parece estar de acuerdo consigo mismo.
 *
 * ⚠ El enunciado histórico de este pipeline era «curate NUNCA borra; regenerar es INERTE». Eso
 * describía main `cc4a3b8a` y HOY ES FALSO: #43 ruling 2 le dio a `applyPatchKeys` el TOMBSTONE
 * (`false` = «quita la clave»), que es exactamente la capacidad de borrar. Medido sobre los 49
 * overlays y las 49 rutas commiteadas: 63 `skip: "pendiente-runner"` de AD desaparecerían.
 *
 * El canal NO es la ausencia —una clave que el overlay no menciona se conserva, y por eso las
 * 2621 claves que sólo viven en la ruta están a salvo—: es el tombstone que `mkoverlay-ad.mjs`
 * emite en su rama `else` para todo lo que su clasificador no ve como interior.
 * ───────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Diff de las claves PATCHABLE entre DOS rutas, emparejando segmentos por `id`.
 *
 * Es el instrumento base: lo usa la reconciliación de abajo y lo usa el cinturón de escritura de
 * `apply-ledger-overlay.mjs` (antes/después de su propia mutación). Deliberadamente NO mira el
 * guion: las ops tienen su propio canal (`opsDeOverlayHuerfanas`) y mezclarlos daría un
 * instrumento que no discrimina cuál de los dos se rompió.
 *
 * Un segmento que desaparece entero se reporta clave a clave; uno nuevo no aporta pérdidas.
 */
export function camposPerdidos(antes, despues, keys = PATCHABLE) {
  const porId = new Map((despues.segments ?? []).map((s) => [s.id, s]));
  const out = [];
  for (const seg of antes.segments ?? []) {
    const otro = porId.get(seg.id) ?? {};
    for (const k of keys) {
      if (!(k in seg)) continue;
      if (!(k in otro)) out.push({ segId: seg.id, clave: k, enRuta: seg[k], motivo: "BORRADO" });
      else if (stable(otro[k]) !== stable(seg[k]))
        out.push({ segId: seg.id, clave: k, enRuta: seg[k], enOverlay: otro[k], motivo: "PISADO" });
    }
  }
  return out;
}

/**
 * ★★ CLASIFICA las pérdidas de una pasada de ESCRITURA en FATALES y DECLARADAS.
 *
 * Es el contrato del cinturón de `apply-ledger-overlay.mjs --claves` (ventana `banner-ad19`,
 * pre-registro §2), y vive AQUÍ, como función pura, por un motivo medido: cuando la clasificación
 * era un arrow inline dentro del CLI, el mutante «el cinturón acepta `PISADO` de segmentos NO
 * nombrados» **SOBREVIVÍA a la batería entera**. No porque el aserto faltara, sino porque el
 * bucle del CLI ya filtra por la lista blanca, así que esa rama es INALCANZABLE desde fuera: es
 * un SEGUNDO CERROJO, y un segundo cerrojo sólo se puede probar desenroscándolo.
 * Sacarlo aquí lo hace unit-testeable sin tener que romper antes el primero.
 *
 * La asimetría es deliberada — nombrar un segmento autoriza a FIJARLE claves, nunca a
 * QUITÁRSELAS:
 *  · `BORRADO` → FATAL siempre. El tombstone `false` es una BAJA, y adjudicar bajas no es de este
 *    script (son los 63 `skip` pendientes de `curate-verify-acta.md`). Default-DENY.
 *  · `PISADO` de un segmento NOMBRADO y con `claves` activo → DECLARADO: es el efecto pedido.
 *  · cualquier otra cosa → FATAL.
 *
 * @param {Array<{segId: string, clave: string, motivo: string}>} perdidas salida de `camposPerdidos`
 * @param {{ segIds?: readonly string[], claves?: boolean }} opts
 */
export function clasificarPerdidas(perdidas, { segIds = [], claves = false } = {}) {
  const declarado = (c) => claves && c.motivo === "PISADO" && segIds.includes(c.segId);
  return { fatales: perdidas.filter((c) => !declarado(c)), declarados: perdidas.filter(declarado) };
}

/**
 * Qué campos de `route` perdería o pisaría una regeneración desde `overlay`.
 *
 * ★ Aplica la MISMA `applyPatchKeys` que `curate.mjs`, sobre una COPIA de cada segmento. No es
 * una réplica de curate: es curate. Una reconciliación que reimplementara la regla de polaridad
 * podría divergir de la conducta que dice predecir, y entonces el instrumento avalaría en vez de
 * medir — el defecto que esta ventana vino a cerrar, un piso más arriba.
 *
 * `rancios`: ids cuyo patch NO se aplicará por huella desalineada (#85). `curate` los salta, así
 * que reportarlos sería un FALSO POSITIVO; el llamador los calcula con `segAnchor` igual que él.
 */
export function camposEnRiesgo(route, overlay = {}, { rancios = new Set() } = {}) {
  const despues = {
    segments: (route.segments ?? []).map((seg) => {
      const patch = rancios.has(seg.id) ? {} : (overlay.segments?.[seg.id] ?? {});
      return applyPatchKeys({ ...seg }, patch);
    }),
  };
  return camposPerdidos(route, despues);
}

/**
 * Claves de segmento que el CINTURÓN de escritura vigila: TODAS las que los segmentos de `ruta`
 * llevan hoy, menos las que su productor reescribe POR CONTRATO.
 *
 * ★★ NO es `PATCHABLE`. Un cinturón que sólo vigilara las 8 claves que el mecanismo de HOY toca
 * es ciego el día que la pérdida llegue por otra clave — la misma forma de código muerto que
 * meter el cinturón dentro del `if` del caso concreto que preocupa. Medido sobre el corpus: los
 * segmentos llevan `skipReason` (205), `openedBy` (103) y `ocr` (1052), ninguna en `PATCHABLE`.
 *
 * ⚠ Lo que el ensanche NO compra, dicho para que nadie lo lea de más: sobre el corpus de hoy
 * reporta EXACTAMENTE lo mismo que `PATCHABLE` (63 = 63 en las 49 rutas), así que su valor es de
 * SEGURO, no de hallazgo. Lo que sí está medido es su COSTE: **0 falsos positivos** — y un gate
 * que cría falsos positivos acaba corriéndose con la flag que lo apaga.
 *
 * ⚠ Y no ve el otro filo del des-skip: la pasada deja 63 `skipReason` HUÉRFANOS (el motivo
 * sobrevive al `skip` que lo justificaba). Eso no es una PÉRDIDA —la clave sigue ahí—, así que
 * ningún cinturón con esta forma lo detecta. Queda dicho en el acta, no fingido aquí.
 *
 * ★ Se DERIVA del corpus en cada pasada en vez de escribirse a mano, así que no puede quedarse
 * atrás cuando aparezca una clave nueva. Y es COMPLETA por construcción para la detección de
 * pérdidas: una clave que no está en `antes` no puede perderse.
 *
 * Excluidas, y por qué:
 * · `script` / `expect` — el productor los RECONSTRUYE (todos→ops, `expectClass`). Vigilarlos
 *   daría rojo en cada pasada; el guion tiene sus propios canales (la DERIVA y las huérfanas).
 * · `id` — es la clave de emparejamiento, no carga útil.
 */
export function clavesVigiladas(ruta) {
  const keys = new Set();
  for (const seg of ruta.segments ?? []) for (const k of Object.keys(seg)) keys.add(k);
  for (const k of ["script", "expect", "id"]) keys.delete(k);
  return [...keys];
}

/**
 * ★★ EL CINTURÓN DEL GUION — la capa que `camposPerdidos` NO mira, a propósito.
 *
 * `camposPerdidos`+`clavesVigiladas` reconcilian CAMPOS DE SEGMENTO, y `clavesVigiladas` EXCLUYE
 * `script` porque su productor (curate) lo reconstruye por contrato. Eso convierte a ese cinturón
 * en el TESTIGO EQUIVOCADO para un escritor que sólo toca el guion: `derive-anchors.mjs` escribe
 * exclusivamente `op.anchor`, así que el cinturón de curate, cableado tal cual sobre él, da 0
 * SIEMPRE — y sigue dando 0 mientras la pasada destruye un ancla. MEDIDO: se le puso a
 * `part04-g03` el `src:"overlay-timing"` que curate documenta (curate.mjs §172), la pasada purgó
 * el ancla `expectDelta:+36` (una de las TRES del proyecto) con exit 0, y
 * `camposPerdidos(antes, despues, clavesVigiladas(antes))` reportó **0 pérdidas**.
 *
 * De ahí esta función: el canal con DIENTES para la capa del guion. Es hermana de
 * `camposPerdidos`, no una variante suya — el reparto es deliberado, para que un rojo diga CUÁL
 * de las dos capas se rompió (la misma razón por la que `camposPerdidos` no mira el guion).
 *
 * Empareja segmentos por `id` y ops por ÍNDICE. El índice es válido para un escritor que no
 * cambia la SECUENCIA de ops (derive-anchors sólo asigna/borra `anchor`); si la longitud se
 * mueve, emparejar por índice daría un torrente de BORRADA falsas, así que eso se reporta como
 * su propio motivo en vez de fingir un diff op a op.
 *
 * Motivos:
 * · `BORRADA` — el ancla desaparece entera (la rama de purga del derivador).
 * · `CAMPO`   — el ancla sobrevive pero PIERDE una clave: el caso con nombre es `expectDelta`,
 *               que ningún derivador emite (espejo-ledger-ad.md §4) y que por tanto se va sin
 *               ruido cuando un ancla derivada pisa una puesta a mano.
 * · `GUION REDIMENSIONADO` / `SEGMENTO PERDIDO` — el emparejamiento deja de ser posible.
 *
 * Un cambio de VALOR en una clave que sigue estando NO se reporta: eso es el productor
 * re-derivando, que es su contrato. Vigilarlo daría rojo en cada pasada.
 */
export function anclasPerdidas(antes, despues) {
  const porId = new Map((despues.segments ?? []).map((s) => [s.id, s]));
  const out = [];
  for (const seg of antes.segments ?? []) {
    const script = seg.script ?? [];
    const conAncla = script.filter((op) => op?.anchor);
    if (!conAncla.length) continue;
    const otro = porId.get(seg.id);
    if (!otro) {
      for (const op of conAncla)
        out.push({ segId: seg.id, opIndex: script.indexOf(op), motivo: "SEGMENTO PERDIDO", enRuta: op.anchor });
      continue;
    }
    const nuevo = otro.script ?? [];
    if (nuevo.length !== script.length) {
      out.push({
        segId: seg.id,
        opIndex: -1,
        motivo: "GUION REDIMENSIONADO",
        enRuta: `${script.length} ops con ${conAncla.length} ancla(s)`,
        enOverlay: `${nuevo.length} ops`,
      });
      continue;
    }
    script.forEach((op, i) => {
      if (!op?.anchor) return;
      const dst = nuevo[i]?.anchor;
      if (!dst) {
        out.push({ segId: seg.id, opIndex: i, motivo: "BORRADA", enRuta: op.anchor });
        return;
      }
      for (const k of Object.keys(op.anchor))
        if (!(k in dst))
          out.push({ segId: seg.id, opIndex: i, clave: k, motivo: "CAMPO", enRuta: op.anchor[k], enOverlay: dst });
    });
  }
  return out;
}

/**
 * Ops estampadas `src:"overlay*"` en la ruta que el overlay ya NO reproduce.
 *
 * `curate` retira toda la familia `overlay*` del guion y la repone desde `insertOps`, así que una
 * op cuyo ancla (`ocrLn`) no exista en el overlay se va sin ruido. Se compara el CONJUNTO DE
 * ANCLAS, no la colocación: predecir el índice sería reimplementar `insertAt` y su defecto
 * histórico, y un instrumento no debe heredar el defecto de lo que vigila.
 */
export function opsDeOverlayHuerfanas(route, overlay = {}) {
  const out = [];
  for (const seg of route.segments ?? []) {
    const anclas = new Set((overlay.segments?.[seg.id]?.insertOps ?? []).map((b) => b.afterOcrLn));
    for (const op of seg.script ?? []) {
      if (!String(op.src ?? "").startsWith("overlay")) continue;
      if (!anclas.has(op.ocrLn)) out.push({ segId: seg.id, ocrLn: op.ocrLn, op });
    }
  }
  return out;
}
