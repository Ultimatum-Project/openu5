/**
 * ALIAS ESPAÑOLES de keywords de Talk (i18n §3.1). DATA AUTORADA (tracked como es.json),
 * NO extraída → vive en src/i18n/, no en game/assets (que es gitignored/extraído).
 *
 * PROBLEMA: el motor DOS casa la keyword del TLK como SUBcadena inglesa del input
 * (`conversation.ts` keywordMatches/stristrIndex, ULTIMA.EXE 0x6f1e). Las keywords son
 * PREFIJOS de palabras inglesas ("tele"→telescope, "star", "shad"→shadowlord). Un jugador
 * en español teclea "estrella", no "star" → la keyword no casa y el diálogo se rompe.
 *
 * SOLUCIÓN (aprobada): tabla de alias GLOBAL por STRING de keyword inglesa → prefijos
 * españoles que el jugador teclearía. El matcher prueba SIEMPRE la keyword inglesa (invariante
 * lang=en byte-idéntico) y, con lang=es, TAMBIÉN estos alias. Global (no por-qa) porque las
 * 1.315 keywords dedupean a un puñado de strings únicos ("name"/"job"/"bye" en casi todos los
 * 135 NPCs) — el canon traduce "job"→"trab" UNA vez. Las colisiones por-NPC se resuelven con
 * `ALIAS_ES_BY_NPC` (override puntual) y las caza el test de unicidad.
 *
 * ⚠ SEMILLA: esto es el glosario de ARRANQUE para probar la ingeniería. La DATA completa (los
 * ~unique prefijos de las 1.315 keywords) es CANON del carril i18n — se rellena por lámina.
 * NO tocar es.json desde aquí. Excluidos (mecánica, §3.2-3.4): sílabas de hechizo, mantras,
 * palabras de poder, nombres propios y contraseñas (IMPERA/DAWN) — sin alias, inglés-only.
 */

/**
 * Alias GLOBAL: keyword inglesa (tal cual está en el TLK, minúsculas) → prefijos españoles.
 * Cada valor es un prefijo que el jugador teclearía; se casa por el MISMO stristr que la
 * keyword inglesa (subcadena en frontera, sobre el input truncado a 15). SEMILLA glosario.
 */
