# Acta #36 — los SIETE sin-oro adjudicados: DOS familias, un censo corrido y la caridad que nadie había visto

Carril `re/gold-deriv`, fase DERIVACIÓN de la tarjeta #36. Base `main` = `ff7577fe`.
Continúa `gold-string-barrido.md` (la MEDICIÓN) e `inn-145-acta.md` §sin-oro (el MÉTODO).

**Veredicto: las siete adjudicadas.** Cuatro fabricaciones VIVAS (no tres), dos cadenas
MUERTAS ya cubiertas desde antes, y una función sin flujo en el binario que se declara con
cita en vez de borrarse. La cadena `"Thou hast not the gold!"` ya no existe en `game/src`.

---

## 1. ★ El censo del barrido tenía las etiquetas CORRIDAS UN SITIO

El barrido listaba cuatro ramas de degradación (`:1476`, `:1622`, `:1726`, `:1837`) y las
etiquetaba armería / reactivos / gremio / astillero. Leído el código, la correspondencia
real es otra, y la diferencia no es cosmética:

| línea | función del núcleo | tienda | ¿puede llevar el sin-oro? |
|---|---|---|---|
| 1476 | `buyEquipment` | armería | **SÍ** |
| 1622 | `sellEquipment` | armería (**VENTA**) | **NO** — vender no gasta oro |
| 1726 | `buyReagent` | reactivos | **SÍ** |
| 1837 | `buyGuildItem` | gremio | **SÍ** |
| 1095 | `buyShip` | astillero | no emite `r.message` |
| **1945** | `healerHeal` | **sanador** | **SÍ — y el barrido no lo listaba** |

Dos consecuencias: el astillero **no está en `:1837`** (está en `:1095`, y por ahí la cadena
no sale), y hay un **quinto emisor de `r.message`** que el barrido no censó, `:1945`
`pickHealMember` — la vía degradada del sanador, que además emitía el mensaje **en crudo,
sin `t()`**, o sea también una fuga de i18n. **Vivos de degradación: CUATRO.**

Lección de método, la de [[emparejar-por-linea-no-es-emparejar]]: el barrido emparejó por
NÚMERO DE LÍNEA en vez de por la función llamada en esa línea, y en un bloque de cuatro
ramas casi idénticas eso desplaza toda la tabla sin que ninguna fila parezca rara.

## 2. Las DOS familias, y por qué el núcleo puro no puede con NINGUNA

Leídos los cinco sin-oro instrucción a instrucción. Todos necesitan el `$` (nombre del
tendero) y la armería además el stream de rands: nada de eso vive en `shops.ts`.

**(a) LITERALES DE DATA.OVL + rand — sólo la ARMERÍA** (`buy_one_item` SHOPPES 0x0a7b):

