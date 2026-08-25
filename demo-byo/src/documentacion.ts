/**
 * ENTRADA DE CONSENTIMIENTO PARA LAS PÁGINAS DE DOCUMENTACIÓN
 * (`/mejoras/**`, `/diferencias`, `/en/differences`, `/privacidad`).
 *
 * Se emite con nombre FIJO — `/consentimiento-doc.js`, ver `vite.config.ts` — por la
 * misma razón que `/consentimiento.js`: esas páginas las genera un script y necesitan
 * una ruta estable, no un nombre con hash que cambie en cada build.
 *
 * ── POR QUÉ EXISTE UNA SEGUNDA ENTRADA Y NO SE REUSA LA DE LA PORTADA ────────────
 * 🔴 MEDIDO el 07-08 antes de tocar nada. `consentimiento.js` son 214 B y su cuerpo
 * entero es:
 *
 *     const {analitica, panel} = instalaConsentimiento({superficie: "portada"});
 *     analitica.evento(EV.PORTADA);
 *
 * Copiar ese `<script>` a las páginas de documentación —que es el arreglo que parece de
 * una línea— mete DOS defectos:
 *
 *   1. **EMITE UN EVENTO AL CARGARSE.** Hoy `/mejoras` no manda nada; con esa línea,
 *      diez páginas que no emitían **empiezan a emitir**. Eso no es cerrar una
 *      incoherencia: es **cambiar lo que el sitio envía**, y esa decisión no la toma
 *      un carril de contenido por simetría estética.
 *   2. **`superficie` está cableada a `"portada"`.** Aunque se decidiera que sí deben
 *      emitir, las diez llegarían etiquetadas como portada — corrompiendo la analítica
 *      con un dato falso que **cuadra internamente** (los eventos existen, la cifra
 *      sube) y que por eso no se ve roto desde el panel.
 *
 * Este módulo monta **el mismo panel** y **no emite absolutamente nada**. La diferencia
 * con la portada es UNA LÍNEA —la que falta—, y está aquí escrita para que quien la
 * añada sepa lo que está decidiendo.
 *
 * ── LO QUE ESTO CIERRA, Y LO QUE NO ─────────────────────────────────────────────
 * CIERRA una incoherencia con la tesis del sitio: la política de privacidad no era
 * alcanzable desde 10 de las 14 páginas. **NO cierra una fuga**, porque no la había:
 * sin script, esas páginas no emitían nada. La acotación importa — si esto se cuenta
 * como «arreglado un incidente de privacidad», se está publicando un mérito falso.
 *
 * ── LA SUPERFICIE ES «doc», Y ESO NO ES COSMÉTICO ───────────────────────────────
 * `instalaConsentimiento` recibe la superficie porque el panel y la analítica la usan
 * para saber DÓNDE están. Aquí es `"doc"` y no `"portada"`: si algún día estas páginas
 * llegaran a emitir, sus eventos tienen que ser distinguibles de los de la home o la
 * cifra agregada mezclará dos poblaciones — que es el modo de fallo del defecto 2 de
 * arriba, sólo que descubierto seis meses después.
 */
import { instalaConsentimiento } from "../../game/src/web/arranque.js";

/**
 * EL HUECO DONDE /privacidad QUIERE EL PANEL, si esta página lo ofrece.
 *
 * 🔴 SE PREGUNTA POR EL HUECO Y NO POR LA URL, y ésa es toda la gracia: este módulo lo
 * cargan las CATORCE páginas de documentación, y condicionar por `location.pathname`
 * metería aquí una lista de rutas que se queda rancia en cuanto alguien mueva una página
 * (ya pasó con `/mejoras/en/` → `/en/improvements/`, y la guarda que miraba la ruta vieja
 * se quedó contando un directorio vacío). Con el hueco, la página que quiera el panel
 * dentro lo pide poniendo un `<div id="panel-aqui">` y nadie tiene que enterarse aquí.
 * Las trece que no lo ponen siguen exactamente igual: banda flotante y enlace en el pie.
 */
const HUECO = "panel-aqui";
const anfitrion = () => document.getElementById(HUECO);

/**
 * EL IDIOMA DE ESTAS PÁGINAS LO DICE SU PROPIO `<html lang>`, no el navegador.
 *
 * Las catorce superficies que cargan este módulo son «una URL por idioma» (§IDIOMA de
 * `build-demo-publica.sh`): quien está en `/en/privacy` eligió inglés AL ABRIRLA. El
 * resolvedor compartido mira `openu5-lang`/`navigator.language`, que aquí es información
 * más vieja que el clic que trajo al visitante — y produce página en un idioma con panel
 * en el otro en 2 de las 4 combinaciones (medido; la tabla está en `OpcionesInstalacion`).
 * 🔴 SE LEE EN CADA APERTURA por lo mismo que el anfitrión: si el atributo cambiara, el
 * panel siguiente ya sale bien; y si faltara, cae a inglés, que es el defecto del sitio.
 */
const idiomaDeLaPagina = () =>
  (document.documentElement.lang || "").toLowerCase().startsWith("es") ? "es" : "en";

const { panel } = instalaConsentimiento({
  superficie: "doc",
  anfitrion,
  idioma: idiomaDeLaPagina,
});

// 🔴 EN LA PÁGINA QUE EMPOTRA, EL PANEL SE ABRE SIEMPRE — y no es «abrirlo sin que lo
// pidan». `instalaConsentimiento` sólo lo abre solo cuando NADIE HA DECIDIDO todavía
// (ver `puedeAbrirseSolo`), que es la regla correcta para algo que TAPA. Empotrado no
// tapa nada: es el control que esta página promete en su propio texto, y sin esta línea
// quien ya decidió —o sea, casi todo el mundo— llegaría a un hueco vacío justo debajo de
// la frase que le dice que ahí está el panel. La frase y el panel se mueven juntos.
if (anfitrion()) panel.abre();

// 🔴 AQUÍ NO VA NINGÚN `analitica.evento(...)`. No es un olvido: es EL PUNTO del módulo.
// Si alguien añade uno, que sea con la decisión tomada y escrita, no por parecerse a
// `portada.ts`.

// Las páginas de documentación tienen conmutador ES/EN que cambia de URL, así que no
// emiten `openu5:lang` como la home (que reescribe sus textos al vuelo). Se conserva el
// oyente igualmente: es barato, y si un día alguna de estas páginas pasa a conmutar en
// caliente, el panel abierto ya se repinta en el idioma nuevo.
window.addEventListener("openu5:lang", () => {
  if (panel.visible()) {
    panel.cierra();
    panel.abre();
  }
});
