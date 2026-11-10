import numpy as np, wave
SR=48000; DUR=38.0; N=int(SR*DUR)
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
# ---------------- INTRO 0-3.25 ----------------
add(sweep(0.5,1600,500,0.8),0.0,0.1)
add(thud(),0.5,0.8); add(bonk(196),0.5,0.4); add(mallet(nf(67)),0.5,0.3)
add(pad(CH['G'],2.9,cut=1500,att=0.3,rel=0.5),0.5,0.16)
add(whoosh(0.3,800,3000),0.8,0.18); add(click(2600),0.85,0.15); add(click(2900),1.05,0.15)
add(whoosh(0.6,4000,10000),1.5,0.08)
for i,(dt,n) in enumerate([(1.0,71),(1.5,74),(2.0,79),(2.5,78)]): add(mallet(nf(n),0.6),dt,0.12,pan=-0.3+0.2*i)
for k in range(5): add(hat(),1.0+k*0.5,0.05)
add(sweep(0.2,300,900,1.5),2.55,0.16); add(sweep(0.25,500,1800,0.5),2.75,0.2)
add(whoosh(0.25,800,4000,rev=True),3.0,0.3)
# ---------------- NOVA 3.25-9 ----------------
add(kick(boom=True),3.25,0.9); add(puff(1.2),3.25,0.7); add(whoosh(0.9,3000,300),3.27,0.25)
chords(['Em','C','Em'],3.5,cut=1800); bassline(['Em','C','Em'],3.5,gain=0.35); drums(3.5,8.75,0.6,clap_on=False)
for k,dt in enumerate([4.0,4.25,4.5,4.75]): add(thud(0.3)*0.6,dt+0.35,0.35,pan=-0.5+0.33*k); add(puff(0.6),dt+0.3,0.25,pan=-0.5+0.33*k)
add(blip(1568,0.07),5.25,0.12); add(blip(1760,0.07),5.5,0.12)
add(whoosh(0.9,5000,12000),5.9,0.08)
arp(['Em','C'],5.5,gain=0.05,inst='mallet',step=0.25)
add(whoosh(0.9,5000,12000),7.7,0.07)
# T1 whip
add(whoosh(0.45,600,6000),8.75,0.45,pan=-0.6)
# ---------------- ADORA 9-14.5 ----------------
chords(['Am','F','Am'],9.0,cut=2600,gain=0.15)
add(bass(nf(33),2.0),9.0,0.3); add(bass(nf(29),2.0),11.0,0.3); add(bass(nf(33),1.6),13.0,0.3)
for k in range(10): add(mallet(nf([57,60,64,67,69,72,76,79,81,84][k]),0.7),9.3+k*0.13,0.09,pan=-0.6+0.12*k)
for k,dt in enumerate([10.55,10.67,10.79,10.91,11.13]): add(bell(nf([84,88,91,95,96][k]),1.5),dt,0.07,pan=-0.4+0.2*k)
for k in range(7): add(click(4000+250*k),10.7+k*0.08,0.06,pan=0.3)
add(whoosh(1.0,4000,11000),11.8,0.08)
arp(['F','Am'],11.0,gain=0.04,inst='mallet',step=0.25,oct=24)
for k in range(10): add(hat(),12.0+k*0.25,0.03)
for k in range(5): add(bell(nf([88,91,95,96,100][k]),1.2),12.6+[0,2,1,3,4][k]*0.14,0.06,pan=-0.4+0.2*k)
# T2 zoom-through
add(sweep(0.5,200,2400,1.5),14.0,0.2); add(whoosh(0.5,500,8000,rev=True),14.0,0.4)
# ---------------- FLORIS 14.5-20 ----------------
add(kick(boom=True),14.5,0.8); add(clap(),14.5,0.3)
chords(['Em','C','G'],14.5,cut=2000,gain=0.14); bassline(['Em','C','G'],14.5,gain=0.38); drums(15.0,19.5,0.6)
add(silk(0.95),14.85,0.4); add(whoosh(0.4,600,3000),15.05,0.25,pan=-0.5); add(whoosh(0.4,600,3000),15.5,0.25,pan=0.5)
add(sweep(0.4,1400,500,1.0),15.75,0.1); add(thud(0.4),16.15,0.6); add(bonk(262,0.2),16.15,0.3)
add(silk(1.1),16.6,0.25)
arp(['C','G'],16.5,gain=0.05)
add(sweep(0.2,500,1100,0.8),18.0,0.08); add(bonk(294,0.2),18.4,0.3); add(silk(1.0),18.6,0.2)
# T3 split
add(sweep(0.15,3000,9000,0.5),19.6,0.15); add(whoosh(0.5,400,5000),19.75,0.4)
# ---------------- ASANI 20-25.5 ----------------
add(pad(CH['Em'],5.0,cut=1200,att=0.4,rel=0.6),20.0,0.16); add(bass(nf(28),4.9),20.0,0.25)
r2=np.random.default_rng(3)
for k in range(40):
    tk=20.35+k*0.037+r2.random()*0.02; add(plop(r2.uniform(500,1200),r2.uniform(150,300),0.08),tk,0.05*(1-k/45),pan=r2.uniform(-.7,.7))
