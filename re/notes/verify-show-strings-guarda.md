# `verify_show` anotaba strings sin exigir inicio de cadena (tarea #50)

**Titular: la guarda es de UNA LÍNEA y es definicional — el byte anterior debe ser el NUL
que cierra el string previo. Retira 160 de 1420 anotaciones. Pero lo que el encargo pedía
como puerta —el idiom de consumo— NO PUEDE SERLO: medido, habría retirado 395 anotaciones
LEGÍTIMAS.**

Base: `main` @ `4f9ed378`. Defecto cazado por el carril de la frontera.

---

## 1. El defecto, reproducido

```
BLCKTHRN.OVL:0b81   mov ax, 0x7530     ; 0x7530 = 30000 DECIMAL (contador de tiempo)
                    -> verify_show anotaba  'u see:\ndarkness.\n'
```

`fileoff = 0x7530 + 0x10` cae **2 bytes dentro** de `'You see:\ndarkness.\n'`, que empieza
de verdad en DS `0x752e`. Ese mismo `mov ax, 0x7530` aparece en **cinco overlays**
(BLCKTHRN, COMSUBS, CMDS, SJOG, ULTIMA.EXE).

Causa: el pool de DATA.OVL es texto contiguo separado por NUL, así que **casi cualquier
inmediato de 16 bits aterriza dentro de alguna cadena**. El peligroso no es el que se ve
raro: es el que cae en frontera de palabra y se lee como una cita impecable.

## 2. El arreglo: (a) puerta definicional · (b) marca de confianza

**(a) INICIO EXACTO — puerta.** `text_at` exige `blob[fileoff-1] == 0`. No es heurística:
si el byte anterior no cierra el string previo, ese DS no es el principio de nada.
Medido sobre los 28 `.asm`: **1420 → 1260 anotaciones** (retira 160). Muestra inequívoca:
`0x7530`=30000 · `0x2710`=10000 · `0x32c8`=13000 · `0x1c00`=segmento de vídeo de CGA.

**(b) CONSUMO — marca, NO puerta.** El encargo pedía exigir el idiom `push+call`. Lo
implementé y lo medí antes de aceptarlo: **habría retirado 395 anotaciones legítimas** —
`'MISCMAPS.DAT'`, `'KARMA.DAT'`, `'No effect!'`, `'Not here!'`. Dos formas del binario no
caben en una ventana corta:

1. carga el puntero y hace `jmp` a una **cola de impresión compartida**
   (`mov ax, 0x46c7 ; jmp 0x1289`);
2. apila varios argumentos antes del `call`, que queda fuera de la ventana.

Convertirlo en puerta cambiaría un problema de falsos positivos por uno de falsos
**negativos**, y en un instrumento de verificación eso es peor: el positivo se ve y se
discute, el negativo desaparece en silencio. Así que se usa como marca — `;` corroborado,
`;?` sin corroborar — que es la rama «degradar a aviso» que el propio encargo contemplaba.

Consumidores REALES derivados del corpus (878 punteros con push+call): `print_string`
domina con **682+63**; la cola es `kernel_fn_25d8`, `stristr`, `strchr_index`,
`ui_draw_boxed_string`, `dos_file_exists`, `shop_expand_and_print_template`. Ojo: esa
derivación **también** arrastra falsos positivos del mismo género (`0x270f`=9999 hacia
`add_word_capped`, `0x9c40`=40000 hacia `tone_sweep`) — otra prueba de que el consumo por
sí solo no basta.

## 3. Tests (pytest 63 → 65)

- `test_verify_show_only_annotates_string_STARTS`: `0x7530` debe dejar de anotarse;
  `0x752e` (el inicio real) sigue dando `'You see:\ndarkness.\n'`; `0x2710`/`0x32c8`/`0x1c00`
  no son strings; y **no-regresión**: `0x6f7a` y `0x46c7` siguen anotándose.
- `test_verify_show_pointer_idiom_is_a_marker_not_a_gate`: falla si alguien convierte el
  idiom en filtro, con `'Not here!'` (que se consume por salto) como testigo.

## 4. Re-barrido del corpus — y TRES defectos de MI PROPIO barrido

Barrí las citas `DS/str/DATA.OVL/fileoff 0xNNNN` del corpus. El instrumento necesitó dos
correcciones antes de dar un número honesto, **las dos del mismo género que persigo**:

