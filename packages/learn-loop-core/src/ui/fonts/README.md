# ExperimentLab self-hosted fonts

These `.woff2` files are bundled by Vite as assets (referenced by relative
`url()` in the `@font-face` blocks in `../experimentLab.css`). There is **no**
runtime CDN / `@import url(...)` — the package stays lean and offline-capable.

| Face | Role | Weights | License |
| :-- | :-- | :-- | :-- |
| **Space Grotesk** | display — titles, concept names, headlines | 500, 600, 700 | SIL OFL 1.1 — see `LICENSE-SpaceGrotesk.txt` |
| **JetBrains Mono** | data / mono — readings grid figures | 500, 700 | SIL OFL 1.1 — see `LICENSE-JetBrainsMono.txt` |

Only the Latin subset is shipped (the viewport UI copy is Latin; sample data may
carry a few sub/superscript symbols like `H₂` which are in the subset). All
`@font-face` declarations use `font-display: swap` so text is never invisible
while a face loads.

Source: the upstream OFL font projects, mirrored via the fontsource CDN
(`cdn.jsdelivr.net/fontsource/...`) at build-authoring time only. The files
themselves are committed here; nothing is fetched at runtime.
