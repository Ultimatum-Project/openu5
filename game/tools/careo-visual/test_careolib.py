#!/usr/bin/env python3
"""
BATERÍA DE REGRESIÓN **DEL MÉTODO** (no del port).

════════════════════════════════════════════════════════════════════════════════════════
LA ÚNICA PREGUNTA QUE RESPONDE: ¿SIGUE EL MÉTODO CAZANDO LO QUE UNA VEZ CAZÓ?
════════════════════════════════════════════════════════════════════════════════════════
El careo visual va a correr sobre 82 episodios. Su modo de fallo peor no es equivocarse:
es **quedarse ciego en silencio** — un instrumento que se estropea sigue emitiendo su hoja
y su informe sigue diciendo «cero divergencias», que es exactamente lo que dice un careo
limpio. Desde el informe, un careo ciego y un careo bueno son INDISTINGUIBLES.

El registro de averías ya cazadas está en `re/notes/careo-artefactos-conocidos.md`. Esto
es su otra mitad: cada avería y cada divergencia real adjudicada se convierte aquí en un
control PERMANENTE.

★★ **CADA CONTROL SE ESTRENA EN CADA CORRIDA.** No basta con que el control pase: al lado
de cada uno corre el MISMO control contra el instrumento **roto de la manera en que
históricamente se rompió**, y ése tiene que dar el veredicto equivocado. Un control que
nunca se ha visto enrojecer no es un control — es decoración que da confianza gratis. Los
instrumentos rotos viven en `careolib` (`muestrea_area`, `veredicto_siembra_ingenuo`,
`segmenta_por_silencio`, `brillo_margen`, `es_ceremonia_por_extension`) precisamente para
que la batería pueda ejercerlos; NINGUNO se usa en un careo de verdad.

════════════════════════════════════════════════════════════════════════════════════════
LA MATRIZ — y por qué un control de más no prueba nada de más
════════════════════════════════════════════════════════════════════════════════════════
Un control sólo vale por el CANAL que ejercita y el RÉGIMEN que lo caza. **Un control que
el régimen ralo ya caza no prueba NADA del denso** (la lección de `xshift`: sembrar un
desplazamiento parecía un control del canal visual y resultó que también cambiaba el
texto, así que lo cazaba el espejo de consola que ya teníamos). Por eso `CONTROLES` de
abajo declara la celda de la matriz que ocupa cada uno, y la guarda default-deny del final
pone la batería en rojo si alguien añade un control sin declararla.

    canal            │ ralo (par antes/después)      │ denso (fotograma a fotograma)
    ─────────────────┼───────────────────────────────┼──────────────────────────────
    visual puro      │ C1 cofre (+2,0)               │ — (el ralo ya lo caza)
    geometría/LOS    │ C2 anillo de luz              │ —
    cadencia paleta  │ ✗ CIEGO por construcción      │ C3 duración · C4 orden
    geometría anim.  │ ✗ CIEGO por construcción      │ C5 escalera de etapas
    consola          │ (lo cubre el espejo de texto) │ —
    segmentación     │ C6 un compás por eco (F1)     │ —
    disparo          │ C7 columna derecha (F2)       │ —
    negativos        │ C8 siembra sobre muro · C9 suelo de no-determinismo

🔴 Y DOS CANALES QUE NO SON DEL INSTRUMENTO. La taxonomía del registro tiene TRES clases, no
una, y **un instrumento verde no protege de las otras dos**: se puede tener el careo mejor
calibrado del mundo y aun así publicar una cifra que nadie puede reconstruir, o declarar
«confirmado por tres testigos» cuando los tres comparten el error. Las tres producen el
mismo síntoma final —un informe que se lee bien y es falso— por mecanismos que no se tocan.

    testigo          │ T1 · N testigos por el MISMO instrumento son UNA confirmación
    informe          │ I1 · cifra compuesta sin su cadena de restas ni su solape declarado

Uso:  python3 -m pytest game/tools/careo-visual/test_careolib.py -q      (~1 s, sin red)
"""
from __future__ import annotations

import warnings

import numpy as np
import pytest

import careolib as K

