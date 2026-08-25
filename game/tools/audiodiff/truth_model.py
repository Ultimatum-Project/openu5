#!/usr/bin/env python3
"""GROUND-TRUTH del speaker de ULTIMA V, DERIVADO del disasm + ancla del oráculo.

Las 4 primitivas del PC-speaker (ULTIMA.EXE.asm) y su ley EXACTA de duración/pitch,
derivada leyendo el cuerpo de cada rutina y anclada con UNA medida del oráculo
(t_dec = s emulados por iteración del bucle dec/jne, con cycles=fixed del oráculo).

Constantes del hardware/asm (NO libres):
  C            = [0x5356], reloj calibrado en runtime  (oráculo: 1308)
  PIT_HZ       = 1193182 Hz (reloj del 8253/8254)
  set_tone/beep/glide: divisor = PIT_HZ/arg  =>  FRECUENCIA EMITIDA = arg (Hz) EXACTA
  Ley de DURACIÓN (nº de decrementos del bucle interno, × t_dec):
    tone_sweep(inc,delay,count,start,step) : dec = count · delay · floor(C/24)   (0x21ac div 0x18)
    noise_burst(step,dur,band)             : dec = dur · (C>>4)                   (0x228c shr 4)
    beep(freq,dur)  = set_tone+delay(dur,1)+stop : dec = dur · (C>>shiftTbl[1])   (shiftTbl[1]=0 => ·C)
    glide(start,end,step,total) = set_tone·(total/step)+delay(step,1) : dec = total · (C>>0) = total·C
  Ley de PITCH:
    tone_sweep/noise: PWM por software; el PIT es portadora fija (divisor 0x3c).
      El pitch AUDIBLE de sweep = tasa de conmutación del gate = (inc/65536)·SR_sweep,
      con SR_sweep = 1/(delay·floor(C/24)·t_dec)  [muestras/seg del bucle].
      noise: secuencia de tonos PIT aleatorios en [100, band] Hz (ruido de banda).
    set_tone/beep/glide: el PIT SÍ fija el tono => Hz EXACTOS (= arg).

Esto REFUTA la nota `sfx-catalog.md §0` ("la frecuencia en Hz NO se deriva del
binario"): para beep/glide/set_tone (bump, cañonazo, escape, anillo, instrumentos)
el Hz ES exacto; sólo sweep/noise dependen de la calibración (t_dec) y AÚN así son
derivables una vez anclado t_dec (misma constante que la duración).
"""
from __future__ import annotations
import json, math, sys

PIT_HZ = 1193182.0

# Params crudos del asm por cue (sfx-catalog.md §6). Tipos:
#   TS=(inc,delay,count,start,step)  NB=(step,dur,band)  BP=(freq,dur)  GL=(start,end,step,total)
CUES: dict[str, list[tuple]] = {
    "combat-hit": [("NB", 10, 3000, 2000)],
    "combat-hit-heavy": [("NB", 40, 3000, 500)],
    "combat-damage": [("NB", 10, 1600, 2000)],
    "combat-defeat": [("NB", 40, 3000, 500)],
    "cast-spell": [("TS", 4600, 1, 10800, 300, 6)] * 3 + [("TS", 6100, 1, 21600, 300, 3)],
    "spell-zap": [("TS", 0x2648, 1, 28000, 1000, 2)],
    "sceptre": [("TS", 0xFD2, 1, 65000, 1, 1)],
    "moongate": [("TS", 0x170C, 1, 30000, 2000, 2)],
    "shadowlord-announce": [("TS", 0x19C8, 1, 60000, 2000, 1)],
    "instrument-note": [("TS", 0x1EAB, 1, 4000, 20000, -4)],  # dígito 0
    "shop-transaction": [("TS", 0x8FC, 1, 2000, 8000, -2)],   # éxito (asc)
    "cannon-fire": [("GL", 1000, 200, 5, 300)],
    "combat-escape": [("GL", 1200, 2000, 1, 40)],
    "ring-vanishes": [("GL", 1200, 2000, 1, 40)],
    # Ambiente por proximidad (ambient_sfx_tick 0x4102; re/notes/ambient-audio-audit.md).
    "ambient-fountain": [("NB", 10, 30, 25000)],   # clase 3 Fountain 0xd8-0xdb (0x42c4)
    "ambient-waterfall": [("NB", 20, 60, 10000)],  # clase 2 Waterfall 0xd4-0xd7 (0x42be)
    "ambient-clock-tick": [("BP", 3000, 3)],       # clase 1 fase 0 (0x42a1)
    "ambient-clock-tock": [("BP", 2000, 3)],       # clase 1 fase 4 (0x429c)
    "ambient-clock-chime": [("TS", 3116, 1, 2000, 20000, -10)],  # dar la hora (0x428b)
    "move-step": [("NB", 1, 25, 1000), ("NB", 1, 25, 1500)],
    "move-blocked": [("BP", 0xA5, 0xC8)],
    "search-fail": [("NB", 40, 3000, 500)],
    "dungeon-trap": [("NB", 1, 50, 3500)],
    "apparition-materialize": [("TS", 0xA3C, 1, 10000, 2500, 6)],
    "apparition-arpeggio": [("TS", 0x0A3C, 1, 5000, 200, 13)] * 3,  # tabla [0x3a26] placeholder
    "apparition-heal-chime": [("TS", 0x157C, 1, 5000, 200, 13)],
    "apparition-chord": [("TS", 0x157C, 1, 60000, 2500, 1)],
}


