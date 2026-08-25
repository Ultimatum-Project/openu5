/**
 * Pickers de PJ (ui/pickers.ts) — TRAMO 2 del refactor estructural. Cubre por
 * UNIDAD el gate del "personaje del comando" (resolve_command_char 0x4995-0x49bc)
 * que antes era un closure de boot():
 *   · jugador ACTIVO puesto → directo, sin prompt (@0x49b2);
 *   · sin activo, ≤1 elegible (status G/P) → auto-único / 0 → nadie (@0x49fa);
 *   · ≥2 elegibles → prompt "Player: " (DS 0xa3c4) + nombre / None! al cancelar;
 *   · pickCastTarget: «On who: » + nombre / None! al cancelar (CAST2 0x9e);
 *   · pickSpellTyped: arma el getstring rúnico sobre el PromptManager.
 */
import { describe, it, expect } from "vitest";
import { createPickers, type Pickers } from "../src/ui/pickers.js";
import { PromptManager } from "../src/ui/prompt-manager.js";
import type { Game } from "../src/core/game.js";

function makeHarness(opts: {
  active?: number; // 0xff = sin activo
  statuses?: string[];
}) {
  const messages: string[] = [];
  const appends: string[] = [];
  const echoes: string[] = [];
  /** Fila de cursor del getstring (`:`), separada del eco — Cast y Mix la usan igual. */
  const cursors: string[] = [];
  const lasts: string[] = []; // reescrituras de la fila de eco viva (hud.echoSetLast)
  const prompts = new PromptManager({ hud: { echoSetLast: (t) => lasts.push(t) } });
  const statuses = opts.statuses ?? ["G", "G", "G"];
  const game = {
    state: {
      activeCharacter: opts.active ?? 0xff,
      partySize: statuses.length,
      characters: statuses.map((s, i) => ({ status: s, name: `PJ${i}` })),
    },
  } as unknown as Game;
  const pickers: Pickers = createPickers({
    game,
    hud: {
      message: (t) => messages.push(t),
      messageAppend: (t) => appends.push(t),
      echo: (t) => echoes.push(t),
      echoCursor: (t) => cursors.push(t),
    },
    view: { setSelectCursor: () => {} },
    prompts,
    refreshAwaiting: () => {},
  });
  return { pickers, prompts, messages, appends, echoes, cursors, lasts };
}

