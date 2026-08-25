# Merma de oro de la FALSEDAD en tiendas — derivación completa y censo de call-sites

**Carril:** bancos-residuales · **2026-07-25** · Encargo del lead a partir del hallazgo de
`frontera-verify`. Fase 1: **derivar antes de tocar el port**.

## 1. La cita refutada

`re/notes/use-merchants.md:132` afirmaba: *«La taberna es SHOPPES2 ⇒ NO aplica la merma de la
Falsedad, porque los pagos van seguidos de `kernel 0x9dfa`, no de `0x19a`»*.

**Son la misma rutina.** SHOPPES2 y SHOPPES3 están en la **banda 4** (`near_call_base =
0xe1e0`), así que:

```
(0xe1e0 + 0x9dfa) & 0xFFFF = 0x7FDA   → stub del kernel
dispatch_table.stubs()[0x7FDA] = SHOPPES.OVL, entry_file_off = 410 = 0x019A
```

Pasan por el stub **porque desde otra banda no pueden llamar directo** — el mismo mecanismo
que hoy ha engañado tres veces (`0xffffdafe`, `0x75a2`, `0x5d8e`). ⇒ **La taberna y la posada
SÍ merman.** Y `game/src/ui/shop-console.ts:1168-1175` documenta y aplica la regla refutada.

## 2. La mecánica, entera

`SHOPPES.OVL 0x019A` — **9 instrucciones**, sin ramas más allá del gate:

```
019a  cmp byte [g_unk_5958], 0     ; ★ GATE
019f  jne 0x1b4                    ; != 0 → RET, no hace nada
01a1  push 0x57aa                  ; &g_gold
01a5  push 1
01a9  push 0x40
01ad  call 0x7e02                  ; → kernel 0x2092 rand_range(1, 0x40)
01b0  push ax
01b1  call 0xffff9dcc4→kernel 0x3F54
01b4  ret
```

| pregunta del encargo | respuesta | cita |
|---|---|---|
| ¿cuánto roba? | **`rand(1, 64)` monedas** | `push 1 / push 0x40 / call 0x2092` |
| ¿con qué probabilidad? | **100 %.** No hay tirada de probabilidad: el único gate es la presencia | 0x019a-0x019f |
| ¿condición? | **`g_shadowlord_here_idx == 0`** = **Faulinei/Falsehood** presente en ESE pueblo | idx canónico en `shadowlord-urban.md §0` |
| ¿puede dejar el oro negativo? | **No.** `kernel 0x3F54` = resta con **clamp a 0** (`cmp [bx],ax; jle → [bx]=0`) | 0x3f5d-0x3f66 |
| ¿imprime algo? | **NADA. Robo silencioso.** La rutina no llama a ningún printer | cuerpo completo |

⇒ **No hay ninguna cadena de usuario nueva** ⇒ **no toca `approved-strings`**. (Se comprobó
explícitamente: era la trampa del «No chest here.».)

**Cómo se fija el gate** (`shadowlord-urban.md §1`, ya derivado): `TOWN.OVL 0x02AE` pone
`g_unk_5958 = 0xFF` y recorre `si=0..2` comparando `[si + 0x58c8]` (tabla de 3 bytes con la
`g_location` de cada SL) contra `g_location`; el **primer match** escribe `g_5958 = si`. Los
SL vagan por las 8 ciudades de la virtud y se re-sortean a medianoche.

## 3. Censo de call-sites — son **ONCE**, no seis

El encargo hablaba de 6 (los de SHOPPES2/3). Hay **5 más dentro de la propia SHOPPES.OVL**
(los mercaderes normales), que llaman `0x19a` directo por estar en la misma banda:

