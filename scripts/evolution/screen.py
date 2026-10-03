# Sheets of original pictures with their name and description, for choosing the next targets by eye:
# a Gotomon whose picture does not match its name is skipped (Codex follows the name and the evolution
# stops looking like the same Gotomon), and each one gets the direction that fits it.
# Gotomon that already have an evolved picture are left out.
# usage: python scripts/evolution/screen.py <sheet-prefix> <stage-prefix|id> ...
#   e.g. python scripts/evolution/screen.py C:/kanji-evo/screen-tohoku tohoku hokkaido   ('legend' = all legends)
#   writes <sheet-prefix>-1.png, -2.png ... (20 Gotomon each)
import json, sys, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

prefix, keys = sys.argv[1], sys.argv[2:]
data = lambda f: [m for m in _flat(json.loads(Path(f'public/data/{f}').read_text(encoding='utf-8'))) if isinstance(m, dict) and m.get('id')]
def _flat(x):
    for i in (x if isinstance(x, list) else [x]):
        yield from (_flat(i) if isinstance(i, list) else [i])
legends = {m['id'] for m in data('enemies_legend.json')}  # key 'legend' picks all of them
monsters = data('enemies_proto.json') + data('enemies_legend.json')  # the game loads these two (enemy_world.json is an unused copy)
full = Path('public/assets/images/monsters/full')
done = {p.stem for p in Path('public/assets/images/monsters/evo').glob('*.webp')}
picked, seen = [], set()
for m in monsters:
    if m['id'] in seen or m['id'] in done: continue
    if any(m['id'] == k or (k == 'legend' and m['id'] in legends) or str(m.get('stageId', '')).startswith(k) for k in keys):
        pic = next(full.glob(f"*/{m['id']}.webp"), None)
        if pic: picked.append((m, pic)); seen.add(m['id'])

font = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 15); bold = ImageFont.truetype('C:/Windows/Fonts/meiryob.ttc', 16)
cols, pic_size, cell_w, cell_h = 5, 200, 250, 330
for n in range(0, len(picked), 20):
    chunk = picked[n:n + 20]; rows = (len(chunk) + cols - 1) // cols
    page = Image.new('RGB', (cols * cell_w, rows * cell_h), (235, 240, 235)); draw = ImageDraw.Draw(page)
    for i, (m, pic) in enumerate(chunk):
        x, y = (i % cols) * cell_w, (i // cols) * cell_h
        im = Image.open(pic).convert('RGBA').resize((pic_size, pic_size), Image.NEAREST)
        page.paste(im, (x + (cell_w - pic_size) // 2, y + 4), im)
        draw.text((x + 6, y + pic_size + 8), f"{m['id']} {m['name']}", font=bold, fill=(20, 30, 20))
        for j, line in enumerate(textwrap.wrap(m.get('desc', ''), 15)[:4]):
            draw.text((x + 6, y + pic_size + 32 + j * 20), line, font=font, fill=(60, 70, 60))
    out = f'{prefix}-{n // 20 + 1}.png'; page.save(out); print(out, len(chunk))
print('total', len(picked))