export const KEYWORD_ALIAS_ES: Readonly<Record<string, readonly string[]>> = {
  // Glosario ES de keywords de Talk (i18n §3.1). Poblado por el carril i18n-cities desde el
  // censo del TLK de las locs traducidas (24, 23, 9-16, 17, 18) + semilla §3.1 (name/job/bye/
  // join/health/star/tele/shad). Alias = prefijos SIN acentos/ñ: el foldChar de
  // conversation.ts ignora el CASO pero NO el acento (0xf3→0x73), así que el prefijo debe
  // cortar ANTES de cualquier vocal acentuada/ñ para casar lo que teclea el jugador. El inglés
  // SIEMPRE matchea; estos alias se AÑADEN. Nombres propios, mecánica (dawn/vas/summ/codex) y
  // genéricos ambiguos → SIN alias (inglés-only, seguro). CERO colisiones de prefijo:
  // validado con aliasCollisionsForNpc sobre TODOS los NPCs de talk/*.json (método del test).
  // Colisiones resueltas en la propia tabla global (sin necesidad de overrides por-NPC):
  // chef→"cocine" (vs kitc→"cocina"), ship→"barco/buque" (evita nave⊂navega), armo→"coraza"
  // (evita arma⊂armad), husb→"conyu" (evita mar⊂marid), y «mari» sin alias (el inglés "mari"
  // ya casa "marino/marinero", y "mar"=sea no debe prefijar a mariner).
  abys: ["abism"], acci: ["accid"], aid: ["auxil"], air: ["aero"], alch: ["alqui"],
  amat: ["afici"], armo: ["coraza"], ask: ["pregu"], banq: ["banqu"], batt: ["batal", "comba"],
  belo: ["abaj"], bind: ["abraz"], blok: ["sujet"], bloo: ["sangu"], bott: ["botel"],
  box: ["caja"], brea: ["romp"], bree: ["raza"], brut: ["salvaj"], busi: ["asunt"],
  bye: ["adio", "adiós"], capt: ["capit"], cast: ["casti"], cave: ["cavern"], cham: ["aposen"],
  chef: ["cocine"], chil: ["chic"], chor: ["quehac"], clim: ["escal", "trep"],
  coin: ["moned", "acun"], cold: ["frio"], comp: ["compo"], cook: ["guiso"], coun: ["conse"],
  cour: ["corte"], crim: ["delit"], crot: ["cascarr"], crys: ["crist"], daem: ["demon"],
  dagg: ["daga"], dang: ["peli"], dark: ["oscur"], day: ["dia"], days: ["jorna"],
  dead: ["muert"], deep: ["profu"], deli: ["exqui"], dog: ["perro"], drin: ["beb", "trag"],
  dung: ["mazmo"], eart: ["tierr"], eat: ["come"], eigh: ["ocho"], emin: ["emine"],
  enha: ["realz"], ente: ["entret"], evil: ["malig"], expe: ["esper"], fals: ["falsed"],
  fath: ["papa"], faul: ["culpa"], feed: ["nutri"], fine: ["fino"], firs: ["prime"],
  foes: ["enemi"], folk: ["gent"], food: ["alim"], forg: ["forj"], foun: ["cimien"],
  foye: ["vestib"], freq: ["frecu"], gard: ["jardi"], glas: ["vidr", "vaso"], good: ["bueno"],
  grap: ["garfi", "ganch"], grea: ["magno"], guar: ["guardi"], hand: ["mano"], harb: ["dars"],
  hat: ["odio"], hay: ["heno"], health: ["salud"], help: ["ayud"], hidd: ["escond"],
  hide: ["ocult"], hors: ["cabal"], hung: ["hambr"], husb: ["conyu"], idea: ["ocurr"],
  immo: ["inmort"], inqu: ["inqui"], insp: ["inspe"], inve: ["invent"], job: ["trab", "ofic"],
  join: ["unir", "acomp"], kill: ["mata"], king: ["rey"], kitc: ["cocina"], know: ["conoc"],
  lady: ["dama"], lane: ["ruta"], law: ["ley"], laws: ["leyes"], leav: ["parti"],
  less: ["menor"], life: ["vida"], ligh: ["faro"], line: ["pauta"], long: ["larg"],
  magi: ["hechi"], main: ["princi"], maje: ["majes"], man: ["homb"], mang: ["sarno"],
  mast: ["amo"], meal: ["comid"], meat: ["carne"], memo: ["recuer"], merc: ["merca"],
  meta: ["fragu"], mine: ["mina"], misb: ["malcri"], miss: ["mision"], mona: ["monar"],
  moth: ["mama"], moun: ["monta"], mout: ["boca"], musi: ["melod"], myst: ["misti"],
  name: ["nomb"], nast: ["ruin"], navi: ["navega"], nigh: ["noch"], obje: ["objet"],
  pare: ["progen"], peac: ["apaci"], perf: ["perfec"], phea: ["faisa"], phil: ["filos"],
  pira: ["pira"], plan: ["plan"], plou: ["arado"], port: ["puert"], powe: ["poder"],
  prem: ["premis"], prep: ["prepar"], pris: ["preso"], prot: ["prote"], quar: ["descua"],
  quie: ["tranq"], rat: ["rata"], reci: ["recit"], regi: ["regim"], reme: ["record"],
  rest: ["repos"], rive: ["remach"], roas: ["asado"], roof: ["tejad"], room: ["estanc"],
  roun: ["vuelt"], roya: ["real"], rum: ["ron"], sacr: ["sacrif"], sail: ["navega"],
  sand: ["arena"], scul: ["escul"], sea: ["mar"], sear: ["rastr"], seek: ["busc"],
  sent: ["conden"], serv: ["sirv"], sext: ["sexta"], shad: ["somb"], shar: ["fragm"],
  ship: ["barco", "buque"], sist: ["herma"], slop: ["bazof"], smit: ["herrer"], some: ["algun"],
  son: ["hijo"], soup: ["sopa"], spec: ["espect"], spir: ["anim"], stab: ["cuadr"],
  star: ["estr"], step: ["estep"], stoc: ["provi"], stor: ["histor"], stud: ["estud"],
  swor: ["espa"], symb: ["simbo"], tale: ["relat"], tele: ["telesc", "catal"], tell: ["cuent"],
  temp: ["templ"], tend: ["cuid"], thin: ["cosa"], time: ["tiemp"], tool: ["instru"],
  trav: ["viaj"], trou: ["cuita"], tyra: ["tira"], unde: ["infra"], uppe: ["superi"],
  val: ["valor"], virt: ["virtu"], visi: ["visit"], want: ["quier"], wate: ["agua"],
  weap: ["arma"], weat: ["clima"], welc: ["bienv"], well: ["bien"], wher: ["dond"],
  whir: ["remoli"], wife: ["espos"], wind: ["vien"], wise: ["sabi"], wond: ["marav"],
  work: ["labo"], worl: ["mund"], wrai: ["espect"],
  // ── Lote 1 keywords-m (criba docs/i18n/criba-keywords-m.md): sustantivos comunes de Talk,
  // prefijos ES SIN acento (foldChar no folda acento/ñ → cortar antes). El inglés siempre casa;
  // estos alias se AÑADEN. CERO colisiones intra-NPC (red = keyword-alias-es.test.ts). ──
  abod: ["morad"], adve: ["avent"], anci: ["antig"], arro: ["flech"], atta: ["ataq"],
  balc: ["balco"], beas: ["besti"], befo: ["antes"], caug: ["atrap"], chai: ["caden"],
  coif: ["cofia"], crop: ["cosech"], daug: ["hija"], deed: ["haza"], devi: ["diabl"],
  dish: ["plato"], draw: ["dibuj"], drow: ["ahog"], duck: ["pato"], envy: ["envid"],
  farm: ["granj"], fear: ["miedo"], fiel: ["campo"], fire: ["fueg"], helm: ["yelmo"],
  iron: ["hierr"], lake: ["lago"], silk: ["seda"], soul: ["alma"], tabl: ["mesa"],
  // ── Lote 2 keywords-m: más sustantivos/verbos comunes (mismo criterio y red de colisiones). ──
  alon: ["solo"], brok: ["roto"], buil: ["constr"], city: ["ciud"], clos: ["cerra"],
  come: ["venir"], cowa: ["cobard"], cros: ["cruz"], die: ["mori"], dona: ["donac"],
  game: ["jueg"], gate: ["verj"], gold: ["oro"], home: ["hogar"], hous: ["casa"],
  hunt: ["caza"], look: ["mira"], lost: ["perdid"], love: ["amor"], mone: ["diner"],
  old: ["viejo"], pay: ["paga"], play: ["juga"], poor: ["pobre"], shop: ["tiend"],
  sick: ["enferm"], walk: ["camin"],
  // ── Lote 3 keywords-m: más sustantivos/verbos comunes. ──
  bolt: ["cerroj"], boy: ["chaval"], dirt: ["suci"], earn: ["gana"], fact: ["hecho"],
  fenc: ["valla"], fly: ["vola"], fool: ["tonto"], forc: ["fuerz"], fun: ["diver"],
  goss: ["chism"], hear: ["escuch"], hour: ["hora"], hull: ["casco"], hurt: ["herid"],
  jail: ["calab"], keen: ["agud"], larg: ["grand"], like: ["gusta"], litt: ["peque"],
  mate: ["parej"], much: ["mucho"], need: ["neces"], one: ["uno"], pass: ["paso"],
  path: ["send"], peop: ["gente"], plac: ["lugar"], pub: ["tabern"], rule: ["regla"],
  sale: ["venta"], seal: ["sello"], self: ["mismo"], song: ["canci"], take: ["toma"],
  talk: ["habla"], tax: ["impues"], town: ["puebl"], trad: ["comerc"], wake: ["despert"],
  week: ["seman"], who: ["quien"],
  // ── Lote 4 keywords-m: más sustantivos/verbos comunes. ──
  auth: ["autor"], beli: ["creen"], enjo: ["disfr"], ensl: ["esclav"], exch: ["intercam"],
  gyps: ["gitan"], happ: ["feliz"], harv: ["siega"], inha: ["habit"], inju: ["lesi"],
  jug: ["jarr"], lear: ["aprend"], leg: ["piern"], lege: ["leyend"], mess: ["mensaj"],
  mort: ["mortal"], mud: ["barro"], neve: ["nunca"], now: ["ahora"], oat: ["avena"],
  orch: ["huert"], othe: ["otro"], outl: ["forajid"], pati: ["pacien"], piec: ["pieza"],
  prid: ["orgull"], puni: ["castig"], quee: ["reina"], seas: ["estaci"], soil: ["suelo"],
  soon: ["pront"], stro: ["fuert"], tast: ["sabor"], teac: ["ense"], towe: ["torre"],
  unti: ["hasta"], whee: ["rueda"], whic: ["cual"], wiza: ["mago"], writ: ["escrib"],
  youn: ["joven"], rava: ["arras"], rebu: ["reconstr"], rece: ["recib"], rele: ["liber"],
  rigg: ["aparej"], roam: ["vaga"], sew: ["cose"], sins: ["pecad"], slee: ["dorm"],
  spik: ["pinch"], surr: ["rendi"], grin: ["sonr"], fidd: ["viol"], mutt: ["chuch"],
  // ── Lote 5 keywords-m: limpias restantes + RESOLUCIÓN DE CLUSTERS de colisión. Verificado
  // (coexistencia por-NPC): esper/enferm/verdad/guard/tierr/objet/viv/libr NUNCA conviven en
  // un NPC → alias global seguro. magic/enchant SÍ conviven (Jimmy) pero se resuelven con
  // raíces distintas (hechi vs encant) sin colisión, sin override. ──
  // (labo/labour SIN alias propio: work→"labo" ya casa "labor" tecleado — evita colisión en Tomoka.)
  appr: ["acerc"], dim: ["tenue"], gues: ["invit"], loca: ["ubica"], mid: ["medio"],
  own: ["propi"], seve: ["siete"], stre: ["calle"], near: ["cerca"],
  // clusters resueltos por raíces distintas (nunca coexisten, o raíz semántica separada):
  hope: ["esper"], wait: ["esper"], ill: ["enferm"], ench: ["encant"], true: ["verdad"],
  trut: ["verdad"], keep: ["conserv"], land: ["tierr"], item: ["objet"], aliv: ["vivo"],
  live: ["vivir"], livi: ["vivien"], free: ["libre"], libr: ["biblio"], hate: ["odio"],
  sing: ["canta"], lock: ["cerrad"], jour: ["viaj"],
};

