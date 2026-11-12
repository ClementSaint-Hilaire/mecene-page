"""Campus 3D (page Data center) : convertit la géométrie de campus-3d-source.html
(triangles non indexés + teinte par triangle, dans <script id="campus-data">) au format de js/components/package-3d.js :
assets/campus-3d.json (index des catégories) + assets/campus-3d.bin (gzip : positions uint16, triangles uint16, teinte uint8).

Usage, depuis la racine du projet : python3 _ref/campus-3d-convert.py
Après une modification, refaire l'image fixe assets/campus-3d-poster.webp (README, « Page Data center »).
"""
import gzip, json, re, struct

SRC = '_ref/campus-3d-source.html'
OUT_JSON, OUT_BIN = 'assets/campus-3d.json', 'assets/campus-3d.bin'

# Points de la maquette Figma (annotations du calque « campus 1 ») → bâtiments mis en avant, dans l'ordre de
# MODELS.campus.systems (js/components/package-3d.js). Bâtiments de la source : A aile ouest, B atrium, C tour,
# D cour couverte, E bloc en L, F barre est, G pavillon sud, H gradins. La pastille se pose sur le 1er bâtiment.
# « site » : le reste du campus (décor, non interactif).
CATS = [
    ('containment', ['A']),
    ('cooling', ['D']),
    ('power', ['F']),
    ('safety', ['G']),
    ('site', ['B', 'C', 'E', 'H']),
]

html = open(SRC, encoding='utf-8').read()
D = json.loads(re.search(r'<script type="application/json" id="campus-data">(.*?)</script>', html, re.S).group(1))

xs, ys, zs = [], [], []
for v in D.values():
    p = v['p']
    xs += p[0::3]; ys += p[1::3]; zs += p[2::3]
lo = [min(xs), min(ys), min(zs)]
span = [max(xs) - lo[0], max(ys) - lo[1], max(zs) - lo[2]]

def q(v, i):
    return max(0, min(65535, round((v - lo[i]) / span[i] * 65535)))

buf = bytearray()
cats = {}
for cid, parts in CATS:
    verts, keys, idx = [], {}, []
    for pid in parts:
        p, c = D[pid]['p'], D[pid]['c']
        for t in range(len(c)):
            tone = max(0, min(255, round(c[t] * 255)))
            for k in range(3):
                o = t * 9 + k * 3
                key = (q(p[o], 0), q(p[o + 1], 1), q(p[o + 2], 2), tone)
                if key not in keys:
                    keys[key] = len(verts)
                    verts.append(key)
                idx.append(keys[key])
    assert len(verts) < 65536, cid
    pos_off = len(buf)
    for x, y, z, _ in verts:
        buf += struct.pack('<3H', x, y, z)
    idx_off = len(buf)
    buf += struct.pack('<%dH' % len(idx), *idx)
    col_off = len(buf)
    buf += bytes(v[3] for v in verts)
    if len(buf) % 2:
        buf += b'\0'  # les tableaux uint16 suivants doivent rester alignés
    a = D[parts[0]]['a']
    cats[cid] = {'nv': len(verts), 'nf': len(idx) // 3, 'pos': pos_off, 'idx': idx_off, 'col': col_off,
                 'a': [round(a[0], 3), round(a[1], 3), round(a[2], 3)]}

meta = {'lo': [round(v, 4) for v in lo], 'span': [round(v, 4) for v in span], 'cats': cats}
json.dump(meta, open(OUT_JSON, 'w'), separators=(',', ':'))
open(OUT_BIN, 'wb').write(gzip.compress(bytes(buf), 9, mtime=0))
print(OUT_JSON, OUT_BIN, len(buf), 'octets avant gzip')
