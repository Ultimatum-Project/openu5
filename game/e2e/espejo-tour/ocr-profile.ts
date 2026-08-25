/**
 * WALKTHROUGH-ESPEJO — PERFILES DE OCR (calibración del comparador POR CORPUS).
 *
 * El comparador de la fase C estaba calibrado contra UN corpus (aulddragon, `part01..06`):
 * su alfabeto de colapso difuso, su strip de artefactos de pantalla y sus patrones RNG se
 * afinaron con la firma de ESE OCR. El corpus AD (Alex Diener, `ad01..25`) sale de un vídeo
 * con OTRA captura y su OCR tiene una firma DISTINTA — medida sobre los 14 229 divergentes
 * del estreno (2026-07-25):
 *
 *  1. **SEGUNDA PASADA CIFRADA (34% de los divergentes).** Cada línea de consola aparece a
 *     menudo DOS veces: la lectura buena y una lectura-fantasma del MISMO texto en la que los
 *     espacios salen como `"` y los glifos se sustituyen de forma consistente
 *     (`with Crossbow:` → `wTEh"Cr6ggH6wT"`, `Mariah, armed` → `MnrTnh,"nrmgH""`,
 *     `Player: Iolo` → `PlayerT"Iolo"""`, `In the barrel` → `In"the"barrel""`).
 *     No aporta contenido: es la MISMA línea. Se RETIRA (`stripGhostPass`) porque su ruido
 *     rompe el casado por subcadena del bloque entero.
 *  2. **Confusión de glifos propia** (`0pen`/`Vpen`, `Vse`, `Klimb-Vp`, `Eagt`, `Wegt`, `gee`,
 *     `flnd`, `toroh`, `Dvne`, `interest7`): u/v/y y s/g y o/6/c se confunden. Se pliegan a un
 *     representante en el colapso — SIMÉTRICAMENTE (ambos lados del diff), así que el plegado
 *     no «arregla» el OCR: sólo hace que los dos lados caigan en el mismo alfabeto.
 *  3. **Fragmentos truncados/redibujados**: el bloque OCR es la concatenación deduplicada de
 *     redibujados parciales, así que trae truncamientos (`The pocket watc reads 3:28 AM.`) que
 *     rompen una subcadena contigua por UN carácter. Para AD el casado va por COBERTURA-TILING
 *     (teselado greedy de subcadenas comunes ≥minTile): el bloque casa si el transcript cubre
 *     ≥`threshold` de su contenido. Umbral y tile mínimo son la perilla calibrada.
 *  4. **Basura de área gráfica** (`"w'w/\/mt( FV `.. FY `.i JL1`): OCR del sprite/panel, sin
 *     contraparte posible. Categoría PROPIA `ocr-garbage` (no-comparable), como `presentacion`.
 *
 * El perfil de aulddragon (`LP1_PROFILE`) es la IDENTIDAD: mantiene bit-a-bit el comportamiento
 * validado de part01..06 (0 MISS, deltas anclados verdes). Toda la calibración nueva vive en
 * `AD_PROFILE`, así que los números de LP1 NO se mueven al recalibrar AD.
 */

/** Clase de glifos ambiguos: todos los caracteres de `chars` colapsan a `to`. */
export interface GlyphClass {
  chars: string;
  to: string;
}

export interface CoverageMatch {
  /** longitud mínima de tesela común (evita casar por ruido de bigramas) */
  minTile: number;
  /** fracción del bloque que el transcript debe cubrir para dar `match` */
  threshold: number;
  /** longitud colapsada mínima del bloque para admitir cobertura (los cortos van por subcadena) */
  minLen: number;
}

