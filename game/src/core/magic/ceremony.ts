/**
 * LA CEREMONIA DE CONJURO — `CAST2.OVL:0x0000`, y QUIÉN la dispara con QUÉ índice.
 *
 * `CAST2.OVL:0x0000` es el jingle-con-inversión-de-pantalla común a TODAS las magias del
 * juego: ráfaga de ruido de entrada, `rect` XOR del viewport (8,8)-(183,183), dos
 * `tone_sweep` espejo, y el MISMO rect XOR otra vez (involutivo) para des-invertir. Toda
 * la escala cuelga de su ÚNICO argumento, gateado a `< 9`
 * (`0x0005 cmp word ptr [bp+4], 9` / `0x0009 jge 0x80`).
 *
 * La VENTANA temporal ya la deriva `skin/fiel/speaker.ts:timeSpellFlashWindowMs(idx)` de
 * los mismos params del catálogo (delay = dur del noise_burst de entrada; dur = 2 sweeps
 * de `count = 0x2710 + 0xfa0·idx`). Este módulo NO toca el tiempo: sólo responde a
 * «¿qué índice recibe la rutina en cada vía?».
 *
 * ── CENSO COMPLETO DE LLAMADORES (derivado, no supuesto) ─────────────────────────────
 *
 * Resuelto con `re/tools/dispatch_table.py` — 🔴 un `call 0xffffc186` NO se lee en crudo:
 * es un near-call cuyo destino de 16 bits (`0xc186`) más la base de banda de CAST.OVL
 * (`0xbf80`) da el stub del kernel `0x8106`, cuyo `ljmp` entra en `CAST2.OVL:0x0000`.
 * CONTROL POSITIVO de la resolución: el stub vecino `0x80b2` sale `CAST2.OVL:0x08f8` (el
 * setter del hechizo-de-tiempo, que `invert-flash.ts` ya citaba por otra vía), y las 14
 * resoluciones de los thunks de CAST.OVL caen todas en rutinas que el port ya nombra por
 * su cuenta (`CAST2:0x00de` teclear hechizo, `0x009e` «On who:», `0x046c` revelado de la
 * poción blanca, `0x07bc` An Grav, `0x04c2` daemon en arena…).
 *
 * `near_calls_to_kernel(*, 0x8106)` sobre los 28 `.asm`: **40 sitios, en DOS overlays y
 * ningún otro** — CAST.OVL 34 y CAST2.OVL 6 (internos: 0x428, 0x4de, 0x6d4, 0x7d8,
 * 0x87c, y 0x90a, que es el reenvío del setter 0x08f8).
 *
 * ── LAS CUATRO VÍAS DEL JUGADOR ──────────────────────────────────────────────────────
 *
 *   (C)ast .......... índice = CÍRCULO del hechizo   (41 de los 48; ver abajo)
 *   Vas Rel Por ..... literal 8, y DESPUÉS de la tecla de fase
 *   (U)se poción .... índice = COLOR de la poción    (0..7)
 *   (U)se pergamino . literal por pergamino          (5 de los 8)
 */

/** Cota del único argumento: `0x0005 cmp word ptr [bp+4], 9` / `0x0009 jge 0x80`. */
export const CEREMONY_INDEX_MAX = 8;

/**
 * (C)ast — el índice es el CÍRCULO, y eso NO se supone de que los literales cuadren: el
 * propio `cast_spell` lo computa doce instrucciones antes del salto, en
 * `CAST.OVL:0x0e0a-0x0e14` (`mov ax,[bp-2]` = índice de hechizo / `cdq` / `mov cx,6` /
 * `idiv cx` / `inc ax` → `[bp-8]`), y usa ESE mismo valor para el gate de nivel
 * (`0x0f07 cmp ax,[bp-8]`) y para restar maná (`0x0ef8 sub [si+0x55b7], al`).
 *
 * Corroboración estática: barrida la jump table de 48 entradas
 * (`0x0f1a jmp word ptr cs:[bx-0x2f3a]`, tabla en el offset de fichero 0x1146, que termina
 * justo en 0x11a6 = el tail común), **41 de los 48 handlers alcanzan la ceremonia y los 41
 * empujan un literal que incluye su círculo; NINGUNO empuja un literal ajeno a él.** Los
 * cuatro In*Grav (14/15/16/20) la alcanzan por la rama compartida `0x004c`, que reconstruye
 * el círculo de su argumento (`0x005e cmp word ptr [bp+4], 3` → 4, si no → 3).
 */
export function castCeremonyIndex(spellIndex: number): number {
  return Math.floor(spellIndex / 6) + 1;
}

/**
 * Los SIETE hechizos del (C)ast que NO hacen la ceremonia — y no son una lista suelta: son
 * DOS familias enteras, cada una con su propio sonido en el binario.
 *
 *   · ARMA-HECHIZO (Grav Por 1, Vas Flam 13, Xen Corp 37): sus handlers (0x0f32, 0x0f90,
 *     0x10a4) entran todos en `CAST.OVL:0x0032`, once instrucciones que fijan
 *     `g_cmb_weapon` y saltan a `COMSUBS.OVL:0x0c52` (el ataque). Cero llamadas a la
 *     ceremonia — y el censo de arriba lo respalda por el otro lado: COMSUBS.OVL no está
 *     entre los dos overlays que la llaman.
 *   · ABANICO DE LÍNEA (In Zu 28, In Nox Hur 40, In Vas Grav Corp 44, In Flam Hur 45): sus
 *     handlers convergen en `0x104e` → `CAST.OVL:0x1f60`, cuyas 200 instrucciones no
 *     llaman a la ceremonia ni una vez. Es el cue `line-spray` que el port ya cataloga
 *     (`core/sfx.ts`), con SU noise_burst propio — y la lista de esa entrada nombra
 *     exactamente estos cuatro, derivada por un carril anterior sin conocer este censo.
 */
