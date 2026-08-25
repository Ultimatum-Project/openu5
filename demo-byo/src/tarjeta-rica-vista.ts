/**
 * LA FICHA RICA, PINTADA — una SECCIÓN COMPONIBLE, no un layout.
 *
 * ── EL CONTRATO, Y ES LO ÚNICO IMPORTANTE DE ESTE FICHERO ───────────────────────────────
 * `seccionRica()` devuelve UN elemento SUELTO y no toca nada más. No busca en el documento,
 * no reordena la tarjeta, no escribe en `<li>` ajenos, no registra listeners globales. Quien
 * la use hace UN `appendChild` donde quiera y se acabó.
 *
 * 🔴 Y ESO ES UNA DECISIÓN DE COORDINACIÓN, no de estilo. La tarjeta de `/byo` la están
 * tocando DOS carriles a la vez: éste y el que añade el minimapa de interiores con sus dos
 * vistas. Una ficha escrita como «el nuevo layout de la tarjeta» obligaría a elegir cuál de
 * los dos gana y a rehacer el otro; escrita como sección que se cuelga, los dos caben y la
 * integración es ADITIVA. Si algún día esto necesita reordenar la tarjeta para funcionar,
 * el diseño está mal, no la tarjeta.
 *
 * ── POR QUÉ `<details>` NATIVO ──────────────────────────────────────────────────────────
 * La portada de la tarjeta ya está llena; lo de aquí crece HACIA ABAJO y PLEGADO. Un
 * `<details>` trae abrir/cerrar, teclado (Enter y Espacio), rol y estado accesibles, y el
 * anuncio de expandido/colapsado — todo del navegador. Con un `<div>` + `onclick` habría que
 * reimplementar las cuatro cosas y los fallos serían míos. Cuesta un elemento.
 *
 * ── POR QUÉ EL TRADUCTOR ENTRA POR PARÁMETRO ────────────────────────────────────────────
 * 🔴 No se importa `txt` de `idioma.ts` y no es por purismo: `idioma.ts` es uno de los
 * ficheros que el otro carril está modificando ahora mismo (+73 líneas medidas), así que
 * añadirle claves HOY fabrica un conflicto en el fichero más tonto de resolver mal — una
 * tabla de cadenas donde un merge descuidado pierde una clave en silencio y `txt()` devuelve
 * el identificador EN CRUDO en la tarjeta, sin dar error.
 * ⇒ El traductor se inyecta. `re/tools/test_byo_tarjeta_rica.py` recoge el conjunto EXACTO de
 * claves que esta vista pide y lo asevera: esa lista es el contrato que la integración tiene
 * que satisfacer en `idioma.ts`, y está escrita por la vista, no copiada a mano.
 */
import type { FichaRica, Miembro } from "./tarjeta-rica.js";
import { lunaSvgPath } from "./tarjeta-rica.js";

/** Traduce una clave. En producción es `txt` de `idioma.ts`; ver la cabecera. */
export type Traductor = (clave: string, vars?: Record<string, string>) => string;

const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag: string, cls: string, texto?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

/**
 * Una luna DIBUJADA a `lado` píxeles, con su rótulo.
 *
 * El disco oscuro va SIEMPRE (es el cuerpo de la luna) y encima el path iluminado, que en
 * fase 0 está vacío. `aria-hidden` porque lo que dice el dibujo ya está en el texto de al
 * lado: un lector de pantalla que anunciara «imagen» aquí sólo añadiría ruido.
 */
function luna(fase: number, rotulo: string, lado = 22): HTMLElement {
  const cont = el("span", "ficha-luna");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "-1.15 -1.15 2.3 2.3");
  svg.setAttribute("width", String(lado));
  svg.setAttribute("height", String(lado));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "ficha-luna__svg");
  const disco = document.createElementNS(SVG_NS, "circle");
  disco.setAttribute("r", "1");
  disco.setAttribute("class", "ficha-luna__disco");
  svg.appendChild(disco);
  const d = lunaSvgPath(fase);
  if (d) {
    const luz = document.createElementNS(SVG_NS, "path");
    luz.setAttribute("d", d);
    luz.setAttribute("class", "ficha-luna__luz");
    svg.appendChild(luz);
  }
  cont.appendChild(svg);
  cont.appendChild(el("span", "ficha-luna__rotulo", rotulo));
  return cont;
}

/** Una fila «rótulo: valor» del bloque plegado. */
function fila(rotulo: string, valor: string): HTMLElement {
  const f = el("div", "ficha-fila");
  f.appendChild(el("dt", "ficha-fila__rotulo", rotulo));
  f.appendChild(el("dd", "ficha-fila__valor", valor));
  return f;
}

/**
 * Un miembro del grupo: nombre, estado y barra de salud.
 *
 * 🔴 LA BARRA SÓLO SE PINTA SI HAY LOS DOS NÚMEROS Y `maxHp > 0`. Sin `maxHp` no hay
 * denominador y la barra sería una fracción inventada; con `maxHp = 0` sería una división
 * por cero que en JS da `Infinity` y pinta una barra a tope — o sea, un muerto con la salud
 * llena. El caso no es teórico: `grupo()` deja fuera las claves que el registro no trae.
 */
