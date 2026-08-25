/**
 * Música contextual con crossfade (QoL). Pistas OGG renderizadas del parche
 * XMI comunitario. El navegador exige un gesto del usuario antes de sonar:
 * la reproducción arranca con la primera interacción.
 */

export type MusicContext =
  | "title"
  | "overworld"
  | "underworld"
  | "town"
  | "castle"
  | "blackthorn"
  | "combat"
  | "dungeon"
  | "tavern";

const CONTEXT_TRACK: Record<MusicContext, string> = {
  title: "/assets/music/theme.ogg",
  overworld: "/assets/music/overworld.ogg",
  underworld: "/assets/music/underworld.ogg",
  town: "/assets/music/stones.ogg",
  castle: "/assets/music/castle.ogg",
  blackthorn: "/assets/music/blackthorn.ogg",
  combat: "/assets/music/combat.ogg",
  dungeon: "/assets/music/dungeon.ogg",
  tavern: "/assets/music/tavern.ogg",
};

const FADE_SECONDS = 1.2;
/** Volumen por defecto (el VOLUME=0.55 histórico). */
const DEFAULT_VOLUME = 0.55;
/** Clave del volumen persistente de la música (string decimal 0..1). */
export const MUSIC_VOLUME_KEY = "u5.musicVolume";

/** Lee el volumen persistido (0..1); ausente/basura ⇒ default. Nunca lanza. */
export function musicVolume(
  store: Pick<Storage, "getItem"> | undefined = safeStorage(),
): number {
  try {
    const raw = store?.getItem(MUSIC_VOLUME_KEY);
    if (raw == null) return DEFAULT_VOLUME;
    const v = Number(raw);
    if (!Number.isFinite(v)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, v));
  } catch {
    return DEFAULT_VOLUME;
  }
}

/**
 * Clave del toggle persistente de la música (localStorage). PRESENTE ⇒ preferencia
 * EXPLÍCITA del usuario (F7), que MANDA sobre el default del perfil de piel. AUSENTE ⇒
 * decide el default del perfil (piel fiel 1988 ⇒ OFF, piel dev ⇒ ON; ver
 * `MusicPlayer.setProfileDefault` y `re/notes/audio-profile-1988.md`).
 */
export const MUSIC_STORAGE_KEY = "u5.music";

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

/**
 * ¿Fijó el usuario una preferencia explícita de música con F7? Si la fijó, gana sobre el
 * default del perfil de piel; si no, manda el perfil. Nunca lanza.
 */
