#!/usr/bin/env python3
"""Generate the cute pupu octopus logo.

Design: slim body, long thin tentacles, holding a paper/document (publishing content).
Color: Xiaohongshu red (#FF2442).
Usage: python3 scripts/generate_icon.py [output.png]
"""
import sys
import math
from PIL import Image, ImageDraw

SIZE = 512

# Palette
BODY      = (255, 36, 66)      # Xiaohongshu red #FF2442
OUTLINE   = (214, 20, 50)      # darker red
GLOSS     = (255, 120, 140)    # light highlight
BLUSH     = (255, 118, 138)    # blush (lighter red)
WHITE     = (255, 255, 255)
PUPIL     = (66, 8, 22)
MOUTH     = (150, 16, 38)
PAPER_RED = (255, 36, 66)

# Slim head
CX, CY = 256, 205
RX, RY = 88, 150


def head_edge(a_deg):
    r = math.radians(a_deg)
    return (CX + RX * math.cos(r), CY + RY * math.sin(r))


def catmull_rom(points, spp=26):
    pts = []
    n = len(points)
    for i in range(n - 1):
        p0 = points[max(i - 1, 0)]
        p1 = points[i]
        p2 = points[i + 1]
        p3 = points[min(i + 2, n - 1)]
        for j in range(spp):
            t = j / spp
            t2 = t * t
            t3 = t2 * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
                       (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                       (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
                       (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                       (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            pts.append((x, y))
    pts.append(points[-1])
    return pts


def draw_tentacle(d, ctrl, width=10, tip=7, color=BODY):
    pts = catmull_rom(ctrl)
    d.line(pts, fill=color, width=width, joint="curve")
    d.ellipse([pts[-1][0] - tip, pts[-1][1] - tip,
               pts[-1][0] + tip, pts[-1][1] + tip], fill=color)


def main(out):
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # --- 8 long thin tentacles (fanning down) ---
    angles = [130, 118, 106, 94, 86, 74, 62, 50]
    for a in angles:
        side = 1 if a < 90 else -1
        x0, y0 = head_edge(a)
        ctrl = [
            (x0, y0),
            (x0 + side * 30, y0 + 42),
            (x0 + side * 55, y0 + 88),
            (x0 + side * 62, y0 + 132),
            (x0 + side * 38, y0 + 140),
        ]
        draw_tentacle(d, ctrl)

    # --- paper / document held in front ---
    d.rounded_rectangle([256 - 85, 355, 256 + 85, 480], radius=20,
                        fill=WHITE, outline=OUTLINE, width=5)
    for i, (lx, lw) in enumerate([(60, 150), (70, 130), (60, 140), (70, 120)]):
        yy = 380 + i * 24
        d.rounded_rectangle([256 - lx, yy, 256 - lx + lw, yy + 9],
                            radius=4, fill=PAPER_RED)

    # --- front tentacle hugging the paper ---
    hold = [
        (222, 340),
        (176, 400),
        (192, 456),
        (256, 476),
        (320, 452),
        (336, 428),
    ]
    draw_tentacle(d, hold)

    # --- head (with outline) ---
    d.ellipse([CX - RX - 5, CY - RY - 5, CX + RX + 5, CY + RY + 5], fill=OUTLINE)
    d.ellipse([CX - RX, CY - RY, CX + RX, CY + RY], fill=BODY)
    # gloss (upper-left)
    d.ellipse([CX - RX + 24, CY - RY + 20, CX - RX + 66, CY - RY + 58], fill=GLOSS)

    # --- face ---
    for ex in (CX - 36, CX + 36):          # eyes
        d.ellipse([ex - 28, 200 - 28, ex + 28, 200 + 28], fill=WHITE)
        d.ellipse([ex - 14, 200 - 12, ex + 14, 200 + 16], fill=PUPIL)
        d.ellipse([ex - 7, 200 - 7, ex - 1, 200 - 1], fill=WHITE)
    for bx in (CX - 66, CX + 66):          # blush
        d.ellipse([bx - 16, 258 - 14, bx + 16, 258 + 14], fill=BLUSH)
    # smile (∩)
    d.arc([CX - 30, 250, CX + 30, 292], start=200, end=340, fill=MOUTH, width=8)

    im.save(out)
    print("saved", out, im.size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/pupu_icon2.png")
