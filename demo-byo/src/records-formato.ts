/**
 * FORMATO DE ALAMBRE de un récord — el ÚNICO predicado, y lo comparten las dos orillas.
 *
 * Diseño: `docs/superpowers/specs/2026-08-04-lanzamiento-e-instrumentacion-design.md`
 * (carril 2). Este módulo lo importan el CLIENTE (`records.ts`, que sube) y la PAGES
 * FUNCTION (`functions/api/partida.ts`, que recibe). Es a propósito: un validador en el
 * servidor y otro «equivalente» en el cliente divergen el día que alguien toca uno —y el
 * que se queda corto es siempre el que nadie mira—. Aquí hay uno.
 *
 * ══ EL INVARIANTE Nº 1: NI UN BYTE DE EA SALE DEL NAVEGADOR ══════════════════════════
 *
 * 🔴 Y NO SE DEFIENDE CON UN FILTRO, SE DEFIENDE CON EL TIPO: en `RecordSubida` **no
 * existe** un campo donde quepa el estado inicial. La repetición local (`ReplayLog`,
 * `game/src/replay/types.ts`) sí lo lleva —`anchor.state` es `JSON.stringify(game.state)`,
 * ~18 KB— y por eso el `ReplayLog` TAL CUAL **no es un payload válido**: el validador lo
 * rechaza nombrando el campo `anchor`. Ese caso tiene su test, porque es exactamente el
 * error que cometería quien implementara la subida de la forma obvia.
 *
 * 🔴 POR QUÉ EL ESTADO NO PUEDE VIAJAR, medido y no por prudencia: `GameState.characters`
 * son los 16 registros del roster —nombre, clase, stats, equipo— que salen de `INIT.GAM`,
 * y el sitio YA TIENE UNA GUARDA que prohíbe publicarlos
 * (`docs/publicacion/guarda_roster_ea.py`: su detector de «filas en claro» es nombre + sus
 * cuatro stats a menos de 160 caracteres, que es literalmente lo que un ancla imprime).
 * Subir anclas al servidor y servirlas a cualquiera sería republicar justo lo que esa
 * guarda para en el ensamblado. Y hay una segunda fuga en el mismo objeto: `state.journal`
 * lleva el TEXTO de las conversaciones, que es prosa de EA verbatim.
 *
 * ⇒ De ahí sale toda la forma de este formato. Lo que viaja es:
 *      la HUELLA del estado inicial  +  [tecla, turno] × N  +  cómo RECONSTRUIRLO
 * que es, palabra por palabra, la fórmula del diseño (§«Fundamento»). El estado se
 * reconstruye en la máquina de quien verifica, desde SU copia — el mismo mecanismo ya
 * decidido para los momentos legendarios (`momentos-instala.ts`: el sitio publica el
 * PARCHE, el `.gam` lo compone el navegador del visitante).
 *
 * ══ QUÉ HACE VERIFICABLE UNA FILA (§4 del encargo) ═══════════════════════════════════
 * Un visitante cualquiera reproduce el récord con SU extracción si tiene estas cinco:
 *
 *   1. `base`      — de qué partida arranca. Hoy sólo `{tipo:"momento", id}`: un momento
 *                    legendario, que CUALQUIERA compone desde su propia copia
 *                    (`componeMomento`, game/src/momentos/compone.ts). Es la única clase
 *                    de arranque que otro puede reconstruir sin recibir un estado.
 *   2. `anclaHash` — SHA-256 del ancla canónica del que subió. El verificador compone SU
 *                    base, la hashea, y ANTES de reproducir nada sabe si arrancan del
 *                    mismo sitio. Es evidencia barata, no la prueba.
 *   3. `semilla`   — la semilla viva del RNG (`game.liveSeed()`), que NO está en el
 *                    GameState y sin la cual la repetición diverge al primer dado.
 *   4. streams     — `keys`/`turns`/`mods`: las teclas y sus turnos (codec.ts). El turno de
 *                    cada tecla es la SUMA DE CONTROL: el reproductor ya se detiene y lo
 *                    dice si al reproducir sale otro (`player.ts:202-216`).
 *   5. `motor`     — con qué versión del port se grabó. Un port distinto puede diverger
 *                    con razón; sin este campo la divergencia parecería un récord falso.
 *
 * La PRUEBA es reproducirlo; los campos 1-3 y 5 son lo que hace que reproducirlo sea
 * posible y que una divergencia se pueda atribuir. El servidor no verifica nada y no puede
 * (§«Límite estructural» del diseño): no tiene los datos de EA ni los tendrá.
 *
 * ══ LO QUE EL SERVIDOR NO SABE SE LLAMA `desenlace` A SECAS EN NINGÚN SITIO ══════════
 * 🔴 El campo se llama `desenlaceReclamado` y la columna de D1 `desenlace_reclamado`. Un
 * `desenlace: true` a secas se lee como un hecho comprobado en cuanto sale de aquí —y no
 * lo es, es lo que dijo quien subió—. El nombre es el aviso, y viaja con el dato.
 */

