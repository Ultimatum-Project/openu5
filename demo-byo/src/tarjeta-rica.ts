/**
 * LA FICHA RICA de una partida en `/byo` — LECTURA Y FORMATEO, sin una línea de DOM.
 *
 * ── QUÉ ES ESTO ─────────────────────────────────────────────────────────────────────────
 * `partidas.ts` lee de un save lo que cabe en la tira de chips de la portada (oro, karma,
 * grupo, fecha, artefactos, Shadowlords). Esto lee el RESTO: las dos lunas con su fase real,
 * la bolsa, por dónde va la trama y quién viaja contigo. Sale un objeto; quien lo pinta es
 * otro. La separación no es estética: es lo que permite que el pytest de la batería llame a
 * estas funciones bajo node y asevere sobre lo que DEVUELVEN, sin navegador y sin canvas.
 *
 * ── LA REGLA QUE MANDA SOBRE TODAS: AUSENTE ES AUSENTE ──────────────────────────────────
 * 🔴 `/byo` lee el JSON CRUDO — `JSON.parse` a pelo en `partidas.ts`, sin pasar por
 * `deserialize()`. La tabla `SAVE_OPTIONAL_DEFAULTS` de `state.ts` (los campos que ganan su
 * valor «en reposo») NO SE APLICA AQUÍ. Y la ausencia es el caso NORMAL, no el raro: sobre
 * las dos partidas reales que se inventariaron el 07-08 (una recién empezada y un checkpoint
 * de final de juego), de los 63 campos declarados en `GameState` había 34 en las dos, 11
 * sólo en la que pasó por una carga y **18 en ninguna**.
 * ⇒ Cada lector de aquí devuelve `undefined` cuando el campo no está, y el que pinta no
 * pinta la línea. NUNCA un cero: un «0 de 8» sobre un campo AUSENTE es un dato inventado, y
 * se lee exactamente igual que un dato medido.
 *
 * ── Y POR QUÉ LOS PREDICADOS SE CALCAN CON SU CITA EN VEZ DE IMPORTARSE ─────────────────
 * Importar de `game/src/core/world/*` arrastraría el modelo del juego al bundle EAGER de la
 * landing (mismo motivo por el que existe `save-keys.ts`, y por el que `minimapa.ts` e
 * `iconos.ts` entran por `import()`). Así que se calcan — pero SIEMPRE con la cita del
 * original al lado, y con un aserto en `re/tools/test_byo_tarjeta_rica.py` que vuelve a
 * cruzar el calco contra la fuente en cada corrida. Un calco sin careo se queda rancio en
 * silencio; eso es lo que este comentario NO garantiza por sí solo y el test sí.
 *
 * ⚠ LA REGLA DE ARRIBA TIENE UNA EXCEPCIÓN Y ES DELIBERADA: `shortEquipNames.json` SÍ se
 * importa (ver `Miembro.equipo`). Lo que hace cara a una importación cruzada es el GRAFO que
 * arrastra —los 477 KB de i18n que entraron a `/byo` por UN import de una constante—, y un
 * `.json` no tiene grafo por construcción: es una hoja. Entre un calco de 48 cadenas que
 * puede quedarse rancio y una hoja que no puede divergir, aquí gana la hoja.
 *
 * ── Y LO QUE CUESTA, MEDIDO (no estimado) ──────────────────────────────────────────────
 * `npx vite build demo-byo` antes y después: el chunk `byo` pasa de **123,24 KB a 123,96 KB
 * … no**. Pasa de **123,24 a 123,28 KB**, y esos 40 B son la clave i18n nueva, no el JSON:
 * `grep "Chaos Swrd" dist/byo-static/byo-*.js` da **CERO**. La razón es que este módulo
 * TODAVÍA NO ESTÁ MONTADO — `seccionRica()` no tiene más llamador que su arnés, así que el
 * bundle eager no lo alcanza y el JSON no viaja. El coste REAL llega el día que alguien
 * monte la sección, y su cota son los **538 B** de las 48 cadenas serializadas (el fichero
 * son 1340 B, pero el `_provenance` no sobrevive al minificador).
 * 🔴 La cifra «+0,72 KB» estuvo escrita aquí un rato y era INVENTADA: la puse antes de
 * construir. Queda anotada porque el defecto no fue el número, fue el orden — una medición
 * escrita antes de medir se lee igual que una medida.
 */
import shortEquipNames from "../../game/src/core/data/shortEquipNames.json" with { type: "json" };

