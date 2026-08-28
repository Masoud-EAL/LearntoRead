#!/usr/bin/env python3
"""Build icons/body-*.svg from the labelled reference sheet.

Generated assets — do not edit icons/body-*.svg by hand. Edit this script and
re-run it:

    python3 -m pip install pillow potracer   # build-time only, nothing ships
    python3 tools/build-body-icons.py

tools/body-parts-source.png is an 8x3 grid of flashcards, one per word in
SPELL_BODY (game.html), each with a text label underneath. The label is cropped
away — the icons carry no text, because the learner is being asked to write the
word.

The art is flat cel-shaded with dark outlines, which colour-traces cleanly: each
card is flattened onto one palette shared by all 24 icons, and every colour is
traced with potrace and painted largest-area-first, each layer holding the union
of itself and everything painted after it. Stacking them that way means a pixel
ends up the colour of the last layer covering it, and no seams open up between
shapes.

The palette is one fixed set for the whole sheet rather than a quantiser run per
card, so the same skin and the same garment blue come out of every card, and the
red arrows that carry half the meaning — which part of the arm is the elbow —
cannot be rounded into the brown outline beside them. Cards are traced a little
over the biggest box the app gives them: tracing detail the screen can never
show only costs bytes.

The card's white background is dropped so the icons sit on the app's dark
background like the rest of icons/. Background is found by flooding in from the
border, not by matching white, so enclosed whites — the whites of an eye, the
teeth in the mouth card — survive.
"""

from collections import Counter
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "body-parts-source.png"
OUT = ROOT / "icons"

# Reading order across the sheet, which is also SPELL_BODY order in game.html.
WORDS = [
    "head", "eye", "ear", "nose", "mouth", "tooth", "tongue", "neck",
    "shoulder", "arm", "elbow", "wrist", "hand", "finger", "thumb", "chest",
    "stomach", "back", "hip", "leg", "knee", "ankle", "foot", "toe",
]

# Card bounds, measured once off the sheet by projecting where the cards are
# opaque. Re-measure if the sheet is ever replaced — artwork() fails loudly
# rather than cropping the wrong thing if the grid no longer lines up.
CARD_X = [(7, 190), (198, 382), (389, 573), (580, 764),
          (772, 955), (964, 1147), (1155, 1338), (1346, 1530)]
CARD_Y = [(48, 305), (335, 592), (622, 886)]

INSET = 10        # step inside the card's own drawn border before reading it
INK_MIN = 3       # pixels of ink in a row before it counts as part of a band
TRACE_PX = 120    # long edge traced at, a little over the largest rendered size
DESPECKLE = 5     # majority-filter window that clears quantising confetti
SPECK = 16        # drop traced specks smaller than this many pixels
WHITE = (255, 255, 255)  # card background — matched exactly, then flooded away
IVORY = (250, 245, 235)  # what white inside the art becomes, see build()

# One palette for all 24 cards, sampled off the sheet by hand. Letting a
# quantiser pick per card went wrong twice over: skin is most of every card, so
# it took the bins in near-identical tones whose borders then cost a fortune in
# path data, while the red arrows — which carry half the meaning, saying which
# part of the arm is the elbow — were rounded into the brown outline beside
# them. Naming the colours keeps the arrows red, keeps one skin across all 24,
# and keeps the layer count down.
PALETTE = np.array([
    WHITE,             # card background — never painted, only flooded away
    IVORY,             # teeth, the whites of an eye, fingernails, highlights
    (250, 230, 215),   # skin highlight
    (252, 197, 154),   # skin
    (243, 164, 118),   # skin in shadow
    (246, 138, 132),   # lips, tongue, gums
    (145, 85, 50),     # deep shadow inside mouth and ear
    (107, 60, 36),     # hair
    (36, 37, 42),      # outline
    (60, 132, 192),    # clothing
    (55, 80, 95),      # clothing in shadow
    (238, 12, 12),     # the pointer arrow
], dtype=np.int32)
VIEWBOX = 100     # icon coordinate space, matching the other icons/*.svg
MARGIN = 2        # units of blank left around the art inside the viewBox
MARKER = (255, 0, 255)   # flood-fill marker, a colour the art never uses

