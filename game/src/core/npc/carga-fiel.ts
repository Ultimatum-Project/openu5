/**
 * PUERTA #D1 — el gate `fresh` de `town_load_map` (TOWN.OVL:0x11F0) en la carga de partida.
 * Acta: `re/notes/npc-carga-partida-fresh-gate.md`. Declarada en `re/deliberate-divergences.md`.
 *
 * ── QUÉ DIVERGE ──────────────────────────────────────────────────────────────────────────
 * En 1988 los NPC de un mapa se pueblan **sólo al ENTRAR** (`town_load_map` con su argumento
 * `fresh` a 1). Los tres llamadores de entrada pasan la constante 1; el cuarto —`main`,
 * ULTIMA.EXE:0x00F7— lo CALCULA, y para una partida guardada dentro de un pueblo da 0 de
 * forma determinista (acta §2). Con `fresh=0` no se lee el `.NPC` y no se activa nada: el
 * mapa se queda con lo que traiga la ventana del save. Medido en DOSBox con el par causal
 * A ⇄ E3 (acta §4): el MISMO fichero, cargado, pinta CERO guardias; saliendo y volviendo a
 * entrar en la MISMA sesión, los pinta.
 *
 * El port RE-DERIVA siempre por horario en la carga (`NpcManager.enterMap(…, restore=true)`,
 * rama de AUSENCIA de `npcWalk`). El CONTENIDO es fiel — mismos NPC, mismas casillas; lo que
 * diverge es CUÁNDO se corre.
 *
 * ── POR QUÉ ESTO ES UNA PUERTA Y NO UN FIX A SECAS ───────────────────────────────────────
 * Dos razones MEDIDAS, no prudenciales:
 *
 *  1. La vía `.GAM`+sidecar NO PUEDE transportar hoy el estado de los NPC. `SaveSidecar`
 *     (saveNative.ts) no tiene el campo y `extractSidecar` no lo extrae ⇒ **0 de 49**
 *     semillas del espejo lo llevan, por CONSTRUCCIÓN y no por accidente
 *     (`tests/npc-gate-carga-medida.test.ts`, con su control positivo). Quitar la
 *     re-derivación sin añadir el transporte dejaría TODO pueblo cargado por esa vía vacío
 *     para siempre — que no es el binario, es una divergencia nueva y peor.
 *  2. Las **siete** semillas del espejo que arrancan en mapa poblado están sostenidas POR la
 *     divergencia: hoy casan con el LP porque el port repuebla y el humano del LP había
 *     entrado andando. Medido cuánto se cae: ad12 30 NPC · part03/05/10 25 · part07/09 14 ·
 *     part06 2 (acta §8 y la medida citada).
 *
 * ⇒ el fix va COMPLETO (transporte + gate) o no va. Y va detrás de esta puerta hasta que las
 * siete semillas estén migradas, porque activarlo antes reparte rojos por el corpus.
 *
 * ── QUÉ HACE LA PUERTA ───────────────────────────────────────────────────────────────────
 * APAGADA (default, y lo que hay en `main`): conducta de hoy, byte a byte. El sidecar no
 * escribe ni lee `npcWalk` y la ausencia sigue significando «re-deriva por horario». Una
 * semilla ya migrada —que SÍ lleva `npcWalk`— queda INERTE: nadie la lee.
 *
 * ENCENDIDA: `extractSidecar` escribe `npcWalk`, `importNativeSave` lo lee, y la AUSENCIA
 * pasa a significar lo que significa en el binario — **no hay nadie** — en vez de «no sé,
 * re-deriva». Es la clase [[heredar-no-deja-el-campo-neutro-lo-deja-en-el-default]].
 *
 * 🔴 La puerta gobierna las DOS piezas a la vez A PROPÓSITO. Con sólo el transporte, un
 * checkpoint exportado a mitad de caminata se restauraría verbatim mientras su hermano sin
 * `npcWalk` se re-deriva: dos semánticas de carga conviviendo en el mismo corpus. Con sólo
 * el gate, el pueblo se queda vacío. Ninguna de las dos mitades es un estado en el que se
 * pueda dejar el port.
 */

/**
 * Estado de la puerta. Arranca del entorno por DOS vías, porque el sujeto vive en los dos
 * lados y ninguna de las dos llega al otro:
 *   · Node (vitest, `tools/migra-npcwalk.ts`): `U5_NPC_GATE_FIEL=1`. Vite NO sustituye
 *     `process.env.X`, así que en el navegador esta rama no existe — de ahí el `typeof`.
 *   · Navegador (el arnés del espejo, que corre contra el vite del webServer de playwright):
 *     `VITE_U5_NPC_GATE_FIEL=1`. Vite expone al bundle las variables del proceso que
 *     empiezan por `VITE_`, así que basta con ponerla en la invocación de playwright.
 *
 * 🔴 Que la variable esté puesta en la shell NO acredita que haya llegado al bundle: son dos
 * procesos y dos mecanismos distintos. Por eso `__u5test.cargaFielActiva()` (main.ts) publica
 * el estado REAL de la puerta dentro de la página, y el careo del espejo lo lee ANTES de dar
 * por bueno un brazo. Un brazo que creía tener la puerta abierta y la tenía cerrada mide
 * «no hay diferencia» y se lee como «los NPC no afectan» — el veredicto invertido.
 */
let activa = ((): boolean => {
  try {
    if (typeof process !== "undefined" && process.env?.U5_NPC_GATE_FIEL === "1") return true;
  } catch {
    /* no hay `process`: es el navegador */
  }
  // 🔴 El cast NO es cosmética: `import.meta.env` sólo lo tipa `vite/client`, que está en el
  // tsconfig de `src/` pero NO en el de `e2e/`. Escrito a pelo, `npx tsc -p game/tsconfig.json`
  // sale VERDE y la batería se pone roja en el paso de tsc-e2e («Property 'env' does not exist
  // on type 'ImportMeta'») — porque son DOS proyectos y comprobar uno no comprueba el otro.
  // Familia del aviso de CLAUDE.md sobre el tsc de la raíz: el comando que compila algo no
  // acredita que compile lo TUYO.
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return meta.env?.VITE_U5_NPC_GATE_FIEL === "1";
  } catch {
    return false;
  }
})();

/** ¿Está la puerta abierta? Único lector permitido — nadie replica el predicado. */
export function cargaFielActiva(): boolean {
  return activa;
}

/**
 * Abre o cierra la puerta y devuelve el valor ANTERIOR, para que un test o una herramienta
 * la restaure sin tener que recordarlo (patrón `prev` de los arneses del repo).
 */
export function setCargaFiel(valor: boolean): boolean {
  const prev = activa;
  activa = valor;
  return prev;
}
