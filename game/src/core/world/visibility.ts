/**
 * VISIBILIDAD / LÍNEA DE VISIÓN de la ventana 11×11 — derivada del kernel del
 * original (ULTIMA.EXE). Decide qué casillas de la ventana de juego se PINTAN y
 * cuáles quedan a NEGRO (fuera del radio de luz o tras un muro opaco). Es
 * información de JUEGO (regla dura #2 de la interview): se aplica en el CORE, en
 * el snapshot, nunca en la piel.
 *
 * CADENA EN EL ORIGINAL (citas re/disasm/ULTIMA.EXE.asm):
 *   0x5910  redibujo de la ventana 11×11 (por turno).            :9528
 *   0x5D0A  construye el buffer de ventana; recibe g_light_level  :9880
 *           como RADIO y lo incrementa en 1 al entrar en 0x5A28.
 *   0x5A28  FLOOD-FILL BFS luz↔negro (NO es un shadowcast por      :9632
 *           octantes): inunda desde el centro (la party). Por cada celda:
 *             · radio:   0x6FF0 (distancia radial) < light+1      :5bd6/5bd9
 *                        (inc en 0x5a66 → umbral efectivo light+1,
 *                         i.e. VISIBLE ⇔ radial ≤ light_level).
 *             · una celda DENTRO del radio se ilumina; sólo PROPAGA la
 *               inundación si es transparente (0x5DFE, :9977; devuelve 1 =
 *               DEJA PASAR — 0x402 es memchr y 5e23-5e2a mapean hallado→0) —
 *               un muro se ve pero corta el avance (`or ax,ax; je` en 0x5cb7).
 *               FUERA del radio la transparente propaga AUNQUE quede oculta
 *               (#350-resplandor: 5c74 escribe 0 sin tocar [bp-0x214], y el
 *               push decide sobre el TILE) — ver `floodFOV`.
 *             · el AVANCE es MOORE 8-conectado (tabla de saltos 5aec-5b26: 8
 *               entradas, `5af0 cmp ax,7`; el acumulador de coords NO se resetea
 *               entre las 8 direcciones ⇒ traza el PERÍMETRO del padre, las 4
 *               diagonales incluidas). Cada diagonal se evalúa con el MISMO test
 *               radio/opacidad que un cardinal: NO hay gate de flancos. El modelo
 *               "cardinal / AND-de-flancos" del review de E1-S2 quedó REFUTADO por
 *               tercera lectura + witness DOSBox (re/notes/flood-adjudication.md,
 *               task #23): el original REVELA la rendija diagonal (corte de esquina).
 *             · (el bloque 5c19-5c45 NO es el corte de esquina: es la consulta a
 *               0xAD14 — ver CLASE abajo. La relación es RECÍPROCA: el pase de
 *               luces escribe en g_vis_buffer, ver NO MODELADO abajo.)
 *             · SELECTOR DE MODO (#189/#219): 0x5A28 sirve a las DOS pasadas y el
 *               modo NO se pasa como argumento — es el local [bp-0x20e], que nace
 *               a cero (5a48) y sube a uno (5a62) sólo cuando el 4º argumento
 *               llega con el CENTINELA 0xff91 (5a57), que además se sustituye por
 *               cero (5a5d). Modo 1 = pase de la party (destino 0xAB02, origen
 *               (0,0)); modo 0 = pase de luces (destino 0xAD14, origen emisor−5).
 *               [bp+6] (=32) es argumento MUERTO: el paso lo fija el `shl` de 5
 *               cableado (5b4f, 5b6a, 5c09, 5c20, 5c37, 5c85), no ese valor.
 *   0x50A1  recalcula g_light_level (radio 2..50) por hora/       :8727
 *           antorcha/hechizo → world/survival.ts::lightLevel.
 *
 * TABLAS (DATA.OVL, verificadas byte a byte; shift DS→file = +0x10):
 *   · radial 6×6 (0x6AA8 / file 0x6AB8, 36 bytes) — RADIAL_DISTANCE.
 *   · opacidad (0x6A86 / file 0x6A96, 19 bytes)   — ALWAYS_OPAQUE.
 *   · rampa alba/ocaso (0x6A80) — ya en survival.ts::SUNRISE_LIGHT_RAMP.
 *
 * CLASE DE EVIDENCIA:
 *   · Radio (radial≤light) + tabla radial + rampa de luz: CLASE A (asm+DATA.OVL).
 *   · Tabla de opacidad + tiles con visor: CLASE A (asm+DATA.OVL). Ver
 *     ALWAYS_OPAQUE / WINDOWED_TILES.
 *   · Propagación: FLOOD-FILL MOORE 8-conectado (diagonales SIN gate de flancos),
 *     derivado de 0x5A28 y confirmado por witness DOSBox (adjudicación #23). NO es
 *     ni la Bresenham del primer intento (revelaba a través de esquinas) ni el
 *     cardinal/AND-de-flancos del review de E1-S2 (sub-revelaba la rendija
 *     diagonal): es el perímetro de 8 vecinos, cada uno con su test radio/opacidad.
 *   · FUENTES DE LUZ ambientales (tabla 0x6A9A + 0x5E4A): cada emisor corre su
 *     propio flood 0x5A28 (radio 10) hacia el buffer 0xAD14, que el pase de la
 *     party CONSULTA en 5c19-5c45 (xrefs 0x5e4a/0x5f53/0x5f65). Portadas como
 *     halos de radio 10 con LOS propia, unidos al FOV de la party (ver
 *     computeVisibleWindow). El merge con 0xAD14 está CALCADO (#256 el padre en
 *     la opaca, #350-resplandor las ramas corregidas + encolado de ocultas) y
 *     careado contra la RAM de DOSBox celda a celda (726/726,
 *     tests/visibility-resplandor-350.test.ts). El HAZ DEL FARO
 *     (0x2A) es mecánica aparte — estampa sus celdas en el MISMO 0xAD14 (0x7091,
 *     tabla 0x1f7e) y desde #326 está PORTADO: core/world/lighthouse.ts calcula
 *     la cuña y computeVisibleWindow la fusiona vía `beamLit`.
 *
 * QUÉ ES 0xAD14 (adjudicado en #219, re/notes/deriv-219-acta.md §1-§3):
 *   NO es un «buffer de fuentes de luz» — eso nombra la ENTRADA del cálculo. Su
 *   CONTENIDO son las celdas ILUMINADAS del chunk 32x32 (valor de tile donde llega
 *   la luz, 0 donde no: el post-pase 0x5f65-0x5f78 convierte 0xFF en 0x00, que es
 *   la convención que consultan 5c29/5c40/5c8c). Extensión direccionable 1024 B
 *   (índice (fila<<5)+col acotado a 0..31 en 0x5b7e/0x5c6a/0x5c6f). ★ Y la MISMA
 *   dirección es, con g_location >= 0x80, el registro de mapa .CBT de 352 B
 *   (g_cbt_room_record): dos dueños EXCLUYENTES POR FASE, discriminados por el
 *   mismo predicado en 0x4408 (tile_addr), 0x5947 y 0x5954.
 *   🔴 LO QUE HAY QUE COMPROBAR ANTES DE USAR ESTA DIRECCIÓN, y que #256 tuvo que adjudicar
 *   porque la ficha llegó con la contradicción de sujeto abierta («¿buffer de luces o buffer
 *   de TILES?»): que la rama que te importa caiga del lado bueno del discriminante. Aquí
 *   cae. El pase de la party —y con él las consultas a 0xAD14 de 5c05-5c45/5c8c (el
 *   test del padre de la opaca y la propia-sola de la transparente)— sólo es alcanzable con
 *   g_location < 0x80, porque su único llamador (0x5D0A) cuelga de la rama `jb` de 5954; en
 *   régimen ALTO, 5947 se salta el barrido de emisores y 5954 se va a 59f8 a copiar 352 B de
 *   0xAD14 a 0xAB02 (11 filas × 32 de zancada). En TODA fase en la que el puente se ejecuta,
 *   0xAD14 ES el buffer de luces. ★ Dos lecturas de la MISMA dirección no se refutan
 *   mientras exista el discriminante que las separa — buscarlo va antes de declarar errata
 *   (acta §0).
 *
 * DERIVADO ENTERO Y NO CALCADO A PROPÓSITO (#220 → #256, adjudicado el 16-08). Estas dos
 * NO son un hueco silencioso ni una mecánica a medio leer: el mecanismo está completo, y
 * la razón de no calcarlo es una DECISIÓN, escrita abajo con su precio.
 *   (a) LA ESCRITURA DE VUELTA. El pase de luces no sólo lee g_vis_buffer: lo PONE
 *       A CERO celda a celda (0x5b89 `mov byte ptr [bx+di-0x54fe], 0`). En el
 *       original eso es la marca de VISITADO del propio pase de luces —el llamador
 *       re-siembra las 121 celdas a 0xFF ANTES DE CADA EMISOR (0x5f23-0x5f3d,
 *       dentro del bucle 5efe..5f63)—, y el brazo de la party necesita esa marca
 *       aparte porque su dedupe (5b90 `cmp byte ptr [si],0xff`) mira el destino, y
 *       el destino del pase de luces ACUMULA entre emisores.
 *   (b) EL PROTOCOLO DE DOS RAMAS del repintado, que es lo que hace observable a
 *       (a): 0x5910 reparte por g_unk_24e6 (595e) entre RECÁLCULO (5987 → 0x5D0A,
 *       que re-siembra las 121 celdas a 0xFF y floodea) e INCREMENTAL
 *       (5992-59f4), que recorre las 121 y SÓLO reescribe con terreno crudo LAS
 *       QUE VALEN CERO (59ad) — es decir, exactamente las que el pase de luces
 *       acaba de marcar en el MISMO fotograma. Y el índice del borrado NO lleva el
 *       origen (5b83-5b89 usa (a<<5)+b, sin [bp+0xa]/[bp+8]), así que los ceros del
 *       ÚLTIMO emisor caen en coordenadas locales de la ventana.
 *   ★ LA PIEZA QUE FALTABA PARA CERRARLO (leída el 16-08): después del flood, 0x5D0A
 *   RECORRE LAS 121 Y CONVIERTE LOS CEROS EN 0xFF (5d76-5d8a `cmp byte ptr [si],0;
 *   jne; dec byte ptr [si]`). Es decir: tras un RECÁLCULO no queda NI UN CERO en
 *   g_vis_buffer. ⇒ el `== 0` de la rama incremental (59ad) no puede casar con nada que
 *   haya escrito el pase de la party: **la única fuente de ceros del sistema es 5b89**,
 *   el rastro de visitados del ÚLTIMO emisor. Un fotograma incremental repinta con
 *   terreno crudo justo esa huella, y como su índice no lleva el origen, la huella cae
 *   en coordenadas de la VENTANA aunque el emisor esté en la otra punta del chunk.
 *   ALCANZABILIDAD, que era lo que faltaba para adjudicar: la rama incremental NO es
 *   un caso raro. `0x10d0` llama a 0x5910 **32 veces por invocación** (bucle 0x1070,
 *   `test di,7` cada 8 vueltas del driver de sonido) sin ningún evento de juego en
 *   medio; g_unk_24e6 se pone a 0 en el primer recálculo (598a), así que 31 de esas 32
 *   pasadas van por la rama incremental. Las esperas animadas del original enseñan esa
 *   huella, y el siguiente recálculo la borra.
 *   ⇒ DIRECCIÓN: en los fotogramas incrementales el original revela ALGUNAS celdas MÁS,
 *   y las revela EN EL SITIO EQUIVOCADO — la forma del halo del último emisor estampada
 *   sobre la ventana de la party.
 *   🔴 DECISIÓN (#256, con la directriz del usuario del 05-08 sobre bugs claros del
 *   original: se arreglan y se REGISTRAN): NO SE CALCA. No es una mecánica que el port
 *   se deje: es un DEFECTO del original —un buffer de trabajo compartido entre dos pases
 *   con dos convenciones de índice distintas dentro de la MISMA rutina (5b48-5b5c indexa
 *   CON origen, 5b83-5b89 SIN él)— y calcarlo costaría meter estado mutable entre
 *   fotogramas en un módulo que hoy es una función pura, más el reparto por g_unk_24e6,
 *   para reproducir un parpadeo de terreno mal colocado. Queda en docs/bugs-del-original.md.
 *   Lo que sí se calca de esta familia es el PUENTE, que es mecánica y no defecto: ver
 *   `floodFOV` y la nota de más abajo.
 *
 * 🔴 «EL PORT SE QUEDA CORTO, NUNCA LARGO»: REFUTADO POR MEDICIÓN (14-08). Esa
 * generalización acompañaba al bloque de arriba desde #219/#220 y era FALSA — y lo
 * era ya ANTES de #252, así que no la rompió ningún fix: nunca fue cierta. La
 * atribución de (a) y (b) a #219/#220 no se mueve; lo que se fecha aquí es la
 * refutación, medida contra un modelo del pase de la party del binario transcrito
 * de 0x5A28 (la transcripción en `tests/visibility-original-referencia.model.ts`; sus
 * controles y la tabla de las 12 filas, en el `.test.ts` hermano):
 *   · ANTES de #252 el port revelaba hasta 3824 celdas·posición MÁS que el original
 *     (sótano de LB, luz 2; Cove 3683; la sala sintética 1164).
 *   · DESPUÉS de #252 el lado corto se cierra POR COMPLETO — sub-revelado 0 en las
 *     doce filas medidas: lo que el port revela es SUPERCONJUNTO de lo del original.
 *     Y el sobre-revelado BAJA en los tres mapas reales (a CERO en el sótano de
 *     Blackthorn, donde el port es hoy exactamente el original).
 *   · La causa ÚNICA del sobre-revelado que quedaba era EL PUENTE: fuera del radio de
 *     la party, 0x5A28 exige en 5c29 que el PADRE de la celda esté marcado en el buffer
 *     de luces 0xAD14, no que esté meramente dentro del radio. Este fichero aceptaba
 *     como puente cualquier celda del disco de la party ⇒ enseñaba de más donde el
 *     original corta.
 *   ✅ CALCADO EL 16-08 (#256, ver `floodFOV`). Con el puente dentro, la misma sonda
 *     sobre los mismos tres mapas reales da sobre = 0 Y sub = 0 en las 1024 posiciones
 *     de cada mapa × los CINCO regímenes de luz: el port ES el pase de la party del
 *     original, ya no un superconjunto suyo. El peor caso que se cerró: sótano de LB,
 *     party en (22,24) con luz 2 — 11 casillas visibles en el original, 65 en el port.
 *     ⇒ de las TRES omisiones de la tanda, ésta era la única que era MECÁNICA; las otras
 *     dos son un defecto del original y quedan declaradas arriba con su razón.
 *   ✅✅ RE-DERIVADO EL 20-08 (#350-resplandor): la lectura de #256 era la verdad del
 *     régimen de CONTACTO pero tenía las dos ramas de fuera-del-radio intercambiadas
 *     (polaridad de 0x5DFE) y le faltaba el encolado de las ocultas — a DISTANCIA el
 *     original revela ADEMÁS los suelos iluminados alcanzables cruzando la oscuridad
 *     (34 celdas medidas en RAM por #350 que aquel «sobre = 0 Y sub = 0» no podía ver:
 *     su modelo llevaba la misma lectura). Derivación, validación 726/726 contra RAM y
 *     calco: re/notes/resplandor-350-derivacion.md + `floodFOV`.
 * ★★ La lección de instrumento, para quien escriba la próxima línea de este bloque:
 * una dirección declarada («nunca largo») es una AFIRMACIÓN MEDIBLE, no una glosa
 * tranquilizadora. Ésta sobrevivió meses porque nadie tenía con qué carearla; el
 * modelo de referencia existe precisamente para que la siguiente no dure tanto. Y su
 * segunda edición (#350): cuando modelo y port COMPARTEN una lectura, su careo mide
 * cero aunque la lectura esté mal — el careo que discrimina es contra la RAM del
 * binario corriendo, y el testigo de #350 existió porque un aserto empírico seguía
 * pendiente (acta #256 §5).
 *
 * EL BARRIDO DE EMISORES ES DEL MAPA, NO DEL ENCUADRE (#252, reporte del usuario
 * «¿las antorchas no deberían iluminar aunque no estén en pantalla?»):
 *   0x5E4A recorre el CHUNK ENTERO 32x32 en coordenadas de MAPA (5e72-5ee9:
 *   `cmp si,0x20` sobre la columna y `cmp [bp-6],0x20` sobre la fila; la celda se
 *   pide con `g_chunk_origin_x + col` / `g_chunk_origin_y + fila` a 0x4402 en
 *   5e78-5e8c), apunta cada emisor en una lista local, y sólo DESPUÉS (5efe-5f63)
 *   corre un flood por emisor con origen `emisor − 5` (5f09/5f1d `sub ax,5`) y
 *   radio 10 (5f3f `mov ax,0xa`). La ventana 11x11 de la party NO entra en ese
 *   barrido en ningún punto: dónde esté el Avatar no cambia qué antorchas emiten.
 *   ⇒ este fichero barre `[-EMITTER_REACH, WINDOW-1+EMITTER_REACH]` en
 *   coordenadas de VENTANA, que es la envolvente exacta de los emisores capaces
 *   de tocar una celda del encuadre (ver EMITTER_REACH), y corre el flood de cada
 *   uno en SU PROPIO marco 11x11 centrado en él, como el `emisor − 5` del binario.
 *   Hasta el 14-08 el barrido era sólo de la ventana: una antorcha a UNA casilla
 *   del borde dejaba de contar entera, y el usuario veía la luz dar un salto al
 *   andar. Medido en la sonda de `visibility.test.ts` (§ «emisor FUERA del
 *   encuadre»): 22 celdas del encuadre se apagaban de golpe en un solo paso.
 */

