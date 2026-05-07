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

# Card 3 — "Built-in CRM" (single col, taller)
# Email + Status columns from Outreach board — colored status pills are the hero.
# Tightened to start cleanly at the table header (skip "Add manually" sliver).
crop("outreach.png", (1480, 320, 920, 800), "bento-status.png")

# Card 4 — "Smart follow-up cadence" (wide, col-span-2)
# 4 priority cards + first leads from Follow-ups page.
# Tightened: skip the leftover sub-tab fragment, start clean at "9 high priority".
crop("followups.png", (0, 130, 2810, 860), "bento-priority.png")

# Card 5 — "Analytics + custom metrics" (full-width, col-span-3)
# KPI cards row + status breakdown bar.
crop("analytics.png", (0, 240, 2822, 720), "bento-analytics.png")
