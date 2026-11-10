import numpy as np, wave
SR=48000; DUR=11.0; N=int(SR*DUR)
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
_add=add
def add(sig,t0,gain=1.0,pan=0.0):
    _add(sig, t0+1.0 if t0>=2.4 else t0, gain, pan)
# Vi Ki hold: dots hop together, soft pulse keeps the beat
_add(bonk(784,0.12),2.6,0.18,pan=-0.2); _add(bonk(784,0.12),2.9,0.22,pan=0.2)
_add(bonk(988,0.12),3.1,0.15,pan=-0.2); _add(bonk(988,0.12),3.38,0.18,pan=0.2)
for tb in (2.5,3.0): _add(hat(op=True),tb+0.25,0.1,pan=0.2); _add(kick()*0.5,tb,0.35)
_add(pad([55,59,62,67],1.25,cut=1500,att=0.1,rel=0.3),2.25,0.12)
# S1: name pops in
add(pad([55,59,62,67],1.9,cut=1300,att=0.4,rel=0.4),0.0,0.18)
for i in range(16):
    if i==9: continue
    add(click(2600+250*(i%4)),0.1+i*0.045+0.06,0.1,pan=-0.6+1.2*i/15)
for i,(dt,n) in enumerate([(0.1,67),(0.4,71),(0.7,74),(1.0,79)]): add(mallet(nf(n),0.6),dt,0.14,pan=-0.3+0.2*i)
# S2: others fall, Vi + Ki gather, dots merge
add(sweep(0.6,1400,250,0.7),1.5,0.12,pan=0.2)
for k in range(5): add(thud(0.25)*0.6,1.75+k*0.07,0.12,pan=-0.5+0.25*k)
add(whoosh(0.45,600,2500),1.8,0.25); add(bonk(392,0.2),2.25,0.35); add(mallet(nf(79),0.6),2.25,0.2); add(bonk(494,0.2),2.3,0.3,pan=0.3)
add(whoosh(0.6,400,3000),2.45,0.32)
add(blip(988,0.06),2.5,0.12,pan=-0.3); add(blip(1175,0.06),2.56,0.12,pan=0.3)
add(bonk(587,0.25),2.95,0.35); add(mallet(nf(86),0.8),2.95,0.18)
for tb in (2.0,2.5): add(hat(op=True),tb+0.25,0.1,pan=0.2)
# S3: morph to geometry + captions
add(whoosh(0.5,2000,9000),3.05,0.14); add(sweep(0.5,400,1200,1.0),3.05,0.08)
add(pad([52,55,59,64],1.1,cut=1800,att=0.05,rel=0.2),3.0,0.15)
for k in range(4): add(bass(nf(40+(12 if k%2 else 0))),3.0+k*0.25,0.4)
add(kick(),3.0,0.7); add(hat(op=True),3.25,0.12)
# S4: merges
add(whoosh(0.38,500,3500,rev=True),3.62,0.4,pan=-0.5)
add(thud(0.6),4.0,0.95,pan=-0.2); add(kick(),4.0,0.6); add(mallet(nf(64),0.8),4.0,0.25); add(bass(nf(36),0.45),4.0,0.45)
add(whoosh(0.38,500,3500,rev=True),4.12,0.4,pan=0.5)
add(thud(0.6),4.5,0.9,pan=0.2); add(kick(),4.5,0.6); add(mallet(nf(67),0.8),4.5,0.25); add(bass(nf(43),0.45),4.5,0.45)
add(sweep(0.5,300,1500,1.6),4.5,0.14)
# stamp
add(kick(boom=True),5.0,0.9); add(clap(),5.0,0.55); add(bp(rng.standard_normal(int(0.12*SR)),1600,0.8)*np.exp(-t_(0.12)/0.02),5.0,0.6)
add(pad([43,55,59,62,66,69],1.0,cut=3200,att=0.005,rel=0.5),5.0,0.25)
for i,n in enumerate([79,83,86]): add(mallet(nf(n),0.8),5.0+i*0.04,0.12,pan=-0.2+0.2*i)
# hop
add(sweep(0.25,300,900,1.5),5.25,0.18); add(sweep(0.25,500,1800,0.5),5.5,0.22); add(bonk(330,0.2),5.5,0.3)
add(sweep(0.4,1800,400,1.6),5.6,0.12); add(whoosh(0.2,800,4000,rev=True),5.8,0.25)
add(thud(0.8),6.0,1.0); add(kick(boom=True),6.0,0.6); add(clap(),6.0,0.45)
add(pad([43,55,59,62,66,69],4.0,cut=3000,att=0.005,rel=3.0),6.0,0.24); add(bass(nf(31),2.4),6.0,0.38)
for i,n in enumerate([79,83,86,90]): add(mallet(nf(n),1.2),6.0+i*0.04,0.13,pan=-0.3+0.2*i)
for k in range(10): add(click(5000+300*(k%4)),6.02+k*0.02,0.05,pan=np.sin(k)*0.7)
# lockup
add(whoosh(0.6,400,2500),6.5,0.3,pan=-0.4); add(bonk(392,0.15),6.95,0.22,pan=-0.3)
for j,dt in enumerate([0,0.06,0.1,0.16]): add(bonk(523+60*j,0.12),6.85+dt+0.12,0.14,pan=0.3)
for i in range(11): add(click(3000+200*(i%5)),6.85+0.42+i*0.04+0.08,0.07,pan=0.3)
for i,dt in enumerate([0.2,0.7,0.8,0.3]): add(bonk([880,988,1109,1319][i],0.15),6.85+dt+0.23,0.2,pan=0.4)
add(whoosh(0.7,4000,10000),7.6,0.08,pan=0.2)
for i,(dt,n) in enumerate([(7.5,79),(7.75,83),(8.0,86),(8.25,91)]): add(mallet(nf(n),0.9),dt,0.1*(1-0.15*i),pan=0.3*np.sin(i))
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