/** Lado de la ventana de juego (11×11). Espejo local de VIEW_WINDOW (core no importa skin). */
export const WINDOW = 11;
/** Centro de la ventana (la party siempre en 5,5). */
export const CENTER = 5;

/**
 * Tabla radial 6×6 (DATA.OVL 0x6AB8, 36 bytes) indexada por
 * `fold(col) + 6·fold(row)`. Es la distancia radial (≈ dcol²+drow²) que 0x6FF0
 * devuelve y 0x5A28 compara con el radio. Centro=0, esquina=50.
 */
const RADIAL_DISTANCE: readonly number[] = [
  50, 41, 34, 29, 26, 25,
  41, 32, 25, 20, 17, 16,
  34, 25, 18, 13, 10, 9,
  29, 20, 13, 8, 5, 4,
  26, 17, 10, 5, 2, 1,
  25, 16, 9, 4, 1, 0,
];

/**
 * Tiles SIEMPRE opacos a la vista (DATA.OVL 0x6A86, 19 bytes). El original los
 * busca en la tabla (0x5DFE → 0x402) y, si están, la casilla corta la luz —
 * bosques/montañas en el exterior; muros, puertas SIN visor (0x97/0xB8/0xB9),
 * estanterías, chimeneas, structuras de esquina en interior.
 */
