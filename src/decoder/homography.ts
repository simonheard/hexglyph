export type Pt={x:number;y:number};
export function solveHomography(src:Pt[],dst:Pt[]){const a:number[][]=[];for(let i=0;i<4;i++){const{x,y}=src[i],{x:u,y:v}=dst[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u]);a.push([0,0,0,x,y,1,-v*x,-v*y,v]);}for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;[a[c],a[p]]=[a[p],a[c]];const d=a[c][c];if(Math.abs(d)<1e-9)throw new Error('退化边界');for(let j=c;j<9;j++)a[c][j]/=d;for(let r=0;r<8;r++)if(r!==c){const f=a[r][c];for(let j=c;j<9;j++)a[r][j]-=f*a[c][j];}}return [...a.map((r,i)=>r[8]),1];}
export function project(h:number[],p:Pt):Pt{const z=h[6]*p.x+h[7]*p.y+1;return{x:(h[0]*p.x+h[1]*p.y+h[2])/z,y:(h[3]*p.x+h[4]*p.y+h[5])/z};}

