#!/usr/bin/env python3
"""
Pre-crop the four full-page product screenshots into the specific
regions used by the bento cards. Running this script regenerates the
crop files; the bento components reference the outputs by filename.

Source images (in public/screenshots/):
  results.png    2472 x 1370
  outreach.png   2784 x 1122
  followups.png  2810 x 1234
  analytics.png  2822 x 1088

Each crop tuple is (x, y, w, h) on the source image.
Adjust values here, re-run, and the bento auto-picks up the new crops.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "screenshots"


def crop(source: str, region: tuple[int, int, int, int], out: str) -> None:
    """Crop source[x,y,w,h] -> out. Coordinates are top-left origin."""
    img = Image.open(SRC / source)
    x, y, w, h = region
    box = (x, y, x + w, y + h)
    img.crop(box).save(SRC / out)
    print(f"  {source} {box} -> {out}  ({w}x{h})")


# Card 1 — "Smart search across every platform" (wide, col-span-2)
# Top of Results: search bar + Suggested Searches + tabs + table header + first rows.
crop("results.png", (0, 0, 2472, 950), "bento-search.png")

# Card 2 — "AI fit scoring" (single col, taller)
# Channel + Fit Score columns, header through row 5 — chips are the hero.
crop("results.png", (130, 380, 870, 940), "bento-fit.png")

# Card 3 — "Built-in CRM" — promoted to col-span-2 (wide) so we can
# show the full table context: Channel + YT + Email + Status pills.
# Skip the customize/manually-add row at top, start at table header,
# show 4 rows of complete CRM data.
crop("outreach.png", (130, 270, 2270, 700), "bento-status.png")

# Card 4 — "Smart follow-up cadence" — demoted to col-span-1 (narrow).
# Crop the LEFT half of leads list (avatar + name + meta) for 5 leads.
# Source is 2810x1234, so y=530 + h=700 = 1230 keeps us in-bounds —
# previously had h=900 which extended past the image and rendered as
# a big white block at the bottom of the visual.
# Badges/buttons live on the right edge so they don't survive a
# narrow-column crop; the cadence concept comes through via the
# "First follow-up · X touches · reached Yd ago" meta lines.
crop("followups.png", (0, 530, 1500, 700), "bento-priority.png")

# Card 5 — "Analytics + custom metrics" (col-span-3) — zoom in on
# KPI cards + status breakdown only. Skip the velocity/medium row
# at the bottom which clutters at small card size.
crop("analytics.png", (0, 240, 2822, 600), "bento-analytics.png")