export interface OcrProfile {
  id: string;
  /** clases de glifo del colapso difuso (además de las base) */
  glyphClasses: GlyphClass[];
  /** retirar la segunda pasada fantasma (espacios→`"`) antes de casar */
  stripGhost: boolean;
  /** detectar basura de área gráfica como categoría propia */
  detectGarbage: boolean;
  /** casado por cobertura-tiling (null = sólo subcadena contigua) */
  coverage: CoverageMatch | null;
  /** aplicar la tabla `AD_PENDING` del runner (flujos que el LP2 usó y el runner no conduce). */
  detectAdPending: boolean;
  /**
   * FASE 3c — patrones de COMBATE re-calibrados PARA ESTE CORPUS, probados sobre
   * `probeFold` (no sobre el crudo). Vacío en LP1 = identidad: los patrones históricos de
   * `RNG_AUTO` siguen siendo los únicos que actúan y los números de part01..06 no se mueven.
   */
  combatRng: RegExp[];
  /** reconocer la COLA DE ARMAS huérfana del banner de roster (ver `isRosterTail`). */
  detectRosterTail: boolean;
  /**
   * Si los patrones de combate declasifican TAMBIÉN los bloques con clase CURADA (`exact`).
   * Hace falta en AD porque `segment.mjs` marca la línea de CORTE del combate
   * (`VICTORY!`/`BATTLE IS LOST!`) como `exact` por ser el marcador del tajo — no porque un
   * curador haya dictaminado que deba casar. Ese `exact` CONTRADICE la política de RNG del
   * propio comparador (que declara el desenlace del combate no-comparable) y gana por orden
   * de código. Se cuenta APARTE (`combatCurated`) para que el efecto sea auditable y
   * reversible. LP1 arrastra la misma contradicción (105 bloques) y se deja INTACTA: moverla
   * es un ruling del lead, no una recalibración de corpus.
   */
  combatOverridesCuratedClass: boolean;
  /**
   * FASE 3f — RECONOCEDORES DEL CORPUS LP1 TARDÍO (`part07-24`), en la ÚLTIMA posición del
   * diff. Ver `LATE_*` más abajo: NO añaden ninguna categoría nueva de no-comparable, sólo
   * hacen que las categorías YA ADJUDICADAS (presentación, RNG de combate, flujo no conducido,
   * segunda pasada del OCR) se reconozcan en la caligrafía corrupta de las partes tardías.
   */
  lateRecognizers: boolean;
  /**
   * FASE 3d — POSICIÓN de `sala-diferida` en el diff. `false` (vigente) = en la ÚLTIMA
   * posición, detrás de match/covered/fuzzy y del reconocedor calibrado: sólo puede convertir
   * DIVERGENTE → no-comparable, así que es MONÓTONO sobre `matched` igual que `combat-rng`.
   * `true` = el comportamiento de 3b/3c (clasificar ANTES de intentar casar), que SÍ podía
   * retirar matches reales — se conserva ÚNICAMENTE para que el banco offline reproduzca la
   * línea base y el antes/después sea atribuible a esta palanca y a nada más.
   */
  salaDeferredBeforeMatch: boolean;
  // ==== VENTANA `comparador-bandas` — las CUATRO palancas, separadas para que cada una se
  // ==== pueda aceptar o revertir SOLA (pre-registro: re/notes/comparador-bandas-preregistro.md).
  /**
   * EXCLUSIÓN F-5 — el DESENLACE DE COMBATE de clase CURADA sale del denominador **antes de
   * casar**, gane o pierda su lotería.
   *
   * Sin esto el bloque es una lotería DE UN SOLO FILO: `segment.mjs` le pone `exact` por ser la
   * línea de corte del combate, ese `exact` lo EXIME de `RNG_AUTO` (que declara el desenlace
   * no-comparable para la clase `auto`, `runner.ts`), y la única palanca que lo toca
   * —`combatOverridesCuratedClass`— está en la ÚLTIMA posición. Resultado: si el port pierde un
   * combate justo ahí suma `+1/+1`, y si no, `0/0`. **Sólo sale del denominador cuando pierde.**
   *
   * ⚠ CONTRADICE A PROPÓSITO la doctrina de monotonía del diff (un reconocedor va al final para
   * no poder robar un match). Se admite porque **ese match no es real**: `fichas-f1f2-acta.md`
   * §2.3 lo adjudicó — el LP perdió contra GIANT RATS y el port contra SNAKES, y lo único que
   * casó fue la línea de desenlace, que es la misma se pierda contra lo que se pierda.
   */
  combatOutcomeLottery: boolean;
  /**
   * EXCLUSIÓN — el bloque del SALUDO DE TIENDA sale del denominador antes de casar.
   * `SHOPPES.OVL 0x01b6` elige la plantilla con `rand_range(0,3)` del stream VIVO **por visita**
   * y el port está calcado (`shop-console.ts`), así que con el port PERFECTO el prior de casar
   * es 1/4: los otros 3/4 de `divergent` no son deuda de fidelidad. Ver `shop-saludo-acta.md`.
   * El predicado es estructural (join por `ocrLn` contra el ancla `shop:<Tipo>`) — ver
   * `isShopGreetingBlock` en `shop-greeting.ts`.
   */
  shopGreetingLottery: boolean;
  /**
   * ROBUSTECIMIENTO F4-f — `coverageRatio` MONÓTONA en el transcript. El teselado greedy
   * histórico PIERDE cobertura cuando `T` crece (ver `coverageRatioMonotone`), así que un bloque
   * que el port SÍ dice pasa de `covered` a `divergent` porque el port dijo más cosas en OTRA
   * parte. No es material: es el instrumento.
   */
  coverageMonotone: boolean;
  /**
   * ROBUSTECIMIENTO F4-f — el barrido fuzzy deja de ser una REJILLA anclada en el índice 0
   * (`step = w/6`) y pasa a ser EXACTO (todas las ventanas), con lo que su valor deja de
   * depender de cuántos caracteres haya ANTES del bloque en `T`. Ver `bestDiceWindow`.
   */
  fuzzyExactScan: boolean;
}

/** Clases BASE (las del comparador original, validadas con aulddragon): i-class y o-class. */
const BASE_CLASSES: GlyphClass[] = [
  { chars: "1l|][!", to: "i" },
  { chars: "0O", to: "o" },
];

/** Perfil del corpus canónico = IDENTIDAD (comportamiento validado de part01..06). */
export const LP1_PROFILE: OcrProfile = {
  id: "lp1",
  glyphClasses: [],
  stripGhost: false,
  detectGarbage: false,
  coverage: null,
  detectAdPending: false,
  combatRng: [],
  detectRosterTail: false,
  combatOverridesCuratedClass: false,
  salaDeferredBeforeMatch: false,
  lateRecognizers: false,
  // ══ VENTANA `comparador-bandas` ══
  // EXCLUSIONES — ENCENDIDAS POR RULING DEL LEAD (01-08). La primera entrega las dejó apagadas
  // aquí porque `combatOverridesCuratedClass` declaraba que mover la contradicción de la clase
  // curada en LP1 era un ruling suyo. Ruló, y con el argumento del propio marco de la ventana:
  // **SIMETRÍA** — el mecanismo es idéntico (el desenlace de combate es RNG del port, declarado
  // «difiere por diseño») y **un predicado estructural no puede depender del corpus que mide**.
  // Nótese que en LP1 la exclusión SÍ puede bajar `matched`: aquí hay billetes que hoy casan. Que
  // bajen es CORRECTO por el ruling — es lotería saliendo del numerador Y del denominador a la
  // vez, no conformidad perdida. Medido y descompuesto en `comparador-bandas-acta.md` §10.
  combatOutcomeLottery: true,
  shopGreetingLottery: true, // inerte en LP1 (0 capturas: el censo de anclas da 0), pero el
  //                            predicado no puede depender del corpus — es la misma simetría.
  // ROBUSTECIMIENTOS — siguen APAGADOS en LP1: son otra ficha (F4-f), el lead no ha rulado sobre
  // ellos, y encenderlos movería las cifras archivadas de LP1 por un motivo ajeno a este ruling.
  coverageMonotone: false,
  fuzzyExactScan: false,
};

