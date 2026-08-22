import {GenericGF,ReedSolomonDecoder,ReedSolomonEncoder} from '@zxing/library';
import {SUPPORTED_SIZES,V1,V2,type DensityMode,type EccProfile} from './constants';
import {crc32,readU32,u32} from './crc32';
import {bytesToSymbols,symbolsToBytes} from './packing';
import {deinterleave,interleave} from './interleave';
import {payloadCells} from './geometry';

export type Encoded={symbols:number[];radius:number;mode:DensityMode;profile:EccProfile;version:1|2;packetBytes:number;dataBytes:number;eccBytes:number;capacity:number};
export type Decoded={text:string;bytes:Uint8Array;corrections:number;profile:EccProfile;mode:DensityMode;version:1|2};
export class PayloadTooLargeError extends Error{
  constructor(public readonly payloadBytes:number,public readonly maxBytes:number){super(`Payload is ${payloadBytes} bytes; this format allows at most ${maxBytes} bytes with these settings.`);this.name='PayloadTooLargeError';}
}

const gf=GenericGF.QR_CODE_FIELD_256;
function concat(...xs:Uint8Array[]){const n=xs.reduce((sum,x)=>sum+x.length,0),out=new Uint8Array(n);let offset=0;for(const x of xs){out.set(x,offset);offset+=x.length;}return out;}
function flags(mode:DensityMode,profile:EccProfile){return(mode==='dense'?1:0)|(Object.keys(V1.profiles).indexOf(profile)<<1);}
function header(magic:Uint8Array,version:number,payload:Uint8Array,mode:DensityMode,profile:EccProfile){return concat(magic,new Uint8Array([version,flags(mode,profile)]),u32(payload.length),u32(crc32(payload)),payload);}
function preamble(payload:Uint8Array,mode:DensityMode,profile:EccProfile){return concat(V2.magic,new Uint8Array([V2.version,flags(mode,profile)]),u32(payload.length),u32(crc32(payload)));}
function eccLength(dataLength:number,profile:EccProfile){const ratio=V1.profiles[profile].ratio;return Math.max(8,Math.ceil(dataLength*ratio/(1-ratio)));}
function eccLengthV2(dataLength:number,profile:EccProfile){const ratio=V2.profiles[profile].ratio;return Math.max(24,Math.ceil(dataLength*ratio/(1-ratio)));}
function maxBlockData(profile:EccProfile){let max=1;for(let n=1;n<=255;n++)if(n+eccLengthV2(n,profile)<=255)max=n;return max;}
function rsEncode(data:Uint8Array,ecc:number){const ints=new Int32Array(data.length+ecc);ints.set(data);new ReedSolomonEncoder(gf).encode(ints,ecc);return new Uint8Array(ints);}
function rsDecode(code:Uint8Array,ecc:number){const ints=Int32Array.from(code);const decoder:any=new ReedSolomonDecoder(gf);decoder.decode(ints,ecc);return new Uint8Array(ints.slice(0,-ecc));}
function packetLengthV2(payloadBytes:number,profile:EccProfile){
  const preambleBytes=14+eccLengthV2(14,profile),block=maxBlockData(profile),full=Math.floor(payloadBytes/block),tail=payloadBytes%block;
  return preambleBytes+full*(block+eccLengthV2(block,profile))+(tail?tail+eccLengthV2(tail,profile):0);
}
function encodePacketV2(payload:Uint8Array,profile:EccProfile,mode:DensityMode){
  const parts=[rsEncode(preamble(payload,mode,profile),eccLengthV2(14,profile))],block=maxBlockData(profile);
  for(let offset=0;offset<payload.length;offset+=block){const chunk=payload.slice(offset,offset+block);parts.push(rsEncode(chunk,eccLengthV2(chunk.length,profile)));}
  return concat(...parts);
}
function maxPayloadFor(profile:EccProfile,mode:DensityMode,version:1|2){
  const bits=mode==='dense'?3:2,sizes=version===2?V2.sizes:V1.sizes,maxCells=payloadCells(sizes[sizes.length-1]).length;
  let max=0;
  for(let payload=0;payload<=10000;payload++){
    const packetBytes=version===2?packetLengthV2(payload,profile):14+payload+eccLength(14+payload,profile);
    if((version===2||packetBytes<=255)&&Math.ceil(packetBytes*8/bits)<=maxCells)max=payload;else if(payload>max+512)break;
  }
  return max;
}

export function maxPayloadBytes(profile:EccProfile='high',mode:DensityMode='dense'){return maxPayloadFor(profile,mode,2);}
export function maxPayloadBytesV1(profile:EccProfile='high',mode:DensityMode='dense'){return maxPayloadFor(profile,mode,1);}

