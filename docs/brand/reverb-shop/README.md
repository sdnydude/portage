# Reverb Shop Brand Assets — Digital Harmony Group Closet

Banner candidates for the DHG Closet Reverb shop (960×160, Reverb's shop-banner spec), 2026-07-08.

## Final candidates (rackmount series)

| File | Variant |
|------|---------|
| `rack-a1-vu-needle.png` | A1 — blackface faceplate, analog VU needle meter |
| `rack-a2-silverface.png` | A2 — brushed aluminum, black skirted knobs |
| `rack-a3-orange-badge.png` | A3 — orange anodized brand badge, cream knobs |

`dhg-closet-reverb-banner.png` is the earlier overtone-series concept (superseded).

## Regenerating

Generators are self-contained node scripts (need `sharp` — point the import at any repo `node_modules`, plus Outfit/DM Mono TTFs installed for librsvg, e.g. in `~/.fonts`):

```bash
node renderA.mjs    # the three rackmount variants
node render3.mjs    # the three original directions (rackmount/catalog/tape)
node render.mjs     # overtone-series concept
```

Knob labels, colors, and copy are plain constants in the scripts. `overtone-philosophy.md` documents the design language. Shop description text lives in the 2026-07-08 session log.
