# ACTA tanda B de #146 — los 3 huecos-en-rutina-portada del re-censo F, leídos

Carril `tandab-146`, rama `re/tandab-146`, sobre `main` @61a8bcd0.
Es la mitad de #146 que **no** hice en su primer pase y que di por cerrada de más: la
descripción de la tarjeta la pedía y yo cerré sólo la fusión y el barrido.
Alcance: `re/ledger` + `re/notes`. CERO `game/src`, CERO e2e.

---

## Resumen

Los tres se sostienen como huecos, pero **ninguno de los tres era exactamente lo que yo
escribí en el anexo de #139**, y las tres correcciones son de cita, no de veredicto. Es el
peaje previsto de haber adjudicado 18 cadenas con el instrumento recién arreglado y sin
haber leído todavía cada flujo entero.

| clave | veredicto | qué cambia respecto de lo que yo escribí |
|---|---|---|
| `'A moonstone!\n'` | hueco **de mensaje** | la mecánica SÍ está portada, y por otra vía; mi cita señalaba la función equivocada |
| `'Magic absorbed!\n'` | hueco **de mecánica + mensaje** | confirmado, y la cita del PORT resiste la verificación |
| `'Thrown out of bed!\n'` | hueco de mensaje | mi offset era el del gate, no el del push; y la geometría del gate no es la que declara el port |

---

## 1. `'A moonstone!\n'` — la mecánica está portada; falta el MENSAJE de una segunda vía

**Lo que yo escribí en #139:** «rutina PORTADA: `quest/items.ts:81 grantPlotItem` cubre
amuleto/corona/cetro/caja/alfombra … y `plotItemForNpcType` no tiene caso para el tile de la
moonstone».

**Está mal apuntado.** `grantPlotItem` es el despacho **por TILE** de los ítems de trama
(0xB4-0xB7 + caja + alfombra). La moonstone no va por ahí: es el **kind 0x19 del jump-table
por ID** de `get_special_item` (SJOG 0x1458), cuya tabla se indexa en 0x147d
(`jmp word ptr cs:[bx-0x2962]`, tras `sub ax,1` / `add ax,ax` sobre `[bp+8]`). Citar
`grantPlotItem` para esta rama es señalar una función que nunca la habría contenido.

**Lo que sí ocurre**, y hace el hueco mucho más pequeño de lo que declaré:

- La **mecánica está portada**. `core/world/search.ts:109-116 applySearchGrant` trata
  `MOONSTONE_SEARCH_ID = 25` y hace `stone.buried = false`, que es exactamente la semántica
  de `mov byte [bx+0x5840],0xff` en SJOG 0x1496 (0xFF = «en inventario, no enterrada»). El
  propio fichero lo cita.
- Lo que falta es el **mensaje de la otra vía de adquisición**: el original tiene DOS
  caminos, el (S)earch —que imprime «a strange rock!», DS 0x8680, y el port sí emite— y el
  (G)et sobre objeto de mundo —que imprime «A moonstone!», DS 0x8c4e, y el port no tiene—.
- Y **el port ya lo declara**: `core/game.ts:4170` dice literalmente «El resto del
  jump-table de get_special_item (⚠O3) sigue sin portarse aquí», habiendo portado del mismo
  jump-table la rama de antorchas (kind 0x0d).

**Veredicto:** hueco **de mensaje** en una rutina PARCIALMENTE portada, ya declarado por el
port bajo la etiqueta ⚠O3. No es sapo: por esa vía el port no dice otra cosa, no dice nada,
porque la vía no existe. **No merece fix propio**: pertenece a ⚠O3 entero.

## 2. `'Magic absorbed!\n'` — hueco de MECÁNICA, y la cita del port resiste

Verifiqué la afirmación del port en vez de heredarla, porque decía «escanea la tabla» y el
arranque parecía una comprobación única. **Sí hay bucle**, leído entero:

```
0d60: sub di,di
0d62: mov si,0x5c5a
0d65: cmp byte [si],0xfc      ; ¿algún objeto con tile 0xFC?
0d68: jne 0xd92
0d6a: mov ax,0x45f2 / call 0x58d0    ; "Magic absorbed!\n"
0d88: mov word [bp-4],0              ; ⇒ FALLA
0d90: jmp 0xd9e
0d92: add si,8 / inc di / cmp di,0x20 / jge … / jmp 0xd65   ; 32 entradas de 8 bytes
0d9e: cmp word [bp-4],0 / je 0xdb1   ; sólo si NO falló:
0da4:   g_time_spell      = 0x54
0da9:   g_time_spell_turns = 0x0a
```

