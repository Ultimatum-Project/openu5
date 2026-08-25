/**
 * INSIGNIAS DE PROGRESO de los momentos legendarios: qué has AÑADIDO y qué has JUGADO.
 *
 * Todo local, sin servidor y sin una sola cuenta: el sitio no sabe quién eres y esto no lo
 * cambia. Lo único que se persiste son diez números como mucho (§EL SELLO, abajo).
 *
 * ══ 1. «AÑADIDO» NO SE PERSISTE: SE DERIVA DEL ALMACÉN ═══════════════════════════════════
 * Es el mismo criterio que la galería ya usaba (`momentos.ts` §«AÑADIDO ✓» SE LEE DEL
 * ALMACÉN), y se mueve aquí para que HAYA UNO SOLO: la tarjeta y la insignia no pueden
 * discrepar si las calcula la misma función. Un momento está añadido si su ranura está en
 * `u5clone:saves` con `provenance: 'momento'` — y deja de estarlo en cuanto el jugador la
 * borra, sin que nadie tenga que enterarse.
 *
 * ══ 2. «JUGADO»: EL CRITERIO DEL ENCARGO NO EXISTE, Y ESTÁ MEDIDO ════════════════════════
 * 🔴 El encargo proponía «la partida del momento tiene timestamp de guardado POSTERIOR a la
 * instalación». Eso NO PUEDE PASAR NUNCA, y no es una opinión sobre el diseño: es lo que
 * hace el código de guardado.
 *
 *   · Guardar a mano acuña una ranura NUEVA cada vez — `saveGame` (core/persistence.ts:135-142)
 *     hace `id = save-${Date.now().toString(36)}-${rand}` y llama a `putSave` con ESE id.
 *   · El autoguardado escribe en `autosave-1/2/3` — `autosave` (persistence.ts:190-204),
 *     rotatorio por `u5clone:autosavePtr`.
 *   · Ninguno de los dos toca `u5clone:save:momento-07`. No hay «guardar encima de la ranura
 *     cargada»: el juego no recuerda de qué ranura salió.
 *
 * ⇒ el `timestamp` de un momento sólo se mueve si lo VUELVES A AÑADIR (`installMomentoSave`
 * es un upsert y refresca la cabecera, persistence.ts:161-171). Un predicado escrito sobre esa
 * frase habría dado **jugado = false siempre**, y habría dado la insignia por implementada:
 * un verde vacuo con pinta de dato. Peor todavía en su único caso positivo — re-añadir un
 * momento se habría leído como «lo has jugado», que es justo lo contrario.
 *
 * ── EL CRITERIO QUE SÍ SE OBSERVA, y se declara entero ──────────────────────────────────
 * Se compone de las DOS mitades que la landing tiene a mano, porque ninguna basta sola:
 *
 *   (a) LA APERTURA — la landing es dueña del enlace «Jugar desde aquí» de la tarjeta de un
 *       momento (`partidas.ts`), así que sabe el instante en que te fuiste a jugar ESE. Es lo
 *       único que ata un momento concreto con lo que pase después. Sola no vale: seguir un
 *       enlace no es jugar.
 *   (b) UNA PARTIDA GUARDADA DESPUÉS — en `u5clone:saves`, cualquier cabecera que NO sea de un
 *       momento (o sea: guardado a mano o autoguardado) con `timestamp` posterior a esa
 *       apertura. Sola no vale: no dice de qué venía.
 *
 * Y la atribución es al momento ABIERTO MÁS RECIENTEMENTE ANTES de ese guardado, no a todos
 * los abiertos alguna vez. Sin eso, abrir el 07 después de haber jugado el 03 marcaría los dos.
 *
 * ⚠ LO QUE ESTE CRITERIO NO DISTINGUE, dicho aquí y no descubierto por el siguiente: si abres
 * un momento, lo cierras sin jugar y luego juegas UNA PARTIDA TUYA y guardas, el momento se
 * marca como jugado. Es el falso positivo que queda, y se acepta a sabiendas: el arreglo sería
 * que el JUEGO estampara de qué ranura arrancó, que es estado nuevo en el motor para adornar
 * una insignia de la landing. La dirección del error es la benigna — de más, nunca de menos —
 * y la insignia no da ni quita nada: informa.
 *
 * 🔴 Y el autoguardado hace que esto se dispare ANTES de lo que parece: salta en cada
 * `map-changed` (main.ts:1872), o sea al entrar en el primer pueblo o mazmorra. No hace falta
 * que el jugador guarde a mano — que es lo que salva al criterio de ser inútil, porque casi
 * nadie guarda a mano en los primeros diez minutos.
 *
 * ══ 3. EL SELLO ═════════════════════════════════════════════════════════════════════════
 * Una sola clave, `openu5-momentos-aperturas`, con `{ "momento-07": 1754680000000 }`. No lleva
 * nada del jugador ni de su copia: ids que ya son públicos y milisegundos.
 *
 * 🔴 EL PREFIJO ES PARTE DEL CONTRATO, no estética. `limpieza.ts` barre `localStorage` por los
 * CUATRO prefijos que documenta (`u5clone:`, `u5.`, `u5dbg-`, `openu5-`) y es default-deny: una
 * clave fuera de esa familia SOBREVIVE a «Borrar datos locales». Esta nació como
 * `u5:momentos:aperturas` y lo hacía — el `u5:` se copió de los nombres de EVENTO (`u5:shot`,
 * `u5:aspect-changed`), que son otra cosa y no los barre nadie. `openu5-` es la familia de lo
 * que guarda el SITIO (junto a `openu5-lang` y `openu5-consentimiento`), que es lo que esto es.
 *
 * 🔴 Y sigue borrándose ADEMÁS por `borraAperturas` en `partidas.ts:borraTodo`: ése es el OTRO
 * botón («borrar mis partidas»), que barre sólo `u5clone:` y por tanto no la alcanza por prefijo.
 * Son dos caminos distintos y hacen falta los dos.
 */
