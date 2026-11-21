import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {toNodeHandler,fromNodeHeaders} from 'better-auth/node';
import {createAccounts} from './auth.mjs';
import {createComfy,imageBuffer,PublicError} from './comfy.mjs';

const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const STATIC=new Set(['index.html','login.html','workspace.css','workspace.js','account.js','brand.js','brand.css','gallery.html','gallery.css','gallery.js','data.json','images.json','assets/flexlab-logo.png','assets/flexlab-symbol.svg','assets/favicon.svg']);
const loopback=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address);
export function outputDimensions(ratio,mode){
  if(!['1:1','4:5','9:16','16:9'].includes(ratio))throw new PublicError('Rasio tidak dikenal.');const [a,b]=ratio.split(':').map(Number),edge=mode==='video'?384:512;
  return a>=b?{width:Math.round(edge*a/b/16)*16,height:edge}:{width:edge,height:Math.round(edge*b/a/16)*16};
}
function json(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value))}
async function readJSON(req,limit=30*1024*1024){
  if(!req.headers['content-type']?.startsWith('application/json'))throw new PublicError('Gunakan JSON.',415);let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw new PublicError('Berkas terlalu besar.',413);chunks.push(chunk)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new PublicError('Permintaan tidak valid.')}
}
export async function startFlexLab({root,dataDir=path.join(root,'.flexlab'),port=Number(process.env.PORT||4317),env=process.env,preview=env.FLEXLAB_DEV_MAILBOX==='1',sendMail,comfy:providedComfy}={}){
  let handler;const server=http.createServer((req,res)=>handler?handler(req,res):json(res,503,{message:'Menyiapkan FlexLab.'}));
  server.requestTimeout=60000;server.headersTimeout=15000;server.maxHeadersCount=100;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
  const localURL=`http://127.0.0.1:${server.address().port}`;const baseURL=(env.BETTER_AUTH_URL||localURL).replace(/\/$/,'');const origin=new URL(baseURL).origin;
  let accounts;
  try{accounts=await createAccounts({dataDir,baseURL,env,preview,sendMail})}catch(e){server.close();throw e}
  const {auth,db}=accounts;const authHandler=toNodeHandler(auth);
  db.exec(`CREATE TABLE IF NOT EXISTS flexlab_jobs (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, mode TEXT NOT NULL, preset TEXT NOT NULL, promptId TEXT, status TEXT NOT NULL, message TEXT, outputs TEXT NOT NULL DEFAULT '[]', createdAt INTEGER NOT NULL, FOREIGN KEY(ownerId) REFERENCES user(id) ON DELETE CASCADE); CREATE INDEX IF NOT EXISTS flexlab_jobs_owner ON flexlab_jobs(ownerId, createdAt);`);
  const comfy=providedComfy||createComfy({baseURL:env.COMFYUI_URL||'http://127.0.0.1:8188',imageWorkflow:env.FLEXLAB_WORKFLOW_IMAGE?path.resolve(root,env.FLEXLAB_WORKFLOW_IMAGE):path.join(root,'.workflows/image.json'),videoWorkflow:env.FLEXLAB_WORKFLOW_VIDEO?path.resolve(root,env.FLEXLAB_WORKFLOW_VIDEO):path.join(root,'.workflows/video.json')});
  const presets=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));const generated=path.join(dataDir,'generated');fs.mkdirSync(generated,{recursive:true});const active=new Map(),submitting=new Set();
  const safeJob=row=>({id:row.id,mode:row.mode,preset:row.preset,status:row.status,message:row.message,createdAt:new Date(row.createdAt).toISOString(),outputs:JSON.parse(row.outputs).map((out,i)=>({kind:out.kind,mime:out.mime,url:`/api/jobs/${row.id}/output/${i}`}))});
  async function session(req){return auth.api.getSession({headers:fromNodeHeaders(req.headers)})}
  async function requireUser(req){const found=await session(req);if(!found?.user)throw new PublicError('Silakan masuk terlebih dahulu.',401);if(!found.user.emailVerified)throw new PublicError('Verifikasi emailmu terlebih dahulu.',403);return found.user;}
  function ownerJob(id,user){const row=db.prepare('SELECT * FROM flexlab_jobs WHERE id=? AND ownerId=?').get(id,user.id);if(!row)throw new PublicError('Hasil tidak ditemukan.',404);return row;}
  async function refreshJob(row){
    if(['completed','error'].includes(row.status))return row;
    if(active.has(row.id))return active.get(row.id);
    const task=(async()=>{
      const result=await comfy.history(row.promptId);
      if(result.state==='error')db.prepare('UPDATE flexlab_jobs SET status=?,message=? WHERE id=?').run('error',result.message,row.id);
      else if(result.state==='completed'){
        const matches=result.outputs.filter(out=>out.kind===row.mode);
        if(!matches.length)db.prepare('UPDATE flexlab_jobs SET status=?,message=? WHERE id=?').run('error','Workflow tidak menghasilkan format yang dipilih. Periksa workflow gambar/video.',row.id);
        else{
          const cached=[];for(const [i,out]of matches.entries()){const bytes=await comfy.download(out);const filename=`${row.id}-${i}${out.ext}`;fs.writeFileSync(path.join(generated,filename),bytes);cached.push({filename,mime:out.mime,kind:out.kind})}
          db.prepare('UPDATE flexlab_jobs SET status=?,outputs=?,message=NULL WHERE id=?').run('completed',JSON.stringify(cached),row.id);
        }
      }else db.prepare('UPDATE flexlab_jobs SET status=? WHERE id=?').run('running',row.id);
      return db.prepare('SELECT * FROM flexlab_jobs WHERE id=?').get(row.id);
    })().finally(()=>active.delete(row.id));active.set(row.id,task);return task;
  }
  handler=async(req,res)=>{
    res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','same-origin');res.setHeader('x-frame-options','DENY');res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try{
      const url=new URL(req.url,baseURL);const route=url.pathname;
      if(req.headers.host!==new URL(baseURL).host&&req.headers.host!==new URL(localURL).host)throw new PublicError('Host tidak diizinkan.',403);
      if(route.startsWith('/api/auth/')){
        // Override untrusted incoming IP headers: this server accepts direct loopback clients only.
        req.headers['x-flexlab-client-ip']=req.socket.remoteAddress;
        if(Number(req.headers['content-length'])>65536)throw new PublicError('Permintaan terlalu besar.',413);
        if(!accounts.mailReady&&['/api/auth/sign-up/email','/api/auth/send-verification-email','/api/auth/request-password-reset'].includes(route))return json(res,503,{code:'EMAIL_NOT_CONFIGURED',message:'Pengiriman email belum diaktifkan. Pengelola perlu mengisi pengaturan SMTP terlebih dahulu.'});
        return await authHandler(req,res);
      }
      if(route==='/api/status'&&req.method==='GET'){
        const found=await session(req);return json(res,200,{mailReady:accounts.mailReady,mailMode:accounts.mailMode,localOnly:true,...(found?.user?.emailVerified?{engine:await comfy.status(url.searchParams.has('refresh'))}:{})});
      }
      if(route==='/api/me'&&req.method==='GET'){const found=await session(req);return json(res,200,{user:found?.user?{id:found.user.id,name:found.user.name,username:found.user.username,email:found.user.email,emailVerified:found.user.emailVerified}:null})}
      if(route==='/api/dev/mail'&&req.method==='GET'){
        if(!preview||env.NODE_ENV==='production'||!loopback(req.socket.remoteAddress))throw new PublicError('Tidak ditemukan.',404);return json(res,200,{mode:'local-preview',message:'Email uji lokal. Tidak dikirim ke alamat email asli.',messages:[...accounts.mailbox].reverse()});
      }
      if(route.startsWith('/api/')){
        const user=await requireUser(req);
        if(req.method!=='GET'&&(req.headers.origin!==origin||req.headers['x-flexlab-request']!=='1'))throw new PublicError('Permintaan lintas situs ditolak.',403);
        if(route==='/api/jobs'&&req.method==='GET')return json(res,200,{jobs:db.prepare('SELECT * FROM flexlab_jobs WHERE ownerId=? ORDER BY createdAt DESC LIMIT 20').all(user.id).map(safeJob)});
        if(route==='/api/jobs'&&req.method==='POST'){
          if(submitting.has(user.id))throw new PublicError('Foto sedang dikirim ke AI. Tunggu sebentar.',409);
          submitting.add(user.id);
          try{
          const input=await readJSON(req);if(!['image','video'].includes(input.mode))throw new PublicError('Pilih gambar atau video.');
          const preset=presets.find(p=>p.id===Number(input.preset));if(!preset)throw new PublicError('Gaya tidak ditemukan.');const duration=Number(input.duration||4);if(![4,6,8].includes(duration))throw new PublicError('Durasi tidak valid.');
          const extra=typeof input.instructions==='string'?input.instructions.trim():'';if(extra.length>600)throw new PublicError('Catatan maksimal 600 karakter.');
          const unfinished=db.prepare("SELECT id FROM flexlab_jobs WHERE ownerId=? AND status IN ('queued','running') LIMIT 1").get(user.id);if(unfinished)throw new PublicError('Masih ada proses yang berjalan. Tunggu hasilnya sebelum membuat yang baru.',409);
          const last=db.prepare('SELECT createdAt FROM flexlab_jobs WHERE ownerId=? ORDER BY createdAt DESC LIMIT 1').get(user.id);if(last&&Date.now()-last.createdAt<10000)throw new PublicError('Tunggu beberapa detik sebelum mencoba lagi.',429);
          const dimensions=outputDimensions(input.ratio||'4:5',input.mode);const bytes=imageBuffer(input.image,input.mime);
          const prompt=`Use the product in the attached reference image as the main subject. Preserve its identity, visible brand, shape, proportions, and material as closely as the model allows. Create a polished product advertising ${input.mode==='video'?'video':'image'}. Visual direction: ${preset.description}. Do not replace the uploaded product with an example product. ${extra?`Additional direction: ${extra}.`:''} No added watermark or invented logos.`;
          const promptId=await comfy.submit({bytes,mime:input.mime,mode:input.mode,prompt,...dimensions,duration});const id=randomUUID();db.prepare('INSERT INTO flexlab_jobs(id,ownerId,mode,preset,promptId,status,createdAt) VALUES (?,?,?,?,?,?,?)').run(id,user.id,input.mode,preset.code,promptId,'queued',Date.now());return json(res,201,{job:safeJob(ownerJob(id,user))});
          }finally{submitting.delete(user.id)}
        }
        const jobMatch=route.match(/^\/api\/jobs\/([0-9a-f-]{36})$/);if(jobMatch&&req.method==='GET')return json(res,200,{job:safeJob(await refreshJob(ownerJob(jobMatch[1],user)))});
        const media=route.match(/^\/api\/jobs\/([0-9a-f-]{36})\/output\/(\d)$/);if(media&&req.method==='GET'){
          const row=ownerJob(media[1],user);const output=JSON.parse(row.outputs)[Number(media[2])];if(row.status!=='completed'||!output)throw new PublicError('Hasil belum tersedia.',404);const file=path.join(generated,output.filename);if(!fs.existsSync(file))throw new PublicError('Berkas hasil tidak ditemukan.',404);
          res.writeHead(200,{'content-type':output.mime,'content-length':fs.statSync(file).size,'cache-control':'private, no-store','content-disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename="flexlab-${row.id}${path.extname(output.filename)}"`});fs.createReadStream(file).pipe(res);return;
        }
        throw new PublicError('Tidak ditemukan.',404);
      }
      if(!['GET','HEAD'].includes(req.method))throw new PublicError('Metode tidak diizinkan.',405);
      let name;try{name=decodeURIComponent(route).replace(/^\//,'')}catch{throw new PublicError('Alamat tidak valid.')};if(!name)name='index.html';
      if(name==='index.html'||name==='gallery.html'){const found=await session(req);if(!found?.user?.emailVerified){res.writeHead(302,{location:'/login.html','cache-control':'no-store'});res.end();return}}
      if(name==='dev-mail.html'&&(!preview||env.NODE_ENV==='production'||!loopback(req.socket.remoteAddress)))throw new PublicError('Tidak ditemukan.',404);
      if(!STATIC.has(name)&&name!=='dev-mail.html'&&!/^images\/[0-9]{3}\.jpg$/.test(name))throw new PublicError('Tidak ditemukan.',404);
      const file=path.join(root,name);if(!fs.existsSync(file))throw new PublicError('Tidak ditemukan.',404);res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
    }catch(error){if(!res.headersSent)json(res,error.status||500,{message:error instanceof PublicError?error.message:'Permintaan gagal. Periksa konfigurasi server lokal.'});else res.end();}
  };
  return {url:localURL,baseURL,auth,db,mailbox:accounts.mailbox,close:async()=>{await Promise.allSettled([...active.values()]);await new Promise(resolve=>server.close(resolve));accounts.close()}};
}