#: DECLARACIÓN OBLIGATORIA por control: (canal, régimen, qué avería/divergencia fija).
#: La guarda `test_todo_control_declara_canal_y_regimen` es default-DENY sobre esta tabla.
CONTROLES: dict[str, tuple[str, str, str]] = {
    "test_c1_visual_puro_una_celda": ("visual puro", "ralo", "control positivo del cofre"),
    "test_c1_mutante_umbral_de_celda_ciego": ("visual puro", "ralo", "mutante de C1"),
    "test_c2_anillo_de_luz_por_forma": ("geometría/LOS", "ralo", "ficha F4/F8"),
    "test_c3_cadencia_duracion_denso": ("cadencia paleta", "denso", "APPARITION_INVERT_MS"),
    "test_c3_mutante_el_ralo_es_ciego_a_la_cadencia": ("cadencia paleta", "ralo", "mutante de C3"),
    "test_c4_cadencia_orden_denso": ("cadencia paleta", "denso", "orden de las dos fases"),
    "test_c5_escalera_de_etapas_denso": ("geometría animada", "denso", "MOONGATE_TRANSIT_STAGE_MS"),
    "test_c5_mutante_celda_fija_caza_agua": ("geometría animada", "denso", "ficha G7"),
    "test_c5_mutante_instrumento_de_otra_clase": ("cadencia paleta", "denso", "artefacto A10"),
    "test_c6_un_compas_por_eco": ("segmentación", "ralo", "ficha F1"),
    "test_c6_mutante_ventana_de_silencio_funde": ("segmentación", "ralo", "mutante de C6"),
    "test_c7_columna_derecha_recupera_el_panel": ("disparo", "ralo", "ficha F2"),
    "test_c7_mutante_overlay_del_youtuber_dispara_solo": ("disparo", "ralo", "artefacto A7"),
    "test_c8_negativo_siembra_sobre_muro_rechazada": ("negativo", "ralo", "artefacto A3"),
    "test_c9_negativo_suelo_de_no_determinismo": ("negativo", "ralo", "artefacto A4"),
    "test_c9_mutante_adjudicador_sin_base2": ("negativo", "ralo", "mutante de C9"),
    "test_a1_ega_puro_cuantiza_a_si_mismo": ("instrumento", "ambos", "artefacto A1"),
    "test_a1_mutante_int16_invierte_negro_y_blanco": ("instrumento", "ambos", "mutante de A1"),
    "test_a2_nearest_recupera_la_linea_de_1px": ("instrumento", "ambos", "artefacto A2"),
    "test_a2_mutante_promediado_borra_la_linea": ("instrumento", "ambos", "mutante de A2"),
    "test_a5_el_cero_tiles_animados_es_del_interior": ("instrumento", "denso", "artefacto A5"),
    "test_a8_el_margen_del_dos_es_azul_no_negro": ("instrumento", "denso", "artefacto A8"),
    "test_a9_un_paso_cambia_el_viewport_entero": ("instrumento", "denso", "artefacto A9"),
    "test_i1_el_reparto_declara_su_solape": ("informe", "ambos", "artefacto I1"),
    "test_i1_mutante_restar_cuentas_pierde_el_solape": ("informe", "ambos", "mutante de I1"),
    "test_t1_n_testigos_por_el_mismo_instrumento_son_uno": ("testigo", "ambos", "artefacto T1"),
    "test_t1_observacion_sin_instrumento_se_rechaza": ("testigo", "ambos", "mutante de T1"),
    "test_todo_control_declara_canal_y_regimen": ("meta", "ambos", "guarda default-deny"),
}

# Rejillas sintéticas con la geometría REAL del arnés. No imitan al juego: imitan dónde
# miran los instrumentos.
SUELO, MURO, COFRE, AGUA = 6, 7, 14, 3  # índices EGA cualesquiera, distinguibles


def rejilla(v: int = SUELO) -> list[list[int]]:
    return [[v] * K.REJILLA for _ in range(K.REJILLA)]


# ════════════════════════════════════════════════════════════════════════════════════════
# C1 — CANAL VISUAL PURO, RÉGIMEN RALO. La divergencia de UNA CELDA sin eco de consola.
# ════════════════════════════════════════════════════════════════════════════════════════
def test_c1_visual_puro_una_celda():
    """El control positivo histórico: un cofre sembrado a (+2,0) con la consola IDÉNTICA.

    MEDIDO en ch01 §4: 1 celda, ~220 px, cazada en 13 de 14 filas, con la consola idéntica
    en 14/14 (el espejo de texto es ciego a esto POR CONSTRUCCIÓN). Aquí se fija la
    propiedad que hace que aquello fuera posible: el instrumento **resuelve una sola celda
    del viewport**, y no cuenta de más.
    """
    base = K.escena(rejilla())
    con = rejilla()
    con[5][7] = COFRE  # (+2,0) desde el centro (5,5) — el defecto del arnés
    d = K.dif_celdas(base, K.escena(con))
    assert d["celdas"] == 1, d
    assert d["mapa"] == [(7, 5)]
    assert d["px"] == K.CELDA * K.CELDA  # 256 px de la celda entera


def test_c1_mutante_umbral_de_celda_ciego():
    """ESTRENO de C1: con el umbral por celda subido, la MISMA siembra deja de verse.

    Es la avería plausible de un careo que «tolera ruido»: cualquier umbral por encima del
    tamaño de una celda convierte el instrumento en ciego a la clase entera de divergencias
    de un solo tile — sin dar ningún error, y con el informe intacto.
    """
    base = K.escena(rejilla())
    con = rejilla()
    con[5][7] = COFRE
    ciego = K.dif_celdas(base, K.escena(con), umbral_px=K.CELDA * K.CELDA + 1)
    assert ciego["celdas"] == 0, "el mutante NO enrojeció: el control de C1 no vale"