/**
 * Override POR-NPC para casos donde el alias GLOBAL de una keyword no encaja con ESE NPC.
 * Clave = id canónico del NPC (location:slot, igual que main.ts usa
 * `${npc.location}:${npc.slot}`). El glosario global no tiene colisiones (ver KEYWORD_ALIAS_ES);
 * los overrides aquí son SEMÁNTICOS, no de colisión:
 *  - 29:4 Balinor (Destard): su keyword «well» es la RESPUESTA de su acertijo (= «pozo»,
 *    "as tall as a house, round as a cup…"), no el «bien»/salud del alias global. Se
 *    sobrescribe a "pozo" para que el jugador ES resuelva el acertijo tecleando «pozo».
 */
const ALIAS_ES_BY_NPC: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  "29:4": { well: ["pozo"] },
};

/**
 * Prefijos españoles para una keyword inglesa, con override por-NPC si existe. Devuelve `[]`
 * si la keyword no tiene alias (excluida o aún sin canon) → el matcher cae en inglés-only.
 * `npcKey` opcional (location:index); sin él usa sólo el mapa global.
 */
export function aliasesForKeywordEs(keyword: string, npcKey?: string): readonly string[] {
  const k = keyword.toLowerCase();
  const override = npcKey ? ALIAS_ES_BY_NPC[npcKey]?.[k] : undefined;
  if (override) return override;
  return KEYWORD_ALIAS_ES[k] ?? [];
}

