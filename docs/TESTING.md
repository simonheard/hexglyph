# Testing, limits and roadmap

## Automated suites

`src/test/protocol.test.ts` covers UTF-8 round trips, RS recovery, 2/3-bit packing, interleave bijection and CRC. `channel.test.ts` checks OKLab separation and adaptive color behavior. `vision.test.ts` constructs actual raster cells and drives the same boundary/calibration/classification/ECC decoder used by the UI.

Run `npm test`. The synthetic channel currently asserts clean, right-angle rotation, mild perspective, JPEG quality 55, mild blur plus white-balance shift, and small occlusion at 24 px pitch. Tests are deterministic so regressions are reproducible.

## What is not yet validated

- perspective and crop limits beyond the checked-in mild trapezoid
- JPEG quality sweep beyond the checked-in quality-55 case
- continuous-angle rotation with resampling
- motion blur directions and lengths
- phone screen moiré and PWM banding
- real camera Bayer/demosaic behavior
- printer/ink/paper/ICC combinations
- curved paper and local lens distortion
- statistically credible success rates or BER curves

The UI should therefore be treated as a working V1 prototype with a verified self-round-trip and bounded synthetic envelope, not as a production scanner.

## Next engineering work

1. Capture a versioned phone/printer corpus and publish per-transform success, symbol error, correction and erasure rates.
2. Add border timing counts so radius is measured instead of searched.
3. Use calibration covariance and shape likelihoods, then pass low-confidence bytes as RS erasures.
4. Fit local thin-plate or mesh warps from sparse grayscale anchors for large/curved codes.
5. Split payloads across multiple RS blocks with block-aware spatial scheduling.
6. Add a worker and coarse-to-fine search so camera scanning stays interactive.
7. Search palettes under measured camera and CMYK transforms rather than generic RGB perturbations.
