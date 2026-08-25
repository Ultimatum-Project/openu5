/**
 * SONDA DE ALCANZABILIDAD DE LA TABLA DE aiType — INSTRUMENTO, NO MECÁNICA.
 *
 * 🔴 ESTO NO ES CONDUCTA PORTADA. No modela nada del binario y no debe contarse como
 * mecánica en ningún censo de fidelidad. Es un aparato de medida que vive en `core`
 * porque es donde está lo que mide.
 *
 * ## Estado: APAGADA, y por qué se quedó así
 *
 * Se escribió para contestar «¿el camino de este aiType se ejecutó durante los sellos?».
 * **No hizo falta**: #82 se cerró por un mecanismo más fuerte que un contador — el ancla
 * de transacción, único canal del espejo sensible a la posición de un NPC, **resetea los
 * NPC a su celda de horario** antes de usarla (`enterMap`), así que un cambio de posición
 * no puede alterar el enganche. Un contador habría dicho «se ejecutó»; el mecanismo dice
 * «aunque se ejecutara, el sello no podía verlo». Derivación en
 * re/notes/npc-aitype4-persigue.md §7.
 *
 * ## 🔴 La condición que la levantaría
 *
 * **La próxima pregunta de alcanzabilidad de NPC** — y hay tres abiertas: si la guarda que
 * hoy sólo deja llegar al `switch` con el NPC en su puesto se toca (entonces la asimetría
 * PUESTO-vs-VIVO del aiType 4 despierta), y las dos fichas de consumo de RNG del sobremundo.
 * Quien se encuentre con una de ésas: arma el flag y tiene el dato sin abrir ventana.
 *
 * ⚠️ Y quien la encuentre sin consumidor dentro de unos meses: **no la borres «limpiando»
 * sin leer esto, ni la enciendas sin saber lo que cuesta.** Lo que cuesta está abajo, en el
 * contrato de no-interferencia. Sus 5 testigos viven en `game/tests/npc-ai-probe.test.ts` y
 * corren en `npm test` (comprobado con recuento: 5 ejecutados, no saltados).
 *
 * ## Para qué existe
 *
 * Un sello INTACTO es compatible con dos cosas que ningún sello distingue por sí solo:
 *   (a) el camino del aiType SE EJECUTÓ y el cambio de comportamiento fue inocuo;
 *   (b) el camino NO SE EJECUTÓ NUNCA en esa corrida ⇒ el sello no fue evidencia de nada.
 * Sin contador son indistinguibles, y el segundo caso se lee como el primero — el fallo y
 * la hipótesis compartiendo resultado. Esta sonda es lo único que los separa.
 *
 * Cuenta por aiType, no sólo el 4, porque la pregunta es la misma para el 5, el 6 y el 7
 * (#52 / #78 / #82): una corrida contesta por toda la familia.
 *
 * ## Contrato de no-interferencia — las cuatro reglas que lo hacen admisible
 *
 * 1. **APAGADA POR DEFECTO.** `activa()` es falso salvo que el arnés ponga el flag en
 *    `globalThis`. En juego normal la sonda no existe: los `if` de los sitios de conteo
 *    salen por el camino corto y no se toca ni un contador.
 * 2. **SÓLO-ESCRITURA desde el motor.** El motor llama a `cuenta()`; nada del motor lee
 *    los contadores. La única lectura es `volcado()`, que ejecuta el ARNÉS al terminar,
 *    fuera de la ventana de comparación.
 * 3. **FUERA DE TODA ESTRUCTURA SERIALIZADA.** Los contadores viven en un objeto privado
 *    de ESTE módulo, no en `GameState` ni en ningún objeto que el espejo vuelque. Esto es
 *    deliberado: el sujeto de la comprobación no es dónde se ESCRIBE el contador, es quién
 *    LEE la estructura donde vive. Un `state.contador` sería inofensivo para el generador
 *    y aun así viajaría en cualquier `JSON.stringify` del estado.
 * 4. **NO TOCA EL GENERADOR NI EL ORDEN.** `cuenta()` es un `++` sobre un entero. No
 *    consume del RNG, no evalúa condiciones del motor y no puede reordenar nada.
 *
 * ## Cómo se usa desde el arnés
 *
 *   globalThis.__U5_AI_PROBE = true;     // ANTES de arrancar la parte
 *   …corrida…
 *   const cuentas = globalThis.__U5_AI_PROBE_DUMP();   // al final, fuera de la ventana
 *
 * No lleva `console`, ni eventos, ni HUD: nada de lo que el espejo captura.
 */

