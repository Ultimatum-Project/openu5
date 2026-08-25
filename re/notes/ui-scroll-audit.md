# Auditoría de las bandas de scroll `►▲/▼/↕◄` (carril ztats-arrows)

Testigo del usuario (2 capturas port-vs-DOS de la lista **Spells** de Ztats): en el
original, cuando una lista de Ztats desborda su ventana de 7 filas, aparece la MISMA
banda con muescas `►↓◄`/`►↑◄`/`►↕◄` que el picker de Ready; en el port NO salía. Este
documento censa TODOS los consumidores del marco de lista (`draw_list_frame`) y de la
banda de flecha (kernel `0x6c0a` = ULTIMA.EXE `0x4dea`) para que no quede otra lista sin
indicador, y explica por qué el hueco se escapó al ASM y a las revisiones.

## El mecanismo (una sola rutina compartida)

El indicador NO lo dibuja cada lista por su cuenta: es un kernel único.

- **Selección del glifo** — cada consumidor calcula un flag de 2 bits: `UP=+2` si hay
  ítem poseído ANTES del tope visible (`find_prev_owned≠0xffff`), `DOWN=+1` si lo hay
  TRAS la página (`find_next_owned≠0xffff`). Mapeo: `1→▼(0x19)`, `2→▲(0x18)`, `3→↕(0x12)`,
  `0→nada`. Verbatim en `render_item_list` @`0x077f-0x0819` (ZSTATS.OVL).
- **Pintado de la banda** — `0x6c0a` (=ULTIMA.EXE `0x4dea`, `draw_box_edge` band):
  `set_active_window(0); set_cursor(0x1e=col30, 0x0a=row10); draw_box_edge(►);
  putchar(glyph); draw_box_edge(◄)`. NO recibe coordenadas → banda **FIJA** en pantalla
  (fila 10, ►col30 / glifo col31 / ◄col32), la MISMA para todos los que la invocan.

Que la banda sea coordinate-free es la clave: Ready y Ztats la pintan en idéntico sitio,
así que el fix reusa la geometría del picker de Ready byte a byte.

## Censo de consumidores en el binario

Barrido sistemático del disasm: `draw_list_frame` (glifos de caja 0x10/0x13/0x15/0x16) +
el selector de 3 vías (`mov ax,0x19`+`0x18`+`0x12`) + la banda `draw_box_edge`.

| # | Overlay · rutina | Qué lista | ¿Banda scroll? | Estado en el port |
|---|---|---|---|---|
| 1 | ZSTATS `render_item_list` @0x06e8 (banda @0x0806) | 4 listas de Ztats (Reagents/Spells/Items/Armaments, páginas 0xd-0x10) | **Sí** (0x6c0a) | **ERA EL HUECO — AHORA FIEL** (este carril): `ztatsListArrowGlyph` + `drawScrollArrowBand` en fiel/skin.ts; repintado vector en shader/skin.ts. |
| 2 | ZSTATS `item_page_controller` @0x0f2e (banda @0x10a6) | Picker de **(R)eady** y selector de reactivos de **(M)ix** | **Sí** (0x6c0a) | **FIEL** (carril ready-arrows): `drawReadyPicker`+`readyArrowGlyph`; Mix va por la misma ruta (`variant:"mix"`), cubierto. |
| 3 | SHOPPES `list_wares` @0x0c80 (banda @0x0e56, kernel 0x742a) — la llama el Blacksmith @0x12B2 | Wares del **herrero** (tabla equipo 0x57c0, count 0x30) | **Sí** (misma banda) | **N/A en la UI actual**: el port sirve las tiendas como **flujo de CONSOLA** (`ui/shop-console.ts`, `print_string`), NO como el pergamino enmarcado del original. La banda no aplica porque el port no dibuja esa lista enmarcada. Divergencia de PRESENTACIÓN pre-existente (ver [[ui-flow-fidelity-gap]]). |
| 4 | SHOPPES3 `draw_list_frame` @0x0565 | Menú/lista enmarcada de una página | **No** (sin selector 3-vías; los `0x18` son la col 24 de `set_text_window`) | Lista de una sola página → sin flecha por diseño en el original tampoco. |
| 5 | DNGLOOK banda @0x0436 (kernel 0x742a) | Retícula de estado/dirección del panel de **look** de mazmorra (glifos varios: `.`,`-`,`r`,`q`,`▲/▼/↕`) | Banda **sí**, pero **NO es una lista** (0 glifos de caja `draw_list_frame`) | Fuera del alcance «scroll de lista»: es el indicador de dirección del look 3D, no un scroll de ítems. Sin lista enmarcada en el port. |
| 6 | INTRO `draw_list_frame`×varios | Chrome del menú de portada / gitana | **No** (los `0x18`/`0x12` son coordenadas/menú, sin lista de ítems poseídos) | Menú, no una lista con overflow. n/a. |

**Conclusión del censo:** de las 3 bandas de scroll de LISTA del binario (#1, #2, #3),
el port ahora cubre #1 (este carril) y #2 (ready-arrows). #3 (herrero) no aplica mientras
las tiendas usen la piel de consola; queda anotado como divergencia de presentación
(no un bug de flecha, sino que la lista enmarcada no existe en el port). #4-#6 no son
listas de ítems con scroll.

## Por qué se escapó (al ASM y a nuestras revisiones)

1. **Las derivaciones fueron POR-COMANDO, no por consumidor compartido.** Cada comando
   (Ztats, Ready, Mix, tiendas) se calcó como una vertical aislada. La banda de flecha,
   en cambio, es una rutina TRANSVERSAL (`0x6c0a`) que varias verticales invocan; nadie
   barrió ese consumidor común de lado a lado. Ready la implementó cuando le tocó (carril
   ready-arrows) y ahí quedó, sin propagarse a la lista de Ztats aunque comparten kernel.
2. **El censo-ui-flujos cubría FLUJOS, no CHROME compartido.** `censo-ui-flujos.md`
   auditó qué modos interactivos existían y sus teclas, no los elementos de presentación
   reutilizados entre modos (bandas, remates, banners). El indicador de scroll es chrome,
   no flujo, así que cayó en la costura.
3. **El ASM lo tenía, pero el sub-bucle interactivo esconde el pintado.** El pintado
   (`0x0806`) vive DENTRO del bucle de teclas de `render_item_list`, tras el dispatch;
   la lectura previa de la lista (ztats-layout.md §3) se centró en el marco + las filas +
   las teclas y describió el sub-bucle como «paginación», sin aislar que ESE bloque
   también pinta la banda cada iteración. El `render_item_list` sí llamaba a la banda; el
   port replicó el marco/filas/scroll pero omitió esa llamada.
4. **Sin overflow no hay síntoma.** La flecha sólo aparece con >7 ítems poseídos en una
   lista; los tests y tours pasaban con inventarios cortos, así que el hueco era invisible
   salvo con un save cargado de hechizos/reactivos (el testigo del usuario).

**Regla para evitar la próxima:** al calcar un elemento de CHROME que el binario dibuja
por un kernel compartido (banda, remate, banner, cursor), grep del kernel en TODOS los
overlays y censar sus llamadores ANTES de cerrar el comando — la fidelidad de un modo no
prueba la del chrome que comparte con los demás.
