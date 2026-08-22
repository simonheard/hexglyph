import type {Pt} from './homography';

const lum=(d:Uint8ClampedArray,i:number)=>.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
type Candidate={corners:Pt[];score:number;cx:number;cy:number;area:number};

export function detectHex(image:ImageData):Pt[]{return detectHexCandidates(image)[0];}

export function detectHexCandidates(image:ImageData,onProgress?:(fraction:number,detail:string)=>void):Pt[][]{
 const{width:w,height:h,data}=image,scale=Math.max(1,Math.ceil(Math.max(w,h)/720)),sw=Math.ceil(w/scale),sh=Math.ceil(h/scale),values=new Float32Array(sw*sh),hist=new Uint32Array(256);
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
  let sum=0,count=0;
  for(let yy=y*scale;yy<Math.min(h,(y+1)*scale);yy++)for(let xx=x*scale;xx<Math.min(w,(x+1)*scale);xx++){sum+=lum(data,4*(yy*w+xx));count++;}
  const value=sum/count;values[y*sw+x]=value;hist[Math.max(0,Math.min(255,Math.round(value)))]++;
 }
 onProgress?.(.22,'分析亮度分布');
 const low=percentile(hist,.01),high=percentile(hist,.99),candidates:Candidate[]=[],thresholds=[.22,.32,.42,.52,.62];
 thresholds.forEach((fraction,index)=>{collect(values,sw,sh,scale,low+(high-low)*fraction,candidates);onProgress?.(.22+.7*(index+1)/thresholds.length,`检测边界阈值 ${index+1}/${thresholds.length}`);});
 candidates.sort((a,b)=>b.score-a.score);
 const unique:Candidate[]=[];
 for(const candidate of candidates){
  const duplicate=unique.some(x=>Math.hypot(x.cx-candidate.cx,x.cy-candidate.cy)<Math.sqrt(candidate.area)*.08&&Math.abs(x.area-candidate.area)/Math.max(x.area,candidate.area)<.18);
  if(!duplicate)unique.push(candidate);
  if(unique.length===6)break;
 }
 if(!unique.length)throw new Error('未检测到高对比六边形边界');
 onProgress?.(1,`找到 ${unique.length} 个候选轮廓`);
 return unique.map(x=>x.corners);
}

function percentile(hist:Uint32Array,p:number){const target=hist.reduce((a,b)=>a+b,0)*p;let sum=0;for(let i=0;i<hist.length;i++){sum+=hist[i];if(sum>=target)return i;}return 255;}

function collect(values:Float32Array,w:number,h:number,scale:number,threshold:number,out:Candidate[]){
 const dark=new Uint8Array(values.length),seen=new Uint8Array(values.length);for(let i=0;i<values.length;i++)dark[i]=values[i]<threshold?1:0;
 const minPixels=Math.max(40,Math.floor(values.length*.00035));
 for(let start=0;start<dark.length;start++){
  if(!dark[start]||seen[start])continue;
  const q=[start];seen[start]=1;let minX=w,maxX=0,minY=h,maxY=0;
  for(let p=0;p<q.length;p++){
   const z=q[p],x=z%w,y=(z/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   if(x>0){const n=z-1;if(dark[n]&&!seen[n]){seen[n]=1;q.push(n);}}
   if(x+1<w){const n=z+1;if(dark[n]&&!seen[n]){seen[n]=1;q.push(n);}}
   if(y>0){const n=z-w;if(dark[n]&&!seen[n]){seen[n]=1;q.push(n);}}
   if(y+1<h){const n=z+w;if(dark[n]&&!seen[n]){seen[n]=1;q.push(n);}}
  }
  const bw=maxX-minX+1,bh=maxY-minY+1,bboxArea=bw*bh,aspect=bw/bh,edgeTouches=Number(minX===0)+Number(minY===0)+Number(maxX===w-1)+Number(maxY===h-1);
  if(q.length<minPixels||bboxArea<values.length*.025||aspect<.42||aspect>2.35||edgeTouches>=2)continue;
  const stride=Math.max(1,Math.floor(q.length/3500)),points:Pt[]=[];
  for(let i=0;i<q.length;i+=stride){const z=q[i];points.push({x:(z%w)*scale,y:((z/w)|0)*scale});}
  const hull=convexHull(points);if(hull.length<6)continue;
  const corners=pickCorners(hull),area=polygonArea(corners),scaledBbox=bboxArea*scale*scale,shape=area/scaledBbox;
  if(shape<.42||shape>.95)continue;
  const cx=corners.reduce((s,p)=>s+p.x,0)/6,cy=corners.reduce((s,p)=>s+p.y,0)/6,shapeScore=1-Math.min(1,Math.abs(shape-.74)/.4),edgePenalty=edgeTouches?.72:1;
  out.push({corners,score:area*(.65+.35*shapeScore)*edgePenalty,cx,cy,area});
 }
}

function pickCorners(hull:Pt[]){
 const cx=hull.reduce((s,p)=>s+p.x,0)/hull.length,cy=hull.reduce((s,p)=>s+p.y,0)/hull.length,angularDistance=(a:number,b:number)=>{const d=Math.abs(a-b)%(Math.PI*2);return Math.min(d,Math.PI*2-d);};
 const ranked=hull.map(p=>({p,a:Math.atan2(p.y-cy,p.x-cx),d:(p.x-cx)**2+(p.y-cy)**2})).sort((a,b)=>b.d-a.d),picked:{p:Pt;a:number}[]=[];
 for(const candidate of ranked){if(picked.every(x=>angularDistance(x.a,candidate.a)>Math.PI/6)){picked.push(candidate);if(picked.length===6)break;}}
 let result=picked.map(x=>x.p);
 if(result.length<6){result=[];for(let j=0;j<6;j++){const a=j*Math.PI/3;let best=hull[0],score=-Infinity;for(const p of hull){const s=(p.x-cx)*Math.cos(a)+(p.y-cy)*Math.sin(a);if(s>score){score=s;best=p;}}result.push(best);}}
 result.sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));return result;
}

function polygonArea(points:Pt[]){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a.x*b.y-b.x*a.y;}return Math.abs(sum)/2;}
function convexHull(ps:Pt[]){const p=[...ps].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(o:Pt,a:Pt,b:Pt)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lo:Pt[]=[],up:Pt[]=[];for(const x of p){while(lo.length>=2&&cross(lo.at(-2)!,lo.at(-1)!,x)<=0)lo.pop();lo.push(x);}for(const x of p.reverse()){while(up.length>=2&&cross(up.at(-2)!,up.at(-1)!,x)<=0)up.pop();up.push(x);}return lo.slice(0,-1).concat(up.slice(0,-1));}