/**
 * DOS contadores por aiType, y la distinción es la que decide el veredicto:
 *
 * · `cuentas` — el `case` de ese aiType se ALCANZÓ (el NPC recibió su paso de IA).
 * · `divergentes` — se entró en la rama **donde el código viejo y el nuevo difieren**:
 *   para el 4 y el 6, la puerta de distancia abierta (con ella cerrada, huir y perseguir
 *   son indistinguibles porque no se mueve nadie); para el 5 y el 7, siempre que actúan.
 *
 * Un sello sólo es EVIDENCIA sobre el fix si `divergentes > 0`. Que `cuentas > 0` y
 * `divergentes == 0` significa que el NPC existía y se le dio turno, pero el party nunca
 * se le acercó lo bastante: el sello no distinguió huir de perseguir. Contar sólo lo
 * primero habría vuelto a producir un número tranquilizador que no contesta la pregunta.
 */
const cuentas = new Int32Array(8);
const divergentes = new Int32Array(8);

/** Nombre del flag y del volcado en `globalThis`, en un solo sitio. */
const FLAG = "__U5_AI_PROBE";
const DUMP = "__U5_AI_PROBE_DUMP";

/**
 * ¿Está armada la sonda? Falso salvo que el arnés lo pida explícitamente.
 * Se lee en cada llamada a propósito: el arnés puede armarla después de importar el módulo.
 */
export function activa(): boolean {
  return (globalThis as Record<string, unknown>)[FLAG] === true;
}

/**
 * Registra que el camino del `aiType` dado se EJECUTÓ una vez. No-op con la sonda apagada.
 * `aiType` fuera de 0..7 se ignora en silencio: es un contador, no una validación.
 */
export function cuenta(aiType: number): void {
  if (!activa()) return;
  if (aiType < 0 || aiType > 7) return;
  cuentas[aiType]! += 1;
}

/**
 * Registra que se entró en la rama donde el comportamiento viejo y el nuevo DIFIEREN.
 * Es el contador que decide si un sello fue evidencia sobre el fix.
 */
export function cuentaDivergente(aiType: number): void {
  if (!activa()) return;
  if (aiType < 0 || aiType > 7) return;
  divergentes[aiType]! += 1;
}

/** Lectura para el ARNÉS. Devuelve una copia: nadie puede mutar los contadores leyéndolos. */
export function volcado(): { alcanzado: Record<number, number>; divergente: Record<number, number> } {
  const alcanzado: Record<number, number> = {};
  const divergente: Record<number, number> = {};
  for (let i = 0; i < 8; i++) {
    alcanzado[i] = cuentas[i]!;
    divergente[i] = divergentes[i]!;
  }
  return { alcanzado, divergente };
}

/** Pone los contadores a cero (entre partes de una misma corrida). */
export function reinicia(): void {
  cuentas.fill(0);
  divergentes.fill(0);
}

// El arnés vive en otro contexto (Playwright evalúa en la página), así que el volcado se
// expone en `globalThis`. Se expone SIEMPRE —incluso con la sonda apagada— porque exponer
// una función que devuelve ceros no cambia el comportamiento de nada, y hacerlo condicional
// obligaría al arnés a distinguir «no armada» de «no cargada», que es justo la ambigüedad
// que esta sonda existe para eliminar.
(globalThis as Record<string, unknown>)[DUMP] = volcado;
