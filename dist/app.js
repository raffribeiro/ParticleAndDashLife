import {runPreflight,measureRender} from './preflight.js?v=1.41.2';
import {PerformanceGovernor} from './performance.js?v=1.41.2';
import {prepareOpening} from './opening-motion.js?v=1.41.2';
window.lumaOpening=prepareOpening();
import {SceneGesture} from './scene-interaction.js?v=1.41.2';
import {BigBang} from './big-bang.js?v=1.41.2';
import {mergeChanged} from './pending-changes.js?v=1.41.2';
import {DoubleTap} from './tap-gesture.js?v=1.41.2';
import {canvasSize} from './canvas-size.js?v=1.41.2';
import {FrameClock} from './timing.js?v=1.41.2';
// App version: shown in the corner; compared with version.json (never cached) to detect a stale load.
let lowFps=0,lowUntil=0;export const VERSION='1.41.2';
{const tag=document.createElement('div');tag.id='version';tag.textContent='v'+VERSION;document.body.appendChild(tag);
 fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(j=>{if(j.version!==VERSION){tag.textContent='v'+VERSION+' · disponível v'+j.version+' — Cmd+Shift+R';tag.classList.add('stale');}}).catch(()=>{});}
import {Simulation,COLORS,PRESETS} from './simulation.js?v=1.41.2';import {makePalette,PALETTES,OPENING_PALETTE,randomTriple,lerpPalette} from './color.js?v=1.41.2';import {Renderer} from './renderer.js?v=1.41.2';
const $=id=>document.getElementById(id),canvas=$('universe');window.lumaLoader?.set(.45,'Preparando a GPU');let renderer;try{renderer=new Renderer(canvas);}catch(e){window.lumaLoader?.fail('Este navegador não conseguiu iniciar o WebGL.');$('notice').textContent=e.message;$('notice').style.display='block';throw e;}
window.lumaLoader?.set(.62,'Iniciando a simulação');let loaderSnapshot=false;
const s=new Simulation(120,canvasSize(canvas).width,canvasSize(canvas).height);new BigBang(s);s.openingColorMix=0;s.openingScale=1;s.radius=150;s.force=1.5;s.setInertia(1);let paused=matchMedia('(prefers-reduced-motion: reduce)').matches,pointer=null,current='symbiosis',last=0,accumulator=0,frames=0,sample=0,lastRender=0,needsRender=true;const fmt=n=>n.toLocaleString('pt-BR');
let requestedSize={width:s.width,height:s.height};
const disturbance={enabled:true,interval:20,strength:.6,pulseOnly:true};let bonding=true;const walkerConfig={enabled:true,max:24};const combatConfig={enabled:true};let disturbanceCount=0,nextDisturbance=20;
let mobilityMin=1,mobilityMax=1;let matrixRevision=0,lastBehaviorPaint=0;const behaviorConfig={enabled:false,interval:30};
const creatureConfig={enabled:true,count:30,wake:true,mood:true,moodPeriod:45};let creatureStats=null,wiggle=2;
// Pop is the default art direction (matches the loading screen); other palettes keep the dark glow look.
const paletteState={rotate:0,preset:'pop',triple:{...OPENING_PALETTE},auto:true,interval:45};let livePalette=null,paletteFrom=null,paletteTo=null,paletteT0=0,nextPaletteAt=0,lastPaletteTick=0;const PALETTE_FADE=6000;let renderScale=1,idleTimer=null;
// 60 fps render, matched to the 60 Hz physics in the worker.
const governor=new PerformanceGovernor();governor.beginPopulation(+$('population').value);let preflightStarted=false,preflightReady=false,benchmarkId=0;const benchmarkJobs=new Map();const startButton=$('start-simulation');startButton.dataset.preflight='running';startButton.querySelector('span').textContent='Testando aparelho…';
function applyQuality(notify=true){const q=governor.quality;renderer.quality=q;renderer.scale=renderScale=q.scale;document.body.dataset.performanceTexture=q.texture;needsRender=true;if(notify)worker.postMessage({kind:'population-budget',factor:governor.populationScale,target:+$('population').value});}
applyQuality(false);
const clock=new FrameClock(60);let started=false,settingsReady=false,openingRevision=null;let revision=0,snapshotAt=performance.now(),stepMs=0;
const worker=new Worker(new URL('./worker.js?v='+VERSION,import.meta.url),{type:'module'});
function sync(){worker.postMessage({kind:'config',populationScale:governor.populationScale,populationTarget:+$('population').value,matrixRevision,behaviorKey:current,behaviorCycle:behaviorConfig,creatures:creatureConfig,wiggle,bonding,walkers:walkerConfig,combat:combatConfig,disturbance,inertia:s.inertia,dynamicMobility:s.dynamicMobility,paused,visible:!document.hidden,pointer,matrix:s.matrix,radius:s.radius,force:s.force,ecology:s.ecology,width:requestedSize.width,height:requestedSize.height});}
worker.onmessage=({data:m})=>{if(m.kind==='benchmark-result'){const job=benchmarkJobs.get(m.id);if(job){clearTimeout(job.timer);benchmarkJobs.delete(m.id);m.error?job.reject(Error(m.error)):job.resolve(m);}return;}if(!loaderSnapshot){loaderSnapshot=true;needsRender=true;window.lumaLoader?.set(.88,'Formando o universo');}if(m.revision!==revision||m.width!==requestedSize.width||m.height!==requestedSize.height)return;s.width=m.width;s.height=m.height;canvas.classList.toggle('grabbing',!!m.dragging);if(m.openingWaiting)openingRevision=m.revision;for(const key of ['x','y','vx','vy','type','energy','fx','size','pulse','minor'])s[key]=m[key];s.openingScale=m.openingScale??1;s.openingColorMix=m.openingColorMix??1;s.openingGlow=m.openingGlow||0;s.count=m.count;s.historyRevision=m.revision;s.consumed=m.consumed;s.combat=m.combat;s.populationTotal=m.populationTotal??m.count;s.ecosystem=m.ecosystem;s.changed=mergeChanged(s.changed,m.changed,m.count);s.events=[...(s.events||[]),...(m.events||[])].slice(-32);s.habitats=m.habitats;if(m.ecosystem&&$('ecosystem-status'))$('ecosystem-status').textContent=m.ecosystem.hunters+' caçadores · '+m.ecosystem.evaders+' evasivos · '+m.ecosystem.resting+' em repouso · '+m.ecosystem.memories+' com memória · '+m.ecosystem.hunting+' caçando · '+m.ecosystem.births+' filhotes';s.bonds=m.bonds;s.walkers=m.walkers;s.creatures=m.creatures;creatureStats=m.creatureStats;snapshotAt=performance.now();stepMs=m.stepMs;if(m.behavior){
 s.matrix=m.behavior.matrix;
 if(behaviorConfig.enabled){const changed=current!==m.behavior.key;current=m.behavior.key;
  document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset==='random'));
  if(PRESETS[current])$('preset-description').textContent='Aleatório · '+(m.behavior.changing?'transição para ':'agora: ')+PRESETS[current].name+' · próxima em '+Math.ceil(m.behavior.next)+' s. '+PRESETS[current].description;
  $('behavior-status').textContent=m.behavior.changing?'Mudando suavemente…':'Próxima mudança em '+Math.ceil(m.behavior.next)+' s';
  if(changed||(m.behavior.changing&&performance.now()-lastBehaviorPaint>750)){matrix();lastBehaviorPaint=performance.now();}
 }else $('behavior-status').textContent='Simbiose fixa';
}mobilityMin=m.mobilityMin;mobilityMax=m.mobilityMax;disturbanceCount=m.disturbanceCount;nextDisturbance=m.nextDisturbance;if(m.disturbanceEvent){const event=m.disturbanceEvent;if(event.kind==='affinities'){$('last-disturbance').textContent='✧ As afinidades estão mudando';s.matrix=event.matrix;matrix();if(!behaviorConfig.enabled){document.querySelectorAll('.preset').forEach(p=>p.classList.remove('active'));current='custom';$('preset-description').textContent='As afinidades mudaram suavemente. Um novo equilíbrio está surgindo.';}}else{$('last-disturbance').textContent='◌ Onda de impulso atravessando a colônia';}}needsRender=true;};
worker.onerror=()=>{window.lumaLoader?.fail('A simulação não conseguiu iniciar. Recarregue a página.');$('notice').textContent='A simulação foi interrompida. Recarregue a página para reiniciar.';$('notice').style.display='block';};
worker.postMessage({kind:'init',waitForFrame:true,count:s.count,populationTarget:+$('population').value,width:s.width,height:s.height});
const resetLocal=s.reset.bind(s);s.reset=(count=+$('population').value)=>{governor.beginPopulation(count);resetLocal(governor.enabled?Math.min(count,120):count);new BigBang(s);s.openingColorMix=0;s.openingScale=1;s.creatures=[];s.walkers=[];s.combat=null;s.events=[];s.changed=null;revision++;sceneGesture.cancel();canvas.classList.remove('grabbing');s.historyRevision=revision;worker.postMessage({kind:'reset',waitForFrame:true,revision,count:s.count,populationTarget:count});needsRender=true;};
function legend(){if(!$('legend'))return;$('legend').replaceChildren();for(const c of COLORS){const dot=document.createElement('i');dot.style.color=dot.style.background=c;$('legend').append(dot);}}
function paletteSource(){return paletteState.preset==='generated'?paletteState.triple:paletteState.preset;}
function commitPalette(p){livePalette=p;document.body.classList.toggle('pop',!!p.pop);['--pop-base-1','--pop-base-2','--pop-hot-1','--pop-hot-2','--pop-accent-1','--pop-accent-2'].forEach((k,i)=>document.documentElement.style.setProperty(k,p.colors[i]));COLORS.splice(0,COLORS.length,...p.colors);renderer.setPalette(p);const root=document.documentElement.style,hex=c=>'#'+c.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');root.setProperty('--mint',p.colors[4]);for(const [key,i] of [['blue',0],['pink',2],['lime',4]])root.setProperty('--start-'+key,p.colors[i]);root.setProperty('--bg',hex(p.background));root.setProperty('--panel',hex(p.panel));document.querySelector('meta[name=theme-color]').content='#'+p.background.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
// Palette changes cross-fade in OKLab over 6 s (instant with reduced motion or rotation).
function applyPalette(animate=false){const target=makePalette(paletteSource(),paletteState.rotate);if(animate&&livePalette&&!matchMedia('(prefers-reduced-motion: reduce)').matches){paletteFrom=livePalette;paletteTo=target;paletteT0=performance.now();}else{paletteFrom=paletteTo=null;commitPalette(target);legend();matrix();}needsRender=true;}
function markPalette(){document.querySelectorAll('.palette').forEach(x=>x.classList.toggle('active',x.dataset.palette===paletteState.preset));}
function newPalette(){if(paletteState.preset==='pop'){{let r=(paletteState.rotate+60+Math.random()*60)%360;if(r>180)r-=360;paletteState.rotate=Math.round(r);}const h=$('hue');if(h){h.value=paletteState.rotate;$('hue-value').textContent=paletteState.rotate+'°';}applyPalette(true);nextPaletteAt=performance.now()+paletteState.interval*1000;return;}paletteState.triple=randomTriple(Math.random,livePalette?.triple);paletteState.preset='generated';markPalette();applyPalette(true);nextPaletteAt=performance.now()+paletteState.interval*1000;}
function stepPalette(now){
 if(paletteTo){const t=Math.min(1,(now-paletteT0)/PALETTE_FADE),e=t*t*(3-2*t);commitPalette(lerpPalette(paletteFrom,paletteTo,e));needsRender=true;if(t>=1){commitPalette(paletteTo);paletteTo=null;legend();matrix();}}
 // Automatic palette evolution; the countdown freezes while paused or hidden.
 const dt=lastPaletteTick?now-lastPaletteTick:0;lastPaletteTick=now;
 if(!paletteState.auto){return;}if(!nextPaletteAt)nextPaletteAt=now+paletteState.interval*1000;
 if(paused||!started)nextPaletteAt+=dt;else if(now>=nextPaletteAt)newPalette();
}
for(const [key,P] of Object.entries(PALETTES)){const b=document.createElement('button');b.className='palette'+(key===paletteState.preset?' active':'');b.dataset.palette=key;const sw=document.createElement('span');sw.className='swatches';for(const c of makePalette(key,0).colors){const i=document.createElement('i');i.style.background=c;sw.append(i);}b.append(P.name,sw);b.onclick=()=>{paletteState.preset=key;markPalette();applyPalette(true);nextPaletteAt=performance.now()+paletteState.interval*1000;};$('palettes').append(b);}
{const b=document.createElement('button');b.className='palette';b.dataset.palette='generated';b.innerHTML='✧ Gerar<span class="swatches"><i style="background:conic-gradient(oklch(.7 .07 250),oklch(.78 .13 190),oklch(.9 .2 330),oklch(.7 .07 250))"></i></span>';b.onclick=newPalette;$('palettes').append(b);}
$('hue').oninput=e=>{paletteState.rotate=+e.target.value;$('hue-value').textContent=e.target.value+'°';applyPalette();};
$('palette-auto').onchange=e=>{paletteState.auto=e.target.checked;nextPaletteAt=0;};
$('palette-interval').oninput=e=>{paletteState.interval=+e.target.value;$('palette-interval-value').textContent=e.target.value+' s';nextPaletteAt=0;};
function matrix(){const el=$('matrix');el.replaceChildren();el.append(document.createElement('span'));for(const c of COLORS){const i=document.createElement('i');i.style.background=c;el.append(i);}s.matrix.forEach((row,a)=>{const i=document.createElement('i');i.style.background=COLORS[a];el.append(i);row.forEach((v,b)=>{const button=document.createElement('button');button.textContent=(v>0?'+':'')+v.toFixed(1);button.style.background=v>0?`rgba(119,221,169,${Math.abs(v)*.24+.03})`:`rgba(196,137,180,${Math.abs(v)*.24+.03})`;button.setAttribute('aria-label',`Espécie ${a+1} para ${b+1}: ${v.toFixed(1)}`);button.onclick=()=>{matrixRevision++;current='custom';s.matrix[a][b]=v<-.1?0:v<.1?.7:-.7;document.querySelectorAll('.preset').forEach(p=>p.classList.remove('active'));$('preset-description').textContent='Afinidades personalizadas. Observe o que muda.';matrix();$('matrix').querySelectorAll('button')[a*6+b].focus();};el.append(button);});});}
function preset(key){if(key==='random'){behaviorConfig.enabled=true;behaviorConfig.kick=Date.now();document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset==='random'));$('preset-description').textContent='Alterna entre Simbiose, Correntes, Predador e presa e Colônias a cada '+behaviorConfig.interval+' s, com transição suave.';sync();return;}behaviorConfig.enabled=false;matrixRevision++;current=key;s.preset(key);document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===key));$('preset-description').textContent=PRESETS[key].description;matrix();}document.querySelectorAll('.preset').forEach(b=>b.onclick=()=>preset(b.dataset.preset));preset(current);applyPalette();
$('auto-quality').onchange=e=>{if(started)return;governor.setEnabled(e.target.checked);applyQuality();};
$('recalibrate').onclick=()=>{if(started)return;preflightStarted=false;preflightReady=false;startButton.disabled=true;};
$('start-simulation').onclick=()=>{if(started||!preflightReady)return;started=true;$('auto-quality').disabled=true;$('recalibrate').disabled=true;window.lumaOpening?.stop();paused=false;lastPaletteTick=0;nextPaletteAt=0;$('start-screen').hidden=true;document.body.classList.remove('awaiting-start');$('start-simulation').blur();needsRender=true;updatePause();sync();};
function updatePause(){ $('pause').textContent=paused?'▶ Continuar':'Ⅱ Pausar';$('status').textContent=paused?'Universo em pausa':'Universo em movimento';}function togglePause(){paused=!paused;accumulator=0;sync();updatePause();}updatePause();$('pause').onclick=togglePause;
$('reset').onclick=()=>s.reset();// Random behavior: a fresh affinity matrix; a click on Aleatório again draws another.
function randomBehavior(){behaviorConfig.enabled=false;matrixRevision++;current='custom';s.matrix=s.matrix.map(row=>row.map(()=>Math.round((Math.random()*2-1)*10)/10));document.querySelectorAll('.preset').forEach(p=>p.classList.remove('active'));$('preset-description').textContent='Afinidades sorteadas. Clique em Sortear de novo para outras.';matrix();}$('random').onclick=randomBehavior;
$('population').oninput=e=>$('population-value').textContent=fmt(+e.target.value);$('population').onchange=e=>{s.reset(+e.target.value);$('count').textContent=fmt(s.count);$('bond-status').textContent=bonding?fmt((s.bonds?.length||0)/2)+' ligações':'Desligadas';$('walker-status').textContent=walkerSummary();if(creatureStats){const st=creatureStats;$('mood-status').textContent=!creatureConfig.mood?'Sempre inimigos':(st.friends+' amigos · '+(st.fish-st.friends)+' inimigos');}};
for(const [id,apply,format] of [['radius',v=>s.radius=v,v=>v],['force',v=>s.force=v,v=>v.toFixed(2).replace('.',',')],['glow',v=>renderer.glow=v/100,v=>v+'%'],['trail',v=>renderer.trail=v/100,v=>v===0?'Desligado':v+'%']]){$(id).oninput=e=>{const v=+e.target.value;apply(v);$(id+'-value').textContent=format(v);};}
$('wiggle').oninput=e=>{wiggle=+e.target.value/100;$('wiggle-value').textContent=e.target.value==='0'?'Desligado':e.target.value+'%';};
$('bloom').oninput=e=>{renderer.bloom.intensity=+e.target.value/100;document.documentElement.style.setProperty('--pp-bloom',Math.min(1.2,+e.target.value/250));$('bloom-value').textContent=e.target.value==='0'?'Desligado':e.target.value+'%';};renderer.bloom.intensity=1.6;renderer.glow=1;renderer.trail=0;
$('creatures-enabled').onchange=e=>creatureConfig.enabled=e.target.checked;
$('creature-count').oninput=e=>{creatureConfig.count=+e.target.value;$('creature-count-value').textContent=e.target.value;};
$('creature-wake').onchange=e=>creatureConfig.wake=e.target.checked;
$('creature-mood').onchange=e=>creatureConfig.mood=e.target.checked;
$('mood-period').oninput=e=>{creatureConfig.moodPeriod=+e.target.value;$('mood-period-value').textContent=e.target.value+' s';};
$('creatures-new').onclick=()=>worker.postMessage({kind:'spawn-creatures',seed:(Math.random()*2**32)>>>0});
function creatureSummary(){if(!creatureConfig.enabled||!creatureStats)return 'Desligados';const st=creatureStats;return fmt(st.fish)+' peixes · '+fmt(st.births)+' nascimentos · '+fmt(st.deaths)+' mortes · '+fmt(st.bites)+' comidas · '+fmt(st.excreted)+' excretadas';}
$('inertia').oninput=e=>{s.setInertia(+e.target.value/100);$('inertia-value').textContent=e.target.value+'%';};
$('bonding').onchange=e=>bonding=e.target.checked;
$('walkers-enabled').onchange=e=>walkerConfig.enabled=e.target.checked;
$('combat-enabled').onchange=e=>combatConfig.enabled=e.target.checked;
$('grain').oninput=e=>{renderer.bloom.grain=0;document.documentElement.style.setProperty('--pp-grain',+e.target.value/100);$('grain-value').textContent=e.target.value==='0'?'Desligado':e.target.value+'%';};renderer.bloom.grain=0;
$('scanlines').oninput=e=>{renderer.bloom.scan=+e.target.value/100;document.documentElement.style.setProperty('--pp-scan',+e.target.value/100);$('scanlines-value').textContent=e.target.value==='0'?'Desligado':e.target.value+'%';};renderer.bloom.scan=.35;
const FACTION_NAMES=['Enxame','Colosso','Místico'];
function walkerSummary(){return walkerConfig.enabled?(s.walkers?.length||0)+' andando'+(s.ecosystem?.plans?' ('+Object.entries(s.ecosystem.plans).map(([k,n])=>n+' '+({lizard:'lagarto',spider:'aranha',centipede:'centopeia',snake:'serpente',jelly:'água-viva',hybrid:'híbrido'}[k]||k)+(n>1?'s':'')).join(', ')+')':'')+' · '+(s.ecosystem?.fragments||0)+' fragmentações · '+(s.ecosystem?.shed||0)+' soltas · '+(s.ecosystem?.eaten||0)+' comidas':'Desligadas';}
function combatSummary(){const c=s.combat?.stats;if(!combatConfig.enabled||!c)return 'Desligado';return c.factions.map((n,i)=>FACTION_NAMES[i]+' '+n).join(' · ')+' — '+c.kills+' derrotas · '+c.severed+' pedaços'+(c.starActive?' · ★ estrela no mapa':'')+(c.balance?' · equilíbrio: dano ×'+c.balance.damage.toFixed(2).replace('.',',')+', agressão ×'+c.balance.aggression.toFixed(2).replace('.',',')+', em luta '+Math.round(c.balance.engaged*100)+'%':'');}
$('dynamic-mobility').onchange=e=>s.dynamicMobility=e.target.checked;
$('ecology').checked=s.ecology;
$('ecology').onchange=e=>s.ecology=e.target.checked;
$('behavior-auto').onchange=e=>{behaviorConfig.enabled=e.target.checked;};
$('behavior-interval').oninput=e=>{behaviorConfig.interval=+e.target.value;$('behavior-interval-value').textContent=e.target.value+' s';};
$('disturbance-enabled').onchange=e=>disturbance.enabled=e.target.checked;
$('disturbance-interval').oninput=e=>{disturbance.interval=+e.target.value;$('disturbance-interval-value').textContent=disturbance.interval+' s';};
$('disturbance-strength').oninput=e=>{disturbance.strength=+e.target.value/100;$('disturbance-strength-value').textContent=e.target.value+'%';};
$('disturb-now').onclick=()=>worker.postMessage({kind:'disturb'});
function wallpaper(){if(!started||matchMedia('(pointer:coarse)').matches||document.body.classList.contains('touch-ui'))return;document.body.classList.remove('idle');document.body.classList.toggle('wallpaper');}$('wallpaper').onclick=wallpaper;$('restore').onclick=wallpaper;
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();wallpaper();return;}if(/INPUT|BUTTON|SUMMARY/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();togglePause();}if(e.key.toLowerCase()==='h')wallpaper();});
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});}let lastTouch=0;canvas.ondblclick=e=>{if(performance.now()-lastTouch>700){e.preventDefault();fullscreen();}};
const doubleTap=new DoubleTap();
canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;document.body.classList.add('touch-ui');lastTouch=performance.now();doubleTap.down(e.pointerId,e.clientX,e.clientY,lastTouch);});
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')doubleTap.move(e.pointerId,e.clientX,e.clientY);});
canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')return;lastTouch=performance.now();if(doubleTap.up(e.pointerId,e.clientX,e.clientY,lastTouch)){e.preventDefault();fullscreen();}});
canvas.addEventListener('pointercancel',e=>doubleTap.cancel(e.pointerId));
// Screensaver: hide UI and cursor after 30 s without input; any input restores.
function wake(){document.body.classList.remove('idle');clearTimeout(idleTimer);if($('screensaver').checked)idleTimer=setTimeout(()=>document.body.classList.add('idle'),30000);}
for(const ev of ['pointermove','pointerdown','keydown','wheel','touchstart'])addEventListener(ev,wake,{passive:true});$('screensaver').onchange=wake;wake();
const sceneGesture=new SceneGesture();
function worldPoint(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*s.width,y:(e.clientY-r.top)/r.height*s.height};}
function interact(action,e){worker.postMessage({kind:'interact',revision,action,...(e?worldPoint(e):{})});}
function cancelGesture(){sceneGesture.cancel();canvas.classList.remove('grabbing');interact('cancel');}
canvas.onpointerdown=e=>{if(!started||s.width!==requestedSize.width||s.height!==requestedSize.height||e.button!==0||!e.isPrimary)return;if(!sceneGesture.down(e.pointerId,e.clientX,e.clientY))return;canvas.setPointerCapture(e.pointerId);interact('grab',e);};
canvas.onpointermove=e=>{if(sceneGesture.move(e.pointerId,e.clientX,e.clientY))interact('move',e);};
canvas.onpointerup=e=>{const action=sceneGesture.up(e.pointerId,e.clientX,e.clientY);if(action)interact(action,e);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
canvas.onpointercancel=canvas.onlostpointercapture=()=>{if(sceneGesture.pointer)cancelGesture();};
window.addEventListener('blur',cancelGesture);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;updatePause();$('notice').textContent='A GPU interrompeu a renderização. Recarregue para continuar.';$('notice').style.display='block';});
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;sample=performance.now();frames=0;needsRender=true;clock.reset();governor.sample(performance.now(),{active:false});sync();});
for(const event of ['click','input','change','keydown'])document.addEventListener(event,()=>{needsRender=true;sync();});
function resizeCanvas(){const next=canvasSize(canvas);if(next.width===requestedSize.width&&next.height===requestedSize.height)return;cancelGesture();governor.restart();if(!started){if(preflightReady)preflightStarted=false;preflightReady=false;startButton.dataset.preflight='running';startButton.disabled=true;startButton.querySelector('span').textContent='Testando aparelho…';}requestedSize=next;pointer=null;needsRender=true;sync();}
const canvasObserver=new ResizeObserver(resizeCanvas);canvasObserver.observe(canvas);window.addEventListener('resize',resizeCanvas);
async function startPreflight(){
 preflightStarted=true;const testedSize={...requestedSize};
 try{
  const requested=+$('population').value;
  const result=await runPreflight({requested,onProgress:n=>{$('preflight-status').textContent='Testando desempenho · '+fmt(n)+' partículas';},
   measureCPU:count=>new Promise((resolve,reject)=>{const id=++benchmarkId,timer=setTimeout(()=>{benchmarkJobs.delete(id);reject(Error('benchmark timeout'));},12000);benchmarkJobs.set(id,{resolve,reject,timer});worker.postMessage({kind:'benchmark',id,options:{count,width:s.width,height:s.height,radius:s.radius,force:s.force,fish:creatureConfig.count}});}),
   measureGPU:(snapshot,quality)=>measureRender(renderer,snapshot,s,quality)});
  governor.applyPreflight(result);governor.lockSession();applyQuality();
  $('preflight-status').textContent=result.limited?'Modo leve preparado · qualidade fixa nesta sessão':'Teste concluído · meta 60 fps · início leve';
 }catch(error){governor.applyPreflight({capacity:100,level:5});governor.lockSession();applyQuality();$('preflight-status').textContent='Início conservador · qualidade fixa nesta sessão';}
 if(testedSize.width!==requestedSize.width||testedSize.height!==requestedSize.height){preflightStarted=false;return;}
 preflightReady=true;startButton.dataset.preflight='ready';startButton.querySelector('span').textContent='Start Simulation';startButton.disabled=startButton.dataset.openingReady!=='true';needsRender=true;
}
function tick(now){requestAnimationFrame(tick);if(document.hidden||!clock.due(now))return;stepPalette(now);if(settingsReady&&loaderSnapshot&&!preflightStarted)startPreflight();let didDraw=false;if(!paused||needsRender){const drawStart=performance.now();renderer.draw(s,paused?0:Math.min(1.5,(now-snapshotAt)/(1000/60)));didDraw=true;const drawMs=performance.now()-drawStart;needsRender=false;if(governor.sample(now,{active:started&&!paused&&s.openingColorMix>=1,drawMs,stepMs,populationTotal:s.populationTotal}))applyQuality();if(loaderSnapshot&&settingsReady)window.lumaLoader?.done();if(started&&settingsReady&&openingRevision===revision&&!paused&&!document.hidden){const readyRevision=openingRevision;openingRevision=null;requestAnimationFrame(()=>worker.postMessage({kind:'start-opening',revision:readyRevision}));}}if(didDraw)frames++;if(!sample)sample=now;if(now-sample>=1000){const fps=frames*1000/(now-sample);$('fps').textContent=Math.round(fps);
   // fps watch: below 60 (57.5 to ignore 1-frame jitter) the counter and the corner tag turn red; drops are logged to the local server.
   {const low=!paused&&!document.hidden&&fps<57.5,tag=$('version');$('fps').classList.toggle('fps-low',low);
    if(low){lowFps=Math.round(fps);lowUntil=now+4000;if(!location.hostname.endsWith('github.io'))fetch('/fps-log',{method:'POST',body:JSON.stringify({fps:lowFps,scale:renderScale,stepMs:+stepMs.toFixed(1),count:s.count,orgs:s.walkers?.length||0,v:VERSION})}).catch(()=>{});}
    if(tag&&!tag.classList.contains('stale')){const show=now<lowUntil;tag.classList.toggle('fps-low',show);tag.textContent='v'+VERSION+(show?' · '+lowFps+' fps':'');}}
   $('performance-status').textContent=started?governor.summary+(governor.populationScale<1?' · limite inicial de população':''):(preflightReady?'Teste prévio concluído · partida leve':'Testando aparelho antes de iniciar…');
   $('fps').title='Física: '+stepMs.toFixed(1).replace('.',',')+' ms por atualização · resolução '+Math.round(renderScale*100)+'% · quadro p95 '+governor.frameMs.toFixed(1)+' ms';$('creature-status').textContent=creatureSummary();$('combat-status').textContent=combatSummary();$('count').textContent=fmt(s.count);$('bond-status').textContent=bonding?fmt((s.bonds?.length||0)/2)+' ligações':'Desligadas';$('walker-status').textContent=walkerSummary();if(creatureStats){const st=creatureStats;$('mood-status').textContent=!creatureConfig.mood?'Sempre inimigos':(st.friends+' amigos · '+(st.fish-st.friends)+' inimigos');}$('palette-status').textContent=paletteState.auto?(paletteTo?'Transição em curso':'Próxima em '+Math.max(0,Math.ceil((nextPaletteAt-now)/1000))+' s'):'Automático desligado';frames=0;sample=now;$('mobility-range').textContent=s.dynamicMobility?mobilityMin.toFixed(2).replace('.',',')+'–'+mobilityMax.toFixed(2).replace('.',',')+'×':'Uniforme · 1,00×';$('disturbance-status').textContent=disturbance.enabled?(disturbance.pulseOnly||disturbanceCount%2===0?'Pulso':'Afinidades')+' em '+Math.ceil(nextDisturbance)+' s':'Automático desligado';$('feeding').textContent=s.ecology?' / '+fmt(s.consumed)+' trocas':'';}}