# ════════════════════════════════════════════════════════════════════════════════════════
# C2 — CANAL GEOMETRÍA/LOS, RÉGIMEN RALO. El anillo de luz, por FORMA y no por cuenta.
# ════════════════════════════════════════════════════════════════════════════════════════
def test_c2_anillo_de_luz_por_forma():
    """La divergencia de LUZ se caza por la FORMA del anillo, no por cuántas celdas hay.

    Lección heredada del trinquete de F4 (`careo-f4-cofre-sobre-muro.test.ts`): el aserto
    «0 celdas ocultas» está SATURADO —de día la luz 0x32 es el máximo de la tabla radial, y
    cualquier ventana sin muros cae ahí— y pasa con la mecánica rota. Un careo que sólo
    cuente celdas negras hereda esa saturación. El instrumento tiene que dar el MAPA, y el
    control se escribe sobre el mapa.
    """
    negro = rejilla(0)
    for r in range(2, 9):
        for c in range(2, 9):
            negro[r][c] = SUELO
    base = K.escena(negro)
    abierto = [f[:] for f in negro]
    for r in range(1, 10):
        for c in range(1, 10):
            abierto[r][c] = SUELO  # el agujero de LOS enciende el anillo
    d = K.dif_celdas(base, K.escena(abierto))
    assert d["celdas"] == 9 * 9 - 7 * 7  # 32 celdas del anillo, no «unas cuantas»
    # …y salen donde deben: el anillo, nunca el centro.
    assert (5, 5) not in d["mapa"]
    assert (1, 1) in d["mapa"] and (9, 9) in d["mapa"]


# ════════════════════════════════════════════════════════════════════════════════════════
# C3/C4 — CANAL CADENCIA, RÉGIMEN DENSO. Lo que el par antes/después NO PUEDE ver.
# ════════════════════════════════════════════════════════════════════════════════════════
def _tren(invert_ms: float, gap_ms: float, n: int, dt: float = 16.0, orden_invertido: bool = False):
    """Genera (ts, brillos) de un tren de pulsos de inversión a `dt` ms por fotograma."""
    periodo = invert_ms + gap_ms
    total = periodo * n
    ts = [i * dt for i in range(int(total / dt) + 1)]
    fase = (lambda t: (t % periodo) >= gap_ms) if orden_invertido else (lambda t: (t % periodo) < invert_ms)
    return ts, [223.0 if fase(t) else 28.0 for t in ts]


def test_c3_cadencia_duracion_denso():
    """El denso mide la DURACIÓN del pulso; el port de hoy corre al 0,49× del testigo LF.

    Cifras EN CRUDO de `re/notes/ceremonias-cadencia-medida.md` §1: testigo LF ep02
    4567 ms de pulso y 867 de hueco; port 2202/2219/2196 y 436/448. El instrumento tiene
    que separar los dos trenes muy por encima de su propio suelo (±12 ms medidos entre dos
    corridas idénticas del port).
    """
    ts_lf, br_lf = _tren(4567, 867, 4)
    ts_pt, br_pt = _tren(2200, 450, 4)
    lf, pt = K.tren_de_pulsos(ts_lf, br_lf), K.tren_de_pulsos(ts_pt, br_pt)
    assert lf["bimodal"] and pt["bimodal"]
    assert lf["n_pulsos"] >= 2 and pt["n_pulsos"] >= 2
    # cada pulso cae dentro de un fotograma (±16 ms) de su nominal
    assert all(abs(p - 4567) <= 16 for p in lf["pulsos"]), lf
    assert all(abs(p - 2200) <= 16 for p in pt["pulsos"]), pt
    # …y la distancia entre los dos lados es 200× el suelo del instrumento (±12 ms)
    assert min(lf["pulsos"]) - max(pt["pulsos"]) > 2000


def test_c3_mutante_el_ralo_es_ciego_a_la_cadencia():
    """ESTRENO de C3: el MISMO tren, muestreado como lo muestrea el RALO, no dice nada.

    `captura-port.pw.ts` vuelca un PNG por compás: 180 ms por tecla + 320 ms de asentado.
    La ceremonia entera la dispara UNA tecla, así que el ralo la mira a t≈320 ms (el primer
    pulso del port arranca a 747 ms: aún no ha empezado) y no vuelve a mirar hasta el compás
    siguiente, ya asentada. Dos muestras en los extremos ⇒ el instrumento tiene que decir
    que NO PUEDE, no inventar un tren.
    """
    ts, br = _tren(2200, 450, 4)
    ralo_ts = [320.0, ts[-1]]
    ralo_br = [28.0, 28.0]  # antes de arrancar y ya asentada: el MISMO valor
    v = K.tren_de_pulsos(ralo_ts, ralo_br)
    assert v["bimodal"] is False
    assert v["motivo"] == "MUESTRAS INSUFICIENTES"
    # Y con más muestras ralas pero todas fuera de la ceremonia: SIN BIMODALIDAD, no un tren.
    v2 = K.tren_de_pulsos([0.0, 320.0, 640.0, 26_000.0, 26_320.0], [28.0, 28.0, 29.0, 28.0, 27.0])
    assert v2["bimodal"] is False and v2["motivo"] == "SIN BIMODALIDAD"


