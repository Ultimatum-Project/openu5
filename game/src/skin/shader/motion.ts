/**
 * Lógica PURA del movimiento suave de la piel shader (eje 3), extraída de `skin.ts`
 * para poder testearla sin DOM/WebGL. NO cambia el comportamiento: `skin.ts` llama a
 * estas funciones donde antes tenía las expresiones en línea. El estado (canvases,
 * relojes, mapas de actores) sigue en la piel; aquí sólo vive la DECISIÓN y la
 * ARITMÉTICA del cross-slide, que es lo que merece regresión.
 *
 * Contrato (idéntico al de `skin.ts` antes de la extracción):
 *  · un paso de 1 tile (Manhattan==1) en mundo y misma location, con la capa mundo
 *    anterior disponible → TWEEN (cross-slide); cualquier otro cambio de centro o de
 *    location → SNAP seco; sin cambio → HOLD (el tween en curso sigue su reloj).
 *  · cada actor desliza de su celda de ventana previa a la nueva SÓLO si el salto por
 *    eje es ≤ `maxStep`; más que eso (spawn/teleport) se pinta seco en su celda nueva.
 */

/** Celda de ventana (col,row) de un actor, o el centro del viewport en tiles. */
export interface Cell {
  col: number;
  row: number;
}

/** Qué hacer con el tween de scroll ante un cambio de centro entre turnos. */
export type StepKind = "tween" | "snap" | "hold";

/**
 * Decide el tratamiento del paso a partir del desplazamiento del centro (dx,dy en
 * tiles), si la location es la misma, si el motion está activo y si hay una capa
 * mundo anterior que deslizar. Réplica EXACTA del if/else de `updateMotion`.
 */
export function classifyStep(args: {
  dx: number;
  dy: number;
  sameLoc: boolean;
  motionEnabled: boolean;
  hasPrev: boolean;
}): StepKind {
  const man = Math.abs(args.dx) + Math.abs(args.dy);
  if (args.motionEnabled && man === 1 && args.sameLoc && args.hasPrev) return "tween";
  if (man !== 0 || !args.sameLoc) return "snap";
  return "hold";
}

/**
 * Progreso del tween por reloj de pared. `t` sube linealmente 0→1 en `durMs`; al
 * llegar a 1 (`done`) la piel limpia el tween. Réplica del cálculo de `present`.
 */
export function tweenProgress(now: number, start: number, durMs: number): { t: number; done: boolean } {
  const raw = (now - start) / durMs;
  if (raw >= 1) return { t: 1, done: true };
  return { t: raw, done: false };
}

/**
 * Offsets device del cross-slide, desde el origen del rect del mundo `(ox,oy)`:
 *  · V0 (la fila/columna que SALE) se desplaza −t·paso;
 *  · V1 (el mundo NUEVO) se desplaza +(1−t)·paso, cubriendo todo menos la franja
 *    saliente que rellena V0. `cell` = tamaño de tile device (16·S).
 */
export function crossSlideOffsets(
  ox: number,
  oy: number,
  t: number,
  dx: number,
  dy: number,
  cell: number,
): { v0: { x: number; y: number }; v1: { x: number; y: number } } {
  return {
    v0: { x: ox - t * dx * cell, y: oy - t * dy * cell },
    v1: { x: ox + (1 - t) * dx * cell, y: oy + (1 - t) * dy * cell },
  };
}

/**
 * PIXEL-SNAP del cross-slide (prototipo A/B, `?pixelsnap=1`): cuantiza los offsets device del
 * blit del mundo a píxel ENTERO. `tweenV0`/`worldCanvas` son BITMAPS ya rasterizados a resolución
 * de dispositivo (`size`), y el cross-slide los blitea con `off.v0/off.v1` (posiblemente
 * fraccionarios). Redondearlos deja el mundo en la rejilla entera cada frame del tween.
 *
 * HALLAZGO MEDIDO (carril pixel-snap, castillo loc17): este flag es un **no-op práctico**.
 * El blit del cross-slide corre con `imageSmoothingEnabled=false` (nearest) y sin escalado
 * (fuente y destino miden `size`), y la piel FUERZA escala ENTERA (`Math.round(width/SCREEN_W)`
 * → `cell = 16·s` entero). Un `drawImage` nearest 1:1 trasladado un offset fraccionario `f`
 * equivale EXACTAMENTE a una traslación de `round(f)` píxeles (para x entero,
 * `floor(x+0.5−f) = x − round(f)`, constante ∀x): NO hay resampleo sub-píxel que quitar. El
 * suelo ya se desplaza en pasos de píxel ENTERO. Métrica de residuo rígido en el tween ≈ 0%
 * con y sin flag; salida byte-idéntica. Se conserva tras flag como kill-switch documentado y
 * por si un futuro cambio del pipeline (escala no entera / smoothing ON) reintrodujera la
 * fracción. El «shimmer» percibido, si persiste, NO nace aquí (candidatos: xBR dependiente del
 * vecindario que cambia por paso, o el resampleo canvas→pantalla del navegador en displays de
 * DPR fraccionario — ninguno lo toca este redondeo).
 *
 * V0 y V1 solapan casi por completo (V1 encima cubre todo menos la franja saliente de ancho
 * ≤ 1 tile), así que redondear cada offset de forma INDEPENDIENTE no abre costura. En el settle
 * (t=1) `(1−t)·dx·cell = 0` → V1 ya está en `(ox,oy)` enteros: NO-OP → byte-idéntico.
 */
export function snapCrossSlide(off: {
  v0: { x: number; y: number };
  v1: { x: number; y: number };
}): { v0: { x: number; y: number }; v1: { x: number; y: number } } {
  return {
    v0: { x: Math.round(off.v0.x), y: Math.round(off.v0.y) },
    v1: { x: Math.round(off.v1.x), y: Math.round(off.v1.y) },
  };
}

/** Recorta `x` al rango [0,1] (reloj del tween de actores). */
export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Posición de ventana INTERPOLADA de un actor entre `from` y `to` con progreso `t`
 * (lineal). Si el salto por cualquier eje supera `maxStep` (spawn/teleport/cambio de
 * escena) NO se desliza: se devuelve `to` seco. Réplica del bucle de `paintActors`.
 */
export function slideActor(from: Cell, to: Cell, t: number, maxStep: number): Cell {
  const dcol = to.col - from.col;
  const drow = to.row - from.row;
  if (Math.abs(dcol) <= maxStep && Math.abs(drow) <= maxStep) {
    return { col: from.col + dcol * t, row: from.row + drow * t };
  }
  return { col: to.col, row: to.row };
}

/**
 * `from` del tween de un actor: la posición REALMENTE compuesta el último frame si la
 * hay (para no saltar cuando un turno rápido interrumpe un tween en vuelo), si no la
 * del snapshot anterior, si no la actual. Réplica de `rendered ?? prevTo ?? to`.
 */
export function resolveActorFrom(rendered: Cell | undefined, prevTo: Cell | undefined, to: Cell): Cell {
  return rendered ?? prevTo ?? to;
}

/**
 * `from` del tween de un actor incluyendo el caso de ENTRADA por scroll (borde-entrante):
 * · visto el frame/turno anterior → `resolveActorFrom` (posición realmente compuesta o
 *   la del snapshot previo), como siempre.
 * · actor NUEVO (sin rendered ni prevTo) que ha aparecido porque el mundo scrolleó un tile
 *   (`scroll` != null = paso de 1 tile con tween de terreno activo ESTE turno): su celda de
 *   ventana del turno anterior era `to` desplazada por el delta de centro (venía de fuera del
 *   borde entrante). Devolverla hace que el actor DESLICE hacia dentro con el terreno en vez
 *   de aparecer clavado en su celda final (el «pop del borde entrante»). Como `dx,dy` ∈ {−1,0,1}
 *   con Manhattan 1, el salto por eje es ≤ 1 ≤ `ACTOR_STEP_MAX` → `slideActor` interpola.
 * · actor NUEVO sin scroll (spawn/teleport/entrar a location): `scroll` == null → `to` seco,
 *   comportamiento de siempre (sin salto fantasma).
 * En t=1 el resultado es SIEMPRE `to` (byte-idéntico al render actual); sólo cambian los
 * frames intermedios del tween.
 */
export function actorSlideFrom(
  rendered: Cell | undefined,
  prevTo: Cell | undefined,
  to: Cell,
  scroll: { dx: number; dy: number } | null,
): Cell {
  // Actor NUEVO entrado por scroll: celda de ventana previa = `to` + delta de centro
  // (venía de fuera del borde entrante). El resto de casos → lógica de siempre.
  if (scroll && !rendered && !prevTo) return { col: to.col + scroll.dx, row: to.row + scroll.dy };
  return resolveActorFrom(rendered, prevTo, to);
}

/** Actor del turno anterior que SALE de la ventana por scroll, con su tile y su tween
 *  de deslizamiento hacia fuera (from=celda previa, to=celda previa−scroll, fuera del
 *  borde). Lo pinta la piel recortado al viewport → en t=1 queda fuera del clip. */
export interface ExitingActor {
  id: string;
  tile: number;
  from: Cell;
  to: Cell;
}

/** Celda de un actor del turno anterior (para calcular las salidas): su tile y su celda. */
export interface PrevActor {
  id: string;
  tile: number;
  col: number;
  row: number;
}

