/**
 * RE-SIEMBRA DEL ESPEJO — re-anclar la entrada de una parte al estado del ORIGINAL,
 * en vez de heredar sin más lo que dejó la parte anterior.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * POR QUÉ EXISTE
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Adjudicación `re/notes/espejo-cadena-party-muerta.md` (22-08): la cadena de checkpoints
 * del espejo se DEGRADA hasta que 16 de 24 llevan la party 100% muerta, el wipe REPLICA
 * con entrada byte-idéntica, y la conformidad de esas partes deja de medir fidelidad (una
 * party muerta produce texto muy predecible —`Player: None!`— contra un corpus lleno de
 * las mismas plantillas). En el corpus del jugador real la party NUNCA fue aniquilada:
 * `darkness engulfs` = 0 en los 24 ocrlogs, y este módulo lo RE-MIDE en runtime sobre las
 * rutas (`muertesEnCorpus`), no lo cita de oídas.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EL REPARO QUE ESTE MÓDULO TIENE QUE RESPETAR, Y CÓMO LO RESPETA
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Re-sembrar es **el instrumento fijando su propio punto de partida**. Sólo es legítimo si
 *   (a) el estado sembrado sale del ORIGINAL —nunca de una corrida nuestra—, y
 *   (b) la siembra se DECLARA en el reporte, para que nadie compare la conformidad de un
 *       tramo re-anclado con la de un tramo encadenado como si fueran lo mismo.
 *
 * (a) LAS DOS FUENTES, las dos del original, ninguna de una corrida del port:
 *
 *   F1 · **El corpus OCR de la propia parte** (`routes/partNN.route.json`, bloques
 *        `expect[].text`, transcritos del vídeo del LP). Dice QUIÉN actúa en el original
 *        durante esta parte y SI el original sufrió alguna muerte. Es lo único de estado
 *        que el corpus lleva: el censo (`tools/censo-observable.mjs`) mide **0 bloques**
 *        con oro, comida, fecha, nivel o HP por miembro — el OCR del espejo transcribe la
 *        CONSOLA, no el panel de estado. Ver §1 de la nota de este carril.
 *
 *   F2 · **El binario**, `BLCKTHRN.OVL:0x0910 party_refuge`. Dice CON QUÉ ESTADO vuelve
 *        una party aniquilada, que es justo lo que el corpus no puede decir:
 *          · 0x0b54-0x0bb1 — por miembro DEL GRUPO (`i < g_party_size`, sin `cmp si,6`):
 *            `word[rec+0x10] := word[rec+0x12]` ⇒ currentHp := maxHp, y status vivo;
 *          · 0x0c40/0x0c47 — `if g_food == 0: g_food = 0x3f` (63).
 *        Ya portado y con paridad en `core/world/blackthorn.ts:495 partyRefuge`; aquí se
 *        aplica la MISMA mutación, y sólo esa parte de ella (ver el recorte de abajo).
 *
 * 🔴 **EL RECORTE, declarado porque es la costura discutible.** `party_refuge` hace MÁS
 * cosas: karma al suelo 75, `g_location ← 0x11` (castillo de LB), planta 1, (10,10), a pie,
 * reloj a las 6:00. Esas NO se aplican, y no por comodidad: el destino de la re-siembra es
 * **el estado del ORIGINAL en este punto**, y el original no estaba en el castillo de LB
 * (nunca entró en el refuge: 0 muertes en el corpus). La posición la fija la costura
 * `enter` de cada segmento (que sí es OCR del original: el banner de localización) y la
 * hora la fija `entryClock` (arnés previo, ya sancionado). O sea: del binario se toma lo
 * que el vídeo NO da (HP/estado/suelo de comida) y del vídeo lo que el vídeo SÍ da.
 *
 * (b) Todo lo de arriba viaja al reporte en el bloque `reseed` de `PartReport` y a la
 * primera pantalla de `summarize()`, con la lista de campos SEMBRADOS y la de NO-SEMBRADOS
 * **con su motivo**. Una parte re-anclada se ve a simple vista en su propio sello.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CASO FRONTERA — «si el vídeo no da un campo, ¿se hereda o se marca no-sembrado?»
 * ══════════════════════════════════════════════════════════════════════════════════════
 * **Se HEREDA de la cadena Y se marca no-sembrado, con motivo.** Las dos cosas, no una:
 * heredar sin marcar es lo que produjo las costuras invisibles de §2 de la adjudicación, y
 * marcar sin heredar obligaría a inventar un valor (el instrumento escribiendo su esperado).
 * `camposNoSembrados()` enumera los campos uno a uno; ninguno se queda fuera por olvido.
 *
 * Y la frontera SIMÉTRICA, que es la que impide que esto se convierta en un lavado: **si
 * el corpus de la parte SÍ tiene mensajes de muerte, NO se siembra**. Ahí la cadena no
 * contradice al original — el original también perdió gente — y re-sembrar borraría una
 * medida buena. `muertesEnCorpus > 0` ⇒ `disparo: "corpus-con-muertes"` y cero mutación.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * SON DOS SIEMBRAS INDEPENDIENTES, con disparo, cita e interruptor PROPIOS
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Esta cabecera describía sólo la primera, y la segunda es la que la validación demostró
 * que importaba — así que van las dos aquí, o quien lea el principio del fichero se queda
 * con media película:
 *
 *   1 · **PARTY** (`disparo`, `U5_ESPEJO_RESIEMBRA=wipe|roster`) — revivir. Es lo de
 *       arriba: corpus (F1) para el gate, binario (F2) para el valor.
 *   2 · **ALFOMBRA** (`disparoCarpet`, `U5_ESPEJO_RESIEMBRA_CARPET`) — reponer
 *       `state.magicCarpets` cuando el corpus de la parte muestra al LP subiéndose a una
 *       y el puerto no tiene ninguna. Fuente: F1 sola. Ver `RE_CARPET` para la medida que
 *       la motivó y para su límite (que es grande: el embarque no se conduce).
 *
 * Van SEPARADAS porque contestan preguntas distintas y porque el experimento las necesita
 * separables: el brazo «party sembrada + alfombra APAGADA» es justo el que mide que
 * revivir a la party sola no cambia la conformidad.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CADA CUÁNTO
 * ══════════════════════════════════════════════════════════════════════════════════════
 * **Por PARTE, a la entrada, y sólo cuando el estado heredado CONTRADICE al original** —
 * no cada N segmentos ni «cuando la deriva pase un umbral». Un umbral de deriva exigiría
 * medir la distancia al estado observado, y el censo dice que ese estado observado NO
 * EXISTE en el corpus para casi ningún campo: un umbral así sería un número inventado. El
 * predicado que sí se puede evaluar con el material que hay es el de CONTRADICCIÓN, y
 * tiene además la propiedad que interesa: en una cadena sana no dispara NUNCA (cero
 * efecto), así que no puede maquillar las partes que van bien.
 */

