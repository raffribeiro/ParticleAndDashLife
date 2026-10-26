import test from 'node:test';
import assert from 'node:assert/strict';
import {Bloom} from '../dist/bloom.js';

test('background uses a separate target and never enters bloom extraction',()=>{
 let current=null,deleted=0;const sources=[],samplers=[],clears=[];
 const gl=new Proxy({FRAMEBUFFER_COMPLETE:1,UNSIGNED_BYTE:2,FRAMEBUFFER:3,TEXTURE0:10,TEXTURE1:11,TEXTURE2:12,
 getExtension:()=>null,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,name)=>name,
 checkFramebufferStatus:()=>1,bindFramebuffer:(_target,fb)=>{current=fb;},shaderSource:(_s,src)=>sources.push(src),
 clearColor:(...rgba)=>clears.push(rgba),uniform1i:(name,value)=>samplers.push([name,value]),deleteFramebuffer:()=>deleted++
 },{get:(o,k)=>k in o?o[k]:(()=>({}))});
 const b=new Bloom(gl,null);assert.ok(b.begin(128,128));assert.equal(current,b.backdrop.fb);assert.notEqual(b.backdrop.tex,b.scene.tex);
 b.foreground();assert.equal(current,b.scene.fb);assert.deepEqual(clears.at(-1),[0,0,0,1]);
 const inputs=[];b.pass=(_program,src)=>inputs.push(src);b.end([.03,.02,.04]);assert.equal(inputs[0],b.scene);assert.ok(!inputs.includes(b.backdrop));
 assert.ok(samplers.some(([name,unit])=>name==='backdrop'&&unit===2));
 assert.ok(sources.some(s=>s.includes('texture2D(backdrop,uv).rgb+s+b*intensity')));
 const targets=2+b.levels.length;b.release();assert.equal(deleted,targets);assert.equal(b.backdrop,null);
});
test('adaptive bloom reallocates its pyramid when quality changes at the same resolution',()=>{
 const gl=new Proxy({FRAMEBUFFER_COMPLETE:1,UNSIGNED_BYTE:2,getExtension:()=>null,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,n)=>n,checkFramebufferStatus:()=>1},{get:(o,k)=>k in o?o[k]:(()=>({}))});
 const b=new Bloom(gl,null);assert.ok(b.begin(512,512));assert.equal(b.levels.length,5);const old=b.scene;b.levelCount=2;assert.ok(b.begin(512,512));assert.equal(b.levels.length,2);assert.notEqual(b.scene,old);const current=b.scene;assert.ok(b.begin(512,512));assert.equal(b.scene,current);b.levelCount=5;assert.ok(b.begin(512,512));assert.equal(b.levels.length,5);
});
test('bloom retries a smaller target after transient allocation pressure',()=>{
 let complete=0;const gl=new Proxy({FRAMEBUFFER_COMPLETE:1,UNSIGNED_BYTE:2,getExtension:()=>null,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,n)=>n,checkFramebufferStatus:()=>complete},{get:(o,k)=>k in o?o[k]:(()=>({}))});
 const b=new Bloom(gl,null);assert.equal(b.begin(512,512),false);complete=1;assert.equal(b.begin(512,512),false);assert.equal(b.begin(256,256),true);assert.ok(b.ok);
});
