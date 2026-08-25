/**
 * IDIOMA DE LA PANTALLA BYO — capa de RENDER (atributos), sobre el resolvedor COMPARTIDO.
 *
 * ── LAS TRES CAPAS, porque confundirlas ya costó una lectura equivocada ──────────────
 * El sitio NO tiene «dos convenciones de i18n» compitiendo. Tiene tres capas:
 *
 *   1. RESOLVER — qué idioma quiere esta persona. `idiomaActual()` de
 *      `game/src/web/arranque.ts`: lee `openu5-lang` (la misma clave que escribe el
 *      botón ES/EN de la portada) y cae a `navigator.language`. **ÚNICO y compartido
 *      por las tres superficies.** Este módulo lo CONSUME; no lo reimplementa.
 *   2. RENDER — cómo se pinta ese idioma. Admite dos formas, y las DOS son correctas:
 *        · ATRIBUTOS `data-es`/`data-en` (portada, verificación, y esta pantalla)
 *        · UNA PÁGINA POR IDIOMA (`/mejoras/` y `/mejoras/en/`)
 *   3. La superficie concreta.
 *
 * ── EL CRITERIO DE LA CAPA 2, que es lo que faltaba escrito ──────────────────────────
 * No es gusto ni consistencia por sí misma. Es **TAMAÑO y GÉNERO**:
 *
 *   · ATRIBUTOS  ⇒ UI CORTA que es parte de un FLUJO (~50-200 cadenas).
 *     Aquí son ~105 palabras. El visitante llega con el idioma ya elegido en la portada
 *     y NO debe cambiar de URL a mitad de embudo. Que la página no tenga URL propia por
 *     idioma da igual: nadie llega a /byo buscando su contenido — de hecho está
 *     deliberadamente fuera del índice (`robots.txt` del sitio).
 *
 *   · PÁGINA POR IDIOMA ⇒ DOCUMENTOS LARGOS que alguien busca por su contenido.
 *     `docs/mejoras` son 13 500 palabras: en atributos duplicaría el peso de cada página
 *     y dejaría el HTML ilegible, y además cada idioma MERECE su URL indexable.
 *
 * Regla de bolsillo: **si el texto es el producto, una URL por idioma; si el texto es el
 * cartel de una puerta por la que se pasa, atributos.**
 *
 * ── POR QUÉ ESTA PANTALLA TAMBIÉN LLEVA CONMUTADOR ──────────────────────────────────
 * La portada tiene el suyo y su elección VIAJA (misma clave). Pero a `/byo` se llega
 * también por enlace directo, y entonces manda `navigator.language`: un hispanohablante
 * con el navegador en inglés se quedaría sin salida. Son diez líneas y cierra el caso.
 */
import { idiomaActual } from "../../game/src/web/arranque.js";

const CLAVE = "openu5-lang";

/**
 * MENSAJES DE EJECUCIÓN — los del log del BYO, que el HTML no puede llevar en atributos
 * porque no existen hasta que pasa algo.
 *
 * 🔴 SON LOS QUE MÁS IMPORTAN y los que menos se ven al probar: **la mitad sólo aparecen
 * cuando algo FALLA** (carpeta incompleta, extracción rota, sin service workers). Un
 * aviso de error en un idioma que no lees es exactamente donde alguien abandona — y para
 * verlos hay que romper algo a propósito, así que nadie los revisa.
 */
