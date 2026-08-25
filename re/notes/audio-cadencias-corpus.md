# Cadencias medidas + censo de jingles del corpus AV (carril audio-cadencias)

Medidas por frames (VFR-aware: pts_time reales de cada frame, `signalstats.YDIF`)
sobre los vídeos del usuario en `original/av-referencia/` (gitignored). Cero
navegadores, cero playwright — solo ffmpeg/numpy local.

## 1. Tabla medido-vs-port

| cadencia | fuente testigo | medido | port | delta / veredicto |
|---|---|---|---|---|
| Tick base de animación | (ya calibrado, video-H, spec 2026-07-14) | ~55 ms (BIOS 18.2 Hz) | `ANIM_TICK_MS = 55` (skin.ts) | ✓ calibrado |
| Tiles de agua | video-B (frame-diff, 65 eventos) | **117 ms** modal (cuant. VFR 100/117/133) | 2 ticks = 110 ms | −7 ms (≈ cuantización del VFR a 1/60): ✓ fiel |
| Cursor de consola | video-H (ya medido por autocorrelación en su día) | ~100-110 ms toggle | 2 ticks = 110 ms | ✓ fiel |
| Paso a pie, repetición MÁXIMA (tecla sostenida) | video-A (12 saltos de viewport, YDIF>5) | ráfaga sostenida **162-200 ms/paso** (mín 162) | slide `TWEEN_MS = 150` + turno | port permite ~6.6 pasos/s vs ~5-6 del original: compatible; el original SALTA (sin slide), el slide de 150 ms es decisión de usuario documentada |
| Paso a pie, ritmo deliberado | video-B (5 saltos) | 433-450 ms/paso | (limitado por tecleo) | n/a — paced por el jugador |
| Combate: micro-eventos intra-ronda (proyectiles/actores en secuencia) | video-J (histograma inter-evento YDIF>4) | moda 60-100 ms + meseta 100-260 ms | `PROJECTILE_MS_PER_CELL=55`, `HIT_FLASH_MS=120` | consistente (60-100 ≈ tick base; 100-260 = secuenciación de actores); medida CONFUNDIDA por input del jugador — no sirve de sello fino |
| Combate: cadencia de ronda | video-J (autocorrelación de actividad) | ~1.0 s (débil, 0.22) y ~1.85 s | — | paced por jugador; solo orientativo |
| Texto de consola/diálogo (página del endgame) | endgame-victoria 105-135 s | página completa en **25-100 ms** (1-3 frames) | pintado inmediato | ✓ paridad: NO hay efecto máquina-de-escribir en el original |
| Beep de página del endgame (dur 0x28) | endgame-victoria 110/114/128 s | **1.9-2.4 s** de zumbido grave pulsado (duty 40-50%) | `endgame-beep`: `beep(1000 Hz, n·8)` ≈ 0.30 s | ✗ DELTA GRANDE de carácter y duración — ver fanfarria-endgame-espectral.md §5 |
| Ping re-tinte verde (dur 2,3) | endgame-victoria ~27 s | 2.8 s activo (dos pulsos, duty 32%) | ≈ 0.04 s | ✗ mismo delta de familia (beep 0x3ae6 = zumbido, no pitido) |

Notas:
- Los vídeos del usuario son grabaciones de pantalla VFR (frame solo al cambiar):
  las duraciones se leyeron de `pts_time`, no de un fps nominal.
- quake (42/75 ms), moongate (32/60 ms), harpsi y camp-song ya estaban calibrados
  por sus carriles; no se re-midieron.

## 2. Censo de jingles: qué emite el original que el port NO tiene

Del corpus + catálogo (`sfx-catalog.md`), lista honesta con dónde se oye:

| sonido | testigo (timestamps) | estado en port |
|---|---|---|
| **Fanfarria del pergamino** (~14.3 s, multi-capa) | endgame-victoria 139.3-153.6 s | **NO EXISTE** — esqueleto de 24 notas PIT medido en `fanfarria-endgame-espectral.md`; rutina ASM sin identificar (GAP 8) |
| **Carácter real del beep endgame 0x3ae6** (zumbido grave, no pitido) | endgame-victoria 26-29/110/114/128 s; endgame-varado 73.9 s→fin (beep terminal sostenido) | cue existe (`endgame-beep`) pero con timbre/duración divergentes (Clase-C declarado en speaker.ts) |
| Tono de entrada a pueblo ~2223 Hz | (pendiente →AV task #4, sfx-catalog §) | NO cableado |
| «Borrowed!» de antorcha `GL(800→2000,1,50)` (SJOG 0x1a21) | — | NO cableado (bloqueado por Clase-C #69: el «Borrowed!» del port es el robo-de-plato divergente) |
| golpe pesado vs estándar (`band 500` vs `2000`) | — | main.ts emite solo `combat-hit` (distinción →AV) |
| instrumento por comando TOWN 0xe40 | — | cue `instrument-note` existe; el comando «tocar» no está portado |
| Ambiente clase 4 (Codex 0x5c-5f) | — | sin cablear (tabla [0x6a48] →AV) |

No se encontraron jingles NUEVOS no censados: todos los eventos audibles de los
vídeos del endgame (combate 5-24 s, ping verde, secuencia moongate/Orb ~52-56 s,
beeps de página, fanfarria) casan con el censo GAP 8 salvo la fanfarria, que era
el hueco conocido y ahora tiene medición.

Sobre los LPs de YouTube: el audio de aulddragon y alexdiener lleva voz continua
encima (verificado también en el final del ep25) — sirven para careos de banda
estrecha puntuales, no para derivar timbres. Los WAV limpios de
`av-referencia/audio/` (paso + cascada) ya están explotados por la calibración
DELAY_UNIT_MS (task #72).

## 3. Recomendaciones de aterrizaje (decisión del lead)

1. **Fanfarria**: NO aterrizar aún; esperar disasm (pista concreta: clientes PIT
   de la tabla del motor 0x42d2 — ver §5 de la nota espectral). El esqueleto §4
   queda listo si se decide un placeholder Clase-C honesto.
2. **endgame-beep**: candidato a re-modelado (zumbido grave pulsado ~50-90 Hz
   efectivo con duración ∝ n real, en vez de `beep(1000)`) — es witness-derived
   directo del mismo testigo 2:34 ya bendecido; barato y muy audible en el endgame.
3. **Cadencias**: nada que corregir — tick base, agua, cursor y texto están fieles;
   el slide de 150 ms es decisión documentada de usuario y no colisiona con la
   cadencia máxima medida del original.