export function encodeBytes(payload:Uint8Array,profile:EccProfile='high',mode:DensityMode='dense'):Encoded{
  const max=maxPayloadBytes(profile,mode);
  if(payload.length>max)throw new PayloadTooLargeError(payload.length,max);
  const packet=encodePacketV2(payload,profile,mode),bits=mode==='dense'?3:2,logical=bytesToSymbols(packet,bits);
  const radius=V2.sizes.find(r=>payloadCells(r).length>=logical.length);
  if(!radius)throw new PayloadTooLargeError(payload.length,max);
  const seed=(radius<<8)|bits,padded=[...logical,...Array(payloadCells(radius).length-logical.length).fill(0)];
  return{symbols:interleave(padded,seed),radius,mode,profile,version:2,packetBytes:packet.length,dataBytes:14+payload.length,eccBytes:packet.length-14-payload.length,capacity:payloadCells(radius).length};
}
export function encodePayload(text:string,profile:EccProfile='high',mode:DensityMode='dense'){return encodeBytes(new TextEncoder().encode(text),profile,mode);}

export function encodeBytesV1(payload:Uint8Array,profile:EccProfile='high',mode:DensityMode='dense'):Encoded{
  const max=maxPayloadBytesV1(profile,mode);
  if(payload.length>max)throw new PayloadTooLargeError(payload.length,max);
  const body=header(V1.magic,V1.version,payload,mode,profile),ecc=eccLength(body.length,profile),packet=rsEncode(body,ecc),bits=mode==='dense'?3:2,logical=bytesToSymbols(packet,bits);
  const radius=V1.sizes.find(r=>payloadCells(r).length>=logical.length);
  if(!radius)throw new PayloadTooLargeError(payload.length,max);
  const seed=(radius<<8)|bits,padded=[...logical,...Array(payloadCells(radius).length-logical.length).fill(0)];
  return{symbols:interleave(padded,seed),radius,mode,profile,version:1,packetBytes:packet.length,dataBytes:body.length,eccBytes:ecc,capacity:payloadCells(radius).length};
}

function matchesMagic(data:Uint8Array,magic:Uint8Array){return data.slice(0,4).every((byte,i)=>byte===magic[i]);}
function decodeV2(raw:Uint8Array,mode:DensityMode):Decoded{
  for(const profile of Object.keys(V2.profiles) as EccProfile[]){
    const preambleEcc=eccLengthV2(14,profile),preambleTotal=14+preambleEcc;
    if(raw.length<preambleTotal)continue;
    try{
      const meta=rsDecode(raw.slice(0,preambleTotal),preambleEcc),profileId=Object.keys(V2.profiles).indexOf(profile);
      if(!matchesMagic(meta,V2.magic)||meta[4]!==V2.version||(meta[5]&1)!==(mode==='dense'?1:0)||(meta[5]>>1)!==profileId)continue;
      const size=readU32(meta,6),expectedCrc=readU32(meta,10),block=maxBlockData(profile),chunks:Uint8Array[]=[];
      let remaining=size,offset=preambleTotal;
      while(remaining){const dataLength=Math.min(block,remaining),ecc=eccLengthV2(dataLength,profile),total=dataLength+ecc;if(offset+total>raw.length)throw new Error('truncated V2 block');chunks.push(rsDecode(raw.slice(offset,offset+total),ecc));offset+=total;remaining-=dataLength;}
      const payload=concat(...chunks);
      if(payload.length!==size||crc32(payload)!==expectedCrc)continue;
      return{text:new TextDecoder().decode(payload),bytes:payload,corrections:0,profile,mode,version:2};
    }catch{}
  }
  throw new Error('V2 ECC/CRC validation failed');
}
function decodeV1(raw:Uint8Array,mode:DensityMode):Decoded{
  for(const profile of Object.keys(V1.profiles) as EccProfile[]){
    const ratio=V1.profiles[profile].ratio;
    for(let dataLength=14;dataLength<Math.min(raw.length,256);dataLength++){
      const ecc=Math.max(8,Math.ceil(dataLength*ratio/(1-ratio))),total=dataLength+ecc;if(total>raw.length||total>255)continue;
      try{const data=rsDecode(raw.slice(0,total),ecc);if(matchesMagic(data,V1.magic)&&data[4]===V1.version){const size=readU32(data,6);if(size!==dataLength-14)continue;const payload=data.slice(14,14+size);if(crc32(payload)!==readU32(data,10))continue;return{text:new TextDecoder().decode(payload),bytes:payload,corrections:0,profile,mode,version:1};}}catch{}
    }
  }
  throw new Error('V1 ECC/CRC validation failed');
}
export function decodeSymbols(symbols:number[],radius:number,mode:DensityMode,_erasuresCells:number[]=[],version?:1|2):Decoded{
  const bits=mode==='dense'?3:2,seed=(radius<<8)|bits,logical=deinterleave(symbols,seed),raw=symbolsToBytes(logical,bits,Math.floor(logical.length*bits/8));
  if(version===2)return decodeV2(raw,mode);
  if(version===1)return decodeV1(raw,mode);
  try{return decodeV2(raw,mode);}catch{return decodeV1(raw,mode);}
}

export {SUPPORTED_SIZES};
