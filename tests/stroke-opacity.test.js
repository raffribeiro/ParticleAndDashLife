import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CreatureMesh} from '../dist/creature-mesh.js';
const species={rgb:[.7,.5,.2],rim:[.9,.8,.6],accent:[.8,.6,.4],deep:[.2,.1,.05]};
test('stroke fill stays opaque across age, energy, mood and attached roles',()=>{
 for(const kind of ['rectangle','line'])for(const life of [0,.1,1])for(const energy of [.25,2])for(const mood of [-1,1])for(const role of [undefined,'leg','tail','head']){
  const mesh=new CreatureMesh(null,null);mesh.palette={species:Array(6).fill(species)};
  mesh[kind]({id:1,points:[10,10,20,12,30,10],life,energy,mood,role,stretch:2,maturity:.8},species);
  const solid=[];for(let i=0;i<mesh.n;i++)if(mesh.data[i*9+8]===5)solid.push(mesh.data[i*9+5]);
  assert.ok(solid.length>0);assert.ok(solid.every(a=>a===1),`${kind}: ${life}, ${energy}, ${mood}, ${role}`);
 }
});
test('stroke shader uses coverage alone for alpha independently of glow and tint',()=>{
 const source=readFileSync(new URL('../dist/creature-mesh.js',import.meta.url),'utf8');
 const branch=source.match(/if\(sh\.z>4\.5\)\{([^}]+)\}/)?.[1];
 assert.ok(branch);assert.match(branch,/vec4\(clamp\(tint\.rgb\*shade,0\.,\.98\),edge\)/);assert.doesNotMatch(branch,/tint\.a|glow/);
});
