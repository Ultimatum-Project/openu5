/**
 * TABLA DE RÉCORDS en `/byo`: verla, verificarla y subir la tuya.
 *
 * Diseño: carril 2 de `docs/superpowers/specs/2026-08-04-lanzamiento-e-instrumentacion-design.md`.
 * El formato de lo que viaja y su porqué están en `records-formato.ts`; el ancla y su
 * reconstrucción, en `records-ancla.ts` (chunk aparte). Aquí sólo hay pantalla.
 *
 * ── TRES DECISIONES DE PANTALLA, CON SU MOTIVO ──────────────────────────────────────────
 *
 * 1. 🔴 SIN PERMISO NO HAY BOTÓN DE SUBIR — y no un botón que avise al pulsarlo. El aviso
 *    de consentimiento promete que sin el permiso «Guardar mi partida» no se envía nada; un
 *    control que existe y pregunta después ya ha hecho creer que se puede. En su lugar se
 *    dice qué activa el permiso y se ofrece el panel REAL (`data-openu5-consent`), que es el
 *    mismo del pie de página y el único sitio donde se concede.
 *
 * 2. 🔴 NI UN CONTROL MUERTO (regla de esta pantalla, `partidas.ts`) NI UNA PETICIÓN AL VACÍO.
 *    Si el despliegue no tiene endpoints —hoy mismo, hasta que se cree la infraestructura—
 *    esta sección no se monta siquiera: lo decide `VITE_RECORDS_API` en el BUILD, igual que
 *    `VITE_POSTHOG_KEY` decide si existe la analítica (`game/src/web/arranque.ts:51`).
 *
 *    🔴 LA PRIMERA VERSIÓN LO DETECTABA SONDEANDO `/api/tabla`, Y LA BATERÍA LA PARÓ: en un
 *    sitio sin endpoints eso son 404 en la consola de CADA visitante, y salieron TRES por
 *    carga (`test_shot_sin_404_salvo_el_declarado` los listó uno a uno). La sonda además era
 *    la respuesta equivocada a la pregunta: en el sitio real, una ruta inexistente devuelve
 *    **200 con la home** (soft-404 global), así que ni siquiera habría dado 404 donde la
 *    respuesta importa. Se decide en el build, que es donde se sabe.
 *
 *    Lo que SÍ se conserva de aquella versión es la comprobación de FORMA de la respuesta
 *    (`pideTabla`): con la bandera puesta y el endpoint caído, sigue sin pintarse nada.
 *
 * 3. LA FILA DICE DE QUÉ ARRANCA Y CON QUÉ MOTOR, no sólo la cifra. Y «ver repetición» de un
 *    récord ajeno reconstruye el ancla desde TU copia y te dice si tu huella coincide con la
 *    publicada: si no coincide, lo que veas no prueba el récord, y se dice antes de abrirlo.
 */
import { listLogs, storeAvailable } from "../../game/src/replay/store.js";
import { getLog } from "../../game/src/replay/store.js";
import type { ReplayMeta } from "../../game/src/replay/types.js";
import {
  leerConsentimiento,
  permiteGuardarPartida,
} from "../../game/src/web/consentimiento.js";
import { FORMATO_RECORD, LIMITES, validaRecord, type RecordSubida } from "./records-formato.js";
import { txt } from "./idioma.js";

/** Una fila de la tabla, tal y como la sirve `GET /api/tabla`. */
interface FilaTabla {
  id: string;
  alias: string;
  baseId: string;
  anclaHash: string;
  motor: string;
  turnos: number;
  teclas: number;
  desenlaceReclamado: boolean;
  creado: number;
}

/** Lo inyecta `demo-byo/vite.config.ts` con el SHA corto del árbol construido. */
declare const __U5_BUILD__: string;

/**
 * Versión del motor que se declara al subir un récord.
 *
 * 🔴 SALE DEL BUILD Y NO SE INVENTA. Es uno de los cinco campos que hacen verificable una
 * fila: quien reproduce con OTRA versión del port puede diverger con toda la razón, y sin
 * esta etiqueta esa divergencia parecería un récord falso. Fuera del build (`npm run dev`,
 * vitest) vale `"dev"`, que es exactamente lo que es.
 *
 * 🔴 Y SE LEE EL IDENTIFICADOR PELADO, no `globalThis.__U5_BUILD__`: el `define` de vite
 * sustituye TEXTO, y una lectura por propiedad no la toca — el campo habría dicho «dev» en
 * producción para siempre, con pinta de estar funcionando.
 */
function versionMotor(): string {
  const v = typeof __U5_BUILD__ === "string" ? __U5_BUILD__ : "dev";
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(v) ? v : "dev";
}

