# EduVideo browser Whisper runtime

`libmain.js` and `libmain.wasm` are built from whisper.cpp v1.8.3, commit `2eeeba56e9edd762b4b38467bab96c2517163158`, using its `examples/whisper.wasm` target and Emscripten. The runtime is MIT licensed; see `LICENSE-whisper.cpp`.

Model weights are not bundled. The browser UI can download or import multilingual tiny, base, or small ggml weights and stores them in IndexedDB. Inference uses the official asynchronous pthread bridge on the page, so the UI stays responsive. The server must provide cross-origin isolation headers for WebAssembly shared memory.