def test_c4_cadencia_orden_denso():
    """El control MÁS FINO: mismo periodo y mismas duraciones de fase, sólo cambia el ORDEN.

    Un careo que sólo comparase «cuánto dura la ceremonia» lo daría por bueno. Lo que se
    mueve es el ARRANQUE del primer pulso (medido: +438 ms), y eso sólo lo ve quien mira el
    interior.
    """
    ts, br = _tren(2200, 450, 4)
    _, br_x = _tren(2200, 450, 4, orden_invertido=True)
    a, b = K.tren_de_pulsos(ts, br), K.tren_de_pulsos(ts, br_x)
    # Las duraciones coinciden dentro de UN FOTOGRAMA (±16 ms a 60 fps): el muestreo a rAF
    # las cuantiza, así que exigir igualdad exacta sería exigirle al instrumento algo que
    # el instrumento no tiene — y ése es justo el motivo de que este control NO sea el de
    # la duración, sino el del ORDEN.
    assert max(abs(x - y) for x, y in zip(sorted(a["pulsos"]), sorted(b["pulsos"]))) <= 16
    assert max(abs(x - y) for x, y in zip(sorted(a["huecos"]), sorted(b["huecos"]))) <= 16
    # …y sin embargo el arranque del primer ON difiere en un HUECO ENTERO (medido: +438 ms).
    def arranque(brs: list[float]) -> float:
        return next(i for i, v in enumerate(brs) if v > 100) * 16.0

    assert abs((arranque(br_x) - arranque(br)) - 450) <= 32
    # El par ralo, en cambio, es CIEGO: los dos extremos de la ceremonia son la MISMA
    # pantalla en los dos lados, y un par antes/después da 0 celdas.
    assert K.dif_celdas(K.escena(rejilla()), K.escena(rejilla()))["celdas"] == 0


# ════════════════════════════════════════════════════════════════════════════════════════
# C5 — CANAL GEOMETRÍA ANIMADA, RÉGIMEN DENSO. La escalera del cruce de puerta lunar.
# ════════════════════════════════════════════════════════════════════════════════════════
def _escalera(ms_por_etapa: float, dt: float = 16.0):
    ts, al = [], []
    t = 0.0
    for h in range(16, -1, -1):
        n = max(1, int(round(ms_por_etapa / dt)))
        for _ in range(n):
            ts.append(t)
            al.append(h)
            t += dt
    return ts, al


def test_c5_escalera_de_etapas_denso():
    """15 escalones 16→0, monótona, y la cadencia que separa testigo (100 ms) de port (62).

    Cifras EN CRUDO de `ceremonias-cadencia-medida.md` §2: LF ep21 = 100 ms/etapa y
    1633 ms de cierre; port = 62 ms/etapa y 900 ms. La FORMA coincide en los dos lados;
    lo que difiere es la cadencia — y ésa es toda la divergencia.
    """
    lf = K.escalera_etapas(*_escalera(100))
    pt = K.escalera_etapas(*_escalera(62))
    for v in (lf, pt):
        assert v["monotona"] is True
        assert v["escalones"] == 16  # 16→0 (el instrumento cuenta transiciones)
        assert v["altura_inicial"] == 16 and v["altura_final"] == 0
    assert abs(lf["ms_por_etapa"] - 100) <= 16
    assert abs(pt["ms_por_etapa"] - 62) <= 16
    assert lf["ms_por_etapa"] > pt["ms_por_etapa"] * 1.4


def test_c5_mutante_celda_fija_caza_agua():
    """ESTRENO de C5 (ficha G7): con la celda FIJA y el jugador caminando, lo medido es AGUA.

    Alturas EN CRUDO del intento fallido sobre ep02 t=1614–1621: 10,15,16,9,0,9,8,0,8,0.
    El instrumento tiene que RECHAZARLAS por no monótonas y **no devolver ms/etapa** — una
    cadencia calculada sobre esa serie sale con pinta de medida y es una cifra inventada.
    """
    alturas = [10, 15, 16, 9, 0, 9, 8, 0, 8, 0]
    v = K.escalera_etapas([i * 33.0 for i in range(len(alturas))], alturas)
    assert v["monotona"] is False
    assert v["motivo"] == "ESCALERA NO MONÓTONA"
    assert v["ms_por_etapa"] is None and v["cierre_ms"] is None


def test_c5_mutante_instrumento_de_otra_clase():
    """ESTRENO cruzado: el instrumento de PALETA sobre una ceremonia de GEOMETRÍA no mide.

    El cruce de la puerta lunar no toca la paleta: el brillo del viewport apenas se mueve.
    El tren de pulsos tiene que decir SIN BIMODALIDAD, no fabricar pulsos con el ruido.
    """
    ts, al = _escalera(100)
    brillo = [40.0 + h * 0.5 for h in al]  # el rectángulo mengua: variación de ~8 niveles
    v = K.tren_de_pulsos(ts, brillo)
    assert v["bimodal"] is False and v["motivo"] == "SIN BIMODALIDAD"


