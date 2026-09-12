export function createPreviewUrls(recordings, urlApi = globalThis.URL) {
  return {
    screen: recordings?.screen ? urlApi.createObjectURL(recordings.screen) : null,
    camera: recordings?.camera ? urlApi.createObjectURL(recordings.camera) : null
  };
}