import type { SaveMeta } from "../../game/src/core/save-keys.js";

/** Dónde viven las aperturas. Prefijo `openu5-`: uno de los CUATRO que `limpieza.ts` barre. */
export const CLAVE_APERTURAS = "openu5-momentos-aperturas";

/** Lo que se sabe de UN momento. Los dos son independientes: se puede estar en los dos. */
export interface Insignia {
  anadido: boolean;
  jugado: boolean;
}

/** `{ id → epoch ms de la ÚLTIMA vez que se fue a jugarlo }`. */
export type Aperturas = Record<string, number>;

/**
 * Lee las aperturas. Nunca lanza: almacenamiento bloqueado (modo privado), clave ausente o
 * contenido corrupto dan `{}` — la pantalla se pinta igual, sólo que sin insignias.
 *
 * Se filtra a NÚMEROS FINITOS por entrada y no se confía en la forma: esto es JSON que ya
 * estaba en disco, y una entrada basura envenenaría la comparación de abajo (`t <= x` con
 * `x = NaN` es `false`, con `x = "9"` compara cadenas) sin dar error.
 */
export function leeAperturas(storage: Storage = localStorage): Aperturas {
  let crudo: string | null;
  try {
    crudo = storage.getItem(CLAVE_APERTURAS);
  } catch {
    return {};
  }
  if (!crudo) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(crudo);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const out: Aperturas = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * Apunta que el visitante se ha ido a jugar este momento AHORA. Idempotente por id: guarda
 * la última, que es la que interesa (jugar hoy no debería depender de haberlo abierto en
 * marzo). Devuelve si se pudo escribir; un almacenamiento lleno o bloqueado no rompe nada —
 * lo único que se pierde es la insignia.
 */
export function marcaApertura(
  id: string,
  ahora: number = Date.now(),
  storage: Storage = localStorage,
): boolean {
  const todas = leeAperturas(storage);
  todas[id] = ahora;
  try {
    storage.setItem(CLAVE_APERTURAS, JSON.stringify(todas));
    return true;
  } catch {
    return false;
  }
}

/** Borra el sello entero. Lo llama el «borrar todo» de la pantalla (ver §3 de la cabecera). */
export function borraAperturas(storage: Storage = localStorage): void {
  try {
    storage.removeItem(CLAVE_APERTURAS);
  } catch {
    /* almacenamiento bloqueado: no había nada que borrar que este código pueda alcanzar */
  }
}

/**
 * El momento que estaba abierto MÁS RECIENTEMENTE en el instante `t`, o `null`.
 *
 * Empates: se recorre en orden de id y se exige estrictamente MAYOR para desbancar, así que
 * dos aperturas con el mismo milisegundo dan siempre el mismo ganador (el id menor). No puede
 * pasar con dos clics de un humano; se fija para que la función sea una función.
 */
function abiertoAntesDe(aperturas: Aperturas, t: number): string | null {
  let mejor: string | null = null;
  let cuando = -Infinity;
  for (const id of Object.keys(aperturas).sort()) {
    const x = aperturas[id]!;
    if (x <= t && x > cuando) {
      mejor = id;
      cuando = x;
    }
  }
  return mejor;
}

/**
 * Las insignias de todos los momentos que tengan alguna, calculadas del índice VIVO y de las
 * aperturas. Los que no salen en el mapa no tienen nada que decir.
 *
 * 🔴 `indice` es el crudo de `readSaveIndex()`, SIN filtrar y sin ordenar: aquí se necesitan
 * las dos clases de cabecera a la vez —las de momento, para «añadido», y las que NO lo son,
 * para «jugado»—, así que un llamante que pasara sólo las suyas rompería la mitad del
 * predicado sin que nada avisara.
 */
export function insignias(
  indice: readonly SaveMeta[],
  aperturas: Aperturas,
): Map<string, Insignia> {
  const out = new Map<string, Insignia>();
  const dame = (id: string): Insignia => {
    let v = out.get(id);
    if (!v) {
      v = { anadido: false, jugado: false };
      out.set(id, v);
    }
    return v;
  };

  for (const m of indice) {
    if (m.provenance === "momento" && m.momentoId) dame(m.momentoId).anadido = true;
  }
  for (const s of indice) {
    // Las ranuras de momento quedan FUERA del lado (b): la del propio momento se escribió al
    // añadirlo, y si se re-añade DESPUÉS de abrirlo su timestamp pasaría a ser posterior — y
    // «volver a añadirlo» se leería como «lo he jugado», que es el falso positivo exacto que
    // el criterio refutado de la cabecera producía.
    if (s.provenance === "momento") continue;
    if (typeof s.timestamp !== "number" || !Number.isFinite(s.timestamp)) continue;
    const id = abiertoAntesDe(aperturas, s.timestamp);
    if (id !== null) dame(id).jugado = true;
  }
  return out;
}