// ==================================================================================
// FASE 3c — RECALIBRACIÓN DE LOS PATRONES DE COMBATE PARA EL CORPUS AD
// ==================================================================================
/**
 * NORMALIZACIÓN DE PRUEBA de patrones del perfil AD — **para PROBAR, jamás para CASAR**
 * (gemela del `ocrFriendly` histórico del runner, que existe con ese mismo propósito).
 *
 * A diferencia de `collapseWith`, CONSERVA la puntuación, porque la puntuación ES parte de
 * la firma del combate: la coma del banner de roster («Iolo, armed with…»), el `!` de las
 * tiradas («Troll missed!») y el `:` de cierre del banner. Y a diferencia del colapso de
 * casado, pliega además **a↔u**, que es la confusión DOMINANTE del OCR de Diener y la que
 * multiplicaba cada patrón de combate por sus variantes (`Attack-Alm!` / `Attuck-Alm!` /
 * `Attuok-Alm!` / `Attaok-Alm!` → UNA forma canónica `uttuok-uim!`).
 *
 * Por qué plegar a↔u aquí es seguro y no lo sería en el casado: estos patrones sólo
 * DECLASIFICAN (sacan un bloque del denominador por RNG declarado). No pueden fabricar un
 * `match` — el plegado agresivo en el casado sí lo haría (haría colisionar «cat» con «cut»),
 * y por eso NO entra en `glyphClasses`.
 */
export function probeFold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[1l|\][]/g, "i") // i-class SIN el `!` (que aquí es firma, no ruido)
    .replace(/[0o6c]/g, "o")
    .replace(/[vya]/g, "u") // v/y→u (clase del perfil) + a↔u (confusión dominante de AD)
    .replace(/g/g, "s");
}

/**
 * VOCABULARIO DE ARMAMENTO del port, para reconocer la COLA huérfana del banner de roster.
 * Son las palabras de `EQUIP_NAMES` (`main.ts:2596` = `InventoryDetails.json` → `Armament`,
 * el MISMO origen que el banner imprime) más el conector « with » (DS 0x6da4) y el
 * «bare hands» del caso sin arma (DS 0x6db2). Va en forma `probeFold`.
 *
 * Se declara inline (misma doctrina que el vocabulario cerrado de `derive-dungeon-ops.mjs`)
 * y un unit test lo CAREA contra `InventoryDetails.json`, así que no puede quedar desfasado
 * en silencio si el core cambia la tabla.
 */
const EQUIP_WORDS_RAW = [
  "with", "bare", "hands",
  "leather", "chain", "coif", "iron", "spiked", "helm", "small", "large", "shield",
  "magic", "jewel", "jeweled", "cloth", "armour", "ringmail", "scale", "mail", "plate",
  "mystic", "dagger", "sling", "club", "flaming", "oil", "main", "gauche", "spear",
  "throwing", "axe", "short", "sword", "mace", "morning", "star", "bow", "arrows",
  "crossbow", "quarrels", "long", "two", "hhammer", "haxe", "hsword", "halberd",
  "swordof", "chaos", "silver", "glass", "ring", "invisibility", "protection",
  "regeneration", "amulet", "of", "turning", "collar", "ankh",
];
export const EQUIP_WORDS: ReadonlySet<string> = new Set(EQUIP_WORDS_RAW.map(probeFold));

/** Distancia de edición acotada (≤`max`); corta en cuanto se pasa. PURA. */
function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      best = Math.min(best, cur[j]!);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

/** ¿Es `w` (ya en `probeFold`) una palabra del armamento del port, tolerando 1 error de OCR? */
function isEquipWord(w: string): boolean {
  if (!w) return false;
  if (EQUIP_WORDS.has(w)) return true;
  // tolerancia de UN error de OCR sólo en palabras largas: en 2-4 caracteres la distancia 1
  // casa casi cualquier cosa y el vocabulario dejaría de ser cerrado.
  if (w.length < 5) return false;
  for (const v of EQUIP_WORDS) if (v.length >= 5 && editDistanceAtMost(w, v, 1)) return true;
  return false;
}

/**
 * COLA DE ARMAS HUÉRFANA del banner de roster. El port emite UNA línea
 * «<Nombre>, armed with <casco, izq, dcha>:» (`main.ts:1219`, COMBAT.OVL 0x0701-0x07af,
 * cierre `:` = DS 0x6dbe) pero el OCR de Diener la parte en dos lecturas, y la SEGUNDA no
 * lleva ni el nombre ni la palabra `armed` — sólo la lista de armas y el `:`:
 * «with Halberd:» (347×) · «with Magic Axe:» · «Magic Axe:» · «Gauche, Short Sword:» ·
 * «Sword:» · «wlth Hulberd:». Sin este reconocedor son el racimo de divergentes MÁS GRANDE
 * del corpus AD, y son instrumento puro: el port SÍ dijo la línea, entera.
 *
 * CONSERVADOR por construcción — se exige que el bloque ENTERO sea vocabulario cerrado de
 * armamento del port terminado en `:`. Una sola palabra ajena lo descalifica, así que no
 * puede comerse diálogo de NPC ni un eco de comando (un «Search-East Sword:» sigue
 * DIVERGENTE: no se barre un bloque que arrastra material comparable).
 */
