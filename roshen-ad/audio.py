"""Музика і звуковий дизайн для «Відкуси чорничну ніч» (20 с, 120 BPM).
Синтез з нуля (numpy/scipy), без зовнішніх семплів. Запуск: python3 audio.py out.wav [gain_db]
Синхроточки: 3.0 відрив ягоди, 4.0 удар, 8.0 застигання, 9.0 злам, 13.0 пекшот, 17.0 фінальний акорд, 18.0 «крапка»."""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(42)
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
dry = np.zeros((N, 2))  # no reverb (sub/kick)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, t0, sig, pan=0.0, gain=1.0):
    i0 = int(round(t0 * SR))
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    i1 = min(N, i0 + len(sig))
    if i1 <= max(0, i0):
        return
    s0 = max(0, -i0)
    buf[max(0, i0):i1] += sig[s0:s0 + i1 - max(0, i0)] * gain


def env_adsr(n, a, d, s, r, hold=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    hold = n - a - d - r if hold is None else int(hold * SR)
    hold = max(0, hold)
    e = np.concatenate([np.linspace(0, 1, max(1, a)), np.linspace(1, s, max(1, d)), np.full(hold, s), np.linspace(s, 0, max(1, r))])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


# ---------------- instruments ----------------
def pad(freqs, dur, bright=0.5):
    t = tt(dur)
    out = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            ph = rng.uniform(0, 2 * np.pi)
            for h in range(1, 7):
                out += np.sin(2 * np.pi * ff * h * t + ph * h) * (bright ** (h - 1)) / h
    out = lp(out, 2200)
    out *= env_adsr(len(t), 0.6, 0.3, 0.85, 0.9) * (1 + 0.08 * np.sin(2 * np.pi * 0.3 * t))
    return out / (len(freqs) * 6)


def musicbox(f, dur=1.6, vel=1.0):
    t = tt(dur)
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 6)
         + 0.18 * np.sin(2 * np.pi * f * 5.43 * t) * np.exp(-t * 14) + 0.08 * np.sin(2 * np.pi * f * 3.01 * t))
    s *= np.exp(-t * 3.2) * np.minimum(1, t / 0.002)
    return s * vel * 0.18


def bell(f, dur=3.0, vel=1.0):
    t = tt(dur)
    parts = [(1, 1, 1.2), (2.0, 0.5, 2.2), (2.76, 0.35, 3), (5.4, 0.2, 5), (8.93, 0.1, 8)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in parts)
    return s * np.minimum(1, t / 0.003) * vel * 0.12


def bass(f, dur, vel=1.0):
    t = tt(dur)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    s *= env_adsr(len(t), 0.005, 0.12, 0.7, 0.08)
    return lp(s, 900) * vel * 0.32


def kick(vel=1.0, big=False):
    t = tt(0.9 if big else 0.45)
    f = 45 + 110 * np.exp(-t * (28 if not big else 18))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * (7 if not big else 3.2))
    s += 0.25 * hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 120)
    return np.tanh(s * 1.6) * vel * 0.55


def clap(vel=1.0):
    t = tt(0.35)
    n = bp(rng.standard_normal(len(t)), 900, 5000)
    e = np.zeros_like(t)
    for d in (0, 0.009, 0.018):
        e += (t >= d) * np.exp(-np.maximum(0, t - d) * 60)
    e += 0.6 * np.exp(-t * 14)
    return n * e * vel * 0.16


def snapfx(vel=1.0):  # finger snap
    t = tt(0.12)
    return bp(rng.standard_normal(len(t)), 1800, 7000) * np.exp(-t * 70) * vel * 0.18


def hat(vel=1.0):
    t = tt(0.08)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 80) * vel * 0.05


def sweep_noise(dur, f0, f1, width=0.35, amp_curve=None):
    """noise with a moving band (via STFT mask)"""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    f, t, Z = signal.stft(x, SR, nperseg=1024)
    cf = np.geomspace(f0, f1, Z.shape[1])
    lf = np.log(np.maximum(f, 1))[:, None]
    mask = np.exp(-((lf - np.log(cf)[None, :]) ** 2) / (2 * width ** 2))
    _, y = signal.istft(Z * mask, SR, nperseg=1024)
    y = y[:n]
    if amp_curve is not None:
        y *= amp_curve(np.arange(n) / n)
    return y / (np.max(np.abs(y)) + 1e-9)


