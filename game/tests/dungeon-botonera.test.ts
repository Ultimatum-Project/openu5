// @vitest-environment jsdom
/**
 * BOTONERA DE MAZMORRA — la lista táctil contra el despachador real del pasillo.
 *
 * Origen: reporte del usuario jugando Doom L1 en táctil (16-08): «dentro de dungeon se
 * han limitado las acciones posibles a solo estas — faltan muchas, View gem, Ready y
 * muchas más; y sale un Chest que no sé qué es». `DUNGEON_BUTTONS` era el ÚNICO de los
 * tres decks contextuales sin censar: sus cinco entradas venían de una lista de memoria.
 *
 * ⚠ LA MAZMORRA NO ES EL COMBATE, Y CONFUNDIRLOS INVIERTE EL VEREDICTO. La arena tiene
 * bucle de turno PROPIO (COMBAT.OVL:0x0838), así que su censo se derivó de una tabla
 * aparte. El bucle DUNGEON no: `sub_06C4` atiende a mano las flechas cocidas (1..4), el 5
 * (prompt Y/N de descenso), 0x0B (karma), ENTER/PERIOD (giro 180°), ^S/^V y los dígitos
 * (0x07bc → set active player), y manda TODO LO DEMÁS al MISMO `kernel_cmd_dispatch`
 * 0x3178 que el mundo:
 *
 *     07a0: ff7604    push word ptr [bp + 4]
 *     07a3: e802a8    call 0xffffafa8
 *
 * Ese destino NO se lee crudo en ULTIMA.EXE.asm (caería en una rutina ajena con cuerpo
 * plausible): se resuelve con `re/tools/dispatch_table.py` — load_seg 0x081D ⇒ base de
 * near-call `overlay_near_call_base` = 0x81D0, y (0xafa8 + 0x81D0) mod 2^16 = 0x3178. Con
 * su CONTROL POSITIVO: `near_calls_to_kernel("DUNGEON.OVL", 0x3178)` devuelve exactamente
 * ese offset y ningún otro, y MAINOUT (0x0c00) y TOWN (0x158f) dan los otros dos bucles de
 * contexto — los tres que la herramienta declara.
 *
 * ⇒ el discriminante no es un handler propio: es el GATE POR LOCALIZACIÓN de cada
 * comando. `g_location` (DS 0x5893) vale 0 en el sobremundo, 1..0x20 en pueblo y
 * 0x21..0x28 en mazmorra (0x28 = Doom). Los gates viven en DOS capas y las dos cuentan:
 * unos en el kernel y otros dentro del overlay del comando. Un censo que sólo lea el
 * kernel declara ACEPTADAS a Board, Fire y Yell, que el overlay RECHAZA — de ahí que la
 * columna `gate` de las tablas de abajo diga siempre DÓNDE se leyó.
 *
 * La derivación completa —el puente, las dos capas y las tres clases con sus cadenas—
 * vive en `re/notes/dungeon-dispatch-gates.md`, que cita este fichero como su instancia
 * auditable; la referencia va en los dos sentidos a propósito, para que quien llegue por
 * la nota encuentre el candado y quien llegue por el candado encuentre el ASM.
 *
 * Este fichero es el candado de la lista contra esa derivación, en dos planos: QUÉ
 * ÓRDENES declara `DUNGEON_BUTTONS` (lógica pura) y que esos botones se MONTEN y EMITAN
 * su tecla al tocarlos (jsdom) — porque «la entrada existe en el array» no es «el jugador
 * puede pulsarla», que es justo lo que reportó el usuario. Lo que NO mide es estilo ni
 * layout.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { describeSiViaja } from "./assets-opcionales.js";
import {
  DUNGEON_BUTTONS,
  UTIL_BUTTONS,
  WORLD_BUTTONS,
  COMBAT_BUTTONS,
  TouchControls,
} from "../src/ui/touch.js";
import type { Game } from "../src/core/game.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN_TS = join(HERE, "..", "src", "main.ts");
const RAIZ = join(HERE, "..", "..");

/** Una orden tal como la despacha el pasillo (kernel 0x3178 + gate por localización). */
interface DungeonOrder {
  /** Tecla tal como la ve el port (`KeyboardEvent.key`). */
  key: string;
  /** Código que compara el binario (AL, mayúscula). */
  code: number;
  /** Nombre humano. */
  name: string;
  /** DÓNDE se leyó el gate de localización (kernel u overlay) — o que no lo tiene. */
  gate: string;
  /** Adónde va en mazmorra: rutina real, o la cadena de rechazo. */
  destino: string;
}

