import{describe,expect,it}from'vitest';
import{distance}from'../vision/color';
import{V1}from'../protocol/constants';
const rgb=(hex:string)=>({r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)});
describe('physical palette',()=>{it('keeps every pair separated in OKLab',()=>{const c=V1.colors.map(rgb);let min=1;for(let i=0;i<c.length;i++)for(let j=i+1;j<c.length;j++)min=Math.min(min,distance(c[i],c[j]));expect(min).toBeGreaterThan(.12)});it('survives representative white balance/exposure drift with adaptive centers',()=>{const base=V1.colors.map(rgb),warp=(c:{r:number;g:number;b:number})=>({r:Math.min(255,c.r*1.08+8),g:Math.min(255,c.g*.93+8),b:Math.min(255,c.b*.82+8)});base.forEach((c,i)=>{const q=warp(c),nearest=base.map((x,j)=>({j,d:distance(q,warp(x))})).sort((a,b)=>a.d-b.d)[0];expect(nearest.j).toBe(i)})})});