export function hasExplicitMusicPref(): boolean {
  try {
    return safeStorage()?.getItem(MUSIC_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

/**
 * ¿Está la música activada? Con preferencia explícita del usuario ("1"/"0") gana ésta;
 * si no hay ninguna, manda `profileDefault` (el default de la piel activa). Nunca lanza.
 */
export function musicEnabled(profileDefault: boolean): boolean {
  try {
    const v = safeStorage()?.getItem(MUSIC_STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
    return profileDefault;
  } catch {
    return profileDefault;
  }
}

export class MusicPlayer {
  private current: HTMLAudioElement | null = null;
  private currentContext: MusicContext | null = null;
  private unlocked = false;
  private pendingContext: MusicContext | null = null;
  private fadeTimer: number | null = null;
  private _enabled: boolean;
  /** Volumen vivo 0..1 (persistido en u5.musicVolume). */
  private volume = musicVolume();

  /**
   * @param profileDefault default de música del perfil de piel INICIAL: piel fiel 1988 ⇒
   *   `false` (sin música: el DOS original en PC estándar no tenía música de fondo, sólo
   *   PC-speaker — `re/notes/audio-profile-1988.md`); piel dev ⇒ `true` (música "enhanced"
   *   XMI→OGG). Sólo aplica si el usuario no fijó una preferencia explícita con F7.
   */
  constructor(profileDefault = false) {
    this._enabled = musicEnabled(profileDefault);
    const unlock = (): void => {
      this.unlocked = true;
      if (this.pendingContext) this.play(this.pendingContext);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerdown", unlock);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** Volumen vivo (0..1) para el shell. */
  get volumeLevel(): number {
    return this.volume;
  }

  /**
   * Fija el volumen (0..1), lo persiste y lo aplica a la pista viva. QoL — no
   * toca estado ni RNG. Durante un crossfade el timer ya lee `this.volume` vivo.
   */
  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    try {
      safeStorage()?.setItem(MUSIC_VOLUME_KEY, String(this.volume));
    } catch {
      /* almacenamiento no disponible: el volumen vive sólo en memoria */
    }
    if (this.current && this.fadeTimer === null) this.current.volume = this.volume;
  }

  /**
   * Enciende/apaga la música SIN persistir (uso interno + default de perfil). Al apagar,
   * detiene la pista viva pero RECUERDA el contexto (`pendingContext`) para reanudarlo.
   */
  private applyEnabled(on: boolean): void {
    this._enabled = on;
    if (!on) {
      if (this.fadeTimer !== null) {
        window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
      this.current?.pause();
      this.current = null;
      // Conserva `pendingContext` = último contexto pedido; olvida el "vivo" para
      // que un play() del MISMO contexto al reencender no sea un no-op (ver play()).
      this.pendingContext = this.currentContext ?? this.pendingContext;
      this.currentContext = null;
    } else if (this.pendingContext) {
      this.play(this.pendingContext);
    }
  }

  /**
   * Enciende/apaga la música por acción EXPLÍCITA del usuario (F7). Persiste la elección
   * (localStorage u5.music), que desde aquí MANDA sobre el default del perfil de piel.
   * QoL — no es una tecla del original; el toggle no toca estado ni RNG del juego.
   */
  setEnabled(on: boolean): void {
    try {
      safeStorage()?.setItem(MUSIC_STORAGE_KEY, on ? "1" : "0");
    } catch {
      /* almacenamiento no disponible: el toggle vive sólo en memoria */
    }
    this.applyEnabled(on);
  }

  /**
   * Fija el default de música del PERFIL de piel activo, aplicado al cambiar de piel (F9):
   * piel fiel 1988 ⇒ `false` (sin música de fondo, calco del PC-speaker del DOS original);
   * piel dev ⇒ `true` (música "enhanced" XMI→OGG). Si el usuario fijó su preferencia con
   * F7 (`hasExplicitMusicPref`), ésta MANDA y esto es un no-op. QoL — cero estado/RNG.
   */
  setProfileDefault(defaultOn: boolean): void {
    if (hasExplicitMusicPref()) return; // el override manual del usuario gana
    this.applyEnabled(defaultOn);
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  /** Contexto según posición: locations 17=LB castle, 18=Blackthorn, 33-40=dungeon. */
  contextFor(location: number, floor: number): MusicContext {
    if (location === 0) return floor === 0xff ? "underworld" : "overworld";
    if (location === 17) return "castle";
    if (location === 18) return "blackthorn";
    if (location >= 33) return "dungeon";
    return "town";
  }

  play(context: MusicContext): void {
    if (context === this.currentContext) return;
    this.pendingContext = context;
    // Música apagada (F7): recuerda el contexto pedido pero no suena; se reanudará
    // en setEnabled(true). Igual que el gate de `unlocked`, no altera nada del juego.
    if (!this._enabled) return;
    if (!this.unlocked) return;
    this.currentContext = context;

    const next = new Audio(CONTEXT_TRACK[context]);
    next.loop = true;
    next.volume = 0;
    void next.play().catch(() => {
      /* autoplay bloqueado: se reintenta en el próximo gesto */
      this.currentContext = null;
    });

    const prev = this.current;
    this.current = next;
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    const steps = 24;
    let step = 0;
    this.fadeTimer = window.setInterval(() => {
      step++;
      const t = step / steps;
      next.volume = Math.min(this.volume, this.volume * t);
      if (prev) prev.volume = Math.max(0, this.volume * (1 - t));
      if (step >= steps) {
        if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        prev?.pause();
      }
    }, (FADE_SECONDS * 1000) / steps);
  }
}
