import {randomUUID} from 'node:crypto';

// whisper.cpp writes tokenizer byte fragments as JSON strings. Individual
// fragments can split a UTF-8 character; decoding the whole file as UTF-8
// first permanently replaces those bytes with U+FFFD.
export function parseWhisperJson(bytes){
  const result=JSON.parse(Buffer.from(bytes).toString('latin1'));
  const utf8=new TextDecoder('utf-8',{fatal:true}),decode=text=>Buffer.from(text,'latin1').toString('utf8');
  for(const segment of result.transcription||[]){
    segment.text=decode(segment.text||'');const tokens=[];let pending=[];
    const flush=()=>{if(!pending.length)return;const first=pending[0],last=pending.at(-1);tokens.push({...first,text:decode(pending.map(t=>t.text).join('')),offsets:{from:first.offsets?.from,to:last.offsets?.to}});pending=[];};
    for(const token of segment.tokens||[]){
      if(String(token.text).startsWith('[_')){flush();continue;}
      pending.push(token);
      try{utf8.decode(Buffer.from(pending.map(t=>t.text).join(''),'latin1'));flush();}catch{/* Complete this character using the next tokenizer fragment. */}
    }
    flush();segment.tokens=tokens;
  }
  return result;
}

export function whisperCues(result){
  if(!Array.isArray(result?.transcription))throw new Error('辨識結果格式無效');
  return result.transcription.map(c=>({id:randomUUID(),start:Number(c.offsets?.from)/1000,end:Number(c.offsets?.to)/1000,text:String(c.text||'').trim(),words:(c.tokens||[]).filter(t=>!String(t.text).startsWith('[_')).map(t=>({text:String(t.text||''),start:Number(t.offsets?.from)/1000,end:Number(t.offsets?.to)/1000})).filter(t=>Number.isFinite(t.start)&&t.start>=0&&t.end>=t.start)})).filter(c=>c.text&&Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end>c.start);
}
