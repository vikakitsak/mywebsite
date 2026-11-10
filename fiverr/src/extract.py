import cv2, numpy as np, json
cfg = {
 'nova': (2, (300,300,720,460)), 'adora': (3, (340,200,700,560)), 'floris': (4, (300,320,720,440)),
 'asani': (5, (300,300,720,460)), 'aura': (6, (300,310,720,450)),
}
info = {}
for name,(idx,(x0,y0,x1,y1)) in cfg.items():
    I = cv2.imread(f'p{idx}.png').astype(np.float32)  # BGR
    roi = np.zeros(I.shape[:2], bool); roi[y0:y1, x0:x1] = True
    lum = I.mean(2); sat = I.max(2) - I.min(2)
    bright = (lum > 170) & roi
    # logo main color = median of very bright pixels
    F = np.median(I[(lum > 200) & roi], axis=0)
    orange = roi & (I[:,:,2] > 170) & (I[:,:,1] > 70) & (I[:,:,1] < 180) & (I[:,:,0] < 110) if name == 'aura' else np.zeros_like(roi)
    m = (bright | orange).astype(np.uint8)
    m = cv2.dilate(m, np.ones((5,5),np.uint8))
    B = cv2.inpaint(I.astype(np.uint8), m, 9, cv2.INPAINT_TELEA).astype(np.float32)
    def alpha_for(C):
        d = C - B; den = (d*d).sum(2) + 1e-3
        return np.clip(((I - B)*d).sum(2) / den, 0, 1)
    aw = alpha_for(np.broadcast_to(F, I.shape))
    a = aw.copy(); cls = np.zeros(a.shape, np.uint8)
    if name == 'aura':
        O = np.array([60, 140, 245], np.float32)  # orange BGR approx
        O = np.median(I[orange], axis=0) if orange.any() else O
        ao = alpha_for(np.broadcast_to(O, I.shape)) * (cv2.dilate(orange.astype(np.uint8), np.ones((3,3),np.uint8)) > 0)
        cls = (ao > aw).astype(np.uint8); a = np.maximum(aw, ao)
        info_o = O.tolist()
    a[~(m > 0)] = 0
    ys, xs = np.where(a > 0.5); bx0, by0, bx1, by1 = xs.min()-4, ys.min()-4, xs.max()+5, ys.max()+5
    S = 4
    A = cv2.resize(a[by0:by1, bx0:bx1], None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
    A = np.clip((A - 0.3) / 0.4, 0, 1); A = A*A*(3-2*A)
    C = cv2.resize(cls[by0:by1, bx0:bx1], None, fx=S, fy=S, interpolation=cv2.INTER_NEAREST)
    col = np.zeros(A.shape + (3,), np.float32); col[:] = F
    if name == 'aura': col[C == 1] = info_o
    rgba = np.dstack([col, A*255]).astype(np.uint8)
    cv2.imwrite(f'{name}_logo.png', rgba)
    # components
    n, lab, stats, cent = cv2.connectedComponentsWithStats((A > 0.5).astype(np.uint8), 8)
    comps = []
    for k in range(1, n):
        x, y, w, h, area = stats[k]
        if area < 200: continue
        comps.append({'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h), 'area': int(area)})
        piece = rgba[y:y+h, x:x+w].copy(); mask = cv2.dilate((lab[y:y+h, x:x+w] == k).astype(np.uint8), np.ones((5,5),np.uint8))
        piece[:,:,3] = piece[:,:,3] * mask
        cv2.imwrite(f'{name}_c{len(comps)-1}.png', piece)
    comps_sorted = comps
    cv2.imwrite(f'{name}_bg.png', B.astype(np.uint8))
    info[name] = {'bbox': [int(bx0), int(by0), int(bx1), int(by1)], 'scale': S, 'color': F[::-1].tolist(), 'comps': comps}
    print(name, 'bbox', (bx0,by0,bx1,by1), 'comps', len(comps), [ (c['x'],c['w'],c['area']) for c in comps])
json.dump(info, open('logos.json','w'), indent=1)
