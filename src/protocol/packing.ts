export function bytesToSymbols(bytes:Uint8Array,bits:2|3):number[]{const out:number[]=[];let acc=0,n=0;for(const b of bytes){acc=(acc<<8)|b;n+=8;while(n>=bits){n-=bits;out.push((acc>>>n)&((1<<bits)-1));}}if(n)out.push((acc<<(bits-n))&((1<<bits)-1));return out;}
export function symbolsToBytes(symbols:number[],bits:2|3,byteLength:number):Uint8Array{const out:number[]=[];let acc=0,n=0;for(const s of symbols){acc=(acc<<bits)|s;n+=bits;while(n>=8&&out.length<byteLength){n-=8;out.push((acc>>>n)&255);}}return new Uint8Array(out);}

