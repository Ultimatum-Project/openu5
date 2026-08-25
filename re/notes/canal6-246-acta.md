# Acta #246 — el SEXTO canal (`mov word ptr [mem], DIR`), cruzado contra el ledger

Carril `re/particion-245b` (worktree `.claude/worktrees/particion-245b`), re-basado sobre
`main` @`1071ebbc`. Tarjeta abierta por #244 (`re/notes/lectura-244-acta.md` §5.1).
Encargo del lead: cruzar los 476 contra el ledger ENTERO con partición que PARTICIONE,
controles por clase, y re-medir qué globales tienen accesos invisibles por esta vía.

---

## 0. CONTROL DE ACUERDO con #244 — corrido ANTES de nada, y EXACTO

| magnitud | #244 §5.1 | **re-medido aquí** | |
|---|---:|---:|---|
| bruto del canal | 476 | **476** | ✓ |
| con inmediato ≥ 0x100 | 294 | **294** | ✓ |
| POSITIVO 0x5C5A (ventana 256) | 66 | **66** | ✓ |
| 0xAD14 (ventana 352) | 12 | **12** | ✓ |
| 0xAB02 (ventana 352) | 0 | **0** | ✓ |
| NEGATIVO 0x270F | 0 | **0** | ✓ |
| NEGATIVO 0x0100 (ventana 352) | 17 | **17** | ✓ |

Siete de siete. La población de partida es la misma, así que todo lo que sigue se compara
con #244 sin asterisco.

### 0.1 ⚠ EL CORPUS SON 28 FICHEROS, NO 24 — y eso hace ruido con mis propias cifras

Reproducir el 476 **exige leer los 28 `.asm`**, que incluyen los cuatro `.DRV`.
`binfiles.FILES` tiene 25 entradas (24 de código + DATA.OVL) y **no lista ningún `.DRV`**;
por eso `idx_particion.scan()` —el instrumento que yo mismo entregué en #245— barre
**24 ficheros**, no 28.

Las dos elecciones son defendibles y responden a preguntas distintas:
- para un censo de **globales del kernel**, excluir los `.DRV` es correcto y ya está
  argumentado en `globals_negdisp` («los `.DRV` tienen su PROPIO segmento de datos: una
  dirección DS suya no es un global del kernel»);
- para medir **la población de un canal**, el corpus es todo el código, y ahí van los 28.

⇒ Lo que NO es defendible es no decirlo. **Las cifras de #245 son sobre 24 ficheros** y
las de esta acta sobre 28; quien las compare tiene que saberlo. Es la familia de #208
(extractores ciegos a `.DRV`), aquí sin defecto pero con la asimetría declarada.

---

## 1. PRE-REGISTRO — escrito ANTES de particionar

Lo que sigue se escribió con el bruto ya reproducido y **con la forma del destino ya
mirada** (361 `[bp − N]`, 17 `[bp + N]`, 87 con destino GLOBAL, 11 por registro
indirecto) — porque de ahí salen los buckets. Lo que **no** estaba medido cuando escribí
esto es nada de lo que se predice abajo.

### 1.1 Los buckets que voy a declarar

En orden de aplicación, el primero que casa gana:

1. `MAGNITUD_FUERA_DS` — el inmediato cae fuera de la ventana DS `[0x1000, 0xF000]`
   (umbrales heredados de `globals_negdisp`, no inventados aquí). Aquí caen los 182 de
   `< 0x100` y los centinelas `0xFFFF`.
2. `SELECTOR_DE_SEGMENTO` — el inmediato acaba en `ds`/`es`/`ss`. Es la clase que **nombró
   #244** con su ejemplar (`HER.DRV` 0xB000 ×19), allí para el QUINTO canal.
3. `DESTINO_GLOBAL` — el destino no es un marco de pila sino una **global** (impresa como
   `[g_nombre]` si el ledger la conoce, como `[0xNNNN]` si no). Mecanismo DISTINTO: el
   puntero se aparca en una global, no en un local. **No es basura**; es población que el
   modelo de desreferencia de esta tarjeta no cubre.
