import { GenericGF, ReedSolomonDecoder, ReedSolomonEncoder } from '@zxing/library';
import { V1, type DensityMode, type EccProfile } from './constants';
import { crc32, readU32, u32 } from './crc32';
import { bytesToSymbols, symbolsToBytes } from './packing';
import { deinterleave, interleave } from './interleave';
import { payloadCells } from './geometry';

export type Encoded={symbols:number[];radius:number;mode:DensityMode;profile:EccProfile;packetBytes:number;dataBytes:number;eccBytes:number;capacity:number};
const gf=GenericGF.QR_CODE_FIELD_256;
function concat(...xs:Uint8Array[]){const n=xs.reduce((s,x)=>s+x.length,0),o=new Uint8Array(n);let p=0;for(const x of xs){o.set(x,p);p+=x.length;}return o;}
function header(payload:Uint8Array,mode:DensityMode,profile:EccProfile){const pid=Object.keys(V1.profiles).indexOf(profile);const flags=(mode==='dense'?1:0)|(pid<<1);return concat(V1.magic,new Uint8Array([V1.version,flags]),u32(payload.length),u32(crc32(payload)),payload);}
function rsEncode(data:Uint8Array,ecc:number){const ints=new Int32Array(data.length+ecc);ints.set(data);new ReedSolomonEncoder(gf).encode(ints,ecc);return new Uint8Array(ints);}
function rsDecode(code:Uint8Array,ecc:number,erasures:number[]=[]){const ints=Int32Array.from(code);const decoder:any=new ReedSolomonDecoder(gf);decoder.decode(ints,ecc,erasures.length?erasures:undefined);return new Uint8Array(ints.slice(0,-ecc));}
export function encodePayload(text:string,profile:EccProfile='high',mode:DensityMode='dense'):Encoded{const body=header(new TextEncoder().encode(text),mode,profile);const ratio=V1.profiles[profile].ratio;const ecc=Math.max(8,Math.ceil(body.length*ratio/(1-ratio)));if(body.length+ecc>255)throw new Error('V1 单个 RS 块最多 255 字节；请缩短文本。');const packet=rsEncode(body,ecc),bits=mode==='dense'?3:2;const logical=bytesToSymbols(packet,bits);let radius=V1.sizes.find(r=>payloadCells(r).length>=logical.length);if(!radius)throw new Error('数据超过 V1 最大尺寸容量');const seed=(radius<<8)|bits;const padded=[...logical,...Array(payloadCells(radius).length-logical.length).fill(0)];return{symbols:interleave(padded,seed),radius,mode,profile,packetBytes:packet.length,dataBytes:body.length,eccBytes:ecc,capacity:payloadCells(radius).length};}
export function decodeSymbols(symbols:number[],radius:number,mode:DensityMode,_erasuresCells:number[]=[]){const bits=mode==='dense'?3:2,seed=(radius<<8)|bits,logical=deinterleave(symbols,seed);const raw=symbolsToBytes(logical,bits,255);if(raw.length<18)throw new Error('码字不足');for(const profile of Object.keys(V1.profiles) as EccProfile[]){const ratio=V1.profiles[profile].ratio;for(let dataLen=14;dataLen<raw.length;dataLen++){const ecc=Math.max(8,Math.ceil(dataLen*ratio/(1-ratio))),total=dataLen+ecc;if(total>raw.length||total>255)continue;try{const data=rsDecode(raw.slice(0,total),ecc);if(data.slice(0,4).every((b,i)=>b===V1.magic[i])&&data[4]===1){const size=readU32(data,6);if(size!==dataLen-14)continue;const payload=data.slice(14,14+size);if(crc32(payload)!==readU32(data,10))continue;return{text:new TextDecoder().decode(payload),bytes:payload,corrections:0,profile,mode};}}catch{}}
  }throw new Error('ECC/CRC 校验失败');}
