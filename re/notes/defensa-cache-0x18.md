# La defensa de un miembro del party: `ficha+0x18` — quién la escribe (NADIE) y las DOS respuestas del binario

> **Veredicto: en el binario publicado, cambiar de equipo NO cambia la defensa de un
> personaje por NINGUNA de las dos vías.** La vía cacheada (`ficha+0x18`) es una
> **constante 7** en los dos ficheros de partida que se distribuyen, y **ningún `.asm`
> del corpus la escribe**. La vía que sí recalcularía desde el equipo
> (`member_armor_rating` `ULTIMA.EXE:0x6da8`) tiene sus seis sumas **inalcanzables**.
> El clon no calca ninguna de las dos: suma el equipo, que es lo que el original
> *pretendía* hacer.

Cierra la pregunta que quedó abierta al leer `0x6da8` (dos carriles la declararon como
el hueco que impedía escribir «la armadura no hace nada en el original»).

---

## 1. Qué se preguntaba, y por qué no bastaba con leer `0x6da8`

`re/notes/combat.md:67` documenta `0x55C0 + slot*0x20` (= ficha `+0x18`) como
«**defensa cacheada** del PJ», y dice que «kernel `0x6DA8` **la recalcula**». Si eso
fuera cierto, la armadura sí influiría —por la vía cacheada— aunque `0x6da8` esté roto.
Toda la conclusión dependía de **quién escribe ese byte**.

## 2. Censo de ESCRITORES — cero, y con control que demuestra que no es ceguera

Censadas las cuatro formas de direccionamiento con desplazamiento sobre los **28
`.asm`**, con la base del roster `0x55a8`, paso `0x20` y **16 fichas**
(`0x55a8..0x57a7`; el `0x57a8` siguiente es `g_food`, medido en `turn_housekeeping`):

| forma | patrón | escrituras | lecturas |
|---|---|---|---|
| **A/D** | desplazamiento = `0x55c0 + i*0x20` (las 16 direcciones absolutas del campo) | **0** | 1 |
| **B** | desplazamiento = `0x55a8` (el `+0x18` viaja dentro del registro índice) | **0** | 9 |
| **C** | desplazamiento = `0x18` sobre un puntero a ficha (`[si+0x18]`, `[bx+0x18]`…) | **0** | 1 |

**TOTAL: 0 escrituras · 11 lecturas.** Las 11 lecturas son el **control**: el mismo
predicado que devuelve cero escrituras sí ve accesos a esas direcciones, así que el cero
no es ceguera del instrumento. Excluidos los `[bp ± N]` (locales de pila), que en la
primera pasada contaminaron el censo con 39 falsos positivos.

Y por un segundo camino: **`0x55c0` aparece UNA sola vez en los 28 `.asm`**, y es la
lectura de `COMBAT.OVL:0x136d`.

🔴 **RESIDUO DECLARADO (forma E)**: una escritura a través de un registro que ya
contenga la dirección exacta, **sin desplazamiento** (`mov [si], al` tras un
`add si, 0x18`), no la ve este censo. No la cierro por lectura de las ~56 rutinas que
materializan un puntero al roster; la cierro por la vía del DATO (§3), que es
independiente y más barata.

## 3. La medición que cierra el residuo: el byte es una CONSTANTE 7

Leídos los dos ficheros de partida que distribuye el juego, con la disposición del
registro **acreditada por el propio campo de nombre** (ver §3.1):

| fichero | `+0x18` de las 16 fichas | suma del equipo (`+0x19..+0x1e` por `DS:0x1634`, saltando `0xFF`) |
|---|---|---|
| `INIT.GAM` | **7 en las 15** | 1 … 12 (rango) |
| `SAVED.GAM` | **7 en las 16** | 1 … 12 (rango) |

**El campo vale 7 para todos los personajes, en los dos ficheros.** No es la suma del
equipo: las sumas van de 1 (Mariah, Jaana, Katrina) a 12 (Geoffrey). Las tres
coincidencias (`Dupre`, `Saduj`, `Elwood`, suma 7) son casualidad aritmética, no señal.

⇒ Un campo que vale lo mismo para los 16 personajes con equipos distintos **no es una
caché de nada**: es una constante. Junto con el cero escrituras de §2, la conclusión es
que **nadie lo recalcula ni lo actualiza en tiempo de ejecución**.

### 3.1 🔴 La primera medición fue con la BASE EQUIVOCADA, y lo cazó el campo de nombre

La primera pasada usó base de fichero `0` y dio «`+0x18` distinto de la suma en 13 de 15,
con valores 1..5» — un resultado **plausible y completamente falso**. El aviso no fue una
cifra rara sino que **los nombres salían desplazados** (`ÿÿGeoffre` en vez de `Geoffrey`).

Los registros empiezan en el offset **`0x02`** del fichero, no en `0`. Con la base
corregida los 16 nombres salen limpios (Shamino · Iolo · Mariah · Geoffrey · Jaana ·
Julia · Dupre · Katrina · Sentri · Gwenno · Johne · Gorn · Maxwell · Toshi · Saduj ·
Elwood) — **y ése es el control que acredita la disposición**. Sin un campo legible que
sirva de ancla, la tabla anterior se habría publicado tal cual.

