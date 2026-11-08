import cv2, numpy as np, sys
W=sys.argv[1]
for name in ['front','side']:
    im=cv2.imread(f'{W}/{name}.jpg').astype(np.float32)/255
    b,g,r=im[...,0],im[...,1],im[...,2]
    lum=0.3*r+0.59*g+0.11*b
    sat=im.max(2)-im.min(2)
    m=(lum>0.10).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(m)
    big=1+np.argmax(st[1:,cv2.CC_STAT_AREA])
    st_m=(lab==big).astype(np.uint8)
    st_m=cv2.morphologyEx(st_m,cv2.MORPH_CLOSE,np.ones((15,15),np.uint8))
    # fill holes
    ff=st_m.copy(); h,w=ff.shape; mask=np.zeros((h+2,w+2),np.uint8); cv2.floodFill(ff,mask,(0,0),1)
    holes=(ff==0); st_m[holes]=1
    # greenish / foliage: exclude from statue
    green=((g-r)>0.03)&(lum>0.04)
    print(name, st_m.mean(), green.mean())
    cv2.imwrite(f'{W}/{name}_mask.png',st_m*255)
    cv2.imwrite(f'{W}/{name}_green.png',green.astype(np.uint8)*255)
