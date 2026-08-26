/**
 * CAREO VISUAL — captura del PORT compas a compas (metodo estrenado en ch01).
 *
 * Conduce la piel FIEL por la lista de compases derivada del video de referencia
 * (`compases-lf01.json`) y vuelca, tras cada compas, el canvas LOGICO 320x200 SIN
 * escalar — la misma resolucion nativa a la que se reduce el fotograma del video,
 * para que el par sea comparable pixel a pixel sin reescalar ninguno de los dos.
 *
 * Reutiliza el patron ya sancionado de `tools/pixeldiff/capture-port.pw.ts`
 * (`.faithful-skin canvas` + `toDataURL`), que es el unico sitio del repo que
 * fotografia el bufer nativo: `querySelector("canvas")` devuelve un ornamento 8x8
 * (src/ui/screenshot.ts).
 *
 * CONTROL POSITIVO (obligatorio, encargo). DOS siembras, y la diferencia entre ellas
 * es justo lo que hay que medir:
 *   · CAREO_SIEMBRA=cofre — siembra un COFRE (tile 0x40, kind "chest") DOS casillas al este
 *     del avatar con `__u5test.addWorldObject`, el mismo gesto de `e2e/objects.spec.ts`
 *     sobre esta misma location 13. Es divergencia VISUAL PURA: aparece un sprite en el
 *     viewport y NO se escribe ni una linea de consola. Si la hoja no la caza, la hoja
 *     NO VE — que es exactamente lo que este careo existe para descartar. MEDIDO: 1 celda
 *     de viewport (~220 px) mas los 5 apliques 0xb0/0xb1/0xbf, que son tiles ANIMADOS.
 *   · 🔴 CAREO_SIEMBRA=cofre-muro — el MISMO cofre en (-3,-3), que era el DEFECTO hasta el
 *     25-08 y NO es una divergencia visual pura: (-3,-3) desde el arranque (15,15) cae en
 *     (12,12), que es una casilla del PROPIO MURO de la choza. La capa de objetos TAPA el
 *     tile base (`Game.activeMap.tileAt`), asi que sembrar ahi BORRA EL MURO — abre un
 *     agujero por el que sale el flood de LOS y, de dia (luz 0x32, que cubre toda la tabla
 *     radial), enciende las 52 casillas negras del exterior de golpe. De ahi salio la ficha
 *     F4 («el port pinta hierba donde el original pinta negro»), REFUTADA el 25-08: el port
 *     sin sembrar pinta el MISMO anillo negro que el original. La mecanica queda fijada en
 *     `game/tests/careo-f4-cofre-sobre-muro.test.ts`. Se conserva por eso, con su nombre.
 *   · CAREO_SIEMBRA=xshift — arranca una casilla a la derecha. NO sirve como control del
 *     canal visual: MEDIDO, tambien cambia el texto (aparecen «Blocked!» que el original
 *     no tiene), asi que la caza el espejo de consola que ya teniamos y no prueba nada
 *     nuevo. Se conserva como contraste declarado.
 *
 * Uso (desde game/, REGLA 3: puerto propio 52xx, NUNCA el 5199 del usuario):
 *   CAREO_PORT=5243 npx playwright test -c tools/careo-visual/captura.config.ts
 *   CAREO_PORT=5243 CAREO_SIEMBRA=xshift CAREO_OUT=<dir> npx playwright test -c …
 *
 * Variables (todas opcionales; sin ninguna, la conducta es la del ch01): CAREO_GUION,
 * CAREO_ENTRADA, CAREO_TIMEOUT, CAREO_SIEMBRA_TRAS, CAREO_CORRECCIONES. Cada una lleva su
 * docblock donde se lee, y la tabla con el porqué está en README.md.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.CAREO_OUT ?? path.join(HERE, "_out");
const SIEMBRA = process.env.CAREO_SIEMBRA ?? "";
/**
 * `CAREO_GUION` — ruta del guion. El ch01 lo llevaba CABLEADO a `compases-lf01.json`, y
 * eso hacía que un segundo episodio no se pudiera conducir sin editar el arnés. El
 * default sigue siendo el del ch01, así que la invocación vieja no cambia de conducta.
 * `CAREO_ENTRADA` — cola del deep-link DEV que fija el ESTADO DE ENTRADA declarado
 * (p.ej. `&loc=0&x=81&y=106&hour=9`: la casilla de overworld de Britain, para que el
 * `(E)nter towne` del primer compás lo resuelva el propio port como el binario).
 */
