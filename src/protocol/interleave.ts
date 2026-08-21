function gcd(a:number,b:number){while(b)[a,b]=[b,a%b];return a;}
export function permutation(n:number,seed:number){if(n<2)return [0];let step=(seed|1)%n;while(gcd(step,n)!==1)step=(step+2)%n||1;const start=(seed*2654435761>>>0)%n;return Array.from({length:n},(_,i)=>(start+i*step)%n);}
export function interleave<T>(a:T[],seed:number){const p=permutation(a.length,seed),out=new Array<T>(a.length);for(let i=0;i<a.length;i++)out[p[i]]=a[i];return out;}
export function deinterleave<T>(a:T[],seed:number){const p=permutation(a.length,seed),out=new Array<T>(a.length);for(let i=0;i<a.length;i++)out[i]=a[p[i]];return out;}

