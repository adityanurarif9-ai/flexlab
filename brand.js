const root=document.documentElement;
const themeButton=document.querySelector('#theme-toggle');
function applyTheme(theme){
  root.dataset.theme=theme==='dark'?'dark':'light';
  const dark=root.dataset.theme==='dark';
  if(themeButton){themeButton.setAttribute('aria-label',dark?'Ganti ke tema terang':'Ganti ke tema gelap');themeButton.title=dark?'Tema terang':'Tema gelap';themeButton.setAttribute('aria-pressed',String(dark));}
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#101923':'#ffffff';
}
let saved='light';try{saved=localStorage.getItem('flexlab-theme')||'light'}catch{}
applyTheme(saved);
themeButton?.addEventListener('click',()=>{const next=root.dataset.theme==='dark'?'light':'dark';applyTheme(next);try{localStorage.setItem('flexlab-theme',next)}catch{}});
window.addEventListener('storage',e=>{if(e.key==='flexlab-theme')applyTheme(e.newValue)});
