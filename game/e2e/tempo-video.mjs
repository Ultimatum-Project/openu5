/**
 * TEMPO DE GRABACIÓN — el reloj del ARNÉS, compartido por los tres arneses de vídeo.
 *
 * ── EL PROBLEMA ───────────────────────────────────────────────────────────────────────
 * Los tres arneses nacieron como TESTS deterministas: teclean tan rápido como el
 * navegador acepta porque nadie los iba a mirar. Cuando el mismo arnés graba vídeo para
 * un humano (revisión de bugs, material de promoción) esa cadencia es ilegible. Medido
 * con el hook del propio port (`__u5test.endgameStoryPage()`), las SEIS páginas de prosa
 * del desenlace duran **254-262 ms** bajo el régimen del grand tour — el dwell copia
 * exactamente el `waitForTimeout` del arnés, o sea que la cadencia de la prosa es 100 %
 * del arnés y 0 % del port (el pacer del desenlace avanza POR TECLA: endgame-pacer.ts:247
 * y :260 ponen `awaitKey`, sin ningún temporizador — y eso es FIEL, el binario tampoco
 * tiene efecto máquina-de-escribir: la página se pinta en 25-100 ms,
 * `re/notes/audio-cadencias-corpus.md` §1). Los ~3 s que dura una página en el testigo
 * son el tiempo que tarda EL JUGADOR HUMANO en pulsar.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ────────────────────────────────────────────────────────
 * No toca la conducta del juego grabado ni lo que los tests assertan. Sólo mueve el
 * reloj del arnés (cadencia entre teclas, pausas de lectura) y — con `vivo` — DEJA DE
 * APAGAR los pacers que el port ya tiene calibrados. Con la env AUSENTE todos los
 * valores son EXACTAMENTE los de hoy: `tecla()`/`lectura()` devuelven su argumento y
 * `pacersVivos()` no instala nada. La batería y CI no cambian ni un milisegundo.
 *
 * ── LAS CIFRAS SON DERIVADAS ──────────────────────────────────────────────────────────
 * Derivación completa, con fuentes y dispersión, en `re/notes/tempo-cinematico.md`.
 *
 * Uso:  U5_VIDEO_TEMPO=cine  (cualquier otro valor, o ausente = régimen test de hoy)
 */

/** Modo declarado por el entorno. `cine` = grabación para ojos humanos. */
export const MODO = process.env.U5_VIDEO_TEMPO ?? "test";

/** ¿Estamos grabando para un humano? */
export const CINE = MODO === "cine";

/**
 * CADENCIA ENTRE TECLAS DE MOVIMIENTO, ms.
 *
 * DERIVADA: `re/notes/audio-cadencias-corpus.md` §1 mide sobre los vídeos de EA
 * (frame-diff VFR-aware, 12 saltos de viewport en video-A) que la repetición MÁXIMA de
 * un humano con la tecla sostenida es **162-200 ms/paso** (mín. 162). 180 es el centro
 * de esa banda medida.
 *
 * 🔴 CAREO POSTERIOR sobre el corpus de walkthroughs (3 pilotos, 8 episodios, 4,30 h de
 * vídeo re-OCReado a tasa nativa; `re/notes/tempo-cinematico.md` §3.1-bis) que MATIZA
 * esta elección y hay que leer antes de tocarla:
 *   · la mediana global de TODO el movimiento real es **300 ms**, no 180;
 *   · la moda de ráfaga NO converge entre pilotos (300 · 280 · **167**) ⇒ esa banda es
 *     repetición de teclado × ciclos de DOSBox, o sea **la máquina, no la intención**;
 *   · el paso DELIBERADO sí converge en los tres: **600 · 680 · 633 ms**.
 * ⇒ 180 es legítimo como «ráfaga sostenida», pero NO es «la cadencia humana»: es el
 * extremo rápido de un fenómeno que en parte es del emulador. Se mantiene por coste
 * (a 300 ms un capítulo de tour casi duplica lo ya medido en §5.3, y a 600 lo triplica),
 * y se deja graduable en vez de enterrado: `U5_VIDEO_TECLA_MS=300` da la mediana real de
 * juego y `=600` el paso deliberado.
 */
export const TECLA_MS = Number(process.env.U5_VIDEO_TECLA_MS) || 180;

/**
 * PAUSA DE LECTURA DE UNA PÁGINA DE PROSA, ms.
 *
 * DERIVADA del testigo real del desenlace
 * (`original/av-referencia/testigos/endgame-victoria-box-20260721.mov`). El testigo es
 * una grabación de pantalla VFR — emite un fotograma AL CAMBIAR y un solo keepalive
 * ~1,0 s después —, así que los instantes de cambio de página se leen directos de los
 * `pts_time` sin detección de escena. Las SEIS páginas de historia miden:
 *
 *   102,483 → 108,867 → 113,750 → 119,170 → 122,275 → 124,942 → 128,717 s
 *   ⇒ 6,38 · 4,88 · 5,42 · 3,11 · 2,67 · 3,78 s     (mediana 4,33 · media 4,37)
 *
 * 🔴 La banda «2,6-3,8 s» que circulaba es REAL pero es la MITAD RÁPIDA: coincide
 * exactamente con las tres páginas más cortas (2,67 · 3,11 · 3,78) y deja fuera las tres
 * primeras (4,88 · 5,42 · 6,38). La dispersión no es ruido — mirando los fotogramas, las
 * páginas largas son las de más texto: el jugador humano lee, no cronometra.
 *
 * 3000 es el extremo RÁPIDO de esa distribución medida (≈ percentil 25) y es la elección
 * por defecto: cae dentro de la banda del encargo y no infla la duración de los vídeos.
 * Quien quiera la MEDIANA real del testigo no necesita tocar código:
 * `U5_VIDEO_LECTURA_MS=4300`.
 */
