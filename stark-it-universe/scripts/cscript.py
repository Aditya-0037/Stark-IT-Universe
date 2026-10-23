"""Compose docs/colour-script.png from the hold-frame captures (cscript.mjs).

usage: python cscript.py <captures dir> <out png> [<json out>]
Each row: the hold frame, the target from the colour script table, and the
measured values (median luma, share of pixels in the top 40 % of brightness,
dominant colours). A last strip compares the page's nights with the brand night.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
jout = sys.argv[3] if len(sys.argv) > 3 else None

ROWS = [
    ('01-hero', 'Hero', 'Deep space; the sun is the only key', '#060A22 -> #0B1640; gold sun', 'High contrast; route gold just below the sun', ['#060A22', '#0B1640', '#FFB52E']),
    ('02-planets', 'Planets', 'Deep space; each planet tints its nebula', '#060A22 -> #0B1640; planet tint', 'High contrast', ['#060A22', '#0B1640', '#8B5CF6']),
    ('03-route', 'Route', 'Deep space; gold route', '#060A22 -> #0B1640; gold route', 'High contrast; route gold below the sun', ['#060A22', '#0B1640', '#FFB52E']),
    ('04-descent', 'Descent', 'Atmospheric entry into blue hour', 'Universe-blue zenith -> peach horizon; gold-lit cloud tops, cool undersides', 'Values rise steadily', ['#3152F5', '#93ACFF', '#F6E9D7', '#FFF7EC', '#B8C6E0']),
    ('05-campus', 'Campus', 'First light, before school', 'Long gold shadows, cool blue fill, one gold window', 'Sky lightest, ground mid, darks in shadow sides', ['#BFD8F5', '#F6E9D7', '#9CC77B', '#FFB52E']),
    ('06-window', 'Window', 'Dim, cool dawn; the window glows gold', 'Gold window in a cool facade', 'Dim but readable', ['#FFB52E', '#5B6FB5', '#EFE6D6']),
    ('07-room', 'Room, hotspots', 'Dim, cool dawn indoors', 'Desaturated room; devices spot-lit in their planet colour', 'Dim but readable, never crushed', ['#5E6E93', '#8B5CF6', '#06B6D4', '#10B981']),
    ('08-switch-dark', 'Switch on (dark)', 'Before the switch', 'Dim room, cool window rim', 'Median luma 10-20 %, never black', ['#1E263B', '#2F3A57', '#93ACFF']),
    ('09-switch-lit', 'Switch on (lit)', 'Warm interior light floods in', 'SIU gold + warm white', 'Brightest, most saturated room state', ['#FFB52E', '#FFF1D6', '#F5F7FC']),
    ('10-build', 'Build', 'The lit room; windows show full morning', 'Warm room with service-colour accents', 'High-key, with real darks', ['#FFF1D6', '#F5F7FC', '#3B82F6', '#10B981']),
    ('11-proof', 'Proof', 'Pull back out to dusk, then night', 'Brand night', 'Bookends the hero', ['#060A22', '#0B1640', '#FFB52E']),
    ('12-contact', 'Contact', 'Night', 'Brand night (panels)', 'Bookends the hero', ['#060A22', '#0B1640']),
]

def wrap(text, n):
    words, lines, cur = text.split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 > n:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + ' ' + w).strip()
    if cur:
        lines.append(cur)
    return lines


def font(size, bold=False):
    for f in (['C:/Windows/Fonts/segoeuib.ttf'] if bold else []) + ['C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf']:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

F, FB, FS = font(17), font(19, True), font(14)

def measure(path):
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32) / 255.0
    luma = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    med = float(np.median(luma))
    top40 = float((luma >= 0.6).mean())
    small = (a[::6, ::6] * 255).astype(np.int32)
    q = (small // 32)
    key = (q[..., 0] << 6) | (q[..., 1] << 3) | q[..., 2]
    counts = np.bincount(key.ravel(), minlength=512)
    order = np.argsort(counts)[::-1]
    dom = []
    for k in order[:12]:
        if counts[k] == 0:
            break
        sel = key == k
        col = small[sel].mean(axis=0).astype(int)
        if all(np.abs(col - np.array(d[0])).sum() > 40 for d in dom):
            dom.append((col.tolist(), float(counts[k] / key.size)))
        if len(dom) == 4:
            break
    return {'median_luma': round(med * 100, 1), 'top40_share': round(top40 * 100, 1), 'dominant': [['#%02X%02X%02X' % tuple(c), round(s * 100, 1)] for c, s in dom]}

TW, TH = 576, 298
rowh = TH + 20
W = TW + 1180
heads = [(TW + 20, 'Scene / time and light'), (TW + 430, 'Dominant colour (target)'), (TW + 820, 'Measured')]
rows_present = [r for r in ROWS if os.path.exists(os.path.join(src, r[0] + '.png'))]
H = 70 + rowh * len(rows_present) + 220
sheet = Image.new('RGB', (W, H), '#F5F7FC')
d = ImageDraw.Draw(sheet)
d.text((20, 18), 'Stark IT Universe: colour script (hold frames, FULL 1920 x 994)', font=font(24, True), fill='#0B1640')
results = {}
y = 70
for key, name, light, target, value, sw in rows_present:
    p = os.path.join(src, key + '.png')
    im = Image.open(p).convert('RGB').resize((TW, TH))
    sheet.paste(im, (10, y))
    m = measure(p)
    results[key] = m
    x = TW + 20
    d.text((x, y + 4), name, font=FB, fill='#0B1640')
    d.multiline_text((x, y + 32), '\n'.join(wrap(light, 34)), font=F, fill='#2F3A57', spacing=4)
    d.multiline_text((x, y + 120), 'Value goal:\n' + '\n'.join(wrap(value, 34)), font=FS, fill='#59606C', spacing=3)
    x2 = TW + 430
    d.multiline_text((x2, y + 4), '\n'.join(wrap(target, 36)), font=F, fill='#2F3A57', spacing=4)
    for i, c in enumerate(sw):
        d.rectangle([x2 + i * 62, y + 110, x2 + i * 62 + 54, y + 150], fill=c, outline='#C9D0E3')
        d.text((x2 + i * 62, y + 154), c, font=font(11), fill='#59606C')
    x3 = TW + 820
    d.text((x3, y + 4), f"median luma {m['median_luma']} %", font=F, fill='#0B1640')
    d.text((x3, y + 30), f"top-40 % brightness: {m['top40_share']} % of pixels", font=F, fill='#0B1640')
    for i, (c, share) in enumerate(m['dominant']):
        d.rectangle([x3 + i * 84, y + 66, x3 + i * 84 + 74, y + 106], fill=c, outline='#C9D0E3')
        d.text((x3 + i * 84, y + 110), f'{c} {share}%', font=font(11), fill='#59606C')
    y += rowh

# nights: the median colour of the frame's dark background pixels (luma under 12 %)
def night_of(path):
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32)
    luma = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]) / 255
    px = a[luma < 0.12]
    if not len(px):
        return None
    return '#%02X%02X%02X' % tuple(np.median(px, axis=0).astype(int))

nights = []
for key, label in [('01-hero', 'Hero (3D)'), ('02-planets', 'Planets (3D)'), ('03-route', 'Route (3D)'), ('11-proof', 'Proof'), ('13-footer', 'Footer')]:
    p = os.path.join(src, key + '.png')
    if os.path.exists(p):
        c = night_of(p)
        if c:
            nights.append((label, c))
d.text((20, y + 10), 'The nights (median of each frame’s dark background pixels) against the brand night #060A22 -> #0B1640', font=FB, fill='#0B1640')
for i, (label, c) in enumerate([('Brand top', '#060A22'), ('Brand bottom', '#0B1640')] + nights):
    x = 20 + i * 170
    d.rectangle([x, y + 44, x + 150, y + 124], fill=c, outline='#C9D0E3')
    d.text((x, y + 130), f'{label}\n{c}', font=FS, fill='#2F3A57')
results['nights'] = nights
sheet.save(out)
if jout:
    json.dump(results, open(jout, 'w'), indent=1)
print(json.dumps(results, indent=1))

