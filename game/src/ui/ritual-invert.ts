/**
 * RitualInvert — conductor de la INVERSIÓN SOSTENIDA del viewport del «WELL DONE» del
 * Altar (#295, CAST2.OVL 0x0c18-0x0d1a). Hermano de `ui/bed-sleep.ts`, y por la MISMA
 * razón estructural: el efecto es un ESTADO que dura, y el core resuelve el rito entero en
 * un `applyEvents` atómico — un estado que se monta y se desmonta dentro del mismo frame no
 * lo ve nadie, y su test habría pasado en verde midiendo un efecto invisible (la lección
 * que #296 dejó escrita en `bed-sleep.ts`).
 *
 * LO QUE HACE EL BINARIO, en orden (cuerpo leído, CAST2 0x0c18-0x0d1a):
 * ```
 *   0c29  print(0xb6d7)                    ; "WELL DONE!"
 *   0c30  push [g_unk_13b0]  / 0c34 call 0x2890   ; ★ set_color(15)
 *   0c37  push 8,8,0xb7,0xb7 / 0c41 call 0x29a6   ; ★ rect con `stc` = XOR ⇒ INVIERTE
 *   0c44  si=0x7d0 … 0c61 jl                      ; barrido ASCENDENTE  (460 tonos)
 *   0c66  si=0x61a8 … 0c83 jg                     ; barrido DESCENDENTE (460 tonos)
 *   0c88  call 0x4e92                             ; kernel 0x3072 — la SACUDIDA (#330(A))
 *   0c8b… karma +3, atributos +1, sus prints (0cba/0cdb/0cfc, condicionales)
 *   0d1a  push 0xa / call 0x5906                  ; ★ kernel_flash(10) ⇒ RESTAURA
 * ```
 * ⇒ el rect XOR de 0x0c41 está **SUELTO**: nadie lo des-invierte. Lo que devuelve el
 * viewport a la normalidad es el redibujo del flash final. Ése es el régimen que el usuario
 * describe como «negativo SOSTENIDO», y es distinto del rect PAREADO del pergamino de
 * tiempo (0x0031/0x007a), que sí se des-invierte solo y por eso vive como ventana de reloj
 * dentro de la piel fiel (`TimeSpellFlash`) y no aquí.
 *
 * CADENCIA — CERO ms de vídeo. La ventana es «lo que hay entre el XOR y el flash», y entre
 * medias corren los DOS barridos de altavoz MÁS la sacudida de 0x0c88 y los prints de
 * atributo (#355 — este bloque decía «sólo los barridos» y era la ventana CORTA del acta
 * #345 §6: el trueno sonaba con la pantalla ya restaurada). Se pide su duración a
 * `wellDoneInvertWindowMs()`, que la deriva de las cotas del bucle (0x7d0→0x61a8 paso 0x32),
 * de los cinco argumentos del tono y del cue `quake` del catálogo — la derivación sumando a
 * sumando vive en su docblock. Si algún día se recalibra el modelo del altavoz, esta
 * ventana se mueve sola.
 *
 * ⚠ Lo que NO se modela, declarado: el CONSUMO de RNG de 0x4e92 (1.856 tiradas en 1988,
 * cero aquí — divergencia declarada en shrine-ceremonies.ts, doctrina de #329). ~~Y la
 * QuakeShake VISUAL, que la piel dispara al llegar el evento (t=0 de la ventana) mientras
 * el binario sacude en t≈5,35 s~~ — CERRADO por fix-quakeshake: `planTurnPhase` empuja
 * fase con `CHAINED_CUES` (no solo `BLOCKING_CUES`), así que la sacudida visual del
 * WELL DONE arranca en t=5.347,5 ms y ocupa el tramo FINAL del negativo, como en el
 * binario (CAST2 0x0c88 corre tras el `jg 0xc69` de los barridos); el AUDIO ya iba
 * serializado (`CHAINED_CUES`, #345) y no se mueve.
 */
export interface RitualInvertDeps {
  /** Monta/desmonta la INVERSIÓN del viewport (`CoreView.setRitualInvert`). */
  view: { setRitualInvert(on: boolean): void };
  /** Delay efectivo de un beat de escena (knob `?scenebeat`; 0 bajo automatización). */
  sceneMs: (ms: number) => number;
}

