# ACTA #192 — la ronda de taberna: el productor de `[0xbd1a]`, y por qué la seña no se sostenía

> Rama `fix/pool-d4`, worktree `.claude/worktrees/pool-d4`, **RETENIDA**. Un commit:
> `71c9455c`. GATES sin pipes, exit por separado, re-corridos tras el `git add`:
> `npx tsc --noEmit` **EXIT 0** · `npx vitest run` COMPLETO **EXIT 0** (302 ficheros,
> 3896 pasados, 1 skipped) · `seed_gate` · `verify_pool174_claims` (**142 → 157 verdes**)
> · `pytest test_frontier` · `pytest test_genero` · `genero.py`, todos **EXIT 0**.
> **CERO e2e.**

---

## 1. La precondición, resuelta: `[0xbd1a]` es el NÚMERO DE VIVOS

#182 se negó a parchear D4 porque el dominio de `[0xbd1a]` no estaba acotado. Lo acota su
productor, `SHOPPES2.OVL:0x0000` (`ret 2`, un arg = precio por cabeza):

```
0008-0013: pone a CERO g_shop_accum(0xb118), g_alive_b(0xbd1c) y g_alive_a(0xbd1a)
0016: al = g_party_size / 001d: je 0x54          ← party vacía: el bucle no corre
0022: si = 0x55b3                                 ← base del roster, stride 0x20
0030: cmp byte ptr [si], 0x44                     ← ¿estado 'D'?
0033: je 0x3e                                     ← ★ el MUERTO no cuenta
0035: inc dx (g_alive_b) / 0036: inc di (g_alive_a)
0037-003a: add word ptr [g_unk_b118], ax          ← coste += precio por cabeza
0049: [g_alive_a] = di · 004d: [g_alive_b] = dx
```

⇒ **`g_alive_a` = miembros VIVOS**, `g_shop_accum` = coste total = precio × vivos.

### 1.1 ★ La respuesta ya estaba en el repo

`re/ledger/globals.json` YA nombraba `0xbd1a` = **`g_alive_a`**, `0xbd1c` = `g_alive_b` y
`0xb118` = `g_shop_accum`. Alguien había leído 0x0000 y lo había registrado; la seña de
#174 los llamó «el contador de rondas» sin cruzarlo con el catálogo. Es la firma de #54
(«el port ya tenía la respuesta en 6 de 7»), esta vez en el LEDGER: **antes de derivar una
global desde cero, mírala en `globals.json`** — el nombre estaba a un `grep` de distancia y
habría ahorrado la mitad de esta tarjeta.

## 2. La adjudicación que #182 dejó abierta

Dos ramas EXCLUYENTES, repartidas por el gate `014a: cmp word ptr [g_alive_a], 0` / `014f: je 0x1c4`:

| rama | condición | qué hace |
|---|---|---|
| **A (comida)** | ≥ 1 vivo — **todo juego normal** | `add_word_capped(&g_food, g_alive_a, 9999)` + PLATO. **NO** toca el contador |
| **B (contador)** | party **ENTERA MUERTA** | `01c4: inc [g_cups_served]`, y nada más |

La **CONCLUSIÓN** de la seña original («en el original nunca incrementa») era **CORRECTA**.
Su **MECANISMO** («un contador gateado al revés») **NO**: no hay contador mal puesto, hay
un selector por número de vivos. #182 hizo bien en rechazar el marco y exigir el productor;
con él, la rama B queda acotada a un estado degenerado y la A es la de siempre.

## 3. Los tres defectos del port, arreglados

1. **No daba la comida.** `0151-015d push 0x57a8(&g_food) / push [g_alive_a] / push 0x270f
   / call 0x5d34` → CS 0x3F14 `add_word_capped` ⇒ **+1 por miembro VIVO, tope 9999**.