const MENSAJES: Record<string, { es: string; en: string }> = {
  sinSW: {
    es: "Este navegador no admite service workers.",
    en: "This browser does not support service workers.",
  },
  recibidos: { es: "{n} ficheros recibidos.", en: "{n} files received." },
  carpetaIncompleta: {
    es: "Esto no parece una carpeta DOS completa de Ultima V:",
    en: "This doesn't look like a complete Ultima V DOS folder:",
  },
  apuntaCarpeta: {
    es: "Apúntame a la carpeta que contiene ULTIMA.EXE, TILES.16, BRIT.DAT…",
    en: "Point me at the folder that contains ULTIMA.EXE, TILES.16, BRIT.DAT…",
  },
  extraccionOk: {
    es: "✔ Extracción completa: {n} recursos generados en tu navegador.",
    en: "✔ Extraction complete: {n} assets generated in your browser.",
  },
  extraccionFallo: { es: "La extracción falló: {motivo}", en: "Extraction failed: {motivo}" },
  extraccionPrevia: {
    es: "Tu copia ya está extraída en este navegador.",
    en: "Your copy is already extracted in this browser.",
  },

  // ── LOS CINCO ESTADOS DE LA ZONA DE CARGA ────────────────────────────────────────
  // 🔴 REGLA QUE GOBIERNA ESTOS TEXTOS: se pinta LA EVIDENCIA, NO EL VEREDICTO.
  // «Tu versión no es compatible» afirma más de lo que el instrumento sabe — el
  // extractor compara TAMAÑOS de 17 de los 31 exigidos, y nada más. El fichero con sus
  // dos cifras dice exactamente lo que sabemos, es accionable, y **no envejece**: el día
  // que se rellenen los catorce tamaños que faltan, el mismo texto cubre más casos sin
  // tocar una palabra. Mismo principio que /verificacion.
  // 🔴 Y NINGÚN NÚMERO SE ESCRIBE AQUÍ: `{total}`, `{medibles}`, `{correctos}` los
  // rellena `main.ts` desde `REQUIRED_FILES`. La propuesta de rediseño decía «27 FILES»
  // seis veces sobre una tabla que hoy son 31.

  // 01 · VACÍO
  // 🔴 LA SEGUNDA FRASE ES LA QUE QUITA EL MIEDO A PROBAR, y faltaba. El texto decía
  // cuántos ficheros hacen falta y ahí se paraba, así que «{total} ficheros» se lee como
  // un examen que hay que aprobar A CIEGAS: quien no está seguro de tenerlos todos no
  // suelta la carpeta, y justo esa persona es la que más necesita soltarla — porque el
  // cargador YA le va a decir cuáles le faltan, por su nombre (`insp.missing` en
  // `main.ts`, estado 03). La capacidad existía y no estaba prometida; prometerla cuesta
  // una frase y convierte «a ver si acierto» en «pruebo y me lo dice».
  // ★ Y se promete en PRESENTE de lo que el código hace HOY, no «podrás ver»: si algún
  // día el estado 03 dejara de enumerar, esta frase queda falsa y hay que moverla con él.
  vacioTitulo: { es: "Todavía no has soltado nada", en: "Nothing dropped yet" },
  vacioCuerpo: {
    es: "Hacen falta {total} ficheros de tu copia de Ultima V. Se leen aquí, en este navegador, y no se sube ninguno a ningún sitio. No hace falta que los cuentes: suelta la carpeta y, si falta alguno, te digo cuál.",
    en: "It takes {total} files from your copy of Ultima V. They are read here, in this browser, and none of them is uploaded anywhere. You don't have to count them: drop the folder and, if any are missing, I'll tell you which.",
  },

  // 02 · LEYENDO
  leyendo: { es: "Leyendo tu carpeta…", en: "Reading your folder…" },
  extrayendo: {
    es: "Generando los recursos en tu navegador…",
    en: "Generating the assets in your browser…",
  },

  // 03 · INCOMPLETO
  faltaUno: { es: "Falta 1 fichero", en: "One file is missing" },
  faltanVarios: { es: "Faltan {n} ficheros", en: "{n} files are missing" },
  faltanCuerpo: {
    es: "Sin ellos el juego no puede arrancar. Suelen estar en el nivel principal de la carpeta: si elegiste una subcarpeta, sube uno y prueba otra vez.",
    en: "Without them the game can't start. They usually sit at the top level of the folder: if you picked a subfolder, go up one and try again.",
  },

  // 04 · OTRA EDICIÓN (lo que la propuesta llamaba «versión no reconocida»)
  midePero: {
    es: "{nombre} mide {size} B, esperábamos {expected}",
    en: "{nombre} is {size} B, we expected {expected}",
  },
  otraEdicionCuerpo: {
    es: "Esto no es la edición DOS contra la que se verificó OpenU5. Puede funcionar en parte, o no funcionar.",
    en: "This is not the DOS release OpenU5 was verified against. It may partly work, or not work at all.",
  },
  // 🔴 EL ALCANCE VIAJA CON LA AFIRMACIÓN, no en una nota al pie: la comprobación es
  // PARCIAL por construcción y quien lea el aviso tiene que saber sobre cuántos
  // ficheros se pronunció. Sin esta línea, «esto no es la edición DOS» se lee como un
  // veredicto sobre los 31.
  alcanceTamano: {
    es: "Se compara el tamaño de {medibles} de los {total} ficheros: una diferencia en los otros {resto} no se vería.",
    en: "The size is compared for {medibles} of the {total} files: a difference in the other {resto} would not show up.",
  },

  // 05 · LISTO
  // 🔴 UN SOLO PÁRRAFO Y DOS FRASES (directriz de concisión, 08-2026): aquí había
  // dos párrafos —«no hará falta repetirlo…» y «al pulsar “Continuar el viaje”…»—
  // que entre título y cuerpo sumaban cuatro frases diciendo tres cosas. Lo que el
  // visitante necesita en este punto: qué hace el botón (abre el juego de 1988),
  // que no habrá que repetir la carga, y dónde quedan sus partidas. El detalle del
  // borrado de datos vive en el bloque «Tus datos» de esta misma página y en /jugar.
  listoCuerpo: {
    es: "Pulsa «Continuar el viaje» para entrar al juego, donde empezaba en 1988. No hará falta repetir la carga en este dispositivo; tus partidas se guardan en este navegador y aparecen aquí abajo.",
    en: "Press “Journey Onward” to enter the game, where it started in 1988. You won't have to load your copy again on this device; your saved games live in this browser and show up below.",
  },

  // ── LA VÍA DEL ZIP ───────────────────────────────────────────────────────────────
  // 🔴 EL RÓTULO NO DICE «también puedes usar un zip» COMO SI FUERA UNA COMODIDAD: en un
  // teléfono es la ÚNICA vía. Ningún navegador móvil deja entregar una CARPETA —sólo
  // ficheros—, así que quien llega desde el móvil pulsa «elegir carpeta», no pasa nada
  // útil y se va. Por eso la razón viaja EN el texto y no en una nota aparte.
  zipVia: { es: "¿Vienes de un móvil?", en: "On a phone?" },
  zipBoton: { es: "Suelta o elige un .zip", en: "Drop or pick a .zip" },
  zipPorQue: {
    es: "Un teléfono no puede entregar una carpeta: comprime tu carpeta de Ultima V en el ordenador y trae el .zip.",
    en: "A phone can't hand over a folder: zip your Ultima V folder on a computer and bring the .zip.",
  },
  zipAbriendo: { es: "Abriendo el .zip…", en: "Opening the .zip…" },
  zipVacio: {
    es: "Ese .zip no trae ningún fichero.",
    en: "That .zip contains no files.",
  },
  zipRoto: {
    es: "No he podido abrir ese .zip: {motivo}",
    en: "I couldn't open that .zip: {motivo}",
  },

  // ── TUS DATOS (bloque 2a) ────────────────────────────────────────────────────────
  // 🔴 «Puedes borrarlo» SIN un botón es una frase sobre una capacidad que el visitante
  // no puede ejercer — la misma clase de defecto que la página de privacidad publicada y
  // sin enlaces entrantes. El botón llama a `clearExtraction()`, que borra la cache
  // entera; y el rótulo del final dice lo que ha pasado, porque un borrado silencioso no
  // se distingue de un botón roto.
  borrar: { es: "Borrar mis ficheros de este navegador", en: "Erase my files from this browser" },
  borrado: {
    es: "Borrado. Este navegador ya no guarda nada de tu copia.",
    en: "Erased. This browser no longer holds anything from your copy.",
  },
  // 🔴 EL RESUMEN LLEVA CIFRAS, y son las MEDIDAS al borrar (`limpieza.ts` devuelve lo que
  // se fue, no lo que se pensaba borrar). Un «Borrado.» pelado sobre cuatro almacenes que
  // pueden fallar por separado —modo privado, caché bloqueada, un SW que no se deja dar de
  // baja— afirma más de lo que se sabe. Con las cifras, un cero es visible y comprobable.
  // 🔴 LA LISTA SE COMPONE DE PIEZAS CON SU SINGULAR, y no es purismo: la primera version
  // metia las cuatro cifras en una frase con los plurales fijos y la captura la enseño
  // diciendo «Borrado: 1 partidas» — en la pantalla que mas cuida como habla. Las piezas de
  // partidas y repeticiones son LAS MISMAS que enumera la confirmacion (`borrarInventario*`),
  // asi que las dos frases no pueden empezar a decirlo distinto.
  // Y sólo se nombra lo que REALMENTE se fue: un «0 repeticiones» no informa de nada y hace
  // leer una lista mas larga para encontrar lo que si pasó.
  borradoDetalle: {
    es: "Borrado: {lista}. Este navegador vuelve a ser el de un visitante nuevo.",
    en: "Erased: {lista}. This browser is a brand-new visitor's again.",
  },
  borradoAjuste: { es: "1 ajuste", en: "1 setting" },
  borradoAjustes: { es: "{n} ajustes", en: "{n} settings" },
  borradoCache: { es: "1 caché", en: "1 cache" },
  borradoCaches: { es: "{n} cachés", en: "{n} caches" },
  nadaQueBorrar: {
    es: "No hay nada guardado en este navegador.",
    en: "There is nothing stored in this browser.",
  },
  misPermisos: { es: "Ver o cambiar mis permisos", en: "See or change my permissions" },

  // ── EL BORRADO CUANDO HAY PARTIDAS: se PREGUNTA, y se dice qué se va ─────────────
  // 🔴 Los recursos extraídos se regeneran soltando la carpeta otra vez; una partida de
  // cuarenta horas NO. Son dos cosas de coste MUY distinto detrás del mismo botón, así
  // que en cuanto hay algo irrecuperable el botón deja de actuar y pasa a preguntar,
  // enseñando el inventario exacto. Sin partidas ni repeticiones no pregunta nada: no
  // hay nada que perder y una confirmación de trámite sólo enseña a no leerlas.
  borrarAviso: {
    es: "Esto borrará también lo que no se puede recuperar:",
    en: "This will also erase what cannot be recovered:",
  },
  borrarInventarioPartidas: {
    es: "{n} partidas guardadas",
    en: "{n} saved games",
  },
  borrarInventarioPartida: { es: "1 partida guardada", en: "1 saved game" },
  borrarInventarioRepeticiones: { es: "{n} repeticiones", en: "{n} recordings" },
  borrarInventarioRepeticion: { es: "1 repetición", en: "1 recording" },
  // Las DOS entradas nuevas del inventario. Se enumeran porque ahora se van de verdad, y
  // porque son las dos que nadie espera: el consentimiento va DENTRO de los ajustes y se
  // NOMBRA, en vez de esconderlo en un «y otras cosas» — que el panel de permisos vuelva a
  // preguntar tiene que estar dicho antes, no descubrirse al recargar.
  borrarInventarioCopia: { es: "tu copia extraída", en: "your extracted copy" },
  borrarInventarioAjustes: {
    es: "{n} ajustes de este navegador (idioma, permisos, piel, sonido)",
    en: "{n} settings in this browser (language, permissions, skin, sound)",
  },
  borrarConfirmar: { es: "Sí, borrarlo todo", en: "Yes, erase everything" },
  borrarCancelar: { es: "Cancelar", en: "Cancel" },
  borrarCancelado: { es: "No se ha borrado nada.", en: "Nothing was erased." },

  // ── TUS PARTIDAS ─────────────────────────────────────────────────────────────────
  // 🔴 NINGÚN CAMPO SE INVENTA: nombre, fecha, turnos y lugar son exactamente los
  // cuatro que `SaveMeta` guarda al escribir la partida (game/src/core/save-keys.ts).
  // Si mañana el juego guardase el retrato o el nivel, esto los enseñaría; hoy no los
  // tiene, así que no los promete.
  partidasTitulo: { es: "Tus partidas", en: "Your saved games" },
  partidasVacio: {
    es: "Todavía no hay ninguna partida guardada en este navegador. Las que guardes dentro del juego aparecerán aquí.",
    en: "No saved games in this browser yet. The ones you save inside the game will show up here.",
  },
  // El turno es la unidad del propio motor (`turnsSinceStart`), no una estimación de
  // minutos: no se convierte a horas porque el juego no mide horas de reloj de pared.
  partidaMeta: { es: "{lugar} · turno {turnos} · {fecha}", en: "{lugar} · turn {turnos} · {fecha}" },
  partidaContinuar: { es: "Continuar", en: "Continue" },
  // El mismo enlace con otro verbo: una partida sembrada no se «continúa», se empieza.
  partidaJugarDesdeAqui: { es: "Jugar desde aquí", en: "Play from here" },
  partidasSinCopia: {
    es: "Para continuar hace falta tu copia del juego: suéltala arriba y estas partidas seguirán aquí.",
    en: "Continuing needs your copy of the game: drop it above and these saves will still be here.",
  },

  // ── LLEVARSE UNA PARTIDA A OTRO DISPOSITIVO (ver `exporta.ts`) ───────────────────────
  // 🔴 Se dice «se descarga a tu disco» y no «exportar»: lo que hace falta que quede claro
  // es que el fichero NO SALE de este ordenador por ningún sitio — no hay cuenta, ni nube, ni
  // enlace. Quien lo lleva al otro dispositivo eres tú, y ésa es la propiedad del diseño, no
  // una limitación que disimular. Misma frase que la sección de repeticiones sostiene arriba.
  partidaDescargar: { es: "Descargar", en: "Download" },
  partidaDescargando: { es: "Preparando…", en: "Preparing…" },
  // El NOMBRE del fichero se enseña: en un móvil la descarga cae en una carpeta que no se ve,
  // y saberlo es la diferencia entre encontrarlo y darlo por perdido.
  partidaDescargada: { es: "Descargada: {f}", en: "Downloaded: {f}" },
  partidaDescargaFallo: { es: "No he podido descargarla", en: "I couldn't download it" },

  // 🔴 EL TÍTULO NOMBRA LA OPERACIÓN QUE LA GENTE BUSCA (#229). Decía sólo «Traer una
  // partida» / «Bring in a save», y el reporte del usuario fue literalmente «en /byo no hay
  // export ni import»: las palabras `importar` y `exportar` NO aparecían en la página —
  // medido, 0 ocurrencias en los dos idiomas—, así que quien las buscaba con los ojos (o con
  // Ctrl-F) no encontraba nada aunque el control estuviera montado y visible. La perífrasis
  // se queda porque es la que se entiende; la palabra técnica va al lado porque es la que se
  // busca. Lo carea `re/tools/test_byo_transferencia.py` en los DOS idiomas.
  importaTitulo: {
    es: "Traer y llevarse partidas · importar y exportar",
    en: "Bring saves in and take them out · import and export",
  },
  importaQue: {
    es: "Si descargaste una partida en otro dispositivo, suelta aquí el fichero y se añadirá a esta lista. Se lee en este navegador y no se envía a ningún sitio.",
    en: "If you downloaded a save on another device, drop the file here and it will join this list. It is read in this browser and sent nowhere.",
  },
  // La otra mitad del par, y existe porque SIN PARTIDAS NO HAY NINGÚN BOTÓN «Descargar»: la
  // exportación es un botón POR TARJETA, así que en un navegador recién estrenado no había
  // en toda la página ni un solo rastro de que exportar fuera posible. Esta línea lo dice
  // aunque la lista esté vacía, y dice DÓNDE está el control cuando la lista no lo esté.
  importaExportaDonde: {
    es: "Para llevártela, cada partida de la lista de arriba tiene su botón «Descargar»: te da un fichero .u5gam que puedes traer aquí desde otro dispositivo.",
    en: "To take one with you, every save in the list above has its own “Download” button: it gives you a .u5gam file you can bring in here from another device.",
  },
  // 🔴 EL ALCANCE DEL FORMATO SE DICE (#266). El `.u5gam` viaja de OpenU5 a OpenU5 y de nada
  // más: no es un SAVED.GAM que el Ultima V original de DOS/DOSBox pueda cargar — el sobre
  // lleva el diario, los objetos del mundo y la trama, que el formato de 1988 no tiene dónde
  // guardar (la mitad que el original no ve). Callarlo invita a llevárselo al DOSBox y
  // descubrir allí que no carga, con pinta de fichero roto.
  importaFormatoAlcance: {
    es: "El fichero .u5gam sólo viaja entre navegadores con OpenU5: no sirve como partida para el Ultima V original de DOS/DOSBox.",
    en: "The .u5gam file only travels between browsers running OpenU5: it does not work as a save for the original DOS/DOSBox Ultima V.",
  },
  // 🔴 EL RÓTULO ANUNCIABA UNA SOLA EXTENSIÓN Y EL CARGADOR ACEPTA DOS (#168a). El
  // `input.accept` de `exporta.ts` dice `.u5gam,.gam` y `leeFichero` tiene una rama
  // ENTERA para el `.gam` pelado del DOS (degradado `sin-sobre`, con su propio mensaje
  // `importaHechoSinSobre` ahí abajo) — o sea que la importación existe, está probada y
  // hasta se explica al terminar, pero NO se anunciaba DONDE SE USA. Quien llega con un
  // SAVED.GAM de 1988 lee «.u5gam», deduce que hace falta convertirlo antes, y se va.
  // El rótulo no puede quedarse corto respecto a `accept`: lo carea
  // `re/tools/test_dropzone_rotulo.py` en la batería, en los DOS idiomas.
  importaSuelta: {
    es: "Suelta aquí el fichero .u5gam o .gam, o pulsa para elegirlo",
    en: "Drop the .u5gam or .gam file here, or click to pick it",
  },
  importaLeyendo: { es: "Leyendo el fichero…", en: "Reading the file…" },
  importaHecho: { es: "Partida añadida ✓ Ya está en la lista de arriba.", en: "Save added ✓ It is in the list above." },
  // 🔴 LA DEGRADACIÓN SE DICE, Y SE DICE QUÉ FALTA. Un `.gam` pelado entra completo en cuanto
  // a los 4192 B del formato de 1988 y COJO en todo lo que ese formato no guarda (el diario,
  // los objetos del mundo, las banderas de la trama). Callarlo daría una partida con pinta de
  // buena en la que los Shadowlords vuelven a estar vivos.
  importaHechoSinSobre: {
    es: "Partida añadida ✓ Venía como .gam suelto: se ha leído todo lo que ese formato guarda, pero no el diario, los objetos del mundo ni el avance de la trama.",
    en: "Save added ✓ It came as a bare .gam: everything that format stores was read, but not the journal, the world objects or the story progress.",
  },
  importaHechoSobreRoto: {
    es: "Partida añadida ✓ Los datos extra del fichero venían ilegibles, así que se ha leído sólo la partida en sí (sin diario, objetos del mundo ni avance de la trama).",
    en: "Save added ✓ The file's extra data was unreadable, so only the save itself was read (no journal, world objects or story progress).",
  },
  // Cada rechazo manda a un sitio distinto y por eso son cuatro frases y no una.
  importaRechazo_corto: {
    es: "Esto no es una partida: son sólo {detalle}, y una partida de Ultima V ocupa 4192 bytes como mínimo. ¿Has soltado otro fichero?",
    en: "This isn't a save: it is only {detalle}, and an Ultima V save is at least 4192 bytes. Did you drop the wrong file?",
  },
  // 🔴 LA CLAVE LLEVA EL GUION porque se compone con `"importaRechazo_" + motivo` y el motivo
  // es `"no-es-partida"` (`exporta.ts`, `MotivoRechazo`). Una clave en camelCase aquí no daría
  // error: `txt()` devuelve la propia clave cuando no la encuentra, así que el usuario vería
  // «importaRechazo_no-es-partida» en pantalla. El arnés carea los cuatro motivos con sus
  // cuatro claves justamente porque este acoplamiento es invisible al compilador.
  "importaRechazo_no-es-partida": {
    es: "El fichero tiene el tamaño de una partida pero dentro no hay una ({detalle}). O está dañado, o es otra cosa.",
    en: "The file is the right size for a save but there isn't one inside ({detalle}). It is either damaged or something else.",
  },
  importaRechazo_codec: {
    es: "No he podido leer esta partida: {detalle}",
    en: "I couldn't read this save: {detalle}",
  },
  importaRechazo_almacen: {
    es: "La partida es correcta pero este navegador no la deja guardar (¿sin espacio, o modo privado?).",
    en: "The save is fine but this browser won't store it (out of space, or private mode?).",
  },
  importaFalloLectura: {
    es: "No he podido leer el fichero de tu disco.",
    en: "I couldn't read the file from your disk.",
  },
  // Los dos únicos textos que se INVENTAN, y sólo para un `.gam` pelado que no trae cabecera:
  // el formato de 1988 no guarda ni el nombre que le pusiste a la partida ni el del sitio (los
  // nombres de lugar viven en la extracción). Se dice que no se saben en vez de inventarlos.
  importaNombrePorDefecto: { es: "Partida importada", en: "Imported save" },
  importaLugarDesconocido: { es: "lugar desconocido", en: "unknown place" },

  // ── REPETICIONES ─────────────────────────────────────────────────────────────────
  // 🔴 NI UN CONTROL MUERTO. Grabar se hace DENTRO del juego (es donde están las teclas
  // que se graban), así que aquí no hay botón de grabar: hay la frase que dice dónde
  // está. Un botón «grabar» en esta pantalla no tendría nada que grabar.
  repeticionesTitulo: { es: "Repeticiones", en: "Replays" },
  repeticionesQue: {
    es: "Una partida es su estado inicial más las teclas que pulsaste, así que cabe entera en unos kilobytes y se puede volver a ver. Se graban desde el menú del juego y se quedan en este navegador.",
    en: "A game is its starting state plus the keys you pressed, so a whole session fits in a few kilobytes and can be watched again. You record them from the game's own menu, and they stay in this browser.",
  },
  repeticionesVacio: {
    es: "Todavía no has grabado ninguna repetición en este navegador.",
    en: "You haven't recorded any replays in this browser yet.",
  },
  repeticionMeta: {
    es: "{teclas} teclas · {turnos} turnos · {fecha}",
    en: "{teclas} keys · {turnos} turns · {fecha}",
  },
  repeticionVer: { es: "Ver repetición", en: "Watch replay" },
  // Hueco de la miniatura en las repeticiones grabadas ANTES de que se capturara el
  // fotograma final. No pueden tenerlo nunca —el canvas de aquel momento ya no
  // existe—, así que el rótulo dice qué falta y no invita a arreglarlo.
  repeticionSinFoto: { es: "Sin imagen", en: "No preview" },
  // Se dice UNA vez y en el sitio donde alguien podría esperar lo contrario.
  // 🔴 ESTE TEXTO CAMBIÓ CON LA TABLA DE RÉCORDS, y en el MISMO commit que la trajo. Decía
  // «no hay forma de subirlo, ni tabla de récords, ni enlace que compartir», que describía
  // la AUSENCIA de una función; en cuanto la función existe, la frase pasa a ser falsa y a
  // nadie le suena la alarma (es prosa). Lo que ahora describe es el INVARIANTE, que no
  // caduca al añadir funciones: nada sale de aquí sin un acto explícito, y lo que sale son
  // teclas, jamás tus ficheros. Misma regla que la reescritura de la portada exigida por el
  // carril 1 del diseño de lanzamiento (§«Reescritura del texto de la portada»).
  repeticionesLocal: {
    es: "Esto vive sólo en este navegador. Nada se envía si no lo pides tú: subir una repetición a la tabla de récords es un acto aparte, y lo que viaja son las teclas —nunca tus ficheros del juego.",
    en: "This lives only in this browser. Nothing is sent unless you ask for it: uploading a replay to the leaderboard is a separate, explicit action, and what travels is the keystrokes — never your game files.",
  },

  // ── TABLA DE RÉCORDS (carril 2 del diseño de lanzamiento) ────────────────────────
  // 🔴 El vocabulario de este bloque es deliberado: «reclamado», «huella», «comprueba tú
  // mismo». El servidor NO puede verificar un récord —haría falta ejecutar el motor, y eso
  // exige los datos de EA que no tiene—, así que ni una de estas frases puede sugerir que
  // alguien lo haya validado por ti.
  recordsTitulo: { es: "Tabla de récords", en: "Leaderboard" },
  recordsQue: {
    es: "Cada récord publica su partida entera en teclas: bájatela y reprodúcela con tu copia. Nadie te pide que te fíes — el servidor no puede comprobar ninguno de estos números, porque para eso haría falta ejecutar el juego, y para eso hacen falta los ficheros que sólo tienes tú.",
    en: "Every record publishes its whole game as keystrokes: download it and replay it with your own copy. Nobody asks you to trust it — the server cannot check any of these numbers, because that would mean running the game, and that needs the files only you have.",
  },
  recordsVacio: { es: "Todavía no hay récords publicados.", en: "No records published yet." },
  recordMeta: {
    es: "{turnos} turnos · {teclas} teclas · desde «{base}» · motor {motor}",
    en: "{turnos} turns · {teclas} keys · from “{base}” · engine {motor}",
  },
  recordHuella: { es: "huella del arranque {h}…", en: "start fingerprint {h}…" },
  recordRegistro: { es: "Registro", en: "Raw log" },
  recordTurnos: { es: "{n} turnos", en: "{n} turns" },
  recordHuellaOk: {
    es: "✔ Tu copia compone el mismo arranque (la huella coincide): si al reproducirlo divergiera, la diferencia estaría en el motor, no en el punto de partida.",
    en: "✔ Your copy builds the same starting point (fingerprints match): if the replay diverged, the difference would be in the engine, not in the start.",
  },
  recordHuellaDistinta: {
    es: "⚠ Tu copia compone OTRO arranque (la huella no coincide). Puedes verlo igual, pero lo que veas no comprueba este récord.",
    en: "⚠ Your copy builds a DIFFERENT starting point (fingerprints differ). You can still watch it, but what you see does not check this record.",
  },
  recordDescargaFallo: {
    es: "No se pudo traer ese registro.",
    en: "Could not fetch that log.",
  },
  recordSinPermiso: {
    es: "Para subir una repetición a la tabla hace falta activar «Guardar mi partida»: es lo único que sale de tu navegador, y son las teclas que pulsaste.",
    en: "Uploading a replay to the leaderboard needs “Save my game” switched on: it is the only thing that leaves your browser, and it is the keys you pressed.",
  },
  recordSinRepeticiones: {
    es: "Cuando grabes una repetición desde el menú del juego, podrás subirla desde aquí.",
    en: "Once you record a replay from the game's own menu, you'll be able to upload it here.",
  },
  recordAlias: { es: "Tu apodo", en: "Your nickname" },
  recordAliasFalta: { es: "Escribe un apodo antes de subir.", en: "Type a nickname before uploading." },
  recordSubir: { es: "Subir récord", en: "Upload record" },
  recordSubiendo: { es: "Subiendo…", en: "Uploading…" },
  recordSubido: { es: "✔ Récord subido.", en: "✔ Record uploaded." },
  recordSubirFallo: { es: "No se pudo subir: {motivo}", en: "Upload failed: {motivo}" },
  // 🔴 El caso frecuente, y NO es un fallo: se explica QUÉ pasa y POR QUÉ no se puede,
  // porque el porqué es justamente la promesa del sitio.
  recordArranqueNoPublico: {
    es: "Esta repetición arranca de una partida tuya, no de un momento publicado. No puede ir a la tabla: para que otro la reprodujera habría que enviar tu estado inicial, y ahí dentro van datos que salen de tus ficheros del juego. Graba desde un momento legendario y esa repetición sí se puede compartir.",
    en: "This replay starts from one of your own games, not from a published moment. It cannot go on the leaderboard: for someone else to reproduce it we would have to send your starting state, and that contains data derived from your game files. Record from a legendary moment and that replay can be shared.",
  },
  recordSinCopia: {
    es: "Hace falta tu copia del juego en este navegador para componer el arranque.",
    en: "Your copy of the game must be in this browser to build the starting point.",
  },
  almacenNoDisponible: {
    es: "Este navegador no deja guardar datos de sitios (¿modo privado?), así que no puede haber partidas ni repeticiones.",
    en: "This browser is not allowing site storage (private mode?), so there can be no saves or replays.",
  },


  // ── TARJETA DE UNA PARTIDA (bloque 2d-bis) ───────────────────────────────────────
  // 🔴 Todo esto sale del ESTADO GUARDADO, no de una tabla nuestra. Lo que la partida
  // no traiga, no se pinta: un «0 de oro» inventado se lee como un dato.
  chipFecha: { es: "{d}/{m}/{a} del juego", en: "game date {d}/{m}/{a}" },
  chipOro: { es: "{n} de oro", en: "{n} gold" },
  chipKarma: { es: "karma {n}", en: "karma {n}" },
  chipGrupo: { es: "grupo de {n}", en: "party of {n}" },
  art_corona: { es: "Corona", en: "Crown" },
  art_cetro: { es: "Cetro", en: "Sceptre" },
  art_amuleto: { es: "Amuleto", en: "Amulet" },
  // Los tres Shards y la caja de sándalo salen de OTROS DOS campos del estado (`shards` y
  // `specialItems.woodenBox`), no de `lbArtifacts`. Se nombran uno a uno porque son tres
  // objetos DISTINTOS de la trama: «3 shards» ocultaría CUÁLES tienes.
  art_shardFalsedad: { es: "Shard de la Falsedad", en: "Shard of Falsehood" },
  art_shardOdio: { es: "Shard del Odio", en: "Shard of Hatred" },
  art_shardCobardia: { es: "Shard de la Cobardía", en: "Shard of Cowardice" },
  art_caja: { es: "Caja de sándalo", en: "Sandalwood box" },
  // 🔴 «SIN RASTRO» NO ES «AÚN NO APARECEN», y el cambio de palabra es el arreglo.
  // Esta clave decía «Shadowlords: aún no aparecen» y salía sobre partidas TERMINADAS: era lo
  // que se imprimía cuando `shadowlordLocs` estaba ausente, que es su estado normal — el port
  // no mantiene ese campo (`game.ts:4962`) y la muerte vive en `questFlags`. O sea que la
  // frase afirmaba sobre la TRAMA («no han aparecido») desde un campo que no habla de eso.
  // La de ahora afirma sobre el SAVE, que es lo único que la tarjeta puede saber.
  slSinRastro: { es: "Shadowlords: sin rastro en esta partida", en: "Shadowlords: no trace in this save" },
  // Y el otro extremo, que antes NO TENÍA CÓMO DECIRSE: los tres destruidos es el final del
  // juego y merece una frase, no tres circulitos que hay que saber leer.
  slTodosDestruidos: { es: "Shadowlords: los tres destruidos", en: "Shadowlords: all three destroyed" },
  slRotulo: { es: "Shadowlords", en: "Shadowlords" },
  // ── LA FICHA RICA (sección plegada de la tarjeta) ────────────────────────────────────
  // Las 28 claves que pide `tarjeta-rica-vista.ts`. NO son una lista escrita a mano: el
  // conjunto lo recoge un traductor ESPÍA en el arnés y `test_byo_tarjeta_rica.py` lo
  // asevera contra esta tabla. Si la vista pide una clave nueva y nadie la añade aquí, el
  // test se pone rojo NOMBRÁNDOLA — que es lo que hace falta, porque `txt()` devuelve la
  // CLAVE EN CRUDO cuando no la encuentra (`idioma.ts`, `if (!m) return id`): una clave que
  // falta no da error, pinta `tramaSantuarios` en la tarjeta y sólo lo ve quien mire esa
  // tarjeta en ese idioma.
  fichaVerDetalles: { es: "Ver detalles", en: "View details" },
  fichaGrupo: { es: "Grupo", en: "Party" },
  fichaBolsa: { es: "Bolsa", en: "Pack" },
  fichaTrama: { es: "Trama", en: "Quest" },
  fichaMundo: { es: "Mundo", en: "World" },
  pjNivel: { es: "niv {n}", en: "lv {n}" },
  pjSinNombre: { es: "(sin nombre)", en: "(unnamed)" },
  // El CARDINAL de ranuras ocupadas. Desde que la ficha nombra lo que se lleva puesto ya no
  // es el texto de la línea: es su `title`, el dato que los nombres no dan (cuántas libres).
  pjEquipado: { es: "{n}/6 equipo", en: "{n}/6 gear" },
  // Las seis ranuras presentes y las seis a 0xff. NO es lo mismo que un registro sin ranuras
  // (ése no pinta línea): esto es «medido, y va desnudo». Los NOMBRES del equipo, en cambio,
  // no pasan por aquí — son los del binario y van en inglés en los dos idiomas (cabo
  // declarado en `Miembro.equipo`).
  pjSinEquipo: { es: "sin equipo", en: "no gear" },
  // Estados de `CharacterState.status`. Sólo se pinta el que NO es 'G' (ver la vista), pero
  // los cinco están porque el save puede traer cualquiera y un estado sin clave saldría en
  // crudo justo en la partida que peor pinta tiene.
  estado_P: { es: "envenenado", en: "poisoned" },
  estado_C: { es: "hechizado", en: "charmed" },
  estado_S: { es: "dormido", en: "asleep" },
  estado_D: { es: "MUERTO", en: "DEAD" },
  bolsaOro: { es: "Oro", en: "Gold" },
  bolsaComida: { es: "Comida", en: "Food" },
  bolsaLlaves: { es: "Llaves", en: "Keys" },
  bolsaGemas: { es: "Gemas", en: "Gems" },
  bolsaAntorchas: { es: "Antorchas", en: "Torches" },
  bolsaCalaveras: { es: "Llaves de calavera", en: "Skull keys" },
  bolsaAlfombras: { es: "Alfombras mágicas", en: "Magic carpets" },
  tramaShadowlords: { es: "Shadowlords", en: "Shadowlords" },
  tramaDeTres: { es: "{n} de 3 destruidos", en: "{n} of 3 destroyed" },
  tramaPalabras: { es: "Palabras de poder", en: "Words of power" },
  tramaEscondrijos: { es: "Escondrijos hallados", en: "Caches found" },
  tramaSantuarios: { es: "Santuarios destruidos", en: "Shrines destroyed" },
  tramaSalas: { es: "Salas despejadas", en: "Rooms cleared" },
  tramaPersonas: { es: "Personas conocidas", en: "People met" },
  tramaMoonstones: { es: "Moonstones enterradas", en: "Moonstones buried" },
  mundoHora: { es: "Hora", en: "Time" },
  mundoDia: { es: "(día)", en: "(day)" },
  mundoNoche: { es: "(noche)", en: "(night)" },
  mundoTransporte: { es: "Transporte", en: "Travel" },
  // Las dos lunas. El número es la FASE REAL (0-7), ya restado el 0x30 del byte crudo.
  lunaFelucca: { es: "Felucca {n}/8", en: "Felucca {n}/8" },
  lunaTrammel: { es: "Trammel {n}/8", en: "Trammel {n}/8" },
  // Los cinco modos de `TransportMode` (`state.ts:49`).
  transporte_foot: { es: "A pie", en: "On foot" },
  transporte_horse: { es: "A caballo", en: "On horseback" },
  transporte_carpet: { es: "En alfombra", en: "By carpet" },
  transporte_skiff: { es: "En esquife", en: "By skiff" },
  transporte_ship: { es: "En barco", en: "By ship" },
  // ── LA PARTIDA EN CURSO ──────────────────────────────────────────────────────────────
  // 🔴 «En curso» NO es una partida distinta ni un almacén nuevo: es la de mayor timestamp,
  // que es EXACTAMENTE la que `loadMostRecentSave()` (persistence.ts:129) recarga al pulsar
  // Journey Onward — el equivalente del SAVED.GAM del original. La insignia dice eso y no
  // «la última que guardaste», que sería describir el mecanismo en vez del significado.
  enCursoInsignia: { es: "en curso", en: "in progress" },
  enCursoTitulo: { es: "Tu partida en curso", en: "Your game in progress" },
  sl_ciudad: { es: "en una ciudad", en: "in a city" },
  sl_fuera: { es: "fuera de las ciudades", en: "outside the cities" },
  sl_destruido: { es: "destruido", en: "destroyed" },
  sl_sin_rastro: { es: "sin rastro", en: "no trace" },

  // ── MOMENTOS LEGENDARIOS (spec 2026-08-08) ───────────────────────────────────────────
  // 🔴 NINGÚN TÍTULO DE MOMENTO SE ESCRIBE AQUÍ. Los diez títulos y sus líneas de
  // ambientación viven en `game/src/momentos/defs.ts` y llegan por el catálogo horneado, en
  // los dos idiomas: son parte del DATO del momento, no rótulos de esta pantalla. Aquí sólo
  // están los textos de la propia galería — los que existirían aunque no hubiera momentos.
  momentosAbrir: { es: "Momentos legendarios", en: "Legendary moments" },
  momentosAbrirQue: {
    es: "Partidas ya montadas en los puntos clave de la historia.",
    en: "Ready-made saves at the story's turning points.",
  },
  momentosTitulo: { es: "Momentos legendarios", en: "Legendary moments" },
  momentosQue: {
    es: "Cada uno es una partida montada justo antes de un momento clave, con el grupo, el sitio y la hora que le tocan. Se añade a tus partidas y se juega libremente desde ahí: no es una escena, es tu partida.",
    en: "Each one is a save set up right before a turning point, with the party, place and time it calls for. It goes into your saved games and you play on freely from there: it is not a cutscene, it is your game.",
  },
  momentosCargando: { es: "Cargando…", en: "Loading…" },
  // El catálogo es un fichero del sitio: si no llega, no hay nada que enseñar y se dice.
  momentosSinCatalogo: {
    es: "No he podido cargar la lista de momentos.",
    en: "I couldn't load the list of moments.",
  },
  momentoActo: { es: "Acto {n}", en: "Act {n}" },
  momentoAnadir: { es: "Añadir a mis partidas", en: "Add to my games" },
  momentoAnadiendo: { es: "Añadiendo…", en: "Adding…" },
  momentoAnadido: { es: "Añadido ✓", en: "Added ✓" },
  // La partida ya está sembrada cuando sale esto: lo que falta es su foto, que se pinta
  // arrancando el juego sobre ella. Se dice porque tarda ~2 s y un botón mudo ese rato se
  // lee como colgado.
  momentoPintando: { es: "Pintando el momento…", en: "Painting the moment…" },
  momentoHecho: {
    es: "«{titulo}» está ya entre tus partidas, ahí abajo.",
    en: "“{titulo}” is now among your saved games, below.",
  },
  momentoProximamente: { es: "Próximamente", en: "Coming soon" },
  // 🔴 SE DICE EL PORQUÉ, no «no disponible»: el momento se compone contra TU copia (es de
  // ahí de donde salen los compañeros y sus cifras), así que sin extracción no hay con qué
  // montarlo — exactamente la misma razón por la que tampoco se puede jugar.
  momentoSinCopia: {
    es: "Hace falta tu copia: el momento se monta con los personajes de tu Ultima V. Suéltala arriba.",
    en: "This needs your copy: the moment is built from your Ultima V's characters. Drop it above.",
  },
  momentoFallo: { es: "No he podido añadirlo: {motivo}", en: "I couldn't add it: {motivo}" },
  // La insignia de la TARJETA, en la lista de partidas: quien vuelve dentro de un mes tiene
  // que poder distinguir la partida que jugó de la que se le puso ahí.
  chipMomento: { es: "momento legendario", en: "legendary moment" },

  // ── INSIGNIAS DE PROGRESO Y ENLACE COMPARTIDO ────────────────────────────────────────
  // «Jugado» y no «Completado»: lo que se observa es que hubo partida después de abrirlo
  // (criterio entero y con su falso positivo declarado en `insignias.ts` §2). Un momento no
  // tiene final, así que «completado» sería afirmar algo que ni siquiera está definido.
  momentoJugado: { es: "Jugado", en: "Played" },
  momentoCopiar: { es: "Copiar enlace", en: "Copy link" },
  momentoCopiado: { es: "Enlace copiado ✓", en: "Link copied ✓" },
  // El portapapeles no existe en contexto inseguro y puede negarse por permisos: entonces el
  // enlace se ENSEÑA para copiarlo a mano, que es lo que el botón prometía hacer por ti.
  momentoCopiarManual: {
    es: "No he podido copiarlo yo. El enlace es: {url}",
    en: "I couldn't copy it for you. The link is: {url}",
  },
  // Los tres avisos de un enlace que no puede abrir la galería. Cada uno manda a un sitio
  // distinto porque cada uno se arregla de otra manera (o de ninguna) — ver `comparte.ts`.
  enlaceDesconocido: {
    es: "El enlace que has abierto lleva a un momento que este sitio no publica ({id}).",
    en: "The link you opened points at a moment this site doesn't publish ({id}).",
  },
  enlaceProximamente: {
    es: "El enlace lleva a un momento que todavía no está disponible.",
    en: "The link points at a moment that isn't available yet.",
  },
  enlaceSinCopia: {
    es: "El enlace lleva a un momento legendario. Se monta con los personajes de tu Ultima V, así que hace falta tu copia: suéltala arriba y la galería se abrirá sola en ese momento.",
    en: "The link points at a legendary moment. It is built from your Ultima V's characters, so it needs your copy: drop it above and the gallery will open on that moment by itself.",
  },

  // ── LAS DOS VISTAS DEL MAPA DE UN INTERIOR ───────────────────────────────────────
  // 🔴 La segunda marca NO señala al grupo, señala al EDIFICIO. Dos anillos rojos idénticos
  // con significados distintos y sin rótulo serían una ilustración que miente.
  visorParDentro: { es: "Dentro — dónde está tu grupo", en: "Inside — where thy party stands" },
  visorParMundo: { es: "En Britannia — dónde está el lugar", en: "In Britannia — where the place lies" },

  // ── LA CAPTURA QUE SE PIDE OTRA VEZ (tarjeta de un momento sin foto) ─────────────
  // 🔴 El rótulo dice GENERAR, no «reintentar»: quien llega aquí desde un momento sembrado
  // por una versión anterior a la captura nunca vio un intento fallido, y «reintentar» le
  // haría buscar un error que no ocurrió.
  shotGenerar: { es: "Generar captura", en: "Generate screenshot" },
  // Para la tarjeta que YA tiene foto pero no es la pantalla canónica de 1988 (una
  // captura del teléfono entero de antes de #153). «Generar» junto a una imagen visible
  // se leería como que el botón hace otra cosa.
  shotRehacer: { es: "Rehacer captura", en: "Redo screenshot" },
  shotGenerando: { es: "Pintando…", en: "Painting…" },
  // El fracaso se queda EN EL BOTÓN y el botón vuelve a estar pulsable: así el segundo
  // intento es una decisión de quien mira, no un bucle que la página decide sola.
  shotFallo: { es: "No salió — probar otra vez", en: "Didn't work — try again" },

  replayCargando: {
    es: "Cargando el juego para reproducir…",
    en: "Loading the game to play this back…",
  },
  replayCerrar: { es: "Cerrar", en: "Close" },

  // ── EL VISOR de la ilustración de una tarjeta ────────────────────────────────────
  // 🔴 Los rótulos son el NOMBRE ACCESIBLE del botón que abre, y por eso dicen QUÉ se
  // abre y no «Ampliar»: quien navega con lector de pantalla oye una lista de tarjetas y
  // «Ampliar, Ampliar, Ampliar» no distingue el mapa de la captura. Y llevan el verbo
  // porque el elemento es un botón, no una imagen.
  visorMapa: { es: "Ver el mapa en grande", en: "View the map larger" },
  visorCaptura: { es: "Ver la captura en grande", en: "View the screenshot larger" },
  visorCerrar: { es: "Cerrar", en: "Close" },

  // Censo y controles, comunes a varios estados.
  censo: { es: "{correctos} de {total} ficheros", en: "{correctos} of {total} files" },
  otraCarpeta: { es: "Elegir otra carpeta", en: "Pick another folder" },
  intentarIgual: { es: "Intentarlo igualmente", en: "Try it anyway" },
  verLista: { es: "Ver la lista completa", en: "See the full list" },
};