import type { Page } from "@playwright/test";

/** Modo de re-siembra (`U5_ESPEJO_RESIEMBRA`). `off` = conducta histórica, bit a bit. */
export type ModoResiembra = "off" | "wipe" | "roster";

export function parseModo(v: string | undefined): ModoResiembra {
  if (v === "wipe" || v === "roster") return v;
  return "off";
}

/** Miembro del grupo tal y como lo trae el estado VIVO tras `importCheckpoint`. */
export interface MiembroVivo {
  nombre: string;
  status: string;
  currentHp: number;
  maxHp: number;
}

/** Foto del estado vivo que necesita la decisión (la trae `sondaResiembra`). */
export interface EstadoVivo {
  partySize: number;
  /**
   * Los miembros DEL GRUPO por `partyStatus === 0` (réplica de `core/party.ts:172
   * partyMembers` y de `probeState`) — **NO** los `partySize` primeros del roster.
   *
   * 🔴 ESTA ELECCIÓN ESTÁ MEDIDA Y ES EL REVÉS DE LO QUE PARECE. La cota fiel del binario
   * es el PREFIJO (`i < g_party_size`, BLCKTHRN 0x0b54, y el acta #124 la confirma: el
   * binario mantiene el roster CONTIGUO moviendo records). Pero **43 de las 49 semillas del
   * espejo VIOLAN ese invariante** (medido: `part07`..`part24` y `ad01`..`ad25`; sólo
   * part01-06 lo cumplen, y la rotura empieza exactamente en la costura part06|part07 que
   * la adjudicación ya había marcado por otras señales). En `part21.gam`, por ejemplo, el
   * prefijo 0..5 es `Min·Shamino·Iolo·MARIAH·GEOFFREY·Jaana` —dos que NO van en el grupo—
   * mientras Julia y Gwenno, que sí van, están en los slots 6 y 10.
   *
   * ⇒ leer el prefijo sobre este material devuelve la party EQUIVOCADA. Se lee por
   * `partyStatus`, que es lo que el corpus puede carear (los nombres que actúan en el
   * vídeo), y la violación del invariante se reporta aparte en vez de heredarla.
   */
  miembros: MiembroVivo[];
  /** Miembros del PREFIJO `0..partySize-1` que NO son del grupo. `> 0` ⇒ invariante roto ⇒
   *  `partyConsciousState`/`partyRefuge` miran a gente que no es la party (ver arriba). */
  intrusosEnPrefijo: number;
  food: number | null;
  /** `state.magicCarpets` (g_carpets DS:0x57B0). Ver `RE_CARPET`. */
  magicCarpets: number | null;
}