import { decodeEvents, encodeEvents } from "../../game/src/replay/codec.js";
import type { ReplayEvent } from "../../game/src/replay/types.js";

/** Versión del FORMATO DE ALAMBRE. Sube si cambia qué campos viajan o qué significan. */
export const FORMATO_RECORD = 1;

/**
 * De dónde arranca la repetición, dicho de forma que otro pueda REPRODUCIRLO.
 *
 * Hoy hay un solo tipo y es deliberado: un momento legendario lo compone cualquiera desde
 * su propia extracción. Un ancla «a media partida» NO tiene representación aquí porque no
 * la puede tener sin enviar el estado — y ése es el invariante. El cliente lo dice con esas
 * palabras cuando se topa con una (`records.ts`), en vez de ofrecer un botón que fallaría.
 */
export interface BaseAncla {
  tipo: "momento";
  /** Id estable del momento (`MomentoDef.id`, game/src/momentos/defs.ts). */
  id: string;
}

/** Lo que el navegador ENVÍA y lo que el servidor DEVUELVE. No hay más campos. */
export interface RecordSubida {
  v: typeof FORMATO_RECORD;
  /** Apodo elegido. NO es identidad: ver `identidad` en el esquema y §5 del informe. */
  alias: string;
  base: BaseAncla;
  /** SHA-256 en hex minúscula (64 caracteres) del ancla canónica. */
  anclaHash: string;
  /** `game.liveSeed()` en el instante del ancla. Entero sin signo de 32 bits. */
  semilla: number;
  /** Teclas codificadas (codec.ts). */
  keys: string;
  /** Deltas de turno codificados. */
  turns: string;
  /** Sidecar de modificadores (`índice:flags` separados por comas). Puede ser "". */
  mods: string;
  /** Nº de teclas. Se COMPRUEBA contra el stream decodificado; no se cree. */
  count: number;
  /** Turno de la última tecla. Idem: se comprueba. */
  lastTurn: number;
  /** Versión del motor con el que se grabó. */
  motor: string;
  /** LO QUE DIJO QUIEN SUBIÓ, no lo que el servidor comprobó. Ver la cabecera. */
  desenlaceReclamado: boolean;
}

/**
 * ── COTAS ────────────────────────────────────────────────────────────────────────────
 *
 * 🔴 LA COTA DE TAMAÑO ES DERIVADA Y SE DECLARA CÓMO. `medidaDeStream()` (abajo) codifica
 * una secuencia de N teclas con el codec REAL y devuelve sus bytes; el test
 * `records-formato.test.ts` la corre y comprueba que `MAX_BYTES` queda por encima con
 * margen. La cifra no está copiada de ningún documento: las dos que circulaban por el
 * proyecto («2,02 B/tecla», «7,9 KB/hora») están declaradas IRREPRODUCIBLES y prohibidas
 * en el corpus de publicación, así que aquí no se citan ni se usan.
 *
 * El ancla ya no viaja, así que lo que crece es SÓLO el stream de teclas: ~1 carácter por
 * tecla en `keys` + ~1 en `turns`, y los escapes son raros.
 */