4. `DESTINO_REG_INDIRECTO` — `[bx]`, `[di]`, `[si + N]`: se escribe a través de un puntero
   ya cargado. También mecanismo distinto.
5. `CANDIDATO` — inmediato dentro de la ventana DS **y** destino en el marco de pila. Es
   el único bucket que puede contener el mecanismo que describe la tarjeta.

### 1.2 Las predicciones, con su condición de fracaso

| # | predicción | fracasa si |
|---|---|---|
| **P1** | `MAGNITUD_FUERA_DS` es el bucket MÁS GRANDE, ≥ 50 % de 476 | < 40 % |
| **P2** | de los `CANDIDATO`, los que caen DENTRO de una global del ledger son MINORÍA: 20–45 % | fuera de esa banda |
| **P3** | el positivo 0x5C5A conserva ≥ 50 de sus 66 tras particionar | < 40 |
| **P4** | `SELECTOR_DE_SEGMENTO` en ESTE canal es ~0 (0–3): los 19 de #244 eran `mov reg, imm`, no a memoria | > 10 |
| **P5** | **NO encontraré un segundo negativo limpio**: para tener dientes hace falta un valor (i) derivado como MAGNITUD en otra tarjeta, (ii) dentro de `[0x1000, 0xF000]` y (iii) que dé 0 — y las magnitudes derivadas de U5 son casi todas pequeñas | encuentro uno que cumpla las tres |

**P5 es la que el lead pidió explícitamente**, y la escribo como predicción NEGATIVA a
propósito: si acierto, la conclusión es «la clase magnitudes no tiene segundo negativo
limpio» y hay que decirlo; si fallo, mejor, el canal gana un control.

### 1.3 La reserva que va IMPRESA junto a cada cifra

Heredada de #242 §3 y confirmada por #244: **sin seguimiento de flujo real esto produce
CANDIDATOS, no accesos.** Un local puede reasignarse entre la escritura y el uso. Y la
regla de la familia: **van SEIS canales, y la lista de canales es ella misma una cota
superior** — «canal X vacío» significa «este defecto no aplica», nunca «censo completo».

---

## 2. RESULTADO — la partición, y las predicciones adjudicadas

| bucket | n | % |
|---|---:|---:|
| `MAGNITUD_FUERA_DS` | **289** | 60,7 % |
| `SELECTOR_DE_SEGMENTO` | **0** | 0,0 % |
| `DESTINO_GLOBAL` | **15** | 3,2 % |
| `DESTINO_REG_INDIRECTO` | **0** | 0,0 % |
| `CANDIDATO` | **172** | 36,1 % |
| **SUMA** | **476** | = el bruto |

De los 172 candidatos, **130 caen dentro de una global del ledger** y **49 de ésos tienen
la carga del local en un registro puntero dentro de la ventana de 12 instrucciones**.

### 2.1 Las cinco predicciones

| # | predicción | medido | |
|---|---|---|---|
| P1 | `MAGNITUD_FUERA_DS` el mayor, ≥ 50 % | **60,7 %**, y es el mayor | ✓ |
| P2 | de los CANDIDATO, en-ledger es MINORÍA (20–45 %) | **130/172 = 75,6 %** | ✗ **FALLA** |
| P3 | 0x5C5A conserva ≥ 50 de 66 | **66** (todos) | ✓ |
| P4 | `SELECTOR_DE_SEGMENTO` 0–3 | **0** | ✓ |
| P5 | NO hay segundo negativo limpio | **no lo hay** (§3) | ✓ |

**P2 falla, y falla por un error de razonamiento que conviene nombrar: predije sobre el
DENOMINADOR equivocado.** Tenía en la cabeza «de los 294 con inmediato ≥ 0x100», pero
escribí «de los CANDIDATO» — y `CANDIDATO` ya exige inmediato en ventana DS **y** destino
en marco de pila. Condicionado a pasar esos dos filtros, ser una global del catálogo no es
la excepción sino **la norma**. Una predicción sobre una población filtrada no se puede
estimar con la intuición de la población bruta.

