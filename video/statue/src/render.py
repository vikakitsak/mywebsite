"""Drone-style 2.5D night flight around the statue. Renders frames deterministically by time t = i/FPS."""
import numpy as np, cv2, math, sys, os
from scipy.interpolate import PchipInterpolator
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
WK = os.path.join(ROOT, 'work')
FONTS = os.path.join(ROOT, 'fonts')
W, H, FPS, DUR = 1920, 1080, 60, 30.0
cv2.setNumThreads(1)

def lin(img8):  # sRGB-ish -> linear
    return np.power(img8.astype(np.float32) / 255.0, 2.2)

def smooth(x):
    x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)

def ease_out(x):
    x = np.clip(x, 0, 1); return 1 - (1 - x) ** 3

def fbm(n, beta, seed):
    r = np.random.default_rng(seed)
    f = np.fft.fftfreq(n)[:, None] ** 2 + np.fft.fftfreq(n)[None, :] ** 2
    f[0, 0] = 1
    spec = (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n))) / f ** (beta / 2)
    spec[0, 0] = 0
    a = np.real(np.fft.ifft2(spec)).astype(np.float32)
    a = (a - a.mean()) / a.std()
    return a

# ------------------------------------------------------------------ camera
K = {
 'theta': [(0, 12), (3, 8.5), (6, 4), (9, -1), (11.55, -7), (12.0, -22), (12.4, -36), (15, -42), (18, -48), (21, -53), (24, -56), (27, -60), (30, -63)],
 'D':     [(0, 175), (3, 135), (6, 96), (9, 78), (12, 72), (15, 64), (18, 54), (21, 46), (23.6, 43), (24.6, 52), (27, 135), (30, 180)],
 'Hc':    [(0, -30), (2.5, -28), (4.6, -19), (6, -9), (9, 1), (12, 5), (15, 9), (18, 13), (21, 15), (24, 16), (26, 30), (30, 52)],
 'ty':    [(0, -6), (3, -4), (6, -1), (9, 0), (12, 1), (15, 5), (18, 11), (21, 14.5), (24, 13), (26.5, -2), (30, -9)],
 'roll':  [(0, 2.5), (3, -1.5), (6, 1.2), (9, -0.8), (11.6, -3.5), (12.25, 6), (13.2, 1.5), (15, -1.2), (18, 1.4), (21, -0.8), (24, 0), (27, -2.6), (30, -1.4)],
 'fov':   [(0, 52), (6, 47), (9, 43), (12, 42), (15, 39), (18, 33), (21, 28), (23.6, 26.5), (24.6, 32), (27, 43), (30, 46)],
 'tx':    [(0, 0), (12, 0), (15, -1.5), (18, -3), (21, 0.5), (24, 0), (30, 0)],
}
INTERP = {k: PchipInterpolator([a for a, b in v], [b for a, b in v]) for k, v in K.items()}

def cam(t):
    c = {k: float(f(np.clip(t, 0, DUR))) for k, f in INTERP.items()}
    th = math.radians(c['theta'])
    C = np.array([c['D'] * math.sin(th), c['Hc'], -c['D'] * math.cos(th)])
    T = np.array([c['tx'] * math.cos(th), c['ty'], c['tx'] * math.sin(th)])
    f = T - C; f /= np.linalg.norm(f)
    # gimbal micro drift (drone feel)
    yaw = 0.10 * math.sin(2 * math.pi * 0.23 * t) + 0.05 * math.sin(2 * math.pi * 0.71 * t + 1.3)
    pit = 0.08 * math.sin(2 * math.pi * 0.19 * t + 0.5) + 0.04 * math.sin(2 * math.pi * 0.93 * t + 2.1)
    up = np.array([0., 1., 0.])
    r = np.cross(up, f); r /= np.linalg.norm(r)
    u = np.cross(f, r)
    f = f + math.radians(yaw) * r + math.radians(pit) * u; f /= np.linalg.norm(f)
    r = np.cross(up, f); r /= np.linalg.norm(r); u = np.cross(f, r)
    ro = math.radians(c['roll'])
    r, u = r * math.cos(ro) + u * math.sin(ro), u * math.cos(ro) - r * math.sin(ro)
    fpx = (H / 2) / math.tan(math.radians(c['fov']) / 2)
    return dict(C=C, f=f, r=r, u=u, fpx=fpx, th=c['theta'], D=c['D'], fov=c['fov'])

def project(cm, P):
    d = P - cm['C']
    x = d @ cm['r']; y = d @ cm['u']; z = d @ cm['f']
    zs = np.maximum(z, 1e-3)
    return W / 2 + cm['fpx'] * x / zs, H / 2 - cm['fpx'] * y / zs, z

def focus_dist(t, cm):
    return float(np.linalg.norm(cm['C'] - np.array([0, float(INTERP['ty'](t)), 0])))

APERTURE = 0.07
def coc(cm, z, zf):
    return APERTURE * cm['fpx'] * abs(z - zf) / (max(z, 0.5) * zf)

