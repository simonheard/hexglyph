/// <reference lib="webworker" />

import {decodeImage,type DecodeProgress} from './decodeImage';

type Request={id:number;file:Blob};
type WorkerMessage=
  |{type:'progress';id:number;progress:DecodeProgress}
  |{type:'result';id:number;result:ReturnType<typeof decodeImage>}
  |{type:'error';id:number;message:string};

const workerScope=self as DedicatedWorkerGlobalScope;

workerScope.onmessage=async(event:MessageEvent<Request>)=>{
 const{id,file}=event.data;
 const send=(message:WorkerMessage)=>workerScope.postMessage(message);
 try{
  send({type:'progress',id,progress:{percent:1,stage:'loading',detail:'读取图片像素'}});
  const bitmap=await createImageBitmap(file);
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('无法创建图片解码画布');
  context.drawImage(bitmap,0,0);
  bitmap.close();
  const image=context.getImageData(0,0,canvas.width,canvas.height);
  let lastUpdate=0;
  const report=(progress:DecodeProgress)=>{const now=performance.now();if(progress.percent===100||now-lastUpdate>55){lastUpdate=now;send({type:'progress',id,progress});}};
  send({type:'result',id,result:decodeImage(image,report)});
 }catch(error){
  send({type:'error',id,message:error instanceof Error?error.message:String(error)});
 }
};

export {};
