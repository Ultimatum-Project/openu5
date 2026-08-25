/**
 * MINIATURA de la pantalla para la tarjeta de una partida guardada.
 *
 * Se toma AL GUARDAR y se guarda junto a la partida (clave aparte,
 * `core/save-keys.ts` SAVE_SHOT_PREFIX). La pantalla `/byo` la enseña; sin ella cae
 * al minimapa. Nada de esto sale del navegador.
 *
 * 🔴 LEER EL CANVAS NO CONSUME RNG, Y ESTÁ MEDIDO, NO SUPUESTO (07-08, chromium sobre
 * el juego vivo): con la partida movida a mano hasta turno 6 y `g_rng_seed` = 46008,
 * el `drawImage` + `toDataURL` dejó semilla Y turno **idénticos**. 11 935 B y 1 ms.
 * El control importa tanto como el resultado: con la semilla en 0 (recién arrancado)
 * «no se movió» habría sido cierto aunque la captura rompiera el juego.
 *
 * 🔴 Y EL CANVAS NO ES `querySelector("canvas")`. Censo medido en el juego vivo: hay
 * SEIS canvas — cuatro de 8×8 (`u5of-brk`, ornamento del marco), uno de 320×200 (el
 * búfer a resolución DOS) y el de 960×600 que es lo que el jugador ve. El primero del
 * documento es un 8×8: quien lo coja captura ocho píxeles y no se entera.
 *
 * 🔴 Y YA NO SE ELIGE POR ÁREA. Esta línea decía «se elige por ÁREA, que es la propiedad
 * que define la pantalla» y dejó de ser verdad el 08-08, cuando la captura pasó a
 * resolución nativa: por área sale el 960×600, que es un ×3 del 320×200 y no aporta
 * información (ver el bloque de abajo). El área sigue sirviendo para identificar EL
 * VISIBLE; lo que se captura es el búfer NATIVO, que se localiza a partir de él
 * (`buferNativo`). Se corrige aquí y no en una nota al pie porque un docstring rancio
 * no es ruido: es un sembrador — el siguiente que lea «se elige por área» lo creerá.
 *
 * 🔴 Y DESDE EL 10-08 EL BÚFER NATIVO NO SE ADIVINA: LA PIEL LO DECLARA (ficha #153).
 * Lo de arriba sigue siendo verdad de ESTE fichero y del ESCRITORIO, y era falso fuera:
 * el heurístico del múltiplo entero (`buferNativo`) sólo acierta cuando el visible es un
 * ×N exacto del nativo, y en los layouts táctiles NO LO ES. Medido por la auditoría
 * audit-ux sobre los cuatro layouts:
 *
 * | layout                    | canvas visible | factores x/y  | qué capturaba |
 * |---------------------------|---------------:|--------------:|--------------:|
 * | escritorio (shader)       |        960×600 |   3,00 / 3,00 |   **320×200** |
 * | móvil CLÁSICO             |        960×600 |   3,00 / 3,00 |   **320×200** |
 * | móvil PARTIDO (de fábrica)|      1170×1696 |   3,66 / 8,48 |     1170×1696 |
 * | móvil APAISADO            |      1700×1020 |   5,31 / 5,10 |     1700×1020 |
 *
 * Los dos de abajo caían al visible y guardaban EL TELÉFONO ENTERO — deck, marco y
 * bandas negras incluidos — a 5,5× el peso. Y el fallo NO era de render: el 320×200 de la
 * piel fiel existe, está pintado y es byte a byte IDÉNTICO entre layouts (SHA-256 careado
 * por la auditoría). Era un fallo de SELECCIÓN, y el heurístico no puede arreglarse
 * aflojándolo: relajar «múltiplo entero» es justo lo que dejaría colarse a los 8×8 del
 * ornamento (ver las dos guardas de `buferNativo`).
 *
 * ⇒ CONTRATO NUEVO: quien monta el búfer nativo lo MARCA con `data-u5-native`
 * (`declararBuferNativo`, y el único que lo llama hoy es `skin/fiel/skin.ts` en su
 * `mount`). `captureScreenshot` PREFIERE el declarado siempre que tenga contenido; el
 * heurístico queda de RESPALDO para una piel que no declare. Marcar la fiel cubre los
 * cuatro layouts de un golpe porque la fiel es la fuente de píxeles de todos: sola en
 * escritorio fiel, alojada por `ShaderSkin` (`shader/skin.ts:392`), y alojada por
 * `PortraitSkin` directamente o a través de la shader.
 */

