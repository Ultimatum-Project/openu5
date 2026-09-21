import { describe, expect, it } from "vitest";
import {
  BYO_CACHE,
  ULTIMATUM_CONTROL_CACHE,
  ULTIMATUM_POINTER_PATH,
  cacheExtraccionActiva,
  type AlmacenDeCaches,
} from "../src/web/extraccion.js";

function almacen(options: { pointer?: unknown; caches: readonly string[] }): AlmacenDeCaches {
  return {
    has: async (name) => options.caches.includes(name),
    open: async (name) => ({
      keys: async () => [],
      match: async (path) => {
        if (name !== ULTIMATUM_CONTROL_CACHE || path !== ULTIMATUM_POINTER_PATH || options.pointer === undefined) {
          return undefined;
        }
        return { clone: () => ({ json: async () => options.pointer }) };
      },
    }),
  };
}

describe("Ultimatum active install selection", () => {
  it("prefers a published immutable generation", async () => {
    const generation = "ultimatum-u5-install-generation-12345678";
    await expect(cacheExtraccionActiva(almacen({
      pointer: { cacheName: generation },
      caches: [ULTIMATUM_CONTROL_CACHE, generation, BYO_CACHE],
    }))).resolves.toBe(generation);
  });

  it("preserves an existing OpenU5 legacy install", async () => {
    await expect(cacheExtraccionActiva(almacen({ caches: [BYO_CACHE] }))).resolves.toBe(BYO_CACHE);
  });

  it("falls back to legacy data when the control pointer is malformed or stale", async () => {
    await expect(cacheExtraccionActiva(almacen({
      pointer: { cacheName: "ultimatum-u5-install-generation-missing" },
      caches: [ULTIMATUM_CONTROL_CACHE, BYO_CACHE],
    }))).resolves.toBe(BYO_CACHE);
  });
});