/**
 * ESPEJO de `actorSlideFrom` para el borde SALIENTE: durante un tween de scroll, los
 * actores que estaban en la ventana el turno anterior (`prev`) y YA NO están en el actual
 * (`curIds`) porque el mundo scrolleó un tile deben DESLIZAR hacia fuera con el terreno en
 * vez de desaparecer de golpe (el coreview omite las entidades fuera de la ventana 11×11).
 *
 * Todo se mueve −`scroll` en coordenadas de ventana por paso (si el centro va +dx, los
 * actores van −dx). La celda nueva de un saliente sería `prevCell − scroll`; si cae FUERA de
 * `[0,window)` (necesariamente por el eje del paso, porque `prevCell` estaba dentro y `scroll`
 * es Manhattan 1) el actor cruzó el borde → se pinta deslizando de `prevCell` a `prevCell −
 * scroll`. En t=1 esa celda está fuera del clip del viewport = invisible → byte-idéntico al
 * render actual (donde el actor simplemente no está). Las desapariciones que NO son por scroll
 * (muerte/teleport/sprite-off del Mimic: `prevCell − scroll` sigue DENTRO de la ventana, o no
 * hay `scroll`) NO se deslizan: se devuelve lista vacía / se omiten.
 */
export function exitingActors(
  prev: readonly PrevActor[],
  curIds: ReadonlySet<string>,
  scroll: { dx: number; dy: number } | null,
  window: number,
): ExitingActor[] {
  if (!scroll) return [];
  const out: ExitingActor[] = [];
  for (const p of prev) {
    if (curIds.has(p.id)) continue; // sigue visible → no ha salido
    const inside = p.col >= 0 && p.col < window && p.row >= 0 && p.row < window;
    if (!inside) continue; // no estaba realmente en la ventana el turno anterior
    const to = { col: p.col - scroll.dx, row: p.row - scroll.dy };
    const crossed = to.col < 0 || to.col >= window || to.row < 0 || to.row >= window;
    if (!crossed) continue; // desapareció sin cruzar el borde → muerte/teleport, no scroll
    out.push({ id: p.id, tile: p.tile, from: { col: p.col, row: p.row }, to });
  }
  return out;
}

/**
 * NIEBLA DE CIUDAD (town-shadow-anchor): durante el tween, la niebla/LOS deja de
 * anclarse a pantalla y hace CROSS-SLIDE como el terreno — cada campo de visibilidad
 * viaja con SU capa de mundo (V0 sale, V1 entra). `litCells` enumera las celdas de
 * ventana ILUMINADAS de un `visMask` (valor 1): son las que el compositor REVELA
 * (destination-out) al deslizar cada campo por su offset. Una celda queda a oscuras
 * sólo si NINGÚN campo la ilumina (unión de luz = intersección de sombra), así el
 * disco de luz —cubierto por la unión de los dos campos solapados— no laggea, y el
 * borde LOS de los edificios desliza con los edificios.
 */
export function litCells(mask: Uint8Array, window: number): Cell[] {
  const out: Cell[] = [];
  for (let row = 0; row < window; row++) {
    for (let col = 0; col < window; col++) {
      if (mask[row * window + col] === 1) out.push({ col, row });
    }
  }
  return out;
}

/**
 * DESCOMPOSICIÓN DE LA NIEBLA (fog-two-fields): durante el tween la oscuridad se pinta en
 * DOS capas con anclajes distintos, porque tiene dos orígenes físicos diferentes:
 *   · el HALO de la party (radio ambiental/antorcha) va pegado al Avatar (centro de
 *     pantalla) → su borde debe quedar ANCLADO A PANTALLA (no barrer con el terreno);
 *   · la sombra por OCLUSIÓN de muros va pegada a los edificios → su borde debe DESLIZAR
 *     con el terreno (testigo de ciudad, 7044b7b7).
 * `visMask` = campo F combinado (1=visible). `visRadius` = disco de radio puro de la party
 * (1=dentro del radio), center-anchored. Las máscaras derivadas alimentan a `paintFog`
 * (capa ANCLADA) y `paintFogSlide` (capa que DESLIZA), cada una recortando su parte:
 *
 *   anchoredLit = visMask OR visRadius   → paintFog ennegrece (¬visMask ∩ ¬visRadius) =
 *     la oscuridad FUERA del disco (caída del radio). Fija a pantalla. Excluye las celdas
 *     iluminadas por emisores fuera del disco (visMask=1) para no taparlas.
 *   occlusionLit = visMask OR NOT visRadius → paintFogSlide ennegrece (¬visMask ∩ visRadius)
 *     = la oscuridad DENTRO del disco (muro que tapa). Desliza con el terreno; NO ennegrece
 *     nada fuera del disco (eso lo hace la capa anclada) → sin bulge del borde entrante.
 *
 * Unión de ambas negruras = (¬visMask ∩ ¬visRadius) ∪ (¬visMask ∩ visRadius) = ¬visMask →
 * en el settle byte-idéntico a `paintFog(visMask)`; sólo cambian los frames del tween.
 * CAVEAT de la VÍA VIEJA (`?fogpremul=off`, aprox. declarada, conservadora): el borde
 * EXTERIOR del halo de un emisor que quede fuera del disco de la party se ancla (no
 * desliza) — nunca revela de más, pero la mancha de luz de una MOONGATE de noche salta
 * a tirones de tile. En la vía PREMUL (default) esto está RESUELTO: el halo de emisor
 * desliza con el terreno (ver `anchoredFogSlideShowsBlack` + `paintAnchoredFogSlide`).
 */
/** `out` opcional (PERF-4): buffer de instancia del caller para no alocar por frame;
 *  si falta o no casa el tamaño, se aloca (compatibilidad con tests/llamadas sueltas). */
export function anchoredLitMask(
  visMask: Uint8Array,
  visRadius: Uint8Array,
  out?: Uint8Array,
): Uint8Array {
  const o = out && out.length === visMask.length ? out : new Uint8Array(visMask.length);
  for (let i = 0; i < o.length; i++) o[i] = visMask[i] === 1 || visRadius[i] === 1 ? 1 : 0;
  return o;
}

export function occlusionLitMask(
  visMask: Uint8Array,
  visRadius: Uint8Array,
  out?: Uint8Array,
): Uint8Array {
  const o = out && out.length === visMask.length ? out : new Uint8Array(visMask.length);
  for (let i = 0; i < o.length; i++) o[i] = visMask[i] === 1 || visRadius[i] === 0 ? 1 : 0;
  return o;
}

/**
 * NIEBLA PRE-MULTIPLICADA (fog-premul): máscara de celdas a ENNEGRECER DENTRO del bitmap de
 * mundo ANTES del cross-slide, sustituyendo el pase por-frame de máscaras que se pintaba encima
 * del terreno ya deslizado (`paintFogSlide` + gates — la fuente de las fugas del borde y del
 * coste bimodal del tween). Es la componente de OCLUSIÓN que DESLIZA con el terreno:
 *
 *   veil = ¬occlusionLit = (visMask==0) ∩ (visRadius==1)   [con disco]
 *   veil = ¬visMask                                        [sin disco / de día]
 *
 * = las celdas OCULTAS que caen DENTRO del disco de radio (muro que tapa; viajan con los
 * edificios, testigo de ciudad 7044b7b7). La caída del RADIO (visMask==0 ∩ visRadius==0) NO se
 * hornea: la pinta la capa ANCLADA A PANTALLA aparte (`paintFog(anchoredLitMask)`), para que el
 * disco no derive/bulge con el terreno (night-fog 5334e884). Unión de la negrura horneada +
 * anclada = ¬visMask → en el settle (t=1) byte-idéntico a `paintFog(visMask)`.
 *
 * Cada bitmap se hornea con SU PROPIO campo (V0 con el visMask/visRadius pre-paso, V1 con el
 * nuevo): el cross-slide desliza dos imágenes YA correctas y NINGÚN contenido ocluido puede
 * asomar en la franja entrante/saliente — no existe en los bitmaps (mata por construcción la
 * familia rooms-flash/occlusion-edge). Sin `visRadius` (de día, disco pleno) se hornea ¬visMask
 * entero: no hay disco que anclar, así que la niebla entera puede deslizar.
 *
 * 🔴 FUGA DEL FILO DEL DISCO (fog-rim, 03-08) — por qué el disco va DILATADO. La partición de
 * ¬visMask en «dentro del disco → horneada, viaja» / «fuera del disco → anclada, no viaja» usa
 * `visRadius`, que NO es geometría de mundo: es el halo de la party, pegado a la PANTALLA. Al
 * hornearla dentro de un bitmap que luego DESLIZA, los dos lados de la partición se evalúan en
 * SISTEMAS DE REFERENCIA distintos durante el tween — la horneada en el índice del bitmap (que
 * se mueve) y la anclada en el índice de PANTALLA (que no). Una casilla OCULTA y FUERA del disco
 * (¬visMask ∩ ¬visRadius) no se hornea (delega en la anclada) pero el slide la arrastra bajo una
 * celda de pantalla que SÍ está dentro del disco, donde la capa anclada no pinta: asoma su
 * terreno. Medido: media luna pegada al filo TRASERO del disco, de área (1−t)·(filas del disco)
 * — 7,00 celdas a t=0 con antorcha (light=10), 0 al asentar; cero de día (disco pleno). Es el
 * «se ven casillas que no deben verse» del reporte, y por eso sólo se ve EN MOVIMIENTO y de NOCHE.
 *
 * El cierre: hornear con el disco ALCANZABLE POR EL DESLIZAMIENTO (`discReaches`) en vez del
 * disco crudo — el paso es de 1 tile CARDINAL (Manhattan==1, ver `classifyStep`), así que toda
 * casilla que pueda acabar bajo el disco de pantalla es el disco dilatado en su 4-vecindad. Es
 * ESTRICTAMENTE CONSERVADOR: sólo añade negro sobre celdas con `visMask==0`, que por definición
 * NO deben verse; jamás tapa luz (un agujero de halo de emisor es `visMask==1`, nunca horneado).
 * En el settle la unión sigue siendo ¬visMask ∩ (dilatado ∪ ¬visRadius) = ¬visMask → mismo
 * conjunto negro que antes, sólo que lo pinta la otra capa ⇒ salida idéntica.
 */