## 3. ★ EL SEGUNDO NEGATIVO: buscado en serio, y NO EXISTE

El encargo pedía «un segundo negativo que sí discrimine, o declarar que la clase no lo
tiene». Criterio, escrito antes de buscar: para tener dientes un negativo necesita las
tres cosas — (i) estar **derivado como magnitud** en otra tarjeta, (ii) caer **dentro** de
`[0x1000, 0xF000]` (si no, el umbral lo excluye solo), y (iii) dar **0**.

**Barrido de todos los inmediatos del corpus en la ventana DS** que no están en el ledger
y que el canal no ve. Los cuatro mejores candidatos por aspecto de magnitud redonda,
**leídos uno a uno, se caen todos**:

| candidato | dec | por qué NO sirve |
|---|---:|---|
| `0x61A8` | 25000 | **es una DIRECCIÓN**: cae dentro de `g_npc_pathbuf`, y el idioma es `cmp si, 0x61a8` / `mov si, 0x61a8` — cota de bucle y reinicio de puntero |
| `0x1F40` | 8000 | **offset de vídeo**: `mov word ptr es:[di + 0x1f40], dx` en `EGA.DRV`, con `cmp di` y `add si` alrededor |
| `0x3E80` | 16000 | ídem, y es 2×0x1F40 — el segundo plano EGA. Además el canal SÍ lo ve una vez (`CAST.OVL:0x1faa`) |
| `0x2710` / `0x4E20` | 10000 / 20000 | mezclados: sobre todo `mov ax, …` (AX no direcciona), pero también `add di, 0x2710` y `call 0x4e20` |

Y el barrido del **corpus documental** (notas + ledger) buscando magnitudes ≥ 0x1000 con
prosa de tope/límite devuelve **una sola**: `0x270F` = 9999, con 34 menciones y derivada en
#238. Todo lo demás que sale con esa frecuencia en esa banda es una **dirección**
(0x5C5A, 0x57C0, 0xAD14, 0xA9FB…) que aparece porque la prosa dice «contador» al lado.

⇒ **VEREDICTO: la clase magnitudes tiene UN negativo con dientes, `0x270F`, y no puede
tener más con el corpus de derivaciones de hoy.** Y la razón no es que yo no buscara: es
estructural. **En un binario de 16 bits en modo real, `[0x1000, 0xF000]` es exactamente
donde viven las direcciones**; una magnitud que llegue ahí tiene que valer ≥ 4096, y las
cantidades de U5 son bytes o topes de 9999. Un número redondo en esa banda es, casi
siempre, un offset de vídeo, una cota de búfer o un destino de código.

### 3.1 ⚠ Y el 0x0100 NO se ha arreglado — se excluye por CONSTRUCCIÓN

Con la partición, el negativo que #244 declaró fallido pasa de «17 y no discrimina» a
**0 candidatos**. Sería fácil venderlo como que la partición reparó el control. **No lo
repara.** Su ventana ENTERA —de `0x0100` a `0x025F`— está **por debajo de `DS_LO`**, así
que la exclusión es **tautológica**: no discrimina, sólo cae del otro lado del umbral. Queda
clavado en un test (`test_canal6_el_0x0100_se_excluye_POR_CONSTRUCCION_no_por_discriminar`)
para que nadie lo cuente como victoria más adelante.

## 4. ★★ EL CRUCE CONTRA EL LEDGER, y el titular falso que estuve a punto de publicar

Nueve globales del catálogo tienen candidatos por este canal. La pregunta del encargo era
cuáles tienen accesos **invisibles** por esta vía — y ahí casi meto la pata:

| global | addr | c1 hex | c3 neg | c4 idx | **c6 imm** |
|---|---|---:|---:|---:|---:|
| `g_party_records` | 0x55A8 | 65 | 0 | 134 | 26 |
| `g_equip_qty` | 0x57C0 | 5 | 0 | 16 | 1 |
| `g_char_anim_states` | 0x5C5A | 142 | 0 | 172 | 66 |
| `g_npc_rt` | 0x5F5E | 0 | 0 | 34 | 5 |
| `g_npc_pathbuf` | 0x615E | 1 | 0 | 6 | 1 |
| `g_npc_path` | 0x655E | 0 | 0 | 16 | 2 |
| `g_npc_stuck` | 0x65C2 | 0 | 0 | 6 | 1 |
| `g_cbt_room_record` | 0xAD14 | 24 | **27** | 0 | 12 |
| `g_combat_actor_records` | 0xBA14 | 0 | **160** | 0 | 16 |

