const cueId=()=>globalThis.crypto?.randomUUID?.()||`api-${Math.random().toString(36).slice(2)}`;

export function transcriptionCues(result,duration){
  const segments=Array.isArray(result?.segments)?result.segments:[];
  if(segments.length)return segments.map(item=>({id:cueId(),start:Number(item.start),end:Number(item.end),text:String(item.text||'').trim(),words:(item.words||result.words||[]).filter(w=>w.start>=item.start&&w.end<=item.end).map(w=>({...w,text:w.text??w.word}))})).filter(item=>item.text&&Number.isFinite(item.start)&&Number.isFinite(item.end)&&item.end>item.start);
  const text=String(result?.text||'').trim();if(!text)throw new Error('API 沒有回傳可用的逐字稿');
  return [{id:cueId(),start:0,end:Math.max(.1,Number(duration)||1),text,words:(result.words||[]).map(w=>({...w,text:w.text??w.word}))}];
}

export async function transcribeWithApi(blob,{endpoint='https://api.openai.com/v1/audio/transcriptions',apiKey,model='gpt-4o-transcribe',language='zh',duration,signal}={}){
  if(!(blob instanceof Blob)||!blob.size)throw new Error('沒有可辨識的聲音');if(!/^https:\/\//i.test(endpoint))throw new Error('API 網址必須使用 HTTPS');if(!apiKey)throw new Error('請輸入 API Key');
  const form=new FormData();form.append('file',blob,'camera.webm');form.append('model',model);if(language&&language!=='auto')form.append('language',language);
  if(model==='whisper-1'){form.append('response_format','verbose_json');form.append('timestamp_granularities[]','segment');form.append('timestamp_granularities[]','word');}
  else if(model.includes('diarize')){form.append('response_format','diarized_json');form.append('chunking_strategy','auto');}
  else form.append('response_format','json');
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form,signal});let result;try{result=await response.json();}catch{throw new Error(`API 回應無法讀取（HTTP ${response.status}）`);}if(!response.ok)throw new Error(result?.error?.message||`API 辨識失敗（HTTP ${response.status}）`);return transcriptionCues(result,duration);
}
