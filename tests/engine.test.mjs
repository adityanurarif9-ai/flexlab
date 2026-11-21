import test from 'node:test';
import assert from 'node:assert/strict';
import {dimensions,motionAt,MOTIONS,safeSettings,DEFAULTS,supportedVideoType,supportedVideoTypes,presetSettings,videoIsUsable} from '../engine.mjs';

test('output dimensions preserve each social aspect ratio and selected short edge',()=>{
  assert.deepEqual(dimensions('9:16',1080),{width:1080,height:1920});
  assert.deepEqual(dimensions('16:9',720),{width:1280,height:720});
  assert.deepEqual(dimensions('4:5',1080),{width:1080,height:1350});
  assert.deepEqual(dimensions('1:1',720),{width:720,height:720});
  assert.throws(()=>dimensions('0:0',1080));assert.throws(()=>dimensions('9:16',40000));
});
test('all animations remain finite and within safe transform bounds over a full clip',()=>{
  for(const motion of MOTIONS)for(let t=0;t<=1;t+=.01){const m=motionAt(motion.id,t,100);for(const n of Object.values(m))assert.ok(Number.isFinite(n));assert.ok(m.scale>=1&&m.scale<=1.3);assert.ok(Math.abs(m.x)<=.1);assert.ok(Math.abs(m.y)<=.1);assert.ok(Math.abs(m.angle)<=.1)}
});
test('zero intensity leaves the uploaded photo stationary for every animation',()=>{
  for(const motion of MOTIONS)for(const t of [0,.25,.5,.75,1]){const m=motionAt(motion.id,t,0);assert.equal(m.scale,1);for(const key of ['x','y','angle'])assert.equal(Math.abs(m[key]),0)}
});
test('push and pull move in opposite directions; looping float returns to its start',()=>{
  assert.ok(motionAt('push',1).scale>motionAt('push',0).scale);
  assert.ok(motionAt('pull',1).scale<motionAt('pull',0).scale);
  const start=motionAt('float',0),end=motionAt('float',1);for(const key of Object.keys(start))assert.ok(Math.abs(start[key]-end[key])<1e-10);
});
test('saved settings cannot inject invalid dimensions, filters, or color strings',()=>{
  const c=safeSettings({ratio:'99999:1',resolution:40000,intensity:900,brightness:-5,textColor:'url(javascript:bad)',title:'x'.repeat(100),duration:300,unknown:'ignored'});
  assert.equal(c.ratio,DEFAULTS.ratio);assert.equal(c.resolution,1080);assert.equal(c.intensity,100);assert.equal(c.brightness,50);assert.equal(c.textColor,'#ffffff');assert.equal(c.title.length,70);assert.equal(c.duration,6);assert.equal(c.unknown,undefined);
  assert.deepEqual(safeSettings(null),DEFAULTS);
});
test('video export detects MP4 and falls back to a supported WebM encoder',()=>{
  assert.equal(supportedVideoType({isTypeSupported:x=>x==='video/mp4'}).extension,'mp4');
  assert.equal(supportedVideoType({isTypeSupported:x=>x==='video/webm'}).extension,'webm');
  assert.equal(supportedVideoType({isTypeSupported:()=>false}),null);assert.equal(supportedVideoType(null),null);
});
test('gallery presets map to actual available photo animations and effects',()=>{
  assert.deepEqual(presetSettings('/smokereveal'),{motion:'push',effect:'smoke'});
  assert.deepEqual(presetSettings('/cyberorbit'),{motion:'orbit',effect:'none'});
  assert.deepEqual(presetSettings('/floatingproduct'),{motion:'float',effect:'none'});
  assert.deepEqual(presetSettings('/filmlook'),{motion:'push',effect:'grain'});
});

test('runtime fallback retains a WebM option when MP4 is advertised',()=>{
 const candidates=supportedVideoTypes({isTypeSupported:x=>x==='video/mp4'||x==='video/webm'});
 assert.deepEqual(candidates.map(x=>x.extension),['mp4','webm']);
 assert.deepEqual(supportedVideoTypes(null),[]);
});

test('a one-frame or unreadable recording is rejected before showing a download',()=>{
 assert.equal(videoIsUsable({width:720,height:900,duration:.033},4),false);
 assert.equal(videoIsUsable({width:720,height:900,duration:3.99},4),true);
 assert.equal(videoIsUsable({width:720,height:900,duration:Infinity},4),true);
 assert.equal(videoIsUsable({width:0,height:0,duration:4},4),false);
 assert.equal(videoIsUsable({width:720,height:900,duration:NaN},4),false);
});
