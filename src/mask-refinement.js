export function refineAlpha(value,threshold=.45,feather=.12) {
  const f=Math.max(.01,feather), t=Math.max(0,Math.min(1,(value-threshold+f)/(2*f)));
  return t*t*(3-2*t);
}
export function refineMask(data, previous, options={}) {
  const smooth=Math.max(0,Math.min(.8,options.smoothing??.2));
  for(let i=0;i<data.length;i+=4){const a=refineAlpha(data[i+3]/255,options.threshold??.45,options.feather??.12)*255;data[i+3]=previous?Math.round(a*(1-smooth)+previous[i+3]*smooth):Math.round(a);data[i]=data[i+1]=data[i+2]=255;}
  return data;
}
