/**
 * Artefactos de DESPLIEGUE que `vite build` no emite y que hasta ahora se reponían
 * a mano tras cada build (regla que vivía SÓLO como prosa en los handoffs, y que la
 * auditoría de cierre 07-27 encontró incumplida: game/dist sin ninguno de los dos).
 * Los escribe el plugin `deployArtifacts` de vite.config.ts en `closeBundle`, mismo
 * patrón que `gameDataAssets`.
 *
 * DOS destinos, dos necesidades distintas (docs/publicacion/PLAN.md §10.3):
 *  - staging PRIVADO (`openu5`, staging.openu5.org — y ultima.kokoima.es, que todavía
 *    convive apuntando al MISMO proyecto): sirve assets extraídos (datos de
 *    EA) ⇒ basic-auth + noindex. El gate es un `_worker.js` de Cloudflare Pages. Las
 *    credenciales NUNCA viven en el repo: entran por entorno (U5_STAGING_USER/
 *    U5_STAGING_PASS) y sin ellas el fichero simplemente NO se emite.
 *  - demo pública BYO (`openu5-web`, openu5.org): sin password (no sirve un solo byte
 *    de EA). Su ensamblador (docs/publicacion/build-demo-publica.sh) copia game/dist y
 *    por eso EXCLUYE `_worker.js` explícitamente: heredar el gate privado dejaría la
 *    demo pública tras un 401 y publicaría la contraseña en un fichero servido.
 *
 * 🔴 ROBOTS: LOS DOS DESTINOS DIVERGEN, Y NO ES UNA INCOHERENCIA (decisión 2026-08-04).
 *   · staging  → `Disallow: /` OBLIGATORIO. Es la SEGUNDA CAPA sobre el 401: sirve
 *     material de EA, y que el portón aguante no quita que no deba aparecer en un
 *     índice. Este es el DEFECTO de esta función y no se toca.
 *   · público  → SIN `Disallow: /`. Queremos que openu5.org se encuentre; publicar el
 *     sitio invisible sería el fallo mudo de manual.
 * Ese `robots.txt` público NO sale de aquí: `build-demo-publica.sh` lo SOBRESCRIBE con
 * su propia política después del rsync, en vez de heredar el que este build dejó. Antes
 * heredaba, y entonces que openu5.org fuese indexable dependía de con qué `U5_ROBOTS`
 * se hubiera invocado el build DEL JUEGO — o sea, del artefacto equivocado. `U5_ROBOTS`
 * sigue existiendo para forks que despliegan ESTE dist directamente.
 * La correspondencia entre las dos políticas está pineada en
 * `tests/robots-dos-destinos.test.ts`, para que no puedan separarse en silencio.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

export const ROBOTS_NOINDEX = "User-agent: *\nDisallow: /\n";
export const ROBOTS_ALLOW = "User-agent: *\nAllow: /\n";

/**
 * Gate basic-auth + noindex para Cloudflare Pages (Functions: `_worker.js` en la raíz).
 *
 * ── POR QUÉ HAY UNA SEGUNDA VÍA (FORMULARIO + COOKIE) ────────────────────────────
 * La versión anterior tenía UNA sola llave: la cabecera `Authorization`. Eso deja
 * fuera al caso «Añadir a pantalla de inicio» de iOS, que es el que rompió (informe
 * del usuario: el icono arranca en NEGRO mientras la misma URL va bien en Safari):
 *
 *  1. En iOS una web app de pantalla de inicio corre en una PARTICIÓN DE ALMACENAMIENTO
 *     propia — cookies, localStorage y credenciales HTTP separadas de Safari
 *     (WebKit bug 181849, «Add to homescreen apps don't share storage with Safari»).
 *     O sea: la contraseña que Safari ya tiene guardada NO viaja al icono.
 *  2. Sin barra de navegador, el diálogo nativo de `WWW-Authenticate` no tiene dónde
 *     pintarse, así que la primera navegación se queda en el 401.
 *  3. El cuerpo de ese 401 es `text/plain` sin `<meta viewport>`: la app instalada no
 *     lo pinta, y lo que queda en pantalla es el fondo del webclip. NEGRO.
 *
 * La cookie no arregla eso por sí sola —está particionada igual que la credencial—,
 * así que lo que hace falta es poder AUTENTICARSE DENTRO de la partición del icono.
 * Por eso el gate responde a una NAVEGACIÓN sin llave con un FORMULARIO HTML (que sí
 * se pinta y sí se puede teclear en modo standalone) en vez de con un desafío que
 * allí nadie puede contestar. Al acertar deja una cookie de sesión y a partir de ahí
 * la partición entera —documento y sub-recursos— pasa sin volver a preguntar.
 *
 * ── LO QUE NO CAMBIA ─────────────────────────────────────────────────────────────
 * · La cabecera `Authorization` sigue valiendo: `curl -u`, wrangler y cualquier arnés
 *   existente entran igual (curl la manda de forma preventiva con `-u`).
 * · Un sub-recurso o una herramienta sin llave siguen recibiendo el 401 clásico CON
 *   `WWW-Authenticate` — la sonda `curl -s -o /dev/null -w "%{http_code}"` sigue dando
 *   401, que es como se comprueba que el staging está cerrado.
 * · Nada se abre: sin llave no sale un solo byte de EA. El formulario es una PUERTA
 *   con cerradura, no un boquete — se sirve CON status 401 y con el noindex puesto.
 * · La demo pública no hereda nada de esto: `build-demo-publica.sh` excluye
 *   `_worker.js` y comprueba que no quede ni un `WWW-Authenticate` en el árbol.
 *
 * El token de la cookie es el SHA-256 de las credenciales con un sufijo de versión:
 * es opaco (no revela la contraseña ni siquiera a quien lea la cookie) y no es un
 * secreto NUEVO — quien lo tenga es porque ya conocía la contraseña.
 */
