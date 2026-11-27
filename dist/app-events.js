export function advanceAudioState({audio,revision,generation,paused,visible}){
 const nextGeneration=generation+1;
 audio.setState({revision,generation:nextGeneration,paused,visible});
 return nextGeneration;
}

export function acknowledgeAudioMessage({audio,worker,message}){
 try{audio.handle(message);}
 finally{worker.postMessage({kind:'audio-ack',revision:message.revision,generation:message.generation,sequence:message.sequence});}
}

export function setupAudioStart({audio,onAccepted}){
 audio.prepare();let accepted=false;
 return (ready,event)=>{if(accepted||!ready)return false;accepted=true;onAccepted();audio.acceptStart(event);return true;};
}

export function createWebglContextLostHandler({pause,notice}){
 return event=>{event.preventDefault();pause();notice.textContent='GPU rendering was interrupted. Reload to continue.';notice.style.display='block';};
}
