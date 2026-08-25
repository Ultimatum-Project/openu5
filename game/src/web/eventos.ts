/**
 * NOMBRES DE EVENTO del embudo, en un solo sitio.
 *
 * El embudo es el único dato que cambia decisiones: dónde se pierde la gente en la
 * mayor fricción del proyecto (traer sus propios ficheros).
 *
 *   portada → /byo → consiente → elige carpeta → extrae → primera partida → juega
 *
 * Constantes y no literales sueltos porque un embudo se rompe MUDO: si un escalón
 * se escribe distinto en el emisor y en el informe, la conversión sale 0 % y parece
 * un problema de producto en vez de una errata. `privacidad-build.mjs` lo defiende:
 * un `evento("literal")` en `game/src` o `demo-byo/src` pone el build ROJO.
 *
 * 🔴 LOS ESCALONES NO SON UNA CADENA DE DENOMINADORES COMUNES, y la lista de arriba se
 * lee mal justamente por parecerlo. Dos de ellos están MEDIDOS SOBRE OTRA POBLACIÓN:
 * `consentimiento_dado` sólo existe cuando la respuesta fue SÍ (un NO no envía nada,
 * por construcción), y `byo_primera_partida` es una TRANSICIÓN de estado del navegador
 * que puede ocurrir en una visita posterior a la que trajo los ficheros. Dividir dos
 * escalones cualesquiera de esta lista no da «la conversión» de nada: cada cifra lleva
 * su población en su propio comentario, y ahí es donde hay que ir a buscarla.
 *
 * NINGÚN evento lleva contenido del juego ni nada que el visitante escribiera: ni
 * nombres de personaje, ni rutas de su disco, ni ids de partida. Los nombres de fichero
 * que sí viajan (en `byo_fuente_invalida`) son los de EA, fijos y públicos.
 */
