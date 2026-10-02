# Side-by-side sheet of original and evolved pictures, for checking Codex's work by eye.
# usage: python scripts/evolution/compare.py <outDir> <sheet.png> [id ...]
import sys
from pathlib import Path
from PIL import Image

out_dir, sheet = Path(sys.argv[1]), sys.argv[2]
ids = sys.argv[3:]
full = Path('public/assets/images/monsters/full')
rows = []
for gid in ids:
    src = next(full.glob(f'*/{gid}.webp')); evo = out_dir / gid / f'{gid}_evo.png'
    if evo.exists(): rows.append((Image.open(src).convert('RGBA'), Image.open(evo).convert('RGBA')))
size = 300
page = Image.new('RGBA', (2 * size + 30, len(rows) * (size + 10) + 10), (235, 240, 235, 255))
for i, (a, b) in enumerate(rows):
    for j, im in enumerate((a, b)):
        im = im.resize((size, size), Image.NEAREST); page.paste(im, (10 + j * (size + 10), 10 + i * (size + 10)), im)
page.save(sheet); print(f'{len(rows)} rows -> {sheet}')
