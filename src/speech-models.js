const BASE='https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';

export const SPEECH_MODELS=Object.freeze([
  {id:'tiny',label:'Whisper tiny',bytes:75*1024**2,sha1:'bd577a113a864445d4c299885e0cb97d4ba92b5f',quality:1,browser:true,description:'最快，適合先產生草稿'},
  {id:'base',label:'Whisper base',bytes:142*1024**2,sha1:'465707469ff3a37a2b9b8d8f89f2f99de7299dac',quality:2,browser:true,description:'速度與正確率平衡'},
  {id:'small',label:'Whisper small',bytes:466*1024**2,sha1:'55356645c2b361a969dfd0ef2c5a50d530afd8d5',quality:3,browser:true,description:'瀏覽器建議的最高品質'},
  {id:'large-v3-turbo-q5_0',label:'Whisper large-v3 turbo（量化）',bytes:547*1024**2,sha1:'e050f7970618a659205450ad97eb95a18d69c9ee',quality:4,browser:false,description:'桌面版推薦，品質高且較省空間'},
  {id:'large-v3-turbo',label:'Whisper large-v3 turbo',bytes:1.5*1024**3,sha1:'4af2b29d7ec73d781377bfd1758ca957a807e941',quality:5,browser:false,description:'桌面版高品質、速度較 large-v3 快'},
  {id:'large-v3',label:'Whisper large-v3',bytes:2.9*1024**3,sha1:'ad82bf6a9043ceed055076d0fd39f5f186ff8062',quality:6,browser:false,description:'桌面版最高品質，下載與辨識最久'}
].map(model=>Object.freeze({...model,url:`${BASE}ggml-${model.id}.bin`})));

export function modelById(id){const model=SPEECH_MODELS.find(item=>item.id===id);if(!model)throw new Error('不支援的語音模型');return model;}
export const browserModelSupported=id=>Boolean(SPEECH_MODELS.find(model=>model.id===id)?.browser);
export const formatModelSize=bytes=>bytes>=1024**3?`${(bytes/1024**3).toFixed(1)} GB`:`${Math.round(bytes/1024**2)} MB`;