/**
 * Byte de fase → fase real: se le resta `0x30`. Calcado de `MOON_PHASE_OFFSET`
 * (`core/world/moongates.ts:37`), que lo deriva del consumidor del binario
 * (`moongate_enter` 0x4973 hace `sub ax,0x30`).
 */
const MOON_PHASE_OFFSET = 0x30;

/** Las ocho fases de cada luna. El ciclo del binario es de 8, no de 4 ni de 28. */
export const FASES_POR_LUNA = 8;

/**
 * ¿Es `b` un byte de fase LATCHEADO y válido? Calco de `isLatchedPhaseByte`
 * (`core/world/moongates.ts:55`): `b >= 0x30 && b <= 0x37`.
 *
 * 🔴 LAS DOS MITADES IMPORTAN Y LA SEGUNDA ES LA QUE SE OLVIDA. Que el campo ESTÉ no basta:
 * tiene que estar EN RANGO. El estado inicial que reparte el port trae los dos bytes a CERO
 * —medido sobre `game/assets/init.gam`, `+0x2DF = 0x00` y `+0x2E0 = 0x00`—, o sea un latch
 * «aún no escrito». Un lector que sólo comprobara `!== undefined` calcularía `0 - 0x30` y
 * pintaría **la fase −48**: un número imposible, salido de un campo presente, en una tarjeta
 * que por lo demás está bien. Por eso el predicado es el del port entero y no su primera
 * mitad.
 *
 * ⚠ Y el `undefined` NO significa «luna nueva»: significa **sin latchear**. Las fases se
 * recalculan por día cuando no hay latch (`latchedMoonPhases`, mismo fichero), pero ese
 * cálculo necesita `moonPhasesRaw` — una tabla de EA que vive en la extracción del visitante,
 * no aquí. ⇒ sin latch, la tarjeta no dice nada de las lunas. No las inventa.
 */
export function esFaseLatcheada(b: unknown): b is number {
  return typeof b === "number" && b >= MOON_PHASE_OFFSET && b <= MOON_PHASE_OFFSET + 7;
}

/** Las dos lunas de una partida, o `undefined` si el par no está latcheado. */
export interface Lunas {
  /** Felucca, 0-7. */
  felucca: number;
  /** Trammel, 0-7. */
  trammel: number;
}

/**
 * Las fases VIGENTES de las dos lunas, o `undefined`.
 *
 * 🔴 EL PAR SE EXIGE ENTERO, y ésa es la conducta del port, no una cautela mía:
 * `latchedMoonPhases` (`moongates.ts:73`) usa el latch **sólo si las DOS** lo tienen, y si
 * no cae al cálculo por día para las dos. Enseñar una luna latcheada junto a otra ausente
 * partiría un par que el juego trata como uno solo.
 */
export function lunas(st: Record<string, unknown>): Lunas | undefined {
  const f = st.feluccaPhase;
  const t = st.trammelPhase;
  if (!esFaseLatcheada(f) || !esFaseLatcheada(t)) return undefined;
  return { felucca: f - MOON_PHASE_OFFSET, trammel: t - MOON_PHASE_OFFSET };
}

/**
 * Una luna DIBUJADA, como `<path>` SVG sobre un círculo de radio 1 centrado en el origen.
 *
 * Devuelve el atributo `d` de la zona ILUMINADA. Es una cadena y no un nodo a propósito:
 * así el aserto puede mirar la geometría sin montar un DOM, y quien pinta decide el tamaño.
 *
 * ── LA GEOMETRÍA, PORQUE UN «SE VE BIEN» NO ES UNA COMPROBACIÓN ─────────────────────────
 * Fase 0 = nueva (nada iluminado) · fase 4 = llena (todo) · 1-3 creciente · 5-7 menguante.
 * El terminador de una luna real es una ELIPSE, no una recta: la mitad visible del disco se
 * dibuja con dos arcos, el del borde y el del terminador, y lo único que cambia entre fases
 * es el radio horizontal del segundo y hacia qué lado barre.
 *
 * `rx = |cos(π·fase/4)|` → en los dos cuartos (fases 2 y 6) `rx = 0` y el terminador es una
 * RECTA, que es exactamente lo que se ve en el cielo.
 *
 * 🔴 EL RADIO ES UN COSENO Y NO UNA RECTA, y lo sé porque la recta la escribí primero. Con
 * `rx = |1 - fase/2|` las cuatro primeras fases salían plausibles y las menguantes daban
 * **rx 1,5 · 2,0 · 2,5** — un terminador MÁS ANCHO QUE EL PROPIO DISCO, o sea una figura
 * imposible. No lo vi mirando el dibujo: lo vio el arnés, porque volcar el `d` de las OCHO
 * fases pone los ocho números en fila y el 2,5 canta. Media función correcta se lee como una
 * función correcta si sólo se miran los casos de la primera mitad.
 */
