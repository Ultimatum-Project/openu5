/**
 * LOS TRES ENDPOINTS de la tabla de récords, ejecutados de verdad y sin red.
 *
 * Sujeto: `demo-byo/functions/api/**` + `demo-byo/src/records-servidor.ts`.
 *
 * ── EL D1 DE ESTE TEST ES SQLite DE VERDAD ──────────────────────────────────────────────
 * 🔴 Y ésa es la diferencia entre probar los endpoints y probar un doble. Un doble que
 * devuelve filas ya ordenadas daría VERDE con la consulta mal escrita: el `ORDER BY` no lo
 * habría ejecutado nadie. Aquí el binding envuelve `node:sqlite`, se crea la tabla con EL
 * FICHERO DE ESQUEMA que se despliega (`demo-byo/records-esquema.sql`, leído del disco), y
 * el SQL de producción se ejecuta tal cual. Lo que queda fuera es lo que sólo D1 tiene
 * (latencia, límites, tipos propios), y eso se ve en el paso 7 del despliegue.
 *
 * KV sí es un doble —un `Map`— porque su contrato es literalmente `get`/`put`.
 */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequest as sube } from "../../demo-byo/functions/api/partida/index.js";
import { onRequest as baja } from "../../demo-byo/functions/api/partida/[id].js";
import { onRequest as tabla } from "../../demo-byo/functions/api/tabla.js";
import {
  FORMATO_RECORD,
  LIMITES,
  canonizaRecord,
  type RecordSubida,
} from "../../demo-byo/src/records-formato.js";
import type { EntornoRecords, KvRecords } from "../../demo-byo/src/records-servidor.js";
import { encodeEvents } from "../src/replay/codec.js";
import type { ReplayEvent } from "../src/replay/types.js";

const ESQUEMA = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../demo-byo/records-esquema.sql",
);

/** KV en memoria. Guarda también el TTL para poder mirarlo (lo usa el limitador). */
class KvMemoria implements KvRecords {
  readonly datos = new Map<string, string>();
  readonly ttl = new Map<string, number>();
  get(clave: string): Promise<string | null> {
    return Promise.resolve(this.datos.get(clave) ?? null);
  }
  put(clave: string, valor: string, opciones?: { expirationTtl?: number }): Promise<void> {
    this.datos.set(clave, valor);
    if (opciones?.expirationTtl) this.ttl.set(clave, opciones.expirationTtl);
    return Promise.resolve();
  }
}

