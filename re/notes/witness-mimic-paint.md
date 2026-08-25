# Witness #2 — MIMIC PAINT: ¿qué pinta el disfraz? · PARCIAL (estructural cerrado)

**Carril:** oracle-fire (rama `re/oracle-fire`) · **Fecha:** 2026-07-19 · Spec:
`re/notes/mimic-disguise-spec.md`. Oráculo headless propio. Probe:
`scratchpad/mimic_paint_witness.py`; captura `scratchpad/mimic_paint_witness.json`.

## VEREDICTO (estructural, CONFIRMADO EN VIVO)

**El disfraz del Mimic NO es un tile de cofre en el mapa — es un ACTOR OCULTABLE (sprite
off), exactamente como el Corpser.** Confirma la conclusión ASM de `mimic-disguise-spec.md`
y REFUTA la lectura "disguised as a treasure chest" del Book of Lore como tile de mapa.

Evidencia viva (combate con Mimic real, tipo 0x1A):
- **Registro de combate 0xBA14 slot 6:** `kind=enemy, ref=0x1A (=tipo 26, MIMIC), hp=30,
  obj=3`. El `+4=obj=3` es el índice en la tabla de sprites 0x5C5A.
- **Tabla de sprites 0x5C5A slot 3:** `raw = a8 a8 05 02 00 1e 2f ff` → tile(+0)=0xA8
  (sprite del Mimic = tipo*4+0x40), tile2(+1)=0xA8, x=5, y=2, aux(+5)=30 (copia de HP),
  **estado6(+6)=0x2F**, tgt7(+7)=0xFF.
- **La celda del Mimic (5,2) en el mapa lógico 0xAD14 = 0x05 (suelo), y en el buffer de
  display 0xab02 = 0x0505 — IDÉNTICO a una celda de suelo vacía.** ⇒ el sprite del actor
  NO se compone en el buffer de tiles/display; se pinta en un PASE DE SPRITE aparte
  (framebuffer). NO hay tile de cofre ni tile de disfraz en ninguna capa de mapa.
- **Forzar +6 ∈ {0x20, 0x00, 0xFF}** (con settle de 14 ticks + relectura estable) NO
  cambió NADA en 0xAD14 ni 0xab02 (0x0505 en los tres casos). ⇒ el efecto visual de +6
  es SÓLO observable en el framebuffer; las tablas de mapa no lo reflejan.

## Implicación para el port (accionable)

El renderer fiel de combate debe: dibujar el sprite del Mimic/Corpser (`tipo*4+0x40`)
**sólo cuando está revelado**; **oculto = no dibujar nada** (la celda muestra el suelo de
la arena). NO existe tile de cofre. Es el modelo "sprite oculto hasta atacar" que ya
propuso `mimic-disguise-spec.md` opción (b) — ahora CONFIRMADO en vivo.

## Hueco restante (por qué es PARCIAL) + cómo cerrarlo

1. **El Mimic inyectado por overworld nace VISIBLE, no disfrazado.** `tile2(+1)=0xA8≠0` y
   `+6=0x2F` (estado despierto/visible), no el 0xFF/0 "oculto" de un Mimic de mazmorra. La
   inicialización "oculto" es propia del spawn en SALA de mazmorra/cofre, no del combate
   arrancado por Ataque en overworld. ⇒ este witness NO capturó la transición
   oculto→revelado en su estado natural.
2. **El sprite del actor NO está en ningún buffer de tiles legible** (0xAD14/0xab02 sólo
   llevan terreno de arena). ⇒ ver los PÍXELES exactos del disfraz (nada vs sprite
   durmiente vs cofre) exige leer el FRAMEBUFFER EGA (el "último recurso" del brief).
3. **Cerrar el pixel-witness** (a demanda del lead): (a) montar un Mimic de MAZMORRA que
   nazca oculto (o forzar tile2=0 + +6=0 y disparar un redibujo sin darle turno), y (b)
   leer el framebuffer en la celda del Mimic para confirmar: oculto = píxeles de suelo,
   revelado = sprite 0xA8. El veredicto estructural (arriba) NO depende de ese pixel-witness
   — ya sabemos que NO es un tile de cofre y que es un actor ocultable.

## Estado

Estructural CERRADO (disfraz = actor oculto, sin tile de cofre; port debe dibujar sprite
sólo si revelado). Pixel-witness del framebuffer DIFERIDO (menor; el lead priorizó #6).
