import numpy as np, wave
SR=48000; DUR=12.0; N=int(SR*DUR)
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
# intro pad 0-2 (Am9), swelling
add(pad([57,60,64,67,71],2.4,cut=1200,att=1.6,rel=0.3),0.0,0.32)
for i in range(16): add(hat(),i*0.125,0.06+0.05*(i%4==0)*0+0.04*(i/16),pan=0.3*((-1)**i))
# riser + reverse cymbal into drop
add(whoosh(1.0,300,6000,rev=True),1.0,0.55)
t=t_(1.0); add(np.sin(2*np.pi*np.cumsum(200+600*(t/1.0)**2)/SR)*(t/1.0)**2*0.25,1.0,1.0)
# progression bars from 2.0: Am (2-4), F (4-6), C (6-7), G (7-8), final Cmaj9 at 8
chords=[(2.0,2.0,[57,60,64,69],45),(4.0,2.0,[53,57,60,65],41),(6.0,1.0,[55,60,64,67],48),(7.0,1.0,[55,59,62,67],43)]
for st,d,ns,root in chords:
    add(pad(ns,d+0.15,cut=2800,att=0.05,rel=0.15),st,0.22)
    for k in range(int(d/0.25)):
        add(bass(nf(root) if k%2==0 else nf(root+12)),st+k*0.25,0.55)
    arp=ns+[ns[1]+12,ns[2]+12]
    for k in range(int(d/0.125)):
        if k%3==2: continue
        add(pluck(nf(arp[(k*2)%len(arp)]+12),0.3),st+k*0.125,0.13,pan=0.5*np.sin(k))
# drums 2-8
for b in range(12):
    tb=2.0+b*0.5
    add(kick(boom=(b==0)),tb,0.95 if b else 1.2)
    add(hat(op=True),tb+0.25,0.16,pan=0.25)
    if b%2==1: add(clap(),tb,0.42)
    for s in (0.125,0.375): add(hat(),tb+s,0.07,pan=-0.3)
# final chord at 8: Cmaj9 bright, long decay
fin=[48,55,59,62,64,71]
add(pad(fin,4.0,cut=3200,att=0.02,rel=3.2),8.0,0.3)
add(kick(boom=True),8.0,0.9)
for i,n in enumerate([72,76,79,83,86]): add(bell(nf(n),3.5),8.0+i*0.06,0.12,pan=-0.4+0.2*i)
add(bass(nf(36),3.5)*1,8.0,0.4)
# soft hats continue 8-10 decaying
for i in range(8): add(hat(),8.5+i*0.25,0.05*(1-i/8),pan=0.2)

# ---------- SFX ----------
def anchor_times():
    pts=lambda P:[((X-570)/100,-(Y-500)/100) for X,Y in P]
    V=pts([[215,300],[325,300],[400,560],[475,300],[585,300],[455,700],[345,700]])
    K=pts([[600,300],[700,300],[700,455],[805,300],[920,300],[780,490],[925,700],[805,700],[700,540],[700,700],[600,700]])
    out=[]
    for P,(t0,t1) in ((V,(0.25,1.05)),(K,(1.1,1.9))):
        P=P+[P[0]]; seg=[np.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]) for i in range(1,len(P))]; Lt=sum(seg); acc=0
        for i in range(len(P)-1):
            if i>0: acc+=seg[i-1]
            out.append(t0+(t1-t0)*acc/Lt)
    return out
add(blip(1760,0.12)*1.2,0.0,0.35); add(click(5000),0.0,0.35)  # dot appears
for i,ta in enumerate(anchor_times()): add(click(2600+400*(i%3)),ta,0.28,pan=-0.5+ (i%5)*0.25)
# pen line hum 0.25-1.9
t=t_(1.65); add(onepole_lp(saw(110,1.65,0.01),900)*np.minimum(1,t/0.1)*np.minimum(1,(1.65-t)/0.1)*0.18,0.25,1.0)
# extrude impact
t=t_(1.2); add(np.sin(2*np.pi*np.cumsum(90*np.exp(-t*3)+30)/SR)*np.exp(-t/0.5)*0.7,2.0,1.0)
add(onepole_lp(rng.standard_normal(int(0.8*SR)),900)*np.exp(-t_(0.8)/0.18),2.0,0.5)
# grid ripple shimmer
add(whoosh(0.9,2500,9000),2.05,0.18,pan=0.4)
# dot orbit passes (doppler-ish whooshes)
for tw in (3.1,4.75,6.05): add(whoosh(0.5,700,2500),tw,0.22,pan=0.6*np.sin(tw*3))
# code scan + data chatter 5.4-7.6
add(whoosh(0.6,1500,7000),5.35,0.2)
r2=np.random.default_rng(9)
for k in range(60):
    tk=5.5+k*0.035+r2.random()*0.01
    if r2.random()<0.6: add(blip(r2.choice([880,1320,1760,2640]),0.03),tk,0.06*(1-k/70),pan=r2.uniform(-.8,.8))
# bracket slams
for tb,pn in ((6.5,-0.6),(7.0,0.6)):
    add(whoosh(0.3,600,4000,rev=True),tb-0.3,0.35,pan=pn)
    add(metal(),tb,0.55,pan=pn); add(kick(),tb,0.5)
# dot swoop & landing
add(whoosh(0.7,400,5000),7.3,0.4)
add(click(1800)*1.5,8.0,0.4)
# name reveal air
add(whoosh(1.0,3000,800),8.2,0.18)
# typing ticks
full='Graphic Design  ·  3D  ·  Code'
for k in range(len(full)):
    if full[k]!=' ': add(click(4200+300*(k%3)),9.25+k*1.05/len(full),0.12,pan=-0.3+0.6*k/len(full))
# light sweep glass
add(whoosh(1.1,5000,12000),10.2,0.12,pan=0.0)
for i,n in enumerate([84,88,91]): add(bell(nf(n),1.5),10.6+i*0.08,0.05,pan=0.5)

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
