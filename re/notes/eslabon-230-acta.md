# Acta #230 — el eslabón EXISTE: «Thrown out of bed!» es ALCANZABLE en el original

Carril `re/eslabon-230` (worktree `.claude/worktrees/eslabon-230`), rama desde `main` @`0b581a82`.
Cierra el cabo (a) de #149 (`re/notes/geometria-149-acta.md` §3.1/§5.1).

## VEREDICTO

**EL ESLABÓN EXISTE, derivado de punta a punta.** El snap horario que corre DENTRO del bucle de
sueño escribe la posición del NPC en la MISMA tabla que barre el gate. ⇒ **el mensaje es
ALCANZABLE en el original**, y `camp.ts::bedSleep` tiene una **MECÁNICA AUSENTE** (no corre el
snap ni el test). La Clase C de #149 queda **re-adjudicada: no es «consecuente», es un hueco.**

---

## 1. La cadena, toda leída

```
CMDS 0x0552 — dormir en cama; bucle por hora:
  0x0677  call 0xffffbb0e  → stub → TOWN.OVL 0x1694  npc_activate_all_town   ← EL SNAP
  0x067a-0x0687  push g_party_x, g_party_y, g_floor
  0x0688  call 0x770e = ULTIMA.EXE 0x368E find_object_at_xy   ← EL GATE (17 B después)
  0x068b  or ax,ax / je → si 0: sigue durmiendo ; si no: si=0xFFFF → imprime DS 0x422a

TOWN 0x1694 (el snap), bucle si = 1..0x20 por NPC:
  0x16e8/0x16ef/0x16f4  lee x/y/z del tramo horario de la BANDA DE RUNTIME
                        ([bx+0x5d61] / [bx+0x5d64] / [bx+0x5d67]) y los empuja
  0x16f9  call 0x1726                                          ← ★ EL ESLABÓN

TOWN 0x1726, el colocador — args (z=[bp+4], y=[bp+6], x=[bp+8], npc=[bp+0xa]):
  0x1785  call 0xffffb714   ← asigna SLOT DE OBJETO si el NPC no tenía (misma rutina que el
                              spawn del troll de game.ts:1317)
  0x180d  al = g_floor
  0x1812  cmp [bp+4], ax  / 0x1815 jne 0x1841   ← si la planta del horario ≠ la del jugador, NO escribe
  0x181a  cmp [bx+0xc], 0 / 0x181e je 0x1841    ← sin slot de objeto, NO escribe
  0x1820  si = [bx+0xc] << 3                    ← slot de objeto × 8
  0x182f  mov [si+0x5c5c], [bp+8]   ← X  →  0x5C5A slot +2
  0x1836  mov [si+0x5c5d], [bp+6]   ← Y  →           +3
  0x183d  mov [si+0x5c5e], [bp+4]   ← Z  →           +4
```

⇒ **el snap escribe las DOS bandas**: la de runtime (en 0x1847, `[bx+2]`) **y la tabla de objetos
0x5C5A en los campos exactos +2/+3/+4 que `find_object_at_xy` compara** (#149 §3.1 leyó su
cuerpo: compara +2/+3/+4 contra los tres args).

**Consecuencia:** en la planta del jugador, si el tramo horario de un NPC lo coloca en
`(g_party_x, g_party_y)`, el gate lo encuentra **en la misma iteración** y el mensaje sale. La
mecánica es legible: *dormir en una cama de pueblo y que el horario meta a alguien en tu casilla
te echa de la cama.*

## 2. Corrección a #149 y a #229

- #149 §3.1 declaró la alcanzabilidad **ABIERTA** porque «0x1694 escribe la banda DS 0x5d61+, no
  0x5C5A, y quién refleja una en otra es un eslabón aparte». **La primera mitad era correcta y la
  conclusión, prudente de más:** 0x1694 no escribe 0x5C5A *directamente*, pero **la rutina que
  llama, sí**. El eslabón estaba a UNA llamada de distancia.
- #229 §3 clasificó TOWN.OVL 0x1726 como productor de la banda de runtime. **Se queda corto:** escribe
  las dos. No es un error de esa acta (no censaba 0x5C5A), pero que nadie la lea como límite.

## 3. ★★ EL INSTRUMENTO ERA CIEGO A LA MITAD DE LA POBLACIÓN