export function lunaSvgPath(fase: number): string {
  const f = ((Math.round(fase) % FASES_POR_LUNA) + FASES_POR_LUNA) % FASES_POR_LUNA;
  if (f === 0) return ""; // luna nueva: no se dibuja nada iluminado
  if (f === 4) return "M 0,-1 A 1,1 0 1,1 0,1 A 1,1 0 1,1 0,-1"; // llena: el disco entero
  // Creciente (1-3) ilumina la DERECHA; menguante (5-7), la izquierda.
  const creciente = f < 4;
  const rx = Math.abs(Math.cos((Math.PI * f) / 4));
  // El limbo recorre el borde del lado iluminado. El terminador vuelve, y su barrido decide
  // si la panza va hacia el lado oscuro (creciente fina) o hacia el iluminado (gibosa).
  const limbo = creciente ? 1 : 0;
  const terminador = creciente ? (f < 2 ? 0 : 1) : f > 6 ? 1 : 0;
  return `M 0,-1 A 1,1 0 0,${limbo} 0,1 A ${rx.toFixed(4)},1 0 0,${terminador} 0,-1`;
}

/** La bolsa. Cada cuenta es opcional: ausente ⇒ no se pinta (y `0` SÍ es un valor). */
export interface Economia {
  oro?: number;
  comida?: number;
  llaves?: number;
  gemas?: number;
  antorchas?: number;
  calaveras?: number;
  alfombras?: number;
  /** Minutos de antorcha ENCENDIDA. Sólo interesa si >0. */
  antorchaEncendida?: number;
}

/**
 * Lee un entero de un campo, o `undefined` si no está o no es un número finito.
 *
 * 🔴 EL CERO SE CONSERVA Y NO ES LO MISMO QUE LA AUSENCIA. «0 gemas» es un dato medido
 * (tienes la bolsa vacía); «gemas ausente» es un save que no lo dice. Un `if (x)` habría
 * fundido los dos casos en uno y borrado la mitad de la bolsa de cualquier partida nueva
 * —medido: en la partida recién empezada del inventario, `gems`, `skullKeys` y
 * `magicCarpets` valen los tres 0—. Por eso la guarda es de TIPO, no de verdad.
 */
