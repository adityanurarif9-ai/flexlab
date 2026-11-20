export const MOTIONS = [
  {id:'push',name:'Cinematic push',short:'Push in',icon:'⊕'},
  {id:'pull',name:'Slow reveal',short:'Pull out',icon:'⊖'},
  {id:'pan',name:'Cinematic pan',short:'Geser',icon:'↔'},
  {id:'float',name:'Gentle float',short:'Melayang',icon:'≈'},
  {id:'orbit',name:'Light orbit',short:'Orbit ringan',icon:'◌'},
  {id:'dynamic',name:'Dynamic hook',short:'Dinamis',icon:'ϟ'},
  {id:'tilt',name:'Editorial tilt',short:'Tilt',icon:'◇'},
  {id:'breathe',name:'Soft breathing',short:'Bernapas',icon:'◎'},
  {id:'still',name:'Still frame',short:'Statis',icon:'□'},
];
export const DEFAULTS={motion:'push',intensity:50,effect:'none',fit:'contain',background:'blur',backgroundColor:'#102b63',brightness:100,contrast:100,saturation:100,title:'',subtitle:'',textColor:'#ffffff',volume:50,ratio:'4:5',resolution:1080,duration:6,fps:30};
export const RECIPES={
  luxury:{motion:'push',effect:'light',intensity:30,background:'solid',backgroundColor:'#241d16',ratio:'4:5',brightness:100,contrast:108,saturation:90},
  fresh:{motion:'float',effect:'particles',intensity:35,background:'gradient',backgroundColor:'#80c6ee',ratio:'4:5',brightness:108,contrast:98,saturation:104},
  tech:{motion:'orbit',effect:'light',intensity:55,background:'gradient',backgroundColor:'#102b63',ratio:'16:9',brightness:100,contrast:115,saturation:110},
  social:{motion:'dynamic',effect:'particles',intensity:70,background:'blur',ratio:'9:16',brightness:105,contrast:108,saturation:110,duration:4},
};
export function dimensions(ratio,shortEdge){
  const [a,b]=String(ratio).split(':').map(Number);const edge=Number(shortEdge);
  if(![[1,1],[4,5],[9,16],[16,9]].some(([x,y])=>x===a&&y===b)||![720,1080].includes(edge))throw Error('Invalid output dimensions');
  return a>=b?{width:Math.round(edge*a/b),height:edge}:{width:edge,height:Math.round(edge*b/a)};
}
export function motionAt(id,progress,intensity=50){
  const t=Math.max(0,Math.min(1,progress));const n=Math.max(0,Math.min(100,intensity))/100;const ease=t*t*(3-2*t);const wave=Math.sin(t*Math.PI*2);const arc=Math.cos(t*Math.PI*2);
  switch(id){
    case'push':return {scale:1+.28*n*ease,x:0,y:0,angle:0};
    case'pull':return {scale:1+.28*n*(1-ease),x:0,y:0,angle:0};
    case'pan':return {scale:1+.14*n,x:(ease-.5)*.18*n,y:0,angle:0};
    case'float':return {scale:1+.05*n,x:wave*.015*n,y:wave*.05*n,angle:Math.sin(t*Math.PI*2)*.018*n};
    case'orbit':return {scale:1+.13*n,x:wave*.055*n,y:(arc-1)*.022*n,angle:wave*.045*n};
    case'dynamic':return {scale:1+n*(.22*Math.exp(-t*8)+.07*Math.sin(t*Math.PI*4)**2),x:Math.sin(t*12)*.012*n*(1-t),y:0,angle:Math.sin(t*8)*.028*n*(1-t)};
    case'tilt':return {scale:1+.12*n,x:0,y:0,angle:(ease-.5)*.12*n};
    case'breathe':return {scale:1+.12*n*(1-arc)/2,x:0,y:0,angle:0};
    default:return {scale:1,x:0,y:0,angle:0};
  }
}
const seed=(i)=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)};
function fitRect(iw,ih,w,h,cover){const s=cover?Math.max(w/iw,h/ih):Math.min(w/iw,h/ih);return {width:iw*s,height:ih*s};}
function wrap(ctx,text,width){const words=text.trim().split(/\s+/);let lines=[],line='';for(const word of words){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word}else line=next}if(line)lines.push(line);return lines.slice(0,3)}
export function createRenderer(canvas,image,settings){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas tidak didukung browser ini.');
  const c={...DEFAULTS,...settings};const w=canvas.width,h=canvas.height;const unit=Math.min(w,h);const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const base=document.createElement('canvas');base.width=w;base.height=h;const bg=base.getContext('2d');
  bg.fillStyle=c.backgroundColor;bg.fillRect(0,0,w,h);
  if(c.background==='gradient'){
    const g=bg.createLinearGradient(0,0,w,h);g.addColorStop(0,c.backgroundColor);g.addColorStop(1,'#050b18');bg.fillStyle=g;bg.fillRect(0,0,w,h);
    const glow=bg.createRadialGradient(w*.8,h*.15,0,w*.8,h*.15,w*.85);glow.addColorStop(0,'#70afff55');glow.addColorStop(1,'#70afff00');bg.fillStyle=glow;bg.fillRect(0,0,w,h);
  }
  if(c.background==='blur'){
    const r=fitRect(iw,ih,w*1.15,h*1.15,true);bg.filter=`blur(${unit*.035}px) brightness(45%)`;bg.drawImage(image,(w-r.width)/2,(h-r.height)/2,r.width,r.height);bg.filter='none';
  }
  const photo=document.createElement('canvas');const sourceScale=Math.min(1,Math.max(w,h)*1.3/Math.max(iw,ih));photo.width=Math.max(1,Math.round(iw*sourceScale));photo.height=Math.max(1,Math.round(ih*sourceScale));
  const pc=photo.getContext('2d');pc.filter=`brightness(${c.brightness}%) contrast(${c.contrast}%) saturate(${c.saturation}%)`;pc.drawImage(image,0,0,photo.width,photo.height);
  const r=fitRect(iw,ih,w,h,c.fit==='cover');
  function draw(progress){
    const t=Math.max(0,Math.min(1,progress));ctx.drawImage(base,0,0);const m=motionAt(c.motion,t,c.intensity);
    ctx.save();ctx.translate(w/2+m.x*w,h/2+m.y*h);ctx.rotate(m.angle);ctx.scale(m.scale,m.scale);ctx.drawImage(photo,-r.width/2,-r.height/2,r.width,r.height);ctx.restore();
    const strength=c.intensity/100;
    if(c.effect==='particles'||c.effect==='snow'){
      ctx.save();ctx.globalCompositeOperation=c.effect==='particles'?'screen':'source-over';
      for(let i=0;i<44;i++){const x=(seed(i+1)+Math.sin(t*2*Math.PI+seed(i+20)*6)*.07)*w;const y=((seed(i+40)-t*(.1+seed(i+70)*.25)+1)%1)*h;const radius=unit*(.0015+seed(i+80)*.006)*(c.effect==='snow'?1.5:1);const alpha=(.2+seed(i+100)*.6)*(.4+.6*strength);ctx.fillStyle=`rgba(220,239,255,${alpha})`;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();if(c.effect==='particles'&&i%8===0){ctx.fillRect(x-radius*3,y-.5,radius*6,1);ctx.fillRect(x-.5,y-radius*3,1,radius*6)}}ctx.restore();
    }
    if(c.effect==='smoke'){
      ctx.save();for(let i=0;i<6;i++){const x=(seed(i+20)+Math.sin(t*Math.PI*2+i)*.16)*w;const y=h*(.85-seed(i+10)*.35)-Math.sin(t*Math.PI+i)*h*.05;const radius=unit*(.25+seed(i)*.3);const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,`rgba(212,229,250,${.1+.1*strength})`);g.addColorStop(1,'rgba(212,229,250,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}ctx.restore();
    }
    if(c.effect==='light'){
      ctx.save();ctx.globalCompositeOperation='screen';const x=(t*1.8-.4)*w;const g=ctx.createLinearGradient(x-w*.2,0,x+w*.2,0);g.addColorStop(0,'#daeaff00');g.addColorStop(.5,`rgba(216,235,255,${.13+.13*strength})`);g.addColorStop(1,'#daeaff00');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
    }
    if(c.effect==='grain'){
      ctx.save();for(let i=0;i<300;i++){const j=i+Math.floor(t*240)*301;ctx.fillStyle=`rgba(255,255,255,${seed(j+5)*.12})`;ctx.fillRect(seed(j+2)*w,seed(j+3)*h,unit*.003,unit*.003)}ctx.restore();
    }
    if(c.title||c.subtitle){
      const size=unit*.057;ctx.save();ctx.font=`600 ${size}px Arial, sans-serif`;const titleLines=wrap(ctx,c.title,w*.84);ctx.font=`400 ${size*.45}px Arial, sans-serif`;const subLines=wrap(ctx,c.subtitle,w*.84);const textHeight=titleLines.length*size*1.16+subLines.length*size*.62;const bottom=h*.075;const overlay=ctx.createLinearGradient(0,h-bottom-textHeight-size*1.5,0,h);overlay.addColorStop(0,'#00000000');overlay.addColorStop(1,'#000000ba');ctx.fillStyle=overlay;ctx.fillRect(0,0,w,h);ctx.fillStyle=c.textColor;ctx.textBaseline='top';ctx.font=`600 ${size}px Arial, sans-serif`;let y=h-bottom-textHeight;for(const line of titleLines){ctx.fillText(line,w*.08,y,w*.84);y+=size*1.16}y+=size*.15;ctx.font=`400 ${size*.45}px Arial, sans-serif`;for(const line of subLines){ctx.fillText(line,w*.08,y,w*.84);y+=size*.62}ctx.restore();
    }
  }
  return {draw,width:w,height:h};
}
export function supportedVideoType(Recorder=globalThis.MediaRecorder){
  if(!Recorder||typeof Recorder.isTypeSupported!=='function')return null;
  const options=[{mime:'video/mp4;codecs=avc1.42001E,mp4a.40.2',extension:'mp4'},{mime:'video/mp4',extension:'mp4'},{mime:'video/webm;codecs=vp9,opus',extension:'webm'},{mime:'video/webm;codecs=vp8,opus',extension:'webm'},{mime:'video/webm',extension:'webm'}];
  return options.find(x=>Recorder.isTypeSupported(x.mime))||null;
}
export function safeSettings(value){
  const o={...DEFAULTS};if(!value||typeof value!=='object')return o;
  const enums={motion:MOTIONS.map(x=>x.id),effect:['none','particles','smoke','light','snow','grain'],fit:['contain','cover'],background:['blur','gradient','solid'],ratio:['1:1','4:5','9:16','16:9'],resolution:[720,1080],duration:[4,6,8,12],fps:[24,30]};
  for(const [k,list]of Object.entries(enums))if(list.includes(value[k]))o[k]=value[k];
  for(const [k,min,max]of [['intensity',0,100],['brightness',50,150],['contrast',50,150],['saturation',0,180],['volume',0,100]])if(Number.isFinite(value[k]))o[k]=Math.max(min,Math.min(max,value[k]));
  for(const k of ['backgroundColor','textColor'])if(/^#[0-9a-f]{6}$/i.test(value[k]))o[k]=value[k];
  for(const [k,len]of [['title',70],['subtitle',100]])if(typeof value[k]==='string')o[k]=value[k].slice(0,len);
  return o;
}
export function presetSettings(code){
  const text=String(code).toLowerCase();let motion='push',effect='none';
  if(/pullout/.test(text))motion='pull';
  else if(/slide|pan|tracking|surfaceglide/.test(text))motion='pan';
  else if(/orbit|360|rotat/.test(text))motion='orbit';
  else if(/float|levitat|gravity|weightless|hover|airborne/.test(text))motion='float';
  else if(/dutch|tilt/.test(text))motion='tilt';
  else if(/fast|rapid|snap|punch|whip|viral|scroll|3second|speed|stomp|drop/.test(text))motion='dynamic';
  if(/smoke|mist|steam|dust|sand/.test(text))effect='smoke';
  else if(/particle|water|ice|crystal|burst|electric|lightning/.test(text))effect='particles';
  else if(/light|glow|neon|energy|flash|gold/.test(text))effect='light';
  else if(/film|35mm/.test(text))effect='grain';
  return {motion,effect};
}
