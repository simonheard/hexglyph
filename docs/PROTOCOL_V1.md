# HexGlyph Protocol V1

Status: experimental. Byte order is big-endian.

## Physical geometry

Cells use axial coordinates `(q, r)` and map to `(x, y) = (q + r/2, √3·r/2)`. A code of radius `R` contains the axial hexagon `max(|q|, |r|, |q+r|) ≤ R`.

- ring `R`: continuous black finder/boundary, not payload cells
- ring `R−1`: repeated calibration cells
- rings `0…R−2`: interleaved payload symbols
- quiet zone: 3 cell pitches
- supported radii: 13, 17, 21, 25, 29, 33, 37, 41

Six contour vertices establish a projective frame. Candidate radius, rotation and mirror state are searched; protocol validation selects the answer. This is slower than explicit metadata timing marks, but a damaged metadata bit cannot destroy geometry recovery.

## Symbol channel

Palette: `#17191d`, `#ef4638`, `#4fbd48`, `#13bad2`. These are dark neutral, warm red, bright green and bright cyan. A small OKLab search increased the minimum selected-palette separation from 0.126 to 0.183. Pure blue was rejected despite high ideal-space distance because its low luminance approaches black under blur/exposure. Calibration learns the captured centers, so these values define rendering, not decoder thresholds.

Dense symbols are `(colorIndex << 1) | marker`. The marker is light on black and dark on chromatic colors. Robust symbols are `colorIndex` and carry no shape bit.

Disc diameter is 84% of pitch. Marker radius is 46% of disc radius. Calibration ring cells, sorted by polar angle, repeat physical symbols 0…7.

## Logical frame

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 4 | ASCII `HG1!` |
| 4 | 1 | version = 1 |
| 5 | 1 | flags: bit 0 Dense, bits 1–2 ECC profile |
| 6 | 4 | UTF-8 payload byte length |
| 10 | 4 | CRC32 of payload |
| 14 | N | payload bytes |

The whole frame is encoded as one GF(256) Reed–Solomon codeword. Parity is `max(8, ceil(dataBytes × ratio / (1−ratio)))`, where ratios are 12%, 20%, 30%, or 40%. Total frame + parity must not exceed 255 bytes.

RS output bytes are converted MSB-first to 3-bit Dense or 2-bit Robust symbols. Padding symbols are zero. A seeded modular permutation places logical symbols over all payload cells. Seed is `(radius << 8) | bitsPerCell`; the coprime permutation step guarantees a bijection.

## Decoder validity

A decode is accepted only if RS succeeds, magic/version match, the decoded byte count matches the frame length, and CRC32 matches. All other orientation, mirror, radius and physical-mode hypotheses are rejected.

Cell readings preserve best symbol and confidence. The current RS path uses hard decisions; confidence drives the overlay and leaves an API seam for erasure/soft decoding.
