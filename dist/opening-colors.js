import {ROLES,srgbToOklch,oklchToSrgb,mixOklab} from './color.js?v=1.39.0';
// ColorAtlas splash hues, raised to particle lightness/chroma for a luminous opening.
const atlas=[[.101508,.077805,.172419],[.020028,.113590,.186532],[0,.143670,.140297],[.064635,.150568,.066073],[.165163,.136417,.012548],[.232732,.118211,.155307]];
export const ATLAS_OPENING_COLORS=atlas.map((rgb,i)=>oklchToSrgb(ROLES[i].L,ROLES[i].C,srgbToOklch(rgb)[2]));
export function openingColors(target,mix=1){
 if(mix>=1)return target;
 if(mix<=0)return ATLAS_OPENING_COLORS;
 return target.map((rgb,i)=>mixOklab(ATLAS_OPENING_COLORS[i],rgb,mix));
}
