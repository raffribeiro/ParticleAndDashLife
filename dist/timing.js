// Preserve phase on high-refresh displays; discard time spent suspended.
export class FrameClock {
 constructor(hz=60){this.interval=1000/hz;this.next=null;}
 due(now){if(this.next===null){this.next=now+this.interval;return true;}if(now+this.interval*.3<this.next)return false;this.next=now-this.next>this.interval*3?now+this.interval:this.next+this.interval;return true;}
 reset(){this.next=null;}
}