**Regla**: toda lectura de una estructura binaria se ancla en un campo **verificable a
ojo** (un nombre, una cadena, un centinela) antes de creerse los campos numéricos. Un
desplazamiento constante no rompe nada: mueve todo a la vez y sigue pareciendo datos.

## 4. El único lector: es `applyDefense`, y el port lo tiene CALCADO

`COMBAT.OVL:0x1340` (`ret 4`), leído entero:

```
1340: si = [bp+4] << 3
1347: test byte [si-0x45ea], 0x40   ; bandera 0x40 = MONSTRUO
134c: je 0x135c                     ;   -> rama de miembro del party
134e: bl = [si-0x45e9] ; bx <<= 3
1356: al = [bx + 0x13bf]            ; MONSTRUO: tabla de estadisticas de criatura
135a: jmp 0x1371
135c: bx = [bp+4] << 3
1363: bl = [bx - 0x45e9]            ; indice del miembro
1369: bx <<= 5                      ; * 0x20
136d: al = [bx + 0x55c0]            ; ← LA DEFENSA CACHEADA (constante 7)
1371: [bp-2] = defensa ; [bp-4] = [bp-6]   ; [bp-6] = dano base
137c: if (defensa != 0) {
1382:    call 0x7e02 (= 0xA290+0x7e02 = kernel 0x2092 rand_range) con min=1, max=defensa
138c:    [bp-4] -= resultado
      }
138f: return [bp-4]
```

Es exactamente `dano - rand_range(1, defensa)` con la guarda `defensa != 0`, y el port
lo tiene **calcado**: `game/src/core/combat/formulas.ts:152-154`
(`if (defense > 0) return base - rng.randRange(1, defense)`).

## 5. ★★ DOS RESPUESTAS DISTINTAS A LA MISMA PREGUNTA, en el mismo overlay

`COMBAT.OVL` responde «¿cuál es la defensa de este combatiente?» en **dos sitios**, con la
**misma** bifurcación monstruo/party y la **misma** tabla para el monstruo, pero con
respuestas **distintas** para el miembro del party:

| sitio | monstruo | miembro del party | valor efectivo del miembro |
|---|---|---|---|
| `0x1340` (aplica la reducción) | `[tipo*8 + 0x13bf]` | `ficha+0x18` (`0x136d`) | **7 siempre** |
| `0x14aa` (accesor de estadística) | `[tipo*8 + 0x13bf]` | `member_armor_rating` (`0x14cb`) | **0**, o **3** con Protection |

Ninguna de las dos consulta el equipo. **El clon no calca ninguna**: `playerDefense`
(`game/src/core/combat/combat.ts:636-647`) delega en `characterDefense` (`equip.ts`), que
suma las seis ranuras — de 1 a 12 con el equipo de fábrica.

## 6. Lo que esto permite decir, y lo que NO

**SE PUEDE DECIR** (medido): en el binario publicado, y con los dos ficheros de partida
que se distribuyen, **cambiar de equipo no altera la defensa de un personaje por ninguna
de las dos vías**. La caché es constante y nadie la escribe; el recálculo desde equipo
está roto por una guarda tautológica.

**NO SE PUEDE DECIR TODAVÍA**:
- Que el campo `+0x18` **signifique** «defensa». Lo llama así `combat.md:67`; lo que yo
  mido es que es constante, que sólo lo lee `0x1340`, y que `0x1340` lo usa **como**
  defensa. El nombre del campo no lo he derivado.
- Que una partida **jugada** (no las dos de fábrica) mantenga el 7. No he encontrado
  escritor, pero el residuo de la forma E sigue declarado.
- Qué debe hacer el clon. Es decisión del lead: la divergencia es **de mecánica**, no de
  stream de RNG (el `rand_range(1, defensa)` se consume igual mientras `defensa != 0`;
  con `defensa == 0` **no se tira**, así que un clon que devuelva 0 donde el original da
  7 **sí movería el stream**).

## 7. Correcciones a material existente

- 🔴 `re/notes/combat.md:67` y su traducción `docs/publicacion/re-en/combat.md:69` dicen
  «kernel `0x6DA8` **la recalcula**». **Retirado**: `0x6da8` no escribe en memoria (todas
  sus escrituras son a `[bp-2]`/`[bp-4]` de su propio marco) y su suma es inalcanzable.
  No recalcula la caché ni ninguna otra cosa.
- `game/src/core/saveNative.ts:225` marca `base+0x18` como `"unknown": preservado de la
  plantilla`. **Es la conducta correcta** y ahora tiene respaldo: el original tampoco lo
  escribe nunca. Vale la pena que el comentario lo diga.

## 8. Cómo reproducirlo

```bash
# (a) censo de escritores, 4 formas, 28 .asm — da 0 escrituras / 11 lecturas
#     (excluir [bp ± N]: son locales de pila)
grep -rn "0x55c0" re/disasm/*.asm          # 1 sola linea, y es LECTURA

# (b) el byte, en los dos ficheros de partida — base 0x02, paso 0x20, 16 fichas
#     ancla de control: el nombre en +0x00 tiene que salir legible
python3 - <<'PY'
d = open('original/u5/ultima5/SAVED.GAM','rb').read()
for i in range(16):
    b = 2 + i*0x20
    print(d[b:b+9].split(b'\x00')[0].decode('latin1'), d[b+0x18])
PY
```