export const ALWAYS_OPAQUE: ReadonlySet<number> = new Set([
  0x09, 0x0a, 0x0c, 0x0d, 0x4d, 0x4e, 0x4f, 0x5a, 0x97, 0xb8, 0xb9, 0xbc, 0xd0,
  0xd1, 0xd2, 0xd3, 0xf8, 0xfe, 0xff,
]);

/**
 * Tiles CON VISOR — los 5 casos especiales de 0x5DFE (5e01-5e1d). El original
 * deja ver a través de ellos SÓLO cuando la casilla está a distancia radial 1 de
 * la party (adyacente): `cmp [bp+4],1` (5e1f), con [bp+4] = valor radial de la
 * PROPIA casilla (0x6FF0, empujado en 5bfd) → == 1 transparente, si no opaca.
 * Pegado al visor ves lo de detrás; de más lejos, tapa.
 *
 * Dos subgrupos (misma rama del asm, distinto significado semántico):
 *   · Puertas-vista 0xBA/0xBB/0x98 (RegularDoorView/LockedDoorView/
 *     MagicLockDoorWithView): variantes ventana de puerta; abiertas son otro
 *     tile (0x44 OPEN_DOOR_SUBSTITUTE), así que estas ids sólo aparecen cerradas.
 *   · Ventanas 0x4A/0x4B (StoneCrossWindow/StoneGlassWindow): muros decorativos
 *     con ventana, no son puertas (IsOpenable:false).
 *
 * OJO auditoría: TileData.json (dataset Ultima5Redux, evidencia Clase D) marca
 * 0x4A/0x4B como BlocksLight incondicional. El BINARIO (0x5DFE, Clase A) los
 * mete en el mismo caso radial-1 que las puertas-vista → mandan las citas del
 * asm sobre el dato de terceros (contrato de fidelidad L0/L3).
 */