# The sheet's head card is a smiling cartoon boy, and this app is for adults
# learning to read for the first time — a child's face is exactly the framing
# CLAUDE.md rules out. It is the one card drawn here instead of traced: a plain
# adult head and shoulders, in the palette above so it sits with the other 23.
# Featureless on purpose. The word is "head", not "face" (which index.html
# still spells with its own picture), and no features means no age, and nobody
# left looking for themselves in it.
DRAWN = {
    "head": """
  <path fill="#f3a476" stroke="#24252a" stroke-width="2.4" stroke-linejoin="round"
        d="M40,56 L60,56 L60,80 Q50,85 40,80 Z"/>
  <path fill="#3c84c0" stroke="#24252a" stroke-width="2.4" stroke-linejoin="round"
        d="M13,100 Q16,83 35,77 Q50,86 65,77 Q84,83 87,100 Z"/>
  <ellipse cx="27.5" cy="46" rx="5.2" ry="7.4" fill="#fcc59a" stroke="#24252a" stroke-width="2.2"/>
  <ellipse cx="72.5" cy="46" rx="5.2" ry="7.4" fill="#fcc59a" stroke="#24252a" stroke-width="2.2"/>
  <path fill="#fcc59a" stroke="#24252a" stroke-width="2.4" stroke-linejoin="round"
        d="M28,42 Q28,20 50,20 Q72,20 72,42 Q72,57 65,64 Q58,71 50,71 Q42,71 35,64 Q28,57 28,42 Z"/>
  <path fill="#6b3c24" stroke="#24252a" stroke-width="2.2" stroke-linejoin="round"
        d="M26.5,45 Q24,16 50,16 Q76,16 73.5,45 Q70,34 63,31 Q50,27 37,32 Q30,36 26.5,45 Z"/>""",
}


def ink_bands(rgba, x0, x1, y0, y1):
    """Vertical bands of the card that carry ink, top to bottom.

    A card holds exactly two: the artwork, then the word underneath it.
    """
    px = rgba.load()
    bands, start = [], None
    for y in range(y0, y1 + 1):
        inked = sum(
            1 for x in range(x0, x1 + 1)
            if px[x, y][3] > 128 and not all(v > 235 for v in px[x, y][:3])
        )
        if inked > INK_MIN and start is None:
            start = y
        elif inked <= INK_MIN and start is not None:
            bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, y1))
    return bands


def artwork(rgba, word, col, row):
    """The card's picture, flattened onto white, with its label cropped off."""
    x0, x1 = CARD_X[col]
    y0, y1 = CARD_Y[row]
    x0, x1, y0, y1 = x0 + INSET, x1 - INSET, y0 + INSET, y1 - INSET
    bands = ink_bands(rgba, x0, x1, y0, y1)
    if len(bands) != 2:
        raise SystemExit(
            f"{word}: expected a picture band and a label band, found "
            f"{len(bands)}: {bands}. The grid or the sheet has moved."
        )
    top, bottom = bands[0]
    card = rgba.crop((x0, top, x1 + 1, bottom + 1))
    flat = Image.new("RGB", card.size, (255, 255, 255))
    flat.paste(card, mask=card.getchannel("A"))
    return flat


def flatten(img):
    """Snap the picture to the shared palette, and clear the quantising dust."""
    long_edge = max(img.size)
    if long_edge > TRACE_PX:
        scale = TRACE_PX / long_edge
        img = img.resize((max(1, round(img.width * scale)),
                          max(1, round(img.height * scale))), Image.LANCZOS)
    img = img.filter(ImageFilter.MedianFilter(3))
    arr = np.array(img, dtype=np.int32)
    gap = arr[:, :, None, :] - PALETTE[None, None, :, :].astype(np.int32)
    nearest = np.argmin((gap * gap).sum(axis=-1), axis=-1)
    snapped = Image.fromarray(PALETTE[nearest].astype(np.uint8), "RGB")
    snapped = snapped.filter(ImageFilter.ModeFilter(DESPECKLE))
    return np.array(snapped), snapped


def background(rgb_img):
    """Mask of card white reachable from the border — the part to drop.

    Flooding in from outside is what keeps enclosed whites: the sclera of the
    eye and the teeth of the mouth are card-white too, but nothing outside can
    reach them. The picture is on the palette by now, so white is exactly white
    and the fill needs no tolerance to work with.
    """
    w, h = rgb_img.size
    padded = Image.new("RGB", (w + 2, h + 2), WHITE)
    padded.paste(rgb_img, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), MARKER, thresh=0)
    flooded = np.array(padded)[1:h + 1, 1:w + 1]
    return np.all(flooded == np.array(MARKER), axis=-1)


