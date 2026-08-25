# ACTA #133 — Lote de fixes calcados del capítulo de huérfanos

Carril `lote-133`, rama `fix/lote-133` (retenida; aterriza el lead). 2026-07-28. CERO e2e.
Origen: `sapo-120-acta.md`. Emparejada con #130 (el «Nay!»).

Tres fixes escritos, un careo, y **el careo destapó una TERCERA instancia del mismo
género en la misma rutina**.

---

## 1. ★ EL GÉNERO DEL LOTE: «medio cmp portado», y aparece TRES veces

Los tres primeros ítems parecían independientes. No lo son: dos de ellos —y el careo del
cuarto— son **el mismo defecto estructural**: el binario decide con un `cmp` de dos
salidas, el port porta UNA, y **la cita del port apunta al offset de la rama portada**, con
lo que parece derivada y no lo está.

| ítem | el cmp | rama portada | rama que faltaba |
|---|---|---|---|
| (1) odd key | `0x1568 cmp [bp+6],0x7f` | `0x158e` ' key' (citada) | `0x1581` ' odd key' |
| (4) HMS Cape | `0x15c6 cmp [bp+6],0xff` | `0x15dc` 'A scroll: …' (citada) | `0x15cd` 'The plans for the HMS Cape!' |

Los dos viven en `apply_item_grant`, a ~100 bytes uno de otro. Y el hermano de (3) es la
misma idea en otra forma —**la mitad de un PAR de prints**— así que el lote entero es una
familia: *el port se queda con un lado y su cita lo respalda*.

⇒ **Criterio para el barrido futuro**: una cita a un offset que es EL DESTINO DE UN SALTO
(`jle`/`jne`) es sospechosa por construcción — hay otra rama, y hay que mirar si está.

## 2. Los tres fixes

### (1) odd key — SJOG 0x1568

```
1568  cmp [bp+6],0x7f / jle 0x158e      ; el lado que faltaba
156e  and [bp+6],0x7f                   ; desenmascara la CUENTA
1573  print_int([bp+6],1,0x20)
1581  print DS 0x8caa ' odd key'        ; ★
158e  print_int(...) / DS 0x8cb4 ' key' ; el único portado
15b1  cmp …,1 → DS 0x8cbe 's!\n' : DS 0x8cba '!\n'
```

