import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function opening(){const classes=new Set(),notice={style:{}},timers=[],window={};runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{window,document:{body:{classList:{add:c=>classes.add(c)}},getElementById:id=>id==='notice'?notice:null},setTimeout(fn,ms){timers.push({fn,ms});}});return {api:window.lumaLoader,classes,notice,timers};}
test('opening reveals title then Start after readiness, without a loading screen',()=>{const {api,classes,timers}=opening();assert.doesNotMatch(html,/id="loader"/);assert.equal(classes.size,0);api.set(.88);api.done();api.done();assert.equal(timers.length,2);assert.equal(classes.size,0);timers.find(t=>t.ms===650).fn();assert.ok(classes.has('show-title'));assert.ok(!classes.has('show-start'));timers.find(t=>t.ms===1250).fn();assert.ok(classes.has('show-start'));});
test('opening failure displays an actionable notice',()=>{const {api,notice,timers}=opening();api.fail('Recarregue a página.');assert.equal(notice.textContent,'Recarregue a página.');assert.equal(notice.style.display,'block');assert.equal(timers.length,0);});

test('ready callback delegates once to the Remotion-authored entrance',()=>{let calls=0;const window={lumaOpening:{play(){calls++;}}};runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{window,document:{},setTimeout(){throw Error('fallback must not run');}});window.lumaLoader.done();window.lumaLoader.done();assert.equal(calls,1);});