| pase | tocadas | qué estaba mal |
|---|---:|---|
| v1 | 169 | sin frontera de palabra: **`CMDS:0x0AEA` casaba por el `DS` de «CM·DS»** — exactamente la `K` de DNGLOOK de #15, en mi propio código |
| v2 | 84 | `fileoff` tratado como DS: ahí `ds = n − 0x10` y yo sumaba `0x10` otra vez |
| **v3** | **62** | — |

De 2523 citas, **1397 siguen dando texto** y **62 quedan tocadas** por la guarda.

### 4.1 Censo de las 62 — ADJUDICACIÓN PENDIENTE, declarada

No las adjudico aquí: son 62 en 34 ficheros y cada una pide leer su contexto para decidir
si el offset es un error de transcripción o una cita DELIBERADA de posición intermedia (el
binario a veces imprime desde mitad de cadena). Convención del pool para lotes grandes:
censo completo ahora, adjudicación en tarjeta propia. **Ninguna es un cambio de
comportamiento**: son citas en prosa y comentarios.

Dato que orienta la adjudicación: **14 de las 62 ya traen el texto correcto en su propia
línea** (sólo sobra el offset); las otras 48 no. Y la distribución del delta tiene dos
modas — deltas 1-4 (18 casos, con pinta de error de transcripción) y deltas ≥13 (31 casos,
con pinta de cita intencionada de subcadena).