# ---------------- harmony / arrangement ----------------
E2, G2, A2, B2, C3, D3, E3, Fs3, G3, A3, B3, C4, D4, E4, Fs4, G4, A4, B4 = 40, 43, 45, 47, 48, 50, 52, 54, 55, 57, 59, 60, 62, 64, 66, 67, 69, 71
CH = {
    'Em': ([E3, G3, B3, D4, Fs4], E2), 'C': ([C3, E3, G3, B3, D4], 36), 'G': ([G2 + 12, B3, D4, Fs4], G2), 'D': ([D3, Fs3, A3, E4], 38),
}
prog = [(0, 2, 'Em'), (2, 4, 'C'), (4, 6, 'Em'), (6, 8, 'C'), (8, 10, 'G'), (10, 12, 'D'), (12, 13, 'Em'), (13, 15, 'C'), (15, 17, 'D'), (17, 20, 'G')]
for a, b, c in prog:
    notes, root = CH[c]
    dur = (b - a) + 1.2
    p = pad([midi(m) for m in notes], dur, bright=0.45 if a < 4 else 0.55)
    if a == 2:  # breathe out before impact
        p *= np.clip((3.85 - (a + tt(dur))) / 0.25, 0, 1)
    if a == 12:
        p *= np.clip((12.95 - (a + tt(dur))) / 0.4, 0, 1) * 0.7 + 0.3 * np.clip((12.95 - (a + tt(dur))) / 0.1, 0, 1)
    if a == 17:
        p = pad([midi(m) for m in [G2 + 12, B3, D4, G4, A4]], 3.6, bright=0.6) * np.clip((20.0 - (17 + tt(3.6))) / 1.6, 0, 1)
    place(music, a, p, gain=0.9)

# music-box arpeggio (8ths) — motif shape changes per section
arp = {
    'Em': [E4, G4, B4, D4 + 12, B4, G4, Fs4, G4], 'C': [E4, G4, B4, C4 + 12, B4, G4, E4, D4],
    'G': [D4, G4, B4, D4 + 12, B4, A4, G4, D4], 'D': [Fs4, A4, D4 + 12, E4 + 12, D4 + 12, A4, Fs4, E4],
}
for a, b, c in prog:
    if a >= 17:
        continue
    for k in range(int((b - a) * 4)):
        tk = a + k * 0.25
        if 3.75 <= tk < 4.0 or 12.5 <= tk < 13.0 or (8.5 <= tk < 9.0) or tk < 0.3:
            continue
        m = arp[c][k % 8] + (12 if a >= 13 else 0)
        vel = 0.75 if k % 2 == 0 else 0.5
        if a < 4:
            vel *= 0.7
        place(music, tk, musicbox(midi(m), vel=vel), pan=0.35 * np.sin(k * 1.3))

# groove
def groove(t0, t1, fill_end=False):
    b = t0
    while b < t1 - 1e-6:
        for off, kind in [(0, 'k'), (0.5, 'c'), (0.75, 'k'), (1.0, 'k2'), (1.5, 'c')]:
            tk = b + off
            if tk >= t1:
                continue
            if kind == 'k':
                place(dry, tk, kick(0.9))
            elif kind == 'k2':
                place(dry, tk, kick(0.6))
            else:
                place(music, tk, clap(0.9)); place(music, tk + 0.004, snapfx(0.6), pan=0.2)
        for h in range(8):
            th = b + h * 0.25
            if th < t1:
                place(music, th, hat(1.0 if h % 2 else 0.55), pan=-0.3)
        b += 2.0


groove(4.0, 8.5)
groove(9.0, 12.4)
groove(13.0, 17.0)

# bass line
bass_notes = [(4, 'Em'), (6, 'C'), (8, 'G'), (10, 'D'), (13, 'C'), (15, 'D')]
for a, c in bass_notes:
    root = CH[c][1]
    for off, d, oc in [(0, 0.45, 0), (0.75, 0.2, 0), (1.0, 0.45, 0), (1.5, 0.2, 12), (1.75, 0.2, 0)]:
        tk = a + off
        if 8.5 <= tk < 9.0 or tk >= 17:
            continue
        place(dry, tk, bass(midi(root + 12 + oc), d, 0.9))
