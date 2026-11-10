import numpy as np, wave
SR=48000; DUR=32.5; N=int(SR*DUR)
L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(5)
def t_(d): return np.arange(int(d*SR))/SR
def add(sig,t0,gain=1.0,pan=0.0):
    i=int(t0*SR); 
    if i>=N: return
    s=sig[:N-i]*gain; gl=np.cos((pan+1)*np.pi/4); gr=np.sin((pan+1)*np.pi/4)
    L[i:i+len(s)]+=s*gl*1.414; R[i:i+len(s)]+=s*gr*1.414
def env(d,a=0.005,dec=0.3):
    t=t_(d); return np.minimum(1,t/a)*np.exp(-t/dec)
def onepole_lp(x,fc):
    # vectorized-ish via fft brickwall smooth
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); fc=np.asarray(fc)
    H=1/np.sqrt(1+(f/fc)**4); return np.fft.irfft(X*H,len(x))
def hp(x,fc):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); H=1/np.sqrt(1+(fc/np.maximum(f,1))**4); return np.fft.irfft(X*H,len(x))
def bp(x,fc,q=2): return hp(onepole_lp(x,fc*(1+1/q)),fc/(1+1/q))
def nf(n): return 440*2**((n-69)/12)
def saw(f,d,det=0.0):
    t=t_(d); out=0
    for k in (-1,0,1):
        ph=(t*f*(1+k*det))%1; out=out+(2*ph-1)
    return out/3
# ---------- instruments ----------
def kick(d=0.5,boom=False):
    t=t_(d); f=45+ (160 if not boom else 220)*np.exp(-t*(28 if not boom else 14)); ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*np.exp(-t/(0.28 if not boom else 0.9)); s+= 0.3*rng.standard_normal(len(t))*np.exp(-t/0.004)
    return np.tanh(s*1.6)
def clap():
    d=0.3; t=t_(d); n=rng.standard_normal(len(t)); e=np.zeros_like(t)
    for o in (0,0.011,0.022): e+= (t>=o)*np.exp(-np.maximum(t-o,0)/0.012)
    e+= (t>=0.03)*np.exp(-np.maximum(t-0.03,0)/0.09)
    return bp(n*e,1400,1.2)*1.4
def hat(op=False):
    d=0.25 if op else 0.06; t=t_(d); return hp(rng.standard_normal(len(t)),7000)*np.exp(-t/(0.07 if op else 0.015))
def pluck(f,d=0.45,bright=3500):
    t=t_(d); s=saw(f,d,0.004); s=onepole_lp(s*np.exp(-t/0.18),bright); return s*np.minimum(1,t/0.003)
def bass(f,d=0.24):
    t=t_(d); s=np.sin(2*np.pi*f*t)+0.35*np.sign(np.sin(2*np.pi*f*t))*0.3
    return onepole_lp(s,400)*np.minimum(1,t/0.004)*np.exp(-t/0.25)
def pad(notes,d,cut=2500,att=0.8,rel=1.2):
    t=t_(d); s=sum(saw(nf(n),d,0.006) for n in notes)/len(notes)
    e=np.minimum(1,t/att)*np.minimum(1,np.maximum(0,(d-t))/rel)
    return onepole_lp(s,cut)*e
def bell(f,d=2.5):
    t=t_(d); mod=np.sin(2*np.pi*f*3.5*t)*2.2*np.exp(-t/0.6)
    return np.sin(2*np.pi*f*t+mod)*np.exp(-t/0.9)*np.minimum(1,t/0.002)
def metal(d=0.9):
    t=t_(d); s=sum(np.sin(2*np.pi*f*t)*np.exp(-t/dc) for f,dc in [(310,0.5),(733,0.35),(1187,0.25),(1955,0.18),(2830,0.12)])
    s+=hp(rng.standard_normal(len(t)),2500)*np.exp(-t/0.03)*2
    return s/3
