Source: DryRain — Pixel Platformer VFX General Pack 1
https://dryrainent.itch.io/ppvfx-general-1

License: free for personal and commercial use, modification allowed. Reselling
the pack itself is not permitted. Attribution is not required by the license
but is given anyway — see the root [README.md](../../../README.md) Acknowledgements section.

This is the full pack as downloaded, kept here so other effects (dust,
sparks, smoke, pulses, beams, debris) are available without re-downloading
if a future feature wants them. Nothing in this folder is served by the
site — `public/` is what actually ships. Currently in live use,
cropped/copied into `public/assets/vfx/`:

- `splash_small.png` -> `public/assets/vfx/footstep-splash.png`
- `blast_small.png` -> `public/assets/vfx/bullet-blast.png`

`dust_side.png` was used for a dry-ground footstep effect that has since
been removed in favor of keeping only the rain splash; the frames are still
here if that's revisited.

`effects.png` + `effects.json` is a combined Aseprite atlas covering every
effect in the pack (including ones not broken out as standalone strips); the
individual `*.png` files are simple horizontal frame strips (32x32 per
frame) cut from the same source and are the easier starting point for
`k.loadSprite(..., { sliceX, sliceY: 1 })`.
