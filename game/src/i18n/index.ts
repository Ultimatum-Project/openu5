/**
 * CAPA DE IDIOMA (i18n) — F1 «motor», sin contenido traducido de verdad.
 *
 * MODELO (docs/i18n/analisis.md §2). El INGLÉS es el SUELO del calco, no «un
 * idioma más»: todo el texto del juego sale byte-exacto del binario y contra él
 * están ancladas TODAS las guardas (pixeldiff, Grand Tour, approved-strings).
 * Un idioma ≠ inglés es una TABLA DE SUSTITUCIÓN paralela `<code>.json`, keyed
 * por la HUELLA del string INGLÉS original (`huella.ts`: sha256 truncado — #380;
 * antes la clave era el inglés EN CLARO, y eso metía el texto de EA en el árbol
 * público y en el bundle), resuelta en runtime en un ÚNICO choke point (`t()`),
 * con fallback al inglés si falta la entrada. El inglés no se almacena: llega en
 * la llamada, leído de los ficheros del juego DEL USUARIO. Así:
 *
 *   - `lang === 'en'`  ⇒ `t()` es la IDENTIDAD ESTRICTA. Ni una llamada altera el
 *     output; el calco y las guardas quedan intactos (corren siempre en 'en').
 *   - `lang !== 'en'`  ⇒ `t(str)` devuelve `tabla[huella(str)] ?? str`. Un idioma
 *     incompleto degrada a inglés string a string (se puede aterrizar por lotes).
 *
 * ALCANCE F1: el motor (esta capa), su choke point en la consola (coreview
 * `pushConsole`), persistencia + API de selección, y una SEMILLA de 20 strings
 * (`es.json`) para probarlo de punta a punta. Traducir el contenido real es F2+.
 *
 * DÓNDE VIVE LA TABLA. En `src/i18n/` (código fuente tracked), NO en
 * `game/assets/` — assets/ es material extraído del binario (gitignored, propiedad
 * de EA); la tabla de idioma es contenido AUTORADO nuevo que debe versionarse.
 */
import esTable from "./es.json" with { type: "json" };
import { huella } from "./huella.js";

/** Valor de traducción: el texto + procedencia ligera (analisis.md §2.4). */
export interface TranslationEntry {
  /** La traducción. */
  t: string;
  /** Quién la escribió (`seed`, un traductor, `mt`…). No es cita al binario. */
  by: string;
  /** ¿Pasó revisión humana del usuario? La semilla F1 es toda `false`. */
  reviewed: boolean;
}

export interface LangTable {
  meta: {
    lang: string;
    name: string;
    seed?: boolean;
    note?: string;
    /** Par de comillas del idioma. Ver `quoteOpen`/`quoteClose`. */
    quotes?: { open: string; close: string };
  };
  strings: Record<string, TranslationEntry>;
}

/** Metadatos de un idioma ofertable en el selector. */
export interface LangInfo {
  code: string;
  name: string;
  /** true = tabla semilla/incompleta (el selector la marca «beta»). */
  seed: boolean;
}

/** Idioma base = el calco. Sin tabla: `t()` es la identidad. */
export const BASE_LANG = "en";

/**
 * Registro de tablas cargadas (idioma → tabla). 'en' NO tiene tabla (identidad).
 * Añadir un idioma = importar su `<code>.json` y registrarlo aquí.
 */
const TABLES: Record<string, LangTable> = {
  es: esTable as LangTable,
};

/**
 * Idiomas ofertables al usuario. 'en' primero (el suelo). El nombre sale de la
 * meta de la tabla; `seed` marca las tablas de demostración/incompletas.
 */
export const AVAILABLE_LANGS: readonly LangInfo[] = [
  { code: BASE_LANG, name: "English", seed: false },
  ...Object.entries(TABLES).map(([code, tbl]) => ({
    code,
    name: tbl.meta.name || code,
    seed: Boolean(tbl.meta.seed),
  })),
];

