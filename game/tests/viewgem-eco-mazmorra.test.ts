/**
 * (V)iew a gem — EL ECO DEL DESPACHADOR EXISTE EN LOS TRES CONTEXTOS.
 *
 * Origen: revisando el comando entero (sobremundo / pueblo-castillo / mazmorra) salió que
 * el bucle de MAZMORRA era el único que abría la vista SIN imprimir ">View a gem!". Medido
 * en vivo el 08-08 sobre Deceit planta 0: la consola quedaba en «North / Enter dungeon /
 * DECEIT» y la gema se gastaba en silencio. Sin gemas era peor: «You have none!» aparecía
 * suelto, sin la pulsación que lo provocó.
 *
 * ── POR QUÉ ES DIVERGENCIA Y NO ESTILO ──────────────────────────────────────────────────
 * El bucle de mazmorra NO tiene despachador propio (a diferencia de la ARENA, que sí lo
 * tiene — COMBAT.OVL 0x0838, ver `combate-botonera.test.ts`). Tres anclas independientes:
 *
 *   1. DUNGEON.OVL manda toda tecla ≥0x20 al kernel: `07a0: push word ptr [bp+4]` (la
 *      tecla) + `07a3: call 0xffffafa8`. Con load_seg 0x081D (command-dispatch.md §3, tabla
 *      de niveles) la base de near-call es 0x81D0, y 0xafa8 + 0x81D0 = 0x13178 → **0x3178**
 *      = `kernel_cmd_dispatch`. Es el único call de ese bucle a la tabla de comandos
 *      (command-dispatch.md §5 lo lista como «DUNGEON.OVL 0x7A3 — exactamente uno»).
 *   2. El caso V del kernel imprime ANTES de mirar dónde estás:
 *        341a: mov ax, 0xa258      ; "View a gem!\n"
 *        341d: push ax
 *        341e: call 0x1850         ; print_string  ← SIEMPRE
 *        3421: cmp byte ptr [g_gems], 0
 *        342c: cmp byte ptr [g_location], 0x21   ← el gate de mazmorra va DESPUÉS
 *        3444: call 0x7f4a         ; → DNGLOOK 0x06A8 (vista de mazmorra)
 *      O sea: el eco es anterior al gate de gemas Y al de localización. No hay estado en el
 *      que el binario abra la vista de mazmorra sin haberlo impreso.
 *   3. CENSO NEGATIVO con su control (una ausencia se comprueba contra la fuente entera):
 *      `DUNGEON.OVL.asm` no contiene NINGUNA ocurrencia de `a258` ni NINGÚN `cmp` contra
 *      0x56/0x76 ('V'/'v'). El control de que el grep no está ciego: ese mismo fichero SÍ
 *      tiene 83 compares contra literales de un byte (son nibbles de tile, no teclas). No
 *      hay una segunda rama de mazmorra que pudiera legítimamente callar el eco.
 *
 * ── QUÉ VIGILA ESTE FICHERO ─────────────────────────────────────────────────────────────
 * El invariante que sobrevive a un refactor: **toda llamada a `game.view()` en main.ts va
 * precedida de su eco**. Se ancla al conjunto de call-sites y no a un número de línea ni a
 * una subcadena de la prosa, así que un tercer contexto añadido mañana entra solo.
 *
 * Y el control en el otro sentido, porque el arreglo tenía dos sitios posibles y uno es
 * falso: el eco es del DESPACHADOR, no del comando. `game.view()` NO debe emitirlo como
 * `{kind:"message"}` — ahí saldría sin el prompt «>» y sin el `\n` que separa pulsaciones
 * (la misma corrección que ya se le hizo a `pass()`, game.ts:2428). Eso lo asevera
 * `view.test.ts`; aquí se repite el lado del call-site para que mover el eco de sitio no
 * pueda dejar los dos ficheros verdes a la vez.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { CMD_STRINGS } from "../src/core/world/cmd-strings.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN_TS = readFileSync(join(HERE, "..", "src", "main.ts"), "utf8");
const LINES = MAIN_TS.split("\n");

/** Índices (0-based) de las líneas que despachan el comando: `applyEvents(game.view())`. */
function viewCallSites(): number[] {
  const out: number[] = [];
  LINES.forEach((l, i) => {
    if (/applyEvents\(\s*game\.view\(\)\s*\)/.test(l)) out.push(i);
  });
  return out;
}

