#!/usr/bin/env python3
"""
NÚCLEO DEL CAREO VISUAL — los instrumentos, en el árbol y con batería propia.

════════════════════════════════════════════════════════════════════════════════════════
POR QUÉ EXISTE (y por qué no es «otra copia de las herramientas»)
════════════════════════════════════════════════════════════════════════════════════════
Hasta hoy los instrumentos del careo visual vivían SÓLO fuera del repo
(`~/PROYECTS/OpenU5-videos/careo-visual/*/herramienta/*.py`), uno por carril, y lo
aprendido sobre sus AVERÍAS vivía en prosa dentro de los informes. Consecuencia medida:
cada carril nuevo vuelve a tropezar con las mismas cinco o seis trampas, y —peor— un
careo cuyo instrumento se estropea sigue emitiendo su informe con «cero divergencias».
Un careo ciego y un careo limpio son indistinguibles desde el informe.

Este fichero es la mitad del arreglo: los instrumentos que DECIDEN (no los que decodifican
vídeo) viven aquí, con su registro de averías conocidas en
`re/notes/careo-artefactos-conocidos.md` y su batería de regresión en `test_careolib.py`.
La batería no pregunta «¿pasa el port?»: pregunta **«¿sigue el método cazando lo que una
vez cazó?»**, y cada control suyo se estrena EN CADA CORRIDA contra el instrumento roto
de la manera en que históricamente se rompió.

FRONTERA DECLARADA: aquí NO está la decodificación del vídeo (ffmpeg/PIL sobre .webm de
EA) ni el OCR del atlas IBM. Eso sigue fuera del repo porque toca material de EA. Lo que
sí está es todo lo que convierte píxeles en un VEREDICTO — que es donde han vivido todas
las averías registradas hasta hoy.

La cuantización a EGA NO se reimplementa: se importa de `../pixeldiff/pdlib.py`, que ya la
tiene con el arreglo de int32 y con su propia guarda anti-ceguera (`test_pdlib.py`). Dos
implementaciones de la misma paleta serían dos sitios que mantener y uno que se olvidaría.
"""
from __future__ import annotations

import statistics
import sys
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pixeldiff"))
import pdlib  # noqa: E402  (ruta inyectada arriba a propósito)

PALETTE = pdlib.PALETTE
cuantiza_ega = pdlib.snap_to_palette

SCREEN_W = pdlib.SCREEN_W  # 320
SCREEN_H = pdlib.SCREEN_H  # 200

# ── Geometría del espacio lógico 320×200, medida en el propio arnés ────────────────────
#: Viewport del mapa: origen (8,8), rejilla 11×11 de celdas de 16 px.
VIEWPORT_X0, VIEWPORT_Y0 = 8, 8
CELDA = 16
REJILLA = 11
#: Banda de consola (el disparador ORIGINAL de ch01 §2.2).
BANDA_CONSOLA = (192, 88, 120, 96)  # x, y, w, h  → x192..311, y88..183
#: Disparador CORREGIDO (ficha F2, ch01 §2.2): la columna derecha ENTERA, consola ∪ panel.
#: Recupera los 42 compases de panel que la consola sola pierde (172 → 214, +24 %).
COLUMNA_DERECHA = (192, 8, 120, 176)  # x192..311, y8..183
#: Verticales blancas de 1 px del marco DOS que `frame.ts` transcribe de
#: `paint_screen_frame` 0x637e. Son el clasificador de régimen y el testigo del remuestreo.
MARCO_VERTICALES = (7, 184)

EGA_NEGRO, EGA_AZUL, EGA_AZUL_CLARO, EGA_BLANCO = 0, 1, 9, 15


