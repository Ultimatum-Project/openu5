# Witness #3 — Pixel-witness del disfraz del Mimic · DIFERIDO (estructural ya CERRADO)

**Carril:** oracle-queue (rama `re/oracle-queue`) · **Fecha:** 2026-07-19 · Encargo del lead:
testigo del FRAMEBUFFER — ¿qué tile pinta la celda del Mimic disfrazado (estado +6) y cuál es
el trigger de revelado? Material previo: `oracle-fire/re/notes/witness-mimic-paint.md` +
`mimic-disguise-spec.md` (LEÍDOS).

## Estado heredado (NO re-litigado): estructural CONFIRMADO en vivo

El carril oracle-fire ya cerró lo ESTRUCTURAL con combate vivo (Mimic tipo 0x1A, registro
0xBA14 slot6 + tabla sprites 0x5C5A slot3):
- El disfraz **NO es un tile de cofre en el mapa** — es un **ACTOR OCULTABLE** (sprite off),
  igual que el Corpser. Byte **+6** del registro de sprite (`DS:0x5C60+idx*8`) = estado de
  sprite: `0xFF` dormido · `0x20` revelado · `0` oculto (`combat.md:43-44`).
- **La celda del Mimic en el mapa lógico 0xAD14 y en el display 0xab02 = suelo idéntico**
  (0x05 / 0x0505). Forzar +6∈{0,0x20,0xFF} NO cambió NADA en 0xAD14 ni 0xab02. ⇒ el sprite
  del actor **no se compone en la capa de tiles**; se pinta en un PASE DE SPRITE aparte
  (framebuffer). No hay tile de disfraz en ninguna capa de mapa.
- Trigger de revelado (ASM COMBAT.OVL, `mimic-disguise-spec.md`): al melé de la IA
  (0x02F8-0304 / 0x031A-0327) si atacante es Mimic 0x1A o Corpser 0x2D → `[0x5C60+idx*8]=0x20`
  (revela). Corpser re-oculta a `0` al inicio de su turno (0x046A-047F).

**Accionable ya derivado para el port** (no requiere el pixel-witness): el renderer fiel de
combate dibuja el sprite del Mimic/Corpser (`tipo*4+0x40`) SÓLO cuando +6≠oculto; oculto = no
dibujar (la celda muestra el suelo de arena). Init OCULTO en spawn de sala; conmuta a 0x20 al
melé; Corpser re-oculta a 0 en su turno.

## Por qué el pixel-witness del FRAMEBUFFER queda DIFERIDO

El único hueco es ver los PÍXELES exactos (oculto = suelo vs sprite durmiente vs nada). Cerrar
eso exige leer el **framebuffer EGA planar (0xA0000)** y decodificar los 4 bit-planes en la
celda de arena del Mimic — el "último recurso" del brief. Dos obstáculos concretos:
1. **Estado natural oculto no disponible por el camino fácil.** El Mimic inyectable por la
   tabla de objetos del overworld (vía `combat_parity.inject_rat`-style) nace VISIBLE
   (+6=0x2F, tile2=0xA8), no disfrazado — la init "oculto" es propia del spawn en SALA de
   mazmorra/cofre. Para el pixel-witness hay que (a) montar una sala de mazmorra con Mimic que
   nazca oculto, o (b) forzar en RAM tile2=0 + +6=0 y disparar un redibujo del viewport de
   combate SIN darle turno al Mimic.
2. **Decodificar EGA planar.** `oracle.read_mem(0xA000,0,0x8000)` da los 32KB del plano EGA,
   pero mapear la celda de arena (x,y en la rejilla de combate) a su rectángulo de píxeles y
   des-entrelazar los 4 planos es trabajo no trivial y frágil (depende del layout del viewport
   de combate, no barrido). El veredicto estructural NO depende de esto.

## Recomendación

**No gastar oráculo aquí** salvo pedido explícito: el veredicto estructural (actor ocultable,
sin tile de cofre, trigger +6) ya da al port TODO lo accionable. El pixel-witness sólo
resolvería la curiosidad "durmiente vs nada" y cuesta un decodificador EGA + un setup de sala
oculta. Si el lead lo pide: método = forzar (tile2=0,+6=0) en `DS:0x5C5A+idx*8` sobre un Mimic
de combate, `read_mem(0xA000,0,0x8000)`, decodificar los 4 planos en el rect de la celda, y
comparar contra el estado +6=0x20 (sprite 0xA8 visible).

## Evidencia
- `oracle-fire/re/notes/witness-mimic-paint.md` (combate vivo, estructural), `mimic-disguise-spec.md`
  (ASM COMBAT.OVL), `re/notes/combat.md:43-45,331` (estado +6, sprite tipo*4+0x40).
