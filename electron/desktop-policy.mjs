export function desktopVisibility({enabled,shown,cameraVisible,cameraReady,notesVisible,kind}){
  const desktop=Boolean(enabled&&shown);
  return {main:!desktop,toolbar:desktop,camera:desktop&&Boolean(cameraVisible&&cameraReady),notes:desktop&&Boolean(notesVisible),overlay:desktop&&kind!=='slides'};
}
export function protectCaptureWindow({kind,includeChrome},role){
  // The annotation overlay is already drawn onto the source canvas; never capture it twice.
  return role==='overlay'||(kind==='screen'&&!includeChrome);
}