/**
 * ── LA CAPTURA VA A RESOLUCIÓN NATIVA Y EN PNG, Y «NATIVA» NO ES EL CANVAS MÁS GRANDE ──
 *
 * 🔴 EL HALLAZGO QUE DECIDE ESTO. De los seis canvas, los dos grandes son **320×200** y
 * **960×600**, y volcando los dos a PNG y MIRÁNDOLOS se ve que contienen LO MISMO: el 960
 * es un reescalado ×3 nearest-neighbour del 320. O sea que el 960 **no lleva ni un bit de
 * información** que el 320 no tenga — es una ampliación. Guardarla sería guardar un zoom
 * que el visor de `/byo` ya hace gratis con `image-rendering: pixelated`.
 * ⇒ «resolución completa» en este juego son **320×200**, que es el búfer DOS.
 *
 * ── LO QUE COSTÓ, MEDIDO ESCRIBIENDO HASTA `QuotaExceededError` ─────────────────────
 * (`storage.estimate()` NO sirve: devuelve delta 0 para localStorage.)
 *
 * | formato                  | KB/captura | caben |
 * |--------------------------|-----------:|------:|
 * | ANTES jpeg 200×125 q0.7  |       11,6 |   440 |
 * | AHORA **PNG 320×200**    |   **19,3** | **265** |
 * | webp nativo q0.92        |       26,2 |   195 |
 * | PNG del visible 960×600  |      154,4 |    33 |
 *
 * +7,7 KB por captura a cambio de pixel art EXACTO en vez del borrón de un jpeg q0.7
 * reescalado a 200 px. El 960 se descarta solo: 8× el coste por CERO información. Y webp
 * se descarta aunque parezca lo moderno — para pixel art sale más caro que PNG **y encima
 * con pérdida**; contraintuitivo, por eso se midió.
 *
 * ⚠️ El aviso de cuota de `save-keys.ts` NO aplica aquí: habla del ÍNDICE (capturas dentro
 * del índice = parsearlas en cada listado), y eso ya está resuelto por diseño — las
 * capturas viven en claves aparte con lectura perezosa. Subir el tamaño no toca el índice.
 *
 * ── COMPATIBILIDAD ──────────────────────────────────────────────────────────────────
 * Las capturas VIEJAS (jpeg) siguen valiendo: `readSaveShot` devuelve el dataURL tal cual
 * y un `<img>` come las dos cosas. Hay sonda con una captura del formato ANTIGUO sembrada
 * y leída — no se da por bueno de palabra.
 */
const TIPO = "image/png";

/**
 * El atributo con el que una piel DECLARA cuál de sus canvas es el búfer nativo.
 *
 * Vive aquí, junto a quien lo LEE, y la piel lo pone llamando a `declararBuferNativo`:
 * el nombre del atributo no se teclea dos veces. Un marcador escrito a mano en la piel y
 * leído a mano aquí son dos constantes que pueden divergir en silencio, y la divergencia
 * no da error — da una miniatura del teléfono entero, que es exactamente el defecto que
 * este contrato viene a cerrar.
 */
export const NATIVE_ATTR = "data-u5-native";

/** La piel declara que ESTE canvas es su búfer a resolución nativa. */
export function declararBuferNativo(canvas: HTMLCanvasElement): void {
  canvas.setAttribute(NATIVE_ATTR, "1");
}

/** Predicados inyectables — para instanciar en un test topologías que la página no tiene. */
export interface OpcionesEleccion<T> {
  /** ¿Este canvas dibuja algo? Por defecto, muestreo de píxeles (`tieneContenido`). */
  conContenido?: (c: T) => boolean;
  /** ¿Lleva la marca de la piel? Por defecto, el atributo `data-u5-native`. */
  esDeclarado?: (c: T) => boolean;
}

/** El canvas que se capturaría, y POR QUÉ VÍA se eligió. */
export interface Eleccion<T> {
  canvas: T;
  /** `true` = lo dijo la piel; `false` = heurístico del múltiplo entero, o el visible. */
  declarado: boolean;
}

/**
 * El búfer DECLARADO por la piel, o `null` si no hay ninguno con contenido.
 *
 * 🔴 EL «CON CONTENIDO» NO ES CEREMONIA HEREDADA DE `buferNativo`: es el mutante M2 de la
 * ficha #153. Una declaración que apunta a un canvas en blanco (piel a medio montar, búfer
 * rancio) pasaría la comprobación de marca y guardaría una captura NEGRA — un fallo que no
 * da error y parece trabajo hecho. Con la guarda, esa declaración se ignora y se cae al
 * heurístico, que es peor imagen pero imagen de verdad.
 *
 * Si hay varias marcadas se toma la MAYOR, por la misma razón que en `buferNativo`: una
 * piel que renderice nativo a 640×400 debe capturarse a 640×400.
 */