/** Una colisión de alias dentro de un NPC: dos keywords cuyos alias serían ambiguos. */
export interface AliasCollision {
  keywordA: string;
  keywordB: string;
  alias: string; // el alias de A que colisiona…
  with: string; // …con este alias de B (uno es prefijo del otro)
}

/**
 * Valida la UNICIDAD de alias por-NPC (§3.1 sub-riesgo): con prefijos españoles cortos, dos
 * keywords DISTINTAS del mismo NPC pueden quedar indistinguibles. La regla: dentro de un NPC,
 * ningún alias de una keyword debe ser PREFIJO (case-fold) de un alias de OTRA keyword — si lo
 * fuera, teclear la palabra larga casaría ambos y ganaría el primero en orden (posiblemente el
 * equivocado). Devuelve la lista de colisiones (vacía = tabla sana para ese NPC).
 *
 * `keywords` = las keywords del NPC en orden; `npcKey` para resolver overrides.
 */
export function aliasCollisionsForNpc(keywords: readonly string[], npcKey?: string): AliasCollision[] {
  const fold = (s: string): string => s.toLowerCase();
  // (keyword, alias) de todas las keywords del NPC que tienen alias.
  const entries: { kw: string; alias: string }[] = [];
  for (const kw of keywords) {
    for (const a of aliasesForKeywordEs(kw, npcKey)) entries.push({ kw, alias: fold(a) });
  }
  const collisions: AliasCollision[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const A = entries[i]!;
      const B = entries[j]!;
      if (A.kw === B.kw) continue; // misma keyword: alias alternativos legítimos
      // Uno prefijo del otro (incl. iguales) → ambiguo.
      if (A.alias.startsWith(B.alias) || B.alias.startsWith(A.alias)) {
        collisions.push({ keywordA: A.kw, keywordB: B.kw, alias: A.alias, with: B.alias });
      }
    }
  }
  return collisions;
}