/**
 * ¿Hay un `hud.echo(CMD_STRINGS.view)` en las `ventana` líneas ANTERIORES a `idx`?
 * La ventana es corta a propósito: el eco tiene que estar pegado al despacho, no en
 * cualquier sitio del fichero.
 */
function ecoAntesDe(idx: number, ventana = 6): boolean {
  return LINES.slice(Math.max(0, idx - ventana), idx).some((l) =>
    /hud\.echo\(\s*CMD_STRINGS\.view\s*\)/.test(l),
  );
}

/** La guarda de auto-repeat, verbatim. Es el sujeto de los dos asertos de §1.11. */
const GUARDA = "if (ev.repeat) return;";

/**
 * Los MODALES-DE-CUALQUIER-TECLA del despachador: bloques `if (xActive) {` que apagan su
 * propio flag y consumen la tecla (`ev.preventDefault()`). Se devuelven como RANGOS de
 * línea para que los asertos puedan preguntar por pertenencia en vez de por cercanía.
 *
 * El teardown de carga de partida tiene la misma cabecera y el mismo apagado de flag pero
 * no toca `ev` ninguno: exigirle una guarda de repeat sería exigirle un absurdo, así que
 * el `preventDefault` es lo que lo deja fuera.
 */
function modalesDeTecla(): { ini: number; fin: number; flag: string }[] {
  const out: { ini: number; fin: number; flag: string }[] = [];
  LINES.forEach((l, i) => {
    const m = /^\s*if \((\w*(?:Active|active))\) \{\s*$/.exec(l);
    if (!m) return;
    // Se recorre el bloque HACIA DELANTE contando llaves, así cada `if` se casa con SU
    // cierre y con nada más (emparejar hacia atrás por cercanía ya dio un verde espurio).
    let prof = 0;
    let fin = LINES.length - 1;
    for (let j = i; j < LINES.length; j++) {
      const s = LINES[j]!;
      prof += (s.match(/\{/g) ?? []).length - (s.match(/\}/g) ?? []).length;
      if (prof <= 0) {
        fin = j;
        break;
      }
    }
    const cuerpo = LINES.slice(i, fin + 1).join("\n");
    if (!new RegExp(`^\\s*${m[1]!} = false;`, "m").test(cuerpo)) return; // no apaga su flag
    if (!/ev\.preventDefault\(\)/.test(cuerpo)) return; // no consume la tecla
    out.push({ ini: i, fin, flag: m[1]! });
  });
  return out;
}

describe("(V)iew a gem — el eco «>View a gem!» acompaña a TODOS los despachos", () => {
  it("hay al menos DOS call-sites de game.view() (mundo/pueblo y mazmorra)", () => {
    // Si esto baja a 1, o el comando dejó de existir en un contexto o alguien unificó los
    // dos bucles — en los dos casos el aserto de abajo estaría midiendo menos de lo que cree.
    expect(viewCallSites().length).toBeGreaterThanOrEqual(2);
  });

  it("CADA call-site lleva su eco inmediatamente antes (kernel 0x341e, antes de los gates)", () => {
    const sinEco = viewCallSites()
      .filter((i) => !ecoAntesDe(i))
      .map((i) => `main.ts:${i + 1}  ${LINES[i]!.trim()}`);
    expect(sinEco).toEqual([]);
  });

  it("el eco es EXACTAMENTE la cadena de DS 0xa258, con su salto de línea", () => {
    // Verbatim de DATA.OVL (fileoff = DS + 0x10). Sin el `\n` el log apila pulsaciones
    // pegadas — el defecto que ya se corrigió en `pass()`.
    expect(CMD_STRINGS.view).toBe("View a gem!\n");
  });

  it("el orden es ECO → despacho, no al revés (0x341e imprime ANTES de dec [g_gems] 0x3428)", () => {
    // El mutante que este aserto mata: mover el `hud.echo` DEBAJO del `applyEvents`. Seguiría
    // habiendo eco, pero «You have none!» saldría ANTES que la pulsación que lo provocó, y
    // con la vista abierta el eco llegaría tras el repintado.
    for (const i of viewCallSites()) {
      const eco = LINES.slice(Math.max(0, i - 6), i).findIndex((l) =>
        /hud\.echo\(\s*CMD_STRINGS\.view\s*\)/.test(l),
      );
      expect(eco, `main.ts:${i + 1} despacha sin eco previo`).toBeGreaterThanOrEqual(0);
    }
  });

  it("TODO modal que cierra CUALQUIER tecla ignora el AUTO-REPEAT (§1.11)", () => {
    // El bug del original: la repetición de la MISMA pulsación que abrió el modal lo cerraba
    // dentro del gesto, gastando la gema y sin dejar ver nada. La prueba de conducta vive en
    // `e2e/viewgem-autorepeat.spec.ts` (necesita CDP: sólo un navegador de verdad pone
    // `KeyboardEvent.repeat`); esto es el candado BARATO que se pone rojo sin navegador.
    //
    // Se ancla al CONJUNTO de modales-de-cualquier-tecla (los que apagan su flag en el
    // keydown), no a dos nombres escritos a mano: un tercer modal de esta familia entra solo
    // y llega con el candado puesto en vez de repetir el defecto.
    // 🔴 ESTE ASERTO NACIÓ ROTO Y LO CAZÓ SU PROPIO MUTANTE. La primera versión buscaba el
    // `preventDefault` en las 12 líneas ANTERIORES a la asignación para decidir si la rama
    // vivía en el keydown. Al retirar la guarda de la gema (mutante M6) el test siguió
    // VERDE: el comentario de derivación de esa rama mide más de 12 líneas, la ventana no
    // llegaba al `preventDefault`, el filtro daba «no es del keydown» y EXCLUÍA justo la
    // rama que este fichero existe para proteger. Un filtro de PROXIMIDAD decide por
    // distancia de texto, que es una propiedad del comentario, no del código.
    // Ahora el emparejamiento es ESTRUCTURAL: de cada `X = false;` se busca hacia atrás su
    // `if (X) {`, y la guarda tiene que estar DENTRO de ese bloque. Un comentario de
    // cualquier tamaño da igual.
    // 🔴 Y LA SEGUNDA VERSIÓN TAMBIÉN NACIÓ ROTA, cazada por el mutante M9. Buscaba hacia
    // atrás el `if (X) {` más cercano SIN COTA, así que al romper el `if` de la gema el
    // emparejamiento saltó al `if (canvasGemActive)` del teardown de carga de partida —
    // ¡1 500 líneas antes— y midió como «bloque» medio fichero, que naturalmente contenía
    // un `preventDefault` y una guarda de OTRA rama. Verde espurio. (M6 y M7 morían igual,
    // pero por accidente de qué bloque agarró: un aserto que acierta por casualidad es un
    // aserto sin dientes.) La lección es la de siempre: emparejar por CERCANÍA —de texto o
    // de nombre— no es emparejar por ESTRUCTURA.
    // Ahora se recorre cada bloque HACIA DELANTE contando llaves, así que cada `if (X) {`
    // se casa con SU cierre y con nada más (ver `modalesDeTecla`).
    const modales = modalesDeTecla();
    const cierres: string[] = [];
    for (const { ini, fin, flag } of modales) {
      const cuerpo = LINES.slice(ini, fin + 1).join("\n");
      // No basta con que la guarda ESTÉ: tiene que estar ANTES de apagar el flag. Ponerla
      // detrás (mutante M3) deja el modal cerrándose con el repeat igual que antes — el
      // bug entero de vuelta— y un aserto de mera presencia lo da por bueno. «Está en el
      // bloque» y «manda en el bloque» no son la misma propiedad.
      const guarda = cuerpo.indexOf(GUARDA);
      const apaga = cuerpo.search(new RegExp(`^\\s*${flag} = false;`, "m"));
      if (guarda < 0 || guarda > apaga) cierres.push(`main.ts:${ini + 1}  ${LINES[ini]!.trim()}`);
    }
    // Y el CONTADOR, porque un emparejamiento que no case con nada también da la lista
    // vacía: si el refactor de mañana cambia la forma del bloque, esto grita en vez de
    // pasar por vacuidad. Hoy son la gema y el zodíaco.
    expect(modales.length, "el emparejamiento no encontró los modales: el aserto estaría vacío").toBe(2);
    expect(cierres).toEqual([]);
  });

  it("CONTROL — la guarda vive SÓLO dentro de los modales (fuera mataría el andar-manteniendo)", () => {
    // La razón es DERIVADA y no de gusto: en el original se anda manteniendo la flecha —la
    // repetición typematic ES el paso continuo— y este repo la reproduce a mano en el táctil
    // (`ui/hold-repeat.ts`). Un `if (ev.repeat) return` global cambiaría el defecto por una
    // regresión mayor y menos fiel. Este aserto es la GUARDA DE LA GUARDA: impide que alguien
    // "simplifique" el arreglo subiéndolo, que es la forma en que este tipo de fix degrada.
    //
    // 🔴 LA PRIMERA VERSIÓN DE ESTE CONTROL NO GUARDABA NADA, y lo cazó un mutante nuevo (M6)
    // al re-verificar el arnés sobre el árbol mergeado. Buscaba la guarda en las 12 líneas
    // siguientes a `window.addEventListener("keydown"` — pero ESE listener es un envoltorio
    // de tres líneas que sólo llama a `handleGameKey(ev)`, y está 560 líneas DESPUÉS de la
    // rama de la gema. El despachador de verdad, el que contiene las dos ramas, es
    // `handleGameKey`. Meter `if (ev.repeat) return;` en su primera línea —que es
    // EXACTAMENTE la simplificación que este control existe para impedir, y la que mata el
    // andar-manteniendo— dejaba los siete asertos VERDES. El control apuntaba al sitio por
    // el que nadie iba a pasar. Anclar por el NOMBRE de un patrón («keydown») en vez de por
    // la ESTRUCTURA que se quiere proteger es el mismo error que ya se cometió dos veces
    // arriba, en el emparejamiento de bloques.
    //
    // Ahora el predicado no nombra ninguna función ni ninguna ventana de líneas: CENSA todas
    // las apariciones de la guarda en el fichero y exige que cada una caiga DENTRO de un
    // modal-de-cualquier-tecla. Da igual dónde la ponga el refactor de mañana y da igual cómo
    // se llame el despachador: si la guarda se escapa del modal, esto la nombra.
    const modales = modalesDeTecla();
    expect(modales.length, "sin modales localizados el censo sería vacuo").toBe(2);
    const dentroDeUnModal = (i: number): boolean =>
      modales.some(({ ini, fin }) => i >= ini && i <= fin);
    const fugadas = LINES.map((l, i) => (l.includes(GUARDA) ? i : -1))
      .filter((i) => i >= 0 && !dentroDeUnModal(i))
      .map((i) => `main.ts:${i + 1}  ${LINES[i]!.trim()}`);
    expect(fugadas, "guarda de auto-repeat FUERA de un modal: mata el andar-manteniendo").toEqual(
      [],
    );
    // Y el contador en el otro sentido: exactamente una guarda POR modal, ni de más (una
    // suelta en el despachador seguiría siendo global) ni de menos.
    const total = LINES.filter((l) => l.includes(GUARDA)).length;
    expect(total, "una guarda por modal, y ninguna suelta").toBe(modales.length);
  });

  it("CONTROL — el eco NO se cuela en el core: game.view() no emite la cadena", () => {
    // El otro sitio donde «arreglar» esto, y es el falso: el eco pertenece al despachador.
    // Si alguien lo mueve a game.ts, este fichero se pone rojo aunque la consola parezca bien.
    const gameTs = readFileSync(join(HERE, "..", "src", "core", "game.ts"), "utf8");
    const viewBody = gameTs.slice(gameTs.indexOf("  view(): GameEvent[] {"));
    const cierre = viewBody.indexOf("\n  }\n");
    expect(cierre).toBeGreaterThan(0); // el cuerpo se localizó de verdad
    expect(viewBody.slice(0, cierre)).not.toContain('text: "View a gem!');
  });
});