export const SPELLS_WITHOUT_CEREMONY: ReadonlySet<number> = new Set([1, 13, 37, 28, 40, 44, 45]);

/** Índice de la ceremonia al lanzar el hechizo `spellIndex`, o `null` si no la hace. */
export function castCeremonyIndexOrNull(spellIndex: number): number | null {
  if (SPELLS_WITHOUT_CEREMONY.has(spellIndex)) return null;
  return castCeremonyIndex(spellIndex);
}

/**
 * VAS REL POR (hechizo 46) — su handler 0x112e entra en `CAST.OVL:0x0cf0`, que **no**
 * hace la ceremonia al lanzar: imprime «To phase:», lee la tecla, y sólo tras el gate
 * `'1'..'8'` EXACTO (`0x0d1d cmp byte ptr [bp-2], 0x31` / `0x0d23 cmp …, 0x38`) empuja el
 * literal (`0x0d2d mov ax, 8` / `0x0d30 push ax` / `0x0d31 call`). Las tres salidas
 * tempranas caen en `0x0d46 sub ax,ax` y se la saltan.
 *
 * El literal 8 COINCIDE con `castCeremonyIndex(46)` (Vas Rel Por es de círculo 8), pero se
 * escribe como literal porque lo que el asm empuja aquí es un inmediato, no el `[bp-8]` del
 * despachador — y porque el SITIO es otro: quien dispare esto no debe disparar además la
 * ceremonia genérica del (C)ast, o sonaría dos veces.
 */
export const VAS_REL_POR_SPELL_INDEX = 46;
export const VAS_REL_POR_PHASE_CEREMONY_INDEX = 8;

/**
 * (U)se de POCIÓN — `CAST.OVL:0x135a`. El índice es el COLOR de la poción, y llega como el
 * argumento de la propia rutina: `0x139b push word ptr [bp+4]` / `0x139e call`. Los ocho
 * colores (0..7) caben de sobra bajo el gate `< 9`.
 *
 * 🔴 El disparo va DESPUÉS del target-select y sólo si NO se canceló: fuera de combate
 * `0x138e call` → `CAST2.OVL:0x009e` («On who:») deja el elegido en `ax`, y
 * `0x1394 or ax,ax` / `0x1396 jge 0x139b` se salta la ceremonia con `ax < 0`. (El consumo
 * de la poción, en cambio, ya ocurrió en `0x136a`: cancelar gasta la poción y no destella.)
 * En combate (`0x1375 cmp g_location, 0x7f` → rama alta) el objetivo es `g_cmb_actor` y no
 * hay cancelación posible.
 */
export function potionCeremonyIndex(color: number): number {
  return color;
}

/**
 * (U)se de PERGAMINO — jump table de 8 entradas en `0x1205 jmp word ptr cs:[bx-0x2d40]`
 * (tabla en el offset de fichero 0x1340). Handler a handler:
 *
 *   0 Vas Lor ......  0x120a  `0x1218 sub ax,ax` / `0x121b call`              → **0**
 *   1 Rel Hur ......  0x1222  sin ceremonia (getdir de viento)                → —
 *   2 In Sanct .....  0x124a  `0x1259 mov ax,2` → setter 0x125d (CAST2:0x08f8) → **2**
 *   3 In An ........  0x1264  `0x1273 mov ax,3` → `jmp 0x125c`                → **3**
 *   4 In Quas Wis ..  0x1278  `0x1290 mov ax,4` / `0x1294 call`               → **4**
 *   5 Kal Xen Corp .  0x12b4  sin ceremonia                                   → —
 *   6 In Mani Corp .  0x12d8  sin ceremonia                                   → —
 *   7 An Tym .......  0x1300  `0x1339 mov ax,7` → `jmp 0x125c`                → **7**
 *
 * 🔴 CORRIGE a `ceremonia-de-conjuro-cast2-0000.md` §2 y §7, que atribuían el sitio 0x1294
 * al «pergamino 5 = Kal Xen Corp». La tabla lo desmiente: 0x1294 vive dentro del handler
 * que empieza en 0x1278, que es la entrada **4**; y el cuerpo que sigue a la ceremonia allí
 * es el REVELADO DEL MAPA (`0x129e push g_party_x/g_party_y` → `LOOKOBJ.OVL:0x10fc`, o
 * `DNGLOOK.OVL:0x06a8` en mazmorra), que es In Quas Wis, no una invocación. Kal Xen Corp
 * (entrada 5, handler 0x12b4) fuera de combate imprime «Not here!» y en arena se va a
 * `CAST2.OVL:0x04c2` — por ninguna de las dos ramas pasa por 0x0000. El port ya nombraba
 * los dos pergaminos correctamente por su cuenta en `main.ts` («reveal (In Quas Wis)»).
 *
 * DOS gates que este vector no puede llevar dentro, y que quedan en el llamador:
 *   · In Quas Wis (4) exige `g_location <= 0x7f` (`0x127f`); en arena imprime «Not here!».
 *   · An Tym (7) se salta la ceremonia en `g_location` 0x1d ó 0x28 (`0x1300`-`0x130c`),
 *     que es la rama «No effect!» — el port ya la excluye por el mensaje.
 */
export const SCROLL_CEREMONY_INDEX: readonly (number | null)[] = [0, null, 2, 3, 4, null, null, 7];

/** Índice de la ceremonia al leer el pergamino `scrollIndex`, o `null` si no la hace. */
export function scrollCeremonyIndex(scrollIndex: number): number | null {
  return SCROLL_CEREMONY_INDEX[scrollIndex] ?? null;
}
