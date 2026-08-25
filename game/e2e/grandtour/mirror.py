#!/usr/bin/env python3
"""Espejo por estado del Grand Tour, por capítulo — wrapper de `re/tools/mirror_runner`.

Uso:  python3 game/e2e/grandtour/mirror.py ch01
      python3 game/e2e/grandtour/mirror.py ch01 --allow-foreign-dosbox

Engancha el checkpoint `saves/<chapter>.{gam,sidecar.json}` (exportado por la spec del
capítulo) al espejo por estado (spec §3). Sin MODIFICAR `mirror_runner.py`/`oracle.py`
(deliverables de F3-T2, task #41): sólo los ORQUESTA.

Dos capas, ambas honestas:

  1. OFFSET-COVERAGE (siempre, sin dosbox): corre `diff_state` con un lector
     byte-fiel del propio .GAM y `sidecar=None`. Valida que ch01.gam cubre y decodifica
     TODOS los offsets mapeados por `mirror_globals` (detecta un .GAM truncado o una
     deriva de offsets). NO es el espejo de estado — es un smoke del arnés.

  2. ESPEJO DE ESTADO REAL (si el oráculo está disponible): bootea ULTIMA.EXE headless,
     inyecta el .GAM, "Journey Onward" y compara DS↔fichero/sidecar con tolerancia 0.
     Si el oráculo NO está disponible (sin dosbox-x / sin datos del juego) o hay otro
     dosbox ajeno (regla 7), se DECLARA SALTADO y se sale 0 — el barrido de espejo real
     está gated a la ventana del usuario (spec §4.1). Un FAIL de un campo mapeado en el
     espejo real SÍ hace salir 1 (es un hallazgo).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]  # game/e2e/grandtour → repo root
SAVES = HERE / "saves"
sys.path.insert(0, str(ROOT / "re" / "tools"))

import mirror_globals as mg  # noqa: E402
import mirror_runner as mr  # noqa: E402


def _paths(chapter: str) -> tuple[Path, Path]:
    gam = SAVES / f"{chapter}.gam"
    sidecar = SAVES / f"{chapter}.sidecar.json"
    if not gam.is_file():
        sys.exit(f"[espejo] no existe {gam} — corre antes la spec del capítulo (tour:{chapter}:spec)")
    return gam, sidecar


def offset_coverage(gam: bytes, label: str) -> bool:
    """Smoke sin dosbox: cada offset mapeado cae dentro del .GAM y decodifica."""
    reader = lambda addr, n: bytes(gam[addr - mg.ROSTER_OFF_REF : addr - mg.ROSTER_OFF_REF + n])
    rep = mr.diff_state(gam, None, reader, mg.ROSTER_OFF_REF, label=f"{label} (offset-coverage, sin dosbox)")
    print(rep.render())
    if not rep.ok:
        print("[espejo] OFFSET-COVERAGE FAIL: el .GAM no casa con la tabla de offsets (¿truncado? ¿deriva?)")
    return rep.ok


def main(argv: list[str]) -> int:
    import argparse

    ap = argparse.ArgumentParser(description="Espejo por estado del Grand Tour por capítulo.")
    ap.add_argument("chapter", help="id del capítulo, p.ej. ch01")
    ap.add_argument("--allow-foreign-dosbox", action="store_true",
                    help="procede con el espejo real aunque haya otro dosbox-x vivo (confound de CPU). "
                         "También activable con la env var U5RE_MIRROR_ALLOW_FOREIGN=1")
    ap.add_argument("--json", dest="json_out", default=None, help="escribe el informe del espejo real aquí")
    args = ap.parse_args(argv)
    # El dosbox del USUARIO es sólo confound de CPU (freewheel compartido): se procede sin
    # tocarlo. Env var (directiva del lead) equivale al flag.
    allow_foreign = args.allow_foreign_dosbox or os.environ.get("U5RE_MIRROR_ALLOW_FOREIGN", "") not in ("", "0")

    gam_path, sidecar_path = _paths(args.chapter)
    gam = gam_path.read_bytes()

    # Capa 1 — offset-coverage (siempre).
    if not offset_coverage(gam, args.chapter):
        return 1

    # Capa 2 — espejo de estado real (gated).
    import oracle  # noqa: E402
    if not oracle.available():
        print(f"[espejo] SALTADO (real): oráculo no disponible (sin dosbox-x / datos del juego). "
              f"El barrido de espejo real está gated a la ventana del usuario (spec §4.1).")
        return 0
    foreign = oracle._foreign_dosbox()
    if foreign and not allow_foreign:
        print("[espejo] SALTADO (real): otro dosbox-x vivo (regla 7). Cierra el ajeno o pasa "
              "--allow-foreign-dosbox / U5RE_MIRROR_ALLOW_FOREIGN=1 para tratarlo como confound de CPU.")
        for ln in foreign:
            print("  " + ln)
        return 0
    if foreign:
        print(f"[espejo] procedo con {len(foreign)} dosbox-x AJENO vivo (confound de CPU, NO se toca):")
        for ln in foreign:
            print("  " + ln)

    sidecar = sidecar_path if sidecar_path.is_file() else None
    report = mr.run(gam_path, sidecar, label=args.chapter, allow_foreign=allow_foreign)
    print(report.render())
    if args.json_out:
        import json
        Path(args.json_out).write_text(json.dumps(report.to_dict(), indent=2))
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
