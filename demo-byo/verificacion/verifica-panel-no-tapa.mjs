/**
 * SONDA DE NAVEGADOR: ¿el panel de consentimiento TAPA la UI de /byo? (ficha #124)
 *
 * Uso:  npx vite build demo-byo
 *       node demo-byo/verificacion/verifica-panel-no-tapa.mjs [--capturas <dir>]
 *
 * Produce observaciones en JSON por stdout. Quien asevera es `re/tools/test_panel_no_tapa.py`.
 *
 * ── LA PREGUNTA, Y LA QUE NO ES ─────────────────────────────────────────────────────────
 * NO mide «¿aparece el panel?» — eso es correcto y DEBE pasar: la decisión de privacidad es
 * obligatoria antes de grabar nada. Mide la otra mitad, que es la que estaba sin medir: de
 * que el panel DEBA APARECER no se sigue que deba TAPAR. El visitante que aún no ha decidido
 * tiene que poder llegar a los controles de la página — y el 08-08 no podía: con 1440×900 el
 * único elemento pulsable de todo /byo era el botón de idioma, y la zona de soltar (el paso
 * más caro del embudo) estaba cubierta al 98 %.
 *
 * ── EL DISCRIMINANTE ────────────────────────────────────────────────────────────────────
 * `document.elementFromPoint` en el centro de cada control: si devuelve el panel (o algo
 * dentro de él), ese clic NO llega a su destino. Es exactamente el mecanismo que interceptó
 * las 8 sondas de byo-extras en la composición del 09-08 — no era rareza del instrumento,
 * era la conducta que también le toca al usuario.
 *
 * ── 🔴 POR QUÉ SE MIDEN DOS COSAS Y NO UNA ──────────────────────────────────────────────
 * «Todo control alcanzable» A SOLAS es un VERDE VACUO: lo cumple de sobra un panel BORRADO,
 * o escondido, o con sus botones fuera de alcance. Y esconder el panel no es el remedio: es
 * el defecto opuesto y peor, porque convierte una decisión de privacidad en algo que el
 * visitante no ve. Por eso la sonda observa TAMBIÉN el panel: presente, visible, con área no
 * nula y con sus DOS botones de decisión alcanzables por el mismo predicado. El par es lo que
 * tiene dientes; cada mitad por su cuenta se satisface rompiendo la otra.
 *
 * ── EL CENSO SE ANCLA AL DOM, NO A UNA LISTA A MANO ─────────────────────────────────────
 * Una lista de ids («#drop, #picker…») es una FOTO: se queda rancia en cuanto alguien añade
 * un botón, y entonces la guarda pasa verde sobre un control que nadie mira. Se enumeran los
 * elementos INTERACTIVOS por su naturaleza (enlaces, botones, campos, summary/label, y todo
 * lo que declare `role=button` o entre en el tabulador).
 * ⚠️ ÚNICA EXCEPCIÓN DECLARADA: `#drop` se nombra a mano porque es un `<div>` SIN rol ni
 * tabindex — el DOM no lo delata como interactivo aunque sea el control principal de la
 * página. Si algún día se le pone `role="button"` (que debería), esta línea sobra y el censo
 * lo recoge solo. Se nombra para no perderlo, no para fijar el conjunto.
 *
 * ── PUERTO EFÍMERO ──────────────────────────────────────────────────────────────────────
 * `listen(0)`: lo elige el sistema. Ni el 5199 del usuario ni un 52xx de otro carril.
 */
import { createServer } from "node:http";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = join(RAIZ, "demo-byo/dist");
const { chromium } = createRequire(join(RAIZ, "package.json"))("playwright");

const iCap = process.argv.indexOf("--capturas");
const CAPTURAS = iCap >= 0 ? process.argv[iCap + 1] : null;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });

