"""Pre-renders arena SFX with numpy/scipy, encodes to ogg via ffmpeg.
  python3 assets/src/render_audio.py public/audio
Drop-in CC0 recordings with the same file names override these."""
import numpy as np, sys, os, subprocess
from scipy import signal
from scipy.io import wavfile

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/audio'
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def t(dur): return np.arange(int(SR * dur)) / SR
def env(n, a, d, sustain=0.0, r=0.0):
    e = np.ones(n)
    ia, id_, ir = int(a * SR), int(d * SR), int(r * SR)
    if ia: e[:ia] = np.linspace(0, 1, ia)
    if id_: e[ia:ia + id_] = np.linspace(1, sustain, min(id_, max(0, n - ia)))
    if ia + id_ < n: e[ia + id_:] = sustain
    if ir and ir < n: e[-ir:] *= np.linspace(1, 0, ir)
    return e
def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band'); return signal.lfilter(b, a, x)
def lp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2)); return signal.lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), btype='high'); return signal.lfilter(b, a, x)
def reverb(x, dur=1.4, wet=0.35, pre=0.02):
    n = int(SR * dur)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * dur * 0.28))
    ir = lp(ir, 5000)
    ir[:int(pre * SR)] = 0
    ir /= np.max(np.abs(ir)) + 1e-9
    y = signal.fftconvolve(x, ir)[: len(x) + n]
    dry = np.pad(x, (0, len(y) - len(x)))
    return dry * (1 - wet) + y * wet
def addat(mix, s, w):
    d = min(len(w), len(mix) - s)
    if d > 0: mix[s:s + d] += w[:d]
def norm(x, db=-3.0):
    x = x / (np.max(np.abs(x)) + 1e-9); return x * (10 ** (db / 20))
def write(name, x, loop=False):
    x = np.clip(x, -1, 1).astype(np.float32)
    if loop:
        # crossfade tail into head for seamless looping
        xf = int(SR * 0.25)
        ramp = np.linspace(0, 1, xf)
        x[:xf] = x[:xf] * ramp + x[-xf:] * (1 - ramp)
        x = x[:-xf]
    wav = os.path.join(OUT, name + '.wav')
    wavfile.write(wav, SR, x)
    ogg = os.path.join(OUT, name + '.ogg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '3', ogg], check=True)
    os.remove(wav)
    print('WROTE', ogg, f'{len(x)/SR:.2f}s')

def voice(dur, energy):
    """One crowd voice: filtered noise with vowel-ish formants and a slow amplitude flutter."""
    n = int(SR * dur); x = rng.standard_normal(n)
    f0 = rng.uniform(120, 260) * (1.3 if energy > 0.6 else 1.0)
    y = np.zeros(n)
    for k, g in ((1, 1.0), (2, 0.6), (3, 0.35)):
        y += bp(x, f0 * k * 0.8, f0 * k * 1.3 + 80, 2) * g
    y += bp(x, 700, 1500, 2) * 0.5 * energy
    flutter = 0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(0.2, 1.4) * t(dur) + rng.uniform(0, 6.28))
    gate = (rng.random(n) < 0.0008 * (1 + energy * 4)).astype(float)
    gate = np.maximum(gate, 0)
    gate_env = signal.lfilter([1], [1, -0.9995], gate)
    gate_env = np.clip(gate_env, 0, 1)
    return y * flutter * (0.2 + 0.8 * gate_env)

def crowd(dur, voices, energy, whistles=0):
    n = int(SR * dur); mix = np.zeros(n)
    for _ in range(voices): mix += voice(dur, energy) * rng.uniform(0.5, 1.0)
    rumble = lp(rng.standard_normal(n), 140) * 2.0 * (0.4 + energy)
    mix = mix / voices * 8 + rumble
    for _ in range(whistles):
        s = int(rng.uniform(0, dur - 0.6) * SR); d = int(SR * rng.uniform(0.25, 0.6))
        tt = np.arange(d) / SR; f = rng.uniform(1800, 2600)
        w = np.sin(2 * np.pi * (f + 300 * np.sin(2 * np.pi * 6 * tt)) * tt) * env(d, 0.03, 0.1, 0.8, 0.1) * 0.25
        addat(mix, s, w)
    if energy > 0.6:
        # claps
        for _ in range(int(dur * 40)):
            s = int(rng.uniform(0, dur - 0.05) * SR); d = int(SR * 0.03)
            addat(mix, s, hp(rng.standard_normal(d), 1500) * np.exp(-np.arange(d) / (SR * 0.006)) * 0.8)
    return norm(reverb(mix, 1.6, 0.4), -6)

write('crowd_calm', crowd(8.0, 70, 0.3, 2)[: int(SR * 8.0)], loop=True)
write('crowd_roar', crowd(6.0, 220, 0.95, 10)[: int(SR * 6.0)], loop=True)

# horn
n = int(SR * 2.2); tt = t(2.2); h = np.zeros(n)
for f in (196.0, 196.5, 293.7, 392.0, 587.3):
    for k in range(1, 9): h += np.sin(2 * np.pi * f * k * tt + rng.uniform(0, 6)) / k
h = lp(h, 2800) * env(n, 0.06, 0.2, 0.85, 0.5)
write('horn', norm(reverb(h, 1.8, 0.3), -2))