def layers(arr, keep):
    """Colour layers, largest area first, each the union of itself and the rest.

    Painted in this order every pixel ends up wearing its own colour, and the
    shapes overlap rather than butt together, so no background shows through
    the joins.
    """
    flat = arr.reshape(-1, 3)
    counts = Counter(map(tuple, flat[keep.reshape(-1)]))
    ordered = [c for c, _ in counts.most_common()]
    out, running = [], np.zeros(arr.shape[:2], dtype=bool)
    for colour in reversed(ordered):
        running = running | (np.all(arr == np.array(colour), axis=-1) & keep)
        out.append((colour, running.copy()))
    out.reverse()
    return out


def trace(mask, place):
    """One colour layer as SVG path data, in viewBox coordinates."""
    if not mask.any():
        return ""
    paths = potrace.Bitmap(np.invert(mask)).trace(
        turdsize=SPECK, alphamax=1.0, opticurve=True, opttolerance=0.8
    )
    out = []
    for curve in paths:
        pt = place(curve.start_point)
        d = [f"M{pt[0]},{pt[1]}"]
        for seg in curve.segments:
            end = place(seg.end_point)
            if isinstance(seg, potrace.BezierSegment):
                c1, c2 = place(seg.c1), place(seg.c2)
                d.append(f"C{c1[0]},{c1[1]} {c2[0]},{c2[1]} {end[0]},{end[1]}")
            else:
                corner = place(seg.c)
                d.append(f"L{corner[0]},{corner[1]} L{end[0]},{end[1]}")
        d.append("Z")
        out.append("".join(d))
    return "".join(out)


def write(word, body):
    path = OUT / f"body-{word}.svg"
    path.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEWBOX} {VIEWBOX}">\n'
        f"  <!-- {word} — generated by tools/build-body-icons.py from\n"
        f"       tools/body-parts-source.png. Do not edit by hand. -->\n"
        + body
        + "\n</svg>\n"
    )
    return path.stat().st_size


def build(word, rgba, index):
    if word in DRAWN:
        return write(word, DRAWN[word].strip("\n"))
    img = artwork(rgba, word, index % 8, index // 8)
    arr, rgb_img = flatten(img)
    keep = ~background(rgb_img)
    if not keep.any():
        raise SystemExit(f"{word}: the whole card read as background.")

    # Whatever white the flood could not reach is inside the picture: a tooth,
    # the white of an eye, a fingernail, or the shine along a shoulder. Pure
    # white blows all of those out into flat blobs against the app's dark
    # background, so they go to ivory and keep their shape.
    arr[keep & np.all(arr == np.array(WHITE), axis=-1)] = IVORY

    ys, xs = np.nonzero(keep)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    w, h = x1 - x0 + 1, y1 - y0 + 1
    scale = (VIEWBOX - 2 * MARGIN) / max(w, h)
    ox = (VIEWBOX - w * scale) / 2
    oy = (VIEWBOX - h * scale) / 2

    def place(p):
        return (round((p.x - x0) * scale + ox, 1), round((p.y - y0) * scale + oy, 1))

    body = []
    for colour, mask in layers(arr, keep):
        d = trace(mask, place)
        if d:
            body.append(f'  <path fill="#{colour[0]:02x}{colour[1]:02x}{colour[2]:02x}"'
                        f' fill-rule="evenodd" d="{d}"/>')
    return write(word, "\n".join(body))


def main():
    rgba = Image.open(SRC).convert("RGBA")
    if len(WORDS) != len(CARD_X) * len(CARD_Y):
        raise SystemExit("word list and card grid disagree")
    total = 0
    for i, word in enumerate(WORDS):
        size = build(word, rgba, i)
        total += size
        flag = "  <-- over budget" if size > 12 * 1024 else ""
        print(f"  body-{word}.svg  {size / 1024:6.1f} KB{flag}")
    print(f"\n  {len(WORDS)} icons, {total / 1024:.0f} KB total")


if __name__ == "__main__":
    main()