export function isRosterTail(text: string): boolean {
  const t = text.trim();
  if (!t.endsWith(":")) return false;
  const words = probeFold(t.slice(0, -1)).split(/[\s,.]+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;
  return words.every(isEquipWord);
}

/**
 * PATRONES DE COMBATE del corpus AD, sobre `probeFold`. Cada uno es la RE-ESCRITURA del
 * patrón que `RNG_AUTO` ya tiene para LP1 — la misma semántica, la ortografía del OCR de
 * Diener. No se añade ninguna clase de bloque NUEVA a lo no-comparable: lo que el
 * comparador ya declaraba RNG del mundo en LP1 (banner de roster, aim, tiradas, desenlace,
 * jugador activo, huida) se declara RNG también cuando AD lo escribe distinto.
 */
export const AD_COMBAT_RNG: RegExp[] = [
  /**
   * 1. BANNER DE ROSTER partido. Ancla en la COMA (o su lectura `.`/`:`) que precede a
   * `armed`, no en la palabra desnuda: así quedan FUERA los dos únicos usos no-combate de
   * «armed» del corpus, que son material comparable legítimo —
   *   · el discurso de resurrección del santuario («"Well armed art thou to fight Death's
   *     embrace…"», `core/game.ts:3963`), y
   *   · el acertijo del Shadowlord («…at the mercy of one armed with such»).
   * Medido: 10 955 bloques con coma / 46 sin ella.
   */
  /[,.:;]\s*urmed\b/,
  /** 2. AIM del ataque (LP1: `/attack-aim/`). 4 variantes de AD → una forma canónica. */
  /uttuok[-\s]*uim/,
  /** 3. indicador de jugador activo del bucle de combate (LP1: `/set active plr/`). */
  /set\s+uotiue\s+pir/,
  /**
   * 4. RESULTADOS DE TIRADA (LP1: `killed|ki]led|kiiied|wounded|grazed|critical|\w+ hit!`).
   * El `!` es obligatorio: es lo que distingue el eco de la tirada de la palabra suelta.
   */
  /\b(?:hit|missed|miss|wounded|sruzed|kiiied|oritioui|bureiu|iishtiu|heuuiiu)!/,
  /**
   * 5. DESENLACE del combate (LP1: `victory|battle is lost|battie`). **Sin** el `battie`
   * DESNUDO de LP1: en AD barría «…more than 23 gp for that battle-worn shield» — un
   * regateo de tienda, material comparable de verdad. Se exige el « is lost» completo.
   */
  /uiotoru!|buttie\s+is\s+iost/,
  /** 6. HUIDA del PJ del arena (SJOG 0x1c37 «Escape!», `core/sfx.ts:251`). Bloque ENTERO. */
  /^esoupe!?$/,
];

/**
 * Perfil del corpus AD. Las clases extra salen del censo de divergentes del estreno:
 *  · `uvy` → u : `Vpen`/`Vse`/`Klimb-Vp`/`F]v West`(=Fly) / `Y6ur`… la V del OCR de AD es
 *    sumidero de U, O y Y. Se pliega con u (y la o-class absorbe la variante `0pen`).
 *  · `sg`  → s : `Eagt`(East) `Wegt`(West) `gee`(see) `dvgt`(dost) `gnog`(snos…).
 *  · `c`   → o : `toroh`(torch) `Watoh`(watch) — la c de AD cae en o.
 *  · `6`   → o : `Y6ur` `Cr6ggH6w` — ya en la o-class extendida.
 * Simétrico: el port también se pliega, así que el plegado no inventa coincidencias, sólo
 * mete a los dos lados en el mismo alfabeto reducido.
 */
export const AD_PROFILE: OcrProfile = {
  id: "ad",
  glyphClasses: [
    { chars: "6c", to: "o" },
    { chars: "vy", to: "u" },
    { chars: "g", to: "s" },
  ],
  stripGhost: true,
  detectGarbage: true,
  coverage: { minTile: 5, threshold: 0.85, minLen: 10 },
  detectAdPending: true,
  combatRng: AD_COMBAT_RNG,
  detectRosterTail: true,
  combatOverridesCuratedClass: true,
  salaDeferredBeforeMatch: false,
  lateRecognizers: false,
  combatOutcomeLottery: true,
  shopGreetingLottery: true,
  coverageMonotone: true,
  fuzzyExactScan: true,
};

/**
 * Perfil AD **congelado en el estado de 3b** (sin la recalibración de combate de 3c). No se
 * usa en la suite: es la LÍNEA BASE del banco de calibración offline, para que el antes/después
 * de 3c se mida sobre el mismo transcript cambiando SÓLO las palancas de 3c — comparar contra
 * `LP1_PROFILE` mezclaría el efecto de 3c con el de toda la calibración de corpus anterior.
 */
export const AD_PRE3C_PROFILE: OcrProfile = {
  ...AD_PROFILE,
  id: "ad-pre3c",
  // ⚠ Las cuatro palancas de `comparador-bandas` se HEREDAN del spread, y es deliberado: una
  // línea base existe para que el antes/después sea atribuible A SU PROPIA palanca y a nada más,
  // así que tiene que diferir del perfil VIGENTE sólo en ella. Congelarlas aquí (primer intento
  // de esta ventana) rompía justamente eso, y el test «difiere en UNA SOLA palanca» lo cazó.
  // El brazo «antes» de ESTA ventana es `AD_PRE_BANDAS_PROFILE`, más abajo.
  combatRng: [],
  detectRosterTail: false,
  combatOverridesCuratedClass: false,
  // 3b clasificaba la sala ANTES de casar: la línea base tiene que reproducirlo, o el
  // «antes» de 3c dejaría de ser el 3b real (misma razón que `detectAdPending`).
  salaDeferredBeforeMatch: true,
};

/**
 * Perfil AD **congelado en el estado de 3c** — difiere de `AD_PROFILE` en UNA SOLA palanca:
 * `sala-diferida` clasificando antes de casar. Es la línea base del deber previo de 3d, para
 * que el efecto de mover el reconocedor de sala a la última posición se mida sobre el mismo
 * transcript y no se confunda con nada más.
 */
export const AD_PRE3D_PROFILE: OcrProfile = {
  ...AD_PROFILE,
  id: "ad-pre3d",
  salaDeferredBeforeMatch: true,
  // Ver AD_PRE3C_PROFILE: las palancas de `comparador-bandas` se HEREDAN (una línea base difiere
  // del vigente en SU palanca y en ninguna otra).
};

/**
 * Perfil LP1 **congelado justo ANTES de la ventana `comparador-bandas`** — el brazo «antes» del
 * A/B de LP1, idéntico a `LP1_PROFILE` salvo en las dos exclusiones que el ruling del lead del
 * 01-08 encendió. No es una foto histórica: difiere del VIGENTE sólo en lo que se mide.
 */
export const LP1_PRE_BANDAS_PROFILE: OcrProfile = {
  ...LP1_PROFILE,
  id: "lp1-pre-bandas",
  combatOutcomeLottery: false,
  shopGreetingLottery: false,
};

/**
 * Perfil AD **congelado justo ANTES de la ventana `comparador-bandas`** — difiere de `AD_PROFILE`
 * en las CUATRO palancas de esta ventana y en NADA más. Es el brazo «comparador VIEJO» del A/B:
 * con `ESPEJO_DUMP=1` en disco, `diffSegment` (que es PURO) se re-corre sobre los MISMOS bytes de
 * transcript con este perfil y con el vigente, así que el delta es atribuible al comparador y
 * **el ruido run-to-run del port es estructuralmente imposible** (no hay dos corridas).
 */
export const AD_PRE_BANDAS_PROFILE: OcrProfile = {
  ...AD_PROFILE,
  id: "ad-pre-bandas",
  combatOutcomeLottery: false,
  shopGreetingLottery: false,
  coverageMonotone: false,
  fuzzyExactScan: false,
};

// ==================================================================================
// FASE 3f — RECONOCEDORES DEL CORPUS LP1 TARDÍO (part07-24)
// ==================================================================================
/**
 * EL HALLAZGO QUE OBLIGA A ESTO. `LP1_PROFILE` es la identidad porque se validó contra
 * `part01..06`, cuyo OCR está limpio. El OCR de `part07..24` del MISMO LP **no lo está**: es
 * una captura distinta, con la misma familia de confusiones que motivó el perfil AD
 * (`Eagt`=East, `Wcgt`=West, `8outh`=South, `Nvrth`=North, `Z-gtatg`=Z-stats, `P]aycr1`=Player:,
 * `Rcadv,,.`=Ready..., y la SEGUNDA PASADA con espacios→`"`). Medido sobre los 16 256
 * divergentes de part09-18: el 17% trae la firma de segunda pasada y el racimo mayor es el
 * panel de estado escrito ilegible.
 *
 * QUÉ HACEN Y QUÉ NO. Estos reconocedores **NO añaden ninguna categoría nueva** a lo
 * no-comparable: reconocen en caligrafía corrupta EXACTAMENTE las cuatro que el comparador ya
 * declara no-comparable con caligrafía limpia — `PRESENTATION_ONLY` (canal sólo-pantalla),
 * `RNG_AUTO` (RNG de combate), `AD_PENDING` (flujo que el runner no conduce) y `stripGhost`
 * (segunda pasada). Es la doctrina de 3c aplicada al corpus tardío de LP1.
 *
 * DÓNDE VAN: en la ÚLTIMA posición del diff, detrás de match/covered/fuzzy y del reconocedor
 * de combate de 3c. Sólo pueden convertir DIVERGENTE → no-comparable; **el numerador no puede
 * moverse ni un bloque**, y eso está blindado por test sobre el corpus entero, no por prosa.
 *
 * QUÉ SE DEJA FUERA A PROPÓSITO (y es la parte importante del diseño — ver el acta
 * `re/notes/espejo-3f-resultado.md`):
 *  · **`Fly`/`Ride`/`Row <rumbo>`** (2 794 bloques, el racimo #2). El binario SÍ imprime el
 *    verbo del vehículo — MAINOUT `transport_face` 0x00DA despacha 0x10→«Ride », 0x14→«Fly »,
 *    0x28→«Row », 0x20/0x24→«Head » (frontier.json; re/notes/transport.md:45) — y el port
 *    imprime SÓLO el rumbo (`game.ts:958`, `DIR_NAMES[dir]`, sin verbo). Es un HUECO DEL PORT
 *    real, cazado por el espejo. Retirarlo del denominador sería la AUTO-ABSOLUCIÓN exacta que
 *    el doc de diseño marca como el riesgo serio de esta fase.
 *  · **rumbos a pie, `Head <rumbo>` y `Pass`**: el port los emite (`game.ts:958`, `:1502`,
 *    `:1852`). Son material comparable de verdad; si divergen, es deriva o OCR, no categoría.
 *  · **`Ready...`** suelto: el port lo emite (`main.ts:2121`, DS 0xa1f0). Sólo se retira el
 *    bloque cuando es el PANEL ENTERO y nada más (ver `isLateStatusPanel`).
 */

/**
 * Plegado del corpus LP1 TARDÍO — **para CLASIFICAR, jamás para CASAR** (misma doctrina y mismo
 * aviso que `probeFold`). Las confusiones se leen del censo de divergentes: `c`→`o` (`Rcady`,
 * `Wcst`, `Hcad`), `6`→`o`, `v`/`y`→`u` (`Nvrth`, `F]y`), `g`/`8`→`s` (`Eagt`, `8outh`),
 * i-class (`P]aycr`), y `e`→`o` porque la `e` de esta captura se lee `c` la mitad de las veces
 * y `c` ya cae en `o`. Agresivo A PROPÓSITO: sólo declasifica, nunca fabrica un match.
 */
export function lateFold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[1l|\][]/g, "i")
    .replace(/[0c6e]/g, "o")
    .replace(/[vy]/g, "u")
    .replace(/[g8]/g, "s")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/**
 * VOCABULARIO CERRADO del PANEL DE ESTADO (Ztats / hoja de personaje / picker de Ready), en
 * forma `lateFold`. Los rótulos son los que `PRESENTATION_ONLY` ya declara canal sólo-pantalla
 * («Z-stats/hoja de personaje (overlay `Select:` + Player/Status)»); los valores son la MISMA
 * lista de miembros de party que usa ese patrón, más `none`.
 */