const WINDOWED_TILES: ReadonlySet<number> = new Set([0x4a, 0x4b, 0xba, 0xbb, 0x98]);

/**
 * ¿La casilla corta la línea de visión? (0x5DFE). `radial` = distancia radial de
 * la PROPIA casilla a la party (0x6FF0): los tiles con visor sólo dejan ver a
 * través cuando radial == 1 (adyacentes); el resto de opacos no dependen del radial.
 */
export function isSightBlocking(tile: number, radial: number): boolean {
  const t = tile & 0xff;
  if (ALWAYS_OPAQUE.has(t)) return true;
  if (WINDOWED_TILES.has(t)) return radial !== 1; // visor: transparente sólo pegado
  return false;
}

/**
 * Tiles que EMITEN luz ambiental (DATA.OVL 0x6A9A / file 0x6AAA, 10 bytes). El
 * original (0x475A→0x5E4A) escanea el chunk buscándolos y por CADA uno corre el
 * mismo flood 0x5A28 con radio 0x0A (10) hacia el buffer 0xAD14, que el pase de
 * la party consulta (5c29/5c40). Antorchas de pared (RightSconce 0xB0 /
 * LeftSconce 0xB1), braseros, hogueras, chimeneas, lámparas y el moongate.
 * Clase A (asm + DATA.OVL). NO incluye el HAZ DEL FARO (0x2A), mecánica aparte
 * (portada en #326: core/world/lighthouse.ts, fusionada vía `beamLit`).
 */