/** Binding de D1 sobre SQLite real. `fallaAlEscribir` sirve para el test del orden. */
class D1Sqlite {
  readonly db = new DatabaseSync(":memory:");
  fallaAlEscribir = false;
  constructor() {
    this.db.exec(readFileSync(ESQUEMA, "utf8"));
  }
  prepare(sql: string) {
    const db = this.db;
    const falla = () => this.fallaAlEscribir;
    const hacer = (args: unknown[]) => ({
      bind: (...mas: unknown[]) => hacer([...args, ...mas]),
      run: () => {
        if (falla()) return Promise.reject(new Error("D1 caído"));
        db.prepare(sql).run(...(args as never[]));
        return Promise.resolve({});
      },
      all: <T,>() => Promise.resolve({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    });
    return hacer([]);
  }
}

function entorno(sal?: string): EntornoRecords & { kv: KvMemoria; d1: D1Sqlite } {
  const kv = new KvMemoria();
  const d1 = new D1Sqlite();
  return { RECORDS_KV: kv, RECORDS_DB: d1, RECORDS_SAL: sal, kv, d1 };
}

function eventos(n: number, saltoTurno = 1): ReplayEvent[] {
  const out: ReplayEvent[] = [];
  for (let i = 0; i < n; i++) out.push({ key: "ArrowUp", turn: (i + 1) * saltoTurno });
  return out;
}

function record(campos: Partial<RecordSubida> = {}, n = 12): RecordSubida {
  const evs = eventos(n);
  const s = encodeEvents(evs);
  return {
    v: FORMATO_RECORD,
    alias: "Kokoima",
    base: { tipo: "momento", id: "01-fuga" },
    anclaHash: "b".repeat(64),
    semilla: 7,
    keys: s.keys,
    turns: s.turns,
    mods: s.mods,
    count: evs.length,
    lastTurn: evs[evs.length - 1]!.turn,
    motor: "0f92f03d",
    desenlaceReclamado: false,
    ...campos,
  };
}

function peticionSubida(cuerpo: unknown, cabeceras: Record<string, string> = {}): Request {
  return new Request("https://openu5.org/api/partida", {
    method: "POST",
    headers: { "content-type": "application/json", ...cabeceras },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

describe("POST /api/partida", () => {
  let env: ReturnType<typeof entorno>;
  beforeEach(() => {
    env = entorno();
  });

  it("guarda el récord y devuelve 201 con su URL", async () => {
    const r = await sube({ request: peticionSubida(record()), env });
    expect(r.status).toBe(201);
    const { id, url } = (await r.json()) as { id: string; url: string };
    expect(id).toMatch(/^[0-9a-f]{20}$/);
    expect(url).toBe(`/api/partida/${id}`);
    expect(r.headers.get("location")).toBe(url);
    expect(env.kv.datos.get(`rec:${id}`)).toBe(canonizaRecord(record()));
    const filas = env.d1.db.prepare("SELECT * FROM records").all() as Record<string, unknown>[];
    expect(filas).toHaveLength(1);
    expect(filas[0]!["turnos"]).toBe(12);
    expect(filas[0]!["identidad_tipo"]).toBe("anonima");
    expect(filas[0]!["identidad_sub"]).toBe(null);
  });

  it("subir dos veces lo mismo es idempotente: mismo id y una sola fila", async () => {
    const a = (await (await sube({ request: peticionSubida(record()), env })).json()) as { id: string };
    const b = (await (await sube({ request: peticionSubida(record()), env })).json()) as { id: string };
    expect(b.id).toBe(a.id);
    const n = env.d1.db.prepare("SELECT COUNT(*) c FROM records").get() as { c: number };
    expect(n.c).toBe(1);
  });

  it("🔴 rechaza una repetición local entera, nombrando el campo del ancla", async () => {
    const log = {
      ...record(),
      id: "replay-x",
      label: "mía",
      createdAt: 1,
      anchor: { state: '{"characters":[{"name":"Shamino","strength":21}]}', seed: 3 },
    };
    const r = await sube({ request: peticionSubida(log), env });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toContain("anchor");
    expect(env.kv.datos.size).toBe(0);
  });

  it("🔴 un .gam crudo no pasa ni de la puerta del JSON, y no deja rastro", async () => {
    const gam = Array.from({ length: 512 }, (_, i) => String.fromCharCode((i * 7) % 256)).join("");
    const r = await sube({ request: peticionSubida(gam), env });
    expect(r.status).toBe(400);
    expect(env.kv.datos.size).toBe(0);
    const n = env.d1.db.prepare("SELECT COUNT(*) c FROM records").get() as { c: number };
    expect(n.c).toBe(0);
  });

  it("415 si no viene como JSON, 405 si no es POST", async () => {
    const r1 = await sube({ request: peticionSubida(record(), { "content-type": "text/plain" }), env });
    expect(r1.status).toBe(415);
    const r2 = await sube({
      request: new Request("https://openu5.org/api/partida", { method: "GET" }),
      env,
    });
    expect(r2.status).toBe(405);
    expect(r2.headers.get("allow")).toBe("POST");
  });

  it("413 por la cabecera declarada Y por el cuerpo real", async () => {
    // (a) la cabecera miente hacia arriba: se corta antes de leer.
    const conCabecera = new Request("https://openu5.org/api/partida", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(LIMITES.MAX_BYTES + 1) },
      body: JSON.stringify(record()),
    });
    expect((await sube({ request: conCabecera, env })).status).toBe(413);
    // (b) sin cabecera fiable, decide el cuerpo medido. Un stream de 300 000 teclas pasa
    //     de MAX_BYTES aunque cada tecla cueste poco.
    const enorme = record({}, 300_000);
    const r = await sube({ request: peticionSubida(enorme), env });
    expect(r.status).toBe(413);
  });

  it("limita a MAX_SUBIDAS_HORA por IP, y sólo si hay sal", async () => {
    const conSal = entorno("sal-de-prueba");
    const cabeceras = { "CF-Connecting-IP": "203.0.113.9" };
    for (let i = 0; i < LIMITES.MAX_SUBIDAS_HORA; i++) {
      const r = await sube({ request: peticionSubida(record({}, 10 + i), cabeceras), env: conSal });
      expect(r.status).toBe(201);
    }
    const pasado = await sube({ request: peticionSubida(record({}, 99), cabeceras), env: conSal });
    expect(pasado.status).toBe(429);
    // La clave del contador NO contiene la IP en claro, y caduca sola.
    const claves = [...conSal.kv.datos.keys()].filter((k) => k.startsWith("rl:"));
    expect(claves).toHaveLength(1);
    expect(claves[0]).not.toContain("203.0.113.9");
    expect(conSal.kv.ttl.get(claves[0]!)).toBe(7200);
    // Sin sal no hay limitador (y tampoco hay hash de IP guardado).
    const sinSal = entorno();
    for (let i = 0; i < LIMITES.MAX_SUBIDAS_HORA + 1; i++) {
      const r = await sube({ request: peticionSubida(record({}, 10 + i), cabeceras), env: sinSal });
      expect(r.status).toBe(201);
    }
    expect([...sinSal.kv.datos.keys()].filter((k) => k.startsWith("rl:"))).toHaveLength(0);
  });

  /**
   * 🔴 EL ORDEN DE LOS DOS ALMACENES, medido por su modo de fallo. Con D1 caído tiene que
   * quedar el registro en KV y NINGUNA fila: un récord invisible es recuperable, una fila
   * cuyo «ver repetición» da 404 es una promesa rota en la cara del visitante.
   */
  it("si D1 falla, queda el registro en KV y NINGUNA fila en la tabla", async () => {
    env.d1.fallaAlEscribir = true;
    await expect(sube({ request: peticionSubida(record()), env })).rejects.toThrow("D1 caído");
    expect([...env.kv.datos.keys()].filter((k) => k.startsWith("rec:"))).toHaveLength(1);
    const n = env.d1.db.prepare("SELECT COUNT(*) c FROM records").get() as { c: number };
    expect(n.c).toBe(0);
  });
});

describe("GET /api/partida/:id", () => {
  it("devuelve BYTE A BYTE lo que se validó, y cachea como inmutable", async () => {
    const env = entorno();
    const { id } = (await (await sube({ request: peticionSubida(record()), env })).json()) as { id: string };
    const r = await baja({
      request: new Request(`https://openu5.org/api/partida/${id}`),
      env,
      params: { id },
    });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(canonizaRecord(record()));
    expect(r.headers.get("cache-control")).toContain("immutable");
  });

  it("404 para un id que no existe y para uno que ni siquiera tiene nuestra forma", async () => {
    const env = entorno();
    for (const id of ["0".repeat(20), "../../etc/passwd", "no-es-un-id"]) {
      const r = await baja({
        request: new Request("https://openu5.org/api/partida/x"),
        env,
        params: { id },
      });
      expect(r.status).toBe(404);
    }
  });
});

describe("GET /api/tabla", () => {
  /** Siembra récords con turnos distintos; devuelve los ids en el orden en que se subieron. */
  async function siembra(env: EntornoRecords, turnos: number[], baseId = "01-fuga"): Promise<void> {
    for (const t of turnos) {
      const r = await sube({
        request: peticionSubida(record({ base: { tipo: "momento", id: baseId }, alias: `A${t}` }, t)),
        env,
      });
      expect(r.status).toBe(201);
    }
  }
  const pide = (env: EntornoRecords, q = "") =>
    tabla({ request: new Request(`https://openu5.org/api/tabla${q}`), env });

  it("ordena por TURNOS ascendente: el mejor récord primero", async () => {
    const env = entorno();
    await siembra(env, [40, 12, 25]);
    const d = (await (await pide(env)).json()) as { filas: { turnos: number; alias: string }[] };
    expect(d.filas.map((f) => f.turnos)).toEqual([12, 25, 40]);
  });

  it("cada fila publica con qué comprobarla: huella, base y motor", async () => {
    const env = entorno();
    await siembra(env, [12]);
    const d = (await (await pide(env)).json()) as { filas: Record<string, unknown>[] };
    const f = d.filas[0]!;
    expect(f["anclaHash"]).toBe("b".repeat(64));
    expect(f["baseId"]).toBe("01-fuga");
    expect(f["motor"]).toBe("0f92f03d");
    // 🔴 el nombre del campo lleva el «reclamado» dentro: el servidor no comprobó nada.
    expect(Object.keys(f)).toContain("desenlaceReclamado");
    expect(Object.keys(f)).not.toContain("desenlace");
  });

  it("filtra por momento: no se comparan arranques distintos", async () => {
    const env = entorno();
    await siembra(env, [12, 30], "01-fuga");
    await siembra(env, [5], "07-doom");
    const d = (await (await pide(env, "?base=07-doom")).json()) as { filas: { turnos: number }[] };
    expect(d.filas.map((f) => f.turnos)).toEqual([5]);
  });

  it("pagina por CLAVE y el cursor lo compone el servidor", async () => {
    const env = entorno();
    await siembra(env, [10, 20, 30]);
    const p1 = (await (await pide(env, "?limite=2")).json()) as {
      filas: { turnos: number }[];
      siguiente: string;
    };
    expect(p1.filas.map((f) => f.turnos)).toEqual([10, 20]);
    const p2 = (await (await pide(env, `?limite=2&desde=${p1.siguiente}`)).json()) as {
      filas: { turnos: number }[];
    };
    expect(p2.filas.map((f) => f.turnos)).toEqual([30]);
  });

  it("rechaza parámetros con forma inválida en vez de interpretarlos", async () => {
    const env = entorno();
    expect((await pide(env, "?base=Robert';DROP TABLE records;--")).status).toBe(400);
    expect((await pide(env, "?desde=basura")).status).toBe(400);
    expect((await pide(env, "?limite=0")).status).toBe(400);
    // y la tabla sigue en pie
    expect(env.d1.db.prepare("SELECT COUNT(*) c FROM records").get()).toEqual({ c: 0 });
  });

  it("tabla vacía es 200 con lista vacía, no un error", async () => {
    const env = entorno();
    const r = await pide(env);
    expect(r.status).toBe(200);
    expect((await r.json()) as unknown).toEqual({ filas: [], siguiente: null });
  });
});