export function buferDeclarado<T extends { width: number; height: number }>(
  canvases: T[],
  opts: OpcionesEleccion<T> = {},
): T | null {
  const conContenido =
    opts.conContenido ?? ((c: T) => tieneContenido(c as unknown as HTMLCanvasElement));
  const esDeclarado =
    opts.esDeclarado ??
    ((c: T) => (c as unknown as Element).getAttribute?.(NATIVE_ATTR) === "1");
  return (
    canvases
      .filter((c) => esDeclarado(c) && conContenido(c))
      .sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null
  );
}

/**
 * LA REGLA DE SELECCIÓN ENTERA, en un sitio y sin tocar el DOM — que es lo que la hace
 * comprobable. Tres escalones, en este orden:
 *
 *   1. lo que la piel DECLARA (con contenido),
 *   2. el heurístico del múltiplo entero (`buferNativo`) para pieles sin declaración,
 *   3. el canvas visible, que es degradar a lo de antes.
 *
 * El escalón 2 NO se retira al llegar el 1: hay canvas 320×200 en la página que ninguna
 * piel monta (la intro fiel, `ui/faithful-intro.ts`), y una piel futura puede no declarar.
 * Quitarlo convertiría «piel sin declaración» en «captura del teléfono entero» otra vez.
 */
export function elegirCanvas<T extends { width: number; height: number }>(
  canvases: T[],
  opts: OpcionesEleccion<T> = {},
): Eleccion<T> | null {
  const utiles = canvases.filter((c) => c.width && c.height);
  if (utiles.length === 0) return null;
  const declarado = buferDeclarado(utiles, opts);
  if (declarado) return { canvas: declarado, declarado: true };
  const visible = utiles.reduce((a, c) => (c.width * c.height > a.width * a.height ? c : a));
  return { canvas: buferNativo(utiles, visible, opts.conContenido) ?? visible, declarado: false };
}

/**
 * Qué DIMENSIONES tendría la captura de ahora mismo, sin llegar a codificarla.
 *
 * Lo consume la re-captura de miniaturas viejas (`ui/shot-refresh.ts`): comparar la foto
 * persistida contra esto es lo que decide si merece la pena rehacerla. Devuelve además
 * `declarado`, y ese campo es LA GUARDA de esa decisión — sin él, una piel sin declaración
 * en móvil re-escribiría una miniatura buena de 320×200 con el teléfono entero.
 */
export function tamanoCaptura(
  parent: ParentNode = document,
): { width: number; height: number; declarado: boolean } | null {
  try {
    const el = elegirCanvas([...parent.querySelectorAll("canvas")]);
    if (!el) return null;
    return { width: el.canvas.width, height: el.canvas.height, declarado: el.declarado };
  } catch {
    return null;
  }
}

/**
 * Devuelve un dataURL PNG de la pantalla, o `null` si no hay canvas o el navegador
 * se niega (canvas contaminado, memoria). Nunca lanza: es un adorno, y el guardado
 * tiene que seguir su camino pase lo que pase.
 */
export function captureScreenshot(parent: ParentNode = document): string | null {
  try {
    const elegido = elegirCanvas([...parent.querySelectorAll("canvas")]);
    if (!elegido) return null;
    const cv = elegido.canvas;
    const off = document.createElement("canvas");
    off.width = cv.width;
    off.height = cv.height;
    const ctx = off.getContext("2d");
    if (!ctx) return null;
    // 1:1, pero se apaga el suavizado igualmente: si algún día se captura el visible
    // (piel sin búfer nativo) el reescalado NO debe interpolar pixel art.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, 0, 0);
    return off.toDataURL(TIPO);
  } catch {
    // Canvas contaminado o sin memoria: la tarjeta usará el minimapa. Que este
    // `catch` exista NO tapa un error de medición — aquí no se mide nada, se ilustra.
    return null;
  }
}

