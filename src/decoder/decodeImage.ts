import {V1,V2,SUPPORTED_SIZES,type DensityMode} from '../protocol/constants';
import {calibrationCells,payloadCells,type Cell} from '../protocol/geometry';
import {decodeSymbols} from '../protocol/codec';
import {distance,mean,type RGB} from '../vision/color';
import {detectHexCandidates} from './detect';
import {project,solveHomography,type Pt} from './homography';

export type CellReading={point:Pt;symbol:number;alternative:number;confidence:number};
export type DecodeImageResult={text:string;bytes:Uint8Array;corners:Pt[];readings:CellReading[];radius:number;mode:DensityMode;profile:string;version:1|2;meanConfidence:number;imageWidth:number;imageHeight:number};
export type DecodeProgress={percent:number;stage:'loading'|'detecting'|'sampling'|'ecc';detail:string};

type RefSample={point:Pt;color:RGB};
type Calibration={groups:RefSample[][];centers:RGB[];score:number;markerThreshold:number;markerScale:number};
type Hypothesis={corners:Pt[];h:number[];radius:number;candidateIndex:number;shift:number;mirror:number;calibration:Calibration};
type SoftCandidate={hypothesis:Hypothesis;readings:CellReading[];mode:DensityMode;version:1|2;quality:number};

const SQRT3=Math.sqrt(3),MAX_FULL_HYPOTHESES=56,MAX_SOFT_HYPOTHESES=2,MAX_SOFT_CELLS=6;

export async function fileToImageData(file:Blob){const bmp=await createImageBitmap(file),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const x=c.getContext('2d')!;x.drawImage(bmp,0,0);bmp.close();return{x:x.getImageData(0,0,c.width,c.height),canvas:c};}