# ------------------------------------------------------------------ assets
def load_plate(name, s, origin, thr, feather_y):
    im = cv2.imread(os.path.join(WK, name + '.jpg'))
    im = cv2.resize(im, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
    bl = cv2.GaussianBlur(im, (0, 0), 1.2)
    im = cv2.addWeighted(im, 1.35, bl, -0.35, 0)
    f = im.astype(np.float32) / 255
    lumv = f.mean(2)
    b, g, r = f[..., 0], f[..., 1], f[..., 2]
    a = smooth((lumv - thr[0]) / (thr[1] - thr[0]))
    crown = smooth(((r - b) - 0.015) / 0.04) * smooth((lumv - 0.03) / 0.05)
    a = np.maximum(a, crown)
    hh, ww = a.shape
    yy = np.arange(hh, dtype=np.float32)[:, None] / 2
    a *= smooth((feather_y[1] - yy) / (feather_y[1] - feather_y[0]))
    xx = np.arange(ww, dtype=np.float32)[None, :] / 2
    edge = smooth(xx / 40) * smooth((ww / 2 - xx) / 40) * smooth(yy / 40)
    a = a * edge
    # relief from statue mask
    m = (lumv > thr[2]).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8))
    dt = cv2.distanceTransform(m, cv2.DIST_L2, 5) / 2 * s
    hrel = np.minimum(dt * 0.85, 4.5)
    hrel = cv2.GaussianBlur(hrel.astype(np.float32), (0, 0), 18)
    rgb = lin((f * 255).clip(0, 255)) * a[..., None]   # premultiplied linear
    rgba = np.dstack([rgb, a]).astype(np.float32)
    return dict(rgba=rgba, h=hrel, s=s / 2, u0=origin[0] * 2, v0=origin[1] * 2)

def plates():
    fr = load_plate('front', 36 / 950, (480, 720), (0.03, 0.10, 0.20), (1150, 1250))
    sd = load_plate('side', 36 / 895, (400, 662), (0.10, 0.19, 0.22), (1000, 1110))
    # side sky is bluish haze; neutralise plate under key
    sd['gain'] = 0.74
    return {'front': fr, 'side': sd}