export function stagingWorkerSource(user: string, pass: string): string {
  // JSON.stringify y no interpolación cruda: una credencial con comillas o backtick
  // rompería el módulo emitido (o peor, se saldría del literal).
  return `// GENERADO por game/tools/deploy-artifacts.ts en el build — NO editar a mano.
// Gate del staging PRIVADO: basic-auth + cookie de sesión + noindex (material EA ⇒
// jamás público ni indexable). Credenciales inyectadas desde el entorno en el build.
const USER = ${JSON.stringify(user)};
const PASS = ${JSON.stringify(pass)};
const COOKIE = "u5staging";
const REALM = 'Basic realm="OpenU5 staging"';
const NOINDEX = "noindex, nofollow";
// Un año: el icono de inicio no debería volver a preguntar nunca en la práctica.
const MAX_AGE = 31536000;

/** Token opaco derivado de las credenciales (no viaja la contraseña en la cookie). */
let TOKEN = null;
async function token() {
  if (TOKEN) return TOKEN;
  const datos = new TextEncoder().encode(USER + ":" + PASS + "|u5-staging-v1");
  const hash = await crypto.subtle.digest("SHA-256", datos);
  TOKEN = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return TOKEN;
}

// ¿Es una NAVEGACIÓN de nivel superior? Sólo ahí tiene sentido pintar el formulario.
//
// EL PREDICADO ES EXACTAMENTE ESTE, sin filtro por cliente: GET, y o bien lo dice
// \`Sec-Fetch-Mode\`, o bien el \`Accept\` PIDE html. No se mira el User-Agent. O sea que
// \`curl -H 'Accept: text/html'\` recibe el formulario igual que un navegador — y está
// bien que así sea: la propiedad que importa es «pide html», no «quién eres».
//
// 🔴 Lo que sostiene la sonda de «el staging sigue cerrado» (\`curl\` pelado ⇒ 401 con
// \`WWW-Authenticate\`) NO es una excepción para curl: no existe. Es que \`curl\` manda
// \`Accept: */*\` por defecto y cae en la otra rama. Es una propiedad del CLIENTE, no una
// garantía del portón, así que va PINEADA por dos tests en deploy-artifacts.test.ts
// (el del \`Accept\` comodín y el del \`Accept: text/html\`) en vez de vivir en este
// comentario. Si alguien cambia el default de su sonda, medirá otra cosa — y el test
// se lo dice por su nombre.
//
// 🔴 Y va en comentarios de LÍNEA a propósito: este texto vive DENTRO del módulo que se
// emite, y un \`/*…*/\` que contenga la secuencia asterisco-barra del comodín de \`Accept\`
// se CIERRA ahí — el resto del comentario pasa a ser código y el \`_worker.js\` no parsea.
// Pasó al escribirlo; lo cazaron los 11 rojos de deploy-artifacts.test.ts.
function esNavegacion(request) {
  if (request.method !== "GET") return false;
  if (request.headers.get("Sec-Fetch-Mode") === "navigate") return true;
  // Reserva para clientes sin Sec-Fetch-* (iOS viejo).
  return (request.headers.get("Accept") || "").includes("text/html");
}

function galleta(tok) {
  return COOKIE + "=" + tok + "; Path=/; Max-Age=" + MAX_AGE + "; HttpOnly; Secure; SameSite=Lax";
}

/**
 * La puerta con cerradura. Sale con 401 y noindex: no es una página pública, es el
 * MISMO rechazo de siempre, pintado de forma que una app instalada pueda contestarlo.
 */
function paginaLogin(destino, fallo) {
  const safe = String(destino).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const aviso = fallo ? '<p class="mal">Usuario o contrase\\u00f1a incorrectos.</p>' : "";
  return new Response(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
      '<meta name="robots" content="noindex,nofollow"><title>OpenU5 staging</title><style>' +
      "html,body{height:100%;margin:0;background:#000;color:#e8dcae;" +
      'font:16px "Courier New",monospace;display:flex;align-items:center;justify-content:center}' +
      "form{display:flex;flex-direction:column;gap:12px;width:min(320px,86vw);padding:24px;" +
      "border:2px solid #8a7434;border-radius:8px;background:rgba(12,8,4,.95)}" +
      "h1{margin:0;font-size:17px;color:#ffe9a8;letter-spacing:2px;text-align:center}" +
      "input{min-height:44px;font:16px inherit;padding:6px 10px;background:#1a1408;color:#ffe9a8;" +
      "border:1px solid #8a7434;border-radius:4px}" +
      "button{min-height:44px;font:bold 16px inherit;background:#2c2313;color:#ffe9a8;" +
      "border:2px solid #8a7434;border-radius:8px}" +
      ".mal{margin:0;color:#ff8080;font-size:14px;text-align:center}" +
      '</style></head><body><form method="POST" action="/__u5login">' +
      "<h1>OpenU5 staging</h1>" + aviso +
      '<input name="u" autocomplete="username" placeholder="Usuario" autocapitalize="off" ' +
      'autocorrect="off" spellcheck="false" required>' +
      '<input name="p" type="password" autocomplete="current-password" placeholder="Contrase\\u00f1a" required>' +
      '<input type="hidden" name="next" value="' + safe + '">' +
      '<button type="submit">Entrar</button></form></body></html>',
    { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": NOINDEX } },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tok = await token();
    const auth = request.headers.get("Authorization") || "";
    const conCabecera = auth === "Basic " + btoa(\`\${USER}:\${PASS}\`);
    const conCookie = (request.headers.get("Cookie") || "")
      .split(/;\\s*/)
      .includes(COOKIE + "=" + tok);

    // ── Envío del formulario. Es la ÚNICA vía nueva y sólo vive en esta ruta.
    if (request.method === "POST" && url.pathname === "/__u5login") {
      let u = "", p = "", next = "/";
      try {
        const f = await request.formData();
        u = f.get("u") || ""; p = f.get("p") || ""; next = f.get("next") || "/";
      } catch { /* cuerpo ilegible ⇒ credenciales vacías ⇒ falla abajo */ }
      if (u !== USER || p !== PASS) return paginaLogin("/", true);
      // Destino SIEMPRE relativo a este origen: un "next" externo sería un redirector
      // abierto colgado de una URL que cualquiera puede pedir.
      const destino = new URL(next, url.origin);
      const ruta = destino.origin === url.origin ? destino.pathname + destino.search : "/";
      return new Response(null, {
        status: 303,
        headers: { Location: ruta, "Set-Cookie": galleta(tok), "X-Robots-Tag": NOINDEX },
      });
    }

    // 🔴 /robots.txt SE SIRVE SIN AUTENTICAR, y es la única excepción al gate.
    //
    // POR QUÉ: la SEGUNDA CAPA (el \`Disallow: /\` de este staging) NO EXISTÍA. Medido el
    // 04-08 sobre lo SERVIDO: \`User-agent: *\` decía \`Allow: /\` —el bloque de Cloudflare
    // Managed Content— y NUESTRO bloque no aparecía por ninguna parte (0 líneas tras el
    // \`# END Cloudflare Managed Content\`). En el proyecto PÚBLICO, que no lleva worker,
    // sí sobrevive: 4 líneas nuestras tras ese mismo END. Ése es el contraste que adjudica
    // el mecanismo — Managed Content appendea el asset del origen, y aquí ese fetch se
    // topaba con el 401 de este worker, así que no appendeaba nada.
    //
    // O sea: tal como estaba cableado, LA CONTRASEÑA Y LA SEGUNDA CAPA ERAN MUTUAMENTE
    // EXCLUYENTES, y creíamos tener las dos.
    //
    // POR QUÉ ES SEGURO: un robots.txt que dice «no indexes nada» no revela contenido —
    // dice justo lo contrario de lo que un atacante quiere. Y el 401 sigue cubriendo TODO
    // lo demás (comprobado: \`/\`, \`/companion/\` y \`/play.html\` siguen dando 401).
    // Lo que se gana es que la capa que declarábamos por escrito pase a existir.
    if (url.pathname === "/robots.txt") {
      const rb = await env.ASSETS.fetch(request);
      const rout = new Response(rb.body, rb);
      rout.headers.set("X-Robots-Tag", NOINDEX);
      return rout;
    }

    if (!conCabecera && !conCookie) {
      // Navegación ⇒ puerta que se puede contestar DENTRO de la partición (iOS PWA).
      if (esNavegacion(request)) return paginaLogin(url.pathname + url.search, false);
      // Sub-recurso o herramienta ⇒ el 401 clásico, intacto.
      return new Response("Auth required", {
        status: 401,
        headers: { "WWW-Authenticate": REALM, "X-Robots-Tag": NOINDEX },
      });
    }

    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", NOINDEX);
    // Quien entró por cabecera se lleva también la cookie: así el resto de la
    // partición (sub-recursos incluidos) ya no depende de que el cliente la repita.
    if (!conCookie) out.headers.append("Set-Cookie", galleta(tok));
    return out;
  },
};
`;
}

export interface DeployArtifacts {
  /** Política emitida en robots.txt. */
  robots: "noindex" | "allow";
  /** ¿Se emitió el gate de staging? (false = faltaban credenciales en el entorno.) */
  worker: boolean;
}

/**
 * Escribe los artefactos en `distDir`. Devuelve qué se emitió para que quien llame
 * pueda decirlo por consola: un build sin gate debe ser VISIBLE, no silencioso.
 */
export function writeDeployArtifacts(
  distDir: string,
  env: Record<string, string | undefined> = process.env,
): DeployArtifacts {
  const allow = env.U5_ROBOTS === "allow";
  writeFileSync(path.join(distDir, "robots.txt"), allow ? ROBOTS_ALLOW : ROBOTS_NOINDEX);

  const user = env.U5_STAGING_USER;
  const pass = env.U5_STAGING_PASS;
  const worker = Boolean(user && pass);
  if (user && pass) {
    writeFileSync(path.join(distDir, "_worker.js"), stagingWorkerSource(user, pass));
  }
  return { robots: allow ? "allow" : "noindex", worker };
}