export class RitualInvert {
  /**
   * 🔴 `setTimeout` GLOBAL, no `window.setTimeout` como sus hermanos de `ui/`: es lo que
   * permite que el conductor se pruebe con los temporizadores falsos de vitest (que parchean
   * `globalThis`, no `window`) sin montar un DOM. En el navegador es exactamente la misma
   * función. El tipo es el de la plataforma, así que se guarda como `ReturnType`.
   */
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * ★ #330(B) — continuación que corre AL RESTAURAR (el `kernel_flash(10)` de 0x0d1a).
   * Existe porque en el binario ese flash NO es el final de nada: es el penúltimo gesto de
   * `shrine_visit`, y justo detrás va el `ret` y la CAMINATA DE SALIDA del envoltorio
   * (0x1075-0x10bd, la escena de #277). O sea que la inversión y la salida están
   * SERIALIZADAS por construcción, y el port las tenía en PARALELO — dos temporizadores de
   * reloj de pared arrancados en el mismo `applyEvents`. Medido en este árbol: ventana de
   * inversión 5.347,5 ms (`wellDoneInvertWindowMs`) contra 41 fotogramas × 54,9 ms = 2.251 ms
   * de escena de salida ⇒ la inversión SOBREVIVÍA 3.097 ms a la salida, y el usuario veía el
   * negativo ya de vuelta en el sobremundo. Ése es el reporte del 15-08.
   */
  private onRestored: (() => void) | null = null;

  constructor(private readonly deps: RitualInvertDeps) {}

  /**
   * Registra la continuación de 0x0d1a (ver `onRestored`). La consume UNA vez: quien la
   * arma es el despachador del evento `shrine-scene`, y sólo cuando la inversión está
   * montada — bajo automatización nunca lo está (ventana 0) y la salida corre en el acto.
   */
  whenRestored(fn: () => void): void {
    this.onRestored = fn;
  }

  /** Restaura el viewport y dispara la continuación pendiente (0x0d1a → `ret` → salida). */
  private restore(): void {
    this.timer = null;
    this.deps.view.setRitualInvert(false); // 0x0d1a kernel_flash(10)
    const fn = this.onRestored;
    this.onRestored = null;
    if (fn) fn();
  }

  /** ¿El viewport está invertido AHORA? (lo consulta el teardown y los tests). */
  get inverted(): boolean {
    return this.timer !== null;
  }

  /**
   * Teardown completo (cargar partida a mitad del rito, patrón `BedSleep.reset`): corta el
   * temporizador y DESMONTA la inversión. Sin lo último, un `load` dentro de la ventana
   * dejaba el viewport en negativo para siempre.
   */
  reset(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // La continuación se DESCARTA, no se ejecuta: `reset` es el teardown de cargar partida
    // a mitad del rito, y ahí no hay santuario del que salir. Correrla montaría la escena
    // de salida encima de la partida recién cargada.
    this.onRestored = null;
    this.deps.view.setRitualInvert(false);
  }

  /**
   * Monta la inversión y programa su retirada `windowMs` después. Un segundo disparo
   * mientras corre REINICIA la ventana (no la encadena): en el binario cada WELL DONE es
   * una invocación entera de `shrine_visit`, no hay solape posible.
   *
   * 🔴 Con `sceneMs(windowMs) === 0` (automatización) el estado se monta y se desmonta en el
   * MISMO frame a propósito: es la misma degradación declarada que usan las demás escenas
   * para que e2e y digests no dependan del reloj de pared. Ahí el efecto es invisible —
   * quien lo mida bajo automatización no está midiendo el producto.
   */
  run(windowMs: number): void {
    const { view, sceneMs } = this.deps;
    if (this.timer !== null) clearTimeout(this.timer);
    view.setRitualInvert(true);
    const ms = sceneMs(windowMs);
    if (ms <= 0) {
      this.restore(); // 0x0d1a kernel_flash(10), síncrono
      return;
    }
    this.timer = setTimeout(() => this.restore(), ms);
  }
}