function miembro(m: Miembro, t: Traductor): HTMLElement {
  const li = el("li", "ficha-pj" + (m.estado === "D" ? " ficha-pj--caido" : ""));
  li.appendChild(el("span", "ficha-pj__nombre", m.nombre || t("pjSinNombre")));
  if (m.nivel !== undefined) {
    li.appendChild(el("span", "ficha-pj__nivel", t("pjNivel", { n: String(m.nivel) })));
  }
  if (m.hp !== undefined && m.maxHp !== undefined && m.maxHp > 0) {
    const barra = el("span", "ficha-pj__barra");
    const dentro = el("span", "ficha-pj__barra-luz");
    const pct = Math.max(0, Math.min(100, Math.round((m.hp / m.maxHp) * 100)));
    dentro.style.width = pct + "%";
    barra.appendChild(dentro);
    li.appendChild(barra);
    li.appendChild(el("span", "ficha-pj__hp", `${m.hp}/${m.maxHp}`));
  }
  // QUÉ lleva puesto, por su nombre (DATA.OVL DS 0x1962 — ver `Miembro.equipo`). El cardinal
  // no desaparece: se va al `title`, porque «3/6» responde a una pregunta que los nombres no
  // responden solos —cuántas ranuras quedan libres— y ocupaba una línea entera para decirlo.
  //
  // 🔴 «SIN EQUIPO» ES UN DATO Y SE DICE. Con las seis ranuras a `0xff` la lista sale vacía,
  // y no pintar nada ahí lo haría indistinguible del registro que no trae ranuras (el que
  // `grupo()` deja en `undefined` a propósito). Ir desnudo es una noticia sobre la partida;
  // que el save no lo cuente, no.
  if (m.equipados !== undefined) {
    const eq = el(
      "span",
      "ficha-pj__equipo",
      m.equipo && m.equipo.length > 0 ? m.equipo.join(" · ") : t("pjSinEquipo"),
    );
    eq.title = t("pjEquipado", { n: String(m.equipados) });
    li.appendChild(eq);
  }
  // El estado sólo se dice cuando NO es «bien»: un «G» en cada línea es ruido, y lo que
  // alguien busca de un vistazo es quién está mal.
  if (m.estado && m.estado !== "G") {
    li.appendChild(el("span", "ficha-pj__estado", t("estado_" + m.estado)));
  }
  return li;
}

/**
 * La INSIGNIA de «partida en curso», para colgar junto al nombre de la tarjeta que
 * `idEnCurso()` señale.
 *
 * 🔴 Va aquí y no en la vista de la ficha porque describe la PARTIDA frente a las demás, no
 * su contenido — mismo criterio que la insignia de procedencia («momento») que ya vive
 * pegada al nombre en `partidas.ts`, y no entre los chips de estado. Y se devuelve suelta,
 * como todo lo de este módulo: quien pinta decide dónde va.
 */
export function insigniaEnCurso(t: Traductor): HTMLElement {
  const ins = el("span", "chip chip--en-curso", t("enCursoInsignia"));
  // El título dice el HECHO, no el mecanismo: lo que importa es que es la que continuarías,
  // no que sea «la de timestamp más alto».
  ins.title = t("enCursoTitulo");
  return ins;
}

/**
 * La SECCIÓN de ficha rica de una partida, o `null` si no hay nada que enseñar.
 *
 * 🔴 EL `null` ES PARTE DEL CONTRATO Y NO UN ATAJO. Sobre una partida vieja sin ninguno de
 * estos campos, un `<details>` que al abrirse no tiene nada dentro es peor que su ausencia:
 * promete información y no la da. Devolver `null` deja la tarjeta exactamente como estaba —
 * la misma regla de «ni hueco ni marco vacío» que ya sigue la ilustración.
 */