/** Lo que el corpus de la parte dice del original. PURO, derivado de la ruta. */
export interface EvidenciaCorpus {
  /** menciones por nombre en los bloques `expect` de la parte (bloques, no ocurrencias). */
  menciones: Record<string, number>;
  /** bloques `expect` que contienen un mensaje de MUERTE del original. */
  muertes: number;
  /** bloques `expect` en los que el original SE SUBE A UNA ALFOMBRA. Ver `RE_CARPET`. */
  carpetBoard: number;
  /** bloques `expect` totales de la parte (denominador de las cifras de arriba). */
  bloques: number;
}

/** Campo NO sembrado, con el motivo por el que no lo está. */
export interface CampoNoSembrado {
  campo: string;
  motivo: string;
}

/** Plan de re-siembra: lo que se va a hacer Y lo que no, con su procedencia. */
export interface PlanResiembra {
  modo: ModoResiembra;
  /** por qué disparó (o por qué no). Valor estable, apto para censar reportes. */
  disparo:
    | "modo-off"
    | "sin-contradiccion"
    | "corpus-con-muertes"
    | "corpus-sin-evidencia"
    | "party-muerta"
    | "miembros-caidos-con-evidencia";
  motivo: string;
  /** disparo de la siembra de ALFOMBRA, independiente del de la party (ver `RE_CARPET`). */
  disparoCarpet: "modo-off" | "apagada" | "corpus-sin-alfombra" | "ya-la-tiene" | "alfombra-perdida";
  /** nombres a revivir (currentHp := maxHp, status := 'G'). */
  revivir: string[];
  /** true si toca reponer comida a 0x3f (sólo cuando está a 0). */
  reponerComida: boolean;
  /** true si toca reponer LA ALFOMBRA que el original usa en esta parte (ver `RE_CARPET`).
   *  Siembra INDEPENDIENTE de la de la party: su disparo, su cita y su interruptor. */
  sembrarCarpet: boolean;
  evidencia: EvidenciaCorpus;
  /** campos efectivamente sembrados, con la fuente de cada uno. */
  sembrados: Array<{ campo: string; fuente: string }>;
  /** campos que se HEREDAN de la cadena, con el motivo (ver caso frontera). */
  noSembrados: CampoNoSembrado[];
  /** estado de la party ANTES de sembrar, para que el reporte no dependa de recordarlo.
   *  `intrusosEnPrefijo > 0` marca la semilla con el invariante de contigüidad roto (#124):
   *  ahí el refuge del puerto NO PUEDE disparar aunque la party esté entera muerta. */
  antes: {
    vivos: number;
    total: number;
    food: number | null;
    partySize: number;
    intrusosEnPrefijo: number;
    magicCarpets: number | null;
  };
}

/** Comida de reposición del refuge: `BLCKTHRN.OVL:0x0c47 mov word [g_food], 0x3f`. */
export const FOOD_REFUGE = 0x3f;

/** Lo que el aplicador cambió DE VERDAD (no lo que se le pidió). */
export interface AplicadoResiembra {
  revividos: string[];
  noEncontrados: string[];
  foodAntes: number | null;
  foodDespues: number | null;
  carpetAntes: number | null;
  carpetDespues: number | null;
}

const CITA_REVIVE = "BLCKTHRN.OVL:0x0b54-0x0bb1 (currentHp:=maxHp, status vivo)";
const CITA_COMIDA = "BLCKTHRN.OVL:0x0c40/0x0c47 (if food==0: food=63)";
const CITA_CORPUS = "corpus OCR de la parte (routes/<part>.route.json, expect[].text)";