# ════════════════════════════════════════════════════════════════════════════════════════
# 1. REMUESTREO DEL VÍDEO — artefacto A2 (el promediado destruye el detalle de 1 px)
# ════════════════════════════════════════════════════════════════════════════════════════
def muestrea_nearest(
    rgb: np.ndarray,
    caja: tuple[float, float, float, float],
    w: int = SCREEN_W,
    h: int = SCREEN_H,
) -> np.ndarray:
    """Recupera el búfer lógico w×h PUNTEANDO el centro de cada píxel nativo.

    El vídeo del testigo es un reescalado NEAREST de un búfer 320×200: puntear el centro
    lo recupera EXACTO y promediar lo destruye. `caja` = (x0, y0, ancho, alto) del área
    útil en el fotograma de origen, en coordenadas de origen (puede tener x0/y0 negativos:
    la calibración por centroides de las líneas del marco da (0,-1,855,481) para 854×480).

    🔴 Artefacto A2 del registro: `scale=320:200` ingenuo (area) da **0 %** de acuerdo en
    la línea blanca de 1 px del marco; esta función da **100 %**. Un careo con el
    remuestreo ingenuo pierde TODO el detalle de 1 px y sus informes siguen saliendo.
    """
    x0, y0, aw, ah = caja
    H, W = rgb.shape[:2]
    xs = np.clip(np.floor(x0 + (np.arange(w) + 0.5) * aw / w).astype(int), 0, W - 1)
    ys = np.clip(np.floor(y0 + (np.arange(h) + 0.5) * ah / h).astype(int), 0, H - 1)
    return rgb[np.ix_(ys, xs)]


def muestrea_area(
    rgb: np.ndarray,
    caja: tuple[float, float, float, float],
    w: int = SCREEN_W,
    h: int = SCREEN_H,
) -> np.ndarray:
    """EL INSTRUMENTO ROTO de A2, conservado A PROPÓSITO como MUTANTE de la batería.

    Promedia cada bloque en vez de puntear su centro — que es lo que hace `scale=320:200`
    y cualquier `resize` con interpolación. No se usa en ningún careo: existe para que
    `test_careolib.py` pueda ESTRENAR en cada corrida el control que lo descarta. Un
    control que nunca se ha visto enrojecer no es un control.
    """
    x0, y0, aw, ah = caja
    H, W = rgb.shape[:2]
    out = np.zeros((h, w, 3), dtype=np.uint8)
    for j in range(h):
        ya = int(np.floor(y0 + j * ah / h))
        yb = int(np.ceil(y0 + (j + 1) * ah / h))
        for i in range(w):
            xa = int(np.floor(x0 + i * aw / w))
            xb = int(np.ceil(x0 + (i + 1) * aw / w))
            blq = rgb[max(ya, 0) : max(yb, 1), max(xa, 0) : max(xb, 1)]
            if blq.size:
                out[j, i] = blq.reshape(-1, 3).mean(axis=0).round()
    return out


def blancura_vertical_marco(idx: np.ndarray, columnas: Sequence[int] = MARCO_VERTICALES) -> float:
    """Fracción de píxeles BLANCOS (EGA 15) a lo largo de las verticales de 1 px del marco.

    Es a la vez el clasificador de régimen de ch01 §1 (1,00 dentro de pantalla de juego
    frente a p95=0,43 fuera) y el testigo del remuestreo (A2). Se mide sobre las filas del
    marco (0..191), no sobre la línea de estado.

    🔴 SÓLO EL BLANCO CUENTA, y esto NO es un detalle de estilo — es el mismo artefacto A2
    una capa más adentro. La primera versión de esta función contaba «claros» = blanco ∪
    gris, y con ella el mutante del promediado **daba 1,00 y no enrojecía**: promediar la
    línea blanca con el azul del marco da (191,191,234), que cuantiza a GRIS CLARO (idx 7),
    no a azul. Es decir, un instrumento que acepta gris declara «línea recuperada» sobre
    una línea DESTRUIDA. Medido al estrenar el control (`test_a2_*`): con gris, 1,00 en los
    dos lados; sólo con blanco, 1,00 frente a 0,00 — que son las dos cifras del informe.
    """
    filas = idx[0 : pdlib.FRAME_LOGICAL_H]
    return float(np.mean([(filas[:, c] == EGA_BLANCO).mean() for c in columnas]))


