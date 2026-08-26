/**
 * REGISTRO DE LOS MENSAJES DEL BÚFER DS 0xB21E — el texto de EA que el port EMITE y que
 * ya no vive en el código.
 *
 * ── QUÉ CIERRA ───────────────────────────────────────────────────────────────────────
 * `re/notes/acta-630-prosa-publicada.md` midió 653 palabras de prosa de EA en el árbol
 * que el repo público sirve, y **638 de ellas** eran cadenas del segmento de datos
 * transcritas A MANO: los discursos de resurrección de Lord British (KARMA.DAT), el
 * interrogatorio de Blackthorn y la máxima del santuario (MISCMSG.DAT) y la escena del
 * Códice (ENDMSG.DAT). Estaban en el código porque eran IRRECUPERABLES —`acta-380` §4
 * midió que 0 de 18 estaban en `game/assets`, ya que KARMA.DAT y MISCMSG.DAT no los
 * extraía nadie—. El extractor ya los emite (`extractor/src/parsers/ds-strings.ts`), así
 * que hoy llegan del juego DEL PROPIO USUARIO, como los TLK.
 *
 * ── EL MECANISMO NO ES NUEVO ─────────────────────────────────────────────────────────
 * Es el de `game/assets` de siempre: asset gitignored + `fetchJson` en el arranque. Y es
 * el mismo movimiento que hizo `i18n-huella` con `es.json` (#380): el inglés deja de
 * ALMACENARSE y pasa a LLEGAR, leído de los ficheros del usuario.
 *
 * 🔴 ESTE MÓDULO NO IMPORTA NADA, y es un requisito y no un gusto — el mismo que declara
 * `extractor/src/assets-catalog.ts`: lo importa el core del juego, y en este repo ya se
 * midió que importar una constante importa su GRAFO (477 KB colados por un import).
 */

/** Los tres ficheros de mensajes que el original carga al búfer DS 0xB21E. */
export type DsStringFile = "KARMA.DAT" | "MISCMSG.DAT" | "ENDMSG.DAT";

/** Lo que emite el extractor: registros NUL-delimitados por fichero, en orden de fichero. */
export type DsStrings = Readonly<Record<DsStringFile, readonly string[]>>;

/** La ruta del asset, para que el mensaje de fallo y el arranque digan lo mismo. */
export const DS_STRINGS_ASSET = "/assets/ds-strings.json";

let cargadas: DsStrings | null = null;

/**
 * Instala el asset. Lo llama el arranque (`main.ts`) tras `fetchJson`, y las suites que
 * ejercitan estas escenas vía `game/tests/ds-strings-fixture.ts`.
 *
 * VALIDA en vez de confiar: un JSON con la forma cambiada (o el `{}` que devuelve un
 * soft-404 con `res.ok` true — #63/#293) instalaría un registro vacío, y el primer
 * `dsRec` fallaría lejos de aquí con «record fuera de rango», que se lee como un índice
 * mal calculado del port y no como un asset que no llegó. El sitio donde se puede decir
 * la verdad es éste.
 */
export function instalaDsStrings(datos: DsStrings): void {
  const faltan = (["KARMA.DAT", "MISCMSG.DAT", "ENDMSG.DAT"] as const).filter(
    (f) => !Array.isArray(datos?.[f]) || datos[f].length === 0,
  );
  if (faltan.length > 0) {
    throw new Error(
      `${DS_STRINGS_ASSET} no tiene registros para ${faltan.join(", ")}. ` +
        `La extracción es vieja o incompleta: vuelve a ejecutar \`npm run extract\`.`,
    );
  }
  cargadas = datos;
}

/** ¿Hay asset instalado? Para que un test pueda SALTARSE en vez de reventar. */
export function hayDsStrings(): boolean {
  return cargadas !== null;
}

/** Sólo para tests: devuelve el registro al estado sin instalar. */
export function olvidaDsStrings(): void {
  cargadas = null;
}

/**
 * Registro `idx` de `file`, byte-exacto del fichero del usuario.
 *
 * 🔴 FALLA CLARO Y TEMPRANO, que es el requisito: sin esto, un asset ausente dejaría a
 * los literales en `undefined` y la escena saldría con «undefined» pintado en la
 * consola del juego —o en blanco— sin decir por qué. El mensaje nombra el asset, el
 * fichero del original y la acción.
 */
export function dsRec(file: DsStringFile, idx: number): string {
  if (cargadas === null) {
    throw new Error(
      `${DS_STRINGS_ASSET} no está cargado y el juego necesita ${file} rec${idx} ` +
        `(texto del juego original). Ejecuta \`npm run extract\` sobre tu copia de ` +
        `Ultima V, o re-haz la extracción en /byo si juegas en el sitio.`,
    );
  }
  const rec = cargadas[file]?.[idx];
  if (typeof rec !== "string") {
    throw new Error(
      `${file} rec${idx} no existe en ${DS_STRINGS_ASSET} ` +
        `(${cargadas[file]?.length ?? 0} registros). ¿Es una edición distinta del juego?`,
    );
  }
  return rec;
}
