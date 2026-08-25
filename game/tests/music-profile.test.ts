/**
 * Perfil de audio por piel (task #27, `re/notes/audio-profile-1988.md`).
 *
 * DERIVACIÓN: el DOS 1988 en un PC estándar NO tiene música de fondo (sólo PC-speaker).
 * ⇒ la piel fiel 1988 debe arrancar SIN música; la piel dev conserva la música "enhanced"
 * (XMI→OGG). F7 es un opt-in EXPLÍCITO que persiste y MANDA sobre el default del perfil.
 *
 * Estos tests son DISCRIMINANTES: fallan si alguien vuelve a un default fijo (p.ej. ON para
 * todas las pieles) o si el override de F7 deja de ganar al default del perfil. Vitest corre
 * en node sin DOM: se stubean `window`, `Audio` y `localStorage` (el sintetizador de música
 * sólo toca esos globals). Presentación pura: cero core/RNG.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MusicPlayer,
  MUSIC_STORAGE_KEY,
  musicEnabled,
  hasExplicitMusicPref,
} from "../src/ui/music.js";

class LocalStorageStub {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
  key(i: number): string | null {
    return [...this.store.keys()][i] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

/** Doble de HTMLAudioElement: registra si se pidió play()/pause() y con qué src/loop. */
interface FakeAudio {
  src: string;
  loop: boolean;
  volume: number;
  played: boolean;
  paused: boolean;
  play(): Promise<void>;
  pause(): void;
}

interface Env {
  audios: FakeAudio[];
  /** Simula el primer gesto del usuario (desbloqueo de autoplay del navegador). */
  unlock(): void;
}

function installEnv(): Env {
  const audios: FakeAudio[] = [];
  const listeners: Record<string, Array<() => void>> = {};
  class Audio implements FakeAudio {
    src: string;
    loop = false;
    volume = 0;
    played = false;
    paused = false;
    constructor(src: string) {
      this.src = src;
      audios.push(this);
    }
    play(): Promise<void> {
      this.played = true;
      return Promise.resolve();
    }
    pause(): void {
      this.paused = true;
    }
  }
  const win = {
    addEventListener: (t: string, cb: () => void): void => {
      (listeners[t] ??= []).push(cb);
    },
    removeEventListener: (t: string, cb: () => void): void => {
      listeners[t] = (listeners[t] ?? []).filter((f) => f !== cb);
    },
    // El fade no se auto-ejecuta en el test: basta con que play() haya arrancado la pista.
    setInterval: (): number => 1,
    clearInterval: (): void => {},
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("Audio", Audio);
  vi.stubGlobal("localStorage", new LocalStorageStub());
  return {
    audios,
    unlock: () => (listeners["keydown"] ?? []).forEach((f) => f()),
  };
}

beforeEach(() => {
  installEnv();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("musicEnabled() — el perfil decide salvo preferencia explícita", () => {
  it("sin preferencia guardada, devuelve el default del perfil", () => {
    expect(musicEnabled(false)).toBe(false); // fiel
    expect(musicEnabled(true)).toBe(true); // dev
    expect(hasExplicitMusicPref()).toBe(false);
  });

  it("con preferencia explícita, ésta gana al default del perfil", () => {
    localStorage.setItem(MUSIC_STORAGE_KEY, "1");
    expect(musicEnabled(false)).toBe(true); // fiel default OFF, pero el usuario forzó ON
    expect(hasExplicitMusicPref()).toBe(true);
    localStorage.setItem(MUSIC_STORAGE_KEY, "0");
    expect(musicEnabled(true)).toBe(false); // dev default ON, pero el usuario forzó OFF
  });
});

describe("piel fiel 1988 — arranca SIN música", () => {
  it("no arranca ninguna pista al pedir contexto (default OFF)", () => {
    const env = installEnv();
    const m = new MusicPlayer(false);
    env.unlock();
    m.play("overworld");
    expect(m.enabled).toBe(false);
    expect(env.audios).toHaveLength(0);
  });

  it("F7 (opt-in explícito) SÍ arranca música y persiste la preferencia", () => {
    const env = installEnv();
    const m = new MusicPlayer(false);
    env.unlock();
    const on = m.toggle();
    expect(on).toBe(true);
    expect(localStorage.getItem(MUSIC_STORAGE_KEY)).toBe("1");
    m.play("town");
    expect(env.audios).toHaveLength(1);
    expect(env.audios[0]!.played).toBe(true);
    expect(env.audios[0]!.loop).toBe(true);
  });
});

describe("piel dev — arranca CON música", () => {
  it("arranca la pista del contexto (default ON)", () => {
    const env = installEnv();
    const m = new MusicPlayer(true);
    env.unlock();
    m.play("overworld");
    expect(m.enabled).toBe(true);
    expect(env.audios).toHaveLength(1);
    expect(env.audios[0]!.played).toBe(true);
    expect(env.audios[0]!.src).toContain("overworld.ogg");
  });
});

describe("setProfileDefault() — cambio de piel (F9) reaplica el default", () => {
  it("dev→fiel detiene la música; fiel→dev la reanuda (sin preferencia explícita)", () => {
    const env = installEnv();
    const m = new MusicPlayer(true); // arranca en dev
    env.unlock();
    m.play("overworld");
    expect(env.audios[0]!.played).toBe(true);

    m.setProfileDefault(false); // swap a fiel ⇒ sin música
    expect(m.enabled).toBe(false);
    expect(env.audios[0]!.paused).toBe(true);

    m.setProfileDefault(true); // swap de vuelta a dev ⇒ reanuda el contexto recordado
    expect(m.enabled).toBe(true);
    const live = env.audios.filter((a) => a.played && !a.paused);
    expect(live.length).toBeGreaterThan(0);
  });

  it("la preferencia explícita del usuario (F7) GANA al default del perfil en el swap", () => {
    const env = installEnv();
    localStorage.setItem(MUSIC_STORAGE_KEY, "1"); // el usuario forzó música ON
    const m = new MusicPlayer(false); // aunque arranque en fiel
    expect(m.enabled).toBe(true);
    m.setProfileDefault(false); // swap a fiel: NO debe apagar (override manual manda)
    expect(m.enabled).toBe(true);
    env.unlock();
    m.play("overworld");
    expect(env.audios.some((a) => a.played)).toBe(true);
  });
});