export const EMITTER_TILES: ReadonlySet<number> = new Set([
  0xdc, 0xbd, 0xbe, 0xb2, 0xde, 0xbf, 0xb0, 0xb1, 0xb3, 0xbc,
]);

/** Radio del halo de una fuente de luz (0x5E4A → 0x5A28 con `mov ax,0xa`, 5f3f). */
const EMITTER_LIGHT_RADIUS = 10;

/**
 * Cuántas casillas MÁS ALLÁ del encuadre hay que barrer buscando emisores (#252).
 *
 * El original no acota nada: barre el chunk 32x32 entero (0x5E4A, ver cabecera).
 * Pero un emisor sólo puede tocar una celda si su distancia RADIAL a ella es
 * ≤ EMITTER_LIGHT_RADIUS, y el mayor desplazamiento cardinal que cumple eso es la
 * cota que se calcula aquí — con la MISMA tabla radial que usa el flood, no con un
 * literal: si el radio del halo o la tabla cambiasen, esta cota les sigue.
 * Barrer `[-EMITTER_REACH, WINDOW-1+EMITTER_REACH]` es por tanto EQUIVALENTE al
 * barrido de chunk entero para todo lo que se ve en la ventana, y no lo aproxima:
 * un emisor más lejos no puede marcar ninguna celda del encuadre.
 */
export const EMITTER_REACH: number = ((): number => {
  let reach = 0;
  while (reach < CENTER && radialOffset(reach + 1, 0) <= EMITTER_LIGHT_RADIUS) reach++;
  return reach;
})();

/**
 * Valor radial (0x6FF0) para offsets absolutos (adx,ady) desde un centro: indexa
 * la tabla 6×6 (= adx²+ady²). Offset > 5 (fuera de la 6×6) → 51 = mayor que
 * cualquier radio (máx 50), i.e. fuera de alcance.
 */
function radialOffset(adx: number, ady: number): number {
  if (adx > CENTER || ady > CENTER) return 51;
  return RADIAL_DISTANCE[CENTER - adx + 6 * (CENTER - ady)]!;
}

/**
 * Distancia radial de la celda (col,row) a la party en el centro de la ventana
 * (0x6FF0): pliega cada eje al cuadrante e indexa la tabla 6×6.
 */
export function radialDistance(col: number, row: number): number {
  return radialOffset(Math.abs(col - CENTER), Math.abs(row - CENTER));
}

/**
 * Las 8 direcciones de vecindad, EN EL ORDEN DEL BINARIO: el recorrido de PERÍMETRO que
 * sale de la tabla de saltos de 0x5A28 (bytes 5b16-5b25, ocho entradas de 2 B) recorrida
 * con el contador [bp-0x216] de 7 a 0 (5cdb `dec`, 5ce5 `cmp …,-1`). Cada entrada mueve
 * UNA coordenada del acumulador, que NO se resetea entre direcciones:
 *   idx7 5afe dec col → O · idx6 5b10 inc row → SO · idx5 5b04 inc col → S ·
 *   idx4 5b04 inc col → SE · idx3 5b0a dec row → E · idx2 5b0a dec row → NE ·
 *   idx1 5afe dec col → N · idx0 5afe dec col → NO.
 * El conjunto alcanzable no depende de este orden (ver `floodFOV`), pero se calca igual
 * porque es gratis: y así el modelo de referencia —que recorre los 8 vecinos en OTRO orden,
 * ver `tests/visibility-original-referencia.model.ts`— pasa a ser también el control de esa
 * independencia, en los asertos de igualdad del `.test.ts` hermano.
 */
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [-1, 0], [-1, 1], [0, 1], [1, 1],
  [1, 0], [1, -1], [0, -1], [-1, -1],
];

