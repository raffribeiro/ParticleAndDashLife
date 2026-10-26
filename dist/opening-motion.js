import {openingMotion} from './opening-motion-data.js?v=1.40.0';
// Keep the existing semantic heading and real button; only their transforms are animated.
export function prepareOpening(doc=document,rng=Math.random){
 const title=doc.querySelector('.start-title'),button=doc.getElementById('start-simulation');
 if(!title||!button)return null;
 const label=title.textContent.trim();title.setAttribute('aria-label',label);
 const letters=Array.from(label,(char,index)=>{const el=doc.createElement('i');el.textContent=char===' '?'\u00a0':char;el.className='opening-letter'+(index>=9?' opening-accent':'');el.setAttribute('aria-hidden','true');const duration=1800+rng()*2600;el.style.setProperty('--letter-pulse-duration',Math.round(duration)+'ms');el.style.setProperty('--letter-pulse-delay',-Math.round(rng()*duration)+'ms');el.style.setProperty('--letter-pulse-scale',(1.035+rng()*.055).toFixed(3));return el;});
 title.replaceChildren(...letters);button.disabled=true;
 let played=false,stopped=false,animations=[];
 const reveal=()=>{doc.body.classList.add('show-title','show-start');button.disabled=false;};
 const stop=()=>{stopped=true;doc.body.classList.remove('title-pulsing');for(const a of animations)a.cancel();animations=[];};
 const play=()=>{if(played)return;played=true;
  Promise.resolve(doc.fonts?.ready).then(()=>{
   if(stopped)return;
   if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof button.animate!=='function'){reveal();return;}
   doc.body.classList.add('show-title','show-start','opening-animated');
   const options=(duration,delay)=>({duration,delay,fill:'both',easing:'linear'});
   animations=letters.map((letter,i)=>letter.animate(openingMotion.letters,options(openingMotion.letterDuration,openingMotion.titleDelay+i*openingMotion.letterStagger)));
   const pop=button.animate(openingMotion.button,options(openingMotion.buttonDuration,openingMotion.buttonDelay));animations.push(pop);
   pop.finished.then(()=>{if(stopped)return;button.disabled=false;for(const a of animations)a.cancel();animations=[];doc.body.classList.remove('opening-animated');doc.body.classList.add('title-pulsing');}).catch(()=>{});
  });
 };
 return {play,stop};
}
