"""Original cinematic score + sound design, synced to render.py timeline (80 BPM, bar = 3 s)."""
import numpy as np, sys
from scipy import signal
from scipy.io import wavfile

SR = 48000; DUR = 30.0; N = int(SR * DUR)
rng = np.random.default_rng(3)
t = np.arange(N) / SR

def note(n):  # midi -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def env_adsr(n, a, r, total):
    e = np.ones(n)
    na = max(int(a * SR), 1); nr = max(int(r * SR), 1)
    e[:na] = np.linspace(0, 1, na) ** 2
    e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e

def saw(f, n, phase=0.0):
    ph = (phase + np.cumsum(np.full(n, f) if np.isscalar(f) else f) / SR) % 1.0
    return 2 * ph - 1

def lp(x, fc, order=2):
    sos = signal.butter(order, fc, 'low', fs=SR, output='sos'); return signal.sosfilt(sos, x)

def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos'); return signal.sosfilt(sos, x)

def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'); return signal.sosfilt(sos, x)

L = np.zeros(N); R = np.zeros(N)
busL = {k: np.zeros(N) for k in ('dry', 'verb')}; busR = {k: np.zeros(N) for k in ('dry', 'verb')}

def put(x, start, gain=1.0, pan=0.0, verb=0.3):
    i0 = int(start * SR)
    if i0 >= N: return
    x = x[:N - i0]
    gl = gain * np.cos((pan + 1) * np.pi / 4); gr = gain * np.sin((pan + 1) * np.pi / 4)
    for bus, w in (('dry', 1 - verb * 0.5), ('verb', verb)):
        busL[bus][i0:i0 + len(x)] += x * gl * w
        busR[bus][i0:i0 + len(x)] += x * gr * w

# ---------------------------------------------------------------- harmony
# D minor: Dm | Dm | Dm Bb | F C | Dm Bb | F D(maj)
chords = [  # (start, dur, midi notes)
    (0.0, 6.0, [38, 50, 57, 62, 65]),        # Dm (low, sparse)
    (6.0, 3.0, [38, 50, 57, 62, 65, 69]),    # Dm
    (9.0, 3.0, [34, 46, 53, 58, 62, 65]),    # Bb
    (12.0, 3.0, [41, 53, 57, 60, 65, 69]),   # F
    (15.0, 3.0, [36, 48, 55, 60, 64, 67]),   # C
    (18.0, 3.0, [38, 50, 57, 62, 65, 69, 74]),
    (21.0, 3.0, [34, 46, 53, 58, 62, 65, 70]),
    (24.0, 3.0, [41, 53, 57, 60, 65, 69, 72]),
    (27.0, 3.0, [38, 50, 57, 62, 66, 69, 74]),  # D major — light at the end
]

def pad_chord(start, dur, notes, bright, gain):
    n = int((dur + 1.6) * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        for d in (-0.09, 0.0, 0.08):
            f = note(m) * 2 ** (d / 12) * (1 + 0.0015 * np.sin(2 * np.pi * (0.2 + rng.random() * 0.3) * tt + rng.random() * 6))
            out += saw(f, n, rng.random()) * (0.6 if m < 45 else 1.0)
    out = lp(out, bright, 2)
    e = env_adsr(n, 0.9, 1.6, n)
    return out * e * gain / len(notes)

def choir(start, dur, notes, gain):
    n = int((dur + 1.4) * SR); tt = np.arange(n) / SR
    src = np.zeros(n)
    for m in notes:
        if m < 50: continue
        for d in (-0.12, 0.1):
            vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt + rng.random() * 6)
            src += saw(note(m) * 2 ** (d / 12) * vib, n, rng.random())
    out = bp(src, 600, 820) * 1.0 + bp(src, 1050, 1350) * 0.55 + bp(src, 2400, 2900) * 0.25
    return out * env_adsr(n, 1.2, 1.4, n) * gain / max(len(notes), 1)

for i, (s0, d, ns) in enumerate(chords):
    bright = 700 if s0 < 6 else (1400 if s0 < 12 else (2200 if s0 < 24 else 2600))
    g = 0.22 if s0 < 6 else 0.34
    x = pad_chord(s0, d, ns, bright, g)
    put(x, s0 - 0.4 if s0 > 0 else 0, 1.0, pan=-0.25, verb=0.45)
    put(np.roll(x, 900), s0 - 0.4 if s0 > 0 else 0, 1.0, pan=0.25, verb=0.45)
    if s0 >= 6:
        put(choir(s0, d, ns, 0.55 if s0 < 18 else 0.75), s0 - 0.5, 1.0, pan=0.0, verb=0.7)

# ---------------------------------------------------------------- low drone / sub
sub_f = np.full(N, note(26))
for s0, d, ns in chords:
    i0 = int(s0 * SR); sub_f[i0:] = note(ns[0] - 12)
sub_f = lp(sub_f, 3)  # glide
sub = np.sin(2 * np.pi * np.cumsum(sub_f) / SR)
sub_env = 0.35 + 0.65 * np.clip((t - 4) / 2, 0, 1)
sub_env *= np.clip((30 - t) / 1.2, 0, 1)
put(sub * sub_env * 0.30, 0, verb=0.0)

