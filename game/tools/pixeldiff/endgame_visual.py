#!/usr/bin/env python3
"""
Arnés VISUAL DEL DESENLACE (#176) — compara lo que PINTA el port en el final contra
fotogramas del original, por regiones y con veredicto por caso.

Cierra el hueco 2 de /verificacion: hasta hoy `game/e2e/endgame.spec.ts` comprobaba la
máquina de FASES y el TEXTO del pergamino (cero píxeles) y `samestate-cases.json` no
tenía ningún caso del final. Esto compara imagen.

    original  →  endgame-victoria-box-20260721.mov (testigo del usuario, gitignored)
                 ffmpeg 1 frame por instante → egcalib.normalize_fixed (recorte
                 calibrado, NO el fiducial de chrome: ver egcalib.py)
    port      →  capture-port.pw.ts @endgame — siembra el final por __u5test como
                 endgame.spec.ts, conduce el pacer hasta cada fase/página y vuelca el
                 canvas lógico 320x200 de la piel fiel

Uso:
    # 1) referencias del vídeo (necesita ffmpeg y el .mov archivado):
    python3 endgame_visual.py --extract-ref
    # 2) capturas del port (dev-server propio; ver README):
    #    cd game && npx playwright test -c tools/pixeldiff/capture.config.ts --grep @endgame
    # 3) comparar y sellar:
    python3 endgame_visual.py                 # exit 0 ok · 2 SORPRESA · 1 faltan capturas
    python3 endgame_visual.py --write         # además REESCRIBE endgame-verdicts.json
    # recalibrar el recorte del vídeo (sólo si se re-graba el testigo):
    python3 endgame_visual.py --calibrate

🔴 ALCANCE, DECLARADO: la referencia es una GRABACIÓN DE PANTALLA, no un volcado de
VRAM. Medido: la grabación no es un escalado entero (bloques 4x4 uniformes 0,6705 con
CONTROL 3x3 en 0,6745 = azar), así que `strict`/`strict_ink` compararían el ruido del
códec. Este arnés usa sólo modos robustos a ±1 px. La vía píxel-exacta pide un ORÁCULO
que llegue al desenlace dentro del binario, y eso sigue bloqueado mientras la absorción
no esté portada (#179). El arnés dice si el desenlace se pinta con el contenido, el
color y la estructura del original; no dice que sea byte a byte.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys

import egcalib
import pdlib

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
CASES = os.path.join(HERE, "endgame-cases.json")
VERDICTS = os.path.join(HERE, "endgame-verdicts.json")
OUT_DEFAULT = os.path.join(REPO_ROOT, "original", "av-referencia", "_pixeldiff", "endgame")
# Deriva de score por encima de la cual se avisa aunque el veredicto NO cambie: una
# puntuación que se mueve mientras el PASS aguanta es la regresión que un umbral con
# holgura se traga. El aviso no rompe el exit; la SORPRESA sí.
DRIFT = 0.03


def sha1_of(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()


def load_cases(path: str = CASES) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def manifest_shas(cfg: dict) -> dict:
    """sha1 de los manifiestos que definen QUÉ se compara — el sello de sincronía.

    Si alguien toca los casos o las regiones y no vuelve a correr el arnés, estos
    sha1 dejan de casar con los de endgame-verdicts.json y test_endgame_visual.py se
    pone ROJO. Sin esto, un manifiesto editado convive con veredictos de otra época y
    nadie se entera: el fichero de veredictos parecería trabajo hecho.
    """
    out = {"endgame-cases.json": sha1_of(CASES)}
    for r in sorted({c["regions"] for c in cfg["cases"]}):
        out[r] = sha1_of(os.path.join(HERE, r))
    return out


def ffmpeg_frame(video: str, t: float, dst: str) -> None:
    subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y",
         "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", dst],
        check=True,
    )


def extract_refs(cfg: dict, out_dir: str) -> int:
    video = os.path.join(REPO_ROOT, cfg["video"])
    if not os.path.isfile(video):
        print("FALTA el testigo en vídeo: %s" % video, file=sys.stderr)
        print("(está gitignored por diseño: material de EA nunca viaja al repo)", file=sys.stderr)
        return 1
    ref_dir = os.path.join(out_dir, "ref")
    os.makedirs(ref_dir, exist_ok=True)
    crop = tuple(cfg["recorte"])
    tmp = os.path.join(out_dir, "_raw.png")
    for case in cfg["cases"]:
        ffmpeg_frame(video, case["t"], tmp)
        idx = egcalib.normalize_fixed(pdlib.load_rgb(tmp), crop)
        dst = os.path.join(ref_dir, case["name"] + ".png")
        pdlib.save_idx_png(idx, dst)
        print("  [ref] t=%-7.1f → %s" % (case["t"], os.path.relpath(dst, REPO_ROOT)))
    os.path.isfile(tmp) and os.remove(tmp)
    return 0


def calibrate(cfg: dict, out_dir: str) -> int:
    """Re-calibra el recorte sobre las tramas CON CHROME y avisa si difieren entre sí."""
    video = os.path.join(REPO_ROOT, cfg["video"])
    chrome = [c for c in cfg["cases"] if c["regions"].endswith("chrome.json")]
    if not chrome:
        print("no hay casos con chrome: la calibración necesita el fiducial", file=sys.stderr)
        return 1
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(out_dir, "_cal.png")
    crops = []
    for c in chrome:
        ffmpeg_frame(video, c["t"], tmp)
        r = egcalib.calibrate(pdlib.load_rgb(tmp))
        crops.append(r)
        print("  t=%-7.1f %s" % (c["t"], r))
    xs = {tuple(r["crop"]) for r in crops}
    print("\nrecortes distintos: %d  (manifiesto: %s)" % (len(xs), cfg["recorte"]))
    if len(xs) > 1:
        print("🔴 las tramas con chrome NO coinciden en el recorte: la ventana de DOSBox "
              "se movió durante la grabación, y entonces un recorte FIJO no vale para "
              "los instantes sin chrome. Hay que registrar frame a frame o re-grabar.")
    return 0


def compare_case(port_png: str, ref_png: str, regions: str, out_dir: str) -> dict:
    compare = os.path.join(HERE, "compare.py")
    os.makedirs(out_dir, exist_ok=True)
    res = subprocess.run(
        [sys.executable, compare, port_png, ref_png,
         "--regions", os.path.join(HERE, regions), "--out-dir", out_dir, "--json"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(res.stdout)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default=CASES)
    ap.add_argument("--out", default=OUT_DEFAULT, help="dir de PNGs y diffs (gitignored)")
    ap.add_argument("--extract-ref", action="store_true", help="saca los frames del vídeo")
    ap.add_argument("--calibrate", action="store_true", help="re-calibra el recorte y sale")
    ap.add_argument("--write", action="store_true", help="reescribe endgame-verdicts.json")
    args = ap.parse_args()

    cfg = load_cases(args.cases)
    if args.calibrate:
        return calibrate(cfg, args.out)
    if args.extract_ref:
        print("Extrayendo referencias del testigo (recorte fijo %s):" % cfg["recorte"])
        return extract_refs(cfg, args.out)

    ref_dir = os.path.join(args.out, "ref")
    port_dir = os.path.join(args.out, "port")
    prev = {}
    if os.path.isfile(VERDICTS):
        with open(VERDICTS, encoding="utf-8") as f:
            prev = {c["name"]: c for c in json.load(f).get("cases", [])}

    print("Comparando el DESENLACE (port ↔ testigo en vídeo):")
    rows, missing, surprises, drifts = [], [], [], []
    for case in cfg["cases"]:
        name = case["name"]
        port_png = os.path.join(port_dir, name + ".png")
        ref_png = os.path.join(ref_dir, name + ".png")
        falta = [p for p in (port_png, ref_png) if not os.path.isfile(p)]
        if falta:
            print("  [%-13s] FALTAN capturas: %s" % (name, ", ".join(
                os.path.relpath(p, REPO_ROOT) for p in falta)))
            missing.append(name)
            continue
        rep = compare_case(port_png, ref_png, case["regions"],
                           os.path.join(args.out, "diff", name))
        regs = [{"name": v["name"], "mode": v["mode"], "score": v.get("score"),
                 "passed": v.get("passed")} for v in rep["regions"]]
        row = {"name": name, "phase": case["phase"], "t": case["t"],
               "verdict": rep["verdict"], "regions": regs}
        rows.append(row)
        expect = case.get("expect", "PASS")
        if rep["verdict"] != expect:
            surprises.append(name)
        old = prev.get(name)
        print("  [%-13s] %s%s" % (name, rep["verdict"],
                                  "  <<< SORPRESA (se esperaba %s)" % expect
                                  if rep["verdict"] != expect else ""))
        for v, o in zip(regs, (old or {}).get("regions", []) + [None] * len(regs)):
            mark = {True: "PASS", False: "FAIL", None: "skip"}[v["passed"]]
            extra = "" if v["score"] is None else "  score=%s" % v["score"]
            if o and o.get("name") == v["name"] and None not in (o.get("score"), v["score"]):
                d = abs(o["score"] - v["score"])
                if d > DRIFT:
                    extra += "  ⚠ DERIVA %+.4f (sellado %s)" % (v["score"] - o["score"], o["score"])
                    drifts.append("%s/%s" % (name, v["name"]))
            print("      [%s] %-16s (%s)%s" % (mark, v["name"], v["mode"], extra))

    if missing:
        print("\nFALTAN %d capturas. Corre `--extract-ref` y la captura @endgame del port."
              % len(missing))
        return 1

    if args.write:
        with open(VERDICTS, "w", encoding="utf-8") as f:
            json.dump({
                "_doc": "Veredictos SELLADOS del arnés visual del desenlace (#176). Lo "
                        "produce endgame_visual.py --write; NO se edita a mano. Los sha1 "
                        "atan estos veredictos a los manifiestos con los que se midieron: "
                        "si alguien cambia casos o regiones sin re-medir, "
                        "re/tools/test_endgame_visual.py se pone ROJO.",
                "manifest_sha1": manifest_shas(cfg),
                "cases": rows,
            }, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("\nsellado → %s" % os.path.relpath(VERDICTS, REPO_ROOT))

    if drifts:
        print("\n⚠ DERIVA sin cambio de veredicto en %d regiones: %s" % (len(drifts), ", ".join(drifts)))
    if surprises:
        print("\nSORPRESAS (%d): %s — o hay una REGRESIÓN visual nueva, o una divergencia "
              "catalogada se arregló (actualiza `expect` en endgame-cases.json)."
              % (len(surprises), ", ".join(surprises)))
        return 2
    print("\nOK: %d instantes del desenlace comparados contra el original." % len(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