export function decodeImage(image:ImageData,onProgress?:(progress:DecodeProgress)=>void):DecodeImageResult{
 onProgress?.({percent:2,stage:'detecting',detail:'准备边界检测'});
 const candidates=detectHexCandidates(image,(fraction,detail)=>onProgress?.({percent:2+fraction*20,stage:'detecting',detail}));
 onProgress?.({percent:23,stage:'sampling',detail:'根据校准环估计半径与方向'});
 const hypotheses=rankHypotheses(image,candidates,(fraction,detail)=>onProgress?.({percent:23+fraction*22,stage:'sampling',detail})).slice(0,MAX_FULL_HYPOTHESES);
 if(!hypotheses.length)throw new Error('没有满足像素密度要求的六边形候选');
 const attempts=hypotheses.reduce((sum,h)=>sum+versionsFor(h.radius).length*2,0),soft:SoftCandidate[]=[];
 let attempt=0,softAttemptCount=0,last='';
 for(const hypothesis of hypotheses)for(const version of versionsFor(hypothesis.radius))for(const mode of ['robust','dense'] as DensityMode[]){
 attempt++;
  const percent=45+Math.floor(attempt/attempts*48),detail=`候选 ${hypothesis.candidateIndex+1}/${candidates.length} · V${version} · R${hypothesis.radius} · ${mode}`;
  let readings:CellReading[]|undefined;
  try{
   onProgress?.({percent,stage:'sampling',detail});
   readings=payloadCells(hypothesis.radius).map(cell=>classify(image,hypothesis.h,cell,hypothesis.radius,mode,hypothesis.calibration));
   onProgress?.({percent,stage:'ecc',detail:`校验 V${version} · R${hypothesis.radius} · ${mode}`});
   const decoded=decodeSymbols(readings.map(x=>x.symbol),hypothesis.radius,mode,[],version);
   onProgress?.({percent:100,stage:'ecc',detail:'ECC 与 CRC 校验成功'});
   return result(image,hypothesis,readings,mode,decoded);
  }catch(error){
   last=error instanceof Error?error.message:String(error);
   if(readings&&soft.length<8){const meanConfidence=readings.reduce((sum,x)=>sum+x.confidence,0)/Math.max(1,readings.length);soft.push({hypothesis,readings,mode,version,quality:meanConfidence+Math.min(1,hypothesis.calibration.score/12)*.25});}
  }
 }
 const rankedSoft=soft.sort((a,b)=>b.quality-a.quality).slice(0,MAX_SOFT_HYPOTHESES);
 for(let candidateIndex=0;candidateIndex<rankedSoft.length;candidateIndex++){
  const candidate=rankedSoft[candidateIndex],uncertain=candidate.readings.map((reading,index)=>({reading,index})).filter(x=>x.reading.alternative!==x.reading.symbol).sort((a,b)=>a.reading.confidence-b.reading.confidence).slice(0,MAX_SOFT_CELLS),variants:number[][]=[];
  for(const x of uncertain)variants.push([x.index]);
  for(let a=0;a<uncertain.length;a++)for(let b=a+1;b<uncertain.length;b++)variants.push([uncertain[a].index,uncertain[b].index]);
  for(let variantIndex=0;variantIndex<variants.length;variantIndex++){
   softAttemptCount++;
   onProgress?.({percent:94+Math.floor((candidateIndex*variants.length+variantIndex+1)/Math.max(1,rankedSoft.length*variants.length)*5),stage:'ecc',detail:`软判决 ${candidateIndex+1}/${rankedSoft.length} · 变体 ${variantIndex+1}/${variants.length}`});
   const symbols=candidate.readings.map(x=>x.symbol);for(const index of variants[variantIndex])symbols[index]=candidate.readings[index].alternative;
   try{const decoded=decodeSymbols(symbols,candidate.hypothesis.radius,candidate.mode,[],candidate.version),readings=candidate.readings.map((x,index)=>variants[variantIndex].includes(index)?{...x,symbol:x.alternative}:x);onProgress?.({percent:100,stage:'ecc',detail:'软判决 ECC 与 CRC 校验成功'});return result(image,candidate.hypothesis,readings,candidate.mode,decoded);}catch(error){last=error instanceof Error?error.message:String(error);}
  }
 }
 const best=hypotheses[0],pitch=estimatedPitch(best.corners,best.radius),densityHint=pitch<8?`；最高分候选约 ${pitch.toFixed(1)} px/格，低于拍屏建议的 10–12 px/格`:'';
 throw new Error(`无法解码：已检查 ${hypotheses.length} 个优先几何组合和 ${softAttemptCount} 个软判决变体；最高分半径 R${best.radius}${densityHint}；${last||'没有匹配的 V1/V2 ECC 或 CRC'}`);
}

function versionsFor(radius:number){const versions:(1|2)[]=[];if(V2.sizes.includes(radius as never))versions.push(2);if(V1.sizes.includes(radius as never))versions.push(1);return versions;}
function estimatedPitch(corners:Pt[],radius:number){const spanX=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),spanY=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));return Math.min(spanX/(2*radius),spanY/(SQRT3*radius));}

function rankHypotheses(image:ImageData,candidates:Pt[][],onProgress?:(fraction:number,detail:string)=>void){
 const work=candidates.length*SUPPORTED_SIZES.length*12,hypotheses:Hypothesis[]=[];let done=0;
 for(let candidateIndex=0;candidateIndex<candidates.length;candidateIndex++){
  const corners=candidates[candidateIndex];
  for(const radius of SUPPORTED_SIZES){
   const pitch=estimatedPitch(corners,radius);
   for(let mirror=0;mirror<2;mirror++)for(let shift=0;shift<6;shift++){
    done++;if(done%8===0)onProgress?.(done/work,`校准候选 ${candidateIndex+1}/${candidates.length} · R${radius}`);
    if(pitch<3.2)continue;
    try{const h=hypothesisHomography(corners,radius,shift,mirror,.36),calibration=calibrate(image,h,radius);hypotheses.push({corners,h,radius,candidateIndex,shift,mirror,calibration});}catch{}
   }
  }
 }
 hypotheses.sort((a,b)=>b.calibration.score-a.calibration.score);
 const refined:Hypothesis[]=[];for(const seed of hypotheses.slice(0,14))for(const offset of [.18,.27,.45,.54,.68])try{const h=hypothesisHomography(seed.corners,seed.radius,seed.shift,seed.mirror,offset),calibration=calibrate(image,h,seed.radius);refined.push({...seed,h,calibration});}catch{}
 onProgress?.(1,`已排序 ${hypotheses.length} 个校准组合并微调 ${refined.length} 个几何尺度`);
 return hypotheses.concat(refined).sort((a,b)=>b.calibration.score-a.calibration.score);
}

