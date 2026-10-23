import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function loader(){const nodes=Object.fromEntries(['loader','loader-fill','loader-text'].map(id=>[id,{style:{},classList:{add(c){this[c]=true;}}}])),timers=[];const window={};runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{window,document:{getElementById:id=>nodes[id]},setInterval:()=>1,clearInterval(){},setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){}});return {api:window.lumaLoader,nodes,timers};}
test('loading progress advances monotonically and only hides after completion',()=>{const {api,nodes,timers}=loader();assert.equal(nodes['loader'].hidden,undefined);api.set(.88,'Formando o universo');api.set(.45);assert.equal(nodes['loader-fill'].style.transform,'scaleX(0.88)');api.done();assert.equal(nodes['loader-fill'].style.transform,'scaleX(1)');timers.find(t=>t.ms===180).fn();assert.ok(nodes.loader.classList.leaving);timers.find(t=>t.ms===700).fn();assert.equal(nodes.loader.hidden,true);});
test('loading failure displays an actionable message',()=>{const {api,nodes}=loader();api.fail('Recarregue a página.');assert.ok(nodes.loader.classList.failed);assert.equal(nodes['loader-text'].textContent,'Recarregue a página.');assert.notEqual(nodes.loader.hidden,true);});