/**
 * FLOOD-FILL genérico de 0x5A28 desde un centro (cc,cr) con un radio `light`.
 * Cada celda alcanzada cae en UNA de estas tres ramas del binario, en este orden:
 *
 *   · DENTRO del radio (5bd9 `cmp ax,[bp+0x10]`, umbral light+1 por el `inc` de 5a66):
 *     visible siempre, y propaga si es transparente — un muro se ve pero corta.
 *   · FUERA del radio y TRANSPARENTE (5c52-5c91): visible ⟺ la PROPIA celda está
 *     marcada en el buffer de luces 0xAD14 (5c8c), SIN mirar al padre; si no, 5c74 la
 *     deja OCULTA. Decidida en los dos sentidos — y PROPAGA EN AMBOS: el push
 *     (5ca1-5cd8) evalúa 0x5DFE sobre [bp-0x214], que 5c74 no toca y conserva el TILE
 *     transparente ⇒ la celda oculta se encola igual. Éste es el RESPLANDOR A
 *     DISTANCIA (#350-resplandor): el flood recorre la región transparente alcanzable
 *     aunque esté a oscuras y enciende por sí sola cada celda iluminada que toca.
 *   · FUERA del radio y OPACA (5c05-5c45): visible ⟺ el PADRE es visible (5c14, byte
 *     ≠ 0 en g_vis_buffer) **Y el PADRE está en 0xAD14** (5c29) Y la PROPIA está en
 *     0xAD14 (5c40). Si falla cualquiera de las tres, 5c47 escribe 0xFF, que es el
 *     centinela de NO DECIDIDA — no de oculta: la celda vuelve a intentarse desde OTRO
 *     vecino. Sólo 5c74 (0) y 5c93 (el tile) deciden. Nunca propaga (0xFF y los muros
 *     están en la tabla de opacas y el push los descarta).
 *
 * 🔴 EL PADRE (ficha #256, calcado el 16-08; RE-DERIVADO en #350-resplandor, 20-08 —
 * re/notes/resplandor-350-derivacion.md). La historia en dos actos, porque las cifras
 * de ambos siguen siendo ciertas en su régimen:
 *   · #256 refutó la regla sin-padre de E1 (aceptaba de puente cualquier celda del
 *     disco: hasta 54/121 casillas de más en una posición del sótano de LB, 1649
 *     celdas·posición allí y 1086 en Cove) y quedó acreditado EMPÍRICAMENTE en
 *     régimen de CONTACTO por el testigo de #350 (px≥21: coincidencia celda a celda,
 *     363 celdas, tres posiciones).
 *   · #350 midió que A DISTANCIA el original revela ADEMÁS parte del halo (34 celdas,
 *     cota estricta ⊆ 0xAD14, jamás sub-revelado) y la derivación lo cerró: la
 *     lectura de #256 tenía las dos ramas de fuera-del-radio INTERCAMBIADAS (la
 *     polaridad de 0x5DFE es 1 = deja pasar: 0x402 es memchr y 0x5DFE mapea
 *     hallado→0/no-hallado→1, 5e23-5e2a) y le faltaba el encolado de las ocultas.
 *     En contacto ambas lecturas coinciden — por eso la sonda de 15.360 posiciones
 *     no podía verlo y sólo lo delató el islote a distancia.
 * La condición del PADRE vive hoy en la rama OPACA: un muro iluminado sólo se enciende
 * desde un vecino de cola visible E iluminado. La consecuencia semántica para el
 * jugador: una sala con antorchas RESPLANDECE desde lejos —sus SUELOS iluminados se
 * ven cruzando la oscuridad—, y sus MUROS se encienden cuando el paseo llega con un
 * padre iluminado; de día (radio 50) nada de esto se ejecuta y las dos lecturas
 * coinciden. Careo con la RAM de DOSBox: 726/726 celdas-posición sin un solo
 * mismatch (`tests/visibility-resplandor-350.test.ts`, esperados EN CRUDO).
 *
 * Los TRES estados son necesarios, no un lujo: sin distinguir NO DECIDIDA de OCULTA,
 * la primera visita de un muro que falla el test del padre lo cerraría para siempre y
 * el reintento de 5c47 se perdería (medido: 69 celdas en la sala de #252, test de
 * referencia).
 *
 * MOORE 8-conectado sin gate de flancos: cada uno de los 8 vecinos (las 4 diagonales
 * incluidas) se evalúa con el MISMO test radio/opacidad que un cardinal — el binario NO
 * gatea la diagonal (adjudicación #23, witness DOSBox: `5af0 cmp ax,7` = 8 entradas;
 * acumulador de coords sin reset = perímetro). El conjunto alcanzable NO depende del
 * orden del anillo: la región transparente ENCOLADA es el componente 8-conexo del
 * centro (cada transparente se decide y encola en su primera visita, sin condición de
 * padre), la transparente decide por sí sola, la opaca visible ⟺ ∃ vecino transparente
 * del componente visible+iluminado (el reintento de 5c47 hace la existencial efectiva)
 * — el mismo punto fijo se recorra en el orden que se recorra.
 *
 * La opacidad usa el radial de la PROPIA celda respecto a (cc,cr) — para los tiles con
 * visor (0x5DFE), que dependen de estar a radial 1. Un visor fuera de radial 1 cae en
 * la rama OPACA y no empuja jamás.
 */