| # | sitio | cita DS | inicio REAL | delta | string real | ¿prosa ya correcta? |
|---|---|---|---|---|---|---|
| 1 | `game/src/core/game.ts:4688` | `0x2882` | `0x2881` | +1 | `\nAttacked!\n` | sí |
| 2 | `game/src/core/game.ts:4752` | `0x2882` | `0x2881` | +1 | `\nAttacked!\n` | sí |
| 3 | `game/src/core/game.ts:4758` | `0x2882` | `0x2881` | +1 | `\nAttacked!\n` | sí |
| 4 | `game/tests/shrine-trigger.test.ts:206` | `0x049b` | `0x049a` | +1 | `*IMC` | — |
| 5 | `re/notes/auditoria-cobertura-completa.md:23` | `0x39c5` | `0x39c3` | +2 | `Falling into underworld!!\n` | sí |
| 6 | `re/notes/auditoria-cobertura-completa.md:34` | `0x2d63` | `0x2d61` | +2 | `Poison!\n` | sí |
| 7 | `re/notes/drink-ahead-fidelity.md:67` | `0x7728` | `0x7726` | +2 | `Cured!\n` | — |
| 8 | `re/notes/intro-demo-scene.md:84` | `0xa054` | `0xa052` | +2 | `QUESTION.DAT` | — |
| 9 | `re/notes/yt-careo-tickets.md:128` | `0x7c60` | `0x7c5e` | +2 | `Cloth suit` | — |
| 10 | `game/src/core/game.ts:4623` | `0x26bb` | `0x26b9` | +2 | `Underworld!\n` | — |
| 11 | `game/src/core/world/shrine-ceremonies.ts:366` | `0x95c8` | `0x95c6` | +2 | `Dexterity +1\n` | — |
| 12 | `game/src/core/world/wind.ts:49` | `0x558a` | `0x5588` | +2 | `POISON!\n` | — |
| 13 | `game/src/skin/fiel/ready.ts:179` | `0x7c60` | `0x7c5e` | +2 | `Cloth suit` | — |
| 14 | `re/notes/diff-ocr-masivo.md:39` | `0x9507` | `0x9504` | +3 | `Direction-` | sí |
| 15 | `game/src/core/dialogue/conversation.ts:130` | `0x9423` | `0x9420` | +3 | `"I cannot help thee with that.` | — |
| 16 | `re/notes/diff-ocr-masivo.md:38` | `0x7974` | `0x7970` | +4 | `No\n\n"What else?\n\n` | — |
| 17 | `re/notes/npc.md:130` | `0x0d8c` | `0x0d88` | +4 | `The Oaken Oar` | — |
| 18 | `game/src/core/world/cmd-strings.ts:182` | `0x29c3` | `0x29bf` | +4 | `Slow progress!\n` | — |
| 19 | `game/src/core/game.ts:4334` | `0x7232` | `0x722c` | +6 | `\nThy wish?\n` | — |
| 20 | `game/src/core/world/cmd-strings.ts:411` | `0x4dca` | `0x4dc4` | +6 | `\nWilt thou take\nit?" ` | — |
| 21 | `game/src/core/world/guard-encounters.ts:182` | `0x27e2` | `0x27dc` | +6 | `'§'®'\n"Thou art under arrest!"\n\n` | — |
| 22 | `game/src/main.ts:1499` | `0x27e2` | `0x27dc` | +6 | `'§'®'\n"Thou art under arrest!"\n\n` | — |
| 23 | `game/src/ui/shop-console.ts:1962` | `0x4dca` | `0x4dc4` | +6 | `\nWilt thou take\nit?" ` | — |
| 24 | `game/tests/guard-arrest-live.test.ts:13` | `0x27e2` | `0x27dc` | +6 | `'§'®'\n"Thou art under arrest!"\n\n` | — |
| 25 | `re/notes/command-dispatch.md:191` | `0x0b04` | `0x0afd` | +7 | `BORDERMARCH` | — |
| 26 | `re/notes/espejo-part08.md:80` | `0x2637` | `0x2630` | +7 | `DWELLING.DAT` | — |
| 27 | `game/src/core/game.ts:1277` | `0x2992` | `0x298b` | +7 | `BREAKING UP!\n` | — |
| 28 | `game/tests/naval-live.test.ts:220` | `0x2992` | `0x298b` | +7 | `BREAKING UP!\n` | — |
| 29 | `game/src/skin/fiel/intro.ts:65` | `0x31c9` | `0x31c1` | +8 | `Copyright 1988 Lord British` | sí |
| 30 | `re/notes/auditoria-cobertura-completa.md:55` | `0x3115` | `0x310c` | +9 | `Journey Onward` | — |
| 31 | `game/src/core/world/transport.ts:565` | `0x6aef` | `0x6ae6` | +9 | `Abandon ship!\n` | — |
| 32 | `re/notes/font.md:25` | `0x50ca` | `0x50bd` | +13 | `"Is there\nanything more\nI can do for\nthe` | — |
| 33 | `re/notes/font.md:45` | `0x50ca` | `0x50bd` | +13 | `"Is there\nanything more\nI can do for\nthe` | — |
| 34 | `re/notes/intro.md:107` | `0x50ca` | `0x50bd` | +13 | `"Is there\nanything more\nI can do for\nthe` | — |
| 35 | `re/notes/ui-render-map.md:80` | `0x50ca` | `0x50bd` | +13 | `"Is there\nanything more\nI can do for\nthe` | — |
| 36 | `re/notes/ui-render-map.md:84` | `0x50ca` | `0x50bd` | +13 | `"Is there\nanything more\nI can do for\nthe` | — |
| 37 | `re/notes/ui-render-map.md:263` | `0x50ca` | `0x50bd` | +13 | `"Is there\nanything more\nI can do for\nthe` | — |
| 38 | `game/src/skin/fiel/proport.ts:58` | `0x50ca` | `0x50bd` | +13 | `"Is there\nanything more\nI can do for\nthe` | — |
| 39 | `re/notes/auditoria-cobertura-completa.md:40` | `0x9338` | `0x9328` | +16 | `Thou hast not enough gold!` | sí |
| 40 | `re/notes/auditoria-cobertura-completa.md:53` | `0x4df3` | `0x4de3` | +16 | `"Highwaymen!\nCheap, at that!\nOUT!" ` | sí |
| 41 | `re/notes/shoppe-greetings-witness.md:5` | `0x7a3c` | `0x7a2c` | +16 | `Yes\n\n"Fine! We sell:\n\n` | — |
| 42 | `re/notes/yt-careo-tickets.md:11` | `0x6b3c` | `0x6b2c` | +16 | `Caught!\n\nThe trolls demand a ` | — |
| 43 | `game/src/core/world/shrine-ceremonies.ts:403` | `0x4492` | `0x4482` | +16 | `\n\nThe Shrine is\nrestored!\n` | sí |
| 44 | `game/src/main.ts:1443` | `0x26a0` | `0x2690` | +16 | `\nDost thou wish to leave? ` | sí |
| 45 | `game/src/main.ts:1448` | `0x26a0` | `0x2690` | +16 | `\nDost thou wish to leave? ` | sí |
| 46 | `game/src/main.ts:1465` | `0x6b3c` | `0x6b2c` | +16 | `Caught!\n\nThe trolls demand a ` | — |
| 47 | `game/tests/shops.test.ts:251` | `0x4df3` | `0x4de3` | +16 | `"Highwaymen!\nCheap, at that!\nOUT!" ` | — |
| 48 | `game/src/core/world/cmd-strings.ts:250` | `0x80bb` | `0x80aa` | +17 | `"We have powers to Cure, Heal, or Resurr` | — |
| 49 | `game/src/core/world/cmd-strings.ts:252` | `0x80bb` | `0x80aa` | +17 | `"We have powers to Cure, Heal, or Resurr` | sí |
| 50 | `game/src/ui/shop-console.ts:777` | `0x80bb` | `0x80aa` | +17 | `"We have powers to Cure, Heal, or Resurr` | sí |
| 51 | `re/notes/antim-freeze.md:43` | `0x4ee2` | `0x4ecf` | +19 | `"The rate for\nour most comfortable room ` | — |
| 52 | `re/notes/demo-scene-data.md:210` | `0x4ee2` | `0x4ecf` | +19 | `"The rate for\nour most comfortable room ` | — |
| 53 | `re/notes/kernel-sweep-4.md:27` | `0x4ee2` | `0x4ecf` | +19 | `"The rate for\nour most comfortable room ` | — |
| 54 | `re/notes/kernel-sweep-4.md:106` | `0x4ee2` | `0x4ecf` | +19 | `"The rate for\nour most comfortable room ` | — |
| 55 | `re/notes/sprite-anim-cadence.md:10` | `0x4ee2` | `0x4ecf` | +19 | `"The rate for\nour most comfortable room ` | — |
| 56 | `re/notes/tile-anim-census.md:34` | `0x4ee2` | `0x4ecf` | +19 | `"The rate for\nour most comfortable room ` | — |
| 57 | `game/src/core/world/cmd-strings.ts:419` | `0x4e86` | `0x4e71` | +21 | `&A&A&g&§&\n	$ asks,\n"Who will\ns` | — |
| 58 | `game/src/ui/shop-console.ts:2041` | `0x4e86` | `0x4e71` | +21 | `&A&A&g&§&\n	$ asks,\n"Who will\ns` | — |
| 59 | `re/notes/espejo-careo-precios.md:26` | `0x4dbc` | `0x4da0` | +28 | `, but we\nhave no room\navailable."\n\n` | — |
| 60 | `re/notes/diff-ocr-masivo.md:56` | `0x781e` | `0x77f8` | +38 | `\n\nThe strangely familiar old man vanishe` | — |
| 61 | `game/src/core/world/cmd-strings.ts:372` | `0x3d5a` | `0x3d2e` | +44 | `´}Ú}ø}~4~@~X~d~v~~®~Ð~Hp²¾ÊØèò` | — |
| 62 | `game/src/ui/shop-console.ts:627` | `0x3d5a` | `0x3d2e` | +44 | `´}Ú}ø}~4~@~X~d~v~~®~Ð~Hp²¾ÊØèò` | — |

