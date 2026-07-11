#!/usr/bin/env python3
"""Generate the extension icons (16/48/128) with zero dependencies.

Draws the brand mark: rounded square with the app's purple→blue
gradient and a white "C" ring. Pure stdlib (zlib + struct) so it runs
anywhere; re-run after design tweaks: python3 extension/icons/gen_icons.py
"""
import math
import struct
import zlib


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: str, size: int, pixel_fn) -> None:
    rows = b""
    for y in range(size):
        row = b"\x00"  # filter type 0
        for x in range(size):
            r, g, b, a = pixel_fn(x, y, size)
            row += bytes((r, g, b, a))
        rows += row
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # RGBA8
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(rows, 9))
        + png_chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


def lerp(a, b, t):
    return a + (b - a) * t


def pixel(x, y, size):
    n = size
    cx, cy = (n - 1) / 2, (n - 1) / 2
    # Rounded-square mask
    radius = n * 0.22
    ix = min(max(x, radius), n - 1 - radius)
    iy = min(max(y, radius), n - 1 - radius)
    d_corner = math.hypot(x - ix, y - iy)
    if d_corner > radius:
        return (0, 0, 0, 0)
    # Diagonal gradient #8b5cf6 → #3b82f6
    t = (x + y) / (2 * (n - 1))
    r = int(lerp(0x8B, 0x3B, t))
    g = int(lerp(0x5C, 0x82, t))
    b = int(lerp(0xF6, 0xF6, t))
    # White "C": ring with a right-side notch
    d = math.hypot(x - cx, y - cy)
    r_outer, r_inner = n * 0.335, n * 0.20
    if r_inner <= d <= r_outer:
        ang = math.degrees(math.atan2(y - cy, x - cx))  # -180..180, 0 = right
        if not (-42 <= ang <= 42):  # notch opens rightward
            return (255, 255, 255, 255)
    return (r, g, b, 255)


if __name__ == "__main__":
    import os

    here = os.path.dirname(os.path.abspath(__file__))
    for s in (16, 48, 128):
        write_png(os.path.join(here, f"icon{s}.png"), s, pixel)
        print(f"wrote icon{s}.png")
