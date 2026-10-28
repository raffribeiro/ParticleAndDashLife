// Preserve phase on high-refresh displays; discard time spent suspended.
export class FrameClock {
 constructor(hz=60){this.interval=1000/hz;this.next=null;}
 due(now){if(this.next===null){this.next=now+this.interval;return true;}if(now+this.interval*.3<this.next)return false;this.next=now-this.next>this.interval*3?now+this.interval:this.next+this.interval;return true;}
 setRate(hz){if(!Number.isFinite(hz)||hz<=0)return;const interval=1000/hz;if(this.interval!==interval){this.interval=interval;this.reset();}}
 reset(){this.next=null;}
}

// Only the waiting screen enters a lighter mode; the selected simulation profile stays fixed.
export class OpeningIdle{
 constructor(delay=15000){this.delay=delay;this.since=null;}
 update(now,{ready=false,started=false,hidden=false}={}){if(!ready||started||hidden){this.since=null;return false;}this.since??=now;return now-this.since>=this.delay;}
}