/**
 * LAS ACEPTADAS. Cada fila: tecla → dónde se leyó su gate → qué corre en mazmorra.
 * Las que dicen «CERO gates» son ausencias MEDIDAS sobre la rutina COMPLETA (extent de
 * `re/ledger/coverage.json`), no sobre una ventana corta, y con control positivo: el
 * mismo escáner encuentra los gates de Open (SJOG 0x137a/0x1381) y Board (CMDS
 * 0x07fc/0x0803) con esos mismos límites.
 */
const ACEPTADAS: DungeonOrder[] = [
  { key: " ", code: 0x20, name: "Pass", gate: "kernel 0x31f4 (loc≠0)", destino: 'print DS 0xa134 "Pass\\n"' },
  { key: "a", code: 0x41, name: "Attack", gate: "kernel 0x3222 jae", destino: "DUNGEON.OVL:0x1D4A" },
  { key: "c", code: 0x43, name: "Cast", gate: "CAST.OVL:0x0DBA — gatea POR HECHIZO", destino: "CAST.OVL:0x0DBA" },
  { key: "g", code: 0x47, name: "Get", gate: "kernel 0x3274 jae (salta el eco «Get-») + SJOG 0x18d6", destino: "SJOG.OVL:0x179E" },
  { key: "h", code: 0x48, name: "Hole up", gate: "kernel_camp_holeup 0x3d5b/0x3d76/0x3d90 jae (SALTAN el chequeo de terreno)", destino: "ULTIMA.EXE:0x3C9A" },
  { key: "i", code: 0x49, name: "Ignite torch", gate: "CMDS 0x0dac/0x0db3", destino: "CMDS.OVL:0x0DBA (relumbre 3D)" },
  { key: "j", code: 0x4a, name: "Jimmy", gate: "SJOG 0x0d52/0x0d59", destino: "SJOG.OVL:0x0C3E" },
  { key: "k", code: 0x4b, name: "Klimb", gate: "kernel 0x32fc jae", destino: "DUNGEON.OVL:0x1E10" },
  { key: "l", code: 0x4c, name: "Look", gate: "kernel 0x3317/0x331e (ventana 0x21..0x28)", destino: "DNGLOOK.OVL:0x0000" },
  { key: "m", code: 0x4d, name: "Mix", gate: "CMDS 0x1b88 — sólo de repintado", destino: "CMDS.OVL:0x1AD8" },
  { key: "n", code: 0x4e, name: "New order", gate: "CERO gates (cmd_new_order, 103 líneas)", destino: "CMDS.OVL:0x0DDC" },
  { key: "o", code: 0x4f, name: "Open", gate: "SJOG 0x137a/0x1381", destino: "SJOG.OVL:0x12D4 (cofre de la celda)" },
  { key: "q", code: 0x51, name: "Quit", gate: "CERO gates (cmd_quit)", destino: "CAST2.OVL:0x10FE" },
  { key: "r", code: 0x52, name: "Ready", gate: "CERO gates (cmd_ready, 52 líneas)", destino: "ZSTATS.OVL:0x1296" },
  { key: "s", code: 0x53, name: "Search", gate: "kernel 0x33a8 jae + SJOG 0x0969", destino: "SJOG.OVL:0x0646" },
  { key: "u", code: 0x55, name: "Use", gate: "CAST.OVL:0x1792 — gatea POR OBJETO", destino: "CAST.OVL:0x1792" },
  { key: "v", code: 0x56, name: "View gem", gate: "kernel 0x342c jae", destino: "DNGLOOK.OVL:0x06A8 (mapa 8×8 de la planta)" },
  { key: "z", code: 0x5a, name: "Ztats", gate: "CERO gates (cmd_zstats, 185 líneas)", destino: "ZSTATS.OVL:0x0A3A" },
];