export function seccionRica(f: FichaRica, t: Traductor): HTMLElement | null {
  const bloques: HTMLElement[] = [];

  // ── GRUPO. Va primero porque es lo que alguien reconoce como SU partida seis meses
  // después; el oro y las llaves son números que podrían ser de cualquiera.
  if (f.grupo.length > 0) {
    const b = el("section", "ficha-bloque");
    b.appendChild(el("h4", "ficha-bloque__titulo", t("fichaGrupo")));
    const ul = el("ul", "ficha-pjs");
    for (const m of f.grupo) ul.appendChild(miembro(m, t));
    b.appendChild(ul);
    bloques.push(b);
  }

  // ── BOLSA. `dl` porque son pares rótulo/valor de verdad.
  const bolsa: [string, number | undefined][] = [
    ["bolsaOro", f.economia.oro],
    ["bolsaComida", f.economia.comida],
    ["bolsaLlaves", f.economia.llaves],
    ["bolsaGemas", f.economia.gemas],
    ["bolsaAntorchas", f.economia.antorchas],
    ["bolsaCalaveras", f.economia.calaveras],
    ["bolsaAlfombras", f.economia.alfombras],
  ];
  const presentes = bolsa.filter(([, v]) => v !== undefined);
  if (presentes.length > 0) {
    const b = el("section", "ficha-bloque");
    b.appendChild(el("h4", "ficha-bloque__titulo", t("fichaBolsa")));
    const dl = el("dl", "ficha-filas");
    for (const [clave, v] of presentes) {
      const f2 = fila(t(clave), String(v));
      // La CLAVE viaja como dato para que el icono se pueda colgar después, igual que hacen
      // los chips de artefacto: releer un rótulo ya traducido para adivinar qué es sería
      // exactamente el «adjudicar por el texto» que no funciona en dos idiomas.
      f2.dataset.icono = clave.replace("bolsa", "").toLowerCase();
      dl.appendChild(f2);
    }
    b.appendChild(dl);
    bloques.push(b);
  }

  // ── TRAMA. Sólo las líneas que el save SOSTIENE (ver `trama()`: los bitmaps ausentes son
  // `undefined`, nunca 0).
  const trama = el("section", "ficha-bloque");
  trama.appendChild(el("h4", "ficha-bloque__titulo", t("fichaTrama")));
  const dlT = el("dl", "ficha-filas");
  let hayTrama = false;
  const ponT = (clave: string, v: number | undefined): void => {
    if (v === undefined) return;
    dlT.appendChild(fila(t(clave), String(v)));
    hayTrama = true;
  };
  // 🔴 Los Shadowlords NO van siempre. Esta línea era incondicional y decía «0 de 3» sobre
  // un save sin `questFlags` — el cero inventado, cometido justo en el bloque cuya cabecera
  // lo prohíbe. Y al ser incondicional hacía que el `return null` de abajo no pudiera darse
  // nunca: fue esa rama inalcanzable la que delató el defecto, no un aserto sobre el dato.
  if (f.trama.shadowlordsMuertos !== undefined) {
    dlT.appendChild(fila(t("tramaShadowlords"), t("tramaDeTres", { n: String(f.trama.shadowlordsMuertos) })));
    hayTrama = true;
  }
  ponT("tramaPalabras", f.trama.palabras);
  ponT("tramaEscondrijos", f.trama.escondrijos);
  ponT("tramaSantuarios", f.trama.santuariosDestruidos);
  ponT("tramaSalas", f.trama.salasDespejadas);
  ponT("tramaPersonas", f.trama.personasConocidas);
  ponT("tramaMoonstones", f.trama.moonstonesEnterradas);
  if (hayTrama) {
    trama.appendChild(dlT);
    bloques.push(trama);
  }

  // ── MUNDO: hora, transporte y las dos lunas DIBUJADAS.
  const mundo = el("section", "ficha-bloque");
  mundo.appendChild(el("h4", "ficha-bloque__titulo", t("fichaMundo")));
  let hayMundo = false;
  const dlM = el("dl", "ficha-filas");
  if (f.reloj) {
    const hh = String(f.reloj.hora).padStart(2, "0");
    const mm = String(f.reloj.minuto).padStart(2, "0");
    dlM.appendChild(fila(t("mundoHora"), `${hh}:${mm} ${t(f.noche ? "mundoNoche" : "mundoDia")}`));
    hayMundo = true;
  }
  if (f.transporte) {
    dlM.appendChild(fila(t("mundoTransporte"), t("transporte_" + f.transporte)));
    hayMundo = true;
  }
  if (hayMundo) mundo.appendChild(dlM);
  // 🔴 LAS LUNAS SÓLO SI ESTÁN LATCHEADAS. `f.lunas` es `undefined` cuando el par no lo está
  // —y eso NO es «luna nueva»: es «esta partida no lo dice»—, así que no se dibuja un par de
  // discos negros que se leerían como dos lunas nuevas medidas.
  if (f.lunas) {
    const par = el("div", "ficha-lunas");
    par.appendChild(luna(f.lunas.felucca, t("lunaFelucca", { n: String(f.lunas.felucca) })));
    par.appendChild(luna(f.lunas.trammel, t("lunaTrammel", { n: String(f.lunas.trammel) })));
    mundo.appendChild(par);
    hayMundo = true;
  }
  if (hayMundo) bloques.push(mundo);

  if (bloques.length === 0) return null;

  const det = document.createElement("details");
  det.className = "ficha-rica";
  const sum = document.createElement("summary");
  sum.className = "ficha-rica__abrir";
  // El resumen dice lo que hay DENTRO, no «ver más»: un `<summary>` que no anticipa su
  // contenido obliga a abrirlo para saber si interesa.
  sum.textContent = t("fichaVerDetalles");
  det.appendChild(sum);
  const cuerpo = el("div", "ficha-rica__cuerpo");
  for (const b of bloques) cuerpo.appendChild(b);
  det.appendChild(cuerpo);
  return det;
}
