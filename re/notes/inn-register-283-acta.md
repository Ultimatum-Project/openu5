# Acta #283 — la ventana «GUEST REGISTER» de la posada: 15×9 enmarcada, y el ESPACIO confirma

Carril `posada-register-283`. Rama `posada-register-283` sobre `main` @`be375c81`.

**Veredicto: la ficha era CIERTA y su alcance el que decía.** Es el residuo §7.1 de
[[inn-145-acta]] («el REGISTRO DE HUÉSPEDES enmarcado NO se porta… la consola usa su lista
de opciones. Divergencia de PRESENTACIÓN, no de cadena. Tarjeta propia»). Derivada entera
`SHOPPES3.OVL:0x052a-0x06c7` y calcada; lo que la ficha NO decía y sale aquí son **tres
cosas**: la geometría exacta, que el ESPACIO **confirma** (y no cancela, al revés que la
ventana hermana del herrero), y que la asimetría de la ranura 0 de [[#50]] es **coherente
dentro de la ventana** — quien discrepa es el contador, no la lista.

---

## 1. La geometría, y por qué el descriptor se re-define una columna más ancho

```
0526  push 1 / call 0x39b4          ; select_text_window(1) = el PANEL derecho
052d  call 0x6d1c   (=0x4efc)       ; BORRA la banda divisoria y56..63 del panel
0530  call 0x3a42(1,0x18,1,0x26,9)  ; set_text_window(1, left=24, top=1, right=38, bot=9)
0547  putchar(0xff)                 ; LIMPIA ese rectángulo (emisor 0x17bb: cursor 0,0 + fill)
054e  call 0x3a42(1,0x18,1,0x27,9)  ; RE-define el MISMO descriptor con right=39
0565  0x10 · 13× 0x11 · 0x13        ; ┌ ─ ┐
0588  si=1..7: (0,si)=0x17 · (14,si)=0x17
05ae  0x0a · 0x14 · 13× 0x15 · 0x16 ; CRLF · └ ─ ┘
```

⇒ caja de **15 columnas × 9 filas**: cols 24..38 (x192..311), filas 1..9 (y8..79).

★ **El `right` 38→39 de `0x054e` no es adorno: apaga el auto-wrap.** `putChar`
(ULTIMA.EXE 0x16ba) hace `inc [si+4]; al=[si+4]+[si+0]; cmp al,[si+2]; jle no-wrap`
(0x1735-0x1740). Con `right=38`, tras escribir la col 14 el cursor queda en 15 y
`15+24 = 39 > 38` ⇒ wrap. En la fila 8 —el borde INFERIOR— ese wrap llevaría el cursor a
la fila 9, y `9+1 = 10 > bot(9)` dispara el **SCROLL** de `0x1754`: la caja recién dibujada
se desplazaría una fila y perdería su tapa. Con `right=39`, `39 ≤ 39` y no hay wrap.

Y por eso el LIMPIADO va con el descriptor ESTRECHO: borra exactamente las 15 columnas de
la caja. Es **el mismo rectángulo** que el port ya tenía medido como `ZTATS_CLEAR_PX`
(`skin/fiel/skin.ts`) para Ztats/Ready — corroboración por un camino independiente.

★ **Los glifos de marco son los MISMOS que el pergamino de Ztats** (0x10/0x11/0x13/0x17/
0x14/0x15/0x16, con el horizontal inferior 0x15 ≠ el superior 0x11), y con las MISMAS
medidas: 15 de ancho × 7 filas de contenido. En el binario son **dos implementaciones
distintas** (una inline en SHOPPES3, otra `draw_list_frame` 0x045e en ZSTATS) que producen
la misma salida; en el port se comparte `drawListFrame`.

## 2. El contenido y la barra — la aritmética cierra por dos caminos

`gotoxy(1,1)` + DS 0x4fc0 `    GUEST`; `gotoxy(1,2)` + DS 0x4fca `  REGISTER:\n\n`. Los dos
CRLF dejan el cursor en la fila relativa 4 (la 3 queda en blanco), y ahí arranca el bucle
de nombres, que pinta cada uno con `gotoxy(4, fila_actual)` (`0x0610`) — **columna 4**.

La barra de selección es un rectángulo **XOR** del driver: `0x064d` empuja
`(0xc6, di, 0x131, di+7)` a `0x29a6` = ULTIMA.EXE `0x0b86`, que entra con **`stc`** (el
relleno opaco es el hermano `0x0aa6`, con `clc`). `di` arranca en **`0x28` = 40 px = fila 5**
(`0x0643 mov di,0x28`) y se mueve ±8 con cada salto (`0x069b sub di,8` / `0x06c3 add di,8`).

★ **Ese 40 es un control independiente de la aritmética de las cabeceras**: la fila del
primer nombre se deduce contando los `\n\n` de DS 0x4fca, y el literal `mov di,0x28` la
confirma sin usar ese razonamiento. Dos caminos, mismo número.

El span x 198..305 **no está alineado a celda**: entra 2 px en el borde izquierdo (col 24 =
x192..199) y 2 px en el derecho (col 38 = x304..311). Se conserva tal cual. Sobre un área de
DOS colores (glifo blanco sobre negro) el XOR con blanco **es** el vídeo inverso, así que la
piel lo compone como «relleno blanco + los glifos que solapan, en negro, RECORTADOS a la
barra» — equivalencia argumentada, no aproximación de conveniencia.

## 3. ★ El ESPACIO CONFIRMA — y el picker de al lado invita a copiarlo mal

Despacho completo de `0x0668-0x06ee`:

| código | destino | qué hace |
|---|---|---|
| 1, 3 | `0x067c` → `0x0494` | huésped ANTERIOR |
| 2, 4 | `0x06a4` → `0x04b6` | huésped SIGUIENTE |
| 0x0d | `0x06d4` | CONFIRMA el resaltado |
| **0x20** | `0x06d4` | **CONFIRMA** — mismo destino que el Enter |
| 0x1b | `0x06c8` | cancela: `No one\n\n` (DS 0x4fd8) y selección 0 |
| otro | `0x06f0` | `sub si,si` → vuelve a leer tecla, sin mover |

`0x06eb cmp ax,0x20 / je 0x6d4` salta al MISMO sitio que `0x06e1 cmp ax,0xd / je 0x6d4`. En
el picker «Arms» del herrero (`core/shops/shopArmsPicker.ts`) el `" "` cae en el brazo de
`Escape`. Son las dos ventanas enmarcadas del panel derecho y el reductor del vecino es lo
primero que uno copia: copiarlo habría hecho que el espacio imprimiera un `No one` que el
original no imprime. Sellado por el mutante M3.

**Sin envolvimiento en los extremos**: `0x0494`/`0x04b6` devuelven el centinela 0 al pasarse
y `0x069e or si,si / je` cae en `0x06a2 jmp 0x660` — re-lee tecla con la barra QUIETA.

## 4. ★ La ranura 0 de [[#50]]: coherente DENTRO de la ventana, y quien discrepa es el contador

El bucle de nombres arranca en `0x55e7` con cuenta 15. Los registros miden 0x20 B y el byte
de posada está en `+0x1f`, así que `0x55e7` es el del registro **1** (el del 0 está en
`0x55c7`, con su nombre en `0x55a8` — el que rellena la gitana, `gypsy.md:158`). Los dos
buscadores del cursor recorren la MISMA población: `0x0494` decrementa y para en 0
(`dec dx / je 0x4ac`), `0x04b6` incrementa hasta 0x10 exclusive. ⇒ dentro de la ventana el
Avatar está fuera de la lista **Y** fuera de la navegación: **son consistentes**.

Quien NO coincide es el CONTADOR de huéspedes `SHOPPES3:0x0000`, que barre desde `0x55c7`
con `cx = 0x10` — 16 registros, **ranura 0 incluida**. Si el registro 0 tuviera el byte de
posada igual a la localización actual, el contador diría uno más que los nombres pintados.
**NO se modela y se declara**: la ranura 0 es el Avatar y su byte vale 0 («en el grupo»)
mientras se juega. Y el propio binario neutraliza el caso: el atajo de un solo huésped
(`0x070c`) llama a `0x04b6(0)`, que también salta la ranura 0, y si devuelve el centinela la
convergencia `0x0715` sale sin cobrar.

## 5. RNG — la cifra, con su ámbito

**El dibujo y la navegación de la ventana hacen CERO tiradas.** Barrido transitivo (prof. 3)
de los seis helpers desde sus entradas: `0x4efc` (borrado del divisor), `0x4f3c`
(`box_border_painter`), `0x2900` (`draw_status_panel`), `0x16ba` (emisor), `0x1850`
(`print_string`) → **0 llamadas a rand**.

🔴 **Pero «cero RNG» a secas sería falso**: `getkey_with_redraw` (0x266c) sí alcanza
`rand_range` (0x2092) por `0x5910` → `0x4552` / `0x2f62` — el tick de mundo del repintado.
Eso es la espera de tecla COMPARTIDA por todos los prompts del juego, no algo que la ventana
añada: el flujo de consola previo también esperaba tecla. ⇒ **no mueve stream respecto al
port de ayer**, y la cifra correcta es «cero tiradas PROPIAS», no «cero tiradas».

## 6. El arreglo, y qué mató a cada mutante

- `core/shops/innRegisterPicker.ts` — reductor del cursor (§3), NUEVO.
- `skin/fiel/innRegister.ts` — modelo puro de la rejilla + geometría de la barra, NUEVO.
- `skin/api.ts` · `skin/coreview.ts` — `InnRegisterView` + `setInnRegister` (hermano de
  `setReadyPicker`).
- `skin/fiel/skin.ts` — `panelOverlayKind` gana su **cuarto estado**, que su propio docblock
  anticipaba, y cae en `full` (no en `shop`): SHOPPES3 limpia hasta la fila **9**, mientras
  el sell-flow del herrero limita el suyo a las filas 1..6 (SHOPPES 0x0fb4). Lo que separa a
  las dos ventanas enmarcadas es el ALTO del rectángulo que borran.
- `skin/shader/skin.ts` — la ventana entra en el `panelOverlay` del paso (3b): mismo puente
  del filo izquierdo y57..62 que Ztats/Ready. Sin eso, la piel de FÁBRICA enseñaría el filo
  blanco cortado a la altura del segundo huésped.
- `ui/shop-console.ts` — `innPickupStart` abre la ventana en vez de listar letras; el prompt
  DS 0x4fa7 sigue saliendo antes (0x051f precede al `select_text_window` de 0x0526).
- `main.ts` — `openInnRegister`, calcado de `openArmsPicker`.

**Verificación**: `tests/inn-register-283.test.ts`, 12 casos, esperados EN CRUDO.
**ORDEN HONESTO: aquí NO hubo failing-first** — se derivó, se implementó y luego se selló;
el sustituto es la mutación. Base commiteada ANTES de sembrar (si no, el `checkout` de
restauración habría destruido el trabajo sin commitear):

| mutante | rojos |
|---|---|
| M1 — `drawListFrame` a no-op (la ventana sin marco) | **4 de 12** |
| M2 — los nombres arrancan en la fila 3 (un solo CRLF) | **4 de 12** |
| M3 — el ESPACIO cancela (vocabulario copiado del picker «Arms») | 1 (el caso ★ de §3) |
| M4 — los extremos ENVUELVEN (módulo en vez de clamp) | 1 (el caso de extremos) |

4/4 muertos; árbol restaurado y `git status` limpio tras cada uno.

## 7. Residuos DECLARADOS

1. 🔴 **NO hay captura de pantalla del port mirada.** Lo mirado es el **volcado de la
   rejilla** carácter a carácter (el modelo), no píxeles renderizados: no existe referencia
   de esta ventana en `original/av-referencia` (buscado: `inn`/`posad`/`regist`, 0 hits) y
   conducir el flujo hasta el (P)ick up con ≥2 huéspedes en Playwright no cabía en el
   presupuesto del carril. La geometría está sellada por unit y por los mutantes; **el
   careo de PÍXELES en las dos pieles queda pendiente** y no se firma como hecho.
2. **Caben CUATRO nombres** (filas relativas 4..7). El original no acota su bucle: el 5º
   nombre se pintaría ENCIMA del borde inferior y el 6º dispararía el scroll de la ventana.
   El port pinta los que caben y declara `overflow`; la lista se recorre entera con el
   cursor. Caso degenerado del original (hay que dejar 5+ personajes en LA MISMA posada),
   no una regla que calcar — pero si algún día se calca, es AQUÍ.
3. **Nombre largo**: con el descriptor a `right=39` el impresor del binario admite hasta la
   col 15 desde la col 4, o sea 11 caracteres antes de pisar el borde derecho. Los nombres
   del roster son más cortos; no se ha censado la cota real del campo de nombre.
4. **El eco de la tecla `P`** sigue sin comprobar — residuo §7.4 de `inn-145-acta`, intacto.