/**
 * Mensajes de MUERTE del original en el OCR. La familia se deriva del binario/port
 * (`An unending darkness engulfs thee` es el texto del refuge) más las variantes que el
 * OCR de 360p produce. Existe para el guard de frontera: si el original SÍ perdió gente
 * aquí, la cadena no lo contradice y NO se siembra.
 *
 * 🔴 Un predicado de AUSENCIA necesita control positivo, o «0 muertes» se lee como «no hay»
 * cuando puede ser «mi patrón está mal». El control vive en `espejo-resiembra.test.ts`:
 * el MISMO regex tiene que casar con las frases del binario. Sin ese control esta constante
 * podría estar vacía y el censo daría 0 igual.
 */
export const RE_MUERTE = /darkness engulfs|\bis dead\b|hath died|has fallen|\bslain\b|battle is lost/i;

/**
 * ★ EL ORIGINAL SE SUBE A UNA ALFOMBRA. Ésta es la evidencia que la VALIDACIÓN de este
 * carril encontró y que ninguna hipótesis previa había mirado.
 *
 * Medido: con la party re-sembrada viva y a tope de HP, `part22` y `part20` vuelven a morir
 * ENTERAS en UN SOLO segmento, y los dos son el mismo: la costura de entrada al SUBMUNDO
 * (`enter.overworld + underworld:true`). El transcript del puerto en `part22-g07` es una
 * marcha A PIE («Very slow!», «Slow progress!», EARTHQUAKE, veneno) con TRES emboscadas
 * seguidas —ratas, arañas, murciélagos— hasta `BATTLE IS LOST!`. El corpus del MISMO
 * segmento dice otra cosa: `Use item Item: Carpet Boarded!` · `Fly` · `Fl- Ezzt` ·
 * `F]v Fast` — **el original CRUZA EL SUBMUNDO VOLANDO** y sólo se encuentra a las arañas.
 *
 * Y el puerto no puede volar porque no tiene alfombra: `state.magicCarpets` (g_carpets,
 * DS:0x57B0) vale **1 en part05/part06 y 0 desde part07**, es decir se pierde en la MISMA
 * costura part06|part07 donde la adjudicación ya había medido la discontinuidad de oro y
 * antorchas y donde se rompe la contigüidad del roster. Tres señales, una costura.
 */
export const RE_CARPET = /carpet.{0,40}board|board.{0,40}carpet/i;

/** Cuenta BLOQUES (no ocurrencias) que mencionan cada nombre. Case-sensitive y con frontera
 *  de palabra: el corpus escribe los nombres propios tal cual y `Min` como subcadena
 *  ensuciaría el recuento. Sub-contar es la dirección segura (menos siembra, no más). */
export function evidenciaDeCorpus(textos: string[], nombres: string[]): EvidenciaCorpus {
  const menciones: Record<string, number> = {};
  for (const n of nombres) menciones[n] = 0;
  const res = nombres.map((n) => [n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)] as const);
  let muertes = 0;
  let carpetBoard = 0;
  for (const t of textos) {
    for (const [n, re] of res) if (re.test(t)) menciones[n] = (menciones[n] ?? 0) + 1;
    if (RE_MUERTE.test(t)) muertes++;
    if (RE_CARPET.test(t)) carpetBoard++;
  }
  return { menciones, muertes, carpetBoard, bloques: textos.length };
}

/**
 * Los campos que la re-siembra NO toca, cada uno con su motivo. Se enumeran a mano y
 * ENTEROS a propósito: el caso frontera del encargo pide que un campo sin dato del vídeo
 * quede MARCADO, y una lista derivada de «lo que no aparece en `sembrados`» no podría
 * llevar motivo (que es la mitad útil).
 */
export function camposNoSembrados(): CampoNoSembrado[] {
  return [
    { campo: "oro", motivo: "cobertura 0 en el corpus: el OCR transcribe la consola, no el panel de estado (censo §1)" },
    { campo: "comida (si != 0)", motivo: "cobertura 0 en el corpus; el binario sólo la repone desde 0 (0x0c40)" },
    { campo: "fecha", motivo: "cobertura 0 en el corpus" },
    { campo: "hora", motivo: "la fija `entryClock` de la ruta (arnés previo, hora canónica 10:00)" },
    { campo: "posicion/localizacion", motivo: "la fija la costura `enter` de cada segmento (banner OCR del original)" },
    { campo: "karma", motivo: "cobertura 0 en el corpus; el suelo 75 del refuge (0x0bfd) NO se aplica (ver recorte)" },
    {
      campo: "transporte (montura/nave/alfombra)",
      motivo:
        "el MODO de transporte lo fija la costura `enter`/`exitSeamAction` y el `foot` del refuge NO se aplica. " +
        "La CAPACIDAD de volar sí se siembra cuando falta y el corpus la usa: ver `sembrarCarpet`/`RE_CARPET`",
    },
    { campo: "inventario (llaves/gemas/antorchas/equipo)", motivo: "cobertura 0 en el corpus (sólo hay mensajes de LOOT, que son deltas, no saldos)" },
    { campo: "nivel/experiencia/stats", motivo: "cobertura 0 en el corpus" },
    { campo: "roster (altas y bajas de miembros)", motivo: "no se altera la composición del grupo: `partyStatus` se hereda" },
  ];
}

