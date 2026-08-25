/**
 * ECO DEL DESPACHADOR: todo comando ecoa su nombre ANTES de correr su handler.
 *
 * DERIVACIÓN (ULTIMA.EXE `kernel_cmd_dispatch` @0x3178, disasm completo
 * `re/disasm/ULTIMA.EXE.asm`). El despachador tiene UNA forma uniforme por caso:
 * carga el puntero al nombre del comando en DATA.OVL y llama a `print_string`
 * (0x1850) ANTES de saltar al handler del overlay. Casos leídos instrucción a
 * instrucción:
 *
 *   0x3340  'M'  mov ax,0xa1b4 · call 0x1850 · call 0x8082   ("Mix Reagents\n\n")
 *   0x334e  'N'  mov ax,0xa1c4 · call 0x1850 · call 0x805e   ("New Order")
 *   0x335c  'O'  mov ax,0xa1ce · call 0x1850 · call 0x7e1e   ("Open-")
 *   0x338c  'Q'  mov ax,0xa1ea · call 0x1850 · call 0x81ae   ("Quit:")
 *   0x339a  'R'  mov ax,0xa1f0 · call 0x1850 · call 0x7e4e   ("Ready...\n\n")
 *   0x3472  'Z'  mov ax,0xa28c · call 0x1850 · call 0x7e36   ("Z-stats...\n")
 *
 * El ESPACIO (Pass) NO es una excepción: 0x31a0 `cmp ax,0x20` → 0x31f4, que tras
 * descartar la rama de vela (g_location==0 && g_sail_dir!=0 → "Sheets in irons!"
 * DS 0xa122, ret 0 SIN turno) cae en:
 *
 *   0x3210       mov ax,0xa134 · jmp 0x33ea
 *   0x33ea       push ax · call 0x1850 · jmp 0x31ee   (ret [bp-2]=1 = turno consumido)
 *
 * es decir el MISMO `print_string` que los demás, con DS 0xa134 = "Pass\n"
 * (verificado byte a byte en `original/u5/ultima5/DATA.OVL`, fileoff = DS+0x10:
 * `50 61 73 73 0a 00` = "Pass\n\0"). Por eso el original escribe una ENTRADA DE
 * ECO con su prompt («>Pass») y no una línea suelta pegada a la anterior.
 *
 * ESTE TEST ES UN DETECTOR DE CLASE, no un veredicto por comando: comprueba que
 * cada nombre de comando del despachador que el port ya tiene catalogado en
 * CMD_STRINGS TENGA UN EMISOR. Es el hueco que dejó pasar el bug del usuario
 * (28-07): `CMD_STRINGS.pass` existía, con su cita DS 0xa134, y NO lo emitía
 * NADIE — el core empujaba un `{kind:"message"}` propio ("Pass", sin `\n` y sin
 * bullet), así que el log del port apilaba «Aguardáis» pegados y sin «>».
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CMD_STRINGS } from "../src/core/world/cmd-strings.js";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string): string => readFileSync(join(here, "..", "src", rel), "utf8");

const main = src("main.ts");
const skinFiel = src("skin/fiel/skin.ts");

/**
 * Emisores del eco que NO viven en el despachador de `main.ts`. Cada excepción va
 * con su DUEÑO derivado — no es una lista blanca de conveniencia:
 *   · `ztats`: lo ecoa la PIEL, que es quien monta la ficha (skin/fiel/skin.ts
 *     dispatch `{type:"console", text:"Z-stats...", kind:"echo"}`); el kernel
 *     0x3472 imprime y salta a ZSTATS, y en el port ese overlay es de la piel.
 *   · `setActive`: no es una tecla de comando A-Z sino el handler de dígito
 *     (kernel 0x4080); ya tiene sus dos emisores (overworld y combate).
 */
const EMITTED_BY_SKIN = new Set(["ztats"]);

/**
 * DEFECTOS ABIERTOS con DUEÑO — no es una lista blanca: para estas claves el test
 * asevera que el defecto SIGUE AHÍ (aserto invertido), de modo que el día que su
 * dueño lo arregle ESTE test se pone rojo y obliga a retirar la entrada. Un
 * «pendiente» que no se puede cerrar en silencio.
 *
 * ✅ VACÍA desde el 01-08. Llevaba `mix` («el despachador imprime "Mix Reagents\n\n"
 * —0x3340 `mov ax,0xa1b4` · `call 0x1850`— ANTES de entrar al handler, y `doMix()` no
 * lo ecoa: el flujo (M)ix arranca mudo», TAREA #102). El carril `skin/mix-flow-fidel`
 * lo arregló y el trinquete hizo su trabajo: al mergear a main este caso se puso ROJO
 * pidiendo la retirada de la entrada. Retirada — `mix` pasa a exigir emisor como los
 * demás, y `doMix` lo emite (`hud.echo(CMD_STRINGS.mix)`, sellado además en
 * `mix-flow-presentation.test.ts`). El Map se conserva por si vuelve a hacer falta.
 */
const OPEN_DEFECTS = new Map<string, string>([]);

/** Nombres de comando cuyo eco imprime el OVERLAY destino, no el kernel: el case
 *  'A' (0x3216) imprime "" y son MAINOUT 0x29fe / TOWN 0x26e0 los que ponen
 *  "Attack-". Se mantiene en la cuenta porque el port sí lo emite en main.ts. */
const ALL_KEYS = Object.keys(CMD_STRINGS) as (keyof typeof CMD_STRINGS)[];

describe("eco del despachador (kernel_cmd_dispatch 0x3178): todo comando tiene emisor", () => {
  for (const key of ALL_KEYS) {
    it(`«${key}» (${JSON.stringify(CMD_STRINGS[key])}) lo emite alguien`, () => {
      const ref = `CMD_STRINGS.${key}`;
      const inMain = main.includes(ref);
      const inSkin = EMITTED_BY_SKIN.has(key) && /Z-stats\.\.\./.test(skinFiel);
      const open = OPEN_DEFECTS.get(key);
      if (open !== undefined) {
        // Aserto INVERTIDO: mientras el defecto siga abierto nadie lo emite. Si esto
        // se pone rojo es BUENA noticia — su dueño lo arregló: retira la entrada de
        // OPEN_DEFECTS y este caso pasa a exigir el emisor como los demás.
        expect(
          inMain || inSkin,
          `«${key}» figura como DEFECTO ABIERTO (${open}) pero YA tiene emisor: ` +
            `retira su entrada de OPEN_DEFECTS para que el test lo exija de verdad.`,
        ).toBe(false);
        return;
      }
      expect(
        inMain || inSkin,
        `CMD_STRINGS.${key} está catalogado con su cita DS pero NINGÚN call-site lo ` +
          `emite: el comando corre MUDO (o el core empuja un mensaje propio sin el ` +
          `prompt «>» del despachador). Cítalo con hud.echo(CMD_STRINGS.${key}).`,
      ).toBe(true);
    });
  }

  it("el ESPACIO ecoa «Pass\\n» (DS 0xa134), no un mensaje suelto del core", () => {
    // El texto catalogado conserva el `\n` del binario: es lo que separa una
    // entrada de la siguiente al pulsar Espacio varias veces seguidas.
    expect(CMD_STRINGS.pass).toBe("Pass\n");
    // Y el emisor es el DESPACHADOR (main.ts), como el resto de comandos.
    expect(main).toContain("hud.echo(CMD_STRINGS.pass)");
  });
});