/** Clave de persistencia (localStorage), convención `u5.*` del repo (u5.skin/u5.music). */
const LANG_STORAGE_KEY = "u5.lang";

/**
 * Normaliza un código crudo (URL/localStorage) a un idioma soportado; si no lo
 * reconoce, cae al inglés. Case-insensitive y tolera `es-ES` → `es`.
 */
export function resolveLang(raw: string | null | undefined): string {
  if (!raw) return BASE_LANG;
  const code = raw.toLowerCase().split("-")[0]!;
  if (code === BASE_LANG || code in TABLES) return code;
  return BASE_LANG;
}

function readStoredLang(): string {
  try {
    if (typeof localStorage !== "undefined") return resolveLang(localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    /* almacenamiento no disponible (modo privado/cuota): sólo en memoria */
  }
  return BASE_LANG;
}

/** Idioma vivo. Se lee de localStorage la primera vez y se mantiene en memoria. */
let currentLang = readStoredLang();
const listeners = new Set<(lang: string) => void>();

/** Idioma activo. `t()` lo lee en cada llamada → cambio en caliente sin reiniciar. */
export function getLang(): string {
  return currentLang;
}

/**
 * Cambia el idioma en caliente (como el selector de piel). Persiste en
 * localStorage salvo `persist:false` (para overrides efímeros de URL/e2e, que no
 * deben ensuciar la preferencia del usuario). Notifica a los suscriptores para
 * que repinten. No-op si el idioma no cambia.
 */
export function setLang(raw: string, opts: { persist?: boolean } = {}): void {
  const lang = resolveLang(raw);
  if (lang === currentLang) return;
  currentLang = lang;
  if (opts.persist !== false) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* almacenamiento no disponible: la elección vive sólo en memoria */
    }
  }
  for (const cb of listeners) cb(lang);
}

