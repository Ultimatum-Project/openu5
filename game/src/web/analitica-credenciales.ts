/**
 * FUENTE CANÓNICA DE LAS CREDENCIALES DE ANALÍTICA (#129).
 *
 * El token vive AQUÍ, en el código, a propósito y con la razón al lado. No es un descuido
 * ni un secreto filtrado: es la decisión de #129, aprobada por el lead el 09-08-2026.
 *
 * ══ POR QUÉ EL TOKEN VA EN EL CÓDIGO ═════════════════════════════════════════════════
 *
 * (1) ES UNA CREDENCIAL DE ESCRITURA PÚBLICA POR CONSTRUCCIÓN. La integración que PostHog
 *     documenta incrusta este token en el snippet de cliente que se sirve al navegador
 *     (`posthog.com/docs/libraries/js`: `posthog.init('<ph_project_token>', {…})`), y sus
 *     endpoints públicos «don't require authentication, but use your project token»
 *     (`posthog.com/docs/api`) — sólo captura. Leer datos exige otra clase de credencial.
 *     El riesgo de exponerlo es que un tercero mande EVENTOS FALSOS; no hay fuga de datos.
 *     ⚠️ DICHO CON PRECISIÓN, y esto importa más que la conclusión: PostHog **no publica
 *     una frase citable** del tipo «es seguro exponerla». La busqué el 09-08 en
 *     `/docs/privacy/data-collection`, `/docs/api` y `/docs/libraries/js` y no está. Lo de
 *     arriba es DERIVACIÓN de su integración documentada, no cita de una política. Si
 *     algún día aparece esa frase, cítese; mientras tanto, que se lea como lo que es.
 *
 * (2) EL ÁRBOL YA LO SERVÍA. `site/legacy/byo-static/eventos-CIJEPUTk.js` está TRACKEADO y
 *     lleva este mismo valor horneado, y se sirve en producción con 200. Esto FORMALIZA
 *     una exposición que ya existía; no la crea.
 *
 * (3) LOS `.env` NO TRACKEADOS PARTÍAN LOS BUILDS EN DOS POBLACIONES. El principal horneaba
 *     y un worktree no, las dos compilaban en verde, y el artefacto difería. MEDIDO el
 *     09-08 en openu5.org: `/play` servía la clave y `/byo` NO — la página con más visitas
 *     llevaba quién sabe cuánto sin enviar nada, en silencio porque el modo sin clave es un
 *     no-op por diseño. Con el token aquí hay UNA población y el build de cualquier
 *     checkout es comparable con el del principal.
 *
 * ══ 🔴 LO QUE **NO** AUTORIZA ESTA DECISIÓN ══════════════════════════════════════════
 * Esto vale para el TOKEN DE PROYECTO (`phc_…`), y sólo para él. La **Personal API Key**
 * de PostHog es otra cosa: da lectura y administración sobre la cuenta, vive en el gestor
 * de secretos del usuario (`~/.claude/secrets/`) y **JAMÁS va al código, ni a un `.env`
 * trackeado, ni a un log, ni a un commit**. Que este fichero exista no crea un precedente
 * para «las claves de PostHog van en el código»: crea uno para *esta* clase de credencial,
 * y la distinción está escrita aquí para que nadie promueva la otra por analogía.
 */

/** Configuración de analítica: el par que el SDK necesita para arrancar. */
export interface CredencialesAnalitica {
  /** Token de PROYECTO de PostHog (`phc_…`). Público por construcción — ver cabecera. */
  readonly clave: string;
  /** Host de ingesta. La región importa: el proyecto vive en la UE. */
  readonly host: string;
}

/**
 * El valor de producción. Es el DEFAULT: sin ficheros de entorno, un build de cualquier
 * checkout sale con esto — que es justo lo que hace que haya UNA sola población.
 */
export const CREDENCIALES_PRODUCCION: CredencialesAnalitica = {
  clave: "phc_nGiKd2jBRwP7herp8U7T2HCLo9B42JmXsYPMRrr5sLzT",
  host: "https://eu.i.posthog.com",
};

/**
 * PRECEDENCIA, DECLARADA (no adivinada): el entorno GANA al default, y sólo en DEV.
 *
 * 🔴 EL «SÓLO EN DEV» ES LA MITAD QUE IMPIDE QUE #129 VUELVA. Si un `.env` pudiera
 * silenciar la analítica en un build de PRODUCCIÓN, seguiríamos teniendo dos poblaciones
 * —una con clave y otra sin— y el modo de fallo silencioso intacto. Un despliegue lleva
 * SIEMPRE las credenciales de producción; un desarrollador puede apuntar su `npm run dev`
 * a otro proyecto de PostHog, o vaciar la clave para no ensuciar los datos, y eso no puede
 * viajar.
 *
 * ⚠️ Vaciar la clave en DEV es legítimo y deja la analítica apagada (no-op limpio). Vaciarla
 * en un build de producción no es posible por aquí, y si alguien lo fuerza, el ensamblador
 * lo caza: §POBLACION comprueba los bundles y enrojece.
 */
export function credenciales(
  env: Record<string, unknown> = (import.meta as { env?: Record<string, unknown> }).env ?? {},
): CredencialesAnalitica {
  const esDev = env["DEV"] === true;
  if (!esDev) return CREDENCIALES_PRODUCCION;

  const leer = (k: string, porDefecto: string): string =>
    typeof env[k] === "string" ? (env[k] as string).trim() : porDefecto;
  return {
    // En DEV el `.env` sobrescribe; sin `.env`, se usa producción igual que en el despliegue,
    // para que lo que ve el desarrollador sea lo que se publica.
    clave: leer("VITE_POSTHOG_KEY", CREDENCIALES_PRODUCCION.clave),
    host: leer("VITE_POSTHOG_HOST", CREDENCIALES_PRODUCCION.host),
  };
}
