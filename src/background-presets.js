export const BACKGROUND_PRESETS=[{id:'study',name:'暖色書房'},{id:'garden',name:'花園露臺'},{id:'studio',name:'簡約工作室'}].map(p=>({...p,url:new URL(`./assets/backgrounds/${p.id}.png`,import.meta.url).href}));
export function backdropUrl(layout){return BACKGROUND_PRESETS.find(p=>p.id===layout?.backgroundPreset)?.url||layout?.backgroundImage;}
