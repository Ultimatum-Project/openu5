"""
Núcleo compartido del arnés píxel-diff (task #26, FASE 1).

Piezas reutilizadas por `normalize.py`, `extract_ref.py` y `compare.py`:
  · PALETTE      — la paleta EGA REAL de Ultima V (16 colores, idx6 = #AA5500
                   marrón, EGA con brown-fix; re/notes/palette-idx6-verdict.md).
  · snap_to_palette — cuantiza una imagen RGB al índice EGA más cercano.
  · detect_frame_bbox — localiza el marco azul del chrome como FIDUCIAL
                   (paint_screen_frame: barra sup/inf/izq + separador + franja
                   der son un único componente conexo de azul idx1).
  · normalize    — registra una captura cualquiera (DOSBox con cromo macOS, o
                   canvas del port escalado) al ESPACIO LÓGICO 320×200 del
                   original, usando el marco como registro y corrigiendo el
                   aspecto 4:3 → cuadrado.

Sin dependencias fuera de numpy/PIL/scipy (todas presentes en el repo).
"""
from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage

# --- Paleta EGA real de U5 (índice → RGB). idx6 = marrón #AA5500 (brown-fix). ---
# Witness runtime: los frames reales de DOSBox-X pintan idx6 marrón, no oliva
# (re/notes/palette-idx6-verdict.md). CRÍTICO: si esto vuelve a oliva, el arnés
# compara oliva-vs-oliva y queda CIEGO a la regresión de paleta.
PALETTE = np.array(
    [
        (0x00, 0x00, 0x00),  # 0  negro
        (0x00, 0x00, 0xAA),  # 1  azul   (color del marco)
        (0x00, 0xAA, 0x00),  # 2  verde
        (0x00, 0xAA, 0xAA),  # 3  cian
        (0xAA, 0x00, 0x00),  # 4  rojo
        (0xAA, 0x00, 0xAA),  # 5  magenta
        (0xAA, 0x55, 0x00),  # 6  marrón (EGA con brown-fix; verdict runtime)
        (0xAA, 0xAA, 0xAA),  # 7  gris claro (borde interior del marco)
        (0x55, 0x55, 0x55),  # 8  gris oscuro
        (0x55, 0x55, 0xFF),  # 9  azul claro
        (0x55, 0xFF, 0x55),  # 10 verde claro
        (0x55, 0xFF, 0xFF),  # 11 cian claro
        (0xFF, 0x55, 0x55),  # 12 rojo claro
        (0xFF, 0x55, 0xFF),  # 13 magenta claro
        (0xFF, 0xFF, 0x55),  # 14 amarillo
        (0xFF, 0xFF, 0xFF),  # 15 blanco (esquinas, texto)
    ],
    dtype=np.int16,
)

EGA_BLUE = 1  # índice del azul del marco
EGA_BLACK = 0
EGA_WHITE = 15
EGA_GRAY = 7

# Espacio lógico del original.
SCREEN_W = 320
SCREEN_H = 200
# El marco azul ocupa filas lógicas 0..191 (barra inferior en 0xb9..0xbf=185..191);
# las filas 192..199 son la línea de estado (vientos/reloj), fuera del marco azul.
FRAME_LOGICAL_H = 192


def load_rgb(path: str) -> np.ndarray:
    """Carga una imagen como array RGB uint8 (H, W, 3), descartando alfa."""
    im = Image.open(path).convert("RGB")
    return np.asarray(im, dtype=np.uint8)


