import test from 'node:test';
import assert from 'node:assert/strict';
import {openingMotion as motion} from '../dist/opening-motion-data.js';
import {prepareOpening} from '../dist/opening-motion.js';
test('Remotion springs have a fast impact, overshoot and exact stable final pose',()=>{
 for(const frames of [motion.letters,motion.button]){
  assert.equal(frames[0].visibility,'hidden');assert.equal(frames.at(-1).transform,'translateY(0px) rotate(0deg) scale(1,1)');
  assert.ok(frames.some(k=>+k.transform.match(/scale\(([^,]+)/)[1]>1));
  assert.ok(frames.every(k=>!k.transform.includes('NaN')&&!('opacity' in k)));
 }
 assert.ok(motion.buttonDelay>motion.titleDelay+20*motion.letterStagger);
 assert.ok(motion.buttonDelay+motion.buttonDuration<1500);
});
function fixture(withLogo=false){const classes=new Set(),calls=[],letters=[],finished=[];
 const animate=(keyframes,options)=>{let resolve;const done=new Promise(r=>resolve=r);const a={finished:done,cancelled:false,cancel(){this.cancelled=true;}};calls.push({keyframes,options,a});finished.push(resolve);return a;};
 const logo=withLogo?{alt:'Particle & Dash Life',animate}:null;
 const title={querySelector:()=>logo,textContent:'Particle & Dash Life',setAttribute(){},replaceChildren(...nodes){letters.push(...nodes.flatMap(n=>n.children));}};
 const button={animate,disabled:false,dataset:{}};const doc={fonts:{ready:Promise.resolve()},body:{classList:{add(...c){c.forEach(x=>classes.add(x));},remove(c){classes.delete(c);}}},querySelector:()=>title,getElementById:()=>button,createElement:()=>({children:[],append(...nodes){this.children.push(...nodes);},setAttribute(){},style:{setProperty(k,v){this[k]=v;}},animate})};
 let seed=0;return {api:prepareOpening(doc,()=>((seed++*37)%101)/101),button,title,logo,classes,calls,letters,finished};}
test('entrance animates each letter once, enables the original button after settling and releases animations',async()=>{
 const f=fixture();assert.equal(f.button.disabled,true);f.api.play();f.api.play();await Promise.resolve();assert.equal(f.calls.length,f.letters.length+2);assert.ok(f.classes.has('show-title'));assert.equal(f.button.disabled,true);
 f.finished.at(-1)();await Promise.resolve();assert.equal(f.button.disabled,false);assert.ok(f.calls.every(c=>c.a.cancelled));
});
test('stopping before readiness prevents delayed animation from starting',async()=>{const f=fixture();f.api.play();f.api.stop();await Promise.resolve();assert.equal(f.calls.length,0);});
test('unsupported animation API shows usable title and button immediately',async()=>{const f=fixture();delete f.button.animate;f.api.play();await Promise.resolve();assert.equal(f.button.disabled,false);assert.ok(f.classes.has('show-start'));assert.equal(f.calls.length,0);});
test('reduced-motion skips springs while keeping Start usable',async()=>{const previous=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});try{const f=fixture();f.api.play();await Promise.resolve();assert.equal(f.button.disabled,false);assert.equal(f.calls.length,0);}finally{if(previous)globalThis.matchMedia=previous;else delete globalThis.matchMedia;}});
test('letters pulse independently only after the entrance and stop when simulation starts',async()=>{const f=fixture();assert.ok(!f.classes.has('title-pulsing'));const durations=f.letters.map(l=>l.style['--letter-pulse-duration']);assert.ok(new Set(durations).size>1);assert.ok(f.letters.every(l=>+l.style['--letter-pulse-scale']>=1.035&&+l.style['--letter-pulse-scale']<=1.09));f.api.play();await Promise.resolve();assert.ok(!f.classes.has('title-pulsing'));f.finished.at(-1)();await Promise.resolve();assert.ok(f.classes.has('title-pulsing'));f.api.stop();assert.ok(!f.classes.has('title-pulsing'));});
test('Start stays disabled while device preflight is running even after the entrance finishes',async()=>{const f=fixture();f.button.dataset.preflight='running';f.api.play();await Promise.resolve();f.finished.at(-1)();await Promise.resolve();assert.equal(f.button.disabled,true);assert.equal(f.button.dataset.openingReady,'true');});

test('supplied logo remains an image and receives the snap entrance without generating letters',async()=>{const f=fixture(true);assert.equal(f.letters.length,0);f.button.dataset.preflight='running';f.api.play();await Promise.resolve();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0].keyframes,motion.letters);f.finished.at(-1)();await Promise.resolve();assert.equal(f.button.disabled,true);assert.ok(f.calls.every(c=>c.a.cancelled));});
