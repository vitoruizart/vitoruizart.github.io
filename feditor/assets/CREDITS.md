# Bundled assets — credits & licensing

All bundled assets are **procedurally generated** SVG → PNG/JPG via
`assets/build-assets.mjs` (run with `node assets/build-assets.mjs`).
License: **CC0 / public domain** (created in this repo).

## Frames (`assets/frames/*.png`)

7 frames generated as 256×256 tileable edge textures for the 9-slice
renderer in `js/lib/frame-render.js` and the CSS `border-image` live
preview. Styles chosen to cover common real-world aesthetics without
lifting copyrighted reference material:

| ID | Name | sliceWidth | borderFrac | Profile |
| --- | --- | --- | --- | --- |
| `black-thin` | Negro fino | 0.18 | 0.03 | Thin flat matte black with subtle bevel |
| `wood-oak` | Roble natural | 0.28 | 0.06 | Warm tan oak, uniform face with darker inner lip |
| `white-painted` | Blanco pintado | 0.24 | 0.05 | Clean matte white with soft cream lip |
| `gold-classic` | Oro clásico | 0.30 | 0.07 | Bright gold-leaf face with darker inner rabbet |
| `wood-walnut` | Nogal oscuro | 0.26 | 0.055 | Rich dark walnut, deeper brown inner lip |
| `gold-aged` | Oro envejecido | 0.30 | 0.07 | Muted ochre gold with patina tones |
| `canvas-wrap` | Lienzo | 0.20 | 0.035 | Thin off-white linen edge, gallery-wrap look |

## Rooms (`assets/rooms/*.jpg`)

3 neutral "sample wall" backdrops (1600×1067 JPEG): wall plane with soft
top-down lighting vignette, skirting board, and a floor strip below. They
exist solely so the first-run UX has a clean backdrop; the **upload flow**
(camera or photo library) is the primary path for real-world room photos.

| ID | Name | Palette |
| --- | --- | --- |
| `wall-warm-white` | Pared blanca cálida | Warm white wall, walnut floor |
| `wall-cool-grey` | Pared gris frío | Cool grey wall, charcoal floor |
| `wall-warm-beige` | Pared beige | Beige wall, darker wood floor |

## Why no real CC0 photographs?

I evaluated sourcing real CC0 photographs from Wikimedia Commons and the
Met Museum Open Access API. Findings:

- **Empty frame photographs** — Wikimedia has a few (e.g., `Frame MET 45186.jpg`
  from the Met, CC0-dedicated), but they are usually ornate single-piece
  cabinetry (columns, cornice, feet) that does not extract cleanly as a
  tileable 9-slice edge strip. Adding a separate "full-overlay" render
  mode for bundled frames would bloat the renderer for marginal benefit.
- **Residential interior photos** — most Wikimedia results are CC-BY (not
  CC0), which would require attribution UI; interior CC0 photos are rare
  and tend to be dated or cluttered with furniture that obstructs the
  prime wall area.

Given the app's actual use case (the user photographs her clients' own
rooms), bundled defaults are *demo* assets only. Clean procedurally
generated walls + frames serve that role without copyright risk.
