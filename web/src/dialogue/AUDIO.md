# Audio status

Every Mandarin line, reply, repair phrase and common phrase has an MP3 in `web/public/audio/zh/`,
named by `audioKey(voice, text)` in `audio.ts`. They are precached by the service worker, so playback
works offline after the first visit.

The recordings are **synthetic and unreviewed**. They were generated locally with Kokoro v1.0 ONNX,
the engine Sayback uses (`zf_xiaobei` for the other speaker, `zm_yunxi` for learner replies). They are
not native-speaker recordings. Tone sandhi, polyphonic characters (for example 一 read as yāo in phone
numbers), pacing and naturalness have not been checked by a listener. The app labels them as a guide,
not a pronunciation model. Professionally recorded or native-reviewed audio is still outstanding.

Regenerate after changing any Mandarin text: `scripts/generate-audio.py` (see its docstring). It adds
missing files and removes unreferenced ones. `dialogue.test.ts` fails if any line has no file.

Kokoro is Apache-2.0: https://github.com/hexgrad/kokoro/blob/main/LICENSE. Model files:
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 (not committed).
