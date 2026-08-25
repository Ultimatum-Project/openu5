#!/usr/bin/env python3
"""Hornea el ATLAS de agua xBRZ para la piel «shader» (tarea water-look, vía (1)).

El look "olas continuas" que el usuario eligió viene del escalador xBRZ (Zenju). El
juego usa su xBR propio (dashes cortos). Como el agua es DETERMINISTA (scroll fn32 de
16 fases + composite de costa/ríos), pre-horneamos con el xBRZ OFFLINE del banco cada
tile de agua × 16 fases → atlas que la piel shader blitea (cero xBRZ en runtime).

  ── ATRIBUCIÓN / LICENCIA ──────────────────────────────────────────────────────
  El escalado lo hace `xbrz_raw` (banco), port del xBRZ de Zenju — **GPL v3**
  (banco/tools/xbrzscale-shader/License.txt, Copyright Zenju). El proyecto publica
  GPL-3.0 → compatible. **PENDIENTE PARA PUBLICACIÓN**: reflejar la atribución de
  xBRZ (Zenju, GPLv3) en el NOTICE del repo. La sesión de publicación lo recoge.
  ────────────────────────────────────────────────────────────────────────────────

Set de agua (derivado del binario, EGA.DRV fn32; ver re/notes/water-anim-audit.md):
  - SCROLL (mec. B): 0x01,0x02,0x03,0x8f  → horneado SEAMLESS (truco 3×3).
  - COMPOSITE (mec. C): costa 0x34-37, ríos 0x60-6f, esquinas 0xe4-e7 (fuente 0x03,
    máscaras 0xd0-d3 / 0x70-7f) → horneado PER-TILE (caveat: uniones inter-tile no
    se funden como el campo completo; documentado).

Salida: game/assets/water-xbrz.png (atlas, gitignored) + water-xbrz.json (manifest,
tracked). Regenerable: `python3 game/tools/water-xbrz/bake_water_xbrz.py`.
"""
import json, os, struct, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))          # worktree root
SK = "<repo>/.claude/worktrees/skin-hd/docs/skin-remaster"
DRV = f"{SK}/banco/tools/xbrzscale-shader/xbrz_raw"
ATLAS = os.path.join(ROOT, "game/assets/tiles-ega.png")
OUT_PNG = os.path.join(ROOT, "game/assets/water-xbrz.png")
OUT_JSON = os.path.join(ROOT, "game/assets/water-xbrz.json")

F = 6            # xBRZ ×6 (= SHADER_FACTOR)
T = 16           # tile px
PHASES = 16      # scroll fn32 periodo

SCROLL_TILES = [0x01, 0x02, 0x03, 0x8f]
WATER_SOURCE = 0x03
# composite dst -> mask (LITERAL de game/src/render/waterfn32.ts)
COMPOSITE = {}
for i in range(16):
    COMPOSITE[0x60 + i] = 0x70 + i          # ríos
for i in range(4):
    COMPOSITE[0x34 + i] = 0xd0 + i          # costa
for i in range(4):
    COMPOSITE[0xe4 + i] = 0xd0 + i          # esquinas

EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),
       (170,170,170),(85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),
       (255,85,255),(255,255,85),(255,255,255)]

_atlas = None
def tile(tid):
    global _atlas
    if _atlas is None:
        _atlas = Image.open(ATLAS).convert("RGBA")
    sx, sy = (tid % 32) * T, (tid // 32) * T
    return np.asarray(_atlas.crop((sx, sy, sx + T, sy + T)), np.uint8)

def scroll_down(base, off):
    return np.roll(base, off % T, axis=0)

def ega_mask(maskid):
    a = tile(maskid)[..., :3].astype(np.int32).reshape(-1, 3)
    pal = np.array(EGA, np.int32)
    idx = ((a[:, None, :] - pal[None, :, :]) ** 2).sum(2).argmin(1).reshape(T, T)
    return ((idx >> 3) & 1).astype(bool)      # plano-3 (intensidad)

def composite(dst_id, mask_id, off):
    bank = tile(dst_id)
    water = scroll_down(tile(WATER_SOURCE), off)
    m = ega_mask(mask_id)[..., None]
    return np.where(m, water, bank).astype(np.uint8)

def xbrz(rgba):
    im = Image.fromarray(rgba, "RGBA")
    payload = struct.pack("<iii", F, im.width, im.height) + im.tobytes()
    p = subprocess.run([DRV], input=payload, stdout=subprocess.PIPE, check=True)
    ow, oh = struct.unpack("<ii", p.stdout[:8])
    return np.asarray(Image.frombytes("RGBA", (ow, oh), p.stdout[8:]), np.uint8)

def bake_seamless(tid, off):
    """Truco 3×3: 3×3 del tile scrolleado → xBRZ → recorte central (seamless)."""
    base = scroll_down(tile(tid), off)
    g = np.tile(base, (3, 3, 1))
    big = xbrz(g)
    s = T * F
    return big[s:2 * s, s:2 * s]

def bake_pertile(tid, mask_id, off):
    return xbrz(composite(tid, mask_id, off))


if __name__ == "__main__":
    tiles = SCROLL_TILES + list(COMPOSITE.keys())
    tiles = sorted(set(tiles))
    cell = T * F                                  # 96
    atlas = np.zeros((len(tiles) * cell, PHASES * cell, 4), np.uint8)
    manifest = {"factor": F, "tile": T, "phases": PHASES, "cell": cell,
                "note": "xBRZ (Zenju, GPLv3) — atribución pendiente en NOTICE",
                "rows": {}}
    for r, tid in enumerate(tiles):
        for k in range(PHASES):
            if tid in SCROLL_TILES:
                out = bake_seamless(tid, k)
            else:
                out = bake_pertile(tid, COMPOSITE[tid], k)
            atlas[r * cell:(r + 1) * cell, k * cell:(k + 1) * cell] = out
        manifest["rows"][f"0x{tid:02x}"] = r
    Image.fromarray(atlas, "RGBA").save(OUT_PNG)
    json.dump(manifest, open(OUT_JSON, "w"), indent=1)
    print(f"atlas {atlas.shape[1]}x{atlas.shape[0]} · {len(tiles)} tiles × {PHASES} fases → {OUT_PNG}")
    print(f"manifest → {OUT_JSON}")