## 5. Gates

| gate | exit |
|---|---|
| `py_compile re/tools/verify_show.py` | **0** |
| `py_compile re/tools/test_frontier.py` | **0** |
| `pytest test_frontier.py test_dispatch.py test_ledger.py` | **0** — **65 passed** |
| `verify_cites.py scan` / `scan-code` | **0** / **0** |

---

## 6. AMPLIACIÓN #30 — eran TRES defectos, no uno, y la ficha señalaba la puerta equivocada

Carril `re/verify-show-30` · 2026-08-06. La ficha decía «anota NÚMEROS como CADENAS» y pedía
una heurística. Al medirlo salieron **tres defectos con tres remedios distintos**, y la
premisa de partida —«no tiene test propio»— era cierta como nombre de fichero y **falsa como
inferencia**: `test_frontier.py` ya lo ejercita en tres tests (770 · 801 · 825). Se midió la
presencia por la firma equivocada.

### 6.1 La clase INDECIDIBLE — se SEÑALA, no se decide

`0x270f` (=9999) se anota `'Missed!\n'` y **el byte previo es NUL**: es inicio exacto de una
cadena real, o sea que **la guarda del §2 acierta**. No es un agujero: es una **frontera del
método**, porque las dos lecturas son estructuralmente válidas. Y 9999 es número de verdad:
`SHOPPES2.OVL` hace `cmp word ptr [g_food], 0x270f` — es el **tope de comida**.

Dos ejes medidos sobre las 1248 anotaciones vivas:
| eje | marca | aciertos |
|---|---|---|
| valor «redondo» en decimal | **43** | **1** — el resto son cadenas en offsets redondos por azar (`'Halberd'`, `'Avatar'`, `'KEEP.DAT'`) |
| **usado además en `cmp`/`add`/`test`** | **15 (1,2 %)** | **2 de 2** |

Se implanta el segundo: **un puntero a cadena no se compara ni se suma**. Marca `⚠AMBIGUA`.

🔴 **El barrido del eje es GLOBAL**: `0x270f` se anota en `CAST.OVL`, que tiene **cero** usos
aritméticos de ese valor — la prueba vive en `INTRO.OVL` y `SHOPPES2.OVL`. Por-fichero no
marca nada.

