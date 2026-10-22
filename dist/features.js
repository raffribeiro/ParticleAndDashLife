const KEYS=['armor','agility','digestion','regeneration','fertility','muscle'];
export function featureLevel(a,key){return a.features?.[key]||0;}
export function mutateFeature(a,rng=Math.random){
 a.features??={};const eligible=KEYS.filter(key=>featureLevel(a,key)<3&&(featureLevel(a,key)>0||Object.keys(a.features).length<4));
 if(!eligible.length)return null;
 const key=eligible[Math.min(eligible.length-1,Math.floor(rng()*eligible.length))];a.features[key]=featureLevel(a,key)+1;return key;
}
export function feedingFeatures(a,food,rng=Math.random){
 a.featureFood=(a.featureFood||0)+Math.max(0,food);
 if(a.featureFood+1e-9<.65)return null;
 a.featureFood=Math.max(0,a.featureFood-.65);return mutateFeature(a,rng);
}
export function inheritFeatures(parent,child,rng=Math.random){
 child.features={};for(const [key,level] of Object.entries(parent.features||{}))if(KEYS.includes(key)&&rng()<.75)child.features[key]=Math.min(3,level);
 mutateFeature(child,rng);
}