# ════════════════════════════════════════════════════════════════════════════════════════
# 2. DIFERENCIA POR CELDA — la unidad en la que hablan todos los informes
# ════════════════════════════════════════════════════════════════════════════════════════
def dif_celdas(a: np.ndarray, b: np.ndarray, umbral_px: int = 1) -> dict:
    """Celdas 16×16 del viewport que difieren, y píxeles distintos totales.

    Los informes del careo cuentan en CELDAS («1 tile», «28 tiles», «58 celdas»), no en
    píxeles: esta es la unidad canónica y la que hay que usar para citarlos.
    """
    if a.shape != b.shape:
        raise ValueError(f"formas distintas: {a.shape} vs {b.shape}")
    mapa: list[tuple[int, int]] = []
    px = 0
    for r in range(REJILLA):
        for c in range(REJILLA):
            y = VIEWPORT_Y0 + r * CELDA
            x = VIEWPORT_X0 + c * CELDA
            ca = a[y : y + CELDA, x : x + CELDA]
            cb = b[y : y + CELDA, x : x + CELDA]
            n = int((ca != cb).sum())
            if n >= umbral_px:
                mapa.append((c, r))
                px += n
    return {"celdas": len(mapa), "px": px, "mapa": mapa}


# ════════════════════════════════════════════════════════════════════════════════════════
# 3. EL ADJUDICADOR — artefacto A4 (el suelo de no-determinismo del propio port)
# ════════════════════════════════════════════════════════════════════════════════════════
def veredicto_siembra(base: np.ndarray, base2: np.ndarray, siembra: np.ndarray) -> dict:
    """Adjudica una siembra CONTRA EL SUELO DE NO-DETERMINISMO, en los dos sentidos.

    🔴 Artefacto A4 del registro, medido el 25-08 por el carril de ceremonias: el fotograma
    «después» daba 28 celdas / 2198 px entre base y siembra ⇒ leído solo, «el careo ralo SÍ
    la caza» y las dos siembras del régimen 2 se descartan. Pero base vs base2 —DOS CORRIDAS
    IDÉNTICAS— daba EXACTAMENTE las mismas 28 celdas y los mismos 2198 px: son los tiles de
    AGUA, que el port anima a reloj de pared. No era la siembra; era el suelo.

    La regla que esta función encierra: **lo que la siembra cambia es el CONJUNTO de celdas
    que difieren MENOS el conjunto que ya difería sin sembrar.** Y adjudica en los DOS
    sentidos, que es la lección entera:
      · `CAZADA`  — quedan celdas netas ⇒ el canal ve la siembra.
      · `SUELO`   — hay diferencia bruta pero es SUBCONJUNTO del suelo ⇒ el canal NO la ve
                    (y quien lea la bruta concluirá lo contrario de lo que pasó).
      · `CIEGA`   — ni bruta ni neta ⇒ el canal no la ve, sin ambigüedad.
    """
    suelo = dif_celdas(base, base2)
    bruto = dif_celdas(base, siembra)
    netas = sorted(set(bruto["mapa"]) - set(suelo["mapa"]))
    if netas:
        estado = "CAZADA"
    elif bruto["celdas"]:
        estado = "SUELO"
    else:
        estado = "CIEGA"
    return {
        "estado": estado,
        "celdas_suelo": suelo["celdas"],
        "celdas_brutas": bruto["celdas"],
        "celdas_netas": len(netas),
        "mapa_neto": netas,
    }


def veredicto_siembra_ingenuo(base: np.ndarray, base2: np.ndarray, siembra: np.ndarray) -> dict:
    """EL ADJUDICADOR ROTO de A4, conservado como MUTANTE: ignora `base2`.

    Es literalmente la lectura que casi tumba las dos siembras buenas del régimen 2. No se
    usa en ningún careo; existe para que la batería vea enrojecer su control.
    """
    bruto = dif_celdas(base, siembra)
    return {
        "estado": "CAZADA" if bruto["celdas"] else "CIEGA",
        "celdas_suelo": None,
        "celdas_brutas": bruto["celdas"],
        "celdas_netas": bruto["celdas"],
        "mapa_neto": bruto["mapa"],
    }


# ════════════════════════════════════════════════════════════════════════════════════════
# 4. TREN DE PULSOS — instrumento de la clase PALETA (aparición, curandero, Códice)
# ════════════════════════════════════════════════════════════════════════════════════════
SEPARACION_MINIMA = 20.0