# ---------------------------------------------------------------- night ambience
wind = lp(hp(rng.normal(size=N), 120), 900) * (0.10 + 0.05 * np.sin(2 * np.pi * 0.11 * t))
wind *= np.clip(t / 1.5, 0, 1) * np.clip((30 - t) / 2, 0, 1)
put(wind, 0, 1.0, pan=-0.3, verb=0.2); put(np.roll(wind, 20000), 0, 1.0, pan=0.3, verb=0.2)
# crickets in the forest (fade as we climb)
cr = np.zeros(N)
for k in range(3):
    f0 = 4300 + k * 370; rate = 2.6 + k * 0.7
    gate = (np.sin(2 * np.pi * rate * t + k) > 0.55).astype(float)
    gate = lp(gate, 60)
    trill = 0.5 + 0.5 * np.sin(2 * np.pi * 45 * t)
    cr += np.sin(2 * np.pi * f0 * t) * gate * trill * 0.012
cr *= np.clip(t / 0.8, 0, 1) * np.clip((7.5 - t) / 2.5, 0, 1)
put(cr, 0, 1.0, pan=0.4, verb=0.35); put(np.roll(cr, 7000), 0, 0.7, pan=-0.5, verb=0.35)

# ---------------------------------------------------------------- sfx helpers
def stft_shape(x, centers_fn, width_fn):
    f, tt, Z = signal.stft(x, SR, nperseg=2048)
    C = centers_fn(tt)[None, :]; Wd = width_fn(tt)[None, :]
    mask = np.exp(-0.5 * (np.log2(np.maximum(f[:, None], 20) / C) / Wd) ** 2)
    _, y = signal.istft(Z * mask, SR, nperseg=2048)
    return y[:len(x)]

def whoosh(dur, f0, f1, peak=0.6, gain=1.0):
    n = int(dur * SR); x = rng.normal(size=n)
    y = stft_shape(x, lambda tt: f0 * (f1 / f0) ** np.clip(tt / dur, 0, 1), lambda tt: np.full_like(tt, 0.9))
    tt = np.arange(n) / SR
    e = np.where(tt < peak * dur, (tt / (peak * dur)) ** 2.5, np.exp(-(tt - peak * dur) / (0.18 * dur)))
    return y * e * gain

def riser(dur, gain=1.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = whoosh(dur, 300, 6000, peak=0.98, gain=1.0)
    f = 110 * (8 ** (tt / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt / dur) ** 3 * 0.25
    shimmer = sum(np.sin(2 * np.pi * np.cumsum(f * k) / SR) for k in (2, 3.01)) * (tt / dur) ** 4 * 0.06
    return (x + tone + shimmer) * gain

def boom(gain=1.0, length=3.5, f_hi=110, f_lo=32):
    n = int(length * SR); tt = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-tt / 0.09)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 1.1)
    body = np.tanh(body * 2.2) * 0.8
    nz = lp(rng.normal(size=n), 2500) * np.exp(-tt / 0.12) * 0.5
    crack = hp(rng.normal(size=n), 3000) * np.exp(-tt / 0.02) * 0.25
    return (body + nz + crack) * gain

def braam(notes, gain=1.0, length=3.8):
    n = int(length * SR); tt = np.arange(n) / SR
    x = sum(saw(note(m) * 2 ** (d / 12), n, rng.random()) for m in notes for d in (-0.1, 0.1))
    x = np.tanh(x * 1.5)
    cut = 400 + 2200 * np.exp(-tt / 0.6)
    y = np.zeros(n)
    blk = 2400
    for i in range(0, n, blk):  # time-varying LPF in blocks
        seg = x[max(0, i - blk):i + blk]
        y[i:i + blk] = lp(seg, cut[i])[-len(x[i:i + blk]):]
    return y * np.exp(-tt / 1.4) * (1 - np.exp(-tt / 0.01)) * gain / len(notes)

def tom(gain=1.0, f0=95, f1=52):
    n = int(0.7 * SR); tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt / 0.05)
    b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.22)
    s = bp(rng.normal(size=n), 150, 1200) * np.exp(-tt / 0.04) * 0.4
    return np.tanh((b + s) * 1.6) * gain

def bell(m, gain=1.0, length=4.0):
    n = int(length * SR); tt = np.arange(n) / SR
    f = note(m); y = np.zeros(n)
    for p, a, dcy in ((1, 1, 2.5), (2.0, 0.45, 1.6), (2.76, 0.35, 1.0), (5.4, 0.18, 0.5), (8.93, 0.08, 0.25)):
        y += a * np.sin(2 * np.pi * f * p * tt + rng.random()) * np.exp(-tt / dcy)
    return y * (1 - np.exp(-tt / 0.002)) * gain

def rev_swell(dur, gain=1.0):
    return boom(1.0, length=dur)[::-1] * 0.0 + whoosh(dur, 200, 3000, peak=0.99) * gain