sync();

requestAnimationFrame(tick);
// Read-only observability for browser verification.
window.luma={get stats(){return {count:s.count,paused,consumed:s.consumed,finite:s.x.every(Number.isFinite),preset:current,stepMs,worker:true,creatures:creatureStats,renderScale,performance:{level:governor.level,fps:governor.fps,p95:governor.frameMs,calibrated:governor.calibrated,limited:governor.limited,quality:governor.quality.name},bloom:renderer.bloom.ok,palette:[...COLORS]};}};

// Save / restore: every panel control, behavior (preset, Aleatório or custom matrix) and palette.
// Stored on the local server (settings.json, survives restarts and cache clears) with localStorage as backup.
function collectSettings(){const inputs={};document.querySelectorAll('.panel input[id]').forEach(el=>{inputs[el.id]=el.type==='checkbox'?el.checked:el.value;});
 return {version:VERSION,saved:new Date().toISOString(),inputs,behavior:{mode:behaviorConfig.enabled?'random':current,matrix:s.matrix.map(r=>[...r])},palette:{preset:paletteState.preset,triple:paletteState.triple,rotate:paletteState.rotate,auto:paletteState.auto,interval:paletteState.interval}};}
function applySettings(cfg){if(!cfg||!cfg.inputs)return false;
 for(const [id,v] of Object.entries(cfg.inputs)){const el=$(id);if(!el||el.disabled)continue;if(el.type==='checkbox'){if(el.checked!==v){el.checked=v;el.dispatchEvent(new Event('change',{bubbles:true}));}}else if(el.value!==v){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}}
 // Settings saved before the pop art direction (v1.31) keep their controls but not their old palette.
 const older=String(cfg.version||'0').split('.').map(Number),legacy=(older[0]||0)<1||((older[0]||0)===1&&(older[1]||0)<31);
 const p=legacy?null:cfg.palette;if(p){Object.assign(paletteState,{preset:p.preset,triple:p.triple,rotate:p.rotate??paletteState.rotate,auto:p.auto??paletteState.auto,interval:p.interval??paletteState.interval});markPalette();applyPalette(false);}
 const b=cfg.behavior;if(b){if(b.mode==='random'||PRESETS[b.mode])preset(b.mode);else if(b.matrix){behaviorConfig.enabled=false;matrixRevision++;current='custom';s.matrix=b.matrix.map(r=>[...r]);document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));$('preset-description').textContent='Afinidades salvas.';matrix();}}
 sync();return true;}
async function saveSettings(){const cfg=collectSettings(),btn=$('save');let ok=false;
 try{localStorage.setItem('luma-settings',JSON.stringify(cfg));ok=true;}catch(e){}
 try{if(location.hostname.endsWith('github.io'))throw new Error('static-host');const r=await fetch('/settings',{method:'POST',body:JSON.stringify(cfg)});ok=ok||r.ok;}catch(e){}
 btn.textContent=ok?'✓ Salvo':'Falhou';setTimeout(()=>{btn.textContent='Salvar';},1600);}
$('save').onclick=saveSettings;
(async()=>{let cfg=null;try{const r=await fetch('settings.json?t='+Date.now(),{cache:'no-store'});if(r.ok)cfg=await r.json();}catch(e){}
 if(!cfg){try{cfg=JSON.parse(localStorage.getItem('luma-settings')||'null');}catch(e){}}
 if(cfg)applySettings(cfg);settingsReady=true;needsRender=true;})();
