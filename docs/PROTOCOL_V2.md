# HexGlyph Protocol V2

Status: experimental. Byte order is big-endian. V2 keeps the V1 outer hexagon and remains decoder-compatible with legacy `HG1!` symbols.

## Honeycomb geometry

Cell centers retain the triangular axial lattice `(x, y) = (q + r/2, √3·r/2)`. Every V2 cell is rendered as a complete regular hexagon rather than a disc. Its circumradius is `0.94 × pitch / √3`, leaving a narrow optical gutter between neighboring cells so JPEG blur and equal-color runs do not merge into one component.

- ring `R`: continuous black finder boundary
- ring `R−1`: repeated color/marker calibration cells
- rings `0…R−2`: globally interleaved payload symbols
- quiet zone: 3 cell pitches
- supported radii: 13, 17, 21, 25, 29, 33, 37, 41, 45, 49

Robust mode uses four colored hexagons (2 bits/cell) and is the default camera profile. Dense mode adds an inset hexagonal marker for eight states (3 bits/cell), but remains more sensitive to blur and geometry error.

## Protected preamble

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 4 | ASCII `HG2!` |
| 4 | 1 | version = 2 |
| 5 | 1 | flags: bit 0 Dense, bits 1–2 ECC profile |
| 6 | 4 | payload byte length |
| 10 | 4 | CRC32 of the complete payload |

The 14-byte preamble is its own shortened GF(256) Reed–Solomon codeword. V2 uses at least 24 parity bytes per codeword so short metadata and tail blocks are not under-protected.

## Multiple RS blocks

Payload bytes are divided into the largest data chunks whose data plus parity fit the 255-symbol GF(256) codeword ceiling. Depending on ECC profile, full data blocks contain 224, 204, 178, or 152 bytes. The final block is shortened rather than padded to a full codeword.

The encoded preamble and payload codewords are concatenated, converted MSB-first to physical symbols, padded with zero symbols to the selected radius, and permuted over the complete payload area. This global interleave spreads localized damage across codewords while every codeword remains independently correctable.

At radius 49, maximum raw payloads are:

| ECC | Dense | Robust |
|---|---:|---:|
| Low | 2196 B | 1444 B |
| Medium | 2000 B | 1323 B |
| High | 1745 B | 1154 B |
| Extreme | 1496 B | 989 B |

These are protocol limits, not guaranteed camera limits. Larger symbols require more captured pixels per cell. Robust mode and SVG/24 px-per-cell exports remain the recommended defaults.

## Decoder validity

The decoder first tests V2 hypotheses, then falls back to V1. A V2 result is accepted only when the protected preamble decodes, physical mode and ECC flags match the hypothesis, every payload codeword decodes, the reconstructed length matches, and the global CRC32 matches.
