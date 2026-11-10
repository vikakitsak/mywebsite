import cv2, numpy as np, json
S = 8
cfg = {'nova': 7, 'floris': 8, 'asani': 9, 'aura': 10, 'adora': 11}
out = {}
def smooth(c, k=7):
    p = c[:, 0, :].astype(np.float32); n = len(p)
    if n < k * 2: return p
    pad = np.concatenate([p[-k:], p, p[:k]]); ker = np.ones(k) / k
    return np.stack([np.convolve(pad[:, 0], ker, 'same')[k:-k], np.convolve(pad[:, 1], ker, 'same')[k:-k]], 1)
for name, idx in cfg.items():
    I = cv2.imread(f'p{idx}.png').astype(np.float32)
    B = I[5, 5].copy()
    d = np.abs(I - B).sum(2); ys, xs = np.where(d > 60)
    x0, y0, x1, y1 = xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4
    R = I[y0:y1, x0:x1]
    lum = R.mean(2); dr = d[y0:y1, x0:x1]; F = np.median(R[dr >= 0.9 * dr.max()], axis=0)
    colors = [F]
    if name == 'aura':
        orange = (R[:, :, 2] > 180) & (R[:, :, 1] > 80) & (R[:, :, 1] < 190) & (R[:, :, 0] < 120)
        O = np.median(R[orange], axis=0); colors.append(O)
    layers = []
    for ci, C in enumerate(colors):
        dv = C - B; a = np.clip(((R - B) * dv).sum(2) / (dv * dv).sum(), 0, 1)
        if name == 'aura':
            # assign pixels to nearer color
            orng = (R[:, :, 2] - R[:, :, 0]) > 60
            near = orng if ci == 1 else ~(cv2.dilate(orng.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
            near = cv2.dilate(near.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
            a = a * near
        A = cv2.resize(a, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
        m = (A > 0.5).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        layers.append((m, C))
    comps = []
    for m, C in layers:
        n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
        for k in range(1, n):
            if st[k][4] < 60 * S: continue
            cm = (lab == k).astype(np.uint8)
            cnts, hier = cv2.findContours(cm, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
            dstr = []; subs = []
            for ci2, c in enumerate(cnts):
                if len(c) < 8: continue
                p = smooth(c); p = cv2.approxPolyDP(p.reshape(-1, 1, 2).astype(np.float32), 1.2, True)[:, 0, :] / S
                sd = 'M' + 'L'.join(f'{px + x0:.2f} {py + y0:.2f}' for px, py in p) + 'Z'; dstr.append(sd)
                bx, by, bw, bh = cv2.boundingRect(c)
                subs.append({'d': sd, 'hole': bool(hier[0][ci2][3] >= 0), 'x': bx / S + x0, 'y': by / S + y0, 'w': bw / S, 'h': bh / S})
            x, y, w, h, area = st[k]
            comps.append({'d': ''.join(dstr), 'subs': subs, 'x': x / S + x0, 'y': y / S + y0, 'w': w / S, 'h': h / S, 'area': int(area) / S / S,
                          'color': '#%02x%02x%02x' % tuple(int(v) for v in C[::-1])})
    out[name] = {'bg': '#%02x%02x%02x' % tuple(int(v) for v in B[::-1]), 'bbox': [int(x0), int(y0), int(x1), int(y1)], 'comps': comps}
    print(name, out[name]['bg'], len(comps), [(round(c['x']), round(c['y']), round(c['w']), round(c['h']), c['color']) for c in comps])
json.dump(out, open('vec.json', 'w'))
