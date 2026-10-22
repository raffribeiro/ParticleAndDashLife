import test from 'node:test';import assert from 'node:assert/strict';
import {FarParticles} from '../dist/far-particles.js';
test('blurred background particles reuse a small static buffer',()=>{
 let uploads=0,draws=0,vertices=0;const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,n)=>n,bufferData:()=>uploads++,drawArrays:(_m,_f,n)=>{draws++;vertices=n;}},{get:(o,k)=>k in o?o[k]:(()=>({}))});
 const f=new FarParticles(gl,null);f.draw(900,650,0,[[.4,.6,.8]]);f.draw(900,650,1,[[.4,.6,.8]]);
 assert.equal(uploads,1);assert.equal(draws,4);assert.equal(vertices,8*6);assert.ok(f.data.every(Number.isFinite));for(let i=5;i<f.data.length;i+=7)assert.ok(f.data[i]>=.12&&f.data[i]<=.25);
});
test('background uses all three active palette roles and refreshes colours without reallocating',()=>{
 const colors=[];let uploads=0;const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,n)=>n,bufferData:()=>uploads++,uniform3f:(name,...rgb)=>colors.push([name,...rgb])},{get:(o,k)=>k in o?o[k]:(()=>({}))});
 const f=new FarParticles(gl,null),a=[[.2,.3,.4],[0,0,0],[.4,.5,.6],[0,0,0],[.7,.2,.1]],b=a.map(c=>c.map(v=>v*.5));f.draw(900,650,0,a);f.draw(900,650,1,b);
 assert.deepEqual(colors.slice(-3),[['tintA',...b[0]],['tintB',...b[2]],['tintC',...b[4]]]);assert.equal(uploads,1);
});
