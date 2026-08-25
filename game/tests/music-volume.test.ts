/**
 * Volumen persistente de la música (shell): parseo, clamp y default de
 * `musicVolume` con storage inyectado. `MusicPlayer` no se instancia aquí
 * (su constructor cuelga listeners de window); el cableado vivo lo cubre
 * el e2e del shell (shell-menu.spec.ts).
 */
import { describe, expect, it } from "vitest";
import { musicVolume, MUSIC_VOLUME_KEY } from "../src/ui/music.js";

function storeWith(value: string | null): Pick<Storage, "getItem"> {
  return { getItem: (k: string) => (k === MUSIC_VOLUME_KEY ? value : null) };
}

describe("musicVolume — volumen persistente 0..1", () => {
  it("ausente ⇒ default 0.55 (el VOLUME histórico)", () => {
    expect(musicVolume(storeWith(null))).toBe(0.55);
    expect(musicVolume(undefined)).toBe(0.55);
  });

  it("parsea el valor y lo clampa a [0,1]", () => {
    expect(musicVolume(storeWith("0.3"))).toBe(0.3);
    expect(musicVolume(storeWith("7"))).toBe(1);
    expect(musicVolume(storeWith("-2"))).toBe(0);
  });

  it("basura ⇒ default", () => {
    expect(musicVolume(storeWith("patata"))).toBe(0.55);
  });
});
