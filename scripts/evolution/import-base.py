# Puts Codex's new base pictures (run-codex.mjs --base) in the game, replacing the Gotomon's picture:
# public/assets/images/monsters/full/<folder>/<id>.webp (512x512) and thumb/<folder>/<id>.webp (128x128),
# matched to the style samples (refs in base-targets.json) like import-images.py matches evolutions:
# - size: as much of the frame as the samples fill on average;
# - tone: the samples' mean brightness, 48 flat colours, lossy WebP;
# - the thumb is the full picture made smaller (as the existing thumbs are).
# A target with "tone": "keep" is not darkened (for a bright picture whose samples happen to be dark).
# Reads <outDir>/<id>/<id>_base.png. A picture whose corners are not transparent is reported and skipped.
# usage: python scripts/evolution/import-base.py <outDir> [id ...]
import json, statistics, sys
from pathlib import Path
from PIL import Image, ImageEnhance

COLOURS, MAX_FILL, QUALITY = 48, 0.98, 88
out_dir = Path(sys.argv[1]); only = sys.argv[2:]
root = Path('public/assets/images/monsters')
targets = json.loads(Path('scripts/evolution/base-targets.json').read_text(encoding='utf-8'))

def brightness(image):
    dots = [p for p in image.get_flattened_data() if p[3] > 128][::7]
    return statistics.mean(max(r, g, b) / 255 for r, g, b, _ in dots)

def fill(image):
    box = image.getbbox(); return max(box[2] - box[0], box[3] - box[1]) / image.width

for target in targets:
    gid = target['id']
    if only and gid not in only: continue
    src = out_dir / gid / f'{gid}_base.png'
    if not src.exists(): print(f'{gid}: no picture yet'); continue
    full = next(root.glob(f'full/*/{gid}.webp')); thumb = root / 'thumb' / full.parent.name / full.name
    refs = [Image.open(next(root.glob(f'full/*/{ref}.webp'))).convert('RGBA') for ref in target['refs']]
    image = Image.open(src).convert('RGBA'); w, h = image.size
    image.putalpha(image.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    corners = [image.getpixel(p)[3] for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    if max(corners) > 10: print(f'{gid}: SKIPPED, the background is not transparent (corners alpha {corners})'); continue
    body = image.crop(image.getbbox())
    side = round(512 * min(MAX_FILL, statistics.mean(fill(r) for r in refs))); scale = side / max(body.size)
    body = body.resize((max(1, round(body.width * scale)), max(1, round(body.height * scale))), Image.NEAREST)
    alpha, rgb = body.getchannel('A'), body.convert('RGB')
    if target.get('tone') != 'keep':
        rgb = ImageEnhance.Brightness(rgb).enhance(min(1.0, statistics.mean(brightness(r) for r in refs) / brightness(body)))
    rgb = rgb.quantize(COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    body = rgb.convert('RGBA'); body.putalpha(alpha)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.paste(body, ((512 - body.width) // 2, (512 - body.height) // 2), body)
    canvas.save(full, 'WEBP', quality=QUALITY, method=6)
    canvas.resize((128, 128), Image.LANCZOS).save(thumb, 'WEBP', quality=QUALITY, method=6)
    print(f'{gid}: {full} and thumb ({full.stat().st_size // 1024} KB, fill {fill(canvas):.2f}, brightness {brightness(canvas):.2f})')