const GUION_PATH = process.env.CAREO_GUION ?? path.join(HERE, "compases-lf01.json");
const ENTRADA = process.env.CAREO_ENTRADA ?? "";

interface Paso {
  id: string;
  keys: string[];
  eco?: string;
  nota?: string;
  video_t?: number;
  clase?: string;
  regimen?: string;
  esperado?: string[];
}
/**
 * 🔴 ARTEFACTO A12 del registro (`re/notes/careo-artefactos-conocidos.md`): este
 * `readFileSync` corre **AL COLECTAR**, y `compases-lf01.json` está gitignored a propósito
 * (lleva la prosa de consola de EA verbatim) con su copia canónica FUERA del repo. En todo
 * worktree fresco el careo visual moría con un ENOENT crudo antes de ejecutar un solo test
 * — que no se lee como «falta un fichero» sino como que el arnés está roto. El fichero no
 * puede entrar en el índice (publicaría prosa de EA), así que lo que se arregla es el
 * MENSAJE: que nombre el fichero, la causa y la línea de CLAUDE.md que lo resuelve.
 *
 * 🔴 RESOLUCIÓN DE CONFLICTO (26-08, el lead componiendo #171 con #172). Las dos ramas
 * reescribieron esta lectura y el conflicto era SEMÁNTICO: #172 traía este mensaje pero con
 * el nombre del guion CABLEADO, y #171 traía `CAREO_GUION` —sin la cual no se puede conducir
 * un segundo episodio sin editar el arnés, que es justo lo que el ch02 necesitó—. Fundir a
 * favor de #172 habría devuelto el cableado EN SILENCIO. Se conservan las dos: el mensaje
 * bueno sobre `GUION_PATH`, y por eso el error imprime la ruta EFECTIVA y no una fija, que
 * si no mandaría a copiar el fichero equivocado a quien use otro guion.
 */
function leeGuion(): { pasos: Paso[] } {
  try {
    return JSON.parse(readFileSync(GUION_PATH, "utf-8")) as { pasos: Paso[] };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    throw new Error(
      `CAREO VISUAL — falta el guion de compases: ${GUION_PATH}\n` +
        "NO es un arnés roto: los guiones están GITIGNORED a propósito (llevan prosa de\n" +
        "consola de EA verbatim) y su copia canónica vive FUERA del repo. Cópiala —es la\n" +
        "última línea del bloque de symlinks de CLAUDE.md REGLA 2—:\n" +
        "  cp -a ~/PROYECTS/OpenU5-videos/careo-visual/<cap>/herramienta/<guion>.json \\\n" +
        "        game/tools/careo-visual/\n" +
        "NO lo metas en el índice para «arreglarlo»: publicaría prosa de EA.",
    );
  }
}
const GUION = leeGuion();

/**
 * `CAREO_CORRECCIONES` — lista de correcciones de POSICIÓN medidas contra el vídeo en una
 * pasada anterior (`desfase.py` → `correcciones.py`), a aplicar TRAS el compás que nombran.
 *
 * Por qué existe: un solo paso que el port bloquea y el original no (o al revés) desfasa la
 * posición para siempre, y de ahí en adelante el careo compara dos sitios distintos y no
 * mide nada. Medido en el ch02: la fase se perdía en el compás 50 de 1072 y el desfase era
 * de UNA casilla en x, sostenido durante los ~16 compases siguientes.
 *
 * 🔴 Es un ARNÉS DE ESTADO DECLARADO, no un arreglo: cada corrección viaja en la fila de la
 * hoja con su magnitud, y la captura que se carea es SIEMPRE la de ANTES de aplicarla — si
 * no, la corrección taparía justo la divergencia que la motivó.
 */