/**
 * LA DECISIÓN. Pura y testeable sin puerto.
 *
 * Orden de las guardas, que importa: primero las que APAGAN (modo, corpus con muertes),
 * después las que encienden. Así el caso «el original también murió aquí» no puede quedar
 * tapado por el disparo del wipe.
 */
export function decideResiembra(
  modo: ModoResiembra,
  estado: EstadoVivo,
  evidencia: EvidenciaCorpus,
  umbral: number,
  /** interruptor PROPIO de la siembra de alfombra (`U5_ESPEJO_RESIEMBRA_CARPET`). Va aparte
   *  del modo para que los dos efectos se puedan medir SEPARADOS: la validación de este
   *  carril mide un brazo con la party sembrada y SIN alfombra, y ése es justo el brazo que
   *  demuestra que revivir a la party sola no arregla nada. */
  carpetOn: boolean,
): PlanResiembra {
  // `estado.miembros` YA es el grupo (`partyStatus === 0`): no se vuelve a recortar por
  // `partySize`. Recortar aquí sería un tercer criterio de membresía, y además `partySize`
  // y el recuento de miembros DISCREPAN en material real (ad13-ad25: `g_party_size` 5 con
  // 6 miembros marcados) — un `slice` dejaría fuera a alguien de la party sin decirlo.
  const grupo = estado.miembros;
  const vivos = grupo.filter((m) => m.status !== "D").length;
  const antes = {
    vivos,
    total: grupo.length,
    food: estado.food,
    partySize: estado.partySize,
    intrusosEnPrefijo: estado.intrusosEnPrefijo,
    magicCarpets: estado.magicCarpets,
  };
  // ── SIEMBRA DE ALFOMBRA: decisión INDEPENDIENTE de la de la party. Un original que
  // vuela y un puerto que camina es una divergencia de TRANSPORTE, y no tiene nada que ver
  // con quién esté vivo — así que ni la comparte el disparo ni la bloquean sus guardas.
  const carpetPide = evidencia.carpetBoard > 0;
  const carpetFalta = estado.magicCarpets === 0;
  const sembrarCarpet = modo !== "off" && carpetOn && carpetPide && carpetFalta;
  const disparoCarpet: PlanResiembra["disparoCarpet"] =
    modo === "off" ? "modo-off" : !carpetOn ? "apagada" : !carpetPide ? "corpus-sin-alfombra" : !carpetFalta ? "ya-la-tiene" : "alfombra-perdida";
  const sembradoCarpet = sembrarCarpet
    ? [{ campo: "magicCarpets ← 1 (g_carpets DS:0x57B0)", fuente: `${CITA_CORPUS}: ${evidencia.carpetBoard} bloque(s) con la party subiéndose a la alfombra` }]
    : [];
  const base = {
    modo,
    revivir: [] as string[],
    reponerComida: false,
    sembrarCarpet,
    disparoCarpet,
    evidencia,
    sembrados: [...sembradoCarpet] as Array<{ campo: string; fuente: string }>,
    noSembrados: camposNoSembrados().filter((c) => !(sembrarCarpet && c.campo.startsWith("transporte"))),
    antes,
  };
  if (modo === "off") {
    return { ...base, disparo: "modo-off", motivo: "U5_ESPEJO_RESIEMBRA sin poner: conducta histórica (cadena pura)" };
  }
  if (evidencia.muertes > 0) {
    return {
      ...base,
      disparo: "corpus-con-muertes",
      motivo: `el corpus de la parte trae ${evidencia.muertes} bloque(s) con mensaje de muerte: el original TAMBIÉN perdió gente aquí, la cadena no lo contradice`,
    };
  }
  const conEvidencia = grupo.filter((m) => (evidencia.menciones[m.nombre] ?? 0) >= umbral);
  if (conEvidencia.length === 0) {
    return {
      ...base,
      disparo: "corpus-sin-evidencia",
      motivo: `ningún miembro del grupo llega al umbral de ${umbral} bloque(s) de mención en el corpus: no hay dato del original con el que contradecir a la cadena`,
    };
  }
  // ── wipe: la contradicción DURA. Una party 100% muerta es un estado que el binario NO
  // PUEDE sostener (ULTIMA.EXE:0x39fc devuelve −1 → MAINOUT:0x0ac2 desvía → refuge), y el
  // corpus dice que el original seguía jugando. Revive el GRUPO ENTERO, como 0x0b54.
  if (vivos === 0) {
    const revivir = grupo.map((m) => m.nombre);
    const reponerComida = estado.food === 0;
    const sembrados = [
      ...sembradoCarpet,
      { campo: `status+currentHp de los ${revivir.length} miembros del grupo`, fuente: `${CITA_REVIVE} · disparo: ${CITA_CORPUS}` },
      ...(reponerComida ? [{ campo: `comida ← ${FOOD_REFUGE}`, fuente: CITA_COMIDA }] : []),
    ];
    return {
      ...base,
      disparo: "party-muerta",
      motivo:
        `la cadena entrega ${vivos}/${grupo.length} vivos y el corpus de la parte nombra a ` +
        `${conEvidencia.map((m) => `${m.nombre}(${evidencia.menciones[m.nombre]})`).join(", ")} sin una sola muerte: ` +
        `estado imposible en el binario (0x39fc→0x0ac2→0x0910)`,
      revivir,
      reponerComida,
      sembrados,
      noSembrados: camposNoSembrados().filter(
        (c) => !(reponerComida && c.campo.startsWith("comida")) && !(sembrarCarpet && c.campo.startsWith("transporte")),
      ),
    };
  }
  // ── roster: la contradicción BLANDA. Miembros caídos que el corpus muestra actuando.
  // 🔴 ESTO ES UNA EXTRAPOLACIÓN, NO UNA PORTADA: aplica el EFECTO de 0x0b54 fuera de su
  // GATE (el binario sólo revive con el grupo ENTERO muerto). Va en modo propio y el
  // reporte lo dice con esa palabra, para que nadie lo lea como fidelidad derivada.
  if (modo === "roster") {
    const revivir = conEvidencia.filter((m) => m.status === "D").map((m) => m.nombre);
    if (revivir.length > 0) {
      return {
        ...base,
        disparo: "miembros-caidos-con-evidencia",
        motivo:
          `${revivir.length} miembro(s) caído(s) que el corpus muestra actuando (` +
          `${revivir.map((n) => `${n}(${evidencia.menciones[n]})`).join(", ")}) — EXTRAPOLACIÓN: ` +
          `el efecto de 0x0b54 aplicado FUERA de su gate (el binario sólo revive con el grupo entero muerto)`,
        revivir,
        sembrados: [
          ...sembradoCarpet,
          { campo: `status+currentHp de ${revivir.join(", ")}`, fuente: `EXTRAPOLADO de ${CITA_REVIVE} · disparo: ${CITA_CORPUS}` },
        ],
      };
    }
  }
  return {
    ...base,
    disparo: "sin-contradiccion",
    motivo: `la cadena entrega ${vivos}/${grupo.length} vivos y el corpus no la contradice: no se toca nada`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════
// LADO PÁGINA — sonda y aplicador. Lo único de este fichero que toca el puerto.
// ══════════════════════════════════════════════════════════════════════════════════════

/** Foto del estado vivo para la decisión. READ-ONLY: no muta ni consume RNG. */
export async function sondaResiembra(page: Page): Promise<EstadoVivo> {
  return page.evaluate(() => {
    const s = (
      window as unknown as {
        __u5test: {
          game: {
            state: {
              characters: Array<{ name: string; status?: string; currentHp?: number; maxHp?: number; partyStatus?: number }>;
              partySize: number;
              food?: number;
              magicCarpets?: number;
            };
          };
        };
      }
    ).__u5test.game.state;
    const n = s.partySize ?? s.characters.length;
    const grupo = s.characters.filter((c) => c.partyStatus === 0);
    // Intrusos del prefijo: cuántos de los `partySize` primeros NO son del grupo. Es la
    // medida del invariante roto (#124), y va al reporte porque explica por qué el refuge
    // del puerto no dispara sobre estas semillas.
    let intrusos = 0;
    for (let i = 0; i < n; i++) if (s.characters[i] && s.characters[i]!.partyStatus !== 0) intrusos++;
    return {
      partySize: n,
      miembros: grupo.map((c) => ({
        nombre: c.name,
        status: c.status ?? "",
        currentHp: c.currentHp ?? 0,
        maxHp: c.maxHp ?? 0,
      })),
      intrusosEnPrefijo: intrusos,
      food: typeof s.food === "number" ? s.food : null,
      magicCarpets: typeof s.magicCarpets === "number" ? s.magicCarpets : null,
    };
  });
}

/**
 * APLICA el plan. Réplica exacta de las DOS mutaciones tomadas de `party_refuge`
 * (`core/world/blackthorn.ts:504-509` y `:524-528`), restringida a los nombres del plan.
 *
 * Se replica en vez de llamar a `partyRefuge` a propósito: esa función aplica ADEMÁS el
 * reposicionamiento a LB, el karma y el reloj, que es justo lo que el recorte declarado de
 * la cabecera NO quiere. Llamarla y deshacer después dejaría un estado que depende del
 * orden de los deshaceres; escribir las dos líneas que sí valen no.
 *
 * Devuelve lo que EFECTIVAMENTE cambió, no lo que se pidió: si un nombre del plan no está
 * en el grupo vivo (roster movido entre la sonda y aquí) sale en `noEncontrados` y el
 * reporte lo enseña, en vez de contarlo como sembrado.
 */
export async function aplicaResiembra(
  page: Page,
  plan: PlanResiembra,
): Promise<AplicadoResiembra> {
  return page.evaluate(
    ({ nombres, comida, foodRefuge, carpet }) => {
      const s = (
        window as unknown as {
          __u5test: {
            game: {
              state: {
                characters: Array<{ name: string; status?: string; currentHp?: number; maxHp?: number; partyStatus?: number }>;
                partySize: number;
                food?: number;
                magicCarpets?: number;
              };
            };
          };
        }
      ).__u5test.game.state;
      const pendientes = new Set(nombres);
      const revividos: string[] = [];
      // Se barre el ROSTER ENTERO filtrando por `partyStatus === 0`, no el prefijo: ver el
      // porqué medido en `EstadoVivo.miembros` (43/49 semillas con el invariante roto).
      for (const c of s.characters) {
        if (!c || c.partyStatus !== 0 || !pendientes.has(c.name)) continue;
        pendientes.delete(c.name);
        c.currentHp = c.maxHp ?? c.currentHp; // 0x0b98: word[rec+0x10] := word[rec+0x12]
        c.status = "G";
        revividos.push(c.name);
      }
      const foodAntes = typeof s.food === "number" ? s.food : null;
      let foodDespues = foodAntes;
      if (comida && foodAntes === 0) {
        s.food = foodRefuge; // 0x0c47
        foodDespues = foodRefuge;
      }
      const carpetAntes = typeof s.magicCarpets === "number" ? s.magicCarpets : null;
      let carpetDespues = carpetAntes;
      if (carpet && carpetAntes === 0) {
        s.magicCarpets = 1; // g_carpets DS:0x57B0 — UNA, la que el original usa (no un stock)
        carpetDespues = 1;
      }
      return { revividos, noEncontrados: [...pendientes], foodAntes, foodDespues, carpetAntes, carpetDespues };
    },
    { nombres: plan.revivir, comida: plan.reponerComida, foodRefuge: FOOD_REFUGE, carpet: plan.sembrarCarpet },
  );
}

/** ¿el plan muta algo? (el aplicador no debe abrir un `page.evaluate` para no hacer nada). */
export function planMuta(plan: PlanResiembra): boolean {
  return plan.revivir.length > 0 || plan.reponerComida || plan.sembrarCarpet;
}

/**
 * LO QUE VIAJA AL REPORTE — §(b) del reparo. Va SIEMPRE, también con `modo:"off"`: un
 * reporte sin bloque `reseed` sería indistinguible de uno de antes de este carril, y la
 * comparabilidad entre corridas es justo lo que hay que poder auditar. Con la re-siembra
 * apagada el bloque dice `aplicada:false, disparo:"modo-off"`, que es información.
 */
export interface ResiembraReport {
  modo: ModoResiembra;
  umbral: number;
  disparo: PlanResiembra["disparo"];
  disparoCarpet: PlanResiembra["disparoCarpet"];
  motivo: string;
  /** ¿se mutó algo de verdad? Es el bit que decide si esta parte es comparable con la de
   *  otra corrida — y el que la puerta y los censos deben mirar, no `modo`. */
  aplicada: boolean;
  /** ⚠ visible en el JSON: la conformidad de una parte re-anclada no se promedia con las
   *  encadenadas. Redundante con `aplicada` a propósito (quien lea el JSON lo lee aquí). */
  aviso: string | null;
  antes: PlanResiembra["antes"];
  revividos: string[];
  noEncontrados: string[];
  comida: { antes: number | null; despues: number | null } | null;
  /** alfombra: `g_carpets` antes/después. `despues > antes` ⇒ se sembró la capacidad de volar. */
  alfombra: { antes: number | null; despues: number | null } | null;
  evidencia: EvidenciaCorpus;
  sembrados: Array<{ campo: string; fuente: string }>;
  noSembrados: CampoNoSembrado[];
}

const AVISO =
  "PARTE RE-ANCLADA: su conformidad NO es comparable con la de un tramo encadenado ni promediable con él";

export function reporteResiembra(
  plan: PlanResiembra,
  umbral: number,
  aplicado: AplicadoResiembra | null,
): ResiembraReport {
  const aplicada =
    aplicado !== null &&
    (aplicado.revividos.length > 0 ||
      aplicado.foodAntes !== aplicado.foodDespues ||
      aplicado.carpetAntes !== aplicado.carpetDespues);
  return {
    modo: plan.modo,
    umbral,
    disparo: plan.disparo,
    disparoCarpet: plan.disparoCarpet,
    motivo: plan.motivo,
    aplicada,
    aviso: aplicada ? AVISO : null,
    antes: plan.antes,
    revividos: aplicado?.revividos ?? [],
    noEncontrados: aplicado?.noEncontrados ?? [],
    comida: aplicado ? { antes: aplicado.foodAntes, despues: aplicado.foodDespues } : null,
    alfombra: aplicado ? { antes: aplicado.carpetAntes, despues: aplicado.carpetDespues } : null,
    evidencia: plan.evidencia,
    sembrados: plan.sembrados,
    noSembrados: plan.noSembrados,
  };
}

/**
 * Línea de una sola fila para el log y para `summarize` (la DECLARACIÓN, §(b)).
 *
 * Se escribe sobre el `ResiembraReport` y NO sobre el plan a propósito: el reporte es lo que
 * queda en disco, así que la línea del log y la del sello no pueden divergir. (La versión
 * anterior reconstruía un plan a mano dentro de `summarize` — dos formas del mismo dato con
 * dos oportunidades de mentir.)
 */
export function resumenResiembra(rs: ResiembraReport): string {
  // La foto de ENTRADA va también cuando NO se siembra: es la que dice si el «NO» fue
  // porque no hacía falta o porque el predicado no vio lo que había (y sin ella el diag de
  // un «NO» inesperado obliga a instrumentar otra vez).
  const foto =
    `party de entrada ${rs.antes.vivos}/${rs.antes.total}, comida ${rs.antes.food ?? "—"}, ` +
    `alfombras ${rs.antes.magicCarpets ?? "—"}`;
  // El aviso de contigüidad va en los DOS brazos: describe la SEMILLA, no la decisión, y es
  // el dato que impide leer un «party 0/6 sin refuge» como un fallo del puerto.
  const contig =
    rs.antes.intrusosEnPrefijo > 0
      ? ` · ⚠ CONTIGÜIDAD ROTA (${rs.antes.intrusosEnPrefijo} ajeno(s) en el prefijo 0..${rs.antes.partySize - 1}: el refuge del puerto NO puede disparar en esta semilla)`
      : "";
  const disparos = `party=${rs.disparo}, alfombra=${rs.disparoCarpet}`;
  if (!rs.aplicada) {
    return `re-siembra: NO (modo=${rs.modo}, ${disparos}) — cadena pura · ${foto}${contig} · ${rs.motivo}`;
  }
  const campos = rs.sembrados.map((x) => x.campo).join(" + ");
  const party = rs.revividos.length ? ` · party ${rs.antes.vivos}/${rs.antes.total} → ${rs.antes.vivos + rs.revividos.length}/${rs.antes.total}` : "";
  const alf = rs.alfombra && rs.alfombra.antes !== rs.alfombra.despues ? ` · alfombras ${rs.alfombra.antes} → ${rs.alfombra.despues}` : "";
  return (
    `re-siembra: SÍ (modo=${rs.modo}, ${disparos}) — ${campos}${party}${alf}${contig} · ` +
    `⚠ ESTA PARTE ESTÁ RE-ANCLADA: su conformidad NO es comparable con la de un tramo encadenado`
  );
}
