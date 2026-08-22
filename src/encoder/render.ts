import { V1,V2 } from '../protocol/constants';
import { calibrationCells, hexCells, payloadCells, ringDistance, type Cell } from '../protocol/geometry';
import type { Encoded } from '../protocol/codec';

export type RenderOptions={cellSize:number;debug?:boolean};
export type Rendered={canvas:HTMLCanvasElement;svg:string;side:number;pitch:number};
const SQRT3=Math.sqrt(3);
function ordered(cells:Cell[]){return [...cells].sort((a,b)=>Math.atan2(a.v,a.u)-Math.atan2(b.v,b.u)||ringDistance(a.q,a.r)-ringDistance(b.q,b.r));}
function cellXY(c:Cell,r:number,pitch:number,q:number){return{x:q+(c.u+r)*pitch,y:q+(c.v+r*SQRT3/2)*pitch};}
function symbolParts(symbol:number,mode:'robust'|'dense'){return mode==='dense'?{color:symbol>>1,marked:(symbol&1)===1}:{color:symbol,marked:false};}

export function renderCode(encoded:Encoded,opt:RenderOptions):Rendered{
  const pitch=Math.max(8,opt.cellSize),q=V1.quietCells*pitch,span=2*encoded.radius*pitch;
  const side=Math.ceil(span+2*q),canvas=document.createElement('canvas');canvas.width=canvas.height=side;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,side,side);
  const points=ordered(hexCells(encoded.radius).filter(c=>ringDistance(c.q,c.r)===encoded.radius));
  const cornerCoords=[{q:-encoded.radius,r:0},{q:0,r:-encoded.radius},{q:encoded.radius,r:-encoded.radius},{q:encoded.radius,r:0},{q:0,r:encoded.radius},{q:-encoded.radius,r:encoded.radius}].map(c=>cellXY({q:c.q,r:c.r,u:c.q+c.r/2,v:c.r*SQRT3/2} as Cell,encoded.radius,pitch,q));
  ctx.beginPath();cornerCoords.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.strokeStyle='#111318';ctx.lineWidth=pitch*.72;ctx.lineJoin='miter';ctx.stroke();
  // Asymmetric grayscale sync: 1/2/3 light dashes identify the top-right edge in debug and future fast paths.
  drawSyncSignature(ctx,cornerCoords,pitch,encoded.version);
  const cal=ordered(calibrationCells(encoded.radius));cal.forEach((c,i)=>drawSymbol(ctx,cellXY(c,encoded.radius,pitch,q),i%8,'dense',pitch,encoded.version));
  payloadCells(encoded.radius).forEach((c,i)=>drawSymbol(ctx,cellXY(c,encoded.radius,pitch,q),encoded.symbols[i]??0,encoded.mode,pitch,encoded.version));
  if(encoded.version===2){ctx.beginPath();cornerCoords.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.strokeStyle='#111318';ctx.lineWidth=pitch*.72;ctx.lineJoin='miter';ctx.stroke();drawSyncSignature(ctx,cornerCoords,pitch,encoded.version);}
  if(opt.debug){ctx.fillStyle='#315efb';ctx.font=`${Math.max(10,pitch*.35)}px ui-monospace`;ctx.fillText(`HG1 r${encoded.radius} ${encoded.mode}`,8,16);}
  return{canvas,svg:canvasToSvg(encoded,opt,side,pitch,q,cornerCoords),side,pitch};
}
function hexPath(ctx:CanvasRenderingContext2D,p:{x:number;y:number},radius:number){ctx.beginPath();for(let i=0;i<6;i++){const angle=Math.PI/6+i*Math.PI/3,x=p.x+Math.cos(angle)*radius,y=p.y+Math.sin(angle)*radius;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
function hexPoints(p:{x:number;y:number},radius:number){return Array.from({length:6},(_,i)=>{const angle=Math.PI/6+i*Math.PI/3;return`${p.x+Math.cos(angle)*radius},${p.y+Math.sin(angle)*radius}`;}).join(' ');}
function drawSymbol(ctx:CanvasRenderingContext2D,p:{x:number;y:number},symbol:number,mode:'robust'|'dense',pitch:number,version:1|2){const {color,marked}=symbolParts(symbol,mode),radius=version===2?pitch/SQRT3*.94:pitch*(1-V1.gapRatio)/2,markerRatio=version===2?V2.markerRatio:V1.markerRatio;version===2?hexPath(ctx,p,radius):(ctx.beginPath(),ctx.arc(p.x,p.y,radius,0,Math.PI*2));ctx.fillStyle=V1.colors[color];ctx.fill();if(marked){version===2?hexPath(ctx,p,radius*markerRatio):(ctx.beginPath(),ctx.arc(p.x,p.y,radius*markerRatio,0,Math.PI*2));ctx.fillStyle=color===0?V1.markerLight:'#101216';ctx.fill();}}
function drawSyncSignature(ctx:CanvasRenderingContext2D,corners:{x:number;y:number}[],pitch:number,version:1|2){ctx.strokeStyle='#fff';ctx.lineWidth=pitch*.16;ctx.lineCap='round';const dash=(edge:number,t:number)=>{const a=corners[edge],b=corners[(edge+1)%6];ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*(t-.018),a.y+(b.y-a.y)*(t-.018));ctx.lineTo(a.x+(b.x-a.x)*(t+.018),a.y+(b.y-a.y)*(t+.018));ctx.stroke();};for(let i=0;i<3;i++)dash(1,.38+i*.09);if(version===2){dash(0,.5);dash(2,.455);dash(2,.545);}ctx.lineCap='butt';}
function canvasToSvg(e:Encoded,opt:RenderOptions,side:number,pitch:number,q:number,corners:{x:number;y:number}[]){const cells:string[]=[];const markerRatio=e.version===2?V2.markerRatio:V1.markerRatio;const add=(c:Cell,s:number,m:'robust'|'dense')=>{const p=cellXY(c,e.radius,pitch,q),x=symbolParts(s,m),r=e.version===2?pitch/SQRT3*.94:pitch*(1-V1.gapRatio)/2;if(e.version===2){cells.push(`<polygon points="${hexPoints(p,r)}" fill="${V1.colors[x.color]}"/>`);if(x.marked)cells.push(`<polygon points="${hexPoints(p,r*markerRatio)}" fill="${x.color===0?V1.markerLight:'#101216'}"/>`);}else{cells.push(`<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${V1.colors[x.color]}"/>`);if(x.marked)cells.push(`<circle cx="${p.x}" cy="${p.y}" r="${r*markerRatio}" fill="${x.color===0?V1.markerLight:'#101216'}"/>`);}};ordered(calibrationCells(e.radius)).forEach((c,i)=>add(c,i%8,'dense'));payloadCells(e.radius).forEach((c,i)=>add(c,e.symbols[i]??0,e.mode));const border=`<polygon points="${corners.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#111318" stroke-width="${pitch*.72}" stroke-linejoin="miter"/>`,signature=svgSyncSignature(corners,pitch,e.version);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"><rect width="100%" height="100%" fill="white"/>${e.version===2?cells.join('')+border+signature:border+signature+cells.join('')}</svg>`;}
function svgSyncSignature(corners:{x:number;y:number}[],pitch:number,version:1|2){const lines:string[]=[];const dash=(edge:number,t:number)=>{const a=corners[edge],b=corners[(edge+1)%6],x1=a.x+(b.x-a.x)*(t-.018),y1=a.y+(b.y-a.y)*(t-.018),x2=a.x+(b.x-a.x)*(t+.018),y2=a.y+(b.y-a.y)*(t+.018);lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);};for(let i=0;i<3;i++)dash(1,.38+i*.09);if(version===2){dash(0,.5);dash(2,.455);dash(2,.545);}return `<g stroke="white" stroke-width="${pitch*.16}" stroke-linecap="round">${lines.join('')}</g>`;}
export function downloadCanvas(canvas:HTMLCanvasElement,name='hexglyph.png'){canvas.toBlob(b=>{if(!b)return;const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);},'image/png');}
export function downloadSvg(svg:string,name='hexglyph.svg'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