if (!existsSync(DIST)) {
  console.error(`No existe ${DIST}. Corre antes:  npx vite build demo-byo`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer((req, res) => {
  const ruta = new URL(req.url, "http://x").pathname;
  const f = join(DIST, ruta === "/" ? "byo.html" : ruta.slice(1));
  if (!f.startsWith(DIST) || !existsSync(f)) return void res.writeHead(404).end("no");
  res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" });
  res.end(readFileSync(f));
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/**
 * Los cinco viewports del censo del 08-08. Los tres primeros son escritorio real (donde se
 * midió el 98-100 % de tapado); los dos últimos son móvil y PAISAJE, que es el caso duro:
 * ahí el panel llegaba al 88 % del alto disponible.
 */
const VIEWPORTS = [
  { nombre: "escritorio-1440x900", width: 1440, height: 900 },
  { nombre: "escritorio-1512x982", width: 1512, height: 982 },
  { nombre: "escritorio-1920x1080", width: 1920, height: 1080 },
  { nombre: "movil-390x844", width: 390, height: 844 },
  { nombre: "movil-375x667", width: 375, height: 667 },
  { nombre: "paisaje-844x390", width: 844, height: 390 },
];

const obs = { base: BASE, consola: [], viewports: {} };
const navegador = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p = await ctx.newPage();
    p.on("console", (m) => {
      if (m.type() === "error") obs.consola.push(`${vp.nombre}: ${m.text().slice(0, 200)}`);
    });
    p.on("pageerror", (e) => obs.consola.push(`${vp.nombre} pageerror: ${String(e).slice(0, 200)}`));

    // SIN sembrar consentimiento: el sujeto de esta medición es justo el visitante que
    // todavía no ha decidido. Sembrar una decisión aquí mataría el caso.
    await p.goto(`${BASE}/byo.html`, { waitUntil: "networkidle" });
    await p.waitForTimeout(900);

    // 🔴 LOS <details> SE ABREN ANTES DEL CENSO, y el porqué está MEDIDO (auditoría de
    // contenidos 08-2026, que plegó las tarjetas de procedencia en <details> nativos):
    // Chromium CALCULA CAJA para los descendientes de un <details> CERRADO —layout sí,
    // pintado no: el enlace de GOG midió 268×37 px con `open:false`—, así que el censo
    // los veía con caja, `elementFromPoint` en su punto medio devolvía al VECINO pintado
    // encima, y salían «nunca alcanzables» en los 6 viewports. Era un rojo del
    // INSTRUMENTO: el sujeto de esta sonda es la reserva del PANEL, no el estado de un
    // plegable —un control plegado se alcanza abriendo su <summary>, que el censo ya
    // mide—. Abrirlos aquí convierte el falso-tapado en MEDICIÓN: también lo plegado
    // tiene que poder traerse a la vista con el panel abierto. Va ANTES de calcular los
    // pasos porque abrirlos cambia el scrollHeight.
    // 🔴 Y SOLO LOS DE LA PÁGINA, nunca los del PANEL — medido al primer intento: los
    // «Ver detalles» del panel de consentimiento también son <details>, abrirlos lo
    // infló de 266 a 406 px y puso en rojo la reserva Y los enlaces del pie. El sujeto
    // de esta sonda es el panel EN SU ESTADO POR DEFECTO; su interior no se toca.
    await p.$$eval("details", (ds) =>
      ds.forEach((d) => {
        if (!d.closest("#openu5-consentimiento")) d.open = true;
      }),
    );

    // 🔴 EL CENSO SE HACE CON SCROLL, y no es una concesión: el remedio de #124 NO
    // consiste en que nada quede nunca bajo la banda —una barra fija abajo siempre cubre
    // algo—, sino en que TODO se pueda TRAER A LA VISTA. Medir sólo la primera pantalla
    // confundiría «está debajo del pliegue» con «está tapado», que son cosas distintas y
    // con remedios distintos. Se recorre la página en pasos de media pantalla y un
    // control cuenta como alcanzable si lo es EN ALGUNA posición de scroll.
    // 🔴 EL PASO SE MIDE CONTRA LA BANDA LIBRE, no contra el viewport. Con medio viewport
    // de paso y el panel ocupando el 60 %, la ventana en la que un elemento está por ENCIMA
    // del panel puede ser MÁS ESTRECHA que el paso: el muestreo salta por encima de ella y
    // el elemento sale «nunca alcanzable» sin estarlo. Pasó con dos controles en los dos
    // viewports más bajos (375×667 y 844×390) y era artefacto del instrumento, no del
    // remedio. Se muestrea a media BANDA LIBRE (viewport − panel), con suelo de 40 px.
    const pasos = await p.evaluate(() => {
      const alto = document.documentElement.scrollHeight;
      const panel = document.getElementById("openu5-consentimiento");
      const hPanel = panel ? panel.getBoundingClientRect().height : 0;
      const banda = Math.max(40, innerHeight - hPanel);
      const paso = Math.max(40, Math.floor(banda / 2));
      const n = Math.ceil(alto / paso) + 1;
      return Array.from({ length: n }, (_, i) => i * paso);
    });

    // Una pasada por cada posición de scroll; se UNEN los alcanzables y se restan de los
    // tapados. `nuncaAlcanzable` = tapado en TODAS las posiciones donde se pudo muestrear.
    const porPaso = [];
    for (const y of pasos) {
      await p.evaluate((yy) => window.scrollTo(0, yy), y);
      await p.waitForTimeout(120);
      porPaso.push(await p.evaluate(() => {
      const PANEL = "openu5-consentimiento";
      const panel = document.getElementById(PANEL);
      const dentroDelPanel = (n) => !!panel && !!n && (n === panel || panel.contains(n));

      const etiqueta = (el) => {
        const id = el.id ? `#${el.id}` : "";
        const cls =
          typeof el.className === "string" && el.className.trim()
            ? `.${el.className.trim().split(/\s+/)[0]}`
            : "";
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34);
        return `${el.tagName.toLowerCase()}${id}${cls} «${txt}»`;
      };

      // ¿El punto medio del elemento pertenece al elemento? Devuelve null si no se puede
      // muestrear (fuera del viewport): «no medido» NO es «alcanzable».
      //
      // 🔴 DOS AJUSTES QUE SALIERON DE VER AL PROPIO INSTRUMENTO EQUIVOCARSE, y que van
      // comentados porque los dos producían un ROJO PERMANENTE — tan inútil como el verde
      // vacuo, y más engañoso porque parece rigor:
      //  (a) el corte «está dentro del panel ⇒ tapado» se aplicaba TAMBIÉN a los botones
      //      DEL panel, que están dentro por definición: el aserto de no-vacuidad no podía
      //      pasar nunca. Estar tapado es que te cubra ALGO AJENO, así que el corte sólo
      //      vale cuando el elemento medido NO vive en el panel.
      //  (b) un elemento sin caja (los `input type=file` llevan el atributo `hidden`; los
      //      dispara un botón visible) no es un control que nadie pulse: se EXCLUYE del
      //      censo en vez de contarse como inalcanzable. Se devuelven aparte para que la
      //      exclusión sea visible y no un filtro callado.
      const alcanzable = (el) => {
        const b = el.getBoundingClientRect();
        // Umbral y no ==0: el patrón «visually hidden» (1×1 + clip-path) deja caja de 1 px,
        // y esos NO son controles que nadie pulse — los dispara su <label>. Contarlos como
        // inalcanzables daba un rojo permanente en los 6 viewports (input.importa__input).
        // 4 px es holgadamente menor que cualquier diana real y mayor que el truco de 1 px.
        if (b.width < 4 || b.height < 4) return "sin-caja";
        const x = b.left + b.width / 2;
        const y = b.top + b.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
        const enc = document.elementFromPoint(x, y);
        if (!enc) return null;
        if (dentroDelPanel(enc) && !dentroDelPanel(el)) return false;
        return enc === el || el.contains(enc) || enc.contains(el);
      };

      // CENSO ANCLADO AL DOM: interactivos por naturaleza. `#drop` va aparte y declarado
      // (ver cabecera): es un div sin rol, el DOM no lo delata.
      const INTERACTIVOS =
        'a[href], button, input:not([type=hidden]), select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
      const conjunto = new Set(document.querySelectorAll(INTERACTIVOS));
      const drop = document.getElementById("drop");
      if (drop) conjunto.add(drop);

      //  (c) 🔴 el contenido de un <details> CERRADO no es «tapado por el panel»: es un
      //      PLIEGUE, y su vía de acceso es el summary — que SÍ está en el censo (el
      //      selector lleva `summary`), así que si el panel tapara el abridor, (A) se
      //      pondría rojo por él. La trampa que obligó a esta rama, MEDIDA el 23-08 con
      //      el enlace de GOG de /byo (los cuatro casos de procedencia se plegaron en
      //      la auditoría de contenidos): Chromium le da CAJA REAL al contenido cerrado
      //      (268×38 medidos; lo oculta por content-visibility, no por display:none),
      //      así que la exclusión de «sin-caja» no lo cazaba y elementFromPoint sobre su
      //      punto medio devolvía SIEMPRE otro elemento ⇒ «nunca alcanzable» en los seis
      //      viewports, con el panel sin tener nada que ver. Igual que (b), la exclusión
      //      se devuelve APARTE (`plegados`) para que sea visible y no un filtro callado.
      //      ⚠ Alcance declarado: un <details> SIN summary propio (marcador de la UA,
      //      que no vive en el DOM) dejaría su contenido excluido sin abridor censado;
      //      hoy no existe ninguno así en la página, y quien lo añada hereda este aviso.
      const plegado = (el) => {
        let n = el;
        while ((n = n.parentElement)) {
          if (n.tagName === "DETAILS" && !n.open) {
            const sum = [...n.children].find((c) => c.tagName === "SUMMARY");
            if (!(sum && sum.contains(el))) return true;
          }
        }
        return false;
      };

      const tapados = [];
      const alcanzables = [];
      const fueraDeVista = [];
      const sinCaja = [];
      const plegados = [];
      for (const el of conjunto) {
        if (dentroDelPanel(el)) continue; // los del propio panel se miden abajo, aparte
        if (plegado(el)) { plegados.push(etiqueta(el)); continue; }
        const a = alcanzable(el);
        if (a === "sin-caja") sinCaja.push(etiqueta(el));
        else if (a === null) fueraDeVista.push(etiqueta(el));
        else if (a) alcanzables.push(etiqueta(el));
        else tapados.push(etiqueta(el));
      }

      // ── EL OTRO LADO DEL PAR: el panel sigue siendo una decisión de verdad ──
      // 🔴 Se desplaza DENTRO del panel antes de medir sus botones. Con el tope de 60vh
      // los botones de decisión caen bajo el scroll interno en viewports bajos (móvil y
      // paisaje), y medirlos sólo en reposo los daba por inalcanzables — un rojo que
      // acusaba al remedio de romper lo que el propio remedio protege. Que haya que
      // desplazar para llegar al botón es correcto y hasta deseable: obliga a pasar por
      // el texto antes de decidir. Lo que NO sería aceptable es que no se pudiera llegar.
      const botones = panel
        ? [...panel.querySelectorAll("[data-accion]")].map((b) => {
            b.scrollIntoView({ block: "nearest" });
            return { accion: b.getAttribute("data-accion"), alcanzable: alcanzable(b) === true };
          })
        : [];
      const pr = panel ? panel.getBoundingClientRect() : null;

      return {
        panel: {
          presente: !!panel,
          areaNoNula: !!pr && pr.width > 0 && pr.height > 0,
          alto: pr ? Math.round(pr.height) : 0,
          pctDelViewport: pr ? Math.round((pr.height / innerHeight) * 100) : 0,
          botones,
        },
        censo: { tapados, alcanzables, fueraDeVista, sinCaja, plegados },
        reserva: (() => {
          const h = document.getElementById("openu5-consentimiento-reserva");
          return h ? Math.round(h.getBoundingClientRect().height) : 0;
        })(),
        docAlto: document.documentElement.scrollHeight,
        viewportAlto: innerHeight,
      };
      }));
    }

    // Composición de las pasadas. El panel se lee de la PRIMERA (es fijo: mismo alto en
    // todas); el censo se compone porque alcanzable-en-alguna-posición es la propiedad.
    {
      const alcanzables = new Set();
      const vistos = new Set();
      const excluidosSinCaja = new Set();
      const excluidosPlegados = new Set();
      for (const r of porPaso) {
        for (const e of r.censo.alcanzables) { alcanzables.add(e); vistos.add(e); }
        for (const e of r.censo.tapados) vistos.add(e);
        for (const e of r.censo.fueraDeVista) vistos.add(e);
        for (const e of r.censo.sinCaja) excluidosSinCaja.add(e);
        for (const e of r.censo.plegados) excluidosPlegados.add(e);
      }
      // Un elemento con caja en ALGUNA posición ya no es «sin caja»: manda el haberla tenido.
      for (const e of vistos) excluidosSinCaja.delete(e);
      // Y un elemento medible en ALGUNA posición ya no está «plegado»: si alguien despliega
      // durante la pasada (hoy nadie lo hace), manda la medición.
      for (const e of vistos) excluidosPlegados.delete(e);
      const nuncaAlcanzable = [...vistos].filter((e) => !alcanzables.has(e));
      obs.viewports[vp.nombre] = {
        panel: porPaso[0].panel,
        reserva: porPaso[0].reserva,
        docAlto: porPaso[0].docAlto,
        viewportAlto: porPaso[0].viewportAlto,
        posicionesDeScroll: pasos.length,
        censo: {
          alcanzablesEnAlgunScroll: [...alcanzables].sort(),
          nuncaAlcanzable: nuncaAlcanzable.sort(),
          excluidosSinCaja: [...excluidosSinCaja].sort(),
          excluidosPlegados: [...excluidosPlegados].sort(),
        },
      };
    }

    if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, `${vp.nombre}.png`), fullPage: false });
    await ctx.close();
  }
} finally {
  await navegador.close();
  server.close();
}

process.stdout.write(JSON.stringify(obs, null, 2));