def snap_to_palette(rgb: np.ndarray) -> np.ndarray:
    """Devuelve un array de índices EGA (H, W) por vecino más cercano en RGB.

    Elimina el fringe de escalado/JPEG y la deriva de color de DOSBox, dejando
    una imagen comparable píxel a píxel en el espacio de 16 colores real.
    """
    h, w = rgb.shape[:2]
    # int32: 255² = 65025 desborda int16 (envolvería a negativo y el argmin
    # elegiría el color MÁS lejano — negro→blanco). En int32 la dist² es exacta.
    flat = rgb.reshape(-1, 3).astype(np.int32)
    pal = PALETTE.astype(np.int32)
    d = ((flat[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2)
    return d.argmin(axis=1).astype(np.uint8).reshape(h, w)


def detect_frame_bbox(idx: np.ndarray, keep_frac: float = 0.05) -> tuple[int, int, int, int]:
    """Localiza el marco azul del chrome y devuelve su bbox (x0, y0, x1, y1).

    El cromo es el azul DOMINANTE de la captura. No se puede exigir un único
    componente conexo: los notches grises de la barra superior y el texto de
    vientos parten el marco en varias piezas grandes (p.ej. borde-izquierdo del
    viewport vs. panel derecho). Estrategia robusta: etiquetar el azul, quedarse
    con las piezas cuyo tamaño ≥ `keep_frac`·(mayor pieza) — esto conserva los
    trozos del marco y descarta barras de tareas / ruido aislado — y devolver el
    bbox UNIÓN de las piezas conservadas.
    """
    blue = idx == EGA_BLUE
    if not blue.any():
        raise ValueError("no se encontró azul del marco (idx1) en la imagen")
    labels, n = ndimage.label(blue)
    sizes = ndimage.sum(np.ones_like(labels), labels, index=np.arange(1, n + 1))
    thresh = sizes.max() * keep_frac
    kept = np.where(sizes >= thresh)[0] + 1  # etiquetas (1-based) a conservar
    mask = np.isin(labels, kept)
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def frame_aspect(bbox: tuple[int, int, int, int]) -> float:
    """Aspecto ancho/alto del bbox del marco EN PÍXELES DE FUENTE (sin corregir).

    El marco lógico es 320×192. Cuando se muestra a 4:3 (píxeles ×1.2 verticales),
    el bbox mide 320 × (192·1.2) → aspecto 1.389. Un raster de píxel crudo (1:1)
    mide 320×192 → 1.667. Comparar este número entre dos capturas revela si una
    está estirada y la otra no (divergencia estructural de aspecto).
    """
    x0, y0, x1, y1 = bbox
    return (x1 - x0 + 1) / (y1 - y0 + 1)


def normalize(rgb: np.ndarray) -> tuple[np.ndarray, dict]:
    """Registra una captura al espacio lógico 320×200 y la devuelve como índices EGA.

    Pasos: (1) snap a paleta, (2) detecta el marco azul como fiducial, (3) recorta
    al marco extendiendo hacia abajo para recuperar la línea de estado (filas
    lógicas 192..199, fuera del marco), (4) reescala a 320×200 corrigiendo el
    aspecto (el marco pasa a ocupar exactamente 320×192 lógicos).

    Devuelve (idx320x200, meta) donde meta trae el bbox de fuente y el aspecto
    medido (para el chequeo estructural del comparador).
    """
    idx = snap_to_palette(rgb)
    x0, y0, x1, y1 = detect_frame_bbox(idx)
    fh = y1 - y0 + 1  # alto del marco en px de fuente = 192 lógicos
    # Extiende el recorte hacia abajo hasta cubrir las 200 filas lógicas.
    px_per_row = fh / FRAME_LOGICAL_H
    y1_full = y0 + int(round(SCREEN_H * px_per_row)) - 1
    y1_full = min(y1_full, rgb.shape[0] - 1)
    crop = rgb[y0 : y1_full + 1, x0 : x1 + 1]
    # Reescala a 320×200 (corrige aspecto: alto físico → 200 filas cuadradas).
    im = Image.fromarray(crop).resize((SCREEN_W, SCREEN_H), Image.BILINEAR)
    out = snap_to_palette(np.asarray(im, dtype=np.uint8))
    meta = {
        "src_bbox": (x0, y0, x1, y1),
        "src_frame_aspect": round(frame_aspect((x0, y0, x1, y1)), 4),
        "src_size": (int(rgb.shape[1]), int(rgb.shape[0])),
    }
    return out, meta


def idx_to_rgb(idx: np.ndarray) -> np.ndarray:
    """Reconstruye una imagen RGB uint8 desde índices EGA (para volcar PNG)."""
    return PALETTE[idx].astype(np.uint8)


def save_idx_png(idx: np.ndarray, path: str, scale: int = 1) -> None:
    """Vuelca índices EGA como PNG (opcionalmente a escala entera, nearest)."""
    im = Image.fromarray(idx_to_rgb(idx))
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)
