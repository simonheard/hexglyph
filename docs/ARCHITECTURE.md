# Architecture and decisions

## Pipeline

`UTF-8 → frame → CRC → RS → symbol packing → spatial permutation → triangular cells → Canvas/SVG`

`image → adaptive grayscale → largest dark connected boundary → convex hull/support vertices → projective map → calibration ring → OKLab + marker classifier → inverse permutation → RS → CRC → UTF-8`

The implementation is split into `protocol/`, `encoder/`, `decoder/`, `vision/`, `ui/`, and `test/`. V1 parameters live in one constants object.

## Answers to the main design questions

1. A hexagon is not globally optimal for raster capacity. It was retained for the visual identity and natural axial lattice; payload density is lower than a rectangular triangular-lattice crop.
2. Triangular sampling is worth keeping experimentally because neighbor distance is isotropic. Its coordinate/projective code is modest; contour recovery is the expensive part.
3. Eight-state cells work at adequate pitch in synthetic tests, but the marker is the weaker subchannel. Robust 4-color mode exists for real-world capture.
4. A 30% marker radius failed after small boundary errors. V1 uses 46%.
5. A 16% pitch gap prevents adjacent components joining while preserving chroma area.
6. Payload outlines were rejected; they reduce useful color and create grayscale clutter.
7. The full `R−1` ring provides many distributed calibration samples rather than a few fragile blocks.
8. The continuous border is reliable on clean backgrounds with the quiet zone; a complete-border requirement is a known limitation.
9. Twelve symmetry hypotheses plus RS/CRC remove rotation and mirror ambiguity. Sync dashes can later accelerate the search.
10. V1 searches a finite radius table. Border-center inset depends on each radius hypothesis. A true timing-count decoder is future work.
11. Projective correction is global only. Curved media and lens distortion require local refinement.
12. Anchors should begin when curvature error approaches roughly 0.15 pitch, not at an arbitrary code size. V1 lacks that estimator and therefore does not spend anchor overhead.
13. One RS(≤255) block keeps V1 auditable. V2 should shard larger data into equal interleaved blocks.
14. A full-area coprime permutation spreads adjacent logical symbols; this turns compact damage into sparse RS errors.
15. Erasure decoding is valuable. Confidence is retained, but the current ZXing RS adapter uses hard decisions.
16. Small PNGs are fragile. The UI defaults to 24 px pitch and warns against less than 18 px in Dense mode.
17. SVG is preferable for print and is included; PNG is preferable for exact browser upload round trips.
18. Moiré is not solved. Use integer display scaling, larger pitch and slight camera defocus; a frequency-aware V2 renderer is possible.
19. CMYK conversion can collapse cyan/green distances. In-code calibration helps, but Robust mode and a print ICC corpus are required.
20. Robust 2-bit/cell mode is implemented, not merely proposed.

## Security and privacy

Encoding and decoding are local browser operations. Camera frames are not uploaded by this application. Uploaded images are decoded in memory. The site has no backend and stores no payload.

