import numpy as np, wave
SR=48000; DUR=10.0; N=int(SR*DUR)
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
def thunk(f0=95, body=170, d=0.7):
    t=t_(d); ph=2*np.pi*np.cumsum(f0+120*np.exp(-t*30))/SR
    s=np.sin(ph)*np.exp(-t/0.25)*1.0
    s+=np.sin(2*np.pi*body*t)*np.exp(-t/0.06)*0.6 + np.sin(2*np.pi*body*2.7*t)*np.exp(-t/0.03)*0.3
    s+=bp(rng.standard_normal(len(t)),1200,1.0)*np.exp(-t/0.012)*0.8
    return np.tanh(s*1.4)
def bonk(f, d=0.25):
    t=t_(d); fr=f*(1+0.6*np.exp(-t*60)); s=np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-t/0.07)
    s+= np.sin(2*np.pi*np.cumsum(fr*2.01)/SR)*np.exp(-t/0.03)*0.3
    return s
# ---- intro 0-2: drone + air + pulse
t=t_(2.3); drone=(np.sin(2*np.pi*55*t)+0.5*np.sin(2*np.pi*82.4*t))*np.minimum(1,t/1.2)*np.minimum(1,(2.3-t)/0.3)
add(drone,0,0.35)
add(pad([52,59,64,67,71],2.2,cut=900,att=1.5,rel=0.25),0,0.25)
for i in range(8): add(hat(),i*0.25,0.05+0.02*(i%2),pan=0.3*(-1)**i)
add(whoosh(1.2,300,1500),0.5,0.2,pan=-0.4)
# piece landings: pre-whoosh + thunk on beats
for tl,pn,bd in ((2.0,-0.4,150),(2.5,0.1,175),(3.0,0.45,200)):
    add(whoosh(0.42,800,3500,rev=True),tl-0.42,0.35,pan=pn)
    add(thunk(body=bd),tl,0.95,pan=pn*0.5)
# groove from 2.0 to 5.0 (Em7 -> Cmaj7)
for st,d,ns,root in ((2.0,2.0,[52,55,59,62],40),(4.0,1.0,[48,52,55,59],36)):
    add(pad(ns,d+0.1,cut=2200,att=0.05,rel=0.12),st,0.18)
    for k in range(int(d/0.25)):
        add(bass(nf(root+(12 if k%2 else 0))),st+k*0.25,0.5)
    for k in range(int(d/0.125)):
        if k%4==3: continue
        add(pluck(nf(ns[(k*3)%4]+24),0.25,3000),st+k*0.125,0.07,pan=0.5*np.sin(k*1.3))
for b in range(6):
    tb=2.0+b*0.5
    if b>0: add(kick(),tb,0.8)
    add(hat(op=True),tb+0.25,0.13,pan=0.2)
    if b%2==1: add(clap(),tb,0.35)
# ball: falling whistle + bonks
t=t_(0.45); add(np.sin(2*np.pi*np.cumsum(1800-1200*(t/0.45))/SR)*(t/0.45)*0.5,3.45,0.25,pan=0.5)
for th,f,g in ((3.9,330,0.8),(4.25,392,0.55),(4.47,440,0.38),(4.6,494,0.22)): add(bonk(f),th,g,pan=0.45)
add(click(2000),4.75,0.12,pan=0.4)  # settles
# flatten 5.0-7.45: riser + Dsus pad closing, vacuum
add(pad([50,55,57,62,64],2.5,cut=1600,att=0.4,rel=0.1),5.0,0.22)
t=t_(2.45); add(np.sin(2*np.pi*np.cumsum(120*2**(t*2.2))/SR)*(t/2.45)**1.5*0.22,5.0,1.0)
add(whoosh(2.4,200,9000,rev=True),5.0,0.45)
for k in range(10): add(kick()*0.5,5.0+k*0.25 if k<8 else 7.0+(k-8)*0.125,0.35+0.04*k)
# silence gap 7.40-7.5, then STAMP
add(kick(boom=True),7.5,1.0); add(clap(),7.5,0.6)
add(bp(rng.standard_normal(int(0.12*SR)),1600,0.8)*np.exp(-t_(0.12)/0.02),7.5,0.7)  # paper slap
add(pad([43,55,59,62,66,69],2.5,cut=3500,att=0.005,rel=2.0),7.5,0.3)
add(bass(nf(31),2.4),7.5,0.45)
for i,n in enumerate([79,83,86,91]): add(bell(nf(n),2.0),7.5+i*0.05,0.08,pan=-0.3+0.2*i)
# dot hop + land
add(blip(1320,0.05),7.56,0.12); add(bonk(660,0.2),8.05,0.35,pan=0.35)
# outro motif
for i,(dt,n) in enumerate([(8.5,74),(8.75,79),(9.0,83),(9.25,86)]): add(pluck(nf(n),0.6,4000),dt,0.12*(1-i*0.12),pan=0.3*np.sin(i))
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
