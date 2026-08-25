/**
 * CAPA i18n DEL SHELL (`src/i18n/shell.ts`) — contrato del helper `ts()`.
 *
 * Espejo reducido del contrato de `i18n.t()` pero para la capa AUTORADA del shell
 * (menú SISTEMA, switchers, ⚙, ayuda), que NO vive en es.json (keyed por el corpus
 * del binario) sino en su propia tabla. Asegura: identidad estricta en 'en',
 * traducción en 'es', fallback string a string, y que NINGUNA key de la tabla ES
 * quede vacía.
 */
import { describe, it, expect, afterEach } from "vitest";
import { ts } from "../src/i18n/shell.js";
import { setLang, BASE_LANG } from "../src/i18n/index.js";

afterEach(() => setLang(BASE_LANG, { persist: false }));

describe("ts() — capa de idioma del shell", () => {
  it("'en' es identidad estricta (la base autorada del shell)", () => {
    setLang("en", { persist: false });
    for (const s of ["Video", "Audio", "Save / Load (F5)", "SYSTEM", "MENU", "no en tabla"]) {
      expect(ts(s)).toBe(s);
    }
  });

  it("'es' traduce las keys conocidas del shell", () => {
    setLang("es", { persist: false });
    expect(ts("Video")).toBe("Vídeo");
    expect(ts("SYSTEM")).toBe("SISTEMA");
    expect(ts("MENU")).toBe("MENÚ");
    expect(ts("Save / Load (F5)")).toBe("Guardar / Cargar (F5)");
    expect(ts("Skin")).toBe("Piel");
    expect(ts("Change skin")).toBe("Cambiar piel");
  });

  it("'es' cae al inglés (identidad) para un string fuera de la tabla", () => {
    setLang("es", { persist: false });
    expect(ts("this shell string is not translated")).toBe("this shell string is not translated");
  });

  it("cambio en caliente: el mismo string sigue el idioma vivo", () => {
    setLang("en", { persist: false });
    expect(ts("Fullscreen")).toBe("Fullscreen");
    setLang("es", { persist: false });
    expect(ts("Fullscreen")).toBe("Pantalla completa");
  });
});