def whoosh(d,f0,f1,rev=False):
    t=t_(d); n=rng.standard_normal(len(t)); out=np.zeros_like(t); seg=2048
    # time-varying bandpass by chunks
    for i in range(0,len(t),seg):
        u=i/len(t); fc=f0*(f1/f0)**u; ch=n[i:i+seg]; 
        if len(ch)<64: continue
        out[i:i+seg]=bp(np.concatenate([ch]),fc,1.5)[:len(ch)]
    e=np.sin(np.pi*np.minimum(1,t/d))**2 if not rev else (t/d)**3
    return out*e
def click(f=3200):
    t=t_(0.03); return (np.sin(2*np.pi*f*t)*0.6+rng.standard_normal(len(t))*0.4)*np.exp(-t/0.004)
def blip(f,d=0.06):
    t=t_(d); return np.sign(np.sin(2*np.pi*f*t))*np.exp(-t/0.02)*0.5

# ---------- music ----------
def mallet(f,d=0.6):
    t=t_(d); return (np.sin(2*np.pi*f*t)*np.exp(-t/0.25)+0.35*np.sin(2*np.pi*f*4*t)*np.exp(-t/0.04)+0.15*np.sin(2*np.pi*f*10*t)*np.exp(-t/0.01))*np.minimum(1,t/0.002)
def bonk(f,d=0.25):
    t=t_(d); fr=f*(1+0.7*np.exp(-t*50)); return np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-t/0.08)
def sweep(d,f0,f1,shape=1.0):
    t=t_(d); u=t/d; f=f0*(f1/f0)**(u**shape); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.sin(np.pi*u)**0.6
def thud(d=0.5):
    t=t_(d); ph=2*np.pi*np.cumsum(50+140*np.exp(-t*35))/SR; return np.tanh(1.5*np.sin(ph)*np.exp(-t/0.18))
def puff(d=0.9):
    t=t_(d); return onepole_lp(rng.standard_normal(len(t)),1200)*np.exp(-t/0.25)*np.minimum(1,t/0.01)
def plop(f0=900,f1=180,d=0.3):
    t=t_(d); f=f1+(f0-f1)*np.exp(-t*25); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/0.09)
def silk(d):
    t=t_(d); u=t/d; return bp(rng.standard_normal(len(t)),2500,0.6)*np.sin(np.pi*u)**1.5*(0.6+0.4*np.sin(2*np.pi*3*t))
CH={'Em':[52,55,59,62,66],'C':[48,52,55,59,62],'G':[43,50,55,59,62],'D':[50,54,57,62,64],'Am':[45,52,55,60,64],'F':[41,48,52,57,60]}
ROOT={'Em':40,'C':36,'G':43,'D':38,'Am':45,'F':41}
def chords(seq,t0,bar=2.0,gain=0.13,cut=2200):
    for i,c in enumerate(seq): add(pad(CH[c],bar+0.1,cut=cut,att=0.08,rel=0.15),t0+i*bar,gain)
def bassline(seq,t0,bar=2.0,gain=0.4,pat=(0,12,0,12,0,12,7,12)):
    for i,c in enumerate(seq):
        for k,o in enumerate(pat): add(bass(nf(ROOT[c]+o)),t0+i*bar+k*0.25,gain)
def drums(t0,t1,kick_g=0.7,clap_on=True,hats=True):
    tb=t0
    while tb<t1-1e-6:
        add(kick(),tb,kick_g)
        if hats: add(hat(op=True),tb+0.25,0.1,pan=0.2); add(hat(),tb+0.125,0.04,pan=-0.3); add(hat(),tb+0.375,0.04,pan=-0.3)
        if clap_on and round((tb-t0)/0.5)%2==1: add(clap(),tb,0.28)
        tb+=0.5
def arp(seq,t0,bar=2.0,gain=0.07,oct=24,step=0.125,inst='pluck'):
    for i,c in enumerate(seq):
        ns=CH[c]
        for k in range(int(bar/step)):
            n=ns[(k*2)%len(ns)]+oct; tt=t0+i*bar+k*step
            add(pluck(nf(n),0.25,3200) if inst=='pluck' else mallet(nf(n),0.4),tt,gain,pan=0.5*np.sin(k*1.1))
