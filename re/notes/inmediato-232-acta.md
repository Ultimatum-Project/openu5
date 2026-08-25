# ACTA #232 — el catálogo sobre el INMEDIATO de la rama hermana: canal ESCASO, DISJUNTO, y corrige al decodificador

> Rama `re/inmediato-232`, worktree `.claude/worktrees/inmediato-232`, base **main `05e3e178`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Ejecuta la tarjeta #232, abierta por `re/notes/catalogo-191-acta.md` §2.1.

---

## 0. VEREDICTO, primero

**El canal sirve, y por una razón que #191 no tenía: es DISJUNTO del decodificador de cadenas.**

- **TASA BASE (medida ANTES de publicar cualquier acierto): 3,5 %** en la población pegajosa
  (9 de 254 inmediatos) y **1,0 %** en la estricta (1 de 97). El canal es escaso, no ruidoso.
- **2×2, y es el resultado que importa:** de los **206** inmediatos a los que el decodificador
  SÍ les saca prosa, **0 están catalogados**. De los 48 que no resuelven, 9 sí. ⇒ el catálogo
  **explica parte de lo que el decodificador deja sin explicar, y no lo contradice en ningún
  inmediato**. Cableado como control `DISJUNCIÓN`, falsable en cada corrida.
- **Los 6 aciertos de `liston-207-acta` §3.1-A reproducen al miembro**, más **2 NUEVOS**
  derivados aquí (§3): `CMDS.OVL:0x0dd6` → `&g_torch_mins`, y `SHOPPES2.OVL:0x01c4` → `&g_food`.
- ★ **Y el segundo acierto nuevo destapa un FALSO POSITIVO del OTRO instrumento** (§3.2): ese
  par está clasificado `EMITIDA` porque `text_at_lax` decodificó `0x270f` como `'Missed!\n'`,
  y `0x270f` es **el número 9999** — el TOPE de `g_food`, como prueba `SHOPPES2.OVL:0x0462
  cmp word ptr [g_food], 0x270f` en el mismo overlay. El catálogo acierta donde el
  decodificador se equivoca.

Contraste con #191, que es el motivo de que esta tarjeta existiera: allí el canal (el OFFSET
del par) tenía **precisión 5/6** y ambigüedad estructural insalvable, porque todo par de la
banda tiene instrucción en su offset por construcción. Aquí **un inmediato empujado a una
rutina no compite con «ser también una instrucción»**, y se ve en el número: 0 cruces en 206.

---

## 1. LA TASA BASE VA PRIMERO (y me ahorró publicar la población equivocada)

El encargo del lead lo puso como condición (a) y rindió dos veces:

**Primero, cazó un error mío.** Mi primera medida usó `collect_cites(sticky=False)` —la
población ESTRICTA, 65 pares— y dio **1 acierto de 97 inmediatos**. Con eso habría publicado
«el canal apenas dispara» y habría enterrado los 6 aciertos de `liston-207`, que viven en la
banda **PEGAJOSA** (173 pares, 254 inmediatos). Es la trampa que el propio docblock de
`cita_pegajosa_atribucion.construir` documenta: **dos poblaciones que se llaman igual.** Se
miden LAS DOS, etiquetadas, y el instrumento las imprime así.

