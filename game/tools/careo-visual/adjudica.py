#!/usr/bin/env python3
"""
ADJUDICADOR de la batería de regresión del método — UN solo instrumento para los dos
regímenes.

Lee lo que capturan los arneses Playwright y da el veredicto con `careolib`:

  · RALO  (`regresion-metodo.pw.ts` → `<dir>/escenas.json` + PNGs)
      base vs base2 = SUELO de no-determinismo; cada siembra se adjudica CONTRA ese suelo.
  · DENSO (`captura-densa.pw.ts` → `<dir>/<escena>/densa/*.png` + `meta.json`)
      tren de pulsos por escena; se comparan las DESCRIPCIONES PARAMÉTRICAS, no 1560 pares.

Salida: una tabla, y **exit 1 si algún control positivo NO cazó** — que es el rojo ruidoso
que este encargo pide. Un método ciego no puede salir con exit 0.

    python3 game/tools/careo-visual/adjudica.py OUT_RALO [OUT_DENSO ...]

🔴 EXIT 1 TAMBIÉN SI NO HAY NADA QUE ADJUDICAR. Un adjudicador que no encuentra capturas y
sale con 0 es indistinguible de uno que las encontró todas verdes — y ése es exactamente el
modo de fallo (careo ciego, informe intacto) contra el que existe esta batería.
"""
from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

import numpy as np
from PIL import Image

import careolib as K


def carga(png: Path) -> np.ndarray:
    """PNG del canvas lógico 320×200 → índices EGA. El port renderiza EGA exacta."""
    rgb = np.asarray(Image.open(png).convert("RGB"), dtype=np.uint8)
    if rgb.shape[:2] != (K.SCREEN_H, K.SCREEN_W):
        raise SystemExit(f"{png}: {rgb.shape[:2]} no es el canvas lógico 320×200")
    return K.cuantiza_ega(rgb)


def adjudica_ralo(d: Path) -> list[tuple[str, str, str, bool]]:
    """Devuelve filas (escena, canal/régimen, veredicto, ¿ok?) del régimen ralo."""
    meta = json.loads((d / "escenas.json").read_text())
    filas = {f["escena"]: f for f in meta["filas"]}
    out: list[tuple[str, str, str, bool]] = []
    if "base" not in filas or "base2" not in filas:
        raise SystemExit(f"{d}: faltan `base`/`base2` — sin suelo no hay adjudicación (A4)")
    base = carga(d / filas["base"]["png"])
    base2 = carga(d / filas["base2"]["png"])
    suelo = K.dif_celdas(base, base2)
    out.append(
        (
            "base vs base2",
            "negativo · ralo",
            f"SUELO = {suelo['celdas']} celdas / {suelo['px']} px",
            True,  # el suelo no es un control que pueda fallar: es el dato que adjudica
        )
    )
    for nombre, f in filas.items():
        if nombre in ("base", "base2"):
            continue
        if not f["png"]:  # escena rechazada por la guarda (cofre-muro)
            out.append((nombre, f"{f['canal']} · {f['regimen']}", f.get("nota", "SIN PNG"), True))
            continue
        v = K.veredicto_siembra(base, base2, carga(d / f["png"]))
        ok = v["estado"] == "CAZADA"
        out.append(
            (
                nombre,
                f"{f['canal']} · {f['regimen']}",
                f"{v['estado']} · brutas={v['celdas_brutas']} suelo={v['celdas_suelo']} "
                f"netas={v['celdas_netas']} {v['mapa_neto'][:4]}",
                ok,
            )
        )
    return out


#: Cuantización del testigo de vídeo: 1 fotograma a 30 fps. Es el suelo IRREDUCIBLE de
#: cualquier comparación de cadencia contra el corpus, así que ninguna diferencia por
#: debajo de esto se declara cazada, por muy limpio que salga el instrumento del port.
CUANTIZACION_VIDEO_MS = 33.0

#: 🔴 EL MUTANTE DE LA MITAD DENSA. `CAREO_MUTANTE=ralo` adjudica las MISMAS capturas
#: mirando sólo los dos instantes que mira el régimen ralo (t≈320 ms y el asentado final),
#: que es literalmente lo que `captura-port.pw.ts` fotografía. Tiene que salir NO CAZÓ: si
#: saliera cazada, el régimen denso no estaría probando nada que el ralo no probase ya —
#: que es la lección de `xshift`, aplicada al eje del régimen en vez del canal.
MUTANTE = __import__("os").environ.get("CAREO_MUTANTE", "")