function floodFOV(
  cc: number,
  cr: number,
  light: number,
  terrainAt: (col: number, row: number) => number,
  isIlluminated?: (col: number, row: number) => boolean,
  paseParty = false,
): Uint8Array {
  const UNDECIDED = 0, HIDDEN = 1, VISIBLE = 2;
  const st = new Uint8Array(WINDOW * WINDOW); // nace UNDECIDED = el 0xFF de 5d17-5d27
  const radialFrom = (col: number, row: number): number =>
    radialOffset(Math.abs(col - cc), Math.abs(row - cr));
  const blocks = (col: number, row: number): boolean =>
    isSightBlocking(terrainAt(col, row), radialFrom(col, row));
  const enBuffer = (col: number, row: number): boolean =>
    isIlluminated?.(col, row) ?? false;

  const queue: number[] = [cr * WINDOW + cc];
  st[queue[0]!] = VISIBLE;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    const cx = cur % WINDOW;
    const cy = (cur - cx) / WINDOW;
    // 5c14/5c29: el PADRE (copia fija de la celda desencolada, [bp-0x208]/[bp-0x206]):
    // su byte en g_vis_buffer (≠0 ⟺ VISIBLE: toda celda encolada quedó decidida en la
    // visita que la empujó, jamás en 0xFF) y su bit en el buffer de luces 0xAD14.
    const padreVisible = st[cur] === VISIBLE;
    const padreEnBuffer = enBuffer(cx, cy);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= WINDOW || ny >= WINDOW) continue;
      const ni = ny * WINDOW + nx;
      if (st[ni] !== UNDECIDED) continue; // 5b90 `cmp byte ptr [si],0xff`
      if (radialFrom(nx, ny) <= light) {
        st[ni] = VISIBLE; // 5c93: se pinta con su tile aunque sea muro
        if (!blocks(nx, ny)) queue.push(ni);
        continue;
      }
      // MODO 0 (pase de un emisor): fuera del radio no se escribe ni se empuja
      // (5be1 `cmp [bp-0x20e],0` → 5c9c fija [bp-0x214]=0xFF, que el push
      // descarta). El pase de la PARTY es modo 1 SIEMPRE (centinela 0xff91),
      // CON O SIN emisores: el paseo por ocultas de abajo puede RODEAR un muro
      // saliendo del disco y RE-ENTRAR (la evaluación dentro-del-radio de 5bd9
      // no mira al padre) — con el buffer vacío eso también revela, así que
      // modo-1-sin-emisores NO equivale a modo 0 (lo midió el control «muros y
      // sin emisores» del test de referencia en el calco de #350-resplandor).
      if (!paseParty) continue;
      if (!blocks(nx, ny)) {
        // 5c52-5c91: TRANSPARENTE fuera del radio — visible ⟺ la PROPIA celda está
        // en el buffer de luces (5c8c), SIN mirar al padre; si no, 5c74 escribe 0 =
        // OCULTA (decidida: el gate no la re-evalúa)…
        st[ni] = enBuffer(nx, ny) ? VISIBLE : HIDDEN;
        // …pero SE ENCOLA IGUAL: el push (5ca1-5cd8) decide con 0x5DFE sobre
        // [bp-0x214], que 5c74 NO toca — conserva el TILE transparente. Éste es el
        // encolador del RESPLANDOR A DISTANCIA (derivación de #350): el flood
        // recorre la región transparente alcanzable AUNQUE ESTÉ A OSCURAS y cada
        // celda iluminada que toca se enciende por sí sola.
        queue.push(ni);
        continue;
      }
      // 5c05-5c45: OPACA fuera del radio — visible ⟺ padre≠0 (5c14) Y padre en el
      // buffer (5c29) Y propia en el buffer (5c40). Si falla: 5c47 re-escribe 0xFF
      // (UNDECIDED, reintentable desde otro vecino) y no empuja (0xFF está en la
      // tabla de opacas y el push lo descarta).
      if (padreVisible && padreEnBuffer && enBuffer(nx, ny)) st[ni] = VISIBLE;
    }
  }
  return st.map((v) => (v === VISIBLE ? 1 : 0));
}

/**
 * Máscara de visibilidad de la ventana 11×11 (row-major, 1=visible / 0=negro):
 * el FOV de la party (flood radio `lightLevel` desde el centro) MÁS los halos de
 * las FUENTES DE LUZ ambientales visibles (antorchas de pared, braseros… tabla
 * 0x6A9A): cada emisor proyecta su propio disco de radio 10 con LOS propia
 * (0x5E4A → 0x5A28 radio 10 → buffer 0xAD14, que el pase de la party consulta).
 *
 * Modelo del merge (#350-resplandor, re-derivado — ver `floodFOV`): el paseo de la
 * party recorre TODA la región transparente 8-conexa alcanzable del encuadre, a
 * oscuras incluida, y una casilla del halo de un emisor se enciende:
 *   · TRANSPARENTE (suelo): por sí sola, con estar iluminada y ser alcanzable (5c8c,
 *     sin condición de padre).
 *   · OPACA (muro): sólo desde un vecino de cola visible E iluminado (5c14/5c29/5c40).
 * La consecuencia semántica, que es la que hay que tener en la cabeza al mirar una
 * captura: **una sala iluminada al fondo de un pasillo oscuro RESPLANDECE desde
 * lejos** — se ven sus suelos iluminados (parcialmente, lo que el encuadre y la
 * conectividad alcancen) ANTES de que el halo toque tu disco; al acercarte, los muros
 * iluminados se van sumando cuando el paseo les llega con padre iluminado. Lo que
 * sigue siendo verdad: una antorcha NO revela una sala sellada al otro lado de un
 * muro (los muros no propagan el paseo, cruce de esquinas Moore incluido).
 * 🔴 Lo que este párrafo decía hasta el 14-08 —«conservador: nunca revelar más que
 * el original»— es la generalización REFUTADA por medición; ver la cabecera. Y lo que
 * dijo del 16-08 al 20-08 —«el halo sólo extiende tu visión si TOCA tu propio
 * disco»— era la MISMA brecha vista desde el otro lado: cierta en contacto, falsa a
 * distancia (las 34 celdas de #350). Desde #350-resplandor el port coincide con la
 * RAM del original celda a celda en las 726 celdas-posición medidas
 * (`tests/visibility-resplandor-350.test.ts`).
 *
 * La POBLACIÓN de emisores es la del MAPA, no la del encuadre (#252): se barre
 * EMITTER_REACH casillas más allá de la ventana, que es la envolvente exacta del
 * barrido de chunk entero del original para lo que se ve. `terrainAt` recibe por
 * tanto coordenadas fuera de 0..WINDOW-1.
 *
 * @param lightLevel radio de la party (world/survival.ts::lightLevel; 2 noche … 50 día).
 * @param terrainAt  tile de TERRENO de la celda de ventana (col,row), 0..10.
 *                   La LOS usa terreno (como 0x5A28 vía 0x4402), no entidades.
 */