export const EV = {
  /** Carga de la portada (openu5.org). */
  PORTADA: "portada_vista",
  /** Carga de /byo (el extractor). */
  BYO_VISTO: "byo_visto",
  /**
   * Se ha ELEGIDO en el panel de consentimiento. Lleva `partida` (si además se
   * permitió subir el registro de teclas) y `superficie` (dónde se decidió).
   *
   * 🔴 ESTE ESCALÓN NO TIENE DENOMINADOR, Y NO ES UN DEFECTO QUE ARREGLAR: sólo llega
   * cuando la respuesta fue SÍ, porque un NO no puede enviar un byte — es justo el
   * invariante de `analitica.ts`. Así que **`consentimiento_dado / byo_visto` NO es la
   * tasa de aceptación**: el numerador cuenta a quien aceptó y el denominador a todos
   * los que aceptaron ALGUNA VEZ (incluidas visitas anteriores, porque el permiso se
   * recuerda y no se vuelve a preguntar). Quien divida esas dos cifras publicará un
   * porcentaje que no mide lo que su nombre dice. La cifra que sí se puede leer aquí es
   * el reparto `partida: true/false` DENTRO de quien aceptó.
   */
  CONSENTIMIENTO_DADO: "consentimiento_dado",
  /** Ha elegido una carpeta (o soltado ficheros): el paso más caro del embudo. */
  BYO_CARPETA: "byo_carpeta_elegida",
  /**
   * La carpeta no era un Ultima V completo. Lleva `problemas` (cuántos) y `clase`:
   * `faltan` (hay ficheros AUSENTES) o `tamano` (están todos, pero alguno no mide lo
   * esperado ⇒ otra edición). Son dos abandonos distintos con dos remedios distintos y
   * el embudo no puede fundirlos: uno se arregla eligiendo otra carpeta y el otro no se
   * arregla en absoluto. (El comentario decía `faltan` como nombre del campo y el código
   * enviaba `problemas` desde el principio: manda el código.)
   */
  BYO_FUENTE_INVALIDA: "byo_fuente_invalida",
  /**
   * La carpeta pasó la validación y la extracción ARRANCA. Es el escalón que separa
   * «eligió mal la carpeta» de «eligió bien y el navegador no pudo»: sin él, un
   * abandono durante la extracción (que puede tardar y quemar memoria en un móvil) es
   * indistinguible de no haber llegado nunca a extraer.
   */
  BYO_EXTRACCION_INICIO: "byo_extraccion_iniciada",
  /** Extracción terminada en el navegador. Lleva `assets` y `duracion_ms`. */
  BYO_EXTRACCION_OK: "byo_extraccion_ok",
  /**
   * La extracción reventó. Lleva `motivo` (el mensaje del error, sin nombres de fichero
   * del usuario) y `duracion_ms` — cuánto aguantó antes de reventar, que distingue un
   * rechazo inmediato de una muerte por memoria a mitad de camino.
   */
  BYO_EXTRACCION_FALLO: "byo_extraccion_fallo",
  /** Clic en «Journey Onward»: sale hacia /play. */
  BYO_JUGAR: "byo_jugar",
  /**
   * Este navegador ha pasado de CERO partidas a tener alguna. Se emite en la
   * TRANSICIÓN, no en cada repintado: es «ya hay algo que continuar», el escalón donde
   * la visita deja de ser una prueba y empieza a ser una partida.
   *
   * Lleva `origen`: `momento` (sembrada del catálogo de momentos legendarios) o
   * `propia` (creada jugando). Son dos entradas al producto con dos costes muy
   * distintos y fundirlas borraría justo lo que el catálogo de momentos vino a probar.
   *
   * 🔴 ALCANCE REAL — NO ES «la primera partida de este navegador», y la diferencia
   * cambia lo que la cifra puede afirmar. La transición se observa DENTRO DE UNA CARGA
   * de `/byo`: la primera lectura del almacén sólo fija la línea base (ver
   * `anotaPrimeraPartida` en `demo-byo/src/main.ts`, y ahí está el porqué). Y el ÚNICO
   * escritor del índice es `game/src/core/persistence.ts`, que corre en `/play.html` —
   * OTRO documento. ⇒ una partida creada JUGANDO nunca se ve nacer desde `/byo`: cuando
   * el visitante vuelve ya está ahí y la absorbe la línea base. **El único 0→≥1 que
   * puede ocurrir con `/byo` abierto es el del modal de momentos.** (Medido el
   * 08-08-2026 leyendo los escritores del índice; los otros escalones sí se verificaron
   * en navegador, éste no — hace falta una copia real de EA.)
   *
   * 🔴 Y POR ESO `origen` NO ES DE FIAR, que es peor que si fuera constante. El modal de
   * momentos genera la miniatura arrancando `/play.html` EN UN IFRAME OCULTO
   * (`momentos-instala.ts`, `unIntentoDeShot`) — mismo origen, MISMO `localStorage`— y
   * ahí dentro `autosave()` se dispara con `map-changed` (`game/src/main.ts:1890`)
   * escribiendo una ranura `autosave-N` **sin `provenance`**. Si esa escritura llega
   * antes del repintado, `partidas[0]` —que es la MÁS RECIENTE— es el autosave y esta
   * línea manda `origen: "propia"` para una transición que sembró un momento. NO ESTÁ
   * MEDIDO si `map-changed` llega a dispararse en esa carga: lo que está medido es que
   * el escritor existe, corre en esa ventana y no pone `provenance`.
   *
   * En consecuencia, hoy: el escalón NO se puede leer como «cuánta gente llegó a tener
   * partida», y su `origen` NO se puede repartir en momento/propia hasta medir lo de
   * arriba. Se deja lo aprobado y se declara. Cerrarlo de verdad pide o una línea base
   * PERSISTIDA entre visitas (una clave más en el almacén de la página cuyo asunto es la
   * privacidad) o mirar la ranura que de verdad nació, no la primera de la lista: las dos
   * son decisiones de producto, no arreglos.
   */
  BYO_PRIMERA_PARTIDA: "byo_primera_partida",
  /**
   * Se ha añadido un momento legendario a las partidas de este navegador. Lleva
   * `momento` = el id del catálogo (`m01`…), que es material NUESTRO: el id de un
   * momento prefabricado, no contenido del juego ni nada que el visitante escribiera.
   */
  BYO_MOMENTO_ANADIDO: "byo_momento_anadido",
  /**
   * Se abre una partida concreta desde la lista (el enlace a `/play.html?save=…`).
   * Lleva `origen` (`momento` | `propia`). Último escalón del embudo BYO: el anterior
   * (`byo_jugar`) es «entra al juego», éste es «entra A UNA PARTIDA».
   *
   * NUNCA lleva el id de la partida ni su nombre: los nombres de personaje los inventa
   * el jugador y son suyos (spec, carril 1 · «aviso de privacidad»).
   */
  BYO_PARTIDA_JUGADA: "byo_partida_jugada",
  /** El juego ha arrancado de verdad en /play (último escalón). */
  JUEGO_ARRANCADO: "juego_arrancado",
  /** Se completa la creación de personaje en The Summoning. */
  PERSONAJE_CREADO: "character_created",
  /** Se restaura la última partida desde Journey Onward. */
  VIAJE_REANUDADO: "journey_resumed",
  /** El autoguardado de Quit & Save termina correctamente. */
  JUEGO_GUARDADO: "game_saved",
  /** Se crea correctamente una partida manual. */
  GUARDADO_MANUAL_CREADO: "manual_save_created",
  /** Se carga correctamente una partida desde el panel. */
  GUARDADO_CARGADO: "save_loaded",
  /** Se elimina una partida desde el panel. */
  GUARDADO_ELIMINADO: "save_deleted",
  /** Se importa correctamente una partida desde un fichero. */
  GUARDADO_IMPORTADO: "save_imported",
  /** Se exporta una copia de una partida. */
  GUARDADO_EXPORTADO: "save_exported",
} as const;

export type NombreEvento = (typeof EV)[keyof typeof EV];