def tren_de_pulsos(
    ts_ms: Sequence[float], brillos: Sequence[float], sep_minima: float = SEPARACION_MINIMA
) -> dict:
    """Describe una ceremonia de inversión de paleta por sus pulsos ON y sus huecos.

    ★★ **La bimodalidad se DECLARA antes de decidir.** El umbral sale de las dos modas del
    propio tramo (p10/p90); si la separación no llega a `sep_minima` la función dice
    `SIN BIMODALIDAD` en vez de inventar un tren. Ésa es la diferencia entre un instrumento
    y un generador de cifras: sobre un tramo sin inversión, un umbral a media distancia
    entre el mínimo y el máximo del RUIDO produce siempre «pulsos».

    Y es el instrumento de UNA CLASE de ceremonia (§6 del README): sobre una ceremonia de
    GEOMETRÍA —la puerta lunar, que no toca la paleta— tiene que salir SIN BIMODALIDAD.
    Usar el instrumento de una clase en otra no mide nada.
    """
    ts = list(map(float, ts_ms))
    br = list(map(float, brillos))
    if len(ts) != len(br):
        raise ValueError("ts_ms y brillos con longitudes distintas")
    if len(ts) < 4:
        return {"bimodal": False, "motivo": "MUESTRAS INSUFICIENTES", "n": len(ts)}
    p10, p90 = float(np.percentile(br, 10)), float(np.percentile(br, 90))
    sep = p90 - p10
    if sep < sep_minima:
        return {"bimodal": False, "motivo": "SIN BIMODALIDAD", "separacion": round(sep, 1)}
    umbral = (p10 + p90) / 2.0
    on = [b > umbral for b in br]
    pulsos: list[float] = []
    huecos: list[float] = []
    i = 0
    while i < len(on):
        j = i
        while j + 1 < len(on) and on[j + 1] == on[i]:
            j += 1
        # Duración del tramo = hasta la marca del PRIMER fotograma del tramo siguiente
        # (a 60 fps el último fotograma del tramo aún está en el estado del tramo).
        fin = ts[j + 1] if j + 1 < len(ts) else ts[j]
        dur = fin - ts[i]
        # Tramos de BORDE (el primero y el último) descartados: están truncados por la
        # ventana de grabación, no por la ceremonia. Medirlos inventa un pulso corto.
        borde = i == 0 or j + 1 >= len(on)
        if not borde:
            (pulsos if on[i] else huecos).append(dur)
        i = j + 1
    return {
        "bimodal": True,
        "separacion": round(sep, 1),
        "umbral": round(umbral, 1),
        "pulsos": [round(p) for p in pulsos],
        "huecos": [round(h) for h in huecos],
        "n_pulsos": len(pulsos),
    }


# ════════════════════════════════════════════════════════════════════════════════════════
# 5. ESCALERA DE ETAPAS — instrumento de la clase GEOMETRÍA (cruce de puerta lunar)
# ════════════════════════════════════════════════════════════════════════════════════════
def altura_maciza(idx: np.ndarray, celda: tuple[int, int], color: int = EGA_AZUL_CLARO) -> int:
    """Nº de filas de una celda del viewport que siguen siendo CUERPO MACIZO del color dado.

    Es el instrumento del cruce de puerta lunar: el rectángulo mengua por arriba, así que
    su altura maciza baja 16→0 en 15 escalones (0x4912-0x492b: blit parcial + delay + dec).
    """
    c, r = celda
    y = VIEWPORT_Y0 + r * CELDA
    x = VIEWPORT_X0 + c * CELDA
    blq = idx[y : y + CELDA, x : x + CELDA]
    return int((blq == color).all(axis=1).sum())


def escalera_etapas(ts_ms: Sequence[float], alturas: Sequence[int]) -> dict:
    """Describe una ceremonia de geometría por su escalera de etapas.

    🔴 Artefacto A6 del registro (ficha G7): si la celda está FIJA y el jugador CAMINA, la
    puerta cambia de celda a cada paso y lo que el instrumento mide es AGUA — la escalera
    sale NO MONÓTONA. Por eso `ms_por_etapa` sólo se devuelve cuando la escalera es
    monótona decreciente: una cadencia calculada sobre una escalera que sube y baja es una
    cifra inventada, y en el informe se lee igual que una medida.
    """
    ts = list(map(float, ts_ms))
    al = [int(a) for a in alturas]
    if len(ts) != len(al):
        raise ValueError("ts_ms y alturas con longitudes distintas")
    cambios = [(ts[i], al[i - 1], al[i]) for i in range(1, len(al)) if al[i] != al[i - 1]]
    monotona = all(nuevo < viejo for _, viejo, nuevo in cambios)
    out: dict = {
        "escalones": len(cambios),
        "monotona": monotona,
        "altura_inicial": al[0] if al else None,
        "altura_final": al[-1] if al else None,
    }
    if not monotona:
        out["motivo"] = "ESCALERA NO MONÓTONA"
        out["ms_por_etapa"] = None
        out["cierre_ms"] = None
        return out
    if len(cambios) >= 2:
        pasos = [cambios[i][0] - cambios[i - 1][0] for i in range(1, len(cambios))]
        out["ms_por_etapa"] = round(statistics.median(pasos))
        out["cierre_ms"] = round(cambios[-1][0] - cambios[0][0])
    else:
        out["ms_por_etapa"] = None
        out["cierre_ms"] = None
    return out


