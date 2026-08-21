export type Cell={u:number;v:number;q:number;r:number};
export function hexCells(radius:number):Cell[]{const a:Cell[]=[];for(let q=-radius;q<=radius;q++)for(let r=Math.max(-radius,-q-radius);r<=Math.min(radius,-q+radius);r++)a.push({u:q+r/2,v:Math.sqrt(3)*r/2,q,r});return a;}
export function cellCount(radius:number){return 1+3*radius*(radius+1);}
export function ringDistance(q:number,r:number){return Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));}
export function payloadCells(radius:number){return hexCells(radius).filter(c=>ringDistance(c.q,c.r)<radius-1);}
export function calibrationCells(radius:number){const ring=radius-1;return hexCells(radius).filter(c=>ringDistance(c.q,c.r)===ring);}