function hypothesisHomography(corners:Pt[],radius:number,shift:number,mirror:number,borderOffset:number){const canonical=[{x:1,y:.5},{x:.25,y:1},{x:0,y:.5},{x:.75,y:0}],inner=inset(corners,radius,borderOffset),ordered=(i:number)=>inner[(mirror?shift-i+12:shift+i+6)%6];return solveHomography(canonical,[ordered(0),ordered(2),ordered(3),ordered(5)]);}

function calibrate(image:ImageData,h:number[],radius:number):Calibration{
 const cells=calibrationCells(radius).sort((a,b)=>Math.atan2(a.v,a.u)-Math.atan2(b.v,b.u)),groups:RefSample[][]=[[],[],[],[]],markerDeltas:number[][]=[[],[]];
 for(let i=0;i<cells.length;i++){const point=toNorm(cells[i],radius),color=sampleAnnulus(image,h,point,radius),center=pixel(image,project(h,point)),outerLum=.2126*color.r+.7152*color.g+.0722*color.b,centerLum=.2126*center.r+.7152*center.g+.0722*center.b;groups[(i%8)>>1].push({point,color});markerDeltas[i&1].push(Math.abs(centerLum-outerLum));}
 const centers=groups.map(group=>mean(group.map(x=>x.color))),within=groups.reduce((sum,group,index)=>sum+group.reduce((s,x)=>s+distance(x.color,centers[index]),0),0)/Math.max(1,cells.length);let separation=Infinity;
 for(let a=0;a<centers.length;a++)for(let b=a+1;b<centers.length;b++)separation=Math.min(separation,distance(centers[a],centers[b]));
 const unmarked=medianNumber(markerDeltas[0]),marked=medianNumber(markerDeltas[1]),markerThreshold=Math.max(12,Math.min(85,(unmarked+marked)/2)),markerScale=Math.max(12,marked-unmarked);
 return{groups,centers,score:separation/(within+.006),markerThreshold,markerScale};
}