/**
 * Texto de ejecución en el idioma vigente, con sustitución de `{clave}`.
 * Sin entrada ⇒ devuelve la propia clave (visible, no silencioso: un mensaje que falta
 * tiene que verse en pantalla, no degradar a cadena vacía).
 */
/**
 * IDIOMA CONGELADO: gana a `idiomaActual()` mientras esté puesto.
 *
 * 🔴 Existe por UN caso, y es real y medido: «Borrar datos locales» borra `openu5-lang`, así
 * que TODO lo que se repinte después —y el propio borrado dispara tres repintados: el panel
 * de estados (`ve({k:'vacio'})`), la lista de partidas (`refrescaPartidas`) y el bloque de
 * datos— resolvería al idioma de respaldo de `navigator.language`. El resultado, fotografiado:
 * media pantalla en español y media en inglés, con el visitante mirando.
 *
 * ★ Y ES UN CERROJO GLOBAL Y NO UN PARÁMETRO POR LLAMADA A PROPÓSITO. Empecé pasando la
 * lengua a `txt()` en el resumen del borrado, corrió verde, y la CAPTURA enseñó que los otros
 * dos repintados seguían volcando al respaldo: un parámetro sólo arregla los sitios que uno se
 * acuerda de tocar, y aquí hay que cubrir todo lo que el borrado despierte, incluido lo que se
 * añada mañana.
 *
 * Se suelta cuando el visitante elige idioma (`aplicaIdioma`): a partir de ahí manda él.
 */
