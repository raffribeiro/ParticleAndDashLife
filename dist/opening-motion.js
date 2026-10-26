import {openingMotion} from './opening-motion-data.js?v=1.39.0';
// Keep the existing semantic heading and real button; only their transforms are animated.
export function prepareOpening(doc=document){
 const title=doc.querySelector('.start-title'),button=doc.getElementById('start-simulation');
 if(!title||!button)return null;
 const label=title.textContent.trim();title.setAttribute('aria-label',label);
 const letters=Array.from(label,(char,index)=>{const el=doc.createElement('i');el.textContent=char===' '?'\u00a0':char;el.className='opening-letter'+(index>=9?' opening-accent':'');el.setAttribute('aria-hidden','true');return el;});
 title.replaceChildren(...letters);button.disabled=true;
 let played=false,stopped=false,animations=[];
 const reveal=()=>{doc.body.classList.add('show-title','show-start');button.disabled=false;};
 const stop=()=>{stopped=true;for(const a of animations)a.cancel();animations=[];};
 const play=()=>{if(played)return;played=true;
  Promise.resolve(doc.fonts?.ready).then(()=>{
   if(stopped)return;
   if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof button.animate!=='function'){reveal();return;}
   doc.body.classList.add('show-title','show-start','opening-animated');
   const options=(duration,delay)=>({duration,delay,fill:'both',easing:'linear'});
   animations=letters.map((letter,i)=>letter.animate(openingMotion.letters,options(openingMotion.letterDuration,openingMotion.titleDelay+i*openingMotion.letterStagger)));
   const pop=button.animate(openingMotion.button,options(openingMotion.buttonDuration,openingMotion.buttonDelay));animations.push(pop);
   pop.finished.then(()=>{if(stopped)return;button.disabled=false;for(const a of animations)a.cancel();animations=[];doc.body.classList.remove('opening-animated');}).catch(()=>{});
  });
 };
 return {play,stop};
}
