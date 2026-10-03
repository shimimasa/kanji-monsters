# Remakes the colouring picture (src/minigames/gotomonColoring/pictures.js) of Gotomon whose base
# picture was replaced (import-base.py), the way the file was first made (docs/progress-handoff.md):
# crop to the opaque part -> 10x10 cells -> a cell is painted when half or more of it is opaque ->
# 3 colours by k-means -> a colour on fewer than 3 cells joins the nearest one -> darkest first ->
# kept only with 28 to 80 painted cells (otherwise the entry is removed).
# usage: python scripts/evolution/coloring-entry.py <id> ...
import json, re, sys
from pathlib import Path
from PIL import Image

FILE = Path('src/minigames/gotomonColoring/pictures.js')
root = Path('public/assets/images/monsters/full')

def cells(gid):
    image = Image.open(next(root.glob(f'*/{gid}.webp'))).convert('RGBA')
    image = image.crop(image.getbbox()); w, h = image.size; out = []
    for row in range(10):
        for col in range(10):
            box = (col * w // 10, row * h // 10, (col + 1) * w // 10, (row + 1) * h // 10)
            dots = list(image.crop(box).get_flattened_data()); solid = [d[:3] for d in dots if d[3] >= 128]
            out.append(tuple(sum(c[i] for c in solid) / len(solid) for i in range(3)) if solid and len(solid) * 2 >= len(dots) else None)
    return out

def dist(a, b): return sum((x - y) ** 2 for x, y in zip(a, b))
def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def entry(gid):
    grid = cells(gid); painted = [c for c in grid if c]
    if not 28 <= len(painted) <= 80: return None
    ranked = sorted(painted, key=lum)
    centres = [ranked[0], ranked[len(ranked) // 2], ranked[-1]]
    for _ in range(20):
        groups = [[] for _ in centres]
        for c in painted: groups[min(range(len(centres)), key=lambda k: dist(c, centres[k]))].append(c)
        centres = [tuple(sum(x[i] for x in g) / len(g) for i in range(3)) if g else centres[k] for k, g in enumerate(groups)]
    while True:
        counts = [sum(1 for c in painted if min(range(len(centres)), key=lambda k: dist(c, centres[k])) == k) for k in range(len(centres))]
        small = [k for k, n in enumerate(counts) if n < 3]
        if not small or len(centres) == 1: break
        centres.pop(small[0])
    centres.sort(key=lum)
    marks = ''.join('.' if c is None else str(min(range(len(centres)), key=lambda k: dist(c, centres[k]))) for c in grid)
    return [marks, *('#%02x%02x%02x' % tuple(round(v) for v in c) for c in centres)]

text = FILE.read_text(encoding='utf-8')
for gid in sys.argv[1:]:
    line = re.compile(rf'^  "{re.escape(gid)}": \[.*\],?\n', re.M)
    made = entry(gid)
    if made is None: text, n = line.subn('', text); print(f'{gid}: removed ({n}), not 28-80 painted cells'); continue
    new = f'  "{gid}": {json.dumps(made, ensure_ascii=False, separators=(",", ","))},\n'
    text, n = line.subn(lambda m: new, text); print(f'{gid}: {"replaced" if n else "NOT FOUND"} ({made[0].count(".")} blank)')
FILE.write_text(text, encoding='utf-8', newline='')