```
0a7b  cmp [g_gold], ax / jge 0xaaa     ; gold >= precio → pago
0a81  mov ax,0x7ba4 / call 0x75c0      ; `\n"`            (impresor llano)
0a8b  push 3 / 0a8f call 0x7e02        ; rand(0,3) del stream VIVO
0a96  push [bx+0x3cae] / call 0x75c0   ; insulto 1-de-4
0a9d  mov ax,0x7ba8 / call 0x26        ; `"\nyells $.\n`  (expansor)
0aa4  mov di,0xffff                    ; ret −1 ⇒ despedida 0x0202 SILENCIOSA
```

Verificadas contra `DATA.OVL` (fileoff = DS+0x10) las 4 entradas de la tabla DS 0x3cae
(0x7b04/0x7b28/0x7b48/0x7b54) y los 3 literales. ★ **Esta familia NO toca SHOPPE.DAT**, así
que se puede calcar ENTERA aunque el pool no esté — que es justo lo que hacía falta.

**(b) REGISTROS DE SHOPPE.DAT — las otras cinco.** Dos mecanismos distintos, los dos
verificados:

| tienda | sitio | cómo llega al registro | registro | ¿echa? |
|---|---|---|---|---|
| reactivos | 0x060a | `0x0610 mov ax,0xb6e2` + `call 0x26` — buffer del chunk precargado en 0xb21e desde fileoff 0x1a67 ⇒ rebase −0x97b7 ⇒ **fileoff 0x1f2b** | **147** | sí (0x0617) |
| gremio | 0x0361 | `0x0367 mov ax,0x21e6` + `call 0x17a` — `print_shoppe` con el fileoff **CRUDO** | **163** | sí (0x036e) |
| sanador | 0x14bc | `0x14ce mov ax,0x23ab` + `call 0x17a` | **173** | **NO** |
| posada | 0x0799 | `call 0xffff9dd6` → stub → `0x017a` | 193 | sí |
| astillero | helper 0x7e2 | ptr 0x198e | 122 | sí (sin despedida) |

**CONTROL del mapeo fileoff→índice** (barrido de SHOPPE.DAT por registros terminados en NUL:
**195**, los mismos que `shoppe.json`): reproduce los tres ya curados — 104 → 0x1643,
173 → 0x23AB, y 193. **3/3.**

⇒ Sin pool, el texto de (b) **no existe**. Se echa en SILENCIO. Es el criterio que ya regía
en `reagentDealYes` y `shipTakeYes`: cuando el registro no está, no se dice nada — **nunca se
rellena el hueco con prosa propia**. Rellenarlo es exactamente cómo nació esta tarjeta.

## 3. ★★ El sanador escondía MECÁNICA, no sólo un texto

El sin-oro del curandero no empieza por el texto. Empieza por la **CARIDAD**:

```
14bc  cmp [g_gold], ax / jge 0x14da    ; con oro → cobra
14c2  cmp ax, 0x64 / jg 0x14ce         ; precio > 100 → no hay caridad
14c7  cmp [g_location], 7 / je 0x14da  ; ★ Skara Brae → SERVICIO GRATIS
14ce  mov ax,0x23ab / call 0x17a       ; si no: registro 173
14d5  mov [bp-4], 1                    ; declinado — y SIGUE el epílogo
```

Con precio ≤ 100 en Skara Brae el servicio **se hace, gratis**. La vía degradada no tenía ese
gate: quien entrase sin pool se quedaba sin la caridad. Y es el **único de los cinco que no
echa** de la tienda. La vía con pool (`healerPayYes`) sí lo tenía; la degradada era una copia
vieja que se quedó atrás — familia [[carril-gemelo-verificar-por-contenido]].

## 4. Los dos MUERTOS y la función sin flujo

- **Astillero — MUERTA, y ya lo estaba.** `shipTakeYes` (`:1095`) nunca emite `r.message`:
  emite `SHIP_CHEAT_INDEX` (122) + `shipYells` y marca `thrownOut`. El barrido lo daba por
  «pendiente de medir»; medido, **no había nada que arreglar ahí**. Además, sin pool la rama
  Shipwright del menú no hace nada, así que tampoco hay vía degradada.
- **Posada — MUERTA**, registro 193 cableado en #145. Confirmado.
- **`buyProvisions` — SIN FLUJO EN EL BINARIO. Declarada, NO borrada.** No hay «mercader de
  provisiones» en Ultima V: la comida se compra con `buyRations` (taberna, SHOPPES2 0x0380,
  +25/unidad) y las antorchas con `buyGuildItem` item=2 (gremio, lote +5) — **las dos vías
  están portadas y cableadas**. `buyProvisions` es el residuo del placeholder sintético
  «Food(1)+Torch» que la UI vendía antes de los mercaderes fieles (`use-merchants.md`
  §Barkeeper; `content-audit.md`:85); al jubilar aquella UI se quedó sin consumidor. Se
  declara con cita y queda **tarjeta para la poda**: borrar un export público con tests
  propios no es decisión de este carril.

## 5. El arreglo

- `core/shops/shops.ts` — los siete devuelven `reason: "gold"` con mensaje **VACÍO**, cada uno
  con la cita de su productor real. Vacío no es «no se dijo nada»: es **«este texto no es del
  núcleo»**, que es la conclusión de `inn-145-acta.md` §4 aplicada a las otras seis.
- `ui/shop-console.ts` — armería: el sin-oro fiel COMPLETO (rand + expulsión). Reactivos y
  gremio: registro si hay pool, silencio si no, y expulsión. Sanador: caridad + registro 173,
  y el `t()` que faltaba.
- `i18n/es.json` + `approved-strings.json` — baja de la entrada y de su traducción huérfana.

## 6. Verificación

`tests/gold-string-36.test.ts`, 17 casos. **Failing-first REAL: 14 rojos de 17** antes del
arreglo. Los 3 verdes de partida son los **controles**, y lo son a propósito: «con oro no sale
insulto y la sesión sigue», «con pool SÍ sale el registro» y «fuera de Skara Brae no hay
caridad» deben estar verdes ANTES y DESPUÉS — si alguno se hubiera puesto rojo, el arreglo
habría roto la vía buena.

Control discriminante del rand: un caso exige que **otro rand dé otro insulto**, porque
«contiene el insulto» sería verde con un port que emitiera siempre el mismo.

Dos bugs propios cazados por los rojos, y ninguno era del código: el herrero **saluda sin
pool** (su welcome es DS 0x8018, no un registro) y hacía falta gastar la tecla de pacing; y la
fixture del herido era **compartida y mutable**, así que el caso de caridad dejaba curado al
paciente de los otros dos ([[marca-destruye-el-dato-del-experimento]] en versión doméstica).

`tsc --noEmit` limpio. Suite completa desde `game/`: **4128 verdes / 323 ficheros**. Gates
4/4 por separado y con población no nula (4 / 18 / 5 / 4). Las dos guardas de fabricación
mordieron y se atendieron: `string-manifest` exigió retirar la entrada huérfana del manifiesto
e i18n quedó sin traducción sin canon.

## 7. Residuos DECLARADOS

1. **`buyProvisions`** — poda pendiente (§4). Export público + 4 tests propios.
2. **Los dos rechazos de `sellEquipment`** (`I cannot buy that!` 0x0e7d, `Thou hast none to
   sell!` 0x0ea2) siguen **sin transcripción del binario**. No son sin-oro y no entran en
   esta tarjeta, pero son de la misma clase: texto de mercader sin cita. Tarjeta propia.
3. **Rojo AJENO y HEREDADO** en la suite: `acumulador-ventana` acusa una entrada muerta de
   `game/e2e/blackthorn.spec.ts`. Es de la base `ff7577fe` y del carril Blackthorn — probado
   por contenido: **todos los inputs que ese test lee son byte-idénticos a los de la base**.