| # | call-site | instrucción inmediatamente anterior | veredicto |
|---|---|---|---|
| 1 | `SHOPPES2 0x0147` | `0x0143 sub [g_gold],ax` | **PAGO ✓** |
| 2 | `SHOPPES2 0x0361` | `0x035d sub [g_gold],ax` | **PAGO ✓** |
| 3 | `SHOPPES2 0x0846` | `0x083c sub [g_gold],ax` | **PAGO ✓** |
| 4 | `SHOPPES3 0x0121` | `0x011d sub [g_gold],ax` | **PAGO ✓** |
| 5 | `SHOPPES3 0x07b3` | `0x07af sub [g_gold],ax` | **PAGO ✓** |
| 6 | `SHOPPES 0x037b` | `0x0377 sub [g_gold],ax` | **PAGO ✓** |
| 7 | `SHOPPES 0x0623` | `0x061f sub [g_gold],ax` | **PAGO ✓** |
| 8 | `SHOPPES 0x0951` | `0x094d sub [g_gold],ax` | **PAGO ✓** |
| 9 | `SHOPPES 0x0ab1` | `0x0aad sub [g_gold],ax` | **PAGO ✓** |
| 10 | `SHOPPES 0x14ed` | `0x14e9 sub [g_gold],ax` | **PAGO ✓** |
| 11 | `SHOPPES2 0x04fb` | *(sólo un print)* | ⚠ **SIN CERRAR** — §5 |

**10 de 11 siguen inmediatamente a un `sub [g_gold]`.**

## 4. LAS VENTAS: **NO merman** — y se prueba por ausencia total

Censo de **todos** los accesos a `g_gold` en los tres overlays (`grep g_gold`):

```
SHOPPES.OVL : 5× cmp  ·  5× sub          (0361/0377, 060a/061f, 092e/094d, 0a7b/0aad, 14bc+14e3/14e9)
SHOPPES2.OVL: 1× cmp  ·  4× sub  ·  4× mov ax,[g_gold]
SHOPPES3.OVL: 2× cmp  ·  2× sub
```

**No existe ni un solo `add` a `g_gold` en ninguno de los tres.** Todos los accesos son
comprobación de saldo (`cmp`), lectura (`mov`) o cobro (`sub`). ⇒ **Ningún call-site de la
merma puede seguir a un abono**, luego **vender no merma**. No es «no lo he visto»: es que la
operación que lo permitiría no existe en estos overlays.

(Corolario: el abono de una venta ocurre fuera de estas tres rutas. Fuera del alcance de este
encargo, anotado.)

## 4-bis. Los tres casos abiertos, IDENTIFICADOS por sus cadenas

Cada uno se ancló localizando el prólogo de su función y volcando las cadenas que imprime
(DS + 0x10 sobre DATA.OVL).

### `SHOPPES2 0x04fb` — función `0x0380` = compra POR CANTIDAD de la taberna

```
0x9c4a  '\n\nHow many wouldst\nthou like?" '
0x9c7a  '"Thou hast\nneither gold nor\nneed! Out!"\n'
0x9cb0  '"Thou canst\nafford only '   +  0x9cca  '!"\n\n'
```

Es el diálogo de **comprar N raciones/bebidas** en la taberna. Sus dos salidas:
la rama «sólo puedes permitirte N» **NO merma**; la rama de compra efectiva **SÍ**.
⇒ **La merma aplica.** (El `call 0x385e` de 0x04e6 que sospechaba como cobro es un
**impresor de número** — imprime `di`, la cantidad asequible, entre las dos cadenas.)

⚠ **Sigue sin localizar dónde se descuenta el oro de esta compra**: no hay `sub [g_gold]`
en la función. Está fuera de ella (caller o helper). No afecta al veredicto de la merma,
pero sí a dónde se engancha el fix.

### `SHOPPES2 0x0846` — función `0x080e` = confirmación Sí/No con honorífico

```
0x9fcc 'milady'   0x9fd4 'sir'   0x9fdc 'Yes'   (+ 0x9fd8 '?" ')
```
`sub [g_gold]` → `mov [0xbd24],1` → **merma** → `call 0x4720`. Compra confirmada con
«…, sir/milady?» Sí/No. **La merma aplica.**

