// Worker snapshots may arrive faster than drawing; retain slot invalidations until consumed.
export function mergeChanged(previous,incoming,count){
 if(!previous?.length&&!incoming?.length)return null;
 return Int32Array.from(new Set([...(previous||[]),...(incoming||[])].filter(i=>i>=0&&i<count)));
}