# ════════════════════════════════════════════════════════════════════════════════════════
# 6. CENSO DE TILES ANIMADOS — artefacto A5 (el «0 tiles animados» vale sólo en interiores)
# ════════════════════════════════════════════════════════════════════════════════════════
def censo_animados(
    idxs: Sequence[np.ndarray], cambios_consola: int, umbral_px: int = 20
) -> dict:
    """Celdas que cambian en una ventana, y cuántos cambios acumula la que más.

    ★★ El argumento NO depende de que la ventana esté quieta — que es donde se quedó corta
    la medida de ch01 §2.1. Se compara el máximo de cambios de UNA celda contra el nº de
    fotogramas en los que la CONSOLA cambió: la diferencia son cambios SIN TURNO, y esos no
    los explica el juego por turnos. (ep02 t=344: 52 cambios en un tile frente a 11
    fotogramas con eco ⇒ ≥41 sin turno.)
    """
    if len(idxs) < 2:
        raise ValueError("hacen falta al menos 2 fotogramas")
    cuenta = np.zeros((REJILLA, REJILLA), dtype=int)
    for k in range(1, len(idxs)):
        d = dif_celdas(idxs[k - 1], idxs[k], umbral_px=umbral_px)
        for c, r in d["mapa"]:
            cuenta[r, c] += 1
    max_celda = int(cuenta.max())
    return {
        "celdas_con_cambio": int((cuenta > 0).sum()),
        "de": REJILLA * REJILLA,
        "max_cambios_en_una_celda": max_celda,
        "cambios_consola": int(cambios_consola),
        "cambios_sin_turno": max(0, max_celda - int(cambios_consola)),
        "anima_en_el_sitio": max_celda - int(cambios_consola) > 0,
    }


# ════════════════════════════════════════════════════════════════════════════════════════
# 7. SEGMENTADOR — ficha F1: UN COMPÁS POR ECO DE COMANDO, no por ventana de silencio
# ════════════════════════════════════════════════════════════════════════════════════════
def segmenta_por_silencio(
    ts_ms: Sequence[float], lineas: Sequence[Sequence[str]], ventana_ms: float = 200.0
) -> list[dict]:
    """EL SEGMENTADOR VIEJO, conservado como MUTANTE (ficha F1, ch01 §2.4).

    Agrupa por cambio de consola con una ventana de silencio. 🔴 FUNDE ACCIONES: dos
    pulsaciones separadas por menos de la ventana (6 fotogramas = 0,2 s) caen en el mismo
    compás y el port replicado se desfasa UNA acción — de ahí las tres filas al 71 % de
    acuerdo (c14–c16) que NO eran fallo del port. No se usa; existe para la batería.
    """
    comp: list[dict] = []
    ultimo: float | None = None
    for t, ls in zip(map(float, ts_ms), lineas):
        nuevas = list(ls)
        if not nuevas:
            continue
        if ultimo is not None and t - ultimo < ventana_ms and comp:
            comp[-1]["lineas"].extend(nuevas)
        else:
            comp.append({"t": t, "lineas": nuevas})
        ultimo = t
    return comp


def segmenta_por_eco(ts_ms: Sequence[float], lineas: Sequence[Sequence[str]]) -> list[dict]:
    """EL SEGMENTADOR ARREGLADO (ficha F1): **un compás por ECO DE COMANDO**.

    El eco de comando del original es una línea que empieza por `>`. Cada uno abre un
    compás; las líneas siguientes (respuestas multilínea legítimas: `Item:` / `On who:` /
    `Healed!`) se acumulan en el compás abierto. Los eventos de cambio sirven sólo para
    acotar la búsqueda, no para decidir el corte — que era el defecto de F1.
    """
    comp: list[dict] = []
    for t, ls in zip(map(float, ts_ms), lineas):
        for linea in ls:
            if linea.startswith(">"):
                comp.append({"t": float(t), "eco": linea, "lineas": [linea]})
            elif comp:
                comp[-1]["lineas"].append(linea)
    return comp