# ════════════════════════════════════════════════════════════════════════════════════════
# C6 — SEGMENTACIÓN (ficha F1): un compás por ECO, no por ventana de silencio.
# ════════════════════════════════════════════════════════════════════════════════════════
#: El caso REAL de ch01 §2.4: en `c14` el original lleva un movimiento MÁS que el port
#: (`>South` y `>East` en el mismo compás). Dos pulsaciones a menos de 6 fotogramas (0,2 s).
ECOS_C14 = [(0.0, [">South"]), (100.0, [">East"]), (900.0, [">Look"]), (1000.0, ["Nothing to see."])]


def test_c6_un_compas_por_eco():
    """El segmentador arreglado emite DOS compases donde el viejo emitía UNO."""
    ts = [t for t, _ in ECOS_C14]
    ls = [l for _, l in ECOS_C14]
    comp = K.segmenta_por_eco(ts, ls)
    assert [c["eco"] for c in comp] == [">South", ">East", ">Look"]
    # La respuesta multilínea legítima se acumula en el compás abierto, no abre uno nuevo.
    assert comp[-1]["lineas"] == [">Look", "Nothing to see."]


def test_c6_mutante_ventana_de_silencio_funde():
    """ESTRENO de C6: el segmentador viejo funde `>South` y `>East` en el mismo compás.

    Ése es el defecto que produjo las tres filas al 71 % de acuerdo (c14–c16) que **no eran
    fallo del port**: el port replicado se desfasaba una acción. Un careo con este defecto
    no se queda ciego — hace algo peor: **fabrica divergencias**.
    """
    ts = [t for t, _ in ECOS_C14]
    ls = [l for _, l in ECOS_C14]
    viejo = K.segmenta_por_silencio(ts, ls, ventana_ms=200.0)
    assert len(viejo) == 2, viejo  # 2 compases donde hay 3 acciones
    assert viejo[0]["lineas"] == [">South", ">East"]  # FUNDIDAS
    assert len(viejo) < len(K.segmenta_por_eco(ts, ls))


# ════════════════════════════════════════════════════════════════════════════════════════
# C7 — DISPARO (ficha F2 y artefacto A7).
# ════════════════════════════════════════════════════════════════════════════════════════
def _con_panel(v: int) -> np.ndarray:
    """Escena donde SÓLO cambia el panel (Z-stats): la consola queda intacta."""
    idx = K.escena(rejilla())
    idx[20:40, 200:300] = v  # panel derecha-arriba, y<88 ⇒ fuera de la banda de consola
    return idx


def test_c7_columna_derecha_recupera_el_panel():
    """Recorrer Z-stats no escribe ni una línea: el disparador de consola es CIEGO a eso.

    MEDIDO en ch01 §2.2: 99 eventos de panel, **42 huérfanos** fuera de todo compás de
    consola ⇒ el disparador de consola pierde 42 compases, 172 → 214, **+24 %**. La
    corrección adoptada es la columna derecha ENTERA.
    """
    frames = [_con_panel(2), _con_panel(3), _con_panel(4)]
    assert K.disparador(frames, caja=K.BANDA_CONSOLA) == [], "la consola NO debería ver el panel"
    assert K.disparador(frames, caja=K.COLUMNA_DERECHA) == [1, 2]


def test_c7_mutante_overlay_del_youtuber_dispara_solo():
    """ESTRENO de C7 (artefacto A7): el overlay animado del canal dispara el disparador.

    Caja nativa MEDIDA en ch01: x216–293, y91–121 — encima de la banda de consola, que es
    justo la región que el método usa de disparador. Sin máscara, cada parpadeo del overlay
    es un compás fantasma; con la máscara declarada, cero. Y **se mide por episodio**: en
    ch01 contamina 20,0 s de 532,9 (3,8 %) y en el tramo de ep02 no aparece en absoluto.
    """
    OVERLAY = (216, 91, 78, 31)
    frames = []
    for k in range(6):
        idx = K.escena(rejilla())
        idx[91:122, 216:294] = 12 if k % 2 else 5  # el overlay parpadea; nada más cambia
        frames.append(idx)
    sin_mascara = K.disparador(frames, caja=K.COLUMNA_DERECHA)
    assert len(sin_mascara) == 5, sin_mascara  # CINCO compases fantasma
    con_mascara = K.disparador(frames, caja=K.COLUMNA_DERECHA, mascara=OVERLAY)
    assert con_mascara == [], con_mascara


# ════════════════════════════════════════════════════════════════════════════════════════
# C8/C9 — LOS NEGATIVOS. Lo que el método debe RECHAZAR, no cazar.
# ════════════════════════════════════════════════════════════════════════════════════════
def test_c8_negativo_siembra_sobre_muro_rechazada():
    """La siembra sobre un tile OPACO no es una divergencia: es el arnés borrando un muro.

    Artefacto A3 (ficha F4, REFUTADA). El arnés sembraba a (−3,−3) desde (15,15) = (12,12),
    que es una casilla del PROPIO MURO de la choza de Iolo (`tileAt(12,12) = 0x4d`, medido
    en vivo). 58 celdas de diferencia — y ninguna del port. La guarda tiene que PARAR la
    siembra, no explicarla después en un informe.
    """
    with pytest.raises(ValueError, match="SIEMBRA INVÁLIDA"):
        K.guarda_siembra(0x4D)
    K.guarda_siembra(0x95)  # el mobiliario de (+2,0): transparente, siembra válida
    K.guarda_siembra(0x44)  # suelo


