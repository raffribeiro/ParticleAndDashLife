import {openingMotion} from './opening-motion-data.js?v=1.43.2';
// Keep the existing semantic heading and real button; only their transforms are animated.
export function prepareOpening(doc=document,rng=Math.random){
 const title=doc.querySelector('.start-title'),button=doc.getElementById('start-simulation');
 if(!title||!button)return null;
 const logo=title.querySelector?.('.opening-logo');
 const label=logo?logo.alt:title.textContent.trim();title.setAttribute('aria-label',label);
 const letters=logo?[logo]:Array.from(label,(char,index)=>{const el=doc.createElement('i');el.textContent=char===' '?'\u00a0':char;el.className='opening-letter'+(index>=9?' opening-accent':'');el.setAttribute('aria-hidden','true');const duration=1800+rng()*2600;el.style.setProperty('--letter-pulse-duration',Math.round(duration)+'ms');el.style.setProperty('--letter-pulse-delay',-Math.round(rng()*duration)+'ms');el.style.setProperty('--letter-pulse-scale',(1.035+rng()*.055).toFixed(3));return el;});
 if(!logo){const rows=[doc.createElement('span'),doc.createElement('span')];rows.forEach(row=>row.className='title-line');rows[0].append(...letters.slice(0,8));rows[1].append(...letters.slice(9));title.replaceChildren(...rows);}button.disabled=true;
 let played=false,stopped=false,animations=[];
 const enableButton=()=>{button.dataset.openingReady='true';button.disabled=button.dataset.preflight==='running';};
 const reveal=()=>{doc.body.classList.add('show-title','show-start');enableButton();};
 const stop=()=>{stopped=true;doc.body.classList.remove('title-pulsing');for(const a of animations)a.cancel();animations=[];};
 const play=()=>{if(played)return;played=true;
  Promise.resolve(doc.fonts?.ready).then(()=>{
   if(stopped)return;
   if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof button.animate!=='function'){reveal();return;}
   doc.body.classList.add('show-title','show-start','opening-animated');
   const options=(duration,delay)=>({duration,delay,fill:'both',easing:'linear'});
   animations=letters.map((letter,i)=>letter.animate(openingMotion.letters,options(openingMotion.letterDuration,openingMotion.titleDelay+i*openingMotion.letterStagger)));
   const pop=button.animate(openingMotion.button,options(openingMotion.buttonDuration,openingMotion.buttonDelay));animations.push(pop);
   pop.finished.then(()=>{if(stopped)return;enableButton();for(const a of animations)a.cancel();animations=[];doc.body.classList.remove('opening-animated');doc.body.classList.add('title-pulsing');}).catch(()=>{});
  });
 };
 return {play,stop};
}
