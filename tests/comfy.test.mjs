import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createComfy} from '../server/comfy.mjs';

test('connector uploads the actual reference, submits typed API inputs and retrieves a video output',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flexlab-comfy-contract-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'video.json');fs.writeFileSync(file,JSON.stringify({'1':{class_type:'ReferenceVideo',inputs:{image:'{{FLEXLAB_IMAGE}}',text:'{{FLEXLAB_PROMPT}}',frames:'{{FLEXLAB_FRAMES}}',seed:'{{FLEXLAB_SEED}}'}}}));
  const bytes=Buffer.from('reference photo fixture'),video=Buffer.from('video output fixture');let submitted,uploaded=false;
  const fetchImpl=async(input,options)=>{const url=new URL(input);assert.equal(url.hostname,'127.0.0.1');assert.equal(options.redirect,'error');
    if(url.pathname==='/system_stats')return Response.json({devices:[{name:'test GPU'}]});
    if(url.pathname==='/object_info')return Response.json({ReferenceVideo:{}});
    if(url.pathname==='/upload/image'){const image=options.body.get('image');assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);assert.equal(image.type,'image/png');uploaded=true;return Response.json({name:'reference.png',subfolder:'products'})}
    if(url.pathname==='/prompt'){assert.equal(uploaded,true);submitted=JSON.parse(options.body);return Response.json({prompt_id:'actual-local-job'})}
    if(url.pathname==='/history/actual-local-job')return Response.json({'actual-local-job':{status:{completed:true,status_str:'success'},outputs:{'2':{gifs:[{filename:'result.mp4',subfolder:'ads',type:'output'}]}}}});
    if(url.pathname==='/view'){assert.equal(url.searchParams.get('filename'),'result.mp4');assert.equal(url.searchParams.get('type'),'output');return new Response(video)}
    throw Error('Unexpected route '+url.pathname);
  };
  const comfy=createComfy({videoWorkflow:file,fetchImpl});const status=await comfy.status();assert.equal(status.ready.video,true,JSON.stringify(status));assert.equal(status.ready.image,false);
  const id=await comfy.submit({mode:'video',bytes,mime:'image/png',prompt:'Keep the uploaded product, blue background',width:384,height:480,duration:4});assert.equal(id,'actual-local-job');const inputs=submitted.prompt['1'].inputs;assert.equal(inputs.image,'products/reference.png');assert.equal(inputs.frames,49);assert.equal(typeof inputs.seed,'number');assert.ok(inputs.text.includes('uploaded product'));
  const result=await comfy.history(id);assert.equal(result.state,'completed');assert.equal(result.outputs[0].kind,'video');assert.deepEqual(await comfy.download(result.outputs[0]),video);
});
test('missing or unreachable node registry blocks readiness instead of claiming AI is ready',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flexlab-node-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'image.json');fs.writeFileSync(file,JSON.stringify({'1':{class_type:'MissingNode',inputs:{image:'{{FLEXLAB_IMAGE}}',prompt:'{{FLEXLAB_PROMPT}}'}}}));
  for(const unreachable of [false,true]){const comfy=createComfy({imageWorkflow:file,fetchImpl:async url=>{if(url.endsWith('/system_stats'))return Response.json({});if(unreachable)throw Error('offline');return Response.json({})}});const status=await comfy.status();assert.equal(status.online,true);assert.equal(status.ready.image,false);}
});