# ════════════════════════════════════════════════════════════════════════════════════════
# 8. DISPARADOR — ficha F2 (la columna derecha ENTERA) y A7 (el overlay del youtuber)
# ════════════════════════════════════════════════════════════════════════════════════════
def _recorta(idx: np.ndarray, caja: tuple[int, int, int, int]) -> np.ndarray:
    x, y, w, h = caja
    return idx[y : y + h, x : x + w]


def disparador(
    idxs: Sequence[np.ndarray],
    caja: tuple[int, int, int, int] = COLUMNA_DERECHA,
    mascara: tuple[int, int, int, int] | None = None,
    umbral_px: int = 1,
) -> list[int]:
    """Índices de fotograma donde la región del disparador CAMBIA.

    `caja` por defecto es la columna derecha ENTERA (consola ∪ panel) — la corrección de la
    ficha F2: el disparador de consola sola pierde el 42 % de los eventos de panel
    (recorrer Z-stats no escribe ni una línea), es decir 172 → 214 compases, +24 %.

    🔴 `mascara` es el artefacto A7: el overlay animado del youtuber («SUBSCRIBE», caja
    nativa medida en ch01 x216–293 y91–121) se pinta ENCIMA de la región del disparador y
    dispara solo, a ~unos por segundo. Se enmascara y se DECLARA — y **se mide por
    episodio, no se hereda**: en ch01 contamina 20,0 s de 532,9 (3,8 %) y en el tramo de
    ep02 no aparece en absoluto.
    """
    def region(k: int) -> np.ndarray:
        r = _recorta(idxs[k], caja).copy()
        if mascara is not None:
            mx, my, mw, mh = mascara
            x, y, _, _ = caja
            r[max(my - y, 0) : my - y + mh, max(mx - x, 0) : mx - x + mw] = 0
        return r

    return [k for k in range(1, len(idxs)) if int((region(k - 1) != region(k)).sum()) >= umbral_px]


# ════════════════════════════════════════════════════════════════════════════════════════
# 9. DETECTOR DE INVERSIÓN — artefacto A8 (el margen del DOS es AZUL, no negro)
# ════════════════════════════════════════════════════════════════════════════════════════
def brillo_viewport(idx: np.ndarray) -> float:
    """Brillo medio (luma de la paleta EGA) del VIEWPORT nativo x8..183, y8..183."""
    blq = idx[
        VIEWPORT_Y0 : VIEWPORT_Y0 + REJILLA * CELDA,
        VIEWPORT_X0 : VIEWPORT_X0 + REJILLA * CELDA,
    ]
    rgb = PALETTE[blq].astype(np.float64)
    return float((0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).mean())


def brillo_margen(idx: np.ndarray) -> float:
    """EL DETECTOR ROTO de A8, conservado como MUTANTE.

    🔴 El margen del DOS **no es negro: es AZUL** (el marco decorativo de U5) y es
    CONSTANTE, así que su brillo absoluto no discrimina nada — la primera versión del censo
    de ceremonias disparó sobre el EPISODIO ENTERO. Existe para que la batería lo vea.
    """
    borde = np.concatenate(
        [idx[0:8, :].ravel(), idx[192:200, :].ravel(), idx[:, 0:8].ravel()]
    )
    rgb = PALETTE[borde].astype(np.float64)
    return float((0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).mean())


def es_ceremonia_por_extension(dif: dict, umbral_celdas: int = 8) -> bool:
    """EL DISCRIMINANTE ROTO de A9, conservado como MUTANTE.

    🔴 «Muchas celdas a la vez» NO separa ceremonia de caminar: **en U5 el mapa hace SCROLL
    con el avatar**, así que UN PASO cambia el viewport entero (121/121). El método de ch01
    propuso este umbral desde una medida hecha DENTRO de una choza, donde no hay scroll —
    la premisa era local y la conclusión se enunció global.
    """
    return dif["celdas"] >= umbral_celdas