let congelado: "es" | "en" | null = null;

/** Congela el idioma de los textos de ejecución. `null` lo devuelve al resolvedor. */
export function congelaIdioma(lang: "es" | "en" | null): void {
  congelado = lang;
}

export function txt(id: string, vars: Record<string, string> = {}): string {
  const m = MENSAJES[id];
  if (!m) return id;
  const lang = congelado ?? idiomaActual();
  let s = m[lang] ?? m.en;
  for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(v);
  return s;
}

/** Aplica `data-es`/`data-en` a todo el documento y sincroniza `<html lang>`. */
export function aplicaIdioma(lang: "es" | "en", doc: Document = document): void {
  // Elegir idioma SUELTA el congelado: si el visitante pulsa ES/EN después de un borrado
  // total, manda él y no la foto que se tomó antes de borrar la preferencia.
  congelaIdioma(lang);
  doc.documentElement.lang = lang;
  doc.querySelectorAll<HTMLElement>("[data-es][data-en]").forEach((n) => {
    const v = n.getAttribute("data-" + lang);
    if (v !== null) n.innerHTML = v;
  });
  // El NOMBRE ACCESIBLE va aparte: `aria-label` no es contenido, así que no lo alcanza
  // el `innerHTML` de arriba. Sin esto, quien navega la zona de soltar con lector de
  // pantalla la oiría siempre en inglés — el usuario que MÁS depende del idioma.
  doc.querySelectorAll<HTMLElement>("[data-es-aria][data-en-aria]").forEach((n) => {
    const v = n.getAttribute("data-" + lang + "-aria");
    if (v !== null) n.setAttribute("aria-label", v);
  });
  // El panel de consentimiento trae SUS PROPIOS textos (vive también en la portada y en
  // el juego, que no comparten este HTML): se le avisa por el mismo evento que usa la
  // portada, para que se repinte si está abierto. Ver `demo-byo/src/portada.ts`.
  doc.defaultView?.dispatchEvent(new CustomEvent("openu5:lang", { detail: lang }));
}