export function bakeFogVeilMask(
  visMask: Uint8Array,
  visRadius: Uint8Array | null,
  window: number,
  out?: Uint8Array,
  carry?: CarriedHalo | null,
): Uint8Array {
  const o = out && out.length === visMask.length ? out : new Uint8Array(visMask.length);
  for (let row = 0; row < window; row++) {
    for (let col = 0; col < window; col++) {
      const i = row * window + col;
      const inDisc = visRadius ? discReaches(visRadius, window, col, row) : true;
      o[i] =
        visMask[i] === 0 && inDisc && !(visRadius && leftTheHaloThisStep(carry, visRadius, window, col, row))
          ? 1
          : 0;
    }
  }
  return o;
}

/**
 * Campo del frame ANTERIOR alineado por el paso, para `bakeFogVeilMask`. Índices: la MISMA
 * casilla de mundo tiene índice `c + (dx,dy)` en el campo viejo y `c` en el nuevo (la ventana
 * se mueve con el centro), igual que en `outgoingGatedMaskV0` («V1-índice = V0-índice − paso»).
 */
export interface CarriedHalo {
  visMask0: Uint8Array;
  visRadius0: Uint8Array;
  dx: number;
  dy: number;
}

/**
 * 🔴 EL BORDE TRASERO SE APAGABA DE GOLPE (reporte del usuario, 08-08: «en la dirección opuesta
 * al movimiento los tiles se muestran a saltos»). La celda que ABANDONA el halo con el paso.
 *
 * El horneado vela `¬visMask ∩ discReaches(visRadius)`, y esa DILATACIÓN a la 4-vecindad —que
 * existe para que ninguna casilla oculta asome al deslizarse bajo el disco (fog-rim)— incluye por
 * fuerza el anillo que el disco acaba de DEJAR ATRÁS. Esas celdas estaban iluminadas en pantalla
 * el fotograma anterior, y velarlas DENTRO del bitmap las apaga en t=0, cuando el bitmap todavía
 * está dibujado en la posición VIEJA: la columna/fila trasera desaparece entera en el primer
 * fotograma del tween y va «rellenándose» según el terreno resbala. Medido en el navegador
 * (overworld, hora 1, paso al Este): la columna oeste del recuadro iluminado se apaga en el
 * primer fotograma y no vuelve hasta el asentamiento.
 *
 * El discriminante NO es «estaba visible antes» a secas — eso incluiría la celda que un MURO
 * acaba de ocultar, que debe nacer velada (LOS instantáneo, testigo rooms-flash-post-b15). Es la
 * conjunción que aísla la caída del RADIO, que es geometría de PANTALLA y no de mundo:
 *   · la casilla estaba ILUMINADA en el campo viejo (`visMask0`), o sea se veía; y
 *   · estaba DENTRO del disco de radio viejo y ya NO lo está en el nuevo.
 * Entonces su negrura le toca a la capa ANCLADA A PANTALLA, que la irá tapando conforme la
 * casilla resbale fuera del halo — un barrido continuo — en vez de al bitmap que se desliza.
 *
 * ★★ La forma del error, otra vez la de `outgoingGatedMaskV0`: **una dilatación pensada para el
 * filo por el que se ENTRA se aplicó también al filo por el que se SALE**, y en el de salida
 * significa lo contrario. Un mismo predicado geométrico, dos filos, dos veredictos.
 *
 * Sin `carry` (reposo, fotograma de cierre del tween, o cualquier llamada sin paso) el predicado
 * es constantemente falso ⇒ el horneado es EL DE ANTES, bit a bit: el asentamiento no se mueve.
 */
function leftTheHaloThisStep(
  carry: CarriedHalo | null | undefined,
  visRadius: Uint8Array,
  window: number,
  col: number,
  row: number,
): boolean {
  if (!carry) return false;
  if (visRadius[row * window + col] !== 0) return false; // dentro del disco crudo: no es el anillo
  const pc = col + carry.dx;
  const pr = row + carry.dy;
  if (pc < 0 || pc >= window || pr < 0 || pr >= window) return false; // el campo viejo no opina
  const p = pr * window + pc;
  return carry.visMask0[p] === 1 && carry.visRadius0[p] === 1;
}

/**
 * DISCO ALCANZABLE POR EL DESLIZAMIENTO (fog-rim): ¿la celda `(col,row)` está dentro del disco
 * de radio O puede acabar, durante el cross-slide, bajo una celda de PANTALLA que sí lo está?
 * Como el paso es de 1 tile CARDINAL, el bitmap se desplaza ≤1 celda en x O en y, así que el
 * conjunto alcanzable es el disco DILATADO en su 4-vecindad. Fuera de la ventana cuenta como 0.
 *
 * Predicado compartido por la vía PREMUL (`bakeFogVeilMask`, que lo aplica al horneado) y por la
 * VÍA VIEJA (`?fogpremul=off`, que lo aplica al disco con el que se construye `occlusionLitMask`
 * de cada campo). Las dos partían el mismo ¬visMask con el mismo disco crudo y las dos filtraban
 * la misma media luna — medido 2,59 y 2,58 celdas de terreno destapado a t=0, respectivamente.
 *
 * 🔴 PREMISA DE LA QUE CUELGA TODO ESTO, y que NO es una propiedad de esta función: que el
 * desplazamiento máximo de un tween sea de **1 celda en 4-vecindad**. Hoy lo garantiza
 * `classifyStep`, que sólo devuelve "tween" con `man === 1` (Manhattan, o sea cardinal y de una
 * sola casilla). Si algún día se admite paso DIAGONAL, salto de más de un tile, o un tween que
 * abarque dos pasos, **esta dilatación se queda corta y la fuga vuelve en silencio** — los tests
 * del composite seguirían dando 0 porque sólo barren los casos que hoy existen. Por eso la
 * premisa tiene test propio que se pone rojo si deja de cumplirse: ver en
 * `tests/shader-motion.test.ts` › «PREMISA DE LA DILATACIÓN».
 */
export function discReaches(
  visRadius: Uint8Array,
  window: number,
  col: number,
  row: number,
): boolean {
  const at = (c: number, r: number): boolean =>
    c >= 0 && c < window && r >= 0 && r < window && visRadius[r * window + c] === 1;
  return at(col, row) || at(col + 1, row) || at(col - 1, row) || at(col, row + 1) || at(col, row - 1);
}

/**
 * Disco de radio DILATADO a la 4-vecindad (`discReaches` materializado como máscara), para los
 * consumidores que necesitan el ARRAY y no el predicado — la vía vieja se lo pasa a
 * `occlusionLitMask` en lugar del disco crudo. `out` opcional (buffer de instancia, sin alloc).
 */
export function slideReachableDisc(
  visRadius: Uint8Array,
  window: number,
  out?: Uint8Array,
): Uint8Array {
  const o = out && out.length === visRadius.length ? out : new Uint8Array(visRadius.length);
  for (let row = 0; row < window; row++)
    for (let col = 0; col < window; col++)
      o[row * window + col] = discReaches(visRadius, window, col, row) ? 1 : 0;
  return o;
}

/**
 * COMPOSITE DE LA VÍA PREMUL DURANTE EL TWEEN (fog-rim) — el modelo que FALTABA, y por cuyo
 * hueco entró la fuga del filo del disco.
 *
 * Los invariantes que vigilaban `bakeFogVeilMask` («veil ∪ ¬anchoredLit = ¬visMask», disjunción)
 * se asertaban ÍNDICE A ÍNDICE, o sea comparando las dos capas EN LA MISMA CELDA: eso es el
 * SETTLE. Ninguno componía las dos capas con el DESPLAZAMIENTO del cross-slide de por medio —
 * que es justo donde la capa horneada (índice de bitmap, se mueve) y la anclada (índice de
 * pantalla, no se mueve) dejan de estar en la misma celda. Este modelo cierra ese hueco.
 *
 * Responde: en el punto de PANTALLA `(px,py)` (unidades de CELDA, fraccionario), ¿se está
 * mostrando el terreno de una casilla que su PROPIO campo declara OCULTA (`visMask==0`)?
 * `true` = FUGA. Réplica de la composición de `skin.ts`:
 *   · capa ANCLADA: negro donde `visRadius1[S]==0` (base de `paintAnchoredFogSlide`). Sus
 *     agujeros de halo de emisor se ignoran a propósito — sólo se punzan donde `visMask==1`,
 *     así que jamás pueden destapar una casilla oculta (ignorarlos es CONSERVADOR: como mucho
 *     este modelo acusaría de más, nunca de menos).
 *   · terreno: V1 (encima) desplazado +(1−t)·paso; donde V1 no llega, V0 a −t·paso.
 *   · veladura: la del bitmap del campo DUEÑO, vía `bakeFogVeilMask` (la función REAL, no una
 *     copia — si el horneado cambia, este modelo cambia con él).
 *
 * Contra la deriva modelo/compositor: el mismo perfil que predice esta función se midió en el
 * NAVEGADOR sobre el compositor real (franja de (1−t)·celda pegada al filo trasero del disco:
 * 16128 px a t=0, 12096 a t=0,25, 8064 a t=0,5, 4032 a t=0,75, 0 al asentar — exactamente
 * (1−t)·7 celdas con antorcha).
 */