def air(d,f0,f1):
    t=t_(d); u=t/d; out=np.zeros_like(t); seg=2048; n=rng.standard_normal(len(t))
    for i in range(0,len(t),seg):
        ch=n[i:i+seg]
        if len(ch)<64: continue
        fc=f0*(f1/f0)**(i/len(t)); out[i:i+seg]=bp(ch,fc,1.2)[:len(ch)]
    return out*np.sin(np.pi*u)**1.2
def riser(d): t=t_(d); u=t/d; return air(d,300,6000)*u**2*1.2 + np.sin(2*np.pi*np.cumsum(150+500*u**2)/SR)*u**3*0.15
# ---------- Ki start ----------
add(pad(CH['G'],2.5,cut=1600,att=0.2,rel=0.3),0.0,0.14)
for i,(dt,n) in enumerate([(0.0,67),(0.5,71),(1.0,74),(1.5,79)]): add(mallet(nf(n),0.6),dt,0.12,pan=-0.3+0.2*i)
add(sweep(0.2,300,900,1.5),0.35,0.1); add(bonk(392,0.2),0.95,0.4); add(kick(),0.95,0.4)
add(riser(0.95),1.55,0.45); add(kick(boom=True),2.5,0.7)
# ---------- NOVA 2.5-8 ----------
add(air(0.6,6000,800),2.5,0.25)
chords(['Em','C','Em'],2.5,cut=1900); bassline(['Em','C','Em'],2.5,gain=0.33)
drums(4.0,7.0,0.55,clap_on=True)
add(air(1.05,900,1400),3.05,0.18,pan=-0.3)
add(pluck(nf(64),0.4,3000),3.5,0.18); add(click(2600),4.1,0.15); add(mallet(nf(76),0.6),4.1,0.18)
for k,dt in enumerate([4.2,4.35,4.5]): add(pluck(nf([67,71,74][k]),0.35,3200),dt,0.16,pan=-0.4+0.4*k)
add(air(0.95,1000,1600),4.5,0.12,pan=0.4); add(mallet(nf(79),0.6),5.45,0.18,pan=0.4); add(click(2800),5.45,0.12)
for k in range(4): add(click(3200+200*k),6.2+k*0.09,0.08,pan=-0.5+0.33*k)
add(air(0.55,900,3000),6.85,0.15); add(riser(0.9),7.1,0.45); add(kick(boom=True),8.0,0.7)
# ---------- FLORIS 8-13.5 ----------
add(air(0.6,6000,800),8.0,0.25)
chords(['Am','F','Am'],8.0,cut=2300,gain=0.14); bassline(['Am','F','Am'],8.0,gain=0.33)
add(sweep(0.9,200,900,1.0),8.55,0.1); add(air(0.9,600,3000),8.55,0.18)
add(pluck(nf(69),0.4,3000),9.45,0.18); add(bonk(262,0.2),9.55,0.3); add(pluck(nf(72),0.4,3000),9.65,0.18)
drums(9.5,12.5,0.5)
add(air(0.6,1500,4000),10.25,0.12); add(bell(nf(88),1.4),10.55,0.07); add(bell(nf(91),1.4),10.7,0.07); add(pad([57,64,69,72,76],1.5,cut=3000,att=0.2,rel=0.8),10.75,0.1)
add(sweep(0.35,500,1100,0.8),11.9,0.08); add(bonk(330,0.18),12.25,0.25)
add(riser(0.9),12.6,0.45); add(kick(boom=True),13.5,0.7)
# ---------- ADORA 13.5-19 ----------
add(air(0.6,6000,800),13.5,0.25)
chords(['C','G','C'],13.5,cut=2600,gain=0.14); add(bass(nf(36),2.0),13.5,0.3); add(bass(nf(43),2.0),15.5,0.3); add(bass(nf(36),1.5),17.5,0.3)
add(air(0.7,2000,8000),14.1,0.12); add(click(1800),15.25,0.3); add(mallet(nf(72),0.8),15.25,0.2)
for k in range(6): add(click(3600+300*k),15.35+k*0.1,0.07,pan=0.3)
add(bell(nf(91),1.2),15.65,0.06)
for k in range(12): add(mallet(nf([60,64,67,72,76,79][k%6]+12),0.5),16.0+k*0.125,0.06,pan=0.5*np.sin(k))
drums(16.0,18.0,0.4,clap_on=False)
add(air(0.5,2000,6000),17.45,0.1); add(bell(nf(96),1.0),17.6,0.05)
add(riser(0.9),18.1,0.45); add(kick(boom=True),19.0,0.6)
# ---------- ASANI 19-24.5 ----------
add(air(0.6,6000,800),19.0,0.22)
add(pad(CH['Em'],5.5,cut=1300,att=0.5,rel=0.8),19.0,0.16); add(bass(nf(28),5.4),19.0,0.24)
add(air(1.25,4000,500),19.55,0.22)
for k in range(10): add(pluck(nf([64,67,71,74,76,79,76,74,71,67][k]),0.4,2600),19.6+k*0.125,0.07,pan=0.6-0.12*k)
add(air(0.6,400,1500),21.45,0.25); add(air(0.6,1500,400),22.05,0.25)
add(sweep(0.45,500,1000,0.8),23.3,0.08); add(bonk(392,0.2),23.75,0.25)
add(riser(0.9),23.6,0.45); add(kick(boom=True),24.5,0.6)
# ---------- AURA 24.5-30 ----------
add(air(0.6,6000,800),24.5,0.22)
for k in range(14): add(blip(np.random.default_rng(k).choice([660,880,990,1320]),0.04),25.0+k*0.08,0.05,pan=-0.6+0.05*k)
add(sweep(0.12,2000,900,1.0),25.75,0.06); add(bonk(294,0.2),26.3,0.35); add(pluck(nf(76),0.3,3000),26.45,0.15); add(thud(0.3),26.62,0.35); add(bonk(220,0.2),26.62,0.2)
for k in range(12): add(blip(np.random.default_rng(40+k).choice([660,880,990,1320]),0.04),26.65+k*0.075,0.05,pan=0.6-0.05*k)
chords(['G','D'],26.5,cut=2400,gain=0.12); bassline(['G','D'],26.5,gain=0.33,pat=(0,0,12,0,7,0,12,7)); drums(26.5,29.0,0.5)
for k in range(8): add(mallet(nf([67,71,74,71,72,76,79,76][k]+12),0.3),27.5+k*0.15,0.07,pan=0.4*np.sin(k))
for dt in (25.75,27.8,28.25,28.75): add(sweep(0.12,2000,900,1.0),dt,0.05)
add(riser(0.9),29.1,0.45); add(kick(boom=True),30.0,0.6)
# ---------- Ki end ----------
add(air(0.8,6000,600),30.0,0.25); add(pad(CH['G'],2.5,cut=1600,att=0.05,rel=1.4),30.0,0.16)
for i,(dt,n) in enumerate([(30.5,79),(31.0,74),(31.5,71)]): add(mallet(nf(n),0.7),dt,0.1,pan=0.3-0.2*i)
add(sweep(0.2,300,900,1.5),31.25,0.1); add(bonk(392,0.2),31.85,0.35)
# ---------- reverb + master ----------
def reverb(x,dec=1.6,mix=0.22,seed=1):
    ir_t=t_(dec*1.5); ir=np.random.default_rng(seed).standard_normal(len(ir_t))*np.exp(-ir_t/(dec/6.9)*1.0)
    ir=onepole_lp(ir,6000); ir/=np.sqrt((ir**2).sum())
    n=len(x)+len(ir); F=1<<int(np.ceil(np.log2(n)))
    y=np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(ir,F),F)[:len(x)]
    return x+y*mix*3
L2=reverb(L,seed=1); R2=reverb(R,seed=2)
mix=np.stack([L2,R2],1)
mix=hp(mix[:,0],28),hp(mix[:,1],28); mix=np.stack(mix,1)
peak=np.abs(mix).max(); mix=mix/peak*1.2; mix=np.tanh(mix)*0.89  # soft limit
# fade very end to avoid click
fl=int(0.25*SR); mix[-fl:]*=np.linspace(1,0,fl)[:,None]**2
mix[:int(0.003*SR)]*=np.linspace(0,1,int(0.003*SR))[:,None]
pcm=(mix*32767).astype(np.int16)
with wave.open('music.wav','wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('peak',np.abs(mix).max(),'rms',np.sqrt((mix**2).mean()))