export const LECTURA_MS = Number(process.env.U5_VIDEO_LECTURA_MS) || 3000;

/**
 * Cadencia entre teclas: la humana en cine, la que le pasen en test.
 * @param {number} base cadencia del régimen test (la de hoy)
 * @returns {number} ms a esperar tras la tecla
 */
export function tecla(base) {
  return CINE ? TECLA_MS : base;
}

/**
 * Pausa de lectura de una página de prosa: la del testigo en cine, la de hoy en test.
 * @param {number} base pausa del régimen test (la de hoy)
 * @returns {number} ms a esperar antes de pasar de página
 */
export function lectura(base) {
  return CINE ? LECTURA_MS : base;
}

/**
 * ¿RESTAURAR los pacers del port? Sí por defecto en cine; `U5_VIDEO_PACERS=0` los deja apagados.
 *
 * 🔴 MEDIDO por el carril `grandtour-cine` sobre `ch34-doom-r8-sceptre` (sala de LAVA de Doom,
 * el DEAD-END fiel de #120), grabación real con vídeo, puerto propio 5231:
 *
 *   | arma                       | vídeo del test 1 | factor | qué se ve                         |
 *   | tempo test (hoy)           |    2,68 s        |  —     | ilegible                          |
 *   | cine + pacers VIVOS        |  249,08 s        | ×93    | 249 s de `>Pass >Pass >Pass…`     |
 *
 * La causa NO es que la escena sea larga: es que los capítulos de SALAS del tour conducen un
 * BUCLE DE CONQUISTA (`conquerRoom`) que gasta cientos de rondas, y la sala r8 está sellada por
 * construcción — la party nunca alcanza a los Daemons y el resolvedor pasa turno hasta que el
 * detector de dead-end dispara. Restaurar la tanda enemiga (400 ms/beat, `main.ts:1765`) le pone
 * 400 ms a CADA una de esas rondas vacías. Es la constante correcta del port aplicada a una
 * población para la que no se calibró: el testigo de combate del que sale son combates que un
 * humano MIRA, no un barrido automático de 16 salas.
 *
 * ⇒ En las escenas (desenlace, rito, troll, captura, veneno) los pacers VIVOS son fidelidad y
 * salen casi gratis. En los capítulos de conquista de salas son horas de metraje muerto. La env
 * separa las dos poblaciones SIN tocar el port y sin enumerar escenas: quien graba decide.
 *
 * Con la env ausente el comportamiento es EXACTAMENTE el de antes de este knob (pacers vivos en
 * cine, nada fuera de cine).
 */
export const PACERS = CINE && process.env.U5_VIDEO_PACERS !== "0";

/**
 * ★ RESTAURA LOS PACERS REALES DEL PORT (sólo en cine) — y por qué así y no con knobs.
 *
 * `main.ts` apaga SEIS pacers cuando detecta automatización, todos por el MISMO
 * discriminante `navigator.webdriver`, que Playwright pone a `true`:
 *   · `:1074` troll sneak            55 ms → 0
 *   · `:1105` escena de santuario   120 ms → 0   (calibrada a testigo: 122 ms/fotograma)
 *   · `:1119` captura de Blackthorn  55 ms → 0
 *   · `:1135` keywaits del rito (#294)      → `instant` (las esperas NO existen)
 *   · `:1150` tick de veneno         93 ms → 0
 *   · `:1765` tanda enemiga         400 ms → 0   (y con ella la pausa BLOQUEANTE de la
 *                                                 fanfarria de victoria, 2,09 s)
 * Está bien puesto: con la unidad a 0 la tanda drena síncrona y los digests del tour
 * sellado no se mueven. Pero significa que TODO vídeo grabado hasta hoy enseña esas seis
 * escenas a una velocidad que ningún jugador ve nunca — no es sólo ilegible, es INFIEL.
 *
 * 🔴 Por qué NO se arregla con `?scenebeat=<ms>`: ese knob es UN número para TODAS las
 * escenas, así que igualaría el troll (55 real) y el santuario (120 real) al mismo valor
 * — uniformidad, no fidelidad. Y `?combeat`/`?trollbeat` sólo cubren dos de las seis.
 * Neutralizar el DISCRIMINANTE hace que cada escena recupere SU PROPIA constante
 * derivada, sin tocar el port y sin enumerar escenas (las que se añadan en el futuro
 * entran solas).
 *
 * MEDIDO con control positivo (`__u5test.combatPacer().beatMs`, servidor propio 5243):
 *   test (hoy)            webdriver=true    beatMs=0
 *   cine (este initScript) webdriver=false   beatMs=400   ← la constante REAL del port
 *   control ?combeat=400   webdriver=true    beatMs=400   ← el hook lee lo que creemos
 *
 * Se instala ANTES del primer `goto` (el valor se lee una vez en `boot()`).
 * @param {{addInitScript: (fn: () => void) => Promise<void>}} destino page o context
 */
export async function pacersVivos(destino) {
  if (!PACERS) return;
  await destino.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "webdriver", {
      get: () => false,
      configurable: true,
    });
  });
}

/** Rótulo para los logs de los arneses (que el vídeo diga con qué reloj se grabó). */
export function rotulo() {
  return CINE
    ? `tempo=CINE (tecla ${TECLA_MS} ms · lectura ${LECTURA_MS} ms · pacers del port ${PACERS ? "VIVOS" : "APAGADOS (U5_VIDEO_PACERS=0)"})`
    : `tempo=test (cadencias de hoy, sin cambios)`;
}
