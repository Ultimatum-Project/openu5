# heredados-168 · TANDA 4 — 4 acreditadas · la predicción de la tanda 1, confirmada

Carril `heredados-168` · 2026-07-28 · rama `re/frontera-verified-26`.
Contador `verified_inherited_without_cite`: **138 → 134**.

> Offset y nombre en celdas separadas a propósito (tanda 1 §2.3).
> Nota verificada a `SEMBRADAS 0 / CAMBIADAS 0` contra `build_name_seeds`.

---

## 1. Las 4

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `COMBAT.OVL:0x13e2` | `attack_defense_stat_selector` | ACREDITADA — ★★ confirma la predicción; ⚠ despacho sin default |
| 2 | `MAINOUT.OVL:0xfc4` | `spawn_monster` | ACREDITADA — ★★ cierra TRES derivaciones de la tanda 1 |
| 3 | `DNGLOOK.OVL:0x109e` | `load_wall_variant_gfx` | ACREDITADA — ★ dos bucles de reintento SIN tope |
| 4 | `NPC.OVL:0xd00` | `npc_ai_step (jump-table aiType 0..7)` | ACREDITADA — tabla decodificada; ★ 8 entradas, 6 destinos |

---

## 2. ★★ La predicción pre-registrada, confirmada

En la tanda 1 dejé escrito, **derivándolo desde fuera y sin haber leído el cuerpo**, que
`COMBAT.OVL:0x13e2`, al recibir `-1`, devuelve la INT (porque así lo invoca `COMSUBS.OVL:0x0`), y en
la tanda 3 que `hit_roll` lo llama dos veces, una con `-2` y otra con el id de arma. Lo dejé
apuntado en el acta como «dos restricciones de llamador derivadas: leer su cuerpo con eso
delante es la mitad del trabajo».

**El cuerpo lo confirma exactamente.** Los cuatro códigos son:

| código | estadística | fuente monstruo (paso 8) | fuente personaje (paso 32) |
|---|---|---|---|
| `-1` | INT | `[tipo*8 + 0x13be]` | `roster + 0x0E` |
| `-2` | DEX | delega en `effective_defender_dex` | ídem |
| `-3` | FUERZA | `[tipo*8 + 0x13bc]` | `roster + 0x0C` |
| `-4` | DEFENSA | `[tipo*8 + 0x13bf]` | `CS 0x6DA8` (recalcula) |

Y la primera mitad de la rutina **traduce un id de arma positivo a FUERZA o DEX**: es el arma
la que decide con qué estadística puntúa el ataque. Eso cierra la cadena completa
`hit_roll → selector → estadística` que las tandas 1, 3 y 4 fueron levantando por trozos.

No lo di por bueno por analogía: **lo escribí antes y lo comprobé después**, que es la única
forma de que una predicción valga algo.

### 2.1. ⚠ Defecto abierto: el despacho no tiene caso por defecto

Los cuatro `cmp` cubren `-4..-1`; cualquier otro valor cae en `mov ax,[bp-4]` con `[bp-4]`
**nunca escrito** (el marco se reserva con `sub sp,4` y no se inicializa) ⇒ **devuelve basura
de pila**. La única rama que entrega un valor sin traducir al despacho es la de los actores
con el bit `0x40` y un segundo argumento distinto de 0.
**Declaro la alcanzabilidad como ABIERTA**, no como bug confirmado: depende de si un actor de
esa clase puede portar un id de arma no nulo, y este cuerpo no lo cierra.

---

## 3. ★★ `spawn_monster` cierra tres derivaciones de la tanda 1

Es el mejor caso de corroboración del barrido, porque llega desde el otro lado:

1. **`CS 0x4402`, o sea `get_tile_ptr`** — lo leí en la tanda 1 para adjudicar `set_map_tile`; aquí
   aparece como el lector de tile del bucle de rechazo.