/**
 * LAS RECHAZADAS, con la cadena EXACTA que imprime cada una en mazmorra (resuelta contra
 * DATA.OVL: offset DS + 0x10 = offset de fichero). El binario las CONOCE —todas tienen
 * handler— y aun así no dejan hacer nada bajo tierra: por eso no pueden aparecer en la
 * botonera. Precedente #71, la trampa inversa.
 */
const RECHAZADAS: DungeonOrder[] = [
  { key: "b", code: 0x42, name: "Board", gate: "CMDS 0x07fc/0x0803", destino: 'CMDS 0x080a → DS 0x4252 "\\nNot here!\\n"' },
  { key: "e", code: 0x45, name: "Enter", gate: "kernel 0x3254 (loc≠0)", destino: 'kernel 0x3260 → DS 0xa156 "Enter what?\\n"' },
  { key: "f", code: 0x46, name: "Fire", gate: "CMDS 0x0af0/0x0af7", destino: 'CMDS 0x0afe → DS 0x42e4 "What?\\n"' },
  { key: "p", code: 0x50, name: "Push", gate: "kernel 0x336a/0x3371", destino: 'kernel 0x3378 → DS 0xa1d4 "Push\\nNot here!\\n"' },
  { key: "t", code: 0x54, name: "Talk", gate: "kernel 0x33e0 (loc>0x20)", destino: 'kernel 0x33e7 → DS 0xa22c "Talk-Funny, no response!\\n"' },
  { key: "y", code: 0x59, name: "Yell", gate: "CMDS 0x1481/0x1488 (cae fuera de las dos ventanas)", destino: 'CMDS 0x14ac → DS 0x453a "\\nNo effect!\\n"' },
];

/**
 * LAS DESCONOCIDAS: el despachador no las reconoce como comando. 'X' va aquí aunque su
 * caso EXISTA, y el motivo se declara porque es una fila que confunde: la ventana de
 * localización de `cmd_xit` (CMDS 0x0EB4: `cmp 0x20/jae` seguido de `cmp 0x29/jbe`) manda
 * TODA localización al cuerpo, así que su rechazo es INALCANZABLE — ficha #71, ya
 * adjudicada, y NO un hallazgo de este censo. Sin botón igualmente: a pie el cuerpo
 * contesta «what?».
 */
const SIN_COMANDO: { key: string; name: string; destino: string }[] = [
  { key: "d", name: "(sin comando en el binario)", destino: 'kernel 0x324e → DS 0xa14c "D-What?\\n"' },
  { key: "w", name: "(sin comando en el binario)", destino: 'kernel 0x3450 → DS 0xa276 "W-What?\\n"' },
  { key: "x", name: "X-it", destino: "gate MUERTO (#71); a pie el cuerpo contesta «what?»" },
];

/**
 * LA ÚNICA EXCEPCIÓN DECLARADA, por nombre y con su razón. En el binario la 'd' NO es
 * comando (está arriba, en SIN_COMANDO); beber de una fuente se alcanza mirándola
 * ((L)ook → «Will you drink?», DNGLOOK 0x012f). El 'd' es un atajo QoL del port declarado
 * desde antes en `main.ts:1503` y `:1562`, y el botón lo hereda. Misma clase que el
 * «Save»=F5 de WORLD_BUTTONS (tecla de shell, no del binario). Va POR NOMBRE, no por
 * clase, para que un botón nuevo no pueda colarse por esta misma puerta.
 */
const QOL_DECLARADO = new Map<string, string>([
  ["d", "atajo QoL de (D)rink, divergencia declarada en main.ts:1503 y :1562"],
]);

/** Órdenes con vía táctil FIJA fuera de la rejilla contextual (no necesitan botón). */
const VIA_FIJA = new Map<string, string>([[" ", "UTIL_BUTTONS «Space»"]]);

