import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

export class PublicError extends Error{constructor(message,status=400){super(message);this.status=status}}
const tokens=['IMAGE','PROMPT','NEGATIVE','SEED','WIDTH','HEIGHT','FPS','FRAMES','DURATION'];
export function fillWorkflow(template,values){
  const serialized=JSON.stringify(template);
  for(const required of ['IMAGE','PROMPT'])if(!serialized.includes(`{{FLEXLAB_${required}}}`))throw new PublicError(`Workflow harus memiliki placeholder ${required}.`,503);
  function visit(value){
    if(typeof value==='string'){
      const m=value.match(/^\{\{FLEXLAB_([A-Z]+)\}\}$/);if(m){if(!tokens.includes(m[1])||values[m[1]]===undefined)throw new PublicError('Placeholder workflow tidak dikenal.',503);return values[m[1]];}
      return value.replace(/\{\{FLEXLAB_([A-Z]+)\}\}/g,(_,key)=>{if(!tokens.includes(key)||values[key]===undefined)throw new PublicError('Placeholder workflow tidak dikenal.',503);return String(values[key])});
    }
    if(Array.isArray(value))return value.map(visit);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,visit(item)]));
    return value;
  }
  if(!template||Array.isArray(template)||!Object.values(template).every(n=>n&&typeof n.class_type==='string'&&n.inputs&&typeof n.inputs==='object'))throw new PublicError('Gunakan workflow ComfyUI format API, bukan format editor.',503);
  return visit(template);
}
export function imageBuffer(data,mime){
  if(typeof data!=='string'||data.length>28*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new PublicError('Foto tidak valid atau terlalu besar.');
  const bytes=Buffer.from(data,'base64');if(bytes.length<16||bytes.length>20*1024*1024)throw new PublicError('Ukuran foto maksimal 20 MB.');
  const detected=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!detected||mime!==detected)throw new PublicError('Gunakan foto JPG, PNG, atau WebP yang valid.');return bytes;
}
export function outputDescriptor(value){
  if(!value||typeof value.filename!=='string'||/[\\/\x00-\x1f]/.test(value.filename)||value.filename==='.'||value.filename==='..')return null;
  const subfolder=String(value.subfolder||'').replaceAll('\\','/');if(subfolder.split('/').some(p=>p==='.'||p==='..')||subfolder.startsWith('/')||subfolder.includes(':'))return null;
  const ext=path.extname(value.filename).toLowerCase();const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm'}[ext];
  if(!mime||value.type&&value.type!=='output')return null;return {filename:value.filename,subfolder,type:'output',ext,mime,kind:mime.startsWith('video/')?'video':'image'};
}
export function createComfy({baseURL='http://127.0.0.1:8188',imageWorkflow,videoWorkflow,fetchImpl=fetch}){
  const base=new URL(baseURL);if(!['http:','https:'].includes(base.protocol)||!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.username||base.password||base.search||base.hash)throw Error('COMFYUI_URL harus alamat localhost, tanpa kredensial.');
  const endpointBase=base.origin+base.pathname.replace(/\/$/,'');
  const files={image:imageWorkflow,video:videoWorkflow};let cache=null,cacheTime=0;
  async function request(endpoint,options={},timeout=8000){
    const response=await fetchImpl(endpointBase+endpoint,{...options,redirect:'error',signal:AbortSignal.timeout(timeout)});
    if(!response.ok){const message=await response.text().catch(()=>'');throw new PublicError(endpoint==='/prompt'?'Workflow atau model belum siap. Periksa konfigurasi ComfyUI.':'ComfyUI tidak dapat menyelesaikan permintaan.',502);}
    return response;
  }
  function template(mode){const file=files[mode];if(!file||!fs.existsSync(file))throw new PublicError(`Workflow ${mode==='video'?'video':'gambar'} belum dikonfigurasi.`,503);let json;try{json=JSON.parse(fs.readFileSync(file,'utf8'))}catch{throw new PublicError('Berkas workflow tidak valid.',503)};fillWorkflow(json,{IMAGE:'check.png',PROMPT:'check',NEGATIVE:'',SEED:1,WIDTH:512,HEIGHT:640,FPS:12,FRAMES:49,DURATION:4});return json;}
  async function status(force=false){
    if(!force&&cache&&Date.now()-cacheTime<5000)return cache;
    const workflows={image:false,video:false};const notes={};for(const mode of ['image','video']){try{template(mode);workflows[mode]=true}catch(e){notes[mode]=e.message}}
    let online=false,device=null,classes=null;
    try{const stats=await (await request('/system_stats',{},2500)).json();device=stats.devices?.[0]?.name||'Perangkat lokal';online=true;if(workflows.image||workflows.video)classes=await (await request('/object_info',{},3000)).json();}
    catch{if(online)for(const mode of ['image','video'])if(workflows[mode]){workflows[mode]=false;notes[mode]='Daftar node ComfyUI belum dapat diperiksa. Coba koneksi lagi.'}}
    if(classes)for(const mode of ['image','video'])if(workflows[mode]){const missing=[...new Set(Object.values(template(mode)).map(x=>x.class_type))].filter(x=>!classes[x]);if(missing.length){workflows[mode]=false;notes[mode]='Node workflow belum tersedia: '+missing.slice(0,3).join(', ');}}
    cache={online,device,workflows,ready:{image:online&&workflows.image,video:online&&workflows.video},notes,message:online?'ComfyUI terhubung.':'ComfyUI belum berjalan di PC ini. Model belum diunduh oleh FlexLab.'};cacheTime=Date.now();return cache;
  }
  async function submit({bytes,mime,mode,prompt,width,height,duration}){
    const ready=await status(true);if(!ready.ready[mode])throw new PublicError(ready.notes[mode]||ready.message,503);
    const extension=mime==='image/png'?'png':mime==='image/jpeg'?'jpg':'webp';const inputName=`flexlab-${randomBytes(16).toString('hex')}.${extension}`;
    const form=new FormData();form.append('image',new Blob([bytes],{type:mime}),inputName);form.append('overwrite','false');
    const upload=await (await request('/upload/image',{method:'POST',body:form},15000)).json();
    if(typeof upload.name!=='string'||/[\\/\x00]/.test(upload.name))throw new PublicError('ComfyUI tidak menerima foto.',502);
    const subfolder=String(upload.subfolder||'').replaceAll('\\','/');if(subfolder.includes('..')||subfolder.startsWith('/')||subfolder.includes(':'))throw new PublicError('Lokasi foto dari ComfyUI tidak valid.',502);
    const input=subfolder?`${subfolder}/${upload.name}`:upload.name;
    const workflow=fillWorkflow(template(mode),{IMAGE:input,PROMPT:prompt,NEGATIVE:'different product, distorted logo, unreadable label, duplicate product, watermark, bad proportions',SEED:randomBytes(4).readUInt32LE(0),WIDTH:width,HEIGHT:height,FPS:12,FRAMES:duration*12+1,DURATION:duration});
    const submitted=await (await request('/prompt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:workflow,client_id:randomBytes(16).toString('hex')})},15000)).json();
    if(submitted.error||!submitted.prompt_id)throw new PublicError('Workflow ditolak ComfyUI. Periksa model dan node yang diperlukan.',502);return String(submitted.prompt_id);
  }
  async function history(promptId){const data=await (await request('/history/'+encodeURIComponent(promptId),{},6000)).json();const entry=data[promptId];if(!entry)return {state:'running'};if(entry.status?.status_str==='error')return {state:'error',message:'ComfyUI gagal menjalankan workflow. Periksa model, node, dan kapasitas GPU.'};
    const outputs=[];for(const value of Object.values(entry.outputs||{}))for(const key of ['images','videos','gifs'])for(const item of value[key]||[]){const safe=outputDescriptor(item);if(safe)outputs.push(safe)}
    if(!outputs.length)return entry.status?.completed?{state:'error',message:'Workflow selesai tanpa berkas hasil yang dapat diunduh.'}:{state:'running'};return {state:'completed',outputs:outputs.slice(0,4)};
  }
  async function download(output){const safe=outputDescriptor(output);if(!safe)throw new PublicError('Berkas hasil tidak valid.',502);const query=new URLSearchParams({filename:safe.filename,subfolder:safe.subfolder,type:'output'});const response=await request('/view?'+query,{},30000);
    const length=Number(response.headers.get('content-length'));if(length>100*1024*1024)throw new PublicError('Hasil terlalu besar untuk disimpan.',502);
    const reader=response.body.getReader();const chunks=[];let total=0;for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>100*1024*1024){await reader.cancel();throw new PublicError('Hasil terlalu besar.',502)}chunks.push(value)}return Buffer.concat(chunks);
  }
  return {status,submit,history,download};
}
