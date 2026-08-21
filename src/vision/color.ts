export type RGB={r:number;g:number;b:number};
export function oklab(c:RGB){const f=(x:number)=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};const r=f(c.r),g=f(c.g),b=f(c.b),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return[.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
export function distance(a:RGB,b:RGB){const x=oklab(a),y=oklab(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);}
export function mean(samples:RGB[]){const n=samples.length||1;return{r:samples.reduce((s,x)=>s+x.r,0)/n,g:samples.reduce((s,x)=>s+x.g,0)/n,b:samples.reduce((s,x)=>s+x.b,0)/n};}