const LATE_PANEL_RAW = [
  "z", "stats", "zstats", "select", "player", "status", "item", "ready",
  "min", "shamino", "iolo", "jaana", "julia", "gwenno", "none",
];
const LATE_PANEL: ReadonlySet<string> = new Set(LATE_PANEL_RAW.map((w) => lateFold(w)));

/** Distancia de edición acotada (≤`max`). PURA. Gemela de la de `isEquipWord`. */
function editAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      best = Math.min(best, cur[j]!);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

/** ¿Es `w` (ya plegado) una palabra del vocabulario del panel, con tolerancia por longitud? */
function isPanelWord(w: string): boolean {
  if (LATE_PANEL.has(w)) return true;
  if (w.length < 4) return false; // en ≤3 la distancia casa casi cualquier cosa
  const max = w.length >= 6 ? 2 : 1;
  for (const v of LATE_PANEL) if (v.length >= 4 && editAtMost(w, v, max)) return true;
  return false;
}

/**
 * PANEL DE ESTADO ENTERO y nada más. Conservador por construcción, con la MISMA estrechez que
 * el ruling que estrechó `PRESENTATION_ONLY` tras el spot-check del lead: se exige que TODAS
 * las palabras del bloque sean vocabulario cerrado del panel. Una sola palabra ajena lo
 * descalifica, así que «Search-South Player: Min Thou dost find a weapon!» sigue DIVERGENTE —
 * arrastra un resultado que el port sí registra y no se puede barrer con el panel.
 *
 * La segunda pasada del OCR se retira ANTES de plegar (`stripGhostPass`): es re-lectura de la
 * misma línea y su ruido rompía el vocabulario. Aquí sólo sirve para CLASIFICAR — el bloque no
 * se re-intenta casar con el texto limpiado, que sería relajación.
 */
