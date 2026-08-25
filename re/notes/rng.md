# Exact kernel RNG (Task 1.3)

> English migration of `re/notes/rng.md` (the Spanish note in the private repo remains the source of truth; translated 2026-07-22).

The random number generator of ULTIMA.EXE, re-derived from the assembly and
verified live against the binary under dosbox-x. **It is NOT the standard
Borland LCG** (`x*0x015A4E35 + 1`): it is a custom 16-bit add/rotate/xor
generator over a single word seed.

Bit-exact TypeScript port: `game/src/core/rng-original.ts` (`OriginalRng`).
Fixed vectors: `game/tests/rng-original.test.ts`. Parity against the real
binary: `re/tools/test_rng_parity.py`.

## Location

Three contiguous routines in the kernel's code pool (offsets over the 34544 B
post-header image, `binfiles.get("ULTIMA.EXE")`, code_offset=2048; file offset
= 0x800 + code offset):

| Code offset | Bytes | Routine | Signature |
|-------------|-------|---------|-----------|
| `0x2056–0x207C` | 39 | `rng_time_hash()` — DOS time hash → seed | no args, `ret` |
| `0x207E–0x2090` | 19 | `rng_srand(n)` — seeds `g_rng_seed` | 1 word arg, `ret 2` |
| `0x2092–0x20C7` | 54 | `rng_rand_range(lo, hi)` — THE game's rand | 2 word args, `ret 4` |

How it was found: searching `re/disasm/ULTIMA.EXE.asm` for `mov ah, 0x2c` +
`int 0x21` (INT 21h AH=2Ch, "get time", the typical seed source) — a single
hit at 0x205C — and from there the two following routines, which store into
the word global `0x5420` (**g_rng_seed**). The raw EXE bytes confirm the three
`55 8b ec` prologues (verified against `original/u5/ultima5/ULTIMA.EXE`; the
linear listing from disasm.py misaligns by 1 byte at 0x207D/0x2091 due to the
0x00 padding bytes between routines — the listing below is realigned with
capstone from each real prologue).

## Listing (realigned, annotated)

### `rng_rand_range(lo, hi)` @ 0x2092 — the heart

```
2092: 55               push bp
2093: 8bec             mov bp, sp
2095: 56               push si
2096: 57               push di
2097: 1e               push ds
2098: a12054           mov ax, [g_rng_seed]     ; DS:0x5420
209b: 054892           add ax, 0x9248
209e: d1c8             ror ax, 1
20a0: d1c8             ror ax, 1
20a2: d1c8             ror ax, 1                ; ror16(x, 3)
20a4: 354892           xor ax, 0x9248
20a7: 051100           add ax, 0x11
20aa: a32054           mov [g_rng_seed], ax     ; new seed
20ad: 25ff7f           and ax, 0x7fff           ; 15 bits
20b0: 8b5e06           mov bx, [bp + 6]         ; lo (first push)
20b3: 8b4e04           mov cx, [bp + 4]         ; hi (second push)
20b6: 2bcb             sub cx, bx
20b8: 41               inc cx                   ; cx = hi - lo + 1
20b9: 33d2             xor dx, dx
20bb: f7f1             div cx                   ; dx = remainder
20bd: 03d3             add dx, bx
20bf: 8bc2             mov ax, dx               ; return: lo + remainder
20c1: 1f               pop ds
20c2: 5f               pop di
20c3: 5e               pop si
20c4: 5d               pop bp
20c5: c20400           ret 4                    ; pascal convention
```

### `rng_srand(n)` @ 0x207E

```
207e: 55 8b ec 56 57 1e          ; prologue
2084: 8b4604           mov ax, [bp + 4]
2087: a32054           mov [g_rng_seed], ax
208a: 1f 5f 5e 5d                ; epilogue
208e: c20200           ret 2
```

### `rng_time_hash()` @ 0x2056

```
2056: 55 8b ec 56 57 1e          ; prologue
205c: b42c             mov ah, 0x2c
205e: cd21             int 0x21         ; CH=hour CL=min DH=sec DL=1/100s
2060: 33c0             xor ax, ax
2062: d0e5             shl ch, 1        ; ch = hour*2   (mod 256)
2064: d0e1             shl cl, 1
2066: d0e1             shl cl, 1        ; cl = min*4    (mod 256)
2068: d0e6             shl dh, 1
206a: d0e6             shl dh, 1
206c: d0e6             shl dh, 1        ; dh = sec*8    (mod 256)
206e: 03c2             add ax, dx       ; ax = (sec*8)<<8 | hundredths
2070: 03c1             add ax, cx       ; ax += (hour*2)<<8 | min*4
2072: 35eb91           xor ax, 0x91eb
2075: 25ff0f           and ax, 0xfff    ; return ∈ [0, 0xFFF]
2078: 1f 5f 5e 5d c3              ; epilogue + ret
```

## Re-derived formula

State: **one word seed** in `g_rng_seed` (DS-relative `0x5420`, DGROUP BSS,
outside the SAVED.GAM window — the seed is NOT saved with the game).

