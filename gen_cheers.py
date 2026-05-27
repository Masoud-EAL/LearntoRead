import struct, math, random

SR = 22050

def write_wav(path, samples):
    data = struct.pack('<' + 'h' * len(samples),
                       *[max(-32767, min(32767, int(s * 32767))) for s in samples])
    with open(path, 'wb') as f:
        f.write(b'RIFF'); f.write(struct.pack('<I', 36 + len(data)))
        f.write(b'WAVEfmt '); f.write(struct.pack('<I', 16))
        f.write(struct.pack('<HHIIHH', 1, 1, SR, SR*2, 2, 16))
        f.write(b'data'); f.write(struct.pack('<I', len(data))); f.write(data)

def bp(buf, fc, q):
    w = 2*math.pi*fc/SR; a = math.sin(w)/(2*q)
    b0=(math.sin(w)/2)/(1+a); b2=-b0; a1=(-2*math.cos(w))/(1+a); a2=(1-a)/(1+a)
    out=[0.0]*len(buf); x1=x2=y1=y2=0.0
    for i,x in enumerate(buf):
        y=b0*x-b2*x2-a1*y1-a2*y2; x2=x1; x1=x; y2=y1; y1=y; out[i]=y
    return out

def lp(buf, fc):
    w=2*math.pi*fc/SR; c=math.cos(w); s=math.sin(w); a=s/(2*0.707)
    b=((1-c)/2)/(1+a); a1=(-2*c)/(1+a); a2=(1-a)/(1+a)
    out=[0.0]*len(buf); x1=x2=y1=y2=0.0
    for i,x in enumerate(buf):
        y=b*x+2*b*x1+b*x2-a1*y1-a2*y2; x2=x1; x1=x; y2=y1; y1=y; out[i]=y
    return out

def comb_reverb(buf, wet=0.22, decay=0.55):
    delays=[int(SR*d) for d in [0.037,0.052,0.071,0.089]]
    bufs=[[0.0]*d for d in delays]; ptrs=[0]*4
    out=list(buf)
    for i,x in enumerate(buf):
        rev=0.0
        for j in range(4):
            p=ptrs[j]; d=bufs[j][p]
            bufs[j][p]=x+d*decay; ptrs[j]=(p+1)%delays[j]; rev+=d
        out[i]=x*(1-wet)+rev*wet/4
    return out

def env_shape(n, atk, rel):
    e=[0.0]*n; ai=int(atk*SR); ri=n-int(rel*SR)
    for i in range(n):
        if i<ai: e[i]=i/ai
        elif i>=ri: e[i]=max(0,(n-i)/(n-ri))
        else: e[i]=1.0
    return e

def crowd_voices(n, n_voices, fund_lo, fund_hi, seed=0):
    rng=random.Random(seed); out=[0.0]*n
    for _ in range(n_voices):
        fund=rng.uniform(fund_lo, fund_hi)
        start=int(rng.uniform(0, n*0.08)); dur=int(rng.uniform(n*0.55, n*0.92))
        end=min(start+dur, n); vlen=end-start
        amp=rng.uniform(0.4,0.9)/n_voices
        vib_rate=rng.uniform(3.5,6.5); vib_depth=rng.uniform(0.008,0.025)
        ph=rng.uniform(0, 2*math.pi)
        phase=ph
        for i in range(start, end):
            pos=(i-start)/vlen
            ve=min(pos/0.08,1.0)*min((1-pos)/0.12,1.0)
            t=(i-start)/SR
            freq=fund*(1+vib_depth*math.sin(2*math.pi*vib_rate*t))
            phase+=2*math.pi*freq/SR
            s=(math.sin(phase)*0.50+math.sin(2*phase+ph)*0.28+
               math.sin(3*phase+ph*1.5)*0.14+math.sin(4*phase)*0.06)
            out[i]+=s*amp*ve
    return out

def clap_layer(n, interval_s, dur_s=0.075, vol=0.35, seed=1):
    rng=random.Random(seed); noise=[rng.uniform(-1,1) for _ in range(n)]
    cl=bp(noise, 1400, 1.8); out=[0.0]*n
    step=int(interval_s*SR); clen=int(dur_s*SR)
    for ci in range(0, n, step):
        for j in range(min(clen, n-ci)):
            t=j/clen; ev=math.sin(math.pi*t)**1.5
            out[ci+j]+=cl[ci+j]*vol*ev
    return out

def generate(duration, n_voices, fund_lo, fund_hi, peak, atk, rel,
             clap_interval=0.38, clap_vol=0.30, seed=42):
    n=int(duration*SR)
    rng=random.Random(seed+1)

    # Crowd voices
    vox=crowd_voices(n, n_voices, fund_lo, fund_hi, seed=seed)
    # Filter voices through formant bands (simulate "ahhh")
    vox_lo=bp(vox, 650, 1.2)
    vox_hi=bp(vox, 1200, 0.9)
    vox_mix=[vox_lo[i]*0.6+vox_hi[i]*0.4 for i in range(n)]

    # Noise layers (air, sibilance)
    noise_a=[rng.uniform(-1,1) for _ in range(n)]
    noise_b=[rng.uniform(-1,1) for _ in range(n)]
    layer_lo=bp(noise_a, 300, 0.6)   # low crowd rumble
    layer_hi=bp(noise_b, 2500, 0.8)  # high shimmer

    # Clapping
    claps=clap_layer(n, clap_interval, vol=clap_vol, seed=seed+2)

    # Mix
    mixed=[vox_mix[i]*0.55 + layer_lo[i]*0.20 + layer_hi[i]*0.08 + claps[i]
           for i in range(n)]

    # Envelope
    e=env_shape(n, atk, rel)
    shaped=[mixed[i]*e[i] for i in range(n)]

    # Reverb
    rev=comb_reverb(shaped, wet=0.20, decay=0.52)

    # Normalise + apply peak
    mx=max(abs(x) for x in rev) or 1.0
    return [x/mx*peak for x in rev]

print("Generating cheer-1st.wav (big winner cheer)...")
s1=generate(3.6, n_voices=48, fund_lo=120, fund_hi=320, peak=0.93,
            atk=0.22, rel=0.85, clap_interval=0.33, clap_vol=0.38)
write_wav('audio/cheer-1st.wav', s1)

print("Generating cheer-2nd.wav (second place)...")
s2=generate(2.5, n_voices=28, fund_lo=140, fund_hi=280, peak=0.70,
            atk=0.30, rel=0.70, clap_interval=0.40, clap_vol=0.25)
write_wav('audio/cheer-2nd.wav', s2)

print("Generating cheer-3rd.wav (third place)...")
s3=generate(2.0, n_voices=16, fund_lo=150, fund_hi=260, peak=0.50,
            atk=0.38, rel=0.60, clap_interval=0.46, clap_vol=0.18)
write_wav('audio/cheer-3rd.wav', s3)

print("Done.")
