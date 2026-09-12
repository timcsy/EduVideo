# On-demand offline transcription

whisper.cpp v1.8.3, commit `2eeeba56e9edd762b4b38467bab96c2517163158`, MIT license (included). Source: https://github.com/ggml-org/whisper.cpp/tree/v1.8.3

The release bundles only the native engine. Model weights are deliberately excluded from the installer. Users choose and download a model from the official `ggerganov/whisper.cpp` repository in the subtitle panel. Desktop downloads are streamed to the app data directory, checked against the official SHA-1, and atomically moved into place. Interrupted or invalid downloads are discarded. `ggml-base.bin` remains in this source directory only as a development/test fixture and is excluded by the packaging filter.

Native binary built on macOS arm64 with a macOS 15.0 deployment target, statically linking whisper/ggml and embedding the Metal library; `otool -L` shows only system frameworks/libraries. No Homebrew installation is needed on the target machine. This desktop release requires macOS 15 or newer on Apple Silicon.

Rebuild from the pinned source using:

```
cmake -S .build-whisper -B .build-whisper/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_METAL_EMBED_LIBRARY=ON -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF
cmake --build .build-whisper/build --target whisper-cli -j 6
cp .build-whisper/build/bin/whisper-cli native/speech/whisper-cli
```

Input audio is converted locally with the bundled FFmpeg to mono 16 kHz PCM WAV. Recognition returns source-time cues, clamped to the actual audio duration. Temporary working files are removed after completion/cancellation. Offline recognition uploads nothing. All model sizes can still make errors and require proofreading.
