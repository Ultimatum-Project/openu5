/**
 * Artefactos de despliegue (game/tools/deploy-artifacts.ts): el reemplazo de la
 * regla-de-prosa «reponer _worker.js + robots.txt tras cada build» por algo que el
 * build hace solo. Lo que se sella aquí es el régimen de los DOS destinos: noindex
 * siempre, y el gate basic-auth SÓLO con credenciales de entorno (nunca del repo).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeDeployArtifacts, stagingWorkerSource } from "../tools/deploy-artifacts.js";

let dist: string;
const read = (f: string) => readFileSync(path.join(dist, f), "utf-8");

beforeEach(() => {
  dist = mkdtempSync(path.join(tmpdir(), "u5-dist-"));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

describe("writeDeployArtifacts", () => {
  it("sin credenciales: robots.txt noindex y NINGÚN _worker.js", () => {
    const out = writeDeployArtifacts(dist, {});
    expect(out).toEqual({ robots: "noindex", worker: false });
    expect(read("robots.txt")).toContain("Disallow: /");
    expect(existsSync(path.join(dist, "_worker.js"))).toBe(false);
  });

  it("con credenciales: emite el gate con esas credenciales y noindex en la cabecera", () => {
    const out = writeDeployArtifacts(dist, {
      U5_STAGING_USER: "ultima",
      U5_STAGING_PASS: "s3cr3t",
    });
    expect(out).toEqual({ robots: "noindex", worker: true });
    const worker = read("_worker.js");
    expect(worker).toContain('const USER = "ultima"');
    expect(worker).toContain('const PASS = "s3cr3t"');
    expect(worker).toContain("WWW-Authenticate");
    expect(worker).toContain("noindex, nofollow");
  });

  it("credenciales A MEDIAS ⇒ no se emite el gate (mejor sin fichero que con uno inservible)", () => {
    expect(writeDeployArtifacts(dist, { U5_STAGING_USER: "ultima" }).worker).toBe(false);
    expect(writeDeployArtifacts(dist, { U5_STAGING_PASS: "s3cr3t" }).worker).toBe(false);
    expect(existsSync(path.join(dist, "_worker.js"))).toBe(false);
  });

  it("U5_ROBOTS=allow invierte la política (un fork no se desindexa en silencio)", () => {
    const out = writeDeployArtifacts(dist, { U5_ROBOTS: "allow" });
    expect(out.robots).toBe("allow");
    expect(read("robots.txt")).toContain("Allow: /");
    expect(read("robots.txt")).not.toContain("Disallow");
  });

  it("la credencial va SERIALIZADA: comillas o backslash no rompen el módulo emitido", () => {
    const src = stagingWorkerSource('u"ser', "pa\\ss`x");
    expect(src).toContain('const USER = "u\\"ser"');
    expect(src).toContain('const PASS = "pa\\\\ss`x"');
    // El módulo emitido tiene que ser JS válido (aquí: parseable como función).
    expect(() => new Function(src.replace(/^export default/m, "return"))).not.toThrow();
  });
});

/**
 * EL PORTÓN, EJECUTADO. Los asertos de arriba miran el TEXTO del módulo emitido; estos
 * lo IMPORTAN y le pasan peticiones de verdad, que es la única forma de sellar una
 * política de acceso (un `toContain("WWW-Authenticate")` sigue verde aunque la rama que
 * la emite se haya vuelto inalcanzable).
 *
 * Lo que se sella es el defecto que los motivó: el icono de «Añadir a inicio» de iOS
 * arrancaba en NEGRO. En iOS esa app corre en una partición de almacenamiento propia
 * (WebKit 181849), así que no lleva la credencial que Safari sí tiene guardada, y sin
 * barra de navegador no hay diálogo donde teclearla: la navegación se quedaba en un 401
 * `text/plain` que la app instalada no pinta. La cookie NO basta por sí sola (está
 * particionada igual); lo que hace falta es poder autenticarse DENTRO de la partición,
 * y por eso una navegación sin llave recibe un formulario en vez de un desafío.
 */