/**
 * SONDAS DE MOTOR, una por orden aceptada: el trozo EXACTO con el que
 * `handleDungeonKey` la resuelve. Hace falta una por comando y no vale un patrón
 * genérico — MEDIDO: el port atiende las VEINTISÉIS letras dentro de ese cuerpo (las
 * rechazadas también tienen su rama, para ecoar la cadena del binario), así que un
 * `dk === "x"` genérico da 26/26 y no discrimina «implementado» de «eco de rechazo».
 * Se usa en los DOS sentidos: como control positivo de que la sonda está viva y como
 * prueba de que la orden tiene motor antes de exigirle botón.
 */
const SONDA_MOTOR: Record<string, string> = {
  " ": 'game.dungeonCommand("pass")',
  a: 'game.dungeonCommand("attack")',
  c: "doDungeonCast()",
  g: 'game.dungeonCommand("get")',
  h: "startCamp()",
  i: "game.ignite()",
  j: 'game.dungeonCommand("jimmy")',
  k: '=== "k" ? "klimb"',
  l: "pendingDungeonLook = true",
  m: "doMix()",
  n: "game.newOrder(",
  o: '=== "o" ? "open"',
  q: "doQuitSave()",
  r: "doReady()",
  s: '=== "s" ? "search"',
  u: "openUsePicker()",
  v: "game.view()",
  // 'z' NO lleva sonda aquí: como en combate, la sirve el keyHandler de CAPTURA de la
  // piel fiel y `handleDungeonKey` la deja pasar a propósito (`if (dk === "z") return;`).
  // Su ausencia del cuerpo se asevera abajo, para que no se lea como descuido.
  d: '=== "d" ? "drink"', // el atajo QoL declarado
};

/** El cuerpo de `handleDungeonKey`, recortado del fuente por sus dos extremos. */
function cuerpoHandleDungeonKey(): string {
  const src = readFileSync(MAIN_TS, "utf8");
  const ini = src.indexOf("const handleDungeonKey = (ev: KeyboardEvent): void => {");
  expect(ini, "no se encontró la declaración de handleDungeonKey en main.ts").toBeGreaterThan(-1);
  // Cierre de la arrow function al MISMO nivel de indentación (4 espacios); todo lo
  // anidado dentro cierra más adentro.
  const fin = src.indexOf("\n    };\n", ini);
  expect(fin, "no se encontró el cierre de handleDungeonKey").toBeGreaterThan(ini);
  return src.slice(ini, fin);
}

