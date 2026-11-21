import {MOTIONS,DEFAULTS,RECIPES,dimensions,createRenderer,supportedVideoTypes,safeSettings,presetSettings,videoIsUsable} from './engine.mjs';

const $=s=>document.querySelector(s);let config={...DEFAULTS},image=null,renderer=null,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,position=0,lastTime=0,mode='video',busy=false,currentExport=null,resultUrl=null,musicFile=null,photoTicket=0;let toastTimer;
const numeric=new Set(['intensity','brightness','contrast','saturation','volume','resolution','duration','fps']);
const bindings={intensity:'intensity',effect:'effect',fit:'fit',background:'background','background-color':'backgroundColor',brightness:'brightness',contrast:'contrast',saturation:'saturation',title:'title',subtitle:'subtitle','text-color':'textColor',volume:'volume',ratio:'ratio',resolution:'resolution',duration:'duration',fps:'fps'};
const videoTypes=supportedVideoTypes();let format=videoTypes[0]||null;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200)}
function makePreview(){
  if(!image)return;const d=dimensions(config.ratio,720);const scale=Math.min(1,720/Math.max(d.width,d.height));$('#preview').width=Math.round(d.width*scale);$('#preview').height=Math.round(d.height*scale);renderer=createRenderer($('#preview'),image,config);renderer.draw(position);
}
function sync(){
  for(const[id,key]of Object.entries(bindings)){const el=$('#'+id);if(el.value!==String(config[key]))el.value=config[key];const out=$('#'+id+'-value');if(out)out.textContent=config[key]+'%'}
  for(const b of document.querySelectorAll('[data-motion]'))b.setAttribute('aria-pressed',b.dataset.motion===config.motion);
  $('#motion-name').textContent=MOTIONS.find(x=>x.id===config.motion).name;
  const d=dimensions(config.ratio,config.resolution);$('#preview-dimensions').textContent=`${d.width} × ${d.height}`;$('#size-label').textContent=`${d.width} × ${d.height} px`;
  $('#end-time').textContent=config.duration.toFixed(1)+'s';$('#mode-video').setAttribute('aria-pressed',mode==='video');$('#mode-image').setAttribute('aria-pressed',mode==='image');$('#video-settings').hidden=mode==='image';
  $('#format-label').textContent=mode==='image'?'Gambar PNG':format?`Video ${format.extension.toUpperCase()}`:'Video tidak didukung';
  $('#export-tip').textContent=mode==='image'?'Mengambil frame pada posisi waktu saat ini.':format?'Video dengan foto, efek, teks, dan musik pilihanmu.':'Gunakan browser modern yang mendukung perekaman canvas.';
  $('#export').textContent=mode==='image'?'Unduh gambar PNG':'Buat video';$('#export').disabled=busy||!image||(mode==='video'&&(!format||!$('#preview').captureStream));
  $('#play').textContent=playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',playing?'Jeda pratinjau':'Putar pratinjau');
  $('#support-note').textContent=mode==='image'?'Gambar diambil dari frame yang terlihat, dengan resolusi sesuai pilihanmu.':'Tetap buka tab studio sampai video selesai dibuat.';
}
function update(patch){config=safeSettings({...config,...patch});lastTime=0;sync();makePreview()}
function frame(now){
  if(!busy){if(playing&&image){if(lastTime)position=(position+(now-lastTime)/1000/config.duration)%1;lastTime=now;if(renderer)renderer.draw(position)}else lastTime=0;$('#timeline').value=Math.round(position*1000);$('#current-time').textContent=(position*config.duration).toFixed(1)+'s'}requestAnimationFrame(frame);
}
async function loadPhoto(source,name,objectUrl=false){
  const ticket=++photoTicket;$('#loading').hidden=false;$('#loading').textContent='Memuat foto…';const next=new Image();
  try{await new Promise((resolve,reject)=>{next.onload=resolve;next.onerror=()=>reject(Error('Foto tidak bisa dibaca. Gunakan JPG, PNG, atau WebP.'));next.src=source});if(next.naturalWidth*next.naturalHeight>50000000)throw Error('Foto terlalu besar. Gunakan gambar di bawah 50 megapiksel.');if(ticket!==photoTicket)return;image=next;position=0;lastTime=0;$('#photo-name').textContent=name;$('#photo-name').title=name;clearResult();makePreview();sync()}
  catch(error){if(ticket===photoTicket){toast(error.message);if(!image){$('#loading').textContent='Upload foto untuk mulai membuat konten.';return}}}
  finally{if(objectUrl)URL.revokeObjectURL(source);if(ticket===photoTicket&&image)$('#loading').hidden=true}
}
function acceptPhoto(file){if(busy)return;if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Format tidak didukung. Pilih JPG, PNG, atau WebP.');return}if(file.size>20*1024*1024){toast('Ukuran foto maksimal 20 MB.');return}loadPhoto(URL.createObjectURL(file),file.name,true)}
function clearResult(){if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=null;$('#result-video').pause();$('#result-video').removeAttribute('src');$('#result-image').removeAttribute('src');$('#result').hidden=true}
function setBusy(value){busy=value;for(const e of document.querySelectorAll('.controls input,.controls select,.controls button,.export-panel input,.export-panel select,.export-panel button,.recipe,#reset,#mode-video,#mode-image,#timeline,#play,#restart'))e.disabled=value;$('#cancel').disabled=false;$('#cancel').hidden=!value||mode==='image';$('#progress-wrap').hidden=!value;$('#photo').disabled=value;lastTime=0;if(!value)sync()}
function showResult(blob,kind,filename){
  clearResult();resultUrl=URL.createObjectURL(blob);$('#result').hidden=false;$('#result-video').hidden=kind!=='video';$('#result-image').hidden=kind!=='image';$('#result-title').textContent=kind==='video'?'Videomu siap.':'Gambarmu siap.';
  $('#result-info').textContent=`${filename} · ${(blob.size/1024/1024).toFixed(1)} MB`;const target=kind==='video'?$('#result-video'):$('#result-image');target.src=resultUrl;$('#download').href=resultUrl;$('#download').download=filename;$('#download').textContent='Unduh '+(kind==='video'?'video':'gambar');
}
async function exportImage(){
  if(!image||busy)return;const state={...config};const p=position;setBusy(true);$('#progress-text').textContent='Menyiapkan gambar…';
  try{const canvas=document.createElement('canvas');const d=dimensions(state.ratio,state.resolution);canvas.width=d.width;canvas.height=d.height;createRenderer(canvas,image,state).draw(p);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Gambar gagal dibuat.')),'image/png'));const name=`flexlab-${state.motion}-${Date.now()}.png`;showResult(blob,'image',name);$('#download').click();toast('Gambar PNG siap diunduh.');canvas.width=canvas.height=1}
  catch(error){toast(error.message)}finally{setBusy(false)}
}
function validateRenderedVideo(blob,expectedDuration){
  return new Promise((resolve,reject)=>{
    const probe=document.createElement('video');const url=URL.createObjectURL(blob);let done=false;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);probe.onloadedmetadata=probe.onerror=null;probe.removeAttribute('src');probe.load();URL.revokeObjectURL(url);if(error)reject(error);else resolve()};
    const timer=setTimeout(()=>finish(Error('Video tidak dapat diperiksa.')),10000);
    probe.onloadedmetadata=()=>finish(videoIsUsable({width:probe.videoWidth,height:probe.videoHeight,duration:probe.duration},expectedDuration)?null:Error('Encoder menghasilkan video yang terlalu pendek.'));
    probe.onerror=()=>finish(Error('Format video tidak dapat diputar.'));probe.preload='metadata';probe.muted=true;probe.src=url;
  });
}
async function exportVideo(){
  if(!image||busy||!format)return;
  setBusy(true);clearResult();$('#progress').value=0;$('#progress-text').textContent='Menyiapkan video…';
  const state={...config};const canvas=document.createElement('canvas');const d=dimensions(state.ratio,state.resolution);canvas.width=d.width;canvas.height=d.height;
  let stream,recorder,audioContext,audioSource,audioBuffer,audioGain,abortReason='',frameRequest=0,timer=0;
  const cancel=reason=>{abortReason=reason||'Render dibatalkan.';if(recorder&&recorder.state!=='inactive')recorder.stop()};currentExport={cancel};
  try{
    const drawing=createRenderer(canvas,image,state);drawing.draw(0);stream=canvas.captureStream(state.fps);
    if(musicFile){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio tidak didukung browser ini. Hapus musik untuk melanjutkan.');
      audioContext=new Audio();await audioContext.resume();audioBuffer=await audioContext.decodeAudioData(await musicFile.arrayBuffer());if(!audioBuffer.duration)throw Error('File musik tidak memiliki durasi.');
      audioGain=audioContext.createGain();audioGain.gain.value=state.volume/100;const dest=audioContext.createMediaStreamDestination();audioGain.connect(dest);for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
    }
    if(abortReason)throw Error(abortReason);
    const alternative=videoTypes.find(x=>x.extension!==format.extension);const attempts=[format,...(alternative?[alternative]:[])];
    let blob=null,lastError;
    for(let index=0;index<attempts.length;index++){
      const type=attempts[index];const chunks=[];let renderedFrames=0;$('#progress').value=0;drawing.draw(0);
      try{
        if(abortReason)throw Error(abortReason);
        if(audioSource){try{audioSource.stop()}catch{}audioSource.disconnect();audioSource=null}
        if(audioContext){audioSource=audioContext.createBufferSource();audioSource.buffer=audioBuffer;audioSource.loop=true;audioSource.connect(audioGain)}
        const active=new MediaRecorder(stream,{mimeType:type.mime,videoBitsPerSecond:state.resolution===1080?10000000:5000000,audioBitsPerSecond:128000});recorder=active;
        await new Promise((resolve,reject)=>{
          let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);cancelAnimationFrame(frameRequest);if(error)reject(error);else resolve()};
          active.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
          active.onerror=e=>finish(e.error||Error('Encoder video gagal.'));active.onstop=()=>finish();
          active.onstart=()=>{if(settled||abortReason){active.stop();return}if(audioSource)audioSource.start();const start=performance.now();
          const tick=now=>{if(settled||active.state==='inactive')return;const elapsed=(now-start)/1000;const p=Math.min(1,elapsed/state.duration);drawing.draw(p);renderedFrames++;if(renderer)renderer.draw(p);$('#progress').value=p;$('#progress-text').textContent=`${index?'Mencoba format '+type.extension.toUpperCase():'Membuat video'}… ${Math.round(p*100)}% · ${Math.min(elapsed,state.duration).toFixed(1)} / ${state.duration} detik`;if(p>=1){active.stop();return}frameRequest=requestAnimationFrame(tick)};
          frameRequest=requestAnimationFrame(tick);clearTimeout(timer);timer=setTimeout(()=>{if(active.state!=='inactive'){abortReason='Render terlalu lambat. Coba 720p dan tetap buka tab ini.';active.stop()}},(state.duration+20)*1000);
          };
          timer=setTimeout(()=>{finish(Error('Encoder tidak mulai merekam.'));if(active.state!=='inactive')active.stop()},15000);active.start(250);
        });
        if(abortReason)throw Error(abortReason);
        if(!chunks.length||renderedFrames<2)throw Error('Encoder belum menghasilkan rekaman yang lengkap.');
        const candidate=new Blob(chunks,{type:active.mimeType||type.mime});await validateRenderedVideo(candidate,state.duration);if(abortReason)throw Error(abortReason);blob=candidate;format=type;break;
      }catch(error){
        clearTimeout(timer);cancelAnimationFrame(frameRequest);lastError=error;if(recorder&&recorder.state!=='inactive')recorder.stop();
        if(abortReason||index===attempts.length-1)throw error;
        $('#progress-text').textContent='Format pertama tidak tersedia. Mencoba format alternatif…';
      }
    }
    if(!blob)throw lastError||Error('Video tidak dapat dibuat di browser ini.');
    const extension=blob.type.includes('mp4')?'mp4':'webm';showResult(blob,'video',`flexlab-${state.motion}-${Date.now()}.${extension}`);toast('Video selesai. Putar pratinjau hasil, lalu unduh.');
  }catch(error){toast(error.message||'Render gagal. Coba resolusi 720p.')}finally{
    clearTimeout(timer);cancelAnimationFrame(frameRequest);if(recorder&&recorder.state!=='inactive')recorder.stop();if(audioSource){try{audioSource.stop()}catch{}audioSource.disconnect()}if(stream)for(const track of stream.getTracks())track.stop();if(audioContext)await audioContext.close().catch(()=>{});canvas.width=canvas.height=1;currentExport=null;setBusy(false);makePreview();
  }
}