def test_c9_negativo_suelo_de_no_determinismo():
    """El adjudicador tiene que restar el SUELO del propio port antes de dar veredicto.

    Artefacto A4, MEDIDO: el fotograma «después» daba 28 celdas / 2198 px entre base y
    siembra ⇒ leído solo, «el ralo SÍ la caza» y las dos siembras buenas del régimen 2 se
    descartan. Pero base vs base2 —dos corridas IDÉNTICAS— daba exactamente las MISMAS 28
    celdas: son los tiles de AGUA, que el port anima a reloj de pared.
    """
    base = K.escena(rejilla())
    agua = rejilla()
    for c in range(K.REJILLA):  # 11 celdas de mar en la fila de arriba…
        agua[0][c] = AGUA
    base2 = K.escena(agua)  # …que ya difieren SIN sembrar nada: ése es el suelo
    v_suelo = K.veredicto_siembra(base, base2, base2)
    assert v_suelo["estado"] == "SUELO", v_suelo
    assert v_suelo["celdas_brutas"] == 11 and v_suelo["celdas_netas"] == 0

    con_cofre = [f[:] for f in agua]
    con_cofre[5][7] = COFRE
    v = K.veredicto_siembra(base, base2, K.escena(con_cofre))
    assert v["estado"] == "CAZADA"
    assert v["celdas_suelo"] == 11
    assert v["celdas_brutas"] == 12
    assert v["celdas_netas"] == 1 and v["mapa_neto"] == [(7, 5)]


def test_c9_mutante_adjudicador_sin_base2():
    """ESTRENO de C9: el adjudicador que ignora `base2` dice CAZADA donde el suelo manda.

    Es literalmente la lectura que casi tumbó las dos siembras buenas del régimen 2 — y en
    el otro sentido, la misma clase de error que `xshift`. **El control de determinismo es
    el que adjudica, en los DOS sentidos.**
    """
    base = K.escena(rejilla())
    agua = rejilla()
    for c in range(K.REJILLA):
        agua[0][c] = AGUA
    base2 = K.escena(agua)
    ingenuo = K.veredicto_siembra_ingenuo(base, base2, base2)
    assert ingenuo["estado"] == "CAZADA", "el mutante NO enrojeció: el control de C9 no vale"
    assert K.veredicto_siembra(base, base2, base2)["estado"] == "SUELO"


# ════════════════════════════════════════════════════════════════════════════════════════
# A1/A2 — LOS DOS ARTEFACTOS DEL MUESTREO, los que dejan al método ciego SIN AVISAR.
# ════════════════════════════════════════════════════════════════════════════════════════
def test_a1_ega_puro_cuantiza_a_si_mismo():
    """Cada color EGA puro tiene que cuantizar a SU PROPIO índice.

    Artefacto A1: en `int16` el cuadrado de la diferencia DESBORDA (255² = 65 025 > 32 767)
    y el `argmin` elige el color MÁS LEJANO — negro pasa a blanco. El careo sigue saliendo,
    con los dos lados invertidos. La cuantización se importa de `pixeldiff/pdlib.py` (que
    ya lleva el arreglo); esto la carea DESDE EL CAREO, que es quien la usa.
    """
    for i, rgb in enumerate(K.PALETTE):
        img = np.array([[rgb]], dtype=np.uint8)
        assert K.cuantiza_ega(img)[0, 0] == i, f"EGA {i} mal cuantizado"