def make_tree(seed, kind):
    r = np.random.default_rng(seed)
    w, h = 360, 900
    img = Image.new('L', (w, h), 0); d = ImageDraw.Draw(img)
    cx = w / 2 + r.normal() * 4
    top = h * 0.03
    d.line([(cx, h), (cx + r.normal() * 3, top + 20)], fill=255, width=9)
    if kind == 'spruce':
        ys = np.linspace(top, h * 0.9, 70)
        for y in ys:
            k = (y - top) / (h * 0.9 - top)
            spread = (0.05 + 0.45 * k ** 0.9) * w * r.uniform(0.75, 1.05)
            for side in (-1, 1):
                for _ in range(3):
                    L = spread * r.uniform(0.5, 1.0)
                    x2 = cx + side * L; y2 = y + L * r.uniform(0.15, 0.45)
                    d.line([(cx, y), (x2, y2)], fill=255, width=int(r.integers(2, 6)))
                    for j in range(4):
                        px = cx + side * L * r.uniform(0.3, 1); py = y + (px - cx) * side * 0.3
                        d.line([(px, py), (px + side * r.uniform(5, 20), py + r.uniform(4, 20))], fill=255, width=2)
    else:  # pine: bare trunk, clumped crown
        crown_b = h * r.uniform(0.35, 0.5)
        for _ in range(26):
            y = r.uniform(top, crown_b)
            k = (y - top) / (crown_b - top)
            L = w * r.uniform(0.15, 0.45) * (0.5 + 0.6 * math.sin(k * math.pi))
            side = r.choice([-1, 1])
            x2 = cx + side * L; y2 = y - r.uniform(0, 30)
            d.line([(cx, y), (x2, y2)], fill=255, width=4)
            for _ in range(5):
                ex = cx + side * L * r.uniform(0.4, 1.05); ey = y2 + r.normal() * 10
                rr = r.uniform(14, 34)
                d.ellipse([ex - rr, ey - rr * 0.6, ex + rr, ey + rr * 0.6], fill=255)
    a = np.asarray(img, np.float32) / 255
    nz = cv2.resize(np.random.default_rng(seed + 9).random((h // 6, w // 6)).astype(np.float32), (w, h))
    a = cv2.GaussianBlur(a, (0, 0), 1.0) * (0.85 + 0.15 * nz)
    xs = (np.arange(w, dtype=np.float32) - cx) / (w / 2)
    lit = np.clip(xs, 0, 1) ** 1.2
    er = cv2.erode((a > 0.3).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
    rim = np.clip(a - cv2.GaussianBlur(er, (0, 0), 3), 0, 1)
    lit = np.clip(lit[None, :] * 0.6 * a + rim * np.clip(xs[None, :] + 0.3, 0, 1) * 1.2, 0, 1.5)
    return a, lit.astype(np.float32)

def build_world():
    r = np.random.default_rng(42)
    trees = []
    def ground(rad):
        return -18 - np.clip(rad - 10, 0, 30) * 0.57
    # camera corridor for the opening
    path = np.array([[cam(t)['C'][0], cam(t)['C'][2]] for t in np.linspace(0, 7, 80)])
    def near_path(x, z):
        return np.min(np.hypot(path[:, 0] - x, path[:, 1] - z))
    for _ in range(90):  # mound ring
        rad = r.uniform(14, 45); a = r.uniform(0, 2 * np.pi)
        trees.append((rad * np.sin(a), ground(rad), -rad * np.cos(a), r.uniform(7, 15), int(r.integers(0, 6))))
    n = 0
    while n < 700:
        rad = np.sqrt(r.uniform(45 ** 2, 360 ** 2)); a = r.uniform(0, 2 * np.pi)
        x, z = rad * np.sin(a), -rad * np.cos(a)
        dp = near_path(x, z)
        if dp < 3.5: continue
        trees.append((x, -35, z, r.uniform(13, 25), int(r.integers(0, 6)))); n += 1
    # hero trees brushing past the lens
    for t0, side, dist in [(0.6, 1, 5.5), (1.5, -1, 4.5), (2.4, 1, 6.5), (3.3, -1, 5), (4.1, 1, 7.5)]:
        cm = cam(t0 + 0.9)
        p = cm['C'] + cm['f'] * 9 + cm['r'] * side * dist
        trees.append((p[0], -35, p[2], r.uniform(16, 22), int(r.integers(0, 6))))
    fog = []
    for _ in range(18):
        rad = r.uniform(18, 140); a = r.uniform(-1.6, 1.6)
        fog.append((rad * np.sin(a), r.uniform(-31, -22), -rad * np.cos(a), r.uniform(50, 110), int(r.integers(0, 3))))
    # town lights
    L = []
    for c in range(16):
        ang = r.uniform(-0.9, 2.4) + np.pi * (c % 3 == 0)
        dist = r.uniform(500, 2600); cx, cz = dist * np.sin(ang), -dist * np.cos(ang)
        nn = int(r.integers(200, 900)); sp = r.uniform(80, 420)
        L.append(np.c_[cx + r.normal(0, sp, nn), np.full(nn, -42), cz + r.normal(0, sp * 0.7, nn)])
    for _ in range(9):  # roads
        p = r.uniform(-2500, 2500, 2); dvec = r.normal(size=2); dvec /= np.linalg.norm(dvec)
        ts = np.arange(0, r.uniform(800, 2500), 35)
        L.append(np.c_[p[0] + dvec[0] * ts, np.full(len(ts), -42), p[1] + dvec[1] * ts])
    lights = np.vstack(L)
    lights = lights[np.hypot(lights[:, 0], lights[:, 2]) > 420]
    warm = r.random(len(lights)) < 0.7
    lcol = np.where(warm[:, None], [0.25, 0.6, 1.0], [1.0, 0.9, 0.85]).astype(np.float32)  # BGR
    lbri = (r.random(len(lights)) ** 3 * 2.2 + 0.25).astype(np.float32)
    # stars
    ns = 2600
    v = r.normal(size=(ns, 3)); v /= np.linalg.norm(v, axis=1)[:, None]; v[:, 1] = np.abs(v[:, 1])
    sb = (r.random(ns) ** 6 * 1.4 + 0.03).astype(np.float32)
    # dust
    nd = 700
    dust = np.c_[r.uniform(-60, 60, nd), r.uniform(-25, 30, nd), r.uniform(-90, 40, nd)]
    dvel = r.normal(0, 0.25, (nd, 3)); dvel[:, 1] = np.abs(dvel[:, 1]) * 0.6
    lamps = [(11 * np.sin(a), -19, -11 * np.cos(a)) for a in np.radians([-110, -60, -20, 25, 70])]
    return dict(trees=trees, fog=fog, lights=lights, lcol=lcol, lbri=lbri, stars=v, sb=sb, dust=dust, dvel=dvel, lamps=lamps)

def letter_sprites(text, font_path, size, fallback=None):
    out = []
    for ch in text:
        fp = fallback if (fallback and ch in 'ŚśĄąĘęŁłŻżŹźŃńĆć') else font_path
        font = ImageFont.truetype(fp, size)
        if ch == ' ':
            out.append((ch, None, size * 0.35)); continue
        bb = font.getbbox(ch)
        adv = font.getlength(ch)
        pad = 20
        img = Image.new('L', (int(bb[2] - min(bb[0], 0)) + 2 * pad, int(size * 1.35) + 2 * pad), 0)
        ImageDraw.Draw(img).text((pad - min(bb[0], 0), pad), ch, font=font, fill=255)
        out.append((ch, np.asarray(img, np.float32) / 255, adv))
    return out

class Assets:
    def __init__(self):
        self.pl = plates()
        self.world = build_world()
        kinds = ['spruce'] * 6
        self.trees = [make_tree(100 + i, kinds[i]) for i in range(6)]
        self.cloud = fbm(1024, 2.6, 5)
        self.fogtex = [self._fogcard(i) for i in range(3)]
        cin = os.path.join(FONTS, 'fontsource-cinzel/files/cinzel-latin-700-normal.woff')
        cin_x = os.path.join(FONTS, 'fontsource-cinzel/files/cinzel-latin-ext-700-normal.woff')
        mon = os.path.join(FONTS, 'fontsource-montserrat/files/montserrat-latin-500-normal.woff')
        mon_x = os.path.join(FONTS, 'fontsource-montserrat/files/montserrat-latin-ext-500-normal.woff')
        self.title = letter_sprites('CHRYSTUS KRÓL', cin, 220, cin_x)
        self.end1 = letter_sprites('ŚWIEBODZIN', cin, 120, cin_x)
        self.end2 = letter_sprites('POLSKA', mon, 34, mon_x)
        g = np.linspace(-1, 1, 256, dtype=np.float32)
        rr = np.hypot(g[None, :], g[:, None])
        self.glow = np.exp(-rr ** 2 * 4.5) * 0.7 + np.exp(-rr * 7) * 0.3
        self.glow *= smooth((1 - rr) / 0.2)

    def _fogcard(self, i):
        n = fbm(256, 2.2, 70 + i)
        n = smooth((n + 0.6) / 2.2)
        g = np.linspace(-1, 1, 256, dtype=np.float32)
        e = np.clip(1 - (g[None, :] ** 2 + (g[:, None] * 1.0) ** 2), 0, 1) ** 1.5
        return cv2.resize((n * e).astype(np.float32), (512, 160))

A = None

# ------------------------------------------------------------------ drawing helpers
def comp_patch(frame, rgb, a, x0, y0):
    """premultiplied over-composite of a patch at integer offset"""
    h, w = a.shape
    X0, Y0 = max(x0, 0), max(y0, 0); X1, Y1 = min(x0 + w, W), min(y0 + h, H)
    if X1 <= X0 or Y1 <= Y0: return
    sx, sy = X0 - x0, Y0 - y0
    aa = a[sy:sy + Y1 - Y0, sx:sx + X1 - X0, None]
    frame[Y0:Y1, X0:X1] = frame[Y0:Y1, X0:X1] * (1 - aa) + rgb[sy:sy + Y1 - Y0, sx:sx + X1 - X0]

def add_patch(frame, rgb, x0, y0):
    h, w = rgb.shape[:2]
    X0, Y0 = max(x0, 0), max(y0, 0); X1, Y1 = min(x0 + w, W), min(y0 + h, H)
    if X1 <= X0 or Y1 <= Y0: return
    frame[Y0:Y1, X0:X1] += rgb[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]

def warp_quad(src, quad_dst, blur=0.0):
    """warp src (h,w[,c]) to dst quad (4x2, TL TR BR BL); returns patch, x0, y0"""
    q = np.asarray(quad_dst, np.float32)
    x0 = int(math.floor(q[:, 0].min())) - 4; y0 = int(math.floor(q[:, 1].min())) - 4
    x1 = int(math.ceil(q[:, 0].max())) + 4; y1 = int(math.ceil(q[:, 1].max())) + 4
    pad = int(blur * 3) + 1
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
    cx0, cy0, cx1, cy1 = max(x0, -50), max(y0, -50), min(x1, W + 50), min(y1, H + 50)
    if cx1 <= cx0 or cy1 <= cy0 or (cx1 - cx0) * (cy1 - cy0) > 9e6: return None
    h, w = src.shape[:2]
    srcq = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    M = cv2.getPerspectiveTransform(srcq, q - np.float32([cx0, cy0]))
    out = cv2.warpPerspective(src, M, (cx1 - cx0, cy1 - cy0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    if blur > 0.6:
        out = cv2.GaussianBlur(out, (0, 0), blur)
    return out, cx0, cy0

# ------------------------------------------------------------------ scene
def sky(cm, t):
    sw, sh = W // 4, H // 4
    xs = (np.arange(sw, dtype=np.float32) + 0.5) * 4 - W / 2
    ys = (np.arange(sh, dtype=np.float32) + 0.5) * 4 - H / 2
    X, Y = np.meshgrid(xs / cm['fpx'], ys / cm['fpx'])
    d = cm['f'][None, None, :] + X[..., None] * cm['r'][None, None, :] - Y[..., None] * cm['u'][None, None, :]
    d /= np.linalg.norm(d, axis=2, keepdims=True)
    el = d[..., 1]
    # gradient: city glow at horizon -> deep navy zenith (BGR, linear)
    hz = np.exp(-np.abs(el) * 9)[..., None]
    col = np.float32([0.0062, 0.0026, 0.0014]) * (1 - hz) + np.float32([0.014, 0.010, 0.010]) * hz
    # directional warm glow toward the town side
    az = np.arctan2(d[..., 0], -d[..., 2])
    col = col + (np.exp(-np.abs(el) * 14) * (0.5 + 0.5 * np.cos(az - 2.6)))[..., None] * np.float32([0.004, 0.009, 0.016])
    # clouds on a plane 700 m up
    up = np.maximum(el, 0.02)
    tt = (700 - cm['C'][1]) / up
    cxp = (cm['C'][0] + d[..., 0] * tt + t * 6) / 2600 * 1024
    czp = (cm['C'][2] + d[..., 2] * tt + t * 2) / 2600 * 1024
    cl = cv2.remap(A.cloud, (cxp % 1024).astype(np.float32), (czp % 1024).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
    cov = smooth((cl - 0.2) / 1.6) * smooth((el - 0.015) / 0.12)
    ccol = np.float32([0.009, 0.008, 0.009]) + np.float32([0.002, 0.005, 0.009]) * (0.5 + 0.5 * np.cos(az - 2.6))[..., None]
    col = col * (1 - cov[..., None] * 0.85) + ccol * cov[..., None] * 0.85
    col = cv2.resize(col, (W, H), interpolation=cv2.INTER_CUBIC)
    cov = cv2.resize(cov, (W, H), interpolation=cv2.INTER_LINEAR)
    # stars
    st = A.world['stars']
    z = st @ cm['f']; ok = z > 0.05
    sx = W / 2 + cm['fpx'] * (st @ cm['r']) / np.maximum(z, 1e-3)
    sy = H / 2 - cm['fpx'] * (st @ cm['u']) / np.maximum(z, 1e-3)
    ok &= (sx > 0) & (sx < W - 1) & (sy > 0) & (sy < H - 1)
    buf = np.zeros((H, W), np.float32)
    tw = 0.75 + 0.25 * np.sin(t * 3.1 + np.arange(len(st)) * 1.7)
    b = (A.world['sb'] * tw * smooth((st[:, 1] - 0.02) / 0.15))[ok]
    xi, yi = sx[ok], sy[ok]
    ix, iy = xi.astype(int), yi.astype(int); fx, fy = xi - ix, yi - iy
    for dx, dy, wgt in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        np.add.at(buf, (iy + dy, ix + dx), b * wgt)
    buf = cv2.GaussianBlur(buf, (0, 0), 0.7) * (1 - cov * 0.95)
    col += buf[..., None] * np.float32([1.0, 0.95, 0.9])
    return col

def draw_lights(frame, cm, zf):
    L = A.world['lights']
    sx, sy, z = project(cm, L)
    ok = (z > 5) & (sx > -5) & (sx < W + 5) & (sy > -5) & (sy < H + 5)
    buf = np.zeros((H, W, 3), np.float32)
    dist = z[ok]
    br = A.world['lbri'][ok] * np.clip(900 / dist, 0.25, 1.5) * 0.9
    xi, yi = sx[ok], sy[ok]
    ix = np.clip(xi.astype(int), 0, W - 2); iy = np.clip(yi.astype(int), 0, H - 2)
    fx, fy = xi - ix, yi - iy
    colv = A.world['lcol'][ok]
    for dx, dy, wgt in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        np.add.at(buf, (iy + dy, ix + dx), colv * (br * wgt)[:, None])
    c = max(coc(cm, 1500, zf), 0.6)
    halo = cv2.GaussianBlur(buf, (0, 0), 6) * 6
    buf = cv2.GaussianBlur(buf, (0, 0), min(c, 4))
    frame += buf + halo * 0.35

def haze(dist):
    return math.exp(-dist / 900.0)

FOGCOL = np.float32([0.011, 0.008, 0.007])

def tree_item(cm, tr, zf, statue_sx):
    x, yb, z, ht, k = tr
    a, lit = A.trees[k]
    hgt = ht; wid = ht * a.shape[1] / a.shape[0]
    P = np.array([x, yb, z])
    d = P - cm['C']; dist = d @ cm['f']
    if dist < 0.8: return None
    rr = np.cross([0, 1, 0], cm['f']); rr[1] = 0; rr /= np.linalg.norm(rr)
    corners = np.array([P - rr * wid / 2 + [0, hgt, 0], P + rr * wid / 2 + [0, hgt, 0], P + rr * wid / 2, P - rr * wid / 2])
    sx, sy, zz = project(cm, corners)
    if np.any(zz < 0.5): return None
    if sx.max() < -20 or sx.min() > W + 20 or sy.max() < -20 or sy.min() > H + 20: return None
    if (sy.max() - sy.min()) < 2.5: return None
    return ('tree', dist, (tr, sx, sy, zz))

def draw_tree(frame, cm, zf, data, statue_sx):
    tr, sx, sy, zz = data
    x, yb, z, ht, k = tr
    a, lit = A.trees[k]
    side_right = statue_sx > sx.mean()
    if not side_right: lit = lit[:, ::-1]
    dist = float(zz.mean())
    bl = coc(cm, dist, zf)
    # motion/size based downsample for speed
    ph = sy.max() - sy.min()
    sc = min(1.0, max(ph * 1.3 / a.shape[0], 0.02))
    if sc < 0.98:
        a_s = cv2.resize(a, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
        l_s = cv2.resize(lit, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
    else:
        a_s, l_s = a, lit
    res = warp_quad(np.dstack([a_s, l_s]), np.c_[sx, sy], blur=bl * 0.5)
    if res is None: return
    p, x0, y0 = res
    al, li = p[..., 0], p[..., 1]
    rad = math.hypot(x, z)
    I = 1.6 / (1 + (rad / 22) ** 2) + 0.05
    hz = haze(dist)
    base = np.float32([0.0025, 0.0045, 0.003]) * (0.6 + 0.4 * hz)
    litc = np.float32([0.05, 0.13, 0.08]) * I
    rgb = (base[None, None, :] + li[..., None] * litc[None, None, :]) * al[..., None]
    rgb = rgb * hz + FOGCOL * (1 - hz) * al[..., None]
    comp_patch(frame, rgb, al, x0, y0)

def draw_fog(frame, cm, zf, data):
    fg, sx, sy, zz = data
    x, y, z, w, k = fg
    tex = A.fogtex[k]
    rad = math.hypot(x, z)
    I = 0.55 / (1 + (rad / 45) ** 2) + 0.07
    dist = float(zz.mean())
    near = smooth((dist - 4) / 25)
    res = warp_quad(tex, np.c_[sx, sy], blur=max(coc(cm, dist, zf) * 0.5, 2))
    if res is None: return
    p, x0, y0 = res
    al = p * 0.45 * near
    col = np.float32([0.10, 0.11, 0.12]) * I
    comp_patch(frame, al[..., None] * col[None, None, :] * 1.0, al * 0.5, x0, y0)

def fog_item(cm, fg):
    x, y, z, w, k = fg
    P = np.array([x, y, z])
    rr = np.cross([0, 1, 0], cm['f']); rr[1] = 0; rr /= np.linalg.norm(rr)
    hgt = w * 160 / 512
    corners = np.array([P - rr * w / 2 + [0, hgt / 2, 0], P + rr * w / 2 + [0, hgt / 2, 0], P + rr * w / 2 - [0, hgt / 2, 0], P - rr * w / 2 - [0, hgt / 2, 0]])
    sx, sy, zz = project(cm, corners)
    if np.any(zz < 1): return None
    if sx.max() < 0 or sx.min() > W or sy.max() < 0 or sy.min() > H: return None
    return ('fog', float((P - cm['C']) @ cm['f']), (fg, sx, sy, zz))

def soft_clamp(x, lim):
    return lim * math.tanh(x / lim)

def draw_plate(frame, cm, zf, pl, th_p, alpha, t):
    """ray-cast the relief plate; return nothing (composited)"""
    th_c = cm['th']
    delta = soft_clamp(th_c - th_p, 9.0)
    thp = math.radians(th_c - delta)
    n = np.array([math.sin(thp), 0, -math.cos(thp)])
    er = np.array([math.cos(thp), 0, math.sin(thp)])
    eu = np.array([0., 1., 0.])
    sw, sh = W // 2, H // 2
    xs = (np.arange(sw, dtype=np.float32) + 0.5) * 2 - W / 2
    ys = (np.arange(sh, dtype=np.float32) + 0.5) * 2 - H / 2
    X, Y = np.meshgrid(xs / cm['fpx'], ys / cm['fpx'])
    d = cm['f'][None, None, :] + X[..., None] * cm['r'][None, None, :] - Y[..., None] * cm['u'][None, None, :]
    C = cm['C']
    nd = d @ n
    nC = C @ n
    hk = np.zeros((sh, sw), np.float32)
    s = pl['s']
    for it in range(3):
        tt = (hk - nC) / np.where(np.abs(nd) < 1e-6, -1e-6, nd)
        P = C[None, None, :] + d * tt[..., None]
        u = (pl['u0'] + (P @ er) / s).astype(np.float32)
        v = (pl['v0'] - (P @ eu) / s).astype(np.float32)
        if it < 2:
            hk = cv2.remap(pl['h'], u, v, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    u = cv2.resize(u, (W, H), interpolation=cv2.INTER_LINEAR)
    v = cv2.resize(v, (W, H), interpolation=cv2.INTER_LINEAR)
    img = cv2.remap(pl['rgba'], u, v, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    dist = float(np.linalg.norm(C))
    bl = coc(cm, dist, zf)
    if bl > 0.7: img = cv2.GaussianBlur(img, (0, 0), bl * 0.5)
    img *= alpha
    rgb, a = img[..., :3], img[..., 3]
    # slight exposure breathing + match to world
    rgb = rgb * pl.get('gain', 1.05)
    frame *= (1 - a[..., None]); frame += rgb

def draw_text3d(frame, cm, zf, t):
    # letters standing up behind the statue, gap around its body
    sprites = A.title
    cap = 8.0  # m per sprite height unit
    scale = cap / 220
    gap = 22.0
    w1 = sum(s[2] for s in sprites[:8]) * scale
    w2 = sum(s[2] for s in sprites[9:]) * scale
    xs = []
    x = -gap / 2 - w1
    for i, (ch, spr, adv) in enumerate(sprites):
        if ch == ' ':
            x = gap / 2; xs.append(None); continue
        xs.append(x); x += adv * scale
    Zp, Yb = 30.0, -9.0
    out = np.zeros_like(frame)
    order = sorted([i for i in range(len(sprites)) if xs[i] is not None], key=lambda i: abs(xs[i] + sprites[i][2] * scale / 2))
    fade_out = 1 - smooth((t - 11.45) / 0.6)
    for rank, i in enumerate(order):
        ch, spr, adv = sprites[i]
        t0 = 7.35 + rank * 0.11
        p = ease_out((t - t0) / 1.1)
        if p <= 0: continue
        h_, w_ = spr.shape
        sw_, sh_ = w_ * scale, h_ * scale
        ang = math.radians(75 * (1 - p))
        yb = Yb - 4 * (1 - p) ** 2
        x0 = xs[i] - 20 * scale
        base = np.array([x0, yb, Zp])
        topv = np.array([0, math.cos(ang), math.sin(ang)]) * sh_
        quad = np.array([base + topv, base + topv + [sw_, 0, 0], base + [sw_, 0, 0], base])
        sx, sy, zz = project(cm, quad)
        if np.any(zz < 1): continue
        dist = float(zz.mean())
        res = warp_quad(spr, np.c_[sx, sy], blur=max(coc(cm, dist, zf) * 0.5, (1 - p) * 6))
        if res is None: continue
        pp, px, py = res
        a = pp * p * fade_out
        col = np.float32([0.55, 0.80, 1.0]) * 1.6
        comp_patch(out, a[..., None] * col, a * 0.0, px, py)
    frame += out
    return out

def draw_beams(frame, cm, t, k=1.0):
    sw, sh = W // 4, H // 4
    buf = np.zeros((sh, sw), np.float32)
    for i, lp in enumerate(A.world['lamps']):
        S = np.array(lp, float)
        tgt = np.array([S[0] * 0.25, 40.0, S[2] * 0.25 + 3])
        dv = tgt - S; dv /= np.linalg.norm(dv)
        for j in range(10):
            a0, a1 = j * 7.0, (j + 1) * 7.0
            P0, P1 = S + dv * a0, S + dv * a1
            sx, sy, zz = project(cm, np.array([P0, P1]))
            if np.any(zz < 2): continue
            wv0 = 1.0 + a0 * 0.16; wv1 = 1.0 + a1 * 0.16
            p0 = np.array([sx[0], sy[0]]); p1 = np.array([sx[1], sy[1]])
            dd = p1 - p0; L = np.linalg.norm(dd)
            if L < 1e-3: continue
            nrm = np.array([-dd[1], dd[0]]) / L
            w0 = cm['fpx'] * wv0 / zz[0]; w1 = cm['fpx'] * wv1 / zz[1]
            poly = np.array([p0 + nrm * w0, p1 + nrm * w1, p1 - nrm * w1, p0 - nrm * w0]) / 4
            val = 0.05 * math.exp(-a0 / 28) * (0.8 + 0.2 * math.sin(i * 2.1 + t * 0.4))
            cv2.fillConvexPoly(buf, np.round(poly * 16).astype(np.int32), val, lineType=cv2.LINE_AA, shift=4)
    buf = cv2.GaussianBlur(buf, (0, 0), 3)
    nz = cv2.resize(A.cloud[:270, :480], (sw, sh))
    nz = 0.7 + 0.3 * np.roll(nz, int(t * 12), axis=1)
    buf = cv2.resize(buf * nz, (W, H), interpolation=cv2.INTER_LINEAR)
    frame += buf[..., None] * np.float32([0.75, 0.88, 1.0]) * k

def draw_dust(frame, cm, zf, t, near_only=None):
    P = A.world['dust'] + A.world['dvel'] * t
    sx, sy, z = project(cm, P)
    ok = (z > 0.8) & (sx > -40) & (sx < W + 40) & (sy > -40) & (sy < H + 40)
    if near_only is not None:
        ok &= (z < near_only) if near_only > 0 else (z >= -near_only)
    buf = np.zeros((H, W), np.float32)
    rad = np.hypot(P[:, 0], P[:, 2])
    lit = 1.2 / (1 + (rad / 25) ** 2) + 0.05
    for i in np.nonzero(ok)[0]:
        c = max(coc(cm, z[i], zf), 0.7)
        e = lit[i] * 0.9 * min(1.0, 9.0 / (c * c))
        cv2.circle(buf, (int(sx[i] * 4), int(sy[i] * 4)), int(c * 4), float(e), -1, cv2.LINE_AA, shift=2)
    buf = cv2.GaussianBlur(buf, (0, 0), 0.8)
    frame += buf[..., None] * np.float32([0.75, 0.85, 1.0]) * 0.5

def draw_glow(frame, cm, k):
    sx, sy, z = project(cm, np.array([[0, 2.0, 0]]))
    if z[0] < 1: return
    R = int(cm['fpx'] * 55 / z[0])
    if R < 4 or R > 4000: return
    g = cv2.resize(A.glow, (2 * R, 2 * R))
    add_patch(frame, g[..., None] * np.float32([0.020, 0.026, 0.032]) * k, int(sx[0]) - R, int(sy[0]) - R)

def plate_mix(t):
    """returns list of (plate, native theta, weight)"""
    x = smooth((t - 11.92) / 0.2)
    out = []
    if x < 1: out.append(('front', 0.0, 1 - x))
    if x > 0: out.append(('side', -40.0, x))
    return out

def render_scene(t):
    cm = cam(t)
    zf = focus_dist(t, cm)
    frame = sky(cm, t)
    draw_lights(frame, cm, zf)
    ssx, ssy, _ = project(cm, np.array([[0, 0, 0]]))
    items = []
    for tr in A.world['trees']:
        it = tree_item(cm, tr, zf, ssx[0])
        if it: items.append(it)
    for fg in A.world['fog']:
        it = fog_item(cm, fg)
        if it: items.append(it)
    pdist = float((np.zeros(3) - cm['C']) @ cm['f'])
    items.append(('glow', pdist + 40, None))
    if 7.3 < t < 12.1: items.append(('text', pdist + 30, None))
    items.append(('dustfar', pdist + 0.5, None))
    items.append(('plate', pdist, None))
    items.append(('beams', pdist - 10, None))
    items.append(('dustnear', pdist - 0.5, None))
    items.sort(key=lambda it: -it[1])
    for kind, dist, data in items:
        if kind == 'tree': draw_tree(frame, cm, zf, data, ssx[0])
        elif kind == 'fog': draw_fog(frame, cm, zf, data)
        elif kind == 'glow': draw_glow(frame, cm, 1.0)
        elif kind == 'text': draw_text3d(frame, cm, zf, t)
        elif kind == 'plate':
            for name, thp, wgt in plate_mix(t):
                draw_plate(frame, cm, zf, A.pl[name], thp, wgt, t)
        elif kind == 'beams': draw_beams(frame, cm, t)
        elif kind == 'dustfar': draw_dust(frame, cm, zf, t, near_only=-pdist)
        elif kind == 'dustnear': draw_dust(frame, cm, zf, t, near_only=pdist)
    return frame

def endtitle(frame, t):
    if t < 25.4: return
    def row(sprites, scale_px, tracking, y, t0, col, stagger):
        widths = [s[2] + tracking for s in sprites]
        total = sum(widths) - tracking
        x = W / 2 - total / 2
        for i, (ch, spr, adv) in enumerate(sprites):
            if spr is not None:
                p = ease_out((t - t0 - i * stagger) / 1.0)
                if p > 0:
                    bl = (1 - p) * 8
                    s = spr if bl < 0.5 else cv2.GaussianBlur(spr, (0, 0), bl)
                    a = s * p
                    comp_patch(frame, a[..., None] * col, a * 0.35, int(x - 20), int(y - 20 + (1 - p) * 26))
            x += widths[i]
    tr = 90 - 40 * ease_out((t - 25.5) / 3.0)
    row(A.end1, 120, tr, 700, 25.55, np.float32([0.62, 0.82, 1.0]) * 1.2, 0.07)
    p = ease_out((t - 26.4) / 1.2)
    if p > 0:
        L = int(260 * p)
        cv2.line(frame, (W // 2 - L, 885), (W // 2 + L, 885), (0.25 * p, 0.35 * p, 0.45 * p), 2, cv2.LINE_AA)
    row(A.end2, 34, 26, 902, 26.7, np.float32([0.45, 0.55, 0.65]), 0.06)

# ------------------------------------------------------------------ post
def post(lin_frame, t, idx):
    f = lin_frame
    # exposure envelope + hits
    ev = smooth(t / 1.6) * (1 - smooth((t - 29.0) / 1.0))
    hit = 0
    for th_, k in ((6.0, 0.22), (12.0, 0.16), (24.0, 0.12)):
        if t >= th_: hit += k * math.exp(-(t - th_) / 0.35)
    f = f * (1.15 * ev) * (1 + hit)
    # bloom
    br = np.maximum(f - 0.45, 0)
    small = cv2.resize(br, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    bl = cv2.GaussianBlur(small, (0, 0), 4) * 0.6 + cv2.GaussianBlur(small, (0, 0), 16) * 0.5 + cv2.GaussianBlur(small, (0, 0), 45) * 0.45
    streak = cv2.blur(cv2.resize(br, (W // 8, H // 8), interpolation=cv2.INTER_AREA), (90, 1))
    bl = cv2.resize(bl, (W, H), interpolation=cv2.INTER_LINEAR)
    st = cv2.resize(streak, (W, H), interpolation=cv2.INTER_LINEAR) * np.float32([1.0, 0.7, 0.45])
    f = f + bl * 0.55 + st * (0.25 + hit)
    # grade: cool shadows / warm highlights
    l = f.mean(2, keepdims=True)
    f = f + np.float32([0.0015, 0.0005, 0.0]) * (1 - smooth(l / 0.2))
    f = f * (np.float32([0.93, 0.98, 1.06]) * smooth(l / 0.6) + np.float32([1.03, 1.0, 0.97]) * (1 - smooth(l / 0.6)))
    # tone map
    f = np.maximum(f, 0)
    f = f * (1 + f / 6.0) / (1 + f)
    g = np.power(f, 1 / 2.2)
    # vignette
    yy, xx = np.ogrid[:H, :W]
    rr = ((xx - W / 2) / (W / 2)) ** 2 * 0.8 + ((yy - H / 2) / (H / 2)) ** 2 * 0.6
    g = g * (1 - 0.32 * rr[..., None] ** 1.3)
    # chromatic aberration (tiny)
    Mr = cv2.getRotationMatrix2D((W / 2, H / 2), 0, 1.0012)
    Mb = cv2.getRotationMatrix2D((W / 2, H / 2), 0, 0.9988)
    g[..., 2] = cv2.warpAffine(g[..., 2], Mr, (W, H), borderMode=cv2.BORDER_REFLECT)
    g[..., 0] = cv2.warpAffine(g[..., 0], Mb, (W, H), borderMode=cv2.BORDER_REFLECT)
    # grain
    rng = np.random.default_rng(1000 + idx)
    gr = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
    gr = cv2.resize(gr, (W, H), interpolation=cv2.INTER_LINEAR)
    g = g + gr[..., None] * 0.012
    return np.clip(g * 255 + rng.random((H, W, 1)) - 0.5, 0, 255).astype(np.uint8)

def speed_px(t):
    a, b = cam(t), cam(t + 1 / FPS)
    ang = np.radians(np.arange(0, 360, 30))
    pts = np.vstack([[[0, 0, 0], [0, 15, 0], [-12, 12, 0], [12, 10, 0]],
                     np.c_[60 * np.sin(ang), np.full(len(ang), -25), -60 * np.cos(ang)],
                     np.c_[900 * np.sin(ang), np.full(len(ang), -40), -900 * np.cos(ang)]]).astype(float)
    p1 = np.array(project(a, pts)[:2]); p2 = np.array(project(b, pts)[:2])
    z = project(a, pts)[2]
    ok = (z > 15) & (p1[0] > -200) & (p1[0] < W + 200) & (p1[1] > -200) & (p1[1] < H + 200)
    d = np.hypot(p2[0] - p1[0], p2[1] - p1[1])[ok] if ok.any() else np.zeros(1)
    # closest tree corridor speed (opening)
    extra = 26 if t < 5.5 else 0
    return float(np.max(d)) + extra

def render_frame(idx):
    global A
    if A is None: A = Assets()
    t = idx / FPS
    sp = speed_px(t)
    whip = math.exp(-((t - 12.0) / 0.13) ** 2)
    sh = 0.5 + 1.0 * whip
    n = int(np.clip(math.ceil(sp * sh / 3.0), 1, 10))
    acc = None
    for k in range(n):
        ts = t + ((k + 0.5) / n - 0.5) * sh / FPS if n > 1 else t
        fr = render_scene(ts)
        acc = fr if acc is None else acc + fr
    acc /= n
    if whip > 0.05:
        L = int(1 + 120 * whip) | 1
        kern = np.zeros((L, L), np.float32); kern[L // 2, :] = 1
        Mr = cv2.getRotationMatrix2D((L / 2 - 0.5, L / 2 - 0.5), -10, 1.0)
        kern = cv2.warpAffine(kern, Mr, (L, L)); kern /= kern.sum()
        acc = cv2.filter2D(acc, -1, kern, borderType=cv2.BORDER_REFLECT)
    endtitle(acc, t)
    return post(acc, t, idx)

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'video':
        import subprocess, multiprocessing as mp, time
        out = sys.argv[2]; a0 = int(sys.argv[3]) if len(sys.argv) > 3 else 0; a1 = int(sys.argv[4]) if len(sys.argv) > 4 else int(DUR * FPS)
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                               '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', str(FPS), out], stdin=subprocess.PIPE)
        t0 = time.time()
        with mp.Pool(4) as pool:
            for k, im in enumerate(pool.imap(render_frame, range(a0, a1), chunksize=2)):
                ff.stdin.write(im.tobytes())
                if k % 60 == 0: print(a0 + k, round(time.time() - t0), flush=True)
        ff.stdin.close(); ff.wait()
        print('done', round(time.time() - t0))
    if mode == 'stills':
        os.makedirs(os.path.join(ROOT, 'stills'), exist_ok=True)
        import time
        for tt in [float(x) for x in sys.argv[2].split(',')]:
            t0 = time.time()
            im = render_frame(int(round(tt * FPS)))
            cv2.imwrite(os.path.join(ROOT, 'stills', f'f_{tt:05.2f}.jpg'), im, [cv2.IMWRITE_JPEG_QUALITY, 88])
            print(tt, round(time.time() - t0, 2), flush=True)