def sweep_inner(C):  # floor(C/24), byte div 0x18 en 0x21a6
    return C // 24 if C >= 0x64 else 0

def clampu16(v):
    return v + 0x10000 if v < 0 else v


def prim_metrics(p, C, t_dec, shift_beep):
    """(ms, f_lo, f_hi) de una llamada de primitiva bajo la ley derivada."""
    kind = p[0]
    if kind == "NB":
        step, dur, band = p[1], p[2], p[3]
        dec = clampu16(dur) * (C >> 4)
        return dec * t_dec * 1000.0, 100.0, float(band)
    if kind == "BP":
        freq, dur = p[1], p[2]
        dec = clampu16(dur) * (C >> shift_beep)
        return dec * t_dec * 1000.0, float(freq), float(freq)
    if kind == "GL":
        start, end, step, total = p[1], p[2], p[3], p[4]
        dec = clampu16(total) * (C >> shift_beep)  # delay(step,1) => shift idx 1 => shift_beep
        return dec * t_dec * 1000.0, float(min(start, end)), float(max(start, end))
    if kind == "TS":
        inc, delay, count, start, step = p[1], p[2], p[3], p[4], p[5]
        n = clampu16(count)
        inner = sweep_inner(C)
        dec = n * delay * inner
        ms = dec * t_dec * 1000.0
        sr = 1.0 / (delay * inner * t_dec) if inner and t_dec else 0.0
        f0 = (inc / 65536.0) * sr
        bx_end = start + step * n
        ratio = (start / bx_end) if (start > 0 and bx_end > 0) else 1.0
        f1 = f0 * ratio
        return ms, min(f0, f1), max(f0, f1)
    raise ValueError(kind)


def cue_truth(cue, C, t_dec, shift_beep):
    ms = 0.0; flo = math.inf; fhi = 0.0
    for p in CUES[cue]:
        m, a, b = prim_metrics(p, C, t_dec, shift_beep)
        ms += m; flo = min(flo, a); fhi = max(fhi, b)
    return {"ms": round(ms, 2), "fLo": round(flo), "fHi": round(fhi)}


def build(C, t_dec, shift_beep=0):
    return {"C": C, "t_dec_us": t_dec * 1e6, "shift_beep": shift_beep,
            "cues": {c: cue_truth(c, C, t_dec, shift_beep) for c in CUES}}


if __name__ == "__main__":
    # t_dec por defecto ANCLADO en la captura real (task #72): la cascada
    # ultima_001.wav mide 3.46 ms de burst NB(20,60,10000) sobre 115 muestras ⇒
    # t_dec = 3.46e-3/(60·(1308>>4)) = 0.711 µs, U = C·t_dec = 0.93 ms (antes 1.10
    # del oráculo, ±13 %). Ver re/notes/audio-diff-calibration.md §7.
    C = int(sys.argv[1]) if len(sys.argv) > 1 else 1308
    t_dec = float(sys.argv[2]) if len(sys.argv) > 2 else 0.711e-6  # s/iteración (0.93 ms / 1308)
    out = build(C, t_dec)
    print(json.dumps(out, indent=2))
