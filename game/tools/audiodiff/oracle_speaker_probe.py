#!/usr/bin/env python3
"""GROUND TRUTH del speaker (task #56) v3 — ancla t_dec con precisión.

v1/v2: C=[0x5356]=1308, params del PASO confirmados, primer bump ~5 ticks pero
args corruptos por el confound (otro dosbox). v3 (confound bajo): choca contra la
pared OESTE (x=1, hallada en v2) VARIAS veces y aísla el bucle puro de retardo
`delay_via_timer` (0x20c8->0x20f6) con args KNOWN, la fuente más limpia de t_dec.
También confirma freq del beep vía set_tone (0x22e2) y mide el burst de PASO.
Lecturas con reintento para sobrevivir a pérdidas transitorias del pty.
"""
import sys, os, json

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "re", "tools"))
import oracle  # noqa: E402

BEEP_ENTRY, BEEP_EXIT = 0x22C0, 0x22DE
SET_TONE = 0x22E2
DELAY_ENTRY, DELAY_EXIT = 0x20C8, 0x20F6
NOISE_ENTRY, NOISE_EXIT = 0x223C, 0x22BC
C_CLOCK, A9CE = 0x5356, 0xA9CE
PX, PY, LOC = 0x5896, 0x5897, 0x5893
TICK_HZ = 1193182.0 / 65536.0

def log(m): print(m, flush=True)
def u16(b): return int.from_bytes(b[:2], "little")
def ms_from(dt): return dt * 1000.0 / TICK_HZ

def main():
    s = oracle.boot()
    s.send_keys_until_main_menu()
    kseg = s.load_seg
    C = u16(s.read_mem_gameseg(C_CLOCK, 2))
    s.write_mem_gameseg(A9CE, b"\x01")
    log("=== CONTEXT === load_seg=%04X C=%d" % (kseg, C))
    res = {"load_seg": kseg, "C": C, "tick_hz": TICK_HZ,
           "delays": [], "beeps": [], "settones": [], "noise_bursts": []}

    def at(off):
        try: return s.at_code_bp(kseg, off)
        except oracle.OracleError: return False

    def args(n, tries=4):
        for _ in range(tries):
            try:
                ss = s.read_reg("SS"); sp = s.read_reg("SP")
                raw = s.read_mem(ss, (sp + 2) & 0xFFFF, n * 2)
                return [u16(raw[i*2:i*2+2]) for i in range(n)]
            except oracle.OracleError:
                continue
        return None

    def ticks():
        try: return s.ticks()
        except oracle.OracleError: return None

    def measure_to(exit_off, max_pulse=400):
        t0 = ticks()
        if t0 is None: return None
        for _ in range(max_pulse):
            try: s.resume()
            except oracle.OracleError: return None
            if at(exit_off):
                t1 = ticks()
                return None if t1 is None else (t1 - t0) & 0xFFFFFFFF
        return None

    s.arm_code_bps([(kseg, a) for a in (DELAY_ENTRY, DELAY_EXIT, SET_TONE,
                    BEEP_ENTRY, BEEP_EXIT, NOISE_ENTRY, NOISE_EXIT)])

    # Camina al oeste hasta x<=1 y luego BUMPEA varias veces.
    plan = ["LEFT"] * 20 + ["LEFT"] * 8  # 20 para llegar al muro, 8 bumps
    for step_i, key in enumerate(plan):
        try: s.send_key(key)
        except oracle.OracleError: continue
        for _ in range(80):
            try: s.resume()
            except oracle.OracleError: break
            if at(SET_TONE):
                a = args(1)  # [freq]
                if a: res["settones"].append(a[0])
            elif at(DELAY_ENTRY):
                a = args(2)  # [outer, shiftidx]
                dt = measure_to(DELAY_EXIT)
                if a is not None:
                    rec = {"outer": a[0], "shiftidx": a[1], "dticks": dt,
                           "ms": ms_from(dt) if dt is not None else None}
                    res["delays"].append(rec)
                    if dt:
                        log("  DELAY(outer=%d,shift=%d) dticks=%d ms=%.1f"
                            % (a[0], a[1], dt, rec["ms"]))
            elif at(BEEP_ENTRY):
                a = args(2)  # [dur, freq]
                if a is not None:
                    res["beeps"].append({"dur": a[0], "freq": a[1]})
                    log("  BEEP dur=%d freq=%d" % (a[0], a[1]))
            elif at(NOISE_ENTRY):
                a = args(3)  # [band, dur, step]
                dt = measure_to(NOISE_EXIT)
                if a is not None:
                    res["noise_bursts"].append(
                        {"band": a[0], "dur": a[1], "step": a[2], "dticks": dt,
                         "ms": ms_from(dt) if dt is not None else None})
            try:
                if s.key_consumed(): break
            except oracle.OracleError: break
        if len([b for b in res["beeps"]]) >= 5:
            break

    # Resúmenes: t_dec de los delays limpios del bump (outer=200,shift=1 => C inner).
    bump_delays = [d for d in res["delays"]
                   if d["dticks"] and d["shiftidx"] == 1 and d["outer"] in (200,)]
    if bump_delays:
        sd = sum(d["dticks"] for d in bump_delays)
        n = len(bump_delays)
        decr = 200 * C  # outer x inner(C>>0)
        res["bump_delay_summary"] = {
            "n": n, "sum_dticks": sd, "avg_ms": ms_from(sd) / n,
            "decr_each": decr, "t_dec_us": ms_from(sd) * 1000.0 / (n * decr)}
        log("BUMP DELAY: n=%d avg_ms=%.1f t_dec=%.4f us"
            % (n, ms_from(sd)/n, res["bump_delay_summary"]["t_dec_us"]))
    log("\n=== RESULT JSON ===")
    print("JSONBEGIN" + json.dumps(res) + "JSONEND")
    try: s.quit()
    except Exception: pass

if __name__ == "__main__":
    main()