function entero(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** La bolsa de una partida. */
export function economia(st: Record<string, unknown>): Economia {
  const e: Economia = {};
  const pon = <K extends keyof Economia>(k: K, v: unknown): void => {
    const n = entero(v);
    if (n !== undefined) e[k] = n;
  };
  pon("oro", st.gold);
  pon("comida", st.food);
  pon("llaves", st.keys);
  pon("gemas", st.gems);
  pon("antorchas", st.torches);
  pon("calaveras", st.skullKeys);
  pon("alfombras", st.magicCarpets);
  pon("antorchaEncendida", st.torchTurns);
  return e;
}

/** Un miembro del grupo, tal como la ficha lo enseña. */
export interface Miembro {
  /** El nombre que el jugador le puso (o el de fábrica). Puede venir vacío. */
  nombre: string;
  /** `G`ood · `P`oisoned · `C`harmed · `S`leeping · `D`ead. */
  estado: string;
  nivel?: number;
  hp?: number;
  maxHp?: number;
  /** `A`vatar · `B`ardo · `F`ighter · `M`age. */
  clase?: string;
  /**
   * CUÁNTAS de las seis ranuras de equipo lleva ocupadas (0-6), o `undefined` si el
   * registro no trae ninguna.
   */
  equipados?: number;

  /**
   * QUÉ lleva puesto, por su nombre, en el orden del registro (`RANURAS`). Sólo las ranuras
   * OCUPADAS: una vacía no aporta una línea en blanco, desaparece. `undefined` exactamente
   * cuando `equipados` lo es — el registro no trae ninguna ranura y no se afirma nada.
   *
   * 🔴 ESTE CAMPO NACE RETIRANDO UNA AFIRMACIÓN FALSA QUE VIVÍA AQUÍ. El comentario anterior
   * decía, en presente y como razón para no dar nombres, que «**no existe en el port ninguna
   * función equip-ID → nombre**» y que el mapa «NO está derivado en ningún sitio que se
   * pueda citar». Las dos mitades eran falsas cuando se escribieron: `equipName(id)` vive en
   * `game/src/skin/coreview.ts:190` desde el 19-07-2026 y la tabla que indexa es un volcado
   * byte a byte del binario. La cautela era buena y el hecho en que se apoyaba, no: lo que
   * faltaba no era la medición, era MIRAR SI YA ESTABA. Se retira sólo esa parte — el
   * cardinal sigue siendo verdad y sigue publicándose.
   *
   * ── DE DÓNDE SALEN LOS NOMBRES (las dos tablas y por qué ésta) ──────────────────────────
   * DATA.OVL tiene DOS tablas de nombres de equipo, las dos de 48 punteros word LE indexados
   * por el MISMO equip-ID, y las dos volcadas ya en el port:
   *   · `DS 0x1962` (fileoff 0x1972) → `game/src/core/data/shortEquipNames.json` — las formas
   *     ABREVIADAS de 10 celdas («Sm. Shield», «Myst. Armr», «Chaos Swrd»).
   *   · `DS 0x17f6` (fileoff 0x1806) → `longEquipNames.json` — las largas («Small Shield»,
   *     «Mystic Armour», «Sword of Chaos»).
   * Se usa la CORTA porque es la que el propio juego pone en el panel de personaje: la
   * lista-4 de Ztats y la página de armas la leen de `0x1962` (`re/notes/ztats-layout.md:116`
   * y `:301`, `re/notes/zstats.md:18` — `print_padded_string 0x0278`). La larga es la del
   * herrero, y sólo cuando cabe: `SHOPPES.OVL 0x0be7 cmp ax,0xd` cambia a la corta con 13+
   * caracteres (`re/notes/asm-shoppes-acta.md:941`). Una ficha de personaje que usara los
   * nombres de la TIENDA sería fiel a la fuente equivocada.
   *
   * ── EL CAREO, PORQUE UN VOLCADO NO SE CREE POR VENIR EN UN `.json` ─────────────────────
   * `re/tools/test_equip_nombres.py` no lee el JSON y lo da por bueno: RE-DERIVA las 48
   * entradas de `DATA.OVL` (sigue los punteros, `string fileoff = ptr + 0x10`) y las carea
   * con el fichero. Y contra una SEGUNDA fuente independiente, que es lo que de verdad
   * acredita el ÍNDICE: la tabla de TIPOS `DS 0x1a7e` (`core/equip.ts:48 TYPE_TABLE`, otro
   * offset, otra estructura, mismo equip-ID) dice de qué es cada ranura, y coincide con lo
   * que el nombre dice que es en las 48 — 0-3 son los cuatro cascos (`0x80`), 42-44 los tres
   * «Ring of …» (`0x02`), 45-47 los tres amuletos (`0x04`), y los dos ÚNICOS no equipables
   * (`0x00`, ids 27 y 29) son exactamente Arrows y Quarrels. Una tabla desplazada aunque
   * fuera una sola posición rompería esa concordancia en las cuatro fronteras a la vez.
   *
   * ⚠ CABO DECLARADO — LOS NOMBRES VAN EN INGLÉS Y EN LOS DOS IDIOMAS. Son los del binario
   * de 1988 y aquí no se traducen, igual que los topónimos de la tarjeta (cabo #132). El
   * juego SÍ los traduce en su picker (`game/src/i18n/es.json`, 46 de 48 — faltan sólo
   * `Main Gauche` y `Ankh`, que son nombres propios), pero ese fichero son **599 KB** y
   * arrastrarlo a la landing por un rótulo es exactamente el defecto ya medido que coló
   * diálogo de EA en el bundle de `/byo`. La traducción es un cabo aparte, no un olvido.
   * ⚠ Aquí decía «ese corpus pesa 477 KB»: 477 KB fue el CRECIMIENTO DEL BUNDLE en aquel
   * incidente, no el tamaño del fichero. Dos cifras de la misma familia y de sujetos
   * distintos; la que corresponde a «lo que pesa el corpus» es 599 KB, medida.
   */
  equipo?: string[];
}

/**
 * Los 48 nombres CORTOS de equipo por equip-ID (DATA.OVL DS 0x1962). Ver `Miembro.equipo`
 * para la derivación, el careo y por qué la tabla corta y no la larga.
 */
const NOMBRES_EQUIPO: readonly string[] = shortEquipNames.names;

/**
 * Nombre de lo que hay en una ranura, o `undefined` si no hay nada que nombrar.
 *
 * 🔴 TRES CASOS Y NINGUNO ES «CADENA VACÍA». Vacía (`0xff`) y fuera de rango son cosas
 * distintas y las dos se callan, pero por razones distintas: el centinela es un dato normal
 * (esa ranura no lleva nada) y un id fuera de 0-47 es un save que dice algo que la tabla del
 * binario no puede nombrar. Se calla en vez de inventar un «Item 51» porque esto es una
 * tarjeta de portada, no el panel de depuración del juego: `coreview.ts:190` sí devuelve ese
 * texto, y ahí está bien.
 *
 * ⚠ LA LÍNEA DEL CENTINELA ES REDUNDANTE Y SE QUEDA DECLARADA COMO TAL. Medido con un
 * mutante: borrarla no pone rojo NADA (`0xff` = 255, y la tabla tiene 48 entradas, así que
 * el acceso ya daba `undefined`). O sea que no es una guarda con dientes — es la
 * DECLARACIÓN de que 255 significa «ranura vacía» y no «id que no conozco», dos hechos
 * distintos que aquí dan la misma respuesta por aritmética y no por diseño. Se anota para
 * que nadie la lea como protegida por un aserto ni pierda el rato escribiéndole uno: no hay
 * testigo posible que la distinga mientras la tabla tenga menos de 256 entradas.
 */
export function nombreEquipo(id: unknown): string | undefined {
  if (typeof id !== "number" || !Number.isInteger(id)) return undefined;
  if (id === EQUIPMENT_NOTHING) return undefined;
  return NOMBRES_EQUIPO[id];
}

/**
 * Las seis ranuras de equipo de `CharacterState` (`state.ts:24-29`), en su orden.
 * Comparten espacio de equip-ID; `0xFF` = ranura vacía.
 */
const RANURAS = ["helmet", "armor", "weapon", "shield", "ring", "amulet"] as const;

/** Centinela «nada equipado». Calco de `EQUIPMENT_NOTHING` (`core/equip.ts:27`). */
const EQUIPMENT_NOTHING = 0xff;

/**
 * Tope del grupo: `MAX_PARTY = 6` (`core/party.ts:9`). Escrito con su cita porque el
 * predicado se calca (ver abajo) y un tope rancio no daría error: daría un séptimo miembro.
 */
const MAX_PARTY = 6;

/**
 * QUIÉN VIAJA CONTIGO — la LISTA, no el número.
 *
 * 🔴 `characters` NO ES EL GRUPO: es el ROSTER COMPLETO de Ultima V, **16 registros
 * SIEMPRE** desde el minuto uno (Avatar, Shamino, Iolo, Mariah, Geoffrey, Jaana, Julia,
 * Dupre, Katrina, Sentri, Gwenno, Johne, Gorn, Maxwell, Toshi, Saduj). Los que aún no se han
 * unido están ahí con `partyStatus: 0xFF` (`state.ts:31`). Ése fue el defecto que hizo que
 * la tarjeta enseñara «grupo de 16» con 3 en el grupo, ya arreglado en `partidas.ts`.
 *
 * ★ EL PREDICADO ES EL DEL PROPIO JUEGO: `party.ts:171 partyMembers()` hace exactamente
 * `filter(partyStatus === 0).slice(0, MAX_PARTY)`. Aquí se calca por el peso del bundle, y
 * `test_byo_tarjeta_rica.py` cruza esta lista contra el `tamanoGrupo()` que ya vive en
 * `partidas.ts` sobre los mismos testigos: si los dos lectores del MISMO hecho divergieran,
 * el aserto lo dice. Dos calcos del mismo predicado sin nadie que los caree es como se
 * separan.
 *
 * ⚠ Un miembro MUERTO (`status: 'D'`) sigue con `partyStatus: 0` y por tanto SIGUE EN LA
 * LISTA: viaja contigo, aunque sea a hombros. Medido en el save avanzado (Shamino, `'D'`,
 * dentro de los 3). Cuántos han caído es otro dato y se cuenta aparte — no se resta de éste.
 */
export function grupo(chars: unknown): Miembro[] {
  if (!Array.isArray(chars)) return [];
  const salida: Miembro[] = [];
  for (const c of chars) {
    if (salida.length >= MAX_PARTY) break;
    const r = c as Record<string, unknown> | null;
    if (r?.partyStatus !== 0) continue;
    const m: Miembro = {
      nombre: typeof r.name === "string" ? r.name : "",
      estado: typeof r.status === "string" ? r.status : "",
    };
    const nivel = entero(r.level);
    if (nivel !== undefined) m.nivel = nivel;
    const hp = entero(r.currentHp);
    if (hp !== undefined) m.hp = hp;
    const maxHp = entero(r.maxHp);
    if (maxHp !== undefined) m.maxHp = maxHp;
    if (typeof r.class === "string" && r.class) m.clase = r.class;
    // Las ranuras se cuentan sólo si el registro trae ALGUNA: un «0 objetos equipados»
    // sobre un save que no guarda equipo sería el cero inventado otra vez.
    const conRanura = RANURAS.filter((k) => typeof r[k] === "number");
    if (conRanura.length > 0) {
      m.equipados = conRanura.filter((k) => r[k] !== EQUIPMENT_NOTHING).length;
      // Y QUÉ lleva. La lista puede salir MÁS CORTA que el cardinal y no es una
      // incoherencia: `equipados` cuenta ranuras ocupadas y esto nombra las que la tabla
      // del binario sabe nombrar. Un id fuera de 0-47 ocupa la ranura de verdad —el
      // cardinal lo dice bien— y no tiene nombre que dar.
      m.equipo = conRanura
        .map((k) => nombreEquipo(r[k]))
        .filter((n): n is string => n !== undefined);
    }
    salida.push(m);
  }
  return salida;
}

/** Cuántos del grupo han caído (`status === 'D'`). Es LA noticia de una partida a medias. */
export function caidos(miembros: Miembro[]): number {
  return miembros.filter((m) => m.estado === "D").length;
}

/**
 * Los tres Shadowlords en su orden canónico. El dato vive en
 * `core/quest/shadowlord-keys.ts:41` (fichero sin dependencias, hecho para poder citarlo
 * desde sitios como éste) y `quest/shadowlords.ts` lo RE-EXPORTA. Es el mismo orden que
 * `shadowlordLocs`.
 */
const SHADOWLORDS = ["falsehood", "hatred", "cowardice"] as const;

/** Por dónde va la trama. Todo opcional: lo que el save no sostiene, no se afirma. */
export interface Trama {
  /**
   * Cuántos de los tres Shadowlords están destruidos, 0-3 — o `undefined` si el save no
   * trae `questFlags` y por tanto no dice nada de la trama.
   *
   * 🔴 ES OPCIONAL Y LO ERA POR LAS MISMAS RAZONES QUE TODO LO DEMÁS, pero lo escribí
   * OBLIGATORIO y devolviendo 0 — o sea, cometí en la primera línea del bloque de trama
   * exactamente el defecto que este módulo existe para impedir: un save sin `questFlags`
   * recibía «0 de 3 Shadowlords destruidos», un cero INVENTADO indistinguible del medido.
   * No lo vio ningún aserto de datos (0 es un valor plausible); lo delató la VISTA, porque
   * al hacer la fila incondicional dejaba el `null` de `seccionRica()` inalcanzable, y un
   * contrato que no puede darse es la pista de que algo se afirma siempre.
   * ★ Un campo que nunca falta en un lector cuyo tema es la ausencia merece una segunda
   * mirada.
   */
  shadowlordsMuertos?: number;
  /** Palabras de poder dichas. */
  palabras?: number;
  /** Escondrijos hallados con (S)earch. */
  escondrijos?: number;
  /** Santuarios destruidos por un Shadowlord (bit 0x80 de cada byte). */
  santuariosDestruidos?: number;
  /** Salas de mazmorra despejadas (`popcount` de los 14 bytes). */
  salasDespejadas?: number;
  /** Personas conocidas (`npcMet`). */
  personasConocidas?: number;
  /** Moonstones enterradas, de las 8. */
  moonstonesEnterradas?: number;
}

/**
 * ¿Cuántos Shadowlords están MUERTOS?
 *
 * 🔴 LA FUENTE AUTORITATIVA ES `questFlags`, NO `shadowlordLocs` — lo dice el propio port en
 * `game.ts:4962-4964`: *«En el clon la fuente autoritativa de "muerto" es questFlags
 * (destroyShadowlord), no `state.shadowlordLocs` (0x58C8), que no se mantiene sincronizado
 * al destruir»*. Sobre el save de final de juego medido, `shadowlordLocs` estaba AUSENTE y
 * los tres flags en `true`: quien lea el campo viejo cuenta CERO muertos en una partida
 * terminada. Es el mismo criterio que ya usa `shadowlords()` en `partidas.ts`, y se mantiene
 * idéntico aquí a propósito — dos respuestas distintas a «¿está muerto?» en la misma tarjeta
 * sería peor que cualquiera de las dos.
 */
function shadowlordsMuertos(questFlags: Record<string, unknown> | undefined): number | undefined {
  // Sin `questFlags` la partida no dice NADA de la trama — ni que haya muertos ni que no.
  // Es el mismo criterio que `shadowlords()` en `partidas.ts`, que en ese caso da
  // `sin-rastro` a los tres en vez de «vivos».
  if (!questFlags) return undefined;
  return SHADOWLORDS.filter((k) => questFlags[`shadowlord-dead:${k}`] === true).length;
}

/** Cuántas claves de `questFlags` empiezan por `prefijo`. */
function cuenta(questFlags: Record<string, unknown> | undefined, prefijo: string): number | undefined {
  if (!questFlags) return undefined;
  return Object.keys(questFlags).filter((k) => k.startsWith(prefijo) && questFlags[k] === true).length;
}

/**
 * Bits a 1 en un array de bytes que cumplen `mascara`. Devuelve `undefined` si el campo no
 * es un array — que es lo que pasa en toda partida que no haya pasado por una carga.
 */
function bitsPuestos(v: unknown, mascara: number): number | undefined {
  if (!Array.isArray(v)) return undefined;
  let n = 0;
  for (const b of v) {
    if (typeof b !== "number") continue;
    for (let i = 0; i < 8; i++) if (mascara & (1 << i) && b & (1 << i)) n++;
  }
  return n;
}

/** Por dónde va la trama de esta partida. */
export function trama(st: Record<string, unknown>): Trama {
  const qf = st.questFlags as Record<string, unknown> | undefined;
  const t: Trama = {};
  const sl = shadowlordsMuertos(qf);
  if (sl !== undefined) t.shadowlordsMuertos = sl;
  const palabras = cuenta(qf, "word-spoken:");
  if (palabras !== undefined) t.palabras = palabras;
  const escondrijos = cuenta(qf, "search:");
  if (escondrijos !== undefined) t.escondrijos = escondrijos;
  // 🔴 Bit 0x80 = santuario destruido por un Shadowlord (`state.ts`, bloque `shrineDestroyed`).
  // Es estado del MUNDO, no del jugador: casi siempre 0, y por eso mismo cuando NO es 0 es la
  // línea más expresiva de la ficha. Ausente en toda partida sin carga previa ⇒ `undefined`.
  const santuarios = bitsPuestos(st.shrineDestroyed, 0x80);
  if (santuarios !== undefined) t.santuariosDestruidos = santuarios;
  // 7 mazmorras × 16 salas en 14 bytes: aquí cuentan LOS OCHO bits de cada byte.
  const salas = bitsPuestos(st.dungeonRoomsCleared, 0xff);
  if (salas !== undefined) t.salasDespejadas = salas;
  const npcMet = bitsPuestos(st.npcMet, 0xff);
  if (npcMet !== undefined) t.personasConocidas = npcMet;
  if (Array.isArray(st.moonstones)) {
    t.moonstonesEnterradas = st.moonstones.filter(
      (m) => (m as { buried?: unknown } | null)?.buried === true,
    ).length;
  }
  return t;
}

/** La hora del mundo. Va aparte de la fecha porque cambia la ficha entera (día/noche). */
export interface Reloj {
  hora: number;
  minuto: number;
}

/** La hora de juego, o `undefined`. */
export function reloj(st: Record<string, unknown>): Reloj | undefined {
  const t = st.time as Record<string, unknown> | undefined;
  const hora = entero(t?.hour);
  const minuto = entero(t?.minute);
  if (hora === undefined || minuto === undefined) return undefined;
  return { hora, minuto };
}

/**
 * ¿Es de NOCHE? `hora < 5 || hora >= 20`.
 *
 * ★ NO ES UN UMBRAL INVENTADO PARA LA WEB: es el calco literal de `isNightTileHour`
 * (`core/world/townHourTiles.ts:52`), que el port deriva del binario — TOWN 0x04fa,
 * `cmp 5; jb call` / `cmp 0x13; jbe skip`, o sea llamada sólo si `hour<5 ∨ hour>=20`.
 *
 * ⚠ Y SE DECLARA DE DÓNDE VIENE, porque el sujeto original es MÁS ESTRECHO que el uso que
 * se le da aquí: en el port esa franja decide si en un pueblo baja la reja y se iza el
 * puente, no el régimen de luz del sobremundo. Se reutiliza porque es la única banda
 * noche/día que el port tiene derivada del binario, y porque lo que la ficha hace con ella
 * es cosmético (un glifo de luna y subir la antorcha encendida a portada). Si algún día se
 * quiere el régimen de luz de verdad, no es este predicado.
 */
export function esDeNoche(r: Reloj | undefined): boolean {
  return r !== undefined && (r.hora < 5 || r.hora >= 20);
}

/** Los cinco modos de transporte del port (`TransportMode`, `state.ts:49`). */
const TRANSPORTES = ["foot", "horse", "carpet", "skiff", "ship"] as const;

/** Cómo viaja el grupo, o `undefined` si el save no lo dice. */
export function transporte(st: Record<string, unknown>): string | undefined {
  const v = st.transport;
  return typeof v === "string" && (TRANSPORTES as readonly string[]).includes(v) ? v : undefined;
}

/**
 * CUÁL de las partidas es «la que tienes en curso», o `null` si no hay ninguna.
 *
 * 🔴 NO ES UN ALMACÉN NUEVO NI UNA PARTIDA DISTINTA, y ésa es toda la ficha: «en curso» es
 * **la de mayor `timestamp`**, que es EXACTAMENTE lo que `loadMostRecentSave()`
 * (`core/persistence.ts:129`) recarga al pulsar Journey Onward — el equivalente del
 * SAVED.GAM del original, sea un autosave rotatorio de (Q) o un guardado a mano.
 * `/byo` ya ordena su índice con el MISMO predicado (`readSaveIndex().sort((a,b) =>
 * b.timestamp - a.timestamp)`), así que la respuesta es la primera de la lista.
 *
 * ★ Se escribe como FUNCIÓN en vez de dejar un `partidas[0]` suelto en el sitio que pinta
 * por dos razones. Una: el hecho que la tarjeta afirma («esto es lo que continuarías») pasa
 * a tener un nombre y un aserto, en vez de vivir en un índice literal que el siguiente
 * cambio de orden convertiría en mentira sin avisar. Y dos: si algún día «en curso» deja de
 * ser «la más reciente» —un `createdAt`, un slot marcado— se cambia AQUÍ, y no en cada
 * sitio que hubiera copiado el `[0]`.
 *
 * ⚠ Se re-deriva el máximo en vez de confiar en que venga ordenada: recibir la lista ya
 * ordenada es cierto HOY por el `sort` de `leeInventario()`, pero es una precondición que
 * este módulo no controla y que un `push` posterior rompería en silencio.
 */
export function idEnCurso(partidas: readonly { id: string; timestamp: number }[]): string | null {
  let mejor: { id: string; timestamp: number } | null = null;
  for (const p of partidas) {
    if (typeof p?.timestamp !== "number") continue;
    if (mejor === null || p.timestamp > mejor.timestamp) mejor = p;
  }
  return mejor?.id ?? null;
}

/** Todo lo que la ficha rica sabe de una partida. */
export interface FichaRica {
  lunas?: Lunas;
  economia: Economia;
  trama: Trama;
  grupo: Miembro[];
  caidos: number;
  reloj?: Reloj;
  noche: boolean;
  transporte?: string;
}

/**
 * Compone la ficha rica de un estado YA PARSEADO.
 *
 * Toma el objeto y no el `id` a propósito: `partidas.ts` ya hizo el `JSON.parse` para su
 * tarjeta y volver a leer el `localStorage` parsearía 18-23 KB por segunda vez para la misma
 * partida. Quien tenga el estado, que lo pase.
 */
export function fichaRica(st: Record<string, unknown>): FichaRica {
  const miembros = grupo(st.characters);
  const r = reloj(st);
  const f: FichaRica = {
    economia: economia(st),
    trama: trama(st),
    grupo: miembros,
    caidos: caidos(miembros),
    noche: esDeNoche(r),
  };
  const l = lunas(st);
  if (l) f.lunas = l;
  if (r) f.reloj = r;
  const tr = transporte(st);
  if (tr) f.transporte = tr;
  return f;
}
