import pymupdf, sys
def dah_lines(path):
    doc=pymupdf.open(path); out=[]
    for p in doc:
        W=p.rect.width
        bl=[b for b in p.get_text('blocks') if b[1]>45 and b[3]<795 and b[6]==0]
        left=sorted([b for b in bl if b[0]<W/2-10],key=lambda b:b[1]); right=sorted([b for b in bl if b[0]>=W/2-10],key=lambda b:b[1])
        for b in left+right:
            out.extend(l.strip() for l in b[4].splitlines() if l.strip())
    return out
if __name__=='__main__':
    open(sys.argv[2],'w').write('\n'.join(dah_lines(sys.argv[1])))
