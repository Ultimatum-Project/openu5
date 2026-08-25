/**
 * EL PRESUPUESTO DE SUBFOTOGRAMAS DEL GRABADOR DE PARTIDAS (#207).
 *
 * Vive APARTE de `partida-render.mjs` por una razón mecánica, no estética: aquel fichero
 * tiene `await` de nivel superior, lee `process.argv` y hace `process.exit(2)` sin id, así
 * que importarlo desde un test lo EJECUTA. Aquí no hay efectos: sólo la aritmética del
 * presupuesto, que es justo lo que #207 tuvo mal y lo único que hace falta vigilar.
 * Por eso además el test que lo cubre NO necesita chromium ni `game/assets` (material de
 * EA) y SÍ puede estar en la puerta de la batería — el grabador entero no puede.
 *
 * ── QUÉ ARREGLA ──────────────────────────────────────────────────────────────────────
 * Hasta #207 el grabador avanzaba un presupuesto FIJO de 6 subfotogramas por paso de
 * replay (`SUBFRAMES = 6`). El número no salía de ninguna medición: era el ritmo cómodo
 * de un paso normal. Toda animación más larga que 6·(1000/12) ms = 500 ms quedaba
 * DECAPITADA en el vídeo, y el corte no da error en ninguna parte — el vídeo sale, dura
 * lo que tiene que durar y le falta la mitad de la escena. Así llegó a publicarse la
 * coreografía del Shard (sacudida ~1,3 s + explosión de celda 585 ms, #201/#206).
 *
 * 🔴 SUBIR EL 6 A PELO NO ES EL ARREGLO, y ésta es la trampa que la ficha #207 veta
 * expresamente: cualquier número fijo caduca con el primer efecto más largo que él, y
 * caduca EN SILENCIO. Lo que se avanza es «mientras quede algo que pintar», y el número
 * pasa a ser un TOPE DE SEGURIDAD (backstop de un bucle potencialmente infinito), no un
 * presupuesto. La diferencia se nota en el caso normal: el tope NO SE TOCA NUNCA.
 *
 * ── EL PREDICADO, Y EL QUE PARECÍA SERLO Y NO LO ERA ─────────────────────────────────
 * 🔴 `window.__reloj.encolados()` (el tamaño de la cola de rAF del propio grabador) NO
 * sirve como predicado de «animación viva», aunque el arreglo diseñado de #207 lo
 * nombrara. Los DOS bucles rAF de las pieles se re-registran INCONDICIONALMENTE al final
 * de cada frame (`skin/fiel/skin.ts` `startClock` y `skin/shader/skin.ts` `startPresent`),
 * así que `encolados()` vale ≥2 SIEMPRE mientras la página vive: un bucle que espere a que
 * baje no termina jamás y agota este tope en cada paso. `encolados()` es el predicado del
 * OTRO freno —«¿siguen vivos los bucles?»— y para eso se usa en `partida-render.mjs`
 * (guarda de migración de los bucles, y el `throw` de `avanza()` sobre cola vacía).
 * El predicado bueno es `window.__u5test.fxActive()`, que expone el MISMO getter que
 * gobierna el repintado de la piel fiel (`get transientFxActive`).
 *
 * ── LOS DOS FRENOS SON INDEPENDIENTES Y SE VIGILAN POR SEPARADO ──────────────────────
 * Un test que cubra sólo uno da el arreglo por bueno con el otro roto:
 *   (1) PRESUPUESTO — si corta antes, da igual lo que diga el predicado.
 *   (2) COLA DE rAF — si la cola está vacía, `avanza()` no avanza nada y ningún
 *       presupuesto, por generoso que sea, produce un fotograma nuevo (721 fotogramas
 *       idénticos: el vídeo congelado que describe la cabecera de `partida-render.mjs`).
 * Ver `game/tests/render-avance-fx.test.ts`, que instancia los dos y el tope.
 */

/**
 * Subfotogramas que se avanzan SIEMPRE, haya o no animación viva.
 *
 * Es el ritmo del replay, no una cota de nada: a 12 fps son 500 ms de vídeo por paso, la
 * cadencia con la que se grabaron todas las partidas publicadas hasta #207. Se conserva
 * EXACTA a propósito — el arreglo de #207 sólo puede ALARGAR un paso, nunca acortarlo, así
 * que ninguna escena ya publicada cambia de ritmo por este cambio.
 */
export const SUBFOTOGRAMAS_MIN = 6;

