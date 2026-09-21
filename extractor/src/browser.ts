/**
 * Wrapper de NAVEGADOR del extractor (demo BYO-files, Fase B de publicación).
 *
 * Corre el pipeline compartido (pipeline.ts) sobre los ficheros que el usuario
 * aporta (drag-and-drop de su carpeta ultima5/) y escribe los assets derivados
 * en Cache Storage bajo /assets/<ruta>, donde el service worker de la demo los
 * sirve al juego. Nada sale del navegador del usuario.
 *
 * REGLA: aquí no entra `node:*` — solo APIs web (Cache Storage, OffscreenCanvas,
 * WebCrypto). El PNG se codifica con OffscreenCanvas.convertToBlob.
 */
import {
  inspectSourceFiles,
  runPipeline,
  validateSourceFiles,
  type PipelineIO,
  type PipelineOptions,
  type SourceInspection,
} from "./pipeline.js";
import { ASSETS_PREFIX, BYO_CACHE } from "./assets-catalog.js";

/**
 * Nombre de la caché y prefijo de los assets. Viven en `assets-catalog.ts` y se
 * RE-EXPORTAN aquí (dos importadores históricos —`demo-byo/src/main.ts` y la prosa que
 * los cita como `browser.ts:22`— siguen valiendo). No se re-declaran: el arranque del
 * juego necesita el mismo nombre de caché para saber si los assets son de una extracción
 * del visitante o del servidor (#293), y dos literales iguales son dos verdades.
 *
 * 🔴 Y HAY COPIONES QUE NO PUEDEN IMPORTAR: `demo-byo/public/sw.js` es un service worker
 * sin bundler y lleva el literal A MANO; los arneses de `demo-byo/verificacion/*.mjs` y
 * tres módulos de `demo-byo/src` también lo escriben crudo (censo del 14-08: 4 en
 * demo-byo/src+public, 6 arneses). Ninguno tenía careo — y desde #293 esa divergencia
 * silencia el aviso entero: el juego miraría una caché que nadie llena. Lo carea ahora
 * `game/tests/extraccion-vigente.test.ts` sobre el fuente del SW y de demo-byo/src.
 */
export { ASSETS_PREFIX, BYO_CACHE };

/** Ficheros del usuario, KEY EN MAYÚSCULAS (GOG/innoextract varían el case). */
export type SourceFiles = Map<string, Uint8Array>;

/**
 * Aplana un drag-and-drop (DataTransferItemList) o un <input webkitdirectory>
 * a un mapa NOMBRE-EN-MAYÚSCULAS → bytes. Solo se queda con nombres de fichero
 * (ignora rutas: da igual si el usuario suelta la carpeta o su contenido).
 */
export async function collectFiles(files: Iterable<File>): Promise<SourceFiles> {
  const out: SourceFiles = new Map();
  for (const file of files) {
    const name = file.name.toUpperCase();
    // Los originales DOS relevantes son < 100 KB; corta payloads absurdos.
    if (file.size > 8 * 1024 * 1024) continue;
    out.set(name, new Uint8Array(await file.arrayBuffer()));
  }
  return out;
}

/** Tope del `.zip` que se acepta. Una copia real comprime a ~0,3 MB; 64 MB es holgado. */
const ZIP_MAX = 64 * 1024 * 1024;

/**
 * TERCER PRODUCTOR de `SourceFiles`: un `.zip` de la carpeta del usuario.
 *
 * ── POR QUÉ ESTO NO TOCA EL MOTOR ────────────────────────────────────────────────
 * El contrato de entrada del extractor es **un mapa plano NOMBRE→BYTES**. El
 * `<input webkitdirectory>` y el arrastrar-y-soltar son sólo DOS PRODUCTORES de ese
 * mapa; la validación, `extractToCache`, la caché y el service worker **no saben de
 * dónde salieron los bytes**. Un `.zip` es un tercer productor y nada más. Es la
 * decisión que parecía tocar el motor y llevaba semanas sin contestarse porque nadie
 * había mirado el tipo.
 *
 * ── POR QUÉ HACE FALTA, Y NO ES UNA COMODIDAD ────────────────────────────────────
 * **Ningún navegador de teléfono deja entregar una CARPETA** — sólo ficheros. Sin esta
 * vía, quien llega desde un móvil pulsa «elegir carpeta», no pasa nada útil y se va.
 *
 * ── 🔴 `DecompressionStream` NO SIRVE, Y NO ES UNA CUESTIÓN DE GUSTO ─────────────
 * Esa API implementa gzip/deflate — el **MÉTODO DE COMPRESIÓN**— y un `.zip` es un
 * **CONTENEDOR**: directorio central, cabeceras locales, nombres, offsets. Por esa vía
 * hay que escribir el parseo a mano (~150 líneas). Confundir método con contenedor ya
 * hizo perder una vuelta a este encargo; no se reintroduce al buscar «sin dependencia».
 *
 * ── CARGA PEREZOSA, y qué la mantiene honesta ────────────────────────────────────
 * El `await import()` está DENTRO de la función a propósito: quien suelta una carpeta
 * —la mayoría— no paga ni un byte del descompresor. Si alguien mueve este import al
 * principio del módulo, el corte desaparece **sin que nada falle**: se nota sólo como
 * un bundle más gordo. Por eso la cifra se mide en el build, no se supone.
 */