def _serie(meta_p: Path) -> tuple[list[float], list[float]]:
    frames_dir = meta_p.parent / "densa"
    meta = json.loads(meta_p.read_text())
    ts = [f["t"] for f in meta["frames"]]
    br = [K.brillo_viewport(carga(frames_dir / f["f"])) for f in meta["frames"]]
    if MUTANTE == "ralo":
        # Los DOS instantes del par ralo: 320 ms de asentado tras la tecla, y el final.
        i320 = min(range(len(ts)), key=lambda i: abs(ts[i] - 320.0))
        return [ts[i320], ts[-1]], [br[i320], br[-1]]
    return ts, br


def adjudica_denso(d: Path) -> list[tuple[str, str, str, bool]]:
    """Tren de pulsos por escena, y cada siembra CAREADA CONTRA `base`.

    ★★ «Tiene pulsos» NO es haber cazado nada: un instrumento que devuelve un tren para
    todo diría ✓ aunque la siembra no hubiera hecho efecto. Lo que se compara son las
    DESCRIPCIONES PARAMÉTRICAS, y el umbral se DERIVA de la dispersión del propio `base`
    (su ruido de muestreo a rAF), no de una constante escrita a mano que caducaría sola.
    """
    metas = [m for m in sorted(d.glob("**/meta.json")) if (m.parent / "densa").is_dir()]
    if not metas:
        return []
    trenes: dict[str, dict] = {}
    for meta_p in metas:
        meta = json.loads(meta_p.read_text())
        escena = str(meta.get("siembra") or meta.get("escena") or meta_p.parent.name)
        trenes[escena] = K.tren_de_pulsos(*_serie(meta_p))

    out: list[tuple[str, str, str, bool]] = []
    base = trenes.get("base") or trenes.get(metas[0].parent.name)
    if base is None or not base.get("bimodal"):
        motivo = "SIN BIMODALIDAD" if base else "SIN ESCENA BASE"
        for escena, v in trenes.items():
            out.append((escena, "cadencia · denso", f"base inservible: {motivo}", False))
        return out
    disp = max(base["pulsos"]) - min(base["pulsos"])  # ruido del propio instrumento
    umbral = max(2 * disp, CUANTIZACION_VIDEO_MS)
    med = statistics.median(base["pulsos"])
    out.append(
        (
            "base",
            "cadencia · denso",
            f"pulsos={base['pulsos']} huecos={base['huecos']} · dispersión={disp} ms "
            f"⇒ umbral derivado {umbral:.0f} ms",
            True,
        )
    )
    for escena, v in trenes.items():
        if escena == "base":
            continue
        if not v.get("bimodal"):
            out.append(
                (escena, "cadencia · denso", f"{v['motivo']} — el instrumento NO inventa un tren", False)
            )
            continue
        delta = abs(statistics.median(v["pulsos"]) - med)
        ok = delta > umbral
        out.append(
            (
                escena,
                "cadencia · denso",
                f"pulsos={v['pulsos']} · Δmediana={delta:.0f} ms vs umbral {umbral:.0f}",
                ok,
            )
        )
    return out


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    filas: list[tuple[str, str, str, bool]] = []
    for arg in argv[1:]:
        d = Path(arg)
        if not d.is_dir():
            raise SystemExit(f"{d}: no es un directorio de capturas")
        if (d / "escenas.json").is_file():
            filas += adjudica_ralo(d)
        filas += adjudica_denso(d)

    if not filas:
        print("ADJUDICA: NADA QUE ADJUDICAR — no se encontró ninguna captura.", file=sys.stderr)
        print("          Un adjudicador vacío que saliera con 0 sería indistinguible", file=sys.stderr)
        print("          de uno que lo encontró todo verde. Exit 1 a propósito.", file=sys.stderr)
        return 1

    ancho = max(len(f[0]) for f in filas)
    print(f"{'escena'.ljust(ancho)}  {'canal · régimen'.ljust(20)}  veredicto")
    print("-" * (ancho + 24 + 40))
    for nombre, canal, txt, ok in filas:
        print(f"{nombre.ljust(ancho)}  {canal.ljust(20)}  {'✓' if ok else '✗ NO CAZÓ'}  {txt}")
    fallos = [f[0] for f in filas if not f[3]]
    if fallos:
        print(f"\nADJUDICA: EL MÉTODO DEJÓ DE VER en {len(fallos)}: {', '.join(fallos)}", file=sys.stderr)
        return 1
    print(f"\nADJUDICA: {len(filas)} controles, todos cazados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
