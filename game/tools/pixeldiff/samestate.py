#!/usr/bin/env python3
"""
Runner MISMO-ESTADO del arnés píxel-diff (task #26, FASE 2).

Orquesta la comparación dura port↔original CARGANDO EL MISMO SAVED.GAM en ambos:

    original  →  re/tools/capture_original.py  (siembra el save en el oráculo
                 dosbox-x headless, asienta el frame, captura la VRAM EGA a PNG
                 NATIVO 320x200)
    port      →  game/tools/pixeldiff/capture-port.pw.ts  (piel fiel + ?nointro,
                 __u5test.loadNativeSave, vuelca el canvas lógico 320x200)

Ambas capturas son NATIVAS 320x200 (píxel cuadrado, sin cromo macOS ni el ×1.2 del
port), así que se comparan SIN --raw: `compare.py` sólo snapea a paleta y aplica
`regions-samestate.json` (modo strict). Sin mismo estado esto no sería honesto —
por eso es la fase 2.

Uso:
    # 1) captura el original de cada caso (necesita dosbox-x; ver oracle.md regla 7)
    python3 samestate.py --capture-original
    # 2) captura el port (dev-server en :5199):
    #    cd game && npx playwright test -c tools/pixeldiff/capture.config.ts \
    #        --grep @samestate
    # 3) compara y resume:
    python3 samestate.py

Las PNG viven bajo original/av-referencia/_pixeldiff/ (gitignored). Este runner y
los manifiestos SÍ se commitean; las capturas NUNCA.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DEFAULT_OUT = os.path.join(
    REPO_ROOT, "original", "av-referencia", "_pixeldiff", "samestate")


def load_cases(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def capture_original_case(save_rel: str, out_png: str, turns: int) -> None:
    """Invoca re/tools/capture_original.py para un caso (boot del oráculo)."""
    save_abs = os.path.join(REPO_ROOT, save_rel)
    script = os.path.join(REPO_ROOT, "re", "tools", "capture_original.py")
    cmd = [sys.executable, script, save_abs, out_png, "--turns", str(turns)]
    print("  [orig] %s → %s" % (save_rel, out_png))
    subprocess.run(cmd, check=True)


def compare_case(port_png: str, orig_png: str, regions: str, out_dir: str) -> dict:
    """Corre compare.py (sin --raw: ambos ya son 320x200 nativos) y devuelve el veredicto."""
    compare = os.path.join(HERE, "compare.py")
    case_out = out_dir
    os.makedirs(case_out, exist_ok=True)
    cmd = [sys.executable, compare, port_png, orig_png,
           "--regions", regions, "--out-dir", case_out, "--json"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default=os.path.join(HERE, "samestate-cases.json"))
    ap.add_argument("--out", default=DEFAULT_OUT, help="dir de PNGs y diffs (gitignored)")
    ap.add_argument("--capture-original", action="store_true",
                    help="captura el original de cada caso vía el oráculo (necesita dosbox-x)")
    ap.add_argument("--turns", type=int, default=1,
                    help="turnos Pass de asentado del frame del original (0 = sin asentar)")
    args = ap.parse_args()

    cfg = load_cases(args.cases)
    default_regions = cfg.get("regions", "regions-samestate.json")
    port_dir = os.path.join(args.out, "port")
    orig_dir = os.path.join(args.out, "orig")
    diff_dir = os.path.join(args.out, "diff")
    os.makedirs(orig_dir, exist_ok=True)

    if args.capture_original:
        print("Capturando el original de cada caso (oráculo headless):")
        for case in cfg["cases"]:
            out_png = os.path.join(orig_dir, case["name"] + ".png")
            capture_original_case(case["save"], out_png, args.turns)
        print()

    print("Comparando MISMO-ESTADO (regions por defecto=%s):" % default_regions)
    summary = []
    any_missing = False
    for case in cfg["cases"]:
        name = case["name"]
        # Regiones por caso (override) o el manifiesto por defecto. Estados con
        # otro layout (mazmorra first-person, vista de gema) traen su propio JSON.
        regions = os.path.join(HERE, case.get("regions", default_regions))
        port_png = os.path.join(port_dir, name + ".png")
        orig_png = os.path.join(orig_dir, name + ".png")
        if not (os.path.isfile(port_png) and os.path.isfile(orig_png)):
            miss = [p for p in (port_png, orig_png) if not os.path.isfile(p)]
            print("  [%-14s] FALTAN capturas: %s" % (name, ", ".join(miss)))
            any_missing = True
            continue
        report = compare_case(port_png, orig_png, regions,
                              os.path.join(diff_dir, name))
        fails = [v["name"] for v in report["regions"] if v.get("passed") is False]
        # 'expect' permite marcar una divergencia YA catalogada (finding) como
        # esperada: el arnés sigue verde en CI si el veredicto coincide con lo
        # esperado, y sólo se pone rojo ante una SORPRESA (regresión nueva, o un
        # FAIL catalogado que de pronto PASA = el port se arregló → actualizar).
        expect = case.get("expect", "PASS")
        surprise = report["verdict"] != expect
        summary.append((name, report["verdict"], expect, surprise, fails))
        tag = " (esperado)" if (report["verdict"] == expect and expect != "PASS") else \
              "  <<< SORPRESA: se esperaba %s" % expect if surprise else ""
        print("  [%-14s] %s%s" % (name, report["verdict"], tag))
        for v in report["regions"]:
            mark = {True: "PASS", False: "FAIL", None: "skip"}[v.get("passed")]
            extra = ""
            if v["mode"] == "presence":
                extra = "  tinta port=%s orig=%s" % (v.get("ink_port"), v.get("ink_orig"))
            elif v["mode"] == "color":
                extra = "  color port=idx%s orig=idx%s" % (v.get("color_port"), v.get("color_orig"))
            elif v["mode"] == "lit_tiles":
                extra = "  score=%s  tiles oscuros port=%s orig=%s" % (
                    v.get("score"), v.get("dark_port"), v.get("dark_orig"))
            elif v.get("score") is not None:
                extra = "  score=%s" % v["score"]
            print("      [%s] %-14s (%s)%s" % (mark, v["name"], v["mode"], extra))
        print("      diff → %s" % report["diff_image"])

    print("\nResumen:")
    surprises = []
    for name, verdict, expect, surprise, fails in summary:
        note = ("FAIL: " + ", ".join(fails)) if fails else "todas PASS"
        flag = ""
        if surprise:
            flag = "  <<< SORPRESA (esperado %s)" % expect
            surprises.append(name)
        elif expect != "PASS":
            flag = "  (divergencia catalogada, esperada)"
        print("  %-14s %-22s %s%s" % (name, verdict, note, flag))
    if any_missing:
        print("\n(Faltan capturas: corre --capture-original y la captura Playwright del port.)")
        return 1
    if surprises:
        print("\nSORPRESAS (%d): %s — el arnés esperaba otro veredicto. Revisa el diff:"
              " o hay una REGRESIÓN nueva, o una divergencia catalogada se ARREGLÓ"
              " (actualiza 'expect' en samestate-cases.json)." % (len(surprises), ", ".join(surprises)))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