function result(image:ImageData,hypothesis:Hypothesis,readings:CellReading[],mode:DensityMode,decoded:ReturnType<typeof decodeSymbols>):DecodeImageResult{return{text:decoded.text,bytes:decoded.bytes,corners:hypothesis.corners,readings,radius:hypothesis.radius,mode,profile:decoded.profile,version:decoded.version,meanConfidence:readings.reduce((sum,x)=>sum+x.confidence,0)/Math.max(1,readings.length),imageWidth:image.width,imageHeight:image.height};}
function toNorm(cell:Cell,radius:number){return{x:.5+cell.u/(2*radius),y:.5+cell.v/(SQRT3*radius)};}
function pixel(image:ImageData,p:Pt):RGB{const x=Math.max(0,Math.min(image.width-1.001,p.x)),y=Math.max(0,Math.min(image.height-1.001,p.y)),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(image.width-1,x0+1),y1=Math.min(image.height-1,y0+1),tx=x-x0,ty=y-y0,at=(xx:number,yy:number,channel:number)=>image.data[4*(yy*image.width+xx)+channel],sample=(channel:number)=>at(x0,y0,channel)*(1-tx)*(1-ty)+at(x1,y0,channel)*tx*(1-ty)+at(x0,y1,channel)*(1-tx)*ty+at(x1,y1,channel)*tx*ty;return{r:sample(0),g:sample(1),b:sample(2)};}
function medianColor(samples:RGB[]){const channel=(key:keyof RGB)=>{const values=samples.map(x=>x[key]).sort((a,b)=>a-b),middle=values.length>>1;return values.length%2?values[middle]:(values[middle-1]+values[middle])/2;};return{r:channel('r'),g:channel('g'),b:channel('b')};}
function medianNumber(samples:number[]){const values=[...samples].sort((a,b)=>a-b),middle=values.length>>1;return values.length%2?values[middle]:(values[middle-1]+values[middle])/2;}
function sampleAnnulus(image:ImageData,h:number[],p:Pt,radius:number){const samples:RGB[]=[];for(const ring of [.15,.21])for(let i=0;i<8;i++){const angle=(i+(ring>.15?.5:0))*Math.PI/4,d=ring/radius;samples.push(pixel(image,project(h,{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d})));}return medianColor(samples);}
function sampleCenter(image:ImageData,h:number[],p:Pt,radius:number){const samples=[pixel(image,project(h,p))];for(let i=0;i<4;i++){const angle=i*Math.PI/2,d=.045/radius;samples.push(pixel(image,project(h,{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d})));}return medianColor(samples);}
function localCenters(p:Pt,calibration:Calibration){return calibration.groups.map((group,index)=>{let nearest=group[0],best=Infinity;for(const sample of group){const d=(sample.point.x-p.x)**2+(sample.point.y-p.y)**2;if(d<best){best=d;nearest=sample;}}const global=calibration.centers[index],local=nearest?.color??global,blend=.42*Math.max(0,1-Math.sqrt(best)*1.8);return{r:global.r*(1-blend)+local.r*blend,g:global.g*(1-blend)+local.g*blend,b:global.b*(1-blend)+local.b*blend};});}
function classify(image:ImageData,h:number[],cell:Cell,radius:number,mode:DensityMode,calibration:Calibration):CellReading{
 const p=toNorm(cell,radius),outer=sampleAnnulus(image,h,p,radius),centers=localCenters(p,calibration),distances=centers.map(x=>distance(outer,x)),order=[0,1,2,3].sort((a,b)=>distances[a]-distances[b]),center=mode==='dense'?sampleCenter(image,h,p,radius):pixel(image,project(h,p)),annLum=.2126*outer.r+.7152*outer.g+.0722*outer.b,cenLum=.2126*center.r+.7152*center.g+.0722*center.b,markerDelta=Math.abs(cenLum-annLum),marked=markerDelta>calibration.markerThreshold,color=order[0],colorConfidence=Math.min(1,marginRatio(distances,order)*3),markerConfidence=Math.min(1,Math.abs(markerDelta-calibration.markerThreshold)/(calibration.markerScale*.55)),symbol=mode==='dense'?color*2+(marked?1:0):color;
 const colorAlternative=mode==='dense'?order[1]*2+(marked?1:0):order[1],markerAlternative=mode==='dense'?color*2+(marked?0:1):colorAlternative,alternative=mode==='dense'&&markerConfidence<colorConfidence?markerAlternative:colorAlternative,confidence=Math.max(0,mode==='dense'?Math.min(colorConfidence,markerConfidence):colorConfidence);
 return{point:project(h,p),symbol,alternative,confidence};
}
function marginRatio(distances:number[],order:number[]){return(distances[order[1]]-distances[order[0]])/(distances[order[1]]+.01);}
function inset(points:Pt[],radius:number,borderOffset=.36){const cx=points.reduce((s,p)=>s+p.x,0)/6,cy=points.reduce((s,p)=>s+p.y,0)/6,f=radius/(radius+borderOffset);return points.map(p=>({x:cx+(p.x-cx)*f,y:cy+(p.y-cy)*f}));}

export function debugRead(image:ImageData,corners:Pt[],radius:number,mode:DensityMode,shift:number,mirror=0){const canonical=[{x:1,y:.5},{x:.25,y:1},{x:0,y:.5},{x:.75,y:0}],inner=inset(corners,radius),ordered=(i:number)=>inner[(mirror?shift-i+12:shift+i+6)%6],h=solveHomography(canonical,[ordered(0),ordered(2),ordered(3),ordered(5)]),calibration=calibrate(image,h,radius);return{centers:calibration.centers,readings:payloadCells(radius).map(cell=>classify(image,h,cell,radius,mode,calibration))};}