export function isLateStatusPanel(text: string): boolean {
  const words = lateFold(stripGhostPass(text)).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const meat = words.filter((w) => w.length >= 2); // partículas de 1 letra = ruido del OCR
  if (meat.length === 0) return false;
  return meat.every(isPanelWord);
}

/**
 * RNG DE COMBATE del corpus tardío, sobre `lateFold`. Cada patrón es la re-escritura de uno
 * que `RNG_AUTO` (runner.ts) ya declara no-comparable para LP1 limpio: banner de roster, aim
 * del ataque, jugador activo del bucle, resultados de tirada y desenlace. No se declara nada
 * nuevo: se reconoce lo mismo en otra caligrafía.
 */
export const LATE_COMBAT_RNG: RegExp[] = [
  /[,.:;]?\s*armod\b|\barmod\s+with\b/, // «…, armed with …» (armed→armod por e→o)
  /att[au]ok[-\s]*aim/, // Attack-Aim!
  /sot\s+aotiuo\s+pir/, // «Set active plr»
  /\b(?:hit|missod|miss|woundod|srazod|kiiiod|oritioai|oscapos)\b/,
  /uiotoru|battio\s+is\s+iost/, // VICTORY! / battle is lost
];

/**
 * FLUJOS QUE EL RUNNER NO CONDUCE, en caligrafía tardía. Es la tabla `AD_PENDING` del runner
 * (ya adjudicada para el corpus AD) reconocida sobre `lateFold`: el runner no teclea Quit, no
 * navega el menú de acampada y la gema está diferida por RULING. Su ausencia del transcript es
 * hueco de ARNÉS, no divergencia del port.
 */
export const LATE_PENDING: Array<{ re: RegExp; flow: string }> = [
  { re: /quit\s*sauo\s*samo|sauo\s+samo/, flow: "Quit-save (el runner no teclea Q)" },
  { re: /hoio\s+up|for\s+how\s+manu\s+hours|wiit\s+thou\s+sot\s+watoh|who\s+wiii\s+stand/, flow: "Hole up & camp (menú de horas/guardia)" },
  { re: /uiow\s+a\s+som|som\s+shows|no\s+soms/, flow: "(V)iew gema de mazmorra (diferida por ruling)" },
];

/**
 * Perfil del corpus LP1 **TARDÍO** (part07-24). Idéntico a `LP1_PROFILE` salvo la palanca de
 * 3f, para que el antes/después sea atribuible a ESA palanca y a nada más — misma disciplina
 * que `AD_PRE3C_PROFILE`/`AD_PRE3D_PROFILE`.
 */
export const LP1_LATE_PROFILE: OcrProfile = {
  ...LP1_PROFILE,
  id: "lp1-3f",
  lateRecognizers: true,
};

