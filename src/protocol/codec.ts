import { GenericGF, ReedSolomonDecoder, ReedSolomonEncoder } from '@zxing/library';
import { V1, type DensityMode, type EccProfile } from './constants';
import { crc32, readU32, u32 } from './crc32';
import { bytesToSymbols, symbolsToBytes } from './packing';
import { deinterleave, interleave } from './interleave';
import { payloadCells } from './geometry';

export type Encoded={symbols:number[];radius:number;mode:DensityMode;profile:EccProfile;packetBytes:number;dataBytes:number;eccBytes:number;capacity:number};
export class PayloadTooLargeError extends Error{
  constructor(public readonly payloadBytes:number,public readonly maxBytes:number){super(`Payload is ${payloadBytes} bytes; V1 allows at most ${maxBytes} bytes with these settings.`);this.name='PayloadTooLargeError';}
}
const gf=GenericGF.QR_CODE_FIELD_256;
function concat(...xs:Uint8Array[]){const n=xs.reduce((s,x)=>s+x.length,0),o=new Uint8Array(n);let p=0;for(const x of xs){o.set(x,p);p+=x.length;}return o;}
function header(payload:Uint8Array,mode:DensityMode,profile:EccProfile){const pid=Object.keys(V1.profiles).indexOf(profile);const flags=(mode==='dense'?1:0)|(pid<<1);return concat(V1.magic,new Uint8Array([V1.version,flags]),u32(payload.length),u32(crc32(payload)),payload);}
function rsEncode(data:Uint8Array,ecc:number){const ints=new Int32Array(data.length+ecc);ints.set(data);new ReedSolomonEncoder(gf).encode(ints,ecc);return new Uint8Array(ints);}
function rsDecode(code:Uint8Array,ecc:number,erasures:number[]=[]){const ints=Int32Array.from(code);const decoder:any=new ReedSolomonDecoder(gf);decoder.decode(ints,ecc,erasures.length?erasures:undefined);return new Uint8Array(ints.slice(0,-ecc));}
function eccLength(dataLength:number,profile:EccProfile){const ratio=V1.profiles[profile].ratio;return Math.max(8,Math.ceil(dataLength*ratio/(1-ratio)));}
export function maxPayloadBytes(profile:EccProfile='high',mode:DensityMode='dense'){
  const bits=mode==='dense'?3:2,maxCells=payloadCells(V1.sizes[V1.sizes.length-1]).length;
  let max=0;
  for(let payload=0;payload<=241;payload++){
    const dataLength=14+payload,total=dataLength+eccLength(dataLength,profile),symbols=Math.ceil(total*8/bits);
    if(total<=255&&symbols<=maxCells)max=payload;
  }
  return max;
}
export function encodeBytes(payload:Uint8Array,profile:EccProfile='high',mode:DensityMode='dense'):Encoded{
  const max=maxPayloadBytes(profile,mode);
  if(payload.length>max)throw new PayloadTooLargeError(payload.length,max);
  const body=header(payload,mode,profile),ecc=eccLength(body.length,profile),packet=rsEncode(body,ecc),bits=mode==='dense'?3:2;
  const logical=bytesToSymbols(packet,bits),radius=V1.sizes.find(r=>payloadCells(r).length>=logical.length);
  if(!radius)throw new PayloadTooLargeError(payload.length,max);
  const seed=(radius<<8)|bits,padded=[...logical,...Array(payloadCells(radius).length-logical.length).fill(0)];
  return{symbols:interleave(padded,seed),radius,mode,profile,packetBytes:packet.length,dataBytes:body.length,eccBytes:ecc,capacity:payloadCells(radius).length};
}
export function encodePayload(text:string,profile:EccProfile='high',mode:DensityMode='dense'):Encoded{return encodeBytes(new TextEncoder().encode(text),profile,mode);}
export function decodeSymbols(symbols:number[],radius:number,mode:DensityMode,_erasuresCells:number[]=[]){const bits=mode==='dense'?3:2,seed=(radius<<8)|bits,logical=deinterleave(symbols,seed);const raw=symbolsToBytes(logical,bits,255);if(raw.length<18)throw new Error('码字不足');for(const profile of Object.keys(V1.profiles) as EccProfile[]){const ratio=V1.profiles[profile].ratio;for(let dataLen=14;dataLen<raw.length;dataLen++){const ecc=Math.max(8,Math.ceil(dataLen*ratio/(1-ratio))),total=dataLen+ecc;if(total>raw.length||total>255)continue;try{const data=rsDecode(raw.slice(0,total),ecc);if(data.slice(0,4).every((b,i)=>b===V1.magic[i])&&data[4]===1){const size=readU32(data,6);if(size!==dataLen-14)continue;const payload=data.slice(14,14+size);if(crc32(payload)!==readU32(data,10))continue;return{text:new TextDecoder().decode(payload),bytes:payload,corrections:0,profile,mode};}}catch{}}
  }throw new Error('ECC/CRC 校验失败');}