export function premulShowsHiddenAt(args: {
  visMask0: Uint8Array;
  visRadius0: Uint8Array | null;
  visMask1: Uint8Array;
  visRadius1: Uint8Array | null;
  window: number;
  dx: number;
  dy: number;
  t: number;
  /** Punto de pantalla en unidades de CELDA (p.ej. 3.5 = centro de la celda 3). */
  px: number;
  py: number;
  /**
   * Horneado del filo trasero (08-08). Con `carry`, el SUJETO del predicado se estrecha a lo
   * único que sigue siendo una fuga cuando la luz del fotograma anterior puede persistir:
   * terreno de una casilla que **ninguno de los dos campos** ha dado nunca por visible. Una
   * casilla que el campo VIEJO iluminaba no se está «destapando»: estaba en pantalla hace
   * 16 ms, y taparla de golpe era el defecto. Sin `carry`, el predicado de siempre.
   */
  carry?: CarriedHalo | null;
}): boolean {
  const { visMask0, visRadius0, visMask1, visRadius1, window: w, dx, dy, t, px, py } = args;
  const sc = Math.floor(px);
  const sr = Math.floor(py);
  if (sc < 0 || sc >= w || sr < 0 || sr >= w) return false;
  // Capa ANCLADA: fuera del disco de pantalla pinta negro → nada puede asomar ahí.
  if (visRadius1 && visRadius1[sr * w + sc] !== 1) return false;
  // ¿Qué bitmap/celda se ve en ese punto? V1 (encima) y si no llega, V0.
  let vm = visMask1;
  let vr = visRadius1;
  let owner: "v1" | "v0" = "v1";
  let c = Math.floor(px - (1 - t) * dx);
  let r = Math.floor(py - (1 - t) * dy);
  if (c < 0 || c >= w || r < 0 || r >= w) {
    vm = visMask0;
    vr = visRadius0;
    owner = "v0";
    c = Math.floor(px + t * dx);
    r = Math.floor(py + t * dy);
    if (c < 0 || c >= w || r < 0 || r >= w) return false; // nada dibujado
  }
  const i = r * w + c;
  if (vm[i] !== 0) return false; // la casilla mostrada SÍ es visible → no es fuga
  // El `carry` sólo gobierna el bitmap V1 (el nuevo); la franja de V0 lleva su propio campo.
  const carry = owner === "v1" ? (args.carry ?? null) : null;
  if (carry) {
    const pc = c + carry.dx;
    const pr = r + carry.dy;
    const seen =
      pc >= 0 && pc < w && pr >= 0 && pr < w && carry.visMask0[pr * w + pc] === 1;
    if (seen) return false; // se veía hace un fotograma: mostrarla no destapa nada nuevo
  }
  return bakeFogVeilMask(vm, vr, w, undefined, carry)[i] !== 1; // oculta y sin velar → asoma
}

/**
 * CONTROL OPUESTO (fog-rim): ¿el punto de PANTALLA sale NEGRO estando el terreno que le toca
 * mostrar declarado VISIBLE por su propio campo? Es el simétrico exacto de
 * `premulShowsHiddenAt`, y hace falta porque el predicado de la fuga **es de un solo filo**:
 * una veladura que lo tapase TODO daría 0,00 de fuga y estaría rotísima. Sin esta segunda
 * cifra, «0 fugas» no distingue «arreglado» de «apagado».
 *
 * ⚠ Este predicado NO es cero ni antes ni después del fix, y la razón es de DISEÑO, no un
 * defecto introducido: durante el tween el CAMPO de visibilidad ya ha saltado a su valor nuevo
 * (el LOS del original es instantáneo) mientras el TERRENO todavía interpola. El disco está
 * anclado a pantalla, así que en el filo DELANTERO hay celdas de pantalla fuera del disco que
 * muestran terreno que sí es visible, y la capa ANCLADA —que este fix no toca— las ennegrece.
 * Es la mitad CONSERVADORA de la misma geometría (tapa de más, nunca destapa de menos) y
 * preexiste al fix; la cifra se mide en la batería para que no crezca en silencio.
 */
export function premulHidesVisibleAt(args: {
  visMask0: Uint8Array;
  visRadius0: Uint8Array | null;
  visMask1: Uint8Array;
  visRadius1: Uint8Array | null;
  window: number;
  dx: number;
  dy: number;
  t: number;
  px: number;
  py: number;
}): boolean {
  const { visMask0, visRadius0, visMask1, visRadius1, window: w, dx, dy, t, px, py } = args;
  const sc = Math.floor(px);
  const sr = Math.floor(py);
  if (sc < 0 || sc >= w || sr < 0 || sr >= w) return false;
  // ¿Qué bitmap/celda se ve (o se vería) en ese punto? Mismo muestreo que el predicado hermano.
  let vm = visMask1;
  let vr = visRadius1;
  let c = Math.floor(px - (1 - t) * dx);
  let r = Math.floor(py - (1 - t) * dy);
  if (c < 0 || c >= w || r < 0 || r >= w) {
    vm = visMask0;
    vr = visRadius0;
    c = Math.floor(px + t * dx);
    r = Math.floor(py + t * dy);
    if (c < 0 || c >= w || r < 0 || r >= w) return false; // nada dibujado: no se oculta nada
  }
  const i = r * w + c;
  if (vm[i] !== 1) return false; // la casilla mostrada NO es visible → taparla es correcto
  // Negro por la capa ANCLADA (fuera del disco de pantalla), salvo agujero de halo de emisor.
  const anchoredBlack =
    visRadius1 !== null &&
    visRadius1[sr * w + sc] === 0 &&
    !(vm[i] === 1 && vr !== null && vr[i] === 0); // halo de emisor: se punza a su posición
  // Negro por el HORNEADO del propio bitmap (no puede pasar: el horneado exige visMask==0).
  const baked = bakeFogVeilMask(vm, vr, w)[i] === 1;
  return anchoredBlack || baked;
}

/**
 * Barrido del composite premul: AREA DE PANTALLA (en celdas) que muestra terreno de una casilla
 * OCULTA, muestreando `sub`×`sub` puntos por celda. 0 = ninguna fuga. Es la cifra que nombra la
 * regresión — con el disco SIN dilatar da (1−t)·(filas que abarca el disco).
 */
export function premulHiddenArea(args: {
  visMask0: Uint8Array;
  visRadius0: Uint8Array | null;
  visMask1: Uint8Array;
  visRadius1: Uint8Array | null;
  window: number;
  dx: number;
  dy: number;
  t: number;
  sub?: number;
  /** Ver `premulShowsHiddenAt`: con `carry` el sujeto es «oculta en LOS DOS campos». */
  carry?: CarriedHalo | null;
}): number {
  const sub = args.sub ?? 8;
  const w = args.window;
  let hits = 0;
  for (let sy = 0; sy < w * sub; sy++) {
    for (let sx = 0; sx < w * sub; sx++) {
      if (premulShowsHiddenAt({ ...args, px: (sx + 0.5) / sub, py: (sy + 0.5) / sub })) hits++;
    }
  }
  return hits / (sub * sub);
}

/** Barrido del CONTROL OPUESTO: área de pantalla (en celdas) que sale NEGRA tapando terreno
 *  VISIBLE. Ver `premulHidesVisibleAt` — no es cero por diseño, y su papel es que no CREZCA. */
export function premulHiddenVisibleArea(args: {
  visMask0: Uint8Array;
  visRadius0: Uint8Array | null;
  visMask1: Uint8Array;
  visRadius1: Uint8Array | null;
  window: number;
  dx: number;
  dy: number;
  t: number;
  sub?: number;
}): number {
  const sub = args.sub ?? 8;
  const w = args.window;
  let hits = 0;
  for (let sy = 0; sy < w * sub; sy++) {
    for (let sx = 0; sx < w * sub; sx++) {
      if (premulHidesVisibleAt({ ...args, px: (sx + 0.5) / sub, py: (sy + 0.5) / sub })) hits++;
    }
  }
  return hits / (sub * sub);
}

/**
 * 🔴 EL FILO TRASERO, que ninguna métrica anterior medía (reporte del usuario 08-08).
 *
 * `premulHiddenVisibleArea` («negro sobre terreno visible») mira el filo por el que se ENTRA:
 * con paso al Este da 7,00 celdas a t=0 y su docstring lo declara correcto por diseño (la casilla
 * asoma un tile por delante del disco anclado y la capa anclada la tapa — sí debe taparla: en
 * t=0 la pantalla tiene que ser IGUAL que antes del paso, y antes del paso esa casilla no se
 * veía). Ese predicado **no puede ver** el defecto del filo TRASERO, porque allí la casilla que
 * se apaga sale NEGRA DENTRO DEL BITMAP y la métrica exige `visMask==1` para contarla.
 * ★★ Una métrica de un solo filo aplaude el filo correcto y deja el otro sin instrumento.
 *
 * Éste es el predicado del filo trasero: ¿el punto de PANTALLA `(px,py)` sale NEGRO estando
 * DENTRO del disco anclado y mostrando una casilla que el campo VIEJO daba por ILUMINADA?
 * Si es así, la pantalla ha perdido en medio del paso algo que se veía al empezarlo, y no ha sido
 * la caída del halo (estamos dentro del disco): lo ha velado el horneado del bitmap.
 * `true` = defecto. Cero antes y después de `t`; cero también de día (disco pleno, nada sale).
 */