/**
 * FASE 3h — PERFIL DEL CORPUS LP1 **TARDÍO** (`part07-24`), con las clases de glifo que
 * SOBREVIVIERON a la guarda de colisiones.
 *
 * A diferencia de 3f (que era monótona y sólo retiraba del denominador), esto **sube el
 * numerador**: hace que bloques hoy DIVERGENTES casen. Por eso el conjunto de clases NO se eligió
 * por lo que sube, sino por una propiedad del vocabulario del port, medida ANTES de ver ningún
 * porcentaje (`tools/guarda-colisiones-3h.ts`, censo cerrado en el commit anterior):
 *
 * | clase | veredicto | por qué |
 * |---|---|---|
 * | `vy→u` | ACEPTADA | «Nvrth»=North, «F]y»=Fly, «Dvgt»=Dost — 0 colisiones nuevas |
 * | `6c→o` | ACEPTADA | «Wcst»=West, «Hcad»=Head, «Y6ur»=Your — 0 colisiones nuevas |
 * | `8→s`  | ACEPTADA | «8outh»=South, «8tatus»=Status — 0 colisiones nuevas |
 * | `g→s`  | **RECHAZADA** | colisiona `"\nSold!\n"` ≡ `"{} gold!"` y `"G:"` ≡ `"S\n\n"` |
 * | `e→o`  | **RECHAZADA** | inocua SOLA, pero con `6c→o` colisiona `"Cast...\n"` ≡ `"East"` |
 *
 * El plegado es SIMÉTRICO (`collapseWith` se aplica a los dos lados del diff), así que no
 * «arregla» el OCR del LP hacia el port: mete a los dos en el mismo alfabeto reducido.
 *
 * `LP1_PROFILE` queda INTACTO: los números validados de `part01-06` sólo se mueven si alguien
 * pide este perfil explícitamente.
 */
export const LP1_TARDIO_PROFILE: OcrProfile = {
  ...LP1_LATE_PROFILE,
  id: "lp1-tardio",
  glyphClasses: [
    { chars: "vy", to: "u" },
    { chars: "6c", to: "o" },
    { chars: "8", to: "s" },
  ],
};

/**
 * PERFIL DEL CORPUS LF (Lord Fenton, 3ª playlist, 33 episodios) — carril `fenton-curacion`.
 *
 * Es `LP1_PROFILE` **más exactamente dos detectores**, y ninguno de los dos es AD-específico:
 *
 *  · `stripGhost` — la segunda pasada FANTASMA (`\S"\S`, espacio leído como `"`). El piloto de
 *    Fenton la midió como su clase de aproximación DOMINANTE, con ejemplos verbatim en
 *    `re/notes/fenton-piloto.md` §3.3(a): `~Hole"up"&"camp`, `hours?"(1-9)"9"`,
 *    `above"thee"the"`. Es el MISMO mecanismo que en AD (re-lectura de la misma línea de
 *    consola mientras la ventana de scroll se redibuja), no una firma del vídeo de Diener.
 *  · `detectGarbage` — el reconocedor de línea ilegible. El escalado midió 5,7 % de BASURA en
 *    474 líneas careadas a ojo (`fenton-escalado.md` §2) en clases localizadas (top-edge,
 *    ghost-scroll, cartela de recap); dejarlas en el denominador es meter instrumento.
 *
 * 🔴 Lo que este perfil NO trae, a propósito: `glyphClasses` propias (las de AD —`6c→o`,
 * `vy→u`, `g→s`— están calibradas contra el OCR de Diener y NO se han medido aquí),
 * `detectAdPending`, `combatRng` ni `detectRosterTail`. lf30 no tiene un solo segmento de
 * combate, así que los tres serían inertes en la medición de este carril y encenderlos sin
 * calibrar sería importar la calibración de otro corpus. **La derivación de las clases de
 * glifo de Fenton queda declarada como trabajo NO hecho** (los ejemplos del corpus apuntan a
 * una clase de vocal→`v` / `s`→`$` / `g`→`9` que nadie ha medido: `Prv9rv$$:` = «Progress!»,
 * `9vv$h` = «South»).
 */
export const LF_PROFILE: OcrProfile = {
  ...LP1_PROFILE,
  id: "lf",
  stripGhost: true,
  detectGarbage: true,
};

export const PROFILES: Record<string, OcrProfile> = {
  "lp1-tardio": LP1_TARDIO_PROFILE,
  lp1: LP1_PROFILE,
  lf: LF_PROFILE,
  "lp1-3f": LP1_LATE_PROFILE,
  "lp1-pre-bandas": LP1_PRE_BANDAS_PROFILE,
  ad: AD_PROFILE,
  "ad-pre3c": AD_PRE3C_PROFILE,
  "ad-pre3d": AD_PRE3D_PROFILE,
};

/** Perfil por id (default lp1: el comparador NO cambia si nadie lo pide). */
export function profileFor(id: string | undefined): OcrProfile {
  return (id && PROFILES[id]) || LP1_PROFILE;
}

/** Tabla de traducción char→char del perfil (base + clases del perfil). */
function foldTable(profile: OcrProfile): Map<string, string> {
  const m = new Map<string, string>();
  for (const cls of [...BASE_CLASSES, ...profile.glyphClasses])
    for (const ch of cls.chars) m.set(ch, cls.to);
  return m;
}
const FOLD_CACHE = new Map<string, Map<string, string>>();
function fold(profile: OcrProfile): Map<string, string> {
  let t = FOLD_CACHE.get(profile.id);
  if (!t) {
    t = foldTable(profile);
    FOLD_CACHE.set(profile.id, t);
  }
  return t;
}

/**
 * Colapso difuso del perfil: minúsculas → plegado de clases → sólo `[a-z2-9]`.
 * Con `LP1_PROFILE` es EXACTAMENTE el `collapse` histórico (i-class + 0/O→o).
 */