$('#motion-grid').innerHTML=MOTIONS.map(x=>`<button class="motion-option" data-motion="${x.id}" aria-pressed="${x.id===config.motion}"><span aria-hidden="true">${x.icon}</span>${x.short}</button>`).join('');
$('#motion-grid').onclick=e=>{const b=e.target.closest('[data-motion]');if(b&&!busy)update({motion:b.dataset.motion})};
for(const[id,key]of Object.entries(bindings))$('#'+id).addEventListener('input',e=>{if(!busy)update({[key]:numeric.has(key)?Number(e.target.value):e.target.value})});
$('#photo').onchange=e=>{acceptPhoto(e.target.files[0]);e.target.value=''};
for(const name of ['dragenter','dragover'])$('#dropzone').addEventListener(name,e=>{e.preventDefault();if(!busy)$('#dropzone').classList.add('dragover')});
for(const name of ['dragleave','drop'])$('#dropzone').addEventListener(name,e=>{e.preventDefault();$('#dropzone').classList.remove('dragover')});$('#dropzone').addEventListener('drop',e=>acceptPhoto(e.dataTransfer.files[0]));
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
$('#sample').onclick=()=>{if(!busy)loadPhoto('images/052.jpg','Foto contoh: parfum')};
$('#play').onclick=()=>{playing=!playing;lastTime=0;sync()};$('#restart').onclick=()=>{position=0;lastTime=0;renderer?.draw(0)};
$('#timeline').oninput=e=>{playing=false;position=Number(e.target.value)/1000;lastTime=0;sync();renderer?.draw(position)};
$('#mode-video').onclick=()=>{mode='video';sync()};$('#mode-image').onclick=()=>{mode='image';sync()};
$('#randomize').onclick=()=>update({motion:MOTIONS[Math.floor(Math.random()*(MOTIONS.length-1))].id,effect:['none','particles','smoke','light','snow','grain'][Math.floor(Math.random()*6)]});
for(const b of document.querySelectorAll('[data-recipe]'))b.onclick=()=>{position=0;update(RECIPES[b.dataset.recipe]);toast('Gaya '+b.querySelector('strong').textContent+' diterapkan.')};
$('#reset').onclick=()=>{position=0;musicFile=null;$('#music').value='';$('#music-name').textContent='Tanpa musik';update(DEFAULTS);toast('Pengaturan direset. Foto tetap dipakai.')};
$('#music').onchange=e=>{const f=e.target.files[0];if(!f)return;if(!f.type.startsWith('audio/')||f.size>30*1024*1024){toast('Pilih file audio hingga 30 MB.');e.target.value='';return}musicFile=f;$('#music-name').textContent=f.name;toast('Musik ditambahkan untuk ekspor video.')};$('#remove-music').onclick=()=>{musicFile=null;$('#music').value='';$('#music-name').textContent='Tanpa musik'};
$('#save-settings').onclick=()=>{try{localStorage.setItem('flexlab-studio-settings',JSON.stringify(config));toast('Pengaturan disimpan. Foto dan musik tidak disimpan.')}catch{toast('Penyimpanan browser tidak tersedia.')}};
$('#load-settings').onclick=()=>{try{const saved=localStorage.getItem('flexlab-studio-settings');if(!saved){toast('Belum ada pengaturan tersimpan.');return}update(safeSettings(JSON.parse(saved)));toast('Pengaturan dimuat.')}catch{toast('Pengaturan tersimpan tidak dapat dibaca.')}};
$('#export').onclick=()=>mode==='image'?exportImage():exportVideo();$('#cancel').onclick=()=>currentExport?.cancel('Render dibatalkan.');
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden&&busy)currentExport?.cancel('Render dihentikan karena tab disembunyikan. Tetap buka tab studio saat membuat video.')});
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});window.addEventListener('pagehide',e=>{if(!e.persisted&&resultUrl)URL.revokeObjectURL(resultUrl)});
$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();
sync();loadPhoto('images/052.jpg','Foto contoh: parfum');requestAnimationFrame(frame);
const requestedPreset=new URLSearchParams(location.search).get('preset');
if(requestedPreset)fetch('data.json').then(r=>{if(!r.ok)throw Error('library');return r.json()}).then(items=>{const entry=items.find(x=>x.code===requestedPreset);if(!entry){toast('Preset tidak ditemukan. Pilih animasi dari studio.');return}update(presetSettings(entry.code));const note=document.createElement('p');note.className='preview-note';note.textContent=`Referensi ${entry.code}: ${entry.description}. Studio menerapkan gerakan dan efek foto yang paling mendekati, tanpa mengubah isi foto.`;$('.preview-panel').append(note);toast('Resep animasi dari '+entry.code+' diterapkan.')}).catch(()=>toast('Preset galeri tidak dapat dimuat. Pilih animasi secara manual.'));