describe("pickCaster — gate del activo (kernel 0x4995-0x49bc)", () => {
  it("jugador ACTIVO puesto → directo, sin prompt", () => {
    const { pickers, prompts } = makeHarness({ active: 2 });
    let picked = -1;
    pickers.pickCaster((i) => (picked = i));
    expect(picked).toBe(2);
    expect(prompts.current).toBe(null);
  });

  it("sin activo y UN solo elegible (G/P) → auto-único sin preguntar", () => {
    const { pickers, prompts } = makeHarness({ statuses: ["S", "P", "D"] });
    let picked = -1;
    pickers.pickCaster((i) => (picked = i));
    expect(picked).toBe(1); // el único G/P
    expect(prompts.current).toBe(null);
  });

  // 🔴 Este caso decía «sin cb, SIN PROMPT» a secas y se leía como «sin salida ninguna»:
  // era el residuo (2) de `resolve-command-char-178c-acta.md`. Con 0 elegibles el binario
  // NO calla — cae por el mismo epílogo que la cancelación e imprime «None!»:
  //   4990: c746f8ffff  mov word ptr [bp - 8], 0xffff   ; init del resultado
  //   49dc-49f2         bucle: sólo escribe [bp-8] si el estado es 'G' (0x47) o 'P' (0x50)
  //   49fa: 837efa01    cmp word ptr [bp - 6], 1        ; nº de elegibles
  //   49fe: 7e5f        jle 0x4a5f                      ; ⇒ epílogo, saltando el prompt
  //   4a5f: 837ef8ff    cmp word ptr [bp - 8], -1
  //   4a65: b8daa3      mov ax, 0xa3da                  ; DATA.OVL fileoff 0xa3ea:
  //   4a69: e8e4cd      call 0x1850                     ;   b'None!\n\x00'
  // El esperado va EN CRUDO (volcado de DATA.OVL, no importado del port).
  it("sin activo y CERO elegibles → «None!» (DS 0xa3da) y nadie lanza", () => {
    const { pickers, prompts, messages, appends } = makeHarness({ statuses: ["S", "D"] });
    let picked = -1;
    pickers.pickCaster((i) => (picked = i));
    expect(picked).toBe(-1);
    expect(prompts.current).toBe(null); // la vía de @0x4a02 no se toca: no se pregunta
    expect(messages).toEqual(["None!"]); // fila PROPIA: nada se imprimió antes
    expect(appends).toEqual([]);
  });

  // 🔴 Este caso decía «≥2 elegibles → prompt 'Cast & who?'» y era el aserto que
  // fijaba la cadena FABRICADA. La vía que pregunta del binario (0x4a00-0x4a57) tiene
  // UN print de prompt, `4a02 mov ax,0xa3c4` → DS 0xa3c4 = "Player: " (volcado de
  // DATA.OVL, fileoff=DS+0x10, b'Player: \x00'), y "who?" tiene 0 hits en DATA.OVL.
  // Esperados EN CRUDO abajo, copiados del corpus OCR del ORIGINAL (routes/): la
  // fila «Cast... Player: Min Spell name:» sale 70 veces y «Cast & who?» ninguna.
  it("≥2 elegibles → prompt 'Player: ' (DS 0xa3c4), NO 'Cast & who?'", () => {
    const { pickers, prompts, messages } = makeHarness({ statuses: ["G", "G"] });
    pickers.pickCaster(() => {});
    expect(messages).toEqual(["Player: "]); // crudo: DS 0xa3c4, y NADA más
    expect(prompts.current?.type).toBe("party-select");
  });

  it("≥2 elegibles: elegir APENDA el nombre en la misma fila (@0x4a30-0x4a3a)", () => {
    const { pickers, prompts, messages, appends } = makeHarness({ statuses: ["G", "G"] });
    let picked = -1;
    pickers.pickCaster((i) => (picked = i));
    (prompts.current as { onKey: (k: string) => void }).onKey("2"); // 1-N elige directo
    expect(picked).toBe(1);
    // La fila del original queda «Player: PJ1» (corpus: «Cast... Player: Min Spell name:»).
    expect(messages.join("") + appends.join("")).toBe("Player: PJ1");
  });

  it("≥2 elegibles: cancelar (ESC) imprime 'None!' (DS 0xa3da, epílogo @0x4a5f/0x4a65)", () => {
    const { pickers, prompts, messages, appends } = makeHarness({ statuses: ["G", "G"] });
    let picked = -1;
    pickers.pickCaster((i) => (picked = i));
    (prompts.current as { onKey: (k: string) => void }).onKey("Escape");
    expect(picked).toBe(-1); // <0 ⇒ CAST 0x0ddf aborta el comando
    // Crudo del corpus: «Cast... Player: None!» (part09-g11 ocrLn 1210, part13-g03 298).
    expect(messages.join("") + appends.join("")).toBe("Player: None!");
  });

  // Residuo (3) del acta: el BUCLE DE RE-PREGUNTA. El picker del roster (kernel 0x2d7a)
  // deja elegir a CUALQUIER miembro, elegible o no; el filtro está DESPUÉS, en el
  // llamador, y no aborta: reimprime el prompt.
  //   4a00: 2bff        sub di, di                       ; di = 0 (el «ya terminé»)
  //   4a1e: 80bfb35547  cmp byte ptr [bx + 0x55b3], 0x47 ; 'G'
  //   4a29: 80bfb35550  cmp byte ptr [bx + 0x55b3], 0x50 ; 'P'
  //   4a2e: 751e        jne 0x4a4e                       ; ni una ni otra ⇒
  //   4a4e: b8cea3      mov ax, 0xa3ce                   ;   DATA.OVL fileoff 0xa3de:
  //   4a52: e8fbcd      call 0x1850                      ;   b'Disabled!\n\n\x00'
  //   4a55: 0bff        or di, di                        ; sigue 0 (nadie lo tocó)
  //   4a57: 74a9        je 0x4a02                        ; ⇒ «Player: » OTRA VEZ
  // Discriminante contra el port «razonable»: NO cancela y NO ecoa el nombre del
  // inhabilitado (el `jne` de @0x4a2e salta por delante del print de @0x4a30).
  it("elegir a un NO elegible → «Disabled!» (DS 0xa3ce) y RE-PREGUNTA (@0x4a55/0x4a57)", () => {
    const { pickers, prompts, messages, appends } = makeHarness({ statuses: ["G", "G", "D"] });
    let picked = -1;
    pickers.pickCaster((i) => (picked = i));
    const key = (k: string) => (prompts.current as { onKey: (k: string) => void }).onKey(k);
    key("3"); // el 'D': ni 'G' ni 'P'
    expect(picked).toBe(-1); // NO resuelve: el comando sigue esperando
    expect(appends).toEqual(["Disabled!"]); // y NO el nombre "PJ2"
    expect(messages).toEqual(["Player: ", "Player: "]); // el prompt, DOS veces
    expect(prompts.current?.type).toBe("party-select"); // sigue preguntando
    key("1"); // ahora uno bueno
    expect(picked).toBe(0);
    expect(appends).toEqual(["Disabled!", "PJ0"]);
    expect(messages).toEqual(["Player: ", "Player: "]); // y ya no vuelve a preguntar
  });

  it("el bucle admite VARIAS vueltas y sigue saliendo por ESC → «None!»", () => {
    const { pickers, prompts, messages, appends } = makeHarness({ statuses: ["G", "G", "D", "S"] });
    let picked = -1;
    pickers.pickCaster((i) => (picked = i));
    const key = (k: string) => (prompts.current as { onKey: (k: string) => void }).onKey(k);
    key("3"); // 'D'
    key("4"); // 'S' — dormido tampoco es 'G'/'P'
    expect(appends).toEqual(["Disabled!", "Disabled!"]);
    expect(messages).toEqual(["Player: ", "Player: ", "Player: "]);
    key("Escape"); // @0x4a12 pone di=1 ⇒ @0x4a57 NO reengancha; epílogo con si<0
    expect(picked).toBe(-1);
    expect(appends[appends.length - 1]).toBe("None!");
    expect(prompts.current).toBe(null);
  });

  // CASO CONTRARIO de los dos arreglos: donde ya era correcto, sigue igual. Un elegible
  // 'P' (envenenado) es TAN elegible como un 'G' — los dos valores están en el mismo
  // par de `cmp` (@0x4a1e/@0x4a29 y @0x49dc/@0x49e1) — así que ni dispara «Disabled!»
  // ni cuenta como cero elegibles.
  it("elegir a un 'P' NO imprime «Disabled!»: 0x50 pasa el mismo cmp que 0x47", () => {
    const { pickers, prompts, messages, appends } = makeHarness({ statuses: ["G", "P"] });
    let picked = -1;
    pickers.pickCaster((i) => (picked = i));
    (prompts.current as { onKey: (k: string) => void }).onKey("2");
    expect(picked).toBe(1);
    expect(appends).toEqual(["PJ1"]);
    expect(messages).toEqual(["Player: "]);
  });
});