export const LIMITES = {
  /** Teclas por récord. 200 000 teclas es una partida larguísima; más es abuso. */
  MAX_TECLAS: 200_000,
  /** Bytes UTF-8 del cuerpo entero. Cota DURA del endpoint (se mide el cuerpo real). */
  MAX_BYTES: 512 * 1024,
  /** Caracteres del alias, ya recortado. */
  MAX_ALIAS: 24,
  /** Caracteres de la etiqueta de motor. */
  MAX_MOTOR: 40,
  /** Subidas por IP y hora. */
  MAX_SUBIDAS_HORA: 10,
} as const;

/** Alias: letras/dígitos Unicode, espacio y `-_.`; ni control, ni marcas, ni emoji. */
const RE_ALIAS = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;
const RE_ID_MOMENTO = /^[a-z0-9][a-z0-9-]*$/;
const RE_HASH = /^[0-9a-f]{64}$/;
const RE_MOTOR = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Campos permitidos en la RAÍZ. Todo lo demás es rechazo, no descarte silencioso. */
const CLAVES: readonly (keyof RecordSubida)[] = [
  "v", "alias", "base", "anclaHash", "semilla",
  "keys", "turns", "mods", "count", "lastTurn", "motor", "desenlaceReclamado",
];

/** Resultado de validar. `motivo` es para el usuario Y para el 400: nombra el campo. */
export type Validacion =
  | { ok: true; record: RecordSubida }
  | { ok: false; motivo: string };

function malo(motivo: string): Validacion {
  return { ok: false, motivo };
}

/**
 * VALIDA un payload recibido. **Default-deny**: sólo pasa lo que está en la lista.
 *
 * 🔴 RECHAZA, NO SANEA. Un validador que borra el campo sobrante acepta el envío de quien
 * cree estar mandando otra cosa —y si ese campo era `anchor`, acepta un cliente que creía
 * estar subiendo el estado y se queda tan tranquilo—. Con rechazo, el cliente mal escrito
 * se entera el primer día en vez de el día que alguien audite el KV.
 *
 * El único saneado es el `trim()` del alias, y es antes de medirlo.
 */