2. **`CS 0x3A74 = set_actor_record` toma 7 argumentos** — en la tanda 1 lo deduje contando
   `ret 0xe`; aquí está el llamador **con exactamente siete pushes**. La aridad queda
   comprobada por las dos puntas.
3. **El campo `+5` del registro de animación.** En la tanda 1 derivé que el panel de estado
   (`CS 0x2900`) imprime ese byte cuando el transporte es un barco, sin saber qué era. Aquí
   el spawner escribe **100** en `+5`, y **sólo para el tipo `0x2C`** — que además sólo puede
   aparecer sobre agua (`(tile & 0xf0) == 0x60`, la familia que derivé en
   `tile_classifier_water`). Juntando las dos lecturas: `+5` es el marcador de casco/aguante
   de la criatura-barco, y **nace en 100**. Ninguna de las dos lecturas lo decía sola.

**Coste en RNG:** hasta **128** vueltas del bucle de rechazo, cada una con una llamada a
`pick_spawn_coords`; agotadas las 128 **sale sin crear nada**, habiéndolas consumido igual.

---

## 4. ★ Dos políticas opuestas ante el fallo, en el mismo binario

Vale la pena ponerlas juntas porque salieron en la misma tanda:

- `MAINOUT.OVL:0xfc4` **acota** su bucle de rechazo en 128 intentos y se rinde limpiamente.
- `DNGLOOK.OVL:0x109e`, en cambio, trae **dos bucles `reintenta hasta que no sea cero` SIN tope**
  (`or ax,ax` / `je` de vuelta al principio). Si el cargador devolviera 0 de forma
  persistente, **no termina**.

No es una crítica al original —el cargador seguramente no falla nunca— pero un porte que
copie el segundo patrón sin el primero hereda un cuelgue potencial donde el original tenía
una garantía implícita del hardware.

---

## 5. La tabla de saltos de `npc_ai_step`, decodificada (no contada de oídas)

El disasm imprime la tabla como instrucciones basura (`cmp al,0xb0`, `enter`, `scasw`) porque
**son datos**. Misma técnica que #51 usó con las 11 casillas de `0x2c4c`:
`-0x4fd4` sin signo es `0xB02C`, la base near-call de `NPC.OVL` es `0xA290`, luego la tabla
vive en el fichero en `0x0d9c`. Los 16 bytes siguientes son ocho words, y **los ocho destinos
caen en etiquetas reales del propio cuerpo** — comprobado programáticamente, no a mano, que
es lo que valida la decodificación.

| aiType | destino | nota |
|---|---|---|
| 0 | `0x0dac` | **NO-OP** (es el `pop si` del epílogo) |
| 1 | `0x0d60` | |
| 2 | `0x0d38` | |
| 3 | `0x0d76` | |
| 4 | `0x0d40` | |
| 5 | `0x0d91` | |
| 6 | `0x0d76` | **repite el 3** |
| 7 | `0x0d91` | **repite el 5** |

⇒ **8 entradas pero 6 destinos distintos.** Quien porte esto como ocho conductas se inventa
dos.

---

## 6. Cola

Sigue lo apuntado en la tanda 3 §3, menos las cuatro de aquí. Nuevos apuntes:

1. **`CS 0x38E4`** — asignador de slot libre de actor, sin leer.
2. **`MAINOUT.OVL:0x0e4e`** — el que traduce tile → tipo de monstruo (la tabla de encuentros);
   está en el bucket DÉBIL de las 168 y ahora tiene un llamador derivado.
3. **`DS 0xBB17`** — latch de estado de la carga de gráficos de mazmorra (bit 1 «ya cargado»,
   bit 2 «pasa antes por `0x6d9e`»); sin entrada en `globals.json`.
4. **Tabla de estadísticas de monstruo ~`0x13B8`**, paso 8, con `+4` FUERZA, `+6` INT,
   `+7` DEFENSA, deducido de los tres accesos que hace el cuerpo — `0x13bc`, `0x13be` y `0x13bf`.