place(dry, 9.0, bass(midi(43 + 12), 0.9, 1.1))
place(dry, 17.0, bass(midi(43), 2.8, 0.6) * np.clip((20 - (17 + tt(2.8))) / 1.5, 0, 1))
place(dry, 8.55, bass(midi(50), 0.45, 0.5))  # tension note before the snap

# ---------------- sound design ----------------
# crickets (0..3.6)
for k in range(26):
    tc = rng.uniform(0.0, 3.4)
    t = tt(0.18)
    chirp = np.sin(2 * np.pi * rng.uniform(4300, 5200) * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 34 * t))) * np.sin(np.pi * t / 0.18)
    place(sfx, tc, chirp * 0.022 * np.clip((3.6 - tc) / 0.8, 0, 1), pan=rng.uniform(-0.8, 0.8))
# firefly letters twinkle on arrival (S1 text: arrivals 1.2 + idx*0.085, skip spaces)
pent = [B4 + 12, D4 + 24, E4 + 24, Fs4 + 24, A4 + 12, B4 + 24]
for idx in range(16):
    if idx == 4:
        continue
    ta = 0.25 + idx * 0.085 + 0.95
    place(music, ta, bell(midi(pent[idx % len(pent)]), 1.2, 0.35), pan=-0.6 + idx / 16 * 1.2)
# stem stretch + snap 3.0
t = tt(0.25)
creak = bp(rng.standard_normal(len(t)), 300, 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * 38 * t)) * np.sin(np.pi * t / 0.25) * 0.05
place(sfx, 2.76, creak, pan=0.1)
t = tt(0.06); place(sfx, 3.0, hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 90) * 0.35, pan=0.05)
t = tt(0.5); place(sfx, 3.0, np.sin(2 * np.pi * (620 + 30 * np.sin(2 * np.pi * 9 * t)) * t) * np.exp(-t * 9) * 0.12, pan=0.1)
# fall whoosh 3.05 -> 3.97 (rising), short gap before the impact
wh = sweep_noise(0.92, 250, 3500, 0.45, lambda u: (u ** 1.6) * np.clip((1 - u) / 0.05, 0, 1))
place(sfx, 3.05, wh * 0.22, pan=0.0)
# impact 4.0: bloop + splash
t = tt(0.5); f = 55 + 260 * np.exp(-t * 14)
bloop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * np.minimum(1, t / 0.002)
place(dry, 4.0, np.tanh(bloop * 1.4) * 0.55)
t = tt(0.7); spl = lp(rng.standard_normal(len(t)), 2600) * np.exp(-t * 7) * np.minimum(1, t / 0.004)
place(sfx, 4.0, spl * 0.4, pan=-0.1)
place(dry, 4.0, kick(1.0, big=True) * 0.8)
for k in range(22):  # droplets patter
    td = 4.15 + rng.uniform(0, 0.75); t = tt(0.06); fd = rng.uniform(900, 2400)
    place(sfx, td, np.sin(2 * np.pi * (fd + 3000 * t) * t) * np.exp(-t * 70) * 0.06, pan=rng.uniform(-0.7, 0.7))
# jet "gloop"
t = tt(0.4); place(sfx, 4.35, np.sin(2 * np.pi * np.cumsum(180 + 500 * t) / SR) * np.sin(np.pi * t / 0.4) * 0.12)
# letters surfacing (S2): soft bubbles
for k in range(22):
    tl = 4.6 + (0.35 if k >= 14 else 0) + k * 0.035 + 0.25
    t = tt(0.09); fb = 300 + (k * 53) % 400
    place(sfx, tl, np.sin(2 * np.pi * np.cumsum(fb + 1800 * t) / SR) * np.exp(-t * 40) * 0.05, pan=-0.5 + (k % 14) / 14)