/**
 * TOPE DE SEGURIDAD: subfotogramas máximos de UN paso de replay.
 *
 * Qué régimen cubre y por qué este número:
 *  · No es un presupuesto. Es el backstop de un `while (hayFxViva())`, que sin él sería un
 *    bucle infinito si alguna capa de fx se quedase encendida (y una se puede quedar: ver
 *    la nota de `worldFx` en `get transientFxActive`). En una corrida sana NO SE ALCANZA.
 *  · Unidad: subfotogramas del grabador, que a `FPS = 12` valen 1000/12 ≈ 83,3 ms de reloj
 *    de la página cada uno. 600 subfotogramas = 50 s de animación continua en UN paso.
 *  · Margen sobre lo medido: la escena AV más larga del juego es la del Shard, y lo VISUAL
 *    de esa escena son ~1,3 s (sacudida ×3, la explosión de celda de 585 ms va dentro) =
 *    ~16 subfotogramas. El tope deja ×37 de margen sobre eso.
 *  🔴 El «~550 fotogramas» que la ficha #207 atribuye a la escena encadenada es la cola de
 *    AUDIO de #206 (barrido 7,13 s + fanfarria 2,09 s = 9,22 s, que a 60 Hz son ~553
 *    fotogramas), y el vídeo se codifica con `-an`: MUDO. Esa cifra no acota nada de lo que
 *    se captura aquí. El tope la cubre igualmente y con holgura — cuesta cero cubrirla y
 *    así el número aguanta aunque algún día el audio arrastre imagen.
 */
export const TOPE_SUBFOTOGRAMAS = 600;

/**
 * Avanza UN paso de replay: el mínimo de ritmo y luego lo que haga falta hasta que no
 * quede animación viva, sin pasar del tope.
 *
 * @param {object} o
 * @param {() => Promise<void>} o.subfotograma  Avanza el reloj y captura UN fotograma.
 *   Si lanza, se propaga sin tocar: es el otro freno (cola de rAF vacía ⇒ nada avanzó) y
 *   tragárselo aquí produciría el vídeo congelado que la guarda existe para impedir.
 * @param {() => Promise<boolean>} o.hayFxViva  Predicado de animación viva.
 * @param {(info: {paso: number, tope: number}) => void} [o.alAlcanzarTope]  Se llama UNA
 *   vez si el tope corta con el predicado todavía en alto. Por defecto LANZA: alcanzar el
 *   tope significa que el predicado no baja, y eso no puede terminar en un vídeo callado.
 * @param {number} [o.paso]  Índice del paso, sólo para el mensaje.
 * @returns {Promise<{subfotogramas: number, topeAlcanzado: boolean}>}
 */
export async function avanzaPasoDeReplay({
  subfotograma,
  hayFxViva,
  alAlcanzarTope = avisoDeTopePorDefecto,
  paso = -1,
  minimo = SUBFOTOGRAMAS_MIN,
  tope = TOPE_SUBFOTOGRAMAS,
}) {
  let n = 0;
  // El MÍNIMO de ritmo va entero y sin consultar el predicado: un paso sin animación
  // ninguna tiene que seguir dando exactamente los mismos 6 fotogramas de siempre.
  while (n < minimo) {
    await subfotograma();
    n++;
  }
  while (await hayFxViva()) {
    if (n >= tope) {
      alAlcanzarTope({ paso, tope });
      return { subfotogramas: n, topeAlcanzado: true };
    }
    await subfotograma();
    n++;
  }
  return { subfotogramas: n, topeAlcanzado: false };
}

/**
 * El aviso por defecto LANZA, y esa elección es el filo de la guarda: si el tope se
 * alcanza, el predicado de animación viva no está bajando, y un grabador que siguiera
 * adelante escribiría un vídeo con un paso de 50 s dentro sin que nadie se enterase.
 * La cabecera de `partida-render.mjs` ya sostiene esta doctrina para la superficie
 * equivocada y para la cola vacía: mejor sin artefacto que con un artefacto callado.
 */
function avisoDeTopePorDefecto({ paso, tope }) {
  throw new Error(
    `TOPE DE SEGURIDAD alcanzado en el paso ${paso}: ${tope} subfotogramas con el predicado ` +
      `de animación viva TODAVÍA en alto. O una capa de fx se ha quedado encendida sin ` +
      `purgarse (mira 'get transientFxActive' en skin/fiel/skin.ts), o hay una animación ` +
      `real más larga que ${tope} subfotogramas y el tope se ha quedado corto. No se produce ` +
      `vídeo: un paso que no termina no se distingue de uno que sí mirando el .webm.`,
  );
}
