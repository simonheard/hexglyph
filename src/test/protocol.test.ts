import{describe,expect,it}from'vitest';
import{encodeBytes,encodePayload,decodeSymbols,maxPayloadBytes,PayloadTooLargeError}from'../protocol/codec';
import{bytesToSymbols,symbolsToBytes}from'../protocol/packing';
import{interleave,deinterleave,permutation}from'../protocol/interleave';
import{crc32}from'../protocol/crc32';

describe('Protocol V1',()=>{
 it.each(['ASCII','中文 UTF-8 🚀','a'.repeat(120)])('round trips %s',text=>{const e=encodePayload(text,'high','dense');expect(decodeSymbols(e.symbols,e.radius,e.mode).text).toBe(text)});
 it('round trips arbitrary bytes and grows the radius automatically',()=>{const small=encodeBytes(Uint8Array.from([0,255,1,254]),'high','dense'),large=encodeBytes(Uint8Array.from({length:140},(_,i)=>(i*91)&255),'high','dense');expect(decodeSymbols(small.symbols,small.radius,small.mode).bytes).toEqual(Uint8Array.from([0,255,1,254]));expect(large.radius).toBeGreaterThan(small.radius)});
 it('reports the exact payload limit for the selected channel',()=>{const max=maxPayloadBytes('high','dense');expect(()=>encodeBytes(new Uint8Array(max),'high','dense')).not.toThrow();expect(()=>encodeBytes(new Uint8Array(max+1),'high','dense')).toThrow(PayloadTooLargeError)});
 it('packs 3-bit symbols without loss',()=>{const b=Uint8Array.from({length:64},(_,i)=>(i*73)&255),s=bytesToSymbols(b,3);expect(symbolsToBytes(s,3,b.length)).toEqual(b)});
 it('packs 2-bit symbols without loss',()=>{const b=Uint8Array.from({length:64},(_,i)=>(i*41)&255),s=bytesToSymbols(b,2);expect(symbolsToBytes(s,2,b.length)).toEqual(b)});
 it('interleaves reversibly and bijectively',()=>{const a=Array.from({length:997},(_,i)=>i),p=permutation(a.length,12345);expect(new Set(p).size).toBe(a.length);expect(deinterleave(interleave(a,12345),12345)).toEqual(a)});
 it('RS repairs sparse symbol damage after spatial interleave',()=>{const text='localized damage should spread across bytes';const e=encodePayload(text,'extreme','dense'),x=[...e.symbols];for(let i=20;i<28;i++)x[i]=(x[i]+3)&7;expect(decodeSymbols(x,e.radius,e.mode).text).toBe(text)});
 it('CRC32 standard vector',()=>expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926));
});