/**
 * DISCO DE LUZ DE LA PARTY (radio puro, SIN muros ni emisores): 1 donde la celda
 * está dentro del radio ambiental/antorcha de la party (`radialDistance ≤ lightLevel`),
 * 0 fuera. Es el MISMO umbral radial que usa `floodFOV` (`radialFrom ≤ light`) pero sin
 * la propagación por flood — la extensión de luz «como si no hubiera muros».
 *
 * Uso: el compositor de la piel shader ANCLA A PANTALLA esta parte de la oscuridad (el
 * halo de la party va pegado al Avatar, que está siempre en el centro), mientras que la
 * oscuridad por OCLUSIÓN de muros (dentro del disco pero tapada) viaja con el terreno.
 * Depende SÓLO de `lightLevel` (no del terreno) → es idéntico frame a frame salvo cambio
 * de radio, y su forma está centrada en la party. Ver `computeVisibleWindow` (el campo F
 * combinado = disco ∩ LOS ∪ emisores) y `coreview` (lo sirve como `visRadius`).
 */
export function computeRadiusMask(lightLevel: number): Uint8Array {
  const mask = new Uint8Array(WINDOW * WINDOW);
  for (let row = 0; row < WINDOW; row++) {
    for (let col = 0; col < WINDOW; col++) {
      if (radialDistance(col, row) <= lightLevel) mask[row * WINDOW + col] = 1;
    }
  }
  return mask;
}

/**
 * @param beamLit  celdas de ventana (índices row-major) iluminadas por el HAZ DEL
 *                 FARO (#326): 0x7040 estampa sus rayos en el MISMO 0xAD14 que los
 *                 halos de emisor, así que aquí se FUSIONAN (OR) con `emitterLit`
 *                 antes del pase de la party — las tres ramas del flood (5c29/5c40/
 *                 5c8c) las consultan igual que a un halo. Quién las calcula y
 *                 cuándo gira la cuña: core/world/lighthouse.ts + coreview.
 */
export function computeVisibleWindow(
  lightLevel: number,
  terrainAt: (col: number, row: number) => number,
  beamLit?: ReadonlySet<number>,
): Uint8Array {
  // Halos de emisores (#252): el barrido es del MAPA, no del encuadre — se extiende
  // EMITTER_REACH casillas por fuera de la ventana en las cuatro direcciones, que es
  // la envolvente de los emisores capaces de marcar una celda visible (0x5E4A barre
  // el chunk entero; ver cabecera). `terrainAt` se llama por tanto con columnas y
  // filas FUERA de 0..WINDOW-1 y debe saber contestar (el muestreador de coreview
  // traduce a coordenadas de mapa y ya lo hacía).
  let emitterLit: Uint8Array | undefined;
  for (let row = -EMITTER_REACH; row < WINDOW + EMITTER_REACH; row++) {
    for (let col = -EMITTER_REACH; col < WINDOW + EMITTER_REACH; col++) {
      if (!EMITTER_TILES.has(terrainAt(col, row) & 0xff)) continue;
      // Flood del emisor en SU PROPIO marco 11×11 centrado en él — el `emisor − 5`
      // de 5f09/5f1d. Así el halo de un emisor de fuera del encuadre no queda
      // recortado por el borde de la ventana de la party.
      const glow = floodFOV(CENTER, CENTER, EMITTER_LIGHT_RADIUS, (c, r) =>
        terrainAt(col - CENTER + c, row - CENTER + r),
      );
      if (!emitterLit) emitterLit = new Uint8Array(WINDOW * WINDOW);
      for (let r = 0; r < WINDOW; r++) {
        for (let c = 0; c < WINDOW; c++) {
          if (!glow[r * WINDOW + c]) continue;
          const wc = col - CENTER + c;
          const wr = row - CENTER + r;
          if (wc < 0 || wr < 0 || wc >= WINDOW || wr >= WINDOW) continue;
          emitterLit[wr * WINDOW + wc] = 1;
        }
      }
    }
  }
  // HAZ DEL FARO (#326): sus celdas van al MISMO buffer que los halos (0x7091
  // escribe en 0xAD14) — se fusionan por OR antes del pase de la party.
  if (beamLit && beamLit.size > 0) {
    if (!emitterLit) emitterLit = new Uint8Array(WINDOW * WINDOW);
    for (const i of beamLit) emitterLit[i] = 1;
  }
  const isIlluminated = emitterLit
    ? (col: number, row: number): boolean => emitterLit![row * WINDOW + col] === 1
    : undefined;

  return floodFOV(CENTER, CENTER, lightLevel, terrainAt, isIlluminated, true);
}