describe("pickCommandChar — mismo gate con 'Player: ' + nombre", () => {
  it("≥2 elegibles: elegir por picker APENDA el nombre en la misma fila", () => {
    const { pickers, prompts, appends } = makeHarness({ statuses: ["G", "G"] });
    let picked = -1;
    pickers.pickCommandChar((i) => (picked = i));
    expect(prompts.current?.type).toBe("party-select");
    // Confirmar el cursor (Enter) elige el 0.
    pickers; // (el reductor real del party-select vive en core; lo conducimos por el prompt)
    (prompts.current as { onKey: (k: string) => void }).onKey("Enter");
    expect(picked).toBe(0);
    expect(appends).toEqual(["PJ0"]); // «Player: PJ0» en la misma fila
  });
});

describe("pickCastTarget — «On who: » (CAST2 0x9e)", () => {
  it("elegido → nombre apendado; cancelar (ESC) → None!", () => {
    const { pickers, prompts, appends } = makeHarness({ statuses: ["G", "G"] });
    let picked = -1;
    pickers.pickCastTarget((i) => (picked = i));
    (prompts.current as { onKey: (k: string) => void }).onKey("2"); // 1-N directo
    expect(picked).toBe(1);
    expect(appends).toEqual(["PJ1"]);
    // Cancelación:
    pickers.pickCastTarget(() => {});
    (prompts.current as { onKey: (k: string) => void }).onKey("Escape");
    expect(appends[appends.length - 1]).toBe("None!"); // DS 0x94fe (t() en 'en' = identidad)
  });
});