describe("botonera de mazmorra — contra kernel_cmd_dispatch 0x3178 + gate por localización", () => {
  it("las clases del censo son disjuntas y no se pisan (integridad de las tablas)", () => {
    const keys = [...ACEPTADAS, ...RECHAZADAS, ...SIN_COMANDO].map((o) => o.key);
    expect(new Set(keys).size, "una tecla en dos clases a la vez").toBe(keys.length);
    const codes = [...ACEPTADAS, ...RECHAZADAS].map((o) => o.code);
    expect(new Set(codes).size, "dos órdenes con el mismo código de tecla").toBe(codes.length);
    // Las letras del binario son mayúsculas (AL vale 0x41..0x5A); el port las compara en
    // minúscula. La tabla guarda la minúscula, así que código y tecla tienen que casar o
    // una de las dos columnas está mal transcrita.
    for (const o of [...ACEPTADAS, ...RECHAZADAS]) {
      if (o.key.length === 1 && o.key >= "a" && o.key <= "z") {
        expect(o.code, `${o.name}: la tecla «${o.key}» no casa con 0x${o.code.toString(16)}`).toBe(
          o.key.toUpperCase().charCodeAt(0),
        );
      }
    }
    // Y la excepción QoL tiene que ser una tecla que el binario NO reconoce: si algún día
    // alguien la mete en ACEPTADAS, la exención sobra y este aserto lo dice.
    for (const k of QOL_DECLARADO.keys()) {
      expect(
        SIN_COMANDO.some((o) => o.key === k),
        `la excepción QoL «${k}» ya no está en SIN_COMANDO: revisa si sigue haciendo falta`,
      ).toBe(true);
    }
  });

  it("NINGÚN botón de mazmorra ofrece una orden que el binario RECHAZA bajo tierra", () => {
    // La trampa inversa de #71. Las seis están en WORLD_BUTTONS — el error natural es
    // reutilizar aquella lista, que fue censada contra el MISMO despachador pero con
    // g_location = 0.
    const rechazadas = new Map(RECHAZADAS.map((o) => [o.key, o]));
    for (const def of DUNGEON_BUTTONS) {
      const mala = rechazadas.get(def.key.toLowerCase());
      expect(
        mala,
        `el botón «${def.label}» (tecla «${def.key}») ofrece una orden que el pasillo ` +
          `rechaza: gate ${mala?.gate} → ${mala?.destino}`,
      ).toBeUndefined();
    }
  });

  it("NINGÚN botón de mazmorra ofrece una tecla que el binario no reconoce", () => {
    const aceptadas = new Set(ACEPTADAS.map((o) => o.key));
    const sinComando = new Map(SIN_COMANDO.map((o) => [o.key, o]));
    for (const def of DUNGEON_BUTTONS) {
      const k = def.key.length === 1 ? def.key.toLowerCase() : def.key;
      if (QOL_DECLARADO.has(k)) continue; // excepción declarada, con su razón
      expect(
        aceptadas.has(k),
        `el botón «${def.label}» manda «${def.key}», que el despachador no acepta en ` +
          `mazmorra (${sinComando.get(k)?.destino ?? "caería en el «What?» del default 0x34D8"}). ` +
          `Si es un atajo QoL deliberado, decláralo en QOL_DECLARADO con su razón`,
      ).toBe(true);
    }
  });

  it("toda orden ACEPTADA que el motor del port ya resuelve TIENE vía táctil", () => {
    // Éste es el aserto que el reporte del usuario habría puesto en rojo: con la lista
    // vieja (Klimb/Srch/Chest/Drink/Torch) faltaban Attack, Cast, Use, Ready, Get, Jimmy,
    // Look, View gem, Ztats, New order, Mix, Hole up y Quit.
    const cuerpo = cuerpoHandleDungeonKey();
    const conBoton = new Set(
      DUNGEON_BUTTONS.map((b) => (b.key.length === 1 ? b.key.toLowerCase() : b.key)),
    );
    const enUtil = new Set(UTIL_BUTTONS.map((b) => b.key));

    const faltan: string[] = [];
    for (const o of ACEPTADAS) {
      if (o.key === "z") continue; // vía propia, aseverada abajo
      const sonda = SONDA_MOTOR[o.key];
      expect(sonda, `${o.name}: falta su sonda de motor en SONDA_MOTOR`).toBeDefined();
      // CONTROL POSITIVO por orden: si el despachador se refactoriza, el aserto positivo
      // se cae ANTES de que la exigencia de botón pueda pasar por vacuidad.
      expect(
        cuerpo.includes(sonda!),
        `sonda MUERTA: handleDungeonKey ya no resuelve ${o.name} con «${sonda}» — revisa ` +
          `el recorte y la expresión antes de fiarte del resto del test`,
      ).toBe(true);
      if (conBoton.has(o.key) || enUtil.has(o.key) || VIA_FIJA.has(o.key)) continue;
      faltan.push(`${o.name} («${o.key}», gate ${o.gate} → ${o.destino})`);
    }
    expect(faltan, `órdenes de mazmorra sin ninguna vía táctil: ${faltan.join(" · ")}`).toEqual([]);

    // Y la Ztats, que no la sirve handleDungeonKey sino el keyHandler de CAPTURA de la
    // piel fiel: se comprueba que el botón existe, porque el cuerpo no la resuelve y un
    // lector podría leer esa ausencia como un descuido.
    expect(conBoton.has("z"), "falta el botón Ztats (lo sirve el keyHandler de la piel fiel)").toBe(
      true,
    );
    expect(cuerpo.includes("if (dk === \"z\") return;")).toBe(true); // pasa de largo — y debe
  });

  it("las RECHAZADAS no tienen orden de motor propia (sólo ecoan la cadena del binario)", () => {
    // El complemento del aserto anterior: que ninguna de las seis haya ganado por la
    // puerta de atrás un `dungeonCommand` propio, que es lo que la haría candidata a
    // botón sin pasar por el censo.
    const cuerpo = cuerpoHandleDungeonKey();
    for (const o of RECHAZADAS) {
      const inventada = `game.dungeonCommand("${o.name.toLowerCase().replace(/[^a-z]/g, "")}")`;
      expect(
        cuerpo.includes(inventada),
        `${o.name} tiene ahora una orden de motor propia (${inventada}) pese a que el ` +
          `binario la rechaza en mazmorra (${o.destino}) — revisa la fidelidad antes que el deck`,
      ).toBe(false);
    }
  });

  it("«Chest» ya no rotula la (O)pen: el vocabulario del binario la llama Open", () => {
    // La segunda mitad del reporte («sale un Chest que no sé qué es»). El rótulo no salía
    // de ningún sitio: el kernel imprime «Open-» (DS 0xa1ce, handler 0x335C) antes de
    // bifurcar a la rama de mazmorra, y WORLD_BUTTONS ya rotula «Open» esa misma tecla.
    const abrir = DUNGEON_BUTTONS.find((b) => b.key === "o");
    expect(abrir, "el deck de mazmorra perdió la (O)pen").toBeDefined();
    expect(abrir!.label).toBe("Open");
    expect(DUNGEON_BUTTONS.some((b) => b.label === "Chest")).toBe(false);
    // Y conserva un title que explique lo que el rótulo ya no carga.
    expect(abrir!.title ?? "").toMatch(/chest/i);
  });

  it("los cinco que el usuario tenía bajo el pulgar siguen DELANTE y en su orden", () => {
    // Regla del 28-07 (escrita en WORLD_BUTTONS): los comandos nuevos se AÑADEN al final,
    // sin reordenar. «Chest»→«Open» es un cambio de RÓTULO, no de posición.
    expect(DUNGEON_BUTTONS.slice(0, 5).map((b) => b.key)).toEqual(["k", "s", "o", "d", "i"]);
    expect(DUNGEON_BUTTONS.length).toBeGreaterThan(5); // el censo AÑADIÓ, no sustituyó
  });
});