interface Correccion { id: string; ddx: number; ddy: number }
const CORR: Map<string, Correccion> = new Map(
  (process.env.CAREO_CORRECCIONES
    ? (JSON.parse(readFileSync(process.env.CAREO_CORRECCIONES, "utf-8")) as {
        correcciones: Correccion[];
      }).correcciones
    : []
  ).map((c) => [c.id, c]),
);

async function faithfulCanvas(page: Page): Promise<Locator> {
  const canvas = page.locator(".faithful-skin canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("width", "320");
  await expect(canvas).toHaveAttribute("height", "200");
  return canvas;
}

async function dump(canvas: Locator, file: string): Promise<void> {
  const dataUrl = await canvas.evaluate((el) =>
    (el as HTMLCanvasElement).toDataURL("image/png"),
  );
  await fs.writeFile(
    file,
    Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"),
  );
}

/**
 * Posición del port compás a compás. Sirve para DOS cosas y las dos hacen falta:
 * (a) el control positivo puede exigir que la casilla cazada sea EXACTAMENTE la del cofre
 *     sembrado (mapa fijo, viewport centrado en el avatar), en vez de conformarse con
 *     «hay diferencia» — que a 1-6 casillas no se separa del ruido de PNJ del propio port;
 * (b) el lead ve el DESFASE de posición sin re-derivarlo del par.
 */
async function posicion(page: Page): Promise<Record<string, number> | null> {
  return page.evaluate(() => {
    const h = (window as unknown as Record<string, unknown>).__u5test as
      | { game?: { state?: { position?: Record<string, number> } } }
      | undefined;
    const p = h?.game?.state?.position;
    return p ? { location: p.location as number, floor: p.floor as number, x: p.x as number, y: p.y as number } : null;
  });
}

async function consola(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const h = (window as unknown as Record<string, unknown>).__u5test as
      | { consoleLines?: () => string[] }
      | undefined;
    return h?.consoleLines?.() ?? [];
  });
}

