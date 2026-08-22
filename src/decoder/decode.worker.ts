/// <reference lib="webworker" />

import {decodeImage} from './decodeImage';

type Request={id:number;file:Blob};
type WorkerMessage=
  |{type:'phase';id:number;phase:'loading'|'decoding'}
  |{type:'result';id:number;result:ReturnType<typeof decodeImage>}
  |{type:'error';id:number;message:string};

const workerScope=self as DedicatedWorkerGlobalScope;

workerScope.onmessage=async(event:MessageEvent<Request>)=>{
 const{id,file}=event.data;
 const send=(message:WorkerMessage)=>workerScope.postMessage(message);
 try{
  send({type:'phase',id,phase:'loading'});
  const bitmap=await createImageBitmap(file);
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('无法创建图片解码画布');
  context.drawImage(bitmap,0,0);
  bitmap.close();
  const image=context.getImageData(0,0,canvas.width,canvas.height);
  send({type:'phase',id,phase:'decoding'});
  send({type:'result',id,result:decodeImage(image)});
 }catch(error){
  send({type:'error',id,message:error instanceof Error?error.message:String(error)});
 }
};

export {};