/**
 * LA CIFRA PUBLICADA, que es la tercera cara del mismo hecho. `/mejoras` publica una tabla
 * con el tamaño de las cuatro hojas del deck, EN LOS DOS IDIOMAS, y estaba escrita a mano:
 * cuando el censo de COMBATE la movió de 2 a 9 el 08-08 nadie tocó la tabla, y el sitio
 * llevaba ocho días publicando un 2. Este censo la habría vuelto a dejar rancia (5 → 18),
 * así que en vez de re-escribirla y confiar, la tabla pasa a tener PREDICADO: se deriva de
 * los arrays y se carea contra los dos espejos. Si alguien añade un botón, la cifra
 * publicada se pone roja aquí y no en producción.
 *
 * Los dos espejos van juntos a propósito: el sidecar inglés lleva el `source-sha1` del
 * castellano, así que tocar uno solo ya lo para el generador — pero eso sella
 * SIMULTANEIDAD, no la cifra. Esto sella la cifra.
 */
// Los DOS espejos de la tabla viven en `docs/mejoras/` y `docs/publicacion/web/`, que
// son proceso interno y NO viajan (whitelist del génesis). En el árbol público este
// bloque se salta con motivo; los otros 9 tests del fichero siguen corriendo allí.
describeSiViaja(
  ["docs/mejoras/3-experiencia.md", "docs/publicacion/web/mejoras-en/3-experiencia.md"],
  "la tabla de tamaños del deck publicada en /mejoras se deriva de los arrays",
  () => {
  const ESPERADO: [string, number][] = [
    ["WORLD_BUTTONS", WORLD_BUTTONS.length],
    ["UTIL_BUTTONS", UTIL_BUTTONS.length],
    ["DUNGEON_BUTTONS", DUNGEON_BUTTONS.length],
    ["COMBAT_BUTTONS", COMBAT_BUTTONS.length],
  ];
  const ESPEJOS = [
    join(RAIZ, "docs", "mejoras", "3-experiencia.md"),
    join(RAIZ, "docs", "publicacion", "web", "mejoras-en", "3-experiencia.md"),
  ];

  for (const ruta of ESPEJOS) {
    it(`${ruta.includes("mejoras-en") ? "EN" : "ES"}: las cuatro filas dicen el cardinal real`, () => {
      const md = readFileSync(ruta, "utf8");
      for (const [tabla, n] of ESPERADO) {
        // La fila es `| <rótulo> (`TABLA`) | <n> |`, con el cardinal opcionalmente en
        // negrita. Se localiza por el NOMBRE DEL ARRAY, que es lo que no cambia al
        // traducir — buscarla por el rótulo daría un falso negativo en inglés.
        const fila = md.match(new RegExp(`^\\|[^|]*\`${tabla}\`[^|]*\\|\\s*\\*{0,2}(\\d+)\\*{0,2}\\s*\\|`, "m"));
        expect(fila, `${ruta}: no hay fila para \`${tabla}\` (¿se renombró la tabla?)`).not.toBeNull();
        expect(
          Number(fila![1]),
          `${ruta} publica ${fila![1]} botones para ${tabla} y el array tiene ${n}: ` +
            `la cifra caducó. Actualiza LOS DOS espejos (y con ellos el source-sha1 del EN)`,
        ).toBe(n);
      }
    });
  }
  },
);

