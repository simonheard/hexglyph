import type {DecodeImageResult,DecodeProgress} from './decodeImage';

type Message=
 |{type:'progress';id:number;progress:DecodeProgress}
 |{type:'result';id:number;result:DecodeImageResult}
 |{type:'error';id:number;message:string};

export type DecodeJob={promise:Promise<DecodeImageResult>;cancel:()=>void};

let nextId=1;

export function canDecodeInWorker(){return typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap!=='undefined';}

export function startDecodeWorker(file:Blob,onProgress:(progress:DecodeProgress)=>void):DecodeJob{
 const id=nextId++,worker=new Worker(new URL('./decode.worker.ts',import.meta.url),{type:'module'});
 let rejectJob:(reason?:unknown)=>void=()=>{},settled=false;
 const finish=()=>{if(!settled){settled=true;worker.terminate();}};
 const promise=new Promise<DecodeImageResult>((resolve,reject)=>{
  rejectJob=reject;
  worker.onmessage=(event:MessageEvent<Message>)=>{
   const message=event.data;
   if(message.id!==id||settled)return;
   if(message.type==='progress'){onProgress(message.progress);return;}
   finish();
   if(message.type==='result')resolve(message.result);
   else reject(new Error(message.message));
  };
  worker.onerror=event=>{finish();reject(new Error(event.message||'后台解码进程异常'));};
  worker.postMessage({id,file});
 });
 return{promise,cancel:()=>{if(settled)return;finish();rejectJob(new DOMException('Decode cancelled','AbortError'));}};
}
