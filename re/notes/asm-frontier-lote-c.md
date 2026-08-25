# LOTE C — los 4 drivers `.DRV`: rol + propósito + evidencia por rutina

> Carril `re/asm-frontier`. Cierra el LOTE C del plan ([[asm-frontier-plan]]) con la
> variante adjudicada por el lead: **derivar 1:1 los 3 blitters gigantes + los cuerpos
> de selector**, y dar a **TODAS** las demás rutinas `.DRV` identificación + propósito +
> evidencia (no 1:1, pero **CERO "sin explicar"**). Amplía [[drivers-drv]] (que ya fijó
> la ABI de 38 selectores y el mecanismo de color) con un rol por CADA una de las **163
> rutinas** del censo (EGA 44 / CGA 40 / HER 40 / T1K 39).
>
> Método: 4 subagentes de lectura, uno por driver, leyendo el `.asm` real
> (`re/disasm/<D>.DRV.asm`) instrucción-a-instrucción; el blitter gigante de cada uno
> derivado en profundidad. **El rol por rutina (los 163 registros `{name, role}`) vive
> en `re/ledger/driver-roles.json`** (dato autoritativo, NO en prosa — para no
> contaminar el name-seed de `routine_census.py`, que escanea todos los `*.md`).

## Titular — el hallazgo que amplía el mapa

Los `.DRV` **no son solo primitivas de píxel.** Además del pipeline esperado (set-mode,
set-color, plot/línea/fill, blit 16×16, blit de imagen), cada driver esconde un
**subsistema de TRANSICIONES de pantalla dirigido por LFSR** (polinomio `0x9248`):
fizzle-fade / dissolve / wipe, con **SFX de PC-speaker** (PIT ch2 + gate 0x61) y
efectos por plataforma:
- **EGA**: dissolve de planos + fizzle-fade + scroll de banda animada (selectores 0x60/0x66/0x69/0x6f).
- **CGA**: shimmer de agua/fuente por LFSR + crossfade con buffer alojado en DOS.
- **HER**: moongate/random-pixel dissolve + screen-melt (Hercules mono, 4 bancos interlazados).
- **T1K**: **fuente/fuegos artificiales** (fountain/fireworks) por partículas + compositor de escena intro.

**Sigue siendo CERO gameplay** (0 `g_rng` del mundo, 0 estado de mundo; los LFSR son
locales al efecto visual). El port no reproduce estos efectos (renderer moderno) — son
insumo de **cadencia/paleta exactas → catálogo AV (task #4)**, no de reglas. Confirma y
amplía el veredicto de [[drivers-drv]] §0.4.

## Blitters gigantes derivados 1:1 (el "premio" de LOTE C)

- **CGA fn25** (offset 0xa26, dentro de la rutina 0x850, 1353 B) — blit de imagen 2bpp de
  W×H variable. Fuente = descriptor de forma en datos del caller (bytes/fila en 0xa20,
  filas en 0x222); destino 0xB800 o buffer offscreen (seg en 0x202); X-clip; **3 modos**
  por flags en 0xa22: copia recta (rep-movsb + máscara de borde), nibble-expand/RLE
  (derecha-a-izquierda), e interlazado/doblado; paso vertical ±1 para flip.
- **HER fn25** (offset 0xc66, dentro de la rutina 0xa3c, 1639 B) — blit de imagen Hercules
  mono con dither. Fuente = directorio por-frame (ptr datos + ptr máscara); ancho→w/4,
  destino B000 o buffer, fila por tabla de bancos interlazados (4 bancos, 90 B/fila);
  X-flip, Y-clip; **3 modos**: copia recta, blit transparente (nibble alto→trama), y
  medio-tono/dither de 2 planos (fn33).
- **T1K fn25** (offset 0x8fa, dentro de la rutina 0x718, 1313 B) — blit de sprite 4-bit
  empaquetado 2px/byte, gemelo del EGA. Fuente = banco en seg (cabecera: count + directorio
  por frame); destino 0xB800 o buffer; clip a la ventana del kernel; V-flip, mirror
  horizontal de nibble, transparencia 2-bit/bitmask del stream RLE.

(EGA no tiene un blitter gigante suelto: el suyo `fn25` está fusionado en la rutina
0x1271, ya IDENT y derivada. Los blitters de EGA 0x772/0x1e68 también leídos.)

## Rol por rutina — 163/163

En `re/ledger/driver-roles.json`: `(fichero, offset) → {name, role}` para las 163
rutinas de los 4 drivers, con la evidencia (offsets/puertos/memoria) en el campo `role`.
`frontier.py` lo lee y adjunta el `role` a cada rutina `.DRV` del ledger de frontera.
Los 3 blitters gigantes + los cuerpos de selector se derivaron 1:1; los helpers, por
conducta + call-graph. Validado por `test_frontier.py` (cada rutina `.DRV` del censo
tiene rol).

## Reconciliación con el ledger

Cada rutina `.DRV` va **SIEMPRE a `deferred_reason: hardware-driver`** en `frontier.json`,
independiente de lo que diga el veredicto automático del censo (el port no reimplementa
hardware de vídeo; y el name-seed del censo es frágil ante la prosa). Ya NO opacas:
163/163 con `role`. La métrica de "entendido" del frontier queda así reservada al
**código de JUEGO** (683 rutinas), y los 163 drivers son "identificados-pero-diferidos".
Esto cumple la variante adjudicada ("entender perfectamente con esfuerzo proporcionado;
el 1:1 literal de los 158 helpers escalaría sólo si el usuario lo pide").

## FLAG para el lead

El subsistema de transiciones/SFX de los `.DRV` (fizzle-fade, dissolve, moongate,
fuente Tandy, shimmer de agua, con LFSR `0x9248` + PC-speaker) es **material de
presentación real que el port omite**. No es gameplay, pero si en algún momento se
persigue fidelidad audiovisual de transiciones (catálogo AV, task #4), aquí está el
mapa: cada efecto con su selector, su LFSR y su ruta de SFX (detalle en
`driver-roles.json`). Anotado, no bloqueante.