export function validaRecord(cuerpo: unknown): Validacion {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return malo("el cuerpo no es un objeto JSON");
  }
  const o = cuerpo as Record<string, unknown>;

  // 1. Ni un campo de más. Éste es el aserto que para un `ReplayLog` entero (trae
  //    `anchor`, `id`, `label`, `createdAt`) y con él el estado inicial y el roster de EA.
  //
  //    🔴 SE LISTAN TODOS, no el primero. Lo pidió el test: un `ReplayLog` entero rebotaba
  //    diciendo «campo no permitido: id» —cierto, y engañoso—, porque `id` va antes que
  //    `anchor` en el objeto. El campo que importa nombrar es el que trae el estado, y
  //    cuál sea el primero depende del orden de construcción del objeto ajeno. Además,
  //    quien esté arreglando su cliente ve de una vez todo lo que sobra.
  const sobran = Object.keys(o).filter((k) => !(CLAVES as readonly string[]).includes(k));
  if (sobran.length > 0) {
    return malo(`campo${sobran.length > 1 ? "s" : ""} no permitido${sobran.length > 1 ? "s" : ""}: ${sobran.join(", ")}`);
  }
  for (const k of CLAVES) {
    if (!(k in o)) return malo(`falta el campo: ${k}`);
  }

  if (o["v"] !== FORMATO_RECORD) return malo(`versión de formato desconocida: ${String(o["v"])}`);

  // 2. Alias.
  if (typeof o["alias"] !== "string") return malo("alias no es una cadena");
  const alias = o["alias"].trim();
  if (alias.length === 0) return malo("alias vacío");
  if (alias.length > LIMITES.MAX_ALIAS) return malo(`alias de más de ${LIMITES.MAX_ALIAS} caracteres`);
  if (!RE_ALIAS.test(alias)) return malo("alias con caracteres no permitidos");

  // 3. Base. Objeto CERRADO, como la raíz: aquí cabría un blob si se dejara abierto.
  const base = o["base"];
  if (typeof base !== "object" || base === null || Array.isArray(base)) return malo("base no es un objeto");
  const b = base as Record<string, unknown>;
  for (const k of Object.keys(b)) {
    if (k !== "tipo" && k !== "id") return malo(`campo no permitido en base: ${k}`);
  }
  if (b["tipo"] !== "momento") return malo(`base.tipo desconocido: ${String(b["tipo"])}`);
  if (typeof b["id"] !== "string" || b["id"].length > 40 || !RE_ID_MOMENTO.test(b["id"])) {
    return malo("base.id no es un id de momento");
  }

  // 4. Huella y semilla.
  if (typeof o["anclaHash"] !== "string" || !RE_HASH.test(o["anclaHash"])) {
    return malo("anclaHash no es un SHA-256 en hex");
  }
  const semilla = o["semilla"];
  if (typeof semilla !== "number" || !Number.isInteger(semilla) || semilla < 0 || semilla > 0xffffffff) {
    return malo("semilla fuera del entero sin signo de 32 bits");
  }

  // 5. Motor.
  if (typeof o["motor"] !== "string" || o["motor"].length > LIMITES.MAX_MOTOR || !RE_MOTOR.test(o["motor"])) {
    return malo("motor no es una etiqueta de versión");
  }

  if (typeof o["desenlaceReclamado"] !== "boolean") return malo("desenlaceReclamado no es booleano");

  // 6. Los tres streams. Tipo, alfabeto y CIERRE (que decodifiquen y vuelvan a codificar
  //    igual) — ver `streamsCanonicos`.
  for (const k of ["keys", "turns", "mods"] as const) {
    if (typeof o[k] !== "string") return malo(`${k} no es una cadena`);
  }
  const count = o["count"];
  const lastTurn = o["lastTurn"];
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > LIMITES.MAX_TECLAS) {
    return malo(`count fuera de rango (0..${LIMITES.MAX_TECLAS})`);
  }
  if (typeof lastTurn !== "number" || !Number.isInteger(lastTurn) || lastTurn < 0) {
    return malo("lastTurn no es un entero no negativo");
  }

  const record: RecordSubida = {
    v: FORMATO_RECORD,
    alias,
    base: { tipo: "momento", id: b["id"] },
    anclaHash: o["anclaHash"],
    semilla,
    keys: o["keys"] as string,
    turns: o["turns"] as string,
    mods: o["mods"] as string,
    count,
    lastTurn,
    motor: o["motor"],
    desenlaceReclamado: o["desenlaceReclamado"],
  };
  const streams = compruebaStreams(record);
  if (streams !== null) return malo(streams);
  return { ok: true, record };
}

/**
 * ── LA GUARDA DE FORMA DE LOS STREAMS ────────────────────────────────────────────────
 *
 * Devuelve el motivo del rechazo, o `null` si pasan.
 *
 * 🔴 NO BASTA CON «QUE DECODIFIQUE». El criterio es que el payload sea el PUNTO FIJO del
 * codec: decodificar y volver a codificar tiene que dar los MISMOS tres streams. Un blob
 * arbitrario metido en `keys` puede decodificar (el codec es total: cualquier ASCII
 * imprimible es una tecla) pero entonces `count` no cuadra, o `turns` no tiene la misma
 * longitud, o el sidecar `mods` no re-emerge igual. Comprobar el punto fijo es una línea y
 * cierra la familia entera de «pasa el parser pero no es un registro».
 *
 * La implementación NO reimplementa el codec: importa el del juego. Un segundo codec en el
 * servidor sería otro sitio donde divergir, y la divergencia se leería como récord falso.
 */