describe("el portón de staging, ejecutado", () => {
  const USER = "ultima";
  const PASS = "s3cr3t";
  const BASE = "https://staging.example/";

  /** Importa el módulo generado tal cual (data: URL ⇒ ES module de verdad, no eval). */
  async function porton(user = USER, pass = PASS) {
    const src = stagingWorkerSource(user, pass);
    const url = "data:text/javascript;base64," + Buffer.from(src, "utf-8").toString("base64");
    const mod = await import(/* @vite-ignore */ url);
    // ASSETS de mentira: devuelve una marca reconocible, para distinguir «pasó el
    // portón» de «el portón contestó él mismo».
    const env = { ASSETS: { fetch: async () => new Response("EL SITIO", { status: 200 }) } };
    return (req: Request) => mod.default.fetch(req, env) as Promise<Response>;
  }

  const navegacion = (ruta = "/", headers: Record<string, string> = {}) =>
    new Request(new URL(ruta, BASE), {
      headers: { "Sec-Fetch-Mode": "navigate", Accept: "text/html", ...headers },
    });
  const subrecurso = (ruta: string, headers: Record<string, string> = {}) =>
    new Request(new URL(ruta, BASE), { headers: { Accept: "*/*", ...headers } });
  const basica = () => "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
  const cookieDe = (res: Response): string => {
    const sc = res.headers.getSetCookie()[0] ?? "";
    return sc.split(";")[0] ?? "";
  };

  it("NAVEGACIÓN sin llave ⇒ formulario HTML tecleable (el caso del icono de iOS)", async () => {
    const res = await (await porton())(navegacion());
    const cuerpo = await res.text();
    // Sigue siendo un RECHAZO (401 + noindex): la puerta tiene cerradura, no es un boquete.
    expect(res.status).toBe(401);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(cuerpo).toContain('action="/__u5login"');
    expect(cuerpo).toContain('type="password"');
    // Y con viewport: el 401 `text/plain` de antes se maquetaba a 980 px en el teléfono.
    expect(cuerpo).toContain("width=device-width");
    // Ni un byte del sitio.
    expect(cuerpo).not.toContain("EL SITIO");
    // El desafío nativo NO va en la navegación: es justo lo que en standalone no se
    // puede contestar, y dejarlo haría que el navegador tapase el formulario.
    expect(res.headers.get("WWW-Authenticate")).toBeNull();
  });

  // EL PREDICADO, PINEADO POR LOS DOS LADOS. El portón NO filtra por cliente: reparte
  // formulario a quien PIDE html, sea quien sea. Lo que sostiene la sonda de «el staging
  // sigue cerrado» (`curl` pelado ⇒ 401 con `WWW-Authenticate`) es que `curl` manda el
  // `Accept` comodín por defecto — una propiedad del CLIENTE, no una garantía del portón.
  // El comentario de `esNavegacion` llegó a decir «que pida html y no sea curl»,
  // describiendo un filtro que no existe; el lead casi lo reporta como defecto. Estos dos
  // tests dejan la frontera donde de verdad está, para no tener que creerse una prosa.
  it("el reparto va por el Accept, NO por el cliente: comodín ⇒ 401 clásico", async () => {
    const res = await (await porton())(
      new Request(new URL("/", BASE), { headers: { Accept: "*/*", "User-Agent": "curl/8.7.1" } }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe('Basic realm="OpenU5 staging"');
    expect(await res.text()).toBe("Auth required");
  });

  it("el reparto va por el Accept, NO por el cliente: `text/html` ⇒ formulario, curl incluido", async () => {
    const res = await (await porton())(
      new Request(new URL("/", BASE), { headers: { Accept: "text/html", "User-Agent": "curl/8.7.1" } }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain('action="/__u5login"');
  });

  it("SUB-RECURSO sin llave ⇒ el 401 clásico con WWW-Authenticate, intacto", async () => {
    const res = await (await porton())(subrecurso("/assets/index.js"));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe('Basic realm="OpenU5 staging"');
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(await res.text()).toBe("Auth required");
  });

  it("la cabecera Authorization sigue abriendo (curl -u, wrangler, arneses) y deja cookie", async () => {
    const res = await (await porton())(navegacion("/", { Authorization: basica() }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("EL SITIO");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(cookieDe(res)).toMatch(/^u5staging=[0-9a-f]{64}$/);
  });

  it("la cookie sola abre — y una cookie con token FALSO no", async () => {
    const f = await porton();
    const buena = cookieDe(await f(navegacion("/", { Authorization: basica() })));
    expect((await f(subrecurso("/assets/x.js", { Cookie: buena }))).status).toBe(200);
    expect((await f(subrecurso("/assets/x.js", { Cookie: "u5staging=" + "0".repeat(64) }))).status).toBe(401);
  });

  it("el token depende de LAS credenciales: la cookie de otro staging no vale aquí", async () => {
    const mia = cookieDe(await (await porton())(navegacion("/", { Authorization: basica() })));
    const otra = await porton("otro", "otra-clave");
    expect((await otra(subrecurso("/assets/x.js", { Cookie: mia }))).status).toBe(401);
  });

  it("login CORRECTO ⇒ 303 a la ruta pedida + cookie; login FALLIDO ⇒ formulario sin cookie", async () => {
    const f = await porton();
    const enviar = (u: string, p: string, next: string) =>
      f(new Request(new URL("/__u5login", BASE), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ u, p, next }).toString(),
      }));

    const ok = await enviar(USER, PASS, "/?nointro&lang=es");
    expect(ok.status).toBe(303);
    expect(ok.headers.get("Location")).toBe("/?nointro&lang=es");
    expect(cookieDe(ok)).toMatch(/^u5staging=[0-9a-f]{64}$/);
    // La cookie que reparte el login es la MISMA que abre el sitio.
    expect((await f(subrecurso("/assets/x.js", { Cookie: cookieDe(ok) }))).status).toBe(200);

    const mal = await enviar(USER, "no-es", "/");
    expect(mal.status).toBe(401);
    expect(mal.headers.getSetCookie()).toEqual([]);
    expect(await mal.text()).toContain("incorrectos");
  });

  it("el `next` del login NO es un redirector abierto", async () => {
    const res = await (await porton())(
      new Request(new URL("/__u5login", BASE), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ u: USER, p: PASS, next: "https://evil.example/x" }).toString(),
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/");
  });

  it("la ruta del login NO es una puerta trasera: sin credenciales no abre nada", async () => {
    const f = await porton();
    // GET a la ruta del login = navegación cualquiera ⇒ formulario, no sitio.
    expect(await (await f(navegacion("/__u5login"))).text()).not.toContain("EL SITIO");
    // POST con el cuerpo vacío tampoco.
    const vacio = await f(new Request(new URL("/__u5login", BASE), { method: "POST" }));
    expect(vacio.status).toBe(401);
    expect(vacio.headers.getSetCookie()).toEqual([]);
  });
});