/**
 * El búfer NATIVO ADIVINADO entre los canvas de la página, o `null` si no hay ninguno.
 *
 * 🔴 DESDE #153 ESTO ES EL RESPALDO, NO LA VÍA PRINCIPAL — y no porque el criterio sea
 * flojo, sino porque su PREMISA sólo se cumple en el escritorio: exige que el visible sea
 * un ×N exacto del nativo, y en los layouts táctiles los factores son 3,66/8,48 y
 * 5,31/5,10 (tabla en la cabecera). Ahí devuelve `null` CORRECTAMENTE, y era el llamador
 * quien acababa guardando el teléfono entero. Hoy manda `buferDeclarado`; esto sigue
 * cubriendo a las pieles que no declaren y a los 320×200 que ninguna piel monta (la intro
 * fiel, `ui/faithful-intro.ts:693`). Aflojar el criterio de aquí NO era el arreglo: lo
 * primero que se colaría son los 8×8 del ornamento que la primera guarda excluye.
 *
 * Criterio: un canvas del que el VISIBLE es un múltiplo entero exacto (mismo factor en
 * las dos dimensiones) y que además tiene contenido. Si hay varios, el mayor — así una
 * piel que renderice nativo a 640×400 se captura a 640×400 y no a 320×200.
 *
 * 🔴 LAS DOS GUARDAS NO SON ADORNO, y cada una tapa un modo de fallo distinto:
 *
 * · **Múltiplo ENTERO en AMBOS ejes.** Sin esto, cualquier canvas pequeño de la página
 *   sería candidato. Los hay: cuatro de 8×8 (`u5of-brk`, el ornamento del marco). Un
 *   `960/8 = 120` entero pero `600/8 = 75` también entero los colaría si sólo se mirase
 *   la divisibilidad — por eso se exige además que el factor sea EL MISMO en x e y
 *   (120 ≠ 75 ⇒ fuera). La relación que define «es el mismo dibujo» es la ESCALA, no la
 *   divisibilidad de cada lado por su cuenta.
 *
 * · **Con contenido.** Un búfer rancio o en blanco pasaría la prueba geométrica y se
 *   guardaría una captura NEGRA — un fallo silencioso, de los que no dan error y parecen
 *   trabajo hecho. Se muestrean píxeles y se exige más de un color.
 *
 * Si nada cumple, se devuelve `null` y el llamador captura el visible: degradar a lo de
 * antes es mejor que capturar algo equivocado.
 *
 * 🔴 SE EXPORTA Y RECIBE EL PREDICADO DE CONTENIDO POR PARÁMETRO **para poder falsificar
 * la guarda geométrica**, y eso no es un capricho de diseño: al mutarla sobre el juego
 * vivo el mutante SOBREVIVIÓ. En la página real hay cuatro 8×8 y un 320×200, y como los
 * candidatos se ordenan por área DESCENDENTE, el 320×200 llega antes que cualquier 8×8
 * aunque el 8×8 se cuele en la lista. O sea que la sonda de navegador no puede
 * distinguir «la guarda funciona» de «la guarda sobra»: el orden la tapa.
 * ★★ Una guarda cuyo fallo no cambia el resultado observable no está verificada, está
 *    DECORANDO. La topología que la instancia (un 8×8 como ÚNICO candidato) no existe en
 *    la página, así que se construye en un test unitario — que es donde sí existe.
 */
export function buferNativo<T extends { width: number; height: number }>(
  canvases: T[],
  visible: T,
  conContenido: (c: T) => boolean = (c) => tieneContenido(c as unknown as HTMLCanvasElement),
): T | null {
  const candidatos = canvases
    .filter((c) => {
      if (c === visible) return false;
      const fx = visible.width / c.width;
      const fy = visible.height / c.height;
      return fx >= 1 && Number.isInteger(fx) && fx === fy && conContenido(c);
    })
    .sort((a, b) => b.width * b.height - a.width * a.height);
  return candidatos[0] ?? null;
}

/** ¿Este canvas dibuja algo? Muestreo barato: más de un color entre ~1000 píxeles. */
function tieneContenido(c: HTMLCanvasElement): boolean {
  try {
    const g = c.getContext("2d");
    if (!g) return false;
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const paso = Math.max(4, Math.floor(d.length / 4 / 1000) * 4);
    const vistos = new Set<number>();
    for (let i = 0; i + 2 < d.length; i += paso) {
      vistos.add(((d[i] ?? 0) << 16) | ((d[i + 1] ?? 0) << 8) | (d[i + 2] ?? 0));
      if (vistos.size > 1) return true;
    }
    return false;
  } catch {
    return false; // contaminado por CORS: no se puede afirmar que tenga contenido
  }
}