export function premulBlacksCarriedAt(args: {
  visMask0: Uint8Array;
  visRadius0: Uint8Array;
  visMask1: Uint8Array;
  visRadius1: Uint8Array;
  window: number;
  dx: number;
  dy: number;
  t: number;
  px: number;
  py: number;
  /** `null` = medir el horneado SIN el arreglo (mutante por causa de muerte). */
  carry?: CarriedHalo | null;
}): boolean {
  const { visMask0, visRadius0, visMask1, visRadius1, window: w, dx, dy, t, px, py } = args;
  const sc = Math.floor(px);
  const sr = Math.floor(py);
  if (sc < 0 || sc >= w || sr < 0 || sr >= w) return false;
  // Fuera del disco ANCLADO la capa anclada ennegrece con todo el derecho (la casilla ya no está
  // bajo el halo): ese negro no es el defecto. El defecto es perder luz DENTRO del disco.
  if (visRadius1[sr * w + sc] !== 1) return false;
  const c = Math.floor(px - (1 - t) * dx);
  const r = Math.floor(py - (1 - t) * dy);
  if (c < 0 || c >= w || r < 0 || r >= w) return false; // lo pinta V0, no este predicado
  const pc = c + dx;
  const pr = r + dy;
  if (pc < 0 || pc >= w || pr < 0 || pr >= w) return false; // sin contraparte vieja: no se veía
  if (visMask0[pr * w + pc] !== 1) return false; // no estaba iluminada antes: velarla es correcto
  const carry =
    args.carry === undefined ? { visMask0, visRadius0, dx, dy } : args.carry;
  return bakeFogVeilMask(visMask1, visRadius1, w, undefined, carry)[r * w + c] === 1;
}

/** Barrido de `premulBlacksCarriedAt`: ÁREA DE PANTALLA (en celdas) que pierde luz que ya tenía. */
export function premulBlacksCarriedArea(args: {
  visMask0: Uint8Array;
  visRadius0: Uint8Array;
  visMask1: Uint8Array;
  visRadius1: Uint8Array;
  window: number;
  dx: number;
  dy: number;
  t: number;
  sub?: number;
  carry?: CarriedHalo | null;
}): number {
  const sub = args.sub ?? 8;
  const w = args.window;
  let hits = 0;
  for (let sy = 0; sy < w * sub; sy++) {
    for (let sx = 0; sx < w * sub; sx++) {
      if (premulBlacksCarriedAt({ ...args, px: (sx + 0.5) / sub, py: (sy + 0.5) / sub })) hits++;
    }
  }
  return hits / (sub * sub);
}

/**
 * Z-ORDER de la niebla deslizante (fog-zorder): decide si la celda de PANTALLA
 * `(col,row)` acaba mostrando terreno (revelada) o negra durante el cross-slide,
 * respetando el orden de pintado del TERRENO. El terreno dibuja V0 (mundo saliente) y
 * ENCIMA V1 (mundo nuevo) desplazado +(1−t)·paso; V1 cubre todo el viewport salvo la
 * franja saliente, que muestra V0. La niebla debe respetar ese z-order para la
 * componente de OCLUSIÓN, y a la vez suavizar con el campo contrario para lo GENUINO:
 *
 *   Regla por celda de pantalla S, con dueño = V1 si V1 cubre S, si no V0:
 *     revelada(S) = ownerLit_dueño(S)  OR  genuine_contrario(S)
 *   · `ownerLit` = máscara de OCLUSIÓN del dueño (occlusionLit: visible ∨ fuera-de-disco).
 *     El dueño manda sobre su propio terreno; su parte «fuera de disco» la ennegrece la
 *     capa ANCLADA aparte, no aquí.
 *   · `genuine` = celdas REALMENTE visibles (visMask==1) del campo contrario, a su offset.
 *     Sólo terreno que la party VIO de verdad → suaviza (p.ej. LOS que colapsa tras un
 *     muro no parpadea a negro). NUNCA incluye el marcador «fuera de disco» del contrario.
 *
 * El bug que corrige: antes cada campo aportaba al CONTRARIO lo que vio DE VERDAD
 * (`genuine* = visMask`) como «suavizado» del LOS que colapsa. Pero en la zona cubierta
 * por V1 el TERRENO que se ve es el de V1 (dibujado encima, opaco): revelar ahí una celda
 * porque el campo VIEJO la vio destapa el terreno de V1 en esa posición — y si esa celda
 * está OCULTA en el frame nuevo (tras un muro), eso es una habitación oculta parpadeando
 * (testigo occlusion-flash: castillo LB, la puerta enrejada + ladrillo de detrás del muro
 * se encendían al deslizar). El suavizado y la oclusión no se pueden distinguir por celda
 * (ambos son «visMask_V0=1, visMask_V1=0»), así que el mandato «cero frames con contenido
 * ocluido» obliga a quedarse SÓLO con el dueño: cada campo manda sobre SU propio terreno.
 *
 * Regla por celda de pantalla S: dueño = V1 si V1 la cubre, si no V0. Revelada(S) =
 * ownerLit_dueño(S) (occlusionLit del dueño). El aporte del contrario se elimina: nunca
 * puede revelar terreno que el dueño oculta. Coincide con el LOS por-paso del original
 * (que salta instantáneo) y reduce EXACTO en el settle (t=1, V1 cubre todo → occlusionLit_V1).
 *
 * Geometría idéntica a `paintFogSlide` (unidad = 1 celda), muestreando el CENTRO
 * (col+0.5,row+0.5). `ownerVk`=occlusionLit del campo k.
 */
export function fogSlideRevealsCell(args: {
  ownerV0: Uint8Array;
  ownerV1: Uint8Array;
  window: number;
  dx: number;
  dy: number;
  t: number;
  col: number;
  row: number;
}): boolean {
  const { ownerV0, ownerV1, window, dx, dy, t, col, row } = args;
  const cx = col + 0.5;
  const cy = row + 0.5;
  const v1ox = (1 - t) * dx;
  const v1oy = (1 - t) * dy;
  const v0ox = -t * dx;
  const v0oy = -t * dy;
  const litAt = (mask: Uint8Array, ox: number, oy: number): boolean => {
    const mc = Math.floor(cx - ox);
    const mr = Math.floor(cy - oy);
    if (mc < 0 || mc >= window || mr < 0 || mr >= window) return false;
    return mask[mr * window + mc] === 1;
  };
  // ¿V1 (mundo nuevo, encima) cubre el centro? Su lienzo ocupa `[offset, offset+ancho)`.
  const v1Covers = cx >= v1ox && cx < v1ox + window && cy >= v1oy && cy < v1oy + window;
  // El dueño de la celda manda sobre su propio terreno; el contrario NO aporta (revelaría
  // terreno que el dueño oculta = parpadeo de habitación).
  if (v1Covers) return litAt(ownerV1, v1ox, v1oy);
  // FRANJA SALIENTE (dueño V0, borde-entrante/saliente que V1 aún no cubre): antes revelaba
  // occlusionLit_V0 a secas → una celda VISIBLE en V0 pero ya OCLUIDA en V1 (un muro que acaba
  // de taparla al dar el paso) deslizaba mostrando su terreno viejo ~2 frames (testigo
  // rooms-flash-post-b15: sala del este tapiada asomando en la franja al caminar). El LOS del
  // original es INSTANTÁNEO: la celda que pasa a ocluida nace VELADA al iniciar el tween. Se
  // gatea por la oclusión del frame NUEVO de la MISMA casilla de mundo (V1-índice = V0-índice −
  // paso): sólo se revela si V0 la veía Y V1 aún la ve; si V1 la OCLUYE → negra.
  // 🔴 CORREGIDO EL 07-08: el texto de esta rama decía «si V1 la ocluye O SALIÓ DE LA VENTANA →
  // negra», y esas dos cosas no son la misma. Ver el bloque de más abajo: «salió de la ventana»
  // = el campo nuevo NO OPINA, y es exactamente la fila/columna de esta franja. En t=1 V1 cubre
  // todo → esta rama no corre → byte-idéntico.
  const mc0 = Math.floor(cx - v0ox);
  const mr0 = Math.floor(cy - v0oy);
  if (mc0 < 0 || mc0 >= window || mr0 < 0 || mr0 >= window) return false;
  if (ownerV0[mr0 * window + mc0] !== 1) return false;
  const mc1 = mc0 - dx;
  const mr1 = mr0 - dy;
  // 🔴 SIN OPINIÓN ≠ OCLUIDA (borde de salida). Esta rama devolvía `false` (= velar) cuando la
  // misma casilla de mundo cae FUERA de la ventana 11×11 del frame nuevo. Pero el gate existe
  // para respetar una OCLUSIÓN del campo NUEVO, y aquí el campo nuevo no tiene ningún valor
  // para esa casilla: no dice «ocluida», no dice nada. Y las casillas sin contraparte son
  // EXACTAMENTE la fila/columna que ocupa la franja saliente (con paso cardinal de 1 tile,
  // `classifyStep`), así que velarlas apagaba ENTERO el borde que se va — de golpe, en el
  // primer fotograma del tween, mientras el terreno seguía deslizando debajo. Manda su PROPIO
  // campo: si V0 la veía, sigue viéndose mientras sale. No puede revelar nada nuevo (es lo que
  // ya estaba en pantalla el fotograma anterior) y en t=1 la rama no corre → asentamiento
  // byte-idéntico. La oclusión REAL del frame nuevo (contraparte DENTRO de la ventana) se
  // sigue respetando en la línea de abajo: ese es el caso de rooms-flash-post-b15.
  if (mc1 < 0 || mc1 >= window || mr1 < 0 || mr1 >= window) return true;
  return ownerV1[mr1 * window + mc1] === 1;
}