describe("pickSpellTyped — getstring rúnico (CAST2 0x00de)", () => {
  // #107 — el prompt son DOS filas, no una. El binario imprime la cadena ENTERA
  // `"Spell name:\n:"` (DATA.OVL DS 0x4603; el de Mix es DS 0x8fac, "For what spell?\n:"):
  // el `\n` abre fila y el `:` es el cursor del getstring, donde se ecoa lo TECLEADO.
  // Mismo modelo ya cableado en (Y)ell y en Talk (TALK_UI.cursor).
  it("parte el prompt en DOS filas: etiqueta + fila del cursor ':' (DS 0x4603)", () => {
    const { pickers, prompts, echoes, cursors } = makeHarness({});
    pickers.pickSpellTyped("Spell name: ", () => {});
    // Careo #341 (único testigo de vídeo: Lord Fenton, 5 casts en lf29/lf30/lf31): la
    // etiqueta la imprime print_string (kernel 0x1850), no el eco del despachador — fila
    // PLANA sin bullet ► y sin abrir grupo. En vídeo «Cast... / Spell name: / :VAS REL
    // POR» son consecutivos. Por eso las DOS filas van por `echoCursor` (cont) y el canal
    // `echo` (con bullet) queda VACÍO.
    expect(echoes).toEqual([]); // el ► marca sólo el eco del comando ("Cast...")
    expect(cursors).toEqual(["Spell name:", ":"]); // etiqueta sin relleno + cursor del getstring
    expect(prompts.current?.type).toBe("rune");
    expect((prompts.current as { max: number }).max).toBe(4);
  });

  it("el eco de las sílabas cae en la fila del CURSOR, no pegado a la etiqueta", () => {
    const { pickers, prompts, lasts } = makeHarness({});
    pickers.pickSpellTyped("Spell name: ", () => {});
    // El prompt "rune" lo conduce el PromptManager por keydown (no lleva onKey propio).
    const press = (key: string) =>
      prompts.handleKey({ key, preventDefault: () => {} } as unknown as KeyboardEvent);
    press("i");
    press("l");
    // ":IN LOR", no "Spell name: IN LOR": el prefijo de eco es el cursor.
    expect(lasts[lasts.length - 1]).toBe(":IN LOR");
  });

  // ⚠ RE-ANCLADO en el merge de `skin/mix-flow-fidel` (01-08). La rama traía este mismo
  // caso con un 3er argumento `question` y la pregunta por `hud.message` (SIN bullet).
  // Main había implementado entretanto el MISMO arreglo de forma genérica (#107) y para
  // los DOS comandos, con la pregunta por `hud.echo` (CON bullet). ~~Se adjudica a favor
  // de main POR CONTENIDO, no por precedencia: el patrón `…?\n:` ya cableado y con
  // testigo del usuario es el de (Y)ell (`main.ts` ~1693), que emite `hud.echo` +
  // `echoCursor`.~~ RE-ADJUDICADO por el careo #341 (23-08): la analogía con Yell no
  // aplica al bullet — en Yell «Yell what?» ES la fila del eco del comando (el
  // despachador ecoa "Yell " DS 0xa286 y el handler APENDA "what?" en esa misma fila:
  // el ► es fiel ahí), mientras que «Spell name:»/«For what spell?» abren fila NUEVA
  // por print_string (DS 0x4603/0x8fac, kernel 0x1850) tras el "Cast...\n"/"Mix\n" del
  // eco — fila plana. El único testigo de vídeo de los tres corpus (Lord Fenton, 5
  // casts en lf29/lf30/lf31) lo muestra: «Spell name:» sin ► y sin blanco delante. La
  // rama de mix-flow-fidel tenía razón en el detalle del bullet (aunque por `message`;
  // la forma que conserva el eco-vivo del getstring es `echoCursor`).
  it("Mix usa el MISMO modelo de dos filas (DS 0x8fac)", () => {
    const { pickers, prompts, echoes, cursors } = makeHarness({});
    pickers.pickSpellTyped("For what spell? ", () => {});
    expect(echoes).toEqual([]); // sin bullet: la etiqueta no es eco de comando
    expect(cursors).toEqual(["For what spell?", ":"]);
    expect((prompts.current as { prefix: string }).prefix, "el eco de sílabas se reescribe sobre el ':'").toBe(":");
  });
});