function compruebaStreams(r: RecordSubida): string | null {
  if (r.keys.length > LIMITES.MAX_TECLAS * 2) return "keys excede la cota de teclas";
  if (r.turns.length > LIMITES.MAX_TECLAS * 2) return "turns excede la cota de teclas";
  if (r.mods.length > LIMITES.MAX_TECLAS * 8) return "mods excede la cota de teclas";
  let eventos;
  try {
    eventos = decodeEvents({ keys: r.keys, turns: r.turns, mods: r.mods });
  } catch (e) {
    return `los streams no decodifican: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (eventos.length !== r.count) {
    return `count dice ${r.count} y los streams traen ${eventos.length} teclas`;
  }
  if (eventos.length > LIMITES.MAX_TECLAS) return `más de ${LIMITES.MAX_TECLAS} teclas`;
  const ultimo = eventos.length ? eventos[eventos.length - 1]!.turn : 0;
  if (ultimo !== r.lastTurn) return `lastTurn dice ${r.lastTurn} y la última tecla va en el turno ${ultimo}`;
  const re = encodeEvents(eventos);
  if (re.keys !== r.keys || re.turns !== r.turns || re.mods !== r.mods) {
    return "los streams no son la forma canónica del codec (re-codificar da otra cosa)";
  }
  return null;
}

/**
 * Serialización CANÓNICA de un récord: claves en el orden de `CLAVES`, sin espacios.
 *
 * Existe por dos razones y las dos importan: el `id` del récord es el hash de ESTA cadena
 * (dos envíos idénticos dan el mismo id y no duplican fila), y lo que se guarda en KV es
 * exactamente esto — así lo que descarga quien verifica es byte a byte lo que se validó,
 * no una re-serialización del servidor con otro orden de claves.
 */
export function canonizaRecord(r: RecordSubida): string {
  return JSON.stringify({
    v: r.v,
    alias: r.alias,
    base: { tipo: r.base.tipo, id: r.base.id },
    anclaHash: r.anclaHash,
    semilla: r.semilla,
    keys: r.keys,
    turns: r.turns,
    mods: r.mods,
    count: r.count,
    lastTurn: r.lastTurn,
    motor: r.motor,
    desenlaceReclamado: r.desenlaceReclamado,
  });
}

/**
 * SHA-256 en hex de una cadena. Web Crypto, que está en el navegador Y en el runtime de
 * Workers: la misma función a los dos lados, sin dependencias.
 */
export async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Id de un récord: los primeros 20 hex del hash de su forma canónica (content-addressed). */
export async function idDeRecord(r: RecordSubida): Promise<string> {
  return (await sha256Hex(canonizaRecord(r))).slice(0, 20);
}

/** Bytes UTF-8 — la MEDIDA, no `length` (que cuenta unidades UTF-16). */
export function bytesUtf8(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * MEDIDA del coste de N teclas con el codec real. La usa el test que justifica
 * `MAX_BYTES`; no la usa el código de producción.
 *
 * ⚠ La secuencia es SINTÉTICA (mezcla declarada por el llamante), no una partida real: lo
 * que mide es el CODEC, y como tal se cita. Una cifra «por hora de juego» exigiría medir a
 * alguien jugando una hora, que es otra cosa y no se hace aquí.
 */
export function medidaDeStream(eventos: readonly ReplayEvent[]): { bytes: number; porTecla: number } {
  const s = encodeEvents(eventos);
  const bytes = bytesUtf8(s.keys) + bytesUtf8(s.turns) + bytesUtf8(s.mods);
  return { bytes, porTecla: eventos.length ? bytes / eventos.length : 0 };
}