/** Suscribe un callback al cambio de idioma. Devuelve la función para desuscribir. */
export function onLangChange(cb: (lang: string) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * RE-WRAP (analisis.md §5). Los `\n` del texto INGLÉS son maquetación para 16
 * columnas de inglés; JAMÁS se portan a otro idioma. Una traducción se AUTORA sin
 * los `\n`-de-wrap (sólo con los `\n`-de-párrafo). Esta función COLAPSA cualquier
 * `\n` interior suelto (wrap) a un espacio, PRESERVANDO:
 *   - `\n\n` (línea en blanco = ruptura de párrafo),
 *   - el `\n` inicial y el FINAL (terminador semántico del mensaje).
 * El re-partido al ancho VIVO lo hace luego el printer de la consola fiel
 * (`textwindow.printString`, word-wrap por `wrapWidth`) — esta capa NO redefine el
 * ancho (lo posee el carril de la consola); sólo entrega texto sin wrap inglés.
 *
 * LIMITACIÓN DECLARADA (F1): trata TODO `\n` interior suelto como wrap. Un `\n`
 * SEMÁNTICO deliberado a media línea (raro; diálogos maquetados) debe autorarse
 * como `\n\n`. La separación fina wrap-vs-semántico sobre los datos extraídos es
 * tooling de F0/F3, no de esta función.
 */
export function rewrap(text: string): string {
  return text.replace(/(?<=[^\n])\n(?=[^\n])/g, " ");
}

/**
 * ¿`text` contiene un `\n` de WRAP (salto interior suelto)? Es la CONVENCIÓN DE
 * AUTORADO de las traducciones (i18n F0b, hueco c): un valor de `<lang>.json` puede
 * llevar `\n` FINAL (terminador) y `\n\n` (párrafo), pero NUNCA un `\n` interior
 * suelto — ése sería wrap inglés de 16-columnas PORTADO, que desmaqueta el idioma
 * (el runtime re-wrappea al ancho vivo). El lint de traducciones lo rechaza; el
 * texto INGLÉS de origen que sí lo trae (≈212 strings) se re-fluye con `rewrap`.
 */
export function hasWrapNewline(text: string): boolean {
  return /(?<=[^\n])\n(?=[^\n])/.test(text);
}

/**
 * CHOKE POINT ÚNICO de i18n. Devuelve el texto en el idioma activo.
 *
 *   - 'en'            → `str` TAL CUAL (identidad estricta; ni rewrap se aplica).
 *   - idioma con hit  → la traducción, re-wrapeada (sin los `\n` ingleses).
 *   - idioma sin hit  → `str` (fallback al inglés; degradación por lotes).
 *
 * PURA respecto al idioma que lee (`currentLang`). No lanza. El llamador (hoy sólo
 * `coreview.pushConsole`) no necesita saber el idioma.
 */
export function t(str: string): string {
  if (currentLang === BASE_LANG) return str;
  // La tabla está indexada por HUELLA de la cadena inglesa, no por la cadena (#380:
  // las claves en claro eran el texto de EA viajando en el árbol y en el bundle).
  // El lookup sigue siendo IGUALDAD EXACTA — `huella()` es inyectiva sobre el
  // dominio medido — así que esta línea no cambia qué casa con qué, sólo bajo qué
  // nombre. Ver `huella.ts` para la derivación y las colisiones medidas.
  const entry = TABLES[currentLang]?.strings[huella(str)];
  if (!entry) return str;
  return rewrap(entry.t);
}

/**
 * COMILLAS DEL IDIOMA — glifo de APERTURA y de CIERRE, por separado (#37/#41).
 *
 * POR QUÉ NO SON UNA ENTRADA DEL CORPUS. `t()` es una tabla indexada por el string
 * INGLÉS, y el inglés usa el MISMO carácter `"` para abrir y para cerrar: la key `'"'`
 * ya está tomada por la de apertura (traduce a `«`), y una tabla por texto no puede dar
 * dos traducciones a la misma key. El cierre no es la traducción de un string: es una
 * propiedad TIPOGRÁFICA del idioma ⇒ vive en `meta.quotes`, fuera de `strings` (y por
 * tanto fuera del manifest de corpus, que sólo gobierna traducciones de texto del
 * binario). Los fragmentos de puntuación que SÍ llevan texto o layout pegado (`'?" '`,
 * `'\n"'`, `'!"\n\n'` — #162 §2) siguen en `strings`: ésos sí son cadenas del binario.
 *
 * POR QUÉ DOS PRIMITIVAS Y NO UN `quotePair()`. El binario NO emite el par desde un
 * punto: TALK 0x04da es `mov ax,0xa2 / push ax / call 0xf32` — el putchar de UN carácter
 * (TLK-charset 0xa2, `&0x7f` = `"`) — y se llama desde 15 sitios independientes. La
 * apertura y el cierre son emisiones separadas, con tres asimetrías que un par atómico no
 * podría expresar:
 *   · el cierre es CONDICIONAL — si la sección acaba en op de transferencia
 *     (JoinParty/End/Goto, 0x07aa devuelve ≠0) NO se emite: 0x0bc5 `je 0xb8a`,
 *     0x1172 `jne 0x112e` saltan por encima de él;
 *   · a veces la APERTURA no es un putchar sino parte del literal de DATA.OVL
 *     (`"My name is ` DS 0x93c2, `"I am called ` DS 0x94ce, `"I cannot help thee with
 *     that.` DS 0x9420) y sólo el cierre sale del putchar (0x0ad3 / 0x0b8a);
 *   · hay cierres a los que se llega por caminos que nunca pasaron por su apertura
 *     (0x0ab7 `je 0xad3` esquiva el 0x0ac5).
 * ⇒ dos glifos independientes, pedidos donde el binario los emite.
 *
 * En 'en' ambas devuelven `'"'`, así que el calco queda BYTE-IDÉNTICO.
 */
const BASE_QUOTE = '"';

function quotes(): { open: string; close: string } {
  if (currentLang === BASE_LANG) return { open: BASE_QUOTE, close: BASE_QUOTE };
  return TABLES[currentLang]?.meta.quotes ?? { open: BASE_QUOTE, close: BASE_QUOTE };
}

/** Glifo de comilla de APERTURA del idioma activo (`"` en inglés, `«` en castellano). */
export function quoteOpen(): string {
  return quotes().open;
}

/** Glifo de comilla de CIERRE del idioma activo (`"` en inglés, `»` en castellano). */
export function quoteClose(): string {
  return quotes().close;
}

/**
 * TF — traduce-y-compone plantillas POSICIONALES `{}` (i18n «cableado» (A)).
 *
 * Muchos strings user-facing del core NO son literales fijos: se COMPONEN en
 * runtime interpolando nombres display / verbos («Troll attacks!», «X hits Y for
 * N.»). Ese compuesto no casa con ninguna key de la tabla, así que el choke `t()`
 * de la consola lo dejaría en inglés. `tf()` traduce la PLANTILLA (que está en el
 * corpus con la MISMA normalización `${…}`→`{}` que aplica el escáner de strings del
 * core) y sustituye cada `{}` EN ORDEN por los argumentos, pasando cada arg STRING
 * por `t()` (así el nombre display se traduce o se conserva) y los numéricos por
 * `String()`.
 *
 *   - lang 'en'      → `t(tpl)` es identidad y cada arg-string es identidad ⇒ el
 *     resultado es BYTE-IDÉNTICO a la interpolación nativa `` `${a} … ${b}` `` de hoy.
 *   - lang con hit   → plantilla traducida (re-wrapeada) + args traducidos.
 *   - lang sin hit   → plantilla inglesa (fallback) + args traducidos.
 *
 * DOBLE PASADA SEGURA: el compuesto resultante nunca es key de la tabla (las keys
 * son plantillas `{}` o strings planos), así que si vuelve a pasar por `t()`
 * (pushConsole) queda intacto — `t(tf(...)) === tf(...)`.
 *
 * PLANTILLAS GENÉRICAS (`{}!`, `{} {}`) NO se traducen (no se meten en la tabla):
 * `t(tpl)` cae a identidad y sólo el arg-nombre pasa por `t()`.
 */
export function tf(template: string, ...args: (string | number)[]): string {
  const tpl = t(template);
  let i = 0;
  return tpl.replace(/\{\}/g, () => {
    const a = args[i++];
    return typeof a === "string" ? t(a) : String(a);
  });
}

/**
 * SEE-WRAP — puntuación (D) del comando (L)ook. El marco lo compone el LLAMADOR con
 * `tf("Thou dost see {}", …)` (la plantilla vive en el core → la caza el manifest); esta
 * función SÓLO envuelve el resultado en los signos españoles cuando la frase inglesa era
 * exclamativa/interrogativa entera ("Thou dost see the Crown!" → «¡Veis la Corona!», nunca
 * «Veis ¡la Corona!»). El signo de cierre viaja en la FRASE inglesa (LOOK2.DAT), así que
 * el idioma de origen decide:
 *
 *   - 'en'          → `body` TAL CUAL (ya es "Thou dost see …!", byte-idéntico).
 *   - otro idioma   → si la frase inglesa cerraba en `!`/`?`, envuelve `¡body!` / `¿body?`
 *                     (el valor de es.json se guarda PELADO; el signo lo re-pone aquí).
 *
 * `enForPunct` es la frase INGLESA de la que se lee el cierre (la misma en el genérico; el
 * compuesto base+sufijo en el concat). En 'en' la rama no toca nada ⇒ sin efecto.
 */
export function seeWrap(enForPunct: string, body: string): string {
  if (currentLang === BASE_LANG) return body;
  // Contracción española de preposición+artículo: siempre correcta salvo ante nombre
  // propio «El» (que no aparece en las frases de LOOK2). Resuelve «la Llama de el Amor».
  body = body.replace(/\bde el\b/g, "del").replace(/\ba el\b/g, "al");
  const end = enForPunct.replace(/\s+$/, "").slice(-1);
  if (end === "!") return `¡${body}!`;
  if (end === "?") return `¿${body}?`;
  return body;
}