★ Aquí el `cmp …,1` de 0x15b1 **SÍ es un selector de singular/plural de verdad** —son dos
cadenas distintas del fichero—, al revés que el `cmp di,0xa` de las parcelas de reactivo
(#91), que resultó ser el ancho de campo del impresor. Mismo aspecto, semántica opuesta:
lo que decide es si hay DOS cadenas o UNA.

⚠ **Y el bit tenía que LLEGAR.** `applySearchGrant` devuelve la cuenta YA enmascarada, así
que el (G)et nombraba con 5 y jamás con 0x85: cablear sólo `lootItemName` habría dejado la
rama nueva inalcanzable —el defecto de #130 otra vez—. En el binario `[bp+6]` es UN SOLO
valor que la rutina desenmascara por dentro, así que el call-site pasa `quality`. Para todo
id que no sea la llave el grant devuelve `entry.quality` tal cual ⇒ el cambio es idéntico
fuera de ese caso.

Alcanzabilidad: **un objeto en todo el juego**, `{id:7, quality:0x85}` en Trinsic ⇒
«5 odd keys!».

### (2) Boarded! — CAST 0x188b

`useMagicCarpet` modelaba el flujo entero —los tres rechazos, el consumo, el tile— y
**enmudecía justo en la rama de éxito**, que es el camino normal. Ahora emite DS 0x48c8.

### (3) ★ pit truncado + su hermano — SJOG 0x077c / 0x0868

El port emitía `'in the pit.'`, que es **la cola de la cadena tras su `\n` interior**: la
de verdad es DS 0x8786 = `'Nothing hidden\nin the pit.\n'` entera, y el binario la manda de
una pieza (0x077c `mov ax,0x8786` + salto a la cola de impresión común). **Y el comentario
del propio fichero consagraba el recorte como fiel** — sapo y prosa auto-fiel a la vez. El
comentario también se corrigió.

Hermano de la misma familia, mismo switch: el muro especial de variante 3 hace **DOS prints
seguidos** (0x0868 DS 0x88c8 + 0x086f DS 0x88ea) y el port emitía sólo el segundo.

## 3. Los arneses que sellaban el defecto (re-sellados, no borrados)

Ocho asertos vivían en verde sobre las cadenas equivocadas. Se re-sellaron con la historia
escrita encima:

- `dungeon.test.ts` — 5 asertos del pit + 1 del muro.
- `use-tools.test.ts` — `toEqual(["Carpet"])` sellaba EL SILENCIO de la rama de éxito.
- ★ `search-get.test.ts:121` — `expect(msgs).toContain(lootItemName(7, 5))` **comparaba la
  función CONSIGO MISMA**: pasaba con cualquier cosa que devolviera. Ahora es un literal, y
  además el objeto real lleva `quality 0x85` ⇒ ejerce el lado alto del cmp. Aserto
  decorativo cazado, del mismo género que los del lote #54.

## 4. Careo del ítem (4) — HMS Cape: **NO está portado**, y es el género de arriba

`case 4` de `lootItemName` hace `tf("A scroll: {}!", SCROLL_CODES[qty & 7])` y cita
**SJOG 0x15dc** — que es exactamente el destino del `jne` de `0x15c6 cmp [bp+6],0xff`.
El lado 0xff (0x15cd: print DS 0x8cc2 `'The plans for the HMS Cape!\n'` + `g_hms_cape =
0xff`) **no está**. Consecuencia medible: conceder los planos (valor 0xff) los nombraría
`'A scroll: AT!'` (0xff & 7 = 7) en vez de la cadena propia, y no marcaría el flag.

La cadena está en `es.json` traducida y **sin emisor** — es la huérfana que el censo ya
señalaba. **No lo arreglo aquí**: además del nombre hay que conceder el estado
(`specialItems.hmsCape`, hoy sólo lo escribe el (U)se en 0x1a86) y eso es mecánica con
alcance propio. **Propongo tarjeta**, y va con la sospecha del §1 ya formulada.

## 5. Lo que NO toqué, por ruling de la tarjeta

`Treasure!` y `This tile is impossible` caen al genérico y el comentario del fichero **lo
declara con alcance diferido E4**: son divergencias DECLARADAS, no sapos. La distinción del
ledger se respeta — un acuse de recibo escrito no es un descuido.

## 6. Corpus

5 cadenas nuevas al manifiesto con cita ASM; retirada `'in the pit.'`, que dejó de existir
en el código (era el truncamiento). En `es.json`, la clave truncada se sustituyó por la
entera con su traducción.

⚠ **Trampa del wrap, pisada y anotada**: traduje el pit conservando el `\n` INTERIOR y la
guarda (C) de i18n se puso roja — las traducciones NO llevan el wrap inglés, lo re-inserta
`rewrap`. El `\n` es del texto ORIGINAL (va en la key y en el literal del port), pero NO de
la traducción. Las otras 4 cadenas nuevas quedan sin traducir: caen al inglés por diseño y
las recoge el carril de i18n.

## 7. Gates

| gate | resultado |
|---|---|
| `npx vitest run` (suite entera) | **EXIT 0** — 3647 pasan, 1 skip |
| `npx tsc --noEmit` | **EXIT 0** |
| `pytest test_frontier.py test_seed_gate.py -q` | ver parte |
| `seed_diff` de esta acta | ver parte |

## 8. Predicciones falsables

1. El barrido del §1 —citas que apuntan al destino de un `jle`/`jne`— encontrará MÁS casos:
   ya van tres en dos rutinas. Si sale vacío, el criterio está mal formulado, no el corpus.
2. Nadie verá jamás «5 odd keys!» por otra vía que el árbol de Trinsic: es el único objeto
   del juego con el bit puesto.
3. Si alguien traduce las 4 cadenas nuevas conservando un `\n` interior, la guarda (C) de
   i18n se pondrá roja igual que se me puso a mí.
