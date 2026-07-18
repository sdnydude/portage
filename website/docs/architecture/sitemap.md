---
id: sitemap
title: App Sitemap
sidebar_position: 5
---

# App Sitemap

Visual map of every shipped route (38 pages) plus the full-screen panels and
overlays, with typed connectors:

- **solid green** — route navigation
- **dashed teal** — overlay / panel that opens without a route change
  (ScanFlow, multi-shot Camera, Photo Editor, pan/zoom Crop, Create Listing sheet)
- **orange** — external jump (Ship-It → eBay item page)

The diagrams are **generated from the real route tree** (`apps/web/src/app`)
by [`website/scripts/gen_sitemaps.py`](https://github.com/sdnydude/portage/blob/main/website/scripts/gen_sitemaps.py),
which also machine-checks that no connector line crosses a page card. When
routes change, update the data in that script and re-run:

```bash
python3 website/scripts/gen_sitemaps.py   # exits non-zero on any wire/card collision
```

## Landscape (full)

[Open full size](/portage/img/sitemap/portage-sitemap.svg) ·
[Printable PDF (A3 landscape)](/portage/img/sitemap/portage-sitemap.pdf)

![Portage sitemap — landscape](/portage/img/sitemap/portage-sitemap.svg)

## Landscape, admin collapsed

The 11 admin pages summarized as a single card — the day-to-day product view.

[Open full size](/portage/img/sitemap/portage-sitemap-admin-collapsed.svg)

![Portage sitemap — admin collapsed](/portage/img/sitemap/portage-sitemap-admin-collapsed.svg)

## Vertical

Single-column orientation for narrow screens and side-by-side reading.

[Open full size](/portage/img/sitemap/portage-sitemap-vertical.svg)

![Portage sitemap — vertical](/portage/img/sitemap/portage-sitemap-vertical.svg)