# ---------------------------------------------------------------- the edit (visual sync points)
# trees brushing past the lens in the forest opening
for tt0, pan in ((1.25, 0.7), (2.15, -0.7), (3.05, 0.6), (3.9, -0.6), (4.75, 0.7)):
    put(whoosh(0.9, 250, 1400, peak=0.45, gain=0.35), tt0, pan=pan, verb=0.15)
# soft heartbeat pulses in the dark
for b in np.arange(0.75, 5.5, 1.5):
    put(tom(0.25, 70, 45), b, verb=0.2)
put(riser(2.6, 0.55), 6.0 - 2.6, verb=0.35)
# 6.0 reveal
put(boom(1.0), 6.0, verb=0.5)
put(braam([38, 45, 50], 0.9), 6.0, verb=0.5)
put(bell(74, 0.35), 6.02, pan=0.2, verb=0.8)
# letters rise: chime arpeggio (one per letter, centre-out order) 7.35 + k*0.11
arp = [62, 65, 69, 74, 77, 81, 74, 69, 77, 81, 86, 89]
for k, m in enumerate(arp):
    put(bell(m, 0.10, 2.5), 7.35 + k * 0.11 + 0.12, pan=(-1) ** k * 0.5, verb=0.75)
# 12.0 whip-orbit
put(rev_swell(0.9, 0.5), 12.0 - 0.9, verb=0.4)
put(whoosh(0.8, 400, 3500, peak=0.5, gain=0.9), 11.65, pan=-0.6, verb=0.25)
put(whoosh(0.8, 3000, 300, peak=0.25, gain=0.6), 11.95, pan=0.6, verb=0.25)
put(boom(0.8, 2.5, 90, 38), 12.0, verb=0.4)
# taiko drive 12 -> 24 (8ths, accents on bar starts)
beat = 0.75
for k, tt0 in enumerate(np.arange(12.0, 23.99, beat / 2)):
    pos = k % 8
    g = {0: 0.55, 3: 0.32, 4: 0.42, 6: 0.3, 7: 0.25}.get(pos, 0.0)
    if tt0 >= 18: g *= 1.25
    if g: put(tom(g, 100 if pos in (0, 4) else 130, 55 if pos in (0, 4) else 75), tt0, pan=(0.2 if pos % 2 else -0.2), verb=0.3)
# string ostinato 15 -> 24
ost = []
for s0, d, ns in chords:
    if 15 <= s0 < 24:
        for k in range(int(d / (beat / 2))):
            ost.append((s0 + k * beat / 2, ns[2] + (12 if k % 2 else 0)))
for tt0, m in ost:
    n = int(0.36 * SR); tt = np.arange(n) / SR
    x = lp(saw(note(m), n) + saw(note(m) * 1.003, n), 1800) * np.exp(-tt / 0.15) * (1 - np.exp(-tt / 0.008))
    put(x * 0.09, tt0, pan=0.35, verb=0.35)
# 18 face approach swell, 21 rack-focus bell
put(bell(81, 0.18), 18.0, pan=-0.3, verb=0.8)
put(bell(86, 0.22), 21.0, pan=0.3, verb=0.85)
put(riser(2.4, 0.6), 24.0 - 2.4, verb=0.35)
# 24.0 release: big hit, then wide pull-back
put(boom(1.1), 24.0, verb=0.55)
put(braam([41, 48, 53], 0.9), 24.0, verb=0.5)
put(whoosh(2.2, 2500, 200, peak=0.12, gain=0.5), 24.05, verb=0.4)
# end title shimmer + final light
for k, m in enumerate([74, 78, 81, 86, 90]):
    put(bell(m, 0.12, 3.0), 25.55 + k * 0.14, pan=(k - 2) * 0.3, verb=0.85)
put(bell(62, 0.3, 4.0), 27.0, verb=0.85)

# ---------------------------------------------------------------- reverb + master
def ir(sec, seed):
    r = np.random.default_rng(seed); n = int(sec * SR); tt = np.arange(n) / SR
    x = r.normal(size=n) * np.exp(-tt / (sec / 6.5))
    return lp(x, 6000) * 0.5 / np.sqrt(np.sum(x ** 2) / SR)
IRL, IRR = ir(3.2, 11), ir(3.2, 12)
wl = signal.fftconvolve(busL['verb'], IRL)[:N] * 0.06
wr = signal.fftconvolve(busR['verb'], IRR)[:N] * 0.06
L = busL['dry'] + wl; R = busR['dry'] + wr
L = hp(L, 22); R = hp(R, 22)
fade = np.clip((DUR - t) / 1.4, 0, 1) ** 1.5 * np.clip(t / 0.05, 0, 1)
L *= fade; R *= fade
pk = max(np.abs(L).max(), np.abs(R).max())
L, R = L / pk, R / pk
drive = 1.6
L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)
L *= 0.89; R *= 0.89
out = np.stack([L, R], 1)
wavfile.write(sys.argv[1], SR, (out * 32767).astype(np.int16))
print('ok', out.shape, np.abs(out).max())