Encontrar el eslabón **exigió arreglar el censo primero**, y el hallazgo de método vale tanto
como el veredicto:

`disasm._ABS_RE` es **`\[0x([0-9a-f]+)\]`** — sólo casa el operando **DESNUDO**. Todo acceso
**INDEXADO** `[reg + 0xNNNN]` sale con `abs_refs = []` y es **invisible**. Y una TABLA se accede
SIEMPRE indexada.

Censo de la tabla 0x5C5A..0x5D59 por los dos canales:

| canal | accesos | escrituras |
|---|---:|---:|
| desnudo `[0xNNNN]` (lo que ve el instrumento estándar) | 142 | 105 |
| **INDEXADO `[reg + 0xNNNN]` (INVISIBLE)** | **172** | **101** |
| **total real** | **314** | **206** |

⇒ **el 55% de los accesos y el 49% de los escritores estaban fuera del radar.** Entre los
invisibles: los seis escritores de NPC.OVL (`0x091c/0x0926`, `0x0ce5/0x0cef`, `0x100b/0x101d`) y
los tres de TOWN `0x1726` — **es decir, el eslabón entero de esta tarjeta.**

**El control que salvó el censo:** sabía por #237 que NPC.OVL 0x091c hace `mov [si+0x5c5c], al`. Mi
primer barrido dio 105 escrituras y **NPC.OVL no aparecía**. Un cero donde sé que hay algo ⇒
instrumento roto, no población vacía. Sin ese control positivo habría firmado 105 y habría
concluido que el eslabón no existe — **el veredicto contrario, con cifras de aspecto sólido.**

**RE-MEDICIÓN de mis cifras anteriores** (honestidad, no cortesía): re-corrí #229 con el canal
ampliado ⇒ `g_cmb_scratch_x/y` da **410 desnudos + 0 indexados**. Los 410 de #229 **aguantan**:
una global escalar no se accede indexada en este corpus. Medido, no supuesto.

## 4. Lo que esto abre en el PORT

`camp.ts::bedSleep` (main) sólo hace `advanceClock(60)` por hora: **ni snap ni gate**. Con el
eslabón derivado, eso ya no es una Clase C consecuente sino **mecánica ausente** de dos piezas:

1. el **snap horario** durante el sueño en cama (el port tiene el equivalente, `NpcManager.enterMap`
   — ver #158/§game.ts:3903 `wakeSnapNpcs` — pero `bedSleep` no lo llama por hora);
2. el **test de ocupación de la casilla propia** y su mensaje `Thrown out of bed!`.

**NO lo he portado.** Es mecánica y el encargo de este carril era el eslabón; además mueve el
orden de eventos por hora. Cabo → tarjeta propuesta.

## 5. Declarado y NO cerrado

1. **No he medido si algún horario real coloca a un NPC en la casilla de una cama de posada.** El
   eslabón es alcanzable POR CONSTRUCCIÓN (nada lo impide y el gate corre tras el snap), pero la
   frecuencia en juego real depende de los datos de `.NPC`. **No confundir «alcanzable» con
   «frecuente»**, y no hace falta para el veredicto: el port no lo modela en absoluto.
2. **La rama de planta DISTINTA** (`0x1815 jne 0x1841`) salta la escritura de 0x5C5A: los NPCs de
   otra planta no entran en la tabla. Derivado y anotado; no lo he seguido más allá.
3. Los **otros ~95 escritores indexados** que el censo nuevo destapa quedan **sin adjudicar** —
   este acta sólo persigue el eslabón. Es población nueva y medida, no un barrido cerrado.
4. **El punto ciego del instrumento es TRANSVERSAL**: cualquier censo previo de una TABLA hecho
   con `abs_refs` está potencialmente a la mitad. → tarjeta propia propuesta; no lo arreglo en
   `re/tools` desde este carril (tocar el instrumento compartido mueve cifras de otros).

## 6. Alcance

Sólo DOCUMENTACIÓN: 1 acta. **Cero código, cero prosa de `game/src`, cero mecánica, cero tests,
no `main.ts`,** no se regeneró `routine-census.json`, y **no toqué `re/tools`** pese a haber
localizado el defecto de `_ABS_RE` (va por tarjeta).
