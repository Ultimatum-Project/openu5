#!/usr/bin/env python3
"""Analizador de la TELEMETRÍA por-acción del Grand Tour (carril tour-telemetry).

FLUJO COMPLETO
==============
1. Pasada del tour con telemetría (opt-in; NO re-sella — pasada dedicada, como la
   pasada-vídeo):

     cd game
     U5_TOUR_TELEMETRY=/tmp/tour.jsonl npm run tour:spec -- "ch0[1-9]|ch1[0-8]"

   El arnés (e2e/grandtour/telemetry.ts, ganchos en nav.ts) apendiza una línea JSON
   por acción de conducción: pasos de walkTo (con la casilla PRETENDIDA por el planner,
   el tile que creía pisable y — si se bloqueó — el NPC/tile VIVOS re-leídos), esperas
   de burnTurn (con razón), pasos 3D de mazmorra y rondas de combate.

2. Análisis:

     python3 game/tools/tour-telemetry-analyze.py /tmp/tour.jsonl
     python3 game/tools/tour-telemetry-analyze.py /tmp/tour.jsonl --json  # machine-readable

QUÉ DETECTA (por capítulo)
==========================
· total de acciones · % bloqueadas · RACHAS de no-avance (>=3 acciones seguidas en la
  misma posición) · STUCK-SPOTS (misma posición > N acciones o > X segundos) ·
  OSCILACIONES (A-B-A-B) · atascos de combate · top-10 peores rachas con detalle.

CLASIFICADOR de cada racha
==========================
· NPC-BLOQUEANDO        — algún paso bloqueado tenía un NPC VIVO en la casilla destino
                          (o el eco delata guardia/tributo). FIEL: esperar es jugar.
· REINTENTO-PATHER      — esperas encadenadas del arnés (walkTo:no-path, first-step-
                          blocked, approach:*) sin evidencia de desacuerdo: ineficiencia
                          de ARNÉS, candidata a fix de nav.ts.
· DESACUERDO-PASABILIDAD— paso bloqueado SIN NPC en destino cuyo tile el planner tenía
                          como pisable (TileData.IsWalking_Passable=True): el modelo del
                          planner y el runtime DISCREPAN → TICKET candidato a bug de
                          fidelidad (clase get-torch). Se imprime casilla exacta, tile
                          planificado vs vivo y qué dice la tabla.
· GOAL-BUMP-PATHER      — paso bloqueado contra una casilla-objetivo que la TABLA ya
                          dice NO-pisable: es la excepción goal-cell de bfsPath (walkTo
                          exacto a un Dresser/mostrador que se registra por bump). El
                          runtime hace lo correcto (Blocked!); el arnés reintenta en
                          bucle = ineficiencia de ARNÉS, no bug del core. (Descubierto
                          en la 1ª cosecha real: TODOS los falsos «desacuerdos» de
                          ch08/ch09/ch10 eran esto — tiles 79/138/202.)
· COMBAT-STALL          — rondas de combate estancadas (mismo actor-celda, stuck>=15).

La tabla de pasabilidad se cruza con la MISMA fuente que usa el planner
(src/core/data/TileData.json, --tiledata para otra ruta).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

# Umbrales (CLI-ajustables)
STREAK_MIN = 3          # acciones seguidas sin avance en la misma posición = racha
SPOT_MIN_ACTIONS = 8    # misma posición > N acciones = stuck-spot
SPOT_MIN_SECONDS = 20.0  # ... o > X segundos wall-clock
OSC_MIN_CYCLES = 2      # A-B-A-B: ciclos completos mínimos
COMBAT_STALL_STUCK = 15

GUARD_ECHO = ("tribute", "guard", "halt", "pay", "gold piece")


def load(path: Path):
    entries = []
    with path.open() as f:
        for ln, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                print(f"AVISO: línea {ln} no es JSON válido (¿escritura concurrente?): descartada", file=sys.stderr)
                continue
            if e.get("v") != 1:
                print(f"AVISO: línea {ln} con esquema v={e.get('v')} != 1: descartada", file=sys.stderr)
                continue
            entries.append(e)
    return entries


def load_tiledata(path: Path):
    try:
        return json.loads(path.read_text())
    except OSError:
        return None


def pos_of(e):
    """Posición 'estable' de la entrada (antes de actuar), como tupla hashable."""
    k = e["kind"]
    if k == "walk-step":
        b = e["before"]
        return ("map", b.get("loc"), b.get("floor"), b["x"], b["y"])
    if k == "wait-turn":
        p = e["pos"]
        return ("map", p.get("loc"), p.get("floor"), p["x"], p["y"])
    if k == "dungeon-step":
        b = e["before"]
        return ("dng", b.get("floor"), b["x"], b["y"])
    if k == "combat-round":
        return ("cmb", e["ax"], e["ay"])
    return None


def advanced(e):
    """¿La acción produjo avance de posición?"""
    k = e["kind"]
    if k in ("walk-step", "dungeon-step"):
        return bool(e.get("moved"))
    if k == "wait-turn":
        return False
    return None  # combate/otras: no aplica al eje de navegación


def is_passable(tiledata, tile):
    if tiledata is None or tile is None:
        return None
    info = tiledata.get(str(tile))
    if info is None:
        return None
    return bool(info.get("IsWalking_Passable"))


def classify_streak(entries, tiledata):
    """Clasifica una racha de no-avance. Devuelve (clase, evidencia)."""
    npc_hits, disagreements, goal_bumps, pather_waits, guard_echoes = [], [], [], 0, 0
    for e in entries:
        if e["kind"] == "wait-turn":
            pather_waits += 1
            if any(g in e.get("echo", "").lower() for g in GUARD_ECHO):
                guard_echoes += 1
            continue
        if e["kind"] in ("walk-step", "dungeon-step") and not e.get("moved"):
            if e.get("npcAtIntended"):
                npc_hits.append(e)
            elif any(g in e.get("echo", "").lower() for g in GUARD_ECHO):
                guard_echoes += 1
            elif e["kind"] == "dungeon-step":
                # En mazmorra no hay actores móviles: bloqueo = desacuerdo directo.
                disagreements.append(e)
            elif e.get("npcAtIntended") is False:
                # Sin NPC vivo en destino. SÓLO es desacuerdo real si la tabla decía
                # pisable: bfsPath permite que la CASILLA-OBJETIVO (walkTo exacto, no
                # adjacent) sea no-transitable (Dresser/mostrador que se registra por
                # bump) — ahí el Blocked! es CORRECTO y el patrón es GOAL-BUMP-PATHER.
                if is_passable(tiledata, e.get("plannedTile")) is False:
                    goal_bumps.append(e)
                else:
                    disagreements.append(e)
    # Regla de MAYORÍA (lección de la 2ª cosecha): un NPC móvil puede apartarse entre el
    # bloqueo y la sonda → un instante suelto con npcAtIntended=false dentro de una racha
    # dominada por NPC es RUIDO de carrera, no desacuerdo. Solo se emite ticket si la
    # evidencia de desacuerdo DOMINA a la de NPC.
    if disagreements and len(disagreements) > len(npc_hits):
        return "DESACUERDO-PASABILIDAD", disagreements
    if npc_hits or guard_echoes:
        return "NPC-BLOQUEANDO", npc_hits
    if goal_bumps:
        return "GOAL-BUMP-PATHER", []
    return "REINTENTO-PATHER", []


def fmt_pos(p):
    if p is None:
        return "?"
    if p[0] == "map":
        return f"loc={p[1]} floor={p[2]} ({p[3]},{p[4]})"
    if p[0] == "dng":
        return f"dungeon floor={p[1]} ({p[2]},{p[3]})"
    return f"combat ({p[1]},{p[2]})"


def analyze_chapter(name, entries, tiledata):
    nav = [e for e in entries if e["kind"] in ("walk-step", "wait-turn", "dungeon-step")]
    combat = [e for e in entries if e["kind"] == "combat-round"]
    combat_ends = [e for e in entries if e["kind"] == "combat-end"]

    total = len(entries)
    blocked = [e for e in nav if advanced(e) is False]
    pct_blocked = (100.0 * len(blocked) / len(nav)) if nav else 0.0

    # RACHAS: secuencias consecutivas (en orden temporal) de no-avance en la MISMA posición.
    streaks = []
    cur = []
    for e in nav:
        if advanced(e) is False and (not cur or pos_of(e) == pos_of(cur[-1])):
            cur.append(e)
        else:
            if len(cur) >= STREAK_MIN:
                streaks.append(cur)
            cur = [e] if advanced(e) is False else []
    if len(cur) >= STREAK_MIN:
        streaks.append(cur)

    # STUCK-SPOTS: misma posición ocupada muchas acciones o mucho tiempo (aunque haya
    # mezcla de intentos distintos). Agrupa runs consecutivos por posición.
    spots = []
    run = []
    for e in nav:
        if run and pos_of(e) == pos_of(run[-1]):
            run.append(e)
        else:
            spots.append(run) if run else None
            run = [e]
    if run:
        spots.append(run)
    stuck_spots = [
        r
        for r in spots
        if len(r) > SPOT_MIN_ACTIONS or (r[-1]["t_ms"] - r[0]["t_ms"]) / 1000.0 > SPOT_MIN_SECONDS
    ]

    # OSCILACIONES A-B-A-B sobre pasos que SÍ avanzaron (thrash del pather).
    moves = [e for e in nav if e["kind"] == "walk-step" and e.get("moved")]
    oscillations = []
    i = 0
    while i + 3 < len(moves):
        a0, b0 = pos_of(moves[i]), pos_of(moves[i + 1])
        j = i
        cycles = 0
        while j + 1 < len(moves) and pos_of(moves[j]) == a0 and pos_of(moves[j + 1]) == b0:
            cycles += 1
            j += 2
        if a0 != b0 and cycles >= OSC_MIN_CYCLES:
            oscillations.append({"a": a0, "b": b0, "cycles": cycles, "t_ms": moves[i]["t_ms"]})
            i = j
        else:
            i += 1

    # COMBAT-STALL: rondas con stuck alto en la misma celda.
    combat_stalls = [e for e in combat if e.get("stuck", 0) >= COMBAT_STALL_STUCK]

    # Clasificación de rachas + tickets de pasabilidad.
    classified = []
    tickets = []
    for s in streaks:
        cls, evidence = classify_streak(s, tiledata)
        item = {
            "pos": fmt_pos(pos_of(s[0])),
            "ctx": s[0].get("ctx", "?"),
            "len": len(s),
            "seconds": round((s[-1]["t_ms"] - s[0]["t_ms"]) / 1000.0, 1),
            "class": cls,
            "attempts": sorted(
                {
                    (
                        f"{e.get('key', e.get('reason', '?'))}→({e['intended']['x']},{e['intended']['y']})"
                        if "intended" in e
                        else e.get("reason", e.get("key", "?"))
                    )
                    for e in s
                }
            ),
            "echo": s[-1].get("echo", ""),
        }
        classified.append(item)
        for e in evidence if cls == "DESACUERDO-PASABILIDAD" else []:
            tickets.append(
                {
                    "chapter": name,
                    "ctx": e.get("ctx"),
                    "pos_party": fmt_pos(pos_of(e)),
                    "celda": e.get("intended"),
                    "plannedTile": e.get("plannedTile"),
                    "liveTile": e.get("liveTile"),
                    "tabla_dice_pisable": is_passable(tiledata, e.get("plannedTile")),
                    "tabla_dice_pisable_vivo": is_passable(tiledata, e.get("liveTile")),
                    "echo": e.get("echo", ""),
                    "t_ms": e["t_ms"],
                }
            )

    return {
        "chapter": name,
        "total_acciones": total,
        "nav_acciones": len(nav),
        "pct_bloqueadas": round(pct_blocked, 1),
        "rachas": classified,
        "stuck_spots": [
            {
                "pos": fmt_pos(pos_of(r[0])),
                "ctx": r[0].get("ctx", "?"),
                "acciones": len(r),
                "seconds": round((r[-1]["t_ms"] - r[0]["t_ms"]) / 1000.0, 1),
            }
            for r in stuck_spots
        ],
        "oscilaciones": [
            {"a": fmt_pos(o["a"]), "b": fmt_pos(o["b"]), "ciclos": o["cycles"]} for o in oscillations
        ],
        "combate": {
            "rondas": len(combat),
            "stalls": len(combat_stalls),
            "resolvedores": [
                {"resolver": e["resolver"], "resolved": e["resolved"], "s": round(e["ms"] / 1000.0, 1)}
                for e in combat_ends
            ],
        },
        "tickets_pasabilidad": tickets,
    }


def main():
    global STREAK_MIN
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("jsonl", type=Path, help="fichero JSONL de U5_TOUR_TELEMETRY")
    ap.add_argument("--json", action="store_true", help="salida JSON machine-readable")
    ap.add_argument(
        "--tiledata",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "src" / "core" / "data" / "TileData.json",
        help="TileData.json del planner (default: game/src/core/data/TileData.json)",
    )
    ap.add_argument("--streak-min", type=int, default=STREAK_MIN)
    ap.add_argument("--top", type=int, default=10, help="tamaño del top de peores rachas")
    args = ap.parse_args()
    STREAK_MIN = args.streak_min

    entries = load(args.jsonl)
    if not entries:
        print("Sin entradas: ¿corriste el tour con U5_TOUR_TELEMETRY apuntando a este fichero?")
        return 1
    tiledata = load_tiledata(args.tiledata)
    if tiledata is None:
        print(f"AVISO: sin TileData en {args.tiledata} — los tickets no podrán citar la tabla", file=sys.stderr)

    by_chapter = defaultdict(list)
    for e in entries:
        by_chapter[e.get("chapter", "?")].append(e)

    reports = [analyze_chapter(ch, sorted(es, key=lambda x: x["t_ms"]), tiledata) for ch, es in sorted(by_chapter.items())]

    if args.json:
        print(json.dumps({"chapters": reports}, indent=2, ensure_ascii=False))
        return 0

    all_streaks = []
    all_tickets = []
    for r in reports:
        print(f"\n═══ {r['chapter']} ═══")
        print(
            f"  acciones: {r['total_acciones']} (nav {r['nav_acciones']}) · bloqueadas: {r['pct_bloqueadas']}%"
        )
        if r["rachas"]:
            print(f"  rachas de no-avance (≥{STREAK_MIN}): {len(r['rachas'])}")
            for s in r["rachas"]:
                print(
                    f"    · [{s['class']}] {s['pos']} ({s['ctx']}) ×{s['len']} intentos, {s['seconds']}s — "
                    f"intentaba: {', '.join(s['attempts'][:4])}{'…' if len(s['attempts']) > 4 else ''} — eco: {s['echo']!r}"
                )
                all_streaks.append((r["chapter"], s))
        if r["stuck_spots"]:
            print(f"  stuck-spots (> {SPOT_MIN_ACTIONS} acciones o > {SPOT_MIN_SECONDS}s en la misma posición):")
            for sp in r["stuck_spots"]:
                print(f"    · {sp['pos']} ({sp['ctx']}) — {sp['acciones']} acciones, {sp['seconds']}s")
        if r["oscilaciones"]:
            print("  oscilaciones A-B-A-B:")
            for o in r["oscilaciones"]:
                print(f"    · {o['a']} ⇄ {o['b']} ×{o['ciclos']} ciclos")
        c = r["combate"]
        if c["rondas"]:
            res = ", ".join(f"{x['resolver']}:{'V' if x['resolved'] else 'X'} {x['s']}s" for x in c["resolvedores"])
            print(f"  combate: {c['rondas']} rondas de jugador · {c['stalls']} rondas-stall · {res}")
        all_tickets.extend(r["tickets_pasabilidad"])

    all_streaks.sort(key=lambda t: t[1]["seconds"], reverse=True)
    print(f"\n═══ TOP-{args.top} PEORES RACHAS (todo el tour) ═══")
    for ch, s in all_streaks[: args.top]:
        print(f"  {s['seconds']:>6.1f}s ×{s['len']:<3} [{s['class']}] {ch} @ {s['pos']} ({s['ctx']}) — {', '.join(s['attempts'][:3])}")

    print("\n═══ TICKETS DESACUERDO-PASABILIDAD (candidatos a bug de fidelidad) ═══")
    if not all_tickets:
        print("  ninguno — el modelo del planner y el runtime están de acuerdo en toda la pasada")
    # Dedupe: la misma celda bloqueada N veces es UN ticket con contador.
    grouped = defaultdict(list)
    for t in all_tickets:
        key = (t["chapter"], t["pos_party"], json.dumps(t["celda"]), t["plannedTile"], t["liveTile"])
        grouped[key].append(t)
    for (ch, pos, celda, planned, live), ts in grouped.items():
        t = ts[0]
        print(
            f"  · ×{len(ts)} {ch} {pos} → celda {celda}: plannedTile={planned} "
            f"(tabla pisable={t['tabla_dice_pisable']}), liveTile={live} "
            f"(tabla pisable={t['tabla_dice_pisable_vivo']}), eco={t['echo']!r}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