Raw step (all 16-bit arithmetic):

```
x  = (seed + 0x9248) & 0xFFFF
x  = ror16(x, 3)                # (x >> 3) | (x << 13)
x  = x ^ 0x9248
x  = (x + 0x11) & 0xFFFF
seed = x                        # the seed IS the last raw value
```

Value returned by `rand_range(lo, hi)` — **both inclusive**:

```
return = lo + ((x & 0x7FFF) % (hi - lo + 1))
```

Seeding: `srand(n)` copies the word as-is. The original's "random" source is
`time_hash()`:
`((((sec*8&0xFF)<<8 | hundredths) + ((hour*2&0xFF)<<8 | min*4&0xFF)) ^ 0x91EB) & 0xFFF`.

Properties: the raw step is a 16-bit bijection (add/ror/xor/add are all
invertible), so there is no convergence into degenerate cycles; the cycle
containing seed 0 has length 47343 (measured with the Python model).

## Usage in the binary

- **22 near call sites inside the kernel** (`call 0x2092`, byte-by-byte scan
  for `e8 rel16`): 0x2acf, 0x2f70, 0x2f81, 0x2f90, 0x2ff4, 0x3001, 0x30b4,
  0x30e8, 0x3119, 0x314c, 0x3ab7, 0x3d13, 0x4043, 0x4625, 0x466d, 0x469f,
  0x500c, 0x51b3, 0x6a1a, 0x6c23, 0x6ca7, 0x6cbb.
  Range examples: `push 1; push 8` → 1..8 (0x2ac7); `push 0; push 0x3f`
  → 0..63 (0x2f69). Push order is lo first, hi second (pascal convention:
  `[bp+6]`=lo, `[bp+4]`=hi).
- **[Resolved in Task 1.4]** The overlays DO call the three routines, with a
  direct **near** `call`: all code shares a single 64K CS (see
  `re/notes/command-dispatch.md` §3–§4). The original scan of the .asm files
  gave 0 hits because the overlays' near targets must be rebased with their
  load segment (mod 64K). Census via
  `dispatch_table.near_calls_to_kernel()`:
  - `rand_range` (0x2092): **149 call sites across 18 overlays** (SJOG 24,
    MAINOUT 20, DUNGEON/SHOPPES 14, TOWN 12, COMBAT/CMDS/COMSUBS 10…, the 18
    figures sum to 149), plus the kernel's 22 = **171 total**. Number pinned
    against `dispatch_table.near_calls_to_kernel()` in
    `test_dispatch.test_rng_census_matches_tool` (cannot drift).
  - `rng_srand` (0x207E): TOWN ×2, CMDS ×1, TALK ×2.
  - `rng_time_hash` (0x2056): TOWN ×1, CMDS ×1, TALK ×2 — re-seeding from the
    DOS clock happens on TOWN/CMDS/TALK events, not in INTRO.
- `lcall [0x5350]` was NOT the overlay→kernel linkage: it is the sound driver
  vector (`T1K.DRV`/`HER.DRV`, `g_snd_driver_fn/seg`); see
  command-dispatch.md §4. Note: `g_rng_seed` (DS:0x5420) lives INSIDE the
  DATA.OVL image loaded in RAM (fileoff 0x5430, 00 00 on file), not in the
  minalloc BSS — same practical behaviour: the seed starts at 0 unless
  re-seeded.

## Live verification (parity, `re/tools/test_rng_parity.py`)

Method: boot the oracle into the world; write a known seed into `g_rng_seed`
with `SM DS:5420`; arm a code breakpoint at the entry of `rand_range`
(`BP load_seg:2092`, physical 0xA2D2 with the deterministic config) together
with the `BPINT 8` pulse; resume repeatedly injecting Space (pass turn) to
force randomness consumption, and on each BP hit read `g_rng_seed`. Every
observed seed must fall on the exact ORBIT predicted by (a) the Python model
of the assembly and (b) the TS clone (`OriginalRng`, invoked via tsx), at
non-decreasing indices.

The assertion is by ordered membership in the orbit rather than by consecutive
transitions because the observation channel (debugger over a pty) can drop or
duplicate a pause (the "±1 probe" caveat of oracle.md). Observed live
(2026-07-09): with seed 0x1234 the sampling captured the 5 exact consecutive
transitions; with seed 0xBEEF it captured orbit indices [0,2,2,4,5,6] — ALL
values on the predicted orbit, with one hit lost and another duplicated by the
pty. As a parity proof it is just as strong: the probability that a wrong
formula produces ≥5 16-bit words falling in order on the correct orbit is
negligible. Verifying the seed's evolution is equivalent to verifying the
returned values because the return←seed derivation (`and 0x7fff / div / add`)
is proven by the assembly bytes above.

## Ledger / globals

- `re/ledger/globals.json`: `g_rng_seed` @ 0x5420, size 2, with this note as
  evidence.
- `re/ledger/coverage.json`: the 114 bytes 0x2056–0x20C7 (the three routines +
  padding) marked as verified `code`, notes → this doc.
