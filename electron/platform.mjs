// Pure helpers for OS differences, kept free of Electron imports so they can be unit tested.
export const whisperExecutable=(platform=process.platform)=>platform==='win32'?'whisper-cli.exe':'whisper-cli';

// Binaries inside app.asar cannot be spawned; electron-builder unpacks them beside it. Windows paths use backslashes.
export const unpackedPath=path=>path.replace(/app\.asar(?=[\\/])/,'app.asar.unpacked');

// whisper-cli reads argv in the Windows ANSI code page, which breaks non-ASCII paths and the zh prompt.
// A UTF-8 response file plus relative audio/output names inside the working directory avoids that on every OS;
// the model path stays absolute because whisper.cpp opens it through a UTF-8 → wide conversion.
export function whisperResponseFile({model,audio,output,language,prompt}){
  const args=['-m',model,'-f',audio,'-l',language,'-ojf','-of',output,'-ml','0','-pp','-sns'];
  if(prompt)args.push('--prompt',prompt);
  if(args.some(arg=>/[\r\n]/.test(arg)))throw new Error('語音辨識參數不可包含換行');
  return args.join('\n')+'\n';
}

// macOS shows .eduv as a single package; elsewhere it is a plain folder, and a dialog cannot pick both files and folders.
export const openProjectDialogProperties=(platform=process.platform)=>platform==='darwin'?['openFile','openDirectory','treatPackageAsDirectory']:['openDirectory'];

// Windows and Linux pass a double-clicked or dropped project as a command-line argument instead of the open-file event.
export function projectPathFromArgv(argv=[]){
  return argv.slice(1).reverse().find(arg=>typeof arg==='string'&&!arg.startsWith('-')&&/\.(eduv|eduvideo|zip)[\\/]?$/i.test(arg))?.replace(/[\\/]$/,'')??null;
}
