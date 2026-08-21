const TABLE = new Uint32Array(256);
for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;TABLE[n]=c>>>0;}
export function crc32(data: Uint8Array){let c=0xffffffff;for(const b of data)c=TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function u32(n:number){return new Uint8Array([n>>>24,(n>>>16)&255,(n>>>8)&255,n&255]);}
export function readU32(a:Uint8Array,o:number){return ((a[o]<<24)|(a[o+1]<<16)|(a[o+2]<<8)|a[o+3])>>>0;}