def hay_inversion(idxs: Sequence[np.ndarray], delta: float = 40.0) -> bool:
    """Detector de inversión de paleta: brillo del VIEWPORT ≥ mediana + `delta`.

    Es el que sí funciona (161 eventos en los 33 episodios). Mira el viewport, no el margen.
    """
    br = [brillo_viewport(i) for i in idxs]
    return max(br) >= float(np.median(br)) + delta


# ════════════════════════════════════════════════════════════════════════════════════════
# 10. GUARDA DE SIEMBRA — artefacto A3 (la siembra que cae sobre el muro y lo borra)
# ════════════════════════════════════════════════════════════════════════════════════════
#: Tiles que la capa de objetos del port TAPA y que, tapados, cambian la LOS. Es el
#: subconjunto de `ALWAYS_OPAQUE` (game/src/core/world/visibility.ts, DATA.OVL 0x6A86) que
#: el arnés puede encontrarse al sembrar en interiores. La guarda vive AQUÍ además de en el
#: arnés TS para que la batería del método pueda ejercerla sin navegador.
TILES_OPACOS_SIEMBRA = frozenset({0x4D, 0x4E, 0x4F, 0x50})


def guarda_siembra(tile_destino: int) -> None:
    """Rechaza sembrar sobre un tile OPACO. Artefacto A3 (ficha F4, REFUTADA).

    🔴 La capa de objetos del port TAPA el tile base (`Game.activeMap.tileAt`), que es lo
    que muestrea la LOS. Sembrar un cofre sobre una casilla de MURO no añade un cofre junto
    al muro: **BORRA EL MURO**, abre un agujero de LOS y, de día, enciende las 52 casillas
    negras del exterior de golpe (58 celdas de diferencia = 52 + el cofre + 5 apliques).
    Eso produjo la ficha F4 —«el port pinta hierba donde el original pinta negro»— que
    costó un carril entero refutar. **Lo que cayó fue la palanca del arnés, no una medida
    del juego**: nadie observó nunca al port pintar hierba jugando.
    """
    if tile_destino in TILES_OPACOS_SIEMBRA:
        raise ValueError(
            f"SIEMBRA INVÁLIDA: el tile destino 0x{tile_destino:02x} es OPACO. La capa de "
            "objetos lo TAPARÍA y borraría el muro (ficha F4, artefacto A3): la diferencia "
            "medida sería del arnés, no del port. Siembra sobre un tile transparente."
        )


# ════════════════════════════════════════════════════════════════════════════════════════
# 11. ARTEFACTOS DEL **INFORME** — no del instrumento (clase distinta, ver el registro §T/§I)
# ════════════════════════════════════════════════════════════════════════════════════════
def reparto(total: int, exclusiones: dict[str, set]) -> dict:
    """Compone «útiles = total − pérdidas» de forma AUDITABLE, con el solape derivado.

    🔴 Artefacto I1 del registro. Un carril entregó «útiles = 176 = 16,4 %» de 1 072 y la
    cadena no cerraba: **83 compases caían en dos exclusiones y se restaban dos veces**. Un
    número compuesto sin su cadena de restas y sin su control no es auditable — y el lector
    no puede reconstruirlo, así que lo cree.

    El arreglo NO es «acordarse del solape»: es tomar CONJUNTOS en vez de CUENTAS, de modo
    que el solape no pueda contarse dos veces **por construcción**, y emitirlo declarado.
    Devuelve la cadena entera más el control de cierre `total − útiles == |unión|`, que se
    comprueba aquí dentro y revienta si no cuadra (una guarda encadenada a su acción, no un
    aviso en un statement aparte).
    """
    union: set = set()
    for s in exclusiones.values():
        union |= set(s)
    utiles = total - len(union)
    if utiles < 0:
        raise ValueError(
            f"REPARTO IMPOSIBLE: las exclusiones cubren {len(union)} de un total de {total}"
        )
    suma_cuentas = sum(len(s) for s in exclusiones.values())
    solape = suma_cuentas - len(union)
    # Control de cierre, ENCADENADO: si esto no se cumple, no hay cifra que publicar.
    if total - utiles != len(union):
        raise AssertionError("la cadena del reparto no cierra")
    return {
        "total": total,
        "utiles": utiles,
        "pct": round(100.0 * utiles / total, 1) if total else 0.0,
        "perdidas": len(union),
        "por_criterio": {k: len(set(v)) for k, v in exclusiones.items()},
        "suma_de_cuentas": suma_cuentas,
        "solape": solape,
        "cadena": f"{total} − {len(union)} = {utiles}"
        + (f"   (Σcuentas {suma_cuentas} − solape {solape} = {len(union)})" if solape else ""),
    }


