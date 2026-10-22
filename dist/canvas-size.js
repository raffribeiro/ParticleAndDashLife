// CSS dimensions are independent from the drawing buffer and the browser window.
export function canvasSize(canvas,fallback={width:1,height:1}){
 const rect=canvas.getBoundingClientRect?.();
 return {width:Math.max(1,canvas.clientWidth??rect?.width??fallback.width),height:Math.max(1,canvas.clientHeight??rect?.height??fallback.height)};
}