# whistle (pea whistle)
n = int(SR * 0.6); tt = t(0.6)
w = (np.sin(2 * np.pi * 2450 * tt) + 0.6 * np.sin(2 * np.pi * 2950 * tt)) * (0.55 + 0.45 * np.sin(2 * np.pi * 34 * tt))
w *= env(n, 0.01, 0.05, 0.9, 0.12)
write('whistle', norm(reverb(w, 0.8, 0.25), -4))

# skate carves (3 variants)
for i in range(3):
    n = int(SR * 0.45); tt = t(0.45); x = rng.standard_normal(n)
    sweep = 2200 - 1500 * (tt / 0.45)
    y = np.zeros(n)
    for seg in range(6):
        a, b = seg * n // 6, (seg + 1) * n // 6
        fc = sweep[a]; y[a:b] = bp(x, max(200, fc * 0.6), fc * 1.4 + 200, 2)[a:b]
    y *= env(n, 0.02, 0.1, 0.5, 0.25) * (1 + 0.3 * np.sin(2 * np.pi * rng.uniform(20, 40) * tt))
    write(f'skate{i}', norm(y, -8))

# boards slam
n = int(SR * 0.5); tt = t(0.5)
b = np.sin(2 * np.pi * 80 * tt) * np.exp(-tt * 14) + lp(rng.standard_normal(n), 900) * np.exp(-tt * 25) * 1.5 + np.sin(2 * np.pi * 240 * tt) * np.exp(-tt * 9) * 0.5
write('boards', norm(reverb(b, 0.9, 0.3), -3))

# hit thud + big hit
for name, big in (('hit', 0), ('bighit', 1)):
    n = int(SR * (0.45 if big else 0.3)); tt = t(0.45 if big else 0.3)
    f = 110 - 60 * np.clip(tt * 6, 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-tt * (7 if big else 12)) * (1.4 if big else 1.0)
    y += lp(rng.standard_normal(n), 500 if big else 900) * np.exp(-tt * (18 if big else 30)) * 1.2
    if big: y += hp(rng.standard_normal(n), 3000) * np.exp(-tt * 40) * 0.5
    write(name, norm(reverb(y, 1.0 if big else 0.5, 0.35 if big else 0.2), -2))

# glove pop / pass
n = int(SR * 0.12); tt = t(0.12)
g = bp(rng.standard_normal(n), 900, 2600) * np.exp(-tt * 60)
write('pass', norm(g, -8))

# slapshot: stick crack + puck whoosh
n = int(SR * 0.35); tt = t(0.35)
s = hp(rng.standard_normal(n), 1200) * np.exp(-tt * 45) * 1.2 + bp(rng.standard_normal(n), 300, 900) * np.exp(-tt * 12) * 0.6
write('shot', norm(reverb(s, 0.7, 0.25), -4))

# crowd chant: stomp-stomp-clap at 120 bpm, 4 bars, with a roomy crowd 'hey' on the clap
bpm = 120; beat = 60 / bpm; bars = 4; n = int(SR * beat * 4 * bars); ch = np.zeros(n)
for bar in range(bars):
    for b in range(4):
        s0 = int((bar * 4 + b) * beat * SR)
        if b in (0, 1):
            d = int(SR * 0.25); tt = np.arange(d) / SR
            addat(ch, s0, np.sin(2 * np.pi * (70 - 30 * tt / 0.25) * tt) * np.exp(-tt * 18) * 1.6 + lp(rng.standard_normal(d), 300) * np.exp(-tt * 30) * 0.8)
        elif b == 2:
            d = int(SR * 0.18); tt = np.arange(d) / SR
            clap = np.zeros(d)
            for k in range(12):
                o = int(rng.uniform(0, 0.02) * SR); dd = int(SR * 0.06)
                addat(clap, o, hp(rng.standard_normal(dd), 1400) * np.exp(-np.arange(dd) / (SR * 0.012)))
            addat(ch, s0, clap * 0.9)
            hey = bp(rng.standard_normal(int(SR * 0.3)), 500, 1400) * env(int(SR * 0.3), 0.02, 0.1, 0.5, 0.15) * 0.6
            addat(ch, s0, hey)
write('chant', norm(reverb(ch, 1.3, 0.35)[:n], -7), loop=True)

# arena organ loop (menu): "charge" riff, 6 s at 120 bpm
notes = [392, 523, 659, 784, 659, 784, 0, 0, 392, 523, 659, 784, 659, 784, 0, 0, 349, 440, 523, 698, 523, 698, 0, 0, 392, 494, 587, 784, 587, 784, 0, 0]
beat = 0.1875; n = int(SR * len(notes) * beat); org = np.zeros(n); tt = t(len(notes) * beat)
for i, f in enumerate(notes):
    if f == 0: continue
    a, b_ = int(i * beat * SR), int((i + 1) * beat * SR)
    seg = tt[a:b_] - tt[a]
    tone = np.zeros(b_ - a)
    for k, gk in ((1, 1.0), (2, 0.5), (3, 0.3), (4, 0.2), (6, 0.1)): tone += np.sin(2 * np.pi * f * k * seg) * gk
    tone += np.sin(2 * np.pi * f / 2 * seg) * 0.4
    org[a:b_] += tone * env(b_ - a, 0.01, 0.02, 0.9, 0.04)
write('organ', norm(reverb(org, 1.4, 0.3)[:n], -6), loop=True)