def reparto_por_cuentas(total: int, cuentas: dict[str, int]) -> dict:
    """EL REPARTO ROTO de I1, conservado como MUTANTE: resta CUENTAS y pierde el solape."""
    return {"total": total, "utiles": total - sum(cuentas.values()), "solape": None}


def confirmaciones_independientes(observaciones: Sequence[dict]) -> dict:
    """Cuenta confirmaciones por INSTRUMENTO distinto, no por observación.

    🔴 Artefacto T1 del registro. **Confirmar con N testigos no acredita contenido si el
    error está en la FUENTE**: tres walkthroughs distintos pasan por el MISMO reconocimiento
    de texto y mutilan los MISMOS glifos. Tres confirmaciones del mismo error son UNA — y la
    coincidencia entre ellas, que se lee como corroboración, es exactamente lo que el error
    compartido predice.

    Cada observación declara el `instrumento` por el que pasó. La cifra que vale es cuántos
    instrumentos DISTINTOS la sostienen; `n` (el recuento ingenuo) se devuelve al lado para
    que la diferencia sea visible en el informe en vez de estar implícita.
    """
    inst = {o.get("instrumento") for o in observaciones}
    if None in inst:
        raise ValueError(
            "OBSERVACIÓN SIN INSTRUMENTO: sin declarar por dónde pasó, no se puede saber si "
            "aporta confirmación independiente. Es el artefacto T1."
        )
    return {
        "n": len(observaciones),
        "independientes": len(inst),
        "instrumentos": sorted(inst),
        "corroborado": len(inst) > 1,
    }


# ════════════════════════════════════════════════════════════════════════════════════════
# 12. ESCENA SINTÉTICA — el sujeto sobre el que la batería ejerce los instrumentos
# ════════════════════════════════════════════════════════════════════════════════════════
def escena(
    tiles: Iterable[Iterable[int]] | None = None,
    *,
    marco: bool = True,
    fondo_consola: int = EGA_NEGRO,
) -> np.ndarray:
    """Pinta una pantalla lógica 320×200 en índices EGA con la geometría real del port.

    No pretende parecerse al juego: pretende tener EXACTAMENTE la geometría que los
    instrumentos usan (marco con sus verticales de 1 px, viewport 11×11 de celdas de 16,
    columna derecha), para que la batería ejerza el instrumento donde de verdad mira.
    """
    idx = np.zeros((SCREEN_H, SCREEN_W), dtype=np.uint8)
    if marco:
        idx[:, :] = EGA_AZUL
        for c in MARCO_VERTICALES:
            idx[0 : pdlib.FRAME_LOGICAL_H, c] = EGA_BLANCO
    x, y, w, h = COLUMNA_DERECHA
    idx[y : y + h, x : x + w] = fondo_consola
    rej = [list(f) for f in tiles] if tiles is not None else [[EGA_NEGRO] * REJILLA] * REJILLA
    for r in range(REJILLA):
        for c in range(REJILLA):
            v = rej[r][c]
            yy = VIEWPORT_Y0 + r * CELDA
            xx = VIEWPORT_X0 + c * CELDA
            idx[yy : yy + CELDA, xx : xx + CELDA] = v
    return idx


def sube_a_video(idx: np.ndarray, w: int, h: int) -> np.ndarray:
    """Reescala NEAREST a (w,h) y devuelve RGB — imita el vídeo del testigo.

    El vídeo de Lord Fenton es exactamente esto: un reescalado nearest de 320×200 a
    854×480. La batería lo usa para estrenar A2 sin tocar material de EA.
    """
    ys = np.clip((np.arange(h) * SCREEN_H // h), 0, SCREEN_H - 1)
    xs = np.clip((np.arange(w) * SCREEN_W // w), 0, SCREEN_W - 1)
    return PALETTE[idx[np.ix_(ys, xs)]].astype(np.uint8)