### `SHOPPES2 0x0611` — función `0x0508` = **el CHISME/LORE del tabernero**

```
0x9f00  'Of what wouldst\nthou hear my\nlore, '  + 0x9f24 '?"\n\nYou respond:\n'
0x9f3a  '"That, I cannot help thee with.\n\n'
0x9f5c  "\n\nFair 'nuff?" "   0x9f6c 'No\n\n'   0x9f72 'Yes\n\n'
```

Es **pagar al tabernero por información** (con su regateo «Fair 'nuff?»). Hace
`sub [g_gold]` y **NO llama a la merma**, mientras su gemelo estructural `0x0846`
(mismo `g_unk_b118`, mismo `call 0x4720`) **sí**.

⇒ **NO es un descuido de lectura: el binario distingue.** Pagar por CHISME no dispara la
merma; comprar consumiciones sí. **Un flag «merma en todo pago de taberna» fabricaría aquí.**

## 5. Lo que NO cierro por lectura — declarado

### 5.1 `SHOPPES2 0x04fb` — call-site sin `sub` previo

Único de los 11 que no sigue a un cobro. Está en la rama de éxito de una función que sí
comprueba saldo (`0x0442 cmp [g_gold],ax`) pero **no tiene ningún `sub [g_gold]` en su
cuerpo**. Sus dos salidas:

```
04d6  print 0x9cb0 "\"Thou canst\nafford only "  → 04e9 print 0x9cca "!\"\n\n"  → RET (SIN merma)
04f4  print 0x9cd0 "\n\n"                        → 04fb MERMA               → RET
```

Es un mercader que regatea por cantidad (*«sólo puedes permitirte N»*). **Dónde cobra, no lo
he localizado**: el candidato es `0x04e6 call 0x385e`, sin leer. **No afirmo qué transacción
es ni si el port la modela.**

### 5.2 `SHOPPES2 0x0611` — un cobro que **NO** merma

`0x060e mov ax,[g_unk_b118]` → `0x0611 sub [g_gold],ax` → `0x0615 call 0x4720`. **No hay
llamada a la merma.** Y su gemelo estructural `0x0846` (mismo `g_unk_b118`, mismo
`call 0x4720` después) **sí la tiene**:

```
0x083c sub [g_gold],ax → 0x0840 mov [0xbd24],1 → 0x0846 MERMA → 0x0849 call 0x4720
0x060e ... 0x0611 sub [g_gold],ax →                              0x0615 call 0x4720
```

**Es una asimetría REAL del binario**, no un descuido de mi lectura: dos cobros casi idénticos
y sólo uno merma. Si al portar se aplicara la merma «a todo pago», **se fabricaría** una que
el original no hace. Hay que identificar las dos transacciones antes de tocar nada.

### 5.3 Alcance del port — RESUELTO: la mecánica SÍ está portada; lo que falla es el ALCANCE

La memoria del carril de tiendas («merma sin portar, deuda 3.10») está **obsoleta**.
`game/src/core/shops/shops.ts::postPurchaseDrain` existe y **calca la mecánica**: gate
primero, `rand(1,64)` del stream vivo, suelo 0, sin mensaje.

Lo que falla es **dónde se llama**. El port tiene **9** call-sites (8 en
`ui/shop-console.ts` vía `drainOnPurchase` + 1 en `game.ts:2990` para el caballo) contra
los **11** del binario, y su propio comentario declara la regla refutada: *«NO en ventas ni
en taberna/posada/astillero (SHOPPES2/3)»*.

⇒ **El fix no es implementar nada: es extender el alcance a los call-sites de SHOPPES2/3 que
el binario sí merma, y sólo a ésos** — dejando fuera el chisme del tabernero (§4-bis).

## 6. Estado y siguiente paso

**Cerrado**: la refutación de la cita · la mecánica completa (cuánto, probabilidad, condición,
clamp, silencio) · el censo de 11 call-sites · **las ventas NO merman** · cero cadenas nuevas.

**Abierto y declarado**: qué transacción es `0x04fb` y dónde cobra · por qué `0x0611` no merma
y `0x0846` sí · el estado real del port.

**No se toca el port** hasta cerrar 5.1 y 5.2: son exactamente los dos casos donde un flag
global fabricaría comportamiento. Y cuando se aplique, **mueve el oro**, que el ledger del
espejo mide — coordinar con `espejo-3d` antes de aterrizar.

---

# ADDENDUM — mapa de funciones de SHOPPES2 y la hipótesis de `[0xbd24]`

## El mapa (prólogos + cadenas de cada función)

| función | contiene | qué es |
|---|---|---|
| `0x00ac-0x01f4` | `0x0143 sub` + **`0x0147` MERMA** | *«That will be N gold for the …»* — **cobro de una ronda** |
| `0x01f4-0x0380` | `0x035d sub` + **`0x0361` MERMA** | *«But haven't ye had enough to drink?»* — **copa de vino** |
| `0x0380-0x0508` | **`0x04fb` MERMA** (sin `sub`) | *«How many wouldst thou like?»* — **diálogo de CANTIDAD** |
| `0x0508-0x066c` | `0x0611 sub` — **SIN merma** | *«Of what wouldst thou hear my lore…»* — **CHISME** |
| `0x066c-0x07e2` | `0x0739 call 0x380` | *«Anything else for thee?»* — **bucle de menú de la taberna** |
| `0x080e-0x08a8` | `0x083c sub` + **`0x0846` MERMA** | `milady/sir` + Sí/No |

## La hipótesis de `[0xbd24]`: **descartada como discriminador**

Sugerencia del lead: quizá la merma no cuelga del pago sino de *qué clase de transacción* es,
y `mov [0xbd24],1` (presente sólo en la rama que merma) sería el discriminador.

**No lo es, y se descarta por lectura:** `0xbd24` aparece **3 veces en todo el binario**, las
tres en SHOPPES2 (`0x0840` escribe 1, `0x0aca` escribe `si`, `0x0b0e` lo lee). **La rutina de
merma (`SHOPPES.OVL 0x019A`) no lo lee**: su único gate es `g_unk_5958`. Es una variable de
estado vecina, no el discriminador.

⇒ **El discriminador no es un flag: es qué call-sites decidió el binario poner.** La distinción
chisme-vs-consumición está cableada en la estructura del código, no en un dato. Por eso el fix
tiene que ir call-site por call-site y no puede derivarse de una condición.

## Residual, ahora MÁS ACOTADO (y sigue abierto)

`0x0380` (diálogo de cantidad) **llama a la merma pero no descuenta oro**, y su único caller
es `0x066c` (el menú *«Anything else for thee?»*), que **tampoco** tiene `sub [g_gold]`. Los
cuatro `sub [g_gold]` de SHOPPES2 están en `0x0143`, `0x035d`, `0x0611` y `0x083c` — **ninguno
en esas dos funciones**.

Dos lecturas posibles, **sin decidir**:

- **(a)** `0x0380` es un sub-diálogo de cantidad cuyo cobro real ocurre en `0x00ac`
  (*«That will be N gold for the…»*) ⇒ una sola transacción podría pasar por **DOS** llamadas
  a la merma (`0x0147` y `0x04fb`) = **doble robo por compra**. Sería un detalle fiel llamativo
  y hay que verlo antes de creerlo.
- **(b)** `0x0380` cobra por otra vía que no he localizado.

**No se implementa el enganche de este call-site hasta decidir entre (a) y (b).** Los otros
cinco de SHOPPES2/3 no dependen de esto.

---

# ADDENDUM 2 — residual CERRADO, y **corrijo mi propia prueba de las ventas**

## ⚠ La prueba por ausencia era CORRECTA EN LA CONCLUSIÓN y EQUIVOCADA EN EL MÉTODO

En §4 escribí: *«no existe ni un solo `add` a `g_gold` en ninguno de los tres ⇒ ningún
call-site de la merma puede seguir a un abono»*. **El método no vale.** Un `grep g_gold`
sólo ve los operandos de memoria DIRECTOS (`sub word ptr [g_gold], ax`) y **se pierde todo
movimiento hecho por PUNTERO**, que es como el binario mueve el oro la mitad de las veces:

```
kernel 0x3F54  sub_clamped(ptr, cantidad)        ; suelo 0     ← la que usa la merma
kernel 0x3F14  add_capped (ptr, cantidad, tope)  ; techo
```

Los overlays los llaman por near-call (`0x9cc4`/`0x9c84` desde SHOPPES.OVL; `0x5d74`/`0x5d34`
desde SHOPPES2/3), así que **el desensamblado no escribe `[g_gold]` en ninguno**. Mi censo
los saltó por construcción.

### Censo CORRECTO (por call-site del helper + puntero empujado)

| sitio | operación | puntero |
|---|---|---|
| `SHOPPES.OVL 0x01b1` | `sub_clamped` | `g_gold` ← **es la propia merma** |
| **`SHOPPES.OVL 0x0f3d`** | **`add_capped(…, 0x270f=9999)`** | **`g_gold` ← ★ EL ABONO DE LA VENTA ★** |
| `SHOPPES2 0x0450` | `sub_clamped` | `g_gold` ← el cobro que faltaba (§ siguiente) |
| `SHOPPES2 0x045f` | `add_capped(…, 25, 9999)` | `g_food` — **falso positivo** de mi primera ventana |

⇒ **SÍ existe un abono de oro**: `SHOPPES.OVL 0x0f3d`, la venta, con tope 9999 (casa con los
«caps 99/9999» del ledger).

### La conclusión SOBREVIVE, con la prueba correcta

**Entre `0x0f3d` y el final de su función NO hay ninguna llamada a la merma** (verificado:
cero `call 0x19a` en `0x0f3d`-`0x1000`). Los cinco call-sites de SHOPPES.OVL están todos
lejos.

⇒ **Vender NO merma.** Pero ahora está probado por *«existe el abono y no lleva merma
detrás»*, no por *«no existe el abono»* — que era falso. Un negativo probado sólo vale si el
barrido que lo sostiene puede ver lo que niega.

## Residual del cobro: CERRADO — y era la lectura (b)

`SHOPPES2 0x0380` **sí cobra**, por el helper de puntero:

```
043f  ax = [g_unk_b118]                    ; precio
0442  cmp [g_gold], ax ; jl 0x474          ; ¿alcanza? no → rama «afford only N» (sin merma)
0448  push 0x57aa ; push [g_unk_b118]
0450  call 0x5d74  → kernel 0x3F54         ; ★ sub_clamped(&g_gold, precio)
0453  push 0x57a8 ; push 0x19 ; push 0x270f
045f  call 0x5d34  → kernel 0x3F14         ; ★ add_capped(&g_food, 25, 9999)
04fb  MERMA
```

⇒ **La función `0x0380` es COMPRAR COMIDA en la taberna**: paga el precio y recibe **25
unidades de comida**. Transacción identificada del todo.

**La lectura (a) —doble merma por compra— queda REFUTADA**: `0x0380` no llama a `0x00ac`
(censo completo de sus `call`: ninguno es `0xac`). Cada transacción merma **una sola vez**.

## Estado: la derivación está COMPLETA

Los 11 call-sites clasificados, las tres funciones ambiguas identificadas, el cobro
localizado, las ventas adjudicadas con prueba válida y la mecánica entera. **No queda nada
que suponer al implementar.**