`core/magic/cast.ts:163-168` describe esto correctamente («la tabla de objetos (0x5c5a,
32×8)») y se declara pendiente. **La cita del port es exacta y queda acreditada.**

**Veredicto:** hueco de **mecánica + mensaje**, el más sustantivo de los tres. El port
devuelve `timeStop` incondicional; el original puede FALLAR el hechizo con el maná ya
gastado. No lo arreglo aquí: requiere el modelo de objetos de mapa/combate, que es lo que el
propio comentario dice, y tocar `game/src` excede este carril.

## 3. `'Thrown out of bed!\n'` — mi offset era el del gate, y la geometría no es la declarada

**Corrección 1 (mía).** Escribí «string DS 0x422a empujado en 0x0688». 0x0688 es el
**gate**; el push está en **0x069d**:

```
0688: call 0x770e            ; con (g_party_x, g_party_y, g_floor)
068b: or ax,ax
068d: je 0x634               ; ==0 → sigue durmiendo
068f: mov si,0xffff
0698: cmp si,-1 / jne 0x6a4  ; degenerado: si acaba de ponerse a -1
069d: mov ax,0x422a / push / call 0x58d0     ; "Thrown out of bed!\n"
```

El `cmp si,-1` no puede fallar (el compilador dejó la comparación tras la asignación
inmediata), así que **si el gate dispara, el mensaje se imprime siempre**.

**Corrección 2 (del port), y es la que importa.** `core/world/camp.ts:130` justifica la
Clase C con «en una posada no hay actor **al lado**». Pero el gate no mira al lado: pasa
`(g_party_x, g_party_y, g_floor)` — **la posición propia de la party**.

Qué es `0x770e`: no leí su cuerpo (es rutina compartida, y los labels de overlay son
file-relativos y no resuelven), así que lo derivé **por uso en tres call-sites
independientes**, los tres con la misma terna (x, y, plano):

- `SJOG 0x03f7` → `cmp ax, 0x19` — compara el retorno con **0x19 = 25**, que es exactamente
  el `MOONSTONE_SEARCH_ID = 25` del port;
- `CMDS 0x0826` → guarda `al` como byte;
- `CMDS 0x0688` → `or ax,ax` (¿hay algo?).

⇒ `0x770e(x,y,plano)` = **búsqueda de OBJETO en esa posición**, 0 si no hay. Confianza:
media-alta por convergencia de tres usos; el cuerpo **no** está leído y así queda declarado.

**Veredicto:** hueco de mensaje, Clase C defendible en el fondo —una posada rara vez tendrá
un objeto/actor sobre la propia casilla— pero **la razón escrita en el port describe la
geometría equivocada**. Es la familia de [[yell-position-adjacent-not-ontop]] al revés: allí
el port suponía «encima» donde el binario pedía adyacente; aquí supone «al lado» donde el
binario mira la propia casilla.

---

## 4. Lo que se corrige en el ledger

Tres `cita` reescritas (cero `veredicto` tocados): la de la moonstone deja de señalar
`grantPlotItem` y pasa a citar el jump-table por ID + `search.ts` + el ⚠O3 de `game.ts:4170`;
la de An Tym gana el bucle verificado y el efecto de fallo; la de la cama corrige 0x0688 →
0x069d y anota la divergencia de geometría.

## 5. Predicciones falsables

1. Si alguien porta ⚠O3 (el jump-table de `get_special_item`), «A moonstone!» debe salir del
   censo **sin tocar la mecánica** — porque la mecánica ya está. Si hiciera falta tocar
   `search.ts`, mi lectura de §1 es errónea.
2. Si se resuelve el cuerpo de `0x770e` y NO es una búsqueda por posición, las tres lecturas
   de call-site de §3 caen a la vez — es una predicción única, no tres.
3. El género de §3 («el port declara una Clase C con la geometría equivocada») debería tener
   más ejemplares: el proyecto ya se comió el mismo error invertido en el (Y)ell. Barrer las
   justificaciones de Clase C que digan «adyacente/al lado/encima» contra el argumento real
   de su gate es barato y no está hecho.