export async function collectZip(file: File): Promise<SourceFiles> {
  if (file.size > ZIP_MAX) {
    throw new Error(`el zip mide ${file.size} B; el tope es ${ZIP_MAX} B`);
  }
  // 🔴 IMPORT DINÁMICO: éste es el corte perezoso. No lo subas al principio del fichero.
  const { unzipSync } = await import("fflate");
  const bytes = new Uint8Array(await file.arrayBuffer());
  // `unzipSync` de la 0.4.x acepta UN solo argumento (la 0.8 añadió un segundo con
  // filtro). Se usa la forma de un argumento porque compila contra las dos.
  const entradas = unzipSync(bytes);

  const out: SourceFiles = new Map();
  for (const [ruta, datos] of Object.entries(entradas)) {
    // Las carpetas viajan como entradas de 0 bytes acabadas en «/».
    if (ruta.endsWith("/") || datos.length === 0) continue;
    // MISMA NORMALIZACIÓN que `collectFiles`: sólo el nombre, en mayúsculas. Da igual
    // que el zip lleve dentro `ultima5/BRIT.DAT` o `BRIT.DAT` — y da igual el case,
    // que GOG e innoextract varían.
    const nombre = ruta.slice(ruta.lastIndexOf("/") + 1).toUpperCase();
    if (!nombre) continue;
    if (datos.length > 8 * 1024 * 1024) continue; // el mismo corte que collectFiles
    out.set(nombre, datos);
  }
  return out;
}

/** ¿Este fichero es un `.zip`? Por NOMBRE: el `type` del navegador no es de fiar. */
export function esZip(file: File): boolean {
  return file.name.toLowerCase().endsWith(".zip");
}

/** Recorre recursivamente entradas de DataTransfer (webkitGetAsEntry). */
export async function collectDropped(items: DataTransferItemList): Promise<SourceFiles> {
  const files: File[] = [];
  const walkEntry = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) =>
        (entry as FileSystemFileEntry).file(res, rej),
      );
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries entrega por lotes de ≤100: iterar hasta lote vacío.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
          reader.readEntries(res, rej),
        );
        if (batch.length === 0) break;
        for (const child of batch) await walkEntry(child);
      }
    }
  };
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  for (const entry of entries) await walkEntry(entry);
  return collectFiles(files);
}

function makeIo(
  src: SourceFiles,
  cache: Cache,
  written: Map<string, Uint8Array | Blob>,
  log: (msg: string) => void,
): PipelineIO {
  const put = async (path: string, body: Blob | string | Uint8Array, type: string) => {
    const blob = body instanceof Blob ? body : new Blob([body as BlobPart], { type });
    if (body instanceof Blob || body instanceof Uint8Array) written.set(path, body);
    else written.set(path, new TextEncoder().encode(body));
    await cache.put(
      new Request(ASSETS_PREFIX + path),
      new Response(blob, { headers: { "Content-Type": type } }),
    );
  };
  return {
    read: (name) => {
      const bytes = src.get(name.toUpperCase());
      if (!bytes) throw new Error(`falta ${name}`);
      return bytes;
    },
    exists: (name) => src.has(name.toUpperCase()),
    putJson: (path, value) => put(path, JSON.stringify(value), "application/json"),
    putPng: async (path, rgba, width, height) => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("OffscreenCanvas 2d no disponible");
      ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
      const blob = await canvas.convertToBlob({ type: "image/png" });
      await put(path, blob, "image/png");
    },
    putBin: (path, bytes) => put(path, bytes, "application/octet-stream"),
    log,
  };
}