# 7.55-8.0 riser, 8.0 set click + thump
place(sfx, 7.45, sweep_noise(0.55, 400, 6000, 0.3, lambda u: u ** 2) * 0.1)
t = tt(0.05); place(sfx, 8.0, hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 120) * 0.3)
t = tt(0.3); place(dry, 8.0, np.sin(2 * np.pi * 80 * t) * np.exp(-t * 18) * 0.35)
# 8.5-9.0 tension: rising pitched noise, then the SNAP at 9.0
place(sfx, 8.5, sweep_noise(0.5, 600, 2500, 0.2, lambda u: u ** 3) * 0.06)
t = tt(0.25); crunch = hp(rng.standard_normal(len(t)), 1500) * np.exp(-t * 30)
for k in range(14):
    d = rng.uniform(0.0, 0.22); i = int(d * SR); w = int(0.004 * SR)
    crunch[i:i + w] += rng.standard_normal(w) * np.exp(-d * 10) * 2.0
place(sfx, 9.0, crunch * 0.32, pan=0.05)
place(dry, 9.0, kick(1.0, big=True) * 0.75)
for k in range(18):  # crumbs
    tcm = 9.15 + rng.uniform(0, 1.4); t = tt(0.03)
    place(sfx, tcm, hp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 150) * 0.08 * np.exp(-(tcm - 9.15)), pan=rng.uniform(-0.8, 0.8))
# whip 12.4-13 + reverse cymbal, boom at 13
place(sfx, 12.4, sweep_noise(0.6, 300, 8000, 0.5, lambda u: u ** 2.2) * 0.25)
t = tt(0.6); rc = hp(rng.standard_normal(len(t)), 5000) * np.exp(-(0.6 - t) * 6) * (t / 0.6) ** 2
place(music, 12.4, rc * 0.12)
place(dry, 13.0, kick(1.1, big=True))
t = tt(1.2); place(sfx, 13.0, lp(rng.standard_normal(len(t)), 600) * np.exp(-t * 4) * 0.2)
t = tt(1.4); place(music, 13.0, hp(rng.standard_normal(len(t)), 6000) * np.exp(-t * 3) * 0.06, pan=0.3)
# package spin swish
place(sfx, 13.05, sweep_noise(1.0, 3000, 500, 0.5, lambda u: np.sin(np.pi * u) ** 2) * 0.16, pan=-0.3)
# final: shimmer at 17.0, berry plink at 18.0 with little bounces
for k, m in enumerate([G4 + 12, B4 + 12, D4 + 24, G4 + 24]):
    place(music, 17.0 + k * 0.06, bell(midi(m), 3.0, 0.7), pan=-0.4 + k * 0.27)
place(music, 18.0, bell(midi(B4 + 24), 2.0, 1.6), pan=0.25)
for k, dt in enumerate([0.0, 0.31, 0.47]):
    t = tt(0.08); place(sfx, 18.0 + dt, np.sin(2 * np.pi * (1300 - k * 80) * t) * np.exp(-t * 60) * (0.32 / (k + 1)), pan=0.25)

# ---------------- mix ----------------
def reverb(x, secs=1.8, mix=0.3):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = np.stack([rng.standard_normal(n) * np.exp(-t * 3.2), rng.standard_normal(n) * np.exp(-t * 3.2)], 1)
    ir[:, 0] = lp(ir[:, 0], 6000); ir[:, 1] = lp(ir[:, 1], 6000)
    ir /= np.sqrt(np.sum(ir ** 2, 0))
    wet = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - mix) + wet * mix * 1.6


mix = reverb(music, 2.0, 0.32) + reverb(sfx, 1.2, 0.18) + dry
mix[:, 0] = hp(mix[:, 0], 28); mix[:, 1] = hp(mix[:, 1], 28)
gain_db = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
mix *= 10 ** (gain_db / 20)
# gentle bus glue + soft limiter
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fade = np.clip((DUR - np.arange(N) / SR) / 0.35, 0, 1)
fi = np.clip(np.arange(N) / SR / 0.02, 0, 1)
mix *= (fade * fi)[:, None]
peak = np.max(np.abs(mix))
if peak > 0.84:
    mix *= 0.84 / peak
wavfile.write(sys.argv[1], SR, (mix * 32767).astype(np.int16))
print('peak', round(float(np.max(np.abs(mix))), 3))