test("careo visual — captura del port por compases (guion en CAREO_GUION)", async ({ page }) => {
  await fs.mkdir(OUT, { recursive: true });
  await page.addInitScript(() => localStorage.clear());

  // La siembra del control positivo desplaza UNA CASILLA el arranque (deep-link DEV).
  // Iolo's Hut = loc 13; la plantilla INIT deja al avatar en (15,15) de ese mapa.
  const extra = SIEMBRA === "xshift" ? "&loc=13&x=16&y=15" : ENTRADA;
  await page.goto(`/?skin=faithful&nointro&seed=1&fresh=1${extra}`);
  const canvas = await faithfulCanvas(page);
  await page.waitForTimeout(700);

  /**
   * `CAREO_SIEMBRA_TRAS=<id>` — siembra el control positivo DESPUÉS de ese compás, no al
   * arrancar. Hace falta desde el ch02: allí el guion empieza en la casilla de overworld
   * de Britain y el primer compás es el `(E)nter towne`, así que un cofre sembrado antes
   * se queda FUERA del mapa que se carea. Sin esto el control positivo del ch02 sería
   * un control de otra pantalla.
   */
  const SIEMBRA_TRAS = process.env.CAREO_SIEMBRA_TRAS ?? "";

  /**
   * 🔴 EL MUTANTE DE LA GUARDA, para que se la pueda ver ENROJECER (una guarda que nadie ha
   * visto disparar no es una guarda): `CAREO_MUTANTE=siembra-en-muro` reintroduce el
   * desplazamiento histórico (−3,−3) BAJO LA ETIQUETA `cofre`, que NO está exenta ⇒ la guarda
   * tiene que parar la corrida con su mensaje. Es el gesto que habría evitado la ficha F4
   * entera. Se ejecuta a mano; el rojo es el resultado esperado.
   */
  const EN_MURO = process.env.CAREO_MUTANTE === "siembra-en-muro";

  /**
   * 🔴 RESOLUCIÓN DE CONFLICTO (26-08, el lead componiendo #171 con #172), y el resultado es
   * MEJOR que cualquiera de los dos lados: #172 traía la guarda de opacidad pero cableada al
   * único punto de siembra que existía entonces, y #171 traía la siembra DIFERIDA
   * (`CAREO_SIEMBRA_TRAS`), que el ch02 necesita. Fundir a favor de #172 habría perdido la
   * siembra diferida; a favor de #171, la guarda. Se conservan las dos y la guarda se mete
   * DENTRO de `sembrarCofre`, así que ahora cubre AMBOS modos — en #172 sólo cubría el
   * inmediato, y la siembra diferida del ch02 habría quedado sin proteger.
   */
  async function sembrarCofre(off: [number, number]): Promise<void> {
    // LA GUARDA DE LA FICHA F4 (artefacto A3 del registro). Se ejerce ANTES de sembrar, sobre
    // el tile de destino REAL, y lee `ALWAYS_OPAQUE` DEL MÓDULO en vivo — una lista copiada
    // aquí divergiría de `visibility.ts` sin que nadie lo note. `cofre-muro` está EXENTA a
    // propósito: es la repro conservada del defecto, y su trabajo es caer ahí.
    if (SIEMBRA !== "cofre-muro") {
      const destino = await page.evaluate(
        async (o: [number, number]) => {
          const w = window as unknown as {
            __u5test: {
              game: {
                activeMap: { tileAt: (x: number, y: number) => number };
                state: { position: { x: number; y: number } };
              };
            };
          };
          const p = w.__u5test.game.state.position;
          const t = w.__u5test.game.activeMap.tileAt(p.x + o[0], p.y + o[1]) & 0xff;
          // 🔴 El especificador va en una CONST: escrito como literal, `tsconfig.tools.json`
          // intenta resolverlo como módulo TS y da TS2307 por una ruta que sólo existe en
          // tiempo de ejecución (la URL de vite; este cuerpo corre en el NAVEGADOR).
          const RUTA = "/src/core/world/visibility.ts";
          const mod = (await import(RUTA)) as { ALWAYS_OPAQUE: Set<number> };
          return { tile: t, opaco: mod.ALWAYS_OPAQUE.has(t) };
        },
        off,
      );
      expect(
        destino.opaco,
        `SIEMBRA INVÁLIDA en (${off.join(",")}): el tile destino ` +
          `0x${destino.tile.toString(16)} es OPACO. La capa de objetos del port TAPA el tile ` +
          "base, así que sembrar ahí BORRARÍA EL MURO y abriría un agujero de LOS: la " +
          "diferencia medida sería del ARNÉS, no del port. Es la ficha F4, refutada el 25-08 " +
          "(re/notes/careo-artefactos-conocidos.md §A3).",
      ).toBe(false);
    }

    // Divergencia VISUAL PURA: un sprite mas en el viewport, cero lineas de consola.
    await page.evaluate((arg: { off: [number, number] }) => {
      const w = window as unknown as {
        __u5test: {
          game: { state: { position: { location: number; floor: number; x: number; y: number } } };
          addWorldObject: (o: unknown) => void;
        };
      };
      const p = w.__u5test.game.state.position;
      const [dx, dy] = arg.off;
      w.__u5test.addWorldObject({
        location: p.location, floor: p.floor, x: p.x + dx, y: p.y + dy,
        tile: 0x40, kind: "chest", contents: 0x63, trapped: false,
      });
    }, { off });
    await page.waitForTimeout(250);
  }

  // Siembra INMEDIATA (modo ch01: el guion arranca ya dentro del mapa que se carea).
  // El tipo va en una const con tupla EXPLÍCITA: escrito en la llamada, `[2, 0]` se
  // infiere como `number[]` y el overload de `page.evaluate` no casa con el parámetro.
  // 🔴 RESOLUCIÓN DE CONFLICTO (26-08, el lead componiendo #165 con #171). Las dos ramas
  // tocaron esta línea y **el conflicto era SEMÁNTICO**: tomar cualquiera de los dos lados
  // entero perdía algo real.
  //   · De #171 se conserva el refactor a función y `CAREO_SIEMBRA_TRAS`, que el ch02
  //     NECESITA (su guion arranca en la casilla de sobremundo de Britain, así que un cofre
  //     sembrado antes del `(E)nter towne` cae fuera del mapa que se carea: sería un control
  //     positivo de OTRA pantalla).
  //   · De #165 se conserva el DEFECTO (+2,0). La rama de #171 salió de main antes de ese
  //     tren y traía el defecto viejo `(-3,-3)`, que cae sobre el MURO de la choza: la capa
  //     de objetos lo BORRA, el flood sale y enciende la ventana entera. Ése fue el origen
  //     de la falsa F4, y como control positivo está DEGRADADO — mide un mecanismo que no
  //     existe jugando. Fundir a favor de #171 lo habría reinstaurado EN SILENCIO.
  // `cofre-muro` conserva el caso del muro bajo su propio nombre; `cofre-dentro` es alias
  // del defecto para no romper los encargos que ya lo nombran.
  // `|| EN_MURO`: el mutante de la guarda (`CAREO_MUTANTE=siembra-en-muro`) entra POR AQUÍ.
  // 🔴 Al resolver el conflicto anterior lo perdí un momento — `EN_MURO` quedó declarada y sin
  // usar, o sea el mutante MUERTO y la guarda sin forma de vérsela disparar. Lo cazó releer
  // los usos, no el compilador. Es la misma clase de pérdida silenciosa que estas dos ramas
  // se hacían la una a la otra.
  const DESPLAZAMIENTO: [number, number] =
    SIEMBRA === "cofre-muro" || EN_MURO ? [-3, -3] : [2, 0];
  if (SIEMBRA.startsWith("cofre") && !SIEMBRA_TRAS) {
    await sembrarCofre(DESPLAZAMIENTO);
  }

  const filas: Array<Record<string, unknown>> = [];
  let saltados = 0;
  let resyncs = 0;
  let resyncsMov = 0;
  let correcciones = 0;
  for (const paso of GUION.pasos) {
    // ── GUARDA 1: no teclear una palabra si el port NO está en diálogo ──────────────
    // 🔴 Medido en la primera corrida del ch02: si el (T)alk del port no encuentra PNJ
    // ("Funny, no response!"), las letras de la palabra siguiente entran como COMANDOS
    // — la `U` de "JUB"/"ALIVE" abre (U)se item, el prompt "Item:" se queda colgado y
    // TODO lo que viene detrás se pierde. Cayeron 1000 compases de una tacada y el log
    // no decía nada raro: cada línea traía su `ultima="Item: "` como si fuera normal.
    const enDialogo = /interest\?|\?$/i.test((await consola(page)).at(-1) ?? "");
    const esPalabra = paso.keys.length > 1 && paso.keys.at(-1) === "Enter";
    let saltado: string | null = null;
    if (esPalabra && !enDialogo) {
      saltado = "el port no esta en dialogo: teclear la palabra la ejecutaria como comandos";
      saltados++;
    } else {
      for (const k of paso.keys) {
        await page.keyboard.press(k);
        await page.waitForTimeout(180);
      }
    }
    await page.waitForTimeout(320); // asentado
    // ── GUARDA 2: prompt colgado ⇒ Escape ────────────────────────────────────────────
    // Un prompt sin consumir ("Player: ", "Item: ", "Spell name:") se come TODAS las
    // teclas siguientes. Se limpia y se DECLARA en la fila; no se esconde.
    // 🔴 El predicado NO es «acaba en dos puntos»: el port deja colgado tambien
    // «Dost thou wish to leave? » al pisar el borde de un pueblo, y con esa version se
    // comio los ~90 ultimos compases de la corrida del ch02. Lo que distingue un PROMPT
    // de un mensaje normal es el ESPACIO FINAL (el hueco del cursor), no el signo.
    let resync = 0;
    while (resync < 2 && /[:?]\s$/.test((await consola(page)).at(-1) ?? "")) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      resync++;
    }
    if (resync) resyncs++;
    const png = path.join(OUT, `${paso.id}.png`);
    await dump(canvas, png);
    const lineas = await consola(page);
    filas.push({
      id: paso.id,
      keys: paso.keys,
      eco_esperado: paso.eco ?? null,
      video_t: paso.video_t ?? null,
      clase: paso.clase ?? null,
      regimen: paso.regimen ?? null,
      png: path.basename(png),
      pos: await posicion(page),
      consola: lineas.slice(-8),
      saltado,
      resync,
    });
    // ── RESYNC DE MOVIMIENTO (declarado, y SIEMPRE despues de la captura) ───────────
    // Un solo paso que el port bloquea y el original NO (o al reves) desfasa la posicion
    // para SIEMPRE, y a partir de ahi el careo compara dos sitios distintos: en la prueba
    // de 90 compases el par pasaba de ~12 casillas distintas a ~97 en UN compas, y las
    // 1000 filas de detras dejaban de medir nada.
    // El arnés adelanta (o retrocede) UNA casilla y lo DECLARA en la fila — misma clase
    // que el `vehiculo.aplicado` del espejo: estado puesto a mano, con su reparo escrito.
    // 🔴 Va DESPUES del `dump`: la captura que se carea es la del port SIN corregir, o el
    // resync taparia justo la divergencia que lo motivo.
    let resyncMov: string | null = null;
    const DIRS: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    };
    const soloFlecha = paso.keys.length === 1 && paso.keys[0] !== undefined && paso.keys[0] in DIRS;
    if (soloFlecha && !saltado) {
      const ult = lineas.at(-1) ?? "";
      const vidTexto = (paso.esperado ?? []).join(" ");
      const portFallo = /Blocked!|Slow progress!|Very slow!/i.test(ult);
      const vidFallo = /Blocked!|Slow progress!|Very slow!/i.test(vidTexto);
      const dir = DIRS[paso.keys[0] as string] as [number, number];
      if (portFallo && !vidFallo) resyncMov = "adelanta";
      else if (!portFallo && vidFallo) resyncMov = "retrocede";
      if (resyncMov) {
        const signo = resyncMov === "adelanta" ? 1 : -1;
        await page.evaluate(
          (arg: { d: [number, number]; s: number }) => {
            const w = window as unknown as {
              __u5test: { game: { state: { position: { x: number; y: number } } } };
            };
            const p = w.__u5test.game.state.position;
            p.x += arg.d[0] * arg.s;
            p.y += arg.d[1] * arg.s;
          },
          { d: dir, s: signo },
        );
        resyncsMov++;
      }
    }
    (filas.at(-1) as Record<string, unknown>).resync_mov = resyncMov;
    const cor = CORR.get(paso.id);
    if (cor) {
      // El desfase medido es (video -> port): P = V + d. Para seguir al video se RESTA.
      await page.evaluate(
        (arg: { dx: number; dy: number }) => {
          const w = window as unknown as {
            __u5test: { game: { state: { position: { x: number; y: number } } } };
          };
          const p = w.__u5test.game.state.position;
          p.x -= arg.dx;
          p.y -= arg.dy;
        },
        { dx: cor.ddx, dy: cor.ddy },
      );
      correcciones++;
      (filas.at(-1) as Record<string, unknown>).correccion = [-cor.ddx, -cor.ddy];
    }
    if (SIEMBRA_TRAS && paso.id === SIEMBRA_TRAS) {
      // Misma fuente que la siembra inmediata: el literal `[2, 0]` estaba escrito aquí a mano
      // y en la otra rama había una const con el mismo valor. Dos fuentes para un valor es una
      // divergencia esperando a ocurrir — y aquí en concreto habría dejado `cofre-muro` sin
      // efecto en el modo diferido, en silencio y sin fallar.
      await sembrarCofre(DESPLAZAMIENTO);
      // eslint-disable-next-line no-console
      console.log(`  >>> COFRE sembrado tras ${paso.id} (control positivo)`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `  ${paso.id}  keys=[${paso.keys.join(",")}]${saltado ? " SALTADO" : ""}` +
        `${resync ? ` RESYNC${resync}` : ""}${resyncMov ? ` MOV:${resyncMov}` : ""}` +
        `  ultima="${lineas.at(-1) ?? ""}"`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `\nsaltados por guarda de dialogo: ${saltados} · resyncs de prompt: ${resyncs}` +
      ` · resyncs de movimiento: ${resyncsMov}` +
      ` · correcciones de desfase aplicadas: ${correcciones}`,
  );
  await fs.writeFile(
    path.join(OUT, "port.json"),
    JSON.stringify(
      { siembra: SIEMBRA || null, saltados, resyncs, resyncsMov, correcciones, filas },
      null,
      1,
    ),
  );
  expect(filas.length).toBe(GUION.pasos.length);
});