add(sweep(0.35,2200,700,1.2),21.9,0.12); add(plop(1100,160,0.4),22.25,0.6); add(thud(0.5),22.25,0.4)
for k,dt in enumerate([22.43,22.61]): add(plop(800,200,0.25),dt,0.15/(k+1))
drums(22.5,24.75,0.45,clap_on=False)
for k in range(8): add(pluck(nf([64,67,71,74,76,74,71,67][k]+12),0.35,2500),22.5+k*0.25,0.06,pan=0.4*np.sin(k))
add(sweep(0.25,600,1400,0.6),23.75,0.08); add(plop(1000,180,0.35),24.25,0.45)
add(kick(boom=True),25.0,0.6); add(sweep(0.5,400,60,0.8),25.0,0.3)
# ---------------- AURA 25.5-31 ----------------
add(blip(1320,0.06),25.6,0.15,pan=-0.4); add(blip(1320,0.06),25.7,0.15,pan=0.4); add(sweep(0.12,2000,900,1.0),26.0,0.06)
add(whoosh(0.5,300,2500),26.05,0.3); add(kick(boom=True),26.1,0.5)
for k,dt in enumerate([26.63,26.78,26.93,27.08]): add(bonk(330*2**(k/4),0.2),dt,0.35,pan=-0.5+0.33*k)
for k in range(5): add(mallet(nf(72+k*2),0.3),27.0+k*0.07,0.15)
chords(['G','D'],26.5,cut=2400,gain=0.12); bassline(['G','D'],26.5,gain=0.35,pat=(0,0,12,0,7,0,12,7)); drums(26.5,30.5,0.55)
for k in range(16): add(mallet(nf([67,71,74,71,72,76,79,76][k%8]+12),0.3),26.5+k*0.25,0.07,pan=0.4*np.sin(k))
add(sweep(0.12,2000,900,1.0),28.1,0.06); add(clap(),28.7,0.5); add(click(1500),28.7,0.4); add(thud(0.3),28.7,0.4)
add(sweep(0.12,2000,900,1.0),29.8,0.06)
# T5 jaws
add(whoosh(0.25,500,3000,rev=True),30.75,0.3); add(clap(),31.0,0.5); add(thud(0.4),31.0,0.7); add(click(1200),31.0,0.4)
# ---------------- REEL 31-33.75 ----------------
chords(['Em','C'],31.0,bar=1.375,cut=2600,gain=0.13); bassline(['Em','C'],31.0,bar=1.375,gain=0.36,pat=(0,12,0,12,0))
drums(31.0,33.0,0.65)
for k in range(5): add(whoosh(0.25,800,3000),31.0+k*0.07,0.12,pan=-0.6+0.3*k)
add(whoosh(0.4,500,4000,rev=True),32.95,0.3); add(sweep(0.45,300,1500,1.4),33.3,0.15)
# ---------------- OUTRO 33.75-38 ----------------
add(kick(boom=True),33.75,0.8)
for k,dt in enumerate([33.8,33.95,34.1]): add(thud(0.3),dt,0.35)
add(sweep(0.3,1400,500,0.8),34.2,0.08); add(bonk(392,0.2),34.5,0.4); add(bonk(494,0.15),34.8,0.2)
add(pad([43,55,59,62,66,69],4.2,cut=3000,att=0.01,rel=3.0),34.5,0.24); add(bass(nf(31),3.4),34.5,0.35)
for i,n in enumerate([79,83,86,90]): add(mallet(nf(n),1.2),34.5+i*0.04,0.12,pan=-0.3+0.2*i)
for k in range(15): add(click(3000+200*(k%5)),34.35+k*0.035,0.06,pan=0.3)
add(whoosh(0.7,4000,10000),35.0,0.08)
add(pluck(nf(86),0.6,4500),35.35,0.2); add(click(2000),35.35,0.3)
for dt in (35.75,36.25,36.75,37.25): add(click(3500),dt,0.12); add(hat(),dt,0.04)
for i,(dt,n) in enumerate([(35.5,79),(36.0,83),(36.5,86),(37.0,91)]): add(mallet(nf(n),0.9),dt,0.08,pan=0.3*np.sin(i))
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