🔴 **Y el eje excluye los `.DRV` igual que la anotación.** Al abrir las marcas una a una, 2 de
4 se apoyaban SÓLO en aritmética de driver: excluirlos para anotar e incluirlos para sospechar
es usar como prueba lo que se acaba de declarar ajeno.

★ **Captura NUEVA que encontró el propio instrumento**: `0x5588` → `'POISON!\n'`. Es una **base
de tabla** (`SHOPPES3.OVL` hace `add si, 0x55a8` / `add di, 0x5588` sobre un índice), no un
puntero a texto.

⚠️ **NO-COBERTURA DECLARADA**: `0x11b2` (=4530) se anota `"don't"` y **es un parámetro de tono**
— ni redondo ni aritmético. **Ningún eje lo caza.** Por eso la marca dice «hay razón para
dudar» y **nunca** «aquí no la hay»: si se leyera como exhaustiva, su ausencia afirmaría algo
que nadie ha comprobado.

### 6.2 El espacio de direcciones — exclusión DURA

Los `.DRV` no comparten el DS de `DATA.OVL`, así que la convención `fileoff = DS + 0x10` no les
aplica: **26 anotaciones falsas por construcción**, no por heurística. Dos vías: **cero** de sus
163 filas del ledger cita una cadena del pool (control positivo: 1059 citas no-driver que sí lo
hacen), y `CGA.DRV: add ax, 0x9248` se anotaba `'THANK'` siendo `0x9248` la constante del
generador de números.

### 6.3 La ausencia-en-falso del §4.5 — y la puerta a bajar NO era la que decía la ficha

El acta hermana atribuía las cinco al listón de «≥3 bytes». **A/B medido:**
```
min_len 3→2 (sólo longitud) ...... +0 anotaciones   ← INERTE
floor_letras 3→2 (sólo letras) ... +37
```
`'No'` **pasa** la puerta de longitud y muere en la de LETRAS, que exige 3 como mínimo y una
palabra de 2 caracteres no puede tener. **El arreglo obvio no habría hecho nada.**

Y el remedio no es aflojar: **es cablear lo que ya existía**. `cita_hermana_emitida` tenía una
`text_at_lax` privada que resuelve el caso; sube aquí. Coste: **+0 anotaciones** (la estricta no
se toca).

Reparto de las cinco, que son **3 + 2** y no 5:
| DS | crudo | veredicto |
|---|---|---|
| `0xA00C` · `0x7928` · `0x7866` | `'No'` | ausencia-en-falso **real**, rescatada por la laxa |
| `0x786E` · `0x78D0` | `'\n\n"'` · `'?\n\n'` | **puntuación sola**: la laxa acierta al rechazarla |

⇒ hay **TRES preguntas** y sólo dos tienen función: «¿merece la pena anotar?» (`text_at`),
«¿hay prosa?» (`text_at_lax`) y «¿hay algún byte imprimible?» — **sin función**, y por eso hubo
que leer esas dos en crudo. No se añade una tercera **porque no tiene consumidor**.

🔴 **Y el daño NO llegaba a ningún verificador.** `verify_strcites.clasificar` usa `text_at` como
vía rápida y **recupera las cinco por su respaldo** (`inicio_real`, bucket `BORDE`). El daño era
del **humano que lee la CLI** — por eso el remedio es que **la salida deje de callar**
(`;bajo-liston`), no recablear consumidores.

### 6.4 🔴 La duplicación de `_starts_exactly` es DELIBERADA — no la limpies

`cita_hermana_emitida` replica la guarda a propósito, y su `agreement_control` compara **esta**
implementación contra **aquélla**. Unificarlas convierte el control en una **tautología** que
sale verde para siempre sin medir nada — peor que no tenerlo, porque tranquiliza. El comentario
en `verify_show._starts_exactly` ya no dice sólo *por qué se replicó*, sino **qué se rompe si la
unificas**, que es lo que necesita leer quien venga a limpiar.

### 6.5 Testigo

`re/tools/test_verify_show.py`, **11 casos**, COMPLEMENTARIO (declara en su cabecera qué cubre
`test_frontier.py`, para que nadie lo duplique al revés). **6 mutantes, uno por eje, los 6
muertos** — pero `M1` **sobrevivió en la primera pasada**: el testigo probaba que el valor está
en el conjunto (el CÁLCULO) y no que la marca salga impresa (el CABLEADO). Se añadieron dos
casos que corren `main()` y leen su salida.
