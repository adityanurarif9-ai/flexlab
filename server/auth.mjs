import {betterAuth} from 'better-auth';
import {username} from 'better-auth/plugins';
import {getMigrations} from 'better-auth/db/migration';
import {DatabaseSync} from 'node:sqlite';
import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

export async function createAccounts({dataDir,baseURL,env=process.env,preview=false,sendMail}){
  fs.mkdirSync(dataDir,{recursive:true});
  const secretFile=path.join(dataDir,'auth-secret');
  if(!env.BETTER_AUTH_SECRET&&!fs.existsSync(secretFile))fs.writeFileSync(secretFile,randomBytes(48).toString('base64url'),{mode:0o600,flag:'wx'});
  const secret=env.BETTER_AUTH_SECRET||fs.readFileSync(secretFile,'utf8').trim();
  if(secret.length<32)throw Error('BETTER_AUTH_SECRET harus sedikitnya 32 karakter.');
  if(preview&&env.NODE_ENV==='production')throw Error('Kotak email uji tidak boleh aktif di production.');
  const mailbox=[];
  const smtpReady=Boolean(env.SMTP_HOST&&env.SMTP_FROM);
  const transport=smtpReady?nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASS}:undefined,connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000}):null;
  async function deliver({to,subject,text}){
    if(sendMail)return sendMail({to,subject,text});
    if(transport)return transport.sendMail({from:env.SMTP_FROM,to,subject,text});
    if(preview){mailbox.push({id:randomBytes(8).toString('hex'),to,subject,text,createdAt:new Date().toISOString()});if(mailbox.length>20)mailbox.shift();return;}
    throw Error('Pengiriman email belum dikonfigurasi.');
  }
  const db=new DatabaseSync(path.join(dataDir,'flexlab.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  const auth=betterAuth({
    appName:'FlexLab',baseURL,secret,database:db,trustedOrigins:[baseURL],
    emailAndPassword:{enabled:true,minPasswordLength:10,maxPasswordLength:128,requireEmailVerification:true,autoSignIn:false,revokeSessionsOnPasswordReset:true,sendResetPassword:async({user,url})=>deliver({to:user.email,subject:'Atur ulang password FlexLab',text:`Permintaan penggantian password FlexLab.\n\nBuka tautan ini:\n${url}\n\nAbaikan bila kamu tidak memintanya.`})},
    emailVerification:{sendOnSignUp:true,sendOnSignIn:true,autoSignInAfterVerification:false,expiresIn:1800,sendVerificationEmail:async({user,url})=>deliver({to:user.email,subject:'Verifikasi email FlexLab',text:`Verifikasi alamat email untuk akun FlexLab.\n\nBuka tautan berikut (berlaku 30 menit):\n${url}\n\nJangan bagikan tautan ini kepada orang lain.`})},
    session:{expiresIn:60*60*24*7,updateAge:60*60*24},
    rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/username':{window:60,max:8},'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:60,max:5},'/send-verification-email':{window:60,max:3},'/request-password-reset':{window:60,max:3}}},
    advanced:{cookiePrefix:'flexlab',useSecureCookies:baseURL.startsWith('https://'),ipAddress:{ipAddressHeaders:['x-flexlab-client-ip']}},
    plugins:[username({minUsernameLength:3,maxUsernameLength:24,usernameValidator:value=>/^[a-zA-Z0-9_]{3,24}$/.test(value)})],
  });
  const {runMigrations}=await getMigrations(auth.options);await runMigrations();
  return {auth,db,mailbox,mailReady:smtpReady||preview||Boolean(sendMail),mailMode:preview&&!smtpReady?'preview':smtpReady||sendMail?'smtp':'unconfigured',close:()=>{transport?.close();db.close()}};
}
