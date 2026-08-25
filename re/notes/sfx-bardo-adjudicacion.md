# Modo 4 del ambiente: es el BARDO, no la estantería — y el `[0x6a34]` de la discordia son DOS cosas que no se pisan

Carril `re/sfx-bardo` (tarea #2) · 2026-08-05 · base `206155f7`.
Adjudica la contradicción que `camp-bard-anim.md §8.6` dejó fichada y sin resolver.
**Cerrada por ASM + datos de `DATA.OVL`. No hizo falta testigo DOSBox** (ver §5).

---

## 0. Veredicto

La tarjeta decía «una de las dos está mal». **No es eso.** Eran **dos preguntas distintas
metidas en una**, y el reparto no es el que sugiere el enunciado:

| | `core/sfx.ts:287-288` | `camp-bard-anim.md §4b` + `speaker.ts` |
|---|---|---|
| **quién es `0x5c–0x5f`** | ❌ **MAL** — «Codex/estantería» | ✅ **BIEN** — BardPlaying |
| **qué es `[0x6a34]`** | ✅ **BIEN** — contador de fase 0..7 | ✅ **BIEN** — base de la tabla de freqs |

La segunda fila **no es un empate ni una ambigüedad**: las dos lecturas son literalmente
ciertas del mismo byte y **no colisionan**, por una razón medible (§3). La única
corrección real es la primera fila, y viaja en este commit.

## 1. Los tiles — el gate lee la capa de SPRITES, así que el banco es el ALTO

`ULTIMA.EXE`, dentro de `ambient_sfx_tick` (`0x4102`), la rama del modo 4:

```
41f8: 8b5ee6            mov bx, word ptr [bp - 0x1a]   ; ← puntero A
41fb: 803f00            cmp byte ptr [bx], 0           ;   exige terreno == 0
41fe: 7510              jne 0x4210
4200: 8b5ee4            mov bx, word ptr [bp - 0x1c]   ; ← puntero B
4203: 8a07              mov al, byte ptr [bx]          ;   EL BYTE QUE SE COMPARA
4205: 24fc              and al, 0xfc
4207: 3c5c              cmp al, 0x5c
4209: 7505              jne 0x4210
420b: bf0400            mov di, 4                      ;   MODO 4
```

**Qué capa es cada puntero lo dicen los STRIDES**, al final del mismo bucle:

```
421d: 8346e620          add word ptr [bp - 0x1a], 0x20   ; stride 32 → capa de TERRENO [0xab02]
4221: 8346e410          add word ptr [bp - 0x1c], 0x10   ; stride 16 → capa de SPRITES [0xac64]
```

Los dos stride son los que `invisibilidad-testigo.md §1` midió **en vivo** en la RAM del
juego: terreno stride 32 en `0xAB02`, sprites stride 16 en `0xAC64`, contiguas
(`0xAC64 − 0xAB02 = 0x162 = 354 = 11 × 32 + 2`).

⇒ El byte comparado con `0x5c` sale de la **capa de sprites**, y el `cmp byte [bx],0`
sobre la de terreno es justamente la marca «esta celda la reclamó un actor» (la estampa
pone el terreno a 0, `0x5542`). Los sprites se blitean con `add ah,1` (`0x56e1`) = **banco
alto**. Por tanto:

| banco | `0x5c` | `0x5d` | `0x5e` | `0x5f` |
|---|---|---|---|---|
| TERRENO (0) | BookcaseLeft | BookcaseRight | CodexAngelLeft | CodexAngelRight |
| **SPRITES (1) — el que ve el gate** | **BardPlaying1** | **BardPlaying2** | **BardPlaying3** | **BardPlaying4** |

**Los dos nombres existen.** Por eso el error era invisible: `sfx.ts` no se inventó nada,
buscó `0x5c` en el catálogo equivocado y **obtuvo una respuesta plausible y concreta**.
Es la segunda aparición del mismo género en dos días — la primera fue el `0x1d` que
«era un puente» de la ficha #42, y también ahí el banco alto era el correcto.

*(Nota de alcance: `sfx.ts` acertaba en la CAPA — decía «sobre capa overlay … necesita el
buffer overlay 0xac64» — y aun así nombró los tiles por el banco bajo. Tener la capa bien
y el banco mal en la misma frase es exactamente lo que hace que nadie lo relea.)*

## 2. Lo que NO cambia: sigue sin portarse, y por la misma razón

La decisión de `sfx.ts` («la clase 4 NO se porta: necesita el buffer overlay y una tabla de
datos →AV») **se sostiene entera**. Lo único que estaba mal era el SUJETO. Sí cambia su
importancia práctica: si el modo 4 es el bardo, deja de ser un adorno de biblioteca y pasa a
ser la precondición de la ficha del **bardo de taberna** — el gate `0x4207` es por TILE, no
por contexto de acampada, así que un bardo a la vista lo dispara igual.

## 3. `[0x6a34]` — por qué las dos lecturas son ciertas a la vez

El bloque de la melodía, íntegro (`0x42d2`–`0x4332`):

```
42d2: 8a1e086a          mov bl, byte ptr [0x6a08]      ; cursor de melodía
42d6: 2aff              sub bh, bh                     ; bh = 0
42d8: 8a87486a          mov al, byte ptr [bx + 0x6a48] ; nota = melodía[cursor]
42df: 3ac7              cmp al, bh                     ; ¿nota == 0?
42e1: 741b              je 0x42fe                      ; ← SILENCIO: se salta el sweep
42e3: 8ad8              mov bl, al
42e5: d1e3              shl bx, 1                      ; bx = nota*2
42e7: ffb7346a          push word ptr [bx + 0x6a34]    ; freq = tabla[nota]
42fb: e894de            call 0x2192                    ; sweep
42fe: fe06086a          inc byte ptr [0x6a08]          ; cursor++
4302/4309: cmp 0x35 / =0                               ; envuelve en 53 notas
430e: 803e845800        cmp byte ptr [0x5884], 0       ; ¿campanadas pendientes?
4315: 803e346a00        cmp byte ptr [0x6a34], 0
431c: 803e346a04        cmp byte ptr [0x6a34], 4
4323: fe0e8458          dec byte ptr [0x5884]          ; consume campanada en fase 0 y 4
4327: fe06346a          inc byte ptr [0x6a34]          ; ← CONTADOR
432b/4332: cmp ,7 / =0                                 ; ← 0..7
```

**El candado está en `42e1`.** La nota 0 salta el sweep, así que cuando se llega a `42e7`
siempre es `nota ≥ 1` ⇒ `bx ≥ 2` ⇒ se lee de **`0x6a36` en adelante**. Los bytes `0x6a34`
y `0x6a35` **no se leen jamás como frecuencia**.

Y el dato lo confirma. Leído de `DATA.OVL` (`fileoff = DS + 0x10`, o sea `0x6a44`):

| slot | DS | word | divisor PIT → Hz |
|---:|---|---|---|
| **0** | **0x6a34** | **0x0000** | **— (nunca indexado)** |
| 1 | 0x6a36 | 0x0da9 | 341 Hz |
| 2 | 0x6a38 | 0x0f56 | 303 Hz |
| 3 | 0x6a3a | 0x1136 | 270 Hz |
| 4 | 0x6a3c | 0x123c | 255 Hz |
| 5 | 0x6a3e | 0x1478 | 227 Hz |
| 6 | 0x6a40 | 0x16fa | 202 Hz |
| 7 | 0x6a42 | 0x1857 | 191 Hz |
| 8 | 0x6a44 | 0x19ca | 180 Hz |
| 9 | 0x6a46 | 0x1b53 | 170 Hz |

Nueve divisores que dan una escala descendente limpia, y un slot 0 a cero. A partir de
`0x6a48` ya empieza la melodía (`[bx + 0x6a48]`, 53 notas).

⇒ **`0x6a34` es el hueco «silencio» de la tabla, cuyo byte bajo el juego reutiliza como
contador de fase del ambiente.** Empaquetado deliberado, no colisión. Las dos notas
describían usos distintos del mismo byte y **ninguna se equivocaba**; lo único flojo era
llamar «la tabla de freqs» a la dirección base, cuando la primera entrada útil es `0x6a36`.

> ⚠ **Y por eso esta fila importa más que la otra:** quien hubiera «resuelto» la
> contradicción declarando ganadora a una de las dos habría borrado una verdad. El
> enunciado «una de las dos está mal» era, él mismo, la trampa.

## 4. Corroboraciones que ya estaban escritas y no se habían cruzado

- `camp-scene-kernel.md:192` ya decía «`si al==0` → SILENCIO» y `:196` «TABLA DE FREQ =
  DS:0x6a34 = DATA.OVL fo 0x6a44». Tenía las dos mitades del §3 **en la misma nota** y a
  cuatro líneas de distancia; lo que faltaba era juntarlas.
- La fase `0..7` gatea `dec [0x5884]` sólo en **0 y 4** ⇒ dos campanadas por vuelta de 8:
  eso es el «tic/tac» que `sfx.ts` describe, y cuadra con su propia documentación de
  `[0x5884]` como contador de campanadas de la hora.
- Las tres clases 1–3 (reloj `0xfa`, cascada `0xd4`, fuente `0xd8`) salen de `call 0x4402`
  (`0x41c1`) = tile CRUDO del mapa, banco 0. `ambientTileClass` del port ya las restringe a
  `0..0xff`. **Las clases 1–3 son terreno y la 4 es sprite**: la asimetría es real y ahora
  está dicha.

## 5. Por qué NO hay testigo DOSBox

El encargo lo pedía «si el ASM no basta». Bastó: la adjudicación descansa en dos strides
literales (`0x20` vs `0x10`), un salto condicional (`42e1`) y once words leídos de
`DATA.OVL`. Un testigo en vivo no añadiría poder discriminante sobre ninguno de los tres, y
montar una taberna con bardo a la vista cuesta bastante más que leerlos.
**Queda declarado como no hecho, no como innecesario para siempre**: si alguien porta el
modo 4, el testigo que valdrá la pena es el de la MELODÍA (53 notas, cursor `[0x6a08]`), que
es lo que este acta no ha oído sonar.

## 6. Qué toca este commit

- `game/src/core/sfx.ts` — corregido el sujeto de la clase 4 (bardo, banco alto, con las
  citas de capa y stride) y anotado el doble uso de `[0x6a34]` para que no se «arregle»
  en el futuro. **Sólo comentarios: cero cambio de comportamiento.**
- `re/notes/camp-bard-anim.md §8.6` — la contradicción pasa a ADJUDICADA, con fecha y
  reparto.
- Esta acta.

**No toca `speaker.ts`**: su `freq = tablaFreq[al] ([0x6a34])` es correcto por lo del §3
(indexa por `al`, y `al ≥ 1`).