2. **No pintaba el plato**, y son DOS orientaciones CON ORDEN: NORTE primero
   (`0160-0173`, y−1, mesa 0x95 → plato **0x9b**), y sólo si ahí no hay mesa el SUR
   (`0194-01a7`, y+1 → **0x9a**). El núcleo devuelve la celda; el conductor la escribe con
   `setVolatileTerrain` (canal de PUNTERO `get_tile_ptr`, #119/#121).
3. **★ El contador se incrementaba en la rama contraria.** `shop-console.ts` hacía
   `this.served += 1` citando «g_cups_served++ (0x01C4)». Observable: el aviso de vino
   saltaba tras 3 servicios COMBINADOS en vez de 3 COPAS, así que 3 rondas de comida + 1
   copa disparaban karma −1 y borrachera de 25 turnos que el original no aplica.

Y la **prosa auto-infiel** de `shops.ts` («lo incrementan TANTO las rondas de comida COMO
las copas») queda retirada con su derivación — era el residuo que #182 dejó anotado.

## 4. ★★ El casi-desastre de instrumento, declarado

Los operandos crudos de los near-call de SHOPPES2 **no son offsets de kernel**: hay que
aplicar `overlay_near_call_base('SHOPPES2.OVL') = 0xE1E0`. Sin la base:

| operando | «resolvía» a (FALSO) | resuelve de verdad a |
|---|---|---|
| `0x5d34` | `vis_buffer_build` | **CS 0x3F14 `add_word_capped`** |
| `0x7730` | `overlay_loader_fatal_abort` | **CS 0x5910 `viewport_redraw`** |
| `0x6222` | `world_turn_dispatch` | **CS 0x4402 `get_tile_ptr`** |

Los nombres falsos eran **plausibles de leer** y estuve a punto de publicar «la suma de
comida la hace `vis_buffer_build`». Lo que lo cazó fue un control… **que además era
inválido**: usé `0x7f70` (el `add_capped` de D10) como control, pero 0x7f70 es de **TALK**,
otra base — un control tomado de otro overlay no controla nada. El control BUENO son tres
rutinas ya identificadas por actas anteriores que, con la base, caen **exactas y en offset
+0**: `print_string`, `putchar`, `viewport_redraw`. Las tres van al trinquete como
controles permanentes, para que el próximo que toque SHOPPES2 vea la base fallar en rojo si
la olvida.

**Regla:** un control de resolución tiene que vivir en el MISMO overlay que lo que resuelve.

## 5. Failing-first, controles y honestidad sobre los verdes

**7 rojos de 10.** Conductuales los de comida (`expected 100 to be 103`, `expected 9998 to
be 9999`); estructurales los de plato/contador (campos nuevos), declarado en el fichero.

> ⚠ **DOS VERDES ERAN DEGENERADOS** y llevan su gemelo dentro: «sin mesa no se escribe
> nada» y «sin oro no da comida» pasaban YA sin el fix, porque el port no daba NADA nunca.
> Los redimen los rojos que prueban que el plato y la comida SÍ aparecen cuando deben.

**Control del arnés:** `tavernRoundPrice(TOWN,1) > 0` — sin él, «cobra el coste correcto»
sería verde con precio 0. **Control que aísla el discriminador:** la misma party de 3 con
uno en `'D'` da 2 de comida y coste de 2, no de 3.

## 6. Cosas que se cazaron solas (y que valen como método)

1. **El trinquete cazó dos citas MÍAS**: escribí `[g_shop_accum]` donde el disasm imprime
   `[g_unk_b118]` — la desincronización símbolo↔disasm de **#81**. Se cita el TEXTO
   LITERAL, que es lo único que ese gate puede verificar.
2. **Una regresión propia, cazada por la suite COMPLETA**: `falsedad-drain-scope.test.ts`
   ejercita la ronda con un `Game` de doble SIN mapa, y mi lectura de mesas lo rompía. Se
   arregla en MI lado (lectura defensiva) en vez de parchear el arnés ajeno, que habría
   empujado mi acoplamiento a un test que no es mío.

## 7. Residuos declarados

1. **El repintado de `018e`** (`viewport_redraw`) NO se emite: `ShopConsoleDeps` no tiene
   canal de refresco de mapa y el viewport está tapado por la consola mientras dura la
   sesión. Declarado como NO-portado, no como equivalente.
2. **`g_alive_b` (0xbd1c) no se modela**: es un duplicado exacto de `g_alive_a` que sólo
   alimenta el selector de frase de `0x006a` (2/3/4/5/6 → cadenas distintas). Presentación,
   y su cadena no está portada — cae en la familia de #145.
3. **La rama B en el clon**: con la party entera muerta el conductor de tienda no es
   alcanzable por la vía normal (el flujo de muerte/refuge corta antes). El núcleo la
   modela porque es lo derivado; que nadie la lea como camino vivo.
