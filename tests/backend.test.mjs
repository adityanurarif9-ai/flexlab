import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startFlexLab,outputDimensions} from '../server/server.mjs';
import {createComfy,fillWorkflow,imageBuffer,outputDescriptor} from '../server/comfy.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const env={NODE_ENV:'test'};
test('workflow values keep their types; unsafe media and malformed inputs are refused',()=>{
  const template={'1':{class_type:'Test',inputs:{image:'{{FLEXLAB_IMAGE}}',text:'{{FLEXLAB_PROMPT}}',seed:'{{FLEXLAB_SEED}}'}}};
  const filled=fillWorkflow(template,{IMAGE:'uploaded.png',PROMPT:'blue scene',SEED:42});assert.equal(filled['1'].inputs.seed,42);assert.equal(filled['1'].inputs.image,'uploaded.png');assert.throws(()=>fillWorkflow({nodes:[]},{}));assert.throws(()=>imageBuffer(png.toString('base64'),'image/jpeg'));assert.deepEqual(imageBuffer(png.toString('base64'),'image/png'),png);assert.equal(outputDescriptor({filename:'../../secret.png'}),null);assert.equal(outputDescriptor({filename:'image.png',subfolder:'../secret'}),null);assert.equal(outputDescriptor({filename:'movie.mp4',type:'output'}).kind,'video');assert.deepEqual(outputDimensions('4:5','image'),{width:512,height:640});assert.throws(()=>outputDimensions('bad','image'));
});
test('offline ComfyUI never reports generation ready and refuses jobs',async()=>{
  const comfy=createComfy({fetchImpl:async()=>{throw Error('offline')}});const status=await comfy.status();assert.equal(status.online,false);assert.equal(status.ready.image,false);assert.equal(status.ready.video,false);await assert.rejects(()=>comfy.submit({mode:'video'}),error=>error.status===503);assert.throws(()=>createComfy({baseURL:'https://remote.example'}));
});
test('accounts require real email verification, protect sessions and isolate generated outputs',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'flexlab-auth-test-')),mail=[];let submits=0;
  // This fake engine is confined to tests. The application has no simulated generator.
  const comfy={status:async()=>({online:true,ready:{image:true,video:false},notes:{}}),submit:async()=>`test-${++submits}`,history:async()=>({state:'completed',outputs:[{filename:'test.png',ext:'.png',mime:'image/png',kind:'image',type:'output'}]}),download:async()=>png};
  const app=await startFlexLab({root,dataDir,port:0,env,sendMail:async message=>mail.push(message),comfy});t.after(async()=>{await app.close();fs.rmSync(dataDir,{recursive:true,force:true})});
  async function request(route,body,cookie,extra={}){const response=await fetch(app.url+route,{method:body?'POST':'GET',redirect:'manual',headers:{...(body?{'content-type':'application/json',origin:app.url,'x-flexlab-request':'1'}:{}),...(cookie?{cookie}:{}),...extra},body:body?JSON.stringify(body):undefined});return response}
  async function signup(username,email){const response=await request('/api/auth/sign-up/email',{username,name:username,email,password:'TestOnly-password-893!',callbackURL:app.url+'/login.html?verified=1'});assert.equal(response.status,200,await response.text());}
  async function login(username){return request('/api/auth/sign-in/username',{username,password:'TestOnly-password-893!'})}
  async function verify(email){const message=mail.findLast(m=>m.to===email&&m.subject.includes('Verifikasi'));assert.ok(message);const link=message.text.match(/https?:\/\/[^\s]+/)[0];const response=await fetch(link,{redirect:'manual'});assert.equal(response.status,302);assert.ok(response.headers.get('location')==='/'||response.headers.get('location').includes('verified=1'),response.headers.get('location'));}
  assert.equal((await request('/')).status,302);assert.equal((await request('/api/jobs')).status,401);
  await signup('reviewer_a','a@example.test');const unverified=await login('reviewer_a');assert.equal(unverified.status,403);assert.equal((await unverified.json()).code,'EMAIL_NOT_VERIFIED');await verify('a@example.test');
  const first=await login('reviewer_a');assert.equal(first.status,200,await first.clone().text());const cookie=first.headers.getSetCookie().map(line=>line.split(';')[0]).join('; ');assert.ok(cookie.includes('session_token'));
  const me=await (await request('/api/me',null,cookie)).json();assert.equal(me.user.emailVerified,true);assert.equal(me.user.username,'reviewer_a');
  const bad=await request('/api/auth/sign-in/username',{username:'reviewer_a',password:'wrong-password'});assert.equal(bad.status,401);
  const body={mode:'image',preset:52,ratio:'4:5',image:png.toString('base64'),mime:'image/png'};
  assert.equal((await request('/api/jobs',body,cookie,{origin:'https://untrusted.example'})).status,403);
  const submitted=await request('/api/jobs',body,cookie);assert.equal(submitted.status,201,await submitted.clone().text());const job=(await submitted.json()).job;assert.equal(job.status,'queued');
  const completed=(await (await request('/api/jobs/'+job.id,null,cookie)).json()).job;assert.equal(completed.status,'completed');const output=await request(completed.outputs[0].url,null,cookie);assert.equal(output.status,200);assert.deepEqual(Buffer.from(await output.arrayBuffer()),png);
  await signup('reviewer_b','b@example.test');await verify('b@example.test');const second=await login('reviewer_b');const otherCookie=second.headers.getSetCookie().map(line=>line.split(';')[0]).join('; ');
  assert.equal((await request('/api/jobs/'+job.id,null,otherCookie)).status,404);assert.equal((await request(completed.outputs[0].url,null,otherCookie)).status,404);assert.deepEqual((await (await request('/api/jobs',null,otherCookie)).json()).jobs,[]);
  for(const route of ['/.env','/.flexlab/flexlab.sqlite','/.workflows/image.json','/server/auth.mjs','/api/dev/mail','/dev-mail.html'])assert.equal((await request(route,null,cookie)).status,404,route);
  // Reset links also use Better Auth's actual one-time token validation.
  assert.equal((await request('/api/auth/request-password-reset',{email:'a@example.test',redirectTo:app.url+'/login.html?reset=1'})).status,200);const resetMail=mail.findLast(m=>m.subject.includes('Atur ulang'));assert.ok(resetMail);const resetLink=resetMail.text.match(/https?:\/\/[^\s]+/)[0];const redirect=await fetch(resetLink,{redirect:'manual'});assert.equal(redirect.status,302);const token=new URL(redirect.headers.get('location'),app.url).searchParams.get('token');assert.ok(token);assert.equal((await request('/api/auth/reset-password',{token,newPassword:'New-test-password-984!'})).status,200);assert.equal((await request('/api/auth/reset-password',{token,newPassword:'Another-test-password-984!'})).status,400);
  assert.equal((await (await request('/api/me',null,cookie)).json()).user,null);
  assert.equal((await request('/api/auth/sign-out',{},otherCookie)).status,200);assert.equal((await request('/api/jobs',null,otherCookie)).status,401);
});
test('mail setup is honest; development inbox requires explicit local mode',async t=>{
  const directories=[],apps=[];t.after(async()=>{for(const app of apps)await app.close();for(const dir of directories)fs.rmSync(dir,{recursive:true,force:true})});
  async function start(preview){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flexlab-mail-test-'));directories.push(dir);const app=await startFlexLab({root,dataDir:dir,port:0,env,preview});apps.push(app);return app}
  const normal=await start(false);const status=await (await fetch(normal.url+'/api/status')).json();assert.equal(status.mailReady,false);assert.equal(status.mailMode,'unconfigured');assert.equal((await fetch(normal.url+'/api/dev/mail')).status,404);assert.equal((await fetch(normal.url+'/api/auth/sign-up/email',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,503);
  const preview=await start(true);assert.equal((await (await fetch(preview.url+'/api/status')).json()).mailMode,'preview');assert.equal((await fetch(preview.url+'/api/dev/mail')).status,200);
});