function el(tag: string, cls: string, texto?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

function boton(rotulo: string, alPulsar: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "guardado__accion";
  b.textContent = rotulo;
  b.addEventListener("click", alPulsar);
  return b;
}

/** Consentimiento vivo. Almacén inaccesible ⇒ `null` ⇒ sin permiso (contrato del módulo). */
function permisoDePartida(): boolean {
  let almacen: Storage | null = null;
  try {
    almacen = localStorage;
  } catch {
    almacen = null;
  }
  return permiteGuardarPartida(leerConsentimiento(almacen));
}

/**
 * Prefijo de los endpoints, fijado en el BUILD. Vive en un módulo con estado porque lo
 * decide `main.ts` (que es quien lee el entorno) y lo usan las tres peticiones.
 */
let API = "";

/**
 * Pide la tabla. `null` = no hay tabla que pintar (la respuesta no es la nuestra, o la red
 * falló) ⇒ la sección entera no se pinta.
 *
 * 🔴 Se comprueba la FORMA de la respuesta y no sólo el `ok`: el sitio sirve un soft-404
 * (toda ruta inexistente devuelve 200 con la home), así que un `r.ok` a secas daría por
 * buena una página HTML. Lo que decide es que el JSON traiga un array `filas`.
 */
async function pideTabla(baseId?: string): Promise<FilaTabla[] | null> {
  try {
    const q = baseId ? `?base=${encodeURIComponent(baseId)}` : "";
    const r = await fetch(`${API}/tabla${q}`, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const d = (await r.json()) as { filas?: unknown };
    if (!Array.isArray(d.filas)) return null;
    return d.filas as FilaTabla[];
  } catch {
    return null;
  }
}

/**
 * Descarga un récord y lo VALIDA con el mismo predicado del servidor antes de tocarlo.
 *
 * No es desconfianza del servidor propio: es que el validador es el que define qué es un
 * récord, y pasarlo aquí también significa que un fichero descargado a mano, o servido por
 * un espejo, entra por la misma puerta. `null` si no llega o no valida.
 */
async function pideRecord(id: string): Promise<RecordSubida | null> {
  try {
    const r = await fetch(`${API}/partida/${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const v = validaRecord(await r.json());
    return v.ok ? v.record : null;
  } catch {
    return null;
  }
}

/** Estado de la sección: lo último que pasó, para pintarlo bajo la lista. */
let aviso = "";

/**
 * Sube la repetición local `meta` con el `alias` dado.
 *
 * El orden importa y es el del invariante: primero se identifica el ARRANQUE (que es lo que
 * puede impedir la subida), y sólo si hay uno reproducible se construye el payload — que por
 * construcción no tiene dónde meter el estado.
 */
async function sube(meta: ReplayMeta, alias: string): Promise<void> {
  const log = await getLog(meta.id);
  if (!log) {
    aviso = txt("recordSubirFallo", { motivo: "la repetición ya no está en este navegador" });
    return;
  }
  const ancla = await import("./records-ancla.js");
  let base: { id: string; huella: string } | null;
  try {
    base = await ancla.identificaBase(log);
  } catch (e) {
    aviso = txt(e instanceof ancla.SinCopia ? "recordSinCopia" : "recordSubirFallo", {
      motivo: e instanceof Error ? e.message : String(e),
    });
    return;
  }
  if (!base) {
    // El caso frecuente, y NO es un error: ver `identificaBase`.
    aviso = txt("recordArranqueNoPublico");
    return;
  }
  const payload: RecordSubida = {
    v: FORMATO_RECORD,
    alias,
    base: { tipo: "momento", id: base.id },
    anclaHash: base.huella,
    semilla: log.anchor.seed,
    keys: log.keys,
    turns: log.turns,
    mods: log.mods,
    count: log.count,
    lastTurn: log.lastTurn,
    motor: versionMotor(),
    desenlaceReclamado: false,
  };
  // Se valida ANTES de enviar, con el mismo módulo que valida el servidor: así un payload
  // mal formado se ve aquí, con el motivo, en vez de convertirse en un 400 opaco.
  const v = validaRecord(payload);
  if (!v.ok) {
    aviso = txt("recordSubirFallo", { motivo: v.motivo });
    return;
  }
  try {
    const r = await fetch(`${API}/partida`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
      aviso = txt("recordSubirFallo", { motivo: cuerpo.error ?? `HTTP ${r.status}` });
      return;
    }
    aviso = txt("recordSubido");
  } catch (e) {
    aviso = txt("recordSubirFallo", { motivo: e instanceof Error ? e.message : String(e) });
  }
}

/** Abre un récord ajeno por el MISMO camino que una repetición propia. */
async function ve(fila: FilaTabla, repinta: () => void): Promise<void> {
  const rec = await pideRecord(fila.id);
  if (!rec) {
    aviso = txt("recordDescargaFallo");
    repinta();
    return;
  }
  const ancla = await import("./records-ancla.js");
  let hecho;
  try {
    hecho = await ancla.reconstruyeRecord(rec, fila.id);
  } catch (e) {
    aviso = txt(e instanceof ancla.SinCopia ? "recordSinCopia" : "recordDescargaFallo", {
      motivo: e instanceof Error ? e.message : String(e),
    });
    repinta();
    return;
  }
  // La huella se dice ANTES de abrir, y se dice siempre: es la diferencia entre «esto prueba
  // el récord» y «esto es una película».
  aviso = txt(hecho.huellaCoincide ? "recordHuellaOk" : "recordHuellaDistinta");
  repinta();
  const { abreReplay } = await import("./popover-replay.js");
  abreReplay(hecho.idLocal, `${rec.alias} · ${txt("recordTurnos", { n: String(rec.lastTurn) })}`);
}

/** Las repeticiones de este navegador, para el bloque de subir. */
async function repeticionesLocales(): Promise<ReplayMeta[]> {
  if (!storeAvailable()) return [];
  try {
    return await listLogs();
  } catch {
    return [];
  }
}

/**
 * Monta la sección. Idempotente: se le vuelve a llamar al cambiar de idioma y tras cada
 * acción, y reconstruye desde cero (mismo contrato que `pintaPartidas`).
 *
 * `api` es el prefijo de los endpoints, que decide el BUILD (ver `main.ts`). Este módulo no
 * lo lee del entorno por su cuenta: quien decide si la tabla existe es quien monta.
 *
 * Devuelve `false` si no hay tabla — y entonces no deja NADA en `raiz`.
 */
export async function montaRecords(raiz: HTMLElement, api: string): Promise<boolean> {
  API = api.replace(/\/$/, "");
  const filas = await pideTabla();
  if (filas === null) {
    raiz.textContent = "";
    return false;
  }
  const locales = await repeticionesLocales();
  pinta(raiz, filas, locales);
  return true;
}

function pinta(raiz: HTMLElement, filas: FilaTabla[], locales: ReplayMeta[]): void {
  const repinta = (): void => pinta(raiz, filas, locales);
  raiz.textContent = "";
  const sec = el("section", "guardados");
  sec.appendChild(el("h3", "guardados__titulo", txt("recordsTitulo")));
  sec.appendChild(el("p", "guardados__que", txt("recordsQue")));

  if (filas.length === 0) {
    sec.appendChild(el("p", "guardados__vacio", txt("recordsVacio")));
  } else {
    const lista = el("ol", "guardados__lista");
    for (const f of filas) {
      const li = el("li", "guardado");
      const info = el("div", "guardado__info");
      info.appendChild(el("b", "guardado__nombre", f.alias));
      info.appendChild(
        el(
          "small",
          "guardado__meta",
          txt("recordMeta", {
            turnos: String(f.turnos),
            teclas: String(f.teclas),
            base: f.baseId,
            motor: f.motor,
          }),
        ),
      );
      // La huella publicada, VISIBLE y recortada: es lo que alguien compara a ojo con la
      // suya, y esconderla dejaría la palabra «verificable» sin nada detrás.
      info.appendChild(el("small", "guardado__meta", txt("recordHuella", { h: f.anclaHash.slice(0, 12) })));
      li.appendChild(info);
      li.appendChild(boton(txt("repeticionVer"), () => void ve(f, repinta)));
      // Enlace REAL al registro: se copia, se abre en otra pestaña y se guarda. Es la
      // materia prima de la verificación entre pares, y no debería exigir esta pantalla.
      const a = document.createElement("a");
      a.className = "guardado__accion";
      a.href = `${API}/partida/${f.id}`;
      a.textContent = txt("recordRegistro");
      li.appendChild(a);
      lista.appendChild(li);
    }
    sec.appendChild(lista);
  }

  // ── SUBIR ──────────────────────────────────────────────────────────────────────────
  const subir = el("div", "guardados__nota");
  if (!permisoDePartida()) {
    subir.appendChild(el("span", "", txt("recordSinPermiso") + " "));
    const permisos = document.createElement("a");
    permisos.href = "#";
    permisos.setAttribute("data-openu5-consent", ""); // el panel REAL, el del pie
    permisos.textContent = txt("misPermisos");
    subir.appendChild(permisos);
  } else if (locales.length === 0) {
    subir.appendChild(el("span", "", txt("recordSinRepeticiones")));
  } else {
    const alias = document.createElement("input");
    alias.type = "text";
    alias.maxLength = LIMITES.MAX_ALIAS;
    alias.placeholder = txt("recordAlias");
    alias.setAttribute("aria-label", txt("recordAlias"));
    subir.appendChild(alias);
    for (const m of locales) {
      const linea = el("div", "");
      linea.appendChild(el("span", "", `${m.label} · ${txt("recordTurnos", { n: String(m.lastTurn) })} `));
      linea.appendChild(
        boton(txt("recordSubir"), () => {
          const nombre = alias.value.trim();
          if (!nombre) {
            aviso = txt("recordAliasFalta");
            repinta();
            return;
          }
          aviso = txt("recordSubiendo");
          repinta();
          void sube(m, nombre).then(repinta);
        }),
      );
      subir.appendChild(linea);
    }
  }
  sec.appendChild(subir);
  if (aviso) sec.appendChild(el("p", "guardados__nota", aviso));
  raiz.appendChild(sec);
}