/** Adapta un `SourceFiles` a lo que piden los validadores del pipeline. */
function ioDe(src: SourceFiles): Pick<PipelineIO, "read" | "exists"> {
  return {
    read: (name) => src.get(name.toUpperCase()) ?? new Uint8Array(),
    exists: (name) => src.has(name.toUpperCase()),
  };
}

/** Valida los ficheros aportados; devuelve problemas (vacío = OK). */
export function validateSource(src: SourceFiles): string[] {
  return validateSourceFiles(ioDe(src));
}

/**
 * Mira los ficheros aportados y devuelve QUÉ falla, separado por clase: lo que no
 * está y lo que está con otro tamaño. La interfaz de /byo necesita la distinción —
 * son dos situaciones con dos siguientes pasos distintos. Ver `SourceInspection`.
 */
export function inspectSource(src: SourceFiles): SourceInspection {
  return inspectSourceFiles(ioDe(src));
}

export type { SourceInspection, SizeMismatch } from "./pipeline.js";

/**
 * Extracción completa en el navegador → Cache Storage. Devuelve el número de
 * assets escritos. La música se omite (QoL; el DOS era mudo).
 */
export async function extractToCache(
  src: SourceFiles,
  log: (msg: string) => void = () => {},
  opts: PipelineOptions = {},
): Promise<number> {
  return extractToNamedCache(src, BYO_CACHE, log, opts);
}

/** Ultimatum staging seam: writes a complete extraction to an unpublished cache. */
export async function extractToNamedCache(
  src: SourceFiles,
  cacheName: string,
  log: (msg: string) => void = () => {},
  opts: PipelineOptions = {},
): Promise<number> {
  if (cacheName !== BYO_CACHE && !/^ultimatum-u5-install-generation-[a-zA-Z0-9-]{8,80}$/.test(cacheName)) {
    throw new Error("nombre de generación de Ultimatum no válido");
  }
  const cache = await caches.open(cacheName);
  const written = new Map<string, Uint8Array | Blob>();
  await runPipeline(makeIo(src, cache, written, log), opts);

  // Manifest (mismo formato que el CLI) — sha-256 vía WebCrypto.
  log("• Manifest…");
  const files: Record<string, string> = {};
  for (const [path, body] of written) {
    const bytes =
      body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : body;
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    files[path] = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  await cache.put(
    new Request(ASSETS_PREFIX + "manifest.json"),
    new Response(
      JSON.stringify({ version: 1, generated: new Date().toISOString(), files }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );
  return written.size + 1;
}

/**
 * ¿Hay una extracción completa previa? (ancla: manifest presente en cache).
 *
 * 🔴 SE PREGUNTA ANTES SI LA CACHÉ EXISTE, y no es una micro-optimización: `caches.open()`
 * **CREA** la caché si no está. Esto es una LECTURA, y una lectura que escribe convertía a
 * todo el que abría `/byo` —sin haber soltado nada— en dueño de un `u5-assets-v1` vacío; y
 * peor, resucitaba la caché JUSTO DESPUÉS de «Borrar datos locales», porque el repintado de
 * la lista vuelve a llamar aquí. Medido en `verifica-momentos-navegador.mjs`: tras el
 * borrado, `caches.keys()` volvía a listar `u5-assets-v1`, así que el rótulo «no queda nada»
 * convivía con una caché nuestra recién nacida.
 */
export async function hasExtraction(): Promise<boolean> {
  if (!("caches" in globalThis)) return false;
  try {
    const controlName = "ultimatum-install-control-v1";
    const pointerPath = "/__ultimatum/games/ultima5/active-install.json";
    if (await caches.has(controlName)) {
      const control = await caches.open(controlName);
      const response = await control.match(pointerPath);
      if (response) {
        const pointer = await response.clone().json() as { cacheName?: unknown };
        const name = typeof pointer?.cacheName === "string" ? pointer.cacheName : "";
        if ((name === BYO_CACHE || /^ultimatum-u5-install-generation-[a-zA-Z0-9-]{8,80}$/.test(name)) && await caches.has(name)) {
          const active = await caches.open(name);
          if (await active.match(ASSETS_PREFIX + "manifest.json")) return true;
        }
      }
    }
  } catch {
    // Preserve the original OpenU5 fallback when platform metadata is unreadable.
  }
  if (!(await caches.has(BYO_CACHE))) return false;
  const cache = await caches.open(BYO_CACHE);
  return (await cache.match(ASSETS_PREFIX + "manifest.json")) !== undefined;
}

/** Borra la extracción (para re-extraer con otra copia o tras un upgrade). */
export async function clearExtraction(): Promise<void> {
  await caches.delete(BYO_CACHE);
}