/**
 * FRANJA SALIENTE GATEADA (outgoing-edge, occlusion-edge): máscara V0 para el pase de niebla
 * deslizante RECORTADA por la oclusión del frame NUEVO. En la franja que V1 aún no cubre, la
 * niebla revelaba `occlusionLit_V0` a secas; una celda que V0 veía pero V1 ya OCLUYE deslizaba
 * mostrando su terreno viejo (fuga del borde). El LOS del original es instantáneo, así que la
 * celda que pasa a ocluida debe nacer VELADA: se conserva `maskV0[c,r]` sólo si la MISMA casilla
 * de mundo (V1-índice = (c−dx, r−dy)) sigue iluminada en `maskV1`.
 * `maskV0/maskV1` = occlusionLit de cada campo (idénticos a los de `paintFogSlide`).
 *
 * 🔴 EL BORDE DE SALIDA (07-08, reporte del usuario: «detrás, las tiles que se van ocultando no
 * lo hacen suave»). Este gate metía en el MISMO saco dos cosas distintas: «V1 la ocluye» y «V1
 * no tiene contraparte para ella» (la casilla salió de la ventana 11×11). La segunda no es una
 * oclusión: es AUSENCIA DE OPINIÓN. Y no es un caso raro — las casillas sin contraparte son
 * EXACTAMENTE la fila/columna que ocupa la franja saliente, así que velarlas apagaba de golpe
 * el borde entero que se va, en el primer fotograma del tween, con el terreno aún deslizando
 * debajo. Medido en el navegador (Paws loc22 (15,6) noche, paso al SUR): la fila trasera pasaba
 * de iluminada a 100 % negra en el PRIMER fotograma (incremento de negrura 0,661 en la peor
 * celda) y se quedaba así; con el arreglo rampa 0,13 → 0,27 → 0,42 → 0,54 → 0,59 → 0,65 → 0,66
 * a lo largo de los 8 fotogramas del tween, con el MISMO valor final. 8 posiciones testigo en
 * ese solo pueblo (barrido x∈[13,17] y∈[4,9]). Ahora esa rama conserva el campo de V0.
 * ★★ La forma del error, para el siguiente: **un predicado de tres valores (sí / no / no sé)
 * implementado con dos ramas manda el «no sé» al lado que le toque por descuido** — y aquí el
 * «no sé» no era un caso de esquina: era la única celda que la rama llega a pintar.
 * Espejo EXACTO de la rama dueño-V0 de `fogSlideRevealsCell`. En el pase, esta máscara sólo
 * afecta a la franja saliente (la zona cubierta por V1 se re-ennegrece y re-revela con maskV1).
 */
export function outgoingGatedMaskV0(
  maskV0: Uint8Array,
  maskV1: Uint8Array,
  dx: number,
  dy: number,
  window: number,
  out?: Uint8Array,
): Uint8Array {
  const o = out && out.length === maskV0.length ? out : new Uint8Array(maskV0.length);
  o.fill(0); // esta máscara sólo ESCRIBE las celdas conservadas → limpiar el reuso
  for (let r = 0; r < window; r++) {
    for (let c = 0; c < window; c++) {
      const i = r * window + c;
      if (maskV0[i] !== 1) continue;
      const c1 = c - dx;
      const r1 = r - dy;
      // 🔴 Sin contraparte en la ventana nueva = el campo NUEVO no opina, NO «está ocluida».
      // Antes esto caía a 0 (velar) y apagaba entera la fila/columna de la franja saliente.
      // Espejo EXACTO de la misma rama en `fogSlideRevealsCell` — si divergen, el modelo y el
      // pintado dejan de coincidir y `shader-fog-cortina.test.ts` lo caza.
      if (c1 < 0 || c1 >= window || r1 < 0 || r1 >= window) {
        o[i] = 1; // manda su propio campo (maskV0[i] ya es 1 en esta rama)
        continue;
      }
      o[i] = maskV1[r1 * window + c1] === 1 ? 1 : 0;
    }
  }
  return o;
}

/**
 * COMPOSITE AUTORITATIVO de la niebla del tween (occlusion-edge): decide si la celda de
 * PANTALLA `(col,row)` acaba mostrando terreno o negra, componiendo las DOS capas tal como
 * lo hace `skin.ts`, y cierra la FUGA DEL BORDE ENTRANTE que dejaba `fogSlideRevealsCell`
 * por sí sola.
 *
 * La descomposición niebla (night-fog 5334e884) parte la oscuridad en dos:
 *   · capa ANCLADA (`paintFog(anchoredLitMask)`): ennegrece ¬visMask ∩ ¬visRadius (la caída
 *     del RADIO) fija a pantalla → el disco no hace bulge al deslizar.
 *   · capa DESLIZANTE (`paintFogSlide`): la oclusión de muros DENTRO del disco, que viaja
 *     con el terreno.
 * El bug: una celda OCLUIDA que además cae FUERA del disco (visMask=0 ∩ visRadius=0) — p.ej.
 * una sala tapiada más allá del radio de la party, iluminada de refilón por emisores — tiene
 * `occlusionLit = visMask OR ¬visRadius = 1`, así que la capa DESLIZANTE la REVELA (punza un
 * agujero) en su posición DESLIZADA, delegando su negrura a la capa anclada… que la ennegrece
 * en la posición de PANTALLA. Durante el tween ambas difieren en `(1−t)·paso`, y en esa franja
 * el terreno ocluido asoma ~2 frames y se apaga al asentar (testigo rooms-flash-post-b15).
 *
 * El cierre: la capa DESLIZANTE sólo gobierna DENTRO del disco (`visRadius==1`, anclado a
 * pantalla); fuera del disco manda SÓLO la capa anclada. Así:
 *   · dentro del disco → resultado de `fogSlideRevealsCell` (oclusión de muros que desliza).
 *   · fuera del disco → revelada ⟺ `visMask1[S]==1` (visibilidad NUEVA en esa celda de
 *     pantalla, anclada): el emisor lejano se ve, la sala tapiada queda NEGRA — sin franja
 *     deslizada que la destape.
 * En el settle (t=1) V1 cubre todo y coincide con la vía anclada de hoy → byte-idéntico.
 *
 * `ownerV0/ownerV1` = occlusionLit de cada campo (como en `fogSlideRevealsCell`).
 * `visMask1`/`visRadius1` = visMask/visRadius del frame NUEVO (V1), anclados a pantalla.
 */
export function fogCompositeRevealsCell(args: {
  ownerV0: Uint8Array;
  ownerV1: Uint8Array;
  visMask1: Uint8Array;
  visRadius1: Uint8Array;
  window: number;
  dx: number;
  dy: number;
  t: number;
  col: number;
  row: number;
}): boolean {
  const { visMask1, visRadius1, window, col, row } = args;
  const idx = row * window + col;
  // Fuera del disco de radio (anclado a pantalla): sólo la capa anclada manda. Revelada ⟺
  // la celda de PANTALLA es visible en el frame nuevo (visMask1); nunca desliza terreno.
  if (visRadius1[idx] !== 1) return visMask1[idx] === 1;
  // Dentro del disco: la oclusión de muros desliza con el terreno (dueño autoritativo).
  return fogSlideRevealsCell(args);
}

/**
 * HALO DE EMISOR de un campo: luz GENUINA (visMask==1) que cae FUERA del disco de radio
 * de la party (visRadius==0) — sólo puede venir de un EMISOR del mundo (moongate,
 * antorchas de pared 0xb0/0xb1, braseros/hogueras/lámparas — EMITTER_TILES, halo radio
 * 10 fundido en visMask por computeVisibleWindow). Es la componente de luz que es
 * GEOMETRÍA DE MUNDO y debe DESLIZAR con el terreno. La luz DENTRO del disco (party/
 * antorcha del Avatar) queda excluida a propósito: su anclaje a pantalla es el correcto
 * (el Avatar no se mueve de pantalla; el mundo sí) — incluirla haría DERIVAR el halo de
 * la party con el terreno (regresión medida en el control del carril moongate-luz:
 * discDrift = 1 tile con visMask entero; 0 con emitterGlow).
 */
export function emitterGlowMask(visMask: Uint8Array, visRadius: Uint8Array): Uint8Array {
  const out = new Uint8Array(visMask.length);
  for (let i = 0; i < out.length; i++) out[i] = visMask[i] === 1 && visRadius[i] === 0 ? 1 : 0;
  return out;
}

/**
 * 🔴 SÓLO SE PUEDE DESLIZAR UNA LUZ QUE YA EXISTÍA (filo DELANTERO, reporte 08-08).
 *
 * `emitterGlowMask(visMask1, vr1)` se punza a la posición DESLIZADA de su campo, que en t=0 es
 * UN TILE POR DELANTE de donde acabará. Para un emisor que ya se veía antes del paso eso es lo
 * correcto y es el arreglo de moongate-luz (su mancha viaja con el emisor en vez de saltar). Pero
 * para una casilla que el paso acaba de REVELAR no hay posición anterior desde la que deslizar:
 * punzarla adelantada ENCIENDE luz en una celda de pantalla que un fotograma antes estaba negra,
 * y deja entre ella y el resto del recuadro una BANDA NEGRA del ancho que le falta por recorrer.
 * Es la «franja de tiles separada del resto por una banda negra vertical, descolgada, que encaja
 * de golpe al rematar el paso» del vídeo del usuario. Medido sobre el modelo puro en la escena
 * del vídeo (disco radio 1, columna emisora recién revelada al Este, paso al Este): 3 celdas de
 * pantalla NEGRAS sobre terreno ya iluminado + 3 celdas DESCOLGADAS un tile más allá, en t=0 y
 * t=0,25; cero desde t=0,5. En píxeles del vídeo del usuario: banda negra `[558, 654−96·t)`.
 *
 * Esta máscara deja pasar sólo el halo que el campo VIEJO también daba por visible (misma casilla
 * de mundo: índice viejo = índice nuevo + paso). La luz NUEVA no desaparece: la punza la capa
 * anclada en su posición de PANTALLA definitiva (ver `anchoredFogSlideShowsBlack`), que es donde
 * se va a quedar. En el asentamiento la unión de las dos es `glow1` entero ⇒ reposo intacto.
 */