/**
 * Monta el conmutador ES/EN y aplica el idioma vigente. Idempotente.
 * `parent` por defecto = el `<main>` de la página (o el body si no hay).
 */
export function instalaIdiomaByo(doc: Document = document): void {
  let lang = idiomaActual(doc.defaultView ?? window);

  const btn = doc.createElement("button");
  btn.type = "button";
  btn.id = "idioma";
  btn.setAttribute("data-testid", "byo-lang");
  // Sin CSS propio en un `<style>` aparte: la pantalla es una sola página y el estilo
  // vive en su `<head>`. Aquí sólo lo mínimo para que no dependa de un selector externo.
  btn.style.cssText =
    "position:fixed;top:12px;right:12px;padding:4px 10px;font:inherit;font-size:.8rem;" +
    "background:#181830;color:#8ab4ff;border:1px solid #555a80;border-radius:6px;cursor:pointer";

  const pinta = (): void => {
    btn.textContent = lang === "es" ? "English" : "Español";
    aplicaIdioma(lang, doc);
  };

  btn.addEventListener("click", () => {
    lang = lang === "es" ? "en" : "es";
    // Se PERSISTE en la clave compartida: la elección hecha aquí también viaja de vuelta
    // a la portada y al juego. El viaje es en los dos sentidos o no es un viaje.
    try {
      doc.defaultView?.localStorage.setItem(CLAVE, lang);
    } catch {
      /* almacenamiento bloqueado: la sesión sigue, sin recordar */
    }
    pinta();
  });

  (doc.querySelector("main") ?? doc.body).appendChild(btn);
  pinta();
}