def _cuantiza_int16(rgb: np.ndarray) -> np.ndarray:
    """EL CUANTIZADOR ROTO de A1, tal como estaba escrito. Sólo para el estreno."""
    flat = rgb.reshape(-1, 3).astype(np.int16)
    pal = K.PALETTE.astype(np.int16)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        d = ((flat[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2)
    return d.argmin(axis=1).astype(np.uint8).reshape(rgb.shape[:2])


def test_a1_mutante_int16_invierte_negro_y_blanco():
    """ESTRENO de A1: con el cuantizador en int16, el negro puro sale BLANCO."""
    negro = np.zeros((4, 4, 3), np.uint8)
    assert K.cuantiza_ega(negro).max() == 0
    roto = _cuantiza_int16(negro)
    assert roto[0, 0] != 0, "el mutante NO enrojeció: el control de A1 no vale"
    assert roto[0, 0] == 15  # y no en cualquier dirección: negro → BLANCO


def _escena_marco() -> np.ndarray:
    return K.escena(rejilla())


def test_a2_nearest_recupera_la_linea_de_1px():
    """Puntear el centro recupera EXACTO el búfer 320×200 escondido en el vídeo 854×480.

    MEDIDO en ch01 §3 sobre la línea blanca de 1 px del marco: caja calibrada + NEAREST da
    **100 %**; `scale=320:200` ingenuo da **0 %**. El vídeo es un reescalado nearest de un
    búfer 320×200, así que puntear lo recupera y promediar lo destruye.
    """
    idx = _escena_marco()
    video = K.sube_a_video(idx, 854, 480)
    rec = K.cuantiza_ega(K.muestrea_nearest(video, (0, 0, 854, 480)))
    assert K.blancura_vertical_marco(rec) == 1.0
    assert np.array_equal(rec, idx)  # recuperación EXACTA, no «parecida»


def test_a2_mutante_promediado_borra_la_linea():
    """ESTRENO de A2: el remuestreo que promedia pierde la línea de 1 px ENTERA."""
    idx = _escena_marco()
    video = K.sube_a_video(idx, 854, 480)
    roto = K.cuantiza_ega(K.muestrea_area(video, (0, 0, 854, 480)))
    assert K.blancura_vertical_marco(roto) == 0.0, "el mutante NO enrojeció: A2 no vale"
    assert not np.array_equal(roto, idx)


# ════════════════════════════════════════════════════════════════════════════════════════
# A5/A8/A9 — LAS TRES PREMISAS QUE SE ENUNCIARON GLOBALES Y ERAN LOCALES.
# ════════════════════════════════════════════════════════════════════════════════════════
def test_a5_el_cero_tiles_animados_es_del_interior():
    """«0 tiles animados» es verdad DONDE SE MIDIÓ (una choza) y falso en el sobremundo.

    Cifras EN CRUDO de `ceremonias-cadencia-medida.md` §3 (ep02, ventanas de 6 s a 30 fps):
    sobremundo con mar 39/121 celdas y 52 cambios en la que más frente a 11 fotogramas con
    eco de consola ⇒ **≥41 cambios SIN TURNO**; ventana de control 3/121. El instrumento
    tiene que dar veredictos OPUESTOS en las dos escenas — que es lo que hace que la
    premisa de ch01 sea una propiedad de la ESCENA y no del juego.
    """
    quieta = [K.escena(rejilla()) for _ in range(12)]
    v_int = K.censo_animados(quieta, cambios_consola=16)
    assert v_int["celdas_con_cambio"] == 0
    assert v_int["anima_en_el_sitio"] is False

    mar = []
    for k in range(53):  # 52 cambios en la celda que más
        g = rejilla()
        for c in range(K.REJILLA):
            g[0][c] = AGUA if k % 2 else SUELO
        mar.append(K.escena(g))
    v_mar = K.censo_animados(mar, cambios_consola=11)
    assert v_mar["max_cambios_en_una_celda"] == 52
    assert v_mar["cambios_sin_turno"] == 41  # la cifra del informe, derivada aquí
    assert v_mar["anima_en_el_sitio"] is True


def test_a8_el_margen_del_dos_es_azul_no_negro():
    """El margen es AZUL y CONSTANTE: su brillo no discrimina nada.

    Artefacto A8: la primera versión del censo de ceremonias usó el brillo del margen y
    **disparó sobre el episodio entero**. El detector bueno mira el VIEWPORT.
    """
    normal = K.escena(rejilla(SUELO))
    invertida = K.escena(rejilla(15))  # inversión de paleta: el viewport se pone blanco
    assert K.brillo_margen(normal) == K.brillo_margen(invertida), "el margen NO discrimina"
    assert K.brillo_viewport(invertida) > K.brillo_viewport(normal) + 40
    assert K.hay_inversion([normal] * 8 + [invertida]) is True


def test_a9_un_paso_cambia_el_viewport_entero():
    """«Muchas celdas a la vez» NO separa ceremonia de caminar: el mapa hace SCROLL.

    Artefacto A9. Un solo paso desplaza el viewport entero (121/121 celdas), así que el
    discriminante por extensión —propuesto desde una medida hecha DENTRO de una choza,
    donde no hay scroll— clasifica CADA PASO como ceremonia.
    """
    g = [[(r * K.REJILLA + c) % 13 + 2 for c in range(K.REJILLA)] for r in range(K.REJILLA)]
    paso = [[(r * K.REJILLA + c + K.REJILLA) % 13 + 2 for c in range(K.REJILLA)] for r in range(K.REJILLA)]
    d = K.dif_celdas(K.escena(g), K.escena(paso))
    assert d["celdas"] == 121, d
    assert K.es_ceremonia_por_extension(d) is True, "el mutante NO enrojeció: A9 no vale"


# ════════════════════════════════════════════════════════════════════════════════════════
# I1/T1 — ARTEFACTOS QUE NO SON DEL INSTRUMENTO: del INFORME y del TESTIGO.
# ════════════════════════════════════════════════════════════════════════════════════════
def test_i1_el_reparto_declara_su_solape():
    """Un número compuesto sin su cadena de restas y su control NO es auditable.

    Caso de origen (26-08): «útiles = 176 = 16,4 %» de 1 072, y la cadena no cerraba porque
    **83 elementos caían en dos exclusiones y se restaban dos veces**. El arreglo no es
    acordarse del solape: es tomar CONJUNTOS, para que no pueda contarse dos veces por
    construcción, y EMITIRLO. Aquí, con la misma forma y números redondos:
    dos criterios de 500 y 479 que comparten 83 ⇒ unión 896, útiles 176.
    """
    total = 1072
    a = set(range(0, 500))
    b = set(range(417, 896))  # 500−417 = 83 compartidos con `a`
    assert len(a) == 500 and len(b) == 479 and len(a & b) == 83
    r = K.reparto(total, {"sin_eco": a, "fuera_de_juego": b})
    assert r["perdidas"] == 896
    assert r["utiles"] == 176
    assert r["pct"] == 16.4
    assert r["solape"] == 83  # DECLARADO, no implícito
    assert r["suma_de_cuentas"] == 979  # 500 + 479: lo que un reparto por cuentas restaría
    # El control de cierre va DENTRO y es el que autoriza a publicar la cifra.
    assert r["total"] - r["utiles"] == r["perdidas"]
    assert "979" in r["cadena"] and "83" in r["cadena"]


def test_i1_mutante_restar_cuentas_pierde_el_solape():
    """ESTRENO de I1: restar CUENTAS da 93 donde la verdad es 176 — y no lo dice.

    El mutante no falla ni avisa: **devuelve un número**, 83 por debajo del real, con la
    misma pinta que el bueno. Ésa es toda la avería.
    """
    total = 1072
    malo = K.reparto_por_cuentas(total, {"sin_eco": 500, "fuera_de_juego": 479})
    assert malo["utiles"] == 93, "el mutante NO enrojeció: el control de I1 no vale"
    assert malo["solape"] is None
    a, b = set(range(0, 500)), set(range(417, 896))
    assert K.reparto(total, {"sin_eco": a, "fuera_de_juego": b})["utiles"] - malo["utiles"] == 83


def test_t1_n_testigos_por_el_mismo_instrumento_son_uno():
    """Tres walkthroughs por el MISMO OCR son UNA confirmación, no tres.

    Si el error está en la FUENTE compartida, la coincidencia entre testigos es justo lo que
    el error predice — leerla como corroboración invierte el argumento. La cifra que vale es
    el número de INSTRUMENTOS distintos.
    """
    mismo_ocr = [
        {"testigo": "lordfenton", "instrumento": "ocr2/atlas-ibm"},
        {"testigo": "aulddragon", "instrumento": "ocr2/atlas-ibm"},
        {"testigo": "alexdiener", "instrumento": "ocr2/atlas-ibm"},
    ]
    v = K.confirmaciones_independientes(mismo_ocr)
    assert v["n"] == 3
    assert v["independientes"] == 1
    assert v["corroborado"] is False  # tres testigos y CERO corroboración independiente

    # Control positivo: en cuanto UNO pasa por otro instrumento, sí hay corroboración.
    mixto = [*mismo_ocr, {"testigo": "espejo-es", "instrumento": "asr-youtube"}]
    w = K.confirmaciones_independientes(mixto)
    assert w["n"] == 4 and w["independientes"] == 2 and w["corroborado"] is True


def test_t1_observacion_sin_instrumento_se_rechaza():
    """ESTRENO de T1: sin declarar el instrumento no se puede contar la independencia.

    Un `n` sin instrumentos declarados es exactamente el recuento ingenuo que el artefacto
    describe, así que la función se niega en vez de devolver un número que se leerá mal.
    """
    with pytest.raises(ValueError, match="SIN INSTRUMENTO"):
        K.confirmaciones_independientes([{"testigo": "lordfenton"}, {"testigo": "aulddragon"}])


# ════════════════════════════════════════════════════════════════════════════════════════
# GUARDA DEFAULT-DENY — un control sin canal ni régimen declarados no es un control.
# ════════════════════════════════════════════════════════════════════════════════════════
def test_todo_control_declara_canal_y_regimen():
    """Todo `test_*` de este fichero tiene que estar en `CONTROLES` con su celda de matriz.

    Sin esto la batería se degrada sola: se añaden controles «porque sí», nadie sabe qué
    canal cubren, y dos que cubren el mismo se leen como cobertura doble. Es la misma forma
    que la guarda del manifiesto del génesis (REGLA 4-bis): default-DENY, y el rojo NOMBRA
    al fichero que falta.
    """
    aqui = {n for n, v in globals().items() if n.startswith("test_") and callable(v)}
    sin_declarar = sorted(aqui - set(CONTROLES))
    assert not sin_declarar, f"controles sin canal/régimen declarados: {sin_declarar}"
    sobrantes = sorted(set(CONTROLES) - aqui)
    assert not sobrantes, f"declarados pero inexistentes (guarda rancia): {sobrantes}"
    canales = {c for c, _, _ in CONTROLES.values()}
    assert canales >= {"visual puro", "cadencia paleta", "geometría animada", "negativo"}


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
