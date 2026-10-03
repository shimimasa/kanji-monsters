# safe edit preserving each line's ending. usage: edit.py <file> <spec.json>
# spec: [{"find": "exact text (one or more lines, \n-joined)", "replace": "new text (\n-joined)"}]
import json, sys
p, spec = sys.argv[1], json.load(open(sys.argv[2], encoding='utf-8'))
b = open(p, 'rb').read().decode('utf-8')
for s in spec:
    lines = b.split('\n'); find = s['find'].split('\n')
    hits = [i for i in range(len(lines) - len(find) + 1) if all(lines[i + k].rstrip('\r') == find[k] for k in range(len(find)))]
    assert len(hits) == 1, (s['find'][:60], len(hits))
    i = hits[0]; eol = '\r' if lines[i].endswith('\r') else ''
    lines[i:i + len(find)] = [l + eol for l in s['replace'].split('\n')]
    b = '\n'.join(lines)
open(p, 'wb').write(b.encode('utf-8')); print('ok', len(spec))
