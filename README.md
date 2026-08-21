# HexGlyph Lab

HexGlyph is an experimental, self-contained 2D visual code. It is **not QR-compatible**. Protocol V1 combines a regular hexagonal silhouette, triangular-lattice sampling, four adaptive colors, an optional center marker, Reed–Solomon error correction, and spatial interleaving.

The repository contains the browser encoder, PNG/SVG export, upload and camera decoder, confidence/debug overlay, protocol implementation, and deterministic logical/image-channel tests.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL. Generate a symbol in **Encode**, download it, then upload it in **Decode**. Camera access requires HTTPS or localhost.

```bash
npm test          # logical, palette and synthetic image tests
npm run build     # production bundle in dist/
npm run palette   # compare candidate palette separation
```

For Cloudflare Pages, use build command `npm run build` and output directory `dist`.

## What V1 deliberately changed

- The outer shape stays hexagonal because it gives three equivalent lattice directions and a distinctive silhouette. It is less pixel-efficient than a rectangular crop and makes recovery harder, but those costs are acceptable for this research format. A rectangular transport profile remains a plausible V2 option.
- The border is a continuous high-contrast grayscale hexagon. Geometry is recovered before color. Rotation and reflection are resolved by trying all 12 symmetries and accepting only a valid magic/version + RS + CRC result. The three border dashes are a fast-path orientation hint, not a correctness dependency.
- The proposed tiny marker was enlarged: its radius is **46% of the colored-disc radius**. Tests showed that 30% was frequently missed after small corner errors and blur. A dot keeps more color area and survives blur better than a hollow ring.
- Cell discs use a 16% pitch gap. They have no outline: an outline consumes chroma area and increases accidental component merging. Black is dark neutral rather than absolute black.
- V1 supports **Dense** (4 colors × marker = 8 symbols, 3 bits/cell) and **Robust** (4 colors only, 2 bits/cell). Robust mode is the safer print/camera choice.
- A complete inner ring repeats all eight symbols as in-image calibration references. Classification uses adaptive observed color centers in OKLab space, never fixed RGB thresholds.
- V1 uses one GF(256) RS codeword (255-byte ceiling) and deterministic full-area interleaving. This is intentionally bounded and easy to verify. Larger payloads need V2 multi-block framing.
- Large-code local alignment anchors are not enabled in V1. The current implementation has no reliable local-warp estimator, so reserving anchor cells would add overhead without delivering correction. This is documented instead of pretending the feature works.

## Current verified envelope

Automated synthetic tests use 24 px pitch and Extreme ECC. The checked-in suite currently verifies:

- clean encoder-style raster: 1/1
- 90° rotation: 1/1
- mild projective trapezoid warp: 1/1
- JPEG quality 55 round trip: 1/1
- mild 3×3 blur mixed at 45% plus per-channel white-balance drift: 1/1
- 24×24 px localized white occlusion: 1/1
- sparse spatial symbol damage through RS: 1/1
- UTF-8/packing/interleave/CRC/palette invariants: 10 logical/channel assertions total (16 total tests)

This is a deterministic regression envelope, **not a statistically meaningful phone-camera success rate**. Moiré, curved paper, crop, motion blur and real printer/camera matrices still need a captured corpus. Do not use V1 for safety-critical data.

## Recommended capture conditions

- Export at 24 px/cell or above; do not rasterize below 18 px/cell for Dense mode.
- Keep the three-cell white quiet zone intact.
- Avoid screen scaling that produces fractional cell pitch; SVG is best for print.
- Prefer Robust mode for colored printing, dim light, heavy JPEG, or screen-to-camera capture.
- Keep the entire black boundary visible. V1 does not recover from a cropped finder border.

## Documentation

- [Protocol V1](docs/PROTOCOL_V1.md)
- [Architecture and engineering decisions](docs/ARCHITECTURE.md)
- [Testing and next work](docs/TESTING.md)

## License

MIT