/**
 * Y EL CABLEADO, que es cosa distinta de la lista: que la rejilla CONMUTE a mazmorra y
 * que cada botón emita de verdad su tecla. Sin esto el fichero sellaría un array —
 * «existe la entrada» no es «el jugador puede pulsarla». Mismo patrón jsdom que
 * `combate-botonera.test.ts`.
 */
function stubBrowserGaps(): void {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: q.includes("coarse"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  if (!("ResizeObserver" in window)) {
    (window as unknown as Record<string, unknown>).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    globalThis.ResizeObserver = (window as unknown as { ResizeObserver: typeof ResizeObserver })
      .ResizeObserver;
  }
}

/** Monta el deck con el juego EN MAZMORRA y devuelve el contenedor de la rejilla. */
function deckEnMazmorra(): HTMLElement {
  stubBrowserGaps();
  document.body.innerHTML = "";
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  // `refresh()` sólo lee estos dos campos para elegir la rejilla (touch.ts:1348).
  const game = { combat: null, dungeonState: {} } as unknown as Game;
  const deck = new TouchControls(parent, game);
  deck.refresh();
  return parent;
}

/** Teclas que el deck emite en `window` durante `fn`. */
function teclasDurante(fn: () => void): string[] {
  const vistas: string[] = [];
  const on = (e: Event): void => void vistas.push((e as KeyboardEvent).key);
  window.addEventListener("keydown", on);
  try {
    fn();
  } finally {
    window.removeEventListener("keydown", on);
  }
  return vistas;
}

function tap(el: Element): void {
  el.dispatchEvent(new MouseEvent("pointerdown", { clientX: 10, clientY: 10, bubbles: true }));
  el.dispatchEvent(new MouseEvent("pointerup", { clientX: 10, clientY: 10, bubbles: true }));
}

describe("botonera de mazmorra — el CABLEADO, no sólo la lista", () => {
  it("en mazmorra la rejilla monta EXACTAMENTE los botones de DUNGEON_BUTTONS", () => {
    const parent = deckEnMazmorra();
    const montados = [...parent.querySelectorAll<HTMLElement>(".touch-cmd")].map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(montados).toEqual(DUNGEON_BUTTONS.map((b) => b.label));
  });

  it("cada botón de mazmorra EMITE su tecla al tocarlo (incluidos los trece nuevos)", () => {
    const parent = deckEnMazmorra();
    const botones = [...parent.querySelectorAll<HTMLElement>(".touch-cmd")];
    expect(botones).toHaveLength(DUNGEON_BUTTONS.length);
    botones.forEach((btn, i) => {
      const esperada = DUNGEON_BUTTONS[i]!.key;
      expect(
        teclasDurante(() => tap(btn)),
        `el botón «${DUNGEON_BUTTONS[i]!.label}» no emitió su tecla`,
      ).toEqual([esperada]);
    });
  });
});