export function carriedGlowMask(
  glow1: Uint8Array,
  visMask0: Uint8Array,
  dx: number,
  dy: number,
  window: number,
): Uint8Array {
  const out = new Uint8Array(glow1.length);
  for (let row = 0; row < window; row++) {
    for (let col = 0; col < window; col++) {
      const i = row * window + col;
      if (glow1[i] !== 1) continue;
      const pc = col + dx;
      const pr = row + dy;
      if (pc < 0 || pc >= window || pr < 0 || pr >= window) continue; // sin contraparte: luz nueva
      out[i] = visMask0[pr * window + pc] === 1 ? 1 : 0;
    }
  }
  return out;
}

/**
 * 🔴 LA LUZ QUE YA ESTABA NO PUEDE APAGARSE EN t=0 (reporte del usuario, vídeo del 22-08:
 * «la pared se ve NEGRA durante unos milisegundos» al andar). Gemela EXACTA de
 * `carriedGlowMask`, por el otro filo: aquélla decide qué halo del campo NUEVO puede
 * DESLIZARSE; ésta, qué halo del campo VIEJO sigue punzado mientras V0 lo cubre.
 *
 * EL DEFECTO, medido. En t=0 el cross-slide no ha movido NADA (V0 va a offset 0), así que el
 * primer fotograma del tween DEBE ser el mismo que el último en reposo. No lo era: la capa
 * anclada partía la luz en `¬visRadius1` (base negra, pegada a pantalla) + agujeros de
 * `emitterGlowMask`, y `emitterGlowMask = visMask ∩ ¬visRadius` EXCLUYE POR CONSTRUCCIÓN lo
 * que cae dentro del disco. El disco está anclado a PANTALLA y la casilla se mueve un tile en
 * índice de ventana con el paso ⇒ toda casilla del ANILLO del disco en la dirección de la
 * marcha estaba FUERA del disco antes (su luz venía del halo de emisor: `glow0=1`) y queda
 * DENTRO después (`visRadius[índice nuevo]=1` ⇒ `glow1=0` ⇒ `carriedGlowMask=0`): ningún
 * agujero la punzaba y NACÍA NEGRA, sin que nada se hubiese movido. Luego «se rellenaba» sola
 * conforme V1 deslizaba encima — pérdida ABRUPTA, recuperación GRADUAL, que es exactamente la
 * asimetría del vídeo del usuario.
 *
 * Medido sobre el mapa real (castillo loc 17, noche, barrido de las 4 direcciones en toda
 * casilla transitable): 463 celdas de pantalla nacían negras estando iluminadas en reposo, 411
 * de ellas de esta clase (el resto son cambios REALES de LOS, que deben nacer veladas —
 * doctrina de LOS instantáneo, ver `fogSlideRevealsCell`); con la antorcha del Avatar
 * encendida (`light=10`, disco mayor ⇒ anillo mayor) son 755. En el vídeo del usuario:
 * fotograma 97, desplazamiento MEDIDO de la antorcha = 0,0 px, y los dos tiles de muro bajo las
 * antorchas del sur caen de 0,54 a 0,05 de relleno, recuperando 0,21 → 0,31 → 0,38 → 0,48 →
 * 0,54 conforme el deslizamiento avanza.
 *
 * EL GATE ES `visMask1`, NO `glowV1` — y ahí está la corrección. Conservar el halo viejo sólo
 * donde el halo NUEVO también lo da (`emitterGlowMask(visMask1, vr)`, que es lo que hace
 * `outgoingGatedMaskV0` para la franja saliente) NO arregla nada: la casilla de este defecto
 * sigue VISIBLE tras el paso pero su luz ya no es «de emisor» sino «del disco», y el halo nuevo
 * la da 0. El predicado que toca es la VISIBILIDAD del campo nuevo para la MISMA casilla de
 * mundo (índice nuevo = índice viejo − paso), sin importar de qué fuente le venga la luz.
 *
 * ★★ Por qué NO mueve el asentamiento (la propiedad que hay que conservar). En t=1 la capa V0
 * va a offset −paso, así que el agujero que esta máscara punza en la celda de PANTALLA `S` sale
 * de `glow0[S+paso]` y su gate exige `visMask1[S+paso−paso] = visMask1[S] == 1`. Y si
 * `visMask1[S]==1`, la vía de referencia del asentamiento —`anchoredLitMask(visMask1, vr1)`—
 * YA da esa celda por iluminada. Es decir: este punzado sólo puede coincidir con lo que el
 * reposo ya ilumina, nunca añadir. El settle sigue siendo byte-idéntico.
 *
 * Sin contraparte en la ventana nueva (la casilla salió del encuadre) manda su PROPIO campo,
 * como en `outgoingGatedMaskV0` y en la rama dueño-V0 de `fogSlideRevealsCell`: «el campo nuevo
 * no opina» ≠ «está ocluida» (ficha del 07-08).
 */
/**
 * ¿La máscara `mask`, PINTADA a offset `(ox,oy)` en tiles, cubre el centro de la celda de
 * PANTALLA `(col,row)`? Es el mismo `litAt` que usa `fogSlideRevealsCell` internamente,
 * extraído para que el punzado deslizado de `survivingGlowMask` se lea EXACTAMENTE igual que
 * lo pinta `paintAnchoredFogSlide` (que rellena `c.col*cell+ox`): si los dos criterios de
 * redondeo divergen, el modelo puro y el pintado dejan de coincidir en el filo del tile.
 */
export function slidMaskCoversCell(
  mask: Uint8Array,
  ox: number,
  oy: number,
  window: number,
  col: number,
  row: number,
): boolean {
  const mc = Math.floor(col + 0.5 - ox);
  const mr = Math.floor(row + 0.5 - oy);
  if (mc < 0 || mc >= window || mr < 0 || mr >= window) return false;
  return mask[mr * window + mc] === 1;
}

export function survivingGlowMask(
  glow0: Uint8Array,
  visMask1: Uint8Array,
  dx: number,
  dy: number,
  window: number,
  out?: Uint8Array,
): Uint8Array {
  const o = out && out.length === glow0.length ? out : new Uint8Array(glow0.length);
  o.fill(0);
  for (let row = 0; row < window; row++) {
    for (let col = 0; col < window; col++) {
      const i = row * window + col;
      if (glow0[i] !== 1) continue;
      const c1 = col - dx;
      const r1 = row - dy;
      // Sin contraparte: el campo nuevo NO OPINA → manda el viejo (que aquí ya vale 1).
      if (c1 < 0 || c1 >= window || r1 < 0 || r1 >= window) {
        o[i] = 1;
        continue;
      }
      o[i] = visMask1[r1 * window + c1] === 1 ? 1 : 0;
    }
  }
  return o;
}

/**
 * LUZ NUEVA DEL PASO, anclada (filo delantero, 08-08): celdas de PANTALLA que el campo NUEVO
 * ilumina y cuya luz NO viene deslizándose de ninguna parte — la misma casilla de mundo no
 * estaba iluminada en el campo viejo (índice viejo = índice nuevo + paso), o directamente no
 * existía en la ventana anterior. Se punzan a offset CERO, su posición definitiva: aparecer
 * donde se van a quedar es lo único que no deja ni banda negra ni franja descolgada.
 * Complemento exacto de `carriedGlowMask` dentro de `visMask1`: juntas cubren todo lo que el
 * campo nuevo ilumina, así que el asentamiento no se mueve.
 */
export function freshLitMask(
  visMask0: Uint8Array,
  visMask1: Uint8Array,
  dx: number,
  dy: number,
  window: number,
  out?: Uint8Array,
): Uint8Array {
  const o = out && out.length === visMask1.length ? out : new Uint8Array(visMask1.length);
  for (let row = 0; row < window; row++) {
    for (let col = 0; col < window; col++) {
      const i = row * window + col;
      if (visMask1[i] !== 1) {
        o[i] = 0;
        continue;
      }
      const pc = col + dx;
      const pr = row + dy;
      const before =
        pc >= 0 && pc < window && pr >= 0 && pr < window && visMask0[pr * window + pc] === 1;
      o[i] = before ? 0 : 1;
    }
  }
  return o;
}

/**
 * LUZ PERSISTENTE del paso (cortina-negra, ficha #34): celdas de PANTALLA iluminadas en el frame
 * VIEJO **y** en el NUEVO (`visMask0 ∩ visMask1`, ambos anclados a pantalla). Es el suelo de la
 * capa anclada durante el tween: lo que se ve iluminado justo antes del paso y justo después no
 * puede ponerse NEGRO en medio — ese negro no es oscuridad del mundo, es artefacto del tween.
 *
 * POR QUÉ HACE FALTA. El punzado deslizado de `emitterGlowMask` deja DOS huecos, ambos porque
 * carva un disco ANCLADO A PANTALLA (`¬visRadius`) dentro de una máscara que después se DESLIZA:
 *   · FRANJA SALIENTE: en la franja que V1 aún no cubre manda V0, y su gate exigía que la misma
 *     casilla de mundo siguiera iluminada en V1 (V1-índice = V0-índice − paso). En el filo esa
 *     casilla cae FUERA de la ventana 11×11 → el gate la velaba → la COLUMNA/FILA ENTERA (11
 *     celdas) del borde que SALE nacía negra.
 *     🔴 ESTE HUECO YA NO EXISTE (07-08): se cerró EN SU ORIGEN, en `outgoingGatedMaskV0` —
 *     «sin contraparte» ya no significa «ocluida». Este suelo sólo lo tapaba cuando la celda
 *     seguía iluminada DESPUÉS del paso, y el borde de salida se apagaba igual cuando no
 *     (reporte del usuario del 07-08). El suelo se conserva por el SEGUNDO hueco.
 *   · COSTURA GLOW/DISCO: el agujero que `emitterGlowMask` carva en el disco viaja con su campo
 *     (V1 se dibuja a +(1−t)·paso), así que tapa celdas de pantalla que el disco ANCLADO ya no
 *     cubre → un arco negro pegado al filo del disco (3 celdas con el disco de radio 2 de noche,
 *     9 celdas; el arco escala con el disco).
 * Medido sobre el modelo puro, sala 11×11 entera iluminada, disco radio 2, paso al Este:
 * 14 celdas negras en t=0 y t=0.25 (11 de la columna + 3 del arco), 0 al asentar.
 *
 * POR QUÉ NO REVELA DE MÁS. La regla sólo puede iluminar celdas con `visMask0=1 ∧ visMask1=1`:
 *   · en t=0 la pantalla muestra V0 exacto y `visMask0=1` ya la daba iluminada → no añade nada
 *     que no se viera al empezar el paso;
 *   · en t=1 manda V1: con `visRadius1=0` y `visMask1=1` el punzado de V1 (offset 0) ya la
 *     ilumina → la regla es un NO-OP en el asentamiento y NO mueve la identidad byte a byte con
 *     `paintFog(anchoredLitMask(visMask1, vr1))`.
 * ALCANCE, con su cota MEDIDA (no «sub-tile»): la regla sólo puede tocar celdas de
 * `visMask0 ∩ visMask1`; las que CAMBIAN de estado con el paso (`visMask0 Δ visMask1`) quedan
 * donde estaban, gobernadas por el punzado deslizado y su gate. Eso NO es residuo de este
 * arreglo sino la DOCTRINA de LOS INSTANTÁNEO que ya regía (`fogSlideRevealsCell`: la celda que
 * pasa a ocluida nace VELADA al iniciar el tween — testigo rooms-flash-post-b15), y es grande:
 * medido en una sala 11×11 que se apaga al dar el paso (Δ = 66 celdas), el frame t=0 ennegrece
 * 52 de las 60 que sólo serán legítimamente negras en t=1. Quien quiera revisar ESA decisión
 * tiene que ir al gate de la franja, no aquí. En la escena testigo de #34 (sala estable) Δ = 0.
 */
