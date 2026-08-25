/**
 * Sonda de disponibilidad del atlas /companion (game/src/ui/shell/companion.ts).
 * Cubre el gate que evita el 404 del menú SISTEMA en los destinos públicos
 * (auditoría de cierre 2026-07-27) y las dos propiedades que lo hacen fiable:
 * el lado seguro ante fallo y el Accept no-html que esquiva el html-fallback de
 * vite (una ruta inexistente que acepta text/html devuelve el index con 200).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { companionAvailable, probeCompanion, COMPANION_URL } from "../src/ui/shell/companion.js";

type Call = { url: string; init?: RequestInit };

function recordingFetch(ok: boolean): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const f = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({ ok } as Response);
  }) as unknown as typeof fetch;
  return { fetch: f, calls };
}

describe("sonda /companion", () => {
  // El módulo cachea el resultado; cada caso parte de "no disponible".
  beforeEach(async () => {
    await probeCompanion(recordingFetch(false).fetch);
  });

  it("arranca en NO disponible (lado seguro: nunca ofrecer un 404)", () => {
    expect(companionAvailable()).toBe(false);
  });

  it("respuesta ok ⇒ disponible; respuesta no-ok ⇒ no disponible", async () => {
    expect(await probeCompanion(recordingFetch(true).fetch)).toBe(true);
    expect(companionAvailable()).toBe(true);

    expect(await probeCompanion(recordingFetch(false).fetch)).toBe(false);
    expect(companionAvailable()).toBe(false);
  });

  it("sondea un fichero NO-html pidiendo JSON por HEAD (esquiva el html-fallback)", async () => {
    const rec = recordingFetch(true);
    await probeCompanion(rec.fetch);
    expect(rec.calls).toHaveLength(1);
    const { url, init } = rec.calls[0]!;
    expect(url.startsWith(COMPANION_URL)).toBe(true);
    expect(url.endsWith(".html")).toBe(false);
    expect(init?.method).toBe("HEAD");
    expect((init?.headers as Record<string, string>).Accept).toBe("application/json");
  });

  it("fetch que rechaza ⇒ no disponible, sin propagar la excepción", async () => {
    const boom = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    await expect(probeCompanion(boom)).resolves.toBe(false);
    expect(companionAvailable()).toBe(false);
  });
});