export function collapseWith(s: string, profile: OcrProfile): string {
  const t = fold(profile);
  let out = "";
  for (const ch of s.toLowerCase()) {
    const f = t.get(ch) ?? t.get(ch.toUpperCase()) ?? ch;
    if (f >= "a" && f <= "z") out += f;
    else if (f >= "2" && f <= "9") out += f;
  }
  return out;
}

/**
 * SEGUNDA PASADA FANTASMA del OCR de AD: retira los runs de tokens unidos por comillas
 * INTERNAS (`\S"\S` — espacio leído como `"`), que son una re-lectura de la MISMA línea de
 * consola, más las colas de comillas sueltas. NO toca las comillas legítimas del texto del
 * juego (`"I thank thee!" says Nilrem.`): ahí la comilla de apertura va precedida de espacio
 * o inicio y la de cierre seguida de espacio, nunca flanqueada por no-espacios a ambos lados.
 */
export function stripGhostPass(text: string): string {
  const tokens = text.split(/\s+/);
  const kept = tokens.filter((tok) => !/[^\s"]"[^\s"]/.test(tok));
  return kept
    .join(" ")
    .replace(/"{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * BASURA DE ÁREA GRÁFICA: OCR del sprite/panel/marco, sin texto de consola detrás
 * (`"w'w/\/mt( FV `.. FY `.i JL1 ? .j;`). Heurística conservadora — se exige que el bloque
 * NO contenga ninguna palabra alfabética de ≥4 letras y que su densidad de puntuación sea
 * alta; así ningún eco real («Blocked!», «Opened!») cae aquí.
 */
export function isGarbage(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return false;
  const words = t.match(/[A-Za-z]{4,}/g) ?? [];
  if (words.length > 0) return false;
  const punct = (t.match(/[^A-Za-z0-9\s]/g) ?? []).length;
  return punct / t.length >= 0.3;
}

/**
 * COBERTURA POR TESELADO GREEDY: fracción de `needle` cubierta por subcadenas comunes con
 * `hay` de longitud ≥ `minTile`, consumidas de izquierda a derecha (Greedy String Tiling
 * simplificado). Robusto a los truncamientos y a los fragmentos duplicados del OCR de AD:
 * el bloque no tiene que aparecer CONTIGUO, sólo estar cubierto por trozos largos.
 * Devuelve 0..1. PURO.
 */
export function coverageRatio(needle: string, hay: string, minTile: number): number {
  if (needle.length === 0) return 1;
  let covered = 0;
  let i = 0;
  while (i < needle.length) {
    // tesela más larga que empieza en i y existe en hay
    let len = 0;
    // búsqueda por extensión: crece mientras la subcadena siga apareciendo
    while (i + len < needle.length && hay.includes(needle.slice(i, i + len + 1))) len++;
    if (len >= minTile) {
      covered += len;
      i += len;
    } else {
      i += 1; // carácter no cubierto (ruido OCR / truncamiento)
    }
  }
  return covered / needle.length;
}

/**
 * COBERTURA MONÓTONA (ventana `comparador-bandas`, ficha F4-f) — la MISMA definición que el
 * docstring de `coverageRatio` declara, computada de verdad.
 *
 * 🔴 EL DEFECTO QUE ARREGLA. El teselado greedy de arriba consume `needle` tomando la tesela MÁS
 * LARGA que empieza en cada posición y saltando su longitud. Añadir texto a `hay` puede alargar
 * una tesela, DESALINEAR el resto del teselado y PERDER cobertura — o sea, `coverageRatio` NO ES
 * MONÓTONA en `hay`, con `hay2 ⊃ hay1` y todo:
 *
 *     needle="ABCDEF", minTile=3
 *       hay1 = "xxABCxxDEFxx"        → 1.000   («ABC» + «DEF»)
 *       hay2 = "xxABCxxDEFxxABCD"    → 0.667   ← ¡superconjunto de hay1!
 *
 * En el espejo eso significa que un bloque que el port SÍ dice puede caer de `covered` a
 * `divergent` **porque el port dijo más cosas en otra parte del segmento** — el churn de F4-f
 * (11 de los 23 bloques que perdían casado en `anclas-f4-acta.md` §6.5 eran `covered→divergent`).
 * No es material que diverja: es el instrumento midiendo distinto el mismo material.
 *
 * LA DEFINICIÓN, y por qué basta con ventanas de longitud EXACTA `minTile`: una posición está
 * cubierta ⇔ existe alguna subcadena de `needle` de longitud ≥ `minTile` que la contiene y que
 * aparece en `hay`. Si una tesela de longitud L > minTile está en `hay`, TODA ventana de
 * `minTile` dentro de ella también está en `hay` (una subcadena de una subcadena es subcadena),
 * y esas ventanas cubren la tesela entera. ⇒ barrer sólo las ventanas de longitud `minTile` da
 * EXACTAMENTE el mismo conjunto cubierto, en `n` comprobaciones en vez del greedy.
 *
 * MONOTONÍA (la propiedad que se busca): `hay1 ⊆ hay2` ⇒ toda ventana presente en `hay1` lo está
 * en `hay2` ⇒ el conjunto cubierto sólo puede crecer. Blindada por test.
 * PURO.
 */
export function coverageRatioMonotone(needle: string, hay: string, minTile: number): number {
  if (needle.length === 0) return 1;
  if (needle.length < minTile) return 0;
  const cov = new Array<boolean>(needle.length).fill(false);
  for (let a = 0; a + minTile <= needle.length; a++) {
    if (!hay.includes(needle.slice(a, a + minTile))) continue;
    for (let p = a; p < a + minTile; p++) cov[p] = true;
  }
  let n = 0;
  for (const c of cov) if (c) n++;
  return n / needle.length;
}