**La primera versión de esta tabla no tenía la columna c3.** Sin ella,
`g_combat_actor_records` salía con 16 candidatos y CERO por los demás canales, o sea el
titular «★ una global visible SÓLO por el sexto canal». **Es falso**: 0xBA14 tiene **160
accesos por desplazamiento negativo**, y de hecho es el **control positivo de libro de
`globals_negdisp`** — su docstring lo explica con `move_combat_actor` (SJOG 0x1c56) y los
campos `[bx − 0x45ea]`.

Lo cazó **reconocer la global**, no el instrumento. Por eso el careo está ahora **cableado**
en `cobertura_por_canales()` con los cuatro canales, y con un test que lo guarda.

⇒ **VEREDICTO: NINGUNA global del catálogo se ve sólo por el sexto canal.** Las nueve están
ya cubiertas por al menos uno de los canales 1/3/4. Lo que el sexto aporta es **población
adicional sobre globales ya visibles**, no un punto ciego nuevo a nivel de «esta global no
la ve nadie». Es un resultado NEGATIVO y es el que hay.

**La lección, que es la de #242 girada 90°:** así como «canal X vacío» no es «censo
completo», **«no se ve por los canales que yo miré» no es «invisible»**. Un censo de
invisibilidad es tan bueno como la LISTA de canales contra la que se mide, y esa lista es
ella misma una cota superior.

## 5. Mis dos errores de esta tanda, con su re-medición

1. **`_MARCO` sólo aceptaba desplazamiento en HEX.** capstone imprime `bp - 4` en decimal
   cuando es pequeño y `bp - 0x108` en hex cuando es grande. Con la regex estrecha, **57
   marcos de pila legítimos** caían en `DESTINO_REG_INDIRECTO` y con ellos se iban
   candidatos buenos: los positivos daban 51/66 y 3/12 en vez de 66/66 y 12/12. Lo cazó
   cruzar el conteo del instrumento contra el desglose de destinos que había hecho a mano
   antes. Re-medido tras el arreglo: **REG_INDIRECTO = 0** y los dos positivos íntegros.
2. **El careo de invisibilidad con dos canales en vez de cuatro** (§4).

Los dos van en la misma dirección que el error de #245: **el instrumento equivocado no
avisa, produce una cifra con buena pinta**. Y las dos veces lo que lo destapó fue una
cifra previa medida por otra vía — el desglose a mano, y el conocer 0xBA14.

## 6. Lo que este carril NO ha hecho

- **No he leído los 172 candidatos.** #244 leyó dos ejemplares y los dos eran reales; los
  otros 170 son **candidatos**, no accesos. Sin seguimiento de flujo no pueden serlo.
- **No he tocado el ledger**, ni `game/src`, ni `main.ts`. Nada de e2e.
- **No he cambiado ninguna cifra publicada** de #68, #219, #242 ni #244.
- **No he cableado el canal a ningún censo.** Igual que #240 y #245: el módulo HABILITA.

## 7. Cabos

1. **Los 15 de `DESTINO_GLOBAL`**: el puntero se aparca en una global, no en un marco. Es
   un mecanismo que este canal ve pero cuyo modelo de desreferencia no cubre. Sin leer.
2. **Los 123 candidatos sin uso cercano** (172 − 49): o la ventana de 12 se queda corta, o
   el puntero se guarda para mucho después — que es justo lo que hacen los dos ejemplares
   que #244 leyó. Misma pregunta abierta que dejó #242 con sus 60.
3. **Los 42 candidatos con inmediato en ventana DS y SIN entrada en el ledger** (172 − 130):
   o son globales sin fichar, o son basura de una clase que aún no tiene nombre.