export function persistentLitMask(
  visMask0: Uint8Array,
  visMask1: Uint8Array,
  out?: Uint8Array,
): Uint8Array {
  const o = out && out.length === visMask0.length ? out : new Uint8Array(visMask0.length);
  for (let i = 0; i < o.length; i++) o[i] = visMask0[i] === 1 && visMask1[i] === 1 ? 1 : 0;
  return o;
}

/**
 * CAPA ANCLADA con HALOS DE EMISOR DESLIZANTES (moongate-luz, vía PREMUL): modelo puro de
 * `paintAnchoredFogSlide` (skin.ts). Decide si la capa ANCLADA del tween pinta NEGRO en la
 * celda de pantalla `(col,row)`.
 *
 * El defecto que corrige (testigo del usuario, moongate de noche): en la vía premul la capa
 * anclada del tween era `paintFog(anchoredLitMask(visMask1, vr1))` — negro en ¬visMask1 ∩
 * ¬visRadius1, TODO anclado a pantalla. La luz de un EMISOR del mundo (moongate, antorchas de
 * pared 0xb0/0xb1, braseros/hogueras/lámparas — EMITTER_TILES, halo radio 10 fundido en
 * visMask por computeVisibleWindow) fuera del disco de la party es un AGUJERO en esa negrura…
 * anclado: al armarse el tween el agujero salta YA a su posición de pantalla nueva mientras el
 * emisor (terreno) desliza → la mancha de luz va «a saltos» de tile. El halo de la party
 * (antorcha del Avatar) no lo sufre: es `visRadius`, disco center-anchored, y su anclaje a
 * pantalla es el CORRECTO (el Avatar no se mueve de pantalla; el mundo sí).
 *
 * La luz de un emisor es GEOMETRÍA DE MUNDO → debe deslizar CON el mundo. Descomposición:
 *   · base ANCLADA = ¬visRadius1 (la caída del radio pura, pegada al Avatar central; la
 *     luz DENTRO del disco — party/antorcha — no se toca: queda anclada, que es lo fiel);
 *   · AGUJEROS = halo de emisor de cada campo (`emitterGlowMask` = visMask ∩ ¬visRadius)
 *     punzados a la posición DESLIZADA de su campo, con el MISMO z-order dueño-V1/
 *     franja-V0-gateada del terreno (`fogSlideRevealsCell` con ownerVk=emitterGlow_k):
 *     nunca revela terreno que el dueño de la celda oculta (gate de la franja saliente
 *     incluido — LOS instantáneo).
 *
 * negro(S) ⟺ visRadius1[S]==0  ∧  ¬fogSlideRevealsCell(emitterGlow0, emitterGlow1, …)
 *            ∧  ¬(visMask0[S]==1 ∧ visMask1[S]==1)   ← suelo de LUZ PERSISTENTE (ficha #34)
 *
 * En el settle (t=1, V1 cubre todo, offset 0): negro ⟺ ¬vr1 ∩ ¬(visMask1 ∩ ¬vr1) =
 * ¬vr1 ∩ ¬visMask1 = exactamente `¬anchoredLitMask(visMask1, vr1)` → byte-idéntico a la
 * vía anclada de hoy. La OCLUSIÓN dentro del disco no vive aquí: va HORNEADA en los
 * bitmaps (bakeFogVeilMask).
 *
 * 🔴 COTA CORREGIDA (ficha #34). Este docstring declaraba que el punzado de MENOS de la costura
 * glow/disco era «SUB-TILE y ≤ los 150 ms del tween». Esa cota era FALSA y desactivó la sospecha
 * durante dos testigos del usuario: MEDIDO sobre este mismo modelo (sala 11×11 entera iluminada,
 * disco radio 2 anclado, las 121 celdas con visMask=1), el punzado de menos eran 14 CELDAS DE
 * PANTALLA ENTERAS en t=0 y t=0.25 — la COLUMNA/FILA DEL BORDE QUE SALE, completa (11 celdas),
 * más un ARCO de 3 en el filo del disco (el arco escala con el radio) — y no eran «≤150 ms»
 * simétricos: al Oeste y al Norte el defecto llegaba a t=0.5 INCLUSIVE (el intervalo semiabierto
 * del gate de la franja rompe el empate a favor de Este/Sur). El suelo de LUZ PERSISTENTE
 * (`persistentLitMask`) lo cerró en esa escena: 0 celdas negras en las cuatro direcciones y en
 * todo t.
 *
 * 🔴 Y EL RESIDUO QUE QUEDABA ERA EL REPORTE SIGUIENTE (07-08). #34 declaró el residuo acotado a
 * `visMask0 Δ visMask1` — las celdas que CAMBIAN de estado con el paso — porque el suelo sólo
 * ilumina la intersección. Esa acotación era correcta y no era inocua: la fila/columna del borde
 * de salida cae justo ahí en cuanto su luz no sobrevive al paso, y volvía a apagarse entera.
 * Se cerró en el ORIGEN (`outgoingGatedMaskV0`: «sin contraparte» ≠ «ocluida»), no ensanchando
 * este suelo. ★★ La lección: **un arreglo que tapa un defecto en la intersección de dos campos
 * deja vivo el mismo defecto en la diferencia** — y la diferencia es donde vive el borde.
 */
export function anchoredFogSlideShowsBlack(args: {
  visMask0: Uint8Array;
  visRadius0: Uint8Array;
  visMask1: Uint8Array;
  visRadius1: Uint8Array;
  window: number;
  dx: number;
  dy: number;
  t: number;
  col: number;
  row: number;
}): boolean {
  const { visMask0, visRadius0, visMask1, visRadius1, window, dx, dy, t, col, row } = args;
  const idx = row * window + col;
  if (visRadius1[idx] === 1) return false; // dentro del disco: sin base anclada
  // 🔴 LUZ NUEVA, ANCLADA (filo delantero, 08-08): lo que el paso acaba de revelar se punza en su
  // posición DEFINITIVA, no deslizada — no tiene posición anterior desde la que deslizar, y
  // punzarlo un tile por delante era la franja descolgada tras banda negra del vídeo del usuario.
  // Ver `freshLitMask` / `carriedGlowMask`.
  if (freshLitMask(visMask0, visMask1, dx, dy, window)[idx] === 1) return false;
  // 🔴 LUZ SALIENTE QUE SOBREVIVE AL PASO (22-08): el halo que el campo VIEJO daba a esta celda
  // sigue punzado a la posición DESLIZADA de V0 mientras la MISMA casilla de mundo siga visible
  // en el campo nuevo. Sin esto el ANILLO del disco en la dirección de la marcha nace NEGRO en
  // t=0 —cuando el cross-slide aún no ha movido nada— porque `emitterGlowMask` excluye por
  // construcción lo que cae dentro del disco anclado a pantalla. Ver `survivingGlowMask`.
  if (
    slidMaskCoversCell(
      survivingGlowMask(emitterGlowMask(visMask0, visRadius0), visMask1, dx, dy, window),
      -t * dx,
      -t * dy,
      window,
      col,
      row,
    )
  )
    return false;
  const lit = fogSlideRevealsCell({
    ownerV0: emitterGlowMask(visMask0, visRadius0),
    // Sólo DESLIZA el halo que el campo viejo también veía (`carriedGlowMask`).
    ownerV1: carriedGlowMask(emitterGlowMask(visMask1, visRadius1), visMask0, dx, dy, window),
    window,
    dx,
    dy,
    t,
    col,
    row,
  });
  if (lit) return false;
  // PERSISTENCIA (ficha #34): una celda de PANTALLA iluminada ANTES y DESPUÉS del paso no puede
  // ennegrecerse EN MEDIO — ese negro es artefacto del tween, no oscuridad del mundo. Ver
  // `persistentLitMask` para el porqué (los dos huecos que deja el punzado deslizado) y para la
  // prueba de que la regla no revela de más ni mueve el asentamiento.
  return !(visMask0[idx] === 1 && visMask1[idx] === 1);
}
