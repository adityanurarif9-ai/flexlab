import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startFlexLab} from './server/server.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,'.env'))}catch(error){if(error.code!=='ENOENT')throw error}
const app=await startFlexLab({root});
console.log(`FlexLab: ${app.url}`);
console.log('AI lokal memakai ComfyUI terpisah. Tidak ada model yang diunduh otomatis.');
if(process.env.FLEXLAB_DEV_MAILBOX==='1')console.log(`EMAIL UJI LOKAL, TIDAK DIKIRIM: ${app.url}/dev-mail.html`);
else if(!process.env.SMTP_HOST)console.log('Email belum aktif. Isi .env untuk SMTP, atau gunakan npm run dev:email untuk uji lokal.');
let closing=false;async function stop(){if(closing)return;closing=true;await app.close();process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