| población | pares clase-2 | inmediatos (distintos) | catalogados | TASA BASE |
|---|---|---|---|---|
| ESTRICTA (la que el módulo adjudica) | 65 | 97 (83) | 1 | **1,0 %** |
| PEGAJOSA (la de `liston-207` / #232) | 173 | 254 (197) | 9 | **3,5 %** |

**Segundo, es lo que da valor a los aciertos.** Si el catálogo reconociera el 40 % de todos los
inmediatos, «está catalogado» no diría nada de ninguno. Con 3,5 % sí dice algo.

⚠ **No re-baselineo citando a `liston-207`**: su corrida hablaba de **111** clase-2 y hoy son
**173** en la pegajosa. La población se movió; lo que se coteja por MIEMBROS son sus 6 pares
(§2), no su conteo.

### 1.1 ★ El 2×2, que es el discriminador de verdad

| | catalogados | total | |
|---|---|---|---|
| inmediatos que **RESUELVEN** a prosa | **0** | 206 | el decodificador ya los explica |
| inmediatos que **NO** resuelven | **9** | 48 | 18,8 % — aquí vive el canal |

**0 de 206** es la afirmación falsable, y está cableada: si algún día un inmediato resuelve a
prosa Y está catalogado, los dos canales dejan de repartirse el trabajo y hay que releer el
aviso entero, no ampliarlo. No es una tautología: son dos consultas independientes (DATA.OVL
contra `globals.json`) sobre el mismo número, y podrían coincidir perfectamente.

---

## 2. LOS 6 CONTROLES POSITIVOS, cotejados POR MIEMBROS

Los 6 pares de la familia A de `liston-207-acta` §3.1 siguen los 6 en la población pegajosa, y
el aviso los marca a los 6:

| par | inmediato | global | estado |
|---|---|---|---|
| `SHOPPES2.OVL:0x04b2` | `0x57a8` | `g_food` | SIN-TEXTO |
| `TALK.OVL:0x064e` | `0x5888` ×2 | `g_karma` | SIN-TEXTO |
| `ULTIMA.EXE:0x4786` | `0x5887` | `g_moongate_anim` | SIN-TEXTO |
| `TALK.OVL:0x11c7` | `0x57ac` | `g_keys` | SIN-TEXTO |
| `SHOPPES.OVL:0x03c2` | `0x57ac` | `g_keys` | SIN-TEXTO |
| `SHOPPES.OVL:0x0e1d` | `0x57c0` | `g_equip_qty` | SIN-TEXTO |

El **×2** de `TALK.OVL:0x064e` no es un duplicado del instrumento: son **dos ramas hermanas
distintas** (`0x0624` y `0x063f`) que empujan el mismo `&g_karma`. Coincide con el «`0x5888`
×2» que `liston-207` anotó, por vía independiente.

### 2.1 Los NEGATIVOS con dientes: los 8 no-A, y ninguno dispara

Los 8 inmediatos de las familias B/C/D/E de `liston-207` §3 están **los 8 en la población** y
**ninguno está catalogado** — el análogo de `ENDGAME.OVL:0x08c2` en #191, ×8:

`0xb5de` · `0xb6e2` (zonas de ceros) · `0x21e6` · `0x2215` (relleno de tabla con stride) ·
números puros, `0x04b0`, = 1200 y `0x07d0`, = 2000 · cadenas REALES sin letras, `0x7ba4`,
= `'\n"'` y `0x6b9c`, = `'\n\n'`.

Los dos últimos son los que más valen: son **cadenas de verdad**, y el catálogo se calla. Y los
dos números puros son la familia que **ningún** canal alcanza (§5, límite declarado).

---

## 3. LOS 2 ACIERTOS NUEVOS, derivados del binario

### 3.1 `CMDS.OVL:0x0dd6` → `&g_torch_mins`: el binario toca la MISMA global en las dos ramas

```
CMDS.OVL:
  0db8: jae 0xdd6                      ; ← el salto citado
  0dba: mov ax, 0x58a7                 ; ← rama HERMANA: &g_torch_mins…
  0dbd: push ax
  0dbe: sub ax, ax        / push ax    ; …arg2 = 0
  0dc1: mov ax, 0xf       / push ax    ; …arg3 = 15
  0dc5: call 0x6112
  ...
  0dd6: mov byte ptr [g_torch_mins], 0xf0   ; ← EL PAR: escribe 240 directo
```

Forma **idéntica** a la familia A (`SHOPPES.OVL:0x0394-0x03a0`: `&g_keys`, 3, `0x63`): dirección
de global + dos numéricos a una rutina de 3 argumentos. Y el par corrobora por sí solo: la rama
del `jae` escribe `0xf0` = 240 en la misma global que la hermana pasa por referencia. Coincide
con el ledger (`g_torch_mins`: «Ignite fija 240 fuera de mazmorra»). Cita del port:
`game/src/core/world/survival.ts:116`.

### 3.2 ★★ `SHOPPES2.OVL:0x01c4` → `&g_food`, y el `EMITIDA` de su par es un FALSO POSITIVO del decodificador

```
SHOPPES2.OVL:
  014f: je 0x1c4                       ; ← el salto citado
  0151: mov ax, 0x57a8   / push ax     ; ← &g_food          (CATALOGADO)
  0155: push word ptr [0xbd1a]         ;   la cantidad (contador de ronda de taberna, #192)
  0159: mov ax, 0x270f   / push ax     ; ← 0x270f           (el decodificador dice 'Missed!\n')
  015d: call 0x5d34                    ;   add_capped(&dst, n, cap)
```

`text_at_lax(0x270f)` devuelve `'Missed!\n'`, y por eso el partidor de cadenas pone este par en
**`EMITIDA`** («el port modela esta rama»). **Es una coincidencia**, y el binario lo dice:

```
SHOPPES2.OVL:0x0462:  cmp word ptr [g_food], 0x270f
```

`0x270f` = **9999** decimal, y el propio overlay lo usa para **comparar contra `g_food`** ⇒ es
el TOPE de la comida, un numérico, no un puntero de texto. Corroboración adicional: `g_food`
es `size 2` en el ledger (u16 LE, tope 9999 exacto); la forma del call-site es la de
`add_byte_capped(&dst, n, cap)` de la familia A con el cap adaptado al ancho del campo; y las
18 ocurrencias de `0x270f` en el corpus incluyen varias `cmp word ptr [...], 0x270f`, que es
forma de clamp y no de impresión. Y «Missed!» es vocabulario de COMBATE, no de tienda.

⇒ **Los dos canales no son dos opiniones sobre lo mismo: el catálogo CORRIGE al decodificador.**
El aviso acierta (`&g_food`) exactamente donde el decodificador falla (`0x270f`).

⚠ **Lo que NO hago aquí:** no reclasifico el par. `EMITIDA` sigue siendo lo que el partidor de
cadenas dice, porque cambiar su estado es tocar la adjudicación, y esta tarjeta es un AVISO.
Queda como **cabo con dueño** (§6.1): el estado de `SHOPPES2.OVL:0x01c4` está sostenido por una
decodificación falsa, y la cola que use ese bucket debe saberlo.

---

## 4. LO CABLEADO — `re/tools/cita_hermana_emitida.py`, extendido

Cero escáner nuevo y **cero segundo lector del ledger**: el canal se importa de #191
(`from cita_pegajosa_atribucion import catalogo_aviso, controles_catalogo`), así que los 5
controles de allí (2 positivos, 2 negativos medidos y el ADVERSO de `g_hull`) corren también
aquí y una deriva del catálogo se ve en los dos sitios a la vez.

- **`censo_inmediatos()`** — UNA FILA POR INMEDIATO (la unidad de este canal), con el par, su
  `estado`, si el decodificador resuelve, y si el catálogo reconoce.
- **`control_disjuncion()`** — la afirmación falsable: 0 catalogados entre los que resuelven.
- **`control_particion_estado()`** — PARTICIÓN IDÉNTICA: el `estado` es función de las cadenas
  del par, no del catálogo. Se comprueba por el INVARIANTE (todas las filas del mismo par
  traen el mismo estado) en vez de un baseline que se pudre, **con su control de SENSIBILIDAD**
  (gemelo sintético con el estado cambiado ⇒ el comparador debe SUSPENDER).
- **`imprimir_aviso_inmediato()`** — el bloque impreso: tasa base PRIMERO, las dos poblaciones,
  el 2×2, los aciertos uno a uno, qué significa un acierto y qué no, y el límite.

**La población por defecto del módulo NO se ha tocado** (sigue `sticky=False`). La pegajosa se
mide y se etiqueta aparte; moverla sería mover la población del partidor de cadenas entero, y
eso es otra tarjeta.

---

## 4.bis ★★ El cotejo LITERAL del bucket SIN-TEXTO: 13 = 13 con los 13 MIEMBROS DISTINTOS

El encargo pedía, en su punto (b), que «los 13 clase-2 SIN-TEXTO sigan siendo los mismos 13».
Lo cumplí primero en forma GENERAL (el invariante de §4, que cubre todos los pares y las dos
unidades) y **no en la literal**. Cerrado ahora, y el resultado es el mejor argumento a favor de
haberlo pedido así:

| población | bucket SIN-TEXTO hoy | de los 13 de `liston-207`: siguen | cambiaron de bucket | FUERA de la población | altas |
|---|---|---|---|---|---|
| PEGAJOSA | **26** pares | **12** | **0** | **1** (`COMBAT.OVL:0x052e`) | 14 |
| ESTRICTA | **13** pares | **0** | 0 | **13** | 13 |

★ **La fila de abajo es la trampa.** En la población ESTRICTA el bucket SIN-TEXTO tiene
**exactamente 13 pares**, el mismo número que publicó `liston-207` — y **no comparte NI UN
miembro**: los 13 suyos están fuera de esa población (viven en la pegajosa) y los 13 de hoy son
otros. Un cotejo por CONTEO habría dado un verde perfecto y habría estado completamente
equivocado. Es la familia `prediccion-numerica-cuadra-por-casualidad` en su forma más pura, y la
tercera vez que aparece en esta cola (`backedge-174-acta` §1 la documentó con «12 = 12 con dos
miembros distintos»).

**Lo que sí se sostiene, por miembros:** en la población de la que habla la tarjeta —la
PEGAJOSA— **12 de los 13 siguen en SIN-TEXTO y ninguno ha cambiado de bucket**. El aviso no ha
movido nada; lo que se movió fue la población, entre la corrida de `liston-207` (111 clase-2) y
main de hoy (173).

⚠ **La baja, declarada:** `COMBAT.OVL:0x052e` **ya no está en el pool clase-2** de ninguna de las
dos políticas. Era el par de la familia D, la de los números puros, `0x04b0`, = 1200 y `0x07d0`, = 2000. Su
salida es anterior a este carril —no la causa el aviso, que no filtra— pero **quien cite «los 13»
a partir de hoy está citando 12 vivos y uno ausente**. No lo persigo aquí: es materia de quien
sostenga esa cola.

## 5. LÍMITE, declarado

Separar «el inmediato es una global» de «el inmediato es un número» **no cierra por qué el
decodificador no resolvió** — sólo dice que no HABÍA texto que resolver. La familia de los
números puros —familia D de `liston-207`, `0x04b0`, = 1200 y `0x07d0`, = 2000— sigue **sin marca
posible y sin entrada de catálogo**: es la misma frontera que la familia VALOR-DE-TABLA de
#191 §1, y se cierra por CONSUMIDOR o no se cierra.

---

## 6. Cabos, con dueño

1. ★ **`SHOPPES2.OVL:0x01c4` está en `EMITIDA` por una decodificación falsa** (§3.2). No es un
   defecto del port: es el estado del partidor sostenido por `text_at_lax(0x270f)`. Quien
   trabaje ese bucket lo necesita. **Tarjeta propuesta.**
2. **`text_at_lax` decodifica números de 4 dígitos como cadenas**: `0x270f` es una instancia
   medida, no un censo. Cuántos de los 206 «resuelven» son números con suerte está **SIN
   MEDIR** — y es la cota superior del partidor de cadenas entero. Materia de la misma tarjeta.
3. **`0xbd1a`** aparece aquí como la cantidad que se suma a `g_food`; #192 lo derivó como
   productor de la ronda de taberna. Coherente, no adjudicado aquí.

---

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

Ver el mensaje del commit. Desde la RAÍZ del worktree, con los 28 `.asm` y las 11 entradas de
`original/` symlinkeadas una a una.

---

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CMDS.OVL`, `SHOPPES.OVL`,
`SHOPPES2.OVL`, `TALK.OVL`, `ULTIMA.EXE`, `COMBAT.OVL`, `ENDGAME.OVL`, `SJOG.OVL`.
